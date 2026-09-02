import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OVERLAP_MARKERS,
  PROOF_TREE_SHA256,
  SOURCE_RECEIPTS,
  evaluateRadfordConstraint,
  evaluateRadfordStructuralRule,
  exactRadfordTree,
  radfordProofTreeFingerprint,
  radfordCompletedAsRealWaiver,
  radfordQualityFlagAffectedFigures,
  radfordRequirementRole,
  radfordSourceSpecificAffectedFigures,
} from './radfordConstraintProofs';
import {
  affectedFiguresForConstraint,
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
  evaluateFourYearConstraint,
} from './fourYearConstraints';
import { canonicalRequirementRole } from './canonicalRequirementRole';
import { _evaluateTemplate } from './transferCreditRate';
import {
  baseSciencePairContext,
  sourceEquivalenciesSha256,
} from './radfordSciencePairConstraint';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const ROOT = path.resolve(__dirname, '../..');
const SLUG = 'radford-university';
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
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9219);
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
    title: 'Radford final-projection parity witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9219);
}

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

function findRule(document, kind) {
  for (const [groupIndex, group] of (document.requirement_groups || []).entries()) {
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

describe('exact Radford paper-figure proofs', () => {
  it('binds all six retained official receipts and the exact catalog statements', () => {
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
    expect(program).toContain('This major fulfills the R and L areas of the REAL Curriculum');
    expect(program).toContain('either four 3XX or 4XX CS courses');
    expect(ge).toContain('TOTAL: Minimum 48 hours');
    expect(ge).toContain('Courses may add a designation of WI (Writing Intensive) and/or GE');
    expect(ge).toContain('at least 15 credit hours, not including foundational math and foundational writing');
  });

  it('retains one whole-tree proof through composition, source, and final projection', () => {
    const documents = [loadComposition(), acceptedSource(), buildFinalProjection()];
    expect(new Set(documents.map(radfordProofTreeFingerprint))).toEqual(new Set([
      PROOF_TREE_SHA256,
    ]));
    expect(documents.map((document) => exactRadfordTree(document))).toEqual([
      expect.objectContaining({ supported: true, proof: { document_style: 'composition', institution_slug: SLUG, proof_tree_sha256: PROOF_TREE_SHA256, source_bundle_sha256: null, source_receipts: expect.any(Array) } }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'accepted_source' }) }),
      expect.objectContaining({ supported: true, proof: expect.objectContaining({ document_style: 'final_projection' }) }),
    ]);
  });

  it('proves only the exact R/L overlap and unique REAL capacity receipts', () => {
    for (const document of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      for (const kind of ['major_area_overlap', 'real_minimum_unique_credit_capacity']) {
        const found = findRule(document, kind);
        expect(evaluateRadfordConstraint(found.group, {
          document,
          path: `requirement_groups[${found.groupIndex}]`,
          constraint: found.constraint,
        }), `${kind}:${document._id || document.slug}`).toMatchObject({
          supported: true,
          proof: { rule_path: `requirement_groups[${found.groupIndex}]` },
        });
      }
    }
    expect(evaluateRadfordConstraint({}, {
      document: acceptedSource(), constraint: { kind: 'upper_level_writing_intensive_course' },
    })).toMatchObject({ supported: false });
  });

  it('proves exactly the canonical four-unit and zero-unit MATH 171 overlap receipts', () => {
    for (const document of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      for (const [path, overlap, code, receiverUnits, sectionUnits] of OVERLAP_MARKERS) {
        expect(evaluateRadfordStructuralRule({
          kind: 'overlap_key', path, document,
        })).toMatchObject({
          supported: true,
          evaluator: 'evaluateRadfordStructuralRule',
          proof: {
            marker_path: path,
            overlap_key: overlap,
            receiver_code: code,
            receiver_units: receiverUnits,
            section_units: sectionUnits,
          },
        });
      }
    }
    expect(evaluateRadfordStructuralRule({
      kind: 'overlap_key', path: OVERLAP_MARKERS[0][0], document: {},
    })).toBeNull();
  });

  it('scopes only facts whose paper-figure invariance is established', () => {
    const document = acceptedSource();
    const expected = {
      two_sciences_one_laboratory: ['1', '6'],
      prefix_level_exclusion_and_approval_rule: ['1', '6'],
      upper_level_writing_intensive_course: ['6'],
      ge_designated_credit_minimum: ['6'],
      outside_school_credit_minimum: ['6'],
      real_minimum_unique_credit_capacity: ['6'],
    };
    for (const [kind, figures] of Object.entries(expected)) {
      const found = findRule(document, kind);
      expect(radfordSourceSpecificAffectedFigures(found.constraint, {
        document,
        container: found.group,
        path: `requirement_groups[${found.groupIndex}]`,
      }), kind).toEqual(figures);
    }
  });

  it('classifies exact zero-unit, REAL, and unrestricted carriers without relabeling eligibility', () => {
    const document = buildFinalProjection();
    const expected = [
      [6, 0, 'zero_unit_requirement', 0],
      [7, 0, 'zero_unit_requirement', 0],
      [7, 1, 'zero_unit_requirement', 0],
      [11, 0, 'general_education', 3],
      [12, 0, 'elective_capacity', 35],
    ];
    for (const [groupIndex, sectionIndex, role, units] of expected) {
      const group = document.requirement_groups[groupIndex];
      const section = group.sections[sectionIndex];
      expect(radfordRequirementRole(document, group, section)).toMatchObject({
        applies: true,
        exact: true,
        role,
        issues: [],
        evidence: {
          path: `requirement_groups[${groupIndex}].sections[${sectionIndex}]`,
          exact_capacity_units: units,
        },
      });
      expect(canonicalRequirementRole(document, group, section)).toMatchObject({
        applies: true,
        exact: true,
        role,
        evidence: { source_bound_evaluator: 'radfordRequirementRole' },
      });
    }
    expect(radfordRequirementRole(
      document, document.requirement_groups[2], document.requirement_groups[2].sections[0],
    )).toBeNull();
  });

  it('enforces the completed Virginia A.S. waiver at the actual pair runtime boundary', () => {
    const bachelor = buildFinalProjection();
    const associates = buildFinalAssociateProjections();
    expect(associates).toHaveLength(19);
    for (const associate of associates) {
      expect(radfordCompletedAsRealWaiver(bachelor, associate), associate._id).toMatchObject({
        applicable: true,
        ready: true,
        award: 'AS',
        real_areas_met: true,
        writing_intensive_met: true,
        general_education_units_met: 30,
        outside_major_rule_met: true,
        program_specific_science_requirement_waived: false,
      });
    }

    const science = baseSciencePairContext(bachelor, associates[0]);
    const scienceEquivalencies = science.pair.map((fact) => ({
      sending_course_id: fact.sending_course_id,
      sending_course_key: `va:${fact.sending_code}`,
      sending_code: fact.sending_code,
      receiving_identifier: fact.receiving_code,
      receiving_name: fact.receiving_name,
      receiving_notes: fact.receiving_notes,
      receiving_parent_id: fact.receiving_parent_id,
      sending_source_url: fact.sending_source_url,
    })).sort((left, right) => (
      left.sending_course_id - right.sending_course_id
        || left.receiving_parent_id - right.receiving_parent_id
    ));
    const scienceAgreements = [{
      _id: `va:agreement:9219:${science.college.numeric_id}`,
      university_id: 'va:uni:radford-university',
      college_id: `va:cc:${science.college.slug}`,
      uc_school_id: 9219,
      community_college_id: science.college.numeric_id,
      university_name: 'Radford University',
      college_name: science.college.name,
      major: 'Computer Science, B.S.',
      state: 'va',
      source: 'derived from Transfer Virginia course equivalencies × published degree requirements',
      pairing: 'course-equivalency-join',
      derived_from: { degree_id: 'va:degree:radford-university:cs', supply_edges: 2 },
      source_equivalencies_contract: 'va-concrete-supply-edge-v2',
      source_equivalencies_count: scienceEquivalencies.length,
      source_equivalencies_sha256: sourceEquivalenciesSha256(scienceEquivalencies),
      source_equivalencies: scienceEquivalencies,
      requirement_groups: [],
    }];
    const scienceUnits = new Map(science.pair.map((fact) => [
      fact.sending_course_id, fact.sending_credits,
    ]));
    const evaluated = _evaluateTemplate(
      bachelor, scienceAgreements, new Set(science.pair_ids), scienceUnits,
      'semester', 'semester', true,
      { associateDocument: associates[0] },
    );
    expect(evaluated).toMatchObject({
      directAppliedUnits: 8,
      geCampusUnits: 30,
      electiveCampusUnits: 33,
      requirementRoleIssues: [],
      sourceBoundApplicationIssues: [],
      sourceBoundRadfordRealWaiver: {
        ready: true,
        general_education_units_met: 30,
      },
    });

    for (const associateDocument of [
      null,
      { ...associates[0], degree_type: 'AAS' },
      { ...associates[0], source_degree_type: 'AAS' },
      { ...associates[0], college_id: 'va:uni:not-a-community-college' },
      { ...associates[0], provenance: null },
    ]) {
      const guarded = _evaluateTemplate(
        bachelor, [], new Set(), new Map(), 'semester', 'semester', true,
        { associateDocument },
      );
      expect(guarded.sourceBoundApplicationIssues).toContainEqual(expect.objectContaining({
        kind: 'radford_completed_as_real_policy',
        reason: expect.stringContaining('exact completed Virginia A.S.'),
      }));
      expect(guarded.geCampusUnits).toBe(0);
    }
  });

  it('scopes the missing GEOL 121 flag only because it belongs exclusively to an inactive variant', () => {
    for (const document of [loadComposition(), acceptedSource(), buildFinalProjection()]) {
      expect(radfordQualityFlagAffectedFigures(document.data_quality_flags[5], document))
        .toEqual([]);
    }
    const drift = acceptedSource();
    const clone = structuredClone(drift);
    clone.requirement_variants[1].selected = true;
    expect(radfordQualityFlagAffectedFigures(clone.data_quality_flags[5], clone)).toBeNull();
  });

  it('preserves source/final blocker parity while pair-level science enforcement owns Figures 3/4', () => {
    const source = acceptedSource();
    const projection = buildFinalProjection();
    const sourceAudit = auditFourYearDocument(source);
    const projectionAudit = auditFourYearDocument(projection);
    expect(sourceAudit.summary).toMatchObject({
      supported_active_rules: 4,
      blocked_active_rules: 5,
      blocked_unit_audit_rules: 1,
      blocked_rules_by_figure: { '1': 2, '3': 0, '4': 0, '6': 5 },
      ready_by_figure: { '1': false, '3': true, '4': true, '6': false },
    });
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockers(projectionAudit, figure), `Figure ${figure}`)
        .toEqual(blockers(sourceAudit, figure));
    }
    expect(blockers(sourceAudit, '3')).toEqual([]);

    for (const kind of [
      'major_area_overlap', 'real_minimum_unique_credit_capacity',
    ]) {
      const found = findRule(source, kind);
      expect(evaluateFourYearConstraint(found.constraint, {
        document: source,
        container: found.group,
        path: `requirement_groups[${found.groupIndex}]`,
      })).toMatchObject({ supported: true, evaluator: 'evaluateRadfordConstraint' });
    }
    for (const kind of [
      'upper_level_writing_intensive_course', 'ge_designated_credit_minimum',
      'outside_school_credit_minimum',
    ]) {
      const found = findRule(source, kind);
      expect(affectedFiguresForConstraint(found.constraint, {
        document: source,
        container: found.group,
        path: `requirement_groups[${found.groupIndex}]`,
      })).toEqual(['6']);
    }
    const science = findRule(source, 'two_sciences_one_laboratory');
    expect(affectedFiguresForConstraint(science.constraint, {
      document: source,
      container: science.group,
      path: `requirement_groups[${science.groupIndex}]`,
    })).toEqual(['1', '6']);
    expect(auditFourYearAnalysisQualityFlags(source)).toContainEqual(
      expect.objectContaining({
        code: 'program_listed_code_absent_from_course_catalog',
        blocking_analysis: true,
        affected_figures: [],
      }),
    );
  });

  it('fails closed on identity, receipt, ref, rule, inactive variant, flag, unit, and projected-id drift', () => {
    const source = acceptedSource();
    const mutations = [
      (document) => { document.school_id = 9219; },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.sources[0].sha256 = '0'.repeat(64); },
      (document) => { document.requirement_groups[7].source_refs = ['major']; },
      (document) => { document.requirement_groups[11].analysis_constraints[2].description += ' changed'; },
      (document) => { document.requirement_variants[1].requirement_groups[0].sections[0].receivers.pop(); },
      (document) => { document.data_quality_flags[5].message += ' changed'; },
      (document) => { document.unit_audit.canonical_remaining_real_capacity = 29; },
      (document) => { document.requirement_groups[6].sections[0].unit_advisement = 1; },
      (document) => { document.requirement_groups[1].sections[1].receivers[0].receiving.parent_id += 1; },
    ];
    for (const mutate of mutations) {
      const document = structuredClone(source);
      mutate(document);
      expect(exactRadfordTree(document).supported).toBe(false);
    }
  });
});
