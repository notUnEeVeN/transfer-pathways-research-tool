#!/usr/bin/env node
/**
 * Offline replay for the fail-closed VSU Figure 1 source-gap receipt.
 *
 * The default mode is read-only and reports drift. `--write` is an explicit
 * local-artifact rebuild; this script never touches MongoDB or degree data.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  RETAINED_PATHS,
  auditVirginiaStateFigure1SourceGapEvidence,
  buildVirginiaStateFigure1SourceGapEvidence,
} = require('../../services/analysis/virginiaStateFigure1SourceGapEvidence');

const SERVER_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const ARTIFACT_PATH = path.join(
  SERVER_ROOT,
  '.va-catalogs/research/virginia-state-figure1-source-gap.json',
);
const absolute = (repoPath) => path.join(REPO_ROOT, repoPath);
const read = (repoPath) => fs.readFileSync(absolute(repoPath), 'utf8');

function retainedSources() {
  return {
    programHtml: read(RETAINED_PATHS.program_html),
    programText: read(RETAINED_PATHS.program_text),
    generalEducationText: read(RETAINED_PATHS.general_education_text),
    policyStatementsHtml: read(RETAINED_PATHS.policy_statements_html),
    policyStatementsText: read(RETAINED_PATHS.policy_statements_text),
  };
}

function main(argv = process.argv.slice(2)) {
  const sources = retainedSources();
  const built = buildVirginiaStateFigure1SourceGapEvidence(sources);
  if (argv.includes('--print')) {
    process.stdout.write(`${JSON.stringify(built, null, 2)}\n`);
    return;
  }
  if (argv.includes('--write')) {
    fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(built, null, 2)}\n`);
    console.log(`wrote ${path.relative(REPO_ROOT, ARTIFACT_PATH)}`);
    return;
  }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  const audit = auditVirginiaStateFigure1SourceGapEvidence(artifact, sources);
  if (!audit.verified) {
    console.error(audit.errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Virginia State Figure 1 source-gap evidence: no drift');
  console.log(`  status ${artifact.disposition.status}`);
  console.log(`  roster ${artifact.exact_published_facts.menu_alternative_counts.total} alternatives / ${artifact.exact_published_facts.underlying_course_code_count} course codes`);
  console.log(`  fingerprint ${artifact.evidence_fingerprint_sha256}`);
}

if (require.main === module) main();

module.exports = {
  ARTIFACT_PATH,
  main,
  retainedSources,
};
