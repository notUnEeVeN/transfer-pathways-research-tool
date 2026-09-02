#!/usr/bin/env node
/**
 * Replay the retained official Norfolk State 2025-2026 CourseLeaf responses
 * and build the finite direct/recursive prerequisite closure evidence.
 *
 * Local artifacts only: this script never opens MongoDB and never infers a
 * prerequisite from a missing search result.
 */

const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const {
  extractCourseLeafEntries,
} = require('../../services/virginia/universityPrerequisiteAcquisition');
const {
  REFERENCED_COURSE_RECEIPT: CSC295_REFERENCED_COURSE_RECEIPT,
} = require('../../services/virginia/norfolkStateCsc295PrerequisiteEvidence');
const {
  ARTIFACT,
  CATALOG_YEAR,
  CLOSURE_CODES,
  CONTRACT,
  COURSELEAF_BOUNDARY,
  DECISIONS,
  DIRECT_REMEDIATION_CODES,
  EVIDENCE_PATH,
  MISSING_CLOSURE_CODES,
  MISSING_CLOSURE_REFERENCES,
  OWNER,
  SLUG,
  TARGET_CODES,
  artifactIssues,
  canonicalJson,
  sha256,
} = require('../../services/virginia/norfolkStatePrerequisiteClosureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const CACHE = path.join(SERVER, '.va-catalogs');
const CANDIDATES = path.join(
  CACHE, 'research', 'va-university-prerequisite-candidates.json',
);
const RAW_DIR = path.join(
  CACHE, 'university-prerequisites', 'raw', 'norfolk-state-university',
);
const ROBOTS_SHA256 =
  '9ea34488a311795f8883efe1bb0a049a093184e738d9c89d8086b427754ef768';
const CATALOG_LABEL = '2025-2026 Academic Catalog';
const POSITIVE_CONTROL_CODE = 'CSC170';
const SEQUENCE_CONTEXT_CODES = Object.freeze(['CHM221', 'CHM221L', 'CHM222L']);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeCode = (value) => String(value || '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

function requiredTexts(candidate) {
  const structured = (candidate?.source?.structured_requisite_fields || [])
    .filter((field) => field.kind === 'prerequisite')
    .map((field) => field.raw);
  if (structured.length) return structured;
  const text = String(candidate?.source?.raw_entry_text || '');
  const marker = /Prerequisites?:\s*/ig;
  const matches = [...text.matchAll(marker)];
  if (!matches.length) return [];
  if (matches.length !== 1) {
    throw new Error(`${candidate.course_code}: prerequisite marker boundary changed`);
  }
  return [text.slice(matches[0].index + matches[0][0].length)];
}

function referencedCodes(text) {
  return [...String(text || '').matchAll(/\b([A-Z]{2,8})[-\s]*(\d{2,4}[A-Z]?)\b/g)]
    .map((match) => normalizeCode(`${match[1]}${match[2]}`));
}

function headingInventory($) {
  const codes = $('.courseblock .courseblocktitle .detail-code strong').map((index, node) => (
    normalizeCode($(node).text())
  )).get().filter(Boolean);
  if (new Set(codes).size !== codes.length) {
    throw new Error('CourseLeaf complete-entry heading inventory is not unique');
  }
  return codes;
}

function pagePaths(pageId) {
  const stem = `norfolk-state-university__${pageId}`;
  return {
    html: path.join(RAW_DIR, `${stem}.html`),
    metadata: path.join(RAW_DIR, `${stem}.json`),
    cache_path: `university-prerequisites/raw/norfolk-state-university/${stem}.html`,
  };
}

function exactEntryProjection(entry) {
  return {
    course_code: entry.course_code,
    courseblock_index: entry.courseblock_index,
    raw_entry_length: entry.raw_entry_text.length,
    raw_entry_sha256: entry.raw_entry_sha256,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    published_units: entry.published_units,
    complete_entry_receipt: entry.complete_entry_receipt,
    structured_requisite_fields: entry.structured_requisite_fields,
  };
}

function candidateProjection(row) {
  const source = row.source;
  const decision = DECISIONS[row.course_code];
  return {
    course_code: row.course_code,
    page_id: decision.page,
    scope_role: decision.scope_role,
    disposition: decision.disposition,
    decision_sha256: sha256(canonicalJson(decision)),
    courseblock_index: source.courseblock_index,
    raw_entry_length: source.raw_entry_text.length,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    published_units: source.published_units,
    complete_entry_receipt: source.complete_entry_receipt,
    structured_requisite_fields: source.structured_requisite_fields,
  };
}

function buildFromRetainedSources() {
  const candidateArtifact = readJson(CANDIDATES);
  const ownerCandidates = candidateArtifact.candidates.filter((row) => (
    row.slug === SLUG && row.owner_namespace === OWNER
  ));
  const candidates = ownerCandidates.filter((row) => (
    row.slug === SLUG && TARGET_CODES.includes(row.course_code)
  )).sort((left, right) => left.course_code.localeCompare(right.course_code));
  const expectedCodes = [...TARGET_CODES].sort();
  if (candidates.length !== expectedCodes.length
      || candidates.some((row, index) => row.course_code !== expectedCodes[index])) {
    throw new Error('the exact 12 direct + 7 closure Norfolk candidate inventory changed');
  }

  const referencedByCode = new Map();
  for (const candidate of ownerCandidates) {
    for (const raw of requiredTexts(candidate)) {
      for (const code of referencedCodes(raw)) {
        const rows = referencedByCode.get(code) || [];
        rows.push({ course_code: candidate.course_code, raw });
        referencedByCode.set(code, rows);
      }
    }
  }
  const presentCodes = new Set(ownerCandidates.map((row) => row.course_code));
  if (!presentCodes.has(CSC295_REFERENCED_COURSE_RECEIPT.course_code)) {
    throw new Error('CSC295 source-bound narrative reference left the candidate inventory');
  }
  const missingReferenceCodes = [...referencedByCode]
    .filter(([code]) => !presentCodes.has(code))
    .map(([code]) => code).sort();
  if (!same(missingReferenceCodes, [...MISSING_CLOSURE_CODES].sort())) {
    throw new Error('Norfolk owner-local recursive closure reference inventory changed');
  }
  for (const code of missingReferenceCodes) {
    const actualReferrers = [...new Set(referencedByCode.get(code)
      .map((row) => row.course_code))].sort();
    const expectedReferrers = MISSING_CLOSURE_REFERENCES[code].referrers
      .map((row) => row.course_code).sort();
    if (!same(actualReferrers, expectedReferrers)) {
      throw new Error(`${code}: exact referring-course inventory changed`);
    }
  }

  const pageIds = [...new Set([
    ...Object.values(DECISIONS).map((row) => row.page),
    ...Object.values(MISSING_CLOSURE_REFERENCES).map((row) => row.absence_page),
  ])].sort();
  const sourcePages = [];
  const extractedByCode = new Map();
  const extractedByPageAndCode = new Map();
  const pageHeadingInventories = new Map();
  let sameCatalogPositiveControl = null;
  let sequenceContext = null;

  for (const pageId of pageIds) {
    const files = pagePaths(pageId);
    const bytes = fs.readFileSync(files.html);
    const metadata = readJson(files.metadata);
    const responseSha256 = sha256(bytes);
    const expectedUrl = `https://catalog.nsu.edu/undergraduate/course-descriptions/${pageId}/`;
    if (metadata.requested_url !== expectedUrl || metadata.final_url !== expectedUrl
        || metadata.http_status !== 200
        || !String(metadata.content_type || '').toLowerCase().includes('text/html')
        || metadata.content_sha256 !== responseSha256
        || metadata.byte_length !== bytes.length
        || metadata.robots?.url !== 'https://catalog.nsu.edu/robots.txt'
        || metadata.robots?.http_status !== 200
        || metadata.robots?.content_sha256 !== ROBOTS_SHA256) {
      throw new Error(`${pageId}: retained HTTP/robots receipt changed`);
    }
    const $ = cheerio.load(bytes);
    const catalogLabel = normalize($('#edition').text());
    const documentTitle = normalize($('title').text());
    if (catalogLabel !== CATALOG_LABEL
        || !documentTitle.endsWith('- Catalog - Norfolk State University')) {
      throw new Error(`${pageId}: exact Norfolk catalog edition/title marker changed`);
    }
    const pageCodes = TARGET_CODES.filter((code) => DECISIONS[code].page === pageId);
    const referrerCodes = Object.values(MISSING_CLOSURE_REFERENCES)
      .flatMap((row) => row.referrers)
      .filter((row) => row.page === pageId)
      .map((row) => row.course_code);
    const nearMatchCodes = Object.values(MISSING_CLOSURE_REFERENCES)
      .filter((row) => row.absence_page === pageId && row.distinct_near_match_code)
      .map((row) => row.distinct_near_match_code);
    const absentCodes = MISSING_CLOSURE_CODES.filter((code) => (
      MISSING_CLOSURE_REFERENCES[code].absence_page === pageId
    ));
    const extraCodes = [
      ...(pageId === 'csc' ? [POSITIVE_CONTROL_CODE] : []),
      ...(pageId === 'chm' ? SEQUENCE_CONTEXT_CODES.filter((code) => (
        !pageCodes.includes(code)
      )) : []),
      ...referrerCodes,
      ...nearMatchCodes,
    ];
    const expectedPresent = [...new Set([...pageCodes, ...extraCodes])];
    const extraction = extractCourseLeafEntries(
      bytes, [...expectedPresent, ...absentCodes],
    );
    if (extraction.ambiguous.length
        || expectedPresent.some((code) => extraction.missing.includes(code))
        || !same(extraction.missing.sort(), [...absentCodes].sort())) {
      throw new Error(`${pageId}: exact target/control courseblock boundary changed`);
    }
    const headingCodes = headingInventory($);
    const inventoryExtraction = extractCourseLeafEntries(bytes, headingCodes);
    if (inventoryExtraction.missing.length || inventoryExtraction.ambiguous.length
        || inventoryExtraction.entries.length !== headingCodes.length
        || inventoryExtraction.complete_entry_count !== headingCodes.length
        || inventoryExtraction.courseblock_count !== headingCodes.length) {
      throw new Error(`${pageId}: full CourseLeaf courseblock inventory changed`);
    }
    pageHeadingInventories.set(pageId, headingCodes);
    for (const entry of extraction.entries) {
      extractedByPageAndCode.set(`${pageId}:${entry.course_code}`, entry);
    }
    for (const entry of extraction.entries.filter((row) => pageCodes.includes(row.course_code))) {
      extractedByCode.set(entry.course_code, entry);
    }
    if (pageId === 'csc') {
      const control = extraction.entries.find((row) => (
        row.course_code === POSITIVE_CONTROL_CODE
      ));
      if (!control || control.requisite_marker_counts.required !== 1
          || control.structured_requisite_fields.length !== 1
          || control.structured_requisite_fields[0].kind !== 'prerequisite') {
        throw new Error('CSC 170 same-catalog prerequisite positive control changed');
      }
      sameCatalogPositiveControl = {
        kind: 'exact_nsu_courseleaf_same_catalog_prerequisite_marker_control',
        catalog_year: CATALOG_YEAR,
        owner_namespace: OWNER,
        same_catalog_positive_control: true,
        course_code: POSITIVE_CONTROL_CODE,
        official_url: expectedUrl,
        source_response_sha256: responseSha256,
        courseblock_index: control.courseblock_index,
        raw_entry_sha256: control.raw_entry_sha256,
        raw_entry_html_sha256: control.raw_entry_html_sha256,
        formal_required_prerequisite_marker_count:
          control.requisite_marker_counts.required,
        raw_entry_text: control.raw_entry_text,
        structured_requisite_fields: control.structured_requisite_fields,
      };
    }
    if (pageId === 'chm') {
      const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
      const rows = SEQUENCE_CONTEXT_CODES.map((code) => byCode.get(code));
      const phrase = 'Must be taken in sequence.';
      if (rows.some((row) => !row)
          || rows[1].raw_entry_text.split(phrase).length !== 2
          || rows[2].raw_entry_text.split(phrase).length !== 2
          || /[A-Z]{2,8}\s*-?\s*\d{2,4}[A-Z]?/.test(phrase)) {
        throw new Error('CHM 221L sequence ambiguity context changed');
      }
      sequenceContext = {
        sequence_statement: phrase,
        sequence_statement_sha256: sha256(phrase),
        target_entry: {
          ...exactEntryProjection(rows[1]),
          raw_entry_text: rows[1].raw_entry_text,
        },
        adjacent_entries: [rows[0], rows[2]].map((entry) => ({
          ...exactEntryProjection(entry),
          raw_entry_text: entry.raw_entry_text,
        })),
        target_sequence_statement_count: 1,
        target_sequence_statement_named_course_code_count: 0,
        sequence_direction_published: null,
      };
    }
    sourcePages.push({
      page_id: pageId,
      official_url: expectedUrl,
      cache_path: files.cache_path,
      metadata_cache_path: files.cache_path.replace(/\.html$/, '.json'),
      http_status: metadata.http_status,
      content_type: metadata.content_type,
      fetched_at: metadata.fetched_at,
      source_response_bytes: bytes.length,
      source_response_sha256: responseSha256,
      robots_url: metadata.robots.url,
      robots_response_sha256: metadata.robots.content_sha256,
      catalog_label: catalogLabel,
      document_title: documentTitle,
      boundary_contract: COURSELEAF_BOUNDARY,
      source_courseblock_count: extraction.courseblock_count,
      source_complete_entry_count: extraction.complete_entry_count,
      complete_entry_heading_code_count: headingCodes.length,
      complete_entry_heading_inventory_sha256:
        sha256(canonicalJson([...headingCodes].sort())),
      source_complete_entries_with_required_requisite_marker_count:
        extraction.complete_entries_with_required_requisite_marker_count,
    });
  }

  const missingSubjectPages = [];
  for (const pageId of [...new Set(Object.values(MISSING_CLOSURE_REFERENCES)
    .map((row) => row.expected_subject_page).filter(Boolean))].sort()) {
    const files = pagePaths(pageId);
    const bytes = fs.readFileSync(files.html);
    const metadata = readJson(files.metadata);
    const responseSha256 = sha256(bytes);
    const expectedUrl = `https://catalog.nsu.edu/undergraduate/course-descriptions/${pageId}/`;
    const $ = cheerio.load(bytes);
    const catalogLabel = normalize($('#edition').text());
    const documentTitle = normalize($('title').text());
    const pageHeading = normalize($('h1').first().text());
    const extraction = extractCourseLeafEntries(bytes, []);
    if (metadata.requested_url !== expectedUrl || metadata.final_url !== expectedUrl
        || metadata.http_status !== 404
        || !String(metadata.content_type || '').toLowerCase().includes('text/html')
        || metadata.content_sha256 !== responseSha256
        || metadata.byte_length !== bytes.length
        || metadata.robots?.url !== 'https://catalog.nsu.edu/robots.txt'
        || metadata.robots?.http_status !== 200
        || metadata.robots?.content_sha256 !== ROBOTS_SHA256
        || catalogLabel !== CATALOG_LABEL
        || documentTitle !== 'Page Not Found - Catalog - Norfolk State University'
        || pageHeading !== 'Page Not Found'
        || extraction.courseblock_count !== 0
        || extraction.complete_entry_count !== 0) {
      throw new Error(`${pageId}: retained missing-subject-page receipt changed`);
    }
    missingSubjectPages.push({
      page_id: pageId,
      official_url: expectedUrl,
      cache_path: files.cache_path,
      metadata_cache_path: files.cache_path.replace(/\.html$/, '.json'),
      http_status: metadata.http_status,
      content_type: metadata.content_type,
      fetched_at: metadata.fetched_at,
      source_response_bytes: bytes.length,
      source_response_sha256: responseSha256,
      robots_url: metadata.robots.url,
      robots_response_sha256: metadata.robots.content_sha256,
      catalog_label: catalogLabel,
      document_title: documentTitle,
      page_heading: pageHeading,
      source_courseblock_count: extraction.courseblock_count,
      source_complete_entry_count: extraction.complete_entry_count,
      inference_boundary:
        'An HTTP 404 for the expected subject URL is a source-gap receipt, not proof that the named course never existed or has no prerequisites.',
    });
  }

  const targetRows = candidates.map((candidate) => {
    const projected = candidateProjection(candidate);
    const extracted = exactEntryProjection(extractedByCode.get(candidate.course_code));
    const {
      course_code: ignoredCode,
      page_id: ignoredPage,
      scope_role: ignoredRole,
      disposition: ignoredDisposition,
      decision_sha256: ignoredDecision,
      ...candidateEntry
    } = projected;
    const { course_code: ignoredExtractedCode, ...extractedEntry } = extracted;
    if (canonicalJson(candidateEntry) !== canonicalJson(extractedEntry)) {
      throw new Error(`${candidate.course_code}: candidate does not replay from retained HTML`);
    }
    return projected;
  });

  const missingClosureReferences = MISSING_CLOSURE_CODES.map((code) => {
    const decision = MISSING_CLOSURE_REFERENCES[code];
    const absencePage = sourcePages.find((row) => row.page_id === decision.absence_page);
    const absenceInventory = pageHeadingInventories.get(decision.absence_page) || [];
    if (!absencePage || absenceInventory.includes(code)) {
      throw new Error(`${code}: missing-entry absence boundary changed`);
    }
    const referrerEntries = decision.referrers.map((referrer) => {
      const current = extractedByPageAndCode.get(`${referrer.page}:${referrer.course_code}`);
      const candidate = ownerCandidates.find((row) => (
        row.course_code === referrer.course_code
      ));
      if (!current || !candidate
          || current.raw_entry_sha256 !== candidate.source.raw_entry_sha256
          || current.raw_entry_text !== candidate.source.raw_entry_text) {
        throw new Error(`${code}: ${referrer.course_code} exact current referrer changed`);
      }
      const fields = current.structured_requisite_fields.filter((field) => (
        field.kind === 'prerequisite' && referencedCodes(field.raw).includes(code)
      ));
      if (fields.length !== 1) {
        throw new Error(`${code}: ${referrer.course_code} exact reference field changed`);
      }
      return {
        ...exactEntryProjection(current),
        course_key: `${OWNER}:${referrer.course_code}`,
        page_id: referrer.page,
        raw_entry_text: current.raw_entry_text,
        matched_required_prerequisite_field: fields[0],
      };
    });
    const nearMatch = decision.distinct_near_match_code
      ? extractedByPageAndCode.get(
        `${decision.absence_page}:${decision.distinct_near_match_code}`,
      ) : null;
    if (decision.distinct_near_match_code && !nearMatch) {
      throw new Error(`${code}: distinct near-match receipt changed`);
    }
    const missingSubjectPage = decision.expected_subject_page
      ? missingSubjectPages.find((row) => row.page_id === decision.expected_subject_page)
      : null;
    if (decision.expected_subject_page && !missingSubjectPage) {
      throw new Error(`${code}: expected subject-page blocker changed`);
    }
    return {
      course_code: code,
      course_key: `${OWNER}:${code}`,
      scope_role: 'recursive_closure_reference_without_published_entry',
      disposition: 'blocked_missing_current_official_course_entry',
      referring_course_keys: referrerEntries.map((row) => row.course_key),
      exact_referrer_entries: referrerEntries,
      absence_receipt: {
        page_id: decision.absence_page,
        official_url: absencePage.official_url,
        cache_path: absencePage.cache_path,
        catalog_year: CATALOG_YEAR,
        http_status: absencePage.http_status,
        source_response_sha256: absencePage.source_response_sha256,
        source_response_bytes: absencePage.source_response_bytes,
        boundary_contract: COURSELEAF_BOUNDARY,
        source_courseblock_count: absencePage.source_courseblock_count,
        source_complete_entry_count: absencePage.source_complete_entry_count,
        complete_entry_heading_code_count: absencePage.complete_entry_heading_code_count,
        complete_entry_heading_inventory_sha256:
          absencePage.complete_entry_heading_inventory_sha256,
        matching_complete_entry_count: 0,
      },
      expected_subject_page_receipt: missingSubjectPage,
      distinct_published_near_match: nearMatch ? {
        ...exactEntryProjection(nearMatch),
        course_key: `${OWNER}:${nearMatch.course_code}`,
        raw_entry_text: nearMatch.raw_entry_text,
      } : null,
      incoming_prerequisite_formula_inferred: false,
      course_alias_inferred: false,
      inference_boundary:
        'The bounded current official source establishes that no matching complete entry is published in the inspected catalog page. It does not establish prerequisite silence, a historical identity, or an alias; recursive closure remains blocked.',
    };
  });

  if (!sameCatalogPositiveControl || !sequenceContext) {
    throw new Error('same-catalog marker or sequence ambiguity controls are incomplete');
  }
  const facts = {
    source_pages: sourcePages,
    same_catalog_positive_control: {
      ...sameCatalogPositiveControl,
      target_pages_with_same_response_positive_control: sourcePages.filter((row) => (
        row.source_complete_entries_with_required_requisite_marker_count > 0
      )).map((row) => row.page_id),
      target_pages_using_cross_page_same_catalog_control: sourcePages.filter((row) => (
        row.source_complete_entries_with_required_requisite_marker_count === 0
      )).map((row) => row.page_id),
    },
    chm_sequence_context: sequenceContext,
    target_rows: targetRows,
    recursive_reference_inventory: {
      exact_owner_candidate_rows: ownerCandidates.length,
      exact_named_required_reference_codes: [...referencedByCode.keys()].sort(),
      exact_named_required_reference_code_count: referencedByCode.size,
      additional_source_bound_narrative_reference_codes: [
        CSC295_REFERENCED_COURSE_RECEIPT.course_code,
      ],
      additional_source_bound_narrative_references_all_published: true,
      published_candidate_reference_codes: [...referencedByCode.keys()]
        .filter((code) => presentCodes.has(code)).sort(),
      missing_candidate_reference_codes: missingReferenceCodes,
      extraction_contract:
        'exact_required_prerequisite_fields_or_unique_terminal_prerequisites_marker_then_exact_course_tokens',
    },
    missing_subject_pages: missingSubjectPages,
    missing_closure_references: missingClosureReferences,
  };
  const blocker = {
    course_key: `${OWNER}:CHM221L`,
    status: 'blocked_unnamed_sequence_requirement',
    source_response_sha256:
      candidates.find((row) => row.course_code === 'CHM221L').source.source_response_sha256,
    raw_entry_sha256:
      candidates.find((row) => row.course_code === 'CHM221L').source.raw_entry_sha256,
    sequence_statement: sequenceContext.sequence_statement,
    named_course_code_count: 0,
    sequence_direction: null,
    course_alias_or_direction_inferred: false,
    authority_needed:
      'Norfolk State Chemistry or Registrar catalog owner must identify the intended course relationship and whether it is prior, concurrent, or subsequent.',
  };
  const preservedSignalCount = Object.values(DECISIONS)
    .reduce((total, decision) => total + decision.signals.length, 0);
  const closureBlockers = missingClosureReferences.map((row) => ({
    course_key: row.course_key,
    status: row.disposition,
    referring_course_keys: row.referring_course_keys,
    absence_receipt: row.absence_receipt,
    expected_subject_page_receipt: row.expected_subject_page_receipt,
    distinct_published_near_match: row.distinct_published_near_match,
    incoming_prerequisite_formula_inferred: false,
    course_alias_inferred: false,
    authority_needed:
      'Norfolk State Registrar or the owning curriculum department must publish or identify the referenced course entry and its prerequisite statement; typo-like similarity is insufficient.',
  }));
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    contract: CONTRACT,
    snapshot_date: candidateArtifact.snapshot_date,
    catalog_year: CATALOG_YEAR,
    owner_namespace: OWNER,
    publication_ready: false,
    summary: {
      exact_target_rows: targetRows.length,
      exact_direct_remediation_rows: DIRECT_REMEDIATION_CODES.length,
      exact_recursive_closure_rows: CLOSURE_CODES.length,
      source_proven_parsed_rows:
        targetRows.filter((row) => row.disposition === 'parsed').length,
      source_proven_structural_none_rows:
        targetRows.filter((row) => row.disposition === 'none').length,
      blocked_rows: targetRows.filter((row) => row.disposition === 'blocked').length,
      publication_blocker_rows: 1 + missingClosureReferences.length,
      retained_source_pages: sourcePages.length,
      retained_missing_subject_pages: missingSubjectPages.length,
      unresolved_owner_local_reference_rows: missingClosureReferences.length,
      bounded_absent_complete_entry_rows: missingClosureReferences
        .filter((row) => row.absence_receipt.http_status === 200).length,
      unresolved_subject_page_404_rows: missingClosureReferences
        .filter((row) => row.expected_subject_page_receipt?.http_status === 404).length,
      preserved_reviewed_signals: preservedSignalCount,
      dropped_source_signals: 0,
      inferred_course_aliases_or_sequence_directions: 0,
    },
    policy: {
      prerequisite_silence:
        'Only an exact present complete CourseLeaf courseblock in the hash-pinned 2025-2026 catalog may establish incoming-prerequisite silence; same-response or same-catalog formal marker controls are mandatory.',
      content_signals:
        'Every constraint-like, grade, curriculum-placement, integrated-component, applicability, and expected-knowledge phrase in the target inventory remains exact-span evidence before a row can be structural none.',
      formulas:
        'Only exact formal prerequisite fields become OR-of-AND formula groups; descriptive readiness prose never becomes an invented edge.',
      ambiguity:
        'An unnamed sequence statement remains blocked until an authoritative source identifies both the course relationship and its direction.',
      missing_referenced_entries:
        'A required course token whose complete entry is absent from the bounded current official catalog remains an unresolved closure blocker. Absence is never promoted to status none, and typo-like near matches never become aliases without owner authority.',
    },
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
    publication_blockers: [blocker, ...closureBlockers],
  };
}

function renderArtifact() {
  return `${JSON.stringify(buildFromRetainedSources(), null, 2)}\n`;
}

function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const rendered = renderArtifact();
  if (write) fs.writeFileSync(EVIDENCE_PATH, rendered);
  else if (!jsonOnly && (!fs.existsSync(EVIDENCE_PATH)
      || fs.readFileSync(EVIDENCE_PATH, 'utf8') !== rendered)) {
    throw new Error('retained Norfolk prerequisite closure evidence artifact drifted');
  }
  const artifact = JSON.parse(rendered);
  const issues = artifactIssues(artifact).filter((issue) => issue !== 'facts_sha256_pin');
  if (issues.length) {
    throw new Error(`Norfolk prerequisite closure evidence invalid: ${issues.join(', ')}`);
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Norfolk State prerequisite closure evidence: PASS');
    console.log(`  exact direct/closure rows: ${artifact.summary.exact_direct_remediation_rows}/${artifact.summary.exact_recursive_closure_rows}`);
    console.log(`  parsed/none/blocked: ${artifact.summary.source_proven_parsed_rows}/${artifact.summary.source_proven_structural_none_rows}/${artifact.summary.blocked_rows}`);
    console.log(`  unresolved owner-local reference entries: ${artifact.summary.unresolved_owner_local_reference_rows}`);
    console.log(`  preserved reviewed signals: ${artifact.summary.preserved_reviewed_signals}`);
    console.log(`  facts SHA-256: ${artifact.facts_sha256}`);
    console.log(write ? `  wrote ${EVIDENCE_PATH}` : '  retained replay: no drift');
  }
  return artifact;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CANDIDATES,
  CATALOG_LABEL,
  POSITIVE_CONTROL_CODE,
  RAW_DIR,
  ROBOTS_SHA256,
  SEQUENCE_CONTEXT_CODES,
  buildFromRetainedSources,
  main,
  pagePaths,
  renderArtifact,
};
