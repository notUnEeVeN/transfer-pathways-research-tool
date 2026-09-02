/**
 * Exact, degree-scoped prerequisite projection for VSU ENGL 210-215.
 *
 * The 2026-2027 course entries publish two composition choices followed by
 * `and for English majors, ENGL 203`.  The Virginia paper corpus models the
 * exact base Computer Science B.S., not an English major.  This module emits
 * only the all-student composition requirements for that exact degree scope;
 * the English-major-only condition is retained, byte-bounded, and explicitly
 * marked as not emitted.  Any course, source, clause, scope, or formula drift
 * fails closed.
 */

const crypto = require('node:crypto');

const CONTRACT = 'vsu_2026_2027_cs_bs_english_major_conditional_projection_v1';
const FORMULA = 'paths_or__conditions_and';
const SCHOOL_ID = 9231;
const SLUG = 'virginia-state-university';
const OWNER = 'va:uni:9231';
const CATALOG_YEAR = '2026-2027';
const COURSE_URL = 'https://catalog.vsu.edu/undergraduate/courses/engl/';
const COURSE_CACHE_PATH =
  'university-prerequisites/raw/virginia-state-university/virginia-state-university__engl.html';
const COURSE_RESPONSE_SHA256 =
  '1d5487f804a52b83265e8a947afe3b66e4d0e50388803227d2f853d1743ae747';
const COURSE_RESPONSE_BYTES = 145416;
const COURSELEAF_BOUNDARY = 'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';

const TARGET_CODES = Object.freeze([
  'ENGL210', 'ENGL211', 'ENGL212', 'ENGL213', 'ENGL214', 'ENGL215',
]);

const COMMON_CLAUSE =
  'ENGL 110 or ENGL 112 AND ENGL 111 or ENGL 113 and for English majors, ENGL 203.';
const ENGL210_CLAUSE =
  'ENGL 110 or ENGL 112 and ENGL 111 or ENGL 113 and for English majors, ENGL 203.';
const CONDITIONAL_RAW = ' and for English majors, ENGL 203.';
const CONDITIONAL_SUBJECT_RAW = 'for English majors, ENGL 203';

const TARGET_RECEIPTS = Object.freeze({
  ENGL210: Object.freeze({
    courseblock_index: 10,
    raw_entry_sha256: '18625cb7f91be84981d950625cc33b8c797c49f19281f3bdebb63791dde206b9',
    raw_entry_html_sha256: '9a6d80486ad449531b5446d1fe16d4d4acbe8b6252ce2db4e908d67e66812eb5',
    heading_text_sha256: '8298c057365f5c0795e602eb42c94eea98b8e3eb04e1734815711dfa74ad4476',
    raw_clause: ENGL210_CLAUSE,
    clause_start: 164,
    statement_start: 149,
    entry_end: 243,
  }),
  ENGL211: Object.freeze({
    courseblock_index: 11,
    raw_entry_sha256: '8b4e884355c37154c96be3a61b99cb93e59cac218d865f8b5780c8177aa9d759',
    raw_entry_html_sha256: '8837347fd8e25ce88382d66901143146a37962c08638278fa2ec3e3d8f21a96b',
    heading_text_sha256: '29552d66b48a4d42e45cb7f0ad767c37e850121ffd6ac9990ee829529fa8ee4e',
    raw_clause: COMMON_CLAUSE,
    clause_start: 155,
    statement_start: 140,
    entry_end: 234,
  }),
  ENGL212: Object.freeze({
    courseblock_index: 12,
    raw_entry_sha256: '327b71e1b1a26e77937234bd9bf9263ed9c7f66995544876ba969bebad622ced',
    raw_entry_html_sha256: '9f7c831d8bb8fc1e3659b441b88ef6601a9261bd5597524ebf31f66c295875d5',
    heading_text_sha256: '1a5c7e52f8834961da3eed6ab0a0baf9c25849e66f2f9733e3240a80463f4e36',
    raw_clause: COMMON_CLAUSE,
    clause_start: 191,
    statement_start: 176,
    entry_end: 270,
  }),
  ENGL213: Object.freeze({
    courseblock_index: 13,
    raw_entry_sha256: '4f52581de09005551685ece14420a7e8a754b970a7f284616c60262bc6c7ad9c',
    raw_entry_html_sha256: '16ad908ed6f13b63097550f11c14472b9971be0ac6f4c53040f6ae02863c6174',
    heading_text_sha256: '027a38d26956681ac58916217beefca64478af1744b3487a8198d1214685634c',
    raw_clause: COMMON_CLAUSE,
    clause_start: 228,
    statement_start: 213,
    entry_end: 307,
  }),
  ENGL214: Object.freeze({
    courseblock_index: 14,
    raw_entry_sha256: '1d3253862f17719c21eec3bb2bd2becfce7904301cd2b409956c71e5f97dcb0b',
    raw_entry_html_sha256: '9966e5a11d62093e45a052939f7d1be07c4646d029348567d78de9b573675f3c',
    heading_text_sha256: '270d4723f1b602b06e8ad437d56172479c88da709e345e269dcc64a91e5d47e5',
    raw_clause: COMMON_CLAUSE,
    clause_start: 184,
    statement_start: 169,
    entry_end: 263,
  }),
  ENGL215: Object.freeze({
    courseblock_index: 15,
    raw_entry_sha256: '9cc7c839141a84869a112ff6ea718e674f9d6ca329acdac1caffb139f368d477',
    raw_entry_html_sha256: '43fcc80d7c7ea1dde1989d06391924568857fbd1020b535e6c193255e5deab8f',
    heading_text_sha256: '43e31595038032c55188eeeb2f28d055543dbf72005a497bb36bcd65adbf8b96',
    raw_clause: COMMON_CLAUSE,
    clause_start: 182,
    statement_start: 167,
    entry_end: 261,
  }),
});

const DEGREE_SCOPE_RECEIPT = Object.freeze({
  contract: 'vsu_exact_computer_science_bs_and_ge_literature_scope_v1',
  institution: 'Virginia State University',
  school_id: SCHOOL_ID,
  catalog_year: CATALOG_YEAR,
  selected_degree: 'Computer Science Major, Bachelor of Science (B.S.)',
  selected_variant: 'Base Computer Science B.S. without a concentration',
  modeled_major: 'Computer Science',
  english_major_modeled: false,
  major_source: Object.freeze({
    url: 'https://catalog.vsu.edu/undergraduate/college-engineering-technology/department-engineering-computer-science/computer-science-major-bs/',
    cache_path: 'pages/virginia-state-university__program.txt',
    text_sha256: 'a3b7b3e40240ae0a78a1c8ad07d1c965524a11a0e2dd65293f653dcd47128ec8',
    exact_scope_finding:
      'The retained page is the base Computer Science B.S. and contains a three-credit GE Literature requirement.',
  }),
  general_education_source: Object.freeze({
    url: 'https://catalog.vsu.edu/undergraduate/general-education-programs/',
    cache_path: 'pages/virginia-state-university__ge.txt',
    text_sha256: '02d2e2935e9a20f1674f5998d76222bcd87e3e63caba167d2356f80e4fa78a39',
    exact_scope_finding:
      'The retained university GE page lists ENGL 210-215 as Literature choices for the general education program.',
  }),
  accepted_degree_proof_tree_sha256: Object.freeze([
    '5a908ee98414c13aff6bbdf7f05340b7f9e2892851ec60ec89f030f848f15800',
    '561dfb5e51fca62c972495067efd4dc256db4efecb135f7d89db278cc7a63562',
  ]),
  accepted_source_bundle_sha256: Object.freeze([
    '7dc03dd0f3739e2bad2b6695e519d3486e97cf4f6f478babccdf5a22986bd16d',
    '8798bbd35187e6ea5437a34370fbbbff0bd7e3174117f3acbb78cf85fb04bde6',
  ]),
});

const SIBLING_CONTEXT = Object.freeze([
  Object.freeze({
    course_code: 'ENGL111',
    courseblock_index: 1,
    raw_entry_sha256: '539befc708310bca050813563a838033da064a70d55a24d2d66794442e738a86',
    exact_statement: 'Prerequisite: ENGL 110.',
    finding: 'The regular Composition II route follows regular Composition I.',
  }),
  Object.freeze({
    course_code: 'ENGL113',
    courseblock_index: 3,
    raw_entry_sha256: '3c0c656ce93ccf688f028ce55520f36e8e5834552e04540713465e65e262786b',
    exact_statement: 'Prerequisites: ENGL 112 Enrollment is limited to students who are in the University Honors program.',
    finding: 'The honors Composition II route follows honors Composition I.',
  }),
  Object.freeze({
    course_code: 'ENGL200',
    courseblock_index: 5,
    raw_entry_sha256: '2021477ffa292bde8252eb88719b1ce22d864b72ce1dde0a9d6e59604b7386a9',
    exact_statement:
      'Prerequisites (s): ENGL 110 and ENGL 111 or ENGL 112 and ENGL 113.',
    finding: 'The same catalog explicitly spells out the two composition sequences.',
  }),
  Object.freeze({
    course_code: 'ENGL217',
    courseblock_index: 16,
    raw_entry_sha256: 'b9dd111e91fc3103dc5a889b2084e0e154c9322980bc507a0a4f5fcdb9a79d8f',
    exact_statement:
      'Prerequisites: ENGL 110/112, ENGL 111/113, and for English majors, ENGL 203.',
    finding:
      'The same catalog publishes the target grammar with explicit slash-delimited composition alternatives and a separately comma-bounded English-major condition.',
  }),
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));

function expectedCompleteEntryReceipt() {
  return {
    receipt_contract: COURSELEAF_RECEIPT,
    source_courseblock_count: 95,
    source_complete_entry_count: 95,
    source_complete_entries_with_required_requisite_marker_count: 56,
    entry_required_requisite_marker_count: 1,
    entry_corequisite_marker_count: 0,
    entry_requisite_marker_like_count: 1,
    entry_constraint_like_signal_count: 0,
    same_source_positive_control: true,
  };
}

function expectedPublishedUnits(receipt) {
  return {
    kind: 'published_fixed_credits',
    notation: '3 Credits',
    credit_hours_min: 3,
    credit_hours_max: 3,
    heading_text_sha256: receipt.heading_text_sha256,
  };
}

function targetCodeForCandidate(candidate) {
  if (candidate?.school_id !== SCHOOL_ID
      || candidate?.slug !== SLUG
      || candidate?.owner_namespace !== OWNER) return null;
  const code = String(candidate?.course_code || '');
  return TARGET_CODES.includes(code) ? code : null;
}

function expectedClause(receipt) {
  return {
    kind: 'prerequisite',
    label: 'Prerequisites',
    raw: receipt.raw_clause,
    relative_start: receipt.clause_start,
    relative_end: receipt.entry_end,
    statement_relative_start: receipt.statement_start,
    statement_relative_end: receipt.entry_end,
  };
}

function candidateIssues(candidate, clauses, code) {
  const receipt = TARGET_RECEIPTS[code];
  const source = candidate?.source || {};
  const rawEntry = String(source.raw_entry_text || '');
  const expected = expectedClause(receipt);
  const clause = Array.isArray(clauses) && clauses.length === 1 ? clauses[0] : null;
  const issues = [];
  const mismatch = (name, actual, wanted) => {
    if (canonicalJson(actual) !== canonicalJson(wanted)) issues.push(name);
  };
  if (candidate.course_key !== `${OWNER}:${code}`) issues.push('course_key');
  if (source.official_url !== COURSE_URL) issues.push('official_url');
  if (source.catalog_year_verified !== CATALOG_YEAR) issues.push('catalog_year');
  if (source.capture_origin !== 'official_acquisition') issues.push('capture_origin');
  if (source.source_format !== 'courseleaf_courseblock') issues.push('source_format');
  if (source.boundary_contract !== COURSELEAF_BOUNDARY) issues.push('boundary_contract');
  if (source.cache_path !== COURSE_CACHE_PATH) issues.push('cache_path');
  if (source.source_response_sha256 !== COURSE_RESPONSE_SHA256
      || source.declared_normalized_text_sha256 !== COURSE_RESPONSE_SHA256
      || source.retained_normalized_text_sha256 !== COURSE_RESPONSE_SHA256) {
    issues.push('source_response_sha256');
  }
  if (source.source_response_bytes !== COURSE_RESPONSE_BYTES) issues.push('source_response_bytes');
  if (source.courseblock_index !== receipt.courseblock_index) issues.push('courseblock_index');
  if (source.raw_entry_sha256 !== receipt.raw_entry_sha256
      || sha256(rawEntry) !== receipt.raw_entry_sha256) issues.push('raw_entry_sha256');
  if (source.raw_entry_html_sha256 !== receipt.raw_entry_html_sha256) {
    issues.push('raw_entry_html_sha256');
  }
  if (source.character_start !== 0 || source.character_end !== receipt.entry_end
      || rawEntry.length !== receipt.entry_end) issues.push('entry_boundary');
  if (rawEntry.slice(receipt.clause_start, receipt.entry_end) !== receipt.raw_clause
      || rawEntry.slice(receipt.statement_start, receipt.clause_start) !== 'Prerequisites: ') {
    issues.push('clause_raw_span');
  }
  mismatch('published_units', source.published_units, expectedPublishedUnits(receipt));
  mismatch('complete_entry_receipt', source.complete_entry_receipt, expectedCompleteEntryReceipt());
  mismatch('structured_requisite_fields', source.structured_requisite_fields, []);
  mismatch('extracted_clause', clause, expected);
  return issues;
}

function courseCondition(code) {
  return {
    type: 'course',
    code,
    course_key: `${OWNER}:${code}`,
    raw: `${code.slice(0, 4)} ${code.slice(4)}`,
  };
}

function expectedFormulaGroup(code, rawClause) {
  // The source publishes Composition I alternatives and Composition II
  // alternatives. Preserve those two simultaneous requirements as the full
  // cartesian OR-of-AND form; ENGL111/113 retain their own source-published
  // prerequisite rows, so recursive closure also preserves the paired
  // regular and honors sequences.
  const routes = [
    ['ENGL110', 'ENGL111'],
    ['ENGL110', 'ENGL113'],
    ['ENGL112', 'ENGL111'],
    ['ENGL112', 'ENGL113'],
  ];
  const courseKey = `${OWNER}:${code}`;
  return {
    id: `${courseKey}:prerequisite:0`,
    kind: 'prerequisite',
    raw: rawClause,
    flags: [
      'vsu_exact_cs_scope_conditional_projection',
      'english_major_condition_preserved_not_emitted',
    ],
    formula: FORMULA,
    paths: routes.map((route, index) => ({
      id: `${courseKey}:prerequisite:0:path:${index}`,
      raw: rawClause,
      all_of: route.map(courseCondition),
    })),
  };
}

function projectionEvidence(code, clause) {
  const receipt = TARGET_RECEIPTS[code];
  const unconditionalEnd = clause.raw.indexOf(' and for English majors');
  const conditionalStart = clause.raw.indexOf(CONDITIONAL_RAW);
  const subjectStart = clause.raw.indexOf(CONDITIONAL_SUBJECT_RAW);
  if (unconditionalEnd !== 45 || conditionalStart !== 45 || subjectStart !== 50) {
    throw new Error('VSU English conditional boundary changed');
  }
  const unconditionalRaw = clause.raw.slice(0, unconditionalEnd);
  return {
    contract: CONTRACT,
    owner_namespace: OWNER,
    course_key: `${OWNER}:${code}`,
    catalog_year: CATALOG_YEAR,
    source_url: COURSE_URL,
    source_response_sha256: COURSE_RESPONSE_SHA256,
    raw_entry_sha256: receipt.raw_entry_sha256,
    raw_entry_html_sha256: receipt.raw_entry_html_sha256,
    raw_clause_sha256: sha256(clause.raw),
    degree_scope: DEGREE_SCOPE_RECEIPT,
    same_catalog_context: {
      source_response_sha256: COURSE_RESPONSE_SHA256,
      sibling_receipts: SIBLING_CONTEXT,
      interpretation:
        'ENGL 110/112 is the Composition I choice and ENGL 111/113 is the Composition II choice; both are required for all students, while ENGL 203 is additional only for English majors.',
    },
    all_student_prerequisite: {
      raw: unconditionalRaw,
      raw_sha256: sha256(unconditionalRaw),
      clause_relative_start: 0,
      clause_relative_end: unconditionalEnd,
      entry_relative_start: receipt.clause_start,
      entry_relative_end: receipt.clause_start + unconditionalEnd,
      graph_projection: 'emitted_as_two_simultaneous_alternative_course_requirements',
    },
    english_major_conditional: {
      raw: CONDITIONAL_RAW,
      raw_sha256: sha256(CONDITIONAL_RAW),
      subject_raw: CONDITIONAL_SUBJECT_RAW,
      subject_raw_sha256: sha256(CONDITIONAL_SUBJECT_RAW),
      clause_relative_start: conditionalStart,
      clause_relative_end: clause.raw.length,
      entry_relative_start: receipt.clause_start + conditionalStart,
      entry_relative_end: receipt.entry_end,
      condition_kind: 'additional_prerequisite_for_named_major',
      required_major: 'English',
      modeled_major: 'Computer Science',
      applicable_to_modeled_degree_scope: false,
      preserved_in_source_evidence: true,
      graph_edge_emitted: false,
      graph_projection: 'not_emitted_for_exact_non_english_computer_science_degree_scope',
      omitted_course_code: 'ENGL203',
      omitted_course_key: `${OWNER}:ENGL203`,
    },
    content_accounting: {
      clause_length: clause.raw.length,
      all_student_characters: unconditionalEnd,
      connector_and_conditional_characters: clause.raw.length - conditionalStart,
      accounted_characters: clause.raw.length,
      source_content_discarded: false,
    },
    inference_boundary:
      'This projection is valid only for the exact source-bound base Computer Science B.S. It does not remove ENGL 203 from an English-major record, infer that another non-English program uses these courses, or reinterpret a changed clause.',
  };
}

function resolveVirginiaStateEnglishPrerequisite(candidate, clauses) {
  const code = targetCodeForCandidate(candidate);
  if (!code) return { applicable: false, ready: false, issues: [] };
  const issues = candidateIssues(candidate, clauses, code);
  if (issues.length) {
    return {
      applicable: true,
      ready: false,
      code,
      issues,
      review_reason: 'vsu_english_exact_candidate_or_scope_receipt_changed',
    };
  }
  const clause = clauses[0];
  const projection = projectionEvidence(code, clause);
  return {
    applicable: true,
    ready: true,
    code,
    groups: [expectedFormulaGroup(code, clause.raw)],
    projection,
    issues: [],
    review_reason: 'exact_vsu_cs_scope_english_major_conditional_projection',
  };
}

function projectionRowIssues(row) {
  const code = String(row?.code || '');
  if (row?.owner_namespace !== OWNER || !TARGET_CODES.includes(code)) return [];
  const receipt = TARGET_RECEIPTS[code];
  const expectedClauseValue = receipt.raw_clause;
  let expectedProjection = null;
  try {
    expectedProjection = projectionEvidence(code, { raw: expectedClauseValue });
  } catch {
    return ['projection_constant_invalid'];
  }
  const issues = [];
  if (row.course_key !== `${OWNER}:${code}`) issues.push('course_key');
  if (row.status !== 'parsed'
      || row.review_status !== 'promoted_strict_formula'
      || row.review_reason !== 'exact_vsu_cs_scope_english_major_conditional_projection') {
    issues.push('review_status');
  }
  if (row.source_url !== COURSE_URL
      || row.catalog_year !== CATALOG_YEAR
      || row.source_content_sha256 !== receipt.raw_entry_sha256) issues.push('source_binding');
  if (row.source_evidence?.content_sha256 !== receipt.raw_entry_sha256
      || sha256(row.source_evidence?.raw_text || '') !== receipt.raw_entry_sha256) {
    issues.push('source_evidence');
  }
  if (row.raw_requisites !== `Prerequisites: ${expectedClauseValue}`) issues.push('raw_requisites');
  if (canonicalJson(row.groups) !== canonicalJson([
    expectedFormulaGroup(code, expectedClauseValue),
  ])) issues.push('formula');
  if (canonicalJson(row.vsu_english_cs_scope_projection) !== canonicalJson(expectedProjection)) {
    issues.push('projection_evidence');
  }
  const conditional = row.vsu_english_cs_scope_projection?.english_major_conditional;
  if (conditional?.preserved_in_source_evidence !== true
      || conditional?.graph_edge_emitted !== false
      || conditional?.applicable_to_modeled_degree_scope !== false
      || conditional?.omitted_course_key !== `${OWNER}:ENGL203`
      || row.vsu_english_cs_scope_projection?.content_accounting?.source_content_discarded
        !== false) issues.push('conditional_preservation');
  return issues;
}

function runtimeDegreeScopeIssues(rows, exactDegreeProof) {
  const targetRows = (Array.isArray(rows) ? rows : []).filter((row) => (
    row?.owner_namespace === OWNER && TARGET_CODES.includes(row?.code)
  ));
  if (!targetRows.length) return [];
  const issues = [];
  if (targetRows.length !== TARGET_CODES.length
      || new Set(targetRows.map((row) => row.code)).size !== TARGET_CODES.length) {
    issues.push('vsu_english_projection_target_roster_changed');
  }
  for (const row of targetRows) {
    for (const issue of projectionRowIssues(row)) {
      issues.push(`${row.course_key}:${issue}`);
    }
  }
  const proof = exactDegreeProof?.proof;
  if (exactDegreeProof?.supported !== true
      || !DEGREE_SCOPE_RECEIPT.accepted_degree_proof_tree_sha256
        .includes(proof?.proof_tree_sha256)
      || (proof?.source_bundle_sha256 != null
        && !DEGREE_SCOPE_RECEIPT.accepted_source_bundle_sha256
          .includes(proof.source_bundle_sha256))
      || proof?.official_source_sha256?.major
        !== DEGREE_SCOPE_RECEIPT.major_source.text_sha256
      || proof?.official_source_sha256?.general_education
        !== DEGREE_SCOPE_RECEIPT.general_education_source.text_sha256) {
    issues.push('vsu_english_projection_exact_cs_degree_scope_not_proven');
  }
  return issues;
}

module.exports = {
  CONTRACT,
  COURSE_CACHE_PATH,
  COURSE_RESPONSE_SHA256,
  COURSE_URL,
  DEGREE_SCOPE_RECEIPT,
  SIBLING_CONTEXT,
  TARGET_CODES,
  TARGET_RECEIPTS,
  expectedFormulaGroup,
  projectionRowIssues,
  resolveVirginiaStateEnglishPrerequisite,
  runtimeDegreeScopeIssues,
  sha256,
};
