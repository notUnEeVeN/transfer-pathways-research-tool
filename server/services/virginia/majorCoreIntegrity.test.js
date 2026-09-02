import { describe, expect, it } from 'vitest';
import {
  majorCoreHash,
  majorCoreMaterial,
  verifiedCoreConflict,
} from './majorCoreIntegrity';

const verified = () => ({
  _id: 'va:as:fixture:cs',
  kind: 'as_degree',
  community_college_id: 'va:cc:fixture',
  college_id: 'va:cc:fixture',
  degree_title_seen: 'Computer Science, A.S.',
  total_units: 60,
  unit_system: 'semester',
  requirement_groups: [{
    title: 'Core',
    group_id: 'old-generated-id',
    source_refs: ['major'],
    group_conjunction: 'And',
    analysis_constraints: [],
    sections: [{
      section_advisement: 1,
      unit_advisement: 3,
      receivers: [{
        code_seen: 'CSC221',
        hash_id: 'old-hash',
        options: [{ course_ids: [1], course_keys: ['va:CSC221'], course_conjunction: 'and' }],
      }],
    }],
  }],
  provenance: { source_bundle_hash: 'old-source' },
  course_unit_evidence: [{ code: 'CSC221', units: 3 }],
  acceptance: { accepted: true },
  verification: { verified: true, verified_by: 'researcher' },
});

describe('verified Virginia major core integrity', () => {
  it('ignores operational, evidence, and reminted projection ids', () => {
    const before = verified();
    const after = structuredClone(before);
    after.updated_at = new Date('2026-08-24T00:00:00Z');
    after.provenance.source_bundle_hash = 'new-source';
    after.course_unit_evidence.push({ code: 'CSC222', units: 4 });
    after.acceptance = { accepted: true, ready_for_analysis: true };
    after.requirement_groups[0].group_id = 'new-generated-id';
    after.requirement_groups[0].source_refs = ['major', 'course_catalog'];
    after.requirement_groups[0].sections[0].receivers[0].hash_id = 'new-hash';
    after.requirement_groups[0].sections[0].receivers[0].options[0].course_ids = [999];

    expect(majorCoreMaterial(after)).toEqual(majorCoreMaterial(before));
    expect(majorCoreHash(after)).toBe(majorCoreHash(before));
    expect(verifiedCoreConflict(before, after)).toBe(false);
  });

  it('allows identity wrappers to be corrected inside an unchanged verified namespace', () => {
    const before = verified();
    before.course_namespace = {
      kind: 'institution_local',
      institution_id: 'va:cc:fixture',
      vccs_master_applicable: false,
      identity_contract: 'owner_plus_course_id',
      scoped_key_format: 'va:cc:fixture:<code>',
    };
    const after = structuredClone(before);
    after.requirement_groups[0].sections[0].receivers[0].options[0] = {
      course_ids: [1200000001],
      course_keys: ['va:cc:fixture:CSC221'],
      course_conjunction: 'and',
    };

    expect(majorCoreHash(after)).toBe(majorCoreHash(before));
    expect(verifiedCoreConflict(before, after)).toBe(false);
  });

  it('blocks a change to the verified course namespace', () => {
    const before = verified();
    const after = structuredClone(before);
    after.course_namespace = {
      kind: 'institution_local',
      institution_id: 'va:cc:fixture',
      vccs_master_applicable: false,
      identity_contract: 'owner_plus_course_id',
      scoped_key_format: 'va:cc:fixture:<code>',
    };

    expect(verifiedCoreConflict(before, after)).toBe(true);
  });

  it('protects alternate requirement maps, including promotion to the active variant', () => {
    const before = verified();
    before.requirement_variants = [{
      key: 'alternate_track',
      selected: false,
      codes_seen: ['CSC221'],
      course_titles: { CSC221: 'Old cached title' },
      source_refs: ['major'],
      requirement_groups: structuredClone(before.requirement_groups),
    }];

    const remintedEvidence = structuredClone(before);
    remintedEvidence.requirement_variants[0].codes_seen = ['CSC221', 'derived-only'];
    remintedEvidence.requirement_variants[0].course_titles.CSC221 = 'New cached title';
    remintedEvidence.requirement_variants[0].source_refs.push('track_page');
    expect(verifiedCoreConflict(before, remintedEvidence)).toBe(false);

    const promoted = structuredClone(before);
    promoted.requirement_variants[0].selected = true;
    expect(verifiedCoreConflict(before, promoted)).toBe(true);

    const changedCourse = structuredClone(before);
    changedCourse.requirement_variants[0].requirement_groups[0]
      .sections[0].receivers[0].options[0].course_keys = ['va:CSC222'];
    expect(verifiedCoreConflict(before, changedCourse)).toBe(true);
  });

  it('fails closed for top-level authored constraints and future degree policy fields', () => {
    const before = verified();

    const constraint = structuredClone(before);
    constraint.analysis_constraints = [{
      kind: 'residency_minimum',
      minimum_units: 30,
      status: 'source_verified',
    }];
    expect(verifiedCoreConflict(before, constraint)).toBe(true);

    const futurePolicy = structuredClone(before);
    futurePolicy.transfer_unit_cap = 60;
    expect(verifiedCoreConflict(before, futurePolicy)).toBe(true);
  });

  it('canonicalizes only evaluator-capability status receipts, not source uncertainty', () => {
    const before = verified();
    before.requirement_groups[0].analysis_constraints = [{
      kind: 'distinct_ge_areas',
      status: 'evaluator_not_implemented',
      minimum_distinct_categories: 2,
      category_subjects: { art: ['ART'], literature: ['ENG'] },
    }];

    const capabilityReceipt = structuredClone(before);
    capabilityReceipt.requirement_groups[0].analysis_constraints[0].status = 'supported';
    expect(verifiedCoreConflict(before, capabilityReceipt)).toBe(false);

    const topLevelBefore = structuredClone(before);
    topLevelBefore.analysis_constraints = structuredClone(
      before.requirement_groups[0].analysis_constraints,
    );
    const topLevelAfter = structuredClone(topLevelBefore);
    topLevelAfter.analysis_constraints[0].status = 'supported';
    expect(verifiedCoreConflict(topLevelBefore, topLevelAfter)).toBe(false);

    const resolvedUncertainty = structuredClone(before);
    resolvedUncertainty.requirement_groups[0].analysis_constraints[0].status = 'supported';
    before.requirement_groups[0].analysis_constraints[0].status = 'source_conflict';
    expect(verifiedCoreConflict(before, resolvedUncertainty)).toBe(true);
  });

  it.each([
    ['course identity', (doc) => { doc.requirement_groups[0].sections[0].receivers[0].options[0].course_keys = ['va:CSC222']; }],
    ['course count', (doc) => { doc.requirement_groups[0].sections[0].section_advisement = 2; }],
    ['course units', (doc) => { doc.requirement_groups[0].sections[0].unit_advisement = 4; }],
    ['boolean semantics', (doc) => { doc.requirement_groups[0].group_conjunction = 'Or'; }],
    ['analysis constraint', (doc) => { doc.requirement_groups[0].analysis_constraints.push({ kind: 'distinct_areas', minimum: 2 }); }],
    ['degree total', (doc) => { doc.total_units = 61; }],
  ])('blocks a verified %s change', (_label, mutate) => {
    const before = verified();
    const after = structuredClone(before);
    mutate(after);
    expect(verifiedCoreConflict(before, after)).toBe(true);
  });

  it('does not treat an unsigned research record as an immutable verdict', () => {
    const before = verified();
    before.verification.verified = false;
    const after = structuredClone(before);
    after.total_units = 61;
    expect(verifiedCoreConflict(before, after)).toBe(false);
  });
});
