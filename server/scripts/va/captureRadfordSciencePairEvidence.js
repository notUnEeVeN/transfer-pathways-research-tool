#!/usr/bin/env node
/**
 * Rebuild/check the exact Radford Figure 3/4 science-pair receipts.
 *
 * The acquisition is read-only and uses only official HTTPS pages. Requests
 * to each host are serialized at that host's published crawl delay. Raw
 * retained response byte counts and hashes remain provenance receipts; live
 * replay normalizes only exact-cardinality per-request Drupal theme tokens
 * and Modern Campus tooltip ids before comparing a full-page SHA-256. Every
 * other byte, transport field, semantic fact, or robots receipt fails closed.
 * No curriculum document or database row is changed.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  COURSE_FACTS,
  RADFORD_HOST,
  TRANSFER_VIRGINIA_HOST,
  USER_AGENT,
  VCCS_HOST,
  buildRadfordSciencePairEvidence,
  radfordSciencePairReplayIssue,
  robotsAllows,
  urlsFor,
} = require('../../services/analysis/radfordSciencePairEvidence');

const SERVER = path.resolve(__dirname, '../..');
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research', 'radford-science-pair-evidence.json',
);
const FETCH_TIMEOUT_MS = 25_000;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchText(url, accept, {
  fetchImpl = globalThis.fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
} = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept, 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw new Error(`${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: await response.text(),
    requestedUrl: url,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') || '',
    status: response.status,
  };
}

function crawlDelay(robotsText) {
  const values = String(robotsText || '').split(/\r?\n/)
    .map((line) => /^\s*Crawl-delay:\s*(\d+(?:\.\d+)?)\s*$/i.exec(line)?.[1])
    .filter(Boolean).map(Number);
  return values.length ? Math.max(...values) : 0;
}

async function fetchHostPages(rows, delaySeconds) {
  const pages = {};
  for (const [index, row] of rows.entries()) {
    if (index) await sleep(delaySeconds * 1000);
    pages[row.code] = await fetchText(row.url, 'text/html');
  }
  return pages;
}

async function buildFromOfficialSources() {
  const hosts = {
    vccs: VCCS_HOST,
    transfer_virginia: TRANSFER_VIRGINIA_HOST,
    radford: RADFORD_HOST,
  };
  const robotsResponses = Object.fromEntries(await Promise.all(
    Object.entries(hosts).map(async ([key, host]) => [
      key, await fetchText(`https://${host}/robots.txt`, 'text/plain'),
    ]),
  ));
  const robots = Object.fromEntries(Object.entries(robotsResponses).map(([key, response]) => [
    key,
    {
      host: hosts[key], status: response.status, text: response.body,
      crawlDelay: crawlDelay(response.body),
    },
  ]));
  const rows = Object.entries(COURSE_FACTS).map(([code, fact]) => ({
    code, urls: urlsFor(fact),
  }));
  for (const { urls } of rows) {
    for (const [key, url] of Object.entries(urls)) {
      if (!robotsAllows(url, robots[key]?.text)) {
        throw new Error(`${url} is not permitted by the retained robots policy`);
      }
    }
  }
  const [vccsPages, transferPages, radfordPages] = await Promise.all([
    fetchHostPages(rows.map((row) => ({ code: row.code, url: row.urls.vccs })), robots.vccs.crawlDelay),
    fetchHostPages(rows.map((row) => ({ code: row.code, url: row.urls.transfer_virginia })), robots.transfer_virginia.crawlDelay),
    fetchHostPages(rows.map((row) => ({ code: row.code, url: row.urls.radford })), robots.radford.crawlDelay),
  ]);
  const pages = {};
  const responses = {};
  for (const { code } of rows) {
    pages[code] = {
      vccs: vccsPages[code].body,
      transfer_virginia: transferPages[code].body,
      radford: radfordPages[code].body,
    };
    responses[code] = {
      vccs: vccsPages[code],
      transfer_virginia: transferPages[code],
      radford: radfordPages[code],
    };
  }
  const evidence = buildRadfordSciencePairEvidence({ pages, responses, robots });
  if (!evidence.verified) {
    throw new Error(`Radford science-pair evidence did not verify: ${evidence.issues.join(', ')}`);
  }
  return evidence;
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const evidence = await buildFromOfficialSources();
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) {
    fs.writeFileSync(OUTPUT, rendered);
  } else {
    const retained = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    const replayIssue = radfordSciencePairReplayIssue(retained, evidence);
    if (replayIssue) {
      throw new Error(`Radford science-pair evidence drifted: ${replayIssue}`);
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Radford exact science-pair evidence: PASS');
    console.log(`  semantic facts SHA-256: ${evidence.facts_sha256}`);
    console.log(`  exact course edges: ${evidence.courses.length}`);
    console.log(write ? `  wrote ${OUTPUT}` : '  checked stable full-page replay: no nonvolatile drift');
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
  FETCH_TIMEOUT_MS,
  OUTPUT,
  buildFromOfficialSources,
  crawlDelay,
  fetchText,
  main,
};
