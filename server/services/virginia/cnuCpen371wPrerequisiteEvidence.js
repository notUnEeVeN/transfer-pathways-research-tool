const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'cnu_cpen371w_prerequisite_identity_evidence';
const CNU_SLUG = 'christopher-newport-university';
const CNU_OWNER_NAMESPACE = 'va:uni:9206';
const CNU_CATALOG_YEAR = '2026-2027';
const CNU_CATALOG_URL =
  'https://cnu.edu/public/_documents/undergrad-catalog/2026-27-undergraduate_catalog.pdf';
const CNU_PROGRAM_URL = 'https://cnu.edu/academics/programs/computer-science.html';
const CNU_ROBOTS_URL = 'https://cnu.edu/robots.txt';
const CNU_CATALOG_RESPONSE_SHA256 =
  '1a5a03803b744f9ace8e9d927d00cee2809f4feaa73268c64c372cd60eea6575';
const CNU_PROGRAM_RESPONSE_SHA256 =
  '6d0fbb01dd45864c841f0a7b2b7212cd606457d1b33ded079ac784ec6bd24c8a';
const CNU_ROBOTS_RESPONSE_SHA256 =
  '34bf572890be69f4c49533093ca40d36d51c37a7b62eb80bb7ea56dd4d7f2a79';
const CNU_CATALOG_RAW_TEXT_SHA256 =
  '52772bdbeecbd8992a714321e4bc36f8d6331612519c4f806da139aa51a71599';
const CNU_PROGRAM_PAGE_RAW_TEXT_SHA256 =
  '4e4ce3f36cf16751a06b074d73422396f31acdcb5628c504599e238d94b3ff40';
const CNU_COURSE_PAGE_RAW_TEXT_SHA256 =
  '4a4445f0732149aaec8c2eb16755dd6c2f4293fc9acb89e72d3bd9eb236c3d53';
const CNU_PDFINFO_SHA256 =
  'cfb818dd8ed18ec87a3d71e800cc45d63c29d4450de7305fbc2e5e06057e7834';
const CNU_CPEN371W_FACTS_SHA256 =
  '653614c38340a26306157189a7ac8720a44d8db5efa3c5754e8f34205b6e195c';
const CNU_ALIAS_RECEIPT_CONTRACT =
  'cnu_current_degree_code_title_plus_catalog_wi_entry_identity_v1';
const CNU_COURSE_BOUNDARY_CONTRACT =
  'cnu_2026_2027_pdf_raw_physical_page_unique_exact_heading_to_next_heading_v1';
const CNU_CLAUSE_RECEIPT_CONTRACT =
  'cnu_2026_2027_exact_prerequisites_statement_in_bounded_entry_v1';

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

function parsePdfInfo(text) {
  const result = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (key) result[key] = line.slice(separator + 1).trim();
  }
  return result;
}

function robotsAllows(robotsText, url) {
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
    const match = /^(Allow|Disallow):\s*(.*)$/i.exec(line);
    if (match && match[2].trim()) {
      rules.push({ kind: match[1].toLowerCase(), path: match[2].trim() });
    }
  }
  const matched = rules.filter((rule) => pathname.startsWith(rule.path))
    .sort((left, right) => right.path.length - left.path.length);
  return !matched.length || matched[0].kind === 'allow';
}

function exactLineCount(text, expected) {
  return String(text || '').split(/\r?\n/).filter((line) => line === expected).length;
}

function boundedCourseEntry(pageText) {
  const lines = String(pageText || '').split(/\r?\n/);
  const heading = 'CPEN 371. WI: Computer Ethics (2-2-0)';
  const indexes = lines.map((line, index) => line === heading ? index : -1).filter((index) => index >= 0);
  if (indexes.length !== 1) return { verified: false, issues: ['unique_cpen371_heading'] };
  const start = indexes[0];
  const next = lines.findIndex((line, index) => (
    index > start && /^[A-Z]{2,8}\s+\d{2,4}[A-Z]?\.\s+\S/.test(line)
  ));
  if (next < 0) return { verified: false, issues: ['next_course_heading_boundary'] };
  if (!lines[next].startsWith('CPEN 414.')) {
    return { verified: false, issues: ['expected_next_course_heading'] };
  }
  const rawEntryText = normalize(lines.slice(start, next).join(' '));
  const statement = 'Prerequisites: ENGL 223 with a C- or higher; major or minor in PCSE.';
  const statementStart = rawEntryText.indexOf(statement);
  if (statementStart < 0 || rawEntryText.indexOf(statement, statementStart + 1) >= 0) {
    return { verified: false, issues: ['exact_prerequisite_statement'] };
  }
  const label = 'Prerequisites';
  const raw = 'ENGL 223 with a C- or higher; major or minor in PCSE';
  const rawStart = statementStart + `${label}: `.length;
  return {
    verified: true,
    issues: [],
    entry: {
      resolved_course_code: 'CPEN371W',
      catalog_entry_course_code: 'CPEN371',
      owner_namespace: CNU_OWNER_NAMESPACE,
      boundary_contract: CNU_COURSE_BOUNDARY_CONTRACT,
      physical_pdf_page: 275,
      heading_text: heading,
      catalog_entry_title: 'WI: Computer Ethics',
      identity_title: 'Computer Ethics',
      published_units: {
        kind: 'credit_lecture_lab_tuple',
        notation: '(2-2-0)',
        credit_hours_min: 2,
        credit_hours_max: 2,
        lecture_hours: 2,
        laboratory_hours: 0,
      },
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      required_requisite_clause: {
        receipt_contract: CNU_CLAUSE_RECEIPT_CONTRACT,
        kind: 'prerequisite',
        label,
        raw,
        raw_sha256: sha256(raw),
        relative_start: rawStart,
        relative_end: rawStart + raw.length,
        statement_relative_start: statementStart,
        statement_relative_end: statementStart + statement.length,
      },
      semantic_prerequisite: {
        status: 'parsed',
        formula: 'paths_or__conditions_and',
        paths: [{
          all_of: [
            {
              type: 'course',
              code: 'ENGL223',
              course_key: `${CNU_OWNER_NAMESPACE}:ENGL223`,
              minimum_grade: 'C-',
              raw: 'ENGL 223 with a C- or higher',
            },
            {
              type: 'non_course',
              condition: 'pcse_major_or_minor',
              academic_program: 'PCSE',
              eligible_academic_program_roles: ['major', 'minor'],
              raw: 'major or minor in PCSE',
            },
          ],
        }],
      },
    },
  };
}

function programRequirementReceipt(programHtml) {
  const source = String(programHtml || '');
  const $ = cheerio.load(source);
  const issues = [];
  if (normalize($('title').text()) !== 'Computer Science | Christopher Newport University') {
    issues.push('program_document_title');
  }
  const published = $('meta[property="article:published_time"]').attr('content') || null;
  if (published !== '2026-07-27T11:37:43-0400') issues.push('program_published_time');
  const ogUrl = $('meta[property="og:url"]').attr('content') || null;
  if (ogUrl !== 'https://cnu.edu/academics/programs/computer-science') {
    issues.push('program_og_url');
  }
  const buttons = $('.accordion-header button').filter((index, element) => (
    normalize($(element).text()) === 'Computer Science'
  ));
  if (buttons.length !== 1) issues.push('unique_computer_science_requirement_panel');
  const panelId = buttons.first().attr('aria-controls');
  const panel = panelId ? $(`#${panelId}`) : null;
  if (!panel || panel.length !== 1) issues.push('computer_science_requirement_panel_boundary');
  const exact = panel ? panel.find('li').filter((index, element) => (
    normalize($(element).clone().children('ul').remove().end().text())
      === 'CPEN 371W - Computer Ethics'
  )) : [];
  if (exact.length !== 1) issues.push('unique_cpen371w_code_title_requirement');
  const degreeStatement =
    'Students majoring in Computer Science who complete all requirements earn the degree of BS, Computer Foundations.';
  const degreeStatements = panel ? panel.find('p').filter((index, element) => (
    normalize($(element).text()) === degreeStatement
  )) : [];
  if (degreeStatements.length !== 1) issues.push('exact_computer_science_degree_statement');
  return {
    verified: issues.length === 0,
    issues,
    receipt: issues.length ? null : {
      program: 'Computer Science',
      degree: 'BS, Computer Foundations',
      exact_degree_statement: degreeStatement,
      target_course_code: 'CPEN371W',
      target_display_code: 'CPEN 371W',
      target_title: 'Computer Ethics',
      exact_requirement_text: 'CPEN 371W - Computer Ethics',
      exact_requirement_html_sha256: sha256($.html(exact.first())),
      program_panel_html_sha256: sha256($.html(panel)),
      published_time: published,
      og_url: ogUrl,
    },
  };
}

function parseCnuCpen371wPrerequisiteEvidence({
  catalogBytes,
  programHtml,
  robotsText,
  pdfInfoText,
  catalogRawText,
  programPageRawText,
  coursePageRawText,
  catalogRequestedUrl = CNU_CATALOG_URL,
  catalogFinalUrl = CNU_CATALOG_URL,
  catalogContentType = 'application/pdf',
  catalogStatus = 200,
  programRequestedUrl = CNU_PROGRAM_URL,
  programFinalUrl = CNU_PROGRAM_URL,
  programContentType = 'text/html; charset=UTF-8',
  programStatus = 200,
  robotsRequestedUrl = CNU_ROBOTS_URL,
  robotsFinalUrl = CNU_ROBOTS_URL,
  robotsContentType = 'text/plain; charset=UTF-8',
  robotsStatus = 200,
  expectedCatalogSha256 = CNU_CATALOG_RESPONSE_SHA256,
  expectedProgramSha256 = CNU_PROGRAM_RESPONSE_SHA256,
  expectedRobotsSha256 = CNU_ROBOTS_RESPONSE_SHA256,
  expectedCatalogRawTextSha256 = CNU_CATALOG_RAW_TEXT_SHA256,
  expectedProgramPageRawTextSha256 = CNU_PROGRAM_PAGE_RAW_TEXT_SHA256,
  expectedCoursePageRawTextSha256 = CNU_COURSE_PAGE_RAW_TEXT_SHA256,
  expectedPdfInfoSha256 = CNU_PDFINFO_SHA256,
} = {}) {
  const pdf = Buffer.from(catalogBytes || Buffer.alloc(0));
  const programSource = String(programHtml || '');
  const robotsSource = String(robotsText || '');
  const fullText = String(catalogRawText || '');
  const programPage = String(programPageRawText || '');
  const coursePage = String(coursePageRawText || '');
  const infoText = String(pdfInfoText || '');
  const issues = [];

  if (catalogRequestedUrl !== CNU_CATALOG_URL || catalogFinalUrl !== CNU_CATALOG_URL) {
    issues.push('catalog_url_identity');
  }
  if (programRequestedUrl !== CNU_PROGRAM_URL || programFinalUrl !== CNU_PROGRAM_URL) {
    issues.push('program_url_identity');
  }
  if (robotsRequestedUrl !== CNU_ROBOTS_URL || robotsFinalUrl !== CNU_ROBOTS_URL) {
    issues.push('robots_url_identity');
  }
  if (catalogStatus !== 200 || programStatus !== 200 || robotsStatus !== 200) {
    issues.push('http_status');
  }
  if (!String(catalogContentType).toLowerCase().includes('application/pdf')) {
    issues.push('catalog_content_type');
  }
  if (!String(programContentType).toLowerCase().includes('text/html')) {
    issues.push('program_content_type');
  }
  if (!String(robotsContentType).toLowerCase().includes('text/plain')) {
    issues.push('robots_content_type');
  }
  if (sha256(pdf) !== expectedCatalogSha256) issues.push('catalog_response_sha256');
  if (sha256(programSource) !== expectedProgramSha256) issues.push('program_response_sha256');
  if (sha256(robotsSource) !== expectedRobotsSha256) issues.push('robots_response_sha256');
  if (sha256(fullText) !== expectedCatalogRawTextSha256) issues.push('catalog_raw_text_sha256');
  if (sha256(programPage) !== expectedProgramPageRawTextSha256) {
    issues.push('program_page_raw_text_sha256');
  }
  if (sha256(coursePage) !== expectedCoursePageRawTextSha256) {
    issues.push('course_page_raw_text_sha256');
  }
  if (sha256(infoText) !== expectedPdfInfoSha256) issues.push('pdfinfo_sha256');
  if (!robotsAllows(robotsSource, CNU_CATALOG_URL)
      || !robotsAllows(robotsSource, CNU_PROGRAM_URL)) issues.push('robots_policy');

  const info = parsePdfInfo(infoText);
  if (info.title !== 'CNU 2026-2027 Undergraduate Catalog'
      || Number(info.pages) !== 321
      || info.page_size !== '602.503 x 787.5 pts'
      || info.file_size !== '12618538 bytes'
      || info.encrypted !== 'no') issues.push('catalog_pdf_identity');

  const programResult = programRequirementReceipt(programSource);
  issues.push(...programResult.issues);
  const majorStart = programPage.indexOf('Major in Computer Science');
  const majorEnd = programPage.indexOf('Major in Cybersecurity', majorStart + 1);
  if (majorStart < 0 || majorEnd < 0 || majorEnd <= majorStart) {
    issues.push('catalog_computer_science_major_boundary');
  }
  const majorText = majorStart >= 0 && majorEnd > majorStart
    ? programPage.slice(majorStart, majorEnd) : '';
  if (exactLineCount(majorText, '1. CPEN 214, 371W;') !== 1) {
    issues.push('catalog_exact_degree_requirement');
  }

  const courseResult = boundedCourseEntry(coursePage);
  issues.push(...courseResult.issues);
  const exactCatalogEntryCount = (fullText.match(/^CPEN 371\. WI: Computer Ethics \(2-2-0\)$/gm) || []).length;
  const competingTargetHeadingCount = (fullText.match(/^CPEN 371W\./gm) || []).length;
  const targetReferenceCount = (fullText.match(/\bCPEN 371W\b/g) || []).length;
  if (exactCatalogEntryCount !== 1) issues.push('unique_catalog_cpen371_entry');
  if (competingTargetHeadingCount !== 0) issues.push('competing_cpen371w_catalog_entry');
  if (targetReferenceCount !== 5) issues.push('catalog_cpen371w_reference_population');
  const crossReference = 'Pre or Corequisites: CPEN 371W, computer engineering major, senior standing.';
  if (!normalize(coursePage).includes(crossReference)) issues.push('same_catalog_cpen371w_cross_reference');

  const programReceipt = programResult.receipt;
  const entry = courseResult.entry;
  const identityResolved = Boolean(programReceipt && entry
    && programReceipt.target_course_code === 'CPEN371W'
    && entry.catalog_entry_course_code === 'CPEN371'
    && programReceipt.target_course_code === `${entry.catalog_entry_course_code}W`
    && entry.catalog_entry_title.startsWith('WI: ')
    && entry.identity_title === programReceipt.target_title
    && exactCatalogEntryCount === 1
    && competingTargetHeadingCount === 0);
  if (!identityResolved) issues.push('joint_current_source_identity_proof');

  const facts = {
    catalog_year: CNU_CATALOG_YEAR,
    target_course_code: 'CPEN371W',
    program_requirement: programReceipt,
    catalog_degree_requirement: {
      major: 'Computer Science',
      exact_requirement_text: '1. CPEN 214, 371W;',
      physical_pdf_page: 272,
      page_raw_text_sha256: sha256(programPage),
    },
    catalog_course_entry: entry,
    identity_resolution: {
      receipt_contract: CNU_ALIAS_RECEIPT_CONTRACT,
      resolved: identityResolved,
      scope: 'CPEN371W_only',
      broad_suffix_alias_rule_created: false,
      target_is_catalog_entry_code_plus_w: true,
      catalog_entry_writing_intensive_marker: 'WI',
      exact_title_match_after_wi_marker: true,
      exact_catalog_entry_count: exactCatalogEntryCount,
      competing_target_heading_count: competingTargetHeadingCount,
      same_catalog_target_reference_count: targetReferenceCount,
      same_catalog_cross_reference: crossReference,
    },
  };
  return {
    verified: issues.length === 0,
    issues,
    catalog_source: {
      requested_url: catalogRequestedUrl,
      final_url: catalogFinalUrl,
      http_status: catalogStatus,
      content_type: catalogContentType,
      response_bytes: pdf.length,
      response_sha256: sha256(pdf),
      pdf_info: info,
      pdf_info_sha256: sha256(infoText),
      raw_text_projection_sha256: sha256(fullText),
      program_physical_pdf_page: 272,
      course_physical_pdf_page: 275,
    },
    program_source: {
      requested_url: programRequestedUrl,
      final_url: programFinalUrl,
      http_status: programStatus,
      content_type: programContentType,
      response_bytes: Buffer.byteLength(programSource),
      response_sha256: sha256(programSource),
    },
    robots: {
      requested_url: robotsRequestedUrl,
      final_url: robotsFinalUrl,
      http_status: robotsStatus,
      content_type: robotsContentType,
      response_bytes: Buffer.byteLength(robotsSource),
      response_sha256: sha256(robotsSource),
      catalog_path_allowed: robotsAllows(robotsSource, CNU_CATALOG_URL),
      program_path_allowed: robotsAllows(robotsSource, CNU_PROGRAM_URL),
    },
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
  };
}

function buildCnuCpen371wPrerequisiteEvidence(sources) {
  const parsed = parseCnuCpen371wPrerequisiteEvidence(sources);
  if (!parsed.verified) {
    throw new Error(`CNU CPEN 371W evidence failed: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: {
      name: 'Christopher Newport University',
      slug: CNU_SLUG,
      school_id: 9206,
      owner_namespace: CNU_OWNER_NAMESPACE,
    },
    purpose:
      'Resolve only CPEN 371W by joining the current exact Computer Science degree code/title to the current unique CPEN 371 WI course entry, then retain that entry prerequisite without creating a broad suffix alias rule.',
    ...parsed,
    disposition: {
      resolved_course_codes: ['CPEN371W'],
      unresolved_course_codes: [],
      identity_scope: 'exact_single_target',
      verified_major_core_changed: false,
    },
  };
}

function cnuCpen371wPrerequisiteEvidenceIssue(evidence) {
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== ARTIFACT
      || evidence?.verified !== true
      || evidence?.issues?.length !== 0
      || evidence?.institution?.owner_namespace !== CNU_OWNER_NAMESPACE
      || evidence?.catalog_source?.response_sha256 !== CNU_CATALOG_RESPONSE_SHA256
      || evidence?.program_source?.response_sha256 !== CNU_PROGRAM_RESPONSE_SHA256
      || evidence?.robots?.response_sha256 !== CNU_ROBOTS_RESPONSE_SHA256
      || evidence?.catalog_source?.raw_text_projection_sha256 !== CNU_CATALOG_RAW_TEXT_SHA256
      || evidence?.facts_sha256 !== CNU_CPEN371W_FACTS_SHA256
      || sha256(canonicalJson(evidence?.facts)) !== CNU_CPEN371W_FACTS_SHA256) {
    return 'the exact current CNU CPEN 371W identity/prerequisite receipt changed';
  }
  if (evidence?.facts?.identity_resolution?.resolved !== true
      || evidence?.facts?.identity_resolution?.scope !== 'CPEN371W_only'
      || evidence?.facts?.identity_resolution?.broad_suffix_alias_rule_created !== false
      || JSON.stringify(evidence?.disposition?.resolved_course_codes)
        !== JSON.stringify(['CPEN371W'])
      || evidence?.disposition?.verified_major_core_changed !== false) {
    return 'the CNU evidence no longer supports the exact bounded CPEN 371W resolution';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  CNU_ALIAS_RECEIPT_CONTRACT,
  CNU_CATALOG_RAW_TEXT_SHA256,
  CNU_CATALOG_RESPONSE_SHA256,
  CNU_CATALOG_URL,
  CNU_CATALOG_YEAR,
  CNU_CLAUSE_RECEIPT_CONTRACT,
  CNU_COURSE_BOUNDARY_CONTRACT,
  CNU_COURSE_PAGE_RAW_TEXT_SHA256,
  CNU_CPEN371W_FACTS_SHA256,
  CNU_OWNER_NAMESPACE,
  CNU_PDFINFO_SHA256,
  CNU_PROGRAM_PAGE_RAW_TEXT_SHA256,
  CNU_PROGRAM_RESPONSE_SHA256,
  CNU_PROGRAM_URL,
  CNU_ROBOTS_RESPONSE_SHA256,
  CNU_ROBOTS_URL,
  CNU_SLUG,
  boundedCourseEntry,
  buildCnuCpen371wPrerequisiteEvidence,
  canonicalJson,
  cnuCpen371wPrerequisiteEvidenceIssue,
  exactLineCount,
  normalize,
  parseCnuCpen371wPrerequisiteEvidence,
  parsePdfInfo,
  programRequirementReceipt,
  robotsAllows,
  sha256,
};
