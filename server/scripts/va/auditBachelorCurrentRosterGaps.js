#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {
  buildVirginiaBachelorCurrentRosterGapEvidence,
} = require('../../services/analysis/virginiaBachelorCurrentRosterGapEvidence');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(
  ROOT,
  '.va-catalogs/research/virginia-bachelor-current-roster-source-gap-evidence.json',
);
const evidence = buildVirginiaBachelorCurrentRosterGapEvidence();
fs.writeFileSync(OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${OUTPUT}\n`);
