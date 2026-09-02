#!/usr/bin/env node
/** Read-only source-bundle review queue. This script never writes Mongo or files. */

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const {
  cachedAcceptedSourcePlan,
} = require('../importVirginiaCatalogDegrees');
const {
  operationalCourseUnitEvidenceOverlay,
} = require('./buildVaDocuments');
const {
  buildPublicationVerificationReview,
  validatePublicationVerificationReview,
} = require('../../services/virginia/publicationVerificationReview');

function optionsFrom(argv = process.argv.slice(2)) {
  const known = new Set(['--json', '--require-clean']);
  const unknown = argv.filter((arg) => !known.has(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  return {
    json: argv.includes('--json'),
    requireClean: argv.includes('--require-clean'),
  };
}

let CLI_OPTIONS = { json: false, requireClean: false };
try {
  CLI_OPTIONS = optionsFrom();
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const JSON_ONLY = CLI_OPTIONS.json;

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    const db = client.db(process.env.DB_NAME || 'pmt_research');
    const [courses, storedDocuments] = await Promise.all([
      db.collection('va_courses').find({}, { projection: { code: 1, credits: 1 } }).toArray(),
      db.collection('va_requirements').find({}).toArray(),
    ]);
    const creditsByCode = new Map(courses.map((course) => [course.code, course.credits]));
    const candidateDocuments = cachedAcceptedSourcePlan(creditsByCode).documents;
    const courseUnitEvidenceOverlay = operationalCourseUnitEvidenceOverlay({
      sourceDocuments: storedDocuments,
      courses,
      candidateDocuments,
    });
    const report = buildPublicationVerificationReview({
      candidateDocuments,
      storedDocuments,
      courseUnitEvidenceOverlay,
      snapshotDate: new Date().toISOString().slice(0, 10),
    });
    const validation = validatePublicationVerificationReview(report);
    if (!validation.valid) throw new Error(`invalid verification review: ${validation.issues.join(', ')}`);
    if (CLI_OPTIONS.requireClean && report.summary.review_items > 0) process.exitCode = 1;
    if (JSON_ONLY) return process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    console.log('Virginia source-bundle verification review: READ ONLY');
    console.log(`  candidates ${report.summary.candidate_documents}`);
    console.log(`  carried exact-bundle signatures ${report.summary.carried_verifications}`);
    console.log(
      `  validated evidence-only overlays ${report.summary.validated_course_unit_evidence_overlays}`
        + ` · ${report.summary.validated_course_unit_evidence_rows} exact rows`,
    );
    console.log(
      '  validated requirement-capacity projections '
        + `${report.summary.validated_requirement_capacity_evidence_projections}`
        + ` · ${report.summary.validated_requirement_capacity_evidence_rows} exact rows`,
    );
    console.log(
      `  raw conflicts ${report.summary.raw_verified_core_conflicts} protected core`
        + ` · ${report.summary.raw_verified_other_material_conflicts} other material`,
    );
    console.log(
      `  unresolved conflicts ${report.summary.unresolved_verified_core_conflicts} protected core`
        + ` · ${report.summary.unresolved_verified_other_material_conflicts} other material`,
    );
    console.log(`  review items ${report.summary.review_items}`);
    for (const state of [
      'verified_core_reconciliation_required',
      'verified_material_reconciliation_required',
      'source_changed_reverification_required',
      'human_verification_required',
    ]) {
      const rows = report.review_items.filter((row) => row.review_state === state);
      if (rows.length) console.log(`  ${state}: ${rows.map((row) => row.id).join(', ')}`);
    }
    console.log(`  report SHA-256 ${report.report_sha256}`);
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

module.exports = { main, optionsFrom };
