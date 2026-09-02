#!/usr/bin/env node
/**
 * Rebuild/check the source-bound William & Mary paper-figure evidence.
 *
 * This command is cache-only. It never opens the database or fetches the
 * network. The MATH 413/414 proof reuses the complete official MATH subject
 * response already retained by the robots-aware university acquisition
 * pipeline; the response itself, its route metadata, and the retained robots
 * body are all hash checked by the builder.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  buildWilliamMaryCurrentCatalogFigureEvidence,
} = require('../../services/analysis/williamMaryCurrentCatalogFigureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const CATALOGS = path.join(SERVER, '.va-catalogs');
const OUTPUT = path.join(
  CATALOGS, 'research', 'william-mary-current-catalog-figure-evidence.json',
);

const readText = (file) => fs.readFileSync(file, 'utf8');
const readJson = (file) => JSON.parse(readText(file));

function buildFromCache() {
  const page = (suffix) => path.join(CATALOGS, 'pages', `william-mary__${suffix}`);
  const raw = path.join(CATALOGS, 'university-prerequisites', 'raw');
  return buildWilliamMaryCurrentCatalogFigureEvidence({
    programHtml: readText(page('program.html')),
    programText: readText(page('program.txt')),
    csciHtml: readText(page('course_catalog.html')),
    csciText: readText(page('course_catalog.txt')),
    geHtml: readText(page('ge.html')),
    geText: readText(page('ge.txt')),
    integrityManifest: readJson(path.join(
      CATALOGS, 'research', 'primary-source-integrity-manifest.json',
    )),
    mathHtml: readText(path.join(
      raw, 'william-mary', 'william-mary__math.html',
    )),
    mathMetadata: readJson(path.join(
      raw, 'william-mary', 'william-mary__math.json',
    )),
    robotsText: readText(path.join(raw, '_robots', 'catalog.wm.edu.txt')),
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
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked-in evidence: ${OUTPUT}`);
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('William & Mary current-catalog figure evidence drifted; inspect and rerun with --write');
    }
  }

  if (jsonOnly) {
    process.stdout.write(rendered);
    return evidence;
  }
  const concentration = evidence.general_concentration;
  const language = evidence.foreign_language_proficiency;
  const policy = evidence.transfer_and_residency_policy;
  console.log('William & Mary current-catalog paper-figure evidence: BLOCKED');
  console.log(`  General roster: ${concentration.roster_contract.eligible_entry_count} entries`);
  console.log(`  exact 12-credit cardinalities: ${concentration.paper_interpretation.exact_feasible_credit_contributing_course_counts.join(', ')}`);
  console.log(`  language routes: ${language.source_rule.routes.length} (${language.paper_interpretation.exact_zero_increment_options.length} exact zero-increment)`);
  console.log(`  transfer grade: ${policy.transfer_grade_threshold.minimum_letter_grade} minimum (conditioned successful-pathway input)`);
  console.log(`  external 300/400 CS maximum: ${policy.computer_science_residency.external_300_400_major_courses_maximum} courses`);
  console.log('  source/core/projection mutations: 0');
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
