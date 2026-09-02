#!/usr/bin/env node
/**
 * Capture/replay the complete current VSU Languages and Literature page that
 * owns ARAB 110/111/212/213. This command never opens MongoDB.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  VSU_DEPARTMENT_URL,
  VSU_ROBOTS_URL,
  buildVirginiaStateArabicPrerequisiteEvidence,
} = require('../../services/virginia/virginiaStateArabicPrerequisiteEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(
  SERVER,
  '.va-catalogs/research/virginia-state-arabic-prerequisite-sources',
);
const PAGE = path.join(SOURCE_DIR, 'languages-and-literature-2026-2027.html');
const ROBOTS = path.join(SOURCE_DIR, 'catalog-vsu-robots.txt');
const OUTPUT = path.join(
  SERVER,
  '.va-catalogs/research/virginia-state-arabic-prerequisite-evidence.json',
);
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

async function fetchText(url, accept) {
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
  };
}

async function liveSources() {
  const robots = await fetchText(VSU_ROBOTS_URL, 'text/plain');
  const page = await fetchText(VSU_DEPARTMENT_URL, 'text/html');
  return { page, robots };
}

function retainedSources() {
  for (const file of [PAGE, ROBOTS]) {
    if (!fs.existsSync(file)) throw new Error(`missing retained VSU Arabic source: ${file}`);
  }
  return {
    page: {
      body: fs.readFileSync(PAGE, 'utf8'),
      requestedUrl: VSU_DEPARTMENT_URL,
      finalUrl: VSU_DEPARTMENT_URL,
      contentType: 'text/html; charset=UTF-8',
      status: 200,
    },
    robots: {
      body: fs.readFileSync(ROBOTS, 'utf8'),
      requestedUrl: VSU_ROBOTS_URL,
      finalUrl: VSU_ROBOTS_URL,
      contentType: 'text/plain; charset=UTF-8',
      status: 200,
    },
  };
}

function renderArtifact(sources) {
  const evidence = buildVirginiaStateArabicPrerequisiteEvidence(sources.page.body, {
    requestedUrl: sources.page.requestedUrl,
    finalUrl: sources.page.finalUrl,
    contentType: sources.page.contentType,
    status: sources.page.status,
    robotsText: sources.robots.body,
    robotsRequestedUrl: sources.robots.requestedUrl,
    robotsFinalUrl: sources.robots.finalUrl,
    robotsContentType: sources.robots.contentType,
    robotsStatus: sources.robots.status,
  });
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

async function main(argv = process.argv.slice(2)) {
  const refresh = argv.includes('--refresh');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--refresh', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if (refresh && jsonOnly) throw new Error('--refresh and --json are mutually exclusive');
  const sources = refresh ? await liveSources() : retainedSources();
  const rendered = renderArtifact(sources);
  if (refresh) {
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
    fs.writeFileSync(PAGE, sources.page.body);
    fs.writeFileSync(ROBOTS, sources.robots.body);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('retained VSU Arabic prerequisite evidence artifact drifted');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    const evidence = JSON.parse(rendered);
    console.log('Virginia State Arabic prerequisite evidence: PASS');
    console.log(`  source SHA-256: ${evidence.source.response_sha256}`);
    console.log(`  facts SHA-256: ${evidence.facts_sha256}`);
    console.log(`  resolved: ${evidence.disposition.resolved_course_codes.join(', ')}`);
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
  OUTPUT,
  PAGE,
  ROBOTS,
  SOURCE_DIR,
  liveSources,
  main,
  renderArtifact,
  retainedSources,
};
