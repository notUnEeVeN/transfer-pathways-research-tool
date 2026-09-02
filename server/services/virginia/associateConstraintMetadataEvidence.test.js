import { describe, expect, it } from 'vitest';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { majorCoreHash } from './majorCoreIntegrity';
import {
  CONTRACTS,
  associateConstraintMetadataEvidenceProof,
  buildAssociateConstraintMetadataEvidenceOverlay,
  validateAssociateConstraintMetadataEvidenceOverlay,
} from './associateConstraintMetadataEvidence';

const IDS = Object.keys(CONTRACTS).sort();

function fixture() {
  const candidates = cachedAcceptedSourcePlan(new Map()).documents
    .filter((document) => IDS.includes(document._id))
    .map((document) => {
      const out = structuredClone(document);
      delete out.updated_at;
      return out;
    })
    .sort((left, right) => left._id.localeCompare(right._id));
  const current = candidates.map((candidate) => {
    const out = structuredClone(candidate);
    const contract = CONTRACTS[out._id];
    const constraint = out.requirement_groups[contract.group_index]
      .analysis_constraints[contract.constraint_index];
    delete constraint.category_subjects;
    delete constraint.minimum_distinct_categories;
    constraint.status = 'evaluator_not_implemented';
    out.provenance.source_bundle_hash = contract.current_source_bundle_sha256;
    out.verification = { verified: true, stale: false };
    return out;
  });
  return { candidates, current };
}

describe('Virginia associate constraint metadata no-op evidence', () => {
  it('proves exactly Central Virginia and Virginia Peninsula are runtime-equivalent no-ops', () => {
    const { candidates, current } = fixture();
    const overlay = buildAssociateConstraintMetadataEvidenceOverlay({
      currentDocuments: current,
      candidateDocuments: candidates,
    });
    expect(overlay).toMatchObject({
      ready: true,
      mode: 'verified_source_tree_unchanged_evidence_only_noop',
      counts: {
        applicable_documents: 2,
        validated_evidence_only_noops: 2,
        conflicts: 0,
      },
    });
    expect(validateAssociateConstraintMetadataEvidenceOverlay(overlay))
      .toEqual({ valid: true, issues: [] });
    expect(overlay.receipts.map((row) => row.document_id)).toEqual(IDS);
    expect(overlay.receipts.every((row) => (
      row.raw_candidate_import_blocked === true
        && row.stored_source_tree_unchanged === true
        && row.signature_carried_to_raw_candidate === false
        && row.human_verification_created === false
        && row.projection_mutation_required === false
    ))).toBe(true);

    for (const candidate of candidates) {
      const prior = current.find((row) => row._id === candidate._id);
      const contract = CONTRACTS[candidate._id];
      expect(majorCoreHash(prior)).toBe(contract.current_major_core_sha256);
      expect(majorCoreHash(candidate)).toBe(contract.candidate_major_core_sha256);
      expect(associateConstraintMetadataEvidenceProof(prior, candidate, overlay))
        .toMatchObject({
          applicable: true,
          safe: true,
          raw_candidate_import_blocked: true,
          stored_source_tree_unchanged: true,
          signature_carried_to_raw_candidate: false,
          human_verification_created: false,
          projection_mutation_required: false,
          failed_checks: [],
        });
    }
  });

  it('fails closed on source, option-set, receiver, constraint, signature, or evidence drift', () => {
    const variants = [
      ['source', ({ current }) => {
        current[0].provenance.source_bundle_hash = '0'.repeat(64);
      }],
      ['option set', ({ current }) => {
        current[0].option_sets.ucgs_block_ii.categories.art.push('ART999');
      }],
      ['receiver', ({ candidates }) => {
        candidates[0].requirement_groups[CONTRACTS[candidates[0]._id].group_index]
          .sections[0].receivers[0].options.pop();
      }],
      ['constraint', ({ candidates }) => {
        const contract = CONTRACTS[candidates[0]._id];
        candidates[0].requirement_groups[contract.group_index]
          .analysis_constraints[0].minimum_distinct_categories = 3;
      }],
      ['signature', ({ candidates }) => {
        candidates[0].verification = { verified: true, stale: false };
      }],
    ];
    for (const [label, mutate] of variants) {
      const changed = fixture();
      mutate(changed);
      const overlay = buildAssociateConstraintMetadataEvidenceOverlay({
        currentDocuments: changed.current,
        candidateDocuments: changed.candidates,
      });
      expect(overlay.ready, label).toBe(false);
      expect(overlay.counts.conflicts, label).toBeGreaterThan(0);
    }

    const exact = fixture();
    const overlay = buildAssociateConstraintMetadataEvidenceOverlay({
      currentDocuments: exact.current,
      candidateDocuments: exact.candidates,
    });
    overlay.evidence_rows[0].projection_mutation_required = true;
    expect(validateAssociateConstraintMetadataEvidenceOverlay(overlay).valid).toBe(false);
  });

  it('does not classify Germanna because its candidate also removes a receiver', () => {
    expect(CONTRACTS['va:as:germanna-community-college:cs']).toBeUndefined();
    const candidate = cachedAcceptedSourcePlan(new Map()).documents.find((document) => (
      document._id === 'va:as:germanna-community-college:cs'
    ));
    expect(associateConstraintMetadataEvidenceProof(candidate, candidate, {
      ready: true, evidence_rows: [], receipts: [], conflicts: [],
    })).toEqual({ applicable: false, safe: false, failed_checks: [] });
  });
});
