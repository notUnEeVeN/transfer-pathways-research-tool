const { createHash } = require('node:crypto');

const CONTRACT = 'virginia_tech_cs4784_recursive_closure_exact_receipts_v1';
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

const TARGET_CODES = Object.freeze(['CS3724', 'CS3744']);
const EXACT_CANDIDATE_SHA256 = Object.freeze({
  CS3724: '792043f1cb175613c79559181242dd840f3c7ba2a257d1befbcf32cd748756b3',
  CS3744: '35dbd389ab558fa5c615f1baefba67f2bb4539a0b01505f05b3b97effed80dfe',
});
const EXACT_SOURCE_SHA256 = Object.freeze({
  CS3724: '7ab32298a0af20142d29944bad32a2f396991af4afde421ed78b38527991afc3',
  CS3744: 'e201dd819ebbc726f4576a541b1823ae26cf0649f4330c6863d4af51536ec600',
});
const EXACT = Object.freeze({
  CS3724: Object.freeze({
    grade: 'A grade of C or better required in CS prerequisite 2114.',
    field: 'CS 1114 or CS 1044 or CS 1054 or CS 1064',
  }),
  CS3744: Object.freeze({
    grade: 'A grade of C or better is required in CS pre-requisite 2114.',
    field:
      '(CS 2114 or ECE 3514) and (MATH 1114 or MATH 2114) and (MATH 1224 or MATH 2204)',
  }),
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(',')}}`;
  return JSON.stringify(value);
}

const sha256 = (value) => createHash('sha256').update(String(value || '')).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalJson(value));

function exactStatement(text, raw) {
  const source = String(text || '');
  const start = source.indexOf(raw);
  if (start < 0 || source.indexOf(raw, start + raw.length) >= 0) return null;
  return {
    kind: 'exact_full_entry_grade_statement',
    raw,
    raw_sha256: sha256(raw),
    relative_start: start,
    relative_end: start + raw.length,
  };
}

function exactPrerequisiteField(candidate, raw) {
  const fields = candidate?.source?.structured_requisite_fields || [];
  const field = fields.length === 1 && fields[0]?.kind === 'prerequisite' ? fields[0] : null;
  const text = candidate?.source?.raw_entry_text || '';
  if (!field || field.receipt_contract !== COURSELEAF_FIELD_RECEIPT
      || field.structural_class !== 'detail-prereq' || field.raw !== raw
      || sha256(field.raw) !== field.raw_sha256
      || sha256(field.raw_field_text) !== field.raw_field_text_sha256
      || text.slice(field.relative_start, field.relative_end) !== field.raw
      || text.slice(field.field_relative_start, field.field_relative_end)
        !== field.raw_field_text
      || field.statement_relative_start !== field.field_relative_start
      || field.statement_relative_end !== field.field_relative_end) return null;
  return field;
}

function candidateIssues(candidate, code) {
  const source = candidate?.source || {};
  const issues = [];
  if (candidate?.school_id !== SCHOOL_ID || candidate?.slug !== SLUG
      || candidate?.owner_namespace !== OWNER || candidate?.course_code !== code
      || candidate?.course_key !== `${OWNER}:${code}`) issues.push('candidate_identity');
  if (source.capture_origin !== 'official_acquisition'
      || source.source_format !== 'courseleaf_courseblock'
      || source.boundary_contract !== COURSELEAF_BOUNDARY
      || source.catalog_year_verified !== CATALOG_YEAR
      || source.source_response_sha256
        !== '89225dfa30ddcfdedca1fd6ec6f26b7ea220979589a97d874b69cf98dc95fbc4'
      || source.retained_source_contract
        !== 'retained_official_2026_2027_department_whole_response_and_exact_courseblock_v1'
      || source.live_recapture_claim !== false) issues.push('source_boundary');
  const receipt = source.complete_entry_receipt;
  if (receipt?.receipt_contract !== COURSELEAF_RECEIPT
      || receipt?.same_source_positive_control !== true
      || receipt?.entry_required_requisite_marker_count !== 1
      || receipt?.entry_corequisite_marker_count !== 0) issues.push('entry_receipt');
  if (sha256(source.raw_entry_text) !== source.raw_entry_sha256
      || canonicalSha256(source) !== EXACT_SOURCE_SHA256[code]) issues.push('source_fingerprint');
  if (canonicalSha256(candidate) !== EXACT_CANDIDATE_SHA256[code]) {
    issues.push('candidate_fingerprint');
  }
  return issues;
}

function course(code, raw, extra = {}) {
  return { type: 'course', code, course_key: `${OWNER}:${code}`, raw, ...extra };
}

function group(candidate, raw, paths) {
  const id = `${candidate.course_key}:prerequisite:0`;
  return {
    id,
    kind: 'prerequisite',
    raw,
    flags: [
      'strict_full_text_accounting',
      `source:${SLUG}`,
      CONTRACT,
      'exact_outside_cs2114_minimum_grade_c_preserved',
    ],
    formula: FORMULA,
    paths: paths.map((allOf, index) => ({
      id: `${id}:path:${index}`,
      raw,
      all_of: allOf,
    })),
  };
}

function resolve(candidate, code) {
  const expected = EXACT[code];
  const field = exactPrerequisiteField(candidate, expected.field);
  const grade = exactStatement(candidate.source.raw_entry_text, expected.grade);
  if (!field || !grade || grade.relative_end !== field.field_relative_start) {
    throw new Error('exact_grade_and_prerequisite_span_changed');
  }
  let paths;
  if (code === 'CS3724') {
    paths = ['CS1114', 'CS1044', 'CS1054', 'CS1064'].map((alternative) => [
      course('CS2114', 'CS prerequisite 2114', {
        minimum_grade: 'C', minimum_grade_evidence: grade,
      }),
      course(alternative, alternative.replace(/^(\D+)(\d)/, '$1 $2')),
    ]);
  } else {
    paths = [];
    for (const computing of ['CS2114', 'ECE3514']) {
      for (const mathematics of ['MATH1114', 'MATH2114']) {
        for (const secondaryMath of ['MATH1224', 'MATH2204']) {
          paths.push([
            course(computing, computing.replace(/^(\D+)(\d)/, '$1 $2'), computing === 'CS2114'
              ? { minimum_grade: 'C', minimum_grade_evidence: grade } : {}),
            course(mathematics, mathematics.replace(/^(\D+)(\d)/, '$1 $2')),
            course(secondaryMath, secondaryMath.replace(/^(\D+)(\d)/, '$1 $2')),
          ]);
        }
      }
    }
  }
  return {
    applicable: true,
    ready: true,
    code,
    status: 'parsed',
    issues: [],
    review_reason: 'virginia_tech_cs4784_recursive_closure_exact_bytes_resolved',
    raw_requisites: `${expected.grade}${field.raw_field_text}`,
    groups: [group(candidate, `${expected.grade}${field.raw_field_text}`, paths)],
    proof: {
      contract: CONTRACT,
      candidate_sha256: EXACT_CANDIDATE_SHA256[code],
      source_sha256: EXACT_SOURCE_SHA256[code],
      source_response_sha256: candidate.source.source_response_sha256,
      raw_entry_sha256: candidate.source.raw_entry_sha256,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      grade_statement: grade,
      prerequisite_field: field,
      grade_scope: code === 'CS3724'
        ? 'CS2114_is_an_additional_required_course_in_every_path'
        : 'minimum_C_applies_only_when_CS2114_is_the_selected_first_alternative',
      required_content_discarded: false,
      source_or_core_content_changed: false,
    },
  };
}

function resolveVirginiaTechCs4784ClosureCandidate(candidate) {
  const code = candidate?.slug === SLUG && TARGET_CODES.includes(candidate?.course_code)
    ? candidate.course_code : null;
  if (!code) return { applicable: false, ready: false, issues: [] };
  const issues = candidateIssues(candidate, code);
  if (issues.length) return {
    applicable: true,
    ready: false,
    code,
    issues,
    review_reason: 'virginia_tech_cs4784_recursive_closure_receipt_changed',
  };
  try {
    return resolve(candidate, code);
  } catch (error) {
    return {
      applicable: true,
      ready: false,
      code,
      issues: [error.message],
      review_reason: 'virginia_tech_cs4784_recursive_closure_semantics_changed',
    };
  }
}

module.exports = {
  CONTRACT,
  EXACT,
  EXACT_CANDIDATE_SHA256,
  EXACT_SOURCE_SHA256,
  TARGET_CODES,
  canonicalSha256,
  resolveVirginiaTechCs4784ClosureCandidate,
  sha256,
};
