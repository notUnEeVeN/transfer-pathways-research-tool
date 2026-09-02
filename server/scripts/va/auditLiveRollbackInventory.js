#!/usr/bin/env node
/**
 * Read-only inventory of the rollback material that actually exists in a
 * Mongo database.  This complements auditRollbackReadiness.js, which proves
 * the writers/validators with synthetic documents but deliberately never
 * opens Mongo.
 */

const path = require('node:path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const {
  VA_FILTER,
  canonicalDocumentHash,
  validateSnapshot,
} = require('./buildVaDocuments');
const {
  validatePrerequisiteSnapshot,
} = require('./publishFigure6Prerequisites');
const {
  readVirginiaPublicationTransitionLedger,
} = require('../../services/virginia/publicationTransition');

const PROJECTION_REVISION_COLLECTION = 'va_projection_revisions';
const PROJECTION_PAYLOAD_COLLECTION = 'va_projection_revision_documents';
const PREREQUISITE_REVISION_COLLECTION = 'va_figure6_prerequisite_revisions';
const PREREQUISITE_PAYLOAD_COLLECTION = 'va_figure6_prerequisite_revision_documents';
const LEGACY_DEGREE_BACKUP_COLLECTION = 'va_schema_backup';
const FULL_PROJECTION_TARGETS = Object.freeze([
  'assist_institutions',
  'assist_courses',
  'assist_agreements',
  'curated_requirements',
]);
const FULL_PREREQUISITE_TARGETS = Object.freeze([
  'va_course_requisites',
  'va_university_course_requisites',
  'va_figure6_prerequisite_publications',
]);

function cursorRows(rows) {
  return {
    sort() { return this; },
    async toArray() { return rows; },
  };
}

async function readRows(db, collection, filter = {}) {
  return db.collection(collection).find(filter).sort({ _id: 1 }).toArray();
}

function snapshotInventory(manifests, payload, validate) {
  const payloadByGeneration = new Map();
  for (const row of payload) {
    const key = String(row?.generation_id || '');
    if (!payloadByGeneration.has(key)) payloadByGeneration.set(key, []);
    payloadByGeneration.get(key).push(row);
  }
  const generations = manifests.map((manifest) => {
    const generationId = String(manifest?.generation_id || manifest?._id || '');
    const validation = validate(manifest, payloadByGeneration.get(generationId) || []);
    payloadByGeneration.delete(generationId);
    return {
      generation_id: generationId || null,
      operation: manifest?.operation || null,
      created_at: manifest?.created_at || null,
      valid: validation.valid,
      errors: validation.errors,
    };
  });
  const orphanPayloadGenerations = [...payloadByGeneration.entries()]
    .filter(([generationId, rows]) => generationId || rows.length)
    .map(([generationId, rows]) => ({
      generation_id: generationId || null,
      row_count: rows.length,
    }));
  return {
    manifest_count: manifests.length,
    payload_row_count: payload.length,
    valid_generation_count: generations.filter((row) => row.valid).length,
    invalid_generation_count: generations.filter((row) => !row.valid).length,
    orphan_payload_generation_count: orphanPayloadGenerations.length,
    generations,
    orphan_payload_generations: orphanPayloadGenerations,
    restore_available: generations.some((row) => row.valid),
  };
}

function backupDocuments(row) {
  return [
    ...(Array.isArray(row?.as_degree) ? row.as_degree : []),
    ...(Array.isArray(row?.degree) ? row.degree : []),
  ];
}

function idToken(value) {
  if (value == null) return '<missing>';
  return typeof value === 'object' && typeof value.toHexString === 'function'
    ? value.toHexString() : JSON.stringify(value);
}

function legacyDegreeBackupInventory(rows, currentRequirements) {
  const currentIds = new Set(currentRequirements.map((row) => idToken(row?._id)));
  const generations = rows.map((row) => {
    const documents = backupDocuments(row);
    const ids = documents.map((document) => idToken(document?._id));
    const uniqueIds = new Set(ids);
    const idSetMatchesCurrent = uniqueIds.size === currentIds.size
      && [...uniqueIds].every((id) => currentIds.has(id));
    return {
      backup_id: idToken(row?._id),
      created_at: row?.created_at || null,
      associate_degree_count: Array.isArray(row?.as_degree) ? row.as_degree.length : null,
      bachelor_degree_count: Array.isArray(row?.degree) ? row.degree.length : null,
      document_count: documents.length,
      unique_document_ids: uniqueIds.size,
      id_set_matches_current: idSetMatchesCurrent,
      bundle_sha256: canonicalDocumentHash(documents),
      valid_degree_only_backup: documents.length === 35
        && uniqueIds.size === 35
        && idSetMatchesCurrent,
    };
  });
  const hashes = new Set(generations.map((row) => row.bundle_sha256));
  return {
    generation_count: generations.length,
    valid_degree_only_generation_count:
      generations.filter((row) => row.valid_degree_only_backup).length,
    distinct_bundle_count: hashes.size,
    current_requirement_count: currentRequirements.length,
    covered_targets: ['curated_requirements'],
    uncovered_projection_targets:
      FULL_PROJECTION_TARGETS.filter((name) => name !== 'curated_requirements'),
    uncovered_prerequisite_targets: [...FULL_PREREQUISITE_TARGETS],
    complete_release_rollback: false,
    generations,
  };
}

async function auditLiveRollbackInventory({ db, dbName = null }) {
  if (!db?.collection) throw new Error('Mongo database handle is required');
  const projectionManifests = await readRows(db, PROJECTION_REVISION_COLLECTION);
  const projectionPayload = await readRows(db, PROJECTION_PAYLOAD_COLLECTION);
  const prerequisiteManifests = await readRows(db, PREREQUISITE_REVISION_COLLECTION);
  const prerequisitePayload = await readRows(db, PREREQUISITE_PAYLOAD_COLLECTION);
  const legacyBackups = await readRows(db, LEGACY_DEGREE_BACKUP_COLLECTION);
  const currentRequirements = await readRows(db, 'curated_requirements', VA_FILTER);
  const transition = await readVirginiaPublicationTransitionLedger(db);

  const projection = snapshotInventory(
    projectionManifests,
    projectionPayload,
    validateSnapshot,
  );
  const prerequisites = snapshotInventory(
    prerequisiteManifests,
    prerequisitePayload,
    validatePrerequisiteSnapshot,
  );
  const legacyDegreeBackup = legacyDegreeBackupInventory(
    legacyBackups,
    currentRequirements,
  );
  return {
    artifact: 'va_live_rollback_inventory',
    read_only: true,
    database: dbName,
    projection,
    prerequisites,
    transition_authority: {
      valid: transition.valid,
      issue: transition.issue,
      event_count: transition.events.length,
      detail: transition.detail,
    },
    legacy_degree_backup: legacyDegreeBackup,
    full_release_target_snapshot_available:
      projection.restore_available && prerequisites.restore_available,
    current_visual_authority_possible:
      transition.valid && projection.restore_available && prerequisites.restore_available,
  };
}

function optionsFrom(argv) {
  const options = { json: false, requireFull: false };
  for (const argument of argv) {
    if (argument === '--json') options.json = true;
    else if (argument === '--require-full') options.requireFull = true;
    else throw new Error(`unknown option ${argument}`);
  }
  return options;
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const dbName = process.env.DB_NAME || 'pmt_research';
  const client = await MongoClient.connect(process.env.MONGO_URI);
  try {
    const report = await auditLiveRollbackInventory({ db: client.db(dbName), dbName });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Virginia live rollback inventory (${dbName}) — READ ONLY`);
      console.log(`  projection snapshots   ${report.projection.valid_generation_count}/${report.projection.manifest_count} valid`);
      console.log(`  prerequisite snapshots ${report.prerequisites.valid_generation_count}/${report.prerequisites.manifest_count} valid`);
      console.log(`  transition authority   ${report.transition_authority.valid ? 'valid' : report.transition_authority.issue}`);
      console.log(`  legacy degree backups  ${report.legacy_degree_backup.valid_degree_only_generation_count}/${report.legacy_degree_backup.generation_count} valid degree-only; full release rollback: no`);
      console.log(`  full target snapshot   ${report.full_release_target_snapshot_available ? 'available' : 'NOT AVAILABLE'}`);
    }
    if (options.requireFull && !report.full_release_target_snapshot_available) {
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = {
  FULL_PREREQUISITE_TARGETS,
  FULL_PROJECTION_TARGETS,
  auditLiveRollbackInventory,
  backupDocuments,
  cursorRows,
  legacyDegreeBackupInventory,
  optionsFrom,
  snapshotInventory,
};
