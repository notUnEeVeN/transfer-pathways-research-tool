import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_GROUP_UNITS,
  PROOF_TREE_SHA256,
  PROTECTED_PROOF_TREE_SHA256,
  PROTECTED_SOURCE_BUNDLE_SHA256,
  QUALITY_FLAG_PATHS,
  RULE_PATHS,
  SOURCE_RECEIPTS,
  exactVirginiaStateTree,
  virginiaStateFigure34AggregateProof,
  virginiaStateProofTreeFingerprint,
  virginiaStateQualityFlagAffectedFigures,
  virginiaStateSourceSpecificAffectedFigures,
} from './virginiaStateConstraintProofs';
import {
  affectedFiguresForConstraint,
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { _evaluateTemplate } from './transferCreditRate';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor, institutionCourseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import {
  readinessForProjectedFigures,
  readinessForSourceFigures,
} from '../virginia/publicationReadiness';

const ROOT = path.resolve(__dirname, '../..');
const SLUG = 'virginia-state-university';
const COMPOSED_PATH = path.join(ROOT, `.va-catalogs/composed/${SLUG}.json`);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));

function acceptedSource() {
  return cachedAcceptedSourcePlan().documents.find((document) => (
    document.institution_id === `va:uni:${SLUG}`
  ));
}

function protectedSource() {
  const document = structuredClone(acceptedSource());
  document.provenance.source_bundle_hash = PROTECTED_SOURCE_BUNDLE_SHA256;
  document.requirement_groups[5].sections[0].unit_advisement_max = 6;
  return document;
}

function reviewed(document) {
  const result = structuredClone(document);
  result.verification = {
    verified: true,
    verified_by: 'vsu-proof-test',
    verified_at: '2026-08-18T18:34:42.388Z',
    stale: false,
  };
  return result;
}

function buildFinalProjection(source = acceptedSource()) {
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9231);
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
    title: 'Virginia State final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [source], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9231);
}

function findRule(document, kind) {
  for (const [groupIndex, group] of (document.requirement_groups || []).entries()) {
    const constraint = (group.analysis_constraints || []).find((row) => row.kind === kind);
    if (constraint) return { constraint, group, groupIndex };
  }
  return null;
}

function scopedFigures(document, kind) {
  const found = findRule(document, kind);
  return virginiaStateSourceSpecificAffectedFigures(found.constraint, {
    container: found.group,
    document,
    path: `requirement_groups[${found.groupIndex}]`,
  });
}

describe('exact Virginia State paper-figure scoping', () => {
  it('binds all six official source receipts and the exact published totals/policies', () => {
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
    const ge = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__ge.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    const college = fs.readFileSync(
      path.join(ROOT, `.va-catalogs/pages/${SLUG}__college.txt`), 'utf8',
    ).replace(/\s+/g, ' ');
    expect(program).toContain('General Education33 Core Requirements54 Required Courses14 Electives19 Total Credit Hours120');
    expect(program).toContain('Restricted Electives13 CSCI Electives Menu');
    expect(ge).toContain('General Education program requires the successful completion of 33 semester hours');
    expect(ge).toContain('Mathematics - 6 semester hours');
    expect(ge).toContain('Natural Science and Lab - 4 semester hours');
    expect(ge).toContain('may not use one course to satisfy more than one general education course requirement');
    expect(college).toContain("Students must earn at least a 'C' in all CSCI, MATH, and STAT courses");
  });

  it('retains exact current and protected source/projection tuples', () => {
    const current = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(current.map(virginiaStateProofTreeFingerprint))).toEqual(new Set([
      PROOF_TREE_SHA256,
    ]));
    expect(current.map((document) => exactVirginiaStateTree(document))).toEqual([
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'composition' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);

    const protectedDocuments = [protectedSource(), buildFinalProjection(protectedSource())];
    expect(new Set(protectedDocuments.map(virginiaStateProofTreeFingerprint))).toEqual(new Set([
      PROTECTED_PROOF_TREE_SHA256,
    ]));
    expect(protectedDocuments.map((document) => exactVirginiaStateTree(document).supported))
      .toEqual([true, true]);
  });

  it('proves the exact 120-credit aggregate while retaining the 6-8 math range', () => {
    for (const document of [acceptedSource(), buildFinalProjection()]) {
      expect(virginiaStateFigure34AggregateProof(document)).toMatchObject({
        supported: true,
        proof: {
          group_units: EXPECTED_GROUP_UNITS,
          general_education_units: 33,
          core_requirement_units: 54,
          required_course_units: 14,
          unrestricted_elective_units: 6,
          restricted_elective_units: 13,
          modeled_units: 120,
          mathematics_credit_range: [6, 8],
        },
      });
    }
    expect(virginiaStateFigure34AggregateProof(protectedSource())).toMatchObject({
      supported: true,
      proof: { mathematics_credit_range: [6, 6] },
    });
  });

  it('supersedes only the protected legacy math ceiling and preserves reader semantics', () => {
    for (const [document, storedCeiling] of [
      [acceptedSource(), 8],
      [protectedSource(), 6],
      [buildFinalProjection(), 8],
      [buildFinalProjection(protectedSource()), 6],
    ]) {
      const found = findRule(document, 'minimum_credit_selection');
      expect(evaluateFourYearConstraint(found.constraint, {
        container: found.group,
        document,
        path: `requirement_groups[${found.groupIndex}]`,
      })).toMatchObject({
        supported: true,
        evaluator: 'minimumCreditSelection',
        proof: {
          rule_path: 'requirement_groups[5]',
          ask: 2,
          required_capacity_units: 6,
          minimum_receiver_sum: 6,
          maximum_receiver_sum: 8,
          stored_ceiling_units: storedCeiling,
          protected_legacy_ceiling_superseded: storedCeiling === 6,
        },
      });
    }

    const sending = [courseIdFor('MTH167'), courseIdFor('MTH263')];
    const agreements = [{
      requirement_groups: [{
        sections: [{
          receivers: ['MATH150', 'MATH260'].map((code, index) => ({
            articulation_status: 'articulated',
            receiving: {
              kind: 'course',
              parent_id: institutionCourseIdFor('va:uni:9231', code),
            },
            options: [{ course_ids: [sending[index]] }],
          })),
        }],
      }],
    }];
    const units = new Map(sending.map((id) => [id, 4]));
    const evaluate = (source) => _evaluateTemplate(
      buildFinalProjection(source), agreements, new Set(sending), units,
      'semester', 'semester', true,
    );
    const current = evaluate(acceptedSource());
    const protectedResult = evaluate(protectedSource());
    expect(protectedResult).toEqual(current);
    expect(current).toMatchObject({
      // The exact GE carrier contributes the source-stated six credits inside
      // the complete 33-credit GE budget in both source styles. The matching
      // MATH 260 also appears in the later fixed major block and is counted
      // there once; no eight-credit GE overshoot is invented.
      geCampusUnits: 33,
      directAppliedUnits: 4,
      requirementRoleIssues: [],
    });
  });

  it('keeps the math evaluator local, exact, and fail-closed', () => {
    const evaluateMath = (document, { path = 'requirement_groups[5]' } = {}) => {
      const found = findRule(document, 'minimum_credit_selection');
      return evaluateFourYearConstraint(found.constraint, {
        container: found.group,
        document,
        path,
      });
    };

    // An unrelated future audit declaration does not change this exact local
    // carrier. It remains separately visible and blocking in the document
    // audit instead of disabling a proven six-credit rule.
    const unrelated = structuredClone(acceptedSource());
    unrelated.unit_audit.analysis_constraints = [{
      kind: 'future_unit_policy', status: 'evaluator_not_implemented',
    }];
    expect(evaluateMath(unrelated).supported).toBe(true);

    const sourceMutations = [
      (document) => { document.provenance.source_bundle_hash = PROTECTED_SOURCE_BUNDLE_SHA256; },
      (document) => { document.sources[1].sha256 = '0'.repeat(64); },
      (document) => { document.requirement_groups[5].tier = 'transferable'; },
      (document) => { document.requirement_groups[5].source_refs = ['major']; },
      (document) => { document.requirement_groups[5].sections[0].section_advisement = 1; },
      (document) => { document.requirement_groups[5].sections[0].unit_advisement = 5; },
      (document) => { document.requirement_groups[5].sections[0].unit_advisement_max = 7; },
      (document) => { document.requirement_groups[5].sections[0].receivers[0].code_seen = 'MATH999'; },
      (document) => { document.requirement_groups[5].sections[0].receivers[0].receiving.units = 4; },
      (document) => { document.requirement_groups[5].sections[0].analysis_constraints = [{
        kind: 'new_local_rule', status: 'evaluator_not_implemented',
      }]; },
      (document) => { document.requirement_groups[5].analysis_constraints[0].status = 'supported'; },
      (document) => { document.requirement_groups[5].analysis_constraints.push(
        structuredClone(document.requirement_groups[5].analysis_constraints[0]),
      ); },
    ];
    for (const mutate of sourceMutations) {
      const drift = structuredClone(acceptedSource());
      mutate(drift);
      expect(evaluateMath(drift).supported).toBe(false);
    }
    expect(evaluateMath(acceptedSource(), { path: 'requirement_groups[4]' }).supported)
      .toBe(false);

    const projectionMutations = [
      (document) => { delete document.analysis_contract; },
      (document) => { delete document.state; },
      (document) => { document.source_program = 'changed'; },
      (document) => {
        document.requirement_groups[5].sections[0].receivers[0].receiving.parent_id += 1;
      },
    ];
    for (const mutate of projectionMutations) {
      const drift = structuredClone(buildFinalProjection());
      mutate(drift);
      expect(evaluateMath(drift).supported).toBe(false);
    }
  });

  it('scopes only the exact open identity/selection rules away from Figures 3/4', () => {
    const source = acceptedSource();
    for (const [kind, row] of Object.entries(RULE_PATHS)) {
      expect(scopedFigures(source, kind), kind).toEqual(row.figures);
      const found = findRule(source, kind);
      expect(affectedFiguresForConstraint(found.constraint, {
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toEqual(row.figures);
    }

    // Figures 3/4 condition on a grade-eligible successful pathway. These two
    // exact thresholds add no course/credit capacity, while the separately
    // published discretionary transfer-application policy is not resolved.
    for (const kind of ['minimum_course_grade', 'minimum_course_grade_by_subject']) {
      const found = findRule(source, kind);
      expect(affectedFiguresForConstraint(found.constraint, {
        container: found.group,
        document: source,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toEqual([]);
    }
  });

  it('narrows each exact quality flag and removes the coextensive grade-policy duplicate', () => {
    const source = acceptedSource();
    const audited = auditFourYearAnalysisQualityFlags(source);
    for (const [code, row] of Object.entries(QUALITY_FLAG_PATHS)) {
      const flag = source.data_quality_flags[row.index];
      expect(virginiaStateQualityFlagAffectedFigures(flag, source), code)
        .toEqual(code === 'major_subject_course_grade_requirement' ? [] : row.figures);
      expect(audited.find((entry) => entry.code === code), code).toMatchObject({
        blocking_analysis: true,
        affected_figures:
          code === 'major_subject_course_grade_requirement' ? [] : row.figures,
        resolved_by_exact_evaluator:
          code === 'major_subject_course_grade_requirement',
      });
    }
    expect(audited.find((entry) => (
      entry.code === 'major_subject_course_grade_requirement'
    ))).toMatchObject({
      mapped_constraint_kinds: ['minimum_course_grade_by_subject'],
      rule_receipts: [{
        kind: 'minimum_course_grade_by_subject',
        exact_active_rule_count: 1,
        expected_active_rule_count: 1,
        supported: true,
        evaluator: 'proveVirginiaBachelorPerformancePolicy',
        proof: {
          policy_receipt_id: 'virginia_state_major_subject_grade',
          conditioned_pathway_model: 'hypothetical_grade_eligible_successful_pathway',
        },
      }],
    });

    for (const mutate of [
      (document) => { document.data_quality_flags[3].message += ' changed'; },
      (document) => { document.data_quality_flags.push(
        structuredClone(document.data_quality_flags[3]),
      ); },
      (document) => { document.requirement_groups[14].source_refs = ['major']; },
      (document) => { document.requirement_groups[14].analysis_constraints.push(
        structuredClone(document.requirement_groups[14].analysis_constraints[0]),
      ); },
    ]) {
      const drift = structuredClone(source);
      mutate(drift);
      const flag = drift.data_quality_flags.find((entry) => (
        entry.code === 'major_subject_course_grade_requirement'
      ));
      expect(virginiaStateQualityFlagAffectedFigures(flag, drift)).toBeNull();
      const receipt = auditFourYearAnalysisQualityFlags(drift).find((entry) => (
        entry.code === 'major_subject_course_grade_requirement'
      ));
      expect(receipt?.resolved_by_exact_evaluator).not.toBe(true);
    }
  });

  it('reduces only safely disproven impacts and leaves all genuine blockers closed', () => {
    for (const document of [
      acceptedSource(), buildFinalProjection(),
      protectedSource(), buildFinalProjection(protectedSource()),
    ]) {
      expect(auditFourYearDocument(document).summary).toMatchObject({
        explicit_rules: 9,
        supported_active_rules: 1,
        blocked_active_rules: 8,
        blocked_unit_audit_rules: 0,
        blocked_rules_by_figure: { '1': 2, '3': 0, '4': 0, '6': 5 },
        ready_by_figure: { '1': false, '3': true, '4': true, '6': false },
      });
    }

    const source = reviewed(acceptedSource());
    const projection = buildFinalProjection(source);
    for (const [figure, expected] of Object.entries({
      1: false, 3: true, 4: true, 6: false,
    })) {
      expect(readinessForSourceFigures(source, { figures: [figure] }).ready, figure)
        .toBe(expected);
      expect(readinessForProjectedFigures(projection, { figures: [figure] }).ready, figure)
        .toBe(expected);
    }
    expect(readinessForSourceFigures(source, { figures: ['3'] })).toMatchObject({
      ready: true,
      figure_constraint_blockers: [],
      unresolved_analysis_quality_flags: [],
    });
  });

  it('fails closed on identity, bundle, source, contract, accounting, tree, rule, and flag drift', () => {
    const source = acceptedSource();
    const mutations = [
      (document) => { document.school_id = 9231; },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.sources[0].url += '?changed=1'; },
      (document) => { document.sources[1].sha256 = '0'.repeat(64); },
      (document) => { document.sources[2].secure = false; },
      (document) => { document.unit_audit.general_education_units = 32; },
      (document) => { document.requirement_groups[13].tier = 'transferable'; },
      (document) => { document.requirement_groups[13].cc_articulable = true; },
      (document) => { document.requirement_groups[13].sections[0].unit_advisement = 12; },
      (document) => { document.requirement_groups[13].sections[0].section_advisement = 3; },
      (document) => { document.requirement_groups[13].sections[0].receivers.pop(); },
      (document) => { document.requirement_groups[6].source_refs = ['major']; },
      (document) => { document.requirement_groups[13].analysis_constraints[0].status = 'supported'; },
      (document) => { document.requirement_groups[13].analysis_constraints.push(
        structuredClone(document.requirement_groups[13].analysis_constraints[0]),
      ); },
      (document) => { document.requirement_groups[14].source_refs = ['major']; },
      (document) => { document.requirement_groups[14].analysis_constraints.push(
        structuredClone(document.requirement_groups[14].analysis_constraints[0]),
      ); },
      (document) => { document.data_quality_flags[0].code = 'changed'; },
    ];
    for (const mutate of mutations) {
      const drift = structuredClone(source);
      mutate(drift);
      expect(exactVirginiaStateTree(drift).supported).toBe(false);
      expect(scopedFigures(drift, 'credit_based_pool_with_unpublished_submenu_distribution'))
        .toBeNull();
    }

    const projection = buildFinalProjection();
    const contractDrift = structuredClone(projection);
    delete contractDrift.analysis_contract;
    expect(exactVirginiaStateTree(contractDrift).supported).toBe(false);
    const idDrift = structuredClone(projection);
    idDrift.requirement_groups[9].sections[0].receivers[0].receiving.parent_id += 1;
    expect(exactVirginiaStateTree(idDrift).supported).toBe(false);
  });

  it('requires exact rule and quality-flag attachment rather than matching prose', () => {
    const source = acceptedSource();
    const found = findRule(source, 'variable_credit_category');
    expect(virginiaStateSourceSpecificAffectedFigures(found.constraint, {
      container: found.group,
      document: source,
      path: 'requirement_groups[2]',
    })).toBeNull();
    expect(virginiaStateSourceSpecificAffectedFigures(
      structuredClone(found.constraint), {
        container: found.group,
        document: source,
        path: 'requirement_groups[1]',
      },
    )).toBeNull();
    expect(virginiaStateQualityFlagAffectedFigures(
      structuredClone(source.data_quality_flags[0]), source,
    )).toBeNull();
  });
});
