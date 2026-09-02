const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { parseCoursePage } = require('../virginia/courseEquivalency');
const {
  COURSE_FACTS,
  EQUIVALENCY_SOURCE_URLS,
  TRANSFER_VIRGINIA_HOST,
  robotsAllows,
} = require('./radfordSciencePairEvidence');

const ARTIFACT = 'radford_college_specific_science_pair_equivalency_evidence';
const CATALOG_YEAR = '2026-2027';
const ROBOTS_URL = `https://${TRANSFER_VIRGINIA_HOST}/robots.txt`;
const ROBOTS_RESPONSE_BYTES = 2189;
const ROBOTS_RESPONSE_SHA256 =
  '278e83bcf567badfebcdea4d5d20ca9898e4449fe4eb2e3b5a08227b4ca9b762';

/**
 * Acquisition targets are colleges for which the accepted A.S. source either
 * prints the complete pair or prints enough receiver-directed/open-category
 * capacity for a separate exact carrier proof to select it.  An equivalency
 * receipt alone never creates curriculum capacity: the latter three colleges
 * stay fail-closed unless `radfordAssociateSciencePairCarrier` also proves the
 * reviewed source slot(s) and exact accepted/final tree.
 */
const PAIR_TARGETS = Object.freeze([
  ['blue-ridge-community-college', 'Blue Ridge Community College', ['CHM111', 'CHM112']],
  ['brightpoint-community-college', 'Brightpoint Community College', ['CHM111', 'CHM112']],
  ['central-virginia-community-college', 'Central Virginia Community College', ['CHM111', 'CHM112']],
  ['germanna-community-college', 'Germanna Community College', ['CHM111', 'CHM112']],
  ['j-sargeant-reynolds-community-college', 'J Sargeant Reynolds Community College', ['CHM111', 'CHM112']],
  ['laurel-ridge-community-college', 'Laurel Ridge Community College', ['CHM111', 'CHM112']],
  ['mountain-gateway-community-college', 'Mountain Gateway Community College', ['CHM111', 'CHM112']],
  ['new-river-community-college', 'New River Community College', ['CHM111', 'CHM112']],
  ['northern-virginia-community-college', 'Northern Virginia Community College', ['CHM111', 'CHM112']],
  ['paul-d-camp-community-college', 'Paul D. Camp Community College', ['CHM111', 'CHM112']],
  ['piedmont-virginia-community-college', 'Piedmont Virginia Community College', ['CHM111', 'CHM112']],
  ['rappahannock-community-college', 'Rappahannock Community College', ['CHM111', 'CHM112']],
  ['tidewater-community-college', 'Tidewater Community College', ['CHM111', 'CHM112']],
  ['virginia-highlands-community-college', 'Virginia Highlands Community College', ['CHM111', 'CHM112']],
  ['virginia-peninsula-community-college', 'Virginia Peninsula Community College', ['CHM111', 'CHM112']],
  ['virginia-western-community-college', 'Virginia Western Community College', ['CHM111', 'CHM112']],
  ['wytheville-community-college', 'Wytheville Community College', ['PHY201', 'PHY202']],
].map(([collegeSlug, sourceInstitution, codes]) => Object.freeze({
  college_slug: collegeSlug,
  source_institution: sourceInstitution,
  sending_codes: Object.freeze(codes),
})));

const RECEIPT_TARGETS = Object.freeze(PAIR_TARGETS.flatMap((target) => (
  target.sending_codes.map((sendingCode) => Object.freeze({
    college_slug: target.college_slug,
    source_institution: target.source_institution,
    sending_code: sendingCode,
    receiving_code: COURSE_FACTS[sendingCode].receiving_code,
  }))
)));

// Filled only after a complete official acquisition has been inspected. It
// pins the exact 34-row positive/negative inventory and all response hashes.
const RECEIPTS_SHA256 =
  '459414663149698f76c29e695c17e34cafc3ccbb533bae3f2054809c43fea27a';

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const sha256 = (value) => createHash('sha256').update(String(value || '')).digest('hex');
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const semanticSha256 = (value) => sha256(JSON.stringify(stable(value)));
const receiptKey = (collegeSlug, sendingCode) => `${collegeSlug}:${sendingCode}`;

function sourceMetadata(body, response = {}, expectedUrl) {
  const source = String(body || '');
  return {
    requested_url: response.requestedUrl || expectedUrl,
    final_url: response.finalUrl || expectedUrl,
    http_status: Number(response.status ?? 200),
    content_type: response.contentType || 'text/html; charset=UTF-8',
    response_bytes: Buffer.byteLength(source),
    response_sha256: sha256(source),
  };
}

function discoveryRows(html, sendingCode) {
  const $ = cheerio.load(String(html || ''));
  const rows = [];
  $('#courses-equivalencies-table table tr').each((index, row) => {
    const cells = $(row).find('td').map((cellIndex, cell) => normalize($(cell).text())).get();
    if (cells.length < 5 || cells[4].toLowerCase() !== '2-year') return;
    const anchors = $(row).find('a[href^="/course/"]').filter((anchorIndex, anchor) => (
      normalize($(anchor).text()).replace(/[\s-]/g, '').toUpperCase() === sendingCode
    ));
    if (anchors.length !== 1) return;
    const href = anchors.first().attr('href') || '';
    const match = /^\/course\/([A-F0-9]{20,})$/i.exec(href);
    if (!match) return;
    rows.push({
      source_institution: cells[0],
      sending_code: cells[1].replace(/[\s-]/g, '').toUpperCase(),
      sending_title: cells[2] || null,
      notes: cells[3] || null,
      level: cells[4],
      guid: match[1].toUpperCase(),
      url: `https://${TRANSFER_VIRGINIA_HOST}${href}`,
    });
  });
  return rows;
}

function discoveryForCode(html, sendingCode, response = {}) {
  const fact = COURSE_FACTS[sendingCode];
  const expectedUrl = EQUIVALENCY_SOURCE_URLS[sendingCode];
  const page = parseCoursePage(String(html || ''), { url: expectedUrl });
  const issues = [];
  if (page.institution !== 'Blue Ridge Community College') issues.push('source_institution');
  if (page.code !== sendingCode || page.title !== fact.sending_title) {
    issues.push('sending_course_identity');
  }
  if (Number(page.credits) !== fact.sending_credits) issues.push('sending_course_credits');
  const source = sourceMetadata(html, response, expectedUrl);
  if (source.requested_url !== expectedUrl || source.final_url !== expectedUrl) {
    issues.push('source_url');
  }
  if (source.http_status !== 200
      || !String(source.content_type).toLowerCase().includes('text/html')) {
    issues.push('source_response');
  }
  return {
    verified: issues.length === 0,
    issues,
    sending_code: sendingCode,
    root_source_institution: page.institution,
    source,
    rows: discoveryRows(html, sendingCode),
  };
}

function routeForTarget(discovery, target) {
  if (target.source_institution === 'Blue Ridge Community College') {
    const url = EQUIVALENCY_SOURCE_URLS[target.sending_code];
    return {
      kind: 'root_page',
      source_institution: target.source_institution,
      sending_code: target.sending_code,
      sending_title: COURSE_FACTS[target.sending_code].sending_title,
      notes: null,
      level: 'source',
      guid: url.split('/').pop(),
      url,
    };
  }
  const matches = (discovery?.rows || []).filter((row) => (
    row.source_institution === target.source_institution
      && row.sending_code === target.sending_code
  ));
  return matches.length === 1 ? matches[0] : null;
}

function receiptForTarget({ target, discovery, courseBody, courseResponse }) {
  const fact = COURSE_FACTS[target.sending_code];
  const route = routeForTarget(discovery, target);
  const base = {
    college_slug: target.college_slug,
    source_institution: target.source_institution,
    sending_code: target.sending_code,
    sending_credits: fact.sending_credits,
    expected_receiving_code: fact.receiving_code,
    discovery: {
      source_url: discovery?.source?.final_url || EQUIVALENCY_SOURCE_URLS[target.sending_code],
      source_response_sha256: discovery?.source?.response_sha256 || null,
      route: route || null,
    },
  };
  if (!route) {
    return {
      receipt: {
        ...base,
        status: 'negative',
        reason: 'college_course_rendering_not_discovered',
        observed_radford_edges: [],
        source: null,
      },
      issues: [],
    };
  }
  const source = sourceMetadata(courseBody, courseResponse, route.url);
  const page = parseCoursePage(String(courseBody || ''), { url: route.url });
  const issues = [];
  if (source.requested_url !== route.url || source.final_url !== route.url) {
    issues.push('source_url');
  }
  if (source.http_status !== 200
      || !String(source.content_type).toLowerCase().includes('text/html')) {
    issues.push('source_response');
  }
  if (page.institution !== target.source_institution) issues.push('source_institution');
  if (page.code !== target.sending_code || page.title !== fact.sending_title) {
    issues.push('sending_course_identity');
  }
  if (Number(page.credits) !== fact.sending_credits) issues.push('sending_course_credits');
  const radfordEdges = (page.equivalencies || []).filter((edge) => (
    edge.institution === 'Radford University' && edge.level === 'four_year'
  )).map((edge) => ({
    receiving_institution: edge.institution,
    receiving_code: edge.identifier,
    receiving_name: edge.name ?? null,
    receiving_notes: edge.notes ?? null,
  }));
  const exactEdges = radfordEdges.filter((edge) => edge.receiving_code === fact.receiving_code);
  const positive = issues.length === 0 && exactEdges.length === 1;
  return {
    receipt: {
      ...base,
      status: positive ? 'positive' : 'negative',
      reason: positive ? null : exactEdges.length === 0
        ? 'exact_radford_landing_not_published'
        : 'exact_radford_landing_not_unique',
      receiving_institution: positive ? exactEdges[0].receiving_institution : null,
      receiving_code: positive ? exactEdges[0].receiving_code : null,
      receiving_name: positive ? exactEdges[0].receiving_name : null,
      receiving_notes: positive ? exactEdges[0].receiving_notes : null,
      observed_radford_edges: radfordEdges,
      source,
    },
    issues,
  };
}

function buildRadfordCollegeSciencePairEvidence({
  discoveryPages = {},
  discoveryResponses = {},
  coursePages = {},
  courseResponses = {},
  robots = {},
} = {}) {
  const issues = [];
  const discoveries = {};
  for (const sendingCode of Object.keys(COURSE_FACTS)) {
    const discovery = discoveryForCode(
      discoveryPages[sendingCode],
      sendingCode,
      discoveryResponses[sendingCode],
    );
    discoveries[sendingCode] = discovery;
    issues.push(...discovery.issues.map((issue) => `${sendingCode}:discovery:${issue}`));
  }
  const robotsSource = String(robots.text || '');
  if (robots.status !== 200
      || robots.host !== TRANSFER_VIRGINIA_HOST
      || Number(robots.crawlDelay) !== 10
      || !robotsSource.trim()
      || !RECEIPT_TARGETS.every((target) => {
        const route = routeForTarget(discoveries[target.sending_code], target);
        return !route || robotsAllows(route.url, robotsSource);
      })) {
    issues.push('transfer_virginia:robots_policy');
  }
  const receipts = [];
  for (const target of RECEIPT_TARGETS) {
    const discovery = discoveries[target.sending_code];
    const route = routeForTarget(discovery, target);
    const key = receiptKey(target.college_slug, target.sending_code);
    const root = route?.kind === 'root_page';
    const built = receiptForTarget({
      target,
      discovery,
      courseBody: root ? discoveryPages[target.sending_code] : coursePages[key],
      courseResponse: root
        ? discoveryResponses[target.sending_code] : courseResponses[key],
    });
    receipts.push(built.receipt);
    issues.push(...built.issues.map((issue) => `${key}:receipt:${issue}`));
  }
  const receiptDigest = semanticSha256(receipts);
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-24',
    institution: { name: 'Radford University', slug: 'radford-university', school_id: 9219 },
    catalog_year: CATALOG_YEAR,
    purpose:
      'College-specific Transfer Virginia receipts for exact science pairs present in accepted A.S. trees or admitted by a separately proved source-bound destination/open-category carrier. Statewide common-course identity and offered_by membership are discovery evidence only; they cannot make a receipt positive or create curriculum capacity.',
    verified: issues.length === 0,
    issues,
    target_count: RECEIPT_TARGETS.length,
    positive_receipts: receipts.filter((receipt) => receipt.status === 'positive').length,
    negative_receipts: receipts.filter((receipt) => receipt.status === 'negative').length,
    discoveries: Object.fromEntries(Object.entries(discoveries).map(([code, discovery]) => [
      code,
      {
        sending_code: code,
        root_source_institution: discovery.root_source_institution,
        source: discovery.source,
        discovered_two_year_renderings: discovery.rows.length,
      },
    ])),
    robots: {
      url: ROBOTS_URL,
      http_status: robots.status,
      response_bytes: Buffer.byteLength(robotsSource),
      response_sha256: sha256(robotsSource),
      crawl_delay_seconds: Number(robots.crawlDelay),
      policy_paths_allowed: true,
    },
    receipts,
    receipts_sha256: receiptDigest,
  };
}

function radfordCollegeSciencePairEvidenceIssue(evidence) {
  if (!evidence || evidence.schema_version !== 1 || evidence.artifact !== ARTIFACT
      || evidence.catalog_year !== CATALOG_YEAR || evidence.verified !== true
      || (evidence.issues || []).length !== 0
      || evidence.target_count !== RECEIPT_TARGETS.length
      || !Array.isArray(evidence.receipts)
      || evidence.receipts.length !== RECEIPT_TARGETS.length
      || evidence.receipts_sha256 !== RECEIPTS_SHA256
      || semanticSha256(evidence.receipts) !== RECEIPTS_SHA256) {
    return 'the Radford college-specific science-pair receipt inventory changed';
  }
  const seen = new Set();
  for (let index = 0; index < RECEIPT_TARGETS.length; index += 1) {
    const target = RECEIPT_TARGETS[index];
    const receipt = evidence.receipts[index];
    const key = receiptKey(target.college_slug, target.sending_code);
    if (seen.has(key)
        || receipt?.college_slug !== target.college_slug
        || receipt?.source_institution !== target.source_institution
        || receipt?.sending_code !== target.sending_code
        || receipt?.sending_credits !== COURSE_FACTS[target.sending_code].sending_credits
        || receipt?.expected_receiving_code !== target.receiving_code
        || !['positive', 'negative'].includes(receipt?.status)) {
      return `the exact ${key} college-specific target receipt changed`;
    }
    seen.add(key);
    if (receipt.status === 'positive' && (
      receipt.reason !== null
      || receipt.receiving_institution !== 'Radford University'
      || receipt.receiving_code !== target.receiving_code
      || !receipt.source
      || receipt.source.http_status !== 200
      || !String(receipt.source.content_type || '').toLowerCase().includes('text/html')
      || receipt.source.requested_url !== receipt.discovery?.route?.url
      || receipt.source.final_url !== receipt.discovery?.route?.url
      || !/^[a-f0-9]{64}$/.test(receipt.source.response_sha256 || '')
      || receipt.source.response_bytes <= 0
    )) {
      return `the positive ${key} college-specific Radford landing changed`;
    }
    if (receipt.status === 'negative'
        && !['college_course_rendering_not_discovered', 'exact_radford_landing_not_published',
          'exact_radford_landing_not_unique'].includes(receipt.reason)) {
      return `the negative ${key} college-specific receipt changed`;
    }
  }
  if (evidence.positive_receipts
        !== evidence.receipts.filter((receipt) => receipt.status === 'positive').length
      || evidence.negative_receipts
        !== evidence.receipts.filter((receipt) => receipt.status === 'negative').length
      || evidence.positive_receipts + evidence.negative_receipts !== RECEIPT_TARGETS.length
      || evidence.robots?.url !== ROBOTS_URL
      || evidence.robots?.http_status !== 200
      || evidence.robots?.response_bytes !== ROBOTS_RESPONSE_BYTES
      || evidence.robots?.response_sha256 !== ROBOTS_RESPONSE_SHA256
      || evidence.robots?.crawl_delay_seconds !== 10
      || evidence.robots?.policy_paths_allowed !== true) {
    return 'the Radford college-specific receipt counts or robots receipt changed';
  }
  return null;
}

function exactPositiveReceipt(evidence, collegeSlug, sendingCode) {
  const issue = radfordCollegeSciencePairEvidenceIssue(evidence);
  if (issue) return { supported: false, reason: issue };
  const receipt = evidence.receipts.find((row) => (
    row.college_slug === collegeSlug && row.sending_code === sendingCode
  ));
  if (!receipt || receipt.status !== 'positive') {
    return {
      supported: false,
      reason: receipt?.reason || 'college_specific_receipt_absent',
      receipt: receipt || null,
    };
  }
  return { supported: true, receipt };
}

module.exports = {
  ARTIFACT,
  CATALOG_YEAR,
  PAIR_TARGETS,
  RECEIPTS_SHA256,
  RECEIPT_TARGETS,
  ROBOTS_RESPONSE_BYTES,
  ROBOTS_RESPONSE_SHA256,
  ROBOTS_URL,
  buildRadfordCollegeSciencePairEvidence,
  discoveryForCode,
  discoveryRows,
  exactPositiveReceipt,
  radfordCollegeSciencePairEvidenceIssue,
  receiptForTarget,
  receiptKey,
  routeForTarget,
  semanticSha256,
  sourceMetadata,
};
