/**
 * Standalone, exact-source audit of the three VCU EGMN entries reached by the
 * university prerequisite closure. This module is deliberately not wired to
 * the shared review or publication adapter.
 *
 * EGMN 190 and 203 are exact complete-entry structural silence. EGMN 102 has
 * two exact required formulas, including a catalog-labelled "Concurrent
 * prerequisite", but both contain an instructor-permission alternative. The
 * formula is retained losslessly and remains runtime-blocked; permission is
 * never erased to make the course-only graph look complete.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  catalogYearSeen,
  extractCourseLeafEntries,
  parseRobots,
  requisiteMarkerCounts,
  robotsAllows,
} = require('./universityPrerequisiteAcquisition');

const ARTIFACT = 'va_vcu_egmn_outside_scope_prerequisite_evidence';
const CONTRACT = 'vcu_2026_2027_egmn_exact_formula_and_structural_silence_v1';
const FORMULA = 'paths_or__conditions_and';
const SCHOOL_ID = 9229;
const SLUG = 'virginia-commonwealth-university';
const OWNER = 'va:uni:9229';
const CATALOG_YEAR = '2026-2027';
const CACHE_ROOT = path.resolve(__dirname, '../../.va-catalogs');
const EVIDENCE_PATH = path.join(
  CACHE_ROOT,
  'research/va-vcu-egmn-outside-scope-prerequisite-evidence.json',
);
const SOURCE = Object.freeze({
  route_id: 'virginia-commonwealth-university__egmn',
  official_url: 'https://bulletin.vcu.edu/azcourses/egmn/',
  cache_path:
    'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__egmn.html',
  metadata_cache_path:
    'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__egmn.json',
  robots_cache_path: 'university-prerequisites/raw/_robots/bulletin.vcu.edu.txt',
  response_sha256: 'e8781daf458905d93cf998b33488e87ad55f830e960a326608b824dc900a1142',
  response_bytes: 103695,
  robots_sha256: '7cb68a0d3fc3b70b5e94820ae1d9671871111601361a38fab7024e2b97f667ea',
  courseblock_count: 110,
  complete_entry_count: 110,
  positive_required_marker_entry_count: 67,
});
const EXPECTED = Object.freeze({
  EGMN102: Object.freeze({
    courseblock_index: 0,
    raw_entry_sha256: '45e621c88035dcb73d4ffcdc3c1bed6437085b614cfd76f781d9990d81e9c845',
    raw_entry_html_sha256:
      'ab3be9ebb9e1c0c4e2aac6ec57c397e81d2983ad81c2546a2bb34a807db6195f',
    heading_text_sha256:
      '9507338c580fd111725c7ea97be93f48fbe9322bae6c5daa3483ba683c1b2da2',
    hours: 3,
    marker_counts: Object.freeze([2, 0, 2, 4]),
    disposition: 'exact_formula_runtime_blocked',
  }),
  EGMN190: Object.freeze({
    courseblock_index: 4,
    raw_entry_sha256: '4aceccdf07f1745756443dc4a45e8873dd84ce0353447a2fc1c3e7295ea604a2',
    raw_entry_html_sha256:
      'e480fb872b30ab4bce5e5adac9bdbd6ab4f85988d5688178fe3f67bb68f6431a',
    heading_text_sha256:
      '71ce60b2ea70fbb43005c2c1f686277d5974735b94fc89410683effa01b22dcc',
    hours: 1,
    marker_counts: Object.freeze([0, 0, 0, 0]),
    disposition: 'safe_structural_none',
  }),
  EGMN203: Object.freeze({
    courseblock_index: 7,
    raw_entry_sha256: '65dc13375219b5d0bbb8fc0b2e6254c3858e8e45bb7f990d65552a4f37357405',
    raw_entry_html_sha256:
      '6bebec8e9b090b432a2fc6094215519ee5b61443ea0a0e14e3c56b89b1c8eab7',
    heading_text_sha256:
      '5536bc6fc2d2149e288ff1d96fa775e0a5b9acaa9ea903f10b34162104755e3f',
    hours: 1,
    marker_counts: Object.freeze([0, 0, 0, 0]),
    disposition: 'safe_structural_none',
  }),
});
const TARGET_CODES = Object.freeze(Object.keys(EXPECTED));
const TARGET_KEYS = Object.freeze(TARGET_CODES.map((code) => `${OWNER}:${code}`));

const PREREQUISITE_CLAUSE =
  'MATH 200 with a minimum grade of C or by permission of the instructor';
const PREREQUISITE_STATEMENT = `Prerequisite: ${PREREQUISITE_CLAUSE}.`;
const CONCURRENT_CLAUSE = 'PHYS 207 or by permission of the instructor';
const CONCURRENT_STATEMENT = `Concurrent prerequisite: ${CONCURRENT_CLAUSE}.`;
const COMBINED_REQUISITES = `${PREREQUISITE_STATEMENT} ${CONCURRENT_STATEMENT}`;

// Replaced by the first exact replay, then kept as a code pin. A source or
// disposition change must update both the artifact and this value explicitly.
const EXPECTED_FACTS_SHA256 =
  'e72d8f6fc12c8aae2922b2061b6ee539a652894dab60398ac1fbb63b95709506';

const sha256 = (value) => crypto.createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || '')))
  .digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

function assertExact(condition, label) {
  if (!condition) throw new Error(label);
}

function absoluteCachePath(relative) {
  const resolved = path.resolve(CACHE_ROOT, relative);
  if (!resolved.startsWith(`${CACHE_ROOT}${path.sep}`)) {
    throw new Error(`unsafe cache path: ${relative}`);
  }
  return resolved;
}

function defaultReadFile(relative) {
  return fs.readFileSync(absoluteCachePath(relative));
}

function uniqueSpan(text, raw, label) {
  const start = String(text || '').indexOf(raw);
  assertExact(start >= 0, `${label}:missing`);
  assertExact(String(text).indexOf(raw, start + raw.length) < 0, `${label}:not_unique`);
  return {
    raw,
    raw_sha256: sha256(raw),
    relative_start: start,
    relative_end: start + raw.length,
    source_content_preserved: true,
  };
}

function occurrenceSpans(text, raw, expectedCount, label) {
  const spans = [];
  let offset = 0;
  while (offset <= text.length) {
    const start = text.indexOf(raw, offset);
    if (start < 0) break;
    spans.push({
      raw,
      raw_sha256: sha256(raw),
      occurrence_index: spans.length,
      relative_start: start,
      relative_end: start + raw.length,
      source_content_preserved: true,
    });
    offset = start + raw.length;
  }
  assertExact(spans.length === expectedCount, `${label}:occurrence_count`);
  return spans;
}

function verifyRetainedSource(readFile = defaultReadFile) {
  const bytes = readFile(SOURCE.cache_path);
  const metadataBytes = readFile(SOURCE.metadata_cache_path);
  const robotsBytes = readFile(SOURCE.robots_cache_path);
  const metadata = JSON.parse(metadataBytes.toString('utf8'));
  assertExact(bytes.length === SOURCE.response_bytes, 'source_bytes');
  assertExact(sha256(bytes) === SOURCE.response_sha256, 'source_sha256');
  assertExact(metadata.route_id === SOURCE.route_id, 'metadata_route_id');
  assertExact(metadata.requested_url === SOURCE.official_url, 'metadata_requested_url');
  assertExact(metadata.final_url === SOURCE.official_url, 'metadata_final_url');
  assertExact(metadata.capture_status === 'official_html_captured', 'metadata_status');
  assertExact(metadata.blocked_reason == null, 'metadata_blocked_reason');
  assertExact(metadata.http_status === 200, 'metadata_http_status');
  assertExact(String(metadata.content_type || '').toLowerCase().includes('text/html'),
    'metadata_content_type');
  assertExact(metadata.byte_length === SOURCE.response_bytes, 'metadata_bytes');
  assertExact(metadata.content_sha256 === SOURCE.response_sha256, 'metadata_sha256');
  assertExact(same(metadata.target_course_codes, TARGET_CODES), 'metadata_target_codes');
  assertExact(metadata.robots?.http_status === 200, 'robots_status');
  assertExact(metadata.robots?.content_sha256 === SOURCE.robots_sha256, 'robots_receipt');
  assertExact(sha256(robotsBytes) === SOURCE.robots_sha256, 'robots_sha256');
  const robotsPolicy = parseRobots(robotsBytes.toString('utf8'));
  assertExact(robotsPolicy.crawl_delay_seconds === 0, 'robots_delay');
  assertExact(robotsAllows(robotsPolicy, new URL(SOURCE.official_url).pathname),
    'robots_disallow');

  const html = bytes.toString('utf8');
  assertExact(catalogYearSeen(html, CATALOG_YEAR), 'catalog_year');
  const extraction = extractCourseLeafEntries(html, TARGET_CODES);
  assertExact(extraction.missing.length === 0, 'missing_target');
  assertExact(extraction.ambiguous.length === 0, 'ambiguous_target');
  assertExact(extraction.entries.length === TARGET_CODES.length, 'target_count');
  assertExact(extraction.courseblock_count === SOURCE.courseblock_count,
    'source_courseblock_count');
  assertExact(extraction.complete_entry_count === SOURCE.complete_entry_count,
    'source_complete_entry_count');
  assertExact(extraction.complete_entries_with_required_requisite_marker_count
    === SOURCE.positive_required_marker_entry_count, 'source_positive_control');
  return { bytes, metadata, metadataBytes, extraction };
}

function exactFormulaGroups(entry) {
  const text = entry.raw_entry_text;
  const combined = uniqueSpan(text, COMBINED_REQUISITES, 'combined_requisites');
  const prerequisiteStatement = uniqueSpan(text, PREREQUISITE_STATEMENT,
    'prerequisite_statement');
  const concurrentStatement = uniqueSpan(text, CONCURRENT_STATEMENT,
    'concurrent_statement');
  const prerequisiteClause = uniqueSpan(text, PREREQUISITE_CLAUSE,
    'prerequisite_clause');
  const concurrentClause = uniqueSpan(text, CONCURRENT_CLAUSE, 'concurrent_clause');
  const math = uniqueSpan(text, 'MATH 200', 'math200');
  const grade = uniqueSpan(text, 'with a minimum grade of C', 'math200_grade');
  const phys = uniqueSpan(text, 'PHYS 207', 'phys207');
  const permissions = occurrenceSpans(
    text, 'by permission of the instructor', 2, 'instructor_permission',
  );
  const concurrentMarker = uniqueSpan(text, 'Concurrent prerequisite:',
    'concurrent_marker');
  const course = (code, span, extra = {}) => ({
    type: 'course',
    code,
    course_key: `${OWNER}:${code}`,
    raw: span.raw,
    raw_sha256: span.raw_sha256,
    relative_start: span.relative_start,
    relative_end: span.relative_end,
    ...extra,
  });
  const permission = (span, appliesTo) => ({
    type: 'non_course',
    condition: 'permission_of_instructor',
    raw: span.raw,
    raw_sha256: span.raw_sha256,
    relative_start: span.relative_start,
    relative_end: span.relative_end,
    authorization_kind: 'permission',
    authorization_authority: 'instructor',
    applies_to_group_kind: appliesTo,
    runtime_binding_status: 'unresolved',
  });
  const group = (kind, label, clause, statement, paths, extra = {}) => ({
    kind,
    catalog_label: label,
    raw: clause.raw,
    raw_sha256: clause.raw_sha256,
    relative_start: clause.relative_start,
    relative_end: clause.relative_end,
    statement_receipt: statement,
    formula: FORMULA,
    paths: paths.map((allOf) => ({ raw: clause.raw, all_of: allOf })),
    ...extra,
  });
  const groups = [
    group('prerequisite', 'Prerequisite', prerequisiteClause, prerequisiteStatement, [
      [course('MATH200', math, {
        minimum_grade: 'C',
        minimum_grade_evidence: grade,
      })],
      [permission(permissions[0], 'prerequisite')],
    ]),
    group('corequisite', 'Concurrent prerequisite', concurrentClause, concurrentStatement, [
      [course('PHYS207', phys, {
        concurrent_required: true,
        catalog_concurrency_label: 'Concurrent prerequisite',
      })],
      [permission(permissions[1], 'corequisite')],
    ], {
      source_semantics: 'catalog_labelled_concurrent_prerequisite',
      concurrent_required: true,
    }),
  ];
  return {
    combined,
    groups,
    constraint_signal_receipts: [grade, concurrentMarker, ...permissions]
      .sort((left, right) => left.relative_start - right.relative_start),
  };
}

function sourceProjection(entry) {
  return {
    official_url: SOURCE.official_url,
    cache_path: SOURCE.cache_path,
    source_response_sha256: SOURCE.response_sha256,
    source_response_bytes: SOURCE.response_bytes,
    boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
    catalog_year: CATALOG_YEAR,
    courseblock_index: entry.courseblock_index,
    published_units: entry.published_units,
    raw_entry_sha256: entry.raw_entry_sha256,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    raw_entry_text: entry.raw_entry_text,
    complete_entry_receipt: entry.complete_entry_receipt,
    structured_requisite_fields: entry.structured_requisite_fields,
  };
}

function verifyEntry(entry, expected) {
  assertExact(entry.courseblock_index === expected.courseblock_index,
    `${entry.course_code}:courseblock_index`);
  assertExact(entry.raw_entry_sha256 === expected.raw_entry_sha256
    && sha256(entry.raw_entry_text) === expected.raw_entry_sha256,
  `${entry.course_code}:raw_entry_sha256`);
  assertExact(entry.raw_entry_html_sha256 === expected.raw_entry_html_sha256,
    `${entry.course_code}:raw_entry_html_sha256`);
  assertExact(entry.published_units?.kind === 'published_fixed_credits'
    && entry.published_units?.credit_hours_min === expected.hours
    && entry.published_units?.credit_hours_max === expected.hours
    && entry.published_units?.heading_text_sha256 === expected.heading_text_sha256,
  `${entry.course_code}:published_units`);
  const markerCounts = requisiteMarkerCounts(entry.raw_entry_text);
  assertExact(same([
    markerCounts.required, markerCounts.corequisite,
    markerCounts.marker_like, markerCounts.constraint_like,
  ], expected.marker_counts), `${entry.course_code}:marker_counts`);
  const receipt = entry.complete_entry_receipt;
  assertExact(receipt?.receipt_contract === COURSELEAF_RECEIPT_CONTRACT
    && receipt?.source_courseblock_count === SOURCE.courseblock_count
    && receipt?.source_complete_entry_count === SOURCE.complete_entry_count
    && receipt?.source_complete_entries_with_required_requisite_marker_count
      === SOURCE.positive_required_marker_entry_count
    && receipt?.same_source_positive_control === true,
  `${entry.course_code}:complete_entry_receipt`);
  assertExact(asArray(entry.structured_requisite_fields).length === 0,
    `${entry.course_code}:unexpected_structured_fields`);
  return markerCounts;
}

function buildRows(extraction) {
  const byCode = new Map(extraction.entries.map((entry) => [entry.course_code, entry]));
  return TARGET_CODES.map((code) => {
    const expected = EXPECTED[code];
    const entry = byCode.get(code);
    assertExact(Boolean(entry), `${code}:entry`);
    const markerCounts = verifyEntry(entry, expected);
    const base = {
      school_id: SCHOOL_ID,
      slug: SLUG,
      owner_namespace: OWNER,
      course_key: `${OWNER}:${code}`,
      course_code: code,
      scope_role: 'recursive_closure',
      source: sourceProjection(entry),
      disposition: expected.disposition,
    };
    if (code === 'EGMN102') {
      const formula = exactFormulaGroups(entry);
      assertExact(formula.groups.length === markerCounts.required,
        'EGMN102:required_statement_accounting');
      assertExact(formula.constraint_signal_receipts.length === markerCounts.constraint_like,
        'EGMN102:constraint_signal_accounting');
      return {
        ...base,
        publication_status_recommendation: 'unparsed',
        review_status_recommendation: 'not_promoted',
        review_reason: 'exact_egmn_formula_preserved_but_instructor_permission_runtime_unbound',
        raw_requisites: formula.combined.raw,
        raw_requisites_receipt: formula.combined,
        groups: formula.groups,
        formula_status: 'exact_source_formula_preserved',
        course_reference_keys: [`${OWNER}:MATH200`, `${OWNER}:PHYS207`],
        incoming_course_edge_count: 2,
        non_course_condition_occurrences: 2,
        runtime_blockers: [{
          kind: 'non_course_condition_binding_required',
          condition: 'permission_of_instructor',
          occurrence_count: 2,
          formula_dropped_or_rewritten: false,
        }],
        constraint_signal_receipts: formula.constraint_signal_receipts,
        content_accounting: {
          exact_complete_present_entry: true,
          required_marker_count: markerCounts.required,
          classified_required_statement_count: formula.groups.length,
          constraint_like_signal_count: markerCounts.constraint_like,
          classified_constraint_signal_count: formula.constraint_signal_receipts.length,
          every_formula_character_preserved: true,
          non_course_alternatives_preserved: true,
          source_content_discarded: false,
        },
        inference_boundary:
          'The two Boolean formulas and both instructor-permission alternatives are exact. The formula remains publication-blocked until the non-course permission condition has an explicit runtime binding; the permission alternatives may not be deleted to leave unconditional course edges.',
      };
    }
    assertExact(Object.values(markerCounts).every((count) => count === 0),
      `${code}:structural_silence`);
    return {
      ...base,
      publication_status_recommendation: 'none',
      review_status_recommendation: 'promoted_structural_none',
      review_reason: 'exact_complete_egmn_entry_zero_required_requisite_markers',
      raw_requisites: null,
      groups: [],
      formula_status: 'structural_none_source_proved',
      course_reference_keys: [],
      incoming_course_edge_count: 0,
      structural_none_safe_for_figure6_course_graph: true,
      literal_no_requirement_statement: false,
      graph_effect: {
        added_course_vertices: 0,
        added_prerequisite_edges: 0,
        added_corequisite_edges: 0,
      },
      content_accounting: {
        exact_complete_present_entry: true,
        same_source_positive_control: true,
        required_marker_count: 0,
        corequisite_marker_count: 0,
        requisite_marker_like_count: 0,
        constraint_like_signal_count: 0,
        source_content_discarded: false,
      },
      inference_boundary:
        'Structural none is limited to this exact complete current entry and the Figure 6 prerequisite/corequisite graph. It is not a literal catalog statement that the course has no requirements.',
    };
  });
}

function buildEvidence({ readFile = defaultReadFile } = {}) {
  const verified = verifyRetainedSource(readFile);
  const rows = buildRows(verified.extraction);
  const formulaReferences = [...new Set(rows.flatMap((row) => row.course_reference_keys))].sort();
  const facts = {
    source: {
      ...SOURCE,
      catalog_year: CATALOG_YEAR,
      boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
      metadata_sha256: sha256(verified.metadataBytes),
      fetched_at: verified.metadata.fetched_at,
      same_source_positive_control: true,
    },
    target_rows: rows,
    formula_reference_keys: formulaReferences,
  };
  const factsSha256 = sha256(canonicalJson(facts));
  if (EXPECTED_FACTS_SHA256) {
    assertExact(factsSha256 === EXPECTED_FACTS_SHA256, 'facts_sha256');
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    contract: CONTRACT,
    snapshot_date: '2026-08-25',
    publication_ready: false,
    summary: {
      target_rows: rows.length,
      exact_complete_entry_rows: rows.length,
      exact_formula_rows: rows.filter(
        (row) => row.disposition === 'exact_formula_runtime_blocked',
      ).length,
      safe_structural_none_rows: rows.filter(
        (row) => row.disposition === 'safe_structural_none',
      ).length,
      runtime_blocked_rows: rows.filter((row) => row.runtime_blockers?.length).length,
      prerequisite_groups: rows.flatMap((row) => row.groups)
        .filter((group) => group.kind === 'prerequisite').length,
      corequisite_groups: rows.flatMap((row) => row.groups)
        .filter((group) => group.kind === 'corequisite').length,
      owner_local_course_reference_keys: formulaReferences.length,
      non_course_condition_occurrences: rows.reduce(
        (total, row) => total + Number(row.non_course_condition_occurrences || 0), 0,
      ),
    },
    policy: {
      exact_formula:
        'Every formula character and alternative is retained from one exact complete entry; a non-course permission alternative keeps the row runtime-blocked.',
      structural_none:
        'Only an exact complete entry with zero requisite and constraint markers plus a same-source positive control is classified as Figure 6 structural none.',
      scope:
        'This standalone evidence does not modify the shared review, prerequisite graph, release gate, documentation, or database.',
    },
    facts,
    facts_sha256: factsSha256,
  };
}

function evidenceIssues(evidence, options = {}) {
  const issues = [];
  if (evidence?.schema_version !== 1) issues.push('schema_version');
  if (evidence?.artifact !== ARTIFACT) issues.push('artifact');
  if (evidence?.contract !== CONTRACT) issues.push('contract');
  if (evidence?.publication_ready !== false) issues.push('publication_ready');
  if (evidence?.facts_sha256 !== sha256(canonicalJson(evidence?.facts))) {
    issues.push('facts_sha256');
  }
  if (EXPECTED_FACTS_SHA256 && evidence?.facts_sha256 !== EXPECTED_FACTS_SHA256) {
    issues.push('facts_sha256_pin');
  }
  try {
    const rebuilt = buildEvidence(options);
    if (!same(evidence, rebuilt)) issues.push('artifact_replay');
  } catch (error) {
    issues.push(`source_replay:${error.message}`);
  }
  return [...new Set(issues)];
}

function loadEvidenceArtifact() {
  return JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
}

function factRowIssues(row, evidence = loadEvidenceArtifact()) {
  if (!TARGET_KEYS.includes(row?.course_key)) return ['not_scoped'];
  const artifactIssues = evidenceIssues(evidence);
  if (artifactIssues.length) {
    return artifactIssues.map((issue) => `evidence:${issue}`);
  }
  const expected = asArray(evidence?.facts?.target_rows)
    .find((candidate) => candidate.course_key === row?.course_key);
  if (!expected) return ['missing_evidence_row'];
  return same(row, expected) ? [] : ['row_replay'];
}

function evidenceRow(evidence, courseKey) {
  return asArray(evidence?.facts?.target_rows)
    .find((row) => row.course_key === courseKey);
}

function isScopedVcuEgmnPrerequisite(candidate) {
  return TARGET_KEYS.includes(candidate?.course_key);
}

function candidateIssues(candidate, evidence = loadEvidenceArtifact()) {
  if (!isScopedVcuEgmnPrerequisite(candidate)) return ['not_scoped'];
  const row = evidenceRow(evidence, candidate.course_key);
  const source = candidate?.source || {};
  const issues = evidenceIssues(evidence);
  if (candidate?.school_id !== row?.school_id || candidate?.slug !== row?.slug
      || candidate?.owner_namespace !== row?.owner_namespace
      || candidate?.course_code !== row?.course_code) issues.push('identity');
  if (source.official_url !== row?.source?.official_url
      || source.cache_path !== row?.source?.cache_path
      || source.source_response_sha256 !== row?.source?.source_response_sha256
      || source.source_response_bytes !== row?.source?.source_response_bytes
      || source.boundary_contract !== row?.source?.boundary_contract
      || source.raw_entry_sha256 !== row?.source?.raw_entry_sha256
      || source.raw_entry_html_sha256 !== row?.source?.raw_entry_html_sha256
      || source.raw_entry_text !== row?.source?.raw_entry_text
      || !same(source.published_units, row?.source?.published_units)
      || !same(source.complete_entry_receipt, row?.source?.complete_entry_receipt)
      || !same(source.structured_requisite_fields, row?.source?.structured_requisite_fields)) {
    issues.push('source_receipt');
  }
  return [...new Set(issues)];
}

function proof(row) {
  return {
    kind: row.disposition === 'safe_structural_none'
      ? 'exact_complete_egmn_entry_structural_none'
      : 'exact_egmn_formula_runtime_blocker',
    contract: CONTRACT,
    course_key: row.course_key,
    source: row.source,
    content_accounting: row.content_accounting,
    graph_effect: row.graph_effect || null,
    inference_boundary: row.inference_boundary,
  };
}

function resolveVcuEgmnPrerequisite(candidate, evidence = loadEvidenceArtifact()) {
  if (!isScopedVcuEgmnPrerequisite(candidate)) {
    return { applicable: false, ready: false, blocked: false, issues: [] };
  }
  const row = evidenceRow(evidence, candidate.course_key);
  const issues = candidateIssues(candidate, evidence);
  if (issues.length) return {
    applicable: true,
    ready: false,
    blocked: row.disposition === 'exact_formula_runtime_blocked',
    issues,
    review_reason: 'vcu_egmn_exact_source_receipt_changed',
  };
  if (row.disposition === 'exact_formula_runtime_blocked') return {
    applicable: true,
    ready: false,
    blocked: true,
    issues: [],
    review_reason: row.review_reason,
    raw_requisites: row.raw_requisites,
    preserved_source_formulas: row.groups,
    preserved_signals: row.constraint_signal_receipts,
    blocker_evidence: {
      ...proof(row),
      source_formulas: row.groups,
      course_reference_keys: row.course_reference_keys,
      runtime_blockers: row.runtime_blockers,
      non_course_condition_occurrences: row.non_course_condition_occurrences,
      prerequisite_formula_inferred: false,
      structural_none_inferred: false,
      partial_course_edges_emitted: false,
    },
  };
  return {
    applicable: true,
    ready: true,
    blocked: false,
    issues: [],
    status: 'none',
    raw_requisites: null,
    groups: [],
    review_status: 'promoted_structural_none',
    review_reason: row.review_reason,
    ignored_nonrequired_requisites: [],
    proof: {
      ...proof(row),
      literal_none_statement: false,
      same_source_positive_control: true,
    },
  };
}

function replayCandidateFromReviewRow(row) {
  const source = row?.review_evidence || {};
  return {
    school_id: row?.school_id,
    slug: row?.slug,
    owner_namespace: row?.owner_namespace,
    course_key: row?.course_key,
    course_code: row?.code,
    source: {
      official_url: source.official_url,
      cache_path: source.cache_path,
      source_response_sha256: source.source_response_sha256,
      source_response_bytes: source.source_response_bytes,
      boundary_contract: source.boundary_contract,
      raw_entry_sha256: source.raw_entry_sha256,
      raw_entry_html_sha256: source.raw_entry_html_sha256,
      raw_entry_text: source.raw_entry_text,
      published_units: source.published_units,
      complete_entry_receipt: source.complete_entry_receipt,
      structured_requisite_fields: source.structured_requisite_fields,
    },
  };
}

function resolutionRowIssues(row, evidence = loadEvidenceArtifact()) {
  if (!isScopedVcuEgmnPrerequisite(row)) return [];
  const expected = evidenceRow(evidence, row.course_key);
  const resolved = resolveVcuEgmnPrerequisite(replayCandidateFromReviewRow(row), evidence);
  const issues = [];
  if (expected.disposition === 'exact_formula_runtime_blocked') {
    if (resolved.ready || !resolved.blocked || row.status !== 'unparsed'
        || row.review_status !== 'not_promoted'
        || row.review_reason !== expected.review_reason
        || row.raw_requisites !== resolved.raw_requisites
        || !same(row.groups, [])
        || !same(row.preserved_source_formulas, resolved.preserved_source_formulas)
        || !same(row.preserved_prerequisite_signals, resolved.preserved_signals)
        || !same(row.prerequisite_constraint_blocker_evidence,
          resolved.blocker_evidence)) issues.push('blocked_projection');
  } else if (!resolved.ready) issues.push('source_receipt');
  else if (row.status !== 'none' || row.review_status !== 'promoted_structural_none'
      || row.review_reason !== expected.review_reason
      || row.raw_requisites !== null || !same(row.groups, [])
      || !same(row.structural_none_evidence, resolved.proof)) {
    issues.push('structural_none_projection');
  }
  return issues;
}

module.exports = {
  ARTIFACT,
  CACHE_ROOT,
  CATALOG_YEAR,
  CONTRACT,
  EVIDENCE_PATH,
  EXPECTED,
  EXPECTED_FACTS_SHA256,
  FORMULA,
  OWNER,
  SOURCE,
  TARGET_CODES,
  TARGET_KEYS,
  buildEvidence,
  candidateIssues,
  canonicalJson,
  defaultReadFile,
  evidenceIssues,
  exactFormulaGroups,
  factRowIssues,
  isScopedVcuEgmnPrerequisite,
  loadEvidenceArtifact,
  replayCandidateFromReviewRow,
  resolutionRowIssues,
  resolveVcuEgmnPrerequisite,
  sha256,
  verifyRetainedSource,
};
