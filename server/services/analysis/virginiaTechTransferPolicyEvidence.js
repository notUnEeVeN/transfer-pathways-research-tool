const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'virginia_tech_transferable_associate_policy_evidence';
const POLICY_URL =
  'https://transferguide.registrar.vt.edu/Transfer-Requirements/VCCS-Transfer.html';
const ROBOTS_URL = 'https://transferguide.registrar.vt.edu/robots.txt';
const ROBOTS_FINAL_URL =
  'https://transferguide.registrar.vt.edu/content/dam/transferguide_registrar_vt_edu/robots.txt';
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';
const POLICY_FACTS_SHA256 =
  'a61d5a75b7d626b5e87525f4b6d6f87e4c9e4b0e1219801bef2b10d895765112';
const POLICY_RESPONSE_SHA256 =
  '0a77a5f0affe5fd39eb286b9f5fa3cc7a82be4bfc45b06dc01251584f38cb1ff';
const ROBOTS_RESPONSE_SHA256 =
  'b1282f723cd580b0cf3c38125d24259ceab3b897d38b63376d9fa6c302558fcf';

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const EXPECTED = Object.freeze({
  title:
    'Policy on Transfer of Virginia Community College Students | transferguide.registrar | Virginia Tech',
  heading: 'Policy on Transfer of Virginia Community College Students',
  pathways_heading: 'Fulfilling Virginia Tech Pathways to General Education',
  pathways_policy:
    'Per State Policy on Transfer, students who earn a transferrable associate degree by enrolling in transfer programs at a Virginia Community College or Richard Bland College, and who graduate with associate degrees based upon a baccalaureate-oriented sequence of courses, and who are offered admission to Virginia Tech, will be granted junior level status upon admission. Additionally, these students will have satisfied the requirements of the University Pathways to General Education. It may take such students longer than two years to complete the baccalaureate degree because of major prerequisites and other circumstances or requirements.',
  passport_heading: 'VCCS Passport & Uniform Certificate of General Studies (UCGS)',
  transcript_notation:
    'VCCS students can earn a Passport or Uniform Certificate of General Studies (UCGS) by completing approved general education courses. All completed courses with a grade of C or better will transfer to Virginia Tech individually to satisfy a portion of our general education requirements. Once a transcript with the earned milestone or credential is processed, a notation will appear on the Transfer Credit screen on Hokie Spa and in the degree audit report (DARS).',
  transferable_heading: 'Transferable VCCS Associate Degree',
  transferable_ge:
    'Fulfills all general education requirements but students must also complete the specific course requirements for their major.',
  transferable_awards:
    'A transferable associate degree is an Associate of Arts, an Associate of Science, or an Associate of Arts and Sciences. Neither an Associate of Applied Science nor an Associate of Fine Arts is transferable.',
});

function robotsAllowsPolicy(robotsText) {
  const source = String(robotsText || '');
  if (!source.trim()) return false;
  const path = new URL(POLICY_URL).pathname;
  const disallowed = source.split(/\r?\n/)
    .map((line) => line.match(/^\s*Disallow:\s*(\S*)\s*$/i)?.[1] || null)
    .filter(Boolean);
  return !disallowed.some((prefix) => path.startsWith(prefix));
}

function exactAccordion($, heading, issues, issue) {
  const buttons = $('.vt-accordion-title button').filter((index, element) => (
    normalize($(element).clone().find('svg').remove().end().text()) === heading
  ));
  if (buttons.length !== 1) {
    issues.push(issue);
    return null;
  }
  const panelId = buttons.first().attr('aria-controls');
  const panels = panelId ? $(`#${panelId}`) : $();
  if (panels.length !== 1
      || normalize(panels.attr('aria-labelledby')) !== normalize(buttons.first().attr('id'))) {
    issues.push(`${issue}_panel`);
    return null;
  }
  return panels.first();
}

function exactCount(values, expected, issue, issues) {
  if (values.filter((value) => value === expected).length !== 1) issues.push(issue);
}

/**
 * Parse only the exact policy facts used to discharge the selected-edge note.
 * Any source, structure, wording, award, or robots change invalidates the
 * receipt instead of broadening the interpretation.
 */
function parseVirginiaTechTransferPolicy(html, {
  requestedUrl = POLICY_URL,
  finalUrl = POLICY_URL,
  contentType = 'text/html',
  robotsText = '',
  robotsStatus = 200,
  robotsRequestedUrl = ROBOTS_URL,
  robotsFinalUrl = ROBOTS_FINAL_URL,
  robotsContentType = 'text/plain',
  capturedAt = null,
} = {}) {
  const source = String(html || '');
  const issues = [];
  const $ = cheerio.load(source);
  const title = normalize($('title').text());
  const headings = $('h1.vt-page-title')
    .map((index, element) => normalize($(element).text())).get();

  if (requestedUrl !== POLICY_URL || finalUrl !== POLICY_URL) issues.push('source_url');
  if (!String(contentType || '').toLowerCase().includes('text/html')) issues.push('content_type');
  if (title !== EXPECTED.title) issues.push('document_title');
  if (headings.length !== 1 || headings[0] !== EXPECTED.heading) issues.push('unique_heading');

  const pathways = exactAccordion(
    $, EXPECTED.pathways_heading, issues, 'pathways_policy_heading',
  );
  const pathwaysParagraphs = pathways?.find('.vt-text p')
    .map((index, element) => normalize($(element).text())).get() || [];
  exactCount(
    pathwaysParagraphs,
    EXPECTED.pathways_policy,
    'completed_transferable_associate_pathways_policy',
    issues,
  );

  const passport = exactAccordion(
    $, EXPECTED.passport_heading, issues, 'passport_ucgs_heading',
  );
  const passportParagraphs = passport?.find('.vt-text p')
    .map((index, element) => normalize($(element).text())).get() || [];
  const passportListItems = passport?.find('.vt-text li')
    .map((index, element) => normalize($(element).text())).get() || [];
  exactCount(
    passportParagraphs,
    EXPECTED.transcript_notation,
    'earned_transcript_notation_policy',
    issues,
  );
  exactCount(
    passportParagraphs,
    EXPECTED.transferable_heading,
    'transferable_associate_heading',
    issues,
  );
  exactCount(
    passportListItems,
    EXPECTED.transferable_ge,
    'transferable_associate_general_education_policy',
    issues,
  );
  exactCount(
    passportParagraphs,
    EXPECTED.transferable_awards,
    'transferable_associate_award_types',
    issues,
  );

  const robotsSource = String(robotsText || '');
  if (robotsRequestedUrl !== ROBOTS_URL
      || robotsFinalUrl !== ROBOTS_FINAL_URL
      || new URL(robotsRequestedUrl).origin !== new URL(robotsFinalUrl).origin
      || robotsStatus !== 200
      || !String(robotsContentType || '').toLowerCase().includes('text/plain')
      || !robotsAllowsPolicy(robotsSource)) issues.push('robots_policy');

  const policyFacts = {
    completed_transferable_associate: {
      source_systems: ['VCCS', 'RBC'],
      baccalaureate_oriented_sequence_required: true,
      admission_required: true,
      pathways_general_education_satisfied: true,
      major_specific_requirements_still_apply: true,
      exact_text: EXPECTED.pathways_policy,
    },
    transferable_associate_awards: {
      included: ['AA', 'AS', 'AA&S'],
      excluded: ['AAS', 'AFA'],
      exact_text: EXPECTED.transferable_awards,
    },
    transferable_vccs_associate_general_education: {
      all_general_education_requirements_fulfilled: true,
      major_specific_course_requirements_still_apply: true,
      exact_text: EXPECTED.transferable_ge,
    },
    passport_ucgs: {
      earned_milestone_or_credential_required_for_transcript_notation: true,
      individual_completed_course_minimum_grade: 'C',
      exact_text: EXPECTED.transcript_notation,
    },
  };

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
    },
    robots: {
      requested_url: robotsRequestedUrl,
      final_url: robotsFinalUrl,
      http_status: robotsStatus,
      content_type: robotsContentType,
      response_bytes: Buffer.byteLength(robotsSource),
      response_sha256: sha256(robotsSource),
      same_host_redirect: new URL(robotsRequestedUrl).origin === new URL(robotsFinalUrl).origin,
      policy_path_allowed: robotsAllowsPolicy(robotsSource),
    },
    policy_facts: policyFacts,
    policy_facts_sha256: sha256(JSON.stringify(policyFacts)),
  };
}

function buildVirginiaTechTransferPolicyEvidence(html, options = {}) {
  const parsed = parseVirginiaTechTransferPolicy(html, options);
  if (!parsed.verified) {
    throw new Error(`Virginia Tech transfer-policy source did not verify: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: {
      name: 'Virginia Polytechnic Institute and State University',
      slug: 'virginia-polytechnic-institute-and-state-university',
      school_id: 9230,
    },
    purpose:
      'Exact supplemental receipt for treating a Passport/UCGS selected-edge annotation as advisory only when the paper cell independently models a completed, transferable Virginia A.S. degree. It does not assert that a student earned Passport/UCGS and does not waive major-specific requirements.',
    ...parsed,
    paper_interpretation: {
      incoming_award: 'AS',
      completed_transferable_associate_degree: true,
      pathways_general_education_satisfied: true,
      major_specific_course_requirements_waived: false,
      passport_or_ucgs_earned_assumed: false,
      selected_edge_note_resolution_basis: 'independently_qualifying_completed_as',
      figure_model: 'complete_degree_path',
    },
  };
}

function virginiaTechTransferPolicyEvidenceIssue(evidence) {
  const facts = evidence?.policy_facts;
  const interpretation = evidence?.paper_interpretation;
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== ARTIFACT
      || evidence?.verified !== true
      || (evidence?.issues || []).length !== 0
      || evidence?.institution?.name
        !== 'Virginia Polytechnic Institute and State University'
      || evidence?.institution?.slug
        !== 'virginia-polytechnic-institute-and-state-university'
      || evidence?.institution?.school_id !== 9230
      || evidence?.source?.requested_url !== POLICY_URL
      || evidence?.source?.final_url !== POLICY_URL
      || evidence?.source?.response_sha256 !== POLICY_RESPONSE_SHA256
      || evidence?.robots?.requested_url !== ROBOTS_URL
      || evidence?.robots?.final_url !== ROBOTS_FINAL_URL
      || evidence?.robots?.http_status !== 200
      || evidence?.robots?.response_sha256 !== ROBOTS_RESPONSE_SHA256
      || evidence?.robots?.same_host_redirect !== true
      || evidence?.robots?.policy_path_allowed !== true
      || evidence?.policy_facts_sha256 !== POLICY_FACTS_SHA256
      || sha256(JSON.stringify(facts)) !== POLICY_FACTS_SHA256) {
    return 'the exact official Virginia Tech transferable-associate policy receipt changed';
  }
  if (JSON.stringify(facts?.completed_transferable_associate?.source_systems)
        !== JSON.stringify(['VCCS', 'RBC'])
      || facts?.completed_transferable_associate
        ?.baccalaureate_oriented_sequence_required !== true
      || facts?.completed_transferable_associate?.admission_required !== true
      || facts?.completed_transferable_associate
        ?.pathways_general_education_satisfied !== true
      || facts?.completed_transferable_associate
        ?.major_specific_requirements_still_apply !== true
      || facts?.completed_transferable_associate?.exact_text !== EXPECTED.pathways_policy
      || JSON.stringify(facts?.transferable_associate_awards?.included)
        !== JSON.stringify(['AA', 'AS', 'AA&S'])
      || JSON.stringify(facts?.transferable_associate_awards?.excluded)
        !== JSON.stringify(['AAS', 'AFA'])
      || facts?.transferable_associate_awards?.exact_text !== EXPECTED.transferable_awards
      || facts?.transferable_vccs_associate_general_education
        ?.all_general_education_requirements_fulfilled !== true
      || facts?.transferable_vccs_associate_general_education
        ?.major_specific_course_requirements_still_apply !== true
      || facts?.transferable_vccs_associate_general_education?.exact_text
        !== EXPECTED.transferable_ge
      || facts?.passport_ucgs
        ?.earned_milestone_or_credential_required_for_transcript_notation !== true
      || facts?.passport_ucgs?.individual_completed_course_minimum_grade !== 'C'
      || facts?.passport_ucgs?.exact_text !== EXPECTED.transcript_notation
      || interpretation?.incoming_award !== 'AS'
      || interpretation?.completed_transferable_associate_degree !== true
      || interpretation?.pathways_general_education_satisfied !== true
      || interpretation?.major_specific_course_requirements_waived !== false
      || interpretation?.passport_or_ucgs_earned_assumed !== false
      || interpretation?.selected_edge_note_resolution_basis
        !== 'independently_qualifying_completed_as'
      || interpretation?.figure_model !== 'complete_degree_path') {
    return 'the Virginia Tech policy semantics no longer support the bounded completed-A.S. interpretation';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  EXPECTED,
  POLICY_FACTS_SHA256,
  POLICY_RESPONSE_SHA256,
  POLICY_URL,
  ROBOTS_FINAL_URL,
  ROBOTS_RESPONSE_SHA256,
  ROBOTS_URL,
  USER_AGENT,
  buildVirginiaTechTransferPolicyEvidence,
  normalize,
  parseVirginiaTechTransferPolicy,
  robotsAllowsPolicy,
  sha256,
  virginiaTechTransferPolicyEvidenceIssue,
};
