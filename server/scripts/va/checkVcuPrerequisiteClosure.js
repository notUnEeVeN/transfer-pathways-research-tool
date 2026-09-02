#!/usr/bin/env node
/**
 * Read-only replay of the finite VCU prerequisite closure control.
 *
 * Inputs are the checked-in university prerequisite candidates. This command
 * never performs network, database, or repository writes.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  buildVcuPrerequisiteControlFromCandidates,
  vcuPrerequisiteControlSummary,
} = require('../../services/virginia/vcuPrerequisiteClosureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const CANDIDATES = path.join(
  SERVER, '.va-catalogs', 'research', 'va-university-prerequisite-candidates.json',
);

function buildFromArtifact() {
  const artifact = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'));
  const control = buildVcuPrerequisiteControlFromCandidates(artifact.candidates);
  const summary = vcuPrerequisiteControlSummary(control);
  if (!control.verified) {
    throw new Error(`VCU prerequisite closure control failed: ${control.issues.join(', ')}`);
  }
  return { control, summary };
}

function main(args = process.argv.slice(2)) {
  const unknown = args.filter((arg) => arg !== '--json');
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const { summary } = buildFromArtifact();
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  }
  console.log('VCU prerequisite closure control: VERIFIED');
  console.log(`  target rows ${summary.target_rows}`);
  console.log(`  exact official courseblocks ${summary.exact_official_courseblock_rows}`);
  console.log(`  weak retained-text blockers ${summary.weak_retained_text_rows}`);
  console.log(`  safe structural-none ${summary.safe_structural_none_rows}`);
  console.log(`  blocked ${summary.blocked_rows}`);
  console.log(`  direct ${summary.direct.safe_structural_none_rows} safe / ${summary.direct.blocked_rows} blocked`);
  console.log(`  closure ${summary.closure.safe_structural_none_rows} safe / ${summary.closure.blocked_rows} blocked`);
  console.log(`  inventory sha256 ${summary.inventory_sha256}`);
  return summary;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { CANDIDATES, buildFromArtifact, main };
