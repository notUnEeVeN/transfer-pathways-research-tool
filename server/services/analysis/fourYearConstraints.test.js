import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  affectedFiguresForConstraint,
  auditFourYearDocument,
  evaluateFourYearConstraint,
  proveFixedCreditFloor,
} from './fourYearConstraints';
import { gmuOduFigure6Selection } from './georgeMasonOldDominionConstraintProofs';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { getMajor } from '../../config/majors';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';

const COMPOSED = path.resolve(__dirname, '../../.va-catalogs/composed');
const FOUR_YEAR_SLUGS = [
  'bridgewater-college',
  'christopher-newport-university',
  'george-mason-university',
  'james-madison-university',
  'longwood-university',
  'norfolk-state-university',
  'old-dominion-university',
  'radford-university',
  'randolph-macon-college',
  'shenandoah-university',
  'the-university-of-virginia-s-college-at-wise',
  'university-of-mary-washington',
  'university-of-virginia',
  'virginia-commonwealth-university',
  'virginia-military-institute',
  'virginia-polytechnic-institute-and-state-university',
  'virginia-state-university',
  'william-mary',
];

const load = (slug) => JSON.parse(fs.readFileSync(path.join(COMPOSED, `${slug}.json`), 'utf8'));

const findContainer = (doc, kind) => {
  let found = null;
  const visit = (value) => {
    if (!value || typeof value !== 'object' || found) return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if ((value.analysis_constraints || []).some((constraint) => constraint.kind === kind)) {
      found = value;
      return;
    }
    Object.values(value).forEach(visit);
  };
  visit(doc.requirement_groups);
  return found;
};

describe('Virginia four-year constraint capabilities', () => {
  it('proves a fixed-credit choose-N floor and fails when any legal choice falls short', () => {
    const section = {
      select: 2,
      units: 6,
      receivers: [
        { code: 'A100', units: 3 },
        { code: 'B100', units: 3 },
        { code: 'C100', units: 4 },
      ],
    };
    expect(proveFixedCreditFloor(section)).toMatchObject({
      supported: true,
      proof: { ask: 2, floor: 6, minimum_receiver_sum: 6 },
    });

    section.receivers[0].units = 2;
    expect(proveFixedCreditFloor(section)).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/only 5 credits/),
    });
  });

  it('supports only source-specific rules that are redundant with the authored tree', () => {
    const expected = [
      ['christopher-newport-university', 'variable_topics_credit_must_close_selection'],
      ['norfolk-state-university', 'minimum_major_menu_units'],
      ['old-dominion-university', 'variable_credit_programming_bridge'],
      ['old-dominion-university', 'work_experience_cap'],
      ['virginia-military-institute', 'variable_credit_internship'],
      ['virginia-state-university', 'minimum_credit_selection'],
    ];
    for (const [slug, kind] of expected) {
      const doc = load(slug);
      const container = findContainer(doc, kind);
      const groupIndex = doc.requirement_groups.indexOf(container);
      expect(evaluateFourYearConstraint(
        container.analysis_constraints.find((constraint) => constraint.kind === kind),
        { container, document: doc, path: `requirement_groups[${groupIndex}]` },
      ), `${slug}:${kind}`).toMatchObject({
        kind,
        supported: true,
        affected_figures: ['1', '3', '4', '6'],
      });
    }
  });

  it('does not accept a kind without its exact source structure', () => {
    const doc = load('virginia-state-university');
    const container = structuredClone(findContainer(doc, 'minimum_credit_selection'));
    container.sections[0].receivers[0].units = 2;
    const result = evaluateFourYearConstraint(container.analysis_constraints[0], { container });
    expect(result).toMatchObject({ supported: false });
    expect(result.reason).toMatch(/only 5 credits/);
  });

  it('fails source-specific proofs when the authored choose count or floor changes', () => {
    const topicsDoc = load('christopher-newport-university');
    const topics = structuredClone(findContainer(
      topicsDoc, 'variable_topics_credit_must_close_selection',
    ));
    topics.sections[0].select = 2;
    expect(evaluateFourYearConstraint(topics.analysis_constraints[0], { container: topics }))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/choose-3/) });

    const majorDoc = load('norfolk-state-university');
    const major = findContainer(majorDoc, 'minimum_major_menu_units');
    major.sections[1].units = 2;
    expect(evaluateFourYearConstraint(major.analysis_constraints[0], {
      container: major, document: majorDoc, path: 'requirement_groups[4]',
    })).toMatchObject({ supported: false, reason: expect.stringMatching(/reviewed NSU source tree/) });

    const internshipDoc = load('virginia-military-institute');
    const internship = structuredClone(findContainer(
      internshipDoc, 'variable_credit_internship',
    ));
    internship.sections[0].units = 2;
    expect(evaluateFourYearConstraint(
      internship.analysis_constraints[0], { container: internship },
    )).toMatchObject({ supported: false, reason: expect.stringMatching(/3-credit/) });
  });

  it('fails closed when a source-specific roster or legal credit ceiling drifts', () => {
    const topicsDoc = load('christopher-newport-university');
    const topics = structuredClone(findContainer(
      topicsDoc, 'variable_topics_credit_must_close_selection',
    ));
    topics.sections[0].receivers.find((receiver) => receiver.code === 'PCSE495').code
      = 'NOTCPSC495';
    expect(evaluateFourYearConstraint(topics.analysis_constraints[0], { container: topics }))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/roster changed/) });

    const majorDoc = load('norfolk-state-university');
    const major = findContainer(majorDoc, 'minimum_major_menu_units');
    const openMath = major.sections[1].receivers.find((receiver) => receiver.kind === 'ge_area');
    Object.assign(openMath, { kind: 'course', code: 'HIST100', units: 3 });
    expect(evaluateFourYearConstraint(major.analysis_constraints[0], {
      container: major, document: majorDoc, path: 'requirement_groups[4]',
    })).toMatchObject({ supported: false, reason: expect.stringMatching(/reviewed NSU source tree/) });

    const floorDoc = load('virginia-state-university');
    const floor = structuredClone(findContainer(floorDoc, 'minimum_credit_selection'));
    floor.sections[0].units_max = 6;
    expect(evaluateFourYearConstraint(floor.analysis_constraints[0], { container: floor }))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/through 8 credits/) });
    floor.sections[0].units_max = 8;
    floor.sections[0].receivers[0].kind = 'ge_area';
    expect(evaluateFourYearConstraint(floor.analysis_constraints[0], { container: floor }))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/concrete course/) });
  });

  it('proves ODU bridge bounds and work-experience cap from closed receiver menus', () => {
    const doc = load('old-dominion-university');
    const bridge = structuredClone(findContainer(doc, 'variable_credit_programming_bridge'));
    const bridgeConstraint = bridge.analysis_constraints.find((constraint) => (
      constraint.kind === 'variable_credit_programming_bridge'
    ));
    expect(evaluateFourYearConstraint(bridgeConstraint, { container: bridge }))
      .toMatchObject({
        supported: true,
        proof: { minimum_receiver_sum: 5, maximum_receiver_units: 6, route_count: 3 },
      });

    const bridgeSection = bridge.sections.find((section) => (
      section.label === 'Programming-language bridge'
    ));
    bridgeSection.receivers[0].units = 4;
    expect(evaluateFourYearConstraint(bridgeConstraint, { container: bridge }))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/must remain 5 credits/) });
    bridgeSection.receivers[0].units = 5;
    bridgeSection.receivers[0].conjunction = 'or';
    expect(evaluateFourYearConstraint(bridgeConstraint, { container: bridge }))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/requires every course/) });

    const cap = structuredClone(findContainer(doc, 'work_experience_cap'));
    const capConstraint = cap.analysis_constraints.find((constraint) => (
      constraint.kind === 'work_experience_cap'
    ));
    expect(evaluateFourYearConstraint(capConstraint, { container: cap }))
      .toMatchObject({
        supported: true,
        proof: { work_experience_receiver_count: 2, maximum_work_experience_units: 6 },
      });

    cap.sections[0].receivers.find((receiver) => receiver.code === 'CS367').units = 4;
    expect(evaluateFourYearConstraint(capConstraint, { container: cap }))
      .toMatchObject({ supported: false, reason: expect.stringMatching(/three-credit/) });
  });

  it('retains the exact ODU proofs after source-to-shared-schema projection', () => {
    const projected = cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
      doc.institution_id === 'va:uni:old-dominion-university'
    ));
    const rules = auditFourYearDocument(projected).active_rules.filter((row) => (
      ['variable_credit_programming_bridge', 'work_experience_cap'].includes(row.kind)
    ));
    expect(rules).toHaveLength(2);
    expect(rules.every((row) => row.supported)).toBe(true);
  });

  it('keeps source uncertainty fail-closed even for a supported evaluator kind', () => {
    const doc = load('virginia-state-university');
    const container = findContainer(doc, 'minimum_credit_selection');
    const constraint = {
      ...container.analysis_constraints[0],
      status: 'unresolved_source_language',
    };
    expect(evaluateFourYearConstraint(constraint, { container })).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/cannot be superseded/),
    });
  });

  it('audits degree-wide and unit-audit constraints outside the requirement tree', () => {
    const doc = structuredClone(load('virginia-state-university'));
    doc.analysis_constraints = [{
      kind: 'future_degree_policy', status: 'evaluator_not_implemented',
    }];
    doc.unit_audit.analysis_constraints = [{
      kind: 'future_unit_policy', status: 'evaluator_not_implemented',
    }];
    doc.requirement_variants = [{
      key: 'future_selected_track',
      selected: true,
      overlap_key: 'future-track-overlap',
      analysis_constraints: [{
        kind: 'future_selected_track_policy', status: 'evaluator_not_implemented',
      }],
    }];
    const audit = auditFourYearDocument(doc);
    expect(audit.active_rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'doc.analysis_constraints[0]', kind: 'future_degree_policy', supported: false,
      }),
      expect.objectContaining({
        path: 'unit_audit.analysis_constraints[0]', kind: 'future_unit_policy', supported: false,
      }),
      expect.objectContaining({
        path: 'requirement_variants[0].analysis_constraints[0]',
        kind: 'future_selected_track_policy', supported: false,
      }),
      expect.objectContaining({
        path: 'requirement_variants[0].overlap_key', kind: 'overlap_key', supported: false,
      }),
    ]));
    expect(audit.summary).toMatchObject({
      explicit_rules: 13,
      active_rules: 13,
      blocked_active_rules: 12,
    });
  });

  it('inventories all 18 official bachelor compositions without hiding inactive variants', () => {
    const audits = FOUR_YEAR_SLUGS.map((slug) => auditFourYearDocument(load(slug)));
    expect(audits).toHaveLength(18);
    expect(audits.reduce((sum, audit) => sum + audit.summary.explicit_rules, 0)).toBe(209);
    // Seventeen inactive analysis constraints plus five inactive overlap keys.
    expect(audits.reduce((sum, audit) => sum + audit.summary.inactive_variant_rules, 0)).toBe(22);
    expect(audits.reduce((sum, audit) => sum + audit.summary.supported_active_rules, 0)).toBe(105);
    expect(audits.reduce((sum, audit) => sum + audit.summary.unit_audit_fields, 0)).toBe(228);
    expect(audits.reduce((sum, audit) => (
      sum + audit.summary.blocked_unit_audit_rules
    ), 0)).toBe(31);
    expect(audits.every((audit) => audit.unit_audit.every((row) => (
      row.path.startsWith('unit_audit.') && Object.hasOwn(row, 'disposition')
    )))).toBe(true);
    // Component subtotals are audit metadata, never evaluator capability.
    expect(audits.flatMap((audit) => audit.unit_audit)
      .filter((row) => row.disposition.endsWith('accounting_fact'))
      .every((row) => row.supported === null && row.blocking === false)).toBe(true);
    expect(Object.fromEntries(['1', '3', '4', '6'].map((figure) => [
      figure,
      audits.reduce((sum, audit) => (
        sum + audit.summary.blocked_rules_by_figure[figure]
      ), 0),
    ]))).toEqual({ 1: 39, 3: 25, 4: 25, 6: 69 });
    expect(audits.filter((audit) => ![
      'bridgewater-college', 'christopher-newport-university',
      'george-mason-university', 'james-madison-university',
      'longwood-university',
      'norfolk-state-university',
      'old-dominion-university',
      'shenandoah-university',
      'university-of-mary-washington',
      'virginia-commonwealth-university',
      'virginia-polytechnic-institute-and-state-university',
      'virginia-state-university',
      'william-mary',
    ].includes(audit.document_id))
      .every((audit) => (
      audit.summary.ready_by_figure['1'] === false
      && audit.summary.ready_by_figure['3'] === false
      && audit.summary.ready_by_figure['4'] === false
      ))).toBe(true);
    expect(audits.find((audit) => audit.document_id === 'james-madison-university')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': true });
    expect(audits.find((audit) => audit.document_id === 'bridgewater-college')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': false });
    expect(audits.find((audit) => audit.document_id === 'christopher-newport-university')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': false });
    expect(audits.find((audit) => audit.document_id === 'university-of-mary-washington')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': false });
    expect(audits.find((audit) => audit.document_id === 'william-mary')
      ?.summary.ready_by_figure).toEqual({ '1': false, '3': true, '4': true, '6': false });
    expect(audits.find((audit) => audit.document_id === 'old-dominion-university')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': true });
    expect(audits.find((audit) => audit.document_id === 'george-mason-university')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': true });
    expect(audits.find((audit) => audit.document_id === 'norfolk-state-university')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': true });
    expect(audits.find((audit) => audit.document_id === 'longwood-university')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': false });
    expect(audits.find((audit) => audit.document_id === 'virginia-commonwealth-university')
      ?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': true });
    expect(audits.find((audit) => (
      audit.document_id === 'virginia-polytechnic-institute-and-state-university'
    ))?.summary.ready_by_figure).toEqual({ '1': true, '3': true, '4': true, '6': false });
    expect(audits.find((audit) => audit.document_id === 'virginia-state-university')
      ?.summary.ready_by_figure).toEqual({ '1': false, '3': true, '4': true, '6': false });
    expect(audits.find((audit) => audit.document_id === 'shenandoah-university')
      ?.summary.ready_by_figure).toEqual({ '1': false, '3': true, '4': true, '6': false });
    expect(audits.reduce((totals, audit) => {
      for (const [category, count] of Object.entries(
        audit.summary.active_rule_remediation,
      )) totals[category] += count;
      return totals;
    }, {
      targeted_source_research: 0,
      evaluator_engineering: 0,
      out_of_scope_administrative_rule: 0,
    })).toEqual({
      targeted_source_research: 34,
      evaluator_engineering: 38,
      out_of_scope_administrative_rule: 10,
    });
    expect(audits.reduce((totals, audit) => {
      for (const [category, count] of Object.entries(
        audit.summary.all_blocker_remediation,
      )) totals[category] += count;
      return totals;
    }, {
      targeted_source_research: 0,
      evaluator_engineering: 0,
      out_of_scope_administrative_rule: 0,
    })).toEqual({
      targeted_source_research: 34,
      evaluator_engineering: 41,
      out_of_scope_administrative_rule: 38,
    });

    const byDocument = Object.fromEntries(audits.map((audit) => [
      audit.document_id,
      [
        audit.summary.active_rules,
        audit.summary.inactive_variant_rules,
        audit.summary.supported_active_rules,
      ],
    ]));
    expect(byDocument).toEqual({
      'bridgewater-college': [13, 0, 8],
      'christopher-newport-university': [4, 0, 2],
      'george-mason-university': [14, 0, 14],
      'james-madison-university': [2, 0, 2],
      'longwood-university': [12, 0, 9],
      'norfolk-state-university': [5, 0, 5],
      'old-dominion-university': [21, 0, 21],
      'radford-university': [9, 1, 4],
      'randolph-macon-college': [15, 0, 1],
      'shenandoah-university': [13, 0, 1],
      'the-university-of-virginia-s-college-at-wise': [22, 7, 14],
      'university-of-mary-washington': [7, 0, 5],
      'university-of-virginia': [8, 3, 0],
      'virginia-commonwealth-university': [8, 0, 6],
      'virginia-military-institute': [6, 10, 4],
      'virginia-polytechnic-institute-and-state-university': [13, 0, 4],
      'virginia-state-university': [9, 0, 1],
      'william-mary': [6, 1, 4],
    });
  });

  it('keeps every active source blocker receipt identical in the final numeric projection', () => {
    const sourcePlan = cachedAcceptedSourcePlan();
    const sources = sourcePlan.documents.filter((document) => (
      document.kind === 'degree' && document.status === 'extracted'
    ));
    const configuredIds = Object.keys(getMajor('va-cs').programs).map(Number).sort((a, b) => a - b);
    const configuredUniversities = VA_INSTITUTION_REGISTRY.filter((row) => (
      row.level === 'four_year' && configuredIds.includes(row.id)
    ));
    const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
    const institutions = [college, ...configuredUniversities].map((row) => ({
      _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
      level: row.level,
      name: row.name,
    }));
    // One deliberately unmatched equivalency per configured owner activates
    // exactly the production cohort. Requirement receipts come solely from
    // the projected source tree, so the witness cannot satisfy or alter one.
    const supply = {
      course_id: courseIdFor('CSC299'),
      course_key: 'va:CSC299',
      code: 'CSC299',
      title: 'Projection parity supply witness',
      credits: 3,
      offered_by: [college.name],
      articulates_to: configuredUniversities.map((row) => ({
        institution: row.name,
        identifier: 'NO_MATCH_299',
      })),
    };
    const projection = buildProjection({
      courses: [supply],
      degrees: sources,
      asDegrees: [],
      institutions,
    });
    expect(projection.degrees.map((document) => document.school_id).sort((a, b) => a - b))
      .toEqual(configuredIds);
    for (const schoolId of [9210, 9218]) {
      expect(gmuOduFigure6Selection(
        projection.degrees.find((document) => document.school_id === schoolId),
      )).toMatchObject({ ready: true });
    }

    const blockersFor = (audit, figure) => [
      ...audit.active_rules.filter((row) => (
        !row.supported && row.affected_figures.includes(figure)
      )),
      ...audit.unit_audit.filter((row) => (
        row.blocking && row.affected_figures.includes(figure)
      )),
    ].map((row) => `${row.path}|${row.kind}`).sort();

    for (const projected of projection.degrees) {
      const source = sources.find((document) => document._id === projected.va_requirement_id);
      expect(source, `${projected._id}:source-link`).toBeTruthy();
      const sourceAudit = auditFourYearDocument(source);
      const projectedAudit = auditFourYearDocument(projected);
      for (const figure of ['1', '3', '4', '6']) {
        expect(
          blockersFor(projectedAudit, figure),
          `${projected._id}:Figure${figure}`,
        ).toEqual(blockersFor(sourceAudit, figure));
      }
    }
  });

  it('reports narrow impact only for rules whose figure scope is known', () => {
    expect(affectedFiguresForConstraint({ kind: 'perspectives_sequence' })).toEqual(['6']);
    expect(affectedFiguresForConstraint({ kind: 'minimum_course_grade' })).toEqual(['3', '4']);
    expect(affectedFiguresForConstraint({ kind: 'general_education_assessment' })).toEqual([]);
    expect(affectedFiguresForConstraint({ kind: 'unknown_future_rule' }))
      .toEqual(['1', '3', '4', '6']);
  });

  it('fails closed for every unclassified unit-audit value shape', () => {
    const base = load('virginia-state-university');
    for (const value of [
      { status: 'required', maximum_units: 30 },
      30,
      ['required', 'maximum 30'],
    ]) {
      const doc = structuredClone(base);
      doc.unit_audit.future_transfer_cap = value;
      const row = auditFourYearDocument(doc).unit_audit
        .find((entry) => entry.kind === 'future_transfer_cap');
      expect(row).toMatchObject({
        blocking: true,
        supported: false,
        disposition: 'unknown_policy_object_requires_classification',
        affected_figures: ['1', '3', '4', '6'],
      });
    }
  });
});
