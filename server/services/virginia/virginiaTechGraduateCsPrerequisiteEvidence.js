const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'virginia_tech_graduate_cs_prerequisite_evidence';
const VIRGINIA_TECH_SLUG = 'virginia-polytechnic-institute-and-state-university';
const VIRGINIA_TECH_SCHOOL_ID = 9230;
const VIRGINIA_TECH_OWNER_NAMESPACE = 'va:uni:9230';
const VIRGINIA_TECH_GRADUATE_CS_URL =
  'https://students.cs.vt.edu/Graduate/Courses/GradCourseDescriptions.html';
const VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL = 'https://students.cs.vt.edu/robots.txt';
const VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL =
  'https://students.cs.vt.edu/content/dam/students_cs_vt_edu/robots.txt';
const VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256 =
  'e745b75628f4e0c9fc3ce53a6fd28725e50f52a5451d777c53c892ff504eab17';
const VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256 =
  '373aba6c1f3e06d978ca61387bc4cec762d5841311734ada9c679c81db0669eb';
const VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256 =
  'f814c273b86092e8a0c0c0231621860486a1dcd432f399d0775f3f0cf35dbaac';
const VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT =
  'virginia_tech_current_graduate_cs_unique_heading_to_next_heading_v1';
const VIRGINIA_TECH_GRADUATE_CS_CURRENT_SOURCE_CONTRACT =
  'virginia_tech_first_party_current_page_exact_meta_pubdate_and_capture_v1';
const VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT =
  'virginia_tech_current_graduate_cs_exact_pre_clause_v1';
const VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT =
  'virginia_tech_current_graduate_cs_complete_entry_zero_marker_with_same_page_controls_v1';
const TARGET_CODES = Object.freeze(['CS5104', 'CS5114']);

const EXPECTED = Object.freeze({
  CS5104: Object.freeze({
    heading: 'CS 5104 - Computability and Formal Languages',
    title: 'Computability and Formal Languages',
    description:
      "Formal theory of computability, the halting problem, models of computation, and Church's thesis, and formal languages. (3H,3C)",
    next_heading_code: 'CS5114',
    prerequisite: null,
  }),
  CS5114: Object.freeze({
    heading: 'CS 5114 - Theory of Algorithms',
    title: 'Theory of Algorithms',
    description:
      'Methods for constructing and analyzing algorithms. Measures of computational complexity, determination of efficient algorithms for a variety of problems such as searching, sorting and pattern matching. Geometric algorithms, mathematical algorithms, and theory of NP-completeness. (3H,3C) Pre: CS3114',
    next_heading_code: 'CS5124',
    prerequisite: 'CS3114',
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

function robotsReceipt(robotsText) {
  const source = String(robotsText || '');
  const lines = source.split(/\r?\n/).map((line) => line.replace(/#.*$/, '').trim());
  let wildcard = false;
  let allowRoot = false;
  let disallowRoot = false;
  let crawlDelay = null;
  for (const line of lines) {
    const agent = /^User-agent:\s*(.+)$/i.exec(line);
    if (agent) {
      wildcard = agent[1].trim() === '*';
      continue;
    }
    if (!wildcard) continue;
    const allow = /^Allow:\s*(.*)$/i.exec(line);
    if (allow?.[1].trim() === '/') allowRoot = true;
    const disallow = /^Disallow:\s*(.*)$/i.exec(line);
    if (disallow?.[1].trim() === '/') disallowRoot = true;
    const delay = /^Crawl-delay:\s*(\d+)$/i.exec(line);
    if (delay) crawlDelay = Number(delay[1]);
  }
  return {
    wildcard_path_allowed: allowRoot && !disallowRoot,
    wildcard_crawl_delay_seconds: crawlDelay,
  };
}

function rawHeadingBoundaries(source) {
  const headings = [];
  const regex = /<p><a id="(CS[0-9-]+)"><\/a><strong>([^<]+)<\/strong><br \/>/g;
  let match;
  while ((match = regex.exec(source))) {
    const fragment = cheerio.load(match[2], { decodeEntities: true }).text();
    headings.push({
      anchor_code: match[1],
      heading_text: normalize(fragment),
      start: match.index,
      heading_end: match.index + match[0].length,
    });
  }
  return headings.map((heading, index) => ({
    ...heading,
    end: headings[index + 1]?.start ?? source.length,
    next_heading_code: headings[index + 1]?.anchor_code || null,
  }));
}

function entryFromBoundary(source, boundary, expected) {
  const rawEntryHtml = source.slice(boundary.start, boundary.end);
  const $ = cheerio.load(rawEntryHtml, { decodeEntities: true });
  const paragraphs = $('body > p');
  if (paragraphs.length !== 1) throw new Error('target boundary is not one complete paragraph entry');
  const paragraph = paragraphs.first();
  const anchor = paragraph.find(':scope > a').first();
  const strong = paragraph.find(':scope > strong').first();
  if (anchor.attr('id') !== boundary.anchor_code || strong.length !== 1) {
    throw new Error('target heading structure changed');
  }
  const headingText = normalize(strong.text());
  const completeText = normalize(paragraph.text());
  if (!completeText.startsWith(`${headingText} `)) {
    throw new Error('target heading-to-description boundary changed');
  }
  const description = completeText.slice(headingText.length + 1);
  const rawEntryText = `${headingText}\n${description}`;
  if (headingText !== expected.heading || description !== expected.description
      || boundary.next_heading_code !== expected.next_heading_code) {
    throw new Error('target exact heading, description, or next-heading boundary changed');
  }
  return {
    rawEntryHtml,
    rawEntryText,
    headingText,
    description,
  };
}

function exactReceipt(rawEntryText, statement, raw) {
  const statementStart = rawEntryText.indexOf(statement);
  if (statementStart < 0 || rawEntryText.indexOf(statement, statementStart + 1) >= 0) {
    throw new Error('exact prerequisite statement is absent or non-unique');
  }
  const rawStart = statementStart + 'Pre: '.length;
  if (rawEntryText.slice(rawStart, rawStart + raw.length) !== raw) {
    throw new Error('exact prerequisite clause boundary changed');
  }
  return {
    receipt_contract: VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT,
    kind: 'prerequisite',
    label: 'Pre',
    raw,
    raw_sha256: sha256(raw),
    relative_start: rawStart,
    relative_end: rawStart + raw.length,
    statement_raw: statement,
    statement_sha256: sha256(statement),
    statement_relative_start: statementStart,
    statement_relative_end: statementStart + statement.length,
  };
}

function parseVirginiaTechGraduateCsPrerequisiteEvidence(pageBytes, {
  requestedUrl = VIRGINIA_TECH_GRADUATE_CS_URL,
  finalUrl = VIRGINIA_TECH_GRADUATE_CS_URL,
  contentType = 'text/html;charset=utf-8',
  status = 200,
  robotsBytes = Buffer.alloc(0),
  robotsRequestedUrl = VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
  robotsFinalUrl = VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL,
  robotsContentType = 'text/plain',
  robotsStatus = 200,
  expectedPageSha256 = VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256,
  expectedRobotsSha256 = VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256,
} = {}) {
  const bytes = Buffer.isBuffer(pageBytes) ? pageBytes : Buffer.from(String(pageBytes || ''));
  const robots = Buffer.isBuffer(robotsBytes)
    ? robotsBytes : Buffer.from(String(robotsBytes || ''));
  const source = bytes.toString('utf8');
  const robotsText = robots.toString('utf8');
  const issues = [];
  const $ = cheerio.load(source, { decodeEntities: true });

  if (requestedUrl !== VIRGINIA_TECH_GRADUATE_CS_URL
      || finalUrl !== VIRGINIA_TECH_GRADUATE_CS_URL) issues.push('page_url_identity');
  if (status !== 200) issues.push('page_http_status');
  if (!String(contentType).toLowerCase().includes('text/html')) issues.push('page_content_type');
  if (sha256(bytes) !== expectedPageSha256) issues.push('page_response_sha256');
  if (normalize($('title').text()) !== 'Course Descriptions | students.cs | Virginia Tech') {
    issues.push('document_title');
  }
  if ($('link[rel="canonical"]').attr('href') !== VIRGINIA_TECH_GRADUATE_CS_URL) {
    issues.push('canonical_url');
  }
  if ($('meta[name="generator"]').attr('content') !== 'Ensemble: https://ensemble.cms.vt.edu/'
      || $('meta[name="created"]').attr('content') !== '2026-07-01T12:54:10Z'
      || $('meta[name="pubdate"]').attr('content') !== '2026-07-01T12:54:08Z'
      || $('meta[name="last-modified"]').attr('content') !== '2026-07-01T12:54:08Z') {
    issues.push('current_first_party_page_metadata');
  }
  const pageHeadings = $('h1').filter((index, element) => (
    normalize($(element).text()) === 'Course Descriptions'
  ));
  if (pageHeadings.length !== 1) issues.push('unique_page_heading');

  const robotsPolicy = robotsReceipt(robotsText);
  if (robotsRequestedUrl !== VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL
      || robotsFinalUrl !== VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL
      || robotsStatus !== 200
      || !String(robotsContentType).toLowerCase().includes('text/plain')
      || sha256(robots) !== expectedRobotsSha256
      || robotsPolicy.wildcard_path_allowed !== true
      || robotsPolicy.wildcard_crawl_delay_seconds !== 10) issues.push('robots_receipt');

  const boundaries = rawHeadingBoundaries(source);
  if (boundaries.length !== 56) issues.push('bounded_heading_population');
  const boundedTexts = [];
  for (const boundary of boundaries) {
    const fragment = source.slice(boundary.start, boundary.end);
    const fragmentDocument = cheerio.load(fragment, { decodeEntities: true });
    const paragraph = fragmentDocument('body > p');
    boundedTexts.push(paragraph.length === 1 ? normalize(paragraph.text()) : '');
  }
  const positiveControlEntryCount = boundedTexts.filter((text) => /\bPre:\s*/.test(text)).length;
  const positiveControlMarkerCount = boundedTexts.reduce(
    (count, text) => count + (text.match(/\bPre:\s*/g) || []).length,
    0,
  );
  if (positiveControlEntryCount !== 43 || positiveControlMarkerCount !== 46) {
    issues.push('same_page_pre_marker_positive_controls');
  }

  const entries = [];
  for (const code of TARGET_CODES) {
    const matches = boundaries.filter((boundary) => boundary.anchor_code === code);
    if (matches.length !== 1) {
      issues.push(`${code}:unique_heading_boundary`);
      continue;
    }
    let bounded;
    try {
      bounded = entryFromBoundary(source, matches[0], EXPECTED[code]);
    } catch (error) {
      issues.push(`${code}:${error.message}`);
      continue;
    }
    const preMarkerCount = (bounded.rawEntryText.match(/\bPre:\s*/g) || []).length;
    const corequisiteMarkerCount = (
      bounded.rawEntryText.match(/\b(?:Co-?requisite|Corequisite)(?:s)?\s*:/gi) || []
    ).length;
    const prerequisiteMarkerLikeCount = (
      bounded.rawEntryText.match(/\b(?:Pre:|Prerequisite(?:s)?\s*:|Co-?requisite(?:s)?\s*:)/gi) || []
    ).length;
    const constraintLikeSignalCount = (
      bounded.description.match(/\b(?:required|standing|permission|consent|proficiency|experience|prerequisite|corequisite)\b/gi) || []
    ).length;
    let requiredRequisiteClause = null;
    let structuralNoneEvidence = null;
    let semanticPrerequisite = null;
    if (code === 'CS5104') {
      if (preMarkerCount !== 0 || corequisiteMarkerCount !== 0
          || prerequisiteMarkerLikeCount !== 0 || constraintLikeSignalCount !== 0) {
        issues.push('CS5104:zero_marker_complete_entry_boundary');
      }
      structuralNoneEvidence = {
        receipt_contract: VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT,
        finding:
          'zero requisite markers and zero unmodeled constraint-like signals in one exact complete heading-to-next-heading entry with same-page positive controls',
        literal_none_statement: false,
        missing_search_result_used: false,
        exact_complete_entry_present: true,
        same_page_positive_control: true,
        source_bounded_entry_count: boundaries.length,
        source_entries_with_pre_marker_count: positiveControlEntryCount,
        source_pre_marker_count: positiveControlMarkerCount,
        positive_control_course_code: 'CS5114',
        positive_control_statement: 'Pre: CS3114',
        entry_required_prerequisite_marker_count: preMarkerCount,
        entry_corequisite_marker_count: corequisiteMarkerCount,
        entry_requisite_marker_like_count: prerequisiteMarkerLikeCount,
        entry_constraint_like_signal_count: constraintLikeSignalCount,
      };
    } else {
      if (preMarkerCount !== 1 || corequisiteMarkerCount !== 0
          || prerequisiteMarkerLikeCount !== 1) {
        issues.push('CS5114:exact_pre_marker_population');
      }
      try {
        requiredRequisiteClause = exactReceipt(
          bounded.rawEntryText,
          'Pre: CS3114',
          'CS3114',
        );
      } catch (error) {
        issues.push(`CS5114:${error.message}`);
      }
      semanticPrerequisite = {
        status: 'parsed',
        formula: 'paths_or__conditions_and',
        paths: [{ all_of: [{
          type: 'course',
          code: 'CS3114',
          course_key: `${VIRGINIA_TECH_OWNER_NAMESPACE}:CS3114`,
          raw: 'CS3114',
        }] }],
      };
    }
    entries.push({
      course_code: code,
      owner_namespace: VIRGINIA_TECH_OWNER_NAMESPACE,
      heading_text: bounded.headingText,
      title: EXPECTED[code].title,
      boundary_contract: VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
      source_current_contract: VIRGINIA_TECH_GRADUATE_CS_CURRENT_SOURCE_CONTRACT,
      source_effective_pubdate: '2026-07-01T12:54:08Z',
      catalog_edition_claimed: false,
      boundary_start: matches[0].start,
      boundary_end: matches[0].end,
      next_heading_code: matches[0].next_heading_code,
      published_units: {
        kind: 'published_contact_credit_tuple',
        notation: '(3H,3C)',
        contact_hours: 3,
        credit_hours_min: 3,
        credit_hours_max: 3,
      },
      raw_entry_html_sha256: sha256(bounded.rawEntryHtml),
      raw_entry_text: bounded.rawEntryText,
      raw_entry_sha256: sha256(bounded.rawEntryText),
      formal_prerequisite_marker_count: preMarkerCount,
      formal_corequisite_marker_count: corequisiteMarkerCount,
      prerequisite_marker_like_count: prerequisiteMarkerLikeCount,
      constraint_like_signal_count: constraintLikeSignalCount,
      required_requisite_clause: requiredRequisiteClause,
      structural_none_evidence: structuralNoneEvidence,
      semantic_prerequisite: semanticPrerequisite,
    });
  }

  const facts = {
    source_temporal_binding: {
      contract: VIRGINIA_TECH_GRADUATE_CS_CURRENT_SOURCE_CONTRACT,
      page_created: $('meta[name="created"]').attr('content') || null,
      page_pubdate: $('meta[name="pubdate"]').attr('content') || null,
      page_last_modified: $('meta[name="last-modified"]').attr('content') || null,
      captured_on: '2026-08-25',
      catalog_edition_claimed: false,
    },
    boundary_contract: VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
    target_course_codes: TARGET_CODES,
    same_page_positive_controls: {
      bounded_heading_count: boundaries.length,
      entries_with_pre_marker_count: positiveControlEntryCount,
      pre_marker_count: positiveControlMarkerCount,
      exact_positive_control_course_code: 'CS5114',
      exact_positive_control_statement: 'Pre: CS3114',
    },
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
      response_bytes: bytes.length,
      response_sha256: sha256(bytes),
      document_title: normalize($('title').text()),
      canonical_url: $('link[rel="canonical"]').attr('href') || null,
      generator: $('meta[name="generator"]').attr('content') || null,
      created: $('meta[name="created"]').attr('content') || null,
      pubdate: $('meta[name="pubdate"]').attr('content') || null,
      last_modified: $('meta[name="last-modified"]').attr('content') || null,
    },
    robots: {
      requested_url: robotsRequestedUrl,
      final_url: robotsFinalUrl,
      http_status: robotsStatus,
      content_type: robotsContentType,
      response_bytes: robots.length,
      response_sha256: sha256(robots),
      ...robotsPolicy,
    },
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
  };
}

function buildVirginiaTechGraduateCsPrerequisiteEvidence(pageBytes, options = {}) {
  const parsed = parseVirginiaTechGraduateCsPrerequisiteEvidence(pageBytes, options);
  if (!parsed.verified) {
    throw new Error(`Virginia Tech graduate CS prerequisite evidence failed: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-25',
    institution: {
      name: 'Virginia Polytechnic Institute and State University',
      slug: VIRGINIA_TECH_SLUG,
      school_id: VIRGINIA_TECH_SCHOOL_ID,
      owner_namespace: VIRGINIA_TECH_OWNER_NAMESPACE,
    },
    purpose:
      'Resolve only the two missing CS5104/CS5114 prerequisite targets from their exact current first-party graduate CS heading-to-next-heading entries; BIT4614 remains missing.',
    ...parsed,
    disposition: {
      resolved_course_codes: TARGET_CODES,
      structural_none_course_codes: ['CS5104'],
      formal_course_prerequisite_codes: ['CS5114'],
      unresolved_course_codes: ['BIT4614'],
      missing_search_result_used: false,
      catalog_edition_claimed: false,
    },
  };
}

function virginiaTechGraduateCsPrerequisiteEvidenceIssue(evidence) {
  if (evidence?.schema_version !== 1
      || evidence?.artifact !== ARTIFACT
      || evidence?.verified !== true
      || evidence?.issues?.length !== 0
      || evidence?.institution?.school_id !== VIRGINIA_TECH_SCHOOL_ID
      || evidence?.institution?.owner_namespace !== VIRGINIA_TECH_OWNER_NAMESPACE
      || evidence?.source?.response_bytes !== 105535
      || evidence?.source?.response_sha256 !== VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256
      || evidence?.robots?.response_bytes !== 225
      || evidence?.robots?.response_sha256 !== VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256
      || evidence?.robots?.wildcard_path_allowed !== true
      || evidence?.robots?.wildcard_crawl_delay_seconds !== 10
      || evidence?.facts_sha256 !== VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256
      || sha256(canonicalJson(evidence?.facts)) !== VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256) {
    return 'the exact current Virginia Tech graduate CS prerequisite evidence receipt changed';
  }
  if (JSON.stringify(evidence?.disposition) !== JSON.stringify({
    resolved_course_codes: TARGET_CODES,
    structural_none_course_codes: ['CS5104'],
    formal_course_prerequisite_codes: ['CS5114'],
    unresolved_course_codes: ['BIT4614'],
    missing_search_result_used: false,
    catalog_edition_claimed: false,
  })) {
    return 'the Virginia Tech graduate CS evidence target or inference boundary changed';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  EXPECTED,
  TARGET_CODES,
  VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_CURRENT_SOURCE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_FACTS_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_RESPONSE_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
  VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_URL,
  VIRGINIA_TECH_OWNER_NAMESPACE,
  VIRGINIA_TECH_SCHOOL_ID,
  VIRGINIA_TECH_SLUG,
  buildVirginiaTechGraduateCsPrerequisiteEvidence,
  canonicalJson,
  normalize,
  parseVirginiaTechGraduateCsPrerequisiteEvidence,
  rawHeadingBoundaries,
  robotsReceipt,
  sha256,
  virginiaTechGraduateCsPrerequisiteEvidenceIssue,
};
