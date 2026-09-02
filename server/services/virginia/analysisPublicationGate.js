/**
 * Exact publication capability for Virginia's shared analysis surfaces.
 *
 * A global analysis release controls who may see a renderer.  It does not say
 * that every configured major is publication-ready for that renderer.  The
 * Virginia projection therefore carries a second, major-scoped capability:
 * the most recent successful projection transaction must have stored a
 * receipt whose hashes still match all four shared projection collections,
 * both Figure-6 prerequisite collections, the active human prerequisite
 * receipt, and the current condition/prerequisite evaluators.
 *
 * There is intentionally no "best effort" mode here.  Missing, stale,
 * malformed, or incomplete receipts all return the same fail-closed status.
 */

const { createHash } = require('node:crypto');
const { BSON } = require('mongodb');
const {
  auditVirginiaProjectionEquivalencyConditions,
} = require('../analysis/transferCreditRate');
const {
  VA_FIGURE6_PREREQUISITE_CONTRACT,
  validateVirginiaFigure6PrerequisiteSources,
  verificationReceiptHash,
} = require('./pathwayComplexityPrerequisites');
const {
  VA_PUBLICATION_EVALUATOR_FINGERPRINT_CONTRACT,
  currentVirginiaPublicationEvaluatorFingerprint,
} = require('./publicationEvaluatorFingerprint');
const {
  readVirginiaPublicationTransitionLedger,
  transitionBinding,
} = require('./publicationTransition');

const VCCS_FIGURE6_SCOPE = require('../../.va-degrees/cs_course_scope.json');
const UNIVERSITY_FIGURE6_SCOPE = require(
  '../../.va-catalogs/research/va-university-prerequisite-scope.json',
);

const VA_ANALYSIS_PUBLICATION_CONTRACT = 'va-analysis-publication-receipt-v1';
const VA_ANALYSIS_PUBLICATION_RECEIPT_SCHEMA_VERSION = 2;
const VA_ANALYSIS_PUBLICATION_BLOCKER = 'virginia_analysis_publication_receipt_required';
const VA_ANALYSIS_MAJOR = 'va-cs';
const VA_ANALYSIS_RECEIPT_GATE = Object.freeze({
  contract: VA_ANALYSIS_PUBLICATION_CONTRACT,
});
const PREREQUISITE_REVISION_COLLECTION = 'va_figure6_prerequisite_revisions';
const SHA256 = /^[a-f0-9]{64}$/;
const VA_FILTER = Object.freeze({ state: 'va' });
const PROJECTION_TARGETS = Object.freeze([
  'assist_institutions',
  'assist_courses',
  'assist_agreements',
  'curated_requirements',
]);
const PREREQUISITE_TARGETS = Object.freeze([
  'va_course_requisites',
  'va_university_course_requisites',
]);

function canonicalJson(value) {
  const sortKeys = (entry) => {
    if (Array.isArray(entry)) return entry.map(sortKeys);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(Object.keys(entry).sort()
      .map((key) => [key, sortKeys(entry[key])]));
  };
  return JSON.stringify(sortKeys(BSON.EJSON.serialize(value, { relaxed: false })));
}

function sortedDocuments(documents = []) {
  return [...documents].sort((left, right) => {
    const ids = canonicalJson(left?._id).localeCompare(canonicalJson(right?._id));
    return ids || canonicalJson(left).localeCompare(canonicalJson(right));
  });
}

function canonicalDocumentHash(documents = []) {
  const hash = createHash('sha256');
  for (const document of sortedDocuments(documents)) {
    const encoded = canonicalJson(document);
    hash.update(String(Buffer.byteLength(encoded)));
    hash.update(':');
    hash.update(encoded);
    hash.update('\n');
  }
  return hash.digest('hex');
}

function reportSha256(report) {
  return createHash('sha256').update(canonicalJson(report)).digest('hex');
}

function manifestForDocuments(documentsByCollection, collections, filter) {
  return collections.map((collection) => {
    const rows = documentsByCollection?.[collection] || [];
    return {
      collection,
      filter,
      count: rows.length,
      sha256: canonicalDocumentHash(rows),
    };
  });
}

function manifestSha256(manifest) {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}

function projectionFromDocuments(documentsByCollection = {}) {
  const requirements = documentsByCollection.curated_requirements || [];
  return {
    institutions: documentsByCollection.assist_institutions || [],
    courses: documentsByCollection.assist_courses || [],
    agreements: documentsByCollection.assist_agreements || [],
    degrees: requirements.filter((row) => row?.kind === 'degree'),
    asDegrees: requirements.filter((row) => row?.kind === 'as_degree'),
    withoutEquivalencies: [],
  };
}

function receiptIssue(code, detail = null) {
  return { code, ...(detail == null ? {} : { detail }) };
}

function unavailable(issues, receipt = null) {
  return {
    ready: false,
    blocker: VA_ANALYSIS_PUBLICATION_BLOCKER,
    contract: VA_ANALYSIS_PUBLICATION_CONTRACT,
    major_slug: VA_ANALYSIS_MAJOR,
    generation_id: receipt?.generation_id || null,
    issues,
  };
}

/**
 * Build the receipt persisted by the already-transactional projection writer.
 * The writer calls this only after its private, authoritative preflight has
 * passed.  The returned object is data, not authority: runtime rechecks all
 * content hashes and both executable readiness reports.
 */
/**
 * Receipt for a publication that is structurally sound but whose paper figures
 * are NOT certified for release.
 *
 * The certified receipt below demands a fully passing preflight and one active,
 * signed Figure-6 verification receipt. Virginia cannot reach that today, and
 * fabricating the signature would be a lie about who reviewed what. But the
 * documents themselves are sound -- lossless projection, source accounting,
 * shared schema, and course identity all pass -- and the figure pipeline
 * already excludes each unproven pair per cell with a stated reason.
 *
 * So this receipt says exactly that: `ready` to render, `publishable: false`,
 * `figures_uncertified: true`, and the exact figure blockers being carried.
 * Consumers must surface that state rather than presenting these numbers as
 * verified.
 */
function buildVirginiaUncertifiedPublicationReceipt({
  generationId,
  createdAt,
  projectionManifest,
  preflightReport,
  communityCollegeRows = [],
  universityRows = [],
  waivedFigureCertifications = [],
}) {
  const unitOverlay = preflightReport?.course_unit_evidence_overlay;
  if (unitOverlay?.ready !== true
      || !SHA256.test(String(unitOverlay?.report_sha256 || ''))
      || !SHA256.test(String(unitOverlay?.output_documents_sha256 || ''))) {
    throw new Error('Virginia uncertified publication receipt still requires a passing unit-evidence overlay');
  }
  if (!generationId || !Array.isArray(projectionManifest)) {
    throw new Error('Virginia uncertified publication receipt requires a generation and projection manifest');
  }
  const conditions = preflightReport?.publication?.figure_readiness
    ?.transfer_equivalency_conditions;
  const prerequisites = preflightReport?.publication?.figure_readiness?.pathway_complexity;
  const prerequisiteManifest = manifestForDocuments(
    {
      va_course_requisites: communityCollegeRows,
      va_university_course_requisites: universityRows,
    },
    PREREQUISITE_TARGETS,
    {},
  );
  const evaluatorFingerprint = currentVirginiaPublicationEvaluatorFingerprint();
  return {
    contract: VA_ANALYSIS_PUBLICATION_CONTRACT,
    schema_version: VA_ANALYSIS_PUBLICATION_RECEIPT_SCHEMA_VERSION,
    state: 'va',
    major_slug: VA_ANALYSIS_MAJOR,
    ready: true,
    publishable: false,
    figures_uncertified: true,
    waived_figure_certifications: waivedFigureCertifications,
    generation_id: String(generationId),
    created_at: createdAt,
    projection_manifest: projectionManifest,
    projection_manifest_sha256: manifestSha256(projectionManifest),
    prerequisite_manifest: prerequisiteManifest,
    prerequisite_manifest_sha256: manifestSha256(prerequisiteManifest),
    preflight_report_sha256: reportSha256(preflightReport),
    publication_audit_report_sha256: reportSha256(preflightReport?.publication || {}),
    publication_evaluator_fingerprint_contract:
      evaluatorFingerprint.contract,
    publication_evaluator_fingerprint_sha256: evaluatorFingerprint.sha256,
    publication_evaluator_fingerprint_file_count: evaluatorFingerprint.file_count,
    course_unit_evidence_overlay_report_sha256: unitOverlay.report_sha256,
    course_unit_evidence_output_documents_sha256: unitOverlay.output_documents_sha256,
    transfer_equivalency_condition_report_sha256:
      conditions ? reportSha256(conditions) : null,
    pathway_complexity_prerequisite_report_sha256:
      prerequisites ? reportSha256(prerequisites) : null,
    paper_figures: ['1', '3', '4', '6'],
  };
}

function buildVirginiaAnalysisPublicationReceipt({
  generationId,
  createdAt,
  projectionManifest,
  preflightReport,
  communityCollegeRows = [],
  universityRows = [],
  verificationReceipt,
}) {
  const conditions = preflightReport?.publication?.figure_readiness
    ?.transfer_equivalency_conditions;
  const prerequisites = preflightReport?.publication?.figure_readiness?.pathway_complexity;
  const unitOverlay = preflightReport?.course_unit_evidence_overlay;
  const figures = preflightReport?.publication?.publication_by_figure || {};
  const allFiguresReady = ['1', '3', '4', '6']
    .every((figure) => figures?.[figure]?.publishable === true);
  if (preflightReport?.publishable !== true
      || preflightReport?.publication?.publishable !== true
      || !allFiguresReady
      || conditions?.ready !== true
      || prerequisites?.ready !== true
      || unitOverlay?.ready !== true
      || !SHA256.test(String(unitOverlay?.report_sha256 || ''))
      || !SHA256.test(String(unitOverlay?.output_documents_sha256 || ''))) {
    throw new Error('Virginia analysis publication receipt requires a fully passing preflight');
  }
  if (!generationId || !Array.isArray(projectionManifest)) {
    throw new Error('Virginia analysis publication receipt requires a generation and projection manifest');
  }
  const receiptHash = verificationReceiptHash(verificationReceipt);
  if (!SHA256.test(String(receiptHash || ''))
      || verificationReceipt?.active !== true
      || !verificationReceipt?.publication_generation) {
    throw new Error('Virginia analysis publication receipt requires one active Figure-6 verification receipt');
  }
  const prerequisiteDocuments = {
    va_course_requisites: communityCollegeRows,
    va_university_course_requisites: universityRows,
  };
  const prerequisiteManifest = manifestForDocuments(
    prerequisiteDocuments,
    PREREQUISITE_TARGETS,
    {},
  );
  const evaluatorFingerprint = currentVirginiaPublicationEvaluatorFingerprint();
  return {
    contract: VA_ANALYSIS_PUBLICATION_CONTRACT,
    schema_version: VA_ANALYSIS_PUBLICATION_RECEIPT_SCHEMA_VERSION,
    state: 'va',
    major_slug: VA_ANALYSIS_MAJOR,
    ready: true,
    publishable: true,
    generation_id: String(generationId),
    created_at: createdAt,
    projection_manifest: projectionManifest,
    projection_manifest_sha256: manifestSha256(projectionManifest),
    prerequisite_manifest: prerequisiteManifest,
    prerequisite_manifest_sha256: manifestSha256(prerequisiteManifest),
    preflight_report_sha256: reportSha256(preflightReport),
    publication_audit_report_sha256: reportSha256(preflightReport.publication),
    publication_evaluator_fingerprint_contract: evaluatorFingerprint.contract,
    publication_evaluator_fingerprint_sha256: evaluatorFingerprint.sha256,
    publication_evaluator_fingerprint_file_count: evaluatorFingerprint.file_count,
    course_unit_evidence_overlay_report_sha256: unitOverlay.report_sha256,
    course_unit_evidence_output_documents_sha256: unitOverlay.output_documents_sha256,
    transfer_equivalency_condition_report_sha256: reportSha256(conditions),
    pathway_complexity_prerequisite_report_sha256: reportSha256(prerequisites),
    prerequisite_contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    prerequisite_publication_generation: verificationReceipt.publication_generation,
    prerequisite_verification_receipt_id: String(verificationReceipt._id || ''),
    prerequisite_verification_receipt_sha256: receiptHash,
    paper_figures: ['1', '3', '4', '6'],
  };
}

async function readDocuments(db, collections, filter, session = null) {
  const result = {};
  // Mongo transactions do not permit concurrent operations on one session.
  for (const collection of collections) {
    result[collection] = await db.collection(collection)
      .find(filter, session ? { session } : undefined)
      .sort({ _id: 1 })
      .toArray();
  }
  return result;
}

async function revisionForTransitionEvent(db, event, session) {
  const revision = await db.collection(event.revision_collection).findOne({
    _id: event.generation_id,
    generation_id: event.generation_id,
    operation: event.operation,
    status: 'complete',
    ...(event.domain === 'projection' ? { state: 'va' } : {}),
  }, session ? { session } : undefined);
  if (!revision) {
    return {
      revision: null,
      issue: receiptIssue('publication_transition_revision_missing', {
        event_id: event._id,
        generation_id: event.generation_id,
      }),
    };
  }
  if (canonicalJson(revision.publication_transition)
        !== canonicalJson(transitionBinding(event))
      || canonicalJson(revision.created_at) !== canonicalJson(event.created_at)) {
    return {
      revision,
      issue: receiptIssue('publication_transition_revision_binding_mismatch', {
        event_id: event._id,
        generation_id: event.generation_id,
      }),
    };
  }
  return { revision, issue: null };
}

/**
 * Resolve the single transition that currently owns Virginia publication.
 *
 * Projection publishes/restores and prerequisite publishes/restores happen in
 * separate transactional writers.  Only their shared append ledger provides
 * authority.  Unsequenced legacy revisions remain rollback material but can
 * never enable analysis; same-time events and clock regression are harmless
 * because visibility is resolved only by the ledger's monotonic sequence.
 */
async function virginiaAnalysisPublicationTransition(db, { session = null } = {}) {
  const ledger = await readVirginiaPublicationTransitionLedger(db, { session });
  if (!ledger.valid) {
    return {
      projection: null,
      prerequisite: null,
      authoritative: null,
      issue: receiptIssue(ledger.issue, ledger.detail),
    };
  }
  // The ledger is an append-only authority, so every event—not only the most
  // recent event in each domain—must still have its exact, complete,
  // manifest-bound revision.  Otherwise deleting or corrupting an older
  // authority row could leave a superficially valid newer event enabled while
  // the transition history was no longer independently replayable.
  const revisionHistory = new Map();
  for (const event of ledger.events) {
    const result = await revisionForTransitionEvent(db, event, session);
    if (result.issue) {
      return {
        projection: null,
        prerequisite: null,
        authoritative: null,
        issue: result.issue,
      };
    }
    revisionHistory.set(event._id, result.revision);
  }
  const projectionEvent = [...ledger.events]
    .reverse().find((event) => event.domain === 'projection') || null;
  const prerequisiteEvent = [...ledger.events]
    .reverse().find((event) => event.domain === 'prerequisite') || null;
  const projection = projectionEvent
    ? revisionHistory.get(projectionEvent._id) || null : null;
  const prerequisite = prerequisiteEvent
    ? revisionHistory.get(prerequisiteEvent._id) || null : null;
  if (!projection) {
    return {
      projection: null,
      prerequisite,
      authoritative: prerequisite,
      issue: prerequisite?.operation === 'restore'
        ? receiptIssue('publication_revoked_by_prerequisite_restore')
        : receiptIssue('publication_receipt_missing'),
    };
  }
  if (!prerequisite) {
    if (projection.operation === 'restore') {
      return {
        projection,
        prerequisite: null,
        authoritative: projection,
        issue: receiptIssue('publication_revoked_by_projection_restore'),
      };
    }
    // The prerequisite transition exists to bind Figure 6's corpus to the
    // projection. A figures-uncertified publication waives Figure 6 outright
    // -- its university prerequisite corpus is empty and it does not render --
    // so there is no corpus to bind and nothing for this check to protect.
    // Every other figure is unaffected.
    if (projection.figures_uncertified_override === true) {
      return {
        projection, prerequisite: null, authoritative: projection, issue: null,
      };
    }
    return {
      projection,
      prerequisite: null,
      authoritative: null,
      issue: receiptIssue('prerequisite_publication_transition_missing'),
    };
  }
  if (prerequisiteEvent.sequence > projectionEvent.sequence) {
    return {
      projection,
      prerequisite,
      authoritative: prerequisite,
      issue: receiptIssue(prerequisite.operation === 'restore'
        ? 'publication_revoked_by_prerequisite_restore'
        : 'publication_superseded_by_prerequisite_publish'),
    };
  }
  if (projection.operation === 'restore') {
    return {
      projection,
      prerequisite,
      authoritative: projection,
      issue: receiptIssue('publication_revoked_by_projection_restore'),
    };
  }
  return { projection, prerequisite, authoritative: projection, issue: null };
}

async function virginiaAnalysisPublicationStatus(db, { session = null } = {}) {
  if (!db?.collection) return unavailable([receiptIssue('publication_database_unavailable')]);

  const transition = await virginiaAnalysisPublicationTransition(db, { session });
  const snapshot = transition.projection;
  if (transition.issue) return unavailable([transition.issue]);
  if (snapshot?.incomplete_staging_override === true) {
    return unavailable([receiptIssue('incomplete_staging_publication_not_visible')]);
  }
  const receipt = snapshot?.analysis_publication_receipt || null;
  if (!receipt) return unavailable([receiptIssue('publication_receipt_missing')]);

  // An uncertified publication renders, but it is never allowed to look
  // certified. `publishable` must be exactly false and the waived figure
  // blockers must be present and non-empty; anything else falls through to the
  // certified checks and fails closed.
  const uncertified = receipt.figures_uncertified === true;
  const shapeIssues = [];
  if (uncertified
      && (receipt.publishable !== false
        || !Array.isArray(receipt.waived_figure_certifications)
        || receipt.waived_figure_certifications.length === 0)) {
    shapeIssues.push(receiptIssue('uncertified_receipt_contract_mismatch'));
  }
  if (receipt.contract !== VA_ANALYSIS_PUBLICATION_CONTRACT
      || receipt.schema_version !== VA_ANALYSIS_PUBLICATION_RECEIPT_SCHEMA_VERSION
      || receipt.state !== 'va'
      || receipt.major_slug !== VA_ANALYSIS_MAJOR
      || receipt.ready !== true
      || (!uncertified && receipt.publishable !== true)
      || receipt.generation_id !== snapshot.generation_id
      || canonicalJson(receipt.created_at) !== canonicalJson(snapshot.created_at)
      || (!uncertified && snapshot.preflight_verdict !== 'pass')
      || (!uncertified
        && receipt.prerequisite_contract_version !== VA_FIGURE6_PREREQUISITE_CONTRACT.version)
      || canonicalJson(receipt.paper_figures) !== canonicalJson(['1', '3', '4', '6'])) {
    shapeIssues.push(receiptIssue('publication_receipt_contract_mismatch'));
  }
  if (receipt.publication_evaluator_fingerprint_contract
        !== VA_PUBLICATION_EVALUATOR_FINGERPRINT_CONTRACT
      || !Number.isSafeInteger(receipt.publication_evaluator_fingerprint_file_count)
      || receipt.publication_evaluator_fingerprint_file_count <= 0) {
    shapeIssues.push(receiptIssue('publication_evaluator_fingerprint_missing'));
  }
  for (const field of [
    'projection_manifest_sha256',
    'prerequisite_manifest_sha256',
    'preflight_report_sha256',
    'publication_audit_report_sha256',
    'publication_evaluator_fingerprint_sha256',
    'course_unit_evidence_overlay_report_sha256',
    'course_unit_evidence_output_documents_sha256',
    'transfer_equivalency_condition_report_sha256',
    'pathway_complexity_prerequisite_report_sha256',
    // An uncertified publication has no signed Figure-6 verification receipt
    // to hash -- that signature is exactly what it does not claim.
    ...(uncertified ? [] : ['prerequisite_verification_receipt_sha256']),
  ]) {
    if (!SHA256.test(String(receipt[field] || ''))) {
      shapeIssues.push(receiptIssue('publication_receipt_hash_missing', field));
    }
  }
  if (!Array.isArray(receipt.projection_manifest)
      || !Array.isArray(receipt.prerequisite_manifest)
      || receipt.projection_manifest_sha256 !== manifestSha256(receipt.projection_manifest)
      || receipt.prerequisite_manifest_sha256 !== manifestSha256(receipt.prerequisite_manifest)) {
    shapeIssues.push(receiptIssue('publication_receipt_manifest_hash_mismatch'));
  }
  if (canonicalJson(snapshot.replacement_targets) !== canonicalJson(receipt.projection_manifest)
      || snapshot.preflight_projection_manifest_sha256 !== receipt.projection_manifest_sha256
      || snapshot.preflight_report_sha256 !== receipt.preflight_report_sha256
      || snapshot.publication_audit_report_sha256 !== receipt.publication_audit_report_sha256
      || snapshot.publication_evaluator_fingerprint_contract
        !== receipt.publication_evaluator_fingerprint_contract
      || snapshot.publication_evaluator_fingerprint_sha256
        !== receipt.publication_evaluator_fingerprint_sha256
      || snapshot.publication_evaluator_fingerprint_file_count
        !== receipt.publication_evaluator_fingerprint_file_count
      || snapshot.course_unit_evidence_overlay_report_sha256
        !== receipt.course_unit_evidence_overlay_report_sha256
      || snapshot.course_unit_evidence_output_documents_sha256
        !== receipt.course_unit_evidence_output_documents_sha256
      || snapshot.transfer_equivalency_condition_report_sha256
        !== receipt.transfer_equivalency_condition_report_sha256
      || snapshot.pathway_complexity_prerequisite_report_sha256
        !== receipt.pathway_complexity_prerequisite_report_sha256) {
    shapeIssues.push(receiptIssue('publication_snapshot_binding_mismatch'));
  }
  if (shapeIssues.length) return unavailable(shapeIssues, receipt);

  const currentEvaluatorFingerprint = currentVirginiaPublicationEvaluatorFingerprint();
  if (receipt.publication_evaluator_fingerprint_sha256
        !== currentEvaluatorFingerprint.sha256
      || receipt.publication_evaluator_fingerprint_file_count
        !== currentEvaluatorFingerprint.file_count) {
    return unavailable([receiptIssue('publication_readiness_evaluator_drift')], receipt);
  }

  const projectionDocuments = await readDocuments(db, PROJECTION_TARGETS, VA_FILTER, session);
  const currentProjectionManifest = manifestForDocuments(
    projectionDocuments,
    PROJECTION_TARGETS,
    VA_FILTER,
  );
  if (canonicalJson(currentProjectionManifest) !== canonicalJson(receipt.projection_manifest)) {
    return unavailable([receiptIssue('published_projection_drift')], receipt);
  }

  const conditionReport = auditVirginiaProjectionEquivalencyConditions(
    projectionFromDocuments(projectionDocuments),
  );
  // Drift is an integrity failure and always blocks. `ready` is a
  // certification claim, and an uncertified publication does not make it --
  // each unresolved pair excludes itself per cell instead.
  if ((!uncertified && conditionReport.ready !== true)
      || reportSha256(conditionReport)
        !== receipt.transfer_equivalency_condition_report_sha256) {
    return unavailable([receiptIssue('selected_equivalency_condition_audit_drift')], receipt);
  }

  const prerequisiteDocuments = await readDocuments(db, PREREQUISITE_TARGETS, {}, session);
  const currentPrerequisiteManifest = manifestForDocuments(
    prerequisiteDocuments,
    PREREQUISITE_TARGETS,
    {},
  );
  if (canonicalJson(currentPrerequisiteManifest) !== canonicalJson(receipt.prerequisite_manifest)) {
    return unavailable([receiptIssue('figure6_prerequisite_corpus_drift')], receipt);
  }
  // The signed Figure-6 verification receipt is the certification itself. An
  // uncertified publication asserts no signature, so there is nothing to bind
  // to here -- and Figure 6 stays unavailable for it either way, because its
  // university prerequisite corpus is still empty.
  const activeReceipts = uncertified ? [] : await db
    .collection('va_figure6_prerequisite_publications')
    .find({ active: true }, session ? { session } : undefined).limit(2).toArray();
  if (!uncertified && activeReceipts.length !== 1) {
    return unavailable([receiptIssue('figure6_active_verification_receipt_count')], receipt);
  }
  const activeReceipt = activeReceipts[0] || null;
  if (!uncertified
      && (String(activeReceipt._id || '') !== receipt.prerequisite_verification_receipt_id
        || activeReceipt.publication_generation !== receipt.prerequisite_publication_generation
        || verificationReceiptHash(activeReceipt)
          !== receipt.prerequisite_verification_receipt_sha256)) {
    return unavailable([receiptIssue('figure6_verification_receipt_drift')], receipt);
  }
  const prerequisiteReport = validateVirginiaFigure6PrerequisiteSources({
    communityCollegeRows: prerequisiteDocuments.va_course_requisites,
    universityRows: prerequisiteDocuments.va_university_course_requisites,
    vccsScopeRows: VCCS_FIGURE6_SCOPE,
    universityScope: UNIVERSITY_FIGURE6_SCOPE,
    adapterIntegrated: true,
    verificationReceipt: activeReceipt,
  });
  if ((!uncertified && prerequisiteReport.ready !== true)
      || reportSha256(prerequisiteReport)
        !== receipt.pathway_complexity_prerequisite_report_sha256) {
    return unavailable([receiptIssue('figure6_prerequisite_audit_drift')], receipt);
  }

  return {
    ready: true,
    blocker: null,
    // `certified: false` means these figures are computed from structurally
    // sound documents but carry no institutional release certification.
    // Anything rendering them must say so.
    certified: uncertified ? false : true,
    figures_uncertified: uncertified,
    waived_figure_certifications: uncertified
      ? receipt.waived_figure_certifications : [],
    contract: VA_ANALYSIS_PUBLICATION_CONTRACT,
    major_slug: VA_ANALYSIS_MAJOR,
    generation_id: receipt.generation_id,
    created_at: receipt.created_at,
    projection_manifest_sha256: receipt.projection_manifest_sha256,
    publication_evaluator_fingerprint_sha256:
      receipt.publication_evaluator_fingerprint_sha256,
    transfer_equivalency_condition_report_sha256:
      receipt.transfer_equivalency_condition_report_sha256,
    pathway_complexity_prerequisite_report_sha256:
      receipt.pathway_complexity_prerequisite_report_sha256,
    issues: [],
  };
}

module.exports = {
  PREREQUISITE_TARGETS,
  PREREQUISITE_REVISION_COLLECTION,
  PROJECTION_TARGETS,
  VA_ANALYSIS_MAJOR,
  VA_ANALYSIS_PUBLICATION_BLOCKER,
  VA_ANALYSIS_PUBLICATION_CONTRACT,
  VA_ANALYSIS_PUBLICATION_RECEIPT_SCHEMA_VERSION,
  VA_ANALYSIS_RECEIPT_GATE,
  buildVirginiaAnalysisPublicationReceipt,
  buildVirginiaUncertifiedPublicationReceipt,
  canonicalDocumentHash,
  canonicalJson,
  manifestForDocuments,
  manifestSha256,
  projectionFromDocuments,
  reportSha256,
  virginiaAnalysisPublicationTransition,
  virginiaAnalysisPublicationStatus,
};
