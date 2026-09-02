#!/usr/bin/env node
/** Cache-only deterministic replay for Randolph-Macon attribute evidence. */
const fs = require('node:fs');
const path = require('node:path');
const {
  RAW_DIR,
  FILES,
  SOURCES,
  sourceFiles,
  verifyCachedCapture,
} = require('./captureRandolphMaconCollegiateAttributeSources');
const {
  buildRandolphMaconCollegiateAttributeEvidence,
} = require('../../services/analysis/randolphMaconCollegiateAttributeEvidence');

const SERVER = path.resolve(__dirname, '../..');
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research',
  'randolph-macon-collegiate-attribute-evidence.json',
);

function buildFromCache() {
  const capture = verifyCachedCapture();
  if (!capture.verified) {
    throw new Error(`invalid Randolph-Macon source cache: ${capture.issues.join(', ')}`);
  }
  return buildRandolphMaconCollegiateAttributeEvidence({
    htmlBySource: Object.fromEntries(SOURCES.map((source) => [
      source.id, fs.readFileSync(sourceFiles(source).raw, 'utf8'),
    ])),
    normalizedBySource: Object.fromEntries(SOURCES.map((source) => [
      source.id, fs.readFileSync(sourceFiles(source).normalized, 'utf8'),
    ])),
    captureMetadata: JSON.parse(fs.readFileSync(FILES.metadata, 'utf8')),
    robotsText: fs.readFileSync(FILES.robots, 'utf8'),
  });
}

function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const evidence = buildFromCache();
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) fs.writeFileSync(OUTPUT, rendered);
  else {
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked evidence: ${OUTPUT}`);
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Randolph-Macon Collegiate attribute evidence drifted; inspect and rerun with --write');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    const total = Object.values(evidence.rosters)
      .reduce((sum, roster) => sum + roster.occurrence_count, 0);
    console.log('Randolph-Macon Collegiate attribute evidence: PARTIALLY VERIFIED');
    console.log(`  exact published roster occurrences: ${total}`);
    console.log('  public-list scope: positive lower bound; not exhaustive');
    console.log('  safe figure scope: WA is zero-increment for Figures 1/3/4; Figure 6 stays blocked');
    console.log('  source/composition/projection/database mutations: 0');
    console.log(write ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
  }
  return evidence;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { OUTPUT, RAW_DIR, buildFromCache, main };
