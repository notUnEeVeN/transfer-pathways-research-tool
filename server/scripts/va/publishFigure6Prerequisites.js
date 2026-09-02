#!/usr/bin/env node
/**
 * Validate and atomically publish both Virginia Figure 6 prerequisite corpora.
 *
 * This is deliberately separate from importVirginiaPrerequisites.js. That
 * importer owns the legacy VCCS research rows. This publisher accepts only the
 * v2 paper corpus, snapshots both corpora plus every publication receipt, and
 * replaces the VCCS and university collections in one MongoDB transaction.
 * Dry-run is the default; an explicit --restore preview is the only read-only
 * mode that opens Mongo without --apply.
 */

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { MongoClient } = require('mongodb');
const {
  VA_FIGURE6_PREREQUISITE_CONTRACT,
  canonicalJson,
  officialHostsForPrerequisiteScope,
  publicationGenerationFor,
  requiredUniversityCourseKeys,
  requiredVccsCourseKeys,
  sha256,
  validateVirginiaFigure6PrerequisiteCorpus,
  verificationReceiptHash,
  verificationReceiptIssues,
} = require('../../services/virginia/pathwayComplexityPrerequisites');
const {
  validateUniversityPrerequisiteScope,
} = require('../../services/virginia/universityPrerequisiteScope');
const {
  allocateVirginiaPublicationTransition,
  persistVirginiaPublicationTransition,
} = require('../../services/virginia/publicationTransition');

const DEFAULT_VCCS_ARTIFACT = path.resolve(
  __dirname,
  '../../.va-catalogs/research/va-vccs-course-requisites.json',
);
const DEFAULT_UNIVERSITY_ARTIFACT = path.resolve(
  __dirname,
  '../../.va-catalogs/research/va-university-course-requisites.json',
);
const DEFAULT_VCCS_SCOPE = path.resolve(__dirname, '../../.va-degrees/cs_course_scope.json');
const DEFAULT_UNIVERSITY_SCOPE = path.resolve(
  __dirname,
  '../../.va-catalogs/research/va-university-prerequisite-scope.json',
);
const DEFAULT_RECEIPT = path.resolve(
  __dirname,
  '../../.va-catalogs/research/va-figure6-prerequisite-verification-receipt.json',
);

const CORPUS_ARTIFACT = 'virginia_figure6_prerequisite_corpus';
const PUBLICATION_COLLECTION = 'va_figure6_prerequisite_publications';
const LEGACY_ARCHIVE_COLLECTION = 'va_prerequisite_research_archive';
const REVISION_COLLECTION = 'va_figure6_prerequisite_revisions';
const REVISION_DOCUMENT_COLLECTION = 'va_figure6_prerequisite_revision_documents';
const SNAPSHOT_SCHEMA_VERSION = 1;
const TARGETS = Object.freeze([
  {
    role: 'community_college',
    collection: VA_FIGURE6_PREREQUISITE_CONTRACT.community_college.collection,
  },
  {
    role: 'university',
    collection: VA_FIGURE6_PREREQUISITE_CONTRACT.university.collection,
  },
]);
const TRANSACTION_OPTIONS = Object.freeze({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
});
const VALIDATED_PUBLICATION_PLAN = Symbol('validated-virginia-figure6-prerequisite-plan');
const SNAPSHOT_TARGETS = Object.freeze([
  ...TARGETS.map(({ collection }) => Object.freeze({ collection })),
  Object.freeze({ collection: PUBLICATION_COLLECTION }),
]);

const asArray = (value) => Array.isArray(value) ? value : [];

function publicationPlanDigest(plan) {
  return sha256(canonicalJson({
    contract_version: plan?.contract_version,
    publication_generation: plan?.publication_generation,
    verification_receipt_id: plan?.verification_receipt_id,
    verification_receipt_sha256: plan?.verification_receipt_sha256,
    artifact_sha256: plan?.artifact_sha256,
    counts: plan?.counts,
    publication_rows: plan?.publicationRows,
    receipt: plan?.receipt,
  }));
}

function valueAfter(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
    ? argv[index + 1] : fallback;
}

function optionsFrom(argv = process.argv.slice(2)) {
  const knownValueFlags = new Set([
    '--uri', '--db', '--vccs-artifact', '--university-artifact',
    '--vccs-scope', '--university-scope', '--receipt', '--restore',
  ]);
  const unknown = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply' || arg === '--json') continue;
    if (knownValueFlags.has(arg)) {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) unknown.push(arg);
      else index += 1;
      continue;
    }
    unknown.push(arg);
  }
  if (unknown.length) throw new Error(`unknown or incomplete option(s): ${unknown.join(', ')}`);
  return {
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
    uri: valueAfter(argv, '--uri', process.env.MONGO_URI || null),
    dbName: valueAfter(argv, '--db', process.env.DB_NAME || 'pmt_research'),
    vccsArtifactFile: valueAfter(argv, '--vccs-artifact', DEFAULT_VCCS_ARTIFACT),
    universityArtifactFile: valueAfter(
      argv,
      '--university-artifact',
      DEFAULT_UNIVERSITY_ARTIFACT,
    ),
    vccsScopeFile: valueAfter(argv, '--vccs-scope', DEFAULT_VCCS_SCOPE),
    universityScopeFile: valueAfter(argv, '--university-scope', DEFAULT_UNIVERSITY_SCOPE),
    receiptFile: valueAfter(argv, '--receipt', DEFAULT_RECEIPT),
    restoreGenerationId: valueAfter(argv, '--restore', null),
  };
}

function artifactIssues(artifact, role, pathPrefix) {
  const issues = [];
  if (!artifact || typeof artifact !== 'object') {
    return [{ path: pathPrefix, code: 'corpus_artifact_required' }];
  }
  if (artifact.schema_version !== 1) {
    issues.push({ path: `${pathPrefix}.schema_version`, code: 'corpus_artifact_schema_invalid' });
  }
  if (artifact.artifact !== CORPUS_ARTIFACT) {
    issues.push({ path: `${pathPrefix}.artifact`, code: 'figure6_corpus_artifact_required' });
  }
  if (artifact.contract_version !== VA_FIGURE6_PREREQUISITE_CONTRACT.version) {
    issues.push({ path: `${pathPrefix}.contract_version`, code: 'corpus_contract_version_mismatch' });
  }
  if (artifact.corpus_role !== role) {
    issues.push({ path: `${pathPrefix}.corpus_role`, code: 'corpus_role_mismatch' });
  }
  if (!Array.isArray(artifact.rows)) {
    issues.push({ path: `${pathPrefix}.rows`, code: 'corpus_rows_required' });
  }
  return issues;
}

function artifactHashesForBytes(bytesByName = {}) {
  return Object.fromEntries(Object.entries(bytesByName)
    .map(([name, bytes]) => [name, sha256(bytes)]));
}

function buildPublicationPlan({
  vccsArtifact,
  universityArtifact,
  vccsScope,
  universityScope,
  verificationReceipt,
  artifactHashes = null,
  now = new Date(),
} = {}) {
  const envelopeIssues = [
    ...artifactIssues(vccsArtifact, 'community_college', 'vccs_artifact'),
    ...artifactIssues(universityArtifact, 'university', 'university_artifact'),
  ];
  const issues = [...envelopeIssues];
  if (!Array.isArray(vccsScope)) {
    issues.push({ path: 'vccs_scope', code: 'vccs_scope_required' });
  }
  const universityScopeReport = validateUniversityPrerequisiteScope(universityScope);
  if (!universityScopeReport.valid) {
    issues.push(...universityScopeReport.issues.map((code) => ({
      path: 'university_scope', code: `university_scope_${code}`,
    })));
  }
  const inputShapeReady = envelopeIssues.length === 0
    && Array.isArray(vccsScope)
    && universityScopeReport.valid;

  const communityCollegeRows = asArray(vccsArtifact?.rows);
  const universityRows = asArray(universityArtifact?.rows);
  const requiredCommunityCollegeKeys = requiredVccsCourseKeys(vccsScope);
  const requiredUniversityKeys = requiredUniversityCourseKeys(universityScope);
  const officialHostsByOwner = officialHostsForPrerequisiteScope(universityScope);
  const computedGeneration = publicationGenerationFor({
    communityCollegeRows,
    universityRows,
    requiredCommunityCollegeKeys,
    requiredUniversityKeys,
    officialHostsByOwner,
  });
  const publicationGeneration = inputShapeReady ? computedGeneration : null;
  const allowedUniversityOwners = asArray(universityScope?.universities)
    .map((row) => row?.owner_namespace).filter(Boolean);

  const corpusReport = inputShapeReady
    ? validateVirginiaFigure6PrerequisiteCorpus({
      communityCollegeRows,
      universityRows,
      requiredCommunityCollegeKeys,
      requiredUniversityKeys,
      adapterIntegrated: true,
      requireOfficialSourceEvidence: true,
      officialHostsByOwner,
      allowedUniversityOwners,
    })
    : { ready: false, issues: [] };
  if (inputShapeReady) issues.push(...corpusReport.issues);

  const hashes = artifactHashes || {};
  const requiredHashNames = [
    'community_college_corpus',
    'university_corpus',
    'vccs_scope',
    'university_scope',
  ];
  let artifactHashesReady = true;
  for (const name of requiredHashNames) {
    if (!/^[a-f0-9]{64}$/.test(String(hashes[name] || ''))) {
      artifactHashesReady = false;
      issues.push({ path: `artifact_sha256.${name}`, code: 'publication_artifact_hash_required' });
    }
  }
  let receiptIssues = [];
  if (inputShapeReady) {
    receiptIssues = verificationReceiptIssues(verificationReceipt, {
      publicationGeneration,
      artifactHashes: Object.fromEntries(requiredHashNames
        .filter((name) => hashes[name])
        .map((name) => [name, hashes[name]])),
      now,
    });
    issues.push(...receiptIssues);
  }

  const receiptSha256 = verificationReceipt
    ? verificationReceiptHash(verificationReceipt) : null;
  const receiptId = publicationGeneration
    ? `va:figure6:prerequisites:${publicationGeneration}` : null;
  const stamp = (rows) => rows.map((row) => ({
    ...row,
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    publication_generation: publicationGeneration,
    verification_receipt_id: receiptId,
    verification_receipt_sha256: receiptSha256,
  }));
  const publicationRows = {
    community_college: stamp(communityCollegeRows),
    university: stamp(universityRows),
  };

  const finalReport = inputShapeReady && corpusReport.ready
      && artifactHashesReady && receiptIssues.length === 0
    ? validateVirginiaFigure6PrerequisiteCorpus({
      communityCollegeRows: publicationRows.community_college,
      universityRows: publicationRows.university,
      requiredCommunityCollegeKeys,
      requiredUniversityKeys,
      adapterIntegrated: true,
      requireOfficialSourceEvidence: true,
      officialHostsByOwner,
      allowedUniversityOwners,
      requirePublicationMetadata: true,
      verificationReceipt,
    })
    : { ready: false, issues: [] };
  if (inputShapeReady) issues.push(...finalReport.issues);

  const uniqueIssues = [...new Map(issues.map((issue) => [
    `${issue.path}\u0000${issue.code}`,
    issue,
  ])).values()];
  const plan = {
    ready: uniqueIssues.length === 0,
    blocker: uniqueIssues.length ? 'virginia_figure6_prerequisite_model_unavailable' : null,
    dry_run: true,
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    publication_generation: publicationGeneration,
    verification_receipt_id: receiptId,
    verification_receipt_sha256: receiptSha256,
    artifact_sha256: hashes,
    counts: {
      community_college: communityCollegeRows.length,
      university: universityRows.length,
      required_community_college: requiredCommunityCollegeKeys.length,
      required_university: requiredUniversityKeys.length,
      owners: new Set(universityRows.map((row) => row?.owner_namespace).filter(Boolean)).size,
    },
    publicationRows,
    receipt: verificationReceipt || null,
    corpus_report: corpusReport,
    final_report: finalReport,
    issues: uniqueIssues,
  };
  if (plan.ready) Object.defineProperty(plan, VALIDATED_PUBLICATION_PLAN, {
    value: publicationPlanDigest(plan),
    configurable: true,
  });
  return plan;
}

function readArtifact(file, name, issues) {
  if (!fs.existsSync(file)) {
    issues.push({ path: name, code: 'artifact_file_missing', detail: file });
    return { value: null, bytes: null };
  }
  const bytes = fs.readFileSync(file);
  try {
    return { value: JSON.parse(bytes.toString('utf8')), bytes };
  } catch (error) {
    issues.push({ path: name, code: 'artifact_json_invalid', detail: error.message });
    return { value: null, bytes };
  }
}

function loadPublicationPlan(opts = optionsFrom([]), now = new Date()) {
  const fileIssues = [];
  const vccsArtifact = readArtifact(opts.vccsArtifactFile, 'vccs_artifact', fileIssues);
  const universityArtifact = readArtifact(
    opts.universityArtifactFile,
    'university_artifact',
    fileIssues,
  );
  const vccsScope = readArtifact(opts.vccsScopeFile, 'vccs_scope', fileIssues);
  const universityScope = readArtifact(opts.universityScopeFile, 'university_scope', fileIssues);
  const receipt = readArtifact(opts.receiptFile, 'verification_receipt', fileIssues);
  const bytesByName = {
    community_college_corpus: vccsArtifact.bytes,
    university_corpus: universityArtifact.bytes,
    vccs_scope: vccsScope.bytes,
    university_scope: universityScope.bytes,
  };
  const hashes = artifactHashesForBytes(Object.fromEntries(
    Object.entries(bytesByName).filter(([, bytes]) => bytes),
  ));
  const plan = buildPublicationPlan({
    vccsArtifact: vccsArtifact.value,
    universityArtifact: universityArtifact.value,
    vccsScope: vccsScope.value,
    universityScope: universityScope.value,
    verificationReceipt: receipt.value,
    artifactHashes: hashes,
    now,
  });
  plan.files = {
    vccs_artifact: opts.vccsArtifactFile,
    university_artifact: opts.universityArtifactFile,
    vccs_scope: opts.vccsScopeFile,
    university_scope: opts.universityScopeFile,
    verification_receipt: opts.receiptFile,
  };
  plan.issues = [...fileIssues, ...plan.issues];
  plan.ready = plan.issues.length === 0;
  plan.blocker = plan.ready ? null : 'virginia_figure6_prerequisite_model_unavailable';
  if (!plan.ready) delete plan[VALIDATED_PUBLICATION_PLAN];
  return plan;
}

const rowsHash = (rows) => sha256(canonicalJson([...rows]
  .sort((left, right) => {
    const leftKey = String(left?.course_key || '');
    const rightKey = String(right?.course_key || '');
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  })));

const sortedSnapshotDocuments = (rows = []) => [...rows].sort((left, right) => {
  const idOrder = canonicalJson(left?._id).localeCompare(canonicalJson(right?._id));
  return idOrder || canonicalJson(left).localeCompare(canonicalJson(right));
});

const snapshotDocumentsHash = (rows = []) => sha256(canonicalJson(
  sortedSnapshotDocuments(rows),
));

function prerequisiteSnapshotTargets(documentsByCollection = {}) {
  return SNAPSHOT_TARGETS.map(({ collection }) => {
    const documents = documentsByCollection[collection] || [];
    return {
      collection,
      filter: {},
      count: documents.length,
      sha256: snapshotDocumentsHash(documents),
    };
  });
}

function validatePrerequisiteSnapshotDocuments(documentsByCollection = {}) {
  const errors = [];
  for (const { collection } of SNAPSHOT_TARGETS) {
    const documents = documentsByCollection[collection];
    if (!Array.isArray(documents)) {
      errors.push(`${collection}: snapshot documents must be an array`);
      continue;
    }
    const ids = new Set();
    for (const [index, document] of documents.entries()) {
      if (!document || typeof document !== 'object' || Array.isArray(document)) {
        errors.push(`${collection}[${index}]: snapshot document must be an object`);
        continue;
      }
      const id = canonicalJson(document._id);
      if (document._id == null) errors.push(`${collection}[${index}]: _id is required`);
      else if (ids.has(id)) errors.push(`${collection}: duplicate _id ${id}`);
      ids.add(id);
    }
  }
  return { valid: errors.length === 0, errors };
}

function buildPrerequisiteSnapshot({
  generationId,
  documentsByCollection,
  operation = 'publish',
  sourceGenerationId = null,
  replacementGeneration = null,
  createdAt = new Date(),
}) {
  if (typeof generationId !== 'string' || !generationId.trim()) {
    throw new Error('prerequisite snapshot generation id is required');
  }
  const validation = validatePrerequisiteSnapshotDocuments(documentsByCollection);
  if (!validation.valid) {
    throw new Error(`cannot snapshot invalid prerequisite state:\n${validation.errors.join('\n')}`);
  }
  const payload = SNAPSHOT_TARGETS.flatMap(({ collection }) => (
    sortedSnapshotDocuments(documentsByCollection[collection])
      .map((document, ordinal) => ({
        _id: `${generationId}:${collection}:${String(ordinal).padStart(8, '0')}`,
        generation_id: generationId,
        collection,
        ordinal,
        document,
      }))
  ));
  return {
    manifest: {
      _id: generationId,
      kind: 'va_figure6_prerequisite_snapshot',
      schema_version: SNAPSHOT_SCHEMA_VERSION,
      generation_id: generationId,
      operation,
      source_generation_id: sourceGenerationId,
      replacement_publication_generation: replacementGeneration,
      created_at: createdAt,
      status: 'complete',
      targets: prerequisiteSnapshotTargets(documentsByCollection),
    },
    payload,
  };
}

function validatePrerequisiteSnapshot(manifest, payload) {
  const errors = [];
  const documentsByCollection = Object.fromEntries(
    SNAPSHOT_TARGETS.map(({ collection }) => [collection, []]),
  );
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['snapshot manifest is missing'], documentsByCollection };
  }
  if (manifest.kind !== 'va_figure6_prerequisite_snapshot') errors.push('manifest kind is invalid');
  if (manifest.schema_version !== SNAPSHOT_SCHEMA_VERSION) {
    errors.push(`unsupported snapshot schema version ${manifest.schema_version ?? '<missing>'}`);
  }
  if (manifest.status !== 'complete') errors.push("manifest status must be 'complete'");
  if (!manifest.generation_id || manifest._id !== manifest.generation_id) {
    errors.push('manifest _id/generation_id mismatch');
  }
  const expectedCollections = new Set(SNAPSHOT_TARGETS.map(({ collection }) => collection));
  const targets = Array.isArray(manifest.targets) ? manifest.targets : [];
  const targetByCollection = new Map();
  if (targets.length !== SNAPSHOT_TARGETS.length) {
    errors.push(`manifest must contain exactly ${SNAPSHOT_TARGETS.length} targets`);
  }
  for (const target of targets) {
    if (!expectedCollections.has(target?.collection)) {
      errors.push(`manifest contains unknown target ${target?.collection ?? '<missing>'}`);
      continue;
    }
    if (targetByCollection.has(target.collection)) {
      errors.push(`manifest contains duplicate target ${target.collection}`);
      continue;
    }
    targetByCollection.set(target.collection, target);
    if (canonicalJson(target.filter) !== canonicalJson({})) {
      errors.push(`${target.collection}: snapshot filter must be exactly {}`);
    }
    if (!Number.isInteger(target.count) || target.count < 0) {
      errors.push(`${target.collection}: snapshot count is invalid`);
    }
    if (!/^[a-f0-9]{64}$/.test(String(target.sha256 || ''))) {
      errors.push(`${target.collection}: snapshot hash is invalid`);
    }
  }
  for (const collection of expectedCollections) {
    if (!targetByCollection.has(collection)) errors.push(`manifest is missing target ${collection}`);
  }

  if (!Array.isArray(payload)) errors.push('snapshot payload is missing');
  else {
    const payloadIds = new Set();
    for (const row of payload) {
      if (row?.generation_id !== manifest.generation_id) {
        errors.push('payload generation_id does not match manifest');
        continue;
      }
      if (!expectedCollections.has(row?.collection)) {
        errors.push(`${row?._id || '<payload>'}: payload target is unknown`);
        continue;
      }
      const id = canonicalJson(row._id);
      if (payloadIds.has(id)) errors.push(`duplicate payload _id ${id}`);
      payloadIds.add(id);
      documentsByCollection[row.collection].push(row);
    }
  }

  for (const { collection } of SNAPSHOT_TARGETS) {
    const rows = documentsByCollection[collection]
      .sort((left, right) => Number(left.ordinal) - Number(right.ordinal));
    rows.forEach((row, index) => {
      if (!Number.isInteger(row.ordinal) || row.ordinal !== index) {
        errors.push(`${collection}: payload ordinals are incomplete or duplicated`);
      }
      const expectedId = `${manifest.generation_id}:${collection}:${String(index).padStart(8, '0')}`;
      if (row._id !== expectedId) errors.push(`${collection}: payload _id does not match ordinal ${index}`);
    });
    const documents = rows.map((row) => row.document);
    const validation = validatePrerequisiteSnapshotDocuments(Object.fromEntries(
      SNAPSHOT_TARGETS.map(({ collection: name }) => [name, name === collection ? documents : []]),
    ));
    errors.push(...validation.errors.filter((error) => error.startsWith(collection)));
    const target = targetByCollection.get(collection);
    if (target && documents.length !== target.count) {
      errors.push(`${collection}: expected ${target.count} documents, found ${documents.length}`);
    }
    if (target && snapshotDocumentsHash(documents) !== target.sha256) {
      errors.push(`${collection}: content hash does not match manifest`);
    }
    documentsByCollection[collection] = documents;
  }
  return { valid: errors.length === 0, errors, documentsByCollection };
}

async function readPrerequisiteSnapshotTargets(db, session) {
  const documents = {};
  for (const { collection } of SNAPSHOT_TARGETS) {
    documents[collection] = await db.collection(collection).find({}, { session }).toArray();
  }
  return documents;
}

async function persistPrerequisiteSnapshot(db, snapshot, transition, session) {
  if (canonicalJson(snapshot?.manifest?.publication_transition)
      !== canonicalJson(transition?.binding)) {
    throw new Error('Virginia prerequisite snapshot is not bound to its publication transition');
  }
  if (snapshot.payload.length) {
    await db.collection(REVISION_DOCUMENT_COLLECTION)
      .insertMany(snapshot.payload, { ordered: true, session });
  }
  await db.collection(REVISION_COLLECTION).insertOne(snapshot.manifest, { session });
  await persistVirginiaPublicationTransition(db, transition, session);
}

async function loadPrerequisiteSnapshot(db, generationId, session = null) {
  const options = session ? { session } : undefined;
  const manifest = await db.collection(REVISION_COLLECTION)
    .findOne({ _id: generationId, generation_id: generationId }, options);
  if (!manifest) throw new Error(`Virginia prerequisite backup ${generationId} does not exist`);
  const payload = await db.collection(REVISION_DOCUMENT_COLLECTION)
    .find({ generation_id: generationId }, options).toArray();
  const validation = validatePrerequisiteSnapshot(manifest, payload);
  if (!validation.valid) {
    throw new Error(
      `Virginia prerequisite backup ${generationId} is incomplete:\n${validation.errors.join('\n')}`,
    );
  }
  return { manifest, payload, documentsByCollection: validation.documentsByCollection };
}

async function replacePrerequisiteSnapshotTargets(db, documentsByCollection, session) {
  const validation = validatePrerequisiteSnapshotDocuments(documentsByCollection);
  if (!validation.valid) {
    throw new Error(`refusing invalid prerequisite replacement:\n${validation.errors.join('\n')}`);
  }
  for (const { collection } of SNAPSHOT_TARGETS) {
    const target = db.collection(collection);
    await target.deleteMany({}, { session });
    const documents = documentsByCollection[collection];
    if (documents.length) await target.insertMany(documents, { ordered: true, session });
  }
  const written = await readPrerequisiteSnapshotTargets(db, session);
  if (canonicalJson(prerequisiteSnapshotTargets(written))
      !== canonicalJson(prerequisiteSnapshotTargets(documentsByCollection))) {
    throw new Error('post-write prerequisite snapshot manifest does not match requested snapshot');
  }
}

async function restorePrerequisiteSnapshot({
  client,
  db,
  generationId,
  backupGenerationId = randomUUID(),
  now = new Date(),
}) {
  const session = client.startSession();
  let restoredTargets;
  try {
    await session.withTransaction(async () => {
      const requested = await loadPrerequisiteSnapshot(db, generationId, session);
      const current = await readPrerequisiteSnapshotTargets(db, session);
      const rollbackOfRestore = buildPrerequisiteSnapshot({
        generationId: backupGenerationId,
        documentsByCollection: current,
        operation: 'restore',
        sourceGenerationId: generationId,
        createdAt: now,
      });
      rollbackOfRestore.manifest.replacement_targets = requested.manifest.targets;
      rollbackOfRestore.manifest.restored_snapshot_manifest_sha256
        = sha256(canonicalJson(requested.manifest));
      const transition = await allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'prerequisite',
        operation: 'restore',
        generationId: backupGenerationId,
        createdAt: rollbackOfRestore.manifest.created_at,
      });
      rollbackOfRestore.manifest.publication_transition = transition.binding;
      await persistPrerequisiteSnapshot(db, rollbackOfRestore, transition, session);
      await replacePrerequisiteSnapshotTargets(db, requested.documentsByCollection, session);
      restoredTargets = requested.manifest.targets;
    }, TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }
  return {
    restored_generation_id: generationId,
    rollback_generation_id: backupGenerationId,
    targets: restoredTargets,
  };
}

async function archiveExistingRows(db, collection, rows, generation, archivedAt, session) {
  const archive = db.collection(LEGACY_ARCHIVE_COLLECTION);
  for (const row of rows) {
    const documentSha256 = sha256(canonicalJson(row));
    const id = `va:prerequisite-archive:${collection}:${documentSha256}`;
    await archive.updateOne(
      { _id: id },
      { $setOnInsert: {
        _id: id,
        source_collection: collection,
        superseded_by_generation: generation,
        archived_at: archivedAt,
        document_sha256: documentSha256,
        document: row,
      } },
      { upsert: true, session },
    );
    const retained = await archive.findOne({ _id: id }, { session });
    if (!retained || retained.document_sha256 !== documentSha256
        || canonicalJson(retained.document) !== canonicalJson(row)) {
      throw new Error(`${collection}: legacy research archive verification failed for ${id}`);
    }
  }
}

async function publishPlan({
  client,
  db,
  plan,
  now = new Date(),
  snapshotGenerationId = randomUUID(),
}) {
  if (!plan?.ready
      || plan[VALIDATED_PUBLICATION_PLAN] !== publicationPlanDigest(plan)) {
    throw new Error('refusing to publish: blocked prerequisite plan or missing validation marker');
  }
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const previousTargets = await readPrerequisiteSnapshotTargets(db, session);
      const snapshot = buildPrerequisiteSnapshot({
        generationId: snapshotGenerationId,
        documentsByCollection: previousTargets,
        operation: 'publish',
        replacementGeneration: plan.publication_generation,
        createdAt: now,
      });
      const transition = await allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'prerequisite',
        operation: 'publish',
        generationId: snapshotGenerationId,
        createdAt: snapshot.manifest.created_at,
      });
      snapshot.manifest.publication_transition = transition.binding;
      await persistPrerequisiteSnapshot(db, snapshot, transition, session);
      for (const target of TARGETS) {
        const collection = db.collection(target.collection);
        await archiveExistingRows(
          db,
          target.collection,
          previousTargets[target.collection],
          plan.publication_generation,
          now,
          session,
        );
        await collection.deleteMany({}, { session });
        const rows = plan.publicationRows[target.role].map((row) => ({
          ...row,
          published_at: now,
        }));
        if (rows.length) await collection.insertMany(rows, { ordered: true, session });
        const written = await collection.find({}, { session }).toArray();
        if (rowsHash(written) !== rowsHash(rows)) {
          throw new Error(`${target.collection}: post-write content mismatch`);
        }
      }

      const publications = db.collection(PUBLICATION_COLLECTION);
      await publications.updateMany(
        { active: true },
        { $set: { active: false, deactivated_at: now } },
        { session },
      );
      await publications.replaceOne(
        { _id: plan.verification_receipt_id },
        {
          ...plan.receipt,
          _id: plan.verification_receipt_id,
          active: true,
          published_at: now,
          receipt_sha256: plan.verification_receipt_sha256,
          publication_generation: plan.publication_generation,
          corpus_counts: plan.counts,
        },
        { upsert: true, session },
      );
    }, TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }
  return {
    published: true,
    publication_generation: plan.publication_generation,
    rollback_generation_id: snapshotGenerationId,
    counts: plan.counts,
  };
}

function printablePlan(plan) {
  return {
    ready: plan.ready,
    blocker: plan.blocker,
    dry_run: plan.dry_run,
    contract_version: plan.contract_version,
    publication_generation: plan.publication_generation,
    verification_receipt_sha256: plan.verification_receipt_sha256,
    artifact_sha256: plan.artifact_sha256,
    counts: plan.counts,
    files: plan.files,
    issues: plan.issues,
  };
}

async function run(opts = optionsFrom(), dependencies = {}) {
  const log = dependencies.log || console.log;
  if (opts.restoreGenerationId) {
    if (!opts.uri) throw new Error('MONGO_URI or --uri is required for --restore');
    const Client = dependencies.MongoClient || MongoClient;
    const client = new Client(opts.uri);
    await client.connect();
    try {
      const db = client.db(opts.dbName);
      const requested = await loadPrerequisiteSnapshot(db, opts.restoreGenerationId);
      const preview = {
        ready: true,
        dry_run: !opts.apply,
        restored_generation_id: opts.restoreGenerationId,
        targets: requested.manifest.targets,
      };
      if (!opts.apply) {
        if (opts.json) log(JSON.stringify(preview, null, 2));
        else {
          log(`[va:figure6-prerequisites] RESTORE READY ${opts.restoreGenerationId}`);
          for (const target of preview.targets) {
            log(`  ${target.collection} ${target.count} ${target.sha256}`);
          }
          log('  dry run — complete manifest-bound snapshot; nothing written');
        }
        return preview;
      }
      const result = await restorePrerequisiteSnapshot({
        client,
        db,
        generationId: opts.restoreGenerationId,
        now: dependencies.now || new Date(),
      });
      log(`  restored all prerequisite targets from ${result.restored_generation_id}`);
      log(`  pre-restore state saved as ${result.rollback_generation_id}`);
      return { ready: true, dry_run: false, ...result };
    } finally {
      await client.close();
    }
  }
  const plan = loadPublicationPlan(opts, dependencies.now || new Date());
  if (opts.json) log(JSON.stringify(printablePlan(plan), null, 2));
  else {
    log(`[va:figure6-prerequisites] ${plan.ready ? 'READY' : 'BLOCKED'}`);
    log(`  contract    ${plan.contract_version}`);
    log(`  generation  ${plan.publication_generation || 'unavailable (invalid/missing corpus envelope)'}`);
    log(`  VCCS        ${plan.counts.community_college} raw rows · ${plan.counts.required_community_college} required direct keys`);
    log(`  university  ${plan.counts.university} raw rows · ${plan.counts.required_university} required direct keys · ${plan.counts.owners} owners`);
    for (const issue of plan.issues.slice(0, 30)) {
      log(`  BLOCK ${issue.path} [${issue.code}]${issue.detail ? ` — ${issue.detail}` : ''}`);
    }
    if (plan.issues.length > 30) log(`  ... ${plan.issues.length - 30} additional issue(s)`);
  }
  if (!opts.apply) {
    if (!opts.json) log('  dry run — no Mongo client created and nothing written');
    return plan;
  }
  if (!plan.ready) throw new Error('refusing --apply because the publication plan is blocked');
  if (!opts.uri) throw new Error('MONGO_URI or --uri is required for --apply');
  const Client = dependencies.MongoClient || MongoClient;
  const client = new Client(opts.uri);
  await client.connect();
  try {
    const result = await publishPlan({
      client,
      db: client.db(opts.dbName),
      plan,
      now: dependencies.now || new Date(),
    });
    log(`  published both corpora atomically as ${result.publication_generation}`);
    return { ...plan, ...result };
  } finally {
    await client.close();
  }
}

module.exports = {
  CORPUS_ARTIFACT,
  DEFAULT_RECEIPT,
  DEFAULT_UNIVERSITY_ARTIFACT,
  DEFAULT_UNIVERSITY_SCOPE,
  DEFAULT_VCCS_ARTIFACT,
  DEFAULT_VCCS_SCOPE,
  LEGACY_ARCHIVE_COLLECTION,
  PUBLICATION_COLLECTION,
  REVISION_COLLECTION,
  REVISION_DOCUMENT_COLLECTION,
  SNAPSHOT_TARGETS,
  TARGETS,
  artifactHashesForBytes,
  artifactIssues,
  buildPrerequisiteSnapshot,
  buildPublicationPlan,
  loadPublicationPlan,
  loadPrerequisiteSnapshot,
  optionsFrom,
  prerequisiteSnapshotTargets,
  publishPlan,
  restorePrerequisiteSnapshot,
  run,
  validatePrerequisiteSnapshot,
};

if (require.main === module) {
  run().then((result) => {
    if (!result.ready) process.exitCode = 1;
  }).catch((error) => {
    console.error('[va:figure6-prerequisites] FATAL', error.stack || error.message);
    process.exitCode = 1;
  });
}
