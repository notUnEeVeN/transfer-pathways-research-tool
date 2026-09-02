#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  EVIDENCE_PATH,
  buildEvidence,
  canonicalJson,
  evidenceIssues,
} = require('../../services/virginia/radfordUvaWiseRecursivePrerequisiteEvidence');

function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const unknown = argv.filter((arg) => arg !== '--write');
  if (unknown.length) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  const artifact = buildEvidence();
  const issues = evidenceIssues(artifact);
  if (issues.length) throw new Error(`Radford/UVA Wise evidence invalid: ${issues.join(', ')}`);
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  let drift = true;
  try {
    drift = canonicalJson(JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8')))
      !== canonicalJson(artifact);
  } catch {
    drift = true;
  }
  if (write) {
    fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
    fs.writeFileSync(EVIDENCE_PATH, serialized);
  } else if (drift) {
    throw new Error(`Radford/UVA Wise evidence drift: run ${path.relative(process.cwd(), __filename)} --write`);
  }
  console.log('Radford/UVA Wise recursive prerequisite evidence: PASS');
  console.log(`  exact entries ${artifact.summary.captured_exact_entry_rows}`);
  console.log(`  safe formulas ${artifact.summary.safe_exact_formula_rows}`);
  console.log(`  blocked rows ${artifact.summary.blocked_exact_source_rows}`);
  console.log(`  formal refs ${artifact.summary.exact_formal_reference_keys}; unresolved 0`);
  console.log(`  facts sha256 ${artifact.facts_sha256}`);
  console.log(write ? `  wrote ${EVIDENCE_PATH}` : '  retained replay: no drift');
  return artifact;
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { main };
