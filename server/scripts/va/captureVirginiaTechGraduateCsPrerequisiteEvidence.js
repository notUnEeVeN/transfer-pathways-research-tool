#!/usr/bin/env node
/**
 * Capture/replay the exact current first-party Virginia Tech graduate CS page
 * used only for CS5104 and CS5114 prerequisite evidence. No database is opened.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL,
  VIRGINIA_TECH_GRADUATE_CS_URL,
  buildVirginiaTechGraduateCsPrerequisiteEvidence,
} = require('../../services/virginia/virginiaTechGraduateCsPrerequisiteEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(
  SERVER,
  '.va-catalogs/research/virginia-tech-graduate-cs-prerequisite-sources',
);
const PAGE = path.join(SOURCE_DIR, 'graduate-course-descriptions.html');
const ROBOTS = path.join(SOURCE_DIR, 'students-cs-vt-robots.txt');
const OUTPUT = path.join(
  SERVER,
  '.va-catalogs/research/virginia-tech-graduate-cs-prerequisite-evidence.json',
);
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

async function fetchBytes(url, accept) {
  const response = await fetch(url, {
    headers: { accept, 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: Buffer.from(await response.arrayBuffer()),
    requestedUrl: url,
    finalUrl: response.url,
    contentType: response.headers.get('content-type') || '',
    status: response.status,
  };
}

async function liveSources() {
  const robots = await fetchBytes(VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL, 'text/plain');
  const page = await fetchBytes(VIRGINIA_TECH_GRADUATE_CS_URL, 'text/html');
  return { page, robots };
}

function retainedSources() {
  for (const file of [PAGE, ROBOTS]) {
    if (!fs.existsSync(file)) {
      throw new Error(`missing retained Virginia Tech graduate CS source: ${file}`);
    }
  }
  return {
    page: {
      body: fs.readFileSync(PAGE),
      requestedUrl: VIRGINIA_TECH_GRADUATE_CS_URL,
      finalUrl: VIRGINIA_TECH_GRADUATE_CS_URL,
      contentType: 'text/html;charset=utf-8',
      status: 200,
    },
    robots: {
      body: fs.readFileSync(ROBOTS),
      requestedUrl: VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
      finalUrl: VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL,
      contentType: 'text/plain;charset=iso-8859-1',
      status: 200,
    },
  };
}

function renderArtifact(sources) {
  const evidence = buildVirginiaTechGraduateCsPrerequisiteEvidence(sources.page.body, {
    requestedUrl: sources.page.requestedUrl,
    finalUrl: sources.page.finalUrl,
    contentType: sources.page.contentType,
    status: sources.page.status,
    robotsBytes: sources.robots.body,
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
      throw new Error('retained Virginia Tech graduate CS prerequisite evidence drifted');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    const evidence = JSON.parse(rendered);
    console.log('Virginia Tech graduate CS prerequisite evidence: PASS');
    console.log(`  source bytes: ${evidence.source.response_bytes}`);
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
