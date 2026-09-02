import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OVERLAP_MARKERS,
  PROOF_TREE_SHA256,
  SOURCE_RECEIPTS,
  evaluateUvaWiseResidencyPolicy,
  evaluateUvaWiseGeConstraint,
  exactUvaWiseTree,
  uvaWiseProofTreeFingerprint,
  uvaWiseVccsGaaWaiver,
} from './uvaWiseConstraintProofs';
import { VCCS_SENDER_RECEIPTS } from './uvaWiseTransferPolicyEvidence';
import {
  affectedFiguresForConstraint,
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { canonicalRequirementRole } from './canonicalRequirementRole';
import { evaluateVirginiaResidencyTransferPolicy } from './virginiaResidencyTransferCaps';
import { _evaluateTemplate } from './transferCreditRate';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const ROOT = path.resolve(__dirname, '../..');
const SLUG = 'the-university-of-virginia-s-college-at-wise';
const COMPOSED_PATH = path.join(ROOT, `.va-catalogs/composed/${SLUG}.json`);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const acceptedSource = () => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === `va:uni:${SLUG}`
));

function buildFinalProjection() {
  const sourcePlan = cachedAcceptedSourcePlan();
  const degree = sourcePlan.documents.find((document) => (
    document.institution_id === `va:uni:${SLUG}`
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9226);
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
    title: 'UVA Wise final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9226);
}

function buildCandidateAssociate(numericId = 9301) {
  const receipt = VCCS_SENDER_RECEIPTS.find((row) => row.numeric_id === numericId);
  const source = cachedAcceptedSourcePlan().documents.find((document) => (
    document._id === receipt.source_id
  ));
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === numericId);
  return buildProjection({
    courses: [], degrees: [], asDegrees: [source],
    institutions: [{
      _id: `va:cc:${college.slug}`, level: college.level, name: college.name,
    }],
  }).asDegrees[0];
}

function findRule(doc, kind) {
  for (const [groupIndex, group] of (doc.requirement_groups || []).entries()) {
    const constraint = (group.analysis_constraints || []).find((entry) => entry.kind === kind);
    if (constraint) return { group, groupIndex, constraint };
  }
  return null;
}

function blockers(audit, figure) {
  return [
    ...audit.active_rules.filter((row) => (
      !row.supported && row.affected_figures.includes(figure)
    )),
    ...audit.unit_audit.filter((row) => (
      row.blocking && row.affected_figures.includes(figure)
    )),
  ].map((row) => `${row.path}|${row.kind}`).sort();
}

describe('exact UVA Wise paper-figure proofs', () => {
  it('binds every retained official source role and the exact catalog statements', () => {
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const receipt of SOURCE_RECEIPTS) {
      const suffix = receipt.id === 'major' ? 'program'
        : receipt.id === 'general_education' ? 'ge' : receipt.id;
      const file = path.join(ROOT, `.va-catalogs/pages/${SLUG}__${suffix}.txt`);
      expect(sha(file), receipt.id).toBe(receipt.sha256);
    }
    const major = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__program.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    const ge = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__ge.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    const graduation = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__graduation.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    expect(major).toContain('At least two natural science with associated labs');
    expect(major).toContain('At least one additional 3000/4000-level mathematics course');
    expect(ge).toContain('Students who are placed into ENG 1030');
    expect(ge).toContain('SEM 1010 - Be Wise Credit(s): 3');
    expect(ge).toContain('One course may not be used to satisfy more than one');
    expect(graduation).toContain('maximum course work allowed toward graduation from a two-year institution is 62 hours');
    expect(graduation).toContain('minimum of 15 credit hours of upper-level courses completed in the major');
  });

  it('retains one whole-tree proof through composition, source, and final projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(uvaWiseProofTreeFingerprint))).toEqual(new Set([
      PROOF_TREE_SHA256,
    ]));
    expect(documents.map((doc) => exactUvaWiseTree(doc))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('proves only the four exact canonical route rules', () => {
    const kinds = [
      'published_first_year_experience_range',
      'accelerated_composition_credit_award',
      'accelerated_language_core_substitution',
      'major_course_substitutes_for_core_area',
    ];
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      for (const kind of kinds) {
        const found = findRule(doc, kind);
        expect(evaluateFourYearConstraint(found.constraint, {
          container: found.group,
          document: doc,
          path: `requirement_groups[${found.groupIndex}]`,
        }), `${kind}:${doc._id || doc.slug}`).toMatchObject({
          supported: true,
          evaluator: 'evaluateUvaWiseConstraint',
          proof: { rule_path: `requirement_groups[${found.groupIndex}]` },
        });
      }
    }
  });

  it('accepts exactly the ten source-bound overlap receipts', () => {
    const audit = auditFourYearDocument(acceptedSource());
    const overlaps = audit.active_rules.filter((row) => row.kind === 'overlap_key');
    expect(overlaps).toHaveLength(OVERLAP_MARKERS.length);
    expect(overlaps.map((row) => row.path)).toEqual(OVERLAP_MARKERS.map(([path]) => path));
    expect(overlaps).toEqual(overlaps.map((row) => expect.objectContaining({
      supported: true,
      evaluator: 'evaluateUvaWiseStructuralRule',
    })));
  });

  it('scopes fixed nontransferable rules away from Figures 3/4 but retains unproved GE attributes', () => {
    const source = acceptedSource();
    const expected = {
      prefix_and_level_course_menu: ['1', '6'],
      upper_division_prefix_distribution: ['1', '6'],
      no_double_count_with_core: ['1', '6'],
      contextual_subarea_minimums: ['3', '4', '6'],
      contextual_disciplinary_breadth: ['3', '4', '6'],
      inclusive_excellence_designation: ['3', '4', '6'],
      no_core_cross_area_double_count: ['3', '4', '6'],
    };
    for (const [kind, figures] of Object.entries(expected)) {
      const found = findRule(source, kind);
      expect(affectedFiguresForConstraint(found.constraint, {
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toEqual(figures);
    }

    const lab = findRule(source, 'two_distinct_lab_sciences_from_approved_disciplines');
    expect(evaluateFourYearConstraint(lab.constraint, {
      container: lab.group,
      document: source,
      path: `requirement_groups[${lab.groupIndex}]`,
    })).toMatchObject({
      supported: false,
      affected_figures: ['1', '3', '4', '6'],
      remediation: { category: 'targeted_source_research' },
    });

    const drift = structuredClone(source);
    drift.requirement_groups[12].sections[3].unit_advisement = 8;
    const contextual = findRule(drift, 'contextual_subarea_minimums');
    expect(affectedFiguresForConstraint(contextual.constraint, {
      container: contextual.group,
      document: drift,
      path: `requirement_groups[${contextual.groupIndex}]`,
    })).toEqual(['1', '3', '4', '6']);
  });

  it('proves only the Figure 3/4 capacity consequence of three contextual rules', () => {
    const safeKinds = [
      'contextual_subarea_minimums',
      'contextual_disciplinary_breadth',
      'no_core_cross_area_double_count',
    ];
    for (const document of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      for (const kind of safeKinds) {
        const found = findRule(document, kind);
        expect(evaluateUvaWiseGeConstraint(found.group, {
          constraint: found.constraint,
          document,
          path: `requirement_groups[${found.groupIndex}]`,
        }), `${kind}:${document._id || document.slug}`).toMatchObject({
          supported: false,
          affected_figures: ['6'],
          paper_impact_proven: true,
          proof: {
            rule_path: 'requirement_groups[12]',
            figure_3_4_capacity_exact: true,
            liberal_arts_core_units: 21,
            major_overlap_self_units: 3,
            remaining_contextual_capacity_units: 18,
            all_witness_courses_below_3000: true,
            selected_course_codes: [
              'SWE1790', 'SOC1100', 'POL1010', 'ANT1020',
              'HED2230', 'HIS1070', 'GEO2020',
            ],
            figure_6_identity_and_prerequisites_exact: false,
          },
        });
        expect(evaluateFourYearConstraint(found.constraint, {
          container: found.group,
          document,
          path: `requirement_groups[${found.groupIndex}]`,
        }), `dispatcher:${kind}:${document._id || document.slug}`).toMatchObject({
          supported: false,
          evaluator: 'evaluateUvaWiseGeConstraint',
          affected_figures: ['6'],
          paper_impact_proven: true,
          remediation: {
            category: kind === 'no_core_cross_area_double_count'
              ? 'evaluator_engineering' : 'targeted_source_research',
          },
          proof: {
            figure_3_4_capacity_exact: true,
            remaining_contextual_capacity_units: 18,
          },
        });
      }
    }
  });

  it('never promotes Inclusive Excellence or the broader major-lab rule', () => {
    const source = acceptedSource();
    for (const kind of [
      'inclusive_excellence_designation',
      'two_distinct_lab_sciences_from_approved_disciplines',
    ]) {
      const found = findRule(source, kind);
      expect(evaluateUvaWiseGeConstraint(found.group, {
        constraint: found.constraint,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toMatchObject({
        supported: false,
        affected_figures: ['1', '3', '4', '6'],
        reason: expect.stringContaining('no exact UVA Wise GE-capacity evaluator'),
      });
    }
  });

  it('fails the contextual capacity proof closed on tree, path, and declaration drift', () => {
    const source = acceptedSource();
    const found = findRule(source, 'contextual_subarea_minimums');
    const cases = [
      {
        document: source,
        container: found.group,
        path: 'requirement_groups[11]',
      },
      {
        document: source,
        container: source.requirement_groups[11],
        path: 'requirement_groups[12]',
      },
      (() => {
        const document = structuredClone(source);
        document.requirement_groups[12].sections[3].unit_advisement = 8;
        const drifted = findRule(document, 'contextual_subarea_minimums');
        return {
          document,
          container: drifted.group,
          path: `requirement_groups[${drifted.groupIndex}]`,
          constraint: drifted.constraint,
        };
      })(),
    ];
    for (const row of cases) {
      const result = evaluateUvaWiseGeConstraint(row.container, {
        constraint: row.constraint || found.constraint,
        document: row.document,
        path: row.path,
      });
      expect(result.supported).toBe(false);
      expect(result.affected_figures).toEqual(['1', '3', '4', '6']);
      expect(result.paper_impact_proven).not.toBe(true);
    }
  });

  it('does not dispatch the exact UVA Wise Core-reuse rule through VCU', () => {
    const source = acceptedSource();
    const found = findRule(source, 'no_double_count_with_core');
    expect(evaluateFourYearConstraint(found.constraint, {
      container: found.group,
      document: source,
      path: `requirement_groups[${found.groupIndex}]`,
    })).toMatchObject({
      supported: false,
      evaluator: 'evaluateInstitutionSpecificNoDoubleCountWithCore',
      affected_figures: ['1', '6'],
      reason: expect.stringContaining('exact UVA Wise upper-major carrier'),
    });
    expect(auditFourYearDocument(source).active_rules.find((row) => (
      row.kind === 'no_double_count_with_core'
    ))).toMatchObject({
      supported: false,
      affected_figures: ['1', '6'],
    });
  });

  it('classifies the exact ten-credit remainder as elective capacity at runtime', () => {
    const projection = buildFinalProjection();
    const group = projection.requirement_groups[14];
    expect(canonicalRequirementRole(projection, group, group.sections[0])).toMatchObject({
      exact: true,
      role: 'elective_capacity',
      evidence: {
        source_bound_evaluator: 'uvaWiseRequirementRole',
        exact_capacity_units: 10,
      },
    });
    const state = _evaluateTemplate(
      projection, [], new Set(), new Map(), 'semester', 'semester', true,
    );
    // 41, not 33: `requirement_groups[2]` is "Two approved natural sciences
    // with associated laboratories" -- 8 breadth credits behind a single open
    // `ge_area` receiver. Every receiver in that section is an open category,
    // so no named articulation can ever reach it, and it is general-education
    // demand. It went uncounted while `isGeOnlySection` excluded every Virginia
    // section outright, which contradicted its own comment ("Only an all-GE
    // Virginia section is GE-only") and left Virginia associate degrees
    // supplying ~0 GE units against bachelor programs demanding ~44% breadth.
    // The 10-credit open capacity in group 14 is still elective, because the
    // canonical role resolves before the GE path.
    expect(state).toMatchObject({
      geCampusUnits: 41,
      electiveCampusUnits: 10,
      requirementRoleIssues: [],
    });

    const drift = structuredClone(projection);
    drift.requirement_groups[14].sections[0].unit_advisement = 9;
    const driftGroup = drift.requirement_groups[14];
    expect(canonicalRequirementRole(drift, driftGroup, driftGroup.sections[0])).toMatchObject({
      exact: false,
      role: 'ambiguous',
      issues: ['unrefined_university_graduation_role'],
    });
  });

  it('enforces all exact UVA Wise two-year residency ceilings', () => {
    const source = acceptedSource();
    expect(evaluateUvaWiseResidencyPolicy(source)).toMatchObject({
      supported: true,
      overall_transfer_cap_units: 75,
      two_year_transfer_cap_units: 62,
      effective_two_year_transfer_cap_units: 62,
      proof: {
        fixed_nontransferable_upper_major_units: 15,
        standard_exception_selected: false,
      },
    });
    expect(evaluateVirginiaResidencyTransferPolicy(source)).toMatchObject({
      supported: true,
      evaluator: 'evaluateUvaWiseResidencyPolicy',
      effective_two_year_transfer_cap_units: 62,
    });

    for (const mutate of [
      (doc) => { doc.unit_audit.two_year_transfer_units_maximum = 63; },
      (doc) => { doc.unit_audit.major_upper_level_residency_minimum = 14; },
      (doc) => { doc.requirement_groups[4].sections[1].unit_advisement = 5; },
    ]) {
      const drift = structuredClone(source);
      mutate(drift);
      expect(evaluateUvaWiseResidencyPolicy(drift)).toBeNull();
      expect(evaluateVirginiaResidencyTransferPolicy(drift)).toMatchObject({ supported: false });
    }
  });

  it('makes the successful GAA path explicit and leaves ordinary/RBC/drift routes unpoisoned', () => {
    const bachelor = buildFinalProjection();
    const sender = buildCandidateAssociate(9301);
    expect(uvaWiseVccsGaaWaiver(bachelor, sender)).toMatchObject({
      applicable: false,
      ready: false,
      scenario_selected: false,
    });
    expect(uvaWiseVccsGaaWaiver(bachelor, sender, {
      scenario: 'successful_gaa_participant',
    })).toMatchObject({
      applicable: true,
      ready: true,
      scenario: 'successful_gaa_participant',
      projection_receipt_cohort: 'candidate',
      qualifying_cip_code: '11.0701',
      successful_gaa_conditions_required: true,
      ordinary_non_gap_transfer_waiver: false,
      major_specific_two_lab_sciences_waived: false,
    });

    const richardBland = { community_college_id: 9317 };
    expect(uvaWiseVccsGaaWaiver(bachelor, richardBland, {
      scenario: 'successful_gaa_participant',
    })).toMatchObject({
      applicable: false, ready: false, bonus_denied: true, source_system: 'RBC',
    });
    const ordinaryRbc = _evaluateTemplate(
      bachelor, [], new Set(), new Map(), 'semester', 'semester', true,
      {
        associateDocument: richardBland,
        uvaWiseGaaScenario: 'successful_gaa_participant',
      },
    );
    expect(ordinaryRbc.sourceBoundApplicationIssues).not.toContainEqual(
      expect.objectContaining({ kind: 'uva_wise_vccs_gaa_policy' }),
    );
    expect(ordinaryRbc.sourceBoundUvaWiseVccsGaa).toBeUndefined();

    const drift = structuredClone(sender);
    drift.requirement_groups[0].sections.pop();
    expect(uvaWiseVccsGaaWaiver(bachelor, drift, {
      scenario: 'successful_gaa_participant',
    })).toMatchObject({
      applicable: false, ready: false, bonus_denied: true,
    });
    const ordinaryDrift = _evaluateTemplate(
      bachelor, [], new Set(), new Map(), 'semester', 'semester', true,
      {
        associateDocument: drift,
        uvaWiseGaaScenario: 'successful_gaa_participant',
      },
    );
    expect(ordinaryDrift.sourceBoundApplicationIssues).not.toContainEqual(
      expect.objectContaining({ kind: 'uva_wise_vccs_gaa_policy' }),
    );
    expect(ordinaryDrift.sourceBoundUvaWiseVccsGaa).toBeUndefined();
  });

  it('fails closed on identity, receipt, source-ref, rule, variant, accounting, and id drift', () => {
    const source = acceptedSource();
    const mutations = [
      (doc) => { doc.school_id = 9226; },
      (doc) => { doc.provenance.source_bundle_hash = '0'.repeat(64); },
      (doc) => { doc.sources[0].sha256 = '0'.repeat(64); },
      (doc) => { doc.requirement_groups[7].source_refs = ['major']; },
      (doc) => { doc.requirement_groups[7].canonical_section_index = 1; },
      (doc) => { doc.requirement_groups[0].sections[0].receivers[0].overlap_key = 'changed'; },
      (doc) => { doc.requirement_variants[1].requirement_groups[0].sections[0].receivers.pop(); },
      (doc) => { doc.unit_audit.canonical_net_liberal_arts_core_units = 32; },
      (doc) => { doc.requirement_groups[3].sections[0].receivers[0].receiving.parent_id += 1; },
    ];
    for (const mutate of mutations) {
      const doc = structuredClone(source);
      mutate(doc);
      expect(exactUvaWiseTree(doc).supported).toBe(false);
    }
  });

  it('keeps exact source/final blocker parity and reports the residual source needs', () => {
    const sourceAudit = auditFourYearDocument(acceptedSource());
    const projectedAudit = auditFourYearDocument(buildFinalProjection());
    expect(sourceAudit.summary).toMatchObject({
      supported_active_rules: 14,
      blocked_active_rules: 8,
      blocked_unit_audit_rules: 2,
      blocked_rules_by_figure: { '1': 4, '3': 2, '4': 2, '6': 8 },
      ready_by_figure: { '1': false, '3': false, '4': false, '6': false },
    });
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockers(projectedAudit, figure), `Figure ${figure}`)
        .toEqual(blockers(sourceAudit, figure));
    }
    expect(auditFourYearAnalysisQualityFlags(acceptedSource())).toContainEqual(
      expect.objectContaining({
        code: 'liberal_arts_core_cross_area_constraints',
        affected_figures: ['3', '4', '6'],
      }),
    );
  });
});
