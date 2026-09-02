import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { startInMemoryMongo } = require('../../test/mongoHarness');
const {
  buildVirginiaAnalysisPublicationReceipt,
  manifestForDocuments,
  reportSha256,
  virginiaAnalysisPublicationTransition,
  virginiaAnalysisPublicationStatus,
} = require('./analysisPublicationGate');
const {
  currentVirginiaPublicationEvaluatorFingerprint,
} = require('./publicationEvaluatorFingerprint');
const {
  VA_PUBLICATION_TRANSITION_CONTRACT,
  VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION,
  VA_PUBLICATION_TRANSITION_COUNTER_ID,
  VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION,
  VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
  buildTransitionEvent,
  transitionBinding,
} = require('./publicationTransition');

let mongo;
let db;
let nextTransitionSequence;

const conditionReport = { ready: true, blocker: null, counts: { cells: 304 } };
const prerequisiteReport = { ready: true, blocker: null, counts: { university: 850 } };
const passingPreflight = () => ({
  publishable: true,
  course_unit_evidence_overlay: {
    ready: true,
    report_sha256: 'a'.repeat(64),
    output_documents_sha256: 'b'.repeat(64),
  },
  publication: {
    publishable: true,
    figure_readiness: {
      transfer_equivalency_conditions: conditionReport,
      pathway_complexity: prerequisiteReport,
    },
    publication_by_figure: Object.fromEntries(
      ['1', '3', '4', '6'].map((figure) => [figure, { figure, publishable: true }]),
    ),
  },
});

const humanReceipt = {
  _id: 'va:figure6:prerequisites:prereq-generation',
  active: true,
  publication_generation: 'prereq-generation',
  artifact: 'virginia_figure6_prerequisite_verification_receipt',
};

function revisionForReceipt(receipt) {
  return {
    _id: receipt.generation_id,
    generation_id: receipt.generation_id,
    state: 'va',
    operation: 'publish',
    status: 'complete',
    created_at: receipt.created_at,
    preflight_verdict: 'pass',
    preflight_projection_manifest_sha256: receipt.projection_manifest_sha256,
    preflight_report_sha256: receipt.preflight_report_sha256,
    publication_audit_report_sha256: receipt.publication_audit_report_sha256,
    publication_evaluator_fingerprint_contract:
      receipt.publication_evaluator_fingerprint_contract,
    publication_evaluator_fingerprint_sha256:
      receipt.publication_evaluator_fingerprint_sha256,
    publication_evaluator_fingerprint_file_count:
      receipt.publication_evaluator_fingerprint_file_count,
    course_unit_evidence_overlay_report_sha256:
      receipt.course_unit_evidence_overlay_report_sha256,
    course_unit_evidence_output_documents_sha256:
      receipt.course_unit_evidence_output_documents_sha256,
    transfer_equivalency_condition_report_sha256:
      receipt.transfer_equivalency_condition_report_sha256,
    pathway_complexity_prerequisite_report_sha256:
      receipt.pathway_complexity_prerequisite_report_sha256,
    incomplete_staging_override: false,
    replacement_targets: receipt.projection_manifest,
    analysis_publication_receipt: receipt,
  };
}

async function insertTransitionRevision(revision, {
  domain,
  sequence = nextTransitionSequence,
} = {}) {
  const event = buildTransitionEvent({
    sequence,
    domain,
    operation: revision.operation,
    generationId: revision.generation_id,
    createdAt: revision.created_at,
  });
  const boundRevision = {
    ...structuredClone(revision),
    publication_transition: transitionBinding(event),
  };
  await db.collection(event.revision_collection).insertOne(boundRevision);
  await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).insertOne(event);
  await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).updateOne(
    { _id: VA_PUBLICATION_TRANSITION_COUNTER_ID },
    { $set: {
      contract: VA_PUBLICATION_TRANSITION_CONTRACT,
      schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
      state: 'va',
      last_sequence: sequence,
      updated_at: event.created_at,
    } },
    { upsert: true },
  );
  nextTransitionSequence = Math.max(nextTransitionSequence, sequence + 1);
  return { event, revision: boundRevision };
}

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('va_analysis_publication_gate_test');
}, 60_000);

beforeEach(async () => {
  await db.dropDatabase();
  nextTransitionSequence = 1;
  await insertTransitionRevision({
    _id: 'baseline-prerequisite-publication',
    generation_id: 'baseline-prerequisite-publication',
    operation: 'publish',
    status: 'complete',
    replacement_publication_generation: humanReceipt.publication_generation,
    created_at: new Date('2026-08-20T00:00:00.000Z'),
  }, { domain: 'prerequisite' });
});

afterAll(async () => { await mongo.stop(); });

describe('Virginia analysis publication receipt', () => {
  it('fails closed when no receipt exists', async () => {
    await expect(virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
      ready: false,
      blocker: 'virginia_analysis_publication_receipt_required',
      contract: 'va-analysis-publication-receipt-v1',
      major_slug: 'va-cs',
      issues: [{ code: 'publication_receipt_missing' }],
    });
  });

  it('fails closed when projection history survives but prerequisite transition history is missing', async () => {
    await db.collection('va_figure6_prerequisite_revisions').deleteMany({});
    await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).deleteMany({});
    await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).deleteMany({});
    nextTransitionSequence = 1;
    await insertTransitionRevision({
      _id: 'orphaned-projection-publication',
      generation_id: 'orphaned-projection-publication',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2026-08-24T00:00:00.000Z'),
      analysis_publication_receipt: { ready: true, publishable: true },
    }, { domain: 'projection' });

    await expect(virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
      ready: false,
      issues: [{ code: 'prerequisite_publication_transition_missing' }],
    });
  });

  it('treats the latest restore as a tombstone even when an older receipt matches the bytes', async () => {
    const projectionManifest = manifestForDocuments({}, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'previous-passing-publication',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: passingPreflight(),
      verificationReceipt: humanReceipt,
    });
    await insertTransitionRevision(revisionForReceipt(receipt), { domain: 'projection' });
    await insertTransitionRevision({
      _id: 'exact-restore-tombstone',
      generation_id: 'exact-restore-tombstone',
      state: 'va',
      operation: 'restore',
      status: 'complete',
      created_at: new Date('2026-08-25T00:00:00.000Z'),
      source_generation_id: 'previous-passing-publication',
      replacement_targets: projectionManifest,
      analysis_visibility: 'disabled_pending_revalidation',
      analysis_publication_receipt: null,
    }, { domain: 'projection' });

    await expect(virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
      ready: false,
      generation_id: null,
      issues: [{ code: 'publication_revoked_by_projection_restore' }],
    });
  });

  it('orders projection and prerequisite revisions as one fail-closed authority', async () => {
    await insertTransitionRevision({
      _id: 'prerequisite-publish-before-projection',
      generation_id: 'prerequisite-publish-before-projection',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2026-08-23T00:00:00.000Z'),
    }, { domain: 'prerequisite' });
    await insertTransitionRevision({
      _id: 'projection-between-prerequisite-transitions',
      generation_id: 'projection-between-prerequisite-transitions',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2026-08-24T00:00:00.000Z'),
    }, { domain: 'projection' });
    await insertTransitionRevision({
      _id: 'prerequisite-restore-after-projection',
      generation_id: 'prerequisite-restore-after-projection',
      operation: 'restore',
      status: 'complete',
      created_at: new Date('2026-08-25T00:00:00.000Z'),
    }, { domain: 'prerequisite' });

    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      projection: { generation_id: 'projection-between-prerequisite-transitions' },
      prerequisite: {
        generation_id: 'prerequisite-restore-after-projection',
        operation: 'restore',
      },
      authoritative: { generation_id: 'prerequisite-restore-after-projection' },
      issue: { code: 'publication_revoked_by_prerequisite_restore' },
    });

    await insertTransitionRevision({
      _id: 'fresh-projection-after-restore',
      generation_id: 'fresh-projection-after-restore',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2026-08-26T00:00:00.000Z'),
    }, { domain: 'projection' });
    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      projection: { generation_id: 'fresh-projection-after-restore' },
      authoritative: { generation_id: 'fresh-projection-after-restore' },
      issue: null,
    });
  });

  it('uses sequence rather than random ids when independent transitions share a timestamp', async () => {
    const created_at = new Date('2026-08-25T00:00:00.000Z');
    await insertTransitionRevision({
      _id: 'same-time-projection',
      generation_id: 'same-time-projection',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at,
    }, { domain: 'projection' });
    await insertTransitionRevision({
      _id: 'same-time-prerequisite-publish',
      generation_id: 'same-time-prerequisite-publish',
      operation: 'publish',
      status: 'complete',
      created_at,
    }, { domain: 'prerequisite' });

    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      authoritative: { generation_id: 'same-time-prerequisite-publish' },
      issue: { code: 'publication_superseded_by_prerequisite_publish' },
    });
  });

  it('does not let UUID lexical order choose between same-time transitions in one writer', async () => {
    const created_at = new Date('2026-08-25T00:00:00.000Z');
    await insertTransitionRevision({
      _id: 'zzzz-lexically-later-publish',
      generation_id: 'zzzz-lexically-later-publish',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at,
    }, { domain: 'projection' });
    await insertTransitionRevision({
      _id: 'aaaa-lexically-earlier-restore',
      generation_id: 'aaaa-lexically-earlier-restore',
      state: 'va',
      operation: 'restore',
      status: 'complete',
      created_at,
    }, { domain: 'projection' });

    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      projection: {
        generation_id: 'aaaa-lexically-earlier-restore',
        operation: 'restore',
      },
      authoritative: { generation_id: 'aaaa-lexically-earlier-restore' },
      issue: { code: 'publication_revoked_by_projection_restore' },
    });
  });

  it('uses sequence rather than wall-clock time when the clock regresses', async () => {
    await insertTransitionRevision({
      _id: 'future-clock-prerequisite',
      generation_id: 'future-clock-prerequisite',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2035-01-01T00:00:00.000Z'),
    }, { domain: 'prerequisite' });
    await insertTransitionRevision({
      _id: 'regressed-clock-projection',
      generation_id: 'regressed-clock-projection',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2020-01-01T00:00:00.000Z'),
    }, { domain: 'projection' });

    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      projection: { generation_id: 'regressed-clock-projection' },
      prerequisite: { generation_id: 'future-clock-prerequisite' },
      authoritative: { generation_id: 'regressed-clock-projection' },
      issue: null,
    });
  });

  it('fails closed on a missing or ambiguous authoritative ledger but preserves legacy rows', async () => {
    await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).deleteMany({});
    await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).deleteMany({});
    await db.collection('va_projection_revisions').insertOne({
      _id: 'legacy-unsequenced-projection',
      generation_id: 'legacy-unsequenced-projection',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2026-08-25T00:00:00.000Z'),
    });
    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      authoritative: null,
      issue: { code: 'publication_transition_ledger_missing' },
    });
    await expect(db.collection('va_projection_revisions')
      .findOne({ _id: 'legacy-unsequenced-projection' })).resolves.not.toBeNull();

    const first = buildTransitionEvent({
      sequence: 1,
      domain: 'projection',
      operation: 'publish',
      generationId: 'legacy-unsequenced-projection',
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    });
    const duplicate = { ...first, _id: `${first._id}:duplicate` };
    await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION)
      .insertMany([first, duplicate]);
    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      authoritative: null,
      issue: { code: 'publication_transition_ledger_invalid' },
    });
  });

  it('does not hide wrong-contract or wrong-state rows in the dedicated ledger', async () => {
    const validShape = buildTransitionEvent({
      sequence: 2,
      domain: 'projection',
      operation: 'publish',
      generationId: 'malformed-ledger-row',
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    });
    for (const malformed of [
      { ...validShape, contract: 'untrusted-transition-contract' },
      { ...validShape, state: 'not-va' },
    ]) {
      await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).insertOne(malformed);
      const transition = await virginiaAnalysisPublicationTransition(db);
      expect(transition).toMatchObject({
        authoritative: null,
        issue: { code: 'publication_transition_ledger_invalid' },
      });
      expect(transition.issue.detail.map((issue) => issue.code))
        .toContain('transition_contract_invalid');
      await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION)
        .deleteOne({ _id: malformed._id });
    }
  });

  it('fails closed when an intermediate ledger event loses its bound revision', async () => {
    const intermediate = await insertTransitionRevision({
      _id: 'intermediate-projection-publication',
      generation_id: 'intermediate-projection-publication',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2026-08-22T00:00:00.000Z'),
    }, { domain: 'projection' });
    await insertTransitionRevision({
      _id: 'latest-projection-publication',
      generation_id: 'latest-projection-publication',
      state: 'va',
      operation: 'publish',
      status: 'complete',
      created_at: new Date('2026-08-23T00:00:00.000Z'),
    }, { domain: 'projection' });
    await db.collection('va_projection_revisions').deleteOne({
      _id: intermediate.revision._id,
    });

    await expect(virginiaAnalysisPublicationTransition(db)).resolves.toMatchObject({
      projection: null,
      prerequisite: null,
      authoritative: null,
      issue: {
        code: 'publication_transition_revision_missing',
        detail: {
          event_id: intermediate.event._id,
          generation_id: intermediate.revision.generation_id,
        },
      },
    });
  });

  it('fails closed when the dedicated counter collection contains an extra row', async () => {
    await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).insertOne({
      _id: 'unexpected-second-transition-counter',
      contract: VA_PUBLICATION_TRANSITION_CONTRACT,
      schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
      state: 'va',
      last_sequence: 999,
    });

    const transition = await virginiaAnalysisPublicationTransition(db);
    expect(transition).toMatchObject({
      authoritative: null,
      issue: { code: 'publication_transition_ledger_invalid' },
    });
    expect(transition.issue.detail).toContainEqual({
      event_id: null,
      code: 'transition_counter_count_invalid',
      expected: 1,
      actual: 2,
    });
  });

  it('builds a receipt only from an all-figure passing preflight', () => {
    const projectionManifest = manifestForDocuments({
      assist_institutions: [],
      assist_courses: [],
      assist_agreements: [],
      curated_requirements: [],
    }, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'projection-generation',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: passingPreflight(),
      verificationReceipt: humanReceipt,
    });

    expect(receipt).toMatchObject({
      contract: 'va-analysis-publication-receipt-v1',
      schema_version: 2,
      state: 'va',
      major_slug: 'va-cs',
      ready: true,
      publishable: true,
      generation_id: 'projection-generation',
      prerequisite_contract_version: 'va-figure6-prerequisites-v2',
      prerequisite_publication_generation: 'prereq-generation',
      paper_figures: ['1', '3', '4', '6'],
    });
    const evaluatorFingerprint = currentVirginiaPublicationEvaluatorFingerprint();
    expect(receipt).toMatchObject({
      publication_evaluator_fingerprint_contract:
        'va-publication-evaluator-source-graph-v1',
      publication_evaluator_fingerprint_sha256: evaluatorFingerprint.sha256,
      publication_evaluator_fingerprint_file_count: evaluatorFingerprint.file_count,
    });
    expect(evaluatorFingerprint.files.map((file) => file.path)).toEqual(expect.arrayContaining([
      'scripts/va/buildVaDocuments.js',
      'services/analysis/fourYearConstraints.js',
      'services/analysis/radfordConstraintProofs.js',
      'services/virginia/degreeAcceptance.js',
      'services/virginia/publicationTransition.js',
      'services/virginia/publicationReadiness.js',
    ]));
    expect(evaluatorFingerprint.files.some((file) => file.path.includes('node_modules')))
      .toBe(false);
    expect(receipt.transfer_equivalency_condition_report_sha256)
      .toBe(reportSha256(conditionReport));
    expect(receipt.pathway_complexity_prerequisite_report_sha256)
      .toBe(reportSha256(prerequisiteReport));

    const failed = passingPreflight();
    failed.publication.publication_by_figure['4'].publishable = false;
    expect(() => buildVirginiaAnalysisPublicationReceipt({
      generationId: 'blocked',
      projectionManifest,
      preflightReport: failed,
      verificationReceipt: humanReceipt,
    })).toThrow(/fully passing preflight/i);
  });

  it('never authorizes an otherwise valid incomplete staging projection', async () => {
    const projectionManifest = manifestForDocuments({}, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'staging-override-projection',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: passingPreflight(),
      verificationReceipt: humanReceipt,
    });
    const revision = revisionForReceipt(receipt);
    revision.incomplete_staging_override = true;
    await insertTransitionRevision(revision, { domain: 'projection' });

    await expect(virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
      ready: false,
      generation_id: null,
      issues: [{ code: 'incomplete_staging_publication_not_visible' }],
    });
  });

  it('rejects a schema-v2 receipt whose evaluator fingerprint is missing', async () => {
    const projectionManifest = manifestForDocuments({}, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'missing-evaluator-fingerprint',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: passingPreflight(),
      verificationReceipt: humanReceipt,
    });
    delete receipt.publication_evaluator_fingerprint_contract;
    delete receipt.publication_evaluator_fingerprint_sha256;
    delete receipt.publication_evaluator_fingerprint_file_count;
    await insertTransitionRevision(revisionForReceipt(receipt), { domain: 'projection' });

    const status = await virginiaAnalysisPublicationStatus(db);
    expect(status).toMatchObject({
      ready: false,
      generation_id: 'missing-evaluator-fingerprint',
    });
    expect(status.issues.map((issue) => issue.code))
      .toContain('publication_evaluator_fingerprint_missing');
  });

  it('rejects a receipt whose stored contract is not the configured contract', async () => {
    const projectionManifest = manifestForDocuments({}, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'wrong-contract',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: passingPreflight(),
      verificationReceipt: humanReceipt,
    });
    receipt.contract = 'untrusted-lookalike-contract';
    await insertTransitionRevision(revisionForReceipt(receipt), { domain: 'projection' });

    await expect(virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
      ready: false,
      generation_id: 'wrong-contract',
      issues: [{ code: 'publication_receipt_contract_mismatch' }],
    });
  });

  it('changes ready to blocked after an identical prerequisite restore', async () => {
    // The production gate deliberately recomputes both heavyweight evaluators.
    // Replace only those pure evaluators in a fresh CJS module instance so this
    // test can isolate transition authority with an empty, byte-stable corpus.
    const transferModule = require('../analysis/transferCreditRate');
    const prerequisiteModule = require('./pathwayComplexityPrerequisites');
    const originalConditionAudit = transferModule.auditVirginiaProjectionEquivalencyConditions;
    const originalPrerequisiteAudit = prerequisiteModule.validateVirginiaFigure6PrerequisiteSources;
    const gatePath = require.resolve('./analysisPublicationGate');
    transferModule.auditVirginiaProjectionEquivalencyConditions = () => structuredClone(conditionReport);
    prerequisiteModule.validateVirginiaFigure6PrerequisiteSources = () => structuredClone(prerequisiteReport);
    delete require.cache[gatePath];
    try {
      const freshGate = require('./analysisPublicationGate');
      const projectionCreatedAt = new Date('2026-08-24T00:00:00.000Z');
      const projectionManifest = freshGate.manifestForDocuments({}, [
        'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
      ], { state: 'va' });
      const receipt = freshGate.buildVirginiaAnalysisPublicationReceipt({
        generationId: 'ready-before-prerequisite-restore',
        createdAt: projectionCreatedAt,
        projectionManifest,
        preflightReport: passingPreflight(),
        verificationReceipt: humanReceipt,
      });
      await insertTransitionRevision({
        _id: 'prerequisite-publication-observed-by-projection',
        generation_id: 'prerequisite-publication-observed-by-projection',
        operation: 'publish',
        status: 'complete',
        replacement_publication_generation: humanReceipt.publication_generation,
        created_at: new Date('2026-08-23T00:00:00.000Z'),
      }, { domain: 'prerequisite' });
      await insertTransitionRevision(revisionForReceipt(receipt), { domain: 'projection' });
      await db.collection('va_figure6_prerequisite_publications').insertOne(humanReceipt);

      await expect(freshGate.virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
        ready: true,
        generation_id: 'ready-before-prerequisite-restore',
        issues: [],
      });

      // No corpus or active-receipt byte changes. Only the completed restore
      // transition is new, and that transition alone must revoke visibility.
      await insertTransitionRevision({
        _id: 'identical-prerequisite-restore',
        generation_id: 'identical-prerequisite-restore',
        operation: 'restore',
        status: 'complete',
        created_at: new Date('2026-08-25T00:00:00.000Z'),
      }, { domain: 'prerequisite' });
      await expect(freshGate.virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
        ready: false,
        generation_id: null,
        issues: [{ code: 'publication_revoked_by_prerequisite_restore' }],
      });
    } finally {
      transferModule.auditVirginiaProjectionEquivalencyConditions = originalConditionAudit;
      prerequisiteModule.validateVirginiaFigure6PrerequisiteSources = originalPrerequisiteAudit;
      delete require.cache[gatePath];
    }
  });

  it('rejects a self-consistent receipt from a different evaluator build', async () => {
    const projectionManifest = manifestForDocuments({}, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'stale-evaluator-fingerprint',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: passingPreflight(),
      verificationReceipt: humanReceipt,
    });
    receipt.publication_evaluator_fingerprint_sha256 = '0'.repeat(64);
    await insertTransitionRevision(revisionForReceipt(receipt), { domain: 'projection' });

    await expect(virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
      ready: false,
      generation_id: 'stale-evaluator-fingerprint',
      issues: [{ code: 'publication_readiness_evaluator_drift' }],
    });
  });

  it('rejects a snapshot whose evaluator binding differs from its receipt', async () => {
    const projectionManifest = manifestForDocuments({}, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'snapshot-evaluator-mismatch',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: passingPreflight(),
      verificationReceipt: humanReceipt,
    });
    const revision = revisionForReceipt(receipt);
    revision.publication_evaluator_fingerprint_sha256 = '0'.repeat(64);
    await insertTransitionRevision(revision, { domain: 'projection' });

    await expect(virginiaAnalysisPublicationStatus(db)).resolves.toMatchObject({
      ready: false,
      generation_id: 'snapshot-evaluator-mismatch',
      issues: [{ code: 'publication_snapshot_binding_mismatch' }],
    });
  });

  it('rejects a once-valid receipt when the current projection differs', async () => {
    const expected = {
      assist_institutions: [{ _id: 'va:uni:9205', state: 'va' }],
      assist_courses: [],
      assist_agreements: [],
      curated_requirements: [],
    };
    const projectionManifest = manifestForDocuments(expected, [
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ], { state: 'va' });
    const preflight = passingPreflight();
    const receipt = buildVirginiaAnalysisPublicationReceipt({
      generationId: 'projection-generation',
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      projectionManifest,
      preflightReport: preflight,
      verificationReceipt: humanReceipt,
    });
    await insertTransitionRevision(revisionForReceipt(receipt), { domain: 'projection' });

    const status = await virginiaAnalysisPublicationStatus(db);
    expect(status).toMatchObject({
      ready: false,
      generation_id: 'projection-generation',
      issues: [{ code: 'published_projection_drift' }],
    });
  });
});
