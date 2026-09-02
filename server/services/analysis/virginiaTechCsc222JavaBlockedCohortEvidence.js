const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const evidence = require(
  '../../.va-catalogs/research/virginia-tech-csc222-java-blocked-cohort-evidence.json'
);

const ARTIFACT = 'virginia_tech_csc222_java_blocked_cohort_evidence';
const SCHEMA_VERSION = 1;
const GENERATED_ON = '2026-08-25';
const CSC222_ID = 1029042724;
const RECEIVING_PARENT_ID = 997045076;
const VIRGINIA_TECH_ID = 9230;
const VT_CSC222_SOURCE_URL =
  'https://www.transfervirginia.org/course/D37A6A9C1F9411F082AC0242AC15010A';
const VT_CSC222_SELECTED_NOTE =
  'If taught in a language other than Java, please see your VT advisor. Elective Elective equivalent credit hours varies based on transfer course.';
const VCCS_ROBOTS_URL = 'https://courses.vccs.edu/robots.txt';
const GERMANNA_ROBOTS_URL = 'https://germanna.edu/robots.txt';
const GERMANNA_RESOURCES_URL =
  'https://germanna.edu/academic-center-excellence/ist-course-resources';
const LAUREL_RIDGE_ROBOTS_URL = 'https://laurelridge.edu/robots.txt';
const LAUREL_RIDGE_ARTICLE_URL =
  'https://laurelridge.edu/2022/12/22/grant-allows-teachers-to-further-education-with-computer-science-certification/';
const REYNOLDS_ROBOTS_URL = 'https://www.reynolds.edu/robots.txt';
const REYNOLDS_OUTLINE_URL =
  'https://www.reynolds.edu/curriculum/Outlines/CSC/CSC222.pdf';

const BLOCKED_COHORT = Object.freeze([
  [9301, 'Blue Ridge Community College', 'brcc', 'blue-ridge'],
  [9302, 'Brightpoint Community College', 'brightpoint', 'brightpoint'],
  [9303, 'Central Virginia Community College', 'cvcc', 'central-virginia'],
  [9306, 'Germanna Community College', 'germanna', 'germanna'],
  [9307, 'Reynolds Community College', 'reynolds', 'reynolds',
    'J Sargeant Reynolds Community College'],
  [9308, 'Laurel Ridge Community College', 'laurelridge', 'laurel-ridge'],
  [9311, 'New River Community College', 'nrcc', 'new-river'],
  [9314, 'Camp Community College', 'camp', 'camp', 'Paul D. Camp Community College'],
  [9315, 'Piedmont Virginia Community College', 'pvcc', 'piedmont-virginia'],
  [9319, 'Southwest Virginia Community College', 'swcc', 'southwest-virginia'],
  [9320, 'Tidewater Community College', 'tcc', 'tidewater'],
  [9321, 'Virginia Highlands Community College', 'vhcc', 'virginia-highlands'],
  [9322, 'Virginia Peninsula Community College', 'vpcc', 'virginia-peninsula'],
  [9323, 'Virginia Western Community College', 'vwcc', 'virginia-western'],
  [9324, 'Wytheville Community College', 'wcc', 'wytheville'],
].map(([
  communityCollegeId,
  collegeName,
  vccsSlug,
  fileSlug,
  sourcePlanCollegeName = collegeName,
]) => Object.freeze({
  community_college_id: communityCollegeId,
  college_name: collegeName,
  source_plan_college_name: sourcePlanCollegeName,
  agreement_id: `va:agreement:9230:${communityCollegeId}`,
  vccs_slug: vccsSlug,
  file_slug: fileSlug,
  source_key: `schedule_${communityCollegeId}`,
  schedule_url: `https://courses.vccs.edu/colleges/${vccsSlug}/courses/CSC222`,
})));

const BLOCKED_IDS = Object.freeze(BLOCKED_COHORT.map((row) => row.community_college_id));
const BLOCKED_BY_ID = new Map(BLOCKED_COHORT.map((row) => [row.community_college_id, row]));

// Filled after capture. These constants deliberately live outside the artifact:
// editing the JSON and its retained sources together cannot bless changed bytes.
const SOURCE_RESPONSE_SHA256 = Object.freeze({
  vccs_robots: '23ff21a5ebd4649c2a062308c0a9689bbc2727abe24ebed666cd78553bfc082d',
  schedule_9301: 'e14a2ae88011b45b8bfb7a7a0786606f4b614c6c103fe1a7aec54978d98844e3',
  schedule_9302: '5becad267bff8d46dd2a1111002a2d29a26c5d6d3ef4620359aae30f6b3b2cc5',
  schedule_9303: 'dbc547b26866d4e828f69edc4ea876652b082a7fef32bfcdfcab9481ee6c828b',
  schedule_9306: '907512460c0005adb2f995f410a0e8190d03feac52f5b5f98a5b659df49263f1',
  schedule_9307: '18deb02b45d290ed5ac31e05b2e304174c252c3aaac3819b746b23049ea8dda5',
  schedule_9308: '0b8144c922e06f733108aaf77f5e537f85c2710a172e747ae7734f4f4f1b267d',
  schedule_9311: 'b295031eae072ad2a6ce7b32dfca83b461ebde1b0cdf86232bfccfd6510c8956',
  schedule_9314: 'a5eb36eb3ceec55ca7ac60d4a391e2c4f849936cc3b437c2c63ca91ba06087f0',
  schedule_9315: '647fd7d9decb4e2a595b73e125f55638ee05d8267a560bc87a4cca63ca63e938',
  schedule_9319: '5ed963309a64f97c42c8a74173b2bc44b565ff613a26f7152af9225b89de9bc4',
  schedule_9320: '61fee84e951e517a9260d6cdf2114ecb1558306296ee6ad34227f5ed0a1172b7',
  schedule_9321: '0c109d3c129873dec5c9d8d7b4a6a9625bee90d0a9e581348136829f7ea2698d',
  schedule_9322: 'ad7e56917a77841c77b632e70cfd61df15079736e461c26f65d76790a9b16e56',
  schedule_9323: 'd374974d5bbed43193024c1e2f5bc5a5adc0d1c39199f09e10e40600dc07298e',
  schedule_9324: 'ec2a81aa7f99c114dc5561f0bece2b673a7beadfc3b98bcbaf0a139c992b20d5',
  germanna_robots: '773fb8d35bb9a39d35335ee6db8dc5c912d2aacbfb823152d9c61cd647dd902d',
  germanna_resources: '1f06ec9ea5742f45b76334e0e5bf919402d91187386fc07a3407fb3a9803ff82',
  laurel_ridge_robots: '6dcfa5dab4f5b46d13495b38e69f3b1d70773cf8e8415d275d61ed14c117d7cf',
  laurel_ridge_article: 'e2402118ebcbfe88effca162fe3f77c4e71a66ddb707f94cf3b86a44438758f5',
  reynolds_robots: 'a86782edf5a9821764d412c6b180d213fce5579bc848c60ec1448aa34f8b3708',
  reynolds_outline: '58c00502e23b9d83c98ee2da35557d4c5146f8ebd044109137b7195a57232b16',
  reynolds_outline_text: '1a34fe0fe303b17b3555ad4376b6d296d6369af4409e76b9a1a54eedde3dcab4',
});
const FACTS_SHA256 = '0c2b864420dd33cfab3b436e42a446d9d3ef74a505c6b6f09e17e7141777015f';

const normalize = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const sha256 = (value) => createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : String(value ?? ''))
  .digest('hex');

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sourceReceipt(body, {
  requestedUrl,
  finalUrl = requestedUrl,
  contentType,
  status = 200,
  fragmentSha256 = null,
} = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''));
  return {
    requested_url: requestedUrl,
    final_url: finalUrl,
    content_type: contentType,
    http_status: status,
    response_bytes: bytes.length,
    response_sha256: sha256(bytes),
    ...(fragmentSha256 ? { fragment_sha256: fragmentSha256 } : {}),
  };
}

function wildcardRuleMatches(pathname, rawPattern) {
  const pattern = String(rawPattern || '').replace(/\$$/, '');
  if (!pattern) return false;
  const escaped = pattern.split('*').map((part) => (
    part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )).join('.*');
  return new RegExp(`^${escaped}`).test(pathname);
}

function robotsPolicy(body, {
  requestedUrl,
  finalUrl = requestedUrl,
  contentType = 'text/plain',
  status = 200,
  protectedUrl,
} = {}) {
  const source = String(body ?? '');
  const receipt = sourceReceipt(source, {
    requestedUrl,
    finalUrl,
    contentType,
    status,
  });
  const protectedPath = new URL(protectedUrl).pathname;
  const sameOrigin = new URL(requestedUrl).origin === new URL(finalUrl).origin
    && new URL(requestedUrl).origin === new URL(protectedUrl).origin;
  if (!sameOrigin) {
    return {
      issues: ['robots_origin'],
      receipt: {
        ...receipt,
        protected_url: protectedUrl,
        policy_published: false,
        protected_path_allowed: false,
      },
      crawl_delay_seconds: 0,
    };
  }
  const absent = status === 404
    || (!String(contentType).toLowerCase().includes('text/plain')
      && /404 Error: Page Not Found/i.test(source));
  if (absent) {
    return {
      issues: [],
      receipt: {
        ...receipt,
        protected_url: protectedUrl,
        policy_published: false,
        protected_path_allowed: true,
      },
      crawl_delay_seconds: 0,
    };
  }
  const lines = source.split(/\r?\n/);
  let applies = false;
  let crawlDelaySeconds = 0;
  const rules = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const userAgent = /^user-agent:\s*(.+)$/i.exec(line);
    if (userAgent) {
      applies = userAgent[1].trim() === '*';
      continue;
    }
    if (!applies) continue;
    const rule = /^(allow|disallow):\s*(.*)$/i.exec(line);
    if (rule && rule[2].trim()) {
      rules.push({ allow: rule[1].toLowerCase() === 'allow', pattern: rule[2].trim() });
      continue;
    }
    const delay = /^crawl-delay:\s*([0-9.]+)$/i.exec(line);
    if (delay) crawlDelaySeconds = Number(delay[1]);
  }
  const matches = rules.filter((rule) => wildcardRuleMatches(protectedPath, rule.pattern));
  matches.sort((left, right) => right.pattern.length - left.pattern.length
    || Number(right.allow) - Number(left.allow));
  const allowed = matches.length === 0 || matches[0].allow;
  return {
    issues: allowed ? [] : ['robots_policy'],
    receipt: {
      ...receipt,
      protected_url: protectedUrl,
      policy_published: true,
      protected_path_allowed: allowed,
      crawl_delay_seconds: crawlDelaySeconds,
    },
    crawl_delay_seconds: crawlDelaySeconds,
  };
}

function explicitJavaStatement(text) {
  const value = normalize(text);
  return /\b(?:this\s+)?(?:class|course|section)\b.{0,60}\b(?:is|will be)\s+(?:taught|conducted|delivered)\s+(?:in|with|using)\s+java\b/i
    .test(value)
    || /\b(?:this\s+)?(?:class|course|section)\b.{0,60}\b(?:uses|will use)\s+java\b/i
      .test(value)
    || /\bprogramming language\s*:\s*java\b/i.test(value);
}

function parseVccsSchedulePage(entry, html, metadata = {}) {
  const source = String(html ?? '');
  const $ = cheerio.load(source);
  const issues = [];
  if ((metadata.requestedUrl || entry.schedule_url) !== entry.schedule_url
      || (metadata.finalUrl || entry.schedule_url) !== entry.schedule_url) {
    issues.push('source_url');
  }
  if ((metadata.status ?? 200) !== 200) issues.push('http_status');
  if (!String(metadata.contentType || 'text/html').toLowerCase().includes('text/html')) {
    issues.push('content_type');
  }
  const title = normalize($('title').text());
  const heading = normalize($('h2').first().text());
  const expectedTitle = `${entry.college_name}: Object-Oriented Programming - CSC 222`;
  const expectedHeading = `Object-Oriented Programming - CSC 222 at ${entry.college_name}`;
  const courseEndpointAvailable = title === expectedTitle && heading === expectedHeading;
  if (!courseEndpointAvailable) {
    const exactGermannaUnavailable = entry.community_college_id === 9306
      && title === "Virginia's Community Colleges:"
      && heading === 'Courses'
      && $('tr.vevent').length === 0;
    if (!exactGermannaUnavailable) issues.push('course_identity');
  }

  const terms = [];
  $('div.collapse[id^="collapse"]').each((index, element) => {
    const panel = $(element);
    const termCode = String(panel.attr('id') || '').replace(/^collapse/, '');
    const term = normalize(panel.prev('.card-header').find('h4').first().text())
      .replace(/\s*➜\s*$/, '');
    if (!term || !/^\d{4}$/.test(termCode)) return;
    const sections = [];
    panel.find('tr.vevent').each((rowIndex, rowElement) => {
      const row = $(rowElement);
      const noteRow = row.next('tr');
      const cells = row.children('td').map((cellIndex, cell) => normalize($(cell).text())).get();
      const note = normalize(noteRow.find('td.classnote').text());
      sections.push({
        class_number: cells[0] || null,
        section: cells[1] || null,
        credits: Number(cells[2]),
        days: cells[3] || null,
        time: cells[4] || null,
        start_date: cells[5] || null,
        location: cells[6] || null,
        mode: cells[7] || null,
        note,
        explicit_java_statement: explicitJavaStatement(note),
        java_mentioned: /\bjava\b/i.test(note),
        fragment_sha256: sha256($.html(row) + $.html(noteRow)),
      });
    });
    terms.push({ term, term_code: termCode, sections });
  });
  const sections = terms.flatMap((term) => term.sections);
  const explicitJavaSections = sections.filter((section) => section.explicit_java_statement);
  const unboundSections = sections.filter((section) => !section.explicit_java_statement);
  const fragment = {
    title,
    heading,
    terms,
  };
  return {
    issues,
    receipt: sourceReceipt(source, {
      requestedUrl: metadata.requestedUrl || entry.schedule_url,
      finalUrl: metadata.finalUrl || entry.schedule_url,
      contentType: metadata.contentType || 'text/html',
      status: metadata.status ?? 200,
      fragmentSha256: sha256(canonicalJson(fragment)),
    }),
    facts: {
      community_college_id: entry.community_college_id,
      college_name: entry.college_name,
      course_endpoint_available: courseEndpointAvailable,
      current_schedule_terms: terms,
      scheduled_section_count: sections.length,
      explicitly_java_bound_section_count: explicitJavaSections.length,
      unbound_section_count: unboundSections.length,
      has_exact_current_java_section_binding: explicitJavaSections.length > 0,
      all_scheduled_sections_explicitly_java:
        sections.length > 0 && explicitJavaSections.length === sections.length,
      resolution_status: 'fail_closed',
      qualification_gap: sections.length === 0
        ? 'No current CSC 222 section-language binding is published at this endpoint.'
        : 'No current CSC 222 row at this college explicitly binds a listed section to Java.',
    },
  };
}

function parseGermannaResources(html, metadata = {}) {
  const source = String(html ?? '');
  const $ = cheerio.load(source);
  const issues = [];
  if ((metadata.requestedUrl || GERMANNA_RESOURCES_URL) !== GERMANNA_RESOURCES_URL
      || (metadata.finalUrl || GERMANNA_RESOURCES_URL) !== GERMANNA_RESOURCES_URL) {
    issues.push('source_url');
  }
  if ((metadata.status ?? 200) !== 200) issues.push('http_status');
  const section = $('.base-accordion__item').filter((index, element) => (
    normalize($(element).find('.base-accordion__header').first().text())
      === 'CSC 222: Object-Oriented Programming'
  ));
  if (section.length !== 1) issues.push('unique_csc222_resource_section');
  const content = section.find('.base-accordion__content').first();
  const handoutHeading = content.find('h3').filter((index, element) => (
    normalize($(element).text()) === 'Handouts'
  )).first();
  const handouts = handoutHeading.next('ul').find('a').map((index, element) => ({
    label: normalize($(element).text()),
    url: new URL($(element).attr('href'), GERMANNA_RESOURCES_URL).href,
  })).get();
  const javaHandouts = handouts.filter((row) => /\bjava\b/i.test(row.label));
  const expected = [
    'Java: Input and Output',
    'Java: File Handling',
    'Java: Variables and Data Types',
    'Object-Oriented Programming with Java',
  ];
  if (JSON.stringify(javaHandouts.map((row) => row.label)) !== JSON.stringify(expected)) {
    issues.push('exact_java_resource_set');
  }
  const sectionText = normalize(content.text());
  const universalBindingStatement = /\b(?:all|every)\b.{0,50}\bCSC\s*222\b.{0,80}\bjava\b/i
    .test(sectionText)
    || /\bCSC\s*222\b.{0,80}\b(?:is|will be) taught (?:in|with) java\b/i.test(sectionText);
  return {
    issues,
    receipt: sourceReceipt(source, {
      requestedUrl: metadata.requestedUrl || GERMANNA_RESOURCES_URL,
      finalUrl: metadata.finalUrl || GERMANNA_RESOURCES_URL,
      contentType: metadata.contentType || 'text/html',
      status: metadata.status ?? 200,
      fragmentSha256: sha256(canonicalJson({ handouts, section_text: sectionText })),
    }),
    facts: {
      community_college_id: 9306,
      evidence_scope: 'current_course_support_resources_not_delivery_policy',
      java_specific_handouts: javaHandouts,
      universal_current_csc222_java_binding: universalBindingStatement,
      resolution_status: 'fail_closed',
      qualification_gap:
        'Java-specific tutoring resources are grouped under CSC 222, but the page does not state that every current CSC 222 delivery uses Java.',
    },
  };
}

function parseLaurelRidgeArticle(html, metadata = {}) {
  const source = String(html ?? '');
  const $ = cheerio.load(source);
  const issues = [];
  if ((metadata.requestedUrl || LAUREL_RIDGE_ARTICLE_URL) !== LAUREL_RIDGE_ARTICLE_URL
      || (metadata.finalUrl || LAUREL_RIDGE_ARTICLE_URL) !== LAUREL_RIDGE_ARTICLE_URL) {
    issues.push('source_url');
  }
  if ((metadata.status ?? 200) !== 200) issues.push('http_status');
  const published = $('meta[property="article:published_time"]').attr('content') || '';
  const paragraphs = $('.entry-content p, article p, main p').map((index, element) => (
    normalize($(element).text())
  )).get();
  const statement = paragraphs.find((text) => (
    /CSC222\s*[–-]\s*Object-Oriented Programming \(Java\)/i.test(text)
  )) || '';
  if (!statement) issues.push('csc222_java_statement');
  if (!published.startsWith('2022-12-23T')) issues.push('published_date');
  return {
    issues,
    receipt: sourceReceipt(source, {
      requestedUrl: metadata.requestedUrl || LAUREL_RIDGE_ARTICLE_URL,
      finalUrl: metadata.finalUrl || LAUREL_RIDGE_ARTICLE_URL,
      contentType: metadata.contentType || 'text/html',
      status: metadata.status ?? 200,
      fragmentSha256: sha256(`${published}\n${statement}`),
    }),
    facts: {
      community_college_id: 9308,
      evidence_scope: 'historical_grant_cohort_certificate_description',
      published_at: published,
      csc222_java_statement: statement,
      universal_current_csc222_java_binding: false,
      resolution_status: 'fail_closed',
      qualification_gap:
        'A December 2022 grant-cohort article names CSC222 (Java), but it does not bind the current Fall 2026 section or establish a current universal delivery policy.',
    },
  };
}

function parseReynoldsOutline(pdfBytes, extractedText, metadata = {}) {
  const bytes = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes || '');
  const text = normalize(extractedText);
  const issues = [];
  if ((metadata.requestedUrl || REYNOLDS_OUTLINE_URL) !== REYNOLDS_OUTLINE_URL
      || (metadata.finalUrl || REYNOLDS_OUTLINE_URL) !== REYNOLDS_OUTLINE_URL) {
    issues.push('source_url');
  }
  if ((metadata.status ?? 200) !== 200) issues.push('http_status');
  if (!String(metadata.contentType || 'application/pdf').toLowerCase().includes('application/pdf')) {
    issues.push('content_type');
  }
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) issues.push('pdf_signature');
  const policyMatch = /JAVA is the preferred language for this course, institutions may offer using a different language to align with primary 4-?year partner requirements\./.exec(text);
  const exactPolicy = policyMatch?.[0] || '';
  if (!exactPolicy) issues.push('preferred_not_required_policy');
  if (!text.includes('Effective Date/Updated: January 1, 2022')) issues.push('effective_date');
  if (metadata.extractedFromSha256 !== sha256(bytes)) issues.push('extraction_source_hash');
  return {
    issues,
    receipt: sourceReceipt(bytes, {
      requestedUrl: metadata.requestedUrl || REYNOLDS_OUTLINE_URL,
      finalUrl: metadata.finalUrl || REYNOLDS_OUTLINE_URL,
      contentType: metadata.contentType || 'application/pdf',
      status: metadata.status ?? 200,
      fragmentSha256: sha256(exactPolicy),
    }),
    extracted_text_receipt: {
      response_bytes: Buffer.byteLength(String(extractedText ?? '')),
      response_sha256: sha256(String(extractedText ?? '')),
      derived_from_response_sha256: sha256(bytes),
      derivation: 'pdftotext - -',
    },
    facts: {
      community_college_id: 9307,
      evidence_scope: 'course_outline_permits_language_variation',
      effective_date: '2022-01-01',
      language_policy: exactPolicy,
      universal_current_csc222_java_binding: false,
      resolution_status: 'fail_closed',
      qualification_gap:
        'The official outline calls Java preferred and expressly permits another language; the current section has no language note.',
    },
  };
}

function exactBlockedCondition(cell, condition) {
  const entry = BLOCKED_BY_ID.get(Number(cell?.community_college_id));
  return Boolean(entry)
    && Number(cell?.school_id) === VIRGINIA_TECH_ID
    && String(cell?.college_name || '') === entry.source_plan_college_name
    && String(cell?.agreement_ids?.[0] || '') === entry.agreement_id
    && Number(cell?.agreement_ids?.length) === 1
    && String(condition?.agreement_id || '') === entry.agreement_id
    && Number(condition?.sending_course_id) === CSC222_ID
    && String(condition?.sending_code || '') === 'CSC222'
    && String(condition?.receiving_identifier || '') === 'CS1114'
    && Number(condition?.receiving_parent_id) === RECEIVING_PARENT_ID
    && String(condition?.condition_kind || '') === 'advisor_or_approval_condition'
    && String(condition?.receiving_notes || '') === VT_CSC222_SELECTED_NOTE
    && String(condition?.sending_source_url || '') === VT_CSC222_SOURCE_URL;
}

function auditExactBlockedCohort(conditionAudit) {
  const matching = [];
  const malformed = [];
  for (const cell of conditionAudit?.blocked_cells || []) {
    const candidates = (cell?.blocking_conditions || []).filter((condition) => (
      Number(condition?.sending_course_id) === CSC222_ID
      || String(condition?.sending_code || '') === 'CSC222'
      || String(condition?.receiving_identifier || '') === 'CS1114'
    ));
    for (const condition of candidates) {
      if (exactBlockedCondition(cell, condition)) matching.push(Number(cell.community_college_id));
      else if (Number(cell?.school_id) === VIRGINIA_TECH_ID) {
        malformed.push(Number(cell?.community_college_id));
      }
    }
  }
  const ids = [...new Set(matching)].sort((a, b) => a - b);
  const issues = [];
  if (malformed.length) issues.push('near_match_condition_identity');
  if (matching.length !== ids.length) issues.push('duplicate_condition');
  if (JSON.stringify(ids) !== JSON.stringify(BLOCKED_IDS)) issues.push('blocked_cohort');
  return {
    ready: issues.length === 0,
    issues,
    exact_blocked_cell_count: ids.length,
    exact_blocked_community_college_ids: ids,
    cohort_sha256: sha256(canonicalJson(ids.map((id) => ({
      community_college_id: id,
      agreement_id: BLOCKED_BY_ID.get(id)?.agreement_id,
    })))),
  };
}

function buildVirginiaTechCsc222JavaBlockedCohortEvidence(sources) {
  const vccsRobots = robotsPolicy(sources?.vccs_robots?.body, {
    requestedUrl: VCCS_ROBOTS_URL,
    finalUrl: sources?.vccs_robots?.finalUrl || VCCS_ROBOTS_URL,
    contentType: sources?.vccs_robots?.contentType || 'text/plain',
    status: sources?.vccs_robots?.status ?? 200,
    protectedUrl: BLOCKED_COHORT[0].schedule_url,
  });
  const schedules = {};
  const issues = [...vccsRobots.issues.map((issue) => `vccs_${issue}`)];
  const sourceReceipts = { vccs_robots: vccsRobots.receipt };
  for (const entry of BLOCKED_COHORT) {
    if (!vccsRobots.receipt.protected_path_allowed) {
      issues.push(`${entry.source_key}_robots_policy`);
      continue;
    }
    const parsed = parseVccsSchedulePage(
      entry,
      sources?.[entry.source_key]?.body,
      sources?.[entry.source_key],
    );
    issues.push(...parsed.issues.map((issue) => `${entry.source_key}_${issue}`));
    if (parsed.facts.has_exact_current_java_section_binding) {
      issues.push(`${entry.source_key}_explicit_java_section_binding_requires_review`);
    }
    sourceReceipts[entry.source_key] = parsed.receipt;
    schedules[entry.community_college_id] = parsed.facts;
  }

  const germannaRobots = robotsPolicy(sources?.germanna_robots?.body, {
    requestedUrl: GERMANNA_ROBOTS_URL,
    finalUrl: sources?.germanna_robots?.finalUrl || GERMANNA_ROBOTS_URL,
    contentType: sources?.germanna_robots?.contentType || 'text/plain',
    status: sources?.germanna_robots?.status ?? 200,
    protectedUrl: GERMANNA_RESOURCES_URL,
  });
  const germanna = parseGermannaResources(
    sources?.germanna_resources?.body,
    sources?.germanna_resources,
  );
  const laurelRobots = robotsPolicy(sources?.laurel_ridge_robots?.body, {
    requestedUrl: LAUREL_RIDGE_ROBOTS_URL,
    finalUrl: sources?.laurel_ridge_robots?.finalUrl || LAUREL_RIDGE_ROBOTS_URL,
    contentType: sources?.laurel_ridge_robots?.contentType || 'text/plain',
    status: sources?.laurel_ridge_robots?.status ?? 200,
    protectedUrl: LAUREL_RIDGE_ARTICLE_URL,
  });
  const laurel = parseLaurelRidgeArticle(
    sources?.laurel_ridge_article?.body,
    sources?.laurel_ridge_article,
  );
  const reynoldsRobots = robotsPolicy(sources?.reynolds_robots?.body, {
    requestedUrl: REYNOLDS_ROBOTS_URL,
    finalUrl: sources?.reynolds_robots?.finalUrl || REYNOLDS_ROBOTS_URL,
    contentType: sources?.reynolds_robots?.contentType || 'text/html',
    status: sources?.reynolds_robots?.status ?? 200,
    protectedUrl: REYNOLDS_OUTLINE_URL,
  });
  const reynolds = parseReynoldsOutline(
    sources?.reynolds_outline?.body,
    sources?.reynolds_outline_text?.body,
    {
      ...sources?.reynolds_outline,
      extractedFromSha256: sources?.reynolds_outline_text?.extractedFromSha256,
    },
  );
  issues.push(
    ...germannaRobots.issues.map((issue) => `germanna_${issue}`),
    ...germanna.issues.map((issue) => `germanna_resources_${issue}`),
    ...laurelRobots.issues.map((issue) => `laurel_ridge_${issue}`),
    ...laurel.issues.map((issue) => `laurel_ridge_article_${issue}`),
    ...reynoldsRobots.issues.map((issue) => `reynolds_${issue}`),
    ...reynolds.issues.map((issue) => `reynolds_outline_${issue}`),
  );
  if (germanna.facts.universal_current_csc222_java_binding) {
    issues.push('germanna_universal_java_binding_requires_review');
  }
  Object.assign(sourceReceipts, {
    germanna_robots: germannaRobots.receipt,
    germanna_resources: germanna.receipt,
    laurel_ridge_robots: laurelRobots.receipt,
    laurel_ridge_article: laurel.receipt,
    reynolds_robots: reynoldsRobots.receipt,
    reynolds_outline: reynolds.receipt,
    reynolds_outline_text: reynolds.extracted_text_receipt,
  });
  if (issues.length) {
    throw new Error(
      `Virginia Tech blocked CSC 222 Java cohort evidence did not verify: ${issues.join(', ')}`,
    );
  }

  const facts = {
    source_plan_reproduction: {
      receiving_institution_id: VIRGINIA_TECH_ID,
      sending_course_id: CSC222_ID,
      sending_code: 'CSC222',
      receiving_identifier: 'CS1114',
      receiving_parent_id: RECEIVING_PARENT_ID,
      condition_kind: 'advisor_or_approval_condition',
      receiving_notes: VT_CSC222_SELECTED_NOTE,
      sending_source_url: VT_CSC222_SOURCE_URL,
      blocked_cell_count: BLOCKED_COHORT.length,
      blocked_community_college_ids: BLOCKED_IDS,
      blocked_cells: BLOCKED_COHORT.map((row) => ({
        community_college_id: row.community_college_id,
        college_name: row.source_plan_college_name,
        agreement_id: row.agreement_id,
      })),
    },
    schedule_audit: {
      source: 'current public courses.vccs.edu CSC 222 college endpoints',
      colleges: schedules,
    },
    supplemental_context: {
      germanna: germanna.facts,
      laurel_ridge: laurel.facts,
      reynolds: reynolds.facts,
    },
  };
  return {
    schema_version: SCHEMA_VERSION,
    artifact: ARTIFACT,
    generated_on: GENERATED_ON,
    verified: true,
    issues: [],
    purpose:
      'Reproduce and adversarially audit the 15 blocked Virginia Tech CSC 222 to CS 1114 sender cells without inferring Java from a statewide title, support resource, instructor, provider, or historical cohort.',
    sources: sourceReceipts,
    facts,
    facts_sha256: sha256(canonicalJson(facts)),
    paper_interpretation: {
      figures: ['3', '4'],
      method: 'fail_closed_without_current_exact_section_or_universal_college_language_binding',
      audited_blocked_community_college_ids: BLOCKED_IDS,
      newly_resolved_community_college_ids: [],
      still_blocked_community_college_ids: BLOCKED_IDS,
      newly_resolved_cells: 0,
      still_blocked_cells: BLOCKED_COHORT.length,
      germanna_course_resources_treated_as_delivery_policy: false,
      laurel_ridge_2022_cohort_generalized_to_current_sections: false,
      reynolds_preferred_language_treated_as_required: false,
      wytheville_nova_provider_inferred_from_other_nova_sections: false,
      statewide_language_inferred: false,
    },
  };
}

function virginiaTechCsc222JavaBlockedCohortEvidenceIssue(candidate = evidence) {
  if (candidate?.schema_version !== SCHEMA_VERSION
      || candidate?.artifact !== ARTIFACT
      || candidate?.generated_on !== GENERATED_ON
      || candidate?.verified !== true
      || (candidate?.issues || []).length !== 0
      || candidate?.facts_sha256 !== FACTS_SHA256
      || sha256(canonicalJson(candidate?.facts)) !== FACTS_SHA256) {
    return 'the blocked CSC 222 Java cohort facts changed';
  }
  for (const [name, expectedHash] of Object.entries(SOURCE_RESPONSE_SHA256)) {
    const receipt = candidate?.sources?.[name];
    if (!receipt
        || receipt.response_sha256 !== expectedHash
        || !Number.isInteger(receipt.response_bytes)
        || receipt.response_bytes <= 0) {
      return `the blocked CSC 222 Java ${name} source receipt changed`;
    }
  }
  if (Object.keys(candidate?.sources || {}).length !== Object.keys(SOURCE_RESPONSE_SHA256).length) {
    return 'the blocked CSC 222 Java source inventory changed';
  }
  const vccsRobots = candidate.sources.vccs_robots;
  if (vccsRobots.requested_url !== VCCS_ROBOTS_URL
      || vccsRobots.final_url !== VCCS_ROBOTS_URL
      || vccsRobots.http_status !== 200
      || vccsRobots.policy_published !== true
      || vccsRobots.protected_path_allowed !== true
      || vccsRobots.crawl_delay_seconds !== 1) {
    return 'the VCCS CSC 222 robots receipt changed';
  }
  for (const entry of BLOCKED_COHORT) {
    const receipt = candidate.sources[entry.source_key];
    if (receipt?.requested_url !== entry.schedule_url
        || receipt?.final_url !== entry.schedule_url
        || receipt?.http_status !== 200
        || !String(receipt?.content_type || '').toLowerCase().includes('text/html')) {
      return `the ${entry.college_name} CSC 222 source identity changed`;
    }
  }
  const exactSourceIdentities = [
    ['germanna_resources', GERMANNA_RESOURCES_URL, 'text/html'],
    ['laurel_ridge_article', LAUREL_RIDGE_ARTICLE_URL, 'text/html'],
    ['reynolds_outline', REYNOLDS_OUTLINE_URL, 'application/pdf'],
  ];
  for (const [name, url, contentType] of exactSourceIdentities) {
    const receipt = candidate.sources[name];
    if (receipt?.requested_url !== url
        || receipt?.final_url !== url
        || receipt?.http_status !== 200
        || !String(receipt?.content_type || '').toLowerCase().includes(contentType)) {
      return `the blocked CSC 222 Java ${name} source identity changed`;
    }
  }
  const robotsIdentities = [
    ['germanna_robots', GERMANNA_ROBOTS_URL, true],
    ['laurel_ridge_robots', LAUREL_RIDGE_ROBOTS_URL, true],
    ['reynolds_robots', REYNOLDS_ROBOTS_URL, false],
  ];
  for (const [name, url, published] of robotsIdentities) {
    const receipt = candidate.sources[name];
    if (receipt?.requested_url !== url
        || receipt?.final_url !== url
        || receipt?.http_status !== 200
        || receipt?.policy_published !== published
        || receipt?.protected_path_allowed !== true) {
      return `the blocked CSC 222 Java ${name} policy receipt changed`;
    }
  }
  if (candidate.sources.laurel_ridge_robots.crawl_delay_seconds !== 10
      || candidate.sources.reynolds_outline_text.derived_from_response_sha256
        !== SOURCE_RESPONSE_SHA256.reynolds_outline
      || candidate.sources.reynolds_outline_text.derivation !== 'pdftotext - -') {
    return 'the blocked CSC 222 Java capture derivation changed';
  }
  const interpretation = candidate?.paper_interpretation;
  if (interpretation?.method
        !== 'fail_closed_without_current_exact_section_or_universal_college_language_binding'
      || JSON.stringify(interpretation?.newly_resolved_community_college_ids) !== '[]'
      || interpretation?.newly_resolved_cells !== 0
      || interpretation?.still_blocked_cells !== 15
      || JSON.stringify(interpretation?.still_blocked_community_college_ids)
        !== JSON.stringify(BLOCKED_IDS)
      || interpretation?.statewide_language_inferred !== false
      || interpretation?.wytheville_nova_provider_inferred_from_other_nova_sections !== false) {
    return 'the fail-closed blocked CSC 222 Java interpretation changed';
  }
  const colleges = candidate?.facts?.schedule_audit?.colleges || {};
  if (JSON.stringify(Object.keys(colleges).map(Number).sort((a, b) => a - b))
      !== JSON.stringify(BLOCKED_IDS)
      || Object.values(colleges).some((row) => (
        row?.resolution_status !== 'fail_closed'
        || row?.has_exact_current_java_section_binding !== false
        || row?.all_scheduled_sections_explicitly_java !== false
      ))) {
    return 'the blocked CSC 222 Java schedule classification changed';
  }
  if (candidate?.facts?.supplemental_context?.germanna
      ?.universal_current_csc222_java_binding !== false
      || candidate?.facts?.supplemental_context?.laurel_ridge
        ?.universal_current_csc222_java_binding !== false
      || candidate?.facts?.supplemental_context?.reynolds
        ?.universal_current_csc222_java_binding !== false) {
    return 'context-only CSC 222 evidence was promoted to a current universal binding';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  BLOCKED_COHORT,
  BLOCKED_IDS,
  CSC222_ID,
  FACTS_SHA256,
  GENERATED_ON,
  GERMANNA_RESOURCES_URL,
  GERMANNA_ROBOTS_URL,
  LAUREL_RIDGE_ARTICLE_URL,
  LAUREL_RIDGE_ROBOTS_URL,
  RECEIVING_PARENT_ID,
  REYNOLDS_OUTLINE_URL,
  REYNOLDS_ROBOTS_URL,
  SCHEMA_VERSION,
  SOURCE_RESPONSE_SHA256,
  VCCS_ROBOTS_URL,
  VIRGINIA_TECH_ID,
  VT_CSC222_SELECTED_NOTE,
  VT_CSC222_SOURCE_URL,
  auditExactBlockedCohort,
  buildVirginiaTechCsc222JavaBlockedCohortEvidence,
  canonicalJson,
  explicitJavaStatement,
  parseGermannaResources,
  parseLaurelRidgeArticle,
  parseReynoldsOutline,
  parseVccsSchedulePage,
  robotsPolicy,
  sha256,
  virginiaTechCsc222JavaBlockedCohortEvidenceIssue,
};
