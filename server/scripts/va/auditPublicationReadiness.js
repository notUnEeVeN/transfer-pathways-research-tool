#!/usr/bin/env node
/**
 * Read-only, fail-closed release gate for Virginia figures.
 *
 * This rebuilds the derived projection in memory, verifies the fixed 19 × 16
 * Figure 3/4 cohort, checks every source acceptance/signature, and compares a
 * semantic inventory of each requirement tree before and after projection.
 * It never writes to MongoDB or to the filesystem.
 *
 *   node scripts/va/auditPublicationReadiness.js
 *   node scripts/va/auditPublicationReadiness.js --source-plan
 *   node scripts/va/auditPublicationReadiness.js --json
 */

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const {
  buildProjection,
  courseUnitOverlayGate,
  operationalCourseUnitEvidenceOverlay,
  operationalVirginiaDegreeSources,
  recomputeVirginiaAcceptance,
} = require('./buildVaDocuments');
const {
  cachedAcceptedSourcePlan,
} = require('../importVirginiaCatalogDegrees');
const { publicationAudit } = require('../../services/virginia/publicationReadiness');
const { auditCourseIdentityResolution } = require('../../services/virginia/courseIdentityAudit');
const {
  validateVirginiaFigure6PrerequisiteSources,
} = require('../../services/virginia/pathwayComplexityPrerequisites');
const {
  validateUniversityPrerequisiteScope,
} = require('../../services/virginia/universityPrerequisiteScope');
const {
  auditVirginiaProjectionEquivalencyConditions,
} = require('../../services/analysis/transferCreditRate');
const {
  buildPublicationVerificationReview,
  sourcePlanFromVerificationReview,
  validatePublicationVerificationReview,
} = require('../../services/virginia/publicationVerificationReview');

const REPO = path.resolve(__dirname, '../../..');
const VCCS_REQUISITE_ARTIFACT = path.join(REPO, 'scripts/data/va_course_requisites.json');
const VCCS_SCOPE_ARTIFACT = path.resolve(__dirname, '../../.va-degrees/cs_course_scope.json');
const UNIVERSITY_SCOPE_ARTIFACT = path.resolve(
  __dirname,
  '../../.va-catalogs/research/va-university-prerequisite-scope.json',
);

const JSON_ONLY = process.argv.includes('--json');
const SOURCE_PLAN = process.argv.includes('--source-plan');
const unknown = process.argv.slice(2).filter((arg) => !['--json', '--source-plan'].includes(arg));
if (require.main === module && unknown.length) {
  console.error(`unknown option(s): ${unknown.join(', ')}`);
  process.exit(2);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function checkedInPrerequisiteScope() {
  const vccsScopeRows = readJson(VCCS_SCOPE_ARTIFACT);
  const universityScope = readJson(UNIVERSITY_SCOPE_ARTIFACT);
  const universityValidation = validateUniversityPrerequisiteScope(universityScope);
  if (!universityValidation.valid) {
    throw new Error(
      `invalid Virginia university prerequisite scope: ${universityValidation.issues.join(', ')}`,
    );
  }
  return { vccsScopeRows, universityScope };
}

function figure6ReadinessForRows({
  communityCollegeRows = [],
  universityRows = [],
  adapterIntegrated = false,
  verificationReceipt = null,
} = {}) {
  return validateVirginiaFigure6PrerequisiteSources({
    communityCollegeRows,
    universityRows,
    ...checkedInPrerequisiteScope(),
    adapterIntegrated,
    verificationReceipt,
  });
}

function checkedInFigure6Readiness({ adapterIntegrated = false } = {}) {
  return figure6ReadinessForRows({
    communityCollegeRows: readJson(VCCS_REQUISITE_ARTIFACT).rows,
    universityRows: [],
    adapterIntegrated,
  });
}

function printReport(report) {
  console.log(`Virginia publication gate: ${report.verdict.toUpperCase()}`);
  console.log(
    `  source cohort      AS ${report.counts.associate_degrees}/${report.expected.associate_degrees}`
      + ` · BS ${report.counts.bachelor_degrees}/${report.expected.bachelor_degrees}`,
  );
  console.log(
    `  active projection  AS ${report.counts.projected_associate_degrees}/${report.expected.associate_degrees}`
      + ` · BS ${report.counts.active_bachelor_templates}/${report.expected.active_bachelor_templates}`
      + ` · cells ${report.counts.agreement_cells}/${report.expected.agreement_cells}`,
  );
  console.log(
    `  complete degree    ${report.source_summary.ready}/${report.source_summary.total}`
      + ` (${report.source_summary.blocked} blocked; diagnostic, not the paper gate)`,
  );
  for (const [figure, readiness] of Object.entries(report.publication_by_figure || {})) {
    console.log(
      `  paper Figure ${figure}     ${readiness.publishable ? 'pass' : 'fail'}`
        + ` · source ${readiness.source_summary.ready}/${readiness.source_summary.total}`
        + ` · projection ${readiness.projected_source_summary.ready}`
        + `/${readiness.projected_source_summary.total}`,
    );
  }
  console.log(
    `  remediation        ${report.source_summary.requires_model_or_evaluator_work} model/evaluator`
      + ` · ${report.source_summary.requires_targeted_source_research} targeted source`
      + ` · ${report.source_summary.requires_human_verification} human verification`
      + ` · ${report.source_summary.requires_scope_or_policy_decision} scope/policy`,
  );
  const fourYear = report.source_summary.four_year_blocker_remediation;
  if (fourYear) {
    console.log(
      `  four-year rules    ${fourYear.evaluator_engineering} evaluator engineering`
        + ` · ${fourYear.targeted_source_research} targeted source`
        + ` · ${fourYear.out_of_scope_administrative_rule} student/admin outside model`,
    );
  }
  console.log(
    `  lossless projection ${report.projection_conservation.length - report.projection_losses.length}`
      + `/${report.projection_conservation.length}`,
  );
  console.log(
    `  source accounting   ${report.source_accounting.length - report.source_accounting_failures.length}`
      + `/${report.source_accounting.length}`,
  );
  if (report.associate_source_disposition) {
    console.log(
      `  source alternates    ${report.associate_source_disposition.counts.safe}`
        + `/${report.associate_source_disposition.counts.dispositions} safe dispositions`,
    );
  }
  console.log(
    `  shared schema       ${report.projection_schema?.ready === true ? 'pass' : 'fail'}`,
  );
  if (report.course_identity) {
    console.log(
      `  course identities   ${report.course_identity.stats.resolved}`
        + `/${report.course_identity.stats.references}`
        + ` (${report.course_identity.stats.issues} issue(s))`,
    );
  }
  if (report.course_unit_evidence_overlay) {
    const overlay = report.course_unit_evidence_overlay;
    console.log(
      `  unit evidence      ${overlay.ready === true ? 'pass' : 'fail'}`
        + ` · ${overlay.counts?.applied_evidence_rows || 0} exact rows`
        + ` · core unchanged ${overlay.receipts.filter((row) => (
          row.output_major_core_unchanged === true
        )).length}/${overlay.receipts.length}`,
    );
  }
  if (report.source_plan) {
    console.log(
      `  verification plan ${report.source_plan.carried_verifications} carried`
        + ` · ${report.source_plan.changed_source_bundles} source changes`
        + ` · ${report.source_plan.validated_course_unit_evidence_overlays?.length || 0}`
        + ' evidence-only overlays'
        + ` (${report.source_plan.validated_course_unit_evidence_rows || 0} exact rows)`,
    );
    console.log(
      `  raw conflicts      ${report.source_plan.raw_verified_core_conflicts?.length || 0}`
        + ' verified core'
        + ` · ${report.source_plan.raw_verified_material_conflicts?.length || 0} other material`,
    );
    console.log(
      `  unresolved         ${report.source_plan.verified_core_conflicts?.length || 0}`
        + ' verified core'
        + ` · ${report.source_plan.verified_material_conflicts?.length || 0} other material`,
    );
  }
  console.log(
    `  figure readiness    ${Object.keys(report.figure_readiness || {}).length - report.figure_failures.length}`
      + `/${Object.keys(report.figure_readiness || {}).length}`,
  );
  const prerequisiteCounts = report.figure_readiness?.pathway_complexity?.counts;
  if (prerequisiteCounts) {
    console.log(
      `  figure 6 corpus     VCCS ${prerequisiteCounts.community_college}`
        + ` rows / ${prerequisiteCounts.required_community_college} required`
        + ` · university ${prerequisiteCounts.university}`
        + ` rows / ${prerequisiteCounts.required_university} required`,
    );
  }
  const equivalencyCounts = report.figure_readiness
    ?.transfer_equivalency_conditions?.counts;
  if (equivalencyCounts) {
    console.log(
      `  equivalency notes  ${equivalencyCounts.ready_cells}`
        + `/${equivalencyCounts.cells} cells ready`
        + ` · ${equivalencyCounts.blocking_condition_observations}`
        + ' unresolved selected-edge observation(s)',
    );
  }

  for (const failure of report.cohort_failures) {
    console.log(`  BLOCK cohort:${failure.field} expected ${failure.expected}, got ${failure.actual}`);
  }
  for (const source of report.sources.filter((row) => !row.ready)) {
    const reasons = [...source.catalog_failures, ...source.analysis_failures, ...source.blockers];
    console.log(`  NOTE complete-degree:${source.id} [${source.route}] — ${[...new Set(reasons)].join(', ')}`);
  }
  for (const loss of report.projection_losses) {
    console.log(`  BLOCK ${loss.id} [projection_loss] — ${loss.issues.map((issue) => issue.field).join(', ')}`);
  }
  for (const failure of report.source_accounting_failures) {
    console.log(`  BLOCK ${failure.id} [source_accounting] — ${failure.issues.join(', ')}`);
  }
  for (const failure of report.associate_source_disposition?.failures || []) {
    console.log(
      `  BLOCK ${failure.alternate_source_id || '<unknown>'} [source_alternate] — `
        + [...failure.receipt_issues, ...failure.safety_issues].join(', '),
    );
  }
  for (const failure of report.identity_cohort?.issues || []) {
    const detail = failure.detail == null ? '' : ` — ${JSON.stringify(failure.detail)}`;
    console.log(`  BLOCK identity:${failure.path} [${failure.code}]${detail}`);
  }
  for (const failure of report.projection_schema?.issues || []) {
    const detail = failure.detail == null ? '' : ` — ${JSON.stringify(failure.detail)}`;
    console.log(`  BLOCK schema:${failure.path} [${failure.code}]${detail}`);
  }
  for (const failure of report.figure_failures || []) {
    const contract = failure.report?.contract;
    const expected = contract
      ? `${contract.community_college.owner_namespace}/${contract.community_college.collection}`
        + ` + ${contract.university.owner_namespace}/${contract.university.collection}`
        + ` using ${contract.formula}`
      : 'required figure inputs';
    console.log(`  BLOCK ${failure.figure} [${failure.blocker}] — expected ${expected}`);
  }
  for (const failure of report.paper_figure_failures || []) {
    console.log(`  BLOCK paper Figure ${failure.figure} — ${failure.blockers.join(', ')}`);
  }
  if (report.course_identity && !report.course_identity.publication_ready) {
    const counts = Object.entries(report.course_identity.stats.issue_counts || {})
      .map(([name, count]) => `${name}:${count}`).join(', ');
    console.log(`  BLOCK sending-course identities — ${counts}`);
  }
  for (const issue of report.course_unit_evidence_overlay?.issues || []) {
    console.log(`  BLOCK unit_evidence — ${issue}`);
  }
  for (const conflict of report.course_unit_evidence_overlay?.conflicts || []) {
    console.log(
      `  BLOCK unit_evidence:${conflict.document_id || '<cohort>'}:${conflict.path}`
        + ` [${conflict.code}]`,
    );
  }
}

function applyFigurePublicationGate(report, {
  ready,
  blocker,
} = {}) {
  if (ready === true) return report;
  for (const figure of Object.values(report.publication_by_figure || {})) {
    figure.publishable = false;
    figure.blockers = [...new Set([...(figure.blockers || []), blocker])];
  }
  report.paper_figure_failures = Object.values(report.publication_by_figure || {})
    .filter((figure) => !figure.publishable)
    .map((figure) => ({ figure: figure.figure, blockers: figure.blockers }));
  report.publishable = false;
  report.verdict = 'fail';
  return report;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    const db = client.db(process.env.DB_NAME || 'pmt_research');
    const [
      courses,
      storedSourceDocuments,
      institutions,
      storedCommunityCollegeRequisites,
      storedUniversityRequisites,
      activePrerequisiteVerificationReceipts,
    ] = await Promise.all([
      db.collection('va_courses').find({}).toArray(),
      db.collection('va_requirements').find({}).toArray(),
      db.collection('va_institutions').find({}).toArray(),
      db.collection('va_course_requisites').find({}).toArray(),
      db.collection('va_university_course_requisites').find({}).toArray(),
      db.collection('va_figure6_prerequisite_publications')
        .find({ active: true }).limit(2).toArray(),
    ]);
    const prerequisiteVerificationReceipt = activePrerequisiteVerificationReceipts.length === 1
      ? activePrerequisiteVerificationReceipts[0] : null;
    const creditsByCode = new Map(courses.map((course) => [course.code, course.credits]));
    const candidateDocuments = cachedAcceptedSourcePlan(creditsByCode).documents;
    const unitEvidenceOverlay = operationalCourseUnitEvidenceOverlay({
      sourceDocuments: storedSourceDocuments,
      courses,
      candidateDocuments,
    });
    const overlayGate = courseUnitOverlayGate(unitEvidenceOverlay, storedSourceDocuments);
    let sourcePlan = null;
    if (SOURCE_PLAN) {
      const verificationReview = buildPublicationVerificationReview({
        candidateDocuments,
        storedDocuments: storedSourceDocuments,
        courseUnitEvidenceOverlay: unitEvidenceOverlay,
      });
      const reviewValidation = validatePublicationVerificationReview(verificationReview);
      if (!reviewValidation.valid) {
        throw new Error(
          `invalid Virginia verification conflict report: ${reviewValidation.issues.join(', ')}`,
        );
      }
      sourcePlan = sourcePlanFromVerificationReview(verificationReview);
    }
    // Re-evaluate with the checked-out code. Persisted acceptance is an audit
    // receipt from the last import and may legitimately lag a newly added
    // evaluator; using it here would make a dry-run preflight require a write
    // before it could determine whether that write is safe.
    const sourceDocuments = recomputeVirginiaAcceptance(
      operationalVirginiaDegreeSources(
        storedSourceDocuments,
        unitEvidenceOverlay.documents,
      ),
      courses,
    );
    const degrees = sourceDocuments.filter((doc) => doc.kind === 'degree' && doc.status === 'extracted');
    const asDegrees = sourceDocuments.filter((doc) => doc.kind === 'as_degree' && doc.status === 'extracted');
    const projection = buildProjection({ courses, degrees, asDegrees, institutions });
    // Audit the canonical projection itself. The projection boundary may safely
    // remint a stale wrapper id into its owner namespace while retaining the
    // original key as provenance; re-reading the source wrapper here would
    // report that intentional identity repair as a scope mismatch.
    const identityAudit = auditCourseIdentityResolution(
      projection.asDegrees,
      projection.courses.filter((course) => course.side === 'sending'),
    );
    const figure6Readiness = SOURCE_PLAN
      ? checkedInFigure6Readiness()
      : figure6ReadinessForRows({
        communityCollegeRows: storedCommunityCollegeRequisites,
        universityRows: storedUniversityRequisites,
        adapterIntegrated: true,
        verificationReceipt: prerequisiteVerificationReceipt,
      });
    const report = publicationAudit({
      sourceDocuments,
      projection,
      identityAudit,
      figureReadiness: {
        pathway_complexity: figure6Readiness,
        transfer_equivalency_conditions:
          auditVirginiaProjectionEquivalencyConditions(projection),
      },
    });
    report.course_unit_evidence_overlay = overlayGate;
    if (!overlayGate.ready) {
      applyFigurePublicationGate(report, {
        ready: false,
        blocker: 'course_unit_evidence_overlay_failed',
      });
    }
    if (SOURCE_PLAN) report.source_plan = sourcePlan;
    if (JSON_ONLY) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
    if (!report.publishable) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  checkedInFigure6Readiness,
  checkedInPrerequisiteScope,
  figure6ReadinessForRows,
  applyFigurePublicationGate,
  printReport,
};
