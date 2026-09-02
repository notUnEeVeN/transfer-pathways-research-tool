const { createHash } = require('node:crypto');
const {
  auditAssociateDocument,
} = require('../analysis/associateFigureConstraints');
const {
  canonicalCourseCode,
  categoryForCourse,
  distinctCategoryMinimum,
  resolveAssociateConstraint,
} = require('../analysis/transferCreditConstraints');
const {
  majorCoreHash,
  majorCoreMaterial,
} = require('./majorCoreIntegrity');

const SCHEMA_VERSION = 1;
const ARTIFACT = 'virginia_associate_constraint_metadata_noop_evidence';

const CONTRACTS = Object.freeze({
  'va:as:central-virginia-community-college:cs': Object.freeze({
    document_id: 'va:as:central-virginia-community-college:cs',
    institution_id: 'va:cc:central-virginia-community-college',
    contract: 'central_virginia_distinct_ge_option_set_noop_v1',
    group_index: 4,
    constraint_index: 0,
    constraint_kind: 'distinct_ge_areas',
    description:
      'The two selected courses must come from different Art, Humanities, or Literature categories.',
    category_subjects: Object.freeze({
      art: Object.freeze(['ART', 'CST', 'MUS']),
      humanities: Object.freeze(['HUM', 'PHI', 'REL']),
      literature: Object.freeze(['ENG']),
    }),
    current_major_core_sha256:
      'ba8002499831ef31e1231976944d0fb079a480e80d17be2cc027e838d6579bdf',
    candidate_major_core_sha256:
      '05dededac7725e6289c556fb7ae38e2d374d0faac9d35fac46594935ae483a94',
    current_source_bundle_sha256:
      '0423d6052f467ff537d048732ddef701a7ea6efb9f9c832271259a6ab36b41f6',
    candidate_source_bundle_sha256:
      '13ce276ee6c3642a2db16e0214c87bd8f6a12239efbe5c94d3f48f5263d5d884',
    source_manifest_sha256:
      '62e173e0034586230332d813953b880fb72925d09d7d00695e85f8c7ad9080a2',
    source_option_set_sha256:
      'bb31c3950be219efd9cae4f1ee4ffc8a50c08b26684fc151722d50d0c451b463',
    normalized_carrier_sha256:
      'b7c272852656be4de10205d966b66ad308bde288bb5aa0a369922377b3aaa182',
    execution_semantics_sha256:
      '56af35951da5486edc78ad3d06f221e833eb557d129131d808d9a07867c389cd',
    current_evaluator_proof_sha256:
      '01227679d4bc1e15527f664ec24ffdcac960fa177bd37eb14bbba6cdfbfe52d5',
    candidate_evaluator_proof_sha256:
      'f2a8bdb4335aaf8382653c7e2a013726098a752bf5fdf57994a2d2550aa55bf0',
    course_count: 16,
  }),
  'va:as:virginia-peninsula-community-college:cs': Object.freeze({
    document_id: 'va:as:virginia-peninsula-community-college:cs',
    institution_id: 'va:cc:virginia-peninsula-community-college',
    contract: 'virginia_peninsula_distinct_category_option_set_noop_v1',
    group_index: 3,
    constraint_index: 0,
    constraint_kind: 'distinct_categories_across_sections',
    description:
      'The two selections must come from different UCGS categories, not merely be different course numbers.',
    category_subjects: Object.freeze({
      arts: Object.freeze(['ART', 'CST', 'MUS']),
      humanities: Object.freeze(['HUM', 'PHI', 'REL']),
      literature: Object.freeze(['ENG']),
    }),
    current_major_core_sha256:
      '1e4826da33b7f2e683101809c251c999f586a2d8221ab89c53cdbe2a9e006962',
    candidate_major_core_sha256:
      '8e244b1d94fed1712c2e6d3ffc89549cdac9fa7d59b710a6891bdabd07c2239a',
    current_source_bundle_sha256:
      '24c152befa8d63552fa3df4a364c844c8afcd2e190bfbb79271250800484fc87',
    candidate_source_bundle_sha256:
      '54add759b298332791fe65fcac7d2e6750ac560c4cef016b3486ca78e0dbecd1',
    source_manifest_sha256:
      'b6572f99c187cf28fbf778517c8b1b02708ac3468dd77d6506c5a25e7f5932a5',
    source_option_set_sha256:
      '2b34be60de170e8e4dfabf12ff4fcd851710f4e12c64c4e1354bed3500210419',
    normalized_carrier_sha256:
      'd6af86e9f9c06f5f69eb621f142113347ac5abab29387ca7ea2c5adc96e1bc55',
    execution_semantics_sha256:
      'ea94b77fdcb695e8e8f7bb7b8b5460fd3aa79d215ff7b21a2ecef4360c449ee2',
    current_evaluator_proof_sha256:
      '67ad675896364492d3853286c1c6157802f044e279b40f2871cfaa90565c596e',
    candidate_evaluator_proof_sha256:
      '7554e18639e81af0c587efaa0ff445360daa90d86ecbe29992f9217811bb0d67',
    course_count: 31,
  }),
});

function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function sha256(value) {
  return createHash('sha256').update(
    typeof value === 'string' || Buffer.isBuffer(value)
      ? value : JSON.stringify(stable(value)),
  ).digest('hex');
}

function exact(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function sourceManifest(document) {
  return (Array.isArray(document?.sources) ? document.sources : []).map((source) => ({
    id: source?.id || null,
    kind: source?.kind || null,
    url: source?.url || null,
    final_url: source?.final_url || null,
    content_sha256: source?.content_sha256
      || source?.sha256 || source?.response_sha256 || null,
    catalog_year: source?.catalog_year || document?.catalog_year || null,
  })).sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function semanticDiff(before, after, path = '') {
  if (exact(before, after)) return [];
  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  if (!beforeObject || !afterObject || Array.isArray(before) !== Array.isArray(after)) {
    return [{ path: path || '<root>', before: before ?? null, after: after ?? null }];
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const rows = [];
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      rows.push(...semanticDiff(before[index], after[index], `${path}[${index}]`));
    }
    return rows;
  }
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    .flatMap((key) => semanticDiff(
      before[key], after[key], path ? `${path}.${key}` : key,
    ));
}

function carrier(document, contract) {
  return document?.requirement_groups?.[contract.group_index] || null;
}

function constraint(document, contract) {
  return carrier(document, contract)?.analysis_constraints?.[contract.constraint_index] || null;
}

function normalizedCarrier(document, contract) {
  const out = structuredClone(carrier(document, contract));
  const row = out?.analysis_constraints?.[contract.constraint_index];
  if (!row) return null;
  delete row.category_subjects;
  delete row.minimum_distinct_categories;
  if (['supported', 'evaluator_not_implemented'].includes(row.status)) {
    row.status = 'evaluator_capable';
  }
  return out;
}

function routeCodes(owner) {
  const raw = (owner?.sections || []).flatMap((section) => (
    (section?.receivers || []).flatMap((receiver) => (
      (receiver?.options || []).flatMap((option) => (
        option?.source_course_keys || option?.course_keys || []
      ))
    ))
  ));
  const codes = raw.map(canonicalCourseCode);
  return codes.some((code) => !code) ? null : [...new Set(codes)].sort();
}

function executionSemantics(document, contract) {
  const owner = carrier(document, contract);
  const value = constraint(document, contract);
  const resolution = resolveAssociateConstraint(value, { owner, doc: document });
  const codes = routeCodes(owner);
  if (!owner || !value || resolution.issues.length || !codes?.length) return null;
  const courseCategories = Object.fromEntries(codes.map((code) => [
    code, categoryForCourse(resolution.constraint, code),
  ]));
  if (Object.values(courseCategories).some((category) => !category)) return null;
  return {
    minimum_distinct_categories: distinctCategoryMinimum(resolution.constraint),
    course_categories: courseCategories,
    selection_count: (owner.sections || []).reduce((sum, section) => (
      sum + Number(section?.section_advisement || 0)
    ), 0),
  };
}

function evaluatorProof(document, contract) {
  const audit = auditAssociateDocument(document);
  return {
    target: audit.rules.find((row) => (
      row.path === `requirement_groups[${contract.group_index}]`
        + `.analysis_constraints[${contract.constraint_index}]`
    )) || null,
    ready_by_figure: audit.summary.ready_by_figure,
  };
}

function expectedCoreDiff(contract) {
  const base = `requirement_groups[${contract.group_index}]`
    + `.analysis_constraints[${contract.constraint_index}]`;
  return [{
    path: `${base}.category_subjects`,
    before: null,
    after: contract.category_subjects,
  }, {
    path: `${base}.minimum_distinct_categories`,
    before: null,
    after: 2,
  }];
}

function exactCurrentConstraint(contract) {
  return {
    kind: contract.constraint_kind,
    status: 'evaluator_not_implemented',
    description: contract.description,
  };
}

function exactCandidateConstraint(contract) {
  return {
    kind: contract.constraint_kind,
    status: 'supported',
    minimum_distinct_categories: 2,
    category_subjects: contract.category_subjects,
    description: contract.description,
  };
}

function contractIssues(current, candidate, contract) {
  const issues = [];
  if (!current || !candidate) return ['current_and_candidate_required'];
  if (current?._id !== contract.document_id || candidate?._id !== contract.document_id
      || current?.kind !== 'as_degree' || candidate?.kind !== 'as_degree'
      || current?.community_college_id !== contract.institution_id
      || candidate?.community_college_id !== contract.institution_id) {
    issues.push('document_identity');
  }
  if (current?.verification?.verified !== true || current?.verification?.stale === true) {
    issues.push('stored_human_verification_boundary');
  }
  if (candidate?.verification?.verified === true) issues.push('raw_candidate_must_remain_unsigned');
  if (majorCoreHash(current) !== contract.current_major_core_sha256) {
    issues.push('current_major_core_sha256');
  }
  if (majorCoreHash(candidate) !== contract.candidate_major_core_sha256) {
    issues.push('candidate_major_core_sha256');
  }
  if (current?.provenance?.source_bundle_hash !== contract.current_source_bundle_sha256) {
    issues.push('current_source_bundle_sha256');
  }
  if (candidate?.provenance?.source_bundle_hash !== contract.candidate_source_bundle_sha256) {
    issues.push('candidate_source_bundle_sha256');
  }
  if (sha256(sourceManifest(current)) !== contract.source_manifest_sha256
      || sha256(sourceManifest(candidate)) !== contract.source_manifest_sha256) {
    issues.push('source_manifest_sha256');
  }
  if (sha256(current?.option_sets?.ucgs_block_ii) !== contract.source_option_set_sha256
      || sha256(candidate?.option_sets?.ucgs_block_ii) !== contract.source_option_set_sha256) {
    issues.push('source_option_set_sha256');
  }
  if (sha256(normalizedCarrier(current, contract)) !== contract.normalized_carrier_sha256
      || sha256(normalizedCarrier(candidate, contract)) !== contract.normalized_carrier_sha256) {
    issues.push('normalized_carrier_sha256');
  }
  if (!exact(constraint(current, contract), exactCurrentConstraint(contract))) {
    issues.push('current_constraint_shape');
  }
  if (!exact(constraint(candidate, contract), exactCandidateConstraint(contract))) {
    issues.push('candidate_constraint_shape');
  }
  if (!exact(
    semanticDiff(majorCoreMaterial(current), majorCoreMaterial(candidate)),
    expectedCoreDiff(contract),
  )) issues.push('two_exact_metadata_only_core_diffs');
  const currentSemantics = executionSemantics(current, contract);
  const candidateSemantics = executionSemantics(candidate, contract);
  if (!currentSemantics || !candidateSemantics
      || !exact(currentSemantics, candidateSemantics)
      || sha256(currentSemantics) !== contract.execution_semantics_sha256) {
    issues.push('execution_semantics_sha256');
  }
  const currentProof = evaluatorProof(current, contract);
  const candidateProof = evaluatorProof(candidate, contract);
  if (sha256(currentProof) !== contract.current_evaluator_proof_sha256
      || sha256(candidateProof) !== contract.candidate_evaluator_proof_sha256
      || currentProof?.target?.supported !== true
      || candidateProof?.target?.supported !== true
      || currentProof?.ready_by_figure?.['3'] !== true
      || currentProof?.ready_by_figure?.['4'] !== true
      || candidateProof?.ready_by_figure?.['3'] !== true
      || candidateProof?.ready_by_figure?.['4'] !== true) {
    issues.push('evaluator_proof_sha256');
  }
  const currentResolution = resolveAssociateConstraint(constraint(current, contract), {
    owner: carrier(current, contract), doc: current,
  });
  const candidateResolution = resolveAssociateConstraint(constraint(candidate, contract), {
    owner: carrier(candidate, contract), doc: candidate,
  });
  if (currentResolution?.evidence?.kind !== 'source_option_set_categories'
      || candidateResolution?.evidence != null
      || routeCodes(carrier(current, contract))?.length !== contract.course_count
      || routeCodes(carrier(candidate, contract))?.length !== contract.course_count) {
    issues.push('source_fallback_boundary');
  }
  return [...new Set(issues)].sort();
}

function expectedEvidenceRow(contract) {
  const content = {
    schema_version: SCHEMA_VERSION,
    kind: 'source_bound_associate_constraint_metadata_noop',
    document_id: contract.document_id,
    institution_id: contract.institution_id,
    contract: contract.contract,
    protected_core_paths: expectedCoreDiff(contract).map((row) => row.path),
    current_major_core_sha256: contract.current_major_core_sha256,
    candidate_major_core_sha256: contract.candidate_major_core_sha256,
    current_source_bundle_sha256: contract.current_source_bundle_sha256,
    candidate_source_bundle_sha256: contract.candidate_source_bundle_sha256,
    source_manifest_sha256: contract.source_manifest_sha256,
    source_option_set_sha256: contract.source_option_set_sha256,
    normalized_carrier_sha256: contract.normalized_carrier_sha256,
    execution_semantics_sha256: contract.execution_semantics_sha256,
    current_evaluator_proof_sha256: contract.current_evaluator_proof_sha256,
    candidate_evaluator_proof_sha256: contract.candidate_evaluator_proof_sha256,
    raw_candidate_import_blocked: true,
    stored_source_tree_unchanged: true,
    signature_carried_to_raw_candidate: false,
    human_verification_created: false,
    projection_mutation_required: false,
  };
  return { ...content, evidence_sha256: sha256(content) };
}

function conflict(documentId, code) {
  return { document_id: documentId, code };
}

function indexDocuments(documents, role, conflicts) {
  const out = new Map();
  for (const [index, document] of (Array.isArray(documents) ? documents : []).entries()) {
    const id = typeof document?._id === 'string' ? document._id : null;
    if (!id) conflicts.push({ document_id: null, code: `${role}_document_id_required`, index });
    else if (out.has(id)) conflicts.push(conflict(id, `duplicate_${role}_document`));
    else out.set(id, document);
  }
  return out;
}

function expectedReceipt(contract, evidence, issues) {
  const content = {
    schema_version: SCHEMA_VERSION,
    document_id: contract.document_id,
    status: issues.length ? 'conflict' : 'validated_evidence_only_noop',
    evidence_only_noop_validated: issues.length === 0,
    conflict_count: issues.length,
    evidence_sha256: evidence.evidence_sha256,
    current_major_core_sha256: contract.current_major_core_sha256,
    candidate_major_core_sha256: contract.candidate_major_core_sha256,
    raw_candidate_import_blocked: true,
    stored_source_tree_unchanged: true,
    signature_carried_to_raw_candidate: false,
    human_verification_created: false,
    projection_mutation_required: false,
  };
  return { ...content, receipt_sha256: sha256(content) };
}

function cohortFingerprint(documents) {
  return (Array.isArray(documents) ? documents : []).map((document) => ({
    id: document?._id || null,
    major_core_sha256: majorCoreHash(document || {}),
    source_bundle_sha256: document?.provenance?.source_bundle_hash || null,
    source_manifest_sha256: sha256(sourceManifest(document)),
    verified: document?.verification?.verified === true,
    stale: document?.verification?.stale === true,
  })).sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function buildAssociateConstraintMetadataEvidenceOverlay({
  currentDocuments = [], candidateDocuments = [],
} = {}) {
  const conflicts = [];
  if (!Array.isArray(currentDocuments)) conflicts.push(conflict(null, 'current_documents_array_required'));
  if (!Array.isArray(candidateDocuments)) conflicts.push(conflict(null, 'candidate_documents_array_required'));
  const currentById = indexDocuments(currentDocuments, 'current', conflicts);
  const candidateById = indexDocuments(candidateDocuments, 'candidate', conflicts);
  const activeContracts = Object.values(CONTRACTS).filter((contract) => (
    currentById.has(contract.document_id) || candidateById.has(contract.document_id)
  ));
  const evidenceRows = [];
  const receipts = [];
  for (const contract of activeContracts) {
    const issues = contractIssues(
      currentById.get(contract.document_id),
      candidateById.get(contract.document_id),
      contract,
    );
    conflicts.push(...issues.map((code) => conflict(contract.document_id, code)));
    const evidence = expectedEvidenceRow(contract);
    evidenceRows.push(evidence);
    receipts.push(expectedReceipt(contract, evidence, issues));
  }
  conflicts.sort((left, right) => (
    String(left.document_id).localeCompare(String(right.document_id))
      || String(left.code).localeCompare(String(right.code))
  ));
  evidenceRows.sort((left, right) => left.document_id.localeCompare(right.document_id));
  receipts.sort((left, right) => left.document_id.localeCompare(right.document_id));
  const payload = {
    schema_version: SCHEMA_VERSION,
    artifact: ARTIFACT,
    ready: conflicts.length === 0,
    mode: 'verified_source_tree_unchanged_evidence_only_noop',
    counts: {
      current_documents: Array.isArray(currentDocuments) ? currentDocuments.length : 0,
      candidate_documents: Array.isArray(candidateDocuments) ? candidateDocuments.length : 0,
      applicable_documents: activeContracts.length,
      validated_evidence_only_noops: receipts.filter((row) => (
        row.evidence_only_noop_validated === true
      )).length,
      conflicts: conflicts.length,
    },
    current_cohort_sha256: sha256(cohortFingerprint(currentDocuments)),
    candidate_cohort_sha256: sha256(cohortFingerprint(candidateDocuments)),
    evidence_rows: evidenceRows,
    receipts,
    conflicts,
  };
  return { ...payload, report_sha256: sha256(payload) };
}

function validateAssociateConstraintMetadataEvidenceOverlay(overlay) {
  const issues = [];
  if (overlay?.schema_version !== SCHEMA_VERSION) issues.push('schema_version');
  if (overlay?.artifact !== ARTIFACT) issues.push('artifact');
  const evidenceRows = Array.isArray(overlay?.evidence_rows) ? overlay.evidence_rows : [];
  const receipts = Array.isArray(overlay?.receipts) ? overlay.receipts : [];
  const conflicts = Array.isArray(overlay?.conflicts) ? overlay.conflicts : [];
  if (overlay?.ready !== (conflicts.length === 0)) issues.push('ready');
  if (overlay?.counts?.applicable_documents !== receipts.length
      || overlay?.counts?.validated_evidence_only_noops !== receipts.filter((row) => (
        row?.evidence_only_noop_validated === true
      )).length
      || overlay?.counts?.conflicts !== conflicts.length) issues.push('counts');
  const evidenceIds = evidenceRows.map((row) => row?.document_id).sort();
  const receiptIds = receipts.map((row) => row?.document_id).sort();
  if (new Set(evidenceIds).size !== evidenceIds.length
      || new Set(receiptIds).size !== receiptIds.length
      || !exact(evidenceIds, receiptIds)) issues.push('evidence_receipt_cohort');
  for (const evidence of evidenceRows) {
    const contract = CONTRACTS[evidence?.document_id];
    if (!contract || !exact(evidence, expectedEvidenceRow(contract))) {
      issues.push(`${evidence?.document_id || '<missing>'}:evidence`);
    }
  }
  for (const receipt of receipts) {
    const evidence = evidenceRows.find((row) => row.document_id === receipt.document_id);
    const contract = CONTRACTS[receipt?.document_id];
    const expected = contract && evidence
      ? expectedReceipt(contract, evidence, []) : null;
    if (!expected || (overlay?.ready === true && !exact(receipt, expected))
        || receipt?.raw_candidate_import_blocked !== true
        || receipt?.stored_source_tree_unchanged !== true
        || receipt?.signature_carried_to_raw_candidate !== false
        || receipt?.human_verification_created !== false
        || receipt?.projection_mutation_required !== false) {
      issues.push(`${receipt?.document_id || '<missing>'}:receipt`);
    }
  }
  const { report_sha256: actual, ...payload } = overlay || {};
  if (actual !== sha256(payload)) issues.push('report_sha256');
  return { valid: issues.length === 0, issues: [...new Set(issues)].sort() };
}

function associateConstraintMetadataEvidenceProof(current, candidate, overlay) {
  const contract = CONTRACTS[candidate?._id || current?._id];
  if (!contract) return { applicable: false, safe: false, failed_checks: [] };
  const validation = validateAssociateConstraintMetadataEvidenceOverlay(overlay);
  const evidence = overlay?.evidence_rows?.find((row) => row.document_id === contract.document_id);
  const receipt = overlay?.receipts?.find((row) => row.document_id === contract.document_id);
  const exactIssues = contractIssues(current, candidate, contract);
  const checks = {
    overlay_valid: validation.valid,
    overlay_ready: overlay?.ready === true,
    exact_current_candidate_contract: exactIssues.length === 0,
    exact_evidence_row: exact(evidence, expectedEvidenceRow(contract)),
    exact_validated_receipt: receipt?.status === 'validated_evidence_only_noop'
      && receipt?.evidence_only_noop_validated === true
      && receipt?.conflict_count === 0
      && receipt?.evidence_sha256 === evidence?.evidence_sha256,
    raw_candidate_import_blocked: receipt?.raw_candidate_import_blocked === true,
    stored_source_tree_unchanged: receipt?.stored_source_tree_unchanged === true,
    signature_not_carried: receipt?.signature_carried_to_raw_candidate === false,
    no_human_verification_created: receipt?.human_verification_created === false,
    no_projection_mutation: receipt?.projection_mutation_required === false,
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => passed !== true)
    .map(([name]) => name).sort();
  return {
    applicable: true,
    safe: failedChecks.length === 0,
    mode: 'source_bound_associate_constraint_metadata_evidence_only_noop',
    document_id: contract.document_id,
    contract: contract.contract,
    protected_core_paths: expectedCoreDiff(contract).map((row) => row.path),
    current_major_core_sha256: contract.current_major_core_sha256,
    candidate_major_core_sha256: contract.candidate_major_core_sha256,
    current_source_bundle_sha256: contract.current_source_bundle_sha256,
    candidate_source_bundle_sha256: contract.candidate_source_bundle_sha256,
    source_manifest_sha256: contract.source_manifest_sha256,
    source_option_set_sha256: contract.source_option_set_sha256,
    execution_semantics_sha256: contract.execution_semantics_sha256,
    evidence_sha256: evidence?.evidence_sha256 || null,
    receipt_sha256: receipt?.receipt_sha256 || null,
    overlay_report_sha256: overlay?.report_sha256 || null,
    raw_candidate_import_blocked: true,
    stored_source_tree_unchanged: true,
    signature_carried_to_raw_candidate: false,
    human_verification_created: false,
    projection_mutation_required: false,
    checks,
    failed_checks: failedChecks,
    contract_issues: exactIssues,
  };
}

module.exports = {
  ARTIFACT,
  CONTRACTS,
  SCHEMA_VERSION,
  associateConstraintMetadataEvidenceProof,
  buildAssociateConstraintMetadataEvidenceOverlay,
  contractIssues,
  evaluatorProof,
  executionSemantics,
  validateAssociateConstraintMetadataEvidenceOverlay,
};
