#!/usr/bin/env node
/**
 * Capture/replay the exact sending-college Transfer Virginia pages used by the
 * Radford science-pair evaluator. No database or curriculum document is read
 * or written. Live acquisition is opt-in because the official host publishes
 * a ten-second crawl delay; the ordinary release check replays retained bytes.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  COURSE_FACTS,
  EQUIVALENCY_SOURCE_URLS,
  TRANSFER_VIRGINIA_HOST,
  USER_AGENT,
  robotsAllows,
} = require('../../services/analysis/radfordSciencePairEvidence');
const {
  RECEIPT_TARGETS,
  ROBOTS_URL,
  buildRadfordCollegeSciencePairEvidence,
  discoveryForCode,
  receiptKey,
  routeForTarget,
} = require('../../services/analysis/radfordCollegeSciencePairEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCES = path.join(
  SERVER, '.va-catalogs', 'research', 'radford-science-pair-college-sources',
);
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research',
  'radford-college-science-pair-equivalency-evidence.json',
);
const MANIFEST = path.join(SOURCES, 'response-manifest.json');
const ROBOTS = path.join(SOURCES, 'robots.txt');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function crawlDelay(robotsText) {
  const values = String(robotsText || '').split(/\r?\n/)
    .map((line) => /^\s*Crawl-delay:\s*(\d+(?:\.\d+)?)\s*$/i.exec(line)?.[1])
    .filter(Boolean).map(Number);
  return values.length ? Math.max(...values) : 0;
}

async function fetchText(url, accept) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: { accept, 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: await response.text(),
    requestedUrl: url,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') || '',
    status: response.status,
    startedAt,
  };
}

function responseRecord(response) {
  return {
    requestedUrl: response.requestedUrl,
    finalUrl: response.finalUrl,
    contentType: response.contentType,
    status: response.status,
  };
}

function discoveryFile(code) {
  return path.join(SOURCES, 'discovery', `${code.toLowerCase()}.html`);
}

function receiptFile(key) {
  return path.join(SOURCES, 'receipts', `${key.replace(/:/g, '__')}.html`);
}

async function acquireOfficialSources() {
  const robotsResponse = await fetchText(ROBOTS_URL, 'text/plain');
  const delaySeconds = crawlDelay(robotsResponse.body);
  if (delaySeconds !== 10) {
    throw new Error(`Transfer Virginia crawl delay changed from 10 to ${delaySeconds}`);
  }
  let nextAllowedAt = robotsResponse.startedAt + delaySeconds * 1000;
  async function scheduled(url) {
    const wait = Math.max(0, nextAllowedAt - Date.now());
    if (wait) await sleep(wait);
    const response = await fetchText(url, 'text/html');
    nextAllowedAt = response.startedAt + delaySeconds * 1000;
    return response;
  }

  const discoveryPages = {};
  const discoveryResponses = {};
  for (const code of Object.keys(COURSE_FACTS)) {
    const url = EQUIVALENCY_SOURCE_URLS[code];
    if (!robotsAllows(url, robotsResponse.body)) {
      throw new Error(`${url} is not permitted by the retained robots policy`);
    }
    const response = await scheduled(url);
    discoveryPages[code] = response.body;
    discoveryResponses[code] = responseRecord(response);
  }

  const parsedDiscoveries = Object.fromEntries(Object.keys(COURSE_FACTS).map((code) => [
    code,
    discoveryForCode(discoveryPages[code], code, discoveryResponses[code]),
  ]));
  const coursePages = {};
  const courseResponses = {};
  for (const target of RECEIPT_TARGETS) {
    const route = routeForTarget(parsedDiscoveries[target.sending_code], target);
    if (!route || route.kind === 'root_page') continue;
    if (!robotsAllows(route.url, robotsResponse.body)) {
      throw new Error(`${route.url} is not permitted by the retained robots policy`);
    }
    const key = receiptKey(target.college_slug, target.sending_code);
    const response = await scheduled(route.url);
    coursePages[key] = response.body;
    courseResponses[key] = responseRecord(response);
  }
  return {
    discoveryPages,
    discoveryResponses,
    coursePages,
    courseResponses,
    robots: {
      host: TRANSFER_VIRGINIA_HOST,
      status: robotsResponse.status,
      text: robotsResponse.body,
      crawlDelay: delaySeconds,
    },
  };
}

/**
 * Fetch only newly declared college pages while replaying the already retained
 * discovery corpus. This is the normal expansion path: it avoids re-requesting
 * unchanged official pages and still obtains a fresh robots receipt before any
 * target request. Requests remain serialized at the published ten-second
 * delay.
 */
async function acquireMissingOfficialSources() {
  const retained = loadRetainedSources();
  const robotsResponse = await fetchText(ROBOTS_URL, 'text/plain');
  const delaySeconds = crawlDelay(robotsResponse.body);
  if (delaySeconds !== 10) {
    throw new Error(`Transfer Virginia crawl delay changed from 10 to ${delaySeconds}`);
  }
  let nextAllowedAt = robotsResponse.startedAt + delaySeconds * 1000;
  async function scheduled(url) {
    const wait = Math.max(0, nextAllowedAt - Date.now());
    if (wait) await sleep(wait);
    const response = await fetchText(url, 'text/html');
    nextAllowedAt = response.startedAt + delaySeconds * 1000;
    return response;
  }
  const parsedDiscoveries = Object.fromEntries(Object.keys(COURSE_FACTS).map((code) => [
    code,
    discoveryForCode(
      retained.discoveryPages[code], code, retained.discoveryResponses[code],
    ),
  ]));
  for (const target of RECEIPT_TARGETS) {
    const key = receiptKey(target.college_slug, target.sending_code);
    if (retained.coursePages[key]) continue;
    const route = routeForTarget(parsedDiscoveries[target.sending_code], target);
    if (!route || route.kind === 'root_page') continue;
    if (!robotsAllows(route.url, robotsResponse.body)) {
      throw new Error(`${route.url} is not permitted by the current robots policy`);
    }
    const response = await scheduled(route.url);
    retained.coursePages[key] = response.body;
    retained.courseResponses[key] = responseRecord(response);
  }
  retained.robots = {
    host: TRANSFER_VIRGINIA_HOST,
    status: robotsResponse.status,
    text: robotsResponse.body,
    crawlDelay: delaySeconds,
  };
  return retained;
}

function loadRetainedSources() {
  if (!fs.existsSync(MANIFEST) || !fs.existsSync(ROBOTS)) {
    throw new Error('missing retained Radford college-specific source manifest or robots response');
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const discoveryPages = {};
  for (const code of Object.keys(COURSE_FACTS)) {
    const file = discoveryFile(code);
    if (!fs.existsSync(file)) throw new Error(`missing retained discovery page: ${file}`);
    discoveryPages[code] = fs.readFileSync(file, 'utf8');
  }
  const coursePages = {};
  for (const key of Object.keys(manifest.courseResponses || {})) {
    const file = receiptFile(key);
    if (!fs.existsSync(file)) throw new Error(`missing retained college page: ${file}`);
    coursePages[key] = fs.readFileSync(file, 'utf8');
  }
  return {
    discoveryPages,
    discoveryResponses: manifest.discoveryResponses || {},
    coursePages,
    courseResponses: manifest.courseResponses || {},
    robots: {
      host: TRANSFER_VIRGINIA_HOST,
      status: manifest.robots?.status,
      text: fs.readFileSync(ROBOTS, 'utf8'),
      crawlDelay: manifest.robots?.crawlDelay,
    },
  };
}

function sourceManifest(sources) {
  return {
    schema_version: 1,
    host: TRANSFER_VIRGINIA_HOST,
    robots: {
      status: sources.robots.status,
      crawlDelay: sources.robots.crawlDelay,
    },
    discoveryResponses: sources.discoveryResponses,
    courseResponses: sources.courseResponses,
  };
}

function writeSources(sources) {
  fs.mkdirSync(path.join(SOURCES, 'discovery'), { recursive: true });
  fs.mkdirSync(path.join(SOURCES, 'receipts'), { recursive: true });
  for (const [code, body] of Object.entries(sources.discoveryPages)) {
    fs.writeFileSync(discoveryFile(code), body);
  }
  for (const [key, body] of Object.entries(sources.coursePages)) {
    fs.writeFileSync(receiptFile(key), body);
  }
  fs.writeFileSync(ROBOTS, sources.robots.text);
  fs.writeFileSync(MANIFEST, `${JSON.stringify(sourceManifest(sources), null, 2)}\n`);
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const refresh = argv.includes('--refresh');
  const refreshMissing = argv.includes('--refresh-missing');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => (
    !['--write', '--refresh', '--refresh-missing', '--json'].includes(argument)
  ));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if (refresh && refreshMissing) throw new Error('choose --refresh or --refresh-missing');
  if (write && !refresh && !refreshMissing) {
    throw new Error('--write requires --refresh or --refresh-missing');
  }

  const sources = refresh ? await acquireOfficialSources()
    : (refreshMissing ? await acquireMissingOfficialSources() : loadRetainedSources());
  const evidence = buildRadfordCollegeSciencePairEvidence(sources);
  if (!evidence.verified) {
    throw new Error(`Radford college-specific evidence did not verify: ${evidence.issues.join(', ')}`);
  }
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) {
    writeSources(sources);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Radford college-specific evidence drifted; inspect and refresh with --write');
    }
    if (refresh) {
      const retained = loadRetainedSources();
      const retainedRendered = `${JSON.stringify(
        buildRadfordCollegeSciencePairEvidence(retained), null, 2,
      )}\n`;
      if (retainedRendered !== rendered) {
        throw new Error('official Radford college-specific responses differ from retained sources');
      }
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Radford college-specific science-pair evidence: PASS');
    console.log(`  exact targets: ${evidence.target_count}`);
    console.log(`  positive receipts: ${evidence.positive_receipts}`);
    console.log(`  negative receipts: ${evidence.negative_receipts}`);
    console.log(`  receipts SHA-256: ${evidence.receipts_sha256}`);
    console.log(write ? `  wrote ${OUTPUT} and retained official sources` : '  checked retained artifact: no drift');
  }
  return evidence;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  MANIFEST,
  OUTPUT,
  ROBOTS,
  SOURCES,
  acquireOfficialSources,
  acquireMissingOfficialSources,
  crawlDelay,
  discoveryFile,
  loadRetainedSources,
  main,
  receiptFile,
  sourceManifest,
};
