import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import {
  GMU_SOURCE_RECEIPTS,
  ODU_GENERAL_TRANSFER_GRADE_SOURCE_TEXT,
  ODU_MAJOR_GRADE_SOURCE_TEXT,
  ODU_SOURCE_RECEIPTS,
  ODU_UPPER_GE_SAMPLE_ROW,
  ODU_UPPER_GE_SOURCE_TEXT,
  evaluateGmuResidencyPolicy,
  evaluateOduAdministrativePolicy,
  evaluateOduRequiredCsGradePolicy,
  evaluateOduResidencyPolicy,
  exactGmuConditionalScienceShape,
  exactGmuSeniorShape,
  exactOduGraduationPolicyShape,
  exactOduTechnicalShape,
  exactOduUpperCsShape,
  exactOduUpperGeShape,
  gmuOduFigure6Selection,
  oduSectionTier,
} from './georgeMasonOldDominionConstraintProofs';
import { assemblePathway } from './pathwayComplexity';
import { buildDegreeGroups, computeUnitBudget, resolveSectionTier } from '../degreeSlots';
import { canonicalSourceContract } from './canonicalSourceContract';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { _evaluateTemplate as evaluateTemplate } from './transferCreditRate';
import { courseIdFor, projectInstitutionReceivingGroups } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const COMPOSED = path.resolve(__dirname, '../../.va-catalogs/composed');
const load = (slug) => JSON.parse(fs.readFileSync(path.join(COMPOSED, `${slug}.json`), 'utf8'));
const projected = (slug) => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.school_id === `va:uni:${slug}`
));

function finalOduProjection() {
  const plan = cachedAcceptedSourcePlan();
  const degree = plan.documents.find((document) => (
    document._id === 'va:degree:old-dominion-university:cs'
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9218);
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
    title: 'Old Dominion final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9218);
}

const findConstraint = (doc, kind) => {
  for (const group of doc.requirement_groups || []) {
    const constraint = (group.analysis_constraints || []).find((row) => row.kind === kind);
    if (constraint) return { group, constraint };
  }
  return null;
};

const codesFor = (document) => {
  const parentCodes = new Map();
  for (const group of document.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        const codes = String(receiver.code_seen || '').split(/\s*\+\s*/).filter(Boolean);
        const parentIds = receiver.receiving?.kind === 'series'
          ? receiver.receiving.parent_ids || []
          : receiver.receiving?.parent_id != null ? [receiver.receiving.parent_id] : [];
        parentIds.forEach((parentId, index) => parentCodes.set(parentId, codes[index]));
      }
    }
  }
  return parentCodes;
};

const residentVertices = (degree) => {
  const ucCodeByParent = codesFor(degree);
  const ucCatalog = new Map([...ucCodeByParent.values()].filter(Boolean).map((code) => [
    code, { id: `uc:${code}`, units: 3 },
  ]));
  return assemblePathway({
    degree,
    asIds: [],
    agreementByParent: new Map(),
    ucCatalog,
    ucCodeByParent,
    ccUnits: new Map(),
  }).vertices;
};

describe('exact George Mason and Old Dominion constraint proofs', () => {
  it('binds the GMU conditional-science route to all five official receipts', () => {
    const suffixes = {
      major: 'program', general_education: 'ge', college: 'college',
      graduation: 'graduation', course_catalog: 'course_catalog',
    };
    for (const receipt of GMU_SOURCE_RECEIPTS) {
      const source = path.join(
        COMPOSED, `../pages/george-mason-university__${suffixes[receipt.id]}.txt`,
      );
      expect(createHash('sha256').update(fs.readFileSync(source)).digest('hex'))
        .toBe(receipt.sha256);
    }
    const major = fs.readFileSync(path.join(
      COMPOSED, '../pages/george-mason-university__program.txt',
    ), 'utf8');
    const ge = fs.readFileSync(path.join(
      COMPOSED, '../pages/george-mason-university__ge.txt',
    ), 'utf8');
    expect(major).toContain('The remaining four natural science credits may be another course that uses the chosen sequence as a required prerequisite, or any course from the Mason Core natural science list in a different subject.');
    expect(ge).toContain('BIOL 102Introductory Biology I-Survey of Biodiversity and Ecology (Mason Core)4');
  });

  it('passes both composed sources and their shared-schema projections', () => {
    for (const [slug, proof] of [
      ['george-mason-university', exactGmuSeniorShape],
      ['old-dominion-university', exactOduUpperCsShape],
    ]) {
      expect(proof(load(slug)), `${slug}:source`).toMatchObject({ supported: true });
      expect(proof(projected(slug)), `${slug}:projection`).toMatchObject({ supported: true });
    }
    for (const doc of [load('old-dominion-university'), projected('old-dominion-university')]) {
      expect(exactOduTechnicalShape(doc)).toMatchObject({ supported: true });
      expect(exactOduUpperGeShape(doc)).toMatchObject({
        supported: true,
        proof: { canonical_section_index: 3, canonical_units: 6 },
      });
    }
    for (const doc of [load('george-mason-university'), projected('george-mason-university')]) {
      expect(evaluateGmuResidencyPolicy(doc)).toMatchObject({
        supported: true,
        effective_two_year_transfer_cap_units: 90,
        proof: {
          fixed_nonarticulable_upper_major_units: 25,
          upper_major_residency_minimum_units: 12,
        },
      });
    }
    const finalGmu = structuredClone(projected('george-mason-university'));
    Object.assign(finalGmu, {
      _id: 'degree:9210:va-cs',
      school_id: 9210,
      institution_id: 'va:uni:9210',
      va_requirement_id: 'va:degree:george-mason-university:cs',
      major_slug: 'va-cs',
      state: 'va',
      analysis_contract: canonicalSourceContract(),
    });
    finalGmu.requirement_groups = projectInstitutionReceivingGroups(
      finalGmu.requirement_groups,
      'va:uni:9210',
    );
    delete finalGmu.slug;
    expect(evaluateGmuResidencyPolicy(finalGmu)).toMatchObject({ supported: true });
    expect(computeUnitBudget(finalGmu.requirement_groups, { sourceDocument: finalGmu }))
      .toMatchObject({ per_tier: { nontransferable: 51 } });
  });

  it('binds the ODU residency and grade scope to every official receipt and projection', () => {
    const suffixes = {
      major: 'program', general_education: 'ge', college: 'college',
      policy: 'policy', course_catalog: 'course_catalog',
    };
    for (const receipt of ODU_SOURCE_RECEIPTS) {
      const source = path.join(
        COMPOSED, `../pages/old-dominion-university__${suffixes[receipt.id]}.txt`,
      );
      expect(createHash('sha256').update(fs.readFileSync(source)).digest('hex'))
        .toBe(receipt.sha256);
    }
    expect(fs.readFileSync(path.join(
      COMPOSED, '../pages/old-dominion-university__program.txt',
    ), 'utf8')).toContain(ODU_MAJOR_GRADE_SOURCE_TEXT);
    expect(fs.readFileSync(path.join(
      COMPOSED, '../pages/old-dominion-university__ge.txt',
    ), 'utf8')).toContain(ODU_GENERAL_TRANSFER_GRADE_SOURCE_TEXT);
    const majorText = fs.readFileSync(path.join(
      COMPOSED, '../pages/old-dominion-university__program.txt',
    ), 'utf8');
    expect(majorText).toContain(ODU_UPPER_GE_SOURCE_TEXT);
    expect(majorText.match(new RegExp(ODU_UPPER_GE_SAMPLE_ROW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')))
      .toHaveLength(2);

    const receiptHash = (id) => ODU_SOURCE_RECEIPTS.find((receipt) => receipt.id === id).sha256;

    const documents = [
      load('old-dominion-university'),
      projected('old-dominion-university'),
      finalOduProjection(),
    ];
    for (const document of documents) {
      expect(exactOduGraduationPolicyShape(document)).toMatchObject({
        supported: true,
        proof: {
          overall_residency_minimum_units: 30,
          upper_major_residency_minimum_units: 12,
          resident_upper_cs_elective_units: 9,
          resident_writing_course: 'CS411W',
          resident_writing_course_units: 3,
          fixed_resident_upper_major_units: 12,
        },
      });
      expect(evaluateOduResidencyPolicy(document)).toMatchObject({
        supported: true,
        evaluator: 'evaluateOduResidencyPolicy',
        overall_transfer_cap_units: 90,
        effective_two_year_transfer_cap_units: 90,
        declared_subrules: [
          'overall_residency', 'major_upper_division_residency',
          'writing_intensive_residency',
        ],
      });
      expect(evaluateOduRequiredCsGradePolicy(document)).toMatchObject({
        supported: false,
        paper_impact_proven: true,
        affected_figures: [],
        proof: {
          grade_source_receipts: {
            major: receiptHash('major'),
            general_education: receiptHash('general_education'),
          },
          minimum_grade: 'C',
          policy_scope: [
            'required_cs_prerequisite_and_writing_grade_eligibility',
            'general_transfer_credit_grade_eligibility',
          ],
          paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
          general_transfer_grade_threshold_conditioned: true,
          categorical_minimum_grade_predicates: true,
          discretionary_application: false,
          timing_dependent_branch: false,
          course_substitution_or_identity_change: false,
          credit_unit_change_when_condition_met: 0,
          carrier_units: 0,
          carrier_course_identities: 0,
        },
      });
      for (const [kind, condition] of [
        ['minimum_cumulative_gpa', 'minimum_overall_cumulative_gpa'],
        ['minimum_major_gpa', 'minimum_major_cumulative_gpa'],
        ['senior_assessment_required', 'senior_assessment_completion'],
      ]) {
        expect(evaluateOduAdministrativePolicy(document, kind)).toMatchObject({
          supported: false,
          paper_impact_proven: true,
          affected_figures: [],
          evaluator: 'evaluateOduAdministrativePolicy',
          proof: {
            condition,
            carrier_units: 0,
            carrier_course_identities: 0,
            course_selection_change_when_condition_met: 0,
            credit_unit_change_when_condition_met: 0,
          },
        });
      }
    }
  });

  it('enforces only fixed CS 411W as an additional ODU-resident section', () => {
    const documents = [
      load('old-dominion-university'),
      projected('old-dominion-university'),
      finalOduProjection(),
    ];
    for (const document of documents) {
      const group = document.requirement_groups[0];
      const writing = group.sections[13];
      expect(oduSectionTier(document, group, writing)).toMatchObject({
        tier: 'nontransferable',
        proof: { section_path: 'requirement_groups[0].sections[13]', course: 'CS411W', units: 3 },
      });
      expect(resolveSectionTier(group, writing, document)).toBe('nontransferable');
      expect(oduSectionTier(
        document, document.requirement_groups[1], document.requirement_groups[1].sections[0],
      )).toMatchObject({
        tier: 'nontransferable',
        proof: {
          section_path: 'requirement_groups[1].sections[0]',
          selected_courses: ['CS312', 'CS337', 'CS402'],
          units: 9,
        },
      });
      expect(resolveSectionTier(group, group.sections[12], document)).toBe('transferable');
    }

    for (const document of documents.slice(1)) {
      expect(computeUnitBudget(document.requirement_groups, { sourceDocument: document }))
        .toMatchObject({
          modeled_units: 120,
          per_tier: { transferable: 67, breadth: 35, nontransferable: 18 },
        });
      const everyParent = new Set([...codesFor(document).keys()]);
      const coverage = buildDegreeGroups(document.requirement_groups, {
        articulated: everyParent,
        sourceDocument: document,
      });
      expect(coverage.groups.find((row) => row.label === 'Required Computer Science courses'))
        .toMatchObject({ total: 18, covered: 17 });
      expect(coverage.units.covered).toBe(87);
    }
    const finalCoverage = buildDegreeGroups(
      documents[2].requirement_groups,
      { articulated: new Set([...codesFor(documents[2]).keys()]), sourceDocument: documents[2] },
    );
    // `ge_total`/`ge_covered` carry the general-education share of these same
    // units, so the units-no-GE lens can subtract it. Asserted here rather than
    // loosened to toMatchObject: this proof is about the exact shape.
    expect(finalCoverage.units).toEqual({ total: 120, covered: 87, ge_total: 41, ge_covered: 35 });
  });

  it('fails the ODU residency, grade scope, and writing tier closed on policy drift', () => {
    const mutations = [];
    const changedReceipt = structuredClone(projected('old-dominion-university'));
    changedReceipt.sources[0].sha256 = '0'.repeat(64);
    mutations.push(changedReceipt);

    const changedGeReceipt = structuredClone(projected('old-dominion-university'));
    changedGeReceipt.sources.find((source) => source.id === 'general_education').sha256 = 'f'.repeat(64);
    mutations.push(changedGeReceipt);

    const changedResidency = structuredClone(load('old-dominion-university'));
    changedResidency.unit_audit.residency.minimum_units = 29;
    mutations.push(changedResidency);

    const changedUpperMajor = structuredClone(load('old-dominion-university'));
    changedUpperMajor.unit_audit.major_upper_division_residency_minimum = 11;
    mutations.push(changedUpperMajor);

    const changedWriting = structuredClone(load('old-dominion-university'));
    changedWriting.requirement_groups[0].sections[13].receivers[0].code = 'CS410';
    mutations.push(changedWriting);

    const changedGrade = structuredClone(load('old-dominion-university'));
    changedGrade.unit_audit.required_non_elective_cs_minimum_grade = 'B';
    mutations.push(changedGrade);

    const courseBearingGradeGate = structuredClone(load('old-dominion-university'));
    courseBearingGradeGate.requirement_groups[13].sections[0].units = 3;
    courseBearingGradeGate.requirement_groups[13].sections[0].receivers[0].units = 3;
    mutations.push(courseBearingGradeGate);

    const transferAuthority = structuredClone(load('old-dominion-university'));
    transferAuthority.requirement_groups[13].requirement_layer = 'transfer_admission';
    mutations.push(transferAuthority);

    for (const document of mutations) {
      expect(exactOduGraduationPolicyShape(document).supported).toBe(false);
      expect(evaluateOduResidencyPolicy(document)).toBeNull();
      expect(evaluateOduRequiredCsGradePolicy(document)).toBeNull();
      expect(oduSectionTier(
        document,
        document.requirement_groups[0],
        document.requirement_groups[0].sections[13],
      )).toBeNull();
    }

    const gradeAudit = auditFourYearDocument(changedGrade);
    expect(gradeAudit.unit_audit.find((row) => (
      row.kind === 'required_non_elective_cs_minimum_grade'
    ))).toMatchObject({
      supported: false,
      blocking: true,
      paper_impact_proven: false,
      affected_figures: ['3', '4'],
    });
  });

  it('supports all seven exact course-selection rules without broad kind exemptions', () => {
    const gmu = load('george-mason-university');
    for (const kind of ['distinct_courses_across_sections', 'no_double_count_with_other_groups']) {
      const { group, constraint } = findConstraint(gmu, kind);
      expect(evaluateFourYearConstraint(constraint, { container: group, document: gmu }))
        .toMatchObject({ supported: true, affected_figures: ['1', '3', '4', '6'] });
    }
    const conditionalScience = findConstraint(gmu, 'prerequisite_or_different_subject');
    expect(evaluateFourYearConstraint(conditionalScience.constraint, {
      container: conditionalScience.group, document: gmu,
    })).toMatchObject({
      supported: true,
      affected_figures: ['1', '3', '4', '6'],
      proof: {
        course_count: 1,
        campus_units: 4,
        selected_sequence_codes: ['CHEM211', 'CHEM213', 'CHEM212', 'CHEM214'],
        selected_additional_science_code: 'BIOL102',
        subjects_distinct: true,
        figure_6_concrete_identity: 'BIOL102',
        conditional_prerequisite_edge_required: false,
      },
    });

    const odu = load('old-dominion-university');
    for (const kind of [
      'minimum_upper_level_credits_across_menu',
      'no_double_count_with_required_major_choices',
    ]) {
      const { group, constraint } = findConstraint(odu, kind);
      expect(evaluateFourYearConstraint(constraint, { container: group, document: odu }))
        .toMatchObject({ supported: true, affected_figures: ['1', '3', '4', '6'] });
    }
    const technical = findConstraint(odu, 'no_double_count_with_other_degree_requirement');
    expect(evaluateFourYearConstraint(technical.constraint, {
      container: technical.group, document: odu,
    })).toMatchObject({
      supported: true,
      affected_figures: ['1', '3', '4', '6'],
      proof: { figures_1_3_4_joint_pair_solver: true, figure_6_enforced: true },
    });
    const upperGe = findConstraint(odu, 'upper_division_ge_alternate_path');
    expect(evaluateFourYearConstraint(upperGe.constraint, {
      container: upperGe.group, document: odu,
    })).toMatchObject({
      supported: true,
      affected_figures: ['1', '3', '4', '6'],
      proof: {
        canonical_course_slots: 2,
        canonical_units_per_slot: 3,
        figure_6_open_course_slots: 2,
      },
    });
  });

  it('accounts for every exact structural marker without hiding residual blockers', () => {
    const gmu = auditFourYearDocument(load('george-mason-university'));
    expect(gmu.summary).toMatchObject({
      active_rules: 14,
      supported_active_rules: 14,
      blocked_active_rules: 0,
      blocked_rules_by_figure: { 1: 0, 3: 0, 4: 0, 6: 0 },
    });
    expect(gmu.active_rules.filter((row) => !row.supported)).toEqual([]);
    expect(gmu.active_rules.filter((row) => row.kind === 'overlap_key')).toHaveLength(10);
    expect(gmu.active_rules.filter((row) => row.kind === 'overlap_key')
      .every((row) => row.supported)).toBe(true);

    const odu = auditFourYearDocument(load('old-dominion-university'));
    expect(odu.summary).toMatchObject({
      active_rules: 21,
      supported_active_rules: 21,
      blocked_active_rules: 0,
      blocked_unit_audit_rules: 4,
      blocked_rules_by_figure: { 1: 0, 3: 0, 4: 0, 6: 0 },
      ready_by_figure: { 1: true, 3: true, 4: true, 6: true },
    });
    expect(odu.active_rules.filter((row) => row.kind === 'overlap_key')).toHaveLength(15);
    expect(odu.active_rules.filter((row) => row.kind === 'overlap_key')
      .every((row) => row.supported)).toBe(true);
    expect(odu.unit_audit.find((row) => row.kind === 'residency')).toMatchObject({
      supported: true,
      blocking: false,
      evaluator: 'evaluateOduResidencyPolicy',
      affected_figures: ['3', '4'],
    });
    expect(odu.unit_audit.find((row) => (
      row.kind === 'required_non_elective_cs_minimum_grade'
    ))).toMatchObject({
      supported: false,
      blocking: true,
      paper_impact_proven: true,
      affected_figures: [],
      remediation: { category: 'out_of_scope_administrative_rule' },
    });
  });

  it('fails closed on institution, authority, count, unit, roster, or marker drift', () => {
    const mutations = [];
    const wrongInstitution = structuredClone(load('george-mason-university'));
    wrongInstitution.slug = 'not-george-mason';
    mutations.push([exactGmuSeniorShape, wrongInstitution, /bound to/]);

    const wrongRefs = structuredClone(load('george-mason-university'));
    wrongRefs.requirement_groups[1].source_refs = ['major', 'graduation'];
    mutations.push([exactGmuSeniorShape, wrongRefs, /authority/]);

    const wrongDegreeTotal = structuredClone(load('george-mason-university'));
    wrongDegreeTotal.total_units = 121;
    mutations.push([exactGmuSeniorShape, wrongDegreeTotal, /120-credit/]);

    const wrongGmuReceipt = structuredClone(projected('george-mason-university'));
    wrongGmuReceipt.sources.find((source) => source.id === 'general_education').sha256 = '0'.repeat(64);
    mutations.push([exactGmuSeniorShape, wrongGmuReceipt, /source roles or text hashes/]);

    const wrongAsk = structuredClone(load('george-mason-university'));
    wrongAsk.requirement_groups[1].sections[1].select = 2;
    mutations.push([exactGmuSeniorShape, wrongAsk, /choose counts/]);

    const wrongUnits = structuredClone(load('old-dominion-university'));
    wrongUnits.requirement_groups[1].sections[0].receivers[1].units = 2;
    mutations.push([exactOduUpperCsShape, wrongUnits, /roster changed/]);

    const wrongRoster = structuredClone(load('old-dominion-university'));
    wrongRoster.requirement_groups[1].sections[0].receivers[1].code = 'CS999';
    mutations.push([exactOduUpperCsShape, wrongRoster, /roster changed/]);

    const wrongMarker = structuredClone(load('old-dominion-university'));
    wrongMarker.requirement_groups[1].sections[0].receivers[4].overlap_key = 'wrong';
    mutations.push([exactOduUpperCsShape, wrongMarker, /marker inventory/]);

    const extraMarker = structuredClone(load('old-dominion-university'));
    extraMarker.requirement_groups[1].sections[0].receivers[0].overlap_key = 'invented';
    mutations.push([exactOduUpperCsShape, extraMarker, /marker inventory/]);

    const extraCrossGroupCourse = structuredClone(load('george-mason-university'));
    extraCrossGroupCourse.requirement_groups[4].sections[0].receivers[0].code = 'CS425';
    mutations.push([exactGmuSeniorShape, extraCrossGroupCourse, /intersection/]);

    const wrongCanonical = structuredClone(load('old-dominion-university'));
    wrongCanonical.requirement_groups[12].canonical_section_index = 2;
    mutations.push([exactOduUpperGeShape, wrongCanonical, /canonical route/]);

    const wrongOptionDCount = structuredClone(load('old-dominion-university'));
    wrongOptionDCount.requirement_groups[12].sections[3].receivers[0].name =
      'One open six-credit course';
    mutations.push([exactOduUpperGeShape, wrongOptionDCount, /route counts or credit bounds/]);

    const wrongScience = structuredClone(load('old-dominion-university'));
    wrongScience.requirement_groups[10].sections[0].receivers[4].codes[1] = 'OEAS999N';
    mutations.push([exactOduTechnicalShape, wrongScience, /sequence roster/]);

    const wrongScienceContext = structuredClone(load('old-dominion-university'));
    wrongScienceContext.requirement_groups[10].requirement_layer = 'major';
    mutations.push([exactOduTechnicalShape, wrongScienceContext, /sequence roster/]);

    const wrongTechnicalContext = structuredClone(load('old-dominion-university'));
    wrongTechnicalContext.requirement_groups[3].cc_articulable = false;
    mutations.push([exactOduTechnicalShape, wrongTechnicalContext, /authority or OR selection/]);

    const wrongProjectedIdentity = structuredClone(projected('old-dominion-university'));
    wrongProjectedIdentity.requirement_groups[10].sections[0]
      .receivers[0].receiving.parent_ids[0] += 1;
    mutations.push([exactOduTechnicalShape, wrongProjectedIdentity, /sequence roster/]);

    const extraScienceIntersection = structuredClone(load('old-dominion-university'));
    extraScienceIntersection.requirement_groups[4].sections[0].receivers[0].code = 'BIOL122N';
    mutations.push([exactOduTechnicalShape, extraScienceIntersection, /science-sequence.*intersection/]);

    for (const [proof, doc, reason] of mutations) {
      expect(proof(doc)).toMatchObject({ supported: false, reason: expect.stringMatching(reason) });
      expect(gmuOduFigure6Selection(doc).ready).toBe(false);
    }

    const wrongConditionalUnits = structuredClone(load('george-mason-university'));
    wrongConditionalUnits.requirement_groups[6].sections[0].units = 3;
    expect(exactGmuConditionalScienceShape(wrongConditionalUnits)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/count, units, or identity-free carrier/),
    });

    const wrongSelectedScience = structuredClone(load('george-mason-university'));
    wrongSelectedScience.requirement_groups[5].sections[0].receivers[2].codes[0] = 'CHEM999';
    expect(exactGmuConditionalScienceShape(wrongSelectedScience)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/laboratory-sequence.*roster/),
    });
    expect(gmuOduFigure6Selection(wrongSelectedScience).ready).toBe(false);

    const concreteConditionalIdentity = structuredClone(projected('george-mason-university'));
    concreteConditionalIdentity.requirement_groups[6].sections[0]
      .receivers[0].receiving.parent_id = 123456;
    expect(exactGmuConditionalScienceShape(concreteConditionalIdentity)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/identity-free carrier/),
    });

    const articulatedConditionalBlock = structuredClone(projected('george-mason-university'));
    articulatedConditionalBlock.requirement_groups[6].assist_requirement = 'Natural Science';
    expect(exactGmuConditionalScienceShape(articulatedConditionalBlock)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/identity-free carrier/),
    });

    const mixedFinalIdentity = structuredClone(projected('george-mason-university'));
    Object.assign(mixedFinalIdentity, {
      _id: 'degree:9210:va-cs',
      school_id: 9211,
      institution_id: 'va:uni:9210',
      va_requirement_id: 'va:degree:george-mason-university:cs',
      major_slug: 'va-cs',
    });
    expect(exactGmuSeniorShape(mixedFinalIdentity)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/bound to/),
    });

    const transferableResidentCourse = structuredClone(load('george-mason-university'));
    transferableResidentCourse.requirement_groups[0].sections[4].cc_articulable = true;
    expect(evaluateGmuResidencyPolicy(transferableResidentCourse)).toBeNull();

    const changedResidenceRule = structuredClone(load('george-mason-university'));
    changedResidenceRule.unit_audit.residency.rule = 'A changed policy must be reviewed.';
    expect(evaluateGmuResidencyPolicy(changedResidenceRule)).toBeNull();
  });

  it('does not let evaluator capability supersede unresolved source status', () => {
    const doc = load('old-dominion-university');
    const { group, constraint } = findConstraint(doc, 'minimum_upper_level_credits_across_menu');
    expect(evaluateFourYearConstraint({
      ...constraint, status: 'unresolved_source_language',
    }, { container: group, document: doc })).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/cannot be superseded/),
    });
  });

  it('feeds Figure 6 the exact constraint-valid receiver selections', () => {
    const gmu = projected('george-mason-university');
    const gmuPlan = gmuOduFigure6Selection(gmu);
    expect(gmuPlan).toMatchObject({
      ready: true,
      section_receiver_indices: {
        '1:0': [0], '1:1': [0, 1, 3], '5:0': [2], '6:0': [0],
      },
      named_general_education_section_keys: ['6:0'],
    });
    const gmuVertices = residentVertices(gmu);
    expect([...gmuVertices.keys()]).toEqual(expect.arrayContaining([
      'uc:CS455', 'uc:CS425', 'uc:CS440', 'uc:CS451',
      'uc:CHEM211', 'uc:CHEM213', 'uc:CHEM212', 'uc:CHEM214',
      'uc:BIOL102',
    ]));
    expect(gmuVertices.has('uc:CS452')).toBe(false);

    const odu = projected('old-dominion-university');
    const oduPlan = gmuOduFigure6Selection(odu);
    expect(oduPlan).toMatchObject({
      ready: true,
      section_receiver_indices: {
        '1:0': [1, 2, 3], '3:0': [0], '10:0': [4], '12:3': [0, 1],
      },
      group_section_indices: { 3: 0, 12: 3 },
    });
    const oduVertices = residentVertices(odu);
    expect([...oduVertices.keys()]).toEqual(expect.arrayContaining([
      'uc:CS312', 'uc:CS337', 'uc:CS402', 'uc:BIOL121N',
      'uc:OEAS106N', 'uc:OEAS108N',
    ]));
    expect(oduVertices.has('uc:CS222')).toBe(false);
    expect(oduVertices.has('uc:BIOL122N')).toBe(false);
    expect([...oduVertices].filter(([key]) => key.startsWith('slot:pool:')))
      .toHaveLength(2);
  });

  it('uses the canonical ODU route and forbids Virginia transfer coverage of university-only work', () => {
    const odu = {
      ...projected('old-dominion-university'),
      analysis_contract: canonicalSourceContract(),
    };
    const budget = computeUnitBudget(odu.requirement_groups);
    expect(budget.modeled_units).toBe(120);
    expect(budget.per_tier.nontransferable).toBe(15);

    const everyParent = new Set([...codesFor(odu).keys()]);
    const coverage = buildDegreeGroups(odu.requirement_groups, {
      articulated: everyParent,
      sourceDocument: odu,
    });
    expect(coverage.groups.find((group) => group.label === 'Upper-level Computer Science electives'))
      .toMatchObject({ total: 3, covered: 0 });
    expect(coverage.groups.find((group) => group.label === 'Upper-Division General Education'))
      .toMatchObject({ total: 1, covered: 0 });
    expect(coverage.units.total).toBe(120);
  });

  it('jointly selects a disjoint ODU technical/science pair for coverage and credit', () => {
    const odu = {
      ...projected('old-dominion-university'),
      analysis_contract: canonicalSourceContract(),
    };
    const byCode = new Map([...codesFor(odu)].map(([parentId, code]) => [code, parentId]));
    const biolSequence = ['BIOL121N', 'BIOL122N', 'BIOL123N', 'BIOL124N'];
    const articulated = new Set([
      ...biolSequence.map((code) => byCode.get(code)),
      byCode.get('CHEM105N'),
    ]);
    const coverage = buildDegreeGroups(odu.requirement_groups, {
      articulated,
      sourceDocument: odu,
    });
    expect(coverage.groups.find((group) => (
      group.label === 'Technical elective from the published science menu'
    ))).toMatchObject({ total: 1, covered: 1 });
    expect(coverage.groups.find((group) => group.label === 'The Nature of Science sequence'))
      .toMatchObject({ total: 1, covered: 1 });

    const sendingByCode = new Map([
      ['BIOL121N', [1, 4]], ['BIOL122N', [2, 0]],
      ['BIOL123N', [3, 4]], ['BIOL124N', [4, 0]],
      ['CHEM105N', [5, 3]],
    ]);
    const agreement = {
      requirement_groups: [{
        sections: [{
          receivers: [...sendingByCode].map(([code, [courseId]]) => ({
            articulation_status: 'articulated',
            receiving: { kind: 'course', parent_id: byCode.get(code) },
            options: [{ course_ids: [courseId] }],
          })),
        }],
      }],
    };
    const unitsById = new Map([...sendingByCode.values()]);
    const application = evaluateTemplate(
      odu,
      [agreement],
      new Set(unitsById.keys()),
      unitsById,
      'semester',
      'semester',
      true,
    );
    expect(application.directAppliedUnits).toBe(11);
    expect(application.directIds).toEqual(new Set([1, 2, 3, 4, 5]));
    // The enumerated ODU sequence is named articulation, not eight generic GE
    // credits. The remaining exact GE capacity in this template is 27 units.
    expect(application.geCampusUnits).toBe(27);

    const withEarlierReuse = new Map([
      ...sendingByCode,
      ['OEAS106N', [6, 4]], ['OEAS108N', [7, 4]],
    ]);
    const reuseAgreement = {
      requirement_groups: [{
        sections: [{
          receivers: [
            ...withEarlierReuse,
            ['CS170', [6]],
          ].map(([code, [courseId]]) => ({
            articulation_status: 'articulated',
            receiving: { kind: 'course', parent_id: byCode.get(code) },
            options: [{ course_ids: [courseId] }],
          })),
        }],
      }],
    };
    const afterEarlierReuse = evaluateTemplate(
      odu,
      [reuseAgreement],
      new Set([...withEarlierReuse.values()].map(([courseId]) => courseId)),
      new Map([...withEarlierReuse.values()]),
      'semester',
      'semester',
      true,
    );
    // CS 170 spends sending course 6 first. The joint solver therefore
    // rejects the otherwise tie-winning BIOL/OEAS pair and commits the full
    // CHEM 105N + BIOL sequence instead; course 7 is never spent.
    expect(afterEarlierReuse.directAppliedUnits).toBe(14);
    expect(afterEarlierReuse.directIds).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });
});
