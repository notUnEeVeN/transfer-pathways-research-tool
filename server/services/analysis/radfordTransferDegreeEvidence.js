const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'radford_2026_2027_transfer_degree_real_evidence';
const CATALOG_YEAR = '2026-2027';
const TRANSFER_URL =
  'https://www.radford.edu/academics/curriculum/real-curriculum/transfer.html';
const REQUIREMENTS_URL =
  'https://www.radford.edu/academics/curriculum/real-curriculum/real-curriculum-requirements-2025-forward.html';
const FACULTY_URL =
  'https://www.radford.edu/academics/curriculum/real-curriculum/faculty.html';
const ROBOTS_URL = 'https://www.radford.edu/robots.txt';
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const semanticSha256 = (value) => sha256(JSON.stringify(stable(value)));

const EXPECTED = Object.freeze({
  transfer: Object.freeze({
    title: 'Transfer Students',
    heading: 'Transfer Students',
    eligibility:
      'Students who have earned an Associate of Arts (AA), Associate of Science (AS), or Associate of Arts and Sciences (AAS) degree from a Virginia community college or higher education institution will have the following met:',
    real: 'REAL requirements (all 4 areas)',
    foundations_and_wi:
      'Foundational Writing, Foundational Math, and Writing Intensive courses',
    general_education: '30 credits required in General Education',
  }),
  requirements: Object.freeze({
    title: 'REAL Curriculum Requirements (Fall 2025 to Summer 2027) | Radford University',
    heading: 'REAL Curriculum Requirements (Fall 2025 to Summer 2027)',
    total: '39-48 hours',
    outside_major:
      "You'll also take Writing Intensive (WI) courses. At least 15 credits (not including foundational writing/math) must come from outside your major's department.",
  }),
  faculty: Object.freeze({
    title: 'Faculty | REAL Curriculum | Radford University',
    heading: 'Faculty',
    catalog_boundary:
      'This transitional model applies to students entering Radford University under the 2025-26 or 2026-27 catalogs.',
    other_transfer_lead:
      'Yes. Transfer students may qualify for waivers under the Legacy Transfer Policy (based on credit hours and key courses). All other transfer students must complete the REAL 2025-27 model in full, including:',
    outside_major: '15 credits outside the major',
  }),
});

const POLICY_FACTS = Object.freeze({
  catalog_boundary: Object.freeze({
    applies_to_catalogs: Object.freeze(['2025-2026', '2026-2027']),
    exact_text: EXPECTED.faculty.catalog_boundary,
  }),
  completed_transfer_degree_waiver: Object.freeze({
    qualifying_awards: Object.freeze(['AA', 'AS', 'AAS']),
    qualifying_institution: 'Virginia community college or higher education institution',
    real_areas_met: true,
    foundational_writing_met: true,
    foundational_math_met: true,
    writing_intensive_met: true,
    general_education_units_met: 30,
    exact_text: Object.freeze({
      eligibility: EXPECTED.transfer.eligibility,
      real: EXPECTED.transfer.real,
      foundations_and_wi: EXPECTED.transfer.foundations_and_wi,
      general_education: EXPECTED.transfer.general_education,
    }),
  }),
  current_real_model: Object.freeze({
    foundational_writing_units: 3,
    foundational_math_units: 3,
    writing_intensive_units: 6,
    writing_intensive_upper_units_minimum: 3,
    area_units: Object.freeze({ R: 9, E: 9, A: 9, L: 9 }),
    unique_total_units_minimum: 39,
    unique_total_units_maximum: 48,
    outside_major_units_minimum: 15,
    exact_text: Object.freeze({
      total: EXPECTED.requirements.total,
      outside_major: EXPECTED.requirements.outside_major,
    }),
  }),
  nonqualifying_transfer_requirements: Object.freeze({
    completed_degree_students_excluded_by_other: true,
    outside_major_units: 15,
    exact_text: Object.freeze({
      lead: EXPECTED.faculty.other_transfer_lead,
      outside_major: EXPECTED.faculty.outside_major,
    }),
  }),
  program_specific_major_requirements_waived: false,
});

const POLICY_FACTS_SHA256 =
  '242e20f3663e8107bbfb76763c1c5a4dc01b18deeeea59d919a9a8b7fe2c5cae';

function robotsAllows(url, robotsText) {
  const path = new URL(url).pathname;
  const disallowed = String(robotsText || '').split(/\r?\n/)
    .map((line) => line.match(/^\s*Disallow:\s*(\S*)\s*$/i)?.[1] || null)
    .filter(Boolean);
  return !disallowed.some((prefix) => path.startsWith(prefix));
}

function exactNodeCount($, expected) {
  return $('p,li,td,th').map((index, element) => normalize(
    $(element).clone().children('ul,ol').remove().end().text(),
  )).get().filter((value) => value === expected).length;
}

function exactSubstringCount($, expected) {
  return normalize($('body').text()).split(expected).length - 1;
}

function pageIssue(html, { title, heading, nodes = [], duplicateNodes = {}, substrings = [] }) {
  const $ = cheerio.load(String(html || ''));
  const issues = [];
  if (normalize($('title').text()) !== title) issues.push('document_title');
  const headings = $('h1').map((index, element) => normalize($(element).text())).get();
  if (headings.length !== 1 || headings[0] !== heading) issues.push('unique_heading');
  for (const value of nodes) {
    if (exactNodeCount($, value) !== 1) issues.push(`exact_text:${value}`);
  }
  for (const [value, count] of Object.entries(duplicateNodes)) {
    if (exactNodeCount($, value) !== count) issues.push(`exact_text_count:${value}`);
  }
  for (const value of substrings) {
    if (exactSubstringCount($, value) !== 1) issues.push(`exact_substring:${value}`);
  }
  return issues;
}

function sourceMetadata(html, response, expected) {
  const $ = cheerio.load(String(html || ''));
  return {
    requested_url: response.requestedUrl,
    final_url: response.finalUrl,
    content_type: response.contentType,
    response_bytes: Buffer.byteLength(String(html || '')),
    response_sha256: sha256(String(html || '')),
    title: normalize($('title').text()),
    heading: normalize($('h1').first().text()) || null,
    ...expected,
  };
}

function parseRadfordTransferDegreeEvidence({
  transferHtml = '',
  requirementsHtml = '',
  facultyHtml = '',
  robotsText = '',
  responses = {},
  robotsStatus = 200,
} = {}) {
  const expectedResponses = {
    transfer: {
      requestedUrl: TRANSFER_URL, finalUrl: TRANSFER_URL,
      contentType: 'text/html; charset=UTF-8',
      ...(responses.transfer || {}),
    },
    requirements: {
      requestedUrl: REQUIREMENTS_URL, finalUrl: REQUIREMENTS_URL,
      contentType: 'text/html; charset=UTF-8',
      ...(responses.requirements || {}),
    },
    faculty: {
      requestedUrl: FACULTY_URL, finalUrl: FACULTY_URL,
      contentType: 'text/html; charset=UTF-8',
      ...(responses.faculty || {}),
    },
  };
  const issues = [
    ...pageIssue(transferHtml, {
      ...EXPECTED.transfer,
      nodes: [
        EXPECTED.transfer.eligibility, EXPECTED.transfer.real,
        EXPECTED.transfer.foundations_and_wi, EXPECTED.transfer.general_education,
      ],
    }).map((issue) => `transfer:${issue}`),
    ...pageIssue(requirementsHtml, {
      ...EXPECTED.requirements,
      nodes: [EXPECTED.requirements.outside_major],
      duplicateNodes: { [EXPECTED.requirements.total]: 2 },
    }).map((issue) => `requirements:${issue}`),
    ...pageIssue(facultyHtml, {
      ...EXPECTED.faculty,
      nodes: [EXPECTED.faculty.outside_major],
      substrings: [
        EXPECTED.faculty.catalog_boundary, EXPECTED.faculty.other_transfer_lead,
      ],
    }).map((issue) => `faculty:${issue}`),
  ];
  for (const [key, expectedUrl] of [
    ['transfer', TRANSFER_URL], ['requirements', REQUIREMENTS_URL], ['faculty', FACULTY_URL],
  ]) {
    const response = expectedResponses[key];
    if (response.requestedUrl !== expectedUrl || response.finalUrl !== expectedUrl) {
      issues.push(`${key}:source_url`);
    }
    if (!String(response.contentType || '').toLowerCase().includes('text/html')) {
      issues.push(`${key}:content_type`);
    }
    if (!robotsAllows(expectedUrl, robotsText)) issues.push(`${key}:robots_policy`);
  }
  if (robotsStatus !== 200 || !String(robotsText || '').trim()) issues.push('robots_response');
  return {
    verified: issues.length === 0,
    issues,
    sources: {
      transfer_degree_waiver: sourceMetadata(
        transferHtml, expectedResponses.transfer, {},
      ),
      current_real_requirements: sourceMetadata(
        requirementsHtml, expectedResponses.requirements, {},
      ),
      faculty_transition_faq: sourceMetadata(
        facultyHtml, expectedResponses.faculty, {},
      ),
    },
    robots: {
      url: ROBOTS_URL,
      http_status: robotsStatus,
      response_bytes: Buffer.byteLength(String(robotsText || '')),
      response_sha256: sha256(String(robotsText || '')),
      policy_paths_allowed: [TRANSFER_URL, REQUIREMENTS_URL, FACULTY_URL]
        .every((url) => robotsAllows(url, robotsText)),
    },
    policy_facts: JSON.parse(JSON.stringify(POLICY_FACTS)),
    policy_facts_sha256: semanticSha256(POLICY_FACTS),
  };
}

function buildRadfordTransferDegreeEvidence(input = {}) {
  const parsed = parseRadfordTransferDegreeEvidence(input);
  if (!parsed.verified) {
    throw new Error(`Radford transfer-degree source did not verify: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: { name: 'Radford University', slug: 'radford-university', school_id: 9219 },
    catalog_year: CATALOG_YEAR,
    purpose: "Supplemental official policy receipt for the paper's completed Virginia A.S. cohort. It does not modify the reviewed Computer Science major tree or waive program-specific major requirements.",
    ...parsed,
    paper_interpretation: {
      incoming_award: 'AS',
      completed_before_radford_enrollment: true,
      real_areas_met: true,
      foundational_requirements_met: true,
      writing_intensive_met: true,
      general_education_units_met: 30,
      outside_major_rule_met_by_completed_degree_waiver: true,
      program_specific_two_sciences_one_laboratory_waived: false,
      figure_3_4_policy_rules_exact_for_qualifying_as: true,
      figure_6_open_course_identity_rules_waived: false,
    },
  };
}

function radfordTransferDegreeEvidenceIssue(evidence) {
  if (!evidence || evidence.schema_version !== 1 || evidence.artifact !== ARTIFACT
      || evidence.catalog_year !== CATALOG_YEAR || evidence.verified !== true
      || (evidence.issues || []).length !== 0
      || evidence.policy_facts_sha256 !== POLICY_FACTS_SHA256
      || semanticSha256(evidence.policy_facts) !== POLICY_FACTS_SHA256
      || JSON.stringify(evidence.policy_facts) !== JSON.stringify(POLICY_FACTS)) {
    return 'the Radford transfer-degree semantic policy receipt changed';
  }
  const expectedSources = {
    transfer_degree_waiver: [TRANSFER_URL, 119746, '97dc8017c79ad693d3be02884e4149859d378b3a54c716de9ca51690a0d6425e'],
    current_real_requirements: [REQUIREMENTS_URL, 121630, 'ba70bd4176175833616c503a9e28268a5557b52dad1f1bab155ebe658f720c07'],
    faculty_transition_faq: [FACULTY_URL, 172498, '11e38f0d262b64cd2305f7d4adb544fa9108e5a33793c35839c92a1d467f1b38'],
  };
  for (const [key, [url, bytes, responseHash]] of Object.entries(expectedSources)) {
    const source = evidence.sources?.[key];
    if (source?.requested_url !== url || source?.final_url !== url
        || source?.response_bytes !== bytes || source?.response_sha256 !== responseHash
        || !String(source?.content_type || '').toLowerCase().includes('text/html')) {
      return `the Radford ${key} official response receipt changed`;
    }
  }
  if (evidence.robots?.url !== ROBOTS_URL || evidence.robots?.http_status !== 200
      || evidence.robots?.response_bytes !== 401
      || evidence.robots?.response_sha256
        !== '16bbefe843bf06054d6f7df31d8978a401777519bbf5558066477dc0a8af0a4e'
      || evidence.robots?.policy_paths_allowed !== true) {
    return 'the Radford robots receipt changed or no longer permits acquisition';
  }
  const paper = evidence.paper_interpretation || {};
  if (paper.incoming_award !== 'AS'
      || paper.completed_before_radford_enrollment !== true
      || paper.real_areas_met !== true
      || paper.foundational_requirements_met !== true
      || paper.writing_intensive_met !== true
      || paper.general_education_units_met !== 30
      || paper.outside_major_rule_met_by_completed_degree_waiver !== true
      || paper.program_specific_two_sciences_one_laboratory_waived !== false
      || paper.figure_3_4_policy_rules_exact_for_qualifying_as !== true
      || paper.figure_6_open_course_identity_rules_waived !== false) {
    return 'the Radford paper interpretation changed';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  CATALOG_YEAR,
  EXPECTED,
  FACULTY_URL,
  POLICY_FACTS,
  POLICY_FACTS_SHA256,
  REQUIREMENTS_URL,
  ROBOTS_URL,
  TRANSFER_URL,
  USER_AGENT,
  buildRadfordTransferDegreeEvidence,
  normalize,
  parseRadfordTransferDegreeEvidence,
  radfordTransferDegreeEvidenceIssue,
  robotsAllows,
  semanticSha256,
  sha256,
};
