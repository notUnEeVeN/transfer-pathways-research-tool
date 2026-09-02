const { createHash } = require('node:crypto');
const {
  majorCoreHash,
  majorCoreMaterial,
} = require('./majorCoreIntegrity');

const SCHEMA_VERSION = 1;
const ARTIFACT = 'virginia_bachelor_requirement_capacity_evidence_overlay';

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

const UVA_FACTS = Object.freeze({
  source_id: 'major',
  source_url:
    'https://records.ureg.virginia.edu/preview_program.php?catoid=72&poid=11700&print=1',
  source_content_sha256:
    'e9e4a11adcfa2c911d42ce428f8327866ed29139c91ee19a018938486580f60d',
  requirement_statement:
    'BSCS majors must take three (3) additional courses in Applied Mathematics beyond the SEAS General Requirements.',
  fixed_course: Object.freeze({ code: 'APMA3100', units: 3 }),
  selection_statement: 'Choose two of these four:',
  options: Object.freeze([
    Object.freeze({ code: 'APMA2130', units: 4 }),
    Object.freeze({ code: 'APMA3080', units: 3 }),
    Object.freeze({ code: 'APMA3120', units: 3 }),
    Object.freeze({ code: 'APMA3150', units: 3 }),
  ]),
  excluded_pair: Object.freeze(['APMA3120', 'APMA3150']),
  published_degree_total_units: 127,
  derivation:
    'The exact choose-two menu has legal six- and seven-credit paths. The paper projection uses the seven-credit canonical path; a six-credit path leaves one more unrestricted credit while the degree remains 127.',
});

const VSU_FACTS = Object.freeze({
  source_id: 'general_education',
  source_url: 'https://catalog.vsu.edu/undergraduate/general-education-programs/',
  source_content_sha256:
    '02d2e2935e9a20f1674f5998d76222bcd87e3e63caba167d2356f80e4fa78a39',
  requirement_statement: 'Mathematics - 6 semester hours required from the courses listed below',
  verified_selection_count: 2,
  options: Object.freeze([
    Object.freeze({ code: 'MATH112', units: 3 }),
    Object.freeze({ code: 'MATH113', units: 3 }),
    Object.freeze({ code: 'MATH120', units: 3 }),
    Object.freeze({ code: 'MATH121', units: 3 }),
    Object.freeze({ code: 'MATH122', units: 3 }),
    Object.freeze({ code: 'MATH130', units: 3 }),
    Object.freeze({ code: 'MATH131', units: 3 }),
    Object.freeze({ code: 'MATH150', units: 4 }),
    Object.freeze({ code: 'MATH260', units: 4 }),
    Object.freeze({ code: 'MATH261', units: 4 }),
    Object.freeze({ code: 'PHIL220', units: 3 }),
    Object.freeze({ code: 'STAT210', units: 3 }),
  ]),
  derivation:
    'The source publishes a six-credit minimum, the verified tree selects two courses, and the exact menu contains three- and four-credit courses; the possible two-course capacity is therefore six through eight credits.',
});

const CONTRACTS = Object.freeze({
  'va:degree:university-of-virginia:cs': Object.freeze({
    document_id: 'va:degree:university-of-virginia:cs',
    institution_id: 'va:uni:university-of-virginia',
    slug: 'university-of-virginia',
    contract: 'uva_exact_applied_math_canonical_capacity_projection_v1',
    current_major_core_sha256:
      '9b07377c58a72e31716e65ccb455424759a520a538fcc07a14173a9a5bd0cd52',
    candidate_major_core_sha256:
      'f4315ed170a4fb625fc1f6ae70261548cd9adbf84a81f49c59cf1ad5c82317ae',
    current_source_bundle_sha256:
      '691a439ef06c4d97f63c9e6dc0635f48f05c958c8d28be46cfe04b1f8e21d649',
    candidate_source_bundle_sha256:
      '691a439ef06c4d97f63c9e6dc0635f48f05c958c8d28be46cfe04b1f8e21d649',
    source_manifest_sha256:
      'cf3280c797e8b5355d8f0cdd2f147a3b5ba7f3df1b92ac75cd06530df13d1647',
    group_index: 5,
    section_index: 1,
    path: 'requirement_groups[5].sections[1].unit_advisement',
    before: 6,
    after: 7,
    companion_path: 'requirement_groups[5].sections[1].unit_advisement_max',
    companion_value: 7,
    source_projection_sha256:
      'fe8db2d67f5080efd6cc636b3f4feb29ac83d3ac223d8fa80d97bd32700f015a',
    final_projection_sha256:
      '3e8e6e1d51fa8153cf62a94d2fcc97e1e7f7c39bca1a989daea2d2174fc7d7c5',
    published_projection_sha256:
      '7dc4a8d639503d7d4e888b9c487a6f0fe3e40cdc80a6734e729a38ad76cd28c0',
    facts: UVA_FACTS,
  }),
  'va:degree:virginia-state-university:cs': Object.freeze({
    document_id: 'va:degree:virginia-state-university:cs',
    institution_id: 'va:uni:virginia-state-university',
    slug: 'virginia-state-university',
    contract: 'vsu_exact_general_education_math_capacity_range_projection_v1',
    current_major_core_sha256:
      'b01b582b8e1db9388562e3ccc276273564cd9e0db054f27ca563b7fd99180c0f',
    candidate_major_core_sha256:
      'b940c1861816292a45adbcff1c0418145c495ef57824fffe5521893eac005572',
    current_source_bundle_sha256:
      '8798bbd35187e6ea5437a34370fbbbff0bd7e3174117f3acbb78cf85fb04bde6',
    candidate_source_bundle_sha256:
      '7dc03dd0f3739e2bad2b6695e519d3486e97cf4f6f478babccdf5a22986bd16d',
    source_manifest_sha256:
      'df87b6bb4e6c1f1d32ce5ccf98bcad6076c168006b27ef840fea852235194986',
    group_index: 5,
    section_index: 0,
    path: 'requirement_groups[5].sections[0].unit_advisement_max',
    before: 6,
    after: 8,
    companion_path: 'requirement_groups[5].sections[0].unit_advisement',
    companion_value: 6,
    source_projection_sha256:
      'f4c15f6b20a49229a176471b3f08cb28cf8f0c8c7f4568e32e24cb7da8ad5ebc',
    final_projection_sha256:
      'e8c9e047eb78f94f3d1c7cd4429667b789f63281bbd94fe808d78e635de1a207',
    published_projection_sha256:
      '93adf3912f90fa136f1aa68ca8c1575cdc2af36e710274f32f623f91c3a5d097',
    facts: VSU_FACTS,
  }),
});

function sourceManifestSha256(doc) {
  return sha256(doc?.sources ?? null);
}

function sourceForFacts(doc, contract) {
  return (Array.isArray(doc?.sources) ? doc.sources : []).find((source) => (
    source?.id === contract.facts.source_id
  )) || null;
}

function valueAtContractPath(doc, contract) {
  return doc?.requirement_groups?.[contract.group_index]
    ?.sections?.[contract.section_index];
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

function contractIssues(current, candidate, contract) {
  const issues = [];
  if (!current || !candidate) return ['current_and_candidate_required'];
  if (current._id !== contract.document_id || candidate._id !== contract.document_id
      || current.kind !== 'degree' || candidate.kind !== 'degree'
      || current.institution_id !== contract.institution_id
      || candidate.institution_id !== contract.institution_id) {
    issues.push('document_identity');
  }
  if (current?.verification?.verified !== true || current?.verification?.stale === true) {
    issues.push('stored_human_verification_boundary');
  }
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
  if (sourceManifestSha256(current) !== contract.source_manifest_sha256
      || sourceManifestSha256(candidate) !== contract.source_manifest_sha256) {
    issues.push('source_manifest_sha256');
  }
  const currentSource = sourceForFacts(current, contract);
  const candidateSource = sourceForFacts(candidate, contract);
  if (!currentSource || !candidateSource
      || currentSource.url !== contract.facts.source_url
      || candidateSource.url !== contract.facts.source_url
      || (currentSource.content_sha256 || currentSource.sha256)
        !== contract.facts.source_content_sha256
      || (candidateSource.content_sha256 || candidateSource.sha256)
        !== contract.facts.source_content_sha256) {
    issues.push('exact_source_fact_receipt');
  }
  const currentSection = valueAtContractPath(current, contract);
  const candidateSection = valueAtContractPath(candidate, contract);
  const field = contract.path.endsWith('unit_advisement_max')
    ? 'unit_advisement_max' : 'unit_advisement';
  const companionField = contract.companion_path.endsWith('unit_advisement_max')
    ? 'unit_advisement_max' : 'unit_advisement';
  if (currentSection?.[field] !== contract.before
      || candidateSection?.[field] !== contract.after
      || currentSection?.[companionField] !== contract.companion_value
      || candidateSection?.[companionField] !== contract.companion_value) {
    issues.push('exact_section_capacity_values');
  }
  const diffs = semanticDiff(majorCoreMaterial(current), majorCoreMaterial(candidate));
  if (JSON.stringify(diffs) !== JSON.stringify([{
    path: contract.path,
    before: contract.before,
    after: contract.after,
  }])) {
    issues.push('single_exact_protected_core_diff');
  }
  return [...new Set(issues)].sort();
}

function expectedEvidenceRow(contract) {
  const content = {
    schema_version: SCHEMA_VERSION,
    kind: 'source_bound_requirement_capacity_projection',
    document_id: contract.document_id,
    institution_id: contract.institution_id,
    contract: contract.contract,
    group_index: contract.group_index,
    section_index: contract.section_index,
    protected_core_path: contract.path,
    stored_value: contract.before,
    projected_value: contract.after,
    companion_path: contract.companion_path,
    companion_value: contract.companion_value,
    source_projection_sha256: contract.source_projection_sha256,
    final_projection_sha256: contract.final_projection_sha256,
    published_projection_sha256: contract.published_projection_sha256,
    current_major_core_sha256: contract.current_major_core_sha256,
    candidate_major_core_sha256: contract.candidate_major_core_sha256,
    current_source_bundle_sha256: contract.current_source_bundle_sha256,
    candidate_source_bundle_sha256: contract.candidate_source_bundle_sha256,
    source_manifest_sha256: contract.source_manifest_sha256,
    source_facts: contract.facts,
    source_facts_sha256: sha256(contract.facts),
    raw_candidate_import_blocked: true,
    verified_source_tree_mutated: false,
    human_verification_created: false,
    projection_only: true,
  };
  return { ...content, evidence_sha256: sha256(content) };
}

function conflict(documentId, code, detail = null) {
  return {
    document_id: documentId,
    code,
    ...(detail ? { detail: stable(detail) } : {}),
  };
}

function indexDocuments(documents, role, conflicts) {
  const out = new Map();
  for (const [index, doc] of (Array.isArray(documents) ? documents : []).entries()) {
    const id = typeof doc?._id === 'string' ? doc._id : null;
    if (!id) {
      conflicts.push(conflict(null, `${role}_document_id_required`, { index }));
    } else if (out.has(id)) {
      conflicts.push(conflict(id, `duplicate_${role}_document`));
    } else out.set(id, doc);
  }
  return out;
}

function receiptFor(contract, evidence, issues) {
  const content = {
    schema_version: SCHEMA_VERSION,
    document_id: contract.document_id,
    status: issues.length ? 'conflict' : 'applied_projection_evidence',
    projection_evidence_applied: issues.length === 0,
    conflict_count: issues.length,
    current_major_core_sha256: contract.current_major_core_sha256,
    candidate_major_core_sha256: contract.candidate_major_core_sha256,
    source_manifest_sha256: contract.source_manifest_sha256,
    evidence_sha256: evidence.evidence_sha256,
    raw_candidate_import_blocked: true,
    stored_source_tree_unchanged: true,
    human_verification_created: false,
  };
  return { ...content, receipt_sha256: sha256(content) };
}

function cohortFingerprint(documents) {
  return (Array.isArray(documents) ? documents : [])
    .map((doc) => ({
      id: doc?._id || null,
      major_core_sha256: majorCoreHash(doc || {}),
      source_bundle_sha256: doc?.provenance?.source_bundle_hash || null,
      source_manifest_sha256: sourceManifestSha256(doc),
      verified: doc?.verification?.verified === true,
      stale: doc?.verification?.stale === true,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function buildBachelorRequirementCapacityEvidenceOverlay({
  currentDocuments = [],
  candidateDocuments = [],
} = {}) {
  const conflicts = [];
  if (!Array.isArray(currentDocuments)) {
    conflicts.push(conflict(null, 'current_documents_array_required'));
  }
  if (!Array.isArray(candidateDocuments)) {
    conflicts.push(conflict(null, 'candidate_documents_array_required'));
  }
  const currentById = indexDocuments(currentDocuments, 'current', conflicts);
  const candidateById = indexDocuments(candidateDocuments, 'candidate', conflicts);
  const activeContracts = Object.values(CONTRACTS).filter((contract) => (
    currentById.has(contract.document_id) || candidateById.has(contract.document_id)
  ));
  const evidenceRows = [];
  const receipts = [];
  for (const contract of activeContracts) {
    const current = currentById.get(contract.document_id) || null;
    const candidate = candidateById.get(contract.document_id) || null;
    const issues = contractIssues(current, candidate, contract);
    conflicts.push(...issues.map((code) => conflict(contract.document_id, code)));
    const evidence = expectedEvidenceRow(contract);
    evidenceRows.push(evidence);
    receipts.push(receiptFor(contract, evidence, issues));
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
    mode: 'verified_source_tree_unchanged_projection_evidence_only',
    counts: {
      current_documents: Array.isArray(currentDocuments) ? currentDocuments.length : 0,
      candidate_documents: Array.isArray(candidateDocuments) ? candidateDocuments.length : 0,
      applicable_documents: activeContracts.length,
      evidence_rows: evidenceRows.length,
      applied_projection_evidence_rows: receipts.filter((row) => (
        row.projection_evidence_applied
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

function validateBachelorRequirementCapacityEvidenceOverlay(overlay) {
  const issues = [];
  if (overlay?.schema_version !== SCHEMA_VERSION) issues.push('schema_version');
  if (overlay?.artifact !== ARTIFACT) issues.push('artifact');
  const evidenceRows = Array.isArray(overlay?.evidence_rows) ? overlay.evidence_rows : [];
  const receipts = Array.isArray(overlay?.receipts) ? overlay.receipts : [];
  const conflicts = Array.isArray(overlay?.conflicts) ? overlay.conflicts : [];
  if (overlay?.ready !== (conflicts.length === 0)) issues.push('ready');
  if (overlay?.counts?.evidence_rows !== evidenceRows.length
      || overlay?.counts?.applicable_documents !== receipts.length
      || overlay?.counts?.applied_projection_evidence_rows !== receipts.filter((row) => (
        row?.projection_evidence_applied === true
      )).length
      || overlay?.counts?.conflicts !== conflicts.length) issues.push('counts');
  const evidenceIds = evidenceRows.map((row) => row?.document_id).sort();
  const receiptIds = receipts.map((row) => row?.document_id).sort();
  if (new Set(evidenceIds).size !== evidenceIds.length
      || new Set(receiptIds).size !== receiptIds.length
      || JSON.stringify(evidenceIds) !== JSON.stringify(receiptIds)) {
    issues.push('evidence_receipt_cohort');
  }
  for (const evidence of evidenceRows) {
    const contract = CONTRACTS[evidence?.document_id];
    if (!contract || JSON.stringify(stable(evidence))
      !== JSON.stringify(stable(expectedEvidenceRow(contract)))) {
      issues.push(`${evidence?.document_id || '<missing>'}:evidence`);
    }
  }
  for (const receipt of receipts) {
    const evidence = evidenceRows.find((row) => row.document_id === receipt.document_id);
    const { receipt_sha256: actual, ...content } = receipt || {};
    if (!evidence || actual !== sha256(content)
        || receipt.evidence_sha256 !== evidence.evidence_sha256
        || receipt.raw_candidate_import_blocked !== true
        || receipt.stored_source_tree_unchanged !== true
        || receipt.human_verification_created !== false) {
      issues.push(`${receipt?.document_id || '<missing>'}:receipt`);
    }
    if (overlay?.ready === true && (receipt.status !== 'applied_projection_evidence'
        || receipt.projection_evidence_applied !== true
        || receipt.conflict_count !== 0)) {
      issues.push(`${receipt?.document_id || '<missing>'}:ready_receipt`);
    }
  }
  const { report_sha256: actualReport, ...payload } = overlay || {};
  if (actualReport !== sha256(payload)) issues.push('report_sha256');
  return { valid: issues.length === 0, issues: [...new Set(issues)].sort() };
}

function bachelorRequirementCapacityEvidenceProof(current, candidate, overlay) {
  const contract = CONTRACTS[candidate?._id || current?._id];
  if (!contract) return { applicable: false, safe: false, failed_checks: [] };
  const validation = validateBachelorRequirementCapacityEvidenceOverlay(overlay);
  const evidence = overlay?.evidence_rows?.find((row) => row.document_id === contract.document_id);
  const receipt = overlay?.receipts?.find((row) => row.document_id === contract.document_id);
  const exactIssues = contractIssues(current, candidate, contract);
  const checks = {
    overlay_valid: validation.valid,
    overlay_ready: overlay?.ready === true,
    exact_current_candidate_contract: exactIssues.length === 0,
    exact_evidence_row: JSON.stringify(stable(evidence))
      === JSON.stringify(stable(expectedEvidenceRow(contract))),
    exact_applied_receipt: receipt?.status === 'applied_projection_evidence'
      && receipt?.projection_evidence_applied === true
      && receipt?.conflict_count === 0
      && receipt?.evidence_sha256 === evidence?.evidence_sha256,
    raw_candidate_import_blocked: receipt?.raw_candidate_import_blocked === true,
    stored_source_tree_unchanged: receipt?.stored_source_tree_unchanged === true,
    no_human_verification_created: receipt?.human_verification_created === false,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => passed !== true).map(([name]) => name).sort();
  return {
    applicable: true,
    safe: failedChecks.length === 0,
    mode: 'source_bound_requirement_capacity_projection_only',
    document_id: contract.document_id,
    contract: contract.contract,
    protected_core_path: contract.path,
    stored_value: contract.before,
    projected_value: contract.after,
    evidence_sha256: evidence?.evidence_sha256 || null,
    receipt_sha256: receipt?.receipt_sha256 || null,
    overlay_report_sha256: overlay?.report_sha256 || null,
    raw_candidate_import_blocked: true,
    signature_carried_to_raw_candidate: false,
    human_verification_created: false,
    checks,
    failed_checks: failedChecks,
    contract_issues: exactIssues,
  };
}

function expectedProjectionReceipt(contract, evidence, overlay) {
  const content = {
    document_id: contract.document_id,
    contract: contract.contract,
    applied: true,
    protected_core_path: contract.path,
    stored_value: contract.before,
    projected_value: contract.after,
    source_major_core_sha256: contract.current_major_core_sha256,
    evidence_sha256: evidence.evidence_sha256,
    overlay_report_sha256: overlay.report_sha256,
    projected_requirement_groups_sha256: contract.final_projection_sha256,
    expected_projected_requirement_groups_sha256: contract.final_projection_sha256,
    expected_published_requirement_groups_sha256: contract.published_projection_sha256,
    source_document_mutated: false,
  };
  return { ...content, projection_sha256: sha256(content) };
}

/**
 * Prove that the one projected capacity difference is the exact overlay output.
 * This is deliberately independent of a candidate wrapper: publication owns
 * the retained source document plus the validated evidence artifact, never an
 * imported replacement tree or a newly manufactured human receipt.
 */
function bachelorRequirementCapacityProjectionProof(source, projected, overlay) {
  const contract = CONTRACTS[source?._id];
  if (!contract) return { applicable: false, safe: false, failed_checks: [] };
  const validation = validateBachelorRequirementCapacityEvidenceOverlay(overlay);
  const evidence = overlay?.evidence_rows?.find((row) => (
    row.document_id === contract.document_id
  ));
  const overlayReceipt = overlay?.receipts?.find((row) => (
    row.document_id === contract.document_id
  ));
  const sourceRecord = sourceForFacts(source, contract);
  const expectedReceipt = evidence
    ? expectedProjectionReceipt(contract, evidence, overlay) : null;
  const projectedGroupsSha256 = sha256(projected?.requirement_groups || []);
  const acceptedProjectionHashes = [
    contract.final_projection_sha256,
    contract.published_projection_sha256,
  ];
  const checks = {
    overlay_valid: validation.valid,
    overlay_ready: overlay?.ready === true,
    exact_applied_overlay_receipt: overlayReceipt?.status === 'applied_projection_evidence'
      && overlayReceipt?.projection_evidence_applied === true
      && overlayReceipt?.conflict_count === 0
      && overlayReceipt?.stored_source_tree_unchanged === true
      && overlayReceipt?.human_verification_created === false,
    exact_source_document_identity: source?._id === contract.document_id
      && source?.kind === 'degree'
      && source?.institution_id === contract.institution_id
      && source?.verification?.verified === true
      && source?.verification?.stale !== true,
    exact_source_tree: majorCoreHash(source || {}) === contract.current_major_core_sha256,
    exact_source_bundle:
      source?.provenance?.source_bundle_hash === contract.current_source_bundle_sha256,
    exact_source_manifest: sourceManifestSha256(source) === contract.source_manifest_sha256,
    exact_source_fact: sourceRecord?.url === contract.facts.source_url
      && (sourceRecord?.content_sha256 || sourceRecord?.sha256)
        === contract.facts.source_content_sha256,
    exact_projected_document_identity: projected?.va_requirement_id === contract.document_id,
    exact_final_projection_tree: acceptedProjectionHashes.includes(projectedGroupsSha256),
    exact_projection_receipt: expectedReceipt != null
      && JSON.stringify(stable(projected?.requirement_capacity_projection || null))
        === JSON.stringify(stable(expectedReceipt)),
    raw_candidate_import_blocked: overlayReceipt?.raw_candidate_import_blocked === true,
    no_human_verification_created: overlayReceipt?.human_verification_created === false,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => passed !== true).map(([name]) => name).sort();
  return {
    applicable: true,
    safe: failedChecks.length === 0,
    mode: 'exact_source_bound_requirement_capacity_projection_conservation',
    document_id: contract.document_id,
    contract: contract.contract,
    protected_core_path: contract.path,
    evidence_sha256: evidence?.evidence_sha256 || null,
    projection_sha256: projected?.requirement_capacity_projection?.projection_sha256 || null,
    projection_style: projectedGroupsSha256 === contract.published_projection_sha256
      ? 'published_shared_schema' : projectedGroupsSha256 === contract.final_projection_sha256
        ? 'evidence_boundary' : null,
    raw_candidate_import_blocked: true,
    signature_carried_to_raw_candidate: false,
    human_verification_created: false,
    checks,
    failed_checks: failedChecks,
  };
}

function projectBachelorRequirementCapacity({
  sourceDocument,
  requirementGroups,
  overlay,
} = {}) {
  const groups = structuredClone(requirementGroups || []);
  const contract = CONTRACTS[sourceDocument?._id];
  if (!contract) return { applicable: false, ready: true, requirement_groups: groups, receipt: null };
  const validation = validateBachelorRequirementCapacityEvidenceOverlay(overlay);
  const evidence = overlay?.evidence_rows?.find((row) => row.document_id === contract.document_id);
  const receipt = overlay?.receipts?.find((row) => row.document_id === contract.document_id);
  const section = groups?.[contract.group_index]?.sections?.[contract.section_index];
  const field = contract.path.endsWith('unit_advisement_max')
    ? 'unit_advisement_max' : 'unit_advisement';
  const companionField = contract.companion_path.endsWith('unit_advisement_max')
    ? 'unit_advisement_max' : 'unit_advisement';
  const issues = [];
  if (!validation.valid || overlay?.ready !== true) issues.push('overlay_not_ready');
  if (majorCoreHash(sourceDocument || {}) !== contract.current_major_core_sha256) {
    issues.push('source_major_core_changed');
  }
  if (sourceManifestSha256(sourceDocument) !== contract.source_manifest_sha256
      || sourceDocument?.provenance?.source_bundle_hash
        !== contract.current_source_bundle_sha256) issues.push('source_identity_changed');
  if (!evidence || !receipt || receipt.projection_evidence_applied !== true
      || receipt.evidence_sha256 !== evidence.evidence_sha256) issues.push('evidence_receipt_changed');
  if (!section || section[field] !== contract.before
      || section[companionField] !== contract.companion_value) {
    issues.push('projected_source_section_changed');
  }
  if (sha256(groups) !== contract.source_projection_sha256) {
    issues.push('source_projection_tree_changed');
  }
  if (issues.length) {
    return {
      applicable: true,
      ready: false,
      requirement_groups: groups,
      receipt: {
        document_id: contract.document_id,
        contract: contract.contract,
        applied: false,
        issues: [...new Set(issues)].sort(),
      },
    };
  }
  section[field] = contract.after;
  if (sha256(groups) !== contract.final_projection_sha256) {
    return {
      applicable: true,
      ready: false,
      requirement_groups: structuredClone(requirementGroups || []),
      receipt: {
        document_id: contract.document_id,
        contract: contract.contract,
        applied: false,
        issues: ['final_projection_tree_changed'],
      },
    };
  }
  return {
    applicable: true,
    ready: true,
    requirement_groups: groups,
    receipt: expectedProjectionReceipt(contract, evidence, overlay),
  };
}

module.exports = {
  ARTIFACT,
  CONTRACTS,
  SCHEMA_VERSION,
  bachelorRequirementCapacityEvidenceProof,
  bachelorRequirementCapacityProjectionProof,
  buildBachelorRequirementCapacityEvidenceOverlay,
  projectBachelorRequirementCapacity,
  sourceManifestSha256,
  validateBachelorRequirementCapacityEvidenceOverlay,
};
