/**
 * Finite, source-bound disposition of the remaining VCU Figure 6 rows.
 *
 * Seven exact CourseLeaf entries are structurally silent about an incoming
 * prerequisite/corequisite after every other constraint-like sentence is
 * retained and typed. Eight exact entries remain blocked because the source
 * publishes an enrollment condition or an under-specified Boolean list.
 * Three CMSC direct rows remain blocked because the retained normalized text
 * is not a complete official-response/courseblock receipt. Nothing in this
 * module is a subject-wide grammar or an absence-from-search inference.
 */

const crypto = require('node:crypto');
const {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  requisiteMarkerCounts,
} = require('./universityPrerequisiteAcquisition');

const CONTRACT =
  'vcu_2026_2027_exact_prerequisite_closure_disposition_v1';
const STRUCTURAL_NONE_KIND =
  'official_complete_vcu_courseleaf_entry_required_requisite_silence_with_accounted_nonprerequisite_signals';
const STRUCTURAL_NONE_REASON =
  'complete_vcu_courseleaf_entry_no_required_requisite_with_nonprerequisite_signals_preserved';
const RECEIPT_MISMATCH_REASON = 'vcu_exact_prerequisite_closure_receipt_changed';
const SCHOOL_ID = 9229;
const SLUG = 'virginia-commonwealth-university';
const OWNER = 'va:uni:9229';
const CATALOG_YEAR = '2026-2027';
const WEAK_TEXT_SHA256 =
  '609f2b3def7f4a44227495bedbac581554ba5d799e60510cfceefa5c23994212';
const WEAK_TEXT_CACHE_PATH =
  'pages/virginia-commonwealth-university__course_catalog.txt';

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(canonical(value));
const signal = (kind, raw) => Object.freeze({ kind, raw });
const fixedUnits = (notation, hours, headingTextSha256) => Object.freeze({
  kind: 'published_fixed_credits',
  notation,
  credit_hours_min: hours,
  credit_hours_max: hours,
  heading_text_sha256: headingTextSha256,
});
const variableUnits = (notation, min, max, headingTextSha256) => Object.freeze({
  kind: 'published_variable_credit_range',
  notation,
  credit_hours_min: min,
  credit_hours_max: max,
  heading_text_sha256: headingTextSha256,
});

const PAGES = Object.freeze({
  clse: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/clse/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__clse.html',
    source_response_sha256:
      '623e6df38bef40f2c388b3d556399f3bf73f6869ef82dbef28dfd0ae5810fb9d',
    source_response_bytes: 54798,
    source_courseblock_count: 52,
    source_complete_entry_count: 52,
    source_positive_count: 31,
  }),
  cmsc: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/cmsc/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__cmsc.html',
    source_response_sha256:
      '4bedbc06a4d447c8a4ecf4a6c0b50857b38dd0eb2ee1aa95fac818e1b1d96d2d',
    source_response_bytes: 96164,
    source_courseblock_count: 94,
    source_complete_entry_count: 94,
    source_positive_count: 55,
  }),
  econ: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/econ/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__econ.html',
    source_response_sha256:
      '19d2070496b86dd1d89094ebb7b7c1836926291fda040df09623724a11c7045e',
    source_response_bytes: 56183,
    source_courseblock_count: 47,
    source_complete_entry_count: 47,
    source_positive_count: 38,
  }),
  egrb: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/egrb/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__egrb.html',
    source_response_sha256:
      'f12e5f7b196f6d72070dff372c55f42b3c6ec0799c0f73a90ecfdccb197c5e63',
    source_response_bytes: 78935,
    source_courseblock_count: 70,
    source_complete_entry_count: 70,
    source_positive_count: 51,
  }),
  egre: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/egre/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__egre.html',
    source_response_sha256:
      '9676e761ea9e8741dc9d6a31c833dc54b6116c496f96f7ba68d9a817c9132c9b',
    source_response_bytes: 89977,
    source_courseblock_count: 76,
    source_complete_entry_count: 76,
    source_positive_count: 71,
  }),
  engr: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/engr/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__engr.html',
    source_response_sha256:
      'f5ba24ba0e45205e23e537669cc333790924e7ed87b1c48665b5fd1b69ac0b6e',
    source_response_bytes: 44995,
    source_courseblock_count: 43,
    source_complete_entry_count: 43,
    source_positive_count: 24,
  }),
  honr: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/honr/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__honr.html',
    source_response_sha256:
      'cfb3554e81444a6a73313b015a021727b30a380661a9cb2a4fbc1415c871a42c',
    source_response_bytes: 33913,
    source_courseblock_count: 32,
    source_complete_entry_count: 32,
    source_positive_count: 11,
  }),
  math: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/math/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__math.html',
    source_response_sha256:
      '67efcec994af7f30e842022d29aa292120dca429da26dda8eb2d448cdc7a5556',
    source_response_bytes: 77403,
    source_courseblock_count: 89,
    source_complete_entry_count: 89,
    source_positive_count: 66,
  }),
  univ: Object.freeze({
    official_url: 'https://bulletin.vcu.edu/azcourses/univ/',
    cache_path:
      'university-prerequisites/raw/virginia-commonwealth-university/virginia-commonwealth-university__univ.html',
    source_response_sha256:
      'a997c46bfcd3d8ed3627ebb86d586ce539dd2c61d71b189c468d73a368464960',
    source_response_bytes: 21562,
    source_courseblock_count: 12,
    source_complete_entry_count: 12,
    source_positive_count: 4,
  }),
});

const CREDIT_TRIO =
  'Students may receive credit toward graduation for only one of the following three courses: ECON 203, ECON 205 or ECON 210.';

const ROWS = Object.freeze({
  CMSC235: Object.freeze({
    scope: 'direct', source_quality: 'retained_normalized_text_only',
    start: 3741, end: 4053,
    raw_entry_sha256: 'b9a5b73fda180f291f15175971e2d8e369e6c1d38adab340515e7d501a778cb2',
    blocker: 'vcu_retained_text_without_exact_official_courseblock_receipt',
    signals: Object.freeze([]),
  }),
  CMSC254: Object.freeze({
    scope: 'direct', source_quality: 'retained_normalized_text_only',
    start: 5208, end: 5831,
    raw_entry_sha256: 'a79674b2f11495299907e761e204891bcd3252fbdbcae2ab0c46abf9a025babb',
    blocker: 'vcu_retained_text_without_exact_official_courseblock_receipt',
    signals: Object.freeze([
      signal('program_enrollment_restriction',
        'Enrollment is restricted to majors in the College of Engineering.'),
      signal('mutual_credit_exclusion',
        'Students may not receive credit for both CMSC 254 and CMSC 210.'),
    ]),
  }),
  CMSC492: Object.freeze({
    scope: 'direct', source_quality: 'retained_normalized_text_only',
    start: 28701, end: 29322,
    raw_entry_sha256: 'ab8610c1cd38bf128978e7727d8591694a8ca03d466168e28b50902e0faaf73e',
    blocker: 'vcu_retained_text_without_exact_official_courseblock_receipt',
    signals: Object.freeze([
      signal('class_standing_and_department_credit_condition',
        'Generally open only to students of junior or senior standing who have acquired at least 12 credits in the departmental discipline.'),
      signal('instructor_and_department_permission_condition',
        'Determination of the amount of credit and permission of instructor and department chair must be procured prior to registration of the course.'),
    ]),
  }),
  ECON205: Object.freeze({
    scope: 'direct', page: 'econ', courseblock_index: 2,
    raw_entry_sha256: '176d35279f3159828c4895e62af069c832824701cd939e7a4f50ddc543416fa1',
    raw_entry_html_sha256: '64b6e4425526888019f1fb29316f662d5c672134adc7e3fc492e4481912e7a68',
    units: fixedUnits('3 Hours', 3,
      'a3869c8dc489649583feb2e33fcb574c2540a57d703e5381d824ef4b9f93355c'),
    marker_counts: Object.freeze([0, 0, 0, 1]), safe_structural_none: true,
    signals: Object.freeze([
      signal('intended_audience_note', 'Intended for engineering students.'),
      signal('mutual_credit_exclusion', CREDIT_TRIO),
    ]),
  }),
  ECON210: Object.freeze({
    scope: 'direct', page: 'econ', courseblock_index: 3,
    raw_entry_sha256: '72f1791440d3f9443a223596e88e1ea1743f5ca78f37d04f7c0b970f9c8d725b',
    raw_entry_html_sha256: 'f72a0c9da5139a8cb36725dea248c7ac550b77795246b4abe0cc6c5359bb9622',
    units: fixedUnits('3 Hours', 3,
      '529382c23bdf75e01b2911b0f69324ae66bb8fab7cd7ddd14a8934f3ed4d63f3'),
    marker_counts: Object.freeze([0, 0, 0, 1]), safe_structural_none: true,
    signals: Object.freeze([signal('mutual_credit_exclusion', CREDIT_TRIO)]),
  }),
  ENGR395: Object.freeze({
    scope: 'direct', page: 'engr', courseblock_index: 14,
    raw_entry_sha256: 'de3e5bfe657f76de90f94989cc15b061f169f9f50f8978c4706cb02e437415e7',
    raw_entry_html_sha256: 'd99da30d7f6ebd66320d22969b7101beb4627d8bde4dc1927f548798c0ef7eff',
    units: fixedUnits('1 Hour', 1,
      '357896c0c47f489c0ddf78de2695f8222e559971491ca7da5c987c38491b28da'),
    marker_counts: Object.freeze([0, 0, 0, 2]),
    blocker: 'vcu_enrollment_condition_requires_explicit_figure6_model',
    signals: Object.freeze([
      signal('program_enrollment_restriction',
        'Enrollment is restricted to majors in the School of Engineering.'),
      signal('descriptive_internship_requirements_phrase',
        'expectations and requirements for internships and cooperative education positions.'),
    ]),
  }),
  HONR230: Object.freeze({
    scope: 'direct', page: 'honr', courseblock_index: 8,
    raw_entry_sha256: 'cd9e5ea779367261f014aa43cd68d5dd064c490a57a1fb47b6a5445e852eb12a',
    raw_entry_html_sha256: '5b184247519e9c384822c99bc1acf2debc2220874a18545e785633b2e9a50a3a',
    units: fixedUnits('3 Hours', 3,
      '4947768744a2468c339eab5946ab4d6f030ee5f29beeb05e8227d72dab287512'),
    marker_counts: Object.freeze([0, 0, 0, 2]),
    blocker: 'vcu_enrollment_condition_requires_explicit_figure6_model',
    signals: Object.freeze([signal('honors_attribute_enrollment_restriction',
      'Enrollment is restricted Honors College students enrolled in one of the following attributes: Honors Active (HN1) or Honors (HN3).')]),
  }),
  HONR240: Object.freeze({
    scope: 'direct', page: 'honr', courseblock_index: 9,
    raw_entry_sha256: '6215fb61976725f5e198cc481036004a2923f6a53241efb2e5882d7d2b9e3452',
    raw_entry_html_sha256: '0edccfc3abb1e8cd0ac839d559479b14c577936324f5251da770e0db19dbe422',
    units: fixedUnits('3 Hours', 3,
      '095921395ac10680637d0b16b0162b6029870b56693439a719af924dfedf2d2b'),
    marker_counts: Object.freeze([0, 0, 0, 2]),
    blocker: 'vcu_enrollment_condition_requires_explicit_figure6_model',
    signals: Object.freeze([signal('honors_attribute_enrollment_restriction',
      'Enrollment is restricted to Honors College students enrolled in one of the following attributes: Honors Active (HN1) or Honors (HN3).')]),
  }),
  UNIV101: Object.freeze({
    scope: 'direct', page: 'univ', courseblock_index: 0,
    raw_entry_sha256: '22afb4f659f29808c9136b1fd64d7d88d2824e4d69825dd25283961eba8cb236',
    raw_entry_html_sha256: '0b89081830414c3c2b0ed5e759ae4725aed3bc55e0aa47e964a24aa063bc5e6e',
    units: fixedUnits('1 Hour', 1,
      '7d2e5c4fb78300ea3795c480a9c706a53b70c4f376509084386f0a242ab36078'),
    marker_counts: Object.freeze([0, 0, 0, 2]),
    blocker: 'vcu_enrollment_condition_requires_explicit_figure6_model',
    signals: Object.freeze([signal('class_enrollment_restriction',
      'Enrollment is restricted to freshmen or by override for students with advanced standing.')]),
  }),
  UNIV111: Object.freeze({
    scope: 'direct', page: 'univ', courseblock_index: 3,
    raw_entry_sha256: 'e959d7b33efae6cf3e8daa5e229d96bda9118f50fd8ef3b945693a76440a1a47',
    raw_entry_html_sha256: 'aa86424ed68518e05337d903b06bf57c9f75e40a697dd57f9c817acd603bdb37',
    units: fixedUnits('3 Hours', 3,
      '52d773ddce9295e3b7aab1fb5ed000836ae70e7623736900d07f448cc79d32bd'),
    marker_counts: Object.freeze([0, 0, 0, 1]), safe_structural_none: true,
    signals: Object.freeze([signal('course_credit_minimum_grade',
      'Students must earn a minimum grade of C to receive credit for the course.')]),
  }),
  UNIV191: Object.freeze({
    scope: 'direct', page: 'univ', courseblock_index: 5,
    raw_entry_sha256: '6177d4d538c302da830a4a6341febd888d16bde716f8a2b6ab4497df7549f9d1',
    raw_entry_html_sha256: 'c5fd740e74fa91652151b9cad6b90d326c7d2dfeaece0d2de77c070a28793c28',
    units: variableUnits('1-3 Hours', 1, 3,
      '0b57396ab69b794e8397fb26c8273ef57c6d82cd8f9f0e410bc812f51d2f1ef0'),
    marker_counts: Object.freeze([0, 0, 0, 2]),
    blocker: 'vcu_enrollment_condition_requires_explicit_figure6_model',
    signals: Object.freeze([
      signal('class_enrollment_restriction',
        'Enrollment is restricted to freshmen or by override for students with advanced standing.'),
      signal('repeat_credit_limit',
        'May be repeated with different content for a maximum of three credits.'),
    ]),
  }),
  CLSE101: Object.freeze({
    scope: 'closure', page: 'clse', courseblock_index: 0,
    raw_entry_sha256: 'a2af0f27846f96a6a31fd7b9601d2a702c0cada29c4741a2b1a21899afad89a6',
    raw_entry_html_sha256: 'c8afd6ac0f4d435cbf1baab9ae8f7506ca8b8c964593b51c2d3a4dab863f14f0',
    units: fixedUnits('3 Hours', 3,
      '7f701f80a5884e1785c2652f8291819736305f872cf2dd21c8e5f93d609dbd20'),
    marker_counts: Object.freeze([1, 0, 1, 0]),
    blocker: 'vcu_enrollment_condition_requires_explicit_figure6_model',
    required_clause:
      'course open to first-year students majoring in chemical and life science engineering',
    signals: Object.freeze([signal('program_and_class_enrollment_prerequisite',
      'course open to first-year students majoring in chemical and life science engineering')]),
  }),
  CMSC210: Object.freeze({
    scope: 'closure', page: 'cmsc', courseblock_index: 3,
    raw_entry_sha256: '0f797d0244905de6509ba1149be51ea06ac8f36bb6af4d6de3193448d88e2b32',
    raw_entry_html_sha256: '2483cda1b1f2fbb8f565e27d7dacab9080c6741b76a0e93c6d8f46322dd75fac',
    units: fixedUnits('3 Hours', 3,
      'f91848f735f5409d6838dcaf43436c86066d75f15bad733da08507400d26b482'),
    marker_counts: Object.freeze([0, 0, 0, 1]), safe_structural_none: true,
    signals: Object.freeze([signal('degree_credit_applicability_restriction',
      'This course is not applicable for credit toward the B.S. in Computer Science.')]),
  }),
  ECON203: Object.freeze({
    scope: 'closure', page: 'econ', courseblock_index: 1,
    raw_entry_sha256: '202be9ddbf013db9050a6177b4bde3d9b0ed5c64ad579eed368734b79efba5c4',
    raw_entry_html_sha256: '54a5e793d6377b5172f2e89d633b05ff97abcdd9bd0b1dfe783ff5d4646b04e9',
    units: fixedUnits('3 Hours', 3,
      '8237fdd5c4ed7685d14bd9c4435559b2821b8d57158b65275829a2735b9150d3'),
    marker_counts: Object.freeze([0, 0, 0, 2]), safe_structural_none: true,
    signals: Object.freeze([
      signal('degree_credit_applicability_restriction',
        'Not applicable for credit toward economics and business majors.'),
      signal('mutual_credit_exclusion', CREDIT_TRIO),
    ]),
  }),
  EGRB102: Object.freeze({
    scope: 'closure', page: 'egrb', courseblock_index: 1,
    raw_entry_sha256: 'b30c84e714e5db0fd12772d5a963d30b94cd0bad348da0f6608d620e236d92aa',
    raw_entry_html_sha256: '9fd53520435a24823b5fcf168ac36244e18bec083c8a0ddc590e9c5401a613c7',
    units: fixedUnits('3 Hours', 3,
      'f45c66c87bfd3984199dc4d1f42d67d59d1bcfd3aa18f0d82ef6e48c2199ffe2'),
    marker_counts: Object.freeze([1, 0, 1, 1]),
    blocker: 'vcu_implicit_comma_boolean_formula_not_source_grouped',
    required_clause:
      'MATH 151, MATH 200, MATH 201 or a satisfactory score on the math placement exam',
    signals: Object.freeze([signal('required_prerequisite_boolean_text',
      'MATH 151, MATH 200, MATH 201 or a satisfactory score on the math placement exam')]),
  }),
  EGRE101: Object.freeze({
    scope: 'closure', page: 'egre', courseblock_index: 0,
    raw_entry_sha256: '258f474522c2f6c1e0ab39409506fd093566967c6aae0692c12ae77b87eddfc0',
    raw_entry_html_sha256: '8a02233821496aaf975603c38f29bad511aef288dc6e7145eb3b124672c7096f',
    units: fixedUnits('3 Hours', 3,
      'ff5dc3ff9c0b2c6728b0cd93d9073a9a9137c589f284f2080b355dfff01577eb'),
    marker_counts: Object.freeze([0, 0, 0, 1]),
    blocker: 'vcu_enrollment_condition_requires_explicit_figure6_model',
    signals: Object.freeze([signal('program_enrollment_restriction',
      'Enrollment is restricted to students in the B.S. in Computer Engineering, B.S. in Electrical Engineering, pre-engineering, undeclared - engineering, B.S.Ed. in Secondary Education and Teaching, and B.S. in Education with a concentration in engineering education.')]),
  }),
  MATH129: Object.freeze({
    scope: 'closure', page: 'math', courseblock_index: 2,
    raw_entry_sha256: '8dc0e9c26b3fddc627912bc7351f684ac745a41f9559b8cf672a363824823f6e',
    raw_entry_html_sha256: 'a4f14afc3c1820b6cabc2158cffdc090aade32745b7c8286b3b5ff98d9373c2b',
    units: fixedUnits('3 Hours', 3,
      '59d5f50330e71d83c07522dd5721213180334abfc70183c207454955c6ae1040'),
    marker_counts: Object.freeze([0, 0, 0, 2]), safe_structural_none: true,
    signals: Object.freeze([
      signal('general_education_credit_exclusion',
        'This course will not satisfy any general education requirements.'),
      signal('mutual_credit_exclusion',
        'Students may receive credit toward graduation for only one of MATH 129 and MATH 141.'),
    ]),
  }),
  MATH131: Object.freeze({
    scope: 'closure', page: 'math', courseblock_index: 3,
    raw_entry_sha256: '3053c441fad237632278abc399d8e6f1f3d1fcf6d43de3fe24b1cd3df3030438',
    raw_entry_html_sha256: '97f7ac0fdaa8c46b733f81a771fa1c53257fd239074ac5da7419e60cfa43e25e',
    units: fixedUnits('3 Hours', 3,
      '1b20679096e476101b64efdc1a9668c8b0145999051bcb72f5e05ad4ef8efdc4'),
    marker_counts: Object.freeze([0, 0, 1, 0]), safe_structural_none: true,
    signals: Object.freeze([signal('outbound_non_prerequisite_note',
      'The course does not serve as a prerequisite for MATH 139, MATH 141, MATH 151 or other advanced mathematical sciences courses.')]),
  }),
});

const TARGET_CODES = Object.freeze(Object.keys(ROWS));
const SAFE_CODES = Object.freeze(TARGET_CODES.filter((code) => ROWS[code].safe_structural_none));
const WEAK_CODES = Object.freeze(TARGET_CODES.filter(
  (code) => ROWS[code].source_quality === 'retained_normalized_text_only',
));

function exactSignalSpans(rawEntryText, expectedSignals) {
  const issues = [];
  const spans = asArray(expectedSignals).map((expected) => {
    const start = String(rawEntryText || '').indexOf(expected.raw);
    const repeated = start >= 0
      && String(rawEntryText || '').indexOf(expected.raw, start + 1) >= 0;
    if (start < 0) issues.push(`missing_signal:${expected.kind}`);
    if (repeated) issues.push(`repeated_signal:${expected.kind}`);
    return {
      kind: expected.kind,
      raw: expected.raw,
      raw_sha256: sha256(expected.raw),
      relative_start: start,
      relative_end: start < 0 ? -1 : start + expected.raw.length,
    };
  });
  return { issues, spans };
}

function weakCandidateIssues(candidate, expected) {
  const source = candidate?.source || {};
  const issues = [];
  if (source.capture_origin !== 'retained_catalog_text') issues.push('weak_capture_origin');
  if (source.official_url !== PAGES.cmsc.official_url) issues.push('official_url');
  if (source.catalog_year_verified !== CATALOG_YEAR) issues.push('catalog_year');
  if (source.declared_normalized_text_sha256 !== WEAK_TEXT_SHA256
      || source.retained_normalized_text_sha256 !== WEAK_TEXT_SHA256) {
    issues.push('retained_text_sha256');
  }
  if (source.character_start !== expected.start || source.character_end !== expected.end) {
    issues.push('retained_text_boundary');
  }
  if (source.raw_entry_sha256 !== expected.raw_entry_sha256
      || sha256(source.raw_entry_text) !== expected.raw_entry_sha256) issues.push('raw_entry');
  if (source.source_response_sha256 != null || source.raw_entry_html_sha256 != null
      || source.complete_entry_receipt != null) issues.push('unexpected_exact_receipt');
  return issues;
}

function exactCandidateIssues(candidate, expected) {
  const source = candidate?.source || {};
  const page = PAGES[expected.page];
  const receipt = source.complete_entry_receipt;
  const markers = requisiteMarkerCounts(source.raw_entry_text);
  const actualMarkerCounts = [
    markers.required, markers.corequisite, markers.marker_like, markers.constraint_like,
  ];
  const receiptMarkerCounts = [
    receipt?.entry_required_requisite_marker_count,
    receipt?.entry_corequisite_marker_count,
    receipt?.entry_requisite_marker_like_count,
    receipt?.entry_constraint_like_signal_count,
  ];
  const issues = [];
  if (source.capture_origin !== 'official_acquisition'
      || source.source_format !== 'courseleaf_courseblock') issues.push('capture_origin');
  if (source.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT) issues.push('boundary_contract');
  if (source.catalog_year_verified !== CATALOG_YEAR) issues.push('catalog_year');
  if (source.official_url !== page.official_url || source.cache_path !== page.cache_path) {
    issues.push('official_source');
  }
  if (source.source_response_sha256 !== page.source_response_sha256
      || source.declared_normalized_text_sha256 !== page.source_response_sha256
      || source.retained_normalized_text_sha256 !== page.source_response_sha256
      || source.source_response_bytes !== page.source_response_bytes) issues.push('source_response');
  if (source.courseblock_index !== expected.courseblock_index
      || source.character_start !== 0
      || source.character_end !== String(source.raw_entry_text || '').length
      || source.raw_entry_sha256 !== expected.raw_entry_sha256
      || sha256(source.raw_entry_text) !== expected.raw_entry_sha256
      || source.raw_entry_html_sha256 !== expected.raw_entry_html_sha256) issues.push('entry');
  if (canonicalJson(source.published_units) !== canonicalJson(expected.units)) issues.push('units');
  if (receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
      || receipt?.source_courseblock_count !== page.source_courseblock_count
      || receipt?.source_complete_entry_count !== page.source_complete_entry_count
      || receipt?.source_complete_entries_with_required_requisite_marker_count
        !== page.source_positive_count
      || receipt?.same_source_positive_control !== true
      || canonicalJson(receiptMarkerCounts) !== canonicalJson(expected.marker_counts)
      || canonicalJson(actualMarkerCounts) !== canonicalJson(expected.marker_counts)) {
    issues.push('marker_control');
  }
  if (asArray(source.structured_requisite_fields).length !== 0) {
    issues.push('unexpected_structured_requisite_field');
  }
  return issues;
}

function identityIssues(candidate) {
  const issues = [];
  if (candidate?.school_id !== SCHOOL_ID) issues.push('school_id');
  if (candidate?.slug !== SLUG) issues.push('slug');
  if (candidate?.owner_namespace !== OWNER) issues.push('owner_namespace');
  if (candidate?.course_key !== `${OWNER}:${candidate?.course_code}`) issues.push('course_key');
  if (candidate?.row_status !== 'candidate_review_required') issues.push('candidate_status');
  return issues;
}

function buildVcuPrerequisiteControlFromCandidates(candidates = []) {
  const vcu = asArray(candidates).filter((row) => row?.slug === SLUG);
  const entries = {};
  const issues = [];
  for (const code of TARGET_CODES) {
    const matches = vcu.filter((row) => row.course_code === code);
    if (matches.length !== 1) {
      issues.push(`${code}:candidate_count`);
      continue;
    }
    const candidate = matches[0];
    const expected = ROWS[code];
    const bindingIssues = [
      ...identityIssues(candidate),
      ...(expected.source_quality === 'retained_normalized_text_only'
        ? weakCandidateIssues(candidate, expected)
        : exactCandidateIssues(candidate, expected)),
    ];
    const signals = exactSignalSpans(candidate.source.raw_entry_text, expected.signals);
    bindingIssues.push(...signals.issues);
    if (expected.required_clause) {
      const clauseMatches = String(candidate.source.raw_entry_text || '')
        .split(expected.required_clause).length - 1;
      if (clauseMatches !== 1) bindingIssues.push('required_clause_boundary');
    }
    if (bindingIssues.length) issues.push(...bindingIssues.map((issue) => `${code}:${issue}`));
    entries[code] = {
      course_key: candidate.course_key,
      scope: expected.scope,
      source_quality: expected.source_quality || 'exact_official_courseblock',
      disposition: expected.safe_structural_none ? 'safe_structural_none' : 'blocked',
      blocker: expected.blocker || null,
      source_response_sha256: candidate.source.source_response_sha256 || null,
      retained_normalized_text_sha256: candidate.source.retained_normalized_text_sha256,
      raw_entry_sha256: candidate.source.raw_entry_sha256,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256 || null,
      courseblock_index: candidate.source.courseblock_index ?? null,
      published_units: candidate.source.published_units || null,
      complete_entry_receipt: candidate.source.complete_entry_receipt || null,
      required_clause: expected.required_clause || null,
      required_clause_sha256: expected.required_clause ? sha256(expected.required_clause) : null,
      retained_signals: signals.spans,
      retained_signals_sha256: sha256(canonicalJson(signals.spans)),
    };
  }
  const receipt = {
    contract: CONTRACT,
    school_id: SCHOOL_ID,
    owner_namespace: OWNER,
    catalog_year: CATALOG_YEAR,
    target_codes: [...TARGET_CODES],
    exact_courseblock_codes: TARGET_CODES.filter((code) => !WEAK_CODES.includes(code)),
    weak_retained_text_codes: [...WEAK_CODES],
    safe_structural_none_codes: [...SAFE_CODES],
    blocked_codes: TARGET_CODES.filter((code) => !SAFE_CODES.includes(code)),
    entries,
    entries_sha256: sha256(canonicalJson(entries)),
  };
  return {
    verified: issues.length === 0 && Object.keys(entries).length === TARGET_CODES.length,
    issues: [...new Set(issues)].sort(),
    receipt,
  };
}

function vcuPrerequisiteControlSummary(control) {
  const entries = Object.values(control?.receipt?.entries || {});
  const partition = (scope) => {
    const scoped = entries.filter((entry) => entry.scope === scope);
    return {
      target_rows: scoped.length,
      exact_official_courseblock_rows: scoped.filter(
        (entry) => entry.source_quality === 'exact_official_courseblock',
      ).length,
      weak_retained_text_rows: scoped.filter(
        (entry) => entry.source_quality === 'retained_normalized_text_only',
      ).length,
      safe_structural_none_rows: scoped.filter(
        (entry) => entry.disposition === 'safe_structural_none',
      ).length,
      blocked_rows: scoped.filter((entry) => entry.disposition === 'blocked').length,
    };
  };
  return {
    contract: CONTRACT,
    verified: control?.verified === true,
    issues: [...asArray(control?.issues)],
    inventory_sha256: control?.receipt?.entries_sha256 || null,
    target_rows: entries.length,
    exact_official_courseblock_rows: entries.filter(
      (entry) => entry.source_quality === 'exact_official_courseblock',
    ).length,
    weak_retained_text_rows: entries.filter(
      (entry) => entry.source_quality === 'retained_normalized_text_only',
    ).length,
    safe_structural_none_rows: entries.filter(
      (entry) => entry.disposition === 'safe_structural_none',
    ).length,
    blocked_rows: entries.filter((entry) => entry.disposition === 'blocked').length,
    direct: partition('direct'),
    closure: partition('closure'),
    safe_codes: [...asArray(control?.receipt?.safe_structural_none_codes)],
    blocked_codes: [...asArray(control?.receipt?.blocked_codes)],
    weak_codes: [...asArray(control?.receipt?.weak_retained_text_codes)],
  };
}

function clausesIssues(clauses, expected) {
  const bounded = asArray(clauses);
  if (!expected.required_clause) return bounded.length ? ['unexpected_required_clause'] : [];
  return bounded.length === 1
    && bounded[0]?.kind === 'prerequisite'
    && bounded[0]?.raw === expected.required_clause
    && sha256(bounded[0].raw) === sha256(expected.required_clause)
    ? [] : ['required_clause'];
}

function resolveVcuPrerequisiteCandidate(candidate, clauses, control) {
  const expected = ROWS[candidate?.course_code];
  if (candidate?.slug !== SLUG || !expected) {
    return { applicable: false, ready: false, issues: [] };
  }
  const entry = control?.receipt?.entries?.[candidate.course_code];
  const issues = [
    ...identityIssues(candidate),
    ...(expected.source_quality === 'retained_normalized_text_only'
      ? weakCandidateIssues(candidate, expected)
      : exactCandidateIssues(candidate, expected)),
    ...clausesIssues(clauses, expected),
  ];
  const signals = exactSignalSpans(candidate.source.raw_entry_text, expected.signals);
  issues.push(...signals.issues);
  if (control?.verified !== true || asArray(control?.issues).length
      || control?.receipt?.contract !== CONTRACT
      || control?.receipt?.school_id !== SCHOOL_ID
      || control?.receipt?.owner_namespace !== OWNER
      || canonicalJson(control?.receipt?.target_codes) !== canonicalJson(TARGET_CODES)
      || sha256(canonicalJson(control?.receipt?.entries || null))
        !== control?.receipt?.entries_sha256
      || entry?.course_key !== candidate.course_key
      || entry?.raw_entry_sha256 !== expected.raw_entry_sha256
      || entry?.disposition !== (expected.safe_structural_none
        ? 'safe_structural_none' : 'blocked')
      || entry?.retained_signals_sha256 !== sha256(canonicalJson(signals.spans))) {
    issues.push('control_receipt');
  }
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues: [...new Set(issues)].sort(),
    review_reason: RECEIPT_MISMATCH_REASON,
  };

  const contentAccounting = {
    complete_entry_characters: String(candidate.source.raw_entry_text || '').length,
    retained_signal_count: signals.spans.length,
    every_reviewed_nonprerequisite_signal_marker_accounted_for: true,
    source_content_discarded: false,
  };
  const proofBase = {
    contract: CONTRACT,
    course_key: candidate.course_key,
    scope: expected.scope,
    source_quality: entry.source_quality,
    catalog_year: CATALOG_YEAR,
    official_url: candidate.source.official_url,
    source_response_sha256: candidate.source.source_response_sha256 || null,
    retained_normalized_text_sha256: candidate.source.retained_normalized_text_sha256,
    raw_entry_sha256: candidate.source.raw_entry_sha256,
    raw_entry_html_sha256: candidate.source.raw_entry_html_sha256 || null,
    retained_signals: signals.spans,
    content_accounting: contentAccounting,
  };

  if (!expected.safe_structural_none) return {
    applicable: true,
    ready: false,
    issues: [],
    review_reason: expected.blocker,
    retained_non_prerequisite_signals: signals.spans,
    blocker_evidence: {
      ...proofBase,
      required_clause: expected.required_clause || null,
      required_clause_sha256: expected.required_clause
        ? sha256(expected.required_clause) : null,
      inference_boundary: expected.source_quality === 'retained_normalized_text_only'
        ? 'The exact retained normalized text is not a complete official HTTP response or exact CourseLeaf courseblock receipt. Its apparent silence cannot become a none row.'
        : 'No prerequisite formula or structural-none row is emitted. Enrollment semantics and source-ambiguous Boolean punctuation remain blocked until the Figure 6 model or an authoritative source resolves them.',
    },
  };

  const page = PAGES[expected.page];
  return {
    applicable: true,
    ready: true,
    issues: [],
    status: 'none',
    review_status: 'promoted_structural_none',
    review_reason: STRUCTURAL_NONE_REASON,
    ignored_nonrequired_requisites: signals.spans,
    structural_none_evidence: {
      ...proofBase,
      kind: STRUCTURAL_NONE_KIND,
      course_entry_status: 'published_exact_courseleaf_courseblock',
      finding:
        'no_incoming_required_prerequisite_or_corequisite_after_exact_nonprerequisite_signal_classification',
      literal_none_statement: false,
      boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
      receipt_contract: CONTRACT,
      source_response_bytes: page.source_response_bytes,
      courseblock_index: expected.courseblock_index,
      published_units: expected.units,
      entry_marker_receipt: entry.complete_entry_receipt,
      source_marker_control: {
        source_response_sha256: page.source_response_sha256,
        source_courseblock_count: page.source_courseblock_count,
        source_complete_entry_count: page.source_complete_entry_count,
        source_complete_entries_with_required_requisite_marker_count:
          page.source_positive_count,
        same_source_positive_control: true,
      },
      inference_boundary:
        'This proves only that one exact, present, complete VCU CourseLeaf entry has no incoming required prerequisite/corequisite after all pinned nonprerequisite signals are retained. It does not discard credit, grade, applicability, or outbound-prerequisite statements and does not infer from a missing search result.',
    },
  };
}

function vcuPrerequisiteResolutionRowIssues(row) {
  const expected = ROWS[row?.code];
  if (row?.slug !== SLUG || !expected) return [];
  const issues = [];
  if (row.school_id !== SCHOOL_ID || row.owner_namespace !== OWNER
      || row.course_key !== `${OWNER}:${row.code}`) issues.push('identity');
  if (row.catalog_year !== CATALOG_YEAR
      || row.source_url !== (expected.page ? PAGES[expected.page].official_url : PAGES.cmsc.official_url)
      || row.source_content_sha256 !== expected.raw_entry_sha256
      || row.review_evidence?.raw_entry_sha256 !== expected.raw_entry_sha256) {
    issues.push('source_binding');
  }
  const signals = exactSignalSpans(row.review_evidence?.raw_entry_text, expected.signals);
  if (signals.issues.length) issues.push('retained_signal_spans');
  const absolute = signals.spans.map((signalRow) => ({
    ...signalRow,
    source_character_start: row.review_evidence.entry_character_start + signalRow.relative_start,
    source_character_end: row.review_evidence.entry_character_start + signalRow.relative_end,
  }));
  if (expected.safe_structural_none) {
    const none = row.structural_none_evidence;
    if (row.status !== 'none' || row.review_status !== 'promoted_structural_none'
        || row.review_reason !== STRUCTURAL_NONE_REASON || row.raw_requisites !== null
        || asArray(row.groups).length !== 0
        || canonicalJson(row.ignored_nonrequired_requisites) !== canonicalJson(absolute)) {
      issues.push('safe_row_projection');
    }
    if (none?.contract !== CONTRACT || none?.receipt_contract !== CONTRACT
        || none?.kind !== STRUCTURAL_NONE_KIND
        || none?.literal_none_statement !== false
        || none?.source_response_sha256 !== PAGES[expected.page].source_response_sha256
        || none?.raw_entry_sha256 !== expected.raw_entry_sha256
        || none?.raw_entry_html_sha256 !== expected.raw_entry_html_sha256
        || none?.courseblock_index !== expected.courseblock_index
        || canonicalJson(none?.published_units) !== canonicalJson(expected.units)
        || none?.entry_marker_receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
        || none?.entry_marker_receipt?.entry_required_requisite_marker_count !== 0
        || none?.entry_marker_receipt?.entry_corequisite_marker_count !== 0
        || none?.entry_marker_receipt?.same_source_positive_control !== true
        || none?.content_accounting?.source_content_discarded !== false
        || none?.content_accounting
          ?.every_reviewed_nonprerequisite_signal_marker_accounted_for !== true
        || canonicalJson(none?.retained_signals) !== canonicalJson(signals.spans)) {
      issues.push('structural_none_evidence');
    }
  } else {
    const audit = row.vcu_prerequisite_closure_audit;
    if (row.status !== 'unparsed' || row.review_status !== 'not_promoted'
        || row.review_reason !== expected.blocker || asArray(row.groups).length !== 0
        || canonicalJson(row.retained_non_prerequisite_signals) !== canonicalJson(absolute)) {
      issues.push('blocked_row_projection');
    }
    if (audit?.contract !== CONTRACT || audit?.course_key !== row.course_key
        || audit?.raw_entry_sha256 !== expected.raw_entry_sha256
        || audit?.source_quality !== (expected.source_quality || 'exact_official_courseblock')
        || audit?.content_accounting?.source_content_discarded !== false
        || canonicalJson(audit?.retained_signals) !== canonicalJson(signals.spans)) {
      issues.push('blocker_evidence');
    }
    if (WEAK_CODES.includes(row.code) && (
      row.review_evidence?.capture_origin != null
      || row.review_evidence?.source_response_sha256 != null
      || row.review_evidence?.raw_entry_html_sha256 != null
    )) issues.push('weak_source_misrepresented_as_exact');
  }
  return [...new Set(issues)].sort();
}

module.exports = {
  CATALOG_YEAR,
  CONTRACT,
  OWNER,
  PAGES,
  ROWS,
  SAFE_CODES,
  SLUG,
  STRUCTURAL_NONE_KIND,
  STRUCTURAL_NONE_REASON,
  TARGET_CODES,
  WEAK_CODES,
  WEAK_TEXT_CACHE_PATH,
  WEAK_TEXT_SHA256,
  buildVcuPrerequisiteControlFromCandidates,
  canonicalJson,
  resolveVcuPrerequisiteCandidate,
  sha256,
  vcuPrerequisiteControlSummary,
  vcuPrerequisiteResolutionRowIssues,
};
