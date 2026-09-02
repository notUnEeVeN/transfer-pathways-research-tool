#!/usr/bin/env node
/**
 * Robots-aware capture for Randolph-Macon's current published Collegiate
 * Requirement rosters. The cache is supplemental evidence only: it never
 * opens MongoDB and never edits the verified degree/composition tree.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const SERVER = path.resolve(__dirname, '../..');
const RAW_DIR = path.join(
  SERVER, '.va-catalogs', 'pages', 'randolph-macon-collegiate-attribute-sources',
);
const REVIEW_DIR = path.join(
  SERVER, '.va-catalogs', 'research', 'randolph-macon-collegiate-attribute-sources',
);
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';
const ROBOTS_URL = 'https://catalog.rmc.edu/robots.txt';
const ROBOTS_SHA256 = 'f6305026d827feeb54fa3dee76e89fb169b56467844ba340d22366c95ef81349';
const ROBOTS_BYTES = 633;

const SOURCES = Object.freeze([
  Object.freeze({
    id: 'overview',
    url: 'https://catalog.rmc.edu/collegiate-requirement-courses/',
    raw_sha256: '34dddf753cdb799cdb9cbee243246299a0fda9e74a4fb55c01de5c187b89a6b9',
    raw_bytes: 28930,
    normalized_sha256: '8293b401ebf9e350d1eac9e099e6021d9823b893237fc56123e7bc257fe51110',
    normalized_bytes: 2931,
  }),
  Object.freeze({
    id: 'effective_communication',
    url: 'https://catalog.rmc.edu/collegiate-requirement-courses/effective-communication/',
    raw_sha256: '883736c3a144058149a60b8044b968555e0b4872ce346de7d42701b987486bed',
    raw_bytes: 65588,
    normalized_sha256: '517b2cc228df8f6f0cd1723eb3a4a3a98ef8a80013f74b4049032c940380016a',
    normalized_bytes: 7904,
  }),
  Object.freeze({
    id: 'pillars',
    url: 'https://catalog.rmc.edu/collegiate-requirement-courses/pillars/',
    raw_sha256: 'c6c248d89bf1be571d5ce062062db1bc9f9beff9e647b0f8e6d0dda7797149ab',
    raw_bytes: 144317,
    normalized_sha256: '9dfff11bb89285dfe3f7b0a1e9770c0270ad12101ec720586b49c373152bc3eb',
    normalized_bytes: 23512,
  }),
  Object.freeze({
    id: 'cross_area',
    url: 'https://catalog.rmc.edu/collegiate-requirement-courses/cross-area-requirements/',
    raw_sha256: 'a12be3dd8cb73fcb4b736a48b773dab9a63b8c8a0bf3a53a9a0c539a4b08622b',
    raw_bytes: 152368,
    normalized_sha256: 'c0324f3ee6664ce5adb6bcb6d1160b6ff933696e24435b3f04e5dd070a7e4713',
    normalized_bytes: 21360,
  }),
  Object.freeze({
    id: 'collegiate_requirements',
    url: 'https://catalog.rmc.edu/academic-program/collegiate-requirements/',
    raw_sha256: '3c4f906add141fda9fa34ea8852ef63fcf4ccb851a91aa21181aaf6828ba1662',
    raw_bytes: 37636,
    normalized_sha256: 'fd58e0a02de8a2ae43309dd739f03ec02ca2770a5f14022d2aa1dc56158ea568',
    normalized_bytes: 10444,
  }),
]);

const FILES = Object.freeze({
  robots: path.join(RAW_DIR, 'catalog.rmc.edu__robots.txt'),
  metadata: path.join(REVIEW_DIR, 'capture.json'),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function sourceFiles(source) {
  const stem = source.id.replace(/_/g, '-');
  return {
    raw: path.join(RAW_DIR, `${stem}.html`),
    normalized: path.join(RAW_DIR, `${stem}.txt`),
  };
}

function normalizeHtmlText(html) {
  const $ = cheerio.load(String(html || ''));
  $('script, style, noscript').remove();
  return `${$('body').text()
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

function robotsAllows(text, pathname) {
  const disallowed = [];
  let applies = false;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(field)) applies = value === '*';
    else if (applies && /^disallow$/i.test(field) && value) disallowed.push(value);
  }
  return !disallowed.some((rule) => pathname.startsWith(rule));
}

function verifyCachedCapture() {
  const issues = [];
  let robots = Buffer.alloc(0);
  let metadata = null;
  try {
    robots = fs.readFileSync(FILES.robots);
    metadata = JSON.parse(fs.readFileSync(FILES.metadata, 'utf8'));
  } catch (error) {
    return { verified: false, issues: [`cache_missing:${error.message}`] };
  }
  if (robots.byteLength !== ROBOTS_BYTES || sha256(robots) !== ROBOTS_SHA256) {
    issues.push('robots_bytes');
  }
  const robotsText = robots.toString('utf8');
  if (SOURCES.some((source) => !robotsAllows(robotsText, new URL(source.url).pathname))) {
    issues.push('robots_disallow');
  }
  const receipts = [];
  for (const source of SOURCES) {
    const files = sourceFiles(source);
    let raw = Buffer.alloc(0);
    let normalized = '';
    try {
      raw = fs.readFileSync(files.raw);
      normalized = fs.readFileSync(files.normalized, 'utf8');
    } catch (error) {
      issues.push(`${source.id}:cache_missing`);
      continue;
    }
    if (raw.byteLength !== source.raw_bytes || sha256(raw) !== source.raw_sha256) {
      issues.push(`${source.id}:raw_bytes`);
    }
    if (Buffer.byteLength(normalized) !== source.normalized_bytes
        || sha256(normalized) !== source.normalized_sha256
        || normalized !== normalizeHtmlText(raw.toString('utf8'))) {
      issues.push(`${source.id}:normalized_bytes`);
    }
    receipts.push({
      id: source.id,
      official_url: source.url,
      raw_sha256: sha256(raw),
      raw_bytes: raw.byteLength,
      normalized_sha256: sha256(normalized),
      normalized_bytes: Buffer.byteLength(normalized),
    });
  }
  const metadataRows = Array.isArray(metadata?.sources) ? metadata.sources : [];
  if (metadata?.schema_version !== 1
      || metadata?.user_agent !== USER_AGENT
      || metadata?.robots?.url !== ROBOTS_URL
      || metadata?.robots?.status !== 200
      || metadata?.robots?.final_url !== ROBOTS_URL
      || metadata?.robots?.sha256 !== ROBOTS_SHA256
      || metadata?.robots?.bytes !== ROBOTS_BYTES
      || metadataRows.length !== SOURCES.length
      || SOURCES.some((source, index) => {
        const row = metadataRows[index];
        return row?.id !== source.id
          || row?.requested_url !== source.url
          || row?.final_url !== source.url
          || row?.status !== 200
          || row?.raw_sha256 !== source.raw_sha256
          || row?.raw_bytes !== source.raw_bytes
          || row?.normalized_sha256 !== source.normalized_sha256
          || row?.normalized_bytes !== source.normalized_bytes;
      })) issues.push('capture_metadata');
  return {
    verified: issues.length === 0,
    issues,
    metadata,
    robots_text: robotsText,
    receipts,
  };
}

async function fetchBytes(url, accept = 'text/html') {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT, Accept: accept },
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
  const robots = await fetchBytes(ROBOTS_URL, 'text/plain');
  if (robots.final_url !== ROBOTS_URL || robots.status !== 200
      || robots.bytes.byteLength !== ROBOTS_BYTES || sha256(robots.bytes) !== ROBOTS_SHA256) {
    throw new Error('Randolph-Macon robots response identity or bytes drifted');
  }
  const robotsText = robots.bytes.toString('utf8');
  if (SOURCES.some((source) => !robotsAllows(robotsText, new URL(source.url).pathname))) {
    throw new Error('Randolph-Macon robots policy disallows a required public catalog route');
  }
  const responses = await Promise.all(SOURCES.map(async (source) => ({
    source,
    response: await fetchBytes(source.url),
  })));
  const sourceMetadata = [];
  for (const { source, response } of responses) {
    const normalized = normalizeHtmlText(response.bytes.toString('utf8'));
    if (response.final_url !== source.url || response.status !== 200
        || response.bytes.byteLength !== source.raw_bytes
        || sha256(response.bytes) !== source.raw_sha256
        || Buffer.byteLength(normalized) !== source.normalized_bytes
        || sha256(normalized) !== source.normalized_sha256) {
      throw new Error(`${source.id} official response bytes drifted`);
    }
    const files = sourceFiles(source);
    fs.writeFileSync(files.raw, response.bytes);
    fs.writeFileSync(files.normalized, normalized);
    sourceMetadata.push({
      id: source.id,
      requested_url: source.url,
      final_url: response.final_url,
      status: response.status,
      content_type: response.content_type,
      raw_sha256: source.raw_sha256,
      raw_bytes: source.raw_bytes,
      normalized_sha256: source.normalized_sha256,
      normalized_bytes: source.normalized_bytes,
    });
  }
  fs.writeFileSync(FILES.robots, robots.bytes);
  fs.writeFileSync(FILES.metadata, `${JSON.stringify({
    schema_version: 1,
    captured_at: new Date().toISOString(),
    user_agent: USER_AGENT,
    robots: {
      url: ROBOTS_URL,
      final_url: robots.final_url,
      status: robots.status,
      content_type: robots.content_type,
      sha256: ROBOTS_SHA256,
      bytes: ROBOTS_BYTES,
      required_catalog_routes_allowed: true,
    },
    sources: sourceMetadata,
  }, null, 2)}\n`);
  return verifyCachedCapture();
}

async function main(argv = process.argv.slice(2)) {
  const fetch = argv.includes('--fetch');
  const unknown = argv.filter((argument) => argument !== '--fetch');
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const report = fetch ? await capture() : verifyCachedCapture();
  if (!report.verified) {
    throw new Error(`Randolph-Macon source capture invalid: ${report.issues.join(', ')}`);
  }
  console.log('Randolph-Macon Collegiate attribute source capture: VERIFIED');
  console.log(`  official pages ${SOURCES.length}; raw bytes ${SOURCES.reduce((sum, row) => sum + row.raw_bytes, 0)}`);
  console.log(`  robots ${ROBOTS_BYTES} bytes ${ROBOTS_SHA256}`);
  console.log(fetch ? '  captured exact official raw/normalized bytes' : '  checked cached bytes: no drift');
  return report;
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = {
  FILES,
  RAW_DIR,
  REVIEW_DIR,
  ROBOTS_BYTES,
  ROBOTS_SHA256,
  ROBOTS_URL,
  SOURCES,
  USER_AGENT,
  capture,
  main,
  normalizeHtmlText,
  robotsAllows,
  sourceFiles,
  verifyCachedCapture,
};
