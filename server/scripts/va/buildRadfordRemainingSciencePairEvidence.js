#!/usr/bin/env node
/** Replay the retained exact bytes for the two remaining Radford pair cells. */

const fs = require('node:fs');
const path = require('node:path');
const {
  buildRadfordRemainingSciencePairEvidence,
  radfordRemainingSciencePairEvidenceIssue,
} = require('../../services/analysis/radfordRemainingSciencePairEvidence');
const {
  loadRetainedSources,
} = require('./captureRadfordRemainingSciencePairEvidence');

const SERVER = path.resolve(__dirname, '../..');
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research', 'radford-remaining-science-pair-evidence.json',
);
const SLUGS = Object.freeze([
  'richard-bland-college', 'southwest-virginia-community-college',
]);
const LEGACY_CODES = Object.freeze(['CHM111', 'CHM112', 'PHY201', 'PHY202']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadRetainedEvidenceInput() {
  const retained = loadRetainedSources();
  return {
    transferPages: Object.fromEntries(Object.entries(retained.transfer).map(([key, value]) => [
      key, value.body,
    ])),
    transferResponses: retained.transfer,
    radfordPages: Object.fromEntries(Object.entries(retained.radford).map(([key, value]) => [
      key, value.body,
    ])),
    radfordResponses: retained.radford,
    robots: retained.robots,
    planTexts: Object.fromEntries(SLUGS.map((slug) => [
      slug, fs.readFileSync(path.join(
        SERVER, '.va-catalogs', 'pages', `${slug}__program.txt`,
      )),
    ])),
    requirements: Object.fromEntries(SLUGS.map((slug) => [
      slug, readJson(path.join(SERVER, '.va-catalogs', 'requirements', `${slug}.json`)),
    ])),
    compositions: Object.fromEntries(SLUGS.map((slug) => [
      slug, readJson(path.join(SERVER, '.va-catalogs', 'composed', `${slug}.json`)),
    ])),
    legacyDiscoveryPages: Object.fromEntries(LEGACY_CODES.map((code) => [
      code, fs.readFileSync(path.join(
        SERVER, '.va-catalogs', 'research', 'radford-science-pair-college-sources',
        'discovery', `${code.toLowerCase()}.html`,
      ), 'utf8'),
    ])),
  };
}

function buildFromRetainedSources() {
  return buildRadfordRemainingSciencePairEvidence(loadRetainedEvidenceInput());
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const evidence = buildFromRetainedSources();
  const issue = radfordRemainingSciencePairEvidenceIssue(evidence);
  if (issue) throw new Error(issue);
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) fs.writeFileSync(OUTPUT, rendered);
  else if (!jsonOnly && (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered)) {
    throw new Error('remaining Radford science-pair artifact drifted; inspect before --write');
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Radford remaining science-pair exact-source audit: PASS');
    console.log(`  exact cells closed: ${evidence.exact_cells_closed.join(', ')}`);
    console.log(`  irreducible cells: ${evidence.irreducible_numeric_ids.join(', ')}`);
    console.log(`  facts SHA-256: ${evidence.facts_sha256}`);
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
  LEGACY_CODES,
  OUTPUT,
  SLUGS,
  buildFromRetainedSources,
  loadRetainedEvidenceInput,
  main,
};
