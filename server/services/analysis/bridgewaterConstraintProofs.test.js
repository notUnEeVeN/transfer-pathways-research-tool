import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bridgewaterProofTreeFingerprint,
  bridgewaterSourceSpecificAffectedFigures,
  bridgewaterTrackSelection,
  evaluateBridgewaterMajorFieldPolicy,
  evaluateBridgewaterResidencyPolicy,
  exactBridgewaterTree,
} from './bridgewaterConstraintProofs';
import {
  auditFourYearAnalysisQualityFlags,
  auditFourYearDocument,
} from './fourYearConstraints';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { getMajor } from '../../config/majors';
import { buildDegreeGroups } from '../degreeSlots';
import { _evaluateTemplate } from './transferCreditRate';
import { assemblePathway } from './pathwayComplexity';
import { readinessForSourceFigures } from '../virginia/publicationReadiness';

const COMPOSED_PATH = path.resolve(
  __dirname, '../../.va-catalogs/composed/bridgewater-college.json',
);
const loadComposition = () => JSON.parse(fs.readFileSync(COMPOSED_PATH, 'utf8'));
const sourceDocuments = () => cachedAcceptedSourcePlan().documents.filter((document) => (
  document.kind === 'degree' && document.status === 'extracted'
));
const sourceDocument = () => sourceDocuments().find((document) => (
  document._id === 'va:degree:bridgewater-college:cs'
));

function finalProjection() {
  const configuredIds = Object.keys(getMajor('va-cs').programs).map(Number);
  const universities = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.level === 'four_year' && configuredIds.includes(row.id)
  ));
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const projection = buildProjection({
    courses: [{
      course_id: courseIdFor('CSC299'),
      course_key: 'va:CSC299',
      code: 'CSC299',
      title: 'Deliberately unmatched projection witness',
      credits: 3,
      offered_by: [college.name],
      articulates_to: universities.map((row) => ({
        institution: row.name,
        identifier: 'NO_MATCH_299',
      })),
    }],
    degrees: sourceDocuments(),
    asDegrees: [],
    institutions: [college, ...universities].map((row) => ({
      _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
      level: row.level,
      name: row.name,
    })),
  });
  return projection.degrees.find((document) => document.school_id === 9205);
}

function ruleContext(document, path, kind) {
  const index = Number(path.match(/\[(\d+)]/)?.[1]);
  const container = document.requirement_groups[index];
  const constraint = container.analysis_constraints.find((entry) => entry.kind === kind);
  return { container, document, path, constraint };
}

function agreement(pairs) {
  return [{
    requirement_groups: [{
      sections: [{
        receivers: pairs.map(([parentId, courseId]) => ({
          articulation_status: 'articulated',
          receiving: { kind: 'course', parent_id: parentId },
          options: [{ course_ids: [courseId] }],
        })),
      }],
    }],
  }];
}

function courseMaps(document) {
  const ucCodeByParent = new Map();
  for (const group of document.requirement_groups) {
    for (const section of group.sections) {
      for (const receiver of section.receivers) {
        const body = receiver.receiving || {};
        const codes = String(receiver.code_seen || body.code || '')
          .split(/\s*\+\s*/).filter(Boolean);
        const ids = body.kind === 'series' ? body.parent_ids || [] : [body.parent_id];
        ids.forEach((id, index) => {
          if (id != null && codes[index]) ucCodeByParent.set(id, codes[index]);
        });
      }
    }
  }
  const ucCatalog = new Map([...ucCodeByParent.values()].map((code) => [code, {
    id: `uc:${code}`,
    units: 3,
  }]));
  return { ucCodeByParent, ucCatalog };
}

describe('Bridgewater exact constraint proofs', () => {
  it('binds the composition, accepted source, and final numeric projection to one proof tree', () => {
    const composition = loadComposition();
    const source = sourceDocument();
    const projected = finalProjection();
    const fingerprints = [composition, source, projected]
      .map(bridgewaterProofTreeFingerprint);
    expect(new Set(fingerprints)).toEqual(new Set([
      '40ba88ea06907bae096a69777f79ed9fcba9c70b9631b3b5c094584f58a64b57',
    ]));
    expect(exactBridgewaterTree(composition)).toMatchObject({
      supported: true, proof: { document_style: 'composition' },
    });
    expect(exactBridgewaterTree(source)).toMatchObject({
      supported: true, proof: { document_style: 'accepted_source' },
    });
    expect(exactBridgewaterTree(projected)).toMatchObject({
      supported: true, proof: { document_style: 'final_projection' },
    });
    for (const document of [composition, source, projected]) {
      expect(evaluateBridgewaterResidencyPolicy(document)).toMatchObject({
        supported: true,
        effective_two_year_transfer_cap_units: 87,
        proof: {
          fixed_nontransferable_upper_major_units: 12,
          major_residency_minimum_units: 9,
        },
      });
    }
    const mixedProjection = structuredClone(projected);
    mixedProjection.school_id = '9205';
    expect(exactBridgewaterTree(mixedProjection)).toMatchObject({ supported: false });
  });

  it('supports eight exact rules and two major-field bounds with the stated blocker delta', () => {
    const documents = [loadComposition(), sourceDocument(), finalProjection()];
    const audits = documents.map(auditFourYearDocument);
    const blockersFor = (audit, figure) => [
      ...audit.active_rules.filter((row) => (
        !row.supported && row.affected_figures.includes(figure)
      )),
      ...audit.unit_audit.filter((row) => (
        row.blocking && row.affected_figures.includes(figure)
      )),
    ].map((row) => `${row.path}|${row.kind}`).sort();
    for (const figure of ['1', '3', '4', '6']) {
      expect(blockersFor(audits[1], figure), `accepted-source Figure ${figure}`)
        .toEqual(blockersFor(audits[0], figure));
      expect(blockersFor(audits[2], figure), `final-projection Figure ${figure}`)
        .toEqual(blockersFor(audits[1], figure));
    }
    for (const audit of audits) {
      expect(audit.summary).toMatchObject({
        active_rules: 13,
        supported_active_rules: 8,
        blocked_active_rules: 5,
        blocked_unit_audit_rules: 2,
        blocked_rules_by_figure: { '1': 0, '3': 0, '4': 0, '6': 5 },
        ready_by_figure: { '1': true, '3': true, '4': true, '6': false },
      });
      expect(audit.active_rules.filter((row) => row.supported).map((row) => row.kind))
        .toEqual([
          'correlated_required_track_choice',
          'correlated_required_track_choice',
          'transfer_status_course_selection',
          'cross_layer_course_overlap',
          'correlated_required_track_choice',
          'correlated_required_track_choice',
          'capacity_contains_nonadditive_ge_gates',
          'overlapping_residency_rules',
        ]);
      for (const kind of ['major_field_units_minimum', 'major_field_units_maximum']) {
        expect(audit.unit_audit.find((row) => row.kind === kind)).toMatchObject({
          supported: true,
          blocking: false,
          evaluator: 'evaluateBridgewaterMajorFieldPolicy',
          proof: { selected_track_major_units: [46, 46] },
        });
      }
    }
  });

  it('keeps open menus, policy ambiguity, and prerequisite incompleteness blocked only where proven relevant', () => {
    const document = sourceDocument();
    const expected = [
      ['requirement_groups[5]', 'approved_transfer_associate_conditional_exemption'],
      ['requirement_groups[6]', 'quantitative_placement_or_course_choice'],
      ['requirement_groups[6]', 'prerequisite_and_ge_overlap'],
      ['requirement_groups[7]', 'closed_current_ge_course_menus'],
      ['requirement_groups[7]', 'full_stack_art321_overlap'],
    ];
    for (const [rulePath, kind] of expected) {
      const context = ruleContext(document, rulePath, kind);
      expect(bridgewaterSourceSpecificAffectedFigures(context.constraint, context))
        .toEqual(['6']);
    }
    const drift = structuredClone(document);
    drift.requirement_groups[7].source_refs.pop();
    const context = ruleContext(drift, 'requirement_groups[7]', 'closed_current_ge_course_menus');
    expect(bridgewaterSourceSpecificAffectedFigures(context.constraint, context)).toBeNull();
    expect(auditFourYearDocument(drift).active_rules.find((row) => (
      row.kind === 'closed_current_ge_course_menus'
    ))).toMatchObject({ supported: false, affected_figures: ['1', '3', '4', '6'] });
  });

  it('resolves only the implementation-only four-receipt track flag', () => {
    const flags = auditFourYearAnalysisQualityFlags(sourceDocument());
    expect(flags[0]).toMatchObject({
      code: 'required_track_choice_correlation',
      resolved_by_exact_evaluator: true,
      mapped_constraint_kinds: ['correlated_required_track_choice'],
      rule_receipts: [{
        exact_active_rule_count: 4,
        expected_active_rule_count: 4,
        supported: true,
        evaluator: 'evaluateBridgewaterConstraint',
      }],
    });
    expect(flags[1]).toMatchObject({
      code: 'connected_learning_overlap_and_choice_rules',
      resolved_by_exact_evaluator: false,
      affected_figures: ['6'],
    });
    expect(flags[2]).toMatchObject({
      code: 'approved_associate_transfer_exception',
      resolved_by_exact_evaluator: false,
      affected_figures: ['6'],
    });
    expect(flags[3]).toMatchObject({
      code: 'full_stack_cl200_corequisite_policy_gap',
      resolved_by_exact_evaluator: false,
      mapped_constraint_kinds: [],
      affected_figures: ['6'],
    });

    const reviewed = structuredClone(sourceDocument());
    reviewed.verification = { verified: true, stale: false };
    const figure1 = readinessForSourceFigures(reviewed, { figures: ['1'] });
    expect(figure1).toMatchObject({
      ready: true,
      analysis_failures: [],
      unresolved_analysis_quality_flags: [],
      figure_constraint_blockers: [],
    });
    const figure6 = readinessForSourceFigures(reviewed, { figures: ['6'] });
    expect(figure6.ready).toBe(false);
    expect(figure6.analysis_failures).toContain('analysis_quality_flags');
    expect(figure6.unresolved_analysis_quality_flags.map((flag) => flag.code)).toEqual([
      'connected_learning_overlap_and_choice_rules',
      'approved_associate_transfer_exception',
      'full_stack_cl200_corequisite_policy_gap',
    ]);
  });

  it('fails closed under identity, source-ref, Boolean, roster, projected-id, and accounting mutations', () => {
    const base = sourceDocument();
    const mutations = [
      (document) => { document.institution_id = 'va:uni:old-dominion-university'; },
      (document) => { document.requirement_groups[2].source_refs.pop(); },
      (document) => { document.requirement_groups[2].canonical_section_index = 1; },
      (document) => { document.requirement_groups[3].sections[0].receivers[0].code_seen = 'CSCI361 + CSCI461'; },
      (document) => { document.requirement_groups[9].sections[0].unit_advisement = 49; },
      (document) => { document.unit_audit.track_paths.cybersecurity.major_units = 45; },
      (document) => { document.unit_audit.major_field_units_minimum = 29; },
      (document) => { document.requirement_groups[2].sections[0].receivers[0].receiving.parent_ids[0] += 1; },
    ];
    for (const mutate of mutations) {
      const document = structuredClone(base);
      mutate(document);
      expect(exactBridgewaterTree(document).supported).toBe(false);
      expect(auditFourYearDocument(document).summary.supported_active_rules).toBe(0);
    }
    const wrongMinimum = structuredClone(base);
    wrongMinimum.unit_audit.major_field_units_minimum = 29;
    expect(evaluateBridgewaterMajorFieldPolicy(
      wrongMinimum, 'major_field_units_minimum', 29,
    )).toMatchObject({ supported: false });
  });

  it('selects one whole track from exact receiving-course reach and never mixes carrier indices', () => {
    const document = finalProjection();
    const cyberIds = document.requirement_groups[2].sections[0]
      .receivers[0].receiving.parent_ids;
    const fullId = document.requirement_groups[2].sections[1]
      .receivers[0].receiving.parent_id;
    const full = bridgewaterTrackSelection(document, { articulated: new Set([fullId]) });
    expect(full).toMatchObject({
      ready: true,
      selected_track_index: 1,
      selected_track_key: 'full_stack_software_development',
      group_section_indices: { 2: 1, 3: 1, 4: 1, 8: 1, 9: 1 },
    });
    const cyber = bridgewaterTrackSelection(document, {
      articulated: new Set([...cyberIds, fullId]),
    });
    expect(cyber).toMatchObject({
      selected_track_index: 0,
      group_section_indices: { 2: 0, 3: 0, 4: 1, 8: 0, 9: 0 },
    });
    expect(bridgewaterTrackSelection(document, { transferEntry: false }))
      .toMatchObject({ group_section_indices: { 4: 0 } });
  });

  it('uses the same intact track in Figure 1 and Figure 3/4 allocation runtimes', () => {
    const document = finalProjection();
    const cyberIds = document.requirement_groups[2].sections[0]
      .receivers[0].receiving.parent_ids;
    const fullId = document.requirement_groups[2].sections[1]
      .receivers[0].receiving.parent_id;
    const fullCoverage = buildDegreeGroups(document.requirement_groups, {
      sourceDocument: document,
      articulated: new Set([fullId]),
    });
    expect(fullCoverage.named_requirements.courses).toMatchObject({ covered: 1 });

    const fullState = _evaluateTemplate(
      document,
      agreement([[fullId, 101]]),
      new Set([101]),
      new Map([[101, 3]]),
      'semester',
      'semester',
      true,
    );
    expect(fullState).toMatchObject({ directAppliedUnits: 3, geCampusUnits: 53 });
    expect([...fullState.directIds]).toEqual([101]);

    const cyberState = _evaluateTemplate(
      document,
      agreement([[cyberIds[0], 101], [cyberIds[1], 102], [fullId, 103]]),
      new Set([101, 102, 103]),
      new Map([[101, 3], [102, 3], [103, 3]]),
      'semester',
      'semester',
      true,
    );
    expect(cyberState).toMatchObject({ directAppliedUnits: 6, geCampusUnits: 50 });
    expect([...cyberState.directIds].sort()).toEqual([101, 102]);
  });

  it('enforces transfer/resident selection and atomic series coverage in Figure 6 assembly', () => {
    const document = finalProjection();
    const { ucCodeByParent, ucCatalog } = courseMaps(document);
    const cyberIds = document.requirement_groups[2].sections[0]
      .receivers[0].receiving.parent_ids;
    const fullId = document.requirement_groups[2].sections[1]
      .receivers[0].receiving.parent_id;
    const fullArticulation = { options: [[101]], parentIds: [fullId] };
    const transfer = assemblePathway({
      degree: document,
      asIds: [101],
      agreementByParent: new Map([[fullId, fullArticulation]]),
      ucCatalog,
      ucCodeByParent,
      ccUnits: new Map([[101, 3]]),
    });
    expect(transfer.vertices.has('uc:ART321')).toBe(true);
    expect(transfer.vertices.has('uc:CSCI361')).toBe(false);
    expect(transfer.vertices.has('uc:CL150')).toBe(true);
    expect(transfer.vertices.has('uc:CL100')).toBe(false);
    expect([...transfer.vertices.keys()].filter((key) => key === 'uc:CSCI400')).toHaveLength(1);

    const noCsci400Catalog = new Map(ucCatalog);
    noCsci400Catalog.delete('CSCI400');
    const fallbackDedupe = assemblePathway({
      degree: document,
      asIds: [],
      agreementByParent: new Map(),
      ucCatalog: noCsci400Catalog,
      ucCodeByParent,
      ccUnits: new Map(),
    });
    expect([...fallbackDedupe.vertices.keys()].filter((key) => (
      key === 'uc:bridgewater-shared:CSCI400'
    ))).toHaveLength(1);

    // One half of the Cybersecurity series is not a completed series. Both
    // receiving courses must remain on the university side.
    const partial = { options: [[201]], parentIds: [cyberIds[0]] };
    const partialCyber = assemblePathway({
      degree: document,
      asIds: [201],
      agreementByParent: new Map([[cyberIds[0], partial]]),
      ucCatalog,
      ucCodeByParent,
      ccUnits: new Map([[201, 3]]),
    });
    expect(partialCyber.vertices.has('uc:CSCI130')).toBe(true);
    expect(partialCyber.vertices.has('uc:CSCI261')).toBe(true);

    const resident = assemblePathway({
      degree: document,
      asIds: [],
      agreementByParent: new Map(),
      ucCatalog,
      ucCodeByParent,
      ccUnits: new Map(),
    });
    expect(resident.vertices.has('uc:CL100')).toBe(true);
    expect(resident.vertices.has('uc:CL150')).toBe(false);
  });
});
