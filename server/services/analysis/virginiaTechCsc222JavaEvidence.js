const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const evidence = require(
  '../../.va-catalogs/research/virginia-tech-csc222-java-evidence.json'
);

const ARTIFACT = 'virginia_tech_csc222_java_evidence';
const RULE = 'exact-vt-csc222-current-java-delivery-v1';
const TERM = 'Fall 2026';
const TERM_CODE = '2264';
const CSC222_ID = 1029042724;

const NOVA_URL = 'https://courses.vccs.edu/colleges/nova/courses/CSC222';
const NEW_RIVER_SCHEDULE_URL = 'https://www.nr.edu/online/courses.php';
const NEW_RIVER_POSTING_URL = 'https://www.nr.edu/jobs/details.php?id_number=4403';
const VCCS_ROBOTS_URL = 'https://courses.vccs.edu/robots.txt';
const NEW_RIVER_ROBOTS_URL = 'https://www.nr.edu/robots.txt';

const VT_CSC222_SOURCE_URL =
  'https://www.transfervirginia.org/course/D37A6A9C1F9411F082AC0242AC15010A';
const VT_CSC222_SELECTED_NOTE =
  'If taught in a language other than Java, please see your VT advisor. Elective Elective equivalent credit hours varies based on transfer course.';

// This is an exact current source-plan/projection identity, not a broad college
// alias. The two hashes bind the currently stored and the checked-in-candidate
// NOVA requirement trees. Both trees derive from the same retained 2026-2027
// source bundle; any third shape fails closed. New River is deliberately absent:
// its current section listing and separate staffing posting do not bind Java to
// the listed section.
const ASSOCIATE_BINDINGS = Object.freeze({
  9312: Object.freeze({
    community_college_id: 9312,
    college_name: 'Northern Virginia Community College',
    projected_id: 'as_degree:9312:va-cs:local_as',
    source_requirement_id: 'va:as:northern-virginia-community-college:cs',
    catalog_year: '2026-2027',
    source_bundle_sha256:
      'bd4a83638659300e6ed507ad80673388ee9ec3b8fec7b0015cdd15d4b4e10b2f',
    accepted_projection_tree_sha256: Object.freeze([
      '5b64176f6f21c9418fae0ca9ec9de776024f833944c3229faa9f1a4153d720e0',
      'ba96d0fb5bee5097d34dfa26dfff7da5e051f1fd17e0050336397f76c5d7190f',
    ]),
  }),
});

// Filled after the retained official responses are captured.  Hard-coding the
// byte hashes is intentional: a self-consistently edited JSON artifact cannot
// bless a changed response.
const SOURCE_RESPONSE_SHA256 = Object.freeze({
  nova_schedule: '43a788cc0f325ec577c17807922c80b9e915456364c73fcbbeb0d498df56e21e',
  new_river_schedule: '73f6ccb38caf5f5d5e9a7fc3f01a65f4631cefc599ba14ebfdacedd76eac141e',
  new_river_staffing_posting:
    '0bd15e531cd108d6ab0fb6cfda4a7ce4a61ac9b01d2402790e1cede221134454',
  vccs_robots: '23ff21a5ebd4649c2a062308c0a9689bbc2727abe24ebed666cd78553bfc082d',
  new_river_robots: '7a7de63534f3c06b5bfd5a612d56585396bf8734621ed9e7c38db7532abad9fa',
});
const FACTS_SHA256 = '8a96ba4259e4acf29091730169c432997a2a29e7604fbe15ba84368ffeeb7a93';

const normalize = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requirementTreeSha256(document) {
  return sha256(canonicalJson(document?.requirement_groups ?? null));
}

function sourceReceipt(body, {
  requestedUrl,
  finalUrl = requestedUrl,
  contentType = 'text/html',
  fragmentSha256 = null,
} = {}) {
  const source = String(body || '');
  return {
    requested_url: requestedUrl,
    final_url: finalUrl,
    content_type: contentType,
    response_bytes: Buffer.byteLength(source),
    response_sha256: sha256(source),
    ...(fragmentSha256 ? { fragment_sha256: fragmentSha256 } : {}),
  };
}

function robotsAllowsPath(robotsText, pathname) {
  const lines = String(robotsText || '').split(/\r?\n/);
  let applies = false;
  const disallowed = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const userAgent = /^user-agent:\s*(.+)$/i.exec(line);
    if (userAgent) {
      applies = userAgent[1].trim() === '*';
      continue;
    }
    if (!applies) continue;
    const disallow = /^disallow:\s*(.*)$/i.exec(line);
    if (disallow && disallow[1].trim()) disallowed.push(disallow[1].trim());
  }
  return !disallowed.some((prefix) => (
    prefix.endsWith('*')
      ? pathname.startsWith(prefix.slice(0, -1))
      : pathname.startsWith(prefix)
  ));
}

function parseNovaSchedule(html, metadata = {}) {
  const source = String(html || '');
  const $ = cheerio.load(source);
  const issues = [];
  if ((metadata.requestedUrl || NOVA_URL) !== NOVA_URL
      || (metadata.finalUrl || NOVA_URL) !== NOVA_URL) issues.push('nova_source_url');
  if (!String(metadata.contentType || 'text/html').toLowerCase().includes('text/html')) {
    issues.push('nova_content_type');
  }
  if (normalize($('title').text())
      !== 'Northern Virginia Community College: Object-Oriented Programming - CSC 222') {
    issues.push('nova_title');
  }
  if (normalize($('h2').first().text())
      !== 'Object-Oriented Programming - CSC 222 at Northern Virginia Community College') {
    issues.push('nova_course_identity');
  }
  const term = $('#collapse2264').prev('.card-header').find('h4').first();
  if (normalize(term.text()).replace(/\s*➜\s*$/, '') !== TERM) issues.push('nova_term');
  const liveSchedule = $('#collapse2264').prev('.card-header').find('a[href*="TERM=2264"]');
  if (liveSchedule.length !== 1) issues.push('nova_term_code');

  const javaSections = [];
  $('#collapse2264 tr.vevent').each((index, element) => {
    const row = $(element);
    const noteRow = row.next('tr');
    const note = normalize(noteRow.find('td.classnote').text());
    if (!/^This class will be taught with Java\./.test(note)) return;
    const cells = row.children('td').map((cellIndex, cell) => normalize($(cell).text())).get();
    const section = {
      class_number: cells[0],
      section: cells[1],
      credits: Number(cells[2]),
      days: cells[3],
      time: cells[4],
      start_date: cells[5],
      location: cells[6],
      mode: cells[7],
      language: 'Java',
      note,
      fragment_sha256: sha256($.html(row) + $.html(noteRow)),
    };
    javaSections.push(section);
  });
  const expected = [
    ['83026', 'CSC 222-001L', 4, '2026-08-24'],
    ['83030', 'CSC 222-002L', 4, '2026-08-24'],
    ['84421', 'CSC 222-040L', 4, '2026-09-08'],
  ];
  const actual = javaSections.map((row) => [
    row.class_number, row.section, row.credits, row.start_date,
  ]);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) issues.push('nova_exact_java_sections');
  return {
    issues,
    receipt: sourceReceipt(source, {
      requestedUrl: metadata.requestedUrl || NOVA_URL,
      finalUrl: metadata.finalUrl || NOVA_URL,
      contentType: metadata.contentType || 'text/html',
      fragmentSha256: sha256(JSON.stringify(javaSections)),
    }),
    facts: {
      community_college_id: 9312,
      college_name: 'Northern Virginia Community College',
      evidence_scope: 'exact_current_sections',
      term: TERM,
      term_code: TERM_CODE,
      java_sections: javaSections,
    },
  };
}

function parseNewRiverSchedule(html, metadata = {}) {
  const source = String(html || '');
  const $ = cheerio.load(source);
  const issues = [];
  if ((metadata.requestedUrl || NEW_RIVER_SCHEDULE_URL) !== NEW_RIVER_SCHEDULE_URL
      || (metadata.finalUrl || NEW_RIVER_SCHEDULE_URL) !== NEW_RIVER_SCHEDULE_URL) {
    issues.push('new_river_schedule_source_url');
  }
  if (!String(metadata.contentType || 'text/html').toLowerCase().includes('text/html')) {
    issues.push('new_river_schedule_content_type');
  }
  const headings = $('h3').map((index, element) => normalize($(element).text())).get();
  if (!headings.includes('NRCC Online Courses for Fall 2026')) {
    issues.push('new_river_schedule_term');
  }
  if (!headings.includes('14 WEEK COURSES 8/24 – 12/11')) {
    issues.push('new_river_schedule_dates');
  }
  const rows = $('tr').filter((index, element) => (
    normalize($(element).children('td').first().text()) === 'CSC 222-35'
  ));
  if (rows.length !== 1) issues.push('new_river_unique_section');
  const row = rows.first();
  const cells = row.children('td').map((index, element) => normalize($(element).text())).get();
  const expected = [
    'CSC 222-35',
    'Object-Oriented Programming',
    '14 Week',
    'Does not require on-site testing',
  ];
  if (JSON.stringify(cells) !== JSON.stringify(expected)) {
    issues.push('new_river_exact_section');
  }
  const section = {
    section: cells[0] || null,
    title: cells[1] || null,
    session: cells[2] || null,
    testing: cells[3] || null,
    term: TERM,
    start_date: '2026-08-24',
    end_date: '2026-12-11',
    fragment_sha256: rows.length === 1 ? sha256($.html(row)) : null,
  };
  return {
    issues,
    receipt: sourceReceipt(source, {
      requestedUrl: metadata.requestedUrl || NEW_RIVER_SCHEDULE_URL,
      finalUrl: metadata.finalUrl || NEW_RIVER_SCHEDULE_URL,
      contentType: metadata.contentType || 'text/html',
      fragmentSha256: section.fragment_sha256,
    }),
    facts: section,
  };
}

function parseNewRiverStaffingPosting(html, metadata = {}) {
  const source = String(html || '');
  const $ = cheerio.load(source);
  const issues = [];
  if ((metadata.requestedUrl || NEW_RIVER_POSTING_URL) !== NEW_RIVER_POSTING_URL
      || (metadata.finalUrl || NEW_RIVER_POSTING_URL) !== NEW_RIVER_POSTING_URL) {
    issues.push('new_river_staffing_posting_source_url');
  }
  if (!String(metadata.contentType || 'text/html').toLowerCase().includes('text/html')) {
    issues.push('new_river_staffing_posting_content_type');
  }
  if ($('h1').filter((index, element) => (
    normalize($(element).text()) === 'Adjunct Computer Science Instructor'
  )).length !== 1) {
    issues.push('new_river_staffing_posting_title');
  }
  const dutiesHeading = $('h3').filter((index, element) => (
    normalize($(element).text()) === 'Duties:'
  ));
  const duties = normalize(dutiesHeading.next('p').text());
  const exactLanguage = 'CSC 222 - Object Oriented Programming (Java)';
  if (dutiesHeading.length !== 1 || !duties.includes(exactLanguage)) {
    issues.push('new_river_csc222_java_staffing_statement');
  }
  const statusHeading = $('h3').filter((index, element) => (
    normalize($(element).text()) === 'Current Status:'
  ));
  const currentStatus = normalize(statusHeading.next('p').text());
  if (statusHeading.length !== 1 || currentStatus !== 'Open') {
    issues.push('new_river_staffing_posting_current_status');
  }
  const deadlineHeading = $('h3').filter((index, element) => (
    normalize($(element).text()) === 'Application Deadline:'
  ));
  if (normalize(deadlineHeading.next('p').text()) !== 'Open until filled') {
    issues.push('new_river_staffing_posting_deadline');
  }
  const fragment = `${duties}\n${currentStatus}`;
  return {
    issues,
    receipt: sourceReceipt(source, {
      requestedUrl: metadata.requestedUrl || NEW_RIVER_POSTING_URL,
      finalUrl: metadata.finalUrl || NEW_RIVER_POSTING_URL,
      contentType: metadata.contentType || 'text/html',
      fragmentSha256: sha256(fragment),
    }),
    facts: {
      course_language_statement: exactLanguage,
      posting_scope: 'courses_available_to_adjunct_instructors_online_or_in_person',
      current_status: currentStatus,
      application_deadline: 'Open until filled',
    },
  };
}

function parseRobots(body, {
  requestedUrl,
  finalUrl = requestedUrl,
  contentType = 'text/plain',
  status = 200,
  protectedUrl,
} = {}) {
  const source = String(body || '');
  const allowed = status === 200
    && String(contentType).toLowerCase().includes('text/plain')
    && new URL(requestedUrl).origin === new URL(finalUrl).origin
    && robotsAllowsPath(source, new URL(protectedUrl).pathname);
  return {
    issues: allowed ? [] : ['robots_policy'],
    receipt: {
      ...sourceReceipt(source, { requestedUrl, finalUrl, contentType }),
      http_status: status,
      protected_url: protectedUrl,
      protected_path_allowed: allowed,
    },
  };
}

function buildVirginiaTechCsc222JavaEvidence(sources) {
  const nova = parseNovaSchedule(sources?.nova_schedule?.body, sources?.nova_schedule);
  const newRiverSchedule = parseNewRiverSchedule(
    sources?.new_river_schedule?.body,
    sources?.new_river_schedule,
  );
  const newRiverPosting = parseNewRiverStaffingPosting(
    sources?.new_river_staffing_posting?.body,
    sources?.new_river_staffing_posting,
  );
  const vccsRobots = parseRobots(sources?.vccs_robots?.body, {
    requestedUrl: VCCS_ROBOTS_URL,
    finalUrl: sources?.vccs_robots?.finalUrl || VCCS_ROBOTS_URL,
    contentType: sources?.vccs_robots?.contentType || 'text/plain',
    status: sources?.vccs_robots?.status ?? 200,
    protectedUrl: NOVA_URL,
  });
  const newRiverRobots = parseRobots(sources?.new_river_robots?.body, {
    requestedUrl: NEW_RIVER_ROBOTS_URL,
    finalUrl: sources?.new_river_robots?.finalUrl || NEW_RIVER_ROBOTS_URL,
    contentType: sources?.new_river_robots?.contentType || 'text/plain',
    status: sources?.new_river_robots?.status ?? 200,
    protectedUrl: NEW_RIVER_SCHEDULE_URL,
  });
  if (newRiverRobots.issues.length === 0
      && !robotsAllowsPath(
        sources?.new_river_robots?.body,
        new URL(NEW_RIVER_POSTING_URL).pathname,
      )) newRiverRobots.issues.push('robots_policy_job_path');

  const issues = [
    ...nova.issues,
    ...newRiverSchedule.issues,
    ...newRiverPosting.issues,
    ...vccsRobots.issues.map((issue) => `vccs_${issue}`),
    ...newRiverRobots.issues.map((issue) => `new_river_${issue}`),
  ];
  if (issues.length) {
    throw new Error(`Virginia Tech CSC 222 Java evidence did not verify: ${issues.join(', ')}`);
  }
  const facts = {
    catalog_window: TERM,
    receiver_condition: 'java_or_advisor_review',
    colleges: {
      9311: {
        community_college_id: 9311,
        college_name: 'New River Community College',
        evidence_scope: 'non_resolving_current_context',
        resolution_status: 'fail_closed',
        qualification_gap:
          'The Fall 2026 schedule identifies CSC 222-35, while the separate open adjunct posting lists CSC 222 (Java); neither source binds Java to section CSC 222-35.',
        term: TERM,
        term_code: TERM_CODE,
        scheduled_sections: [newRiverSchedule.facts],
        separate_staffing_posting: newRiverPosting.facts,
      },
      9312: nova.facts,
    },
  };
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    verified: true,
    issues: [],
    purpose:
      'Bound Virginia Tech CSC 222 Java/advisor resolution only to exact current section-language evidence; retained New River context remains non-resolving because its two sources are not section-language bound.',
    sources: {
      nova_schedule: nova.receipt,
      new_river_schedule: newRiverSchedule.receipt,
      new_river_staffing_posting: newRiverPosting.receipt,
      vccs_robots: vccsRobots.receipt,
      new_river_robots: newRiverRobots.receipt,
    },
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
    paper_interpretation: {
      figures: ['3', '4'],
      method: 'optimistic_best_case_exact_current_section_language',
      resolved_community_college_ids: [9312],
      non_resolving_context_community_college_ids: [9311],
      statewide_language_inferred: false,
      unlisted_colleges_resolved: false,
      figure_6_resolved: false,
    },
  };
}

function virginiaTechCsc222JavaEvidenceIssue(candidate = evidence) {
  if (candidate?.schema_version !== 1
      || candidate?.artifact !== ARTIFACT
      || candidate?.verified !== true
      || (candidate?.issues || []).length !== 0
      || candidate?.generated_on !== '2026-08-24'
      || candidate?.facts_sha256 !== FACTS_SHA256
      || sha256(canonicalJson(candidate?.facts)) !== FACTS_SHA256) {
    return 'the exact CSC 222 Java evidence receipt changed';
  }
  for (const [name, expectedHash] of Object.entries(SOURCE_RESPONSE_SHA256)) {
    const receipt = candidate?.sources?.[name];
    if (!receipt
        || receipt.response_sha256 !== expectedHash
        || !Number.isInteger(receipt.response_bytes)
        || receipt.response_bytes <= 0) {
      return `the exact CSC 222 Java ${name} source receipt changed`;
    }
  }
  const interpretation = candidate?.paper_interpretation;
  if (JSON.stringify(interpretation) !== JSON.stringify({
    figures: ['3', '4'],
    method: 'optimistic_best_case_exact_current_section_language',
    resolved_community_college_ids: [9312],
    non_resolving_context_community_college_ids: [9311],
    statewide_language_inferred: false,
    unlisted_colleges_resolved: false,
    figure_6_resolved: false,
  })) return 'the bounded CSC 222 Java interpretation changed';
  const facts = candidate?.facts;
  if (facts?.catalog_window !== TERM
      || facts?.receiver_condition !== 'java_or_advisor_review'
      || JSON.stringify(Object.keys(facts?.colleges || {}).sort())
        !== JSON.stringify(['9311', '9312'])
      || facts.colleges[9311]?.evidence_scope !== 'non_resolving_current_context'
      || facts.colleges[9311]?.resolution_status !== 'fail_closed'
      || facts.colleges[9311]?.scheduled_sections?.[0]?.section !== 'CSC 222-35'
      || Object.hasOwn(facts.colleges[9311]?.scheduled_sections?.[0] || {}, 'language')
      || facts.colleges[9311]?.separate_staffing_posting?.current_status !== 'Open'
      || facts.colleges[9312]?.java_sections?.length !== 3
      || facts.colleges[9312]?.java_sections?.some((row) => row.language !== 'Java')) {
    return 'the exact CSC 222 Java facts changed';
  }
  return null;
}

function associateBindingIssue(document, binding) {
  if (!document || !binding
      || Number(document.community_college_id) !== binding.community_college_id
      || String(document._id || '') !== binding.projected_id
      || String(document.va_requirement_id || '') !== binding.source_requirement_id
      || String(document.catalog_year || '') !== binding.catalog_year
      || String(document.provenance?.source_bundle_hash || '')
        !== binding.source_bundle_sha256) {
    return 'the exact associate source identity or source bundle changed';
  }
  const treeSha256 = requirementTreeSha256(document);
  if (!binding.accepted_projection_tree_sha256.includes(treeSha256)) {
    return 'the exact associate projected requirement tree changed';
  }
  return null;
}

function resolveVirginiaTechCsc222JavaEvidence({
  agreement,
  row,
  associateDocument,
  figureModel,
  evidenceOverride = evidence,
} = {}) {
  const sendingCode = String(row?.sending_code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (sendingCode !== 'CSC222'
      || String(row?.source_receiving_identifier || '') !== 'CS1114'
      || String(row?.source_receiving_name || '') !== 'Intro to Software Design'
      || String(row?.source_receiving_notes || '') !== VT_CSC222_SELECTED_NOTE
      || String(row?.sending_source_url || '') !== VT_CSC222_SOURCE_URL
      || Number(row?.sending_course_id) !== CSC222_ID
      || String(row?.sending_course_key || '') !== 'va:CSC222') {
    return { applicable: false, ready: false };
  }
  const communityCollegeId = Number(agreement?.community_college_id);
  const artifactIssue = virginiaTechCsc222JavaEvidenceIssue(evidenceOverride);
  if (artifactIssue) return { applicable: true, ready: false, reason: artifactIssue };
  const route = evidenceOverride?.facts?.colleges?.[communityCollegeId];
  const explicitlyResolved = evidenceOverride.paper_interpretation
    .resolved_community_college_ids.includes(communityCollegeId);
  if (!explicitlyResolved
      || route?.evidence_scope !== 'exact_current_sections'
      || !Array.isArray(route?.java_sections)
      || route.java_sections.length === 0
      || route.java_sections.some((section) => section?.language !== 'Java')) {
    return {
      applicable: true,
      ready: false,
      reason: 'no exact current official section-language binding is retained for this college',
    };
  }
  const binding = ASSOCIATE_BINDINGS[communityCollegeId];
  if (!binding) {
    return {
      applicable: true,
      ready: false,
      reason: 'no exact current official CSC 222 Java delivery is retained for this college',
    };
  }
  if (figureModel !== 'complete_degree_path') {
    return {
      applicable: true,
      ready: false,
      reason: 'the exact CSC 222 Java witness is scoped only to the Figure 3/4 complete-degree best-case model',
    };
  }
  if (String(agreement?._id || '') !== `va:agreement:9230:${communityCollegeId}`) {
    return { applicable: true, ready: false, reason: 'the exact Virginia Tech pair identity changed' };
  }
  const bindingIssue = associateBindingIssue(associateDocument, binding);
  if (bindingIssue) return { applicable: true, ready: false, reason: bindingIssue };
  return {
    applicable: true,
    ready: true,
    proof: {
      rule: RULE,
      community_college_id: communityCollegeId,
      college_name: binding.college_name,
      associate_source_requirement_id: binding.source_requirement_id,
      associate_source_bundle_sha256: binding.source_bundle_sha256,
      associate_projection_tree_sha256: requirementTreeSha256(associateDocument),
      evidence_facts_sha256: FACTS_SHA256,
      source_response_sha256: [SOURCE_RESPONSE_SHA256.nova_schedule],
      evidence_scope: route.evidence_scope,
      term: route.term,
      term_code: route.term_code,
      qualifying_sections: route.java_sections.map((section) => ({
        section: section.section,
        ...(section.class_number ? { class_number: section.class_number } : {}),
        start_date: section.start_date,
        language: section.language,
        fragment_sha256: section.fragment_sha256,
      })),
      statewide_language_inferred: false,
    },
  };
}

module.exports = {
  ARTIFACT,
  ASSOCIATE_BINDINGS,
  CSC222_ID,
  FACTS_SHA256,
  NEW_RIVER_POSTING_URL,
  NEW_RIVER_ROBOTS_URL,
  NEW_RIVER_SCHEDULE_URL,
  NOVA_URL,
  RULE,
  SOURCE_RESPONSE_SHA256,
  TERM,
  TERM_CODE,
  VCCS_ROBOTS_URL,
  VT_CSC222_SELECTED_NOTE,
  VT_CSC222_SOURCE_URL,
  buildVirginiaTechCsc222JavaEvidence,
  canonicalJson,
  parseNewRiverStaffingPosting,
  parseNewRiverSchedule,
  parseNovaSchedule,
  requirementTreeSha256,
  resolveVirginiaTechCsc222JavaEvidence,
  virginiaTechCsc222JavaEvidenceIssue,
};
