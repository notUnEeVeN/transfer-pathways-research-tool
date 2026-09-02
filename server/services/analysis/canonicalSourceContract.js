const CANONICAL_SOURCE_CONTRACT_VERSION = 'canonical-source-requirements-v1';

const CANONICAL_SOURCE_CONTRACT = Object.freeze({
  version: CANONICAL_SOURCE_CONTRACT_VERSION,
  requirement_tree: 'groups_and_or__sections__receivers__options',
  boolean_semantics: 'explicit_not_label_inferred',
  associate_plan: 'joint_count_units_no_reuse',
  aggregate_fill: 'explicit_only',
  course_units: 'source_requirement_exact',
  publication_gate: 'source_acceptance_and_human_verification',
});

function canonicalSourceContract() {
  return { ...CANONICAL_SOURCE_CONTRACT };
}

function usesCanonicalSourceContract(doc) {
  return doc?.analysis_contract?.version === CANONICAL_SOURCE_CONTRACT_VERSION
    && doc.analysis_contract.requirement_tree === CANONICAL_SOURCE_CONTRACT.requirement_tree
    && doc.analysis_contract.boolean_semantics === CANONICAL_SOURCE_CONTRACT.boolean_semantics
    && doc.analysis_contract.associate_plan === CANONICAL_SOURCE_CONTRACT.associate_plan
    && doc.analysis_contract.aggregate_fill === CANONICAL_SOURCE_CONTRACT.aggregate_fill
    && doc.analysis_contract.course_units === CANONICAL_SOURCE_CONTRACT.course_units
    && doc.analysis_contract.publication_gate === CANONICAL_SOURCE_CONTRACT.publication_gate;
}

function canonicalContractIssues(doc) {
  if (usesCanonicalSourceContract(doc)) return [];
  const contract = doc?.analysis_contract;
  if (!contract) return ['analysis_contract_required'];
  return Object.entries(CANONICAL_SOURCE_CONTRACT)
    .filter(([key, expected]) => contract[key] !== expected)
    .map(([key]) => `analysis_contract_${key}_mismatch`);
}

module.exports = {
  CANONICAL_SOURCE_CONTRACT,
  CANONICAL_SOURCE_CONTRACT_VERSION,
  canonicalContractIssues,
  canonicalSourceContract,
  usesCanonicalSourceContract,
};
