#!/usr/bin/env node
/**
 * Rebuild/check the fail-closed collection scope for the receiving-university
 * prerequisite corpus required by Virginia Figure 6. This script is local-file
 * only: it never connects to MongoDB and writes only with an explicit --write.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  ACTIVE_UNIVERSITY_COHORT,
  buildUniversityPrerequisiteScope,
  validateUniversityPrerequisiteScope,
} = require('../../services/virginia/universityPrerequisiteScope');

const SERVER = path.resolve(__dirname, '../..');
const CACHE = path.join(SERVER, '.va-catalogs');
const OUTPUT = path.join(CACHE, 'research', 'va-university-prerequisite-scope.json');
const WRITE = process.argv.includes('--write');
const JSON_ONLY = process.argv.includes('--json');
const unknown = process.argv.slice(2).filter((arg) => !['--write', '--json'].includes(arg));
if (unknown.length) {
  console.error(`unknown option(s): ${unknown.join(', ')}`);
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function buildFromCache() {
  const compositions = {};
  const requirements = {};
  const catalogTexts = {};
  for (const { slug } of ACTIVE_UNIVERSITY_COHORT) {
    compositions[slug] = readJson(path.join(CACHE, 'composed', `${slug}.json`));
    requirements[slug] = readJson(path.join(CACHE, 'requirements', `${slug}.json`));
    catalogTexts[slug] = fs.readFileSync(
      path.join(CACHE, 'pages', `${slug}__course_catalog.txt`),
      'utf8',
    );
  }
  return buildUniversityPrerequisiteScope({ compositions, requirements, catalogTexts });
}

function main() {
  const built = buildFromCache();
  const validation = validateUniversityPrerequisiteScope(built);
  if (!validation.valid) throw new Error(`scope validation failed: ${validation.issues.join(', ')}`);
  const rendered = `${JSON.stringify(built, null, 2)}\n`;

  if (WRITE) {
    fs.writeFileSync(OUTPUT, rendered);
  } else {
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked-in scope artifact: ${OUTPUT}`);
    const current = fs.readFileSync(OUTPUT, 'utf8');
    if (current !== rendered) throw new Error('Virginia university prerequisite scope drifted; inspect and rerun with --write');
  }

  if (JSON_ONLY) {
    process.stdout.write(rendered);
    return;
  }
  const { summary } = built;
  console.log(`Virginia university prerequisite scope: BLOCKED (${summary.active_universities} owners)`);
  console.log(`  named direct courses ${summary.direct_named_courses}`);
  console.log(`  exact tokens in cached official text ${summary.exact_code_tokens_in_cached_official_text}`);
  console.log(`  direct course-detail capture floor ${summary.direct_course_detail_capture_floor}`);
  console.log(`  open requirement receivers ${summary.unnamed_requirement_receivers}`);
  console.log(`  open GE receivers ${summary.ge_area_receivers}`);
  console.log(`  checked-in owner-scoped prerequisite rows ${summary.checked_in_owner_scoped_rows}`);
  console.log('  recursive closure unknown until direct formulas are parsed');
  console.log(WRITE ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
}

if (require.main === module) main();

module.exports = { OUTPUT, buildFromCache };
