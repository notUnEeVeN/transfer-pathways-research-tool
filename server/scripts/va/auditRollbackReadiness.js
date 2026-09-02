#!/usr/bin/env node
/**
 * Read-only release invariant for Virginia's two transactional rollback paths.
 * This deliberately uses synthetic in-memory documents and never opens Mongo.
 */

const {
  buildSnapshot,
  restoreProjection,
  validateSnapshot,
} = require('./buildVaDocuments');
const {
  PUBLICATION_COLLECTION,
  buildPrerequisiteSnapshot,
  restorePrerequisiteSnapshot,
  validatePrerequisiteSnapshot,
} = require('./publishFigure6Prerequisites');
const {
  virginiaAnalysisPublicationStatus,
} = require('../../services/virginia/analysisPublicationGate');
const {
  VA_PUBLICATION_TRANSITION_CONTRACT,
  VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION,
  VA_PUBLICATION_TRANSITION_COUNTER_ID,
  VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION,
  VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
  buildTransitionEvent,
  transitionBinding,
} = require('../../services/virginia/publicationTransition');

const projectionDocuments = () => ({
  assist_institutions: [{ _id: 'va:rollback-audit:institution', state: 'va' }],
  assist_courses: [{ _id: 'va:rollback-audit:course', state: 'va' }],
  assist_agreements: [{ _id: 'va:rollback-audit:agreement', state: 'va' }],
  curated_requirements: [{ _id: 'va:rollback-audit:degree', state: 'va' }],
});

const prerequisiteDocuments = () => ({
  va_course_requisites: [{ _id: 'va:rollback-audit:vccs' }],
  va_university_course_requisites: [{ _id: 'va:rollback-audit:university' }],
  [PUBLICATION_COLLECTION]: [{ _id: 'va:rollback-audit:receipt', active: true }],
});

function cursorFor(rows) {
  return {
    sort() { return this; },
    limit() { return this; },
    async toArray() { return structuredClone(rows); },
  };
}

async function tombstoneFailsClosed({ prerequisite = false } = {}) {
  const projectionEvent = buildTransitionEvent({
    sequence: 1,
    domain: 'projection',
    operation: prerequisite ? 'publish' : 'restore',
    generationId: 'va:rollback-audit:projection-publish',
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
  });
  const projection = {
    _id: 'va:rollback-audit:projection-publish',
    generation_id: 'va:rollback-audit:projection-publish',
    state: 'va',
    operation: prerequisite ? 'publish' : 'restore',
    status: 'complete',
    created_at: new Date('2026-08-24T00:00:00.000Z'),
    publication_transition: transitionBinding(projectionEvent),
    analysis_publication_receipt: null,
  };
  const prerequisiteEvent = prerequisite ? buildTransitionEvent({
    sequence: 2,
    domain: 'prerequisite',
    operation: 'restore',
    generationId: 'va:rollback-audit:prerequisite-restore',
    createdAt: new Date('2026-08-25T00:00:00.000Z'),
  }) : null;
  const prerequisiteRestore = {
    _id: 'va:rollback-audit:prerequisite-restore',
    generation_id: 'va:rollback-audit:prerequisite-restore',
    operation: 'restore',
    status: 'complete',
    created_at: new Date('2026-08-25T00:00:00.000Z'),
    ...(prerequisiteEvent
      ? { publication_transition: transitionBinding(prerequisiteEvent) } : {}),
  };
  const events = [projectionEvent, ...(prerequisiteEvent ? [prerequisiteEvent] : [])];
  const counter = {
    _id: VA_PUBLICATION_TRANSITION_COUNTER_ID,
    contract: VA_PUBLICATION_TRANSITION_CONTRACT,
    schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
    state: 'va',
    last_sequence: events.length,
  };
  const status = await virginiaAnalysisPublicationStatus({
    collection(name) {
      const rows = name === 'va_projection_revisions'
        ? [projection]
        : (name === 'va_figure6_prerequisite_revisions' && prerequisite
          ? [prerequisiteRestore]
          : (name === VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION
            ? events
            : (name === VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION ? [counter] : [])));
      return {
        find() { return cursorFor(rows); },
        async findOne(filter) {
          return structuredClone(rows.find((row) => (
            row._id === filter._id
              && row.generation_id === filter.generation_id
              && row.operation === filter.operation
              && row.status === filter.status
              && (filter.state === undefined || row.state === filter.state)
          )) || null);
        },
      };
    },
  });
  return status.ready === false
    && status.issues?.[0]?.code === (prerequisite
      ? 'publication_revoked_by_prerequisite_restore'
      : 'publication_revoked_by_projection_restore');
}

async function auditRollbackReadiness() {
  const projection = buildSnapshot({
    generationId: 'va-rollback-audit-projection',
    documentsByCollection: projectionDocuments(),
  });
  const projectionTampered = structuredClone(projection);
  projectionTampered.payload[0].document._id = 'tampered';
  const projectionMixed = structuredClone(projection);
  projectionMixed.payload[0].generation_id = 'different-generation';

  const prerequisites = buildPrerequisiteSnapshot({
    generationId: 'va-rollback-audit-prerequisites',
    documentsByCollection: prerequisiteDocuments(),
  });
  const prerequisiteTampered = structuredClone(prerequisites);
  prerequisiteTampered.payload[0].document._id = 'tampered';
  const prerequisiteMixed = structuredClone(prerequisites);
  prerequisiteMixed.payload[0].generation_id = 'different-generation';

  const report = {
    projection: {
      target_count: projection.manifest.targets.length,
      exact_snapshot_valid: validateSnapshot(projection.manifest, projection.payload).valid,
      tampered_snapshot_rejected:
        !validateSnapshot(projectionTampered.manifest, projectionTampered.payload).valid,
      mixed_generation_rejected:
        !validateSnapshot(projectionMixed.manifest, projectionMixed.payload).valid,
      transactional_restore_exported: typeof restoreProjection === 'function',
    },
    prerequisites: {
      target_count: prerequisites.manifest.targets.length,
      exact_snapshot_valid:
        validatePrerequisiteSnapshot(prerequisites.manifest, prerequisites.payload).valid,
      tampered_snapshot_rejected:
        !validatePrerequisiteSnapshot(
          prerequisiteTampered.manifest,
          prerequisiteTampered.payload,
        ).valid,
      mixed_generation_rejected:
        !validatePrerequisiteSnapshot(
          prerequisiteMixed.manifest,
          prerequisiteMixed.payload,
        ).valid,
      transactional_restore_exported: typeof restorePrerequisiteSnapshot === 'function',
    },
    publication_restore_tombstone_fails_closed: await tombstoneFailsClosed(),
    prerequisite_restore_tombstone_fails_closed:
      await tombstoneFailsClosed({ prerequisite: true }),
  };
  report.ready = report.projection.target_count === 4
    && Object.entries(report.projection)
      .filter(([key]) => key !== 'target_count').every(([, value]) => value === true)
    && report.prerequisites.target_count === 3
    && Object.entries(report.prerequisites)
      .filter(([key]) => key !== 'target_count').every(([, value]) => value === true)
    && report.publication_restore_tombstone_fails_closed === true
    && report.prerequisite_restore_tombstone_fails_closed === true;
  return report;
}

async function main() {
  const report = await auditRollbackReadiness();
  if (!report.ready) {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log('✓ Virginia rollback contracts ready — 4 projection + 3 prerequisite targets');
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { auditRollbackReadiness };
