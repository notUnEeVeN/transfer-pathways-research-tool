import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FOCUSED_INQUIRY_SOURCE_TEXT,
  PROOF_TREE_SHA256,
  REAL_SOURCE_TEXT,
  RESIDENCY_ACCREDITATION_SOURCE_TEXT,
  RESIDENCY_EXCEPTION_SOURCE_TEXT,
  RESIDENCY_EXCHANGE_SOURCE_TEXT,
  RESIDENCY_SOURCE_TEXT,
  SOURCE_RECEIPTS,
  TRANSFER_POLICY_FACTS_SHA256,
  evaluateVcuConstraint,
  evaluateVcuAdministrativePolicy,
  evaluateVcuResidencyPolicy,
  exactVcuTree,
  selectedVcuRoute,
  vcuFigureSelection,
  vcuFigure6NonCourseSelection,
  vcuMajorResidencyCourseProof,
  vcuProofTreeFingerprint,
  vcuQualityFlagAffectedFigures,
  vcuSourceSpecificAffectedFigures,
  vcuTransferOrientedAsWaiver,
  vcuTransferPolicyEvidenceIssue,
} from './vcuConstraintProofs';
import { auditFourYearDocument, evaluateFourYearConstraint } from './fourYearConstraints';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { getMajor } from '../../config/majors';
import { courseIdFor, institutionCourseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { buildDegreeGroups } from '../degreeSlots';
import { readinessForSourceFigures } from '../virginia/publicationReadiness';
import { assemblePathway } from './pathwayComplexity';

const ROOT = path.resolve(__dirname, '../..');
const COMPOSED_PATH = path.join(
  ROOT, '.va-catalogs/composed/virginia-commonwealth-university.json',
);
const sourcePath = (suffix) => path.join(
  ROOT, `.va-catalogs/pages/virginia-commonwealth-university__${suffix}.txt`,
);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const acceptedSource = () => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === 'va:uni:virginia-commonwealth-university'
));

function buildFinalAssociateProjections() {
  const sourcePlan = cachedAcceptedSourcePlan();
  const asDegrees = sourcePlan.documents.filter((document) => (
    document.kind === 'as_degree' && document.status === 'extracted'
  ));
  const colleges = VA_INSTITUTION_REGISTRY.filter((row) => row.level === 'community_college')
    .map((row) => ({
      _id: `va:cc:${row.slug}`,
      level: row.level,
      name: row.name,
    }));
  return buildProjection({
    courses: [], degrees: [], asDegrees, institutions: colleges,
  }).asDegrees;
}

function buildFinalProjection() {
  const sourcePlan = cachedAcceptedSourcePlan();
  const degrees = sourcePlan.documents.filter((document) => (
    document.kind === 'degree' && document.status === 'extracted'
  ));
  const configuredIds = Object.keys(getMajor('va-cs').programs).map(Number);
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
    title: 'VCU final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: universities.map((row) => ({
      institution: row.name,
      identifier: 'NO_MATCH_299',
    })),
  };
  return buildProjection({
    courses: [supply], degrees, asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9229);
}

function findRule(doc, kind) {
  for (const [groupIndex, group] of (doc.requirement_groups || []).entries()) {
    const constraint = (group.analysis_constraints || []).find((entry) => entry.kind === kind);
    if (constraint) return { group, groupIndex, constraint };
  }
  return null;
}

const clone = (value) => structuredClone(value);

describe('exact VCU paper-figure proofs', () => {
  it('binds all six retained official source bytes', () => {
    const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const suffixes = {
      major: 'program', general_education: 'ge', college: 'college',
      graduation: 'graduation', policy: 'policy', course_catalog: 'course_catalog',
    };
    for (const receipt of SOURCE_RECEIPTS) {
      expect(sha(sourcePath(suffixes[receipt.id])), receipt.id).toBe(receipt.sha256);
    }
    const generalEducation = fs.readFileSync(sourcePath('ge'), 'utf8');
    const graduation = fs.readFileSync(sourcePath('graduation'), 'utf8');
    expect(generalEducation).toContain(FOCUSED_INQUIRY_SOURCE_TEXT);
    expect(graduation).toContain(RESIDENCY_ACCREDITATION_SOURCE_TEXT);
    expect(graduation).toContain(RESIDENCY_SOURCE_TEXT);
    expect(graduation).toContain(RESIDENCY_EXCEPTION_SOURCE_TEXT);
    expect(graduation).toContain(RESIDENCY_EXCHANGE_SOURCE_TEXT);
    expect(graduation).toContain(REAL_SOURCE_TEXT);
  });

  it('retains one complete-tree fingerprint through composition, source, and projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(vcuProofTreeFingerprint))).toEqual(new Set([
      PROOF_TREE_SHA256,
    ]));
    expect(documents.map((doc) => exactVcuTree(doc))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('selects only the exact equal-capacity placement route and fixed-credit elective route', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(selectedVcuRoute(doc)).toMatchObject({
        ready: true,
        placement_receiver_index: 0,
        placement_code: 'CMSC254',
        placement_units: 4,
        elective_receiver_indices: [0, 1, 2],
        elective_codes: ['CMSC410', 'CMSC411', 'CMSC412'],
        elective_units: 9,
        core_elective_overlap_codes: [],
        focused_inquiry_receiver_indices: [0, 0],
        focused_inquiry_codes: ['UNIV111', 'UNIV200'],
        focused_inquiry_units: 6,
        honors_replacements_selected: 0,
      });
    }
  });

  it('supports the three closed major-route rules and exact transfer-entry Focused Inquiry rule', () => {
    const kinds = [
      'placement_dependent_introductory_course',
      'variable_credit_selection_and_repeatability',
      'no_double_count_with_core',
      'focused_inquiry_grade_and_postmatriculation_transfer_rule',
    ];
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      for (const kind of kinds) {
        const found = findRule(doc, kind);
        expect(evaluateVcuConstraint(found.group, {
          document: doc,
          path: `requirement_groups[${found.groupIndex}]`,
          constraint: found.constraint,
        }), `${kind}:${doc._id || doc.slug}`).toMatchObject({
          supported: true,
          ...(kind === 'focused_inquiry_grade_and_postmatriculation_transfer_rule' ? {
            proof: {
              focused_inquiry_codes: ['UNIV111', 'UNIV200'],
              focused_inquiry_units: 6,
              honors_replacements_selected: 0,
              paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
              transfer_timing_enforced_by: 'community_college_credit_precedes_university_segment',
              postmatriculation_external_credit_units: 0,
            },
          } : {}),
        });
      }
    }
  });

  it('requires transfer-entry context and selects no honors-only Focused Inquiry receiver', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(vcuFigureSelection(doc)).toMatchObject({
        ready: false,
        reason: expect.stringContaining('only when community-college credit precedes'),
      });
      expect(vcuFigureSelection(doc, { transferEntry: true })).toMatchObject({
        ready: true,
        transfer_entry: true,
        postmatriculation_external_credit_units: 0,
        section_receiver_indices: {
          '0:1': [0],
          '2:0': [0, 1, 2],
          '8:0': [0],
          '8:1': [0],
        },
        proof: {
          focused_inquiry_codes: ['UNIV111', 'UNIV200'],
          honors_replacements_selected: 0,
        },
      });
    }
  });

  it('enforces the ordinary Focused Inquiry route in the final numeric reader', () => {
    const document = buildFinalProjection();
    const coverage = (codes) => buildDegreeGroups(document.requirement_groups, {
      articulated: new Set(codes.map((code) => institutionCourseIdFor('va:uni:9229', code))),
      sourceDocument: document,
    });
    const group = (result) => result.groups.find((row) => (
      row.label === 'ConnectED foundations not already counted in the program table'
    ));
    expect(group(coverage(['UNIV111', 'UNIV200']))).toMatchObject({
      total: 2,
      covered: 2,
    });
    expect(group(coverage(['HONR230', 'HONR240']))).toMatchObject({
      total: 2,
      covered: 0,
    });
  });

  it('applies the exact transfer-oriented A.S. waiver and residency policy', () => {
    expect(vcuTransferPolicyEvidenceIssue()).toBeNull();
    expect(TRANSFER_POLICY_FACTS_SHA256)
      .toBe('19f6d869fc73c6f5596cad3705450ff003e66393db11b151227f058ca675bce6');
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      const connected = findRule(doc, 'connected_category_distribution_and_overlap');
      expect(evaluateVcuConstraint(connected.group, {
        document: doc,
        path: `requirement_groups[${connected.groupIndex}]`,
        constraint: connected.constraint,
      })).toMatchObject({
        supported: true,
        affected_figures: ['3', '4', '6'],
        proof: {
          net_connected_capacity_units: 15,
          policy_facts_sha256: TRANSFER_POLICY_FACTS_SHA256,
          qualifying_award: 'AS',
          lower_division_general_education_met: true,
          accepted_transfer_credit_contributes_to_degree_hours: true,
          connected_course_identity_increment_for_figure_6: 0,
          enforced_at_runtime_by: 'vcuTransferOrientedAsWaiver',
        },
      });

      const mixed = findRule(doc, 'gpa_and_residency');
      expect(evaluateVcuConstraint(mixed.group, {
        document: doc,
        path: `requirement_groups[${mixed.groupIndex}]`,
        constraint: mixed.constraint,
      })).toMatchObject({
        supported: true,
        affected_figures: ['3', '4'],
        proof: {
          paper_model_condition: 'hypothetical_grade_eligible_successful_pathway',
          cumulative_gpa_condition: 2,
          major_gpa_condition: 2,
          gpa_course_or_credit_effect_when_condition_met: 0,
          residency_supported: true,
          residency_issues: [],
          effective_two_year_transfer_cap_units: 90,
          major_residency: {
            total_major_course_attempts: 21,
            fixed_resident_major_course_attempts: 18,
            resident_major_course_attempts_minimum: 11,
          },
        },
      });
    }
  });

  it('enforces the independent 90-credit ceiling and half-major course rule', () => {
    for (const doc of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(evaluateVcuResidencyPolicy(doc)).toMatchObject({
        supported: true,
        evaluator: 'evaluateVcuResidencyPolicy',
        evaluator_version: 2,
        overall_transfer_cap_units: 90,
        final_window_transfer_cap_units: 90,
        effective_two_year_transfer_cap_units: 90,
        declared_subrules: [
          'overall_residency', 'final_window_residency', 'military_exception',
          'ARAC_discretionary_waiver', 'VCU_program_and_exchange_exception',
        ],
        proof: {
          policy_facts_sha256: TRANSFER_POLICY_FACTS_SHA256,
          published_transfer_maximum_units: 90,
          overall_transfer_cap_units: 90,
          final_window_transfer_cap_units: 90,
          transfer_timing_enforced_by: 'community_college_credit_precedes_university_segment',
          accreditation_floor_declared_nonappealable: true,
          sponsored_exchange_selected: false,
          postmatriculation_external_credit_units: 0,
          military_or_arac_timing_exception_can_raise_90_credit_ceiling: false,
          major_residency: {
            total_major_course_attempts: 21,
            fixed_resident_major_course_attempts: 18,
            resident_major_course_attempts_minimum: 11,
            potentially_external_lower_major_codes: ['CMSC235', 'CMSC255', 'CMSC256'],
          },
        },
      });
      expect(vcuMajorResidencyCourseProof(doc)).toMatchObject({
        ready: true,
        total_major_course_attempts: 21,
        fixed_resident_major_course_attempts: 18,
        resident_major_course_attempts_minimum: 11,
      });
    }
  });

  it('guards every VCU Figure 3/4 cell with a canonical pre-enrollment A.S.', () => {
    const bachelor = buildFinalProjection();
    const associates = buildFinalAssociateProjections();
    expect(associates).toHaveLength(19);
    for (const associate of associates) {
      expect(vcuTransferOrientedAsWaiver(bachelor, associate)).toMatchObject({
        applicable: true,
        ready: true,
        award: 'AS',
        earned_before_vcu_enrollment: true,
        lower_division_general_education_met: true,
        accepted_transfer_credit_applies_to_degree_hours: true,
        transfer_ceiling_units: 90,
        evidence_sha256: TRANSFER_POLICY_FACTS_SHA256,
      });
    }
    const associate = associates[0];
    for (const mutate of [
      (doc) => { doc.source_degree_type = 'AAS'; },
      (doc) => { doc.degree_type = 'local_aas'; },
      (doc) => { doc.kind = 'certificate'; },
      (doc) => { doc.provenance.source_bundle_hash = null; },
      (doc) => { doc.college_id = 'not-a-virginia-college'; },
      (doc) => { doc.va_requirement_id = 'not-an-as-source'; },
      (doc) => { doc.analysis_contract = null; },
    ]) {
      const changed = clone(associate);
      mutate(changed);
      expect(vcuTransferOrientedAsWaiver(bachelor, changed)).toMatchObject({
        applicable: true,
        ready: false,
      });
    }
    const notVcu = clone(bachelor);
    for (const key of ['slug', '_id', 'va_requirement_id', 'institution_id', 'school_id', 'school']) {
      notVcu[key] = `not-vcu-${key}`;
    }
    expect(vcuTransferOrientedAsWaiver(
      notVcu,
      associate,
    )).toMatchObject({ applicable: false, ready: false });
  });

  it('narrows only the exact open GE and zero-unit REAL carriers', () => {
    const doc = acceptedSource();
    const connected = findRule(doc, 'connected_category_distribution_and_overlap');
    const real = findRule(doc, 'course_attribute_or_cocurricular_experience');
    expect(vcuSourceSpecificAffectedFigures(connected.constraint, {
      container: connected.group,
      document: doc,
      path: `requirement_groups[${connected.groupIndex}]`,
    })).toEqual(['3', '4', '6']);
    expect(vcuSourceSpecificAffectedFigures(real.constraint, {
      container: real.group,
      document: doc,
      path: `requirement_groups[${real.groupIndex}]`,
    })).toEqual(['6']);
    const realEvaluation = evaluateFourYearConstraint(real.constraint, {
      container: real.group,
      document: doc,
      path: `requirement_groups[${real.groupIndex}]`,
    });
    expect(realEvaluation).toMatchObject({
      supported: false,
      paper_impact_proven: true,
      affected_figures: [],
      evaluator: 'evaluateVcuConstraint',
      proof: {
        selected_route: 'approved_REAL_level_3_4_cocurricular_experience',
        selected_route_kind: 'non_course_completion',
        carrier_units: 0,
        carrier_course_identities: 0,
        added_prerequisite_edges: 0,
        complete_degree_completion_still_required: true,
      },
    });
    expect(vcuFigure6NonCourseSelection(doc)).toMatchObject({
      ready: true,
      non_course_section_keys: ['11:0'],
      selected_route: 'approved_REAL_level_3_4_cocurricular_experience',
      selected_route_kind: 'non_course_completion',
      carrier_units: 0,
      carrier_course_identities: 0,
      added_prerequisite_edges: 0,
    });
    for (const kind of ['minimum_cumulative_gpa', 'minimum_major_gpa']) {
      expect(evaluateVcuAdministrativePolicy(doc, kind)).toMatchObject({
        supported: false,
        paper_impact_proven: true,
        affected_figures: [],
        evaluator: 'evaluateVcuAdministrativePolicy',
        proof: {
          condition: kind,
          threshold: 2,
          carrier_units: 0,
          carrier_course_identities: 0,
        },
      });
    }
    const audit = auditFourYearDocument(doc);
    expect(audit.summary.ready_by_figure['6']).toBe(true);
    expect(audit.active_rules.find((row) => (
      row.kind === 'course_attribute_or_cocurricular_experience'
    ))).toMatchObject({ supported: false, affected_figures: [], paper_impact_proven: true });
    expect(readinessForSourceFigures(doc, { figures: ['6'] }))
      .toMatchObject({ figure_constraint_blockers: [] });
    expect(vcuQualityFlagAffectedFigures(
      doc.data_quality_flags.find((flag) => flag.code === 'connected_overlap_evaluator_required'),
      doc,
    )).toEqual(['3', '4', '6']);
  });

  it('omits the exact co-curricular REAL branch from both Figure 6 graphs', () => {
    const exact = acceptedSource();
    const drifted = clone(exact);
    drifted.requirement_groups[11].analysis_constraints[0].description += ' changed';
    const assemble = (degree, asIds) => assemblePathway({
      degree,
      asIds,
      agreementByParent: new Map(),
      ucCatalog: new Map(),
      ucCodeByParent: new Map(),
      ccUnits: new Map(asIds.map((id) => [id, 3])),
    });
    for (const asIds of [[], [101, 102]]) {
      const exactPathway = assemble(exact, asIds);
      const driftedPathway = assemble(drifted, asIds);
      expect(driftedPathway.vertices.size).toBe(exactPathway.vertices.size + 1);
      expect([...driftedPathway.vertices.values()].filter((row) => (
        row.kind === 'slot' && row.units == null
      ))).toHaveLength(
        [...exactPathway.vertices.values()].filter((row) => (
          row.kind === 'slot' && row.units == null
        )).length + 1,
      );
    }
  });

  it('fails closed on identity, source, reference, rule, unit, route, and accounting drift', () => {
    const source = acceptedSource();
    const mutations = [
      (doc) => { doc.school = 'Not VCU'; },
      (doc) => { doc.sources[0].sha256 = '0'.repeat(64); },
      (doc) => { doc.requirement_groups[2].source_refs = ['major']; },
      (doc) => { doc.requirement_groups[2].analysis_constraints[0].description += ' changed'; },
      (doc) => { doc.requirement_groups[0].sections[1].unit_advisement = 3; },
      (doc) => { doc.requirement_groups[2].sections[0].receivers[0].code_seen = 'CMSC491'; },
      (doc) => { doc.unit_audit.modeled_units = 119; },
      (doc) => { doc.data_quality_flags.pop(); },
      (doc) => { doc.requirement_groups[8].sections[0].receivers[0].code_seen = 'UNIV112'; },
      (doc) => { doc.requirement_groups[8].sections[1].unit_advisement = 4; },
      (doc) => { doc.requirement_groups[12].sections[2].unit_advisement = 1; },
    ];
    for (const mutate of mutations) {
      const changed = clone(source);
      mutate(changed);
      expect(exactVcuTree(changed).supported).toBe(false);
      expect(vcuFigureSelection(changed, { transferEntry: true }).ready).toBe(false);
      expect(evaluateVcuResidencyPolicy(changed)).toBeNull();
    }

    const changedReal = clone(source);
    changedReal.requirement_groups[11].sections[0].unit_advisement = 1;
    const real = findRule(changedReal, 'course_attribute_or_cocurricular_experience');
    expect(evaluateFourYearConstraint(real.constraint, {
      container: real.group,
      document: changedReal,
      path: `requirement_groups[${real.groupIndex}]`,
    })).toMatchObject({
      supported: false,
      affected_figures: ['1', '3', '4', '6'],
    });
    expect(vcuFigure6NonCourseSelection(changedReal).ready).toBe(false);
    expect(evaluateVcuAdministrativePolicy(changedReal, 'minimum_cumulative_gpa'))
      .toBeNull();
  });

  it('does not inherit VCU scoping at another identity or detached path', () => {
    const source = acceptedSource();
    const connected = findRule(source, 'connected_category_distribution_and_overlap');
    expect(vcuSourceSpecificAffectedFigures(connected.constraint, {
      container: connected.group,
      document: { ...source, school: 'Other University' },
      path: `requirement_groups[${connected.groupIndex}]`,
    })).toBeNull();
    expect(vcuSourceSpecificAffectedFigures(connected.constraint, {
      container: connected.group,
      document: source,
      path: 'requirement_groups[8]',
    })).toBeNull();
  });
});
