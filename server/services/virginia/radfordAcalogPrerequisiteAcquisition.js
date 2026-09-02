const crypto = require('node:crypto');
const cheerio = require('cheerio');

const RADFORD_SLUG = 'radford-university';
const RADFORD_HOST = 'catalog.radford.edu';
const RADFORD_CATALOG_YEAR = '2026-2027';
const RADFORD_CATALOG_LABEL = '2026-2027 University Academic Catalog';
const RADFORD_CATOID = 62;
const RADFORD_PROGRAM_CACHE_PATH = 'pages/radford-university__program.html';
const RADFORD_PROGRAM_HTML_SHA256 =
  '73ddf85d1e1ffad17765730415afd55d7f1c043dfcf8e9fd0dc52fc37328b535';
const RADFORD_BOUNDARY_CONTRACT =
  'radford_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1';
const RADFORD_DISCOVERY_CONTRACT =
  'radford_retained_current_program_exact_course_link_and_coid_v1';
const RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT =
  'radford_hash_pinned_retained_course_entry_exact_link_and_coid_v1';
const RADFORD_CLAUSE_RECEIPT_CONTRACT =
  'radford_acalog_strong_prerequisite_marker_to_first_br_exact_clause_v1';
const RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT =
  'radford_acalog_strong_pre_or_corequisite_marker_to_first_br_exact_clause_v1';

const RADFORD_DIRECT_COURSE_RECORDS = Object.freeze({
  CS120: Object.freeze({ coid: 108997, title: 'Principles of Computer Science I (GE)' }),
  CS220: Object.freeze({ coid: 109002, title: 'Principles of Computer Science II (GE)' }),
  CS230: Object.freeze({ coid: 110626, title: 'Foundations of Cloud Computing' }),
  CS252: Object.freeze({ coid: 110367, title: 'Foundations of Computer Systems' }),
  CS322: Object.freeze({ coid: 108998, title: 'Discrete Mathematics for Computer Science' }),
  CS340: Object.freeze({ coid: 109015, title: 'Database I' }),
  CS345: Object.freeze({ coid: 109016, title: 'Introduction to Information Security' }),
  CS350: Object.freeze({ coid: 109017, title: 'Introduction to Computer Networking' }),
  CS370: Object.freeze({ coid: 109020, title: 'Software Engineering I' }),
  CS390: Object.freeze({ coid: 109042, title: 'Career Preparation' }),
  CS411: Object.freeze({ coid: 110418, title: 'Societal Security in Computing' }),
  ENGL111: Object.freeze({ coid: 108402, title: 'Principles of College Composition (GE)' }),
  MATH168: Object.freeze({ coid: 109885, title: 'Calculus I with Integrated Precalculus I (GE)' }),
  MATH169: Object.freeze({ coid: 109886, title: 'Calculus I with Integrated Precalculus II (GE)' }),
  MATH171: Object.freeze({ coid: 109887, title: 'Calculus and Analytic Geometry I (GE)' }),
});

// These recursive prerequisites do not occur on the retained program page.
// Their identities are instead pinned to exact links in already-retained,
// hash-bound current-catalog course responses. Titles are pinned after the
// target responses are captured and are never inferred from link text.
const RADFORD_CLOSURE_COURSE_RECORDS = Object.freeze({
  CS109: Object.freeze({
    coid: 108994, title: 'Problem Solving and Programming (GE)', discovery_course_code: 'CS119',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs119.html',
    discovery_response_sha256: '7d365cc7369ce45569a0bbcb8291d7da331f89eb0a935756b0b3344ca82cd94f',
  }),
  CS101: Object.freeze({
    coid: 110714, title: 'Computational Thinking', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
  CS118: Object.freeze({
    coid: 110599, title: 'Principles of Programming I (GE)', discovery_course_code: 'CS252',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs252.html',
    discovery_response_sha256: '340867cae1fdef5501b24bc21290d2188a1ae95e519bb62cbc750110ea13aa66',
  }),
  CS119: Object.freeze({
    coid: 110600, title: 'Principles of Programming II (GE)', discovery_course_code: 'CS220',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs220.html',
    discovery_response_sha256: 'f75a6d6614c7457ef86cafa11e9bfec3b9552c6d9e60fe537f1461a7136f9174',
  }),
  MATH125: Object.freeze({
    coid: 109057, title: 'Precalculus I (GE)', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
  MATH126: Object.freeze({
    coid: 109058, title: 'Business Calculus (GE)', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
  MATH138: Object.freeze({
    coid: 109062, title: 'Precalculus II (GE)', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
  PHYS111: Object.freeze({
    coid: 109347, title: 'General Physics I', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
  PHYS112: Object.freeze({
    coid: 109348, title: 'General Physics II (GE)', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
  PHYS221: Object.freeze({
    coid: 109349, title: 'Physics I (GE)', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
  PHYS222: Object.freeze({
    coid: 109350, title: 'Physics II (GE)', discovery_course_code: 'CS120',
    discovery_cache_path: 'university-prerequisites/raw/radford-university/radford-university__cs120.html',
    discovery_response_sha256: '8110f1dd56fe51edf61c44a4f922c4797037ad36a713b4a52275a4c9f80e3295',
  }),
});
const RADFORD_COURSE_RECORDS = Object.freeze({
  ...RADFORD_DIRECT_COURSE_RECORDS,
  ...RADFORD_CLOSURE_COURSE_RECORDS,
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const normalizedText = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function expectedCourseUrl(code) {
  const record = RADFORD_COURSE_RECORDS[normalizeCode(code)];
  return record
    ? `https://${RADFORD_HOST}/preview_course_nopop.php?catoid=${RADFORD_CATOID}&coid=${record.coid}`
    : null;
}

function verifyRadfordRetainedEntryDiscovery(html, targetCode) {
  const target = normalizeCode(targetCode);
  const expected = RADFORD_CLOSURE_COURSE_RECORDS[target];
  if (!target || !expected) return {
    verified: false, issues: ['unsupported_closure_target'], links: [],
  };
  const bytes = Buffer.from(String(html || ''));
  const issues = [];
  if (sha256(bytes) !== expected.discovery_response_sha256) issues.push('discovery_html_sha256');
  const $ = cheerio.load(bytes.toString('utf8'));
  if (normalizedText($('#acalog-catalog-name').text()) !== RADFORD_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const matches = $('a[href*="preview_course_nopop.php"]')
    .map((index, element) => {
      const linkCode = normalizeCode($(element).text());
      if (linkCode !== target) return null;
      const href = String($(element).attr('href') || '');
      let url;
      try { url = new URL(href, `https://${RADFORD_HOST}/`); } catch { return null; }
      const ariaLabel = normalizedText($(element).attr('aria-label'));
      return {
        course_code: target,
        catoid: Number(url.searchParams.get('catoid')),
        coid: Number(url.searchParams.get('coid')),
        link_text: normalizedText($(element).text()),
        aria_label: ariaLabel,
        href,
        href_sha256: sha256(href),
        discovery_course_code: expected.discovery_course_code,
        discovery_cache_path: expected.discovery_cache_path,
        discovery_response_sha256: expected.discovery_response_sha256,
      };
    }).get().filter(Boolean);
  if (matches.length !== 1) issues.push(`${target}:unique_retained_entry_link`);
  const link = matches.length === 1 ? matches[0] : null;
  if (link && (link.catoid !== RADFORD_CATOID || link.coid !== expected.coid
      || link.link_text !== target.replace(/([A-Z]+)(\d)/, '$1 $2')
      || link.aria_label !== `View course details for ${target.replace(/([A-Z]+)(\d)/, '$1 $2')}`)) {
    issues.push(`${target}:retained_entry_link_identity`);
  }
  return { verified: issues.length === 0, issues, links: link ? [link] : [] };
}

function headingParts(value) {
  const text = normalizedText(value);
  const match = /^([A-Z]{2,8})\s+(\d{2,4}[A-Z]?)\s*-\s*(.+)$/.exec(text);
  return match ? { code: normalizeCode(`${match[1]}${match[2]}`), title: match[3], text } : null;
}

function parsePublishedCredits(text) {
  const match = /^\((\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\)$/.exec(
    normalizedText(text),
  );
  if (!match) return null;
  const minimum = Number(match[1]);
  const maximum = Number(match[2] || match[1]);
  if (!(minimum > 0) || maximum < minimum) return null;
  return {
    kind: match[2] ? 'published_variable_credit_range' : 'published_fixed_credits',
    notation: normalizedText(text),
    credit_hours_min: minimum,
    credit_hours_max: maximum,
  };
}

/**
 * The retained program page is discovery evidence only. It must expose one
 * exact current-catalog showCourse link for every target, with the pinned
 * catoid/coid identity. It never supplies prerequisite text.
 */
function verifyRadfordProgramDiscovery(html, targetCodes) {
  const bytes = Buffer.from(String(html || ''));
  const issues = [];
  if (sha256(bytes) !== RADFORD_PROGRAM_HTML_SHA256) issues.push('program_html_sha256');
  const $ = cheerio.load(bytes.toString('utf8'));
  if (normalizedText($('#acalog-catalog-name').text()) !== RADFORD_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const links = [];
  for (const requested of targetCodes || []) {
    const code = normalizeCode(requested);
    const record = RADFORD_DIRECT_COURSE_RECORDS[code];
    if (!record) {
      issues.push(`${code || requested}:unsupported_target`);
      continue;
    }
    const matches = $('a[onclick*="showCourse"]')
      .map((index, element) => {
        const heading = headingParts($(element).text());
        const onclick = String($(element).attr('onclick') || '');
        const identity = /showCourse\('([0-9]+)',\s*'([0-9]+)'/.exec(onclick);
        return heading?.code === code && identity ? {
          course_code: code,
          title: heading.title,
          catoid: Number(identity[1]),
          coid: Number(identity[2]),
          link_text: heading.text,
          onclick_sha256: sha256(onclick),
        } : null;
      }).get().filter(Boolean);
    const unique = new Map(matches.map((row) => [`${row.catoid}:${row.coid}:${row.link_text}`, row]));
    if (unique.size !== 1) {
      issues.push(`${code}:unique_program_link`);
      continue;
    }
    const link = [...unique.values()][0];
    if (link.catoid !== RADFORD_CATOID || link.coid !== record.coid
        || link.title !== record.title) issues.push(`${code}:program_link_identity`);
    links.push(link);
  }
  return { verified: issues.length === 0, issues, links };
}

function contentCellForHeading($, heading) {
  const cells = heading.parents('td.block_content');
  if (cells.length !== 1) return null;
  return cells.first();
}

function radfordMarkedClauseReceipt(rawEntryHtml, rawEntryText, {
  markerPattern, kind, receiptContract,
  boundaryTerminal = 'first_br_after_unique_strong_prerequisite_marker',
  issuePrefix = 'prerequisite',
}) {
  const html = String(rawEntryHtml || '');
  const markers = [...html.matchAll(markerPattern)];
  if (!markers.length) return { verified: true, issues: [], receipt: null };
  if (markers.length !== 1) return {
    verified: false, issues: [`unique_${issuePrefix}_marker`], receipt: null,
  };
  const marker = markers[0];
  const start = marker.index + marker[0].length;
  const terminal = /<br\s*\/?\s*>/ig;
  terminal.lastIndex = start;
  const endMatch = terminal.exec(html);
  if (!endMatch) return {
    verified: false, issues: [`${issuePrefix}_first_br_boundary`], receipt: null,
  };
  const clauseHtml = html.slice(start, endMatch.index);
  const fragment = cheerio.load(`<div id="receipt">${clauseHtml}</div>`);
  fragment('#receipt [style*="display: none"]').remove();
  // Match the element-boundary projection used for the retained full entry.
  // Acalog often wraps punctuation in its own span, so plain text would erase
  // the exact spacing needed for replayable offsets and hashes.
  fragment('#receipt *').each((index, element) => fragment(element).append(' '));
  const raw = normalizedText(fragment('#receipt').text());
  if (!raw) return { verified: false, issues: [`${issuePrefix}_clause_empty`], receipt: null };
  const relativeStart = rawEntryText.indexOf(raw);
  if (relativeStart < 0 || rawEntryText.indexOf(raw, relativeStart + raw.length) >= 0) {
    return { verified: false, issues: [`${issuePrefix}_text_projection`], receipt: null };
  }
  const label = normalizedText(marker[1]);
  const statementStart = rawEntryText.lastIndexOf(`${label}:`, relativeStart);
  if (statementStart < 0) {
    return { verified: false, issues: [`${issuePrefix}_statement_projection`], receipt: null };
  }
  return {
    verified: true,
    issues: [],
    receipt: {
      receipt_contract: receiptContract,
      kind,
      label,
      raw,
      raw_sha256: sha256(raw),
      relative_start: relativeStart,
      relative_end: relativeStart + raw.length,
      statement_relative_start: statementStart,
      statement_relative_end: relativeStart + raw.length,
      raw_html_sha256: sha256(clauseHtml),
      boundary_terminal: boundaryTerminal,
    },
  };
}

function radfordRequiredClauseReceipt(rawEntryHtml, rawEntryText) {
  return radfordMarkedClauseReceipt(rawEntryHtml, rawEntryText, {
    markerPattern: /<strong>\s*(Prerequisites?):\s*<\/strong>/gi,
    kind: 'prerequisite',
    receiptContract: RADFORD_CLAUSE_RECEIPT_CONTRACT,
  });
}

function radfordPreOrCorequisiteClauseReceipt(rawEntryHtml, rawEntryText) {
  return radfordMarkedClauseReceipt(rawEntryHtml, rawEntryText, {
    markerPattern: /<strong>\s*(Pre-\s*or\s*Corequisites?):\s*<\/strong>/gi,
    kind: 'pre_or_corequisite',
    receiptContract: RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT,
    boundaryTerminal: 'first_br_after_unique_strong_pre_or_corequisite_marker',
    issuePrefix: 'pre_or_corequisite',
  });
}

/**
 * Accept one full Acalog preview_course_nopop record only when the response
 * has a unique exact course H1, exact catoid/coid URL identity, current
 * catalog label, and one positive Credits field. The whole course-bearing
 * content cell is retained; silence is deliberately not interpreted.
 */
function extractRadfordCourseEntry(html, targetCode, { finalUrl } = {}) {
  const target = normalizeCode(targetCode);
  const expected = RADFORD_COURSE_RECORDS[target];
  if (!target || !expected) {
    return { verified: false, issues: ['unsupported_target_course_code'], entries: [], missing: [] };
  }
  const issues = [];
  let url;
  try { url = new URL(finalUrl || expectedCourseUrl(target)); } catch { /* checked below */ }
  if (url?.protocol !== 'https:' || url?.hostname.toLowerCase() !== RADFORD_HOST
      || url?.pathname !== '/preview_course_nopop.php'
      || Number(url.searchParams.get('catoid')) !== RADFORD_CATOID
      || Number(url.searchParams.get('coid')) !== expected.coid) issues.push('course_url_identity');
  const $ = cheerio.load(String(html || ''));
  if (normalizedText($('#acalog-catalog-name').text()) !== RADFORD_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const headings = $('h1#course_preview_title').filter((index, element) => (
    headingParts($(element).text())?.code === target
  ));
  if (headings.length !== 1) issues.push('unique_exact_course_heading');
  const heading = headings.first();
  const parts = headingParts(heading.text());
  if (!parts || (expected.title && parts.title !== expected.title)) issues.push('exact_course_title');
  const cell = headings.length === 1 ? contentCellForHeading($, heading) : null;
  if (!cell) issues.push('unique_course_content_cell');
  const creditLabels = cell ? cell.find('strong').filter((index, element) => (
    normalizedText($(element).text()) === 'Credits:'
  )) : [];
  if (creditLabels.length !== 1) issues.push('unique_credits_label');
  let publishedUnits = null;
  if (creditLabels.length === 1) {
    let creditText = '';
    for (const node of creditLabels[0].nextSibling ? [creditLabels[0].nextSibling] : []) {
      creditText += $(node).text();
    }
    publishedUnits = parsePublishedCredits(creditText);
    if (!publishedUnits) issues.push('published_credits');
  }
  if (issues.length) return { verified: false, issues, entries: [], missing: [target] };
  const clone = cell.clone();
  clone.find('.help_block,.acalog-social-media-links,.portfolio_link,.print_link').remove();
  clone.find('script,style').remove();
  clone.find('*').each((index, element) => $(element).append(' '));
  const cellText = normalizedText(clone.text());
  const start = cellText.indexOf(parts.text);
  const repeated = start >= 0 ? cellText.indexOf(parts.text, start + parts.text.length) : -1;
  const backToTop = cellText.indexOf('Back to Top', start + parts.text.length);
  if (start < 0 || repeated >= 0 || backToTop < 0) {
    return { verified: false, issues: ['course_record_text_boundary'], entries: [], missing: [target] };
  }
  const rawEntryText = cellText.slice(start, backToTop).trim();
  const rawEntryHtml = cell.html() || '';
  if (!rawEntryText.startsWith(`${parts.text} Credits:`)) {
    return { verified: false, issues: ['course_record_text_boundary'], entries: [], missing: [target] };
  }
  const clause = radfordRequiredClauseReceipt(rawEntryHtml, rawEntryText);
  if (!clause.verified) {
    return { verified: false, issues: clause.issues, entries: [], missing: [target] };
  }
  const preOrCorequisite = radfordPreOrCorequisiteClauseReceipt(rawEntryHtml, rawEntryText);
  if (!preOrCorequisite.verified) {
    return {
      verified: false, issues: preOrCorequisite.issues, entries: [], missing: [target],
    };
  }
  const formalRequisiteMarkerCount = [...rawEntryHtml.matchAll(
    /<strong>\s*(?:Prerequisites?|Pre-\s*or\s*Corequisites?|Corequisites?):\s*<\/strong>/gi,
  )].length;
  if (formalRequisiteMarkerCount !== Number(Boolean(clause.receipt))
      + Number(Boolean(preOrCorequisite.receipt))) {
    return {
      verified: false,
      issues: ['unaccounted_formal_requisite_marker'],
      entries: [],
      missing: [target],
    };
  }
  return {
    verified: true,
    issues: [],
    entries: [{
      course_code: target,
      catoid: RADFORD_CATOID,
      coid: expected.coid,
      heading_text: parts.text,
      title: parts.title,
      published_units: publishedUnits,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(rawEntryHtml),
      required_requisite_clause: clause.receipt,
      pre_or_corequisite_clause: preOrCorequisite.receipt,
      formal_requisite_marker_count: formalRequisiteMarkerCount,
    }],
    missing: [],
  };
}

module.exports = {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_PRE_OR_COREQUISITE_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_CATALOG_LABEL,
  RADFORD_CATALOG_YEAR,
  RADFORD_CATOID,
  RADFORD_CLOSURE_COURSE_RECORDS,
  RADFORD_COURSE_RECORDS,
  RADFORD_DIRECT_COURSE_RECORDS,
  RADFORD_DISCOVERY_CONTRACT,
  RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  RADFORD_HOST,
  RADFORD_PROGRAM_CACHE_PATH,
  RADFORD_PROGRAM_HTML_SHA256,
  RADFORD_SLUG,
  expectedCourseUrl,
  extractRadfordCourseEntry,
  headingParts,
  normalizeCode,
  normalizedText,
  parsePublishedCredits,
  radfordRequiredClauseReceipt,
  radfordPreOrCorequisiteClauseReceipt,
  sha256,
  verifyRadfordProgramDiscovery,
  verifyRadfordRetainedEntryDiscovery,
};
