import { describe, expect, it } from 'vitest';
import {
  buildPublicationVerificationReview,
  reviewState,
  sourcePlanFromVerificationReview,
  validatePublicationVerificationReview,
} from './publicationVerificationReview';
import { buildCourseUnitEvidenceOverlay } from './courseUnitEvidenceOverlay';
import { sharedCourseIdentity } from './courseIdentity';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import {
  CONTRACTS as CAPACITY_CONTRACTS,
  buildBachelorRequirementCapacityEvidenceOverlay,
} from './bachelorRequirementCapacityEvidence';

const candidate = (id = 'va:degree:sample:cs') => ({
  _id: id,
  kind: 'degree',
  institution_id: 'va:uni:sample',
  catalog_year: '2026-2027',
  total_units: 120,
  requirement_groups: [],
  provenance: { source_bundle_hash: 'a'.repeat(64) },
  sources: [{ id: 'major', kind: 'major', url: 'https://catalog.sample.edu/major' }],
  acceptance: { accepted: true, ready_for_analysis: false },
});

const stored = (next = candidate()) => ({
  ...structuredClone(next),
  verification: { verified: true, verified_at: '2026-08-24T00:00:00.000Z' },
});

function evidenceOnlyFixture(id = 'va:degree:sample:cs') {
  const identity = sharedCourseIdentity('CSC221');
  const next = candidate(id);
  next.requirement_groups = [{
    title: 'Programming',
    sections: [{
      unit_advisement: 3,
      receivers: [{
        code_seen: 'CSC221',
        options: [{
          course_keys: [identity.course_key],
          course_ids: [identity.course_id],
        }],
      }],
    }],
  }];
  const prior = stored(next);
  const candidateWithEvidence = structuredClone(next);
  candidateWithEvidence.course_unit_evidence = [{
    ...identity,
    units: 3,
    min_units: 3,
    max_units: 3,
    source_refs: ['major'],
    source_paths: ['catalog#CSC221'],
    evidence: 'captured_official_course_detail',
  }];
  const overlay = buildCourseUnitEvidenceOverlay({
    currentDocuments: [prior],
    candidateDocuments: [candidateWithEvidence],
  });
  return { prior, candidateWithEvidence, overlay };
}

function capacityEvidenceFixture() {
  const ids = Object.keys(CAPACITY_CONTRACTS).sort();
  const candidates = cachedAcceptedSourcePlan(new Map()).documents
    .filter((document) => ids.includes(document._id))
    .map((document) => {
      const out = structuredClone(document);
      delete out.updated_at;
      return out;
    })
    .sort((left, right) => left._id.localeCompare(right._id));
  const current = candidates.map((candidateDocument) => {
    const prior = structuredClone(candidateDocument);
    const contract = CAPACITY_CONTRACTS[prior._id];
    prior.verification = { verified: true, stale: false };
    prior.provenance.source_bundle_hash = contract.current_source_bundle_sha256;
    const section = prior.requirement_groups[contract.group_index]
      .sections[contract.section_index];
    if (contract.path.endsWith('unit_advisement_max')) {
      section.unit_advisement_max = contract.before;
    } else section.unit_advisement = contract.before;
    return prior;
  });
  const requirementCapacityEvidence = buildBachelorRequirementCapacityEvidenceOverlay({
    currentDocuments: current,
    candidateDocuments: candidates,
  });
  return {
    current,
    candidates,
    courseUnitEvidenceOverlay: {
      requirement_capacity_evidence: requirementCapacityEvidence,
    },
  };
}

describe('Virginia publication verification review', () => {
  it('carries a signature only for the exact unchanged bundle and protected core', () => {
    const next = candidate();
    expect(reviewState(stored(next), next)).toBe('carried_exact_bundle_verification');
    const report = buildPublicationVerificationReview({
      candidateDocuments: [next], storedDocuments: [stored(next)], snapshotDate: '2026-08-24',
    });
    expect(report).toMatchObject({
      publication_ready: true,
      summary: { candidate_documents: 1, carried_verifications: 1, review_items: 0 },
    });
    expect(validatePublicationVerificationReview(report)).toEqual({ valid: true, issues: [] });
  });

  it('requires a new human review for an unsigned or changed source bundle', () => {
    const next = candidate();
    expect(reviewState(null, next)).toBe('human_verification_required');
    const prior = stored(next);
    prior.provenance.source_bundle_hash = 'b'.repeat(64);
    expect(reviewState(prior, next)).toBe('source_changed_reverification_required');
  });

  it('fails closed on protected core drift even when the source hash matches', () => {
    const next = candidate();
    const prior = stored(next);
    prior.total_units = 121;
    expect(reviewState(prior, next)).toBe('verified_core_reconciliation_required');
    const report = buildPublicationVerificationReview({
      candidateDocuments: [next], storedDocuments: [prior],
    });
    expect(report.review_items[0]).toMatchObject({
      protected_core_diff_count: 1,
      protected_core_diff: [{ path: 'total_units', before: 121, after: 120 }],
    });
  });

  it('does not let operational acceptance metadata manufacture a core conflict', () => {
    const next = candidate();
    const prior = stored(next);
    prior.acceptance = { accepted: false, ready_for_analysis: false };
    expect(reviewState(prior, next)).toBe('carried_exact_bundle_verification');
  });

  it('separates an exact validated evidence-only addition without carrying the signature', () => {
    const { prior, candidateWithEvidence, overlay } = evidenceOnlyFixture();
    expect(overlay.ready).toBe(true);
    expect(reviewState(prior, candidateWithEvidence)).toBe(
      'verified_material_reconciliation_required',
    );
    expect(reviewState(prior, candidateWithEvidence, {
      courseUnitEvidenceOverlay: overlay,
    })).toBe('validated_course_unit_evidence_overlay');

    const report = buildPublicationVerificationReview({
      candidateDocuments: [candidateWithEvidence],
      storedDocuments: [prior],
      courseUnitEvidenceOverlay: overlay,
    });
    expect(report).toMatchObject({
      publication_ready: true,
      summary: {
        carried_verifications: 0,
        validated_course_unit_evidence_overlays: 1,
        validated_course_unit_evidence_rows: 1,
        raw_verified_core_conflicts: 0,
        raw_verified_other_material_conflicts: 1,
        unresolved_verified_core_conflicts: 0,
        unresolved_verified_other_material_conflicts: 0,
        review_items: 0,
      },
    });
    expect(report.all_documents[0].conflict_receipt).toMatchObject({
      category: 'validated_course_unit_evidence_only',
      unresolved: false,
      raw_candidate_import_blocked: true,
      material_path_receipts: [{
        category: 'course_unit_evidence',
        path_pattern: 'course_unit_evidence',
        change: 'added',
        leaf_diff_count: 1,
      }],
      course_unit_evidence_overlay: {
        safe: true,
        signature_carried_to_raw_candidate: false,
      },
    });
    expect(sourcePlanFromVerificationReview(report)).toMatchObject({
      carried_verifications: 0,
      raw_verified_material_conflicts: [candidateWithEvidence._id],
      validated_course_unit_evidence_overlays: [candidateWithEvidence._id],
      validated_course_unit_evidence_rows: 1,
      verified_material_conflicts: [],
      verified_core_conflicts: [],
      conflict_receipts: [{
        id: candidateWithEvidence._id,
        category: 'validated_course_unit_evidence_only',
      }],
    });
    expect(validatePublicationVerificationReview(report)).toEqual({ valid: true, issues: [] });
  });

  it('does not let a green evidence overlay hide another material or core change', () => {
    const { prior, candidateWithEvidence, overlay } = evidenceOnlyFixture();
    const otherMaterial = structuredClone(candidateWithEvidence);
    otherMaterial.school = 'Changed candidate display value';
    expect(reviewState(prior, otherMaterial, {
      courseUnitEvidenceOverlay: overlay,
    })).toBe('verified_material_reconciliation_required');

    const coreChange = structuredClone(candidateWithEvidence);
    coreChange.total_units = 121;
    expect(reviewState(prior, coreChange, {
      courseUnitEvidenceOverlay: overlay,
    })).toBe('verified_core_reconciliation_required');

    const tamperedOverlay = structuredClone(overlay);
    tamperedOverlay.receipts[0].output_major_core_unchanged = false;
    expect(reviewState(prior, candidateWithEvidence, {
      courseUnitEvidenceOverlay: tamperedOverlay,
    })).toBe('verified_material_reconciliation_required');
  });

  it('resolves only the exact UVA/VSU capacity projection while keeping raw imports blocked', () => {
    const fixture = capacityEvidenceFixture();
    const report = buildPublicationVerificationReview({
      candidateDocuments: fixture.candidates,
      storedDocuments: fixture.current,
      courseUnitEvidenceOverlay: fixture.courseUnitEvidenceOverlay,
    });
    expect(report).toMatchObject({
      publication_ready: true,
      summary: {
        candidate_documents: 2,
        validated_requirement_capacity_evidence_projections: 2,
        validated_requirement_capacity_evidence_rows: 2,
        raw_verified_core_conflicts: 2,
        unresolved_verified_core_conflicts: 0,
        review_items: 0,
      },
    });
    expect(report.all_documents.every((row) => (
      row.review_state === 'validated_requirement_capacity_evidence_projection'
        && row.conflict_receipt.raw_candidate_import_blocked === true
        && row.conflict_receipt.unresolved === false
        && row.conflict_receipt.requirement_capacity_evidence_projection.safe === true
        && row.conflict_receipt.requirement_capacity_evidence_projection
          .signature_carried_to_raw_candidate === false
        && row.conflict_receipt.requirement_capacity_evidence_projection
          .human_verification_created === false
    ))).toBe(true);
    expect(sourcePlanFromVerificationReview(report)).toMatchObject({
      raw_verified_core_conflicts: fixture.candidates.map((row) => row._id),
      validated_requirement_capacity_evidence_projections:
        fixture.candidates.map((row) => row._id),
      validated_requirement_capacity_evidence_rows: 2,
      verified_core_conflicts: [],
    });
    expect(validatePublicationVerificationReview(report)).toEqual({ valid: true, issues: [] });
  });

  it('returns an exact capacity case to protected-core review on any evidence mutation', () => {
    const fixture = capacityEvidenceFixture();
    fixture.courseUnitEvidenceOverlay.requirement_capacity_evidence = structuredClone(
      fixture.courseUnitEvidenceOverlay.requirement_capacity_evidence,
    );
    fixture.courseUnitEvidenceOverlay.requirement_capacity_evidence
      .evidence_rows[0].source_facts.derivation = 'mutated';
    const report = buildPublicationVerificationReview({
      candidateDocuments: fixture.candidates,
      storedDocuments: fixture.current,
      courseUnitEvidenceOverlay: fixture.courseUnitEvidenceOverlay,
    });
    expect(report.all_documents.map((row) => row.review_state)).toEqual([
      'verified_core_reconciliation_required',
      'verified_core_reconciliation_required',
    ]);
    expect(report.summary).toMatchObject({
      raw_verified_core_conflicts: 2,
      unresolved_verified_core_conflicts: 2,
      validated_requirement_capacity_evidence_projections: 0,
      review_items: 2,
    });
  });

  it('produces byte-stable receipts regardless of input document ordering', () => {
    const first = evidenceOnlyFixture('va:degree:first:cs');
    const second = evidenceOnlyFixture('va:degree:second:cs');
    const build = (fixtures) => {
      const overlay = buildCourseUnitEvidenceOverlay({
        currentDocuments: fixtures.map((row) => row.prior),
        candidateDocuments: fixtures.map((row) => row.candidateWithEvidence),
      });
      return buildPublicationVerificationReview({
        candidateDocuments: fixtures.map((row) => row.candidateWithEvidence),
        storedDocuments: fixtures.map((row) => row.prior),
        courseUnitEvidenceOverlay: overlay,
        snapshotDate: '2026-08-24',
      });
    };
    const forward = build([first, second]);
    const reverse = build([second, first]);
    expect(reverse).toEqual(forward);
    expect(reverse.report_sha256).toBe(forward.report_sha256);
  });

  it('detects report tampering and never presents analysis readiness as verification', () => {
    const next = candidate();
    next.acceptance.ready_for_analysis = true;
    const report = buildPublicationVerificationReview({ candidateDocuments: [next] });
    expect(report.publication_ready).toBe(false);
    expect(report.review_items).toHaveLength(1);
    report.all_documents[0].source_bundle_hash = 'c'.repeat(64);
    expect(validatePublicationVerificationReview(report).valid).toBe(false);
  });
});
