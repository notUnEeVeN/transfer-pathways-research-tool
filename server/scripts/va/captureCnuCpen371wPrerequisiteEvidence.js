#!/usr/bin/env node
/**
 * Capture/replay the exact current CNU sources that jointly bind the degree
 * requirement code CPEN 371W to the unique CPEN 371 WI catalog entry. This
 * command uses Poppler only to derive reviewable projections and never opens
 * MongoDB.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  CNU_CATALOG_URL,
  CNU_PROGRAM_URL,
  CNU_ROBOTS_URL,
  buildCnuCpen371wPrerequisiteEvidence,
} = require('../../services/virginia/cnuCpen371wPrerequisiteEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(
  SERVER,
  '.va-catalogs/research/cnu-cpen371w-prerequisite-sources',
);
const FILES = Object.freeze({
  catalog: path.join(SOURCE_DIR, 'cnu-2026-2027-undergraduate-catalog.pdf'),
  program: path.join(SOURCE_DIR, 'computer-science-program.html'),
  robots: path.join(SOURCE_DIR, 'cnu-robots.txt'),
  pdfInfo: path.join(SOURCE_DIR, 'catalog.pdfinfo.txt'),
  catalogRawText: path.join(SOURCE_DIR, 'catalog.raw.txt'),
  programPageRawText: path.join(SOURCE_DIR, 'catalog-physical-page-272.raw.txt'),
  coursePageRawText: path.join(SOURCE_DIR, 'catalog-physical-page-275.raw.txt'),
});
const OUTPUT = path.join(
  SERVER,
  '.va-catalogs/research/cnu-cpen371w-prerequisite-evidence.json',
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

function run(command, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync(command, args, {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${String(result.stderr || '').trim()}`);
  }
  return result.stdout;
}

function pdfProjections(catalogBytes) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnu-cpen371w-'));
  const pdf = path.join(tempDir, 'catalog.pdf');
  const full = path.join(tempDir, 'catalog.raw.txt');
  const programPage = path.join(tempDir, 'program.raw.txt');
  const coursePage = path.join(tempDir, 'course.raw.txt');
  try {
    fs.writeFileSync(pdf, catalogBytes);
    const pdfInfoText = run('pdfinfo', [pdf]);
    run('pdftotext', ['-raw', pdf, full]);
    run('pdftotext', ['-f', '272', '-l', '272', '-raw', pdf, programPage]);
    run('pdftotext', ['-f', '275', '-l', '275', '-raw', pdf, coursePage]);
    return {
      pdfInfoText,
      catalogRawText: fs.readFileSync(full, 'utf8'),
      programPageRawText: fs.readFileSync(programPage, 'utf8'),
      coursePageRawText: fs.readFileSync(coursePage, 'utf8'),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function liveSources() {
  const robots = await fetchBytes(CNU_ROBOTS_URL, 'text/plain');
  const program = await fetchBytes(CNU_PROGRAM_URL, 'text/html');
  const catalog = await fetchBytes(CNU_CATALOG_URL, 'application/pdf');
  return { catalog, program, robots, ...pdfProjections(catalog.body) };
}

function retainedSources() {
  for (const file of Object.values(FILES)) {
    if (!fs.existsSync(file)) throw new Error(`missing retained CNU CPEN 371W source: ${file}`);
  }
  const catalogBytes = fs.readFileSync(FILES.catalog);
  const regenerated = pdfProjections(catalogBytes);
  for (const [name, file] of [
    ['pdfInfoText', FILES.pdfInfo],
    ['catalogRawText', FILES.catalogRawText],
    ['programPageRawText', FILES.programPageRawText],
    ['coursePageRawText', FILES.coursePageRawText],
  ]) {
    if (fs.readFileSync(file, 'utf8') !== regenerated[name]) {
      throw new Error(`retained CNU ${name} projection does not replay from the retained PDF`);
    }
  }
  return {
    catalog: {
      body: catalogBytes,
      requestedUrl: CNU_CATALOG_URL,
      finalUrl: CNU_CATALOG_URL,
      contentType: 'application/pdf',
      status: 200,
    },
    program: {
      body: fs.readFileSync(FILES.program),
      requestedUrl: CNU_PROGRAM_URL,
      finalUrl: CNU_PROGRAM_URL,
      contentType: 'text/html; charset=UTF-8',
      status: 200,
    },
    robots: {
      body: fs.readFileSync(FILES.robots),
      requestedUrl: CNU_ROBOTS_URL,
      finalUrl: CNU_ROBOTS_URL,
      contentType: 'text/plain; charset=UTF-8',
      status: 200,
    },
    ...regenerated,
  };
}

function renderArtifact(sources) {
  const evidence = buildCnuCpen371wPrerequisiteEvidence({
    catalogBytes: sources.catalog.body,
    programHtml: sources.program.body.toString('utf8'),
    robotsText: sources.robots.body.toString('utf8'),
    pdfInfoText: sources.pdfInfoText,
    catalogRawText: sources.catalogRawText,
    programPageRawText: sources.programPageRawText,
    coursePageRawText: sources.coursePageRawText,
    catalogRequestedUrl: sources.catalog.requestedUrl,
    catalogFinalUrl: sources.catalog.finalUrl,
    catalogContentType: sources.catalog.contentType,
    catalogStatus: sources.catalog.status,
    programRequestedUrl: sources.program.requestedUrl,
    programFinalUrl: sources.program.finalUrl,
    programContentType: sources.program.contentType,
    programStatus: sources.program.status,
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
    fs.writeFileSync(FILES.catalog, sources.catalog.body);
    fs.writeFileSync(FILES.program, sources.program.body);
    fs.writeFileSync(FILES.robots, sources.robots.body);
    fs.writeFileSync(FILES.pdfInfo, sources.pdfInfoText);
    fs.writeFileSync(FILES.catalogRawText, sources.catalogRawText);
    fs.writeFileSync(FILES.programPageRawText, sources.programPageRawText);
    fs.writeFileSync(FILES.coursePageRawText, sources.coursePageRawText);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('retained CNU CPEN 371W prerequisite evidence artifact drifted');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    const evidence = JSON.parse(rendered);
    console.log('CNU CPEN 371W prerequisite evidence: PASS');
    console.log(`  catalog SHA-256: ${evidence.catalog_source.response_sha256}`);
    console.log(`  program SHA-256: ${evidence.program_source.response_sha256}`);
    console.log(`  facts SHA-256: ${evidence.facts_sha256}`);
    console.log(`  identity resolved: ${evidence.facts.identity_resolution.resolved}`);
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
  SOURCE_DIR,
  liveSources,
  main,
  pdfProjections,
  renderArtifact,
  retainedSources,
};
