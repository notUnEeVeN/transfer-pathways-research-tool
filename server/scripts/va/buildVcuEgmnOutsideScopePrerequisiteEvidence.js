#!/usr/bin/env node
/**
 * Deterministically build/check the standalone VCU EGMN closure evidence.
 * Retained local source only: no network or database access. Writes require
 * the explicit --write option.
 */

const fs = require('node:fs');
const {
  EVIDENCE_PATH,
  buildEvidence,
  evidenceIssues,
} = require('../../services/virginia/vcuEgmnOutsideScopePrerequisiteEvidence');

function buildFromRetainedSource() {
  const artifact = buildEvidence();
  const issues = evidenceIssues(artifact);
  if (issues.length) throw new Error(`VCU EGMN evidence failed: ${issues.join(', ')}`);
  return artifact;
}

function main(args = process.argv.slice(2)) {
  const allowed = new Set(['--write', '--json']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const write = args.includes('--write');
  const json = args.includes('--json');
  const artifact = buildFromRetainedSource();
  const rendered = `${JSON.stringify(artifact, null, 2)}\n`;
  if (write) fs.writeFileSync(EVIDENCE_PATH, rendered);
  else if (!fs.existsSync(EVIDENCE_PATH)
      || fs.readFileSync(EVIDENCE_PATH, 'utf8') !== rendered) {
    throw new Error('VCU EGMN prerequisite evidence drifted; inspect and rerun with --write');
  }
  if (json) {
    process.stdout.write(rendered);
    return artifact;
  }
  console.log('VCU EGMN outside-scope prerequisite evidence: VERIFIED');
  console.log(`  exact complete entries ${artifact.summary.exact_complete_entry_rows}`);
  console.log(`  exact formula / structural none ${artifact.summary.exact_formula_rows} / ${artifact.summary.safe_structural_none_rows}`);
  console.log(`  runtime blocked ${artifact.summary.runtime_blocked_rows}`);
  console.log(`  owner-local course references ${artifact.summary.owner_local_course_reference_keys}`);
  console.log(`  facts sha256 ${artifact.facts_sha256}`);
  console.log(write ? `  wrote ${EVIDENCE_PATH}` : '  retained replay: no drift');
  return artifact;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildFromRetainedSource, main };
