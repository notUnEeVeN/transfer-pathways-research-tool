#!/usr/bin/env node
/**
 * Replay the retained official VSU CourseLeaf responses and build the finite
 * Figure 6 prerequisite/corequisite remediation artifact.  This script never
 * opens MongoDB and never uses a missing search result as prerequisite proof.
 */

const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const {
  extractCourseLeafEntries,
} = require('../../services/virginia/universityPrerequisiteAcquisition');
const {
  ARTIFACT,
  CATALOG_YEAR,
  CONTRACT,
  COURSELEAF_BOUNDARY,
  DECISIONS,
  EVIDENCE_PATH,
  OWNER,
  SLUG,
  TARGET_CODES,
  artifactIssues,
  canonicalJson,
  sha256,
} = require('../../services/virginia/virginiaStatePrerequisiteClosureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const CACHE = path.join(SERVER, '.va-catalogs');
const CANDIDATES = path.join(
  CACHE, 'research', 'va-university-prerequisite-candidates.json',
);
const RAW_DIR = path.join(
  CACHE, 'university-prerequisites', 'raw', 'virginia-state-university',
);
const ROBOTS_SHA256 =
  '8ba3a5e25335b7e343ff1331a044873101011acdafde82726af28c9a9a02b365';
const CATALOG_LABEL = '2026-2027 Academic Catalog Homepage';
const POSITIVE_CONTROL_CODE = 'CSCI281';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

function pagePaths(pageId) {
  const stem = `virginia-state-university__${pageId}`;
  return {
    html: path.join(RAW_DIR, `${stem}.html`),
    metadata: path.join(RAW_DIR, `${stem}.json`),
    cache_path: `university-prerequisites/raw/virginia-state-university/${stem}.html`,
  };
}

function candidateProjection(row) {
  const source = row.source;
  return {
    course_code: row.course_code,
    page_id: DECISIONS[row.course_code].page,
    disposition: DECISIONS[row.course_code].disposition,
    decision_sha256: sha256(canonicalJson(DECISIONS[row.course_code])),
    courseblock_index: source.courseblock_index,
    raw_entry_length: source.raw_entry_text.length,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    published_units: source.published_units,
    complete_entry_receipt: source.complete_entry_receipt,
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
  };
}

function buildFromRetainedSources() {
  const candidateArtifact = readJson(CANDIDATES);
  const candidates = candidateArtifact.candidates.filter((row) => (
    row.slug === SLUG && TARGET_CODES.includes(row.course_code)
  )).sort((left, right) => left.course_code.localeCompare(right.course_code));
  if (candidates.length !== TARGET_CODES.length
      || candidates.some((row, index) => row.course_code !== [...TARGET_CODES].sort()[index])) {
    throw new Error('the exact 26 direct + 1 closure VSU candidate inventory is incomplete or changed');
  }
  const candidateByCode = new Map(candidates.map((row) => [row.course_code, row]));
  const pageIds = [...new Set(Object.values(DECISIONS).map((row) => row.page))].sort();
  const sourcePages = [];
  const extractedByCode = new Map();
  let csciPositiveControl = null;
  let mathBoundary = null;

  for (const pageId of pageIds) {
    const files = pagePaths(pageId);
    const bytes = fs.readFileSync(files.html);
    const metadata = readJson(files.metadata);
    const responseSha256 = sha256(bytes);
    const expectedUrl = `https://catalog.vsu.edu/undergraduate/courses/${pageId}/`;
    if (metadata.requested_url !== expectedUrl || metadata.final_url !== expectedUrl
        || metadata.http_status !== 200
        || !String(metadata.content_type || '').toLowerCase().includes('text/html')
        || metadata.content_sha256 !== responseSha256
        || metadata.byte_length !== bytes.length
        || metadata.robots?.url !== 'https://catalog.vsu.edu/robots.txt'
        || metadata.robots?.http_status !== 200
        || metadata.robots?.content_sha256 !== ROBOTS_SHA256) {
      throw new Error(`${pageId}: retained HTTP/robots receipt changed`);
    }
    const $ = cheerio.load(bytes);
    const catalogLabel = normalize($('.site-title a').text());
    const documentTitle = normalize($('title').text());
    if (catalogLabel !== CATALOG_LABEL
        || !documentTitle.endsWith('| Virginia State University Catalog')) {
      throw new Error(`${pageId}: exact VSU catalog edition/title marker changed`);
    }
    const pageCodes = TARGET_CODES.filter((code) => DECISIONS[code].page === pageId);
    const extraCodes = pageId === 'csci' ? [POSITIVE_CONTROL_CODE]
      : (pageId === 'math' ? ['MATH200', 'MATH260'] : []);
    const extraction = extractCourseLeafEntries(bytes, [...pageCodes, ...extraCodes]);
    if (extraction.ambiguous.length
        || pageCodes.some((code) => extraction.missing.includes(code))) {
      throw new Error(`${pageId}: exact target courseblock boundary changed`);
    }
    for (const entry of extraction.entries.filter((row) => pageCodes.includes(row.course_code))) {
      extractedByCode.set(entry.course_code, entry);
    }
    if (pageId === 'csci') {
      const control = extraction.entries.find((row) => row.course_code === POSITIVE_CONTROL_CODE);
      if (!control || control.requisite_marker_counts.required !== 1) {
        throw new Error('CSCI 281 same-catalog positive control changed');
      }
      csciPositiveControl = {
        ...exactEntryProjection(control),
        raw_entry_text: control.raw_entry_text,
        requisite_marker_counts: control.requisite_marker_counts,
        source_response_sha256: responseSha256,
        official_url: expectedUrl,
      };
    }
    if (pageId === 'math') {
      const math260 = extraction.entries.find((row) => row.course_code === 'MATH260');
      if (!extraction.missing.includes('MATH200') || !math260) {
        throw new Error('current MATH 200 absence / MATH 260 presence boundary changed');
      }
      mathBoundary = {
        source_response_sha256: responseSha256,
        exact_math200_entry_count: 0,
        exact_math260_entry_count: 1,
        math260: exactEntryProjection(math260),
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
      source_complete_entries_with_required_requisite_marker_count:
        extraction.complete_entries_with_required_requisite_marker_count,
    });
  }

  const targetRows = candidates.map((candidate) => {
    const projected = candidateProjection(candidate);
    const extracted = exactEntryProjection(extractedByCode.get(candidate.course_code));
    const { course_code: ignoredCode, ...extractedReceipt } = extracted;
    const { course_code: ignoredCandidateCode, disposition: ignoredDisposition,
      decision_sha256: ignoredDecision, page_id: ignoredPage, ...candidateReceipt } = projected;
    if (canonicalJson(candidateReceipt) !== canonicalJson(extractedReceipt)) {
      throw new Error(`${candidate.course_code}: candidate does not replay from retained HTML`);
    }
    return projected;
  });

  if (!csciPositiveControl || !mathBoundary) {
    throw new Error('cross-page marker or PHYS 112 conflict controls are incomplete');
  }
  const facts = {
    source_pages: sourcePages,
    same_catalog_positive_control: {
      kind: 'exact_current_vsu_courseleaf_prerequisite_marker_control',
      catalog_year: CATALOG_YEAR,
      owner_namespace: OWNER,
      catalog_label: CATALOG_LABEL,
      course_code: POSITIVE_CONTROL_CODE,
      source_response_sha256: csciPositiveControl.source_response_sha256,
      raw_entry_sha256: csciPositiveControl.raw_entry_sha256,
      raw_entry_html_sha256: csciPositiveControl.raw_entry_html_sha256,
      courseblock_index: csciPositiveControl.courseblock_index,
      formal_required_prerequisite_marker_count:
        csciPositiveControl.requisite_marker_counts.required,
      raw_entry_text: csciPositiveControl.raw_entry_text,
      target_pages_with_same_response_positive_control:
        sourcePages.filter((row) => (
          row.source_complete_entries_with_required_requisite_marker_count > 0
        )).map((row) => row.page_id),
      target_pages_using_cross_page_same_catalog_control:
        sourcePages.filter((row) => (
          row.source_complete_entries_with_required_requisite_marker_count === 0
        )).map((row) => row.page_id),
    },
    current_math_subject_boundary: mathBoundary,
    target_rows: targetRows,
  };
  const publicationBlocker = {
    course_key: `${OWNER}:PHYS112`,
    status: 'blocked_conflicting_current_catalog_reference',
    phys112_source_response_sha256:
      candidateByCode.get('PHYS112').source.source_response_sha256,
    phys112_raw_entry_sha256: candidateByCode.get('PHYS112').source.raw_entry_sha256,
    referenced_course_code: 'MATH200',
    current_math_subject_response_sha256: mathBoundary.source_response_sha256,
    current_math_subject_exact_entry_count_for_math200:
      mathBoundary.exact_math200_entry_count,
    current_math_subject_exact_entry_count_for_math260:
      mathBoundary.exact_math260_entry_count,
    current_math260_raw_entry_sha256: mathBoundary.math260.raw_entry_sha256,
    alias_inferred: false,
    authority_needed:
      'Virginia State University Registrar or Physics/Mathematics catalog owner must identify the intended current Calculus I course code for PHYS 112.',
  };
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
      source_proven_parsed_rows:
        targetRows.filter((row) => row.disposition === 'parsed').length,
      source_proven_structural_none_rows:
        targetRows.filter((row) => row.disposition === 'none').length,
      blocked_rows: targetRows.filter((row) => row.disposition === 'blocked').length,
      retained_source_pages: sourcePages.length,
      dropped_source_signals: 0,
      inferred_course_aliases: 0,
    },
    policy: {
      prerequisite_silence:
        'Only an exact present complete CourseLeaf courseblock in the hash-pinned current catalog may establish incoming-prerequisite silence; same-response or same-catalog positive marker controls are mandatory.',
      corequisites:
        'Distinct-course corequisites become exact formula groups. Same-code and unnumbered integrated laboratory components remain span-bound evidence and never become invented self-edges.',
      non_course_conditions:
        'Enrollment restrictions become non-course formula conditions; descriptive, outbound, activity, certificate, and anti-credit statements remain span-bound non-graph evidence.',
      conflicts:
        'A current reference absent from the complete current owner subject page remains blocked; a nearby code/title never creates an inferred alias.',
    },
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
    publication_blockers: [publicationBlocker],
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
    throw new Error('retained VSU prerequisite closure evidence artifact drifted');
  }
  const artifact = JSON.parse(rendered);
  const issues = artifactIssues(artifact).filter((issue) => issue !== 'facts_sha256_pin');
  if (issues.length) throw new Error(`VSU prerequisite closure evidence invalid: ${issues.join(', ')}`);
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Virginia State prerequisite closure evidence: PASS');
    console.log(`  exact rows: ${artifact.summary.exact_target_rows}`);
    console.log(`  parsed/none/blocked: ${artifact.summary.source_proven_parsed_rows}/${artifact.summary.source_proven_structural_none_rows}/${artifact.summary.blocked_rows}`);
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
  buildFromRetainedSources,
  main,
  pagePaths,
  renderArtifact,
};
