import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  affectedFiguresForAssociateConstraint,
  auditAssociateAnalysisQualityFlags,
  auditAssociateDocument,
  evaluateAssociateConstraint,
} from './associateFigureConstraints';
import {
  readinessForProjectedFigures,
  readinessForSourceFigures,
} from '../virginia/publicationReadiness';
import { canonicalSourceContract } from './canonicalSourceContract';

const require = createRequire(import.meta.url);
const { cachedAcceptedSourcePlan } = require('../../scripts/importVirginiaCatalogDegrees');
const { projectGroups } = require('../../scripts/va/buildVaDocuments');
const { institutionIdentityBySlug } = require('../virginia/institutionIds');

const sourceDocuments = cachedAcceptedSourcePlan().documents
  .filter((doc) => doc.kind === 'as_degree');

const source = (slug) => structuredClone(sourceDocuments.find((doc) => (
  doc._id === `va:as:${slug}:cs`
)));

function verified(doc) {
  doc.verification = { verified: true, stale: false };
  return doc;
}

function withReadyAcceptance(doc) {
  doc.acceptance = {
    accepted: true,
    ready_for_analysis: true,
    catalog: { checks: [] },
    analysis_ready: { checks: [] },
  };
  return doc;
}

function projected(doc) {
  const slug = String(doc?._id || '').replace(/^va:as:/, '').replace(/:cs$/, '');
  const identity = institutionIdentityBySlug(slug, 'community_college');
  return {
    ...structuredClone(doc),
    _id: `as_degree:${identity.id}:va-cs:local_as`,
    kind: 'as_degree',
    major_slug: 'va-cs',
    state: 'va',
    community_college_id: identity.id,
    college_id: `va:cc:${identity.id}`,
    college_name: identity.name,
    status: 'found',
    va_requirement_status: 'extracted',
    va_requirement_id: doc._id,
    analysis_ready: doc.acceptance?.ready_for_analysis === true,
    analysis_contract: canonicalSourceContract(),
    requirement_groups: projectGroups(doc, { associate: true }),
  };
}

function constraintOwner(doc, kind) {
  let found = null;
  const visit = (value) => {
    if (!value || typeof value !== 'object' || found) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const index = (value.analysis_constraints || [])
      .findIndex((constraint) => constraint.kind === kind);
    if (index >= 0) found = { owner: value, constraint: value.analysis_constraints[index] };
    else Object.values(value).forEach(visit);
  };
  visit({ requirement_groups: doc.requirement_groups, unit_audit: doc.unit_audit });
  if (!found) throw new Error(`missing ${kind}`);
  return found;
}

describe('Virginia associate figure constraint audit', () => {
  it('inventories all 19 current compositions without widening an unsupported kind', () => {
    const audits = sourceDocuments.map(auditAssociateDocument);
    expect(audits).toHaveLength(19);
    expect(audits.reduce((sum, audit) => sum + audit.summary.explicit_rules, 0)).toBe(78);
    expect(audits.reduce((sum, audit) => sum + audit.summary.supported_active_rules, 0))
      .toBe(53);
    expect(audits.reduce((sum, audit) => sum + audit.summary.blocked_active_rules, 0))
      .toBe(25);
    expect(audits.filter((audit) => audit.summary.ready_by_figure['3'])
      .map((audit) => audit.document_id).sort()).toEqual([
      'va:as:brightpoint-community-college:cs',
      'va:as:central-virginia-community-college:cs',
      'va:as:germanna-community-college:cs',
      'va:as:laurel-ridge-community-college:cs',
      'va:as:northern-virginia-community-college:cs',
      'va:as:piedmont-virginia-community-college:cs',
      'va:as:southwest-virginia-community-college:cs',
      'va:as:virginia-highlands-community-college:cs',
      'va:as:virginia-peninsula-community-college:cs',
      'va:as:virginia-western-community-college:cs',
    ]);
    expect(audits.filter((audit) => (
      audit.summary.ready_by_figure['3'] !== audit.summary.ready_by_figure['6']
    )).map((audit) => audit.document_id)).toEqual([
      'va:as:laurel-ridge-community-college:cs',
      'va:as:northern-virginia-community-college:cs',
    ]);
  });

  it('defaults an unknown or source-uncertain rule to every associate-side figure', () => {
    expect(affectedFiguresForAssociateConstraint({
      kind: 'future_rule', status: 'evaluator_not_implemented',
    })).toEqual(['3', '4', '6']);
    const central = source('central-virginia-community-college');
    const { owner, constraint } = constraintOwner(central, 'distinct_ge_areas');
    const uncertain = { ...constraint, status: 'unresolved_source_language' };
    expect(evaluateAssociateConstraint(uncertain, {
      container: owner, document: central, path: 'requirement_groups[0]',
    })).toMatchObject({
      supported: false,
      affected_figures: ['3', '4', '6'],
      remediation: { category: 'targeted_source_research' },
    });
  });

  it('keeps NOVA aggregate GE exact for Figures 3/4 and rejects an unreviewed carrier mutation', () => {
    const nova = withReadyAcceptance(verified(source('northern-virginia-community-college')));
    const clean = auditAssociateDocument(nova);
    expect(clean.summary.ready_by_figure).toEqual({ '3': true, '4': true, '6': false });
    expect(readinessForSourceFigures(nova, { figures: ['3', '4'] }))
      .toMatchObject({ ready: true, figure_constraint_blockers: [] });
    expect(readinessForSourceFigures(nova, { figures: ['6'] }))
      .toMatchObject({ ready: false });

    const cleanProjection = projected(nova);
    expect(readinessForProjectedFigures(cleanProjection, { figures: ['3', '4'] }))
      .toMatchObject({ ready: true, figure_constraint_blockers: [] });
    expect(readinessForProjectedFigures(cleanProjection, { figures: ['6'] }))
      .toMatchObject({ ready: false });

    // The persisted pre-import shape enumerates named receivers inside this
    // aggregate block without a category dictionary. Reproduce that semantic
    // discrepancy: neither the source nor projection gate may infer categories
    // from labels, subjects, or the existence of `distinct_areas: 2`.
    const drifted = structuredClone(nova);
    const humanities = drifted.requirement_groups.find((group) => (
      group.ge_area === 'nova_humanities_fine_arts_literature'
    ));
    humanities.sections[0].receivers = [{
      receiving: null,
      options: [{
        course_ids: [1009160722],
        course_keys: ['va:ART100'],
        source_course_keys: ['va:ART100'],
        course_conjunction: 'and',
      }],
    }];
    const driftedAudit = auditAssociateDocument(drifted);
    expect(driftedAudit.active_blockers.map((row) => row.kind))
      .toEqual(expect.arrayContaining(['distinct_areas', 'distinct_ge_areas']));
    expect(driftedAudit.summary.ready_by_figure).toEqual({
      '3': false, '4': false, '6': false,
    });

    const driftedProjection = projected(drifted);
    expect(readinessForProjectedFigures(driftedProjection, { figures: ['3'] }))
      .toMatchObject({
        ready: false,
        blockers: expect.arrayContaining(['associate_constraint_evaluator_required']),
      });
  });

  it('requires exact option-set evidence in both source and projected trees', () => {
    const central = withReadyAcceptance(verified(source('central-virginia-community-college')));
    const currentConstraint = constraintOwner(central, 'distinct_ge_areas').constraint;
    // Reproduce the current verified document contract: the requirement tree
    // lacks candidate-only category metadata, so the exact checked-in
    // option_sets dictionary is the sole admissible fallback.
    delete currentConstraint.category_subjects;
    delete currentConstraint.minimum_distinct_categories;
    expect(auditAssociateDocument(central).summary.ready_by_figure['3']).toBe(true);
    expect(auditAssociateDocument(projected(central)).summary.ready_by_figure['3']).toBe(true);

    const mutate = (doc) => {
      const group = constraintOwner(doc, 'distinct_ge_areas').owner;
      const routeCodes = new Set((group.sections || []).flatMap((section) => (
        (section.receivers || []).flatMap((receiver) => (
          (receiver.options || []).flatMap((option) => (
            option.source_course_keys || option.course_keys || []
          ))
        ))
      )).map((key) => key.split(':').at(-1)));
      const optionSet = Object.values(doc.option_sets || {}).find((candidate) => {
        const codes = [...new Set(Object.values(candidate.categories || {}).flat())].sort();
        const routes = [...routeCodes].sort();
        return JSON.stringify(codes) === JSON.stringify(routes);
      });
      optionSet.categories.art.pop();
    };
    const sourceMutation = structuredClone(central);
    mutate(sourceMutation);
    expect(auditAssociateDocument(sourceMutation).summary.ready_by_figure['3']).toBe(false);

    const projectionMutation = projected(central);
    mutate(projectionMutation);
    expect(readinessForProjectedFigures(projectionMutation, { figures: ['3'] }))
      .toMatchObject({
        ready: false,
        blockers: expect.arrayContaining(['associate_constraint_evaluator_required']),
      });
  });

  it('opens only Laurel Ridge Figures 3/4 while preserving the complete-degree and Figure 6 conflict', () => {
    const laurel = verified(source('laurel-ridge-community-college'));
    expect(laurel.acceptance?.ready_for_analysis).toBe(false);
    expect(readinessForSourceFigures(laurel, { figures: ['3', '4'] })).toMatchObject({
      ready: true,
      complete_degree_ready: false,
      figure_constraint_blockers: [],
    });
    expect(readinessForSourceFigures(laurel, { figures: ['6'] })).toMatchObject({
      ready: false,
      figure_constraint_blockers: [expect.objectContaining({
        kind: 'published_maximum_source_conflict',
        affected_figures: ['6'],
      })],
    });

    const final = projected(laurel);
    expect(final.analysis_ready).toBe(false);
    expect(readinessForProjectedFigures(final, { figures: ['3', '4'] })).toMatchObject({
      ready: true,
      complete_degree_ready: false,
      figure_constraint_blockers: [],
    });
    expect(readinessForProjectedFigures(final, { figures: ['6'] })).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(['explicit_analysis_ready_projection_required']),
    });

    const drifted = structuredClone(final);
    drifted.requirement_groups[0].sections[0].unit_advisement_max = 2;
    expect(readinessForProjectedFigures(drifted, { figures: ['3', '4'] })).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(['associate_constraint_evaluator_required']),
    });
  });

  it('closes only Mountain Gateway’s published UCGS cap and preserves all three open destination components', () => {
    const accepted = source('mountain-gateway-community-college');
    const final = projected(accepted);
    for (const document of [accepted, final]) {
      const audit = auditAssociateDocument(document);
      expect(audit.active_rules.find((row) => (
        row.kind === 'published_ucgs_component_cap'
      ))).toMatchObject({
        supported: true,
        evaluator: 'evaluateAssociateCollegeConstraint',
        affected_figures: ['3', '4', '6'],
        proof: {
          raw_unit_tuple_count: 9,
          destination_selected_course_identities_resolved: false,
        },
      });
      expect(audit.active_blockers.map((row) => row.kind)).toEqual([
        'choose_two_variable_credit_open_roster',
        'destination_selected_open_stem_roster',
        'destination_selected_transfer_core',
      ]);
      expect(audit.summary).toMatchObject({
        supported_active_rules: 4,
        blocked_active_rules: 3,
        blocked_rules_by_figure: { '3': 3, '4': 3, '6': 3 },
        ready_by_figure: { '3': false, '4': false, '6': false },
      });
    }
    for (const figure of ['3', '4', '6']) {
      expect(readinessForSourceFigures(accepted, { figures: [figure] }))
        .toMatchObject({ ready: false });
      expect(readinessForProjectedFigures(final, { figures: [figure] }))
        .toMatchObject({ ready: false });
    }
  });

  it('removes only RCC bundle combinatorics from Figures 3/4 and keeps math/alignment closed', () => {
    const accepted = source('rappahannock-community-college');
    const final = projected(accepted);
    for (const document of [accepted, final]) {
      const audit = auditAssociateDocument(document);
      const combination = audit.active_rules.find((row) => (
        row.kind === 'variable_credit_category_with_course_combinations'
      ));
      expect(combination).toMatchObject({
        supported: false,
        evaluator: 'evaluateAssociateCollegeConstraint',
        affected_figures: ['6'],
        proof: {
          exact_source_roster_course_count: 123,
          exact_candidate_bundle_counts: { three_credit: 117, four_credit: 432 },
          exact_total_unit_edges_solved: [18, 19],
          global_no_double_count: true,
          destination_alignment_proven_by_this_solver: false,
          paired_mathematics_topology_proven_by_this_solver: false,
        },
      });
      expect(audit.summary.blocked_rules_by_figure).toEqual({
        '3': 2, '4': 2, '6': 3,
      });
      expect(audit.active_blockers.filter((row) => row.affected_figures.includes('3'))
        .map((row) => row.kind)).toEqual([
        'paired_math_slots_with_cross_row_routes',
        'receiving_program_alignment_required',
      ]);
    }

    const drifted = structuredClone(accepted);
    drifted.option_sets.approved_transfer_electives.course_credit_overrides.EGR121 = 3;
    expect(auditAssociateDocument(drifted).active_rules.find((row) => (
      row.kind === 'variable_credit_category_with_course_combinations'
    ))).toMatchObject({
      supported: false,
      affected_figures: ['3', '4', '6'],
    });
  });

  it('retains Wytheville grade and competency rules as complete-degree blockers only', () => {
    const wytheville = verified(source('wytheville-community-college'));
    wytheville.requirement_groups.forEach((group) => {
      delete group.distinct_course_ids_across_sections;
      delete group.distinct_areas;
      group.analysis_constraints = [];
      (group.sections || []).forEach((section) => { section.analysis_constraints = []; });
    });
    wytheville.data_quality_flags = [];
    wytheville.acceptance = {
      accepted: true,
      ready_for_analysis: false,
      catalog: { checks: [] },
      analysis_ready: {
        checks: [{ name: 'constraint_support', severity: 'fail' }],
      },
    };
    const sourceGate = readinessForSourceFigures(wytheville, { figures: ['3', '4', '6'] });
    expect(sourceGate).toMatchObject({
      ready: true,
      complete_degree_ready: false,
      figure_constraint_blockers: [],
    });
    expect(sourceGate.associate_constraint_audit.active_blockers).toEqual([
      expect.objectContaining({ kind: 'minimum_course_grade', affected_figures: [] }),
      expect.objectContaining({ kind: 'computer_competency_multiple_routes', affected_figures: [] }),
    ]);

    const projectedGate = readinessForProjectedFigures(projected(wytheville), {
      figures: ['3', '4', '6'],
    });
    expect(projectedGate).toMatchObject({ ready: true, complete_degree_ready: false });

    const flattened = structuredClone(wytheville);
    flattened.requirement_groups[0].sections.push({
      section_advisement: 1,
      unit_advisement: 3,
      receivers: [{ options: [{ course_ids: [1], course_keys: ['va:ITE115'] }] }],
    });
    expect(readinessForSourceFigures(flattened, { figures: ['3'] })).toMatchObject({
      ready: false,
      blockers: expect.arrayContaining(['associate_constraint_evaluator_required']),
      figure_constraint_blockers: [expect.objectContaining({
        kind: 'computer_competency_multiple_routes',
      })],
    });
  });

  it('supersedes only Tidewater implementation flags with exact active-rule counts', () => {
    const tidewater = source('tidewater-community-college');
    tidewater.data_quality_flags.push(
      {
        code: 'distinct_humanities_categories_require_evaluation',
        severity: 'block_analysis',
      },
      {
        code: 'overlapping_options_are_distinct_slots',
        severity: 'block_analysis',
      },
    );
    const flags = auditAssociateAnalysisQualityFlags(tidewater);
    expect(flags.filter((flag) => flag.severity === 'block_analysis' && [
      'distinct_humanities_categories_require_evaluation',
      'overlapping_options_are_distinct_slots',
    ].includes(flag.code))).toEqual([
      expect.objectContaining({ resolved_by_exact_evaluator: true }),
      expect.objectContaining({ resolved_by_exact_evaluator: true }),
    ]);

    const drifted = structuredClone(tidewater);
    constraintOwner(drifted, 'no_double_count_between_technical_slots')
      .constraint.status = 'unresolved_source_language';
    expect(auditAssociateAnalysisQualityFlags(drifted)
      .find((flag) => flag.code === 'overlapping_options_are_distinct_slots'))
      .toMatchObject({ resolved_by_exact_evaluator: false });

    const stronger = structuredClone(tidewater);
    stronger.data_quality_flags.find((flag) => (
      flag.code === 'distinct_humanities_categories_require_evaluation'
    )).severity = 'block';
    expect(auditAssociateAnalysisQualityFlags(stronger)
      .find((flag) => flag.code === 'distinct_humanities_categories_require_evaluation'))
      .toMatchObject({ resolved_by_exact_evaluator: false });
  });
});
