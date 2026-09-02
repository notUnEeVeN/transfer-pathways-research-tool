import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { projectGroups } from '../../scripts/va/buildVaDocuments';
import { majorCoreHash } from './majorCoreIntegrity';
import {
  CONTRACTS,
  bachelorRequirementCapacityEvidenceProof,
  bachelorRequirementCapacityProjectionProof,
  buildBachelorRequirementCapacityEvidenceOverlay,
  projectBachelorRequirementCapacity,
  validateBachelorRequirementCapacityEvidenceOverlay,
} from './bachelorRequirementCapacityEvidence';
import { projectionConservationIssues } from './publicationReadiness';

const IDS = Object.keys(CONTRACTS).sort();

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

const digest = (value) => createHash('sha256')
  .update(JSON.stringify(stable(value))).digest('hex');

function rehashArtifact(overlay) {
  for (const evidence of overlay.evidence_rows || []) {
    const { evidence_sha256: ignored, ...content } = evidence;
    evidence.evidence_sha256 = digest(content);
  }
  for (const receipt of overlay.receipts || []) {
    const evidence = overlay.evidence_rows.find((row) => (
      row.document_id === receipt.document_id
    ));
    if (evidence) receipt.evidence_sha256 = evidence.evidence_sha256;
    const { receipt_sha256: ignored, ...content } = receipt;
    receipt.receipt_sha256 = digest(content);
  }
  const { report_sha256: ignored, ...payload } = overlay;
  overlay.report_sha256 = digest(payload);
}

function exactFixture() {
  const candidates = cachedAcceptedSourcePlan(new Map()).documents
    .filter((document) => IDS.includes(document._id))
    .map((document) => {
      const out = structuredClone(document);
      delete out.updated_at;
      return out;
    })
    .sort((left, right) => left._id.localeCompare(right._id));
  const current = candidates.map((candidate) => {
    const prior = structuredClone(candidate);
    const contract = CONTRACTS[prior._id];
    prior.verification = {
      verified: true,
      stale: false,
      verified_at: '2026-08-24T00:00:00.000Z',
    };
    prior.provenance.source_bundle_hash = contract.current_source_bundle_sha256;
    const section = prior.requirement_groups[contract.group_index]
      .sections[contract.section_index];
    if (contract.path.endsWith('unit_advisement_max')) {
      section.unit_advisement_max = contract.before;
    } else section.unit_advisement = contract.before;
    return prior;
  });
  return { current, candidates };
}

describe('source-bound bachelor requirement-capacity projection evidence', () => {
  it('recognizes only the exact UVA and VSU source/tree variants without editing either source', () => {
    const { current, candidates } = exactFixture();
    const before = digest(current);
    const overlay = buildBachelorRequirementCapacityEvidenceOverlay({
      currentDocuments: current,
      candidateDocuments: candidates,
    });

    expect(overlay).toMatchObject({
      ready: true,
      counts: {
        applicable_documents: 2,
        evidence_rows: 2,
        applied_projection_evidence_rows: 2,
        conflicts: 0,
      },
    });
    expect(validateBachelorRequirementCapacityEvidenceOverlay(overlay))
      .toEqual({ valid: true, issues: [] });
    expect(digest(current)).toBe(before);

    for (const candidate of candidates) {
      const prior = current.find((document) => document._id === candidate._id);
      const sourceHash = digest(prior);
      const proof = bachelorRequirementCapacityEvidenceProof(prior, candidate, overlay);
      expect(proof).toMatchObject({
        applicable: true,
        safe: true,
        raw_candidate_import_blocked: true,
        signature_carried_to_raw_candidate: false,
        human_verification_created: false,
      });
      const projection = projectBachelorRequirementCapacity({
        sourceDocument: prior,
        requirementGroups: projectGroups(prior, { associate: false }),
        overlay,
      });
      expect(projection).toMatchObject({ applicable: true, ready: true });
      expect(projection.requirement_groups)
        .toEqual(projectGroups(candidate, { associate: false }));
      expect(projection.receipt).toMatchObject({
        applied: true,
        source_document_mutated: false,
        expected_projected_requirement_groups_sha256:
          CONTRACTS[candidate._id].final_projection_sha256,
      });
      expect(digest(prior)).toBe(sourceHash);
      expect(majorCoreHash(prior)).toBe(CONTRACTS[candidate._id].current_major_core_sha256);
    }
  });

  it.each([
    ['stored verification removed', (current) => { current[0].verification.verified = false; }],
    ['stored verification stale', (current) => { current[0].verification.stale = true; }],
    ['stored source hash', (current) => { current[0].sources[0].content_sha256 = '0'.repeat(64); }],
    ['stored source bundle', (current) => { current[0].provenance.source_bundle_hash = '0'.repeat(64); }],
    ['candidate source bundle', (_current, candidates) => {
      candidates[0].provenance.source_bundle_hash = '0'.repeat(64);
    }],
    ['stored receiver menu', (current) => {
      current[0].requirement_groups[5].sections[1].receivers.pop();
    }],
    ['candidate receiver units', (_current, candidates) => {
      candidates[1].requirement_groups[5].sections[0].receivers[0].receiving.units = 4;
    }],
    ['candidate extra core change', (_current, candidates) => {
      candidates[0].requirement_groups[0].title = 'mutated';
    }],
    ['protected field boundary', (current) => {
      current[1].requirement_groups[5].sections[0].unit_advisement = 7;
    }],
  ])('fails closed when %s changes', (_label, mutate) => {
    const { current, candidates } = exactFixture();
    mutate(current, candidates);
    const overlay = buildBachelorRequirementCapacityEvidenceOverlay({
      currentDocuments: current,
      candidateDocuments: candidates,
    });
    expect(overlay.ready).toBe(false);
    expect(overlay.conflicts.length).toBeGreaterThan(0);
  });

  it('rejects artifact mutations even when a caller recomputes an outer-looking hash', () => {
    const { current, candidates } = exactFixture();
    const exact = buildBachelorRequirementCapacityEvidenceOverlay({
      currentDocuments: current,
      candidateDocuments: candidates,
    });
    const mutations = [
      (overlay) => { overlay.evidence_rows[0].source_facts.derivation = 'mutated'; },
      (overlay) => { overlay.receipts[0].human_verification_created = true; },
      (overlay) => { overlay.evidence_rows.pop(); overlay.counts.evidence_rows -= 1; },
      (overlay) => { overlay.report_sha256 = '0'.repeat(64); },
    ];
    for (const mutate of mutations) {
      const overlay = structuredClone(exact);
      mutate(overlay);
      if (overlay.report_sha256 !== '0'.repeat(64)) rehashArtifact(overlay);
      expect(validateBachelorRequirementCapacityEvidenceOverlay(overlay).valid).toBe(false);
      expect(bachelorRequirementCapacityEvidenceProof(current[0], candidates[0], overlay).safe)
        .toBe(false);
    }
  });

  it('binds both the source and final projection trees and never over-fires', () => {
    const { current, candidates } = exactFixture();
    const overlay = buildBachelorRequirementCapacityEvidenceOverlay({
      currentDocuments: current,
      candidateDocuments: candidates,
    });
    const prior = current[0];
    const groups = projectGroups(prior, { associate: false });
    groups[0].title = 'mutated projection input';
    const blocked = projectBachelorRequirementCapacity({
      sourceDocument: prior,
      requirementGroups: groups,
      overlay,
    });
    expect(blocked).toMatchObject({
      applicable: true,
      ready: false,
      receipt: { applied: false, issues: ['source_projection_tree_changed'] },
    });

    const unrelated = {
      ...structuredClone(candidates[0]),
      _id: 'va:degree:unrelated:cs',
      institution_id: 'va:uni:unrelated',
    };
    expect(projectBachelorRequirementCapacity({
      sourceDocument: unrelated,
      requirementGroups: unrelated.requirement_groups,
      overlay,
    })).toMatchObject({ applicable: false, ready: true, receipt: null });
    expect(bachelorRequirementCapacityEvidenceProof(unrelated, unrelated, overlay))
      .toEqual({ applicable: false, safe: false, failed_checks: [] });
  });

  it('waives only the exact receipt-bound unit-fact conservation difference', () => {
    const { current, candidates } = exactFixture();
    const overlay = buildBachelorRequirementCapacityEvidenceOverlay({
      currentDocuments: current,
      candidateDocuments: candidates,
    });
    for (const source of current) {
      const projectedCapacity = projectBachelorRequirementCapacity({
        sourceDocument: source,
        requirementGroups: projectGroups(source, { associate: false }),
        overlay,
      });
      const projected = {
        ...structuredClone(source),
        va_requirement_id: source._id,
        requirement_groups: projectedCapacity.requirement_groups,
        requirement_capacity_projection: projectedCapacity.receipt,
      };
      expect(bachelorRequirementCapacityProjectionProof(source, projected, overlay))
        .toMatchObject({ applicable: true, safe: true });
      expect(projectionConservationIssues(source, projected, {
        requirementCapacityEvidenceOverlay: overlay,
      })).toEqual([]);
      expect(projectionConservationIssues(source, projected).map((row) => row.field))
        .toEqual(['unit_facts']);

      const mutations = [
        (doc) => { doc.requirement_capacity_projection.projection_sha256 = '0'.repeat(64); },
        (doc) => { doc.requirement_groups[0].title = 'mutated final projection'; },
        (doc, evidence) => { evidence.report_sha256 = '0'.repeat(64); },
      ];
      for (const mutate of mutations) {
        const changedProjection = structuredClone(projected);
        const changedOverlay = structuredClone(overlay);
        mutate(changedProjection, changedOverlay);
        expect(bachelorRequirementCapacityProjectionProof(
          source,
          changedProjection,
          changedOverlay,
        ).safe).toBe(false);
        expect(projectionConservationIssues(source, changedProjection, {
          requirementCapacityEvidenceOverlay: changedOverlay,
        }).some((row) => row.field === 'unit_facts')).toBe(true);
      }
    }
  });
});
