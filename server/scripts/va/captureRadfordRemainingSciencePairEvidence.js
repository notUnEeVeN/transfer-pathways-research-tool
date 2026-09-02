#!/usr/bin/env node
/**
 * Capture the exact official course pages needed to audit the last two
 * Radford Figure 3/4 science-pair cells. This corpus is deliberately
 * standalone: it does not edit a degree, agreement, generated publication
 * artifact, or database row.
 *
 * Live acquisition is opt-in. Transfer Virginia publishes a ten-second crawl
 * delay, so its requests are serialized from the robots response onward. The
 * two Southwest routes are discovered from the exact Richard Bland course
 * pages instead of being inferred from statewide course identity.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { parseCoursePage } = require('../../services/virginia/courseEquivalency');
const {
  USER_AGENT,
  robotsAllows,
} = require('../../services/analysis/radfordSciencePairEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCES = path.join(
  SERVER, '.va-catalogs', 'research', 'radford-remaining-science-pair-sources',
);
const MANIFEST = path.join(SOURCES, 'response-manifest.json');
const TRANSFER_HOST = 'www.transfervirginia.org';
const RADFORD_HOST = 'www.radford.edu';
const TRANSFER_ROBOTS_URL = `https://${TRANSFER_HOST}/robots.txt`;
const RADFORD_ROBOTS_URL = `https://${RADFORD_HOST}/robots.txt`;

const RICHARD_BLAND = Object.freeze([
  Object.freeze({
    key: 'richard-bland-college:PHYS201',
    institution: 'Richard Bland College',
    sendingCode: 'PHYS201',
    sendingTitle: 'University Physics',
    sendingCredits: 4,
    receivingCode: 'PHYS221',
    url: `https://${TRANSFER_HOST}/course/2FB60A081F9511F082AC0242AC15010A`,
    southwestCode: 'PHY241',
  }),
  Object.freeze({
    key: 'richard-bland-college:PHYS202',
    institution: 'Richard Bland College',
    sendingCode: 'PHYS202',
    sendingTitle: 'University Physics',
    sendingCredits: 4,
    receivingCode: 'PHYS222',
    url: `https://${TRANSFER_HOST}/course/2FB60A911F9511F082AC0242AC15010A`,
    southwestCode: 'PHY242',
  }),
]);

const RADFORD_RECEIVERS = Object.freeze([
  Object.freeze({
    key: 'PHYS221',
    url: `https://${RADFORD_HOST}/registrar/course-descriptions/physics/phys-221.html`,
  }),
  Object.freeze({
    key: 'PHYS222',
    url: `https://${RADFORD_HOST}/registrar/course-descriptions/physics/phys-222.html`,
  }),
]);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function crawlDelay(robotsText) {
  const values = String(robotsText || '').split(/\r?\n/)
    .map((line) => /^\s*Crawl-delay:\s*(\d+(?:\.\d+)?)\s*$/i.exec(line)?.[1])
    .filter(Boolean).map(Number);
  return values.length ? Math.max(...values) : 0;
}

async function fetchBytes(url, accept) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    headers: { accept, 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  const body = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body,
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
    status: response.status,
    contentType: response.contentType,
    responseBytes: response.body.length,
    responseSha256: sha256(response.body),
  };
}

function exactSouthwestRoute(html, sendingCode) {
  const $ = cheerio.load(Buffer.isBuffer(html) ? html.toString('utf8') : String(html || ''));
  const matches = [];
  $('#courses-equivalencies-table table tr').each((index, row) => {
    const cells = $(row).find('td').map((cellIndex, cell) => normalize($(cell).text())).get();
    if (cells.length < 5
        || cells[0] !== 'Southwest Virginia Community College'
        || cells[1].replace(/[\s-]/g, '').toUpperCase() !== sendingCode
        || cells[4].toLowerCase() !== '2-year') return;
    const anchors = $(row).find('a[href^="/course/"]').filter((anchorIndex, anchor) => (
      normalize($(anchor).text()).replace(/[\s-]/g, '').toUpperCase() === sendingCode
    ));
    if (anchors.length !== 1) return;
    const href = anchors.first().attr('href') || '';
    if (/^\/course\/[A-F0-9]{20,}$/i.test(href)) {
      matches.push(`https://${TRANSFER_HOST}${href}`);
    }
  });
  if (matches.length !== 1) {
    throw new Error(`expected one exact Southwest ${sendingCode} route, found ${matches.length}`);
  }
  return matches[0];
}

function assertTransferCourse(response, expected) {
  if (response.requestedUrl !== expected.url || response.finalUrl !== expected.url
      || response.status !== 200
      || !response.contentType.toLowerCase().includes('text/html')) {
    throw new Error(`${expected.key} response boundary changed`);
  }
  const page = parseCoursePage(response.body.toString('utf8'), { url: expected.url });
  const edges = (page.equivalencies || []).filter((edge) => (
    edge.institution === 'Radford University'
      && edge.identifier === expected.receivingCode
      && edge.level === 'four_year'
  ));
  if (page.institution !== expected.institution
      || page.code !== expected.sendingCode
      || page.title !== expected.sendingTitle
      || Number(page.credits) !== expected.sendingCredits
      || edges.length !== 1) {
    throw new Error(`${expected.key} exact source identity or Radford edge changed`);
  }
}

function transferFile(key) {
  return path.join(SOURCES, 'transfer', `${key.replace(/:/g, '__')}.html`);
}

function radfordFile(key) {
  return path.join(SOURCES, 'radford', `${key}.html`);
}

async function acquireOfficialSources() {
  const [transferRobots, radfordRobots] = await Promise.all([
    fetchBytes(TRANSFER_ROBOTS_URL, 'text/plain'),
    fetchBytes(RADFORD_ROBOTS_URL, 'text/plain'),
  ]);
  const transferRobotsText = transferRobots.body.toString('utf8');
  const radfordRobotsText = radfordRobots.body.toString('utf8');
  const transferDelay = crawlDelay(transferRobotsText);
  const radfordDelay = crawlDelay(radfordRobotsText);
  if (transferDelay !== 10) {
    throw new Error(`Transfer Virginia crawl delay changed from 10 to ${transferDelay}`);
  }

  let transferNextAllowedAt = transferRobots.startedAt + transferDelay * 1000;
  async function fetchTransfer(url) {
    if (!robotsAllows(url, transferRobotsText)) {
      throw new Error(`${url} is not allowed by current Transfer Virginia robots policy`);
    }
    const wait = Math.max(0, transferNextAllowedAt - Date.now());
    if (wait) await sleep(wait);
    const response = await fetchBytes(url, 'text/html');
    transferNextAllowedAt = response.startedAt + transferDelay * 1000;
    return response;
  }

  let radfordNextAllowedAt = radfordRobots.startedAt + radfordDelay * 1000;
  async function fetchRadford(url) {
    if (!robotsAllows(url, radfordRobotsText)) {
      throw new Error(`${url} is not allowed by current Radford robots policy`);
    }
    const wait = Math.max(0, radfordNextAllowedAt - Date.now());
    if (wait) await sleep(wait);
    const response = await fetchBytes(url, 'text/html');
    radfordNextAllowedAt = response.startedAt + radfordDelay * 1000;
    return response;
  }

  const radfordPromise = (async () => {
    const pages = {};
    for (const target of RADFORD_RECEIVERS) {
      pages[target.key] = await fetchRadford(target.url);
    }
    return pages;
  })();

  const transfer = {};
  const southwestTargets = [];
  for (const target of RICHARD_BLAND) {
    const response = await fetchTransfer(target.url);
    assertTransferCourse(response, target);
    transfer[target.key] = response;
    southwestTargets.push({
      key: `southwest-virginia-community-college:${target.southwestCode}`,
      institution: 'Southwest Virginia Community College',
      sendingCode: target.southwestCode,
      sendingTitle: target.sendingCode === 'PHYS201'
        ? 'University Physics I' : 'University Physics II',
      sendingCredits: 4,
      receivingCode: target.receivingCode,
      url: exactSouthwestRoute(response.body, target.southwestCode),
    });
  }
  for (const target of southwestTargets) {
    const response = await fetchTransfer(target.url);
    assertTransferCourse(response, target);
    transfer[target.key] = response;
  }
  const radford = await radfordPromise;
  return {
    transfer,
    radford,
    robots: {
      transfer: { ...transferRobots, host: TRANSFER_HOST, crawlDelay: transferDelay },
      radford: { ...radfordRobots, host: RADFORD_HOST, crawlDelay: radfordDelay },
    },
  };
}

function sourceManifest(sources) {
  return {
    schema_version: 1,
    captured_on: '2026-08-25',
    purpose: 'Exact current official receipts for the remaining Richard Bland and Southwest Radford science-pair audit; no statewide identity inference.',
    robots: Object.fromEntries(Object.entries(sources.robots).map(([key, response]) => [
      key, { ...responseRecord(response), host: response.host, crawlDelay: response.crawlDelay },
    ])),
    transferResponses: Object.fromEntries(Object.entries(sources.transfer).map(([key, value]) => [
      key, responseRecord(value),
    ])),
    radfordResponses: Object.fromEntries(Object.entries(sources.radford).map(([key, value]) => [
      key, responseRecord(value),
    ])),
  };
}

function writeSources(sources) {
  fs.mkdirSync(path.join(SOURCES, 'transfer'), { recursive: true });
  fs.mkdirSync(path.join(SOURCES, 'radford'), { recursive: true });
  for (const [key, response] of Object.entries(sources.transfer)) {
    fs.writeFileSync(transferFile(key), response.body);
  }
  for (const [key, response] of Object.entries(sources.radford)) {
    fs.writeFileSync(radfordFile(key), response.body);
  }
  fs.writeFileSync(path.join(SOURCES, 'transfer-robots.txt'), sources.robots.transfer.body);
  fs.writeFileSync(path.join(SOURCES, 'radford-robots.txt'), sources.robots.radford.body);
  fs.writeFileSync(MANIFEST, `${JSON.stringify(sourceManifest(sources), null, 2)}\n`);
}

function loadRetainedSources() {
  if (!fs.existsSync(MANIFEST)) throw new Error('missing retained remaining-pair manifest');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const transfer = {};
  for (const [key, response] of Object.entries(manifest.transferResponses || {})) {
    transfer[key] = { ...response, body: fs.readFileSync(transferFile(key)) };
  }
  const radford = {};
  for (const [key, response] of Object.entries(manifest.radfordResponses || {})) {
    radford[key] = { ...response, body: fs.readFileSync(radfordFile(key)) };
  }
  const robots = {};
  for (const [key, response] of Object.entries(manifest.robots || {})) {
    robots[key] = {
      ...response,
      body: fs.readFileSync(path.join(SOURCES, `${key}-robots.txt`)),
    };
  }
  return { transfer, radford, robots, manifest };
}

async function main(argv = process.argv.slice(2)) {
  const refresh = argv.includes('--refresh');
  const write = argv.includes('--write');
  const unknown = argv.filter((argument) => !['--refresh', '--write'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if (write && !refresh) throw new Error('--write requires --refresh');
  const sources = refresh ? await acquireOfficialSources() : loadRetainedSources();
  if (write) writeSources(sources);
  const manifest = refresh ? sourceManifest(sources) : sources.manifest;
  console.log('Radford remaining science-pair official source capture: PASS');
  console.log(`  transfer course pages: ${Object.keys(sources.transfer).length}`);
  console.log(`  Radford receiving pages: ${Object.keys(sources.radford).length}`);
  console.log(`  Transfer robots SHA-256: ${manifest.robots.transfer.responseSha256}`);
  console.log(write ? `  wrote ${SOURCES}` : '  replayed retained exact bytes');
  return sources;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  MANIFEST,
  RADFORD_RECEIVERS,
  RICHARD_BLAND,
  SOURCES,
  acquireOfficialSources,
  crawlDelay,
  exactSouthwestRoute,
  loadRetainedSources,
  main,
  responseRecord,
  sourceManifest,
};
