const crypto = require('node:crypto');
const cheerio = require('cheerio');

const LONGWOOD_SLUG = 'longwood-university';
const LONGWOOD_DEPARTMENT_HOST = 'www.longwood.edu';
const LONGWOOD_DEPARTMENT_PATH = '/computerscience/computer-science-course-listing';
const LONGWOOD_DEPARTMENT_URL =
  `https://${LONGWOOD_DEPARTMENT_HOST}${LONGWOOD_DEPARTMENT_PATH}/`;
const LONGWOOD_DIRECT_CMSC_TARGETS = Object.freeze([
  'CMSC140',
  'CMSC160',
  'CMSC161',
  'CMSC162',
  'CMSC201',
  'CMSC208',
  'CMSC210',
  'CMSC242',
  'CMSC262',
  'CMSC280',
  'CMSC283',
  'CMSC442',
  'CMSC461',
  'CMSC483',
]);
// These are not rewritten into the authored degree composition.  The exact
// Longwood figure evaluator selects them as one deterministic legal path
// through the open 12-credit major-elective menu, so their prerequisite rows
// are required alongside the direct named course set.
const LONGWOOD_DETERMINISTIC_CMSC_TARGETS = Object.freeze([
  'CMSC360',
  'CMSC415',
  'CMSC455',
]);
const LONGWOOD_BOUNDARY_CONTRACT =
  'longwood_department_unique_course_listing_entry_with_published_credits_v1';
const LONGWOOD_CATALOG_CONTEXT_CONTRACT =
  'longwood_acalog_selected_undergraduate_catalog_year_and_catoid_v1';
const LONGWOOD_CATALOG_CONTEXT_YEAR = '2026-2027';
const LONGWOOD_CATALOG_CONTEXT_CATOID = 19;
const LONGWOOD_CATALOG_CONTEXT_URL =
  'https://catalog.longwood.edu/content.php?catoid=19&navoid=975';
const LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH =
  'pages/longwood-university__course_catalog.html';
const LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH =
  'pages/longwood-university__course_catalog.txt';
const LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256 =
  '7a8378f7e9249dce4f138e5fa62c487853ce3ca2c2a044ef8cb80c2ab248d36a';
const LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY =
  'department_course_text_from_unversioned_first_party_page_bound_to_separately_retained_2026_2027_catoid_19_catalog_context';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function normalizedText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2212\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function canonicalPath($) {
  const values = $('link[rel="canonical"]')
    .map((index, element) => $(element).attr('href')).get().filter(Boolean);
  if (values.length !== 1) return null;
  try {
    const url = new URL(values[0], LONGWOOD_DEPARTMENT_URL);
    if (url.protocol !== 'https:'
        || url.hostname.toLowerCase() !== LONGWOOD_DEPARTMENT_HOST) return null;
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    return null;
  }
}

function publishedCredits(text) {
  const matches = [...normalizedText(text).matchAll(/\b(\d+(?:\s*-\s*\d+)?)\s+credits?\b/gi)];
  if (matches.length !== 1) return null;
  const notation = matches[0][1].replace(/\s+/g, '');
  const values = notation.split('-').map(Number);
  const minimum = values[0];
  const maximum = values.length === 2 ? values[1] : values[0];
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)
      || minimum < 0 || maximum < minimum) return null;
  return {
    kind: minimum === maximum ? 'published_fixed_credits' : 'published_variable_credits',
    notation,
    credit_hours_min: minimum,
    credit_hours_max: maximum,
  };
}

/**
 * The catalog landing page is retained separately from the department page.
 * It proves the selected catalog edition and catoid, but does not pretend the
 * unversioned department URL itself printed an edition.
 */
function verifyLongwoodCatalogContext(html, expectedYear, expectedCatoid = 19) {
  const $ = cheerio.load(String(html || ''));
  const year = String(expectedYear || '');
  const catoid = String(expectedCatoid || '');
  const issues = [];
  const selected = $('#select_catalog option[selected]');
  if (selected.length !== 1
      || normalizedText(selected.text()) !== `${year} Undergraduate Catalog`
      || String(selected.attr('value')) !== catoid) {
    issues.push('selected_catalog_year_and_catoid');
  }
  if (normalizedText($('#acalog-catalog-name').text()) !== `${year} Undergraduate Catalog`) {
    issues.push('hidden_catalog_name');
  }
  const visibleNames = $('.acalog_catalog_name')
    .map((index, element) => normalizedText($(element).text())).get();
  if (visibleNames.length !== 1 || visibleNames[0] !== `${year} Undergraduate Catalog`) {
    issues.push('visible_catalog_name');
  }
  const headings = $('h1#acalog-page-title')
    .map((index, element) => normalizedText($(element).text())).get();
  if (headings.length !== 1 || headings[0] !== 'Course Descriptions') {
    issues.push('course_descriptions_heading');
  }
  const form = $('form#course_search');
  const action = String(form.attr('action') || '');
  if (form.length !== 1 || !action.includes(`catoid=${catoid}`)) {
    issues.push('catalog_course_filter_identity');
  }
  const relevant = [
    normalizedText(selected.text()),
    selected.attr('value') || '',
    normalizedText($('#acalog-catalog-name').text()),
    visibleNames.join('|'),
    headings.join('|'),
    action,
  ].join('\n');
  return {
    verified: issues.length === 0,
    issues,
    catalog_year: issues.length ? null : year,
    catoid: issues.length ? null : Number(catoid),
    relevant_context_sha256: sha256(relevant),
  };
}

/**
 * Bind target courses to complete, non-overlapping entries on Longwood's
 * first-party Computer Science Course Listing.  Each accepted entry is one
 * `.course-listing-fade` node with exactly one leading code, title paragraph,
 * description span, and published credit value (including legitimate zero-
 * credit seminars).  Silence about prerequisites remains silence.
 */
function extractLongwoodComputerScienceEntries(html, targetCourseCodes) {
  const $ = cheerio.load(String(html || ''));
  const targets = [...new Set((targetCourseCodes || []).map(normalizeCode).filter(Boolean))].sort();
  const issues = [];
  if (canonicalPath($) !== LONGWOOD_DEPARTMENT_PATH) issues.push('canonical_department_path');
  const h1 = $('h1').map((index, element) => normalizedText($(element).text())).get();
  if (h1.length !== 1 || h1[0] !== 'Computer Science Course Listing') {
    issues.push('unique_course_listing_heading');
  }
  const h2 = $('h2').map((index, element) => normalizedText($(element).text())).get();
  if (h2.filter((value) => value === 'Computer Science Courses').length !== 1) {
    issues.push('computer_science_courses_heading');
  }
  if (issues.length) return { verified: false, issues, entries: [], missing: targets };

  const byCode = new Map();
  $('.course-listing-fade').each((index, element) => {
    const entry = $(element);
    const strong = entry.find('strong');
    if (strong.length !== 1) return;
    const code = normalizeCode(strong.text());
    if (!code) return;
    const values = byCode.get(code) || [];
    values.push(entry);
    byCode.set(code, values);
  });

  const entries = [];
  const missing = [];
  for (const code of targets) {
    const matches = byCode.get(code) || [];
    if (matches.length !== 1) {
      missing.push(code);
      continue;
    }
    const entry = matches[0];
    const paragraphs = entry.children('p');
    const descriptionNodes = entry.find('span.trunccourse');
    const heading = normalizedText(paragraphs.first().text());
    const description = normalizedText(descriptionNodes.text());
    const headingMatch = heading.match(/^([A-Z]{2,8}\d{2,4}[A-Z]?)\.\s+(.+)$/);
    const units = publishedCredits(description);
    if (paragraphs.length !== 2 || descriptionNodes.length !== 1
        || normalizeCode(headingMatch?.[1]) !== code || !headingMatch?.[2]
        || !description || !units) {
      missing.push(code);
      continue;
    }
    const rawEntryText = `${heading} ${description}`;
    entries.push({
      course_code: code,
      heading_text: heading,
      title: headingMatch[2],
      published_units: units,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(entry.toString()),
    });
  }
  return {
    verified: missing.length === 0,
    issues: missing.length ? ['target_entry_boundary'] : [],
    entries,
    missing,
  };
}

module.exports = {
  LONGWOOD_BOUNDARY_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_CATOID,
  LONGWOOD_CATALOG_CONTEXT_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH,
  LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH,
  LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
  LONGWOOD_CATALOG_CONTEXT_URL,
  LONGWOOD_CATALOG_CONTEXT_YEAR,
  LONGWOOD_DEPARTMENT_HOST,
  LONGWOOD_DEPARTMENT_PATH,
  LONGWOOD_DEPARTMENT_URL,
  LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
  LONGWOOD_DIRECT_CMSC_TARGETS,
  LONGWOOD_SLUG,
  LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
  canonicalPath,
  extractLongwoodComputerScienceEntries,
  normalizeCode,
  normalizedText,
  publishedCredits,
  sha256,
  verifyLongwoodCatalogContext,
};
