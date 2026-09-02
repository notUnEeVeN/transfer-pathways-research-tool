#!/usr/bin/env node
/**
 * Rebuild/check review-only receiving-university prerequisite entry candidates.
 * Local cache only: no database or network access; writes only with --write.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  buildUniversityPrerequisiteCandidates,
  validateUniversityPrerequisiteCandidates,
} = require('../../services/virginia/universityPrerequisiteCandidates');

const SERVER = path.resolve(__dirname, '../..');
const CACHE = path.join(SERVER, '.va-catalogs');
const SCOPE = path.join(CACHE, 'research', 'va-university-prerequisite-scope.json');
const ACQUISITION = path.join(CACHE, 'research', 'va-university-prerequisite-acquisition.json');
const OUTPUT = path.join(CACHE, 'research', 'va-university-prerequisite-candidates.json');
const WRITE = process.argv.includes('--write');
const JSON_ONLY = process.argv.includes('--json');
const unknown = process.argv.slice(2).filter((arg) => !['--write', '--json'].includes(arg));
if (unknown.length) {
  console.error(`unknown option(s): ${unknown.join(', ')}`);
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function buildFromCache() {
  const scope = readJson(SCOPE);
  const catalogTexts = Object.fromEntries(scope.universities.map(({ slug }) => [
    slug,
    fs.readFileSync(path.join(CACHE, 'pages', `${slug}__course_catalog.txt`), 'utf8'),
  ]));
  const acquisition = fs.existsSync(ACQUISITION) ? readJson(ACQUISITION) : null;
  const artifact = buildUniversityPrerequisiteCandidates({ scope, catalogTexts, acquisition });
  const validation = validateUniversityPrerequisiteCandidates(artifact, { scope, catalogTexts });
  if (!validation.valid) throw new Error(`candidate validation failed: ${validation.issues.join(', ')}`);
  return artifact;
}

function main() {
  const artifact = buildFromCache();
  const rendered = `${JSON.stringify(artifact, null, 2)}\n`;
  if (WRITE) {
    fs.writeFileSync(OUTPUT, rendered);
  } else {
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked-in candidate artifact: ${OUTPUT}`);
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Virginia university prerequisite candidates drifted; inspect and rerun with --write');
    }
  }
  if (JSON_ONLY) {
    process.stdout.write(rendered);
    return;
  }
  const { summary } = artifact;
  console.log('Virginia university prerequisite candidates: REVIEW REQUIRED');
  console.log(`  direct named courses ${summary.direct_named_courses}`);
  console.log(`  exact cached token hits ${summary.exact_code_tokens_in_cached_official_text}`);
  console.log(`  safely bounded review candidates ${summary.safely_bounded_review_candidates}`);
  console.log(`    direct ${summary.safely_bounded_direct_review_candidates}; closure ${summary.safely_bounded_closure_review_candidates}`);
  console.log(`    newly acquired ${summary.acquired_exact_entry_candidates}`);
  console.log(`  token hits without bounded entry ${summary.exact_tokens_without_bounded_entry}`);
  console.log(`  remaining direct-capture floor ${summary.remaining_direct_capture_floor}`);
  console.log('  publication contract rows 0; recursive closure unknown');
  console.log(WRITE ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
}

if (require.main === module) main();

module.exports = { OUTPUT, buildFromCache };
