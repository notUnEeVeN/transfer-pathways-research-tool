#!/usr/bin/env node
/**
 * Robots-aware, one-response capture for the catalog-year-matched VMI PDF used
 * only by the supplemental open-rule proof. This never opens Mongo and never
 * changes the verified degree/composition trees.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const cheerio = require('cheerio');

const SERVER = path.resolve(__dirname, '../..');
// Raw response bytes are a regenerable cache. `.va-catalogs/pages/` is the
// repository's ignored source-page convention, so the 10 MB PDF and the two
// HTTP responses never become durable research artifacts. Only the bounded
// extraction and its hash receipt live under research/.
const RAW_DIR = path.join(
  SERVER, '.va-catalogs', 'pages', 'vmi-open-rule-sources',
);
const REVIEW_DIR = path.join(
  SERVER, '.va-catalogs', 'research', 'vmi-open-rule-sources',
);
const ROBOTS_URL = 'https://www.vmi.edu/robots.txt';
const REGISTRAR_URL =
  'https://www.vmi.edu/academics/academic-support-services/registrar/';
const PDF_URL =
  'https://www.vmi.edu/wp-content/uploads/2026/06/2025-2026_VMICatalog-SizedforWeb.pdf';
const PDF_SHA256 = '244f93ee26e73f8639512bfa7b5e383af3d196ab5c02f4559d20628066390c32';
const PDF_BYTES = 10270130;
const EXCERPT_SHA256 = 'a1e0d504f1beed7544e5cd10c75c7382fe60c26e02b524867a722d8fc8b611c9';
const EXCERPT_BYTES = 11713;
const PAGE_RANGES = Object.freeze([[42, 42], [132, 134], [233, 233], [243, 243]]);
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const FILES = Object.freeze({
  robots: path.join(RAW_DIR, 'www.vmi.edu__robots.txt'),
  registrar: path.join(RAW_DIR, 'www.vmi.edu__registrar.html'),
  pdf: path.join(RAW_DIR, 'vmi-2025-2026-academic-catalog.pdf'),
  excerpt: path.join(REVIEW_DIR, 'vmi-2025-2026-academic-catalog__bounded-pages.txt'),
  metadata: path.join(REVIEW_DIR, 'capture.json'),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function robotsAllows(text, pathname) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.replace(/#.*$/, '').trim());
  let applies = false;
  const rules = [];
  for (const line of lines) {
    if (!line) continue;
    const [name, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(name)) {
      applies = value === '*';
    } else if (applies && /^disallow$/i.test(name) && value) {
      rules.push(value);
    }
  }
  return !rules.some((rule) => pathname.startsWith(rule));
}

function registrarPdfLinks(html) {
  const $ = cheerio.load(String(html || ''));
  return $('a').map((index, element) => ({
    text: $(element).text().replace(/\s+/g, ' ').trim(),
    href: new URL($(element).attr('href') || '', REGISTRAR_URL).href,
  })).get().filter((row) => row.text === 'VMI Catalog 2025-2026');
}

function extractBoundedPages(pdfPath) {
  return PAGE_RANGES.map(([first, last]) => {
    const body = execFileSync('pdftotext', [
      '-f', String(first), '-l', String(last), '-raw', pdfPath, '-',
    ], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
    return `--- PDF PAGES ${first}-${last} ---\n${body}`;
  }).join('\n');
}

function verifyCachedCapture() {
  const issues = [];
  let robots;
  let registrar;
  let pdf;
  let excerpt;
  let metadata;
  try {
    robots = fs.readFileSync(FILES.robots);
    registrar = fs.readFileSync(FILES.registrar);
    pdf = fs.readFileSync(FILES.pdf);
    excerpt = fs.readFileSync(FILES.excerpt);
    metadata = JSON.parse(fs.readFileSync(FILES.metadata, 'utf8'));
  } catch (error) {
    return { verified: false, issues: [`cache_missing:${error.message}`] };
  }
  const robotsText = robots.toString('utf8');
  if (!robotsAllows(robotsText, new URL(REGISTRAR_URL).pathname)
      || !robotsAllows(robotsText, new URL(PDF_URL).pathname)) issues.push('robots_disallow');
  const links = registrarPdfLinks(registrar.toString('utf8'));
  if (links.length !== 1 || links[0].href !== PDF_URL) issues.push('registrar_pdf_link');
  if (sha256(pdf) !== PDF_SHA256 || pdf.byteLength !== PDF_BYTES
      || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) issues.push('pdf_bytes');
  if (sha256(excerpt) !== EXCERPT_SHA256 || excerpt.byteLength !== EXCERPT_BYTES) {
    issues.push('bounded_page_text');
  }
  if (metadata?.schema_version !== 1
      || metadata?.robots_url !== ROBOTS_URL
      || metadata?.registrar_url !== REGISTRAR_URL
      || metadata?.pdf_url !== PDF_URL
      || metadata?.pdf_sha256 !== PDF_SHA256
      || metadata?.pdf_bytes !== PDF_BYTES
      || metadata?.bounded_page_text_sha256 !== EXCERPT_SHA256
      || metadata?.bounded_page_text_bytes !== EXCERPT_BYTES
      || JSON.stringify(metadata?.page_ranges) !== JSON.stringify(PAGE_RANGES)
      || !/pdftotext version 26\.04\.0/.test(metadata?.extractor || '')) {
    issues.push('capture_metadata');
  }
  return {
    verified: issues.length === 0,
    issues,
    metadata,
    robots_text: robotsText,
    registrar_html: registrar.toString('utf8'),
    bounded_page_text: excerpt.toString('utf8'),
  };
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    final_url: response.url,
    status: response.status,
    content_type: response.headers.get('content-type'),
  };
}

async function capture() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  const robots = await fetchBytes(ROBOTS_URL);
  const robotsText = robots.bytes.toString('utf8');
  if (!robotsAllows(robotsText, new URL(REGISTRAR_URL).pathname)
      || !robotsAllows(robotsText, new URL(PDF_URL).pathname)) {
    throw new Error('VMI robots policy disallows a required official route');
  }
  const registrar = await fetchBytes(REGISTRAR_URL);
  const links = registrarPdfLinks(registrar.bytes.toString('utf8'));
  if (links.length !== 1 || links[0].href !== PDF_URL) {
    throw new Error('the official registrar no longer exposes the exact 2025-2026 PDF link');
  }
  const pdf = await fetchBytes(PDF_URL);
  if (pdf.final_url !== PDF_URL || sha256(pdf.bytes) !== PDF_SHA256
      || pdf.bytes.byteLength !== PDF_BYTES) {
    throw new Error('the official catalog PDF identity or bytes drifted');
  }
  fs.writeFileSync(FILES.robots, robots.bytes);
  fs.writeFileSync(FILES.registrar, registrar.bytes);
  fs.writeFileSync(FILES.pdf, pdf.bytes);
  const excerpt = extractBoundedPages(FILES.pdf);
  if (sha256(excerpt) !== EXCERPT_SHA256 || Buffer.byteLength(excerpt) !== EXCERPT_BYTES) {
    throw new Error('the page-bounded PDF extraction drifted');
  }
  fs.writeFileSync(FILES.excerpt, excerpt);
  const extractor = execFileSync('pdftotext', ['-v'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const metadata = {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    user_agent: USER_AGENT,
    robots_url: ROBOTS_URL,
    robots_sha256: sha256(robots.bytes),
    robots_status: robots.status,
    registrar_url: REGISTRAR_URL,
    registrar_final_url: registrar.final_url,
    registrar_sha256: sha256(registrar.bytes),
    registrar_bytes: registrar.bytes.byteLength,
    registrar_status: registrar.status,
    pdf_url: PDF_URL,
    pdf_final_url: pdf.final_url,
    pdf_sha256: PDF_SHA256,
    pdf_bytes: PDF_BYTES,
    pdf_status: pdf.status,
    pdf_content_type: pdf.content_type,
    page_ranges: PAGE_RANGES,
    extractor: extractor || 'pdftotext version 26.04.0',
    bounded_page_text_sha256: EXCERPT_SHA256,
    bounded_page_text_bytes: EXCERPT_BYTES,
  };
  fs.writeFileSync(FILES.metadata, `${JSON.stringify(metadata, null, 2)}\n`);
  return verifyCachedCapture();
}

async function main(argv = process.argv.slice(2)) {
  const fetch = argv.includes('--fetch');
  const unknown = argv.filter((arg) => arg !== '--fetch');
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const report = fetch ? await capture() : verifyCachedCapture();
  if (!report.verified) throw new Error(`VMI source capture invalid: ${report.issues.join(', ')}`);
  console.log('VMI open-rule official source capture: VERIFIED');
  console.log(`  PDF ${PDF_BYTES} bytes ${PDF_SHA256}`);
  console.log(`  bounded pages ${PAGE_RANGES.map(([a, b]) => a === b ? a : `${a}-${b}`).join(', ')}`);
  console.log(fetch ? '  captured official source bytes' : '  checked cached source bytes: no drift');
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = {
  EXCERPT_BYTES,
  EXCERPT_SHA256,
  FILES,
  PAGE_RANGES,
  PDF_BYTES,
  PDF_SHA256,
  PDF_URL,
  RAW_DIR,
  REGISTRAR_URL,
  REVIEW_DIR,
  ROBOTS_URL,
  extractBoundedPages,
  registrarPdfLinks,
  robotsAllows,
  verifyCachedCapture,
};
