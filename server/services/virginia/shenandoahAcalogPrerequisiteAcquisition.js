const crypto = require('node:crypto');
const cheerio = require('cheerio');

const SHENANDOAH_SLUG = 'shenandoah-university';
const SHENANDOAH_HOST = 'catalog.su.edu';
const SHENANDOAH_OWNER_NAMESPACE = 'va:uni:9224';
const SHENANDOAH_CATALOG_YEAR = '2025-2026';
const SHENANDOAH_CATALOG_LABEL = '2025-2026 Undergraduate Catalog';
const SHENANDOAH_CATOID = 33;
const SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS = 120;
const SHENANDOAH_PROGRAM_CACHE_PATH = 'pages/shenandoah-university__program.html';
const SHENANDOAH_PROGRAM_HTML_SHA256 =
  '5708d035d19423df5e756e45d9b2068b162ca0f774aa79203cdec63dd3344c84';
const SHENANDOAH_COURSE_CATALOG_CACHE_PATH =
  'pages/shenandoah-university__course_catalog.html';
const SHENANDOAH_COURSE_CATALOG_HTML_SHA256 =
  'd082e72e1fb16b8817b888bff80ea394bf795cf6cc2032c21941e4e21ba79a49';
const SHENANDOAH_BOUNDARY_CONTRACT =
  'shenandoah_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1';
const SHENANDOAH_DISCOVERY_CONTRACT =
  'shenandoah_retained_current_program_exact_course_link_and_coid_v1';
const SHENANDOAH_FILTER_DISCOVERY_CONTRACT =
  'shenandoah_retained_current_course_descriptions_form_and_exact_filtered_link_v1';
const SHENANDOAH_CLAUSE_RECEIPT_CONTRACT =
  'shenandoah_acalog_exact_terminal_prerequisite_field_to_closing_p_v2';

// The original fourteen identities are reproduced from the hash-pinned
// 2025-2026 program source. ENG 101 and FYS 101 are instead bound to exact
// current-catalog prefix/number filter responses with retained HTTP 202→200
// browser receipts. INT 101 and MATH 102 are prerequisite-closure identities
// discovered through the same path; obsolete course-map links remain
// inadmissible for all four.
const SHENANDOAH_DIRECT_COURSE_RECORDS = Object.freeze({
  CSC121: Object.freeze({ coid: 55161, title: 'Introduction to Computer Programming I' }),
  CSC122: Object.freeze({ coid: 55149, title: 'Introduction to Computer Programming II' }),
  CSC210: Object.freeze({ coid: 55189, title: 'Data Structures' }),
  CSC301: Object.freeze({ coid: 55188, title: 'Introduction to Networking' }),
  CSC310: Object.freeze({ coid: 55430, title: 'Computer Architecture' }),
  CSC403: Object.freeze({ coid: 55187, title: 'Operating Systems' }),
  CSC407: Object.freeze({ coid: 55428, title: 'Software Design' }),
  CSC410: Object.freeze({ coid: 55183, title: 'Introduction to Databases' }),
  CSC430: Object.freeze({ coid: 55429, title: 'Programming Languages' }),
  CSC480: Object.freeze({ coid: 55435, title: 'Research in Computer Science' }),
  ENG101: Object.freeze({
    coid: 54326,
    title: 'Composition',
    discovery_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
    discovery_cache_path:
      'university-prerequisites/raw/shenandoah-university/shenandoah-university__eng101_discovery.html',
    discovery_response_sha256:
      'ef907d9ff2317642b50e7c46b1ecd5c0d92f49cd41cf3e4d3ec1d92dabcb22f1',
  }),
  FYS101: Object.freeze({
    coid: 54418,
    title: 'Going Global First-Year Seminar',
    discovery_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
    discovery_cache_path:
      'university-prerequisites/raw/shenandoah-university/shenandoah-university__fys101_discovery.html',
    discovery_response_sha256:
      'a51bf0d5fdbc732da2b5356d19cb22d0ab8e1d39cd79a08f83edcbbae507a1f0',
  }),
  INT101: Object.freeze({
    coid: 55320,
    title: 'Introduction to Computing Fundamentals',
    discovery_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
    discovery_cache_path:
      'university-prerequisites/raw/shenandoah-university/shenandoah-university__int101_discovery.html',
    discovery_response_sha256:
      'c3722be423c803d43b7db611c980780e643fef2841bbf69d53062bc8633e9748',
  }),
  MATH101: Object.freeze({
    coid: 54576,
    title: 'College Algebra',
    discovery_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
    discovery_cache_path:
      'university-prerequisites/raw/shenandoah-university/shenandoah-university__math101_discovery.html',
    discovery_response_sha256:
      '6c2fdb804af9be52273ea0a5691f219c94467c41881abc73f24dbd8b7af7a19a',
  }),
  MATH102: Object.freeze({
    coid: 54577,
    title: 'Precalculus',
    discovery_contract: SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
    discovery_cache_path:
      'university-prerequisites/raw/shenandoah-university/shenandoah-university__math102_discovery.html',
    discovery_response_sha256:
      'fa31a58085372087d4f1561af89254b6c10eb96765ca63c8ab1f6f0f190ae5a5',
  }),
  MATH201: Object.freeze({ coid: 54578, title: 'Calculus and Analytic Geometry I' }),
  MATH202: Object.freeze({ coid: 54579, title: 'Calculus and Analytic Geometry II' }),
  MATH209: Object.freeze({ coid: 54582, title: 'Discrete Math' }),
  MATH370: Object.freeze({ coid: 54590, title: 'Numerical Analysis' }),
});

const SHENANDOAH_FILTER_DISCOVERY_TARGETS = Object.freeze({
  ENG101: Object.freeze({ prefix: 'ENG', number: '101', title: 'Composition' }),
  FYS101: Object.freeze({
    prefix: 'FYS', number: '101', title: 'Going Global First-Year Seminar',
  }),
  INT101: Object.freeze({ prefix: 'INT', number: '101', title: null }),
  MATH101: Object.freeze({ prefix: 'MATH', number: '101', title: null }),
  MATH102: Object.freeze({ prefix: 'MATH', number: '102', title: null }),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const normalizedText = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function headingParts(value) {
  const text = normalizedText(value);
  const match = /^([A-Z]{2,8})\s+(\d{2,4}[A-Z]?)\s*(?:-|\u2013|\u2014)?\s*(.+)$/.exec(text);
  return match ? { code: normalizeCode(`${match[1]}${match[2]}`), title: match[3], text } : null;
}

function expectedCourseUrl(code) {
  const record = SHENANDOAH_DIRECT_COURSE_RECORDS[normalizeCode(code)];
  return record
    ? `https://${SHENANDOAH_HOST}/preview_course_nopop.php?catoid=${SHENANDOAH_CATOID}&coid=${record.coid}`
    : null;
}

function expectedFilterDiscoveryUrl(code) {
  const target = SHENANDOAH_FILTER_DISCOVERY_TARGETS[normalizeCode(code)];
  if (!target) return null;
  const url = new URL(`https://${SHENANDOAH_HOST}/content.php`);
  url.searchParams.set('catoid', String(SHENANDOAH_CATOID));
  url.searchParams.set('navoid', '1985');
  url.searchParams.set('filter[item_type]', '3');
  url.searchParams.set('filter[only_active]', '1');
  url.searchParams.set('filter[27]', target.prefix);
  url.searchParams.set('filter[29]', target.number);
  url.searchParams.set('filter[course_type]', '-1');
  url.searchParams.set('filter[keyword]', '');
  url.searchParams.set('filter[32]', '1');
  url.searchParams.set('filter[cpage]', '1');
  url.searchParams.set('cur_cat_oid', String(SHENANDOAH_CATOID));
  url.searchParams.set('expand', '');
  url.searchParams.set('filter[exact_match]', '1');
  url.searchParams.set('search_database', 'Filter');
  return url.href;
}

function discoveryLinks(html) {
  const $ = cheerio.load(String(html || ''));
  return $('a[onclick*="showCourse"]')
    .map((index, element) => {
      const heading = headingParts($(element).text());
      const onclick = String($(element).attr('onclick') || '');
      const identity = /showCourse\('([0-9]+)',\s*'([0-9]+)'/.exec(onclick);
      return heading && identity ? {
        course_code: heading.code,
        title: heading.title,
        catoid: Number(identity[1]),
        coid: Number(identity[2]),
        link_text: heading.text,
        onclick_sha256: sha256(onclick),
      } : null;
    }).get().filter(Boolean);
}

function verifyShenandoahProgramDiscovery(html, targetCodes = []) {
  const bytes = Buffer.from(String(html || ''));
  const issues = [];
  if (sha256(bytes) !== SHENANDOAH_PROGRAM_HTML_SHA256) issues.push('program_html_sha256');
  const $ = cheerio.load(bytes.toString('utf8'));
  if (normalizedText($('#acalog-catalog-name').text()) !== SHENANDOAH_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const available = discoveryLinks(bytes.toString('utf8'));
  const links = [];
  for (const requested of targetCodes) {
    const code = normalizeCode(requested);
    const expected = SHENANDOAH_DIRECT_COURSE_RECORDS[code];
    if (!expected || expected.discovery_contract === SHENANDOAH_FILTER_DISCOVERY_CONTRACT) {
      issues.push(`${code || requested}:unsupported_target`);
      continue;
    }
    const matches = available.filter((row) => row.course_code === code);
    const unique = new Map(matches.map((row) => [
      `${row.catoid}:${row.coid}:${row.link_text}`, row,
    ]));
    if (unique.size !== 1) {
      issues.push(`${code}:unique_program_link`);
      continue;
    }
    const link = [...unique.values()][0];
    if (link.catoid !== SHENANDOAH_CATOID || link.coid !== expected.coid
        || link.title !== expected.title) issues.push(`${code}:program_link_identity`);
    links.push(link);
  }
  return { verified: issues.length === 0, issues, links };
}

function verifyShenandoahCourseCatalogFilterForm(html) {
  const bytes = Buffer.from(String(html || ''));
  const $ = cheerio.load(bytes.toString('utf8'));
  const issues = [];
  if (sha256(bytes) !== SHENANDOAH_COURSE_CATALOG_HTML_SHA256) {
    issues.push('course_catalog_html_sha256');
  }
  if (normalizedText($('#acalog-catalog-name').text()) !== SHENANDOAH_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const form = $('form#course_search');
  if (form.length !== 1
      || new URL(form.attr('action'), `https://${SHENANDOAH_HOST}`).pathname !== '/content.php'
      || form.attr('method')?.toLowerCase() !== 'get'
      || form.find('select[name="filter[27]"]').length !== 1
      || form.find('input[name="filter[29]"]').length !== 1
      || form.find('input[name="filter[exact_match]"][value="1"]').length !== 1
      || form.find('input[name="cur_cat_oid"][value="33"]').length !== 1
      || form.find('input[name="navoid"][value="1985"]').length !== 1) {
    issues.push('exact_course_filter_form');
  }
  for (const target of Object.values(SHENANDOAH_FILTER_DISCOVERY_TARGETS)) {
    if (form.find(`select[name="filter[27]"] option[value="${target.prefix}"]`).length !== 1) {
      issues.push(`${target.prefix}:filter_prefix`);
    }
  }
  return { verified: issues.length === 0, issues };
}

function extractShenandoahFilteredDiscovery(html, targetCode, { finalUrl } = {}) {
  const code = normalizeCode(targetCode);
  const target = SHENANDOAH_FILTER_DISCOVERY_TARGETS[code];
  const issues = [];
  if (!target) return { verified: false, issues: ['unsupported_filter_target'], link: null };
  let url = null;
  try { url = new URL(finalUrl || expectedFilterDiscoveryUrl(code)); } catch { /* below */ }
  const expectedUrl = new URL(expectedFilterDiscoveryUrl(code));
  for (const [key, value] of expectedUrl.searchParams.entries()) {
    if (url?.searchParams.get(key) !== value) issues.push(`filter_url:${key}`);
  }
  if (url?.protocol !== 'https:' || url?.hostname.toLowerCase() !== SHENANDOAH_HOST
      || url?.pathname !== '/content.php') issues.push('filter_url_identity');
  const $ = cheerio.load(String(html || ''));
  if (normalizedText($('#acalog-catalog-name').text()) !== SHENANDOAH_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const selectedPrefix = $('select[name="filter[27]"] option[selected]').attr('value')
    || $('select[name="filter[27]"]').val();
  const selectedNumber = $('input[name="filter[29]"]').attr('value');
  if (selectedPrefix !== target.prefix || selectedNumber !== target.number) {
    issues.push('echoed_exact_filter');
  }
  const matches = $('a[href*="preview_course_nopop.php"],a[onclick*="showCourse"]')
    .map((index, element) => {
      const heading = headingParts($(element).text());
      if (heading?.code !== code || (target.title && heading.title !== target.title)) return null;
      let catoid = null;
      let coid = null;
      const href = $(element).attr('href');
      try {
        const linkUrl = new URL(href, `https://${SHENANDOAH_HOST}`);
        catoid = Number(linkUrl.searchParams.get('catoid'));
        coid = Number(linkUrl.searchParams.get('coid'));
      } catch { /* onclick fallback below */ }
      const onclick = String($(element).attr('onclick') || '');
      const identity = /showCourse\('([0-9]+)',\s*'([0-9]+)'/.exec(onclick);
      if (identity) {
        if (catoid != null && catoid !== Number(identity[1])) return null;
        if (coid != null && coid !== Number(identity[2])) return null;
        catoid = Number(identity[1]);
        coid = Number(identity[2]);
      }
      return Number.isInteger(coid) && coid > 0 ? {
        course_code: code,
        title: heading.title,
        catoid,
        coid,
        link_text: heading.text,
        href: href || null,
        href_sha256: sha256(href || ''),
        onclick_sha256: sha256(onclick),
      } : null;
    }).get().filter(Boolean);
  const unique = new Map(matches.map((row) => [`${row.catoid}:${row.coid}:${row.link_text}`, row]));
  if (unique.size !== 1) issues.push('unique_exact_filtered_course_link');
  const link = unique.size === 1 ? [...unique.values()][0] : null;
  if (link?.catoid !== SHENANDOAH_CATOID) issues.push('filtered_link_catoid');
  return { verified: issues.length === 0, issues, link };
}

function contentCellForHeading($, heading) {
  const cells = heading.parents('td.block_content');
  return cells.length === 1 ? cells.first() : null;
}

function parsePublishedCredits(rawEntryText) {
  const matches = [...String(rawEntryText || '').matchAll(
    /\bCredit\(s\):\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\b/g,
  )];
  if (matches.length !== 1) return null;
  const minimum = Number(matches[0][1]);
  const maximum = Number(matches[0][2] || matches[0][1]);
  if (!(minimum > 0) || maximum < minimum) return null;
  return {
    kind: matches[0][2] ? 'published_variable_credit_range' : 'published_fixed_credits',
    notation: matches[0][0],
    credit_hours_min: minimum,
    credit_hours_max: maximum,
  };
}

function requiredClauseReceipt(rawEntryHtml, rawEntryText) {
  const html = String(rawEntryHtml || '');
  // Shenandoah's Acalog entries may repeat an informal "Prerequisite:" in
  // the description. Only the vendor's terminal structured
  // "Prerequisite(s): ... </p>" field is accepted. Acalog inserts <br>
  // elements as display line wraps inside a field, so the first <br> is not a
  // semantic boundary (MATH 102 is a retained counterexample).
  const markers = [...html.matchAll(/Prerequisite\(s\):\s*/gi)];
  if (!markers.length) return { verified: true, issues: [], receipt: null };
  if (markers.length !== 1) return {
    verified: false, issues: ['unique_structured_prerequisite_marker'], receipt: null,
  };
  const marker = markers[0];
  const start = marker.index + marker[0].length;
  const terminal = /<\/p\s*>/ig;
  terminal.lastIndex = start;
  const endMatch = terminal.exec(html);
  if (!endMatch) return {
    verified: false, issues: ['structured_prerequisite_closing_p_boundary'], receipt: null,
  };
  const clauseHtml = html.slice(start, endMatch.index);
  const fragment = cheerio.load(`<div id="receipt">${clauseHtml}</div>`);
  fragment('#receipt [style*="display: none"]').remove();
  fragment('#receipt *').each((index, element) => fragment(element).append(' '));
  const raw = normalizedText(fragment('#receipt').text());
  if (!raw) return { verified: false, issues: ['prerequisite_clause_empty'], receipt: null };
  const statement = `Prerequisite(s): ${raw}`;
  const statementStart = rawEntryText.indexOf(statement);
  if (statementStart < 0
      || rawEntryText.indexOf(statement, statementStart + statement.length) >= 0) {
    return { verified: false, issues: ['prerequisite_statement_projection'], receipt: null };
  }
  const relativeStart = statementStart + 'Prerequisite(s): '.length;
  return {
    verified: true,
    issues: [],
    receipt: {
      receipt_contract: SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
      kind: 'prerequisite',
      label: 'Prerequisite(s)',
      raw,
      raw_sha256: sha256(raw),
      relative_start: relativeStart,
      relative_end: relativeStart + raw.length,
      statement_relative_start: statementStart,
      statement_relative_end: relativeStart + raw.length,
      raw_html_sha256: sha256(clauseHtml),
      boundary_terminal: 'closing_p_after_unique_terminal_prerequisite_parenthetical_marker',
    },
  };
}

function extractShenandoahCourseEntry(html, targetCode, { finalUrl } = {}) {
  const target = normalizeCode(targetCode);
  const expected = SHENANDOAH_DIRECT_COURSE_RECORDS[target];
  if (!target || !expected) return {
    verified: false, issues: ['unsupported_target_course_code'], entries: [], missing: [],
  };
  const issues = [];
  let url;
  try { url = new URL(finalUrl || expectedCourseUrl(target)); } catch { /* checked below */ }
  if (url?.protocol !== 'https:' || url?.hostname.toLowerCase() !== SHENANDOAH_HOST
      || url?.pathname !== '/preview_course_nopop.php'
      || Number(url.searchParams.get('catoid')) !== SHENANDOAH_CATOID
      || Number(url.searchParams.get('coid')) !== expected.coid) issues.push('course_url_identity');
  const $ = cheerio.load(String(html || ''));
  if (normalizedText($('#acalog-catalog-name').text()) !== SHENANDOAH_CATALOG_LABEL) {
    issues.push('catalog_label');
  }
  const headings = $('h1#course_preview_title').filter((index, element) => (
    headingParts($(element).text())?.code === target
  ));
  if (headings.length !== 1) issues.push('unique_exact_course_heading');
  const heading = headings.first();
  const parts = headingParts(heading.text());
  if (!parts || parts.title !== expected.title) issues.push('exact_course_title');
  const cell = headings.length === 1 ? contentCellForHeading($, heading) : null;
  if (!cell) issues.push('unique_course_content_cell');
  if (issues.length) return { verified: false, issues, entries: [], missing: [target] };
  const clone = cell.clone();
  clone.find('.help_block,.acalog-social-media-links,.portfolio_link,.print_link').remove();
  clone.find('script,style').remove();
  clone.find('*').each((index, element) => clone.find(element).append(' '));
  const cellText = normalizedText(clone.text());
  const start = cellText.indexOf(parts.text);
  const repeated = start >= 0 ? cellText.indexOf(parts.text, start + parts.text.length) : -1;
  const backToTop = cellText.indexOf('Back to Top', start + parts.text.length);
  if (start < 0 || repeated >= 0 || backToTop < 0) return {
    verified: false, issues: ['course_record_text_boundary'], entries: [], missing: [target],
  };
  const rawEntryText = cellText.slice(start, backToTop).trim();
  const rawEntryHtml = cell.html() || '';
  const publishedUnits = parsePublishedCredits(rawEntryText);
  if (!publishedUnits) return {
    verified: false, issues: ['published_credits'], entries: [], missing: [target],
  };
  const clause = requiredClauseReceipt(rawEntryHtml, rawEntryText);
  if (!clause.verified) return {
    verified: false, issues: clause.issues, entries: [], missing: [target],
  };
  const formalCorequisiteMarkerCount = (
    rawEntryHtml.match(/Corequisite\(s\):/gi) || []
  ).length;
  return {
    verified: true,
    issues: [],
    entries: [{
      course_code: target,
      catoid: SHENANDOAH_CATOID,
      coid: expected.coid,
      heading_text: parts.text,
      title: parts.title,
      published_units: publishedUnits,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(rawEntryHtml),
      required_requisite_clause: clause.receipt,
      formal_corequisite_marker_count: formalCorequisiteMarkerCount,
    }],
    missing: [],
  };
}

module.exports = {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CATALOG_LABEL,
  SHENANDOAH_CATALOG_YEAR,
  SHENANDOAH_CATOID,
  SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
  SHENANDOAH_COURSE_CATALOG_CACHE_PATH,
  SHENANDOAH_COURSE_CATALOG_HTML_SHA256,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_FILTER_DISCOVERY_CONTRACT,
  SHENANDOAH_FILTER_DISCOVERY_TARGETS,
  SHENANDOAH_HOST,
  SHENANDOAH_OWNER_NAMESPACE,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_PROGRAM_HTML_SHA256,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  SHENANDOAH_SLUG,
  discoveryLinks,
  expectedCourseUrl,
  expectedFilterDiscoveryUrl,
  extractShenandoahCourseEntry,
  extractShenandoahFilteredDiscovery,
  headingParts,
  normalizeCode,
  normalizedText,
  parsePublishedCredits,
  requiredClauseReceipt,
  sha256,
  verifyShenandoahProgramDiscovery,
  verifyShenandoahCourseCatalogFilterForm,
};
