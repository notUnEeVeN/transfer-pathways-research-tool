const crypto = require('node:crypto');
const {
  importMaterialHash,
  verificationForSourceBundle,
  verifiedImportConflict,
} = require('../../scripts/importVirginiaCatalogDegrees');
const {
  majorCoreHash,
  majorCoreMaterial,
  verifiedCoreConflict,
} = require('./majorCoreIntegrity');
const {
  bachelorRequirementCapacityEvidenceProof,
} = require('./bachelorRequirementCapacityEvidence');
const {
  associateConstraintMetadataEvidenceProof,
} = require('./associateConstraintMetadataEvidence');

const ARTIFACT = 'virginia_degree_publication_verification_review';
const REVIEW_STATES = Object.freeze([
  'carried_exact_bundle_verification',
  'validated_course_unit_evidence_overlay',
  'validated_requirement_capacity_evidence_projection',
  'validated_associate_constraint_metadata_noop',
  'human_verification_required',
  'source_changed_reverification_required',
  'verified_core_reconciliation_required',
  'verified_material_reconciliation_required',
]);
const RESOLVED_REVIEW_STATES = new Set([
  'carried_exact_bundle_verification',
  'validated_course_unit_evidence_overlay',
  'validated_requirement_capacity_evidence_projection',
  'validated_associate_constraint_metadata_noop',
]);

// Keep this list deliberately local and prove it against importMaterialHash in
// every generated row. If the import guard's material boundary ever changes,
// report validation fails instead of silently misclassifying a path.
const IMPORT_OPERATIONAL_FIELDS = new Set([
  'acceptance',
  'collection_status',
  'curated_at',
  'curated_by',
  'research_status',
  'updated_at',
  'verification',
]);

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function sha256(value) {
  return crypto.createHash('sha256').update(
    typeof value === 'string' || Buffer.isBuffer(value)
      ? value : JSON.stringify(stable(value)),
  ).digest('hex');
}

function sourceManifest(doc) {
  return (Array.isArray(doc?.sources) ? doc.sources : []).map((source) => ({
    id: source?.id || null,
    kind: source?.kind || null,
    url: source?.url || null,
    final_url: source?.final_url || null,
    content_sha256: source?.content_sha256
      || source?.sha256 || source?.response_sha256 || null,
    catalog_year: source?.catalog_year || doc?.catalog_year || null,
  })).sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function importMaterialForReceipt(doc = {}) {
  return stable(Object.fromEntries(Object.entries(doc || {}).filter(([key]) => (
    !IMPORT_OPERATIONAL_FIELDS.has(key)
  ))));
}

function semanticDiff(before, after, path = '') {
  if (JSON.stringify(stable(before)) === JSON.stringify(stable(after))) return [];
  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  if (!beforeObject || !afterObject || Array.isArray(before) !== Array.isArray(after)) {
    return [{ path: path || '<root>', before: before ?? null, after: after ?? null }];
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const rows = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      rows.push(...semanticDiff(before[index], after[index], `${path}[${index}]`));
    }
    return rows;
  }
  const rows = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    rows.push(...semanticDiff(before[key], after[key], path ? `${path}.${key}` : key));
  }
  return rows;
}

function normalizedPath(path) {
  const indexed = String(path || '<root>').replace(/\[\d+\]/g, '[]');
  if (/^course_titles\./.test(indexed)) return 'course_titles.*';
  return indexed;
}

function pathCategory(path) {
  const value = String(path || '');
  if (/^course_unit_evidence(?:\.|\[|$)/.test(value)) return 'course_unit_evidence';
  if (/^(?:codes_seen|course_titles)(?:\.|\[|$)/.test(value)) return 'derived_display_cache';
  if (/(?:^|\.)analysis_constraints(?:\.|\[|$)/.test(value)) return 'analysis_constraint';
  if (/(?:^|\.)(?:total_units(?:_max)?|unit_advisement(?:_max)?|section_advisement(?:_max)?)(?:\.|\[|$)/
    .test(value)) return 'unit_requirement';
  if (/^option_sets(?:\.|\[|$)/.test(value)) return 'approved_course_pool';
  if (/^requirement_variants(?:\.|\[|$)/.test(value)) return 'requirement_variant';
  if (/^requirement_groups(?:\.|\[|$)/.test(value)) {
    if (/(?:receivers|options|course_keys|course_ids|code_seen)(?:\.|\[|$)/.test(value)) {
      return 'course_or_choice';
    }
    if (/(?:^|\.)(?:title|label_seen)(?:\.|\[|$)/.test(value)) return 'requirement_label';
    return 'requirement_structure';
  }
  if (/^(?:kind|institution_id|community_college_id|college_id|program|degree_title_seen|degree_type|degree_variant|academic_unit|college|catalog_year|unit_system|course_namespace)(?:\.|\[|$)/
    .test(value)) return 'degree_identity';
  return 'other_material';
}

function changeKind(diff) {
  if (diff?.before == null && diff?.after != null) return 'added';
  if (diff?.before != null && diff?.after == null) return 'removed';
  return 'changed';
}

/** Collapse index-heavy semantic diffs into deterministic release receipts. */
function concisePathReceipts(diffs = []) {
  const grouped = new Map();
  for (const diff of diffs) {
    const category = pathCategory(diff?.path);
    const pathPattern = normalizedPath(diff?.path);
    const change = changeKind(diff);
    const key = `${category}\u0000${pathPattern}\u0000${change}`;
    const current = grouped.get(key) || {
      category,
      path_pattern: pathPattern,
      change,
      leaf_diff_count: 0,
    };
    current.leaf_diff_count += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((left, right) => (
    left.category.localeCompare(right.category)
      || left.path_pattern.localeCompare(right.path_pattern)
      || left.change.localeCompare(right.change)
  ));
}

function indexedOverlay(courseUnitEvidenceOverlay) {
  const receipts = new Map((courseUnitEvidenceOverlay?.receipts || []).map((row) => (
    [row?.document_id, row]
  )));
  const documents = new Map((courseUnitEvidenceOverlay?.documents || []).map((row) => (
    [row?._id, row]
  )));
  return { receipts, documents };
}

function evidenceRowsAreStrictlyAdditive(prior, output) {
  const before = Array.isArray(prior?.course_unit_evidence)
    ? prior.course_unit_evidence : [];
  const after = Array.isArray(output?.course_unit_evidence)
    ? output.course_unit_evidence : [];
  if (after.length <= before.length) return false;
  const remaining = new Map();
  for (const row of after) {
    const digest = sha256(row);
    remaining.set(digest, (remaining.get(digest) || 0) + 1);
  }
  for (const row of before) {
    const digest = sha256(row);
    const count = remaining.get(digest) || 0;
    if (count === 0) return false;
    remaining.set(digest, count - 1);
  }
  return true;
}

function evidenceOverlayProof(prior, candidate, courseUnitEvidenceOverlay, overlayIndex = null) {
  const id = candidate?._id || null;
  const index = overlayIndex || indexedOverlay(courseUnitEvidenceOverlay);
  const receipt = index.receipts.get(id) || null;
  const output = index.documents.get(id) || null;
  const candidateEvidenceSha256 = sha256(candidate?.course_unit_evidence ?? null);
  const outputEvidenceSha256 = sha256(output?.course_unit_evidence ?? null);
  const evidenceOnlyOutput = prior == null ? null : structuredClone(prior);
  if (evidenceOnlyOutput && output && Object.prototype.hasOwnProperty.call(
    output,
    'course_unit_evidence',
  )) {
    evidenceOnlyOutput.course_unit_evidence = structuredClone(output.course_unit_evidence);
  }
  const {
    documents: overlayDocuments = [],
    report_sha256: overlayReportSha256 = null,
    ...overlayReportPayload
  } = courseUnitEvidenceOverlay || {};
  const {
    receipt_sha256: receiptSha256 = null,
    ...receiptPayload
  } = receipt || {};
  const checks = {
    global_overlay_ready: courseUnitEvidenceOverlay?.ready === true
      && Number(courseUnitEvidenceOverlay?.counts?.conflicts) === 0
      && (courseUnitEvidenceOverlay?.conflicts || []).length === 0,
    overlay_report_bound: overlayReportSha256 === sha256(overlayReportPayload),
    overlay_output_cohort_bound:
      courseUnitEvidenceOverlay?.output_documents_sha256 === sha256(overlayDocuments),
    document_receipt_applied: receipt?.status === 'applied'
      && receipt?.overlay_applied === true
      && Number(receipt?.conflict_count) === 0,
    document_receipt_bound: receiptSha256 === sha256(receiptPayload),
    current_document_bound: receipt?.current_document_sha256 === sha256(prior),
    output_document_bound: receipt?.output_document_sha256 === sha256(output),
    output_is_current_plus_evidence_only: output != null
      && sha256(output) === sha256(evidenceOnlyOutput),
    exact_candidate_evidence: receipt?.candidate_evidence_sha256 === candidateEvidenceSha256
      && receipt?.output_evidence_sha256 === outputEvidenceSha256
      && candidateEvidenceSha256 === outputEvidenceSha256,
    evidence_rows_strictly_additive: evidenceRowsAreStrictlyAdditive(prior, output),
    protected_core_unchanged: receipt?.candidate_core_matches_current === true
      && receipt?.output_major_core_unchanged === true
      && majorCoreHash(prior || {}) === majorCoreHash(output || {}),
    candidate_material_exactly_reproduced: output != null
      && importMaterialHash(output) === importMaterialHash(candidate),
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name)
    .sort();
  return {
    safe: failedChecks.length === 0,
    mode: 'operational_course_unit_evidence_only',
    document_id: id,
    receipt_sha256: receipt?.receipt_sha256 || null,
    overlay_report_sha256: courseUnitEvidenceOverlay?.report_sha256 || null,
    candidate_evidence_sha256: candidateEvidenceSha256,
    output_evidence_sha256: outputEvidenceSha256,
    applied_evidence_rows: receipt?.applied_evidence_rows || 0,
    applied_codes: [...(receipt?.applied_codes || [])].sort(),
    checks,
    failed_checks: failedChecks,
    signature_carried_to_raw_candidate: false,
  };
}

function reviewClassification(prior, candidate, {
  courseUnitEvidenceOverlay = null,
  overlayIndex = null,
} = {}) {
  const nextHash = candidate?.provenance?.source_bundle_hash || null;
  const priorHash = prior?.provenance?.source_bundle_hash || null;
  const priorVerified = prior?.verification?.verified === true;
  const coreConflict = verifiedCoreConflict(prior, candidate);
  const importConflict = verifiedImportConflict(prior, candidate);
  const carried = verificationForSourceBundle(prior, nextHash);
  let overlayProof = null;
  let requirementCapacityProof = null;
  let associateConstraintMetadataProof = null;

  if (importConflict && !coreConflict && courseUnitEvidenceOverlay) {
    overlayProof = evidenceOverlayProof(
      prior,
      candidate,
      courseUnitEvidenceOverlay,
      overlayIndex,
    );
  }
  if (coreConflict && courseUnitEvidenceOverlay?.requirement_capacity_evidence) {
    requirementCapacityProof = bachelorRequirementCapacityEvidenceProof(
      prior,
      candidate,
      courseUnitEvidenceOverlay.requirement_capacity_evidence,
    );
  }
  if (coreConflict && courseUnitEvidenceOverlay?.associate_constraint_metadata_evidence) {
    associateConstraintMetadataProof = associateConstraintMetadataEvidenceProof(
      prior,
      candidate,
      courseUnitEvidenceOverlay.associate_constraint_metadata_evidence,
    );
  }

  let state;
  if (coreConflict && associateConstraintMetadataProof?.safe === true) {
    state = 'validated_associate_constraint_metadata_noop';
  } else if (coreConflict && requirementCapacityProof?.safe === true) {
    state = 'validated_requirement_capacity_evidence_projection';
  } else if (coreConflict) state = 'verified_core_reconciliation_required';
  else if (overlayProof?.safe === true) state = 'validated_course_unit_evidence_overlay';
  else if (importConflict) state = 'verified_material_reconciliation_required';
  else if (priorVerified && priorHash !== nextHash) {
    state = 'source_changed_reverification_required';
  } else if (carried.verification?.verified === true && carried.source_changed !== true) {
    state = 'carried_exact_bundle_verification';
  } else state = 'human_verification_required';

  return {
    state,
    coreConflict,
    importConflict,
    overlayProof,
    requirementCapacityProof,
    associateConstraintMetadataProof,
  };
}

function reviewState(prior, candidate, options = {}) {
  return reviewClassification(prior, candidate, options).state;
}

function reviewChecklist(state) {
  const rows = [
    'Open every official source URL and confirm the retained catalog edition and institution.',
    'Trace every requirement group, choice, course, unit, overlap, and policy fact to its source reference.',
    'Confirm the canonical unit path and published degree minimum without filling an unexplained source gap.',
    'Sign only the exact source_bundle_hash through the existing authenticated Virginia review workflow.',
  ];
  if (state === 'verified_core_reconciliation_required') {
    rows.unshift('Reconcile the protected curricular-tree difference before replacing the verified record.');
  } else if (state === 'verified_material_reconciliation_required') {
    rows.unshift('Reconcile the same-source material difference before replacing the verified record.');
  } else if (state === 'source_changed_reverification_required') {
    rows.unshift('Review the changed official source bundle; the prior signature cannot carry forward.');
  } else if (state === 'validated_course_unit_evidence_overlay') {
    return [
      'Use only the bound operational course-unit evidence overlay; do not import or sign the raw candidate wrapper.',
      'Retain the verified requirement tree and its existing verification receipt unchanged.',
    ];
  } else if (state === 'validated_requirement_capacity_evidence_projection') {
    return [
      'Use only the exact source-bound requirement-capacity projection receipt; do not import or sign the raw candidate wrapper.',
      'Retain the verified requirement tree and its existing verification receipt unchanged.',
    ];
  } else if (state === 'validated_associate_constraint_metadata_noop') {
    return [
      'Use the stored option-set-backed evaluator path; do not import or sign the raw candidate wrapper.',
      'Retain the verified requirement tree and its existing verification receipt unchanged; no projection mutation is required.',
    ];
  }
  return rows;
}

function buildPublicationVerificationReview({
  candidateDocuments = [],
  storedDocuments = [],
  courseUnitEvidenceOverlay = null,
  snapshotDate = null,
} = {}) {
  const stored = new Map(storedDocuments.map((doc) => [doc?._id, doc]));
  const overlayIndex = indexedOverlay(courseUnitEvidenceOverlay);
  const rows = [...candidateDocuments].sort((left, right) => (
    String(left?._id).localeCompare(String(right?._id))
  )).map((candidate) => {
    const prior = stored.get(candidate?._id) || null;
    const classification = reviewClassification(prior, candidate, {
      courseUnitEvidenceOverlay,
      overlayIndex,
    });
    const state = classification.state;
    const sourceBundleHash = candidate?.provenance?.source_bundle_hash || null;
    const coreDiff = prior && classification.coreConflict
      ? semanticDiff(majorCoreMaterial(prior), majorCoreMaterial(candidate)) : [];
    const materialDiff = prior && classification.importConflict
      ? semanticDiff(importMaterialForReceipt(prior), importMaterialForReceipt(candidate)) : [];
    const corePathReceipts = concisePathReceipts(coreDiff);
    const materialPathReceipts = concisePathReceipts(materialDiff);
    const conflictCategory = classification.associateConstraintMetadataProof?.safe === true
      ? 'validated_associate_constraint_metadata_noop_only'
      : classification.requirementCapacityProof?.safe === true
        ? 'validated_requirement_capacity_evidence_projection_only'
      : classification.coreConflict
        ? 'verified_protected_core_change'
      : classification.overlayProof?.safe === true
        ? 'validated_course_unit_evidence_only'
        : classification.importConflict
          ? 'verified_other_material_change'
          : state === 'source_changed_reverification_required'
            ? 'source_bundle_changed'
            : null;
    return {
      id: candidate?._id || null,
      kind: candidate?.kind || null,
      institution_id: candidate?.institution_id
        || candidate?.community_college_id || candidate?.college_id || null,
      catalog_year: candidate?.catalog_year || null,
      review_state: state,
      source_bundle_hash: sourceBundleHash,
      protected_core_sha256: majorCoreHash(candidate || {}),
      previous: prior ? {
        source_bundle_hash: prior?.provenance?.source_bundle_hash || null,
        protected_core_sha256: majorCoreHash(prior),
        verified: prior?.verification?.verified === true,
        stale: prior?.verification?.stale === true,
        verified_at: prior?.verification?.verified_at || null,
      } : null,
      acceptance: {
        catalog_accepted: candidate?.acceptance?.accepted === true,
        analysis_ready: candidate?.acceptance?.ready_for_analysis === true,
      },
      protected_core_diff_count: coreDiff.length,
      protected_core_diff: coreDiff,
      conflict_receipt: {
        category: conflictCategory,
        unresolved: !RESOLVED_REVIEW_STATES.has(state),
        raw_verified_core_conflict: classification.coreConflict,
        raw_verified_import_conflict: classification.importConflict,
        raw_candidate_import_blocked:
          classification.importConflict || classification.coreConflict,
        material_diff_count: materialDiff.length,
        material_path_receipts: materialPathReceipts,
        protected_core_diff_count: coreDiff.length,
        protected_core_path_receipts: corePathReceipts,
        stored_material_sha256: prior ? importMaterialHash(prior) : null,
        candidate_material_sha256: importMaterialHash(candidate || {}),
        stored_receipt_material_sha256: prior
          ? sha256(importMaterialForReceipt(prior)) : null,
        candidate_receipt_material_sha256: sha256(importMaterialForReceipt(candidate || {})),
        course_unit_evidence_overlay: classification.overlayProof,
        requirement_capacity_evidence_projection:
          classification.requirementCapacityProof,
        associate_constraint_metadata_noop:
          classification.associateConstraintMetadataProof,
      },
      sources: sourceManifest(candidate),
      review_checklist: reviewChecklist(state),
    };
  });
  const counts = Object.fromEntries(REVIEW_STATES.map((state) => [
    state, rows.filter((row) => row.review_state === state).length,
  ]));
  const unsigned = rows.filter((row) => !RESOLVED_REVIEW_STATES.has(row.review_state));
  const rawCoreConflicts = rows.filter((row) => (
    row.conflict_receipt.raw_verified_core_conflict
  ));
  const rawOtherMaterialConflicts = rows.filter((row) => (
    row.conflict_receipt.raw_verified_import_conflict
      && !row.conflict_receipt.raw_verified_core_conflict
  ));
  const unresolvedCoreConflicts = rows.filter((row) => (
    row.review_state === 'verified_core_reconciliation_required'
  ));
  const unresolvedOtherMaterialConflicts = rows.filter((row) => (
    row.review_state === 'verified_material_reconciliation_required'
  ));
  const validatedEvidenceRows = rows
    .filter((row) => row.review_state === 'validated_course_unit_evidence_overlay')
    .reduce((sum, row) => (
      sum + Number(row.conflict_receipt.course_unit_evidence_overlay?.applied_evidence_rows || 0)
    ), 0);
  const validatedCapacityRows = rows.filter((row) => (
    row.review_state === 'validated_requirement_capacity_evidence_projection'
  )).length;
  const validatedMetadataNoopRows = rows.filter((row) => (
    row.review_state === 'validated_associate_constraint_metadata_noop'
  )).length;
  const content = {
    schema_version: 1,
    artifact: ARTIFACT,
    snapshot_date: snapshotDate,
    authority: 'read_only_candidate_source_plan_and_stored_verification_receipts',
    publication_ready: unsigned.length === 0,
    summary: {
      candidate_documents: rows.length,
      carried_verifications: counts.carried_exact_bundle_verification,
      validated_course_unit_evidence_overlays:
        counts.validated_course_unit_evidence_overlay,
      validated_course_unit_evidence_rows: validatedEvidenceRows,
      validated_requirement_capacity_evidence_projections:
        counts.validated_requirement_capacity_evidence_projection,
      validated_requirement_capacity_evidence_rows: validatedCapacityRows,
      validated_associate_constraint_metadata_noops: validatedMetadataNoopRows,
      review_items: unsigned.length,
      raw_verified_core_conflicts: rawCoreConflicts.length,
      raw_verified_other_material_conflicts: rawOtherMaterialConflicts.length,
      unresolved_verified_core_conflicts: unresolvedCoreConflicts.length,
      unresolved_verified_other_material_conflicts: unresolvedOtherMaterialConflicts.length,
      ...counts,
    },
    evidence_boundary: [
      'This report never creates or modifies a human verification receipt.',
      'A prior signature carries only when the exact source-bundle hash matches and no protected or material replacement conflict exists.',
      'Protected curriculum differences are identified with the same major-core guard used by the importer.',
      'A validated course-unit evidence overlay retains the stored verified document and copies only exact source-bound evidence; it never carries a signature to the raw candidate wrapper.',
      'A validated requirement-capacity receipt is projection-only: it retains the stored verified source tree, keeps the raw candidate import blocked, and never creates or carries a human verification receipt.',
      'A validated associate-constraint metadata no-op proves the stored source option set already supplies identical evaluator semantics; it retains the stored tree, performs no projection mutation, and keeps the raw candidate blocked.',
      'Analysis readiness is diagnostic and never substitutes for source verification.',
    ],
    review_items: unsigned,
    all_documents: rows,
  };
  return { ...content, report_sha256: sha256(content) };
}

function validatePublicationVerificationReview(report) {
  const issues = [];
  if (report?.schema_version !== 1) issues.push('schema_version');
  if (report?.artifact !== ARTIFACT) issues.push('artifact');
  const rows = Array.isArray(report?.all_documents) ? report.all_documents : [];
  const ids = new Set();
  for (const row of rows) {
    if (!row?.id || ids.has(row.id)) issues.push(`${row?.id || '<missing>'}:duplicate_or_missing_id`);
    ids.add(row?.id);
    if (!REVIEW_STATES.includes(row?.review_state)) issues.push(`${row?.id}:review_state`);
    if (!/^[a-f0-9]{64}$/.test(row?.source_bundle_hash || '')) issues.push(`${row?.id}:source_bundle_hash`);
    if (!/^[a-f0-9]{64}$/.test(row?.protected_core_sha256 || '')) issues.push(`${row?.id}:core_hash`);
    const receipt = row?.conflict_receipt;
    if (!receipt || typeof receipt !== 'object') {
      issues.push(`${row?.id}:conflict_receipt`);
      continue;
    }
    if (receipt.stored_material_sha256 !== receipt.stored_receipt_material_sha256) {
      issues.push(`${row?.id}:stored_material_boundary`);
    }
    if (receipt.candidate_material_sha256 !== receipt.candidate_receipt_material_sha256) {
      issues.push(`${row?.id}:candidate_material_boundary`);
    }
    if (row.review_state === 'validated_course_unit_evidence_overlay') {
      const proof = receipt.course_unit_evidence_overlay;
      if (proof?.safe !== true || proof?.signature_carried_to_raw_candidate !== false
          || receipt.raw_verified_import_conflict !== true
          || receipt.raw_verified_core_conflict !== false
          || receipt.category !== 'validated_course_unit_evidence_only') {
        issues.push(`${row?.id}:course_unit_evidence_overlay_proof`);
      }
    }
    if (row.review_state === 'validated_requirement_capacity_evidence_projection') {
      const proof = receipt.requirement_capacity_evidence_projection;
      if (proof?.safe !== true
          || proof?.signature_carried_to_raw_candidate !== false
          || proof?.human_verification_created !== false
          || proof?.raw_candidate_import_blocked !== true
          || receipt.raw_verified_core_conflict !== true
          || receipt.raw_candidate_import_blocked !== true
          || receipt.category
            !== 'validated_requirement_capacity_evidence_projection_only') {
        issues.push(`${row?.id}:requirement_capacity_evidence_projection_proof`);
      }
    }
    if (row.review_state === 'validated_associate_constraint_metadata_noop') {
      const proof = receipt.associate_constraint_metadata_noop;
      if (proof?.safe !== true
          || proof?.signature_carried_to_raw_candidate !== false
          || proof?.human_verification_created !== false
          || proof?.raw_candidate_import_blocked !== true
          || proof?.stored_source_tree_unchanged !== true
          || proof?.projection_mutation_required !== false
          || receipt.raw_verified_core_conflict !== true
          || receipt.raw_candidate_import_blocked !== true
          || receipt.category !== 'validated_associate_constraint_metadata_noop_only') {
        issues.push(`${row?.id}:associate_constraint_metadata_noop_proof`);
      }
    }
  }
  if (report?.summary?.candidate_documents !== rows.length) issues.push('summary_candidates');
  const reviewItems = rows.filter((row) => !RESOLVED_REVIEW_STATES.has(row.review_state));
  if (report?.summary?.review_items !== reviewItems.length) issues.push('summary_review_items');
  const expectedSummary = {
    raw_verified_core_conflicts: rows.filter((row) => (
      row?.conflict_receipt?.raw_verified_core_conflict === true
    )).length,
    raw_verified_other_material_conflicts: rows.filter((row) => (
      row?.conflict_receipt?.raw_verified_import_conflict === true
        && row?.conflict_receipt?.raw_verified_core_conflict !== true
    )).length,
    unresolved_verified_core_conflicts: rows.filter((row) => (
      row?.review_state === 'verified_core_reconciliation_required'
    )).length,
    unresolved_verified_other_material_conflicts: rows.filter((row) => (
      row?.review_state === 'verified_material_reconciliation_required'
    )).length,
    validated_course_unit_evidence_overlays: rows.filter((row) => (
      row?.review_state === 'validated_course_unit_evidence_overlay'
    )).length,
    validated_course_unit_evidence_rows: rows
      .filter((row) => row?.review_state === 'validated_course_unit_evidence_overlay')
      .reduce((sum, row) => (
        sum + Number(row?.conflict_receipt?.course_unit_evidence_overlay
          ?.applied_evidence_rows || 0)
      ), 0),
    validated_requirement_capacity_evidence_projections: rows.filter((row) => (
      row?.review_state === 'validated_requirement_capacity_evidence_projection'
    )).length,
    validated_requirement_capacity_evidence_rows: rows.filter((row) => (
      row?.review_state === 'validated_requirement_capacity_evidence_projection'
    )).length,
    validated_associate_constraint_metadata_noops: rows.filter((row) => (
      row?.review_state === 'validated_associate_constraint_metadata_noop'
    )).length,
  };
  for (const [field, expected] of Object.entries(expectedSummary)) {
    if (report?.summary?.[field] !== expected) issues.push(`summary_${field}`);
  }
  if (JSON.stringify(report?.review_items || []) !== JSON.stringify(reviewItems)) issues.push('review_items');
  const { report_sha256: actualHash, ...content } = report || {};
  if (actualHash !== sha256(content)) issues.push('report_sha256');
  return { valid: issues.length === 0, issues };
}

/** Compact conflict accounting embedded in the read-only candidate preflight. */
function sourcePlanFromVerificationReview(report) {
  const rows = Array.isArray(report?.all_documents) ? report.all_documents : [];
  const idsForState = (state) => rows
    .filter((row) => row?.review_state === state)
    .map((row) => row.id);
  const rawCore = rows.filter((row) => (
    row?.conflict_receipt?.raw_verified_core_conflict === true
  ));
  const rawOtherMaterial = rows.filter((row) => (
    row?.conflict_receipt?.raw_verified_import_conflict === true
      && row?.conflict_receipt?.raw_verified_core_conflict !== true
  ));
  const compactReceipt = (row) => {
    const receipt = row.conflict_receipt;
    const overlay = receipt.course_unit_evidence_overlay;
    const capacity = receipt.requirement_capacity_evidence_projection;
    const metadataNoop = receipt.associate_constraint_metadata_noop;
    return {
      id: row.id,
      category: receipt.category,
      unresolved: receipt.unresolved,
      raw_candidate_import_blocked: receipt.raw_candidate_import_blocked,
      material_diff_count: receipt.material_diff_count,
      material_path_receipts: receipt.material_path_receipts,
      protected_core_diff_count: receipt.protected_core_diff_count,
      protected_core_path_receipts: receipt.protected_core_path_receipts,
      ...(overlay ? {
        course_unit_evidence_overlay: {
          safe: overlay.safe,
          applied_evidence_rows: overlay.applied_evidence_rows,
          receipt_sha256: overlay.receipt_sha256,
          overlay_report_sha256: overlay.overlay_report_sha256,
          signature_carried_to_raw_candidate: overlay.signature_carried_to_raw_candidate,
        },
      } : {}),
      ...(capacity ? {
        requirement_capacity_evidence_projection: {
          safe: capacity.safe,
          contract: capacity.contract,
          protected_core_path: capacity.protected_core_path,
          stored_value: capacity.stored_value,
          projected_value: capacity.projected_value,
          evidence_sha256: capacity.evidence_sha256,
          receipt_sha256: capacity.receipt_sha256,
          overlay_report_sha256: capacity.overlay_report_sha256,
          raw_candidate_import_blocked: capacity.raw_candidate_import_blocked,
          signature_carried_to_raw_candidate:
            capacity.signature_carried_to_raw_candidate,
          human_verification_created: capacity.human_verification_created,
        },
      } : {}),
      ...(metadataNoop ? {
        associate_constraint_metadata_noop: {
          safe: metadataNoop.safe,
          contract: metadataNoop.contract,
          protected_core_paths: metadataNoop.protected_core_paths,
          current_major_core_sha256: metadataNoop.current_major_core_sha256,
          candidate_major_core_sha256: metadataNoop.candidate_major_core_sha256,
          source_manifest_sha256: metadataNoop.source_manifest_sha256,
          source_option_set_sha256: metadataNoop.source_option_set_sha256,
          execution_semantics_sha256: metadataNoop.execution_semantics_sha256,
          evidence_sha256: metadataNoop.evidence_sha256,
          receipt_sha256: metadataNoop.receipt_sha256,
          overlay_report_sha256: metadataNoop.overlay_report_sha256,
          raw_candidate_import_blocked: metadataNoop.raw_candidate_import_blocked,
          stored_source_tree_unchanged: metadataNoop.stored_source_tree_unchanged,
          signature_carried_to_raw_candidate:
            metadataNoop.signature_carried_to_raw_candidate,
          human_verification_created: metadataNoop.human_verification_created,
          projection_mutation_required: metadataNoop.projection_mutation_required,
        },
      } : {}),
    };
  };
  return {
    carried_verifications: idsForState('carried_exact_bundle_verification').length,
    changed_source_bundles: idsForState('source_changed_reverification_required').length,
    human_verification_required: idsForState('human_verification_required').length,
    raw_verified_core_conflicts: rawCore.map((row) => row.id),
    raw_verified_material_conflicts: rawOtherMaterial.map((row) => row.id),
    validated_course_unit_evidence_overlays:
      idsForState('validated_course_unit_evidence_overlay'),
    validated_course_unit_evidence_rows: rows
      .filter((row) => row?.review_state === 'validated_course_unit_evidence_overlay')
      .reduce((sum, row) => (
        sum + Number(row?.conflict_receipt?.course_unit_evidence_overlay
          ?.applied_evidence_rows || 0)
      ), 0),
    validated_requirement_capacity_evidence_projections:
      idsForState('validated_requirement_capacity_evidence_projection'),
    validated_requirement_capacity_evidence_rows: rows.filter((row) => (
      row?.review_state === 'validated_requirement_capacity_evidence_projection'
    )).length,
    validated_associate_constraint_metadata_noops:
      idsForState('validated_associate_constraint_metadata_noop'),
    verified_core_conflicts: idsForState('verified_core_reconciliation_required'),
    verified_material_conflicts: idsForState('verified_material_reconciliation_required'),
    conflict_receipts: [...rawCore, ...rawOtherMaterial]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(compactReceipt),
    verification_review_report_sha256: report?.report_sha256 || null,
  };
}

module.exports = {
  ARTIFACT,
  REVIEW_STATES,
  buildPublicationVerificationReview,
  concisePathReceipts,
  evidenceOverlayProof,
  importMaterialForReceipt,
  pathCategory,
  reviewClassification,
  reviewState,
  semanticDiff,
  sha256,
  sourcePlanFromVerificationReview,
  validatePublicationVerificationReview,
};
