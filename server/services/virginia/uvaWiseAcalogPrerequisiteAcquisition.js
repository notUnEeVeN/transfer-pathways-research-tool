const crypto = require('node:crypto');
const cheerio = require('cheerio');

const UVA_WISE_SLUG = 'the-university-of-virginia-s-college-at-wise';
const UVA_WISE_HOST = 'catalog.uvawise.edu';
const UVA_WISE_OWNER_NAMESPACE = 'va:uni:9226';
const UVA_WISE_CATALOG_YEAR = '2026-2027';
const UVA_WISE_CATALOG_LABEL = '2026-2027 UVA Wise Catalog';
const UVA_WISE_CATOID = 9;
const UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS = 120;
const UVA_WISE_PROGRAM_CACHE_PATH =
  'pages/the-university-of-virginia-s-college-at-wise__program.html';
const UVA_WISE_GE_CACHE_PATH =
  'pages/the-university-of-virginia-s-college-at-wise__ge.html';
const UVA_WISE_PROGRAM_HTML_SHA256 =
  'f0029d52ad30f4a795d79db032165ebb7e1c41f5742cb4753e3c55741002fd5e';
const UVA_WISE_GE_HTML_SHA256 =
  '2ff74991394f4720a462d9e6e4b0d7276febbffe554f3095181f79f5e5cf127e';
const UVA_WISE_BOUNDARY_CONTRACT =
  'uva_wise_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1';
const UVA_WISE_DISCOVERY_CONTRACT =
  'uva_wise_two_retained_source_exact_course_link_and_coid_v1';
const UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT =
  'uva_wise_hash_pinned_retained_course_entry_exact_link_and_coid_v1';
const UVA_WISE_CLAUSE_RECEIPT_CONTRACT =
  'uva_wise_acalog_strong_prerequisite_marker_first_br_to_next_br_exact_clause_v1';

// Every identity comes from one of the two complete, hash-pinned official
// pages already retained for the verified degree composition. The detail
// crawler never guesses a coid from a course-code search result.
const UVA_WISE_DIRECT_COURSE_RECORDS = Object.freeze({
  CSC1010: Object.freeze({ coid: 17962, title: 'Introduction to Programming in Python' }),
  CSC1180: Object.freeze({ coid: 17964, title: 'Foundations of Programming in C++' }),
  CSC2180: Object.freeze({ coid: 17965, title: 'Data Structures' }),
  CSC2300: Object.freeze({ coid: 17969, title: 'Software Engineering' }),
  CSC3180: Object.freeze({ coid: 17971, title: 'Introduction to Algorithms' }),
  CSC3400: Object.freeze({ coid: 17977, title: 'Database Design & Applications' }),
  CSC3710: Object.freeze({ coid: 17979, title: 'Discrete Structures' }),
  CSC4000: Object.freeze({ coid: 17983, title: 'Operating Systems: Theory/Practice' }),
  CSC4200: Object.freeze({ coid: 17986, title: 'Programming Languages' }),
  CSC4300: Object.freeze({ coid: 17990, title: 'Computer Architecture' }),
  CSC4350: Object.freeze({ coid: 17991, title: 'Computer Networks' }),
  CSC4990: Object.freeze({ coid: 17996, title: 'Computer Science Seminar' }),
  ENG1010: Object.freeze({ coid: 18055, title: 'Composition' }),
  ENG1020: Object.freeze({ coid: 18056, title: 'Composition' }),
  ENG1030: Object.freeze({ coid: 18057, title: 'Honors Composition' }),
  FRE1010: Object.freeze({ coid: 18135, title: 'Elementary French' }),
  FRE1020: Object.freeze({ coid: 18136, title: 'Elementary French' }),
  FRE1030: Object.freeze({ coid: 18137, title: 'Accelerated Elementary French' }),
  GER1010: Object.freeze({ coid: 18170, title: 'Elementary German' }),
  GER1020: Object.freeze({ coid: 18171, title: 'Elementary German' }),
  GER1030: Object.freeze({ coid: 18840, title: 'Accelerated Elementary German' }),
  MTH2040: Object.freeze({ coid: 18339, title: 'Calculus I' }),
  MTH2050: Object.freeze({ coid: 18340, title: 'Calculus II' }),
  MTH2180: Object.freeze({ coid: 18341, title: 'Applied Probability & Statistics' }),
  SEM1010: Object.freeze({ coid: 18716, title: 'Be Wise' }),
  SPA1010: Object.freeze({ coid: 18743, title: 'Elementary Spanish' }),
  SPA1020: Object.freeze({ coid: 18744, title: 'Elementary Spanish' }),
  SPA1030: Object.freeze({ coid: 18745, title: 'Accelerated Elementary Spanish' }),
  STA2180: Object.freeze({ coid: 18772, title: 'Applied Probability & Statistics' }),
  SWE1790: Object.freeze({ coid: 18773, title: 'Engineering Leadership' }),
  SWE2300: Object.freeze({ coid: 18774, title: 'Software Engineering' }),
});

const UVA_WISE_CLOSURE_COURSE_RECORDS = Object.freeze({
  MTH1010: Object.freeze({
    coid: 18331, title: 'College Algebra', discovery_course_code: 'CSC1180',
    discovery_cache_path: 'university-prerequisites/raw/the-university-of-virginia-s-college-at-wise/the-university-of-virginia-s-college-at-wise__csc1180.html',
    discovery_response_sha256: 'ecbfaf9c488dbe8cdfd7c2adff6e413877207cf7d23ebb6a1dde754904cd84e5',
  }),
  MTH1110: Object.freeze({
    coid: 18334, title: 'Precalculus I', discovery_course_code: 'CSC2180',
    discovery_cache_path: 'university-prerequisites/raw/the-university-of-virginia-s-college-at-wise/the-university-of-virginia-s-college-at-wise__csc2180.html',
    discovery_response_sha256: '321c6211d3e8bddda50228f5a24678f769f866e7dd4f4b576f7ea63ee1815a23',
  }),
  MTH1210: Object.freeze({
    coid: 18337, title: 'Precalculus II', discovery_course_code: 'MTH2040',
    discovery_cache_path: 'university-prerequisites/raw/the-university-of-virginia-s-college-at-wise/the-university-of-virginia-s-college-at-wise__mth2040.html',
    discovery_response_sha256: 'bcc0e5bc6bd79a4506ef2df7617c4281686f702ec98ae32dcbd17e54224ca726',
  }),
});
const UVA_WISE_COURSE_RECORDS = Object.freeze({
  ...UVA_WISE_DIRECT_COURSE_RECORDS,
  ...UVA_WISE_CLOSURE_COURSE_RECORDS,
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const normalizedText = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function expectedCourseUrl(code) {
  const record = UVA_WISE_COURSE_RECORDS[normalizeCode(code)];
  return record
    ? `http://${UVA_WISE_HOST}/preview_course_nopop.php?catoid=${UVA_WISE_CATOID}&coid=${record.coid}`
    : null;
}

function verifyUvaWiseRetainedEntryDiscovery(html, targetCode) {
  const target = normalizeCode(targetCode);
  const expected = UVA_WISE_CLOSURE_COURSE_RECORDS[target];
  if (!target || !expected) return {
    verified: false, issues: ['unsupported_closure_target'], links: [],
  };
  const bytes = Buffer.from(String(html || ''));
  const issues = [];
  if (sha256(bytes) !== expected.discovery_response_sha256) issues.push('discovery_html_sha256');
  const $ = cheerio.load(bytes.toString('utf8'));
  if (normalizedText($('#acalog-catalog-name').text()) !== UVA_WISE_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const matches = $('a[href*="preview_course_nopop.php"]')
    .map((index, element) => {
      const linkCode = normalizeCode($(element).text());
      if (linkCode !== target) return null;
      const href = String($(element).attr('href') || '');
      let url;
      try { url = new URL(href, `http://${UVA_WISE_HOST}/`); } catch { return null; }
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
  const displayCode = target.replace(/([A-Z]+)(\d)/, '$1 $2');
  if (link && (link.catoid !== UVA_WISE_CATOID || link.coid !== expected.coid
      || link.link_text !== displayCode
      || link.aria_label !== `View course details for ${displayCode}`)) {
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
  const notation = normalizedText(text).replace(/^\((.*)\)$/, '$1');
  const match = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/.exec(notation);
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

function discoveryLinks(html, source) {
  const $ = cheerio.load(String(html || ''));
  return $('a[onclick*="showCourse"]')
    .map((index, element) => {
      const heading = headingParts($(element).text());
      const onclick = String($(element).attr('onclick') || '');
      const identity = /showCourse\('([0-9]+)',\s*'([0-9]+)'/.exec(onclick);
      if (!heading || !identity) return null;
      return {
        course_code: heading.code,
        title: heading.title,
        catoid: Number(identity[1]),
        coid: Number(identity[2]),
        source,
        link_text: heading.text,
        onclick_sha256: sha256(onclick),
      };
    }).get().filter(Boolean);
}

function verifyUvaWiseDiscovery({ programHtml, geHtml } = {}, targetCodes = []) {
  const issues = [];
  const sources = [
    { id: 'program', html: String(programHtml || ''), hash: UVA_WISE_PROGRAM_HTML_SHA256 },
    { id: 'general_education', html: String(geHtml || ''), hash: UVA_WISE_GE_HTML_SHA256 },
  ];
  for (const source of sources) {
    if (sha256(Buffer.from(source.html)) !== source.hash) issues.push(`${source.id}_html_sha256`);
    const $ = cheerio.load(source.html);
    if (normalizedText($('#acalog-catalog-name').text()) !== UVA_WISE_CATALOG_LABEL) {
      issues.push(`${source.id}_catalog_label`);
    }
  }
  const allLinks = sources.flatMap((source) => discoveryLinks(source.html, source.id));
  const links = [];
  for (const requested of targetCodes || []) {
    const code = normalizeCode(requested);
    const expected = UVA_WISE_DIRECT_COURSE_RECORDS[code];
    if (!expected) {
      issues.push(`${code || requested}:unsupported_target`);
      continue;
    }
    const matches = allLinks.filter((row) => row.course_code === code);
    const identities = new Map(matches.map((row) => [
      `${row.catoid}:${row.coid}:${row.link_text}`,
      row,
    ]));
    if (identities.size !== 1) {
      issues.push(`${code}:unique_discovery_identity`);
      continue;
    }
    const link = [...identities.values()][0];
    if (link.catoid !== UVA_WISE_CATOID || link.coid !== expected.coid
        || link.title !== expected.title) issues.push(`${code}:discovery_identity`);
    links.push({
      ...link,
      discovery_sources: [...new Set(matches.map((row) => row.source))].sort(),
    });
  }
  return { verified: issues.length === 0, issues, links };
}

function contentCellForHeading($, heading) {
  const cells = heading.parents('td.block_content');
  return cells.length === 1 ? cells.first() : null;
}

function requiredClauseReceipt(rawEntryHtml, rawEntryText) {
  const html = String(rawEntryHtml || '');
  const markers = [...html.matchAll(
    /<strong>\s*(Prerequisite(?:\(s\)|s)?)\s*<\/strong>\s*<br\s*\/?\s*>/gi,
  )];
  if (!markers.length) return { verified: true, issues: [], receipt: null };
  if (markers.length !== 1) return {
    verified: false, issues: ['unique_prerequisite_marker'], receipt: null,
  };
  const marker = markers[0];
  const start = marker.index + marker[0].length;
  const terminal = /<br\s*\/?\s*>/ig;
  terminal.lastIndex = start;
  const endMatch = terminal.exec(html);
  if (!endMatch) return { verified: false, issues: ['prerequisite_first_br_boundary'], receipt: null };
  const clauseHtml = html.slice(start, endMatch.index);
  const fragment = cheerio.load(`<div id="receipt">${clauseHtml}</div>`);
  fragment('#receipt [style*="display: none"]').remove();
  fragment('#receipt *').each((index, element) => fragment(element).append(' '));
  const raw = normalizedText(fragment('#receipt').text());
  if (!raw) return { verified: false, issues: ['prerequisite_clause_empty'], receipt: null };
  const label = marker[1];
  const statementStart = rawEntryText.indexOf(label);
  if (statementStart < 0
      || rawEntryText.indexOf(label, statementStart + label.length) >= 0) {
    return { verified: false, issues: ['prerequisite_statement_projection'], receipt: null };
  }
  const afterLabel = statementStart + label.length;
  const relativeStart = rawEntryText.indexOf(raw, afterLabel);
  if (relativeStart < 0
      || normalizedText(rawEntryText.slice(afterLabel, relativeStart)) !== '') {
    return { verified: false, issues: ['prerequisite_text_projection'], receipt: null };
  }
  return {
    verified: true,
    issues: [],
    receipt: {
      receipt_contract: UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
      kind: 'prerequisite',
      label,
      raw,
      raw_sha256: sha256(raw),
      relative_start: relativeStart,
      relative_end: relativeStart + raw.length,
      statement_relative_start: statementStart,
      statement_relative_end: relativeStart + raw.length,
      raw_html_sha256: sha256(clauseHtml),
      boundary_terminal: 'next_br_after_unique_strong_prerequisite_marker_and_first_br',
    },
  };
}

function extractUvaWiseCourseEntry(html, targetCode, { finalUrl } = {}) {
  const target = normalizeCode(targetCode);
  const expected = UVA_WISE_COURSE_RECORDS[target];
  if (!target || !expected) {
    return { verified: false, issues: ['unsupported_target_course_code'], entries: [], missing: [] };
  }
  const issues = [];
  let url;
  try { url = new URL(finalUrl || expectedCourseUrl(target)); } catch { /* checked below */ }
  if (url?.protocol !== 'http:' || url?.hostname.toLowerCase() !== UVA_WISE_HOST
      || url?.pathname !== '/preview_course_nopop.php'
      || Number(url.searchParams.get('catoid')) !== UVA_WISE_CATOID
      || Number(url.searchParams.get('coid')) !== expected.coid) issues.push('course_url_identity');
  const $ = cheerio.load(String(html || ''));
  if (normalizedText($('#acalog-catalog-name').text()) !== UVA_WISE_CATALOG_LABEL) {
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
    /^(?:Credit\(s\)|Credits):?$/.test(normalizedText($(element).text()))
  )) : [];
  if (creditLabels.length !== 1) issues.push('unique_credits_label');
  let publishedUnits = null;
  if (creditLabels.length === 1) {
    const creditText = normalizedText($(creditLabels[0]).next('strong').first().text()
      || $(creditLabels[0].nextSibling).text());
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
  if (!rawEntryText.startsWith(`${parts.text} Credit`)) {
    return { verified: false, issues: ['course_record_text_boundary'], entries: [], missing: [target] };
  }
  const clause = requiredClauseReceipt(rawEntryHtml, rawEntryText);
  if (!clause.verified) {
    return { verified: false, issues: clause.issues, entries: [], missing: [target] };
  }
  return {
    verified: true,
    issues: [],
    entries: [{
      course_code: target,
      catoid: UVA_WISE_CATOID,
      coid: expected.coid,
      heading_text: parts.text,
      title: parts.title,
      published_units: publishedUnits,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(rawEntryHtml),
      required_requisite_clause: clause.receipt,
    }],
    missing: [],
  };
}

module.exports = {
  UVA_WISE_BOUNDARY_CONTRACT,
  UVA_WISE_CATOID,
  UVA_WISE_CLOSURE_COURSE_RECORDS,
  UVA_WISE_COURSE_RECORDS,
  UVA_WISE_CATALOG_LABEL,
  UVA_WISE_CATALOG_YEAR,
  UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
  UVA_WISE_DIRECT_COURSE_RECORDS,
  UVA_WISE_DISCOVERY_CONTRACT,
  UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  UVA_WISE_GE_CACHE_PATH,
  UVA_WISE_GE_HTML_SHA256,
  UVA_WISE_HOST,
  UVA_WISE_OWNER_NAMESPACE,
  UVA_WISE_PROGRAM_CACHE_PATH,
  UVA_WISE_PROGRAM_HTML_SHA256,
  UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
  UVA_WISE_SLUG,
  expectedCourseUrl,
  extractUvaWiseCourseEntry,
  headingParts,
  normalizeCode,
  normalizedText,
  parsePublishedCredits,
  requiredClauseReceipt,
  sha256,
  verifyUvaWiseDiscovery,
  verifyUvaWiseRetainedEntryDiscovery,
};
