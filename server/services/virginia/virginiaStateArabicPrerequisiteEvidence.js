const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'virginia_state_arabic_prerequisite_evidence';
const VSU_SLUG = 'virginia-state-university';
const VSU_OWNER_NAMESPACE = 'va:uni:9231';
const VSU_CATALOG_YEAR = '2026-2027';
const VSU_DEPARTMENT_URL =
  'https://catalog.vsu.edu/undergraduate/college-humanities-social-sciences/department-languages-literature/';
const VSU_ROBOTS_URL = 'https://catalog.vsu.edu/robots.txt';
const VSU_DEPARTMENT_RESPONSE_SHA256 =
  'f935d7746101b1fd4bdff0aac5518da394b3381ade71b2790e9bd8dd8a17ce4e';
const VSU_ROBOTS_RESPONSE_SHA256 =
  '8ba3a5e25335b7e343ff1331a044873101011acdafde82726af28c9a9a02b365';
const VSU_ARABIC_FACTS_SHA256 =
  'ac2eb81ada0407d06481d3b77941dd766077ac38d2fc95e9e5a4342d5930ecea';
const VSU_ARABIC_BOUNDARY_CONTRACT =
  'vsu_2026_2027_languages_department_unique_arabic_section_courseblock_v1';
const VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT =
  'vsu_exact_complete_description_formal_prerequisite_suffix_v1';
const VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT =
  'vsu_exact_complete_description_admission_credit_restriction_v1';

const EXPECTED = Object.freeze({
  ARAB110: Object.freeze({
    title: 'Elementary Arabic I',
    units: 3,
    description:
      'Pronunciation, explanations, and drill in basic structures, easy readings, dictations and daily oral practice; open to those students presenting no admission credit in Arabic. .',
    prerequisite: null,
    restriction: 'open to those students presenting no admission credit in Arabic',
  }),
  ARAB111: Object.freeze({
    title: 'Elementary Arabic II',
    units: 3,
    description:
      'Supplementary course to Arabic 110; continued pronunciation, explanations, and drill in basic structures, dictations and oral practice. Prerequisite: ARAB 110 or its equivalent.',
    prerequisite: 'ARAB 110 or its equivalent',
    prerequisite_code: 'ARAB110',
  }),
  ARAB212: Object.freeze({
    title: 'Intermediate Arabic I',
    units: 3,
    description:
      'Review of grammar, reading of moderately difficult prose, practice in oral Arabic, and work in written composition. Prerequisite: ARAB 111 or its equivalent.',
    prerequisite: 'ARAB 111 or its equivalent',
    prerequisite_code: 'ARAB111',
  }),
  ARAB213: Object.freeze({
    title: 'Intermediate Arabic II',
    units: 3,
    description:
      'Review of grammar, continued practiced in pronunciation and conversation, and reading of moderately difficult prose. Prerequisite: ARAB 212 or its equivalent.',
    prerequisite: 'ARAB 212 or its equivalent',
    prerequisite_code: 'ARAB212',
  }),
});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function robotsAllows(robotsText, url = VSU_DEPARTMENT_URL) {
  const pathname = new URL(url).pathname;
  let applies = false;
  const rules = [];
  for (const rawLine of String(robotsText || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const agent = /^User-agent:\s*(.+)$/i.exec(line);
    if (agent) {
      applies = agent[1].trim() === '*';
      continue;
    }
    if (!applies) continue;
    const rule = /^(Allow|Disallow):\s*(.*)$/i.exec(line);
    if (rule && rule[2].trim()) {
      rules.push({ kind: rule[1].toLowerCase(), path: rule[2].trim() });
    }
  }
  const matched = rules.filter((rule) => pathname.startsWith(rule.path))
    .sort((left, right) => right.path.length - left.path.length);
  return !matched.length || matched[0].kind === 'allow';
}

function exactSubstringReceipt(source, raw, contract) {
  const start = source.indexOf(raw);
  if (start < 0 || source.indexOf(raw, start + raw.length) >= 0) return null;
  return {
    receipt_contract: contract,
    raw,
    raw_sha256: sha256(raw),
    relative_start: start,
    relative_end: start + raw.length,
  };
}

function prerequisiteFormula(courseCode, raw) {
  return {
    status: 'parsed',
    formula: 'paths_or__conditions_and',
    paths: [
      {
        all_of: [{
          type: 'course',
          code: courseCode,
          course_key: `${VSU_OWNER_NAMESPACE}:${courseCode}`,
          raw: raw.slice(0, raw.toLowerCase().lastIndexOf(' or ')),
        }],
      },
      {
        all_of: [{
          type: 'non_course',
          condition: `equivalent_to_${courseCode.toLowerCase()}`,
          equivalent_to_course_code: courseCode,
          raw: 'its equivalent',
        }],
      },
    ],
  };
}

function admissionRestrictionFormula(raw) {
  return {
    status: 'parsed_non_course_enrollment_restriction',
    formula: 'paths_or__conditions_and',
    paths: [{
      all_of: [{
        type: 'non_course',
        condition: 'no_admission_credit_in_arabic',
        admission_credit_subject: 'Arabic',
        admission_credit_allowed: false,
        raw,
      }],
    }],
  };
}

function parseVirginiaStateArabicPrerequisiteEvidence(html, {
  requestedUrl = VSU_DEPARTMENT_URL,
  finalUrl = VSU_DEPARTMENT_URL,
  contentType = 'text/html; charset=UTF-8',
  status = 200,
  robotsText = '',
  robotsRequestedUrl = VSU_ROBOTS_URL,
  robotsFinalUrl = VSU_ROBOTS_URL,
  robotsContentType = 'text/plain; charset=UTF-8',
  robotsStatus = 200,
  expectedDepartmentSha256 = VSU_DEPARTMENT_RESPONSE_SHA256,
  expectedRobotsSha256 = VSU_ROBOTS_RESPONSE_SHA256,
} = {}) {
  const source = String(html || '');
  const robotsSource = String(robotsText || '');
  const issues = [];
  const $ = cheerio.load(source);

  if (requestedUrl !== VSU_DEPARTMENT_URL || finalUrl !== VSU_DEPARTMENT_URL) {
    issues.push('department_url_identity');
  }
  if (status !== 200) issues.push('department_http_status');
  if (!String(contentType).toLowerCase().includes('text/html')) issues.push('department_content_type');
  if (sha256(source) !== expectedDepartmentSha256) issues.push('department_response_sha256');
  if (normalize($('title').text())
      !== 'Department of Languages and Literature | Virginia State University Catalog') {
    issues.push('document_title');
  }
  const catalogLabels = $('.site-title a').map((index, element) => normalize($(element).text())).get();
  if (JSON.stringify(catalogLabels) !== JSON.stringify(['2026-2027 Academic Catalog Homepage'])) {
    issues.push('catalog_edition_label');
  }

  if (robotsRequestedUrl !== VSU_ROBOTS_URL || robotsFinalUrl !== VSU_ROBOTS_URL
      || robotsStatus !== 200
      || !String(robotsContentType).toLowerCase().includes('text/plain')
      || sha256(robotsSource) !== expectedRobotsSha256
      || !robotsAllows(robotsSource)) {
    issues.push('robots_receipt');
  }

  const arabicHeadings = $('h2').filter((index, element) => (
    normalize($(element).text()) === 'Arabic (ARAB)'
  ));
  if (arabicHeadings.length !== 1) issues.push('unique_arabic_section_heading');
  const section = arabicHeadings.first().next('.sc_sccoursedescs');
  if (section.length !== 1) issues.push('arabic_section_boundary');
  const blocks = section.find(':scope > .courseblock');
  if (blocks.length !== 4) issues.push('arabic_section_complete_courseblock_count');

  const entries = [];
  for (const [courseCode, expected] of Object.entries(EXPECTED)) {
    const spacedCode = courseCode.replace(/^(ARAB)(\d+)$/, '$1 $2');
    const matches = blocks.filter((index, element) => {
      const heading = normalize($(element).find(':scope > .courseblocktitle').text());
      return heading.startsWith(`${spacedCode}.`);
    });
    if (matches.length !== 1) {
      issues.push(`${courseCode}:unique_exact_courseblock`);
      continue;
    }
    const block = matches.first();
    const titleElements = block.find(':scope > .courseblocktitle');
    const descriptions = block.find(':scope > .courseblockdesc');
    if (titleElements.length !== 1 || descriptions.length !== 1) {
      issues.push(`${courseCode}:complete_entry_fields`);
      continue;
    }
    const headingText = normalize(titleElements.text());
    const description = normalize(descriptions.text());
    const expectedHeading = `${spacedCode}. ${expected.title}. (${expected.units} Credits)`;
    if (headingText !== expectedHeading) issues.push(`${courseCode}:exact_heading`);
    if (description !== expected.description) issues.push(`${courseCode}:exact_description`);
    const rawEntryText = `${headingText}\n${description}`;
    const htmlFragment = $.html(block);
    const prerequisiteMarkerCount = (description.match(/\bPrerequisite:\s*/g) || []).length;
    let requiredRequisiteClause = null;
    let enrollmentRestriction = null;
    let semanticPrerequisite = null;
    if (expected.prerequisite) {
      if (prerequisiteMarkerCount !== 1
          || !description.endsWith(`Prerequisite: ${expected.prerequisite}.`)) {
        issues.push(`${courseCode}:formal_prerequisite_suffix`);
      }
      requiredRequisiteClause = exactSubstringReceipt(
        rawEntryText,
        expected.prerequisite,
        VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
      );
      if (!requiredRequisiteClause) issues.push(`${courseCode}:prerequisite_projection`);
      else {
        const markerStart = rawEntryText.indexOf('Prerequisite:', rawEntryText.indexOf('\n'));
        requiredRequisiteClause = {
          ...requiredRequisiteClause,
          kind: 'prerequisite',
          label: 'Prerequisite',
          statement_relative_start: markerStart,
          statement_relative_end: requiredRequisiteClause.relative_end + 1,
        };
      }
      semanticPrerequisite = prerequisiteFormula(expected.prerequisite_code, expected.prerequisite);
    } else {
      if (prerequisiteMarkerCount !== 0) issues.push(`${courseCode}:unexpected_prerequisite_marker`);
      enrollmentRestriction = exactSubstringReceipt(
        rawEntryText,
        expected.restriction,
        VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT,
      );
      if (!enrollmentRestriction) issues.push(`${courseCode}:admission_restriction_projection`);
      else enrollmentRestriction = {
        ...enrollmentRestriction,
        kind: 'enrollment_restriction',
        restriction_type: 'prior_admission_credit',
        subject: 'Arabic',
        admission_credit_allowed: false,
      };
      semanticPrerequisite = admissionRestrictionFormula(expected.restriction);
    }
    entries.push({
      course_code: courseCode,
      owner_namespace: VSU_OWNER_NAMESPACE,
      heading_text: headingText,
      title: expected.title,
      published_units: {
        kind: 'published_fixed_credits',
        notation: `${expected.units} Credits`,
        credit_hours_min: expected.units,
        credit_hours_max: expected.units,
      },
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(htmlFragment),
      formal_prerequisite_marker_count: prerequisiteMarkerCount,
      required_requisite_clause: requiredRequisiteClause,
      enrollment_restriction: enrollmentRestriction,
      catalog_silence_inferred_as_no_prerequisite: false,
      semantic_prerequisite: semanticPrerequisite,
    });
  }

  const facts = {
    catalog_year: VSU_CATALOG_YEAR,
    boundary_contract: VSU_ARABIC_BOUNDARY_CONTRACT,
    target_course_codes: Object.keys(EXPECTED),
    entries,
  };
  return {
    verified: issues.length === 0,
    issues,
    source: {
      requested_url: requestedUrl,
      final_url: finalUrl,
      http_status: status,
      content_type: contentType,
      response_bytes: Buffer.byteLength(source),
      response_sha256: sha256(source),
      document_title: normalize($('title').text()),
      catalog_label: catalogLabels[0] || null,
      arabic_section_courseblock_count: blocks.length,
      arabic_section_html_sha256: section.length === 1 ? sha256($.html(section)) : null,
    },
    robots: {
      requested_url: robotsRequestedUrl,
      final_url: robotsFinalUrl,
      http_status: robotsStatus,
      content_type: robotsContentType,
      response_bytes: Buffer.byteLength(robotsSource),
      response_sha256: sha256(robotsSource),
      department_path_allowed: robotsAllows(robotsSource),
    },
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
  };
}

function buildVirginiaStateArabicPrerequisiteEvidence(html, options = {}) {
  const parsed = parseVirginiaStateArabicPrerequisiteEvidence(html, options);
  if (!parsed.verified) {
    throw new Error(`Virginia State Arabic prerequisite evidence failed: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: {
      name: 'Virginia State University',
      slug: VSU_SLUG,
      school_id: 9231,
      owner_namespace: VSU_OWNER_NAMESPACE,
    },
    purpose:
      'Resolve the four direct-missing Arabic prerequisite targets from the complete current Languages and Literature catalog page without treating an omitted marker as no prerequisite.',
    ...parsed,
    disposition: {
      resolved_course_codes: Object.keys(EXPECTED),
      unresolved_course_codes: [],
      formal_course_prerequisite_codes: ['ARAB111', 'ARAB212', 'ARAB213'],
      preserved_non_course_restriction_codes: ['ARAB110'],
      equivalent_alternatives_preserved: true,
    },
  };
}

function virginiaStateArabicPrerequisiteEvidenceIssue(evidence) {
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== ARTIFACT
      || evidence?.verified !== true
      || evidence?.issues?.length !== 0
      || evidence?.institution?.owner_namespace !== VSU_OWNER_NAMESPACE
      || evidence?.source?.response_sha256 !== VSU_DEPARTMENT_RESPONSE_SHA256
      || evidence?.robots?.response_sha256 !== VSU_ROBOTS_RESPONSE_SHA256
      || evidence?.robots?.department_path_allowed !== true
      || evidence?.facts_sha256 !== VSU_ARABIC_FACTS_SHA256
      || sha256(canonicalJson(evidence?.facts)) !== VSU_ARABIC_FACTS_SHA256) {
    return 'the exact current VSU Arabic prerequisite evidence receipt changed';
  }
  if (JSON.stringify(evidence?.disposition?.resolved_course_codes)
      !== JSON.stringify(Object.keys(EXPECTED))
      || evidence?.disposition?.unresolved_course_codes?.length !== 0
      || evidence?.disposition?.equivalent_alternatives_preserved !== true) {
    return 'the VSU Arabic evidence no longer resolves exactly the four bounded targets';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  EXPECTED,
  VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT,
  VSU_ARABIC_BOUNDARY_CONTRACT,
  VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
  VSU_ARABIC_FACTS_SHA256,
  VSU_CATALOG_YEAR,
  VSU_DEPARTMENT_RESPONSE_SHA256,
  VSU_DEPARTMENT_URL,
  VSU_OWNER_NAMESPACE,
  VSU_ROBOTS_RESPONSE_SHA256,
  VSU_ROBOTS_URL,
  VSU_SLUG,
  admissionRestrictionFormula,
  buildVirginiaStateArabicPrerequisiteEvidence,
  canonicalJson,
  exactSubstringReceipt,
  normalize,
  parseVirginiaStateArabicPrerequisiteEvidence,
  prerequisiteFormula,
  robotsAllows,
  sha256,
  virginiaStateArabicPrerequisiteEvidenceIssue,
};
