/**
 * Source-bound supplemental evidence for the four still-open VMI rules.
 *
 * This module is deliberately not a figure evaluator. It proves two exact
 * catalog-valid witnesses (the 200-level mathematics elective and the two
 * Civilizations & Cultures overlays), and it records why the science and
 * residence rules still cannot be executed without analyst invention. It
 * never edits the reviewed degree tree or a canonical projection.
 */
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'vmi_2025_2026_open_rule_source_evidence';
const ARTIFACT_SEMANTIC_SHA256 =
  '5416c20adecc19de50380cb7ea9d4c636025cef6c7a85b233786eb9789cc4cd5';
const CATALOG_YEAR = '2025-2026';
const SLUG = 'virginia-military-institute';
const PDF_URL =
  'https://www.vmi.edu/wp-content/uploads/2026/06/2025-2026_VMICatalog-SizedforWeb.pdf';
const PROGRAM_URL =
  'https://catalog.vmi.edu/preview_program.php?catoid=39&poid=2815&print=1';
const COURSE_CATALOG_URL = 'https://catalog.vmi.edu/content.php?catoid=39&navoid=1548';
const GE_URL = 'https://www.vmi.edu/academics/academic-program/';
const GRADUATION_URL =
  'https://www.vmi.edu/academics/academic-support-services/registrar/registration-enrollment/transfer-activity-after-matriculation/';

const EXPECTED_SOURCE = Object.freeze({
  program: Object.freeze({
    source_id: 'major', url: PROGRAM_URL,
    html_sha256: '095efb6560ade865e6a4534bc52f14e56dd32235b0462d4e3b0b827038744351',
    html_bytes: 153754,
    text_sha256: '87c7981ed376b431a5116bdbed48d5213e3bf476ac7ec5da3f4e3a3571fe2609',
    text_bytes: 7441,
    text_path: 'server/.va-catalogs/pages/virginia-military-institute__program.txt',
  }),
  course_catalog: Object.freeze({
    source_id: 'course_catalog', url: COURSE_CATALOG_URL,
    html_sha256: '18460bba408b1b64e4de8fc8fa914ad2c73f78a983ba5abe50dc1a6dc11544a1',
    html_bytes: 85702,
    text_sha256: '88a32ceba30aabc76b6a6389de0a52c5d9fde78b1a5634ad6f3bed4b10a02439',
    text_bytes: 11495,
    text_path: 'server/.va-catalogs/pages/virginia-military-institute__course_catalog.txt',
  }),
  ge: Object.freeze({
    source_id: 'general_education', url: GE_URL,
    html_sha256: 'b68e801f1084a76f391e4ed72766f5f75e120a08a625d0e55a6c01e015f1ca1b',
    html_bytes: 230388,
    text_sha256: '189939a08a458e988916adbc5fe7ef3bd1f647b005cabe28cff2695c664c738d',
    text_bytes: 6020,
    text_path: 'server/.va-catalogs/pages/virginia-military-institute__ge.txt',
  }),
  graduation: Object.freeze({
    source_id: 'graduation', url: GRADUATION_URL,
    html_sha256: 'b2d6efd2119a75c3629fd2373aa7f94d7e6339736fe6c6d6c39a0b41a1de7add',
    html_bytes: 224639,
    text_sha256: 'ba0009fe257230d773537dc2578ebae35c71c4af5639222aa2208ecc23307d7e',
    text_bytes: 2110,
    text_path: 'server/.va-catalogs/pages/virginia-military-institute__graduation.txt',
  }),
});

const EXPECTED_PDF = Object.freeze({
  pdf_sha256: '244f93ee26e73f8639512bfa7b5e383af3d196ab5c02f4559d20628066390c32',
  pdf_bytes: 10270130,
  excerpt_sha256: 'a1e0d504f1beed7544e5cd10c75c7382fe60c26e02b524867a722d8fc8b611c9',
  excerpt_bytes: 11713,
  page_ranges: Object.freeze([[42, 42], [132, 134], [233, 233], [243, 243]]),
});

const EXPECTED_MATH_ROSTER = Object.freeze([
  'MA101', 'MA102', 'MA103', 'MA106', 'MA110', 'MA114', 'MA123', 'MA124',
  'MA126', 'MA215', 'MA220', 'MA301', 'MA305', 'MA310', 'MA311', 'MA319',
  'MA320', 'MA330WX', 'MA331X', 'MA339', 'MA340', 'MA341', 'MA342', 'MA343',
  'MA345', 'MA346', 'MA347', 'MA348', 'MA349', 'MA404', 'MA405', 'MA415',
  'MA419', 'MA426', 'MA432', 'MA451-459', 'MA471-479', 'MA490W', 'MA495',
]);

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const normalizeCode = (value) => String(value || '')
  .toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const semanticSha256 = (value) => sha256(JSON.stringify(stable(value)));
const exactArray = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function occurrenceCount(haystack, needle) {
  return String(haystack || '').split(needle).length - 1;
}

function exactTextIssues(text, expectations, prefix) {
  const body = normalize(text);
  return expectations.flatMap((expected) => (
    occurrenceCount(body, expected) === 1 ? [] : [`${prefix}:${expected}`]
  ));
}

function verifyRetainedSources({
  programHtml = '', programText = '', courseCatalogHtml = '', courseCatalogText = '',
  geHtml = '', geText = '', graduationHtml = '', graduationText = '', integrityManifest,
}) {
  const inputs = {
    program: { html: String(programHtml), text: String(programText) },
    course_catalog: { html: String(courseCatalogHtml), text: String(courseCatalogText) },
    ge: { html: String(geHtml), text: String(geText) },
    graduation: { html: String(graduationHtml), text: String(graduationText) },
  };
  const issues = [];
  const receipts = {};
  if (integrityManifest?.schema_version !== 1
      || integrityManifest?.artifact !== 'virginia_primary_outcome_source_integrity_manifest'
      || integrityManifest?.hash_semantics
        !== 'Source sha256 values cover the normalized UTF-8 text bytes used by the collector, not the raw HTML or PDF transport bytes.') {
    issues.push('manifest:identity');
  }
  const manifestRows = Array.isArray(integrityManifest?.exact_local_byte_matches)
    ? integrityManifest.exact_local_byte_matches : [];
  for (const [key, expected] of Object.entries(EXPECTED_SOURCE)) {
    const input = inputs[key];
    const htmlHash = sha256(input.html);
    const textHash = sha256(input.text);
    if (htmlHash !== expected.html_sha256 || Buffer.byteLength(input.html) !== expected.html_bytes) {
      issues.push(`${key}:html_bytes`);
    }
    if (textHash !== expected.text_sha256 || Buffer.byteLength(input.text) !== expected.text_bytes) {
      issues.push(`${key}:text_bytes`);
    }
    const matches = manifestRows.filter((row) => (
      row?.institution === SLUG && row?.source_id === expected.source_id
    ));
    const row = matches[0];
    if (matches.length !== 1
        || row?.classification !== 'exact_local_byte_match'
        || row?.official_url !== expected.url
        || row?.declared_sha256 !== expected.text_sha256
        || row?.retained_text_path !== expected.text_path
        || row?.retained_text_bytes !== expected.text_bytes
        || row?.byte_reproducible !== true
        || row?.provenance_status !== 'exact_retained_normalized_text_bytes'
        || row?.capture_metadata?.requested_url !== expected.url
        || row?.capture_metadata?.final_url !== expected.url
        || row?.capture_metadata?.status !== 200
        || row?.capture_metadata?.transport !== 'browser') {
      issues.push(`${key}:manifest_row`);
    }
    receipts[key] = {
      official_url: expected.url,
      normalized_text_sha256: textHash,
      normalized_text_bytes: Buffer.byteLength(input.text),
      retained_html_sha256: htmlHash,
      retained_html_bytes: Buffer.byteLength(input.html),
      manifest_classification: row?.classification || null,
      captured_at: row?.capture_metadata?.captured_at || null,
    };
  }
  return { verified: issues.length === 0, issues, receipts };
}

function parseProgramAndGeneralEducation({ programText = '', geText = '' }) {
  const programExpectations = [
    'The Bachelor of Science degree in Computer Science – Theory and Application Track requires 136 semester hours.',
    'VMI Core Curriculum: 34 Credits',
    'Science Requirement I - (BI, CH, or PY w/ lab) Credit Hours: 4',
    'Science Requirement II - (BI, CH, or PY w/ lab) Credit Hours: 4',
    'Required Computer Science Core Courses: 30 Credits',
    'Required Theory and Application Track Courses: 18 credits',
    'Computer and Information Sciences Electives*: 6 credits',
    'Computer and Information Sciences Upper-Level Electives*: 3 credits',
    'Required Additional Mathematics Courses: 9 Credits',
    'ELEC MA - Mathematics Elective Credit Hours: 3 **',
    'ROTC: 12 credits',
    'Free Electives: 24 credits',
    '** MA Elective must be 200 level or higher',
  ];
  const geExpectations = [
    'Scientific Analysis – 8 Hours An approved sequence in biology, chemistry, or physics is required, but differs by major.',
    'Civilizations And Cultures 2 courses, one of which may be replaced by a credit-bearing, Institute-approved study abroad experience.',
  ];
  const issues = [
    ...exactTextIssues(programText, programExpectations, 'program'),
    ...exactTextIssues(geText, geExpectations, 'ge'),
  ];
  const categories = {
    core: 34, computer_science_core: 30, theory_application_track: 18,
    cis_electives: 6, cis_upper_level_elective: 3, additional_mathematics: 9,
    rotc: 12, free_electives: 24,
  };
  if (Object.values(categories).reduce((sum, value) => sum + value, 0) !== 136) {
    issues.push('program:category_arithmetic');
  }
  return {
    verified: issues.length === 0,
    issues,
    degree_total_credits: 136,
    exact_category_credits: categories,
    category_credit_sum: 136,
    science_rule: {
      total_credits: 8, course_count: 2, each_course_credits: 4,
      eligible_subjects: ['BI', 'CH', 'PY'], laboratory_required: true,
      source_says_approved_sequence: true, source_says_sequence_differs_by_major: true,
    },
    mathematics_elective: { credits: 3, minimum_course_number: 200 },
    civilizations_and_cultures: {
      course_count: 2, study_abroad_replacement_maximum: 1,
      study_abroad_must_be_credit_bearing: true,
      study_abroad_must_be_institute_approved: true,
    },
  };
}

function splitBoundedPdf(text) {
  const source = String(text || '');
  const pattern = /^--- PDF PAGES (\d+)-(\d+) ---$/gm;
  const matches = [...source.matchAll(pattern)];
  const pages = matches.map((match, index) => ({
    first_page: Number(match[1]),
    last_page: Number(match[2]),
    text: source.slice(match.index + match[0].length, matches[index + 1]?.index ?? source.length),
  }));
  return pages;
}

function normalizePdf(value) {
  return String(value || '')
    .replace(/([A-Za-z])-[\r\n]+([a-z])/g, '$1$2')
    .replace(/\f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function exactBlock(text, start, end, issue, issues) {
  if (occurrenceCount(text, start) !== 1 || occurrenceCount(text, end) !== 1
      || text.indexOf(start) >= text.indexOf(end)) {
    issues.push(issue);
    return '';
  }
  return text.slice(text.indexOf(start), text.indexOf(end)).trim();
}

function verifyPdfCapture(captureMetadata, boundedPageText = '') {
  const metadata = captureMetadata || {};
  const issues = [];
  if (metadata.schema_version !== 1
      || metadata.robots_url !== 'https://www.vmi.edu/robots.txt'
      || metadata.robots_sha256 !== '2b9c5c3e93c371d87ce6f3f695f72362326a0896b6fc4f87fe1e0221cf200f11'
      || metadata.robots_status !== 200
      || metadata.registrar_url
        !== 'https://www.vmi.edu/academics/academic-support-services/registrar/'
      || metadata.registrar_final_url !== metadata.registrar_url
      || metadata.registrar_sha256
        !== '64f82bc4b52a4b840995f09449f07438804b367b58f51c59d793cc4ba35fe152'
      || metadata.registrar_bytes !== 187719
      || metadata.registrar_status !== 200
      || metadata.pdf_url !== PDF_URL || metadata.pdf_final_url !== PDF_URL
      || metadata.pdf_sha256 !== EXPECTED_PDF.pdf_sha256
      || metadata.pdf_bytes !== EXPECTED_PDF.pdf_bytes
      || metadata.pdf_status !== 200 || metadata.pdf_content_type !== 'application/pdf'
      || !exactArray(metadata.page_ranges, EXPECTED_PDF.page_ranges)
      || metadata.extractor !== 'pdftotext version 26.04.0'
      || metadata.bounded_page_text_sha256 !== EXPECTED_PDF.excerpt_sha256
      || metadata.bounded_page_text_bytes !== EXPECTED_PDF.excerpt_bytes) {
    issues.push('pdf:capture_metadata');
  }
  if (sha256(String(boundedPageText)) !== EXPECTED_PDF.excerpt_sha256
      || Buffer.byteLength(String(boundedPageText)) !== EXPECTED_PDF.excerpt_bytes) {
    issues.push('pdf:bounded_text_bytes');
  }
  return {
    verified: issues.length === 0,
    issues,
    official_url: PDF_URL,
    catalog_identity: 'VIRGINIA MILITARY INSTITUTE ACADEMIC CATALOG, 2025-2026',
    pdf_sha256: metadata.pdf_sha256 || null,
    pdf_bytes: metadata.pdf_bytes ?? null,
    bounded_page_text_sha256: sha256(String(boundedPageText)),
    bounded_page_text_bytes: Buffer.byteLength(String(boundedPageText)),
    page_ranges: metadata.page_ranges || null,
    acquisition_boundary: 'raw PDF bytes are regenerable under the ignored page cache; this durable receipt retains only exact response identity and page-bounded extracted text',
  };
}

function parseBoundedPdf(boundedPageText = '') {
  const issues = [];
  const pages = splitBoundedPdf(boundedPageText);
  const expectedRanges = EXPECTED_PDF.page_ranges;
  if (!exactArray(pages.map((row) => [row.first_page, row.last_page]), expectedRanges)) {
    issues.push('pdf:page_boundaries');
  }
  const byRange = new Map(pages.map((row) => [
    `${row.first_page}-${row.last_page}`, normalizePdf(row.text),
  ]));
  for (const [range, pageNumber] of [['42-42', '42'], ['132-134', '132'], ['233-233', '233'], ['243-243', '243']]) {
    const page = byRange.get(range) || '';
    if (!page.startsWith(`VIRGINIA MILITARY INSTITUTE ACADEMIC CATALOG, 2025-2026 ${pageNumber} `)) {
      issues.push(`pdf:${range}:catalog_identity`);
    }
  }
  const core = byRange.get('42-42') || '';
  const program = byRange.get('132-134') || '';
  issues.push(...exactTextIssues(core, [
    'C. Scientific Analysis (approved BI, CH, or PY sequence) 8 hours',
    'B. Civilizations and Cultures (two courses)2',
    'One of these courses may be replaced by a credit-bearing, Institute-approved Study Abroad experience.',
  ], 'pdf:42'));
  issues.push(...exactTextIssues(program, [
    'The Bachelor of Science degree in Computer Science – Theory and Application Track requires 136 semester hours.',
    'B.S. in Computer Science - Theory and Application Track must complete science sequence:',
    'Science Requirement I - (BI, CH, or PY w/ lab) Credit Hours: 4',
    'Science Requirement II - (BI, CH, or PY w/ lab) Credit Hours: 4',
    'Required Additional Mathematics Courses: 9 Credits',
    'ELEC MA - Mathematics Elective Credit Hours: 3 **',
    'Free Electives: 24 credits',
    '** MA Elective must be 200 level or higher',
  ], 'pdf:132-134'));

  const mathPage = byRange.get('233-233') || '';
  const ma330 = exactBlock(
    mathPage, 'MA 330WX - History of Mathematics',
    'MA 331X - History of Mathematics II', 'pdf:ma330_boundary', issues,
  );
  const ma331 = exactBlock(
    mathPage, 'MA 331X - History of Mathematics II',
    'MA 339 - Introduction to Python', 'pdf:ma331_boundary', issues,
  );
  if (occurrenceCount(ma330, 'Lecture Hours: 3 | Lab Hours: 0 | Credit Hours: 3') !== 1
      || occurrenceCount(ma330, 'Prerequisite(s): MA 123 or permission of instructor.') !== 1
      || occurrenceCount(ma330, 'Note: Writing Intensive (W) and Civilizations & Cultures Course (X).') !== 1) {
    issues.push('pdf:ma330_formula_or_designation');
  }
  if (occurrenceCount(ma331, 'Lecture Hours: 3 | Lab Hours: 0 | Credit Hours: 3') !== 1
      || occurrenceCount(ma331, 'Prerequisite(s): MA 124 Note: Civilizations & Cultures Course (X).') !== 1) {
    issues.push('pdf:ma331_formula_or_designation');
  }

  const biologyPage = byRange.get('243-243') || '';
  const bi101 = exactBlock(
    biologyPage, 'BI 101 - General Biology I',
    'BI 102 - General Biology II', 'pdf:bi101_boundary', issues,
  );
  const bi102 = exactBlock(
    biologyPage, 'BI 102 - General Biology II',
    'BI 105 - Concepts in Biology I', 'pdf:bi102_boundary', issues,
  );
  for (const [code, block] of [['BI101', bi101], ['BI102', bi102]]) {
    if (occurrenceCount(block, 'Lecture Hours: 3 | Lab Hours: 3 | Credit Hours: 4') !== 1) {
      issues.push(`pdf:${code}:hours`);
    }
  }
  if (occurrenceCount(bi102, 'This course is a continuation of BI 101.') !== 1) {
    issues.push('pdf:bi102_continuation');
  }
  return {
    verified: issues.length === 0,
    issues,
    relevant_page_sha256: Object.fromEntries(pages.map((row) => [
      `${row.first_page}-${row.last_page}`, sha256(row.text),
    ])),
    exact_course_entries: {
      MA330WX: {
        credits: 3, designation: ['W', 'X'],
        prerequisite_formula: {
          kind: 'any_of', operands: [
            { kind: 'course', code: 'MA123' },
            { kind: 'permission', authority: 'instructor' },
          ],
        },
        raw_entry_sha256: sha256(ma330),
      },
      MA331X: {
        credits: 3, designation: ['X'],
        prerequisite_formula: { kind: 'course', code: 'MA124' },
        raw_entry_sha256: sha256(ma331),
      },
      BI101: {
        credits: 4, lecture_hours: 3, lab_hours: 3,
        raw_entry_sha256: sha256(bi101),
      },
      BI102: {
        credits: 4, lecture_hours: 3, lab_hours: 3,
        continuation_of: 'BI101', raw_entry_sha256: sha256(bi102),
      },
    },
  };
}

function extractAppliedMathematicsRoster(courseCatalogHtml = '') {
  const source = String(courseCatalogHtml || '');
  const $ = cheerio.load(source);
  const issues = [];
  if (normalize($('title').text()) !== 'Courses of Instruction - Virginia Military Institute'
      || !exactArray($('h1').map((index, element) => normalize($(element).text())).get(), [
        'Courses of Instruction',
      ])
      || !exactArray($('#acalog-catalog-name').map((index, element) => normalize($(element).text())).get(), [
        '2025-2026 Academic Catalog',
      ])) {
    issues.push('math_roster:catalog_identity');
  }
  const applied = $('h2').filter((index, element) => normalize($(element).text()) === 'APPLIED MATHEMATICS');
  const arabic = $('h2').filter((index, element) => normalize($(element).text()) === 'ARABIC');
  if (applied.length !== 1 || arabic.length !== 1) issues.push('math_roster:section_headings');
  const startRow = applied.closest('tr');
  const endRow = arabic.closest('tr');
  const rows = startRow.parent().children('tr');
  const start = startRow.index();
  const end = endRow.index();
  if (start !== 20 || end !== 60 || startRow.parent()[0] !== endRow.parent()[0]) {
    issues.push('math_roster:section_geometry');
  }
  const entries = [];
  rows.slice(start + 1, end).each((relativeIndex, row) => {
    const links = $(row).find('a[href^="preview_course_nopop.php?catoid=39&coid="]');
    if (links.length !== 1) {
      issues.push(`math_roster:row_${relativeIndex}`);
      return;
    }
    const link = links.first();
    const visible = normalize(link.text());
    const match = /^MA (\d{3}(?:-\d{3})?[A-Z]{0,2}) - (.+)$/.exec(visible);
    const href = link.attr('href') || '';
    const hrefMatch = /^preview_course_nopop\.php\?catoid=39&coid=(\d+)$/.exec(href);
    if (!match || !hrefMatch) {
      issues.push(`math_roster:entry_${relativeIndex}`);
      return;
    }
    entries.push({
      course_code: normalizeCode(`MA${match[1]}`),
      title: match[2], catalog_id: 39, course_id: Number(hrefMatch[1]),
      structural_row_index: start + 1 + relativeIndex,
    });
  });
  const codes = entries.map((row) => row.course_code);
  if (!exactArray(codes, EXPECTED_MATH_ROSTER) || new Set(codes).size !== codes.length) {
    issues.push('math_roster:exact_codes');
  }
  const atOrAbove200 = entries.filter((row) => Number(row.course_code.match(/^MA(\d{3})/)?.[1]) >= 200);
  const singleIdentities = atOrAbove200.filter((row) => !row.course_code.includes('-'));
  const selectable = singleIdentities.filter((row) => row.course_code !== 'MA220');
  if (entries.length !== 39 || atOrAbove200.length !== 30
      || singleIdentities.length !== 28 || selectable.length !== 27
      || !selectable.some((row) => row.course_code === 'MA331X')) {
    issues.push('math_roster:eligibility_counts');
  }
  return {
    verified: issues.length === 0,
    issues,
    structural_section: {
      heading: 'APPLIED MATHEMATICS', next_heading: 'ARABIC',
      heading_row_index: start, next_heading_row_index: end,
    },
    published_entry_count: entries.length,
    at_or_above_200_count: atOrAbove200.length,
    exact_single_identity_count: singleIdentities.length,
    selectable_single_identity_excluding_required_MA220_count: selectable.length,
    entries,
    selectable_single_identity_codes: selectable.map((row) => row.course_code),
  };
}

function parseResidenceRule(graduationHtml = '') {
  const source = String(graduationHtml || '');
  const $ = cheerio.load(source);
  const issues = [];
  const details = $('details').filter((index, element) => (
    normalize($(element).find('summary').first().text()) === 'Transfer Limits and Residency'
  ));
  if (details.length !== 1) issues.push('residency:unique_details');
  const rule = normalize(details.text());
  const exactClauses = [
    'cadets matriculating with no advance standing credit must complete a minimum of six semesters and 75% of their degree requirements in residence at VMI.',
    'Cadets matriculating with advanced standing credit will be credited with appropriate time reduction based on transferred activity, but must complete a minimum of six semesters and 50% of their academic activity in residence at VMI.',
    'A maximum of 18 semester hours may be transferred from summer sessions, inter-semester sessions and internet activity from other colleges.',
    'Internet-based courses are NOT allowed while cadets are simultaneously enrolled full-time at VMI for the Fall or Spring semesters.',
  ];
  issues.push(...exactTextIssues(rule, exactClauses, 'residency'));
  const finalDetails = $('details').filter((index, element) => (
    normalize($(element).find('summary').first().text()) === 'Transfer Credit for Meeting Degree Requirements:'
  ));
  const finalRule = normalize(finalDetails.text());
  if (finalDetails.length !== 1
      || occurrenceCount(finalRule, 'may transfer in a maximum of 10 credit hours towards the final completion of his/her degree requirements.') !== 1
      || occurrenceCount(finalRule, 'All courses must be pre-approved') !== 1
      || occurrenceCount(finalRule, 'all final grades must be into the Office of the Registrar one week before the cadet’s respective commencement date.') !== 1) {
    issues.push('residency:final_completion_rule');
  }
  return {
    verified: issues.length === 0,
    issues,
    conditional_branches: [
      { advanced_standing_credit: false, minimum_semesters: 6, resident_fraction: 0.75 },
      { advanced_standing_credit: true, minimum_semesters: 6, resident_fraction: 0.50 },
    ],
    additional_dimensions: {
      summer_intersession_and_internet_transfer_maximum_credits: 18,
      concurrent_full_time_fall_spring_internet_transfer_allowed: false,
      post_final_full_time_semester_transfer_maximum_credits: 10,
      post_final_courses_must_be_preapproved: true,
      final_grade_deadline_relative_to_commencement_days: 7,
    },
    exact_details_sha256: sha256(rule),
    exact_final_completion_details_sha256: sha256(finalRule),
  };
}

const EXPECTED_COMPOSITION_FACTS = Object.freeze({
  identity: {
    schema_version: 1, slug: SLUG,
    program: 'Computer Science, B.S. - Theory and Application Track',
    catalog_year: CATALOG_YEAR, total_units: 136,
    composition_status: 'composed_full_degree',
  },
  already_required_math_sequence: {
    select: 1, units: 6, label: 'Mathematical reasoning',
    receiver: { kind: 'series', codes: ['MA123', 'MA124'], units: 6 },
  },
  science: {
    path: 'requirement_groups[0]', title: 'VMI Core Curriculum for the Theory and Application track',
    stated_credits: 34,
    constraint: {
      kind: 'approved_science_sequence', status: 'evaluator_not_implemented',
      description: 'The eight science credits must be an approved two-course biology, chemistry, or physics sequence with laboratories.',
    },
    section: {
      select: 1, units: 8, label: 'Scientific analysis',
      receiver: {
        kind: 'ge_area', code: 'VMI-SCIENCE-SEQUENCE',
        name: 'Approved two-course BI, CH, or PY science sequence with laboratories', units: 8,
      },
    },
  },
  mathematics: {
    path: 'requirement_groups[5]', title: 'Required additional mathematics', stated_credits: 9,
    constraint: {
      kind: 'approved_math_elective_level_floor', status: 'evaluator_not_implemented',
      description: 'The open mathematics elective must be numbered 200 or above.',
    },
    section: {
      select: 1, units: 3, tier: 'breadth',
      receiver: {
        kind: 'ge_area', code: 'VMI-MA-200-PLUS',
        name: 'Approved mathematics elective numbered 200 or above', units: 3,
      },
    },
  },
  overlay: {
    path: 'requirement_groups[7]', title: 'Free electives to the Theory and Application degree total',
    stated_credits: 24,
    constraint: {
      kind: 'core_overlay_inside_free_electives', status: 'evaluator_not_implemented',
      description: 'Two Civilizations and Cultures courses must be satisfied inside the published allocation; one may be replaced by an approved credit-bearing study-abroad experience.',
    },
    section: {
      select: 1, units: 24,
      receiver: {
        kind: 'ge_area', code: 'VMI-THEORY-FREE-ELECTIVES',
        name: 'Twenty-four free-elective credits, including any remaining Core overlays', units: 24,
      },
    },
  },
  residency: {
    path: 'requirement_groups[8]', title: 'Institute graduation and residence rules',
    constraint: {
      kind: 'conditional_residency_by_advanced_standing', status: 'evaluator_not_implemented',
      description: 'Residence is at least six qualifying full-time semesters and either 75 percent of the degree for entrants without advanced standing or 50 percent for entrants with advanced standing.',
    },
    section: {
      select: 1, units: 0, label: 'Residence requirements',
      receiver: {
        kind: 'requirement',
        name: "Satisfy VMI's six-semester, percentage-of-program, and final-semester residence rules",
        units: 0,
      },
    },
  },
});

function receiver(receiver) {
  const body = receiver?.receiving && typeof receiver.receiving === 'object'
    ? receiver.receiving : receiver || {};
  const rawCodes = body.codes ?? body.code ?? [];
  const codeFact = Array.isArray(rawCodes)
    ? (rawCodes.length ? { codes: rawCodes.map(normalizeCode) } : {})
    : (rawCodes ? { code: normalizeCode(rawCodes) } : {});
  return {
    kind: body.kind || null,
    ...codeFact,
    ...(body.name ? { name: body.name } : {}),
    units: body.units ?? null,
  };
}

function selectedCompositionFacts(document) {
  const groups = Array.isArray(document?.requirement_groups) ? document.requirement_groups : [];
  const science = groups[0] || {};
  const math = groups[5] || {};
  const overlay = groups[7] || {};
  const residency = groups[8] || {};
  const section = (group, index) => group?.sections?.[index] || {};
  const oneConstraint = (group) => group?.analysis_constraints?.[0] || null;
  const sectionFact = (value) => ({
    select: value.select ?? null, units: value.units ?? null,
    ...(value.label ? { label: value.label } : {}),
    ...(value.tier ? { tier: value.tier } : {}),
    receiver: receiver(value.receivers?.[0]),
  });
  return {
    identity: {
      schema_version: document?.schema_version ?? null, slug: document?.slug ?? null,
      program: document?.program ?? null, catalog_year: document?.catalog_year ?? null,
      total_units: document?.total_units ?? null,
      composition_status: document?.composition_status ?? null,
    },
    already_required_math_sequence: sectionFact(section(science, 3)),
    science: {
      path: 'requirement_groups[0]', title: science.title ?? null,
      stated_credits: science.stated_credits ?? null,
      constraint: oneConstraint(science), section: sectionFact(section(science, 4)),
    },
    mathematics: {
      path: 'requirement_groups[5]', title: math.title ?? null,
      stated_credits: math.stated_credits ?? null,
      constraint: oneConstraint(math), section: sectionFact(section(math, 2)),
    },
    overlay: {
      path: 'requirement_groups[7]', title: overlay.title ?? null,
      stated_credits: overlay.stated_credits ?? null,
      constraint: oneConstraint(overlay), section: sectionFact(section(overlay, 0)),
    },
    residency: {
      path: 'requirement_groups[8]', title: residency.title ?? null,
      constraint: oneConstraint(residency), section: sectionFact(section(residency, 4)),
    },
  };
}

function verifyComposition(document) {
  const facts = selectedCompositionFacts(document);
  const issues = exactArray(facts, EXPECTED_COMPOSITION_FACTS)
    ? [] : ['composition:exact_open_rule_carriers'];
  return {
    verified: issues.length === 0,
    issues,
    facts_sha256: semanticSha256(facts),
    facts,
  };
}

function buildVirginiaMilitaryInstituteOpenRuleEvidence(input = {}) {
  const retained = verifyRetainedSources(input);
  const published = parseProgramAndGeneralEducation(input);
  const capture = verifyPdfCapture(input.captureMetadata, input.boundedPageText);
  const pdf = parseBoundedPdf(input.boundedPageText);
  const mathRoster = extractAppliedMathematicsRoster(input.courseCatalogHtml);
  const residency = parseResidenceRule(input.graduationHtml);
  const composition = verifyComposition(input.composition);
  const issues = [
    ...retained.issues.map((issue) => `retained:${issue}`),
    ...published.issues,
    ...capture.issues,
    ...pdf.issues,
    ...mathRoster.issues,
    ...residency.issues,
    ...composition.issues,
  ];
  if (issues.length) throw new Error(`VMI open-rule evidence failed closed: ${issues.join(', ')}`);

  const entries = pdf.exact_course_entries;
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    catalog_year: CATALOG_YEAR,
    institution: { slug: SLUG, name: 'Virginia Military Institute', school_id: 9235 },
    publication_ready: false,
    source_contract: {
      catalog_boundary: 'Every semantic rule and course witness is from the VMI 2025-2026 catalog edition. The catalog index and official PDF are independent responses bound by their exact response hashes; no same-capture-time claim is made.',
      retained_primary_sources: retained,
      official_catalog_pdf: capture,
    },
    published_degree_arithmetic: published,
    approved_math_elective_level_floor: {
      source_verified: true,
      paper_witness_exact: true,
      authored_constraint_path: 'requirement_groups[5]',
      predicate: { subject: 'MA', minimum_course_number: 200, credits: 3 },
      roster_contract: mathRoster,
      deterministic_witness: {
        course_code: 'MA331X', allocation: 'open mathematics elective', credits: 3,
        satisfies_number_floor: true, civilizations_and_cultures_designation: true,
        prerequisite_formula: entries.MA331X.prerequisite_formula,
        prerequisite_course_already_required: true,
        prerequisite_course_code: 'MA124',
        source_entry_sha256: entries.MA331X.raw_entry_sha256,
      },
    },
    core_overlay_inside_free_electives: {
      source_verified: true,
      paper_witness_exact: true,
      authored_constraint_path: 'requirement_groups[7]',
      exact_source_rule: published.civilizations_and_cultures,
      localization_finding: {
        authored_kind_literal_both_courses_inside_free_electives_supported: false,
        description_inside_published_allocation_supported: true,
        reason: 'The source requires two C&C courses but does not require both to occupy free-elective slots. A legal zero-increment witness uses one math-elective slot and one free-elective slot.',
      },
      deterministic_cross_allocation_witness: {
        study_abroad_used: false,
        total_designated_courses: 2,
        incremental_credits_above_published_degree_total: 0,
        free_elective_credits_consumed: 3,
        free_elective_credits_remaining: 21,
        assignments: [
          {
            course_code: 'MA331X', allocation: 'open mathematics elective', credits: 3,
            prerequisite_formula: entries.MA331X.prerequisite_formula,
            prerequisite_course_already_required: true,
            source_entry_sha256: entries.MA331X.raw_entry_sha256,
          },
          {
            course_code: 'MA330WX', allocation: 'free electives', credits: 3,
            selected_prerequisite_branch: { kind: 'course', code: 'MA123' },
            full_prerequisite_formula: entries.MA330WX.prerequisite_formula,
            selected_prerequisite_course_already_required: true,
            source_entry_sha256: entries.MA330WX.raw_entry_sha256,
          },
        ],
      },
    },
    approved_science_sequence: {
      source_rule_verified: true,
      exact_approved_roster_verified: false,
      paper_witness_exact: false,
      authored_constraint_path: 'requirement_groups[0]',
      exact_source_rule: published.science_rule,
      bounded_candidate: {
        course_codes: ['BI101', 'BI102'], total_credits: 8,
        same_eligible_subject: true, each_has_laboratory: true,
        continuation_relationship_explicit: true,
        entries: [entries.BI101, entries.BI102],
      },
      unresolved_fact: 'No retained source explicitly identifies BI 101 + BI 102 as the approved sequence for the Computer Science Theory and Application track; structural fit is not approval.',
      forbidden_inference: 'Do not promote a subject/lab/continuation match into an approved program-specific roster.',
      figures_blocked: ['1', '3', '4', '6'],
    },
    conditional_residency_by_advanced_standing: {
      source_rule_verified: true,
      executable_for_paper_figures: false,
      authored_constraint_path: 'requirement_groups[8]',
      source_rule: residency,
      missing_runtime_state: [
        'advanced_standing_credit_at_matriculation',
        'qualifying_full_time_semester_count',
        'resident_academic_activity_denominator_for_the_applicable_branch',
        'summer_or_intersession_transfer_classification',
        'concurrent_fall_or_spring_full_time_enrollment',
        'post_final_semester_preapproval_and_completion_timing',
      ],
      figures_blocked: ['3', '4'],
    },
    paper_capability_delta: {
      central_runtime_integrated: true,
      exact_source_capabilities_available_for_integration: [
        'approved_math_elective_level_floor',
        'core_overlay_inside_published_allocation_via_cross_group_witness',
      ],
      current_blocking_audit_receipt_count_by_figure: {
        '1': 3, '3': 5, '4': 5, '6': 3,
      },
      integrated_blocker_reduction_by_figure: {
        '1': {
          resolved: 2, residual_audit_receipt_count: 1,
          residual: ['requirement_groups[0].analysis_constraints[0]:approved_science_sequence'],
        },
        '3': {
          resolved: 2, residual_audit_receipt_count: 3,
          residual: [
            'requirement_groups[0].analysis_constraints[0]:approved_science_sequence',
            'requirement_groups[8].analysis_constraints[0]:conditional_residency_by_advanced_standing',
            'unit_audit.residency:residency',
          ],
        },
        '4': {
          resolved: 2, residual_audit_receipt_count: 3,
          residual: [
            'requirement_groups[0].analysis_constraints[0]:approved_science_sequence',
            'requirement_groups[8].analysis_constraints[0]:conditional_residency_by_advanced_standing',
            'unit_audit.residency:residency',
          ],
        },
        '6': {
          resolved: 2, residual_audit_receipt_count: 1,
          residual: ['requirement_groups[0].analysis_constraints[0]:approved_science_sequence'],
        },
      },
      residual_semantic_blockers_by_figure: {
        '1': ['approved_science_sequence'],
        '3': ['approved_science_sequence', 'conditional_residency_and_transfer_policy'],
        '4': ['approved_science_sequence', 'conditional_residency_and_transfer_policy'],
        '6': ['approved_science_sequence'],
      },
      residency_is_only_remaining_blocker: false,
    },
    canonical_effect: {
      verified_requirement_or_composition_mutations: 0,
      accepted_source_mutations: 0,
      projection_mutations: 0,
      central_evaluator_changes: 2,
      database_writes: 0,
      constraint_carrier_sha256: composition.facts_sha256,
    },
  };
}

function virginiaMilitaryInstituteOpenRuleEvidenceIssue(evidence) {
  if (!evidence || evidence.schema_version !== 1 || evidence.artifact !== ARTIFACT
      || evidence.catalog_year !== CATALOG_YEAR || evidence.publication_ready !== false) {
    return 'VMI open-rule artifact identity changed';
  }
  if (semanticSha256(evidence) !== ARTIFACT_SEMANTIC_SHA256) {
    return 'VMI open-rule source facts, fail-closed decisions, or mutation boundary changed';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  ARTIFACT_SEMANTIC_SHA256,
  CATALOG_YEAR,
  EXPECTED_COMPOSITION_FACTS,
  EXPECTED_MATH_ROSTER,
  EXPECTED_PDF,
  EXPECTED_SOURCE,
  buildVirginiaMilitaryInstituteOpenRuleEvidence,
  extractAppliedMathematicsRoster,
  parseBoundedPdf,
  parseProgramAndGeneralEducation,
  parseResidenceRule,
  selectedCompositionFacts,
  verifyComposition,
  verifyPdfCapture,
  verifyRetainedSources,
  virginiaMilitaryInstituteOpenRuleEvidenceIssue,
};
