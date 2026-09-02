#!/usr/bin/env node

const fs = require('node:fs');
const {
  EVIDENCE_PATH,
  buildEvidence,
  evidenceIssues,
} = require('../../services/virginia/radfordRandolphMaconPrerequisiteTailEvidence');

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
  if (issues.length) throw new Error(`tail evidence invalid: ${issues.join(', ')}`);
  const rendered = `${JSON.stringify(artifact, null, 2)}\n`;
  if (WRITE) fs.writeFileSync(EVIDENCE_PATH, rendered);
  else if (!fs.existsSync(EVIDENCE_PATH)
      || fs.readFileSync(EVIDENCE_PATH, 'utf8') !== rendered) {
    throw new Error('Radford/Randolph-Macon prerequisite tail evidence drifted; rerun with --write');
  }
  if (JSON_ONLY) return process.stdout.write(rendered);
  console.log('Radford/Randolph-Macon prerequisite tail evidence: PASS');
  console.log(`  exact target entries ${artifact.summary.exact_current_complete_entry_rows}`);
  console.log(`  safe zero-course-edge ${artifact.summary.safe_zero_course_edge_rows}`);
  console.log(`  blocked required knowledge ${artifact.summary.blocked_required_prior_knowledge_rows}`);
  console.log(`  source upgrades ${artifact.summary.source_upgrade_rows}`);
  console.log(`  facts sha256 ${artifact.facts_sha256}`);
  console.log(WRITE ? `  wrote ${EVIDENCE_PATH}` : '  retained replay: no drift');
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

module.exports = { main };
