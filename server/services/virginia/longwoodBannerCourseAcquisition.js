const cheerio = require('cheerio');
const {
  LONGWOOD_DEPARTMENT_HOST,
  normalizeCode,
  normalizedText,
  publishedCredits,
  sha256,
} = require('./longwoodDepartmentPrerequisiteAcquisition');

const LONGWOOD_BANNER_HOST = LONGWOOD_DEPARTMENT_HOST;
const LONGWOOD_BANNER_PATH = '/site-assets/courses-from-banner';
const LONGWOOD_BANNER_URL = `https://${LONGWOOD_BANNER_HOST}${LONGWOOD_BANNER_PATH}/`;
const LONGWOOD_BANNER_DIRECT_TARGETS = Object.freeze([
  'CTZN110',
  'CTZN410',
  'ENGL165',
  'ENGL319',
  'MATH171',
  'MATH175',
  'MATH250',
  'MATH261',
]);
const LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS = Object.freeze([
  'MATH301',
  'PSYC335',
  'RELI301',
  'SPAN320',
]);
const LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS = Object.freeze([
  'SPAN212',
]);
const LONGWOOD_BANNER_BOUNDARY_CONTRACT =
  'longwood_banner_unique_course_listing_entry_with_published_credits_v1';
const LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY =
  'banner_course_text_from_unversioned_first_party_page_bound_to_separately_retained_2026_2027_catoid_19_catalog_context';

function canonicalPath($) {
  const values = $('link[rel="canonical"]')
    .map((index, element) => $(element).attr('href')).get().filter(Boolean);
  if (values.length !== 1) return null;
  try {
    const url = new URL(values[0], LONGWOOD_BANNER_URL);
    if (url.protocol !== 'https:'
        || url.hostname.toLowerCase() !== LONGWOOD_BANNER_HOST) return null;
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    return null;
  }
}

/**
 * Longwood's first-party "Courses from Banner" page exposes one structural
 * `.course-listing-fade` node per course.  A row is accepted only when its
 * exact code identifies one and only one two-paragraph node with one
 * description span and one published credit notation.  A missing requisite
 * marker remains source silence and is never converted to status=none.
 */
function extractLongwoodBannerEntries(html, targetCourseCodes) {
  const $ = cheerio.load(String(html || ''));
  const targets = [...new Set((targetCourseCodes || []).map(normalizeCode).filter(Boolean))].sort();
  const issues = [];
  if (canonicalPath($) !== LONGWOOD_BANNER_PATH) issues.push('canonical_banner_path');
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
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS,
  LONGWOOD_BANNER_DIRECT_TARGETS,
  LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS,
  LONGWOOD_BANNER_HOST,
  LONGWOOD_BANNER_PATH,
  LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
  LONGWOOD_BANNER_URL,
  canonicalPath,
  extractLongwoodBannerEntries,
};
