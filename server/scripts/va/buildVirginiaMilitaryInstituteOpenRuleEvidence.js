#!/usr/bin/env node
/**
 * Cache-only replay for VMI's supplemental open-rule source evidence.
 *
 * The durable builder consumes only retained pages plus the page-bounded PDF
 * extraction and its capture receipt. It performs no network or database I/O.
 * A clean clone can recreate the ignored raw PDF/HTTP cache with
 * `captureVirginiaMilitaryInstituteOpenRuleSources.js --fetch`.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  buildVirginiaMilitaryInstituteOpenRuleEvidence,
} = require('../../services/analysis/virginiaMilitaryInstituteOpenRuleEvidence');

const SERVER = path.resolve(__dirname, '../..');
const CATALOGS = path.join(SERVER, '.va-catalogs');
const REVIEW_DIR = path.join(CATALOGS, 'research', 'vmi-open-rule-sources');
const OUTPUT = path.join(
  CATALOGS, 'research', 'virginia-military-institute-open-rule-evidence.json',
);

const readText = (file) => fs.readFileSync(file, 'utf8');
const readJson = (file) => JSON.parse(readText(file));

function buildFromCache() {
  const page = (suffix) => path.join(
    CATALOGS, 'pages', `virginia-military-institute__${suffix}`,
  );
  return buildVirginiaMilitaryInstituteOpenRuleEvidence({
    programHtml: readText(page('program.html')),
    programText: readText(page('program.txt')),
    courseCatalogHtml: readText(page('course_catalog.html')),
    courseCatalogText: readText(page('course_catalog.txt')),
    geHtml: readText(page('ge.html')),
    geText: readText(page('ge.txt')),
    graduationHtml: readText(page('graduation.html')),
    graduationText: readText(page('graduation.txt')),
    integrityManifest: readJson(path.join(
      CATALOGS, 'research', 'primary-source-integrity-manifest.json',
    )),
    captureMetadata: readJson(path.join(REVIEW_DIR, 'capture.json')),
    boundedPageText: readText(path.join(
      REVIEW_DIR, 'vmi-2025-2026-academic-catalog__bounded-pages.txt',
    )),
    composition: readJson(path.join(
      CATALOGS, 'composed', 'virginia-military-institute.json',
    )),
  });
}

function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const evidence = buildFromCache();
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) {
    fs.writeFileSync(OUTPUT, rendered);
  } else {
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked evidence: ${OUTPUT}`);
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('VMI open-rule evidence drifted; inspect and rerun with --write');
    }
  }
  if (jsonOnly) {
    process.stdout.write(rendered);
    return evidence;
  }
  console.log('VMI open-rule source evidence: PARTIALLY VERIFIED');
  console.log('  exact source capabilities: mathematics level floor, cross-allocation C&C witness');
  console.log('  residual Figure 1/6 blocker: approved science roster');
  console.log('  residual Figure 3/4 blockers: approved science roster, conditional residency runtime state');
  console.log('  source/composition/projection/database mutations: 0');
  console.log(write ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
  return evidence;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { OUTPUT, buildFromCache, main };
