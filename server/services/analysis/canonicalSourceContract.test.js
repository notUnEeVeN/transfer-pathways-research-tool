import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SOURCE_CONTRACT_VERSION,
  canonicalContractIssues,
  canonicalSourceContract,
  usesCanonicalSourceContract,
} from './canonicalSourceContract';

describe('canonical exact-source analysis contract', () => {
  it('is explicit, JSON-safe, and reusable by any state projection', () => {
    const contract = canonicalSourceContract();
    expect(contract).toMatchObject({
      version: CANONICAL_SOURCE_CONTRACT_VERSION,
      boolean_semantics: 'explicit_not_label_inferred',
      associate_plan: 'joint_count_units_no_reuse',
      course_units: 'source_requirement_exact',
    });
    expect(usesCanonicalSourceContract({ analysis_contract: contract })).toBe(true);
    expect(JSON.parse(JSON.stringify(contract))).toEqual(contract);
  });

  it('fails closed when a copied contract omits or changes one capability', () => {
    expect(canonicalContractIssues({})).toEqual(['analysis_contract_required']);
    const changed = canonicalSourceContract();
    changed.boolean_semantics = 'label_inferred';
    expect(usesCanonicalSourceContract({ analysis_contract: changed })).toBe(false);
    expect(canonicalContractIssues({ analysis_contract: changed }))
      .toContain('analysis_contract_boolean_semantics_mismatch');
  });
});
