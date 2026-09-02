import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  COLLEGIATE_ATTRIBUTE_EVIDENCE,
  EVIDENCE_ARTIFACT_BYTES_SHA256,
  FIGURE_34_INVARIANT_RULE_PATHS,
  PROOF_TREE_SHA256,
  RULE_PATHS,
  capacityContainsOverlappingCollegiateRequirementsProof,
  evaluateRandolphMaconConstraint,
  exactRandolphMaconRosterEvidence,
  exactRandolphMaconTree,
  majorElectiveSharedSelectionProof,
  noncreditExperiencePaperProof,
  randolphMaconProofTreeFingerprint,
} from './randolphMaconConstraintProofs';
import {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { getMajor } from '../../config/majors';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const COMPOSED_PATH = path.resolve(
  __dirname, '../../.va-catalogs/composed/randolph-macon-college.json',
);
const composition = JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const sourcePlan = cachedAcceptedSourcePlan();
const acceptedSource = sourcePlan.documents.find((document) => (
  document._id === 'va:degree:randolph-macon-college:cs'
));
const ROSTER_KINDS = Object.freeze(Object.keys(RULE_PATHS).filter((kind) => (
  kind !== 'capacity_contains_overlapping_collegiate_requirements'
)));

function findRule(document, kind) {
  for (let index = 0; index < document.requirement_groups.length; index += 1) {
    const group = document.requirement_groups[index];
    const constraint = (group.analysis_constraints || []).find((row) => row.kind === kind);
    if (constraint) return { group, constraint, path: `requirement_groups[${index}]` };
  }
  return null;
}

function evaluate(document, kind) {
  const found = findRule(document, kind);
  return evaluateFourYearConstraint(found.constraint, {
    container: found.group,
    document,
    path: found.path,
  });
}

let finalProjection;

beforeAll(() => {
  const sources = sourcePlan.documents.filter((document) => (
    document.kind === 'degree' && document.status === 'extracted'
  ));
  const configuredIds = Object.keys(getMajor('va-cs').programs)
    .map(Number).sort((left, right) => left - right);
  const universities = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'four_year' && configuredIds.includes(row.id)
  ));
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const institutions = [college, ...universities].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  const supply = {
    course_id: courseIdFor('CSC299'),
    course_key: 'va:CSC299',
    code: 'CSC299',
    title: 'Projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: universities.map((row) => ({
      institution: row.name,
      identifier: 'NO_MATCH_299',
    })),
  };
  finalProjection = buildProjection({
    courses: [supply], degrees: sources, asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9221);
});

describe('Randolph-Macon exact Collegiate attribute constraint proofs', () => {
  it('pins one identical authored tree through composition, source, and projection', () => {
    expect(acceptedSource).toBeTruthy();
    expect(finalProjection).toBeTruthy();
    for (const [style, document] of [
      ['composition', composition],
      ['accepted_source', acceptedSource],
      ['final_projection', finalProjection],
    ]) {
      expect(randolphMaconProofTreeFingerprint(document), style).toBe(PROOF_TREE_SHA256);
      expect(exactRandolphMaconTree(document), style).toMatchObject({
        supported: true,
        proof: { document_style: style, proof_tree_sha256: PROOF_TREE_SHA256 },
      });
    }
  });

  it('scopes only the WA zero-credit invariant and retains all seven roster rules closed', () => {
    for (const document of [composition, acceptedSource, finalProjection]) {
      for (const kind of ROSTER_KINDS) {
        const result = evaluate(document, kind);
        expect(result.evaluator, `${result.proof?.document_style}:${kind}`)
          .toBe('evaluateRandolphMaconConstraint');
        expect(result.supported, `${result.proof?.document_style}:${kind}`).toBe(false);
        expect(result.proof).toMatchObject({
          proof_tree_sha256: PROOF_TREE_SHA256,
          evidence_artifact_bytes_sha256: EVIDENCE_ARTIFACT_BYTES_SHA256,
          published_roster_occurrences: 929,
          public_roster_exhaustive: false,
          negative_membership_inference_allowed: false,
        });
      }
    }
    expect(evaluate(composition, 'writing_attentive_overlap')).toMatchObject({
      supported: false,
      paper_impact_proven: true,
      affected_figures: ['6'],
      proof: {
        selected_pillar_course_witness: 'ARTH201',
        published_witness_pillar: 'AE',
        additional_course_count: 0,
        additional_units: 0,
        invariant_under_omitted_eligible_courses: true,
        residual_figure_6_identity_and_prerequisites_open: true,
      },
    });
  });

  it('states why positive evidence cannot close exhaustive membership or discretion', () => {
    for (const kind of [
      'distinct_pillar_courses', 'major_to_pillar_overlap_limit',
      'pillar_distribution_attributes', 'cross_area_overlap_limit',
      'cross_area_course_or_project_forms',
    ]) {
      expect(evaluate(composition, kind)).toMatchObject({
        supported: false,
        reason: expect.stringMatching(/expressly excludes current eligible options/),
        proof: {
          positive_witness_available: true,
          exhaustive_transfer_optimizing_membership_available: false,
        },
      });
    }
    expect(evaluate(composition, 'foreign_language_sequence_or_proficiency'))
      .toMatchObject({
        supported: false,
        reason: expect.stringMatching(/Registrar decision/),
        proof: {
          published_intermediate_sequence_witness_count: 3,
          registrar_proficiency_route_resolved_for_degree_application: false,
        },
      });
  });

  it('proves only the exact 40+80 nonadditive capacity accounting', () => {
    for (const document of [composition, acceptedSource, finalProjection]) {
      expect(capacityContainsOverlappingCollegiateRequirementsProof(document))
        .toMatchObject({
          supported: true,
          proof: {
            fixed_major_units: 40,
            collegiate_gate_group_count: 4,
            collegiate_gate_increment_units: 0,
            remaining_capacity_units: 80,
            degree_total_units: 120,
            exhaustive_capacity_course_membership_proven: false,
            transfer_application_discretion_resolved: false,
            resident_major_allocation_resolved: false,
          },
        });
      expect(evaluate(document, 'capacity_contains_overlapping_collegiate_requirements'))
        .toMatchObject({
          supported: true,
          evaluator: 'evaluateRandolphMaconConstraint',
          proof: {
            proof_tree_sha256: PROOF_TREE_SHA256,
            rule_path: 'requirement_groups[7]',
            remaining_capacity_units: 80,
          },
        });
    }

    const changed = structuredClone(composition);
    changed.requirement_groups[7].sections[0].units = 81;
    expect(capacityContainsOverlappingCollegiateRequirementsProof(changed))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/40\+80/) });
    expect(evaluate(changed, 'capacity_contains_overlapping_collegiate_requirements'))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/source tree/) });
  });

  it('does not touch the two explicit human verification blockers', () => {
    for (const kind of [
      'official_catalog_wording_conflict', 'transfer_grade_and_application_review',
    ]) {
      const result = evaluate(composition, kind);
      expect(result).toMatchObject({
        supported: false,
        evaluator: null,
        reason: 'no exact four-year evaluator is registered',
      });
    }
  });

  it('fails closed on tree, rule-location, attachment, bundle, receipt, and projection drift', () => {
    const tree = structuredClone(composition);
    tree.requirement_groups[5].sections[0].units = 1;
    expect(evaluate(tree, 'writing_attentive_overlap')).toMatchObject({
      supported: false, reason: expect.stringMatching(/source tree/),
    });

    const found = findRule(composition, 'writing_attentive_overlap');
    expect(evaluateFourYearConstraint(found.constraint, {
      container: found.group, document: composition, path: 'requirement_groups[4]',
    })).toMatchObject({
      supported: false, reason: expect.stringMatching(/moved/),
    });
    expect(evaluateRandolphMaconConstraint({}, {
      constraint: found.constraint, document: composition, path: found.path,
    })).toMatchObject({
      supported: false, reason: expect.stringMatching(/exact source container/),
    });

    const duplicated = structuredClone(composition);
    duplicated.requirement_groups[5].analysis_constraints.push(
      structuredClone(duplicated.requirement_groups[5].analysis_constraints[1]),
    );
    expect(evaluate(duplicated, 'writing_attentive_overlap')).toMatchObject({
      supported: false, reason: expect.stringMatching(/source tree/),
    });

    const bundle = structuredClone(acceptedSource);
    bundle.provenance.source_bundle_hash = '0'.repeat(64);
    expect(evaluate(bundle, 'writing_attentive_overlap')).toMatchObject({
      supported: false, reason: expect.stringMatching(/bundle receipt/),
    });

    const sourceReceipt = structuredClone(acceptedSource);
    sourceReceipt.sources[1].sha256 = '0'.repeat(64);
    expect(evaluate(sourceReceipt, 'writing_attentive_overlap')).toMatchObject({
      supported: false, reason: expect.stringMatching(/source roles or text hashes/),
    });

    const projection = structuredClone(finalProjection);
    projection.requirement_groups[0].sections[0].receivers[0].receiving.parent_id += 1;
    expect(evaluate(projection, 'writing_attentive_overlap')).toMatchObject({
      supported: false, reason: expect.stringMatching(/course identities/),
    });
  });

  it('fails closed on evidence byte, semantics, scope, witness, and disposition mutations', () => {
    expect(exactRandolphMaconRosterEvidence()).toMatchObject({ supported: true });
    expect(exactRandolphMaconRosterEvidence(COLLEGIATE_ATTRIBUTE_EVIDENCE, {
      artifactBytesSha256: '0'.repeat(64),
    })).toMatchObject({
      supported: false, reason: expect.stringMatching(/artifact bytes/),
    });
    for (const [label, mutate] of [
      ['scope', (copy) => { copy.roster_scope.exhaustive_for_current_eligibility = true; }],
      ['witness', (copy) => {
        copy.published_positive_witnesses.pillars.writing_attentive_course = 'CSCI111';
      }],
      ['disposition', (copy) => {
        copy.publication_disposition.still_blocked_constraint_kinds = [];
      }],
      ['row', (copy) => { copy.rosters.WA.entries[0].code = 'MUTATED'; }],
    ]) {
      const copy = structuredClone(COLLEGIATE_ATTRIBUTE_EVIDENCE);
      mutate(copy);
      expect(exactRandolphMaconRosterEvidence(copy), label).toMatchObject({
        supported: false, reason: expect.stringMatching(/semantics changed/),
      });
    }
  });

  it('expands both printed special-topics ranges and enforces one shared major selection state', () => {
    const result = majorElectiveSharedSelectionProof(composition);
    expect(result).toMatchObject({
      supported: true,
      proof: {
        programming_emphasis_choice_count: 7,
        printed_elective_menu_entry_count: 17,
        expanded_elective_identity_count: 25,
        special_topics_ranges: {
          'RMC-CSCI-280-284': ['CSCI280', 'CSCI281', 'CSCI282', 'CSCI283', 'CSCI284'],
          'RMC-CSCI-380-384': ['CSCI380', 'CSCI381', 'CSCI382', 'CSCI383', 'CSCI384'],
        },
        feasible_selection_counts_by_emphasis: {
          CSCI330: 9996,
          CSCI332: 9996,
          CSCI335: 9996,
          CSCI340: 9996,
          CSCI343: 11985,
          CSCI350: 9996,
          CSCI382: 9996,
        },
        selected_elective_course_count: 4,
        selected_elective_units: 12,
        minimum_300_level_courses: 2,
        programming_emphasis_reuse_allowed: false,
        carrier_cc_articulable: false,
        residual_range_course_prerequisites_open: true,
      },
    });
    // CSCI 382 is hidden inside the printed 380-384 range. Its lower count
    // proves the solver excludes that identity when it was used as Emphasis.
    expect(result.proof.feasible_selection_counts_by_emphasis.CSCI382)
      .toBeLessThan(result.proof.feasible_selection_counts_by_emphasis.CSCI343);
  });

  it('scopes exact fixed major-menu rules away from Figures 3/4 without closing identities', () => {
    for (const document of [composition, acceptedSource, finalProjection]) {
      for (const kind of Object.keys(FIGURE_34_INVARIANT_RULE_PATHS)
        .filter((value) => value !== 'cohort_specific_noncredit_experiences')) {
        expect(evaluate(document, kind), kind).toMatchObject({
          supported: false,
          paper_impact_proven: true,
          affected_figures: ['1', '6'],
          evaluator: 'evaluateRandolphMaconConstraint',
          proof: {
            proof_tree_sha256: PROOF_TREE_SHA256,
            rule_kind: kind,
            selected_elective_course_count: 4,
            selected_elective_units: 12,
            carrier_cc_articulable: false,
            residual_range_course_prerequisites_open: true,
          },
        });
      }
      const quality = auditFourYearAnalysisQualityFlags(document)
        .find((row) => row.code === 'major_elective_cross_choice_constraints');
      expect(quality).toMatchObject({
        blocking_analysis: true,
        affected_figures: ['1', '6'],
        resolved_by_exact_evaluator: false,
      });
    }
  });

  it('proves the retained cohort carrier is zero-credit while preserving its conflict', () => {
    expect(noncreditExperiencePaperProof(composition)).toMatchObject({
      supported: true,
      affected_figures: [],
      proof: {
        selected_course_count: 0,
        academic_units: 0,
        cc_articulable: false,
        official_wording_conflict_resolved: false,
      },
    });
    expect(evaluate(composition, 'cohort_specific_noncredit_experiences')).toMatchObject({
      supported: false,
      paper_impact_proven: true,
      affected_figures: [],
      evaluator: 'evaluateRandolphMaconConstraint',
    });
    expect(evaluate(composition, 'official_catalog_wording_conflict')).toMatchObject({
      supported: false,
      affected_figures: ['1', '3', '4', '6'],
      evaluator: null,
    });
  });

  it('fails the new invariants closed on moved, widened, range, and carrier drift', () => {
    const found = findRule(composition, 'elective_minimum_course_level');
    expect(evaluateFourYearConstraint(found.constraint, {
      container: found.group,
      document: composition,
      path: 'requirement_groups[1]',
    })).toMatchObject({ supported: false, affected_figures: ['1', '3', '4', '6'] });

    for (const [label, mutate] of [
      ['widened', (copy) => { copy.requirement_groups[2].sections[0].units = 13; }],
      ['range', (copy) => {
        copy.requirement_groups[2].sections[0].receivers[2].code = 'RMC-CSCI-280-285';
      }],
      ['carrier', (copy) => { copy.requirement_groups[2].cc_articulable = true; }],
      ['noncredit', (copy) => { copy.requirement_groups[8].sections[0].units = 1; }],
    ]) {
      const copy = structuredClone(composition);
      mutate(copy);
      const proof = label === 'noncredit'
        ? noncreditExperiencePaperProof(copy) : majorElectiveSharedSelectionProof(copy);
      expect(proof.supported, label).toBe(false);
    }
  });

  it('remeasures the safe paper-impact reductions without claiming readiness', () => {
    for (const document of [composition, acceptedSource, finalProjection]) {
      const audit = auditFourYearDocument(document);
      expect(audit.summary).toMatchObject({
        active_rules: 15,
        supported_active_rules: 1,
        blocked_active_rules: 14,
        blocked_unit_audit_rules: 2,
        blocked_rules_by_figure: { '1': 10, '3': 10, '4': 10, '6': 11 },
        ready_by_figure: { '1': false, '3': false, '4': false, '6': false },
      });
      expect(audit.summary.active_rule_remediation).toEqual({
        targeted_source_research: 5,
        evaluator_engineering: 8,
        out_of_scope_administrative_rule: 1,
      });
    }
  });
});
