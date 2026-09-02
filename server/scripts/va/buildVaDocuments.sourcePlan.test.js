import { describe, expect, it, vi } from 'vitest';
import {
  candidateSourceSafetyAudit,
  equivalencyConditionDelta,
  parseCliArgs,
  printAcceptedSourcePlanComparison,
} from './buildVaDocuments';
import { cachedAcceptedSourcePlan } from '../importVirginiaCatalogDegrees';

const sourceDocument = (overrides = {}) => ({
  _id: 'va:as:example-community-college:cs',
  kind: 'as_degree',
  status: 'extracted',
  source: 'institution_catalog',
  community_college_id: 'va:cc:example-community-college',
  total_units: 60,
  requirement_groups: [{
    group_id: 'science',
    sections: [{
      section_id: 'science_1',
      unit_advisement: 4,
      receivers: [],
    }],
  }],
  provenance: { source_bundle_hash: 'a'.repeat(64) },
  verification: { verified: false },
  ...overrides,
});

describe('Virginia accepted-source release-path comparison', () => {
  it('is read-only and cannot be combined with any publication or restore mode', () => {
    expect(parseCliArgs(['--source-plan'])).toMatchObject({
      sourcePlan: true,
      apply: false,
      restoreGenerationId: null,
    });
    expect(() => parseCliArgs(['--source-plan', '--apply']))
      .toThrow(/read-only/);
    expect(() => parseCliArgs(['--source-plan', '--restore=generation-001']))
      .toThrow(/read-only/);
    expect(() => parseCliArgs([
      '--source-plan', '--allow-incomplete', '--staging',
    ])).toThrow(/read-only/);
  });

  it('distinguishes safe verification carry, protected-content conflict, and source reopen', () => {
    const candidate = sourceDocument();
    const prior = sourceDocument({ verification: { verified: true } });
    const unchanged = candidateSourceSafetyAudit({
      storedSourceDocuments: [prior],
      candidateDocuments: [candidate],
    });
    expect(unchanged).toMatchObject({
      ready_for_default_import: true,
      counts: {
        safe_carried_verifications: 1,
        human_verification_required: 0,
        verified_core_conflicts: 0,
        verified_material_conflicts: 0,
      },
    });

    const changedCore = structuredClone(candidate);
    changedCore.requirement_groups[0].sections[0].unit_advisement = 8;
    const protectedContent = candidateSourceSafetyAudit({
      storedSourceDocuments: [prior],
      candidateDocuments: [changedCore],
    });
    expect(protectedContent).toMatchObject({
      authoritative_import_blocked: true,
      counts: {
        verified_core_conflicts: 1,
        verified_material_conflicts: 1,
        overlapping_verified_conflicts: 1,
        safe_carried_verifications: 0,
      },
    });

    const changedSource = structuredClone(candidate);
    changedSource.provenance.source_bundle_hash = 'b'.repeat(64);
    const reopen = candidateSourceSafetyAudit({
      storedSourceDocuments: [prior],
      candidateDocuments: [changedSource],
    });
    expect(reopen).toMatchObject({
      authoritative_import_blocked: true,
      counts: {
        changed_verified_source_bundles: 1,
        verified_core_conflicts: 0,
        verified_material_conflicts: 0,
        safe_carried_verifications: 0,
        human_verification_required: 1,
      },
    });
  });

  it('loads the real checked-in publication candidate without weakening its 37-document manifest', () => {
    const candidate = cachedAcceptedSourcePlan().documents;
    const simulatedStored = candidate.map((document) => ({
      ...structuredClone(document),
      verification: { verified: true },
    }));
    const audit = candidateSourceSafetyAudit({
      storedSourceDocuments: simulatedStored,
      candidateDocuments: candidate,
    });
    expect(candidate).toHaveLength(37);
    expect(candidate.filter((document) => document.kind === 'as_degree')).toHaveLength(19);
    expect(candidate.filter((document) => document.kind === 'degree')).toHaveLength(18);
    expect(audit).toMatchObject({
      ready_for_default_import: true,
      counts: {
        candidate_documents: 37,
        safe_carried_verifications: 37,
        verified_core_conflicts: 0,
        verified_material_conflicts: 0,
      },
    });
  });

  it('proves gains only when the authoritative and candidate pair rosters are identical', () => {
    const authoritativeProjection = {
      asDegrees: [{ community_college_id: 9301 }, { community_college_id: 9302 }],
      degrees: [{ school_id: 9219 }],
    };
    const candidateProjection = structuredClone(authoritativeProjection);
    const blockedCell = {
      community_college_id: 9301,
      college_name: 'Example Community College',
      school_id: 9219,
      school: 'Radford University',
      associate_source_id: 'va:as:example-community-college:cs',
    };
    const delta = equivalencyConditionDelta({
      authoritativeProjection,
      candidateProjection,
      authoritativeAudit: {
        counts: { cells: 2, ready_cells: 1 },
        blocked_cells: [blockedCell],
      },
      candidateAudit: {
        counts: { cells: 2, ready_cells: 2 },
        blocked_cells: [],
      },
    });
    expect(delta).toMatchObject({
      comparable: true,
      exact: true,
      ready_cell_delta: 1,
      gained_cells: [blockedCell],
      regressed_cells: [],
      issues: [],
    });

    const differentRoster = structuredClone(candidateProjection);
    differentRoster.asDegrees[1].community_college_id = 9303;
    expect(equivalencyConditionDelta({
      authoritativeProjection,
      candidateProjection: differentRoster,
      authoritativeAudit: { counts: { cells: 2, ready_cells: 1 }, blocked_cells: [blockedCell] },
      candidateAudit: { counts: { cells: 2, ready_cells: 2 }, blocked_cells: [] },
    })).toMatchObject({
      comparable: false,
      exact: false,
      gained_cells: [],
    });
  });

  it('separates raw candidate conflicts from the core-preserving operational review', () => {
    const output = [];
    const log = vi.spyOn(console, 'log').mockImplementation((line = '') => {
      output.push(String(line));
    });
    try {
      printAcceptedSourcePlanComparison({
        authoritative_condition_counts: { ready_cells: 1, cells: 2 },
        candidate_condition_counts: { ready_cells: 2, cells: 2 },
        condition_delta: { exact: true, gained_cells: [], regressed_cells: [], issues: [] },
        safety: {
          ready_for_default_import: false,
          counts: {
            verified_material_conflicts: 2,
            verified_core_conflicts: 1,
            overlapping_verified_conflicts: 1,
          },
          verified_material_conflicts: ['va:as:raw-material:cs'],
          verified_core_conflicts: ['va:as:protected-core:cs'],
          changed_verified_source_bundles: ['va:as:raw-source-change:cs'],
        },
        verification_review: {
          carried_verifications: 4,
          validated_course_unit_evidence_overlays: ['va:as:evidence-only:cs'],
          verified_core_conflicts: ['va:as:protected-core:cs'],
          verified_material_conflicts: [],
          changed_source_bundles: 2,
          human_verification_required: 5,
        },
      });
    } finally {
      log.mockRestore();
    }
    const rendered = output.join('\n');
    expect(rendered).toContain('raw import safety  BLOCKED');
    expect(rendered).toContain('1 evidence-only overlays');
    expect(rendered).toContain('1 unresolved core · 0 unresolved other material');
    expect(rendered).toContain('review queue       2 changed source bundles · 5 unsigned · 8 total');
    expect(rendered).toContain('RAW candidate material conflicts');
    expect(rendered).toContain('BLOCK unresolved verified core');
  });
});
