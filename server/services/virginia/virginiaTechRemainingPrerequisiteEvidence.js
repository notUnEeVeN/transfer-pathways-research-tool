/**
 * Exact, fail-closed review of the Virginia Tech prerequisite rows that remain
 * outside the shared university prerequisite grammar.
 *
 * This module is deliberately not wired into universityPrerequisiteReview yet.
 * It separates rows whose complete retained 2026-2027 CourseLeaf entries are
 * sufficient for a lossless formula from rows where the publication itself is
 * ambiguous, program-conditional, or incomplete.  In particular, it never
 * turns a missing/unnamed prerequisite into `status: none`.
 */

const { createHash } = require('node:crypto');

const CONTRACT = 'virginia_tech_remaining_prerequisite_exact_receipts_v1';
const SCHOOL_ID = 9230;
const SLUG = 'virginia-polytechnic-institute-and-state-university';
const OWNER = 'va:uni:9230';
const CATALOG_YEAR = '2026-2027';
const FORMULA = 'paths_or__conditions_and';
const COURSELEAF_BOUNDARY = 'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const COURSELEAF_FIELD_RECEIPT =
  'courseleaf_exact_structured_requisite_field_offsets_and_html_hash_v1';

const SAFE_CODES = Object.freeze([
  'COMM2004',
  'COMM2014',
  'CS1114',
  'CS4784',
  'ENGE3900',
]);

const AMBIGUOUS_BOOLEAN_CODES = Object.freeze([
  'CS4664',
  'MATH3414',
  'MATH4445',
]);

const CONDITIONAL_APPLICABILITY_CODES = Object.freeze([
  'ENGE4735',
  'ENGE4736',
]);

const UNIDENTIFIED_PREREQUISITE_CODES = Object.freeze([
  'MUS3065',
  'MUS3066',
]);

const TARGET_CODES = Object.freeze([
  ...SAFE_CODES,
  ...AMBIGUOUS_BOOLEAN_CODES,
  ...CONDITIONAL_APPLICABILITY_CODES,
  ...UNIDENTIFIED_PREREQUISITE_CODES,
]);
const TARGET_CODE_SET = new Set(TARGET_CODES);

// Fingerprint the complete candidate and source objects.  This includes the
// official URL, catalog edition, browser/robots/sitemap receipts, response
// byte count/hash, exact entry/HTML hashes and offsets, units, and complete-
// entry marker controls.
const EXACT_CANDIDATE_SHA256 = Object.freeze({
  COMM2004: 'c9e9357116169f01dbfe37741a8ecd2411556d307d925710b8e01787dbe72f52',
  COMM2014: '171b358e7cd34673563756798d711366adc629d8de9e71cfc39ff2368b311b00',
  CS1114: 'c7a4664462655989528350bd3e2ed254b89e90d506161fa0e0dd7989eb076112',
  CS4664: '5fc9d7332ff8483624d89b8acfced84e7970adfe1f6b7995434e9fee692c219f',
  CS4784: '26b6947a3f91d74a0898e5e2cf808bfb93c38a86eafbefed4bbcb767713410ea',
  ENGE3900: '842ed6dc9036a45069b13cde26febbac8b2110ee6c343d1493f615ae8b8f1c36',
  ENGE4735: '44d5499c8173b70b03eec0e591282615e6f0d0c85f1b1f0f4394c3da38f4089a',
  ENGE4736: 'f105e15796ffd32d0172ac201a1fe2173796d77b30db15c242414342c786bc09',
  MATH3414: '5eb9edf6fd280641b98671cbadd532069b4f261714c6d9d0bc0f7a6b7c754191',
  MATH4445: 'd0e167a1775902f942e4f4242a3cdf825bf0c25bf607f0528e4f4efab7f38c59',
  MUS3065: '203e5521ee5da1c7a3bda17fb558314761438ade336f5a8a491f954c92a6ee96',
  MUS3066: 'f2f034f0434b47fe06dd0630843bde6772bd123d370e18548e6e69dd5afd06ac',
});

const EXACT_SOURCE_SHA256 = Object.freeze({
  COMM2004: '5605dd8c17691c4503bda7f0a52beb13ecd60b54872c7e3f5ddf4261ab96ee67',
  COMM2014: '07c26202e68ab4fdd70e5a99fa57d58cced86db57029deefc2d8050f9cd6ff9f',
  CS1114: 'c7b0aae84dcde781c783e3bae8fb77887bfb1d016e32edf7d0b14bdc30f1fd8b',
  CS4664: '0c1051fd2b46a8476dba1c7ea945893e400ce1b9654a30fe814c5de9c4ee6280',
  CS4784: '081f7c852cf222bcbe4cc7edd1d03a59036d239f93e27418098b593cc4ede46c',
  ENGE3900: 'ab9ee1bcf219af5beec222b56ac280316e6e8ffb8edbe2a6934e65459c4626b7',
  ENGE4735: '1aa7be61751dd28bb021c3df7627734ede6c672199aa1b14aa5e1fce43eda04a',
  ENGE4736: 'd935e7da417ce380e1e0511caf58569caed2dd8e41a5f0bce6a6a41ce7dcc6f5',
  MATH3414: '80cdf59afcc09d0cab4b0d4660e0784ef1b1f551fbc438ef5f83a06dae049b68',
  MATH4445: 'df9ffbff86a50b52a0ee6f4cfd41dfc07708d4b19ce590e32350eac793b18699',
  MUS3065: 'bc1a48618a47adc67d5eb60eabbd282213370c2cfac34632b0d039d097559991',
  MUS3066: 'd36d96e2826eb29d8cc92c16fb327a7cbb5cfd5dddfad25af122b2873b08bc66',
});

const EXACT_STATEMENTS = Object.freeze({
  COMM2004: Object.freeze({
    raw: 'Pre: Sophomore standing.',
    condition_raw: 'Sophomore standing',
  }),
  COMM2014: Object.freeze({
    raw: 'Pre: Sophomore standing required.',
    condition_raw: 'Sophomore standing required',
  }),
  CS1114: Object.freeze({
    corequisite: 'MATH 1225',
  }),
  CS4784: Object.freeze({
    senior: 'Pre-requisite: Senior Standing required.',
    senior_condition_raw: 'Senior Standing required',
    grade: 'A grade of C or better is required in CS pre-requisite 3724 and 3744',
    prerequisite: 'CS 3724 and CS 3744',
    raw:
      'Pre-requisite: Senior Standing required. A grade of C or better is required in CS pre-requisite 3724 and 3744Prerequisite(s): CS 3724 and CS 3744',
  }),
  ENGE3900: Object.freeze({
    raw: 'Pre: Departmental approval of 3900 plan.',
    condition_raw: 'Departmental approval of 3900 plan',
  }),
  MUS3065: Object.freeze({
    raw: 'Must meet pre-requisite or have permission of the instructor',
  }),
  MUS3066: Object.freeze({
    raw: 'Must meet pre-requisite or have permission of the instructor',
  }),
});

const EXACT_AMBIGUOUS_FIELDS = Object.freeze({
  CS4664: 'CS 3114 and CS 3654 or CMDA 3654 or STAT 3654',
  MATH3414:
    '(CS 1044 or CS 1705 or CS 1114 or CS 1124) and MATH 2406H or (CMDA 2005 and CMDA 2006) or (MATH 2214 or MATH 2214H) and (MATH 2204 or MATH 2204H)',
  MATH4445:
    'MATH 2406H or (CMDA 2005 and CMDA 2006) or (MATH 2214 or MATH 2214H) and (MATH 2204 or MATH 2204H)',
});

const AMBIGUITY = Object.freeze({
  CS4664:
    'The unparenthesized AND/OR expression does not publish whether CS3114 applies to every alternative.',
  MATH3414:
    'The expression mixes parenthesized alternatives with unparenthesized outer AND/OR operators, so its route boundaries are not published.',
  MATH4445:
    'The expression mixes parenthesized alternatives with an unparenthesized final AND, so its route boundary is not published.',
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalSha256(value) {
  return sha256(canonicalJson(value));
}

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function targetCode(candidate) {
  for (const code of [
    normalizeCode(candidate?.course_code),
    normalizeCode(String(candidate?.course_key || '').split(':').at(-1)),
  ]) {
    if (TARGET_CODE_SET.has(code)) return code;
  }
  const sourceFingerprint = canonicalSha256(candidate?.source || null);
  return TARGET_CODES.find((code) => EXACT_SOURCE_SHA256[code] === sourceFingerprint) || null;
}

function exactUniqueStatement(rawEntryText, raw, kind) {
  const source = String(rawEntryText || '');
  const start = source.indexOf(raw);
  if (start < 0 || source.indexOf(raw, start + raw.length) >= 0) {
    throw new Error(`Virginia Tech ${kind} is absent or non-unique`);
  }
  return {
    kind,
    raw,
    raw_sha256: sha256(raw),
    relative_start: start,
    relative_end: start + raw.length,
  };
}

function exactField(candidate, kind) {
  const fields = candidate?.source?.structured_requisite_fields;
  if (!Array.isArray(fields)) throw new Error('Virginia Tech structured fields are missing');
  const matches = fields.filter((field) => field?.kind === kind);
  if (matches.length !== 1) throw new Error(`Virginia Tech ${kind} field is not unique`);
  const field = matches[0];
  const source = candidate.source.raw_entry_text;
  if (field.receipt_contract !== COURSELEAF_FIELD_RECEIPT
      || field.structural_class !== (kind === 'corequisite' ? 'detail-coreq' : 'detail-prereq')
      || sha256(field.raw) !== field.raw_sha256
      || sha256(field.raw_field_text) !== field.raw_field_text_sha256
      || source.slice(field.relative_start, field.relative_end) !== field.raw
      || source.slice(field.field_relative_start, field.field_relative_end) !== field.raw_field_text
      || field.statement_relative_start !== field.field_relative_start
      || field.statement_relative_end !== field.field_relative_end) {
    throw new Error(`Virginia Tech ${kind} field receipt changed`);
  }
  return field;
}

function candidateIssues(candidate, code) {
  const source = candidate?.source;
  const issues = [];
  if (candidate?.school_id !== SCHOOL_ID
      || candidate?.slug !== SLUG
      || candidate?.owner_namespace !== OWNER
      || candidate?.course_key !== `${OWNER}:${code}`
      || candidate?.course_code !== code) issues.push('candidate_identity');
  if (source?.catalog_year_verified !== CATALOG_YEAR
      || source?.capture_origin !== 'official_acquisition'
      || source?.source_format !== 'courseleaf_courseblock'
      || source?.boundary_contract !== COURSELEAF_BOUNDARY) issues.push('source_boundary');
  if (source?.complete_entry_receipt?.receipt_contract !== COURSELEAF_RECEIPT
      || source?.complete_entry_receipt?.same_source_positive_control !== true
      || !Number.isInteger(source?.source_response_bytes)
      || source.source_response_bytes <= 0) issues.push('complete_entry_receipt');
  if (sha256(source?.raw_entry_text || '') !== source?.raw_entry_sha256) {
    issues.push('raw_entry_sha256');
  }
  if (canonicalSha256(source) !== EXACT_SOURCE_SHA256[code]) issues.push('source_fingerprint');
  if (canonicalSha256(candidate) !== EXACT_CANDIDATE_SHA256[code]) {
    issues.push('candidate_fingerprint');
  }
  return issues;
}

function courseCondition(code, raw, extra = {}) {
  const normalized = normalizeCode(code);
  if (!normalized) throw new Error(`invalid Virginia Tech course code ${code}`);
  return {
    type: 'course',
    code: normalized,
    course_key: `${OWNER}:${normalized}`,
    raw,
    ...extra,
  };
}

function nonCourseCondition(condition, raw, extra = {}) {
  return { type: 'non_course', condition, raw, ...extra };
}

function exactGroup(candidate, kind, raw, paths, flags) {
  const id = `${candidate.course_key}:${kind}:0`;
  return {
    id,
    kind,
    raw,
    flags: [
      'strict_full_text_accounting',
      `source:${SLUG}`,
      CONTRACT,
      ...flags,
    ],
    formula: FORMULA,
    paths: paths.map((path, index) => ({
      id: `${id}:path:${index}`,
      raw,
      all_of: path,
    })),
  };
}

function completeEntryProof(candidate, code, modeledStatements) {
  return {
    contract: CONTRACT,
    candidate_sha256: EXACT_CANDIDATE_SHA256[code],
    source_sha256: EXACT_SOURCE_SHA256[code],
    source_response_sha256: candidate.source.source_response_sha256,
    source_response_bytes: candidate.source.source_response_bytes,
    source_cache_path: candidate.source.cache_path,
    raw_entry_sha256: candidate.source.raw_entry_sha256,
    raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
    complete_entry_receipt: candidate.source.complete_entry_receipt,
    modeled_statements: modeledStatements,
    required_content_discarded: false,
    source_or_core_content_changed: false,
  };
}

function resolveCommunicationStanding(candidate, code) {
  const expected = EXACT_STATEMENTS[code];
  if (candidate.source.structured_requisite_fields.length !== 0) {
    throw new Error(`${code} gained a structured requisite field`);
  }
  const statement = exactUniqueStatement(candidate.source.raw_entry_text, expected.raw, 'standing');
  return {
    raw_requisites: expected.raw,
    groups: [exactGroup(candidate, 'prerequisite', expected.raw, [[
      nonCourseCondition('sophomore_standing_or_higher', expected.condition_raw, {
        minimum_class_standing: 'sophomore',
        required: true,
        source_evidence: statement,
      }),
    ]], ['exact_narrative_sophomore_standing_requirement'])],
    proof: completeEntryProof(candidate, code, [statement]),
  };
}

function resolveCs1114(candidate) {
  const field = exactField(candidate, 'corequisite');
  if (candidate.source.structured_requisite_fields.length !== 1
      || field.raw !== EXACT_STATEMENTS.CS1114.corequisite
      || candidate.source.complete_entry_receipt.entry_required_requisite_marker_count !== 0
      || candidate.source.complete_entry_receipt.entry_corequisite_marker_count !== 1) {
    throw new Error('CS1114 exact corequisite-only boundary changed');
  }
  return {
    raw_requisites: field.raw_field_text,
    groups: [exactGroup(candidate, 'corequisite', field.raw, [[
      courseCondition('MATH1225', field.raw, {
        concurrent_allowed: true,
        source_field_kind: 'corequisite',
      }),
    ]], [
      'exact_courseleaf_corequisite_only_entry',
      'zero_required_prerequisite_markers_preserved',
      'status_is_parsed_never_none',
    ])],
    proof: completeEntryProof(candidate, 'CS1114', [field]),
  };
}

function resolveCs4784(candidate) {
  const expected = EXACT_STATEMENTS.CS4784;
  const field = exactField(candidate, 'prerequisite');
  if (candidate.source.structured_requisite_fields.length !== 1
      || field.raw !== expected.prerequisite) {
    throw new Error('CS4784 exact formal prerequisite field changed');
  }
  const senior = exactUniqueStatement(candidate.source.raw_entry_text, expected.senior, 'senior standing');
  const grade = exactUniqueStatement(
    candidate.source.raw_entry_text,
    expected.grade,
    'exact_full_entry_grade_statement',
  );
  const rawStart = senior.relative_start;
  const rawEnd = field.field_relative_end;
  if (candidate.source.raw_entry_text.slice(rawStart, rawEnd) !== expected.raw
      || grade.relative_start !== senior.relative_end + 1
      || field.field_relative_start !== grade.relative_end) {
    throw new Error('CS4784 exact requirement span changed');
  }
  return {
    raw_requisites: expected.raw,
    groups: [exactGroup(candidate, 'prerequisite', expected.raw, [[
      nonCourseCondition('senior_standing_or_higher', expected.senior_condition_raw, {
        minimum_class_standing: 'senior',
        required: true,
        source_evidence: senior,
      }),
      courseCondition('CS3724', 'CS 3724', {
        minimum_grade: 'C',
        minimum_grade_evidence: grade,
      }),
      courseCondition('CS3744', 'CS 3744', {
        minimum_grade: 'C',
        minimum_grade_evidence: grade,
      }),
    ]], [
      'exact_narrative_senior_standing_requirement',
      'exact_formal_and_conjunction',
      'exact_outside_minimum_grade_c_applied_to_both_courses',
    ])],
    proof: completeEntryProof(candidate, 'CS4784', [senior, grade, field]),
  };
}

function resolveEnge3900(candidate) {
  const expected = EXACT_STATEMENTS.ENGE3900;
  if (candidate.source.structured_requisite_fields.length !== 0) {
    throw new Error('ENGE3900 gained a structured requisite field');
  }
  const statement = exactUniqueStatement(
    candidate.source.raw_entry_text,
    expected.raw,
    'departmental approval',
  );
  return {
    raw_requisites: expected.raw,
    groups: [exactGroup(candidate, 'prerequisite', expected.raw, [[
      nonCourseCondition('departmental_approval_of_3900_plan', expected.condition_raw, {
        authorization_kind: 'approval',
        authorization_authority: 'department',
        approval_subject: '3900 plan',
        required: true,
        source_evidence: statement,
      }),
    ]], ['exact_narrative_departmental_approval_requirement'])],
    proof: completeEntryProof(candidate, 'ENGE3900', [statement]),
  };
}

function buildSafeResolution(candidate, code) {
  if (code === 'COMM2004' || code === 'COMM2014') {
    return resolveCommunicationStanding(candidate, code);
  }
  if (code === 'CS1114') return resolveCs1114(candidate);
  if (code === 'CS4784') return resolveCs4784(candidate);
  if (code === 'ENGE3900') return resolveEnge3900(candidate);
  throw new Error(`no safe Virginia Tech remaining-row resolver for ${code}`);
}

function auditAmbiguousBoolean(candidate, code) {
  const field = exactField(candidate, 'prerequisite');
  if (candidate.source.structured_requisite_fields.length !== 1
      || field.raw !== EXACT_AMBIGUOUS_FIELDS[code]) {
    throw new Error(`${code} ambiguous field changed`);
  }
  return {
    exact_field_receipt: field,
    ambiguity: AMBIGUITY[code],
    formula_emitted: false,
    precedence_rule_inferred: false,
  };
}

function auditConditionalApplicability(candidate, code) {
  const fields = candidate.source.structured_requisite_fields;
  if (fields.length !== 2
      || fields[0].kind !== 'prerequisite'
      || fields[1].kind !== 'corequisite'
      || fields[1].raw !== '(MSE 4055 for MSE majors) or (ISE 4404 for ISE majors).') {
    throw new Error(`${code} conditional field roster changed`);
  }
  const majorScope = exactUniqueStatement(
    candidate.source.raw_entry_text,
    'Students majoring in Material Science and Engineering, Mechanical Engineering, Electrical and Computer Engineering, Industrial and Systems Engineering, and Biomedical Engineering must meet prerequisite and corequisite requirements for their respective in-major capstone courses.',
    'capstone major scope',
  );
  return {
    exact_field_receipts: fields.map((field) => exactField(candidate, field.kind)),
    exact_major_scope_statement: majorScope,
    exact_corequisite_branches: [
      { course_code: 'MSE4055', applies_when_major: 'MSE' },
      { course_code: 'ISE4404', applies_when_major: 'ISE' },
    ],
    default_branch_published: false,
    prerequisite_route_to_major_mapping_published: false,
    formula_emitted: false,
    universal_corequisite_inferred: false,
  };
}

function auditUnidentifiedPrerequisite(candidate, code) {
  const statement = exactUniqueStatement(
    candidate.source.raw_entry_text,
    EXACT_STATEMENTS[code].raw,
    'unnamed prerequisite disjunction',
  );
  if (candidate.source.structured_requisite_fields.length !== 0) {
    throw new Error(`${code} gained a formal prerequisite field`);
  }
  return {
    exact_statement: statement,
    connector: 'or',
    left_branch: {
      published_text: 'pre-requisite',
      prerequisite_identity_published: false,
    },
    right_branch: {
      published_text: 'permission of the instructor',
      authorization_kind: 'permission',
      authorization_authority: 'instructor',
    },
    formula_emitted: false,
    sequence_from_course_number_or_title_inferred: false,
    status_none_authorized: false,
  };
}

function resolveVirginiaTechRemainingPrerequisiteCandidate(candidate) {
  const code = targetCode(candidate);
  if (!code) return { applicable: false, ready: false, issues: [] };
  const issues = candidateIssues(candidate, code);
  if (issues.length) return {
    applicable: true,
    ready: false,
    code,
    classification: 'exact_receipt_changed',
    issues,
    review_reason: 'virginia_tech_remaining_exact_candidate_or_source_receipt_changed',
  };

  if (SAFE_CODES.includes(code)) {
    try {
      return {
        applicable: true,
        ready: true,
        code,
        classification: 'safe_exact_retained_bytes',
        status: 'parsed',
        issues: [],
        review_reason: 'virginia_tech_exact_remaining_prerequisite_resolved',
        ...buildSafeResolution(candidate, code),
      };
    } catch (error) {
      return {
        applicable: true,
        ready: false,
        code,
        classification: 'exact_semantic_projection_failed',
        issues: [error.message],
        review_reason: 'virginia_tech_remaining_exact_semantic_projection_failed',
      };
    }
  }

  if (AMBIGUOUS_BOOLEAN_CODES.includes(code)) {
    try {
      return {
        applicable: true,
        ready: false,
        code,
        classification: 'genuinely_ambiguous_boolean_grouping',
        issues: ['ambiguous_boolean_grouping'],
        review_reason: 'virginia_tech_courseleaf_boolean_grouping_not_explicit',
        proof: auditAmbiguousBoolean(candidate, code),
      };
    } catch (error) {
      return {
        applicable: true,
        ready: false,
        code,
        classification: 'exact_receipt_changed',
        issues: [error.message],
        review_reason: 'virginia_tech_remaining_exact_candidate_or_source_receipt_changed',
      };
    }
  }

  if (CONDITIONAL_APPLICABILITY_CODES.includes(code)) {
    try {
      return {
        applicable: true,
        ready: false,
        code,
        classification: 'major_conditional_not_losslessly_representable',
        issues: ['conditional_applicability_not_losslessly_representable'],
        review_reason:
          'virginia_tech_courseleaf_conditional_applicability_not_losslessly_representable',
        proof: auditConditionalApplicability(candidate, code),
      };
    } catch (error) {
      return {
        applicable: true,
        ready: false,
        code,
        classification: 'exact_receipt_changed',
        issues: [error.message],
        review_reason: 'virginia_tech_remaining_exact_candidate_or_source_receipt_changed',
      };
    }
  }

  try {
    return {
      applicable: true,
      ready: false,
      code,
      classification: 'requires_new_official_prerequisite_identity',
      issues: ['published_prerequisite_operand_unidentified'],
      review_reason: 'virginia_tech_catalog_names_no_prerequisite_operand',
      proof: auditUnidentifiedPrerequisite(candidate, code),
    };
  } catch (error) {
    return {
      applicable: true,
      ready: false,
      code,
      classification: 'exact_receipt_changed',
      issues: [error.message],
      review_reason: 'virginia_tech_remaining_exact_candidate_or_source_receipt_changed',
    };
  }
}

function summarizeVirginiaTechRemainingPrerequisites(candidates) {
  const rows = (candidates || [])
    .map(resolveVirginiaTechRemainingPrerequisiteCandidate)
    .filter((row) => row.applicable)
    .sort((a, b) => a.code.localeCompare(b.code));
  return {
    contract: CONTRACT,
    target_count: TARGET_CODES.length,
    safe_delta: rows.filter((row) => row.ready).length,
    safe_codes: rows.filter((row) => row.ready).map((row) => row.code),
    ambiguous_boolean_codes: rows
      .filter((row) => row.classification === 'genuinely_ambiguous_boolean_grouping')
      .map((row) => row.code),
    conditional_applicability_codes: rows
      .filter((row) => row.classification === 'major_conditional_not_losslessly_representable')
      .map((row) => row.code),
    new_official_prerequisite_identity_codes: rows
      .filter((row) => row.classification === 'requires_new_official_prerequisite_identity')
      .map((row) => row.code),
    exact_receipt_failures: rows
      .filter((row) => row.classification === 'exact_receipt_changed')
      .map((row) => row.code),
  };
}

module.exports = {
  AMBIGUITY,
  AMBIGUOUS_BOOLEAN_CODES,
  CATALOG_YEAR,
  CONDITIONAL_APPLICABILITY_CODES,
  CONTRACT,
  EXACT_CANDIDATE_SHA256,
  EXACT_SOURCE_SHA256,
  EXACT_STATEMENTS,
  OWNER,
  SAFE_CODES,
  SCHOOL_ID,
  SLUG,
  TARGET_CODES,
  UNIDENTIFIED_PREREQUISITE_CODES,
  canonicalJson,
  canonicalSha256,
  resolveVirginiaTechRemainingPrerequisiteCandidate,
  sha256,
  summarizeVirginiaTechRemainingPrerequisites,
};
