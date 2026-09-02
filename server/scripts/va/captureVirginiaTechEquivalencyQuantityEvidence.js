#!/usr/bin/env node
/**
 * Rebuild/check Virginia Tech's exact current VCCS split-credit rows.
 * Official HTTPS sources only; this command never opens the database.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  EQUIVALENCY_URL,
  ROBOTS_URL,
  USER_AGENT,
  buildVirginiaTechEquivalencyQuantityEvidence,
} = require('../../services/analysis/virginiaTechEquivalencyQuantityEvidence');

const SERVER = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(
  SERVER, '.va-catalogs', 'research', 'virginia-tech-equivalency-quantity-sources',
);
const PAGE = path.join(SOURCE_DIR, 'vccs-equivalencies-2026.html');
const ROBOTS = path.join(SOURCE_DIR, 'robots.txt');
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research',
  'virginia-tech-equivalency-quantity-evidence.json',
);

async function fetchText(url, accept) {
  const response = await fetch(url, {
    headers: { accept, 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return {
    body: await response.text(),
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
  };
}

async function buildFromOfficialSources() {
  const [page, robots] = await Promise.all([
    fetchText(EQUIVALENCY_URL, 'text/html'),
    fetchText(ROBOTS_URL, 'text/plain'),
  ]);
  const evidence = buildVirginiaTechEquivalencyQuantityEvidence(page.body, {
    requestedUrl: EQUIVALENCY_URL,
    finalUrl: page.finalUrl,
    contentType: page.contentType,
    robotsText: robots.body,
    robotsStatus: robots.status,
    robotsRequestedUrl: ROBOTS_URL,
    robotsFinalUrl: robots.finalUrl,
    robotsContentType: robots.contentType,
    capturedAt: null,
  });
  return { evidence, page: page.body, robots: robots.body };
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if (write && jsonOnly) throw new Error('--write and --json are mutually exclusive');
  const built = await buildFromOfficialSources();
  const rendered = `${JSON.stringify(built.evidence, null, 2)}\n`;

  if (write) {
    fs.mkdirSync(SOURCE_DIR, { recursive: true });
    fs.writeFileSync(PAGE, built.page);
    fs.writeFileSync(ROBOTS, built.robots);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    for (const file of [PAGE, ROBOTS, OUTPUT]) {
      if (!fs.existsSync(file)) throw new Error(`missing checked-in VT quantity evidence: ${file}`);
    }
    if (fs.readFileSync(PAGE, 'utf8') !== built.page
        || fs.readFileSync(ROBOTS, 'utf8') !== built.robots
        || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Virginia Tech equivalency quantity evidence drifted; inspect and rerun with --write');
    }
  }

  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Virginia Tech VCCS equivalency quantity evidence: PASS');
    console.log(`  quantity facts SHA-256: ${built.evidence.quantity_facts_sha256}`);
    console.log(`  response SHA-256: ${built.evidence.source.response_sha256}`);
    console.log(`  robots SHA-256: ${built.evidence.robots.response_sha256}`);
    console.log(write ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
  }
  return built.evidence;
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
  buildFromOfficialSources,
  main,
};
