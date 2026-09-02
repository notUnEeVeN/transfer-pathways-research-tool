#!/usr/bin/env node
/**
 * Rebuild/check the fail-closed university prerequisite formula review.
 * Local artifacts only: no database or network access; writes only --write.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  buildUniversityPrerequisiteReview,
  validateUniversityPrerequisiteReview,
} = require('../../services/virginia/universityPrerequisiteReview');

const SERVER = path.resolve(__dirname, '../..');
const RESEARCH = path.join(SERVER, '.va-catalogs', 'research');
const SCOPE = path.join(RESEARCH, 'va-university-prerequisite-scope.json');
const CANDIDATES = path.join(RESEARCH, 'va-university-prerequisite-candidates.json');
const OUTPUT = path.join(RESEARCH, 'va-university-prerequisite-review.json');
const WRITE = process.argv.includes('--write');
const JSON_ONLY = process.argv.includes('--json');
const unknown = process.argv.slice(2).filter((arg) => !['--write', '--json'].includes(arg));
if (unknown.length) {
  console.error(`unknown option(s): ${unknown.join(', ')}`);
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function buildFromArtifacts() {
  const scope = readJson(SCOPE);
  const candidates = readJson(CANDIDATES);
  const artifact = buildUniversityPrerequisiteReview({ scope, candidates });
  const validation = validateUniversityPrerequisiteReview(artifact, { scope, candidates });
  if (!validation.valid) throw new Error(`review validation failed: ${validation.issues.join(', ')}`);
  return artifact;
}

function main() {
  const artifact = buildFromArtifacts();
  const rendered = `${JSON.stringify(artifact, null, 2)}\n`;
  if (WRITE) {
    fs.writeFileSync(OUTPUT, rendered);
  } else {
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked-in review artifact: ${OUTPUT}`);
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Virginia university prerequisite review drifted; inspect and rerun with --write');
    }
  }
  if (JSON_ONLY) {
    process.stdout.write(rendered);
    return;
  }
  const { summary, closure } = artifact;
  console.log('Virginia university prerequisite formula review: BLOCKED');
  console.log(`  direct rows ${summary.direct_required_rows}`);
  console.log(`  parsed ${summary.parsed}`);
  console.log(`  explicit none ${summary.none}`);
  console.log(`  unparsed ${summary.unparsed}`);
  console.log(`  missing ${summary.missing}`);
  console.log(`  promoted contract rows ${summary.promoted_contract_rows}`);
  console.log(`  unique formula references ${closure.formula_reference_keys}`);
  console.log(`  unresolved recursive references ${closure.unresolved_reference_keys}`);
  console.log('  publication rows 0');
  console.log(WRITE ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
}

if (require.main === module) main();

module.exports = { OUTPUT, buildFromArtifacts };
