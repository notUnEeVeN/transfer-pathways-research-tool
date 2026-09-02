/**
 * Exact, finite evidence for George Mason direct-path courses whose complete
 * CourseLeaf entry publishes no *required* prerequisite or corequisite.
 *
 * Mason's catalog deliberately distinguishes `Required Prerequisite(s):`
 * from `Recommended Prerequisite:` and `Recommended Corequisite:`.  The
 * generic CourseLeaf marker counter is lexical, so it conservatively treats a
 * recommendation as prerequisite-like.  This resolver may classify only the
 * fixed rows below, only at their exact response/entry fingerprints, and only
 * after preserving every reviewed nonrequired signal as span-bound evidence.
 * `none` therefore means no required prerequisite/corequisite graph edge; it
 * does not mean that the course has no recommendation, restriction, grade,
 * concurrency, repeat-credit, or enrollment condition.
 */

const crypto = require('node:crypto');

const CONTRACT =
  'gmu_exact_complete_courseleaf_required_requisite_silence_with_nonrequired_signal_accounting_v1';
const REVIEW_REASON =
  'exact_gmu_complete_entry_no_required_requisite_with_nonrequired_signals_preserved';
const SCHOOL_ID = 9210;
const SLUG = 'george-mason-university';
const OWNER = 'va:uni:9210';
const CATALOG_YEAR = '2026-2027';
const COURSELEAF_BOUNDARY =
  'unique_courseblock_exact_leading_code_with_published_units';
const COURSELEAF_RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';

const PAGE = Object.freeze({
  biol: Object.freeze({
    official_url: 'https://catalog.gmu.edu/courses/biol/',
    cache_path:
      'university-prerequisites/raw/george-mason-university/george-mason-university__biol.html',
    source_response_sha256:
      '4eaecb7ae7b85aa4460ce5c110f6fa915a515808370de3d37fe546c111877fcd',
    source_response_bytes: 307055,
    source_courseblock_count: 196,
    source_complete_entry_count: 196,
    source_positive_control_count: 175,
  }),
  chem: Object.freeze({
    official_url: 'https://catalog.gmu.edu/courses/chem/',
    cache_path:
      'university-prerequisites/raw/george-mason-university/george-mason-university__chem.html',
    source_response_sha256:
      'b461ae025f816a3ddf4604611a1eb28c1d04b67ece2d1c67a2f66a60e57639dc',
    source_response_bytes: 206849,
    source_courseblock_count: 97,
    source_complete_entry_count: 97,
    source_positive_control_count: 87,
  }),
  cs: Object.freeze({
    official_url: 'https://catalog.gmu.edu/courses/cs/',
    cache_path:
      'university-prerequisites/raw/george-mason-university/george-mason-university__cs.html',
    source_response_sha256:
      '5180e1335639e2e9d1778c0dd19d051ed3cce9e4035b6749597ab56cef4e5600',
    source_response_bytes: 222649,
    source_courseblock_count: 103,
    source_complete_entry_count: 103,
    source_positive_control_count: 95,
  }),
  ece: Object.freeze({
    official_url: 'https://catalog.gmu.edu/courses/ece/',
    cache_path:
      'university-prerequisites/raw/george-mason-university/george-mason-university__ece.html',
    source_response_sha256:
      'be9819b8dcda2f3f7ccd700e923acd8277396e8a5b0cd4bf2ffae63ed09892a0',
    source_response_bytes: 388340,
    source_courseblock_count: 178,
    source_complete_entry_count: 178,
    source_positive_control_count: 148,
  }),
  engh: Object.freeze({
    official_url: 'https://catalog.gmu.edu/courses/engh/',
    cache_path:
      'university-prerequisites/raw/george-mason-university/george-mason-university__engh.html',
    source_response_sha256:
      '35036ea113eaf362d2e9d6eccd9db508c40e36452dcab0a2a1d1237884bd7b42',
    source_response_bytes: 288842,
    source_courseblock_count: 202,
    source_complete_entry_count: 202,
    source_positive_control_count: 134,
  }),
  geol: Object.freeze({
    official_url: 'https://catalog.gmu.edu/courses/geol/',
    cache_path:
      'university-prerequisites/raw/george-mason-university/george-mason-university__geol.html',
    source_response_sha256:
      '64d7bb9458feb00cc2d0f5e8cd5d45081da70b2c9a3bd2f895db9fa8b8453d93',
    source_response_bytes: 150216,
    source_courseblock_count: 78,
    source_complete_entry_count: 78,
    source_positive_control_count: 65,
  }),
  phil: Object.freeze({
    official_url: 'https://catalog.gmu.edu/courses/phil/',
    cache_path:
      'university-prerequisites/raw/george-mason-university/george-mason-university__phil.html',
    source_response_sha256:
      'ccefe83f733f2afd948f79054fe05f955315a385ff38afd5490d911cb247d1f4',
    source_response_bytes: 107615,
    source_courseblock_count: 74,
    source_complete_entry_count: 74,
    source_positive_control_count: 37,
  }),
});

const signal = (kind, raw) => Object.freeze({ kind, raw });
const fixedUnits = (notation, creditHours, headingTextSha256) => Object.freeze({
  kind: 'published_fixed_credits',
  notation,
  credit_hours_min: creditHours,
  credit_hours_max: creditHours,
  heading_text_sha256: headingTextSha256,
});

const RECEIPTS = Object.freeze({
  BIOL102: Object.freeze({
    page: 'biol', courseblock_index: 1, entry_length: 691,
    raw_entry_sha256: '9e33a167b0f7f10de0d09ccb1ecc6db643436a25c132fd7ae687d1dbe3cbe16d',
    raw_entry_html_sha256: 'f8f993aaf83ebcceea63ff5d053c82485e7c62e83881dcb75597a66d6fab5671',
    published_units: fixedUnits('4 credits', 4, '8ab1d74f2216f9e78ad76cb419b75e6ec0bb9556390bd789aa4b6645a4b96d53'),
    marker_counts: Object.freeze([0, 0, 0, 1]),
    signals: Object.freeze([
      signal('audience_eligibility_note', 'Survey course suitable for any major.'),
      signal('anti_requisite', 'Biology majors may not take after BIOL 200-level or above courses have been taken.'),
      signal('attempt_limit', 'Limited to three attempts.'),
    ]),
  }),
  BIOL103: Object.freeze({
    page: 'biol', courseblock_index: 2, entry_length: 756,
    raw_entry_sha256: '40b41398e63a3cbed712de5cc55058bdade9e37fb9453aae5ccc3dd42ac88cb5',
    raw_entry_html_sha256: '640835d70ada00e07f3ced0e1c425ddc01ff28cf2c62bb0ced94b5c781ec03ac',
    published_units: fixedUnits('3 credits', 3, 'a034a0e02f8cbae6ca8c1564fa3c7236b9b5215701fdf2590607ff38f1f3db63'),
    marker_counts: Object.freeze([0, 0, 0, 1]),
    signals: Object.freeze([
      signal('audience_eligibility_note', 'This is a survey course suitable for any major.'),
      signal('anti_requisite', 'Biology majors may not take BIOL 103 after having taken a BIOL course at the 200 level or above.'),
      signal('attempt_limit', 'Limited to three attempts.'),
    ]),
  }),
  BIOL105: Object.freeze({
    page: 'biol', courseblock_index: 3, entry_length: 430,
    raw_entry_sha256: 'd228e201b57df75280255ce8ff4b734b19fbd80b368739236469e39bed1e2272',
    raw_entry_html_sha256: '4570c46124f99adefa3ecb7d078cb41f6a006b1cbbc4274da4f1286e0e09cf32',
    published_units: fixedUnits('1 credit', 1, '72ab8ab2e2b44c4b8a12b5fca8c9428e9e699273e9548f5a7d11b34d2e706881'),
    marker_counts: Object.freeze([1, 1, 2, 0]),
    signals: Object.freeze([
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('recommended_prerequisite', 'Recommended Prerequisite: BIOL 103'),
      signal('recommended_corequisite', 'Recommended Corequisite: BIOL 103'),
    ]),
  }),
  BIOL106: Object.freeze({
    page: 'biol', courseblock_index: 4, entry_length: 415,
    raw_entry_sha256: '245e45ffbae711dd622e6115962884c8445cc6a399e1669b774766265352a8b4',
    raw_entry_html_sha256: '662e337e915da364d3003260650d3502e319b0aded4a10d9f8bcc3f9726de74e',
    published_units: fixedUnits('1 credit', 1, '8173a4f4f2b5c1c0034e25a81ae05af9cc8de84ea51a6c4b90a8560e3f2ffe77'),
    marker_counts: Object.freeze([1, 0, 1, 0]),
    signals: Object.freeze([
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('recommended_prerequisite', 'Recommended Prerequisite: BIOL 102T'),
    ]),
  }),
  BIOL107: Object.freeze({
    page: 'biol', courseblock_index: 5, entry_length: 572,
    raw_entry_sha256: '7e4512aebf7a3ff44f2db2d4aae40caffa2c95c1182c01a628753e33d26c34df',
    raw_entry_html_sha256: 'eabf4ed4978953847a35407fde7eb001f619e7ebb415d86cf1652e8869479fa9',
    published_units: fixedUnits('3 credits', 3, 'a244cc9203485d0d71b8c9b01acbeb9e6c3a10f72ba84f4db248edcef429790d'),
    marker_counts: Object.freeze([0, 0, 0, 1]),
    signals: Object.freeze([
      signal('strong_course_sequence_recommendation', 'Students are strongly urged to take BIOL 103 prior to BIOL 107.'),
      signal('audience_eligibility_note', 'Survey course suitable for any major.'),
      signal('anti_requisite', 'May not be taken after BIOL 200-level or above courses have been taken.'),
      signal('attempt_limit', 'Limited to three attempts.'),
    ]),
  }),
  CHEM211: Object.freeze({
    page: 'chem', courseblock_index: 8, entry_length: 636,
    raw_entry_sha256: '672ce78583cb1a06b7017e3b410bbf01ca66f602abfb339c1df3aafd583df882',
    raw_entry_html_sha256: '3c0add9046293507d46400a2dc8e8779c70dbd5c61db8d6960a2679ebc60f7b1',
    published_units: fixedUnits('3 credits', 3, '3b601de1f9eb5c199bf9406b0988e1560cebfc7c7a1c777cd5261e753502d421'),
    marker_counts: Object.freeze([0, 1, 2, 1]),
    signals: Object.freeze([
      signal('anti_credit_restriction', 'Credit will not be given for this course and CHEM 103, 104.'),
      signal('academic_program_recommendation', 'Students majoring in science, engineering, or mathematics should choose this course sequence.'),
      signal('outbound_prerequisite_note', 'CHEM 211 is a prerequisite to CHEM 212.'),
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('recommended_corequisite', 'Recommended Corequisite: CHEM 213'),
    ]),
  }),
  CS108: Object.freeze({
    page: 'cs', courseblock_index: 2, entry_length: 1010,
    raw_entry_sha256: '911c4195b9eddf7fc7a023c79b09449b59ef251ab874f8dcae51646d995067bc',
    raw_entry_html_sha256: 'e25a9e6666009322c68a3b760750cb5830e9a4e62025f9221e421df198e9f388',
    published_units: fixedUnits('3 credits', 3, '22396af0eaf1e6a72a84a5120e2efbc38c8d553ce8e70ace2b12b5c58c3d7f38'),
    marker_counts: Object.freeze([0, 0, 0, 1]),
    signals: Object.freeze([
      signal('audience_background_note', 'This is the first of a two semester sequence intended for students with little or no programming experience, which introduces the field of Computer Science as well as the basics of programming commensurate with a first course in programming.'),
      signal('attempt_limit', 'Limited to two attempts.'),
      signal('registration_restriction', 'Registration Restrictions: Students with the terminated from CEC major attribute may not enroll.'),
    ]),
  }),
  CS110: Object.freeze({
    page: 'cs', courseblock_index: 4, entry_length: 892,
    raw_entry_sha256: '920ab55bc07e5ffb127d3fdfee3b3d60fc3b419ef102c1776fcda2ee0e44da76',
    raw_entry_html_sha256: '25c5d39c9a300651007efdee01bdeb51f41f72bc7e43714060c1ef74616370aa',
    published_units: fixedUnits('3 credits', 3, '94a2b37ce63a71ff497b39664f6f800454072b21df14b52062963287e661b5d8'),
    marker_counts: Object.freeze([0, 0, 0, 5]),
    signals: Object.freeze([
      signal('degree_timing_requirement', 'Note: All computer science majors are required to take this course within their first year as a computer science major.'),
      signal('attempt_limit', 'Limited to two attempts.'),
      signal('program_enrollment_restriction', 'Registration Restrictions: Enrollment limited to students in the EC-BS-ACS or EC-BS-CS programs.'),
      signal('attribute_enrollment_restriction', 'Students with the terminated from CEC major attribute may not enroll.'),
    ]),
  }),
  ECE511: Object.freeze({
    page: 'ece', courseblock_index: 68, entry_length: 1144,
    raw_entry_sha256: 'fc67eb21c9889bcac4122d2b5317258dbea9707fec315503d55cb29417d23751',
    raw_entry_html_sha256: '962693958fe17f374c769313f70a6398c359c098751e6b5ad7bd9582290abd2a',
    published_units: fixedUnits('3 credits', 3, 'b8758292f60c7575ec389ef20848f482869cb1dc23aef18e31fb3dae0155531e'),
    marker_counts: Object.freeze([1, 0, 1, 8]),
    signals: Object.freeze([
      signal('repeat_credit_restriction', 'May not be repeated for credit.'),
      signal('recommended_prerequisite', 'Recommended Prerequisite: ECE 445 or CS 465 or permission of instructor'),
      signal('class_enrollment_restriction', 'Registration Restrictions: Enrollment limited to students with a class of Advanced to Candidacy, Graduate, Junior Plus, Non-Degree or Senior Plus.'),
      signal('level_enrollment_restriction', 'Enrollment is limited to Graduate, Non-Degree or Undergraduate level students.'),
      signal('degree_enrollment_restriction', 'Students in a Non-Degree Undergraduate degree may not enroll.'),
      signal('college_enrollment_restriction', 'Enrollment limited to students in the College of Science, Engineering Computing or Schar School of Policy and Gov colleges.'),
    ]),
  }),
  ENGH100: Object.freeze({
    page: 'engh', courseblock_index: 0, entry_length: 1165,
    raw_entry_sha256: '41d73cb0434ce4e19d9fe5736465ef67a90d26390ea822c07314bde4b544aff1',
    raw_entry_html_sha256: '0c4e00ddd9c721a992d717311f0f542e763417d3aae7b266928fa762103ca620',
    published_units: fixedUnits('4 credits', 4, 'a2c9116ba0c972e221c6996ab2670dee9d66bc4f39e98e2be1e9f692b85c6f46'),
    marker_counts: Object.freeze([0, 0, 0, 2]),
    signals: Object.freeze([
      signal('degree_minimum_grade_note', 'Note: Students must attain a minimum grade of C- to fulfill degree requirements.'),
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('course_equivalence_note', 'Equivalent to ENGH 101, ENGH 122, ENGH 123.'),
    ]),
  }),
  ENGH101: Object.freeze({
    page: 'engh', courseblock_index: 1, entry_length: 1237,
    raw_entry_sha256: '76a6cb1464be81690c9f43b8bb5c6704313238dea703003fe56d51e76f9dbcd8',
    raw_entry_html_sha256: '8ae7133c7654cb9a8fe78adbe11a9699e3ad070a83b87f1a81cabf30eba572d8',
    published_units: fixedUnits('3 credits', 3, '890277a4d4f12d386ce03213d8fec2283558ed3472b4682f20981bdfe3e42223'),
    marker_counts: Object.freeze([0, 0, 0, 2]),
    signals: Object.freeze([
      signal('degree_minimum_grade_note', 'Notes: Students must attain minimum grade of C- to fulfill degree requirements.'),
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('course_equivalence_note', 'Equivalent to ENGH 100, ENGH 122, ENGH 123.'),
    ]),
  }),
  ENGH388: Object.freeze({
    page: 'engh', courseblock_index: 69, entry_length: 816,
    raw_entry_sha256: '208fa04633bdde332ad138a594bdbd4b88fd1f1f6fe8daa96bf80fc7f2c456e3',
    raw_entry_html_sha256: '5a536da6b78aee526c5a168d9e8c2eb23d3ac181f07fc4c90e8179bafa53edbd',
    published_units: fixedUnits('3 credits', 3, '785546b99252e5ac5364e7ac3b000df7ae11ebc6374a16927a5962ae653b72e4'),
    marker_counts: Object.freeze([1, 0, 1, 1]),
    signals: Object.freeze([
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('recommended_prerequisite', 'Recommended Prerequisite: ENGH 302.'),
    ]),
  }),
  GEOL102: Object.freeze({
    page: 'geol', courseblock_index: 1, entry_length: 715,
    raw_entry_sha256: '42fe9e9968551a00ff6eae6c97a2f86cab31f4a2b0699b1fcfb0012a38fbf186',
    raw_entry_html_sha256: 'e4ad7e959ae16d168f6759c61155d15b5e34c3a959afe4c4e1f9d927f2f1b1c4',
    published_units: fixedUnits('3 credits', 3, 'e88a8b5f6595b8dae0c80cc5836f949ca9a32b7d085f9443f7a087d95959a522'),
    marker_counts: Object.freeze([1, 0, 1, 0]),
    signals: Object.freeze([
      signal('concurrent_sequence_advice', 'For students desiring a four-credit sequence with a lab, GEOL 104 should be taken concurrently.'),
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('recommended_prerequisite', 'Recommended Prerequisite: GEOL 101 + GEOL 103'),
    ]),
  }),
  PHIL371: Object.freeze({
    page: 'phil', courseblock_index: 37, entry_length: 731,
    raw_entry_sha256: '1a961fe79de00c55cae375b6a87f1452627ec6c50a2e74cba31fdd261577e1d6',
    raw_entry_html_sha256: 'a48ba7f8cc3b767561f76b38d0958e9a97d288e959ea7aeca8899169d5805552',
    published_units: fixedUnits('3 credits', 3, 'c260c26451ceb395eab1d2b679673f3b63290edf7821956cdf67bd96e8e6d6c5'),
    marker_counts: Object.freeze([1, 0, 1, 2]),
    signals: Object.freeze([
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('recommended_prerequisite', 'Recommended Prerequisite: PHIL 271 or permission of instructor.'),
    ]),
  }),
  PHIL376: Object.freeze({
    page: 'phil', courseblock_index: 41, entry_length: 499,
    raw_entry_sha256: 'bb42872625dcd1c0c32f5a521699ab896bb47de24b9098a3fbc53c70fb1d671e',
    raw_entry_html_sha256: '4794d7ff7d0224d636bc4005237b9bf1baea4e02bb67a24c4685b7a62ecbced0',
    published_units: fixedUnits('3 credits', 3, '2b0a8f2d036129729f659f5556d3fe931ec5c6e53ac1143020e9cac023821123'),
    marker_counts: Object.freeze([1, 0, 1, 2]),
    signals: Object.freeze([
      signal('attempt_limit', 'Limited to three attempts.'),
      signal('recommended_prerequisite', 'Recommended Prerequisite: PHIL 173 or MATH 110 or permission of instructor.'),
    ]),
  }),
});

const TARGET_CODES = Object.freeze(Object.keys(RECEIPTS));
const REACQUIRE_CODES = Object.freeze(['CS108', 'CS110']);
const targetCodeSet = new Set(TARGET_CODES);

const SIGNAL_MARKER = /(?:Recommended\s+(?:Pre|Co)requisites?|Registration Restrictions|Enrollment (?:is )?limited|may not enroll|must attain (?:a )?minimum grade|minimum grade|may not (?:take|be taken|be repeated)|Credit will not be given|Limited to (?:two|three) attempts|taken concurrently|is a prerequisite to|strongly urged to take|required to take this course|Equivalent to|permission of instructor|should choose this course sequence|suitable for any major|little or no programming experience)/gi;
const REQUIRED_LABEL = /Required\s+(?:Pre|Co)-?requisites?\s*:/gi;
const UNQUALIFIED_LABEL = /(?:^|[^A-Za-z])((?:Pre|Co)-?requisites?\s*:)/gi;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const same = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isScopedGeorgeMasonPrerequisiteSilence({
  school_id: schoolId,
  slug,
  owner_namespace: ownerNamespace,
  course_code: courseCode,
  code,
  course_key: courseKey,
} = {}) {
  const normalized = normalizeCode(courseCode || code);
  return (schoolId == null || schoolId === SCHOOL_ID)
    && slug === SLUG
    && ownerNamespace === OWNER
    && targetCodeSet.has(normalized)
    && (courseKey == null || courseKey === `${OWNER}:${normalized}`);
}

function scopedUnparsedCourseKeys(review) {
  const rows = [
    ...(Array.isArray(review?.direct_review_rows) ? review.direct_review_rows : []),
    ...(Array.isArray(review?.closure_review_rows) ? review.closure_review_rows : []),
  ];
  return [...new Set(rows.filter((row) => (
    row?.status === 'unparsed'
      && REACQUIRE_CODES.includes(normalizeCode(row.code || row.course_code))
      && isScopedGeorgeMasonPrerequisiteSilence(row)
  )).map((row) => row.course_key))].sort();
}

function expectedCompleteEntryReceipt(code) {
  const receipt = RECEIPTS[code];
  const page = PAGE[receipt.page];
  const [required, corequisite, markerLike, constraintLike] = receipt.marker_counts;
  return {
    receipt_contract: COURSELEAF_RECEIPT,
    source_courseblock_count: page.source_courseblock_count,
    source_complete_entry_count: page.source_complete_entry_count,
    source_complete_entries_with_required_requisite_marker_count:
      page.source_positive_control_count,
    entry_required_requisite_marker_count: required,
    entry_corequisite_marker_count: corequisite,
    entry_requisite_marker_like_count: markerLike,
    entry_constraint_like_signal_count: constraintLike,
    same_source_positive_control: true,
  };
}

function boundedSignals(candidate, receipt) {
  const text = String(candidate?.source?.raw_entry_text || '');
  const issues = [];
  const rows = receipt.signals.map((entry, index) => {
    const relativeStart = text.indexOf(entry.raw);
    if (relativeStart < 0 || text.indexOf(entry.raw, relativeStart + 1) >= 0) {
      issues.push(`nonrequired_signal_${index}_boundary`);
    }
    const safeStart = Math.max(0, relativeStart);
    return {
      kind: entry.kind,
      raw: entry.raw,
      raw_sha256: sha256(entry.raw),
      relative_start: relativeStart,
      relative_end: relativeStart + entry.raw.length,
      source_character_start: candidate.source.character_start + safeStart,
      source_character_end: candidate.source.character_start + safeStart + entry.raw.length,
      required_prerequisite_graph_edge_emitted: false,
    };
  });
  const matches = [...text.matchAll(SIGNAL_MARKER)];
  const unaccounted = matches.filter((match) => !rows.some((row) => (
    match.index >= row.relative_start
      && match.index + match[0].length <= row.relative_end
  )));
  if (unaccounted.length) issues.push('unaccounted_nonrequired_signal_marker');
  return { rows, marker_count: matches.length, issues };
}

function unqualifiedFormalLabels(text) {
  return [...String(text || '').matchAll(UNQUALIFIED_LABEL)].filter((match) => {
    const prefix = String(text).slice(Math.max(0, match.index - 20), match.index + 1);
    return !/(?:Required|Recommended)\s*$/i.test(prefix);
  });
}

function candidateIssues(candidate, clauses = []) {
  if (!isScopedGeorgeMasonPrerequisiteSilence(candidate)) return ['not_scoped'];
  const code = normalizeCode(candidate.course_code);
  const receipt = RECEIPTS[code];
  const page = PAGE[receipt.page];
  const source = candidate.source || {};
  const issues = [];
  const require = (condition, issue) => { if (!condition) issues.push(issue); };
  require(candidate.school_id === SCHOOL_ID, 'school_id');
  require(candidate.course_key === `${OWNER}:${code}`, 'course_key');
  require(source.capture_origin === 'official_acquisition', 'capture_origin');
  require(source.source_format === 'courseleaf_courseblock', 'source_format');
  require(source.boundary_contract === COURSELEAF_BOUNDARY, 'boundary_contract');
  require(source.catalog_year_verified === CATALOG_YEAR, 'catalog_year');
  require(source.official_url === page.official_url, 'official_url');
  require(source.cache_path === page.cache_path, 'cache_path');
  require(source.source_response_sha256 === page.source_response_sha256
    && source.declared_normalized_text_sha256 === page.source_response_sha256
    && source.retained_normalized_text_sha256 === page.source_response_sha256,
  'source_response_sha256');
  require(source.source_response_bytes === page.source_response_bytes, 'source_response_bytes');
  require(source.courseblock_index === receipt.courseblock_index, 'courseblock_index');
  require(source.character_start === 0
    && source.character_end === receipt.entry_length
    && source.raw_entry_text?.length === receipt.entry_length,
  'entry_boundary');
  require(source.raw_entry_sha256 === receipt.raw_entry_sha256
    && sha256(source.raw_entry_text) === receipt.raw_entry_sha256,
  'raw_entry');
  require(source.raw_entry_html_sha256 === receipt.raw_entry_html_sha256,
    'raw_entry_html_sha256');
  require(same(source.published_units, receipt.published_units), 'published_units');
  require(same(source.complete_entry_receipt, expectedCompleteEntryReceipt(code)),
    'complete_entry_receipt');
  require(same(source.structured_requisite_fields, []), 'structured_requisite_fields');
  require(Array.isArray(clauses) && clauses.length === 0, 'unexpected_required_clause');
  require((source.raw_entry_text.match(REQUIRED_LABEL) || []).length === 0,
    'required_label_present');
  require(unqualifiedFormalLabels(source.raw_entry_text).length === 0,
    'unqualified_requisite_label_present');
  const signals = boundedSignals(candidate, receipt);
  issues.push(...signals.issues);
  return [...new Set(issues)];
}

function proof(candidate) {
  const code = normalizeCode(candidate.course_code);
  const receipt = RECEIPTS[code];
  const page = PAGE[receipt.page];
  const signals = boundedSignals(candidate, receipt);
  return {
    kind: 'official_complete_gmu_courseleaf_entry_required_requisite_silence',
    contract: CONTRACT,
    course_entry_status: 'published_exact_courseleaf_courseblock',
    finding: 'no_required_prerequisite_or_corequisite_label_in_complete_entry',
    literal_none_statement: false,
    boundary_contract: COURSELEAF_BOUNDARY,
    receipt_contract: CONTRACT,
    owner_namespace: OWNER,
    course_key: `${OWNER}:${code}`,
    catalog_year: CATALOG_YEAR,
    source_url: page.official_url,
    source_cache_path: page.cache_path,
    source_response_sha256: page.source_response_sha256,
    source_response_bytes: page.source_response_bytes,
    raw_entry_sha256: receipt.raw_entry_sha256,
    raw_entry_html_sha256: receipt.raw_entry_html_sha256,
    courseblock_index: receipt.courseblock_index,
    published_units: receipt.published_units,
    marker_control: expectedCompleteEntryReceipt(code),
    formal_required_label_audit: {
      required_prerequisite_or_corequisite_label_count: 0,
      unqualified_prerequisite_or_corequisite_label_count: 0,
      same_response_positive_control_count: page.source_positive_control_count,
      generic_marker_counts_are_lexical_and_may_include_recommendations: true,
    },
    nonrequired_signal_count: signals.rows.length,
    nonrequired_signal_marker_count: signals.marker_count,
    nonrequired_signals: signals.rows.map((row) => {
      const {
        source_character_start,
        source_character_end,
        ...relative
      } = row;
      return relative;
    }),
    content_accounting: {
      full_entry_sha256: receipt.raw_entry_sha256,
      every_reviewed_nonrequired_signal_marker_accounted_for: true,
      source_content_discarded: false,
    },
    inference_boundary:
      'Status none means only that this exact complete GMU entry publishes no Required Prerequisite(s) or Required Corequisite(s). Every reviewed recommendation, corequisite recommendation, anti-requisite, repeat/credit restriction, grade note, concurrency note, attempt limit, and enrollment signal remains span-bound audit evidence and emits no required prerequisite graph edge.',
  };
}

function resolveGeorgeMasonPrerequisiteSilence(candidate, clauses = []) {
  if (!isScopedGeorgeMasonPrerequisiteSilence(candidate)) {
    return { applicable: false, ready: false, issues: [] };
  }
  const issues = candidateIssues(candidate, clauses);
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues,
    review_reason: 'gmu_exact_required_requisite_silence_receipt_changed',
  };
  const receipt = RECEIPTS[normalizeCode(candidate.course_code)];
  return {
    applicable: true,
    ready: true,
    issues: [],
    review_reason: REVIEW_REASON,
    ignored_nonrequired_requisites: boundedSignals(candidate, receipt).rows,
    structural_none_evidence: proof(candidate),
  };
}

function resolutionRowIssues(row) {
  if (!isScopedGeorgeMasonPrerequisiteSilence(row)) return [];
  const issues = [];
  if (row.status !== 'none' || row.review_status !== 'promoted_structural_none'
      || row.review_reason !== REVIEW_REASON || row.raw_requisites !== null
      || !Array.isArray(row.groups) || row.groups.length !== 0) issues.push('review_status');
  const replayCandidate = {
    school_id: row.school_id,
    slug: row.slug,
    owner_namespace: row.owner_namespace,
    course_key: row.course_key,
    course_code: row.code,
    source: {
      official_url: row.review_evidence?.official_url,
      declared_normalized_text_sha256:
        row.review_evidence?.declared_normalized_text_sha256,
      retained_normalized_text_sha256:
        row.review_evidence?.retained_normalized_text_sha256,
      character_start: row.review_evidence?.entry_character_start,
      character_end: row.review_evidence?.entry_character_end,
      raw_entry_sha256: row.review_evidence?.raw_entry_sha256,
      raw_entry_text: row.review_evidence?.raw_entry_text,
      capture_origin: row.review_evidence?.capture_origin,
      source_format: row.review_evidence?.source_format,
      boundary_contract: row.review_evidence?.boundary_contract,
      catalog_year_verified: row.review_evidence?.catalog_year_verified,
      source_response_sha256: row.review_evidence?.source_response_sha256,
      source_response_bytes: row.review_evidence?.source_response_bytes,
      cache_path: row.review_evidence?.cache_path,
      courseblock_index: row.review_evidence?.courseblock_index,
      published_units: row.review_evidence?.published_units,
      raw_entry_html_sha256: row.review_evidence?.raw_entry_html_sha256,
      complete_entry_receipt: row.review_evidence?.complete_entry_receipt,
      structured_requisite_fields: row.review_evidence?.structured_requisite_fields,
    },
  };
  const resolved = resolveGeorgeMasonPrerequisiteSilence(replayCandidate, []);
  if (!resolved.ready) issues.push('source_receipt');
  else {
    if (!same(row.ignored_nonrequired_requisites,
      resolved.ignored_nonrequired_requisites)) issues.push('nonrequired_signals');
    if (!same(row.structural_none_evidence,
      resolved.structural_none_evidence)) issues.push('structural_none_evidence');
  }
  if (row.source_content_sha256 !== row.review_evidence?.raw_entry_sha256
      || row.source_evidence?.content_sha256 !== row.review_evidence?.raw_entry_sha256
      || row.source_evidence?.raw_text !== row.review_evidence?.raw_entry_text) {
    issues.push('source_binding');
  }
  return issues;
}

module.exports = {
  CATALOG_YEAR,
  CONTRACT,
  OWNER,
  PAGE,
  REACQUIRE_CODES,
  RECEIPTS,
  REVIEW_REASON,
  SCHOOL_ID,
  SLUG,
  TARGET_CODES,
  boundedSignals,
  candidateIssues,
  expectedCompleteEntryReceipt,
  isScopedGeorgeMasonPrerequisiteSilence,
  proof,
  resolutionRowIssues,
  resolveGeorgeMasonPrerequisiteSilence,
  scopedUnparsedCourseKeys,
  sha256,
};
