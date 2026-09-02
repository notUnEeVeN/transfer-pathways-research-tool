#!/usr/bin/env node
/**
 * Capture/check the exact UVA Wise contextual-course rosters and current IE
 * evidence gap. This command never opens MongoDB.
 *
 *   node scripts/va/captureUvaWiseGeRosterEvidence.js
 *   node scripts/va/captureUvaWiseGeRosterEvidence.js --fetch --write
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  IE_URL,
  buildUvaWiseGeRosterEvidence,
} = require('../../services/analysis/uvaWiseGeRosterEvidence');

const SERVER = path.resolve(__dirname, '../..');
const GE_TEXT = path.join(
  SERVER, '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__ge.txt',
);
const MAJOR_TEXT = path.join(
  SERVER, '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__program.txt',
);
const ROBOTS = path.join(
  SERVER, '.va-catalogs/research/uva-wise-transfer-policy-sources/robots.txt',
);
const SOURCES = path.join(
  SERVER, '.va-catalogs/research/uva-wise-ge-roster-sources',
);
const IE_HTML = path.join(SOURCES, 'inclusive-excellence.html');
const IE_METADATA = path.join(SOURCES, 'inclusive-excellence.json');
const OUTPUT = path.join(
  SERVER, '.va-catalogs/research/uva-wise-ge-roster-evidence.json',
);
const USER_AGENT = 'transfer-pathways-research/1.0 (+source-verification; contact: research)';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function fetchInclusiveExcellence() {
  const response = await fetch(IE_URL, {
    redirect: 'follow',
    headers: { accept: 'text/html', 'user-agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`${IE_URL} returned HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  return {
    html: body.toString('utf8'),
    metadata: {
      requested_url: IE_URL,
      final_url: response.url,
      http_status: response.status,
      content_type: response.headers.get('content-type') || '',
      response_bytes: body.length,
      response_sha256: sha256(body),
      fetched_at: new Date().toISOString(),
    },
  };
}

function readRetainedInclusiveExcellence() {
  return {
    html: fs.readFileSync(IE_HTML, 'utf8'),
    metadata: JSON.parse(fs.readFileSync(IE_METADATA, 'utf8')),
  };
}

function buildFromRetainedSources(ie = readRetainedInclusiveExcellence()) {
  return buildUvaWiseGeRosterEvidence({
    geText: fs.readFileSync(GE_TEXT, 'utf8'),
    majorText: fs.readFileSync(MAJOR_TEXT, 'utf8'),
    ieHtml: ie.html,
    robotsText: fs.readFileSync(ROBOTS, 'utf8'),
    ieResponse: ie.metadata,
  });
}

async function main(argv = process.argv.slice(2)) {
  const fetchSource = argv.includes('--fetch');
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((arg) => !['--fetch', '--write', '--json'].includes(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  if (write && !fetchSource) throw new Error('--write requires --fetch');
  const ie = fetchSource ? await fetchInclusiveExcellence() : readRetainedInclusiveExcellence();
  const evidence = buildFromRetainedSources(ie);
  if (!evidence.verified) {
    throw new Error(`UVA Wise GE evidence failed: ${evidence.issues.join(', ')}`);
  }
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) {
    fs.mkdirSync(SOURCES, { recursive: true });
    fs.writeFileSync(IE_HTML, ie.html);
    fs.writeFileSync(IE_METADATA, `${JSON.stringify(ie.metadata, null, 2)}\n`);
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('UVA Wise GE roster artifact drifted');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('UVA Wise GE roster / IE-gap evidence: PASS');
    console.log(`  contextual occurrences: ${evidence.contextual.occurrence_count}`);
    console.log(`  contextual unique courses: ${evidence.contextual.unique_course_count}`);
    console.log('  Figure 3/4 fixed contextual witness: 18/18 remaining credits');
    console.log('  IE designation roster completeness: NOT PROVED');
    console.log('  major lab roster / pair qualification: NOT PROVED');
    console.log(write ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
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
  GE_TEXT,
  IE_HTML,
  IE_METADATA,
  MAJOR_TEXT,
  OUTPUT,
  ROBOTS,
  SOURCES,
  buildFromRetainedSources,
  fetchInclusiveExcellence,
  main,
  readRetainedInclusiveExcellence,
};
