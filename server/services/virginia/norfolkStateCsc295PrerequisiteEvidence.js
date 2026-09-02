/**
 * Exact source-bound resolution for Norfolk State CSC 295.
 *
 * The official entry expresses its prerequisite in a narrative sentence
 * instead of CourseLeaf's normal `Prerequisites:` field.  The same exact,
 * hash-pinned response uniquely publishes CSC 260 as "Computer Programming
 * II".  Preserve the source's disjunction literally: CSC 260 OR the typed
 * non-course condition "equivalent knowledge".
 */

const crypto = require('node:crypto');

const CONTRACT = 'nsu_2025_2026_csc295_narrative_prerequisite_disjunction_v1';
const SCHOOL_ID = 9217;
const SLUG = 'norfolk-state-university';
const OWNER = 'va:uni:9217';
const COURSE_CODE = 'CSC295';
const COURSE_KEY = `${OWNER}:${COURSE_CODE}`;
const CATALOG_YEAR = '2025-2026';
const SOURCE_URL = 'https://catalog.nsu.edu/undergraduate/course-descriptions/csc/';
const SOURCE_CACHE_PATH =
  'university-prerequisites/raw/norfolk-state-university/norfolk-state-university__csc.html';
const SOURCE_RESPONSE_SHA256 =
  'ac2b992770d615ffdeb639cee8399e88a187762cc6b94e106808216f52f30ac5';
const SOURCE_RESPONSE_BYTES = 74849;
const ROBOTS_RESPONSE_SHA256 =
  '9ea34488a311795f8883efe1bb0a049a093184e738d9c89d8086b427754ef768';
const COURSELEAF_BOUNDARY = 'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';

const RAW_ENTRY =
  'CSC 295 Java Applications Programming (3 Credits) Introduction to the core JAVA language with emphasis on application development using the latest JAVA class libraries such as Swing, JavaBeans, Java2D, Java3D. This course is designed for students who are familiar with object-oriented programming. The prerequisite course is Computer Programming II or equivalent knowledge.';
const NARRATIVE_STATEMENT =
  'The prerequisite course is Computer Programming II or equivalent knowledge.';
const RAW_ALTERNATIVES = 'Computer Programming II or equivalent knowledge';
const COURSE_ALTERNATIVE = 'Computer Programming II';
const KNOWLEDGE_ALTERNATIVE = 'equivalent knowledge';

const TARGET_RECEIPT = Object.freeze({
  courseblock_index: 13,
  raw_entry_sha256: '579dd05a5cbfff7133533ba455385b0e6ef50ecf92b8c1de209511668e493d55',
  raw_entry_html_sha256: '1f060357e12835f2710f36aa2a84d9becefe1189564906156310b3b8c546dd93',
  heading_text_sha256: '087a99aefe89c3a8e3f5543d9cf9b1310a62bf621f07165444d336fa6b66e231',
  entry_length: 373,
  statement_start: 298,
  statement_end: 373,
  alternatives_start: 325,
  alternatives_end: 372,
});

const REFERENCED_COURSE_RECEIPT = Object.freeze({
  course_code: 'CSC260',
  course_key: `${OWNER}:CSC260`,
  title: 'Computer Programming II',
  courseblock_index: 7,
  heading: 'CSC 260 Computer Programming II (3 Credits)',
  raw_entry_sha256: 'ab5db463e1cf4d757d6bd2dbe67d40ea5697c2cd171f5432069cb83655985e2a',
  raw_entry_html_sha256: 'a496f41711707fa1b7478fcab2cdf9d3210bcb1205ac9453d3be4ff5157cccb7',
  heading_text_sha256: 'd73ef572e28a8c67f46dd38cafbbc7ac39b54134adc626d409c7cdbf83c1489e',
  exact_matching_title_count_in_response: 1,
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));

function expectedPublishedUnits() {
  return {
    kind: 'published_fixed_credits',
    notation: '3 Credits',
    credit_hours_min: 3,
    credit_hours_max: 3,
    heading_text_sha256: TARGET_RECEIPT.heading_text_sha256,
  };
}

function expectedCompleteEntryReceipt() {
  return {
    receipt_contract: COURSELEAF_RECEIPT,
    source_courseblock_count: 52,
    source_complete_entry_count: 52,
    source_complete_entries_with_required_requisite_marker_count: 32,
    entry_required_requisite_marker_count: 0,
    entry_corequisite_marker_count: 0,
    entry_requisite_marker_like_count: 1,
    entry_constraint_like_signal_count: 0,
    same_source_positive_control: true,
  };
}

function expectedGroup() {
  return {
    id: `${COURSE_KEY}:prerequisite:0`,
    kind: 'prerequisite',
    raw: RAW_ALTERNATIVES,
    flags: [
      'strict_full_text_accounting',
      'source:norfolk-state-university',
      'nsu_csc295_exact_narrative_prerequisite_sentence',
    ],
    formula: 'paths_or__conditions_and',
    paths: [{
      id: `${COURSE_KEY}:prerequisite:0:path:0`,
      raw: COURSE_ALTERNATIVE,
      all_of: [{
        type: 'course',
        code: REFERENCED_COURSE_RECEIPT.course_code,
        course_key: REFERENCED_COURSE_RECEIPT.course_key,
        raw: COURSE_ALTERNATIVE,
      }],
    }, {
      id: `${COURSE_KEY}:prerequisite:0:path:1`,
      raw: KNOWLEDGE_ALTERNATIVE,
      all_of: [{
        type: 'non_course',
        condition: 'equivalent_knowledge',
        raw: KNOWLEDGE_ALTERNATIVE,
      }],
    }],
  };
}

function expectedProof() {
  return {
    contract: CONTRACT,
    owner_namespace: OWNER,
    course_key: COURSE_KEY,
    catalog_year: CATALOG_YEAR,
    source_url: SOURCE_URL,
    source_cache_path: SOURCE_CACHE_PATH,
    source_response_sha256: SOURCE_RESPONSE_SHA256,
    source_response_bytes: SOURCE_RESPONSE_BYTES,
    robots_response_sha256: ROBOTS_RESPONSE_SHA256,
    raw_entry_sha256: TARGET_RECEIPT.raw_entry_sha256,
    raw_entry_html_sha256: TARGET_RECEIPT.raw_entry_html_sha256,
    narrative_statement: {
      raw: NARRATIVE_STATEMENT,
      raw_sha256: sha256(NARRATIVE_STATEMENT),
      entry_relative_start: TARGET_RECEIPT.statement_start,
      entry_relative_end: TARGET_RECEIPT.statement_end,
    },
    alternatives: {
      raw: RAW_ALTERNATIVES,
      raw_sha256: sha256(RAW_ALTERNATIVES),
      entry_relative_start: TARGET_RECEIPT.alternatives_start,
      entry_relative_end: TARGET_RECEIPT.alternatives_end,
      connector: ' or ',
      connector_relative_start: COURSE_ALTERNATIVE.length,
      connector_relative_end: COURSE_ALTERNATIVE.length + 4,
      left: COURSE_ALTERNATIVE,
      right: KNOWLEDGE_ALTERNATIVE,
      formula_projection: 'two_paths_or_with_one_condition_per_path',
    },
    same_response_course_identity: REFERENCED_COURSE_RECEIPT,
    content_accounting: {
      statement_characters: NARRATIVE_STATEMENT.length,
      prefix_characters: NARRATIVE_STATEMENT.indexOf(RAW_ALTERNATIVES),
      alternatives_characters: RAW_ALTERNATIVES.length,
      terminal_characters: 1,
      accounted_characters: NARRATIVE_STATEMENT.length,
      source_content_discarded: false,
    },
    inference_boundary:
      'The graph preserves only the exact published disjunction. Equivalent knowledge remains a typed non-course alternative; it is not converted into CSC 260, deleted, or treated as a recommendation.',
  };
}

function targetCandidate(candidate) {
  return candidate?.school_id === SCHOOL_ID
    && candidate?.slug === SLUG
    && candidate?.owner_namespace === OWNER
    && candidate?.course_code === COURSE_CODE;
}

function candidateIssues(candidate, clauses) {
  const source = candidate?.source || {};
  const issues = [];
  const mismatch = (name, actual, expected) => {
    if (canonicalJson(actual) !== canonicalJson(expected)) issues.push(name);
  };
  if (candidate.course_key !== COURSE_KEY) issues.push('course_key');
  if (source.official_url !== SOURCE_URL) issues.push('official_url');
  if (source.catalog_year_verified !== CATALOG_YEAR) issues.push('catalog_year');
  if (source.capture_origin !== 'official_acquisition') issues.push('capture_origin');
  if (source.source_format !== 'courseleaf_courseblock') issues.push('source_format');
  if (source.boundary_contract !== COURSELEAF_BOUNDARY) issues.push('boundary_contract');
  if (source.cache_path !== SOURCE_CACHE_PATH) issues.push('cache_path');
  if (source.source_response_sha256 !== SOURCE_RESPONSE_SHA256
      || source.declared_normalized_text_sha256 !== SOURCE_RESPONSE_SHA256
      || source.retained_normalized_text_sha256 !== SOURCE_RESPONSE_SHA256) {
    issues.push('source_response_sha256');
  }
  if (source.source_response_bytes !== SOURCE_RESPONSE_BYTES) issues.push('source_response_bytes');
  if (source.courseblock_index !== TARGET_RECEIPT.courseblock_index) issues.push('courseblock_index');
  if (source.raw_entry_text !== RAW_ENTRY
      || source.raw_entry_sha256 !== TARGET_RECEIPT.raw_entry_sha256
      || sha256(String(source.raw_entry_text || '')) !== TARGET_RECEIPT.raw_entry_sha256) {
    issues.push('raw_entry');
  }
  if (source.raw_entry_html_sha256 !== TARGET_RECEIPT.raw_entry_html_sha256) {
    issues.push('raw_entry_html_sha256');
  }
  if (source.character_start !== 0 || source.character_end !== TARGET_RECEIPT.entry_length) {
    issues.push('entry_boundary');
  }
  if (source.raw_entry_text?.slice(
    TARGET_RECEIPT.statement_start, TARGET_RECEIPT.statement_end,
  ) !== NARRATIVE_STATEMENT || source.raw_entry_text?.slice(
    TARGET_RECEIPT.alternatives_start, TARGET_RECEIPT.alternatives_end,
  ) !== RAW_ALTERNATIVES) issues.push('narrative_span');
  mismatch('published_units', source.published_units, expectedPublishedUnits());
  mismatch('complete_entry_receipt', source.complete_entry_receipt, expectedCompleteEntryReceipt());
  mismatch('structured_requisite_fields', source.structured_requisite_fields, []);
  if (!Array.isArray(clauses) || clauses.length !== 0) issues.push('unexpected_formal_clause');
  return issues;
}

function resolveNorfolkStateCsc295Prerequisite(candidate, clauses) {
  if (!targetCandidate(candidate)) return { applicable: false, ready: false, issues: [] };
  const issues = candidateIssues(candidate, clauses);
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues,
    review_reason: 'nsu_csc295_exact_narrative_prerequisite_receipt_changed',
  };
  return {
    applicable: true,
    ready: true,
    issues: [],
    raw_requisites: NARRATIVE_STATEMENT,
    groups: [expectedGroup()],
    proof: expectedProof(),
    review_reason: 'exact_nsu_csc295_narrative_prerequisite_disjunction',
  };
}

function resolutionRowIssues(row) {
  if (row?.owner_namespace !== OWNER || row?.code !== COURSE_CODE) return [];
  const issues = [];
  if (row.course_key !== COURSE_KEY) issues.push('course_key');
  if (row.status !== 'parsed' || row.review_status !== 'promoted_strict_formula'
      || row.review_reason !== 'exact_nsu_csc295_narrative_prerequisite_disjunction') {
    issues.push('review_status');
  }
  if (row.catalog_year !== CATALOG_YEAR || row.source_url !== SOURCE_URL
      || row.source_content_sha256 !== TARGET_RECEIPT.raw_entry_sha256
      || row.source_evidence?.content_sha256 !== TARGET_RECEIPT.raw_entry_sha256
      || row.source_evidence?.raw_text !== RAW_ENTRY) issues.push('source_binding');
  if (row.raw_requisites !== NARRATIVE_STATEMENT) issues.push('raw_requisites');
  if (canonicalJson(row.groups) !== canonicalJson([expectedGroup()])) issues.push('formula');
  if (canonicalJson(row.norfolk_state_csc295_resolution) !== canonicalJson(expectedProof())) {
    issues.push('proof');
  }
  if (row.norfolk_state_csc295_resolution?.content_accounting?.source_content_discarded
      !== false) issues.push('content_accounting');
  return issues;
}

module.exports = {
  CONTRACT,
  COURSE_CODE,
  COURSE_KEY,
  NARRATIVE_STATEMENT,
  RAW_ALTERNATIVES,
  REFERENCED_COURSE_RECEIPT,
  ROBOTS_RESPONSE_SHA256,
  SOURCE_CACHE_PATH,
  SOURCE_RESPONSE_SHA256,
  SOURCE_URL,
  TARGET_RECEIPT,
  expectedGroup,
  expectedProof,
  resolutionRowIssues,
  resolveNorfolkStateCsc295Prerequisite,
  sha256,
};
