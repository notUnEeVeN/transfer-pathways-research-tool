const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const SERVER = path.resolve(__dirname, '..', '..');
const CACHE_ROOT = path.join(
  SERVER,
  '.va-catalogs',
  'vccs-prerequisites',
  'raw',
  'southwest-virginia-community-college',
);
const PARSER_CONTRACT = 'southwest-courseleaf-preview-course-fragment-v1';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function expectedHeading(row) {
  const code = normalizeCode(row?.code).replace(/^([A-Z]+)(\d)/, '$1 $2');
  return `${code}: ${String(row?.title || '').trim()}`;
}

function cachePathForRow(row) {
  const source = new URL(row.source_url);
  const catoid = source.searchParams.get('catoid');
  const coid = source.searchParams.get('coid');
  if (source.protocol !== 'https:'
      || source.hostname !== 'catalog.sw.edu'
      || source.pathname !== '/preview_course_nopop.php'
      || !/^\d+$/.test(catoid || '')
      || !/^\d+$/.test(coid || '')) {
    throw new Error(`${row.code} is not an exact Southwest CourseLeaf preview URL`);
  }
  return path.join(CACHE_ROOT, `catoid-${catoid}__coid-${coid}.html`);
}

function extractCourseFragment(body, row) {
  const html = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
  const starts = html.match(/id=['"]course_preview_title['"]/gi) || [];
  const fragments = html.match(/<p><h1 id=['"]course_preview_title['"][^>]*>[\s\S]*?<\/p>/gi)
    || [];
  if (starts.length !== 1 || fragments.length !== 1) {
    throw new Error(`${row.code} official response does not contain one exact course fragment`);
  }
  const fragmentHtml = fragments[0];
  const $ = cheerio.load(fragmentHtml, null, false);
  const heading = $('#course_preview_title').text().replace(/\s+/g, ' ').trim();
  if (heading !== expectedHeading(row)) {
    throw new Error(`${row.code} official response heading changed`);
  }
  $('h1').after('\n');
  $('br').replaceWith('\n');
  const rawEntryText = $.root().text().split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  if (rawEntryText !== row.raw_entry_text) {
    throw new Error(`${row.code} retained entry is not byte-derived from the official response`);
  }
  return { fragmentHtml, heading, rawEntryText };
}

function captureReceipt(body, row) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ''), 'utf8');
  const html = buffer.toString('utf8');
  const page = cheerio.load(html);
  const catalogName = page('.acalog_catalog_name').first().text().replace(/\s+/g, ' ').trim();
  if (catalogName !== `${row.catalog_year} Catalog`) {
    throw new Error(`${row.code} official response catalog edition changed`);
  }
  const extracted = extractCourseFragment(buffer, row);
  const file = cachePathForRow(row);
  return {
    kind: 'official_http_response_and_single_course_fragment',
    cache_path: path.relative(SERVER, file),
    source_response_sha256: sha256(buffer),
    source_response_bytes: buffer.length,
    course_fragment_html_sha256: sha256(extracted.fragmentHtml),
    course_fragment_html_bytes: Buffer.byteLength(extracted.fragmentHtml),
    extracted_entry_sha256: sha256(extracted.rawEntryText),
    course_heading_seen: extracted.heading,
    catalog_name_seen: catalogName,
    parser_contract: PARSER_CONTRACT,
  };
}

function loadAndValidateCapture(row) {
  const expectedFile = cachePathForRow(row);
  if (!row?.source_capture
      || row.source_capture.cache_path !== path.relative(SERVER, expectedFile)
      || !fs.existsSync(expectedFile)) {
    throw new Error(`${row.code} exact official response cache is missing`);
  }
  const receipt = captureReceipt(fs.readFileSync(expectedFile), row);
  if (JSON.stringify(receipt) !== JSON.stringify(row.source_capture)) {
    throw new Error(`${row.code} official response receipt mismatch`);
  }
  return receipt;
}

module.exports = {
  CACHE_ROOT,
  PARSER_CONTRACT,
  cachePathForRow,
  captureReceipt,
  extractCourseFragment,
  loadAndValidateCapture,
};
