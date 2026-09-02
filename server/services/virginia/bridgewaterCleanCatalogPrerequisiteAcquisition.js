const crypto = require('node:crypto');
const cheerio = require('cheerio');

const BRIDGEWATER_SLUG = 'bridgewater-college';
const BRIDGEWATER_HOST = 'bridgewater.cleancatalog.io';
const BRIDGEWATER_EDITION_PATH = '/courses-of-instruction';
const BRIDGEWATER_BOUNDARY_CONTRACT =
  'bridgewater_cleancatalog_unique_class_article_exact_h1_and_units_v1';
const BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT =
  'bridgewater_cleancatalog_exact_article_requisite_field_labels_v1';

const PREFIX_PATHS = Object.freeze({
  ART: '/art/',
  CL: '/connected-learning-curriculum/',
  COMM: '/communication-studies-theatre/',
  CSCI: '/mathematics-computer-science/',
  DSA: '/mathematics-computer-science/',
  MATH: '/mathematics-computer-science/',
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function normalizedText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function expectedCoursePath(courseCode) {
  const code = normalizeCode(courseCode);
  const match = /^([A-Z]+)(\d{2,4}[A-Z]?)$/.exec(code || '');
  if (!match || !PREFIX_PATHS[match[1]]) return null;
  return `${PREFIX_PATHS[match[1]]}${code.toLowerCase()}`;
}

function canonicalPath($) {
  const canonicals = $('link[rel="canonical"]').map((index, element) => (
    $(element).attr('href')
  )).get().filter(Boolean);
  if (canonicals.length !== 1) return null;
  let url;
  try {
    url = new URL(canonicals[0]);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== BRIDGEWATER_HOST) return null;
  return url.pathname.replace(/\/$/, '') || '/';
}

/**
 * Bridgewater's course pages do not print an edition. The exact edition is
 * therefore pinned independently on the official Courses of Instruction
 * page, whose prose explicitly states which year its descriptions apply to.
 * A copyright year, navigation label, or inferred "current" edition does not
 * satisfy this contract.
 */
function verifyBridgewaterCatalogEdition(html, expectedYear) {
  const $ = cheerio.load(String(html || ''));
  const issues = [];
  if (canonicalPath($) !== BRIDGEWATER_EDITION_PATH) issues.push('canonical_edition_path');
  const headings = $('main h1').map((index, element) => normalizedText($(element).text())).get();
  if (headings.length !== 1 || headings[0] !== 'Courses of Instruction') {
    issues.push('unique_courses_of_instruction_heading');
  }
  const year = String(expectedYear || '');
  if (!/^20\d{2}-20\d{2}$/.test(year)) issues.push('expected_catalog_year');
  const mainText = normalizedText($('main').text());
  const exactStatement = `Course numbers and descriptions listed herein apply to the ${year} academic year.`;
  if (!mainText.includes(exactStatement)) issues.push('exact_catalog_year_statement');
  return {
    verified: issues.length === 0,
    issues,
    catalog_year: issues.length === 0 ? year : null,
    edition_path: BRIDGEWATER_EDITION_PATH,
    exact_year_statement: issues.length === 0 ? exactStatement : null,
    normalized_main_text_sha256: sha256(mainText),
  };
}

function headingCode(value) {
  const match = /^([A-Z]{2,8})\s*-\s*(\d{2,4}[A-Z]?)\s*:/i.exec(normalizedText(value));
  return match ? normalizeCode(`${match[1]}${match[2]}`) : null;
}

function publishedCredits(article, $) {
  const values = article.find('.field--name-field-credits .field__item')
    .map((index, element) => normalizedText($(element).text())).get();
  if (values.length !== 1 || !/^\d+(?:\.\d+)?$/.test(values[0])) return null;
  const units = Number(values[0]);
  if (!Number.isFinite(units) || units <= 0) return null;
  return {
    kind: 'published_fixed_credits',
    notation: values[0],
    credit_hours_min: units,
    credit_hours_max: units,
  };
}

function articleText(article, $) {
  const clone = article.clone();
  clone.find('.field__label').each((index, element) => {
    const label = $(element);
    if (!/:\s*$/.test(label.text())) label.append(':');
  });
  clone.find('*').each((index, element) => $(element).append(' '));
  return normalizedText(clone.text());
}

function requisiteFieldReceipt(article, $) {
  const fields = article.find('.field__label').map((index, element) => {
    const label = normalizedText($(element).text()).replace(/:\s*$/, '');
    const field = $(element).closest('.field');
    const values = field.find('.field__item').map((valueIndex, valueElement) => (
      normalizedText($(valueElement).text())
    )).get().filter(Boolean);
    return { label, values };
  }).get();
  const requisiteFields = fields.filter((field) => /requisites?/i.test(field.label));
  const prerequisites = requisiteFields.filter((field) => /^Prerequisites?$/i.test(field.label));
  const corequisites = requisiteFields.filter((field) => /^Corequisites?$/i.test(field.label));
  const unrecognized = requisiteFields.filter((field) => (
    !/^Prerequisites?$/i.test(field.label) && !/^Corequisites?$/i.test(field.label)
  ));
  return {
    receipt_contract: BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT,
    field_label_count: fields.length,
    field_labels_sha256: sha256(JSON.stringify(fields)),
    exact_prerequisite_field_count: prerequisites.length,
    exact_corequisite_field_count: corequisites.length,
    unrecognized_requisite_like_field_count: unrecognized.length,
    requisite_fields: requisiteFields.map((field) => ({
      label: field.label,
      values: field.values,
      values_sha256: sha256(JSON.stringify(field.values)),
    })),
  };
}

function bridgewaterUnmodeledTimingSignals(value) {
  const text = normalizedText(value);
  const signals = [];
  if (/\brequired first-semester\b/i.test(text)) signals.push('required_first_semester');
  if (/\btaken during the student(?:'|’)?s first semester\b/i.test(text)) {
    signals.push('taken_during_first_semester');
  }
  if (/\btaken in a student(?:'|’)?s first semester\b/i.test(text)) {
    signals.push('taken_in_first_semester');
  }
  return signals;
}

/**
 * Bound one exact Bridgewater CleanCatalog course entry. The accepted boundary
 * is a single full class article with an exact canonical path, exact leading
 * H1 code, and a unique positive Credits field. Course-code mentions in prose,
 * search results, department lists, and duplicate articles never qualify.
 */
function extractBridgewaterCourseEntry(html, targetCourseCode) {
  const target = normalizeCode(targetCourseCode);
  const expectedPath = expectedCoursePath(target);
  if (!target || !expectedPath) {
    return { verified: false, issues: ['unsupported_target_course_code'], entries: [], missing: [] };
  }
  const $ = cheerio.load(String(html || ''));
  const issues = [];
  if (canonicalPath($) !== expectedPath) issues.push('canonical_course_path');
  const articles = $('main article.node--type-class.node--view-mode-full');
  if (articles.length !== 1) issues.push('unique_full_class_article');
  if (issues.length) {
    return { verified: false, issues, entries: [], missing: [target] };
  }
  const article = articles.first();
  const about = String(article.attr('about') || '').replace(/\/$/, '');
  if (about !== expectedPath) issues.push('article_about_path');
  const headings = article.find('h1').map((index, element) => normalizedText($(element).text())).get();
  if (headings.length !== 1 || headingCode(headings[0]) !== target) issues.push('exact_unique_h1_code');
  const units = publishedCredits(article, $);
  if (!units) issues.push('unique_positive_published_credits');
  if (issues.length) {
    return { verified: false, issues, entries: [], missing: [target] };
  }
  const rawEntryText = articleText(article, $);
  const rawEntryHtml = article.toString();
  const fieldReceipt = requisiteFieldReceipt(article, $);
  const title = headings[0].slice(headings[0].indexOf(':') + 1).trim();
  return {
    verified: true,
    issues: [],
    entries: [{
      course_code: target,
      canonical_path: expectedPath,
      heading_text: headings[0],
      title,
      published_units: units,
      raw_entry_text: rawEntryText,
      raw_entry_sha256: sha256(rawEntryText),
      raw_entry_html_sha256: sha256(rawEntryHtml),
      requisite_field_receipt: fieldReceipt,
    }],
    missing: [],
  };
}

module.exports = {
  BRIDGEWATER_BOUNDARY_CONTRACT,
  BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT,
  BRIDGEWATER_EDITION_PATH,
  BRIDGEWATER_HOST,
  BRIDGEWATER_SLUG,
  expectedCoursePath,
  bridgewaterUnmodeledTimingSignals,
  extractBridgewaterCourseEntry,
  headingCode,
  normalizeCode,
  normalizedText,
  publishedCredits,
  requisiteFieldReceipt,
  sha256,
  verifyBridgewaterCatalogEdition,
};
