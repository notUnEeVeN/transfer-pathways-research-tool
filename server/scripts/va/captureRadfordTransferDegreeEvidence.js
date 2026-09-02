#!/usr/bin/env node
/**
 * Rebuild/check Radford's exact completed-transfer-degree REAL receipt.
 * Official HTTPS pages only; no database access and no curriculum mutation.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  FACULTY_URL,
  REQUIREMENTS_URL,
  ROBOTS_URL,
  TRANSFER_URL,
  USER_AGENT,
  buildRadfordTransferDegreeEvidence,
} = require('../../services/analysis/radfordTransferDegreeEvidence');

const SERVER = path.resolve(__dirname, '../..');
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research', 'radford-transfer-degree-real-evidence.json',
);

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

async function buildFromOfficialSources() {
  const [transfer, requirements, faculty, robots] = await Promise.all([
    fetchText(TRANSFER_URL, 'text/html'),
    fetchText(REQUIREMENTS_URL, 'text/html'),
    fetchText(FACULTY_URL, 'text/html'),
    fetchText(ROBOTS_URL, 'text/plain'),
  ]);
  return buildRadfordTransferDegreeEvidence({
    transferHtml: transfer.body,
    requirementsHtml: requirements.body,
    facultyHtml: faculty.body,
    robotsText: robots.body,
    robotsStatus: robots.status,
    responses: { transfer, requirements, faculty },
  });
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const evidence = await buildFromOfficialSources();
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) fs.writeFileSync(OUTPUT, rendered);
  else if (!jsonOnly && fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
    throw new Error('Radford transfer-degree evidence drifted; inspect and rerun with --write');
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Radford completed-A.S. REAL policy evidence: PASS');
    console.log(`  policy facts SHA-256: ${evidence.policy_facts_sha256}`);
    console.log(`  completed AS GE units met: ${evidence.paper_interpretation.general_education_units_met}`);
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

module.exports = { OUTPUT, buildFromOfficialSources, main };
