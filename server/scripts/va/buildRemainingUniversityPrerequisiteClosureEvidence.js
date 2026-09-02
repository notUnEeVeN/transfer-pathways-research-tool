#!/usr/bin/env node
/** Read-only replay for the de-duplicated residual prerequisite evidence. */

const fs = require('node:fs');
const {
  EVIDENCE_PATH,
  buildEvidence,
  evidenceIssues,
} = require('../../services/virginia/remainingUniversityPrerequisiteClosureEvidence');

const WRITE = process.argv.includes('--write');
const JSON_ONLY = process.argv.includes('--json');
const allowed = new Set(['--write', '--json']);
const unknown = process.argv.slice(2).filter((arg) => !allowed.has(arg));
if (unknown.length) {
  console.error(`unknown option(s): ${unknown.join(', ')}`);
  process.exit(2);
}

function main() {
  const artifact = buildEvidence();
  const issues = evidenceIssues(artifact);
  if (issues.length) {
    throw new Error(`remaining university prerequisite evidence invalid: ${issues.join(', ')}`);
  }
  const rendered = `${JSON.stringify(artifact, null, 2)}\n`;
  if (WRITE) fs.writeFileSync(EVIDENCE_PATH, rendered);
  else if (!fs.existsSync(EVIDENCE_PATH)
      || fs.readFileSync(EVIDENCE_PATH, 'utf8') !== rendered) {
    throw new Error(
      'Remaining university prerequisite evidence drifted; rerun with --write',
    );
  }
  if (JSON_ONLY) return process.stdout.write(rendered);
  console.log('Remaining university prerequisite closure evidence: PASS');
  console.log(`  residual target rows ${artifact.summary.residual_target_rows}`);
  console.log(`  safe zero-course-edge ${artifact.summary.safe_zero_course_edge_rows}`);
  console.log(`  exact formulas ${artifact.summary.exact_formula_rows}`);
  console.log(`  runtime-ready formulas ${artifact.summary.runtime_ready_formula_rows}`);
  console.log(`  new blocked references ${artifact.summary.new_blocked_reference_rows}`);
  console.log(`  facts sha256 ${artifact.facts_sha256}`);
  console.log(WRITE ? `  wrote ${EVIDENCE_PATH}` : '  retained replay: no drift');
  return artifact;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

module.exports = { main };
