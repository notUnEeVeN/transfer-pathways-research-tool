#!/usr/bin/env node
/**
 * Capture/replay NOVA's exact current CSC 222 Java witness and New River's
 * explicitly non-resolving current context.
 *
 * Default mode is a network-free retained-response replay. `--refresh` fetches
 * the official HTTPS pages and rewrites only this evidence bundle. MongoDB is
 * never opened by either mode.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  NEW_RIVER_POSTING_URL,
  NEW_RIVER_ROBOTS_URL,
  NEW_RIVER_SCHEDULE_URL,
  NOVA_URL,
  VCCS_ROBOTS_URL,
  buildVirginiaTechCsc222JavaEvidence,
} = require('../../services/analysis/virginiaTechCsc222JavaEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(
  SERVER,
  '.va-catalogs/research/virginia-tech-csc222-java-sources',
);
const OUTPUT = path.join(
  SERVER,
  '.va-catalogs/research/virginia-tech-csc222-java-evidence.json',
);
const FILES = Object.freeze({
  nova_schedule: path.join(SOURCE_DIR, 'nova-csc222-fall-2026.html'),
  new_river_schedule: path.join(SOURCE_DIR, 'new-river-csc222-fall-2026.html'),
  new_river_staffing_posting: path.join(
    SOURCE_DIR,
    'new-river-csc222-java-staffing-posting.html',
  ),
  vccs_robots: path.join(SOURCE_DIR, 'courses-vccs-robots.txt'),
  new_river_robots: path.join(SOURCE_DIR, 'new-river-robots.txt'),
});
const URLS = Object.freeze({
  nova_schedule: NOVA_URL,
  new_river_schedule: NEW_RIVER_SCHEDULE_URL,
  new_river_staffing_posting: NEW_RIVER_POSTING_URL,
  vccs_robots: VCCS_ROBOTS_URL,
  new_river_robots: NEW_RIVER_ROBOTS_URL,
});
const CONTENT_TYPES = Object.freeze({
  nova_schedule: 'text/html; charset=UTF-8',
  new_river_schedule: 'text/html; charset=UTF-8',
  new_river_staffing_posting: 'text/html; charset=UTF-8',
  vccs_robots: 'text/plain',
  new_river_robots: 'text/plain; charset=utf-8',
});
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

async function fetchSource(name) {
  const url = URLS[name];
  const response = await fetch(url, {
    headers: {
      accept: name.includes('robots') ? 'text/plain' : 'text/html',
      'user-agent': USER_AGENT,
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: await response.text(),
    requestedUrl: url,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') || '',
    status: response.status,
  };
}

async function liveSources() {
  // courses.vccs.edu publishes Crawl-delay: 1 for the wildcard agent. Only
  // one page is fetched from that host; the robots file is fetched first.
  const vccsRobots = await fetchSource('vccs_robots');
  const nova = await fetchSource('nova_schedule');
  const newRiverRobots = await fetchSource('new_river_robots');
  const newRiverSchedule = await fetchSource('new_river_schedule');
  const newRiverPosting = await fetchSource('new_river_staffing_posting');
  return {
    nova_schedule: nova,
    new_river_schedule: newRiverSchedule,
    new_river_staffing_posting: newRiverPosting,
    vccs_robots: vccsRobots,
    new_river_robots: newRiverRobots,
  };
}

function retainedSources() {
  return Object.fromEntries(Object.entries(FILES).map(([name, file]) => {
    if (!fs.existsSync(file)) throw new Error(`missing retained CSC 222 source: ${file}`);
    return [name, {
      body: fs.readFileSync(file, 'utf8'),
      requestedUrl: URLS[name],
      finalUrl: URLS[name],
      contentType: CONTENT_TYPES[name],
      status: 200,
    }];
  }));
}

function renderArtifact(sources) {
  return `${JSON.stringify(buildVirginiaTechCsc222JavaEvidence(sources), null, 2)}\n`;
}

async function main(argv = process.argv.slice(2)) {
  const refresh = argv.includes('--refresh');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((arg) => !['--refresh', '--json'].includes(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if (refresh && jsonOnly) throw new Error('--refresh and --json are mutually exclusive');

  const sources = refresh ? await liveSources() : retainedSources();
  const rendered = renderArtifact(sources);
  if (refresh) {
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
    for (const [name, source] of Object.entries(sources)) {
      fs.writeFileSync(FILES[name], source.body);
    }
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('retained CSC 222 Java evidence artifact drifted');
    }
  }

  if (jsonOnly) process.stdout.write(rendered);
  else {
    const artifact = JSON.parse(rendered);
    console.log('Virginia Tech CSC 222 Java evidence: PASS');
    console.log(`  facts SHA-256: ${artifact.facts_sha256}`);
    for (const [name, source] of Object.entries(artifact.sources)) {
      console.log(`  ${name} SHA-256: ${source.response_sha256}`);
    }
    console.log(refresh ? `  wrote ${OUTPUT}` : '  retained replay: no drift');
  }
  return JSON.parse(rendered);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  FILES,
  OUTPUT,
  URLS,
  liveSources,
  main,
  renderArtifact,
  retainedSources,
};
