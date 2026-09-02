const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'vcu_2026_2027_transfer_pathway_policy_evidence';
const CATALOG_YEAR = '2026-2027';
const POLICY_URL =
  'https://bulletin.vcu.edu/undergraduate/undergraduate-study/admission-university/transfer-admission-guidelines/';
const ROBOTS_URL = 'https://bulletin.vcu.edu/robots.txt';

const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const EXPECTED = Object.freeze({
  title: 'Admission guidelines for transfer students < Virginia Commonwealth University Academic Catalog',
  heading: 'Admission guidelines for transfer students',
  edition: '2026-27 Edition',
  preliminary:
    'This is the preliminary (or launch) version of the 2026-2027 VCU Bulletin. Courses that expose students to cutting-edge content and transformative learning may be added and notification of additional program approvals may be received prior to finalization. General education program content is also subject to change. The final edition and full PDF version will include these updates and will be available in August prior to the beginning of the fall semester.',
  accepted_credit:
    'Accepted transfer credit contributes to hours earned and toward fulfillment of degree requirements at VCU. The grades of accepted transfer courses are recorded as TR on the student’s VCU transcript. Hours attempted and quality points earned are not recorded.',
  transfer_maximum:
    'A maximum of 90 total undergraduate transfer credits will be accepted. Regardless of how many transfer credits are accepted, students must satisfy all VCU graduation requirements noted in the graduation checklist, including the following:',
  overall_residency:
    'Completion of at least 25 percent of the semester-hour credits required for their bachelor’s degree program at VCU',
  final_window:
    'Completion of at least 30 of the last 45 semester-hour credits required for their bachelor’s degree program at VCU',
  upper_level:
    'Completion of at least 45 upper-level credits (courses numbered 300 or higher)',
  major_residency:
    'No more than half (50 percent) of the courses applied to the major requirements can be transferred from another college. In other words, students may need to complete at least 50 percent of their major degree requirements at VCU.',
  ge_waiver:
    'Transfer students who earn a Uniform Certificate of General Studies, a transfer-oriented associate degree (A.A., A.S., or A.A.& S.), an Associate of Fine Arts (A.F.A.) or a bachelor’s degree from a regionally accredited institution prior to enrollment at VCU will be considered to have met all lower-division general education requirements with the exception of certain lower-level and upper-level degree program requirements that also apply to native students.',
  grade_threshold:
    'Only courses with minimum grades of C are transferable.',
  equivalency_rule:
    'Credits needed to meet major prerequisites will be based on the course equivalency tables or agreements resulting from program-to-program articulation agreements. (See the list of agreements.)',
});

function uniqueExact(values, expected, issue, issues) {
  const matches = values.filter((value) => value === expected);
  if (matches.length !== 1) issues.push(issue);
  return matches[0] || null;
}

function robotsAllowsPolicy(robotsText) {
  const text = String(robotsText || '');
  if (!text.trim()) return false;
  const policyPath = new URL(POLICY_URL).pathname;
  const disallowed = text.split(/\r?\n/)
    .map((line) => line.match(/^\s*Disallow:\s*(\S*)\s*$/i)?.[1] || null)
    .filter(Boolean);
  return !disallowed.some((prefix) => policyPath.startsWith(prefix));
}

/**
 * Extract only the policy facts consumed by the paper model.  The parser is
 * intentionally structural and exact: a wording, heading, edition, or list
 * change produces an issue instead of silently carrying the old inference.
 */
function parseVcuTransferPolicy(html, {
  requestedUrl = POLICY_URL,
  finalUrl = POLICY_URL,
  contentType = 'text/html',
  robotsText = '',
  robotsStatus = 200,
  capturedAt = null,
} = {}) {
  const source = String(html || '');
  const issues = [];
  const $ = cheerio.load(source);
  const title = normalize($('title').text());
  const headings = $('h1').map((index, element) => normalize($(element).text())).get();
  const edition = normalize($('#bulletin-edition .cat-title').text());
  const content = $('#content');
  const contentParagraphs = content.find('p')
    .map((index, element) => normalize($(element).text())).get();
  const contentListItems = content.find('li')
    .map((index, element) => normalize($(element).clone().children('ul,ol').remove().end().text()))
    .get();

  if (requestedUrl !== POLICY_URL || finalUrl !== POLICY_URL) issues.push('source_url');
  if (!String(contentType || '').toLowerCase().includes('text/html')) issues.push('content_type');
  if (title !== EXPECTED.title) issues.push('document_title');
  if (headings.length !== 1 || headings[0] !== EXPECTED.heading) issues.push('unique_heading');
  if (edition !== EXPECTED.edition) issues.push('catalog_edition');
  uniqueExact(contentParagraphs, EXPECTED.preliminary, 'preliminary_banner', issues);
  uniqueExact(contentListItems, EXPECTED.accepted_credit, 'accepted_credit_rule', issues);
  uniqueExact(contentListItems, EXPECTED.transfer_maximum, 'transfer_maximum_rule', issues);
  uniqueExact(contentListItems, EXPECTED.overall_residency, 'overall_residency_rule', issues);
  uniqueExact(contentListItems, EXPECTED.final_window, 'final_window_rule', issues);
  uniqueExact(contentListItems, EXPECTED.upper_level, 'upper_level_rule', issues);
  uniqueExact(contentParagraphs, EXPECTED.major_residency, 'major_residency_rule', issues);

  const geHeadings = content.find('h3').filter((index, element) => (
    normalize($(element).text()) === 'General education requirements for transfer students'
  ));
  if (geHeadings.length !== 1) issues.push('general_education_heading');
  const geRows = geHeadings.first().next('ol').children('li')
    .map((index, element) => normalize($(element).text())).get();
  if (geRows.length !== 4 || geRows[0] !== EXPECTED.ge_waiver) {
    issues.push('transfer_degree_general_education_waiver');
  }

  const stateHeadings = content.find('h2').filter((index, element) => (
    normalize($(element).text()) === 'State policy on transfer agreement'
  ));
  if (stateHeadings.length !== 1) issues.push('state_transfer_policy_heading');
  const additionally = stateHeadings.first().nextAll('p').filter((index, element) => (
    normalize($(element).text()) === 'Additionally:'
  )).first();
  const stateRows = additionally.next('ul').children('li')
    .map((index, element) => normalize($(element).text())).get();
  if (!stateRows.includes(EXPECTED.grade_threshold)) issues.push('transfer_grade_threshold');
  if (!stateRows.includes(EXPECTED.equivalency_rule)) issues.push('major_equivalency_rule');

  if (robotsStatus !== 200 || !robotsAllowsPolicy(robotsText)) issues.push('robots_policy');

  const policyFacts = {
    accepted_transfer_credit: {
      contributes_to_hours_earned: true,
      contributes_toward_degree_requirements: true,
      exact_text: EXPECTED.accepted_credit,
    },
    transfer_ceiling: {
      maximum_units: 90,
      exact_text: EXPECTED.transfer_maximum,
    },
    residency: {
      degree_fraction_minimum: 0.25,
      degree_units_minimum_at_120: 30,
      final_window_units: 45,
      final_window_resident_units_minimum: 30,
      upper_level_units_minimum: 45,
      major_external_course_fraction_maximum: 0.5,
      exact_text: {
        overall: EXPECTED.overall_residency,
        final_window: EXPECTED.final_window,
        upper_level: EXPECTED.upper_level,
        major: EXPECTED.major_residency,
      },
    },
    transfer_degree_general_education: {
      timing: 'earned_prior_to_vcu_enrollment',
      qualifying_awards: ['AA', 'AS', 'AA&S', 'AFA', 'bachelors'],
      lower_division_general_education_met: true,
      native_program_requirements_still_apply: true,
      exact_text: EXPECTED.ge_waiver,
    },
    transfer_course_conditions: {
      minimum_grade: 'C',
      major_credit_uses_equivalency_tables_or_program_agreements: true,
      exact_text: {
        grade: EXPECTED.grade_threshold,
        equivalency: EXPECTED.equivalency_rule,
      },
    },
  };
  const semanticSha256 = sha256(JSON.stringify(policyFacts));

  return {
    verified: issues.length === 0,
    issues,
    source: {
      requested_url: requestedUrl,
      final_url: finalUrl,
      content_type: contentType,
      response_bytes: Buffer.byteLength(source),
      response_sha256: sha256(source),
      captured_at: capturedAt,
      title,
      heading: headings[0] || null,
      catalog_edition: edition,
      preliminary: true,
    },
    robots: {
      url: ROBOTS_URL,
      http_status: robotsStatus,
      response_bytes: Buffer.byteLength(String(robotsText || '')),
      response_sha256: sha256(String(robotsText || '')),
      policy_path_allowed: robotsAllowsPolicy(robotsText),
    },
    policy_facts: policyFacts,
    policy_facts_sha256: semanticSha256,
  };
}

function buildVcuTransferPolicyEvidence(html, options = {}) {
  const parsed = parseVcuTransferPolicy(html, options);
  if (!parsed.verified) {
    throw new Error(`VCU transfer-policy source did not verify: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: {
      name: 'Virginia Commonwealth University',
      slug: 'virginia-commonwealth-university',
      school_id: 9229,
    },
    catalog_year: CATALOG_YEAR,
    purpose:
      'Supplemental exact policy receipt for the fixed transfer-oriented associate-degree paper cohort. It does not modify the reviewed Computer Science major tree or source-bundle signature.',
    ...parsed,
    paper_interpretation: {
      incoming_award: 'AS',
      award_earned_before_vcu_enrollment: true,
      successful_grade_eligible_pathway: true,
      lower_division_connected_category_distribution_waived: true,
      program_specific_named_requirements_waived: false,
      accepted_transfer_units_may_apply_to_degree_hours: true,
      maximum_transfer_units: 90,
      figure_3_4_exact_for_qualifying_as: true,
      figure_6_connected_course_identity_increment: 0,
    },
  };
}

module.exports = {
  ARTIFACT,
  CATALOG_YEAR,
  EXPECTED,
  POLICY_URL,
  ROBOTS_URL,
  USER_AGENT,
  buildVcuTransferPolicyEvidence,
  normalize,
  parseVcuTransferPolicy,
  robotsAllowsPolicy,
  sha256,
};
