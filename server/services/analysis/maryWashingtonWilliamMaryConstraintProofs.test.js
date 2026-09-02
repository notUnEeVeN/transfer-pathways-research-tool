import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  affectedFiguresForConstraint,
  auditFourYearDocument,
} from './fourYearConstraints';
import {
  evaluateUmwResidencyPolicy,
  evaluateWmResidencyPolicy,
  proveWmForeignLanguageFigure34BestCase,
} from './maryWashingtonWilliamMaryConstraintProofs';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { computeUnitBudget } from '../degreeSlots';
import { canonicalSourceContract } from './canonicalSourceContract';

const CATALOGS = path.resolve(__dirname, '../../.va-catalogs');
const loadJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const source = (slug) => loadJson(path.join(CATALOGS, 'composed', `${slug}.json`));
const requirement = (slug) => loadJson(path.join(CATALOGS, 'requirements', `${slug}.json`));
const projection = (slug) => cachedAcceptedSourcePlan().evaluatedDocuments.find((doc) => (
  doc.institution_id === `va:uni:${slug}`
));

const UMW = 'university-of-mary-washington';
const WM = 'william-mary';
const UMW_SUPPORTED = [
  'capacity_contains_overlapping_ge_gates',
  'conditional_transfer_waiver',
  'distinct_methods_categories',
  'overlapping_attribute_and_course_requirements',
];
const WM_SUPPORTED = [
  'capacity_reallocation_after_overlap',
  'coll350_attribute_overlap',
  'coll_major_overlap_limit',
];

function receipts(doc, kinds) {
  return auditFourYearDocument(doc).active_rules
    .filter((row) => kinds.includes(row.kind))
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

function groupWithConstraint(doc, kind) {
  return doc.requirement_groups.find((group) => (
    (group.analysis_constraints || []).some((constraint) => constraint.kind === kind)
  ));
}

function sectionWithCode(group, code) {
  return group.sections.find((section) => (
    section.receivers.some((receiver) => (
      receiver.code === code || receiver.receiving?.code === code
    ))
  ));
}

describe('Mary Washington and William & Mary exact figure proofs', () => {
  it('retains identical proof capability in each checked-in composition and projection', () => {
    for (const [slug, numericId, kinds] of [
      [UMW, 9228, UMW_SUPPORTED],
      [WM, 9233, WM_SUPPORTED],
    ]) {
      const sourceReceipts = receipts(source(slug), kinds);
      const projectedReceipts = receipts(projection(slug), kinds);
      expect(sourceReceipts, `${slug}:source`).toHaveLength(kinds.length);
      expect(projectedReceipts, `${slug}:projection`).toHaveLength(kinds.length);
      expect(sourceReceipts.every((row) => row.supported)).toBe(true);
      expect(projectedReceipts.every((row) => row.supported)).toBe(true);
      expect(projectedReceipts.map((row) => ({
        kind: row.kind,
        evaluator: row.evaluator,
        proof: row.proof,
      }))).toEqual(sourceReceipts.map((row) => ({
        kind: row.kind,
        evaluator: row.evaluator,
        proof: row.proof,
      })));

      // buildProjection remints the final runtime wrapper into numeric school
      // IDs while retaining the exact source requirement ID as provenance.
      const runtimeProjection = structuredClone(projection(slug));
      runtimeProjection.va_requirement_id = `va:degree:${slug}:cs`;
      runtimeProjection._id = `degree:${numericId}:va-cs`;
      runtimeProjection.institution_id = `va:uni:${numericId}`;
      delete runtimeProjection.slug;
      expect(receipts(runtimeProjection, kinds).every((row) => row.supported)).toBe(true);
    }
  });

  it('proves UMW residency from exact mandatory campus-only major credit', () => {
    for (const document of [source(UMW), projection(UMW)]) {
      expect(evaluateUmwResidencyPolicy(document)).toMatchObject({
        supported: true,
        overall_transfer_cap_units: 90,
        effective_two_year_transfer_cap_units: 90,
        proof: {
          fixed_nonarticulable_major_units: 33,
          half_major_residency_minimum_units: 23,
          final_credit_window_units: 21,
          final_credit_window_residency_units_minimum: 15,
        },
      });
    }
    const runtime = structuredClone(projection(UMW));
    Object.assign(runtime, {
      _id: 'degree:9228:va-cs',
      school_id: 9228,
      institution_id: 'va:uni:9228',
      va_requirement_id: `va:degree:${UMW}:cs`,
      major_slug: 'va-cs',
      state: 'va',
      analysis_contract: canonicalSourceContract(),
    });
    delete runtime.slug;
    expect(evaluateUmwResidencyPolicy(runtime)).toMatchObject({ supported: true });
    expect(computeUnitBudget(runtime.requirement_groups, { sourceDocument: runtime }))
      .toMatchObject({ per_tier: { transferable: 13, nontransferable: 33 } });

    const transferableUpperMajor = structuredClone(source(UMW));
    transferableUpperMajor.requirement_groups[0].sections[3].cc_articulable = true;
    expect(evaluateUmwResidencyPolicy(transferableUpperMajor)).toBeNull();

    const changedPolicy = structuredClone(source(UMW));
    changedPolicy.unit_audit.residency.rule = 'A changed policy needs renewed review.';
    expect(evaluateUmwResidencyPolicy(changedPolicy)).toBeNull();
  });

  it('proves every W&M residency dimension on one exact legal transfer route', () => {
    for (const document of [source(WM), projection(WM)]) {
      const group = document.requirement_groups[5];
      const constraint = group.analysis_constraints[0];
      expect(evaluateWmResidencyPolicy(document, {
        container: group,
        path: 'requirement_groups[5]',
        constraint,
      })).toMatchObject({
        supported: true,
        overall_transfer_cap_units: 60,
        effective_two_year_transfer_cap_units: 60,
        declared_subrules: [
          'overall_residency', 'major_residency_units',
          'major_course_count_fraction', 'external_upper_major_course_maximum',
        ],
        proof: {
          minimum_major_course_count: 15,
          resident_major_course_count_minimum: 9,
          half_major_course_count_minimum: 8,
          resident_major_units: 27,
          external_300_400_major_courses_selected: 0,
          external_300_400_major_courses_maximum: 2,
          upper_elective_credit_contributing_course_count_minimum: 4,
          external_upper_rule_path: 'requirement_groups[5].sections[5]',
          source_bundle_sha256: '7e26dbfdf181bea3d29b1ffbfc7e81765a0b6cf9bde23d7d183a4785f83a5354',
          official_program_text_sha256: '61508bd1e00785b92456b51c694a3cdeb3e187e99cfa4d0ebf7b06e0706c088f',
          official_degree_policy_text_sha256: 'c4096bde6c76f6c56e6799d02ab0fd979e634c020efa91564ade90e0237ab579',
          major_groups_semantic_sha256: '2aacd0a632e3dc0c976bc7cbce0b80fd3903f669c9d67532d17c75661653d3d1',
          residency_group_semantic_sha256: '7871a8d6cbbbc56ff3d5a9ccb4bdc9754545b6ba03f84f616166560922a32e25',
          transfer_grade_threshold: {
            minimum_letter_grade: 'C',
            c_minus_acceptable: false,
            conditioned_input: 'hypothetical_grade_eligible_successful_pathway',
            separately_blocks_paper_figures: false,
          },
        },
      });
    }

    const runtime = structuredClone(projection(WM));
    Object.assign(runtime, {
      _id: 'degree:9233:va-cs',
      school_id: 9233,
      institution_id: 'va:uni:9233',
      va_requirement_id: `va:degree:${WM}:cs`,
      major_slug: 'va-cs',
      state: 'va',
      analysis_contract: canonicalSourceContract(),
    });
    delete runtime.slug;
    expect(evaluateWmResidencyPolicy(runtime)).toMatchObject({ supported: true });
    delete runtime.analysis_contract;
    expect(evaluateWmResidencyPolicy(runtime)).toBeNull();
  });

  it('fails the W&M residency proof on authority, tree, path, or upper-route drift', () => {
    const mutations = [
      (doc) => { doc.provenance.source_bundle_hash = '0'.repeat(64); },
      (doc) => { doc.sources.find((row) => row.id === 'major').sha256 = '0'.repeat(64); },
      (doc) => { doc.requirement_groups[5].sections[5].receivers[0].receiving.name += ' changed'; },
      (doc) => { doc.requirement_groups[5].sections[5].unit_advisement = 1; },
      (doc) => { doc.requirement_groups[0].sections[3].cc_articulable = true; },
      (doc) => { doc.requirement_groups[2].cc_articulable = true; },
      (doc) => {
        doc.requirement_groups[5].analysis_constraints.push(
          structuredClone(doc.requirement_groups[5].analysis_constraints[0]),
        );
      },
    ];
    for (const mutate of mutations) {
      const document = structuredClone(projection(WM));
      mutate(document);
      expect(evaluateWmResidencyPolicy(document), String(mutate)).toBeNull();
    }

    const document = projection(WM);
    const group = document.requirement_groups[5];
    const constraint = group.analysis_constraints[0];
    expect(evaluateWmResidencyPolicy(document, {
      container: document.requirement_groups[4],
      path: 'requirement_groups[5]', constraint,
    })).toBeNull();
    expect(evaluateWmResidencyPolicy(document, {
      container: group,
      path: 'requirement_groups[4]', constraint,
    })).toBeNull();
    expect(evaluateWmResidencyPolicy(document, {
      container: group,
      path: 'requirement_groups[5]', constraint: structuredClone(constraint),
    })).toBeNull();
  });

  it('pins the canonical projections to the retained official source bundles', () => {
    const expected = {
      [UMW]: '72ae4a8eb9bd53d6cd1ed5382c7d950252bdac902709a69be0eb6e099f349eb2',
      [WM]: '7e26dbfdf181bea3d29b1ffbfc7e81765a0b6cf9bde23d7d183a4785f83a5354',
    };
    for (const slug of [UMW, WM]) {
      const evidence = requirement(slug);
      expect(evidence.sources.length).toBe(5);
      expect(evidence.sources.every((row) => (
        row.official === true
          && row.secure === true
          && /^[a-f0-9]{64}$/.test(row.sha256)
      ))).toBe(true);
      expect(projection(slug).provenance.source_bundle_hash).toBe(expected[slug]);
      const refs = new Set(source(slug).requirement_groups.flatMap((group) => group.source_refs));
      expect([...refs].every((ref) => evidence.sources.some((row) => row.id === ref))).toBe(true);
    }
  });

  it('does not derive capability from titles, labels, names, or constraint prose', () => {
    for (const [slug, kinds] of [[UMW, UMW_SUPPORTED], [WM, WM_SUPPORTED]]) {
      const doc = structuredClone(source(slug));
      for (const [groupIndex, group] of doc.requirement_groups.entries()) {
        group.title = `changed group ${groupIndex}`;
        for (const constraint of group.analysis_constraints || []) {
          constraint.description = 'changed prose that carries no evaluator state';
        }
        for (const [sectionIndex, section] of group.sections.entries()) {
          section.label = `changed section ${sectionIndex}`;
          for (const receiver of section.receivers) receiver.name = 'changed display name';
        }
      }
      expect(receipts(doc, kinds).every((row) => row.supported)).toBe(true);
    }
  });

  it('fails every UMW accounting proof when canonical units, category identity, or source refs drift', () => {
    const mutations = [
      (doc) => { doc.unit_audit.general_education_and_elective_capacity_units = 73; },
      (doc) => {
        const ge = groupWithConstraint(doc, 'overlapping_attribute_and_course_requirements');
        ge.source_refs = ['general_education'];
      },
      (doc) => {
        const ge = groupWithConstraint(doc, 'distinct_methods_categories');
        sectionWithCode(ge, 'UMW-GE-ADDITIONAL-ARTS-LITERATURE')
          .receivers[0].code = 'UMW-GE-UNREVIEWED-METHOD';
      },
      (doc) => {
        const capacity = groupWithConstraint(doc, 'capacity_contains_overlapping_ge_gates');
        capacity.sections[0].units = 73;
        capacity.sections[0].receivers[0].units = 73;
      },
      (doc) => { doc.slug = WM; },
    ];
    for (const mutate of mutations) {
      const doc = structuredClone(source(UMW));
      mutate(doc);
      const rows = receipts(doc, UMW_SUPPORTED);
      expect(rows).toHaveLength(UMW_SUPPORTED.length);
      expect(rows.every((row) => row.supported === false)).toBe(true);
    }
  });

  it('fails every William & Mary accounting proof when units, carriers, or identity drift', () => {
    const mutations = [
      (doc) => { doc.unit_audit.canonical_distinct_coll_and_arts_units = 33; },
      (doc) => {
        const coll = groupWithConstraint(doc, 'coll_major_overlap_limit');
        sectionWithCode(coll, 'WM-COLL350').receivers[0].code = 'WM-COLL350-UNREVIEWED';
      },
      (doc) => {
        const capacity = groupWithConstraint(doc, 'capacity_reallocation_after_overlap');
        capacity.sections[0].units = 37;
        capacity.sections[0].receivers[0].units = 37;
      },
      (doc) => { doc.requirement_groups[0].sections[0].units = 5; },
      (doc) => { doc.slug = UMW; },
    ];
    for (const mutate of mutations) {
      const doc = structuredClone(source(WM));
      mutate(doc);
      const rows = receipts(doc, WM_SUPPORTED);
      expect(rows).toHaveLength(WM_SUPPORTED.length);
      expect(rows.every((row) => row.supported === false)).toBe(true);
    }
  });

  it('uses the exact W&M zero-course language route only for optimistic Figures 3/4', () => {
    const umw = auditFourYearDocument(source(UMW));
    expect(umw.summary).toMatchObject({
      supported_active_rules: 5,
      blocked_rules_by_figure: { '1': 0, '3': 0, '4': 0, '6': 2 },
      ready_by_figure: { '1': true, '3': true, '4': true, '6': false },
    });
    expect(umw.active_rules.filter((row) => !row.supported).map((row) => row.kind))
      .toEqual([
        'no_double_count_with_prior_major_requirements',
        'no_double_count_with_prior_major_requirements',
      ]);

    const wm = auditFourYearDocument(source(WM));
    expect(wm.summary).toMatchObject({
      supported_active_rules: 4,
      blocked_rules_by_figure: { '1': 1, '3': 0, '4': 0, '6': 2 },
      ready_by_figure: { '1': false, '3': true, '4': true, '6': false },
    });
    expect(wm.active_rules.filter((row) => !row.supported).map((row) => row.kind))
      .toEqual([
        'open_course_category_with_exclusions',
        'foreign_language_proficiency_variable_credit',
      ]);

    const umwDoc = source(UMW);
    const umwScopedMajor = groupWithConstraint(
      umwDoc, 'no_double_count_with_prior_major_requirements',
    );
    const noDoubleCount = umwScopedMajor.analysis_constraints.find((row) => (
      row.kind === 'no_double_count_with_prior_major_requirements'
    ));
    expect(affectedFiguresForConstraint(noDoubleCount, {
      container: umwScopedMajor, document: umwDoc,
    })).toEqual(['6']);

    const wmDoc = source(WM);
    const openGroup = groupWithConstraint(wmDoc, 'open_course_category_with_exclusions');
    const openRule = openGroup.analysis_constraints.find((row) => (
      row.kind === 'open_course_category_with_exclusions'
    ));
    expect(affectedFiguresForConstraint(openRule, {
      container: openGroup, document: wmDoc,
    })).toEqual(['1', '6']);
    const languageGroup = groupWithConstraint(
      wmDoc, 'foreign_language_proficiency_variable_credit',
    );
    const languageRule = languageGroup.analysis_constraints.find((row) => (
      row.kind === 'foreign_language_proficiency_variable_credit'
    ));
    expect(affectedFiguresForConstraint(languageRule, {
      container: languageGroup, document: wmDoc,
    })).toEqual(['6']);
    expect(proveWmForeignLanguageFigure34BestCase(languageGroup, {
      document: wmDoc,
      constraint: languageRule,
    })).toMatchObject({
      supported: true,
      proof: {
        method: 'optimistic_best_case_source_valid_zero_increment_route',
        selected_source_options: [1, 2, 6],
        selected_college_course_increment: 0,
        selected_college_credit_increment: 0,
        zero_increment_is_universal: false,
        figure_6_supported: false,
      },
    });

    const changedCarrier = structuredClone(wmDoc);
    const changedGroup = groupWithConstraint(
      changedCarrier, 'foreign_language_proficiency_variable_credit',
    );
    sectionWithCode(changedGroup, 'WM-LANGUAGE-202-203').units = 1;
    const changedRule = changedGroup.analysis_constraints.find((row) => (
      row.kind === 'foreign_language_proficiency_variable_credit'
    ));
    expect(proveWmForeignLanguageFigure34BestCase(changedGroup, {
      document: changedCarrier,
      constraint: changedRule,
    }).supported).toBe(false);
    expect(affectedFiguresForConstraint(changedRule, {
      container: changedGroup,
      document: changedCarrier,
    })).toEqual(['1', '3', '4', '6']);

    // A context-free or future use of the same kind remains conservative.
    for (const kind of [
      'no_double_count_with_prior_major_requirements',
      'open_course_category_with_exclusions',
      'foreign_language_proficiency_variable_credit',
    ]) {
      expect(affectedFiguresForConstraint({ kind })).toEqual(['1', '3', '4', '6']);
    }
  });
});
