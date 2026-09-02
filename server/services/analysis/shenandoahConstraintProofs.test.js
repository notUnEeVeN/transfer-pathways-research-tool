import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PROOF_TREE_SHA256,
  QUALITY_FLAG_CODES,
  SHENANDOAH_SENDER_RECEIPTS,
  SOURCE_RECEIPTS,
  exactShenandoahTree,
  shenandoahFigure34PairProof,
  shenandoahFigure34Readiness,
  shenandoahProofTreeFingerprint,
  shenandoahQualityFlagAffectedFigures,
  shenandoahSourceSpecificAffectedFigures,
} from './shenandoahConstraintProofs';
import {
  affectedFiguresForConstraint,
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
} from './fourYearConstraints';
import { _evaluateTemplate } from './transferCreditRate';
import { readinessForProjectedFigures } from '../virginia/publicationReadiness';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const ROOT = path.resolve(__dirname, '../..');
const SLUG = 'shenandoah-university';
const COMPOSED_PATH = path.join(ROOT, `.va-catalogs/composed/${SLUG}.json`);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const sourcePlan = () => cachedAcceptedSourcePlan();
const acceptedSource = () => sourcePlan().evaluatedDocuments.find((document) => (
  document._id === `va:degree:${SLUG}:cs`
));

function buildFinalProjection() {
  const plan = sourcePlan();
  const degree = plan.documents.find((document) => (
    document._id === `va:degree:${SLUG}:cs`
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9224);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const institutions = [college, university].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  const supply = {
    course_id: courseIdFor('CSC299'),
    course_key: 'va:CSC299',
    code: 'CSC299',
    title: 'Shenandoah final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9224);
}

function buildFinalAssociateProjections() {
  const plan = sourcePlan();
  const asDegrees = plan.documents.filter((document) => (
    document.kind === 'as_degree' && document.status === 'extracted'
  ));
  const colleges = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'community_college'
  )).map((row) => ({
    _id: `va:cc:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  return buildProjection({
    courses: [], degrees: [], asDegrees, institutions: colleges,
  }).asDegrees;
}

function findRule(document, kind, wantedPath = null) {
  for (const [groupIndex, group] of (document.requirement_groups || []).entries()) {
    const path = `requirement_groups[${groupIndex}]`;
    if (wantedPath && path !== wantedPath) continue;
    const constraint = (group.analysis_constraints || []).find((entry) => (
      entry.kind === kind
    ));
    if (constraint) return { group, groupIndex, path, constraint };
  }
  return null;
}

function blockerKeys(audit, figure) {
  return [
    ...audit.active_rules.filter((row) => (
      !row.supported && row.affected_figures.includes(figure)
    )),
    ...audit.unit_audit.filter((row) => (
      row.blocking && row.affected_figures.includes(figure)
    )),
  ].map((row) => `${row.path}|${row.kind}`).sort();
}

describe('exact Shenandoah Figure 3/4 proof', () => {
  it('binds all six retained official byte receipts and the exact policy statements', () => {
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const receipt of SOURCE_RECEIPTS) {
      const suffix = receipt.id === 'major' ? 'program'
        : receipt.id === 'general_education' ? 'ge' : receipt.id;
      const file = path.join(ROOT, `.va-catalogs/pages/${SLUG}__${suffix}.txt`);
      expect(sha(file), receipt.id).toBe(receipt.sha256);
    }
    const program = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__program.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    const graduation = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__graduation.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    expect(program).toContain('Select 6 or more credits of mathematics electives');
    expect(program).toContain('Additional 6 credits from CSC or DATA courses');
    expect(graduation).toContain(
      'The minimum number of credit hours required for a baccalaureate degree is 120.',
    );
    expect(graduation).toContain('must earn a minimum of 25%');
    expect(graduation).toContain('Twenty-four of the last 30 credit hours');
    expect(graduation).toContain(
      'The university-mandated general education domain requirements will be considered to have been fulfilled',
    );
    expect(graduation).toContain('Associate of Sciences');
    expect(graduation).toContain(
      'The core requirements of the individual academic unit will be considered on a case-by-case basis',
    );
  });

  it('retains one complete tree hash through composition, accepted source, and final projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(shenandoahProofTreeFingerprint))).toEqual(new Set([
      PROOF_TREE_SHA256,
    ]));
    expect(documents.map((document) => exactShenandoahTree(document))).toEqual([
      expect.objectContaining({
        supported: true,
        proof: expect.objectContaining({
          document_style: 'composition',
          proof_tree_sha256: PROOF_TREE_SHA256,
          source_bundle_sha256: null,
        }),
      }),
      expect.objectContaining({
        supported: true,
        proof: expect.objectContaining({ document_style: 'accepted_source' }),
      }),
      expect.objectContaining({
        supported: true,
        proof: expect.objectContaining({ document_style: 'final_projection' }),
      }),
    ]);
    for (const document of documents) {
      expect(exactShenandoahTree(document)).toMatchObject({
        proof: {
          accounting: {
            degree_units: 120,
            major_units: 55,
            fixed_nontransferable_math_menu_units: 6,
            fixed_nontransferable_csc_data_menu_units: 6,
            university_general_education_domain_units: 30,
            unrestricted_elective_capacity_units: 35,
            academic_unit_core_units: 0,
            academic_unit_core_published: false,
          },
          residency: {
            residency_minimum_units: 30,
            transfer_credit_maximum_units: 90,
            final_window_units: 30,
            final_window_resident_minimum_units: 24,
          },
        },
      });
    }
  });

  it('scopes only exact unresolved rules and flags away from Figures 3/4', () => {
    const document = acceptedSource();
    const paths = [
      ['requirement_groups[1]', 'open_subject_level_credit_menu', ['1', '6']],
      ['requirement_groups[2]', 'open_subject_level_credit_menu', ['1', '6']],
      ['requirement_groups[3]', 'conditional_transfer_fys_replacement', ['1', '6']],
      ['requirement_groups[4]', 'sphere_region_credit_ranges', ['1', '6']],
      ['requirement_groups[5]', 'sphere_region_credit_ranges', ['1', '6']],
      ['requirement_groups[6]', 'sphere_region_credit_ranges', ['1', '6']],
      ['requirement_groups[7]', 'sphere_region_credit_ranges', ['1', '6']],
      ['requirement_groups[8]', 'shened_total_across_ranged_spheres', ['1', '6']],
      ['requirement_groups[8]', 'major_discipline_substitution_limit', ['1', '6']],
      ['requirement_groups[8]', 'conditional_associate_degree_domain_fulfillment', ['1', '6']],
      ['requirement_groups[9]', 'capacity_contains_conditional_shened_gates', ['1', '6']],
      ['requirement_groups[10]', 'articulation_agreement_residency_treatment', []],
    ];
    for (const [pathValue, kind, figures] of paths) {
      const found = findRule(document, kind, pathValue);
      const context = {
        document, container: found.group, path: found.path,
      };
      expect(shenandoahSourceSpecificAffectedFigures(found.constraint, context), pathValue)
        .toEqual(figures);
      expect(affectedFiguresForConstraint(found.constraint, context), pathValue)
        .toEqual(figures);
    }

    const flags = auditFourYearAnalysisQualityFlags(document);
    expect(flags.map((row) => row.code)).toEqual(QUALITY_FLAG_CODES);
    expect(flags.every((row) => (
      row.blocking_analysis === true
      && row.resolved_by_exact_evaluator === false
      && JSON.stringify(row.affected_figures) === JSON.stringify(['1', '6'])
    ))).toBe(true);
    for (const flag of document.data_quality_flags) {
      expect(shenandoahQualityFlagAffectedFigures(flag, document)).toEqual(['1', '6']);
    }
  });

  it('keeps complete-degree and Figures 1/6 blockers while removing exactly twelve Figure 3/4 rule blockers', () => {
    const source = acceptedSource();
    const projection = buildFinalProjection();
    for (const document of [source, projection]) {
      const audit = auditFourYearDocument(document);
      expect(audit.summary).toMatchObject({
        explicit_rules: 13,
        active_rules: 13,
        supported_active_rules: 1,
        blocked_active_rules: 12,
        blocked_unit_audit_rules: 1,
        blocked_rules_by_figure: { '1': 11, '3': 0, '4': 0, '6': 11 },
        ready_by_figure: { '1': false, '3': true, '4': true, '6': false },
      });
      expect(blockerKeys(audit, '3')).toEqual([]);
      expect(blockerKeys(audit, '4')).toEqual([]);
      expect(blockerKeys(audit, '1')).toHaveLength(11);
      expect(blockerKeys(audit, '6')).toHaveLength(11);
    }
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockerKeys(auditFourYearDocument(projection), figure))
        .toEqual(blockerKeys(auditFourYearDocument(source), figure));
    }
  });

  it('proves every live source-plan sender is an exact fixed A.S. tuple, including Richard Bland', () => {
    const sourceAssociates = sourcePlan().documents.filter((document) => (
      document.kind === 'as_degree' && document.status === 'extracted'
    ));
    const associates = buildFinalAssociateProjections();
    const bachelor = buildFinalProjection();
    expect(sourceAssociates).toHaveLength(19);
    expect(sourceAssociates.every((document) => document.degree_type === 'AS')).toBe(true);
    expect(associates).toHaveLength(19);
    expect(SHENANDOAH_SENDER_RECEIPTS).toHaveLength(19);
    expect(SHENANDOAH_SENDER_RECEIPTS.map((row) => row.numeric_id)).toContain(9317);

    let worstCaseResidentUnits = Infinity;
    for (const associate of associates) {
      const proof = shenandoahFigure34PairProof(bachelor, associate);
      expect(proof, associate._id).toMatchObject({
        applicable: true,
        ready: true,
        supported: true,
        qualifying_award: 'AS',
        university_general_education_domains_fulfilled: true,
        university_general_education_domain_units: 30,
        academic_unit_core_published: false,
        academic_unit_core_units: 0,
        unrestricted_elective_capacity_units: 35,
        articulation_residency_exception_selected: false,
        ordinary_final_resident_units: 30,
        proof: {
          bachelor_proof_tree_sha256: PROOF_TREE_SHA256,
          sender_award: 'AS',
          sender_tree_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          sender_source_bundle_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          articulation_residency_exception_selected: false,
        },
      });
      worstCaseResidentUnits = Math.min(
        worstCaseResidentUnits,
        proof.ordinary_minimum_shenandoah_units,
      );
    }
    // Two exact plans publish a 64-credit upper bound. Even that stronger
    // adversarial bound leaves 56 resident credits, not merely the 30 needed.
    expect(worstCaseResidentUnits).toBe(56);
  });

  it('applies the exact 30 GE + 35 elective split and never relabels all 65 credits as GE', () => {
    const bachelor = buildFinalProjection();
    const associate = buildFinalAssociateProjections()[0];
    const evaluated = _evaluateTemplate(
      bachelor, [], new Set(), new Map(), 'semester', 'semester', true,
      { associateDocument: associate },
    );
    expect(evaluated).toMatchObject({
      directAppliedUnits: 0,
      geCampusUnits: 30,
      lowerGeCampusUnits: 30,
      electiveCampusUnits: 35,
      lowerElectiveCampusUnits: 35,
      requirementRoleIssues: [],
      sourceBoundApplicationIssues: [],
      sourceBoundShenandoahAs: {
        applicable: true,
        ready: true,
        university_general_education_domain_units: 30,
        unrestricted_elective_capacity_units: 35,
      },
    });
  });

  it('retains current human review as the final Figure 3/4 publication blocker', () => {
    const bachelor = buildFinalProjection();
    const associate = buildFinalAssociateProjections()[0];
    const base = readinessForProjectedFigures(bachelor, {
      label: 'The bachelor-degree source', figures: ['3', '4'],
    });
    const pair = shenandoahFigure34PairProof(bachelor, associate);
    const readiness = shenandoahFigure34Readiness(bachelor, base, pair);
    expect(base).toMatchObject({
      ready: false,
      blockers: ['current_human_verification_required'],
      complete_degree_ready: false,
      figure_constraint_blockers: [],
    });
    expect(readiness).toMatchObject({
      ready: false,
      blockers: ['current_human_verification_required'],
      complete_degree_ready: false,
      figure_constraint_blockers: [],
      shenandoah_source_pair_figure_capability: true,
      shenandoah_source_pair_figure_ready: false,
      shenandoah_source_pair_proof: expect.objectContaining({
        bachelor_proof_tree_sha256: PROOF_TREE_SHA256,
      }),
    });
    expect(readiness.warning).toContain('current_human_verification_required');
  });

  it('fails closed on a new/non-A.S. sender and every sender identity, source, or tree drift', () => {
    const bachelor = buildFinalProjection();
    const associate = buildFinalAssociateProjections()[0];
    const mutations = [
      (document) => { document.degree_type = 'aas'; },
      (document) => { document.source_degree_type = 'AAS'; },
      (document) => {
        document.community_college_id = 9999;
        document.college_id = 'va:cc:9999';
        document._id = 'as_degree:9999:va-cs:local_as';
      },
      (document) => { document.college_name += ' renamed'; },
      (document) => { document.va_requirement_id += '-drift'; },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.requirement_groups[0].sections[0].unit_advisement += 1; },
      (document) => { document.total_units_max = 90; },
    ];
    for (const mutate of mutations) {
      const drift = structuredClone(associate);
      mutate(drift);
      const proof = shenandoahFigure34PairProof(bachelor, drift);
      expect(proof).toMatchObject({ applicable: true, ready: false, supported: false });
      const evaluated = _evaluateTemplate(
        bachelor, [], new Set(), new Map(), 'semester', 'semester', true,
        { associateDocument: drift },
      );
      expect(evaluated).toMatchObject({
        geCampusUnits: 0,
        electiveCampusUnits: 0,
        sourceBoundApplicationIssues: [expect.objectContaining({
          kind: 'shenandoah_as_general_education_domain_policy',
        })],
      });
    }
    expect(shenandoahFigure34PairProof(bachelor, null)).toMatchObject({
      applicable: true, ready: false, supported: false,
    });
  });

  it('fails closed on source drift, rule movement, any unit/core appearance, and projected-id drift', () => {
    const source = acceptedSource();
    const mutations = [
      (document) => { document.school_id = 9224; },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.sources[0].sha256 = '0'.repeat(64); },
      (document) => {
        const [rule] = document.requirement_groups[1].analysis_constraints.splice(0, 1);
        document.requirement_groups[0].analysis_constraints = [rule];
      },
      (document) => { document.requirement_groups[9].sections[0].unit_advisement = 64; },
      (document) => { document.unit_audit.academic_unit_core_units = 3; },
      (document) => {
        document.requirement_groups.push({
          title: 'New academic unit core',
          requirement_layer: 'academic_unit_core',
          sections: [],
        });
      },
      (document) => { document.data_quality_flags[1].message += ' changed'; },
      (document) => { document.requirement_layers.ge_college.note += ' changed'; },
      (document) => {
        document.requirement_groups[0].sections[0]
          .receivers[0].receiving.parent_id += 1;
      },
    ];
    for (const mutate of mutations) {
      const document = structuredClone(source);
      mutate(document);
      expect(exactShenandoahTree(document).supported).toBe(false);
    }

    const moved = structuredClone(source);
    const [constraint] = moved.requirement_groups[1].analysis_constraints.splice(0, 1);
    moved.requirement_groups[0].analysis_constraints = [constraint];
    expect(shenandoahSourceSpecificAffectedFigures(constraint, {
      document: moved,
      container: moved.requirement_groups[0],
      path: 'requirement_groups[0]',
    })).toBeNull();
    expect(affectedFiguresForConstraint(constraint, {
      document: moved,
      container: moved.requirement_groups[0],
      path: 'requirement_groups[0]',
    })).toEqual(['1', '3', '4', '6']);
  });

  it('adds a pair blocker without erasing human review when the sender proof drifts', () => {
    const bachelor = buildFinalProjection();
    const associate = buildFinalAssociateProjections()[0];
    const drift = structuredClone(associate);
    drift.source_degree_type = 'AAS';
    const base = readinessForProjectedFigures(bachelor, {
      label: 'The bachelor-degree source', figures: ['3', '4'],
    });
    const readiness = shenandoahFigure34Readiness(
      bachelor,
      base,
      shenandoahFigure34PairProof(bachelor, drift),
    );
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual([
      'current_human_verification_required',
      'shenandoah_pair_credential_proof_required',
    ]);
    expect(readiness.shenandoah_source_pair_figure_capability).toBe(false);
  });
});
