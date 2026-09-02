#!/usr/bin/env node
/**
 * Read-only independent recount for the 14 Virginia Figure 3/4 source gaps.
 *
 * By default the script runs the authoritative publication audit in JSON mode
 * and recounts its row-level output. A previously captured report can be
 * supplied with --report=/absolute/or/relative/path.json. No mode writes.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { cachedAcceptedSourcePlan } = require('../importVirginiaCatalogDegrees');
const {
  recountFigure34SourceGate,
  validateFigure34SourceBlockerArtifact,
} = require('../../services/virginia/figure34SourceBlockerAudit');

const SERVER = path.resolve(__dirname, '../..');
const PAGES = path.join(SERVER, '.va-catalogs/pages');
const ARTIFACT = path.join(
  SERVER, '.va-catalogs/research/va-figure34-source-blocker-audit.json',
);
const INTEGRITY = path.join(
  SERVER, '.va-catalogs/research/primary-source-integrity-manifest.json',
);
const PUBLICATION_AUDIT = path.join(__dirname, 'auditPublicationReadiness.js');
const PUBLICATION_AUDIT_ARGS = Object.freeze([
  PUBLICATION_AUDIT, '--source-plan', '--json',
]);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function parseArgs(argv) {
  const options = { json: false, evidenceOnly: false, report: null };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--evidence-only') options.evidenceOnly = true;
    else if (arg.startsWith('--report=')) options.report = arg.slice('--report='.length);
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function livePublicationReport() {
  const run = spawnSync(process.execPath, PUBLICATION_AUDIT_ARGS, {
    cwd: SERVER,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  // The publication audit intentionally exits 1 while any gate is closed.
  if (![0, 1].includes(run.status) || !String(run.stdout || '').trim()) {
    throw new Error(
      `publication audit did not produce a report (status ${run.status}): `
        + String(run.stderr || '').trim(),
    );
  }
  return JSON.parse(run.stdout);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const artifact = readJson(ARTIFACT);
  const evidence = validateFigure34SourceBlockerArtifact(artifact, {
    sourceDocuments: cachedAcceptedSourcePlan().documents,
    pageIndex: readJson(path.join(PAGES, 'index.json')),
    integrityManifest: readJson(INTEGRITY),
    pagesDir: PAGES,
  });
  const report = options.evidenceOnly ? null
    : (options.report ? readJson(path.resolve(options.report)) : livePublicationReport());
  const gate = report ? recountFigure34SourceGate(report, artifact) : null;
  const valid = evidence.valid && (!gate || gate.valid);
  const result = {
    valid,
    evidence,
    ...(gate ? { gate } : {}),
    artifact: path.relative(SERVER, ARTIFACT),
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Virginia Figure 3/4 source-gap audit: ${valid ? 'PASS' : 'FAIL'}`);
    console.log(
      `  evidence ${evidence.counts.documents} documents`
        + ` · ${evidence.counts.exact_retained_official_byte_documents} exact retained-byte`
        + ` · ${evidence.counts.transport_exception_documents} transport exception`,
    );
    if (gate) {
      for (const figure of ['3', '4']) {
        const row = gate.figures[figure];
        console.log(
          `  Figure ${figure} ${row.source.ready}/${row.source.total} ready`
            + ` · ${row.source.blocked} blocked`
            + ` · source/projection parity ${row.source_projected_blocked_parity ? 'yes' : 'no'}`,
        );
      }
      console.log(
        `  findings ${gate.classification_counts.a_existing_evidence_automation} automatable`
          + ` · ${gate.classification_counts.b_new_official_source_capture} new-source`
          + ` · ${gate.classification_counts.c_human_institutional_verification} human/institutional`,
      );
      console.log(
        `  explicit university remaining actions`
          + ` ${gate.figure34_remaining_action_counts.a_existing_evidence_automation}`
          + ` class-A engineering`
          + ` · ${gate.figure34_remaining_action_counts.b_new_official_source_capture} new-source`
          + ` · ${gate.figure34_remaining_action_counts.c_human_institutional_verification} human/institutional`,
      );
      console.log(
        `  class-A execution`
          + ` ${gate.figure34_automatable_action_readiness.immediately_executable}`
          + ` executable now`
          + ` · ${gate.figure34_automatable_action_readiness.dependency_blocked}`
          + ` dependency-blocked`,
      );
    }
    for (const issue of [...evidence.issues, ...(gate?.issues || [])]) {
      console.log(`  BLOCK ${issue}`);
    }
  }
  if (!valid) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { PUBLICATION_AUDIT_ARGS, livePublicationReport, main, parseArgs };
