const crypto = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'william_mary_2026_2027_current_catalog_figure_evidence';
const CATALOG_YEAR = '2026-2027';
const PROGRAM_URL =
  'https://catalog.wm.edu/programs/computer-science-bs-computer-science/index.html';
const CSCI_URL = 'https://catalog.wm.edu/undergraduate/courses/csci/';
const MATH_URL = 'https://catalog.wm.edu/undergraduate/courses/math/';
const GE_URL = 'https://catalog.wm.edu/undergraduate/requirements-degrees/';
const ROBOTS_URL = 'https://catalog.wm.edu/robots.txt';

const EXPECTED_SHA256 = Object.freeze({
  program_html: '8f943153b3a8489b2074fc16fbaaec55c8622d6aa7403e9913b668832675bad6',
  program_text: '61508bd1e00785b92456b51c694a3cdeb3e187e99cfa4d0ebf7b06e0706c088f',
  csci_html: '54b9e44c308f6205f5d05437c649e4f19ecf9d0d027c7379374e0d84ad844eed',
  csci_text: '28ea797fb6cdb750e5b5cb7547e5441b7918dbb352611280400b32c9ba92812f',
  math_html: '24fa149a313b93ef85e754286e9aa01ebd2e03a938a7e0b6315a5f620682928f',
  ge_html: '0fa9acb97573a446ebf90ed18e6a22fbba2c010d776f620e42847452030dfa37',
  ge_text: 'c4096bde6c76f6c56e6799d02ab0fd979e634c020efa91564ade90e0237ab579',
  robots_txt: '4eaac51773cf2538bbac642a1926ea98f51c25819252a0094007028fa72d069a',
});

const EXPECTED_TEXT_BYTES = Object.freeze({
  program: 7114,
  csci_catalog: 29613,
  degree_policy: 76512,
});

const EXCLUDED_CSCI_CODES = Object.freeze(['CSCI320', 'CSCI430', 'CSCI498']);
const PERMITTED_MATH_CODES = Object.freeze(['MATH413', 'MATH414']);
const RETAINED_MATH_CAPTURE_TARGETS = Object.freeze([
  'MATH109', 'MATH111', 'MATH112', 'MATH131', 'MATH132', 'MATH214',
]);
const REQUIRED_UPPER_CSCI_CORE = Object.freeze([
  'CSCI301', 'CSCI303', 'CSCI304', 'CSCI312', 'CSCI423',
]);
const WM_PROGRAM_RESIDENCY_SENTENCE =
  'At least half of the required minimum number of courses for the CS major must be taken at W&M and for all classes at the 300 and 400 level taken elsewhere, a total of at most two courses can count towards the CS major.';
const WM_TRANSFER_GRADE_RULE =
  'A grade of “C” (2.0) or higher is required (“C-” is not acceptable). In the case of a course taken on a Pass/Fail basis, a grade of “P” is acceptable only when the student provides a letter from the faculty member who taught the course certifying that the student’s work was at the level of C or above.';
const WM_DEGREE_RESIDENCY_RULE =
  'No degree will be granted by the university until the applicant has completed a minimum of 60 credit hours in residence at William & Mary. A minimum of 15 credit hours in the major and 9 credit hours in the minor must be taken in residence at William & Mary.';

const PRIOR_ENROLLMENT_LANGUAGE_ROUTES = Object.freeze([
  'completion of Level IV in high school of an ancient or modern foreign language;',
  'graduation from a high school where the main language of instruction was not English (official High School transcript must be in language of instruction; English translation must be provided);',
  'transfer credit for a language course taught in the target language at a level equivalent to or above the 202/203 level at William & Mary;',
  'transfer credit obtained via internationally accredited exams such as Advanced Placement, International Baccalaureate, A-levels, etc., in some specific languages (for those languages, please check the section on “Credit for Pre-Matriculation Examinations” ;',
]);

const AFTER_ENROLLMENT_LANGUAGE_ROUTES = Object.freeze([
  'completion of a language course at William & Mary, taught in the target language, at a level equivalent to or above the 202/203 level;',
  'obtaining a score of “intermediate” or higher on both the Oral and Writing Proficiency ACTFL standardized tests for a language other than English (not administered by William & Mary).',
  'through study abroad, only if: prior approval for the course has been obtained from the Department of Modern Languages & Literatures, and the course is taken in a country where the language is the official language.',
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const normalizeText = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const exactArray = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function catalogIdentityIssues($, { title, heading }) {
  const issues = [];
  if (normalizeText($('title').text()) !== title) issues.push('document_title');
  const headings = $('h1').map((index, element) => normalizeText($(element).text())).get();
  if (!exactArray(headings, [heading])) issues.push('unique_page_heading');
  const siteLabel = $('.site-title > span')
    .map((index, element) => normalizeText($(element).text())).get();
  const edition = $('.site-title > a')
    .map((index, element) => ({
      text: normalizeText($(element).text()),
      href: $(element).attr('href') || null,
    })).get();
  if (!exactArray(siteLabel, ['Academic Catalog'])
      || !exactArray(edition, [{ text: `${CATALOG_YEAR} Edition`, href: '/' }])) {
    issues.push('catalog_edition_identity');
  }
  return issues;
}

function parsePublishedCredits(value) {
  const text = normalizeText(value);
  const match = /^\((\d+)(?:([,-])(\d+))? Credits?\)$/.exec(text);
  if (!match) return null;
  const minimum = Number(match[1]);
  const maximum = Number(match[3] || match[1]);
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
      || minimum < 0 || maximum < minimum) return null;
  const publishedValues = match[2] === ',' ? [minimum, maximum] : null;
  return {
    kind: minimum === maximum
      ? 'published_fixed_credits'
      : publishedValues
        ? 'published_discrete_credits'
        : 'published_variable_credits',
    notation: match[2] ? `${minimum}${match[2]}${maximum}` : String(minimum),
    credit_hours_min: minimum,
    credit_hours_max: maximum,
    ...(publishedValues ? { published_values: publishedValues } : {}),
  };
}

function verifyPrimarySourceIntegrity({
  programText, csciText, geText, integrityManifest,
}) {
  const issues = [];
  if (integrityManifest?.schema_version !== 1
      || integrityManifest?.artifact !== 'virginia_primary_outcome_source_integrity_manifest'
      || integrityManifest?.hash_semantics
        !== 'Source sha256 values cover the normalized UTF-8 text bytes used by the collector, not the raw HTML or PDF transport bytes.') {
    issues.push('manifest_identity');
  }
  const rows = Array.isArray(integrityManifest?.exact_local_byte_matches)
    ? integrityManifest.exact_local_byte_matches : [];
  const specifications = [
    {
      key: 'program', sourceId: 'major', url: PROGRAM_URL,
      path: 'server/.va-catalogs/pages/william-mary__program.txt',
      text: String(programText || ''), sha: EXPECTED_SHA256.program_text,
      bytes: EXPECTED_TEXT_BYTES.program,
    },
    {
      key: 'csci_catalog', sourceId: 'course_catalog', url: CSCI_URL,
      path: 'server/.va-catalogs/pages/william-mary__course_catalog.txt',
      text: String(csciText || ''), sha: EXPECTED_SHA256.csci_text,
      bytes: EXPECTED_TEXT_BYTES.csci_catalog,
    },
    {
      key: 'degree_policy', sourceId: 'general_education', url: GE_URL,
      path: 'server/.va-catalogs/pages/william-mary__ge.txt',
      text: String(geText || ''), sha: EXPECTED_SHA256.ge_text,
      bytes: EXPECTED_TEXT_BYTES.degree_policy,
    },
  ];
  const sources = {};
  for (const specification of specifications) {
    const actualSha = sha256(specification.text);
    const actualBytes = Buffer.byteLength(specification.text);
    const matches = rows.filter((row) => (
      row?.institution === 'william-mary' && row?.source_id === specification.sourceId
    ));
    const row = matches[0];
    if (actualSha !== specification.sha || actualBytes !== specification.bytes) {
      issues.push(`${specification.key}_retained_text_bytes`);
    }
    if (matches.length !== 1
        || row?.classification !== 'exact_local_byte_match'
        || row?.official_url !== specification.url
        || row?.declared_sha256 !== specification.sha
        || row?.retained_text_path !== specification.path
        || row?.retained_text_bytes !== specification.bytes
        || row?.byte_reproducible !== true
        || row?.provenance_status !== 'exact_retained_normalized_text_bytes'
        || row?.capture_metadata?.requested_url !== specification.url
        || row?.capture_metadata?.final_url !== specification.url
        || row?.capture_metadata?.status !== 200
        || row?.capture_metadata?.transport !== 'http') {
      issues.push(`${specification.key}_manifest_row`);
    }
    sources[specification.key] = {
      official_url: specification.url,
      normalized_text_sha256: actualSha,
      normalized_text_bytes: actualBytes,
      manifest_classification: row?.classification || null,
      captured_at: row?.capture_metadata?.captured_at || null,
    };
  }
  return {
    verified: issues.length === 0,
    issues,
    manifest_artifact: integrityManifest?.artifact || null,
    manifest_audited_at: integrityManifest?.audited_at || null,
    sources,
  };
}

function extractSubjectCourseBlocks(html, {
  subject, title, heading, expectedResponseSha256,
}) {
  const source = String(html || '');
  const $ = cheerio.load(source);
  const issues = catalogIdentityIssues($, { title, heading });
  if (sha256(source) !== expectedResponseSha256) issues.push('source_response_hash');
  const rows = [];
  const seen = new Set();
  $('.courseblock').each((courseblockIndex, element) => {
    const block = $(element);
    const codeNodes = block.find('.detail-code');
    const titleNodes = block.find('.detail-title');
    const hoursNodes = block.find('.detail-hours_html');
    const attributeCode = normalizeCode(block.attr('data-coursecode'));
    const visibleCode = normalizeCode(codeNodes.text());
    const courseTitle = normalizeText(titleNodes.text());
    const publishedCredits = parsePublishedCredits(hoursNodes.text());
    if (codeNodes.length !== 1 || titleNodes.length !== 1 || hoursNodes.length !== 1
        || attributeCode !== visibleCode || !attributeCode.startsWith(subject)
        || !courseTitle || !publishedCredits || seen.has(attributeCode)) {
      issues.push(`courseblock_${courseblockIndex}`);
      return;
    }
    seen.add(attributeCode);
    const rawEntryHtml = block.toString();
    const rawEntryText = normalizeText(block.text());
    rows.push({
      course_code: attributeCode,
      title: courseTitle,
      published_credits: publishedCredits,
      source_courseblock_index: courseblockIndex,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(rawEntryHtml),
    });
  });
  if (!rows.length) issues.push('courseblocks_absent');
  return {
    verified: issues.length === 0,
    issues,
    source_response_sha256: sha256(source),
    structural_courseblock_count: rows.length,
    entries: rows,
  };
}

function extractGeneralConcentrationRule(programHtml) {
  const source = String(programHtml || '');
  const $ = cheerio.load(source);
  const issues = catalogIdentityIssues($, {
    title: 'Computer Science (BS in Computer Science) | William & Mary Academic Catalog',
    heading: 'Computer Science (BS in Computer Science)',
  });
  if (sha256(source) !== EXPECTED_SHA256.program_html) issues.push('source_response_hash');
  const headings = $('h2').filter((index, element) => normalizeText($(element).text()) === 'General');
  if (headings.length !== 1) issues.push('unique_general_heading');
  const heading = headings.first();
  const nextHeading = heading.nextAll('h2').first();
  if (normalizeText(nextHeading.text()) !== 'Cybersecurity') issues.push('general_section_end');
  const sectionNodes = heading.nextUntil('h2');
  const tables = sectionNodes.filter('table.sc_courselist');
  const footnotes = sectionNodes.filter('dl.sc_footnotes');
  if (tables.length !== 1 || footnotes.length !== 1) issues.push('general_table_or_footnote');
  const table = tables.first();
  const ruleRows = table.find('tbody > tr').filter((index, element) => (
    normalizeText($(element).find('.courselistcomment').text())
      === '12 credits chosen from any 300-400 level computer science courses.'
  ));
  if (ruleRows.length !== 1 || normalizeText(ruleRows.find('.hourscol').text()) !== '12') {
    issues.push('twelve_credit_rule');
  }
  const mathRows = table.find('tbody > tr').filter((index, element) => (
    $(element).find('a.code').length > 0
  ));
  const mathCodes = mathRows.find('a.code')
    .map((index, element) => normalizeCode($(element).text())).get();
  if (!exactArray(mathCodes, PERMITTED_MATH_CODES)
      || !mathRows.eq(1).hasClass('orclass')
      || !/^or\s+MATH 414\b/.test(normalizeText(mathRows.eq(1).text()))) {
    issues.push('permitted_math_alternatives');
  }
  const totalRows = table.find('tbody > tr.listsum');
  if (totalRows.length !== 1 || normalizeText(totalRows.find('.hourscol').text()) !== '12') {
    issues.push('general_total_hours');
  }
  const exclusionCodes = footnotes.find('a.code')
    .map((index, element) => normalizeCode($(element).text())).get();
  const footnoteText = normalizeText(footnotes.text());
  if (!exactArray(exclusionCodes, EXCLUDED_CSCI_CODES)
      || !/^1 excluding CSCI 320 Directed Study, CSCI 430 Computer Languages and CSCI 498 Internship\.$/.test(footnoteText)) {
    issues.push('exact_exclusion_footnote');
  }

  const coreTable = $('table.sc_courselist').first();
  const upperCore = coreTable.find('tbody > tr a.code')
    .map((index, element) => normalizeCode($(element).text())).get()
    .filter((code) => /^CSCI[34]\d{2}[A-Z]?$/.test(code));
  if (!exactArray(upperCore, REQUIRED_UPPER_CSCI_CORE)) issues.push('required_upper_core_roster');

  const relevantHtml = [heading.toString(), ...sectionNodes.map((index, element) => (
    $.html(element)
  )).get()].join('');
  return {
    verified: issues.length === 0,
    issues,
    source_response_sha256: sha256(source),
    relevant_section_sha256: sha256(relevantHtml),
    exact_rule_text: normalizeText(ruleRows.find('.courselistcomment').text()),
    required_credits: 12,
    eligible_subject_and_level: 'CSCI 300-499',
    permitted_math_codes: mathCodes,
    excluded_csci_codes: exclusionCodes,
    required_upper_csci_core_codes: upperCore,
    exclusion_footnote_text: footnoteText,
  };
}

function verifyRetainedMathCapture(mathHtml, metadata, robotsText) {
  const source = String(mathHtml || '');
  const robots = String(robotsText || '');
  const issues = [];
  if (metadata?.requested_url !== MATH_URL || metadata?.final_url !== MATH_URL
      || metadata?.capture_status !== 'official_html_captured'
      || metadata?.http_status !== 200
      || !String(metadata?.content_type || '').toLowerCase().includes('text/html')
      || metadata?.content_sha256 !== EXPECTED_SHA256.math_html
      || metadata?.content_sha256 !== sha256(source)) {
    issues.push('math_capture_metadata');
  }
  if (!exactArray(metadata?.target_course_codes, RETAINED_MATH_CAPTURE_TARGETS)) {
    issues.push('math_original_capture_target_scope');
  }
  if (metadata?.robots?.url !== ROBOTS_URL || metadata?.robots?.http_status !== 200
      || metadata?.robots?.crawl_delay_seconds !== 0
      || metadata?.robots?.content_sha256 !== EXPECTED_SHA256.robots_txt
      || sha256(robots) !== EXPECTED_SHA256.robots_txt) {
    issues.push('robots_evidence');
  }
  const extracted = extractSubjectCourseBlocks(source, {
    subject: 'MATH',
    title: 'Mathematics (MATH) | William & Mary Academic Catalog',
    heading: 'Mathematics (MATH)',
    expectedResponseSha256: EXPECTED_SHA256.math_html,
  });
  issues.push(...extracted.issues.map((issue) => `math_${issue}`));
  const byCode = new Map(extracted.entries.map((row) => [row.course_code, row]));
  const entries = PERMITTED_MATH_CODES.map((code) => byCode.get(code)).filter(Boolean);
  if (entries.length !== PERMITTED_MATH_CODES.length
      || entries.some((row) => row.published_credits.kind !== 'published_fixed_credits'
        || row.published_credits.credit_hours_min !== 3)) {
    issues.push('math_413_414_exact_entries');
  }
  return {
    verified: issues.length === 0,
    issues,
    acquisition_status: 'reused_existing_robots_verified_official_courseleaf_subject_capture',
    route: {
      official_url: MATH_URL,
      capture_scope: 'complete_official_math_subject_response',
      response_sha256: sha256(source),
      response_bytes: Buffer.byteLength(source),
      captured_at: metadata?.fetched_at || null,
      robots_url: ROBOTS_URL,
      robots_response_sha256: sha256(robots),
      robots_http_status: metadata?.robots?.http_status ?? null,
      robots_crawl_delay_seconds: metadata?.robots?.crawl_delay_seconds ?? null,
      original_acquisition_target_course_codes: metadata?.target_course_codes || null,
      original_target_list_included_math_413_414: false,
      retained_entry_proof: 'MATH 413 and MATH 414 already occur as unique structural course blocks in the complete retained response; no network refetch is needed',
    },
    structural_courseblock_count: extracted.structural_courseblock_count,
    entries,
  };
}

function extractForeignLanguageRoutes(geHtml) {
  const source = String(geHtml || '');
  const $ = cheerio.load(source);
  const issues = catalogIdentityIssues($, {
    title: 'Requirements for Degrees | William & Mary Academic Catalog',
    heading: 'Requirements for Degrees',
  });
  if (sha256(source) !== EXPECTED_SHA256.ge_html) issues.push('source_response_hash');
  const headings = $('h4').filter((index, element) => (
    normalizeText($(element).text()) === 'Foreign Language Proficiency'
  ));
  if (headings.length !== 1) issues.push('unique_foreign_language_heading');
  const heading = headings.first();
  const afterHeading = heading.nextAll('h4').first();
  const writingHeading = afterHeading.nextAll('h4').first();
  if (normalizeText(afterHeading.text()) !== 'After enrolling at William & Mary:'
      || normalizeText(writingHeading.text()) !== 'Writing Proficiency') {
    issues.push('foreign_language_section_boundaries');
  }
  const priorLists = heading.nextUntil(afterHeading).filter('ol');
  const afterLists = afterHeading.nextUntil(writingHeading).filter('ol');
  const prior = priorLists.first().children('li')
    .map((index, element) => normalizeText($(element).text())).get();
  const after = afterLists.first().children('li')
    .map((index, element) => normalizeText($(element).text())).get();
  if (priorLists.length !== 1 || afterLists.length !== 2
      || !exactArray(prior, PRIOR_ENROLLMENT_LANGUAGE_ROUTES)
      || !exactArray(after, AFTER_ENROLLMENT_LANGUAGE_ROUTES)) {
    issues.push('exact_completion_route_lists');
  }
  const sectionNodes = heading.add(heading.nextUntil(writingHeading));
  const sectionText = normalizeText(sectionNodes.text());
  if (!/Placement exams can be completed before the student’s first full-time semester/.test(sectionText)
      || !/Choose appropriate W&M course enrollment by consulting the website for placement/.test(sectionText)
      || !/the committee may allow the substitution of other appropriate courses/.test(sectionText)) {
    issues.push('placement_or_exception_evidence');
  }
  const relevantHtml = sectionNodes.map((index, element) => $.html(element)).get().join('');
  return {
    verified: issues.length === 0,
    issues,
    source_response_sha256: sha256(source),
    relevant_section_sha256: sha256(relevantHtml),
    proficiency_level: '202/203 level or above',
    routes: [
      {
        option: 1,
        timing: 'prior_to_enrollment',
        raw: prior[0] || null,
        college_course_increment: 0,
        college_credit_increment: 0,
        evidence_class: 'exact_zero_increment_high_school_proficiency',
      },
      {
        option: 2,
        timing: 'prior_to_enrollment',
        raw: prior[1] || null,
        college_course_increment: 0,
        college_credit_increment: 0,
        evidence_class: 'exact_zero_increment_high_school_language_of_instruction',
      },
      {
        option: 3,
        timing: 'prior_to_enrollment',
        raw: prior[2] || null,
        college_course_increment: { min: 1, max: null },
        college_credit_increment: { min: null, max: null },
        evidence_class: 'qualifying_transfer_course_identity_and_credits_open',
      },
      {
        option: 4,
        timing: 'prior_to_enrollment',
        raw: prior[3] || null,
        college_course_increment: { min: null, max: null },
        college_credit_increment: { min: null, max: null },
        evidence_class: 'exam_transfer_credit_equivalency_and_credits_open',
      },
      {
        option: 5,
        timing: 'after_enrollment',
        raw: after[0] || null,
        college_course_increment: { min: 1, max: null },
        college_credit_increment: { min: null, max: null },
        evidence_class: 'william_mary_course_and_possible_placement_sequence_open',
        reason: 'the required 202/203-or-above course and any prerequisite sequence depend on language and placement',
      },
      {
        option: 6,
        timing: 'after_enrollment',
        raw: after[1] || null,
        college_course_increment: 0,
        college_credit_increment: 0,
        evidence_class: 'exact_zero_increment_external_proficiency_tests',
      },
      {
        option: 7,
        timing: 'after_enrollment',
        raw: after[2] || null,
        college_course_increment: { min: 1, max: null },
        college_credit_increment: { min: null, max: null },
        evidence_class: 'approved_study_abroad_course_identity_and_credits_open',
        reason: 'the approved study-abroad course identity and credits are not fixed by this catalog rule',
      },
    ],
    placement_evidence: {
      placement_selects_enrollment_not_completion: true,
      zero_increment_inference_from_placement_forbidden: true,
    },
    exception_evidence: {
      committee_may_substitute_other_courses: true,
      substituted_course_identity_and_credits_open: true,
    },
  };
}

/**
 * Retain the grade threshold and every CS-major residency dimension as exact
 * source evidence.  This parser is intentionally sentence-exact and edition-
 * pinned: it creates a review receipt, not a loose runtime prose heuristic.
 */
function extractTransferAndResidencyPolicy(programHtml, geHtml) {
  const programSource = String(programHtml || '');
  const geSource = String(geHtml || '');
  const program = cheerio.load(programSource);
  const ge = cheerio.load(geSource);
  const issues = [
    ...catalogIdentityIssues(program, {
      title: 'Computer Science (BS in Computer Science) | William & Mary Academic Catalog',
      heading: 'Computer Science (BS in Computer Science)',
    }).map((issue) => `program_${issue}`),
    ...catalogIdentityIssues(ge, {
      title: 'Requirements for Degrees | William & Mary Academic Catalog',
      heading: 'Requirements for Degrees',
    }).map((issue) => `degree_policy_${issue}`),
  ];
  if (sha256(programSource) !== EXPECTED_SHA256.program_html) {
    issues.push('program_source_response_hash');
  }
  if (sha256(geSource) !== EXPECTED_SHA256.ge_html) {
    issues.push('degree_policy_source_response_hash');
  }

  const programParagraphs = program('p').filter((index, element) => (
    normalizeText(program(element).text()).endsWith(WM_PROGRAM_RESIDENCY_SENTENCE)
  ));
  const transferGradeRows = ge('li').filter((index, element) => (
    normalizeText(ge(element).text()) === WM_TRANSFER_GRADE_RULE
  ));
  const degreeResidencyParagraphs = ge('p').filter((index, element) => (
    normalizeText(ge(element).text()) === WM_DEGREE_RESIDENCY_RULE
  ));
  if (programParagraphs.length !== 1) issues.push('unique_program_residency_rule');
  if (transferGradeRows.length !== 1) issues.push('unique_transfer_grade_rule');
  if (degreeResidencyParagraphs.length !== 1) issues.push('unique_degree_residency_rule');

  const relevantProgramHtml = programParagraphs.length === 1
    ? program.html(programParagraphs[0]) : '';
  const relevantDegreePolicyHtml = transferGradeRows.length === 1
      && degreeResidencyParagraphs.length === 1
    ? `${ge.html(transferGradeRows[0])}${ge.html(degreeResidencyParagraphs[0])}` : '';
  return {
    verified: issues.length === 0,
    issues,
    source_receipts: {
      program_response_sha256: sha256(programSource),
      program_relevant_html_sha256: sha256(relevantProgramHtml),
      degree_policy_response_sha256: sha256(geSource),
      degree_policy_relevant_html_sha256: sha256(relevantDegreePolicyHtml),
    },
    transfer_grade_threshold: {
      exact_rule_text: transferGradeRows.length === 1
        ? normalizeText(ge(transferGradeRows[0]).text()) : null,
      minimum_letter_grade: 'C',
      minimum_grade_points: 2,
      c_minus_acceptable: false,
      pass_fail_requires_instructor_certification_at_or_above_threshold: true,
      paper_method: {
        figures: ['3', '4'],
        conditioned_input: 'hypothetical_grade_eligible_successful_pathway',
        pure_grade_threshold_changes_course_identity: false,
        pure_grade_threshold_changes_applied_units: false,
        separately_blocks_paper_figures: false,
      },
    },
    computer_science_residency: {
      exact_program_rule_text: programParagraphs.length === 1
        ? WM_PROGRAM_RESIDENCY_SENTENCE : null,
      exact_degree_rule_text: degreeResidencyParagraphs.length === 1
        ? normalizeText(ge(degreeResidencyParagraphs[0]).text()) : null,
      overall_resident_credits_minimum: 60,
      major_resident_credits_minimum: 15,
      resident_fraction_of_minimum_major_course_count: 0.5,
      external_300_400_major_courses_maximum: 2,
    },
  };
}

function exactExample(roster, assignments, { requiredTogether = {} } = {}) {
  const byCode = new Map(roster.map((row) => [row.course_code, row]));
  const selected = new Set(assignments.map((row) => row.course_code));
  let credits = 0;
  for (const assignment of assignments) {
    const entry = byCode.get(assignment.course_code);
    const minimum = entry?.published_credits?.credit_hours_min;
    const maximum = entry?.published_credits?.credit_hours_max;
    if (!entry || assignment.credits < minimum || assignment.credits > maximum) return null;
    credits += assignment.credits;
  }
  if (new Set(assignments.map((row) => row.course_code)).size !== assignments.length
      || credits !== 12) return null;
  for (const [courseCode, requiredCodes] of Object.entries(requiredTogether)) {
    if (selected.has(courseCode) && requiredCodes.some((code) => !selected.has(code))) return null;
  }
  return { course_count: assignments.length, credits, assignments };
}

function buildWilliamMaryCurrentCatalogFigureEvidence({
  programHtml, programText, csciHtml, csciText, mathHtml, mathMetadata,
  robotsText, geHtml, geText, integrityManifest,
}) {
  const retainedSources = verifyPrimarySourceIntegrity({
    programText, csciText, geText, integrityManifest,
  });
  const program = extractGeneralConcentrationRule(programHtml);
  const csci = extractSubjectCourseBlocks(csciHtml, {
    subject: 'CSCI',
    title: 'Computer Science (CSCI) | William & Mary Academic Catalog',
    heading: 'Computer Science (CSCI)',
    expectedResponseSha256: EXPECTED_SHA256.csci_html,
  });
  const math = verifyRetainedMathCapture(mathHtml, mathMetadata, robotsText);
  const language = extractForeignLanguageRoutes(geHtml);
  const transferAndResidency = extractTransferAndResidencyPolicy(programHtml, geHtml);
  const issues = [
    ...retainedSources.issues.map((issue) => `retained_sources:${issue}`),
    ...program.issues.map((issue) => `program:${issue}`),
    ...csci.issues.map((issue) => `csci:${issue}`),
    ...math.issues.map((issue) => `math:${issue}`),
    ...language.issues.map((issue) => `language:${issue}`),
    ...transferAndResidency.issues.map((issue) => `transfer_and_residency:${issue}`),
  ];
  const upperCsci = csci.entries.filter((row) => /^CSCI[34]\d{2}[A-Z]?$/.test(row.course_code));
  const excluded = upperCsci.filter((row) => EXCLUDED_CSCI_CODES.includes(row.course_code));
  const eligibleCsci = upperCsci.filter((row) => !EXCLUDED_CSCI_CODES.includes(row.course_code));
  const roster = [...eligibleCsci, ...math.entries]
    .map((row) => ({
      ...row,
      rule_membership: PERMITTED_MATH_CODES.includes(row.course_code)
        ? 'permitted_math_choose_at_most_one'
        : REQUIRED_UPPER_CSCI_CORE.includes(row.course_code)
          ? 'textually_in_level_pool_but_already_required_in_core'
          : row.published_credits.credit_hours_max === 0
            ? 'textually_in_level_pool_zero_credit'
            : 'general_concentration_candidate',
    }))
    .sort((left, right) => left.course_code.localeCompare(right.course_code));
  if (upperCsci.length !== 47 || excluded.length !== 3 || eligibleCsci.length !== 44
      || roster.length !== 46) issues.push('roster:cardinality');
  const unitShape = {
    fixed_zero_credit: roster.filter((row) => (
      row.published_credits.credit_hours_min === 0
      && row.published_credits.credit_hours_max === 0
    )).map((row) => row.course_code),
    fixed_one_credit: roster.filter((row) => (
      row.published_credits.credit_hours_min === 1
      && row.published_credits.credit_hours_max === 1
    )).map((row) => row.course_code),
    variable_one_to_three_credits: roster.filter((row) => (
      row.published_credits.credit_hours_min === 1
      && row.published_credits.credit_hours_max === 3
    )).map((row) => row.course_code),
    fixed_three_credits: roster.filter((row) => (
      row.published_credits.credit_hours_min === 3
      && row.published_credits.credit_hours_max === 3
    )).map((row) => row.course_code),
  };
  if (!exactArray(unitShape.fixed_zero_credit, ['CSCI423W', 'CSCI440W', 'CSCI495W', 'CSCI496W'])
      || !exactArray(unitShape.fixed_one_credit, ['CSCI437X'])
      || !exactArray(unitShape.variable_one_to_three_credits, ['CSCI420', 'CSCI490'])
      || unitShape.fixed_three_credits.length !== 39) {
    issues.push('roster:published_credit_shapes');
  }
  const csci437x = roster.find((row) => row.course_code === 'CSCI437X');
  if (!csci437x || !/This course is to be taken in together with CSCI-437 Introduction to Game Design and Game Development\..*Corequisite\(s\): CSCI 437$/.test(
    csci437x.raw_entry_text,
  )) {
    issues.push('roster:csci437x_corequisite');
  }
  const requiredTogether = { CSCI437X: ['CSCI437'] };
  const examples = [
    exactExample(roster, [
      { course_code: 'CSCI315', credits: 3 },
      { course_code: 'CSCI321', credits: 3 },
      { course_code: 'CSCI324', credits: 3 },
      { course_code: 'CSCI356', credits: 3 },
    ]),
    exactExample(roster, [
      { course_code: 'CSCI315', credits: 3 },
      { course_code: 'CSCI321', credits: 3 },
      { course_code: 'CSCI324', credits: 3 },
      { course_code: 'CSCI420', credits: 1 },
      { course_code: 'CSCI490', credits: 2 },
    ], { requiredTogether }),
    exactExample(roster, [
      { course_code: 'CSCI315', credits: 3 },
      { course_code: 'CSCI321', credits: 3 },
      { course_code: 'CSCI420', credits: 1 },
      { course_code: 'CSCI437', credits: 3 },
      { course_code: 'CSCI437X', credits: 1 },
      { course_code: 'CSCI490', credits: 1 },
    ], { requiredTogether }),
  ];
  if (examples.some((row) => !row)
      || !exactArray(examples.map((row) => row.course_count), [4, 5, 6])
      || examples.some((example) => example.assignments.some((assignment) => (
        REQUIRED_UPPER_CSCI_CORE.includes(assignment.course_code)
      )))) {
    issues.push('roster:cardinality_examples');
  }
  if (issues.length) throw new Error(`William & Mary evidence failed closed: ${issues.join(', ')}`);

  return {
    schema_version: 1,
    artifact: ARTIFACT,
    catalog_year: CATALOG_YEAR,
    institution: { slug: 'william-mary', school_id: 9233 },
    publication_ready: false,
    source_contract: {
      edition_boundary: {
        edition: `${CATALOG_YEAR} Edition`,
        relationship: 'program, CSCI, degree-policy, and MATH pages each print the same catalog edition; their independent capture timestamps are retained and no same-request timestamp is claimed',
      },
      retained_primary_source_integrity: retainedSources,
      program: {
        ...retainedSources.sources.program,
        response_sha256: program.source_response_sha256,
      },
      csci_catalog: {
        ...retainedSources.sources.csci_catalog,
        response_sha256: csci.source_response_sha256,
      },
      math_catalog: math.route,
      degree_policy: {
        ...retainedSources.sources.degree_policy,
        response_sha256: language.source_response_sha256,
      },
    },
    general_concentration: {
      source_rule: program,
      roster_contract: {
        structural_upper_level_csci_entries: upperCsci.length,
        excluded_csci_entries: excluded,
        eligible_csci_entries: eligibleCsci.length,
        permitted_math_entries: math.entries.length,
        eligible_entry_count: roster.length,
        witness_pool_avoiding_already_required_core_count: roster.filter((row) => (
          !REQUIRED_UPPER_CSCI_CORE.includes(row.course_code)
        )).length,
        credit_contributing_witness_pool_count: roster.filter((row) => (
          !REQUIRED_UPPER_CSCI_CORE.includes(row.course_code)
            && row.published_credits.credit_hours_max > 0
        )).length,
        selection_constraints: [
          {
            kind: 'choose_at_most_one',
            course_codes: PERMITTED_MATH_CODES,
            source: 'the General table stores MATH 414 as the or-row after MATH 413',
          },
          {
            kind: 'required_together',
            selected_course_code: 'CSCI437X',
            required_course_codes: ['CSCI437'],
            timing: 'corequisite',
            source_entry_sha256: csci437x?.raw_entry_sha256 || null,
          },
        ],
        unit_shape_counts: {
          fixed_zero_credit: unitShape.fixed_zero_credit.length,
          fixed_one_credit: unitShape.fixed_one_credit.length,
          variable_one_to_three_credits: unitShape.variable_one_to_three_credits.length,
          fixed_three_credits: unitShape.fixed_three_credits.length,
        },
        unit_shape_codes: unitShape,
        entries: roster,
      },
      paper_interpretation: {
        unique: false,
        exact_feasible_credit_contributing_course_counts: [4, 5, 6],
        cardinality_bound_proof: {
          lower_bound: 'every positive-credit eligible entry has a three-credit ceiling, so 12 credits require at least four credit-contributing courses',
          upper_bound: 'only CSCI 420, CSCI 437X, and CSCI 490 carry fewer than three positive credits; any seven positive-credit courses therefore total at least 1 + 1 + 1 + 3 + 3 + 3 + 3 = 15 credits',
          existence: 'the retained roster supplies exact source-valid witnesses at four, five, and six courses; the six-course witness includes CSCI 437 alongside its one-credit CSCI 437X corequisite',
        },
        witnesses: examples,
        figure_1: {
          ready: false,
          reason: 'the source fixes 12 credits but permits source-valid four-, five-, and six-course realizations because CSCI 420/490 carry 1-3 credits and the one-credit CSCI 437X may be selected together with its three-credit CSCI 437 corequisite',
        },
        figure_6: {
          ready: false,
          reason: 'the source fixes neither one course combination nor one prerequisite graph; selecting a convenient four-course route would be an analyst choice, not a catalog fact',
        },
        zero_credit_entries_do_not_reduce_the_twelve_credit_floor: true,
        required_upper_core_reuse_not_assumed: true,
      },
    },
    foreign_language_proficiency: {
      source_rule: language,
      paper_interpretation: {
        unique: false,
        zero_increment_route_exists: true,
        zero_increment_is_universal: false,
        exact_zero_increment_options: [1, 2, 6],
        open_course_or_credit_options: [3, 4, 5, 7],
        college_course_increment_min: 0,
        college_course_increment_max: null,
        college_credit_increment_min: 0,
        college_credit_increment_max: null,
        figure_3: {
          ready: true,
          method: 'optimistic_best_case_source_valid_zero_increment_route',
          selected_options: [1, 2, 6],
          assumption: 'the modeled successful transfer student satisfies foreign-language proficiency through one of the catalog-published zero-course routes',
          reason: 'Figure 3 is an optimistic best-case credit-utilization model, and the official catalog publishes three exact routes that add zero college courses and zero college credits',
        },
        figure_4: {
          ready: true,
          method: 'optimistic_best_case_source_valid_zero_increment_route',
          selected_options: [1, 2, 6],
          assumption: 'the modeled successful transfer student satisfies foreign-language proficiency through one of the catalog-published zero-course routes',
          reason: 'Figure 4 is the lower-bound consequence of the same optimistic transfer plan, so a published zero-increment route is the exact minimizing witness',
        },
        figure_6: {
          ready: false,
          reason: 'course identity, number of prerequisites, and even whether a course node exists are student-specific',
        },
      },
    },
    transfer_and_residency_policy: transferAndResidency,
    canonical_effect: {
      verified_requirement_or_composition_mutation_required: false,
      projection_mutation_required: false,
      runtime_gate_change_supported: true,
      residual_blockers: [
        'general_concentration_course_cardinality_and_selection_are_not_unique',
        'foreign_language_course_and_credit_increment_are_not_unique_for_figure_6',
      ],
    },
  };
}

module.exports = {
  AFTER_ENROLLMENT_LANGUAGE_ROUTES,
  ARTIFACT,
  CATALOG_YEAR,
  CSCI_URL,
  EXCLUDED_CSCI_CODES,
  EXPECTED_SHA256,
  EXPECTED_TEXT_BYTES,
  GE_URL,
  MATH_URL,
  PERMITTED_MATH_CODES,
  PRIOR_ENROLLMENT_LANGUAGE_ROUTES,
  PROGRAM_URL,
  RETAINED_MATH_CAPTURE_TARGETS,
  ROBOTS_URL,
  buildWilliamMaryCurrentCatalogFigureEvidence,
  catalogIdentityIssues,
  extractForeignLanguageRoutes,
  extractGeneralConcentrationRule,
  extractTransferAndResidencyPolicy,
  extractSubjectCourseBlocks,
  normalizeCode,
  normalizeText,
  parsePublishedCredits,
  sha256,
  verifyPrimarySourceIntegrity,
  verifyRetainedMathCapture,
  WM_DEGREE_RESIDENCY_RULE,
  WM_PROGRAM_RESIDENCY_SENTENCE,
  WM_TRANSFER_GRADE_RULE,
};
