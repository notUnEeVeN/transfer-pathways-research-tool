import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  PLANS,
  RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256,
  RAPP_APPROVED_TRANSFER_ELECTIVE_RULE,
  RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE,
  RAPP_MATHEMATICS_GROUP_SHA256,
  RAPP_MATHEMATICS_OPTION_SET_SHA256,
  exactCreditBundles,
  exactRappahannockApprovedTransferElectiveCarrier,
  exactReviewedDocument,
  proveRappahannockApprovedTransferElectiveCombinations,
  proveRappahannockPairedMathematics,
  proveRappahannockReceivingProgramAlignment,
  rappahannockExactSixtyCreditWitness,
  rappahannockFigure34NegativeProof,
  richardBlandFigure34NegativeProof,
  solveRappahannockApprovedTransferElectiveBundles,
} from './rappahannockRichardBlandConstraintProofs';
import { canonicalSourceContract } from './canonicalSourceContract';
import { courseIdFor } from '../virginia/courseIdentity';

const require = createRequire(import.meta.url);
const { cachedAcceptedSourcePlan } = require('../../scripts/importVirginiaCatalogDegrees');
const { projectGroups } = require('../../scripts/va/buildVaDocuments');

const sourceDocuments = cachedAcceptedSourcePlan().documents
  .filter((document) => document.kind === 'as_degree');

function source(plan) {
  return structuredClone(sourceDocuments.find((document) => document._id === plan.sourceId));
}

function operationalRappahannock() {
  const document = source(PLANS.rappahannock);
  document.provenance.source_bundle_hash =
    '542140ae69475ff93426ef6c1dc5de6c0f65988f610b046fc0d539b87fe1cf25';
  const courses = document.option_sets.approved_transfer_electives.courses;
  courses.splice(courses.indexOf('MTH161'), 0, 'MTH154');
  document.requirement_groups[5].sections[0].receivers = [{
    articulation_status: 'articulated',
    not_articulated_reason: null,
    options: [
      ['MTH154', 'or'], ['MTH161', 'and'], ['MTH245', 'and'], ['MTH161', 'and'],
      ['MTH162', 'and'], ['MTH167', 'or'], ['MTH263', 'and'], ['MTH264', 'and'],
    ].map(([code, conjunction]) => ({
      course_ids: [courseIdFor(code)],
      course_keys: [`va:${code}`],
      course_conjunction: conjunction,
    })),
    options_conjunction: 'or',
    hash_id: null,
    tier: null,
    course_level: null,
    cc_articulable: null,
    overlap_key: null,
    note: null,
    receiving: null,
    code_seen: 'MTH 154 / MTH 161 / MTH 162 / MTH 167 / MTH 245 / MTH 261 / MTH 263 / MTH 264 ',
    human_review: null,
  }];
  return document;
}

function projection(document, plan) {
  return {
    ...structuredClone(document),
    _id: `as_degree:${plan.numericId}:va-cs:local_as`,
    kind: 'as_degree',
    major_slug: 'va-cs',
    state: 'va',
    community_college_id: plan.numericId,
    college_id: `va:cc:${plan.numericId}`,
    college_name: plan.name,
    status: 'found',
    va_requirement_status: 'extracted',
    va_requirement_id: document._id,
    analysis_ready: document.acceptance?.ready_for_analysis === true,
    analysis_contract: canonicalSourceContract(),
    requirement_groups: projectGroups(document, { associate: true }),
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const PAGE_SUFFIX = Object.freeze({
  catalog: 'catalog',
  major: 'program',
  program_intent: 'program_intent',
  general_education: 'ge',
  graduation: 'graduation',
  policy: 'policy',
  course_catalog: 'course_catalog',
});

function retainedPage(plan, sourceId) {
  return path.resolve(
    __dirname,
    `../../.va-catalogs/pages/${plan.slug}__${PAGE_SUFFIX[sourceId]}.txt`,
  );
}

function withoutStyle(proof) {
  const copy = structuredClone(proof);
  delete copy.document_style;
  return copy;
}

function combinationCarrier(document) {
  const owner = document.requirement_groups[12];
  return { owner, constraint: owner.analysis_constraints[0] };
}

describe('Rappahannock and Richard Bland exact negative Figure 3/4 receipts', () => {
  it.each(Object.values(PLANS))(
    'binds every $name receipt to the exact retained official text bytes',
    (plan) => {
      for (const receipt of plan.sources) {
        const file = retainedPage(plan, receipt.id);
        expect(fs.existsSync(file), file).toBe(true);
        expect(sha256(fs.readFileSync(file))).toBe(receipt.sha256);
      }
    },
  );

  it('retains the exact source language that makes both shortcuts unsafe', () => {
    const rappProgram = fs.readFileSync(retainedPage(PLANS.rappahannock, 'major'), 'utf8');
    const rappGe = fs.readFileSync(
      retainedPage(PLANS.rappahannock, 'general_education'),
      'utf8',
    );
    expect(rappProgram).toContain('MTH 161/MTH 162');
    expect(rappProgram).toContain('MTH 263/MTH 264');
    expect(rappProgram).toContain('Students should consult with their academic advisor to select courses required by their desired degree at their transfer institution.');
    expect(rappGe).toContain('MTH 167\u00a0-\u00a0Precalculus with Trigonometry (5 Credits)');
    expect(rappGe).toContain('MTH 263\u00a0-\u00a0Calculus I (4 Credits)');
    expect(rappGe).toContain('MTH 264\u00a0-\u00a0Calculus II (4 Credits)');
    expect(rappGe).toContain('If a student has taken a course, wishes to take a course, or transferred a course from another college that is not on this list, you must consult with your faculty advisor to find out if that course can be applied');

    const rbcProgram = fs.readFileSync(retainedPage(PLANS.richardBland, 'major'), 'utf8');
    expect(rbcProgram).toContain('Quantitative and Symbolic Reasoning: 19 - 20 Credit Hours');
    expect(rbcProgram).toContain('For\u00a0Computer Science\u00a0take CSCI 222 and one math course');
    expect(rbcProgram).toContain('MATH\u00a0-\u00a0261 Multivariable Calculus Credits: 4');
    expect(rbcProgram).toContain('Electives: 15 - 16 Credit Hours');
    expect(rbcProgram).toContain('Total Credit Hours 60');
  });

  it('re-derives the 123-course dictionary and every credit range from the exact published named list without calling that list closed', () => {
    const document = source(PLANS.rappahannock);
    const text = fs.readFileSync(
      retainedPage(PLANS.rappahannock, 'general_education'),
      'utf8',
    );
    const start = text.indexOf('Courses which meet the APPROVED TRANSFER ELECTIVES');
    const end = text.indexOf('\nNote(s):', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const printedRows = text.slice(start, end).split(/\r?\n/).flatMap((line) => {
      const match = line.match(
        /^([A-Z]{2,4})\s+(\d{3})\s*[-–—].*?\((\d+)(?:-(\d+))? Credits?\)/i,
      );
      return match ? [{
        code: `${match[1]}${match[2]}`.toUpperCase(),
        minimum: Number(match[3]),
        maximum: Number(match[4] || match[3]),
      }] : [];
    });
    const uniqueRows = new Map(printedRows.map((row) => [row.code, row]));
    expect(printedRows).toHaveLength(125);
    expect([...uniqueRows]).toHaveLength(123);
    expect(printedRows.filter((row, index) => (
      printedRows.findIndex((candidate) => candidate.code === row.code) !== index
    )).map((row) => row.code)).toEqual(['CST100', 'CST110']);

    const optionSet = document.option_sets.approved_transfer_electives;
    expect(optionSet.courses).toEqual([...uniqueRows.keys()]);
    for (const code of optionSet.courses) {
      const sourceUnits = uniqueRows.get(code);
      const stored = optionSet.course_credit_overrides[code]
        ?? optionSet.default_course_credits;
      const storedRange = typeof stored === 'number'
        ? { minimum: stored, maximum: stored }
        : stored;
      expect(storedRange, code).toEqual({
        minimum: sourceUnits.minimum,
        maximum: sourceUnits.maximum,
      });
    }

    const proof = proveRappahannockReceivingProgramAlignment(
      document.requirement_groups[12].analysis_constraints[1],
      { owner: document.requirement_groups[12], doc: document },
    );
    expect(proof.proof).toMatchObject({
      exact_published_named_roster_course_count: 123,
      published_named_roster_is_closed_feasible_universe: false,
      unlisted_courses_may_require_faculty_advisor_approval: true,
      destination_alignment_proven: false,
    });
  });

  it('retains exact negative receipts for the unresolved paired-math and destination-alignment rules', () => {
    const accepted = source(PLANS.rappahannock);
    const projected = projection(accepted, PLANS.rappahannock);
    for (const document of [accepted, projected]) {
      const mathematics = document.requirement_groups[5];
      const mathProof = proveRappahannockPairedMathematics(
        mathematics.analysis_constraints[0],
        { owner: mathematics, doc: document },
      );
      expect(mathProof).toMatchObject({
        handled: true,
        ready: false,
        supported: false,
        affected_figures: ['3', '4', '6'],
        proof: {
          mathematics_option_set_sha256: RAPP_MATHEMATICS_OPTION_SET_SHA256,
          mathematics_group_sha256: RAPP_MATHEMATICS_GROUP_SHA256,
          complete_calculus_row_allocation_proven: false,
          partial_quantitative_witness_is_publication_selector: false,
        },
      });
      expect(mathProof.proof.exact_quantitative_route_witnesses).toEqual([
        ['MTH154', 'MTH245'],
        ['MTH161', 'MTH245'],
      ]);
      expect(mathProof.proof.unresolved_calculus_topology).toHaveLength(4);

      const electives = document.requirement_groups[12];
      const alignmentProof = proveRappahannockReceivingProgramAlignment(
        electives.analysis_constraints[1],
        { owner: electives, doc: document },
      );
      expect(alignmentProof).toMatchObject({
        handled: true,
        ready: false,
        supported: false,
        affected_figures: ['3', '4', '6'],
        proof: {
          exact_published_named_roster_course_count: 123,
          published_named_roster_is_closed_feasible_universe: false,
          receiving_program_specific_selection_required: true,
          universal_computer_science_subset_published_by_bound_sources: false,
          destination_alignment_proven: false,
        },
      });
    }
  });

  it('fails both negative receipts closed on detached carriers or any relevant source-tree drift', () => {
    const base = source(PLANS.rappahannock);
    const detachedMath = structuredClone(
      base.requirement_groups[5].analysis_constraints[0],
    );
    expect(proveRappahannockPairedMathematics(detachedMath, {
      owner: base.requirement_groups[5], doc: base,
    }).reason).toContain('detached');
    const detachedAlignment = structuredClone(
      base.requirement_groups[12].analysis_constraints[1],
    );
    expect(proveRappahannockReceivingProgramAlignment(detachedAlignment, {
      owner: base.requirement_groups[12], doc: base,
    }).reason).toContain('detached');

    const mutations = [
      (document) => { document.sources[1].sha256 = '0'.repeat(64); },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.option_sets.mathematics_requirements.printed_slots[1].credits_maximum = 5; },
      (document) => { document.option_sets.mathematics_requirements.recommended_routes[1].then_calculus_routes.pop(); },
      (document) => { document.option_sets.approved_transfer_electives.courses.pop(); },
      (document) => { document.requirement_groups[12].analysis_constraints[1].description = 'guess'; },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(base);
      mutate(changed);
      const math = proveRappahannockPairedMathematics(
        changed.requirement_groups[5].analysis_constraints[0],
        { owner: changed.requirement_groups[5], doc: changed },
      );
      const alignment = proveRappahannockReceivingProgramAlignment(
        changed.requirement_groups[12].analysis_constraints[1],
        { owner: changed.requirement_groups[12], doc: changed },
      );
      expect(math.ready).toBe(false);
      expect(alignment.ready).toBe(false);
      expect(math.affected_figures).toEqual(['3', '4', '6']);
      expect(alignment.affected_figures).toEqual(['3', '4', '6']);
      expect(math.proof.complete_calculus_row_allocation_proven).toBeUndefined();
      expect(alignment.proof.destination_alignment_proven).toBeUndefined();
    }
  });

  it('keeps Rappahannock closed even when a destination-aligned exact 60-credit witness exists', () => {
    const document = source(PLANS.rappahannock);
    // These are the exact RCC courses joined to named Norfolk State CS degree
    // requirements in the real-data probe. The proof consumes ids, not labels.
    const aligned = new Set([
      'ART100', 'BUS100', 'CST100', 'ENG258', 'ENG275', 'HIS111', 'HIS122',
      'HIS141', 'HIS142', 'MTH162', 'MUS121',
    ].map(courseIdFor));
    const witness = rappahannockExactSixtyCreditWitness(document, aligned);
    expect(witness).not.toBeNull();
    expect(witness.total_units).toBe(60);
    expect(witness.fixed_units).toBe(36);
    expect(witness.mathematics_units).toBe(6);
    expect(witness.approved_transfer_elective_units).toBe(18);
    expect(witness.elective_bundles).toHaveLength(6);
    expect(witness.elective_bundles.flatMap((bundle) => bundle.course_ids).every((id) => (
      aligned.has(id)
    ))).toBe(true);
    expect(new Set(witness.selected_course_ids).size).toBe(witness.selected_course_ids.length);

    const receipt = rappahannockFigure34NegativeProof(document, {
      destinationAlignedCourseIds: aligned,
    });
    expect(receipt.ready).toBe(false);
    expect(receipt.supported).toBe(false);
    expect(receipt.affected_figures).toEqual(['3', '4']);
    expect(receipt.proof.exact_60_credit_witness).not.toBeNull();
    expect(receipt.proof.exact_60_credit_witness_is_publication_selector).toBe(false);
    expect(receipt.proof.receiving_program_alignment_required).toBe(true);
    expect(receipt.proof.unresolved_calculus_topology).toHaveLength(4);
  });

  it('represents exact one-plus-two credit Rappahannock combinations without treating them as proof of the full optimizer', () => {
    const document = source(PLANS.rappahannock);
    const optionSet = document.option_sets.approved_transfer_electives;
    const allowed = new Set(['EGR121', 'PED109'].map(courseIdFor));
    const bundles = exactCreditBundles(optionSet, allowed, 3);
    expect(bundles).toContainEqual({
      course_codes: ['EGR121', 'PED109'],
      course_ids: [courseIdFor('EGR121'), courseIdFor('PED109')],
      units_by_course: { EGR121: 2, PED109: 1 },
      units: 3,
    });
    expect(rappahannockFigure34NegativeProof(document, {
      destinationAlignedCourseIds: allowed,
    }).ready).toBe(false);
  });

  it('solves the exact six RCC rows at both published edges and preserves variable credits', () => {
    const document = source(PLANS.rappahannock);
    const fiveFixed = ['ART100', 'ART101', 'ART102', 'ART121', 'ART243'];
    const lowerEligible = new Set([
      ...fiveFixed, 'PED101', 'PED109',
    ].map(courseIdFor));
    const lower = solveRappahannockApprovedTransferElectiveBundles(document, {
      eligibleCourseIds: lowerEligible,
      targetUnits: 18,
    });
    expect(lower).toMatchObject({ ready: true, supported: true, feasible: true });
    expect(lower.rows.map((row) => row.units)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(lower.rows.at(-1)).toMatchObject({
      units_minimum: 3,
      units_maximum: 4,
      course_codes: ['PED101', 'PED109'],
      units_by_course: { PED101: 2, PED109: 1 },
    });
    expect(new Set(lower.selected_course_ids).size).toBe(lower.selected_course_ids.length);
    expect(lower.proof).toMatchObject({
      source_bound_rule: RAPP_APPROVED_TRANSFER_ELECTIVE_RULE,
      elective_dictionary_sha256: RAPP_APPROVED_TRANSFER_ELECTIVE_DICTIONARY_SHA256,
      exact_source_roster_course_count: 123,
      selected_units: 18,
      global_no_double_count: true,
      destination_alignment_proven_by_this_solver: false,
    });

    const upper = solveRappahannockApprovedTransferElectiveBundles(document, {
      eligibleCourseIds: new Set([...fiveFixed, 'BIO101'].map(courseIdFor)),
      targetUnits: 19,
    });
    expect(upper).toMatchObject({ ready: true, supported: true, feasible: true });
    expect(upper.rows.map((row) => row.units)).toEqual([3, 3, 3, 3, 3, 4]);
    expect(upper.rows.at(-1)).toMatchObject({
      course_codes: ['BIO101'],
      units_by_course: { BIO101: 4 },
      units: 4,
    });
  });

  it('honors global no-double-count and rejects a five-credit course as a three-credit row', () => {
    const document = source(PLANS.rappahannock);
    const eligible = new Set([
      'ART100', 'ART101', 'ART102', 'ART121', 'ART243', 'ART244', 'MTH167',
    ].map(courseIdFor));
    const feasible = solveRappahannockApprovedTransferElectiveBundles(document, {
      eligibleCourseIds: eligible,
      globallySelectedCourseIds: [courseIdFor('ART100')],
      targetUnits: 18,
    });
    expect(feasible).toMatchObject({ ready: true, feasible: false });
    expect(feasible.proof.candidate_bundle_counts).toEqual({
      three_credit: 5,
      four_credit: 0,
    });

    const unblocked = solveRappahannockApprovedTransferElectiveBundles(document, {
      eligibleCourseIds: eligible,
      targetUnits: 18,
    });
    expect(unblocked).toMatchObject({ ready: true, feasible: true });
    expect(unblocked.selected_course_ids).not.toContain(courseIdFor('MTH167'));
    expect(new Set(unblocked.selected_course_ids).size)
      .toBe(unblocked.selected_course_ids.length);
  });

  it('closes only the exact Figure 3/4 combination rule and preserves both independent blockers', () => {
    const accepted = source(PLANS.rappahannock);
    const projected = projection(accepted, PLANS.rappahannock);
    for (const document of [accepted, projected]) {
      const { owner, constraint } = combinationCarrier(document);
      const receipt = proveRappahannockApprovedTransferElectiveCombinations(
        constraint,
        { owner, doc: document },
      );
      expect(receipt).toMatchObject({
        handled: true,
        supported: false,
        affected_figures: ['6'],
        proof: {
          exact_source_roster_course_count: 123,
          exact_candidate_bundle_counts: { three_credit: 117, four_credit: 432 },
          exact_total_unit_edges_solved: [18, 19],
          global_no_double_count: true,
          figure_3_4_combination_semantics_resolved: true,
          destination_alignment_proven_by_this_solver: false,
          paired_mathematics_topology_proven_by_this_solver: false,
          figure_6_combination_selection_resolved: false,
        },
      });
      expect(document.requirement_groups[5].analysis_constraints[0].kind)
        .toBe('paired_math_slots_with_cross_row_routes');
      expect(owner.analysis_constraints[1].kind)
        .toBe('receiving_program_alignment_required');
    }
  });

  it('normalizes only the exact protected operational RCC wrapper to the published 123-course carrier', () => {
    const accepted = operationalRappahannock();
    const final = projection(accepted, PLANS.rappahannock);
    for (const document of [accepted, final]) {
      expect(exactReviewedDocument(document, PLANS.rappahannock)).toMatchObject({
        ready: true,
        proof: {
          tuple_style: 'protected_operational',
          source_bundle_sha256:
            '542140ae69475ff93426ef6c1dc5de6c0f65988f610b046fc0d539b87fe1cf25',
          proof_tree_sha256:
            '78afc9788818298561bfa2473ee3e859a8de8d3040e2a95aae7ab84370e6286a',
        },
      });
      const electives = document.requirement_groups[12];
      const carrier = exactRappahannockApprovedTransferElectiveCarrier(
        document,
        electives,
        electives.analysis_constraints[0],
      );
      expect(carrier).toMatchObject({
        ready: true,
        sourceCourseCount: 124,
        excludedSourceCodes: [RAPP_PROTECTED_OPERATIONAL_EXTRA_ELECTIVE_CODE],
      });
      expect(carrier.sourceOptionSet.courses).toContain('MTH154');
      expect(carrier.optionSet.courses).not.toContain('MTH154');
      expect(carrier.optionSet.courses).toHaveLength(123);

      const combination = proveRappahannockApprovedTransferElectiveCombinations(
        electives.analysis_constraints[0],
        { owner: electives, doc: document },
      );
      expect(combination).toMatchObject({
        handled: true,
        supported: false,
        affected_figures: ['6'],
        proof: {
          source_wrapper_course_count: 124,
          excluded_nonpublished_wrapper_codes: ['MTH154'],
          exact_source_roster_course_count: 123,
          exact_published_named_roster_course_count: 123,
          protected_wrapper_normalized_in_memory_only: true,
          source_document_or_database_changed_by_this_proof: false,
          exact_candidate_bundle_counts: { three_credit: 117, four_credit: 432 },
          exact_total_unit_edges_solved: [18, 19],
          destination_alignment_proven_by_this_solver: false,
          paired_mathematics_topology_proven_by_this_solver: false,
        },
      });

      const mathematics = document.requirement_groups[5];
      expect(proveRappahannockPairedMathematics(
        mathematics.analysis_constraints[0],
        { owner: mathematics, doc: document },
      )).toMatchObject({
        handled: true,
        ready: false,
        supported: false,
        affected_figures: ['3', '4', '6'],
      });
      expect(proveRappahannockReceivingProgramAlignment(
        electives.analysis_constraints[1],
        { owner: electives, doc: document },
      )).toMatchObject({
        handled: true,
        ready: false,
        supported: false,
        affected_figures: ['3', '4', '6'],
        proof: {
          source_wrapper_course_count: 124,
          excluded_nonpublished_wrapper_codes: ['MTH154'],
          destination_alignment_proven: false,
        },
      });
    }
  });

  it('fails the protected RCC normalization closed on crossed tuples or any wrapper drift', () => {
    const candidate = source(PLANS.rappahannock);
    const operational = operationalRappahannock();
    candidate.provenance.source_bundle_hash = operational.provenance.source_bundle_hash;
    operational.provenance.source_bundle_hash = PLANS.rappahannock.sourceBundleSha256;
    for (const document of [candidate, operational]) {
      const { owner, constraint } = combinationCarrier(document);
      expect(proveRappahannockApprovedTransferElectiveCombinations(
        constraint,
        { owner, doc: document },
      )).toMatchObject({
        handled: true,
        ready: false,
        supported: false,
        affected_figures: ['3', '4', '6'],
      });
    }

    const mutations = [
      (document) => { document.sources[3].sha256 = '0'.repeat(64); },
      (document) => { document.option_sets.approved_transfer_electives.courses.push('MTH155'); },
      (document) => {
        document.option_sets.approved_transfer_electives.courses =
          document.option_sets.approved_transfer_electives.courses.filter((code) => code !== 'MTH154');
      },
      (document) => { document.requirement_groups[12].sections[0].unit_advisement_max = 20; },
      (document) => { document.requirement_groups[12].analysis_constraints[0].description = 'wider'; },
      (document) => { document.requirement_groups[5].sections[0].receivers[0].options.pop(); },
    ];
    for (const mutate of mutations) {
      const changed = operationalRappahannock();
      mutate(changed);
      const { owner, constraint } = combinationCarrier(changed);
      const result = proveRappahannockApprovedTransferElectiveCombinations(
        constraint,
        { owner, doc: changed },
      );
      expect(result).toMatchObject({
        handled: true,
        supported: false,
        affected_figures: ['3', '4', '6'],
      });
      expect(result.proof.figure_3_4_combination_semantics_resolved).toBeUndefined();
    }
  });

  it('fails the combination solver closed on whole-source, attachment, row, roster, or unit drift', () => {
    const base = source(PLANS.rappahannock);
    const mutations = [
      (document) => { document.sources[0].sha256 = '0'.repeat(64); },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.requirement_groups[12].sections[0].unit_advisement_max = 20; },
      (document) => { document.option_sets.approved_transfer_electives.printed_slots[0].count = 4; },
      (document) => { document.option_sets.approved_transfer_electives.courses.pop(); },
      (document) => { document.option_sets.approved_transfer_electives.courses[1] = 'ART100'; },
      (document) => { document.option_sets.approved_transfer_electives.course_credit_overrides.EGR121 = 3; },
      (document) => { document.requirement_groups[12].analysis_constraints.push(
        structuredClone(document.requirement_groups[12].analysis_constraints[0]),
      ); },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(base);
      mutate(changed);
      const result = solveRappahannockApprovedTransferElectiveBundles(changed, {
        eligibleCourseIds: new Set(
          changed.option_sets.approved_transfer_electives.courses.map(courseIdFor),
        ),
      });
      expect(result).toMatchObject({ ready: false, feasible: false });
    }

    const { constraint } = combinationCarrier(base);
    const detached = structuredClone(constraint);
    expect(proveRappahannockApprovedTransferElectiveCombinations(detached, {
      owner: base.requirement_groups[12], doc: base,
    })).toMatchObject({
      handled: true,
      supported: false,
      affected_figures: ['3', '4', '6'],
    });
    expect(solveRappahannockApprovedTransferElectiveBundles(base, {}))
      .toMatchObject({ ready: false, feasible: false });
  });

  it('derives Richard Bland 60-62 directly from every named branch/elective edge and stays closed', () => {
    const receipt = richardBlandFigure34NegativeProof(source(PLANS.richardBland));
    expect(receipt.ready).toBe(false);
    expect(receipt.supported).toBe(false);
    expect(receipt.affected_figures).toEqual(['3', '4']);
    expect(receipt.proof.totals_represented).toEqual([60, 61, 62]);
    expect(receipt.proof.source_authored_arithmetic).toHaveLength(6);
    expect(receipt.proof.exact_60_credit_routes).toHaveLength(2);
    expect(receipt.proof.non_60_source_authored_routes).toHaveLength(4);
    expect(receipt.proof.exact_60_credit_routes.map((route) => (
      route.branch_course_codes
    ))).toEqual([
      ['CSCI222', 'MATH254'],
      ['CSCI222', 'MATH271'],
    ]);
    expect(receipt.proof.published_component_conflict_reconciled).toBe(false);
    expect(receipt.proof.exact_60_credit_routes_are_publication_selector).toBe(false);
  });

  it.each([
    ['Rappahannock', PLANS.rappahannock, rappahannockFigure34NegativeProof],
    ['Richard Bland', PLANS.richardBland, richardBlandFigure34NegativeProof],
  ])('has exact accepted-source/final-projection parity for %s', (_label, plan, evaluate) => {
    const accepted = source(plan);
    const projected = projection(accepted, plan);
    const sourceReceipt = evaluate(accepted);
    const projectionReceipt = evaluate(projected);
    expect(sourceReceipt.ready).toBe(false);
    expect(projectionReceipt.ready).toBe(false);
    expect(sourceReceipt.proof.document_style).toBe('accepted_source');
    expect(projectionReceipt.proof.document_style).toBe('final_projection');
    expect(withoutStyle(sourceReceipt.proof)).toEqual(withoutStyle(projectionReceipt.proof));
  });

  it('fails Rappahannock closed on source, tree, roster, arithmetic, identity, or projection drift', () => {
    const base = source(PLANS.rappahannock);
    const mutations = [
      (document) => { document.sources[0].sha256 = '0'.repeat(64); },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.total_units_max = 63; },
      (document) => { document.requirement_groups[5].analysis_constraints[0].kind = 'supported'; },
      (document) => { document.option_sets.approved_transfer_electives.courses.pop(); },
      (document) => { document.option_sets.approved_transfer_electives.course_credit_overrides.MTH167 = 4; },
      (document) => { document.option_sets.mathematics_requirements.recommended_routes[1].then_calculus_routes.pop(); },
      (document) => { document._id = 'va:as:another-college:cs'; },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(base);
      mutate(changed);
      const receipt = rappahannockFigure34NegativeProof(changed);
      expect(receipt.ready).toBe(false);
      expect(receipt.proof.exact_60_credit_witness).toBeUndefined();
    }
    const projected = projection(base, PLANS.rappahannock);
    projected.analysis_contract.aggregate_fill = 'guess';
    expect(rappahannockFigure34NegativeProof(projected).reason).toContain(
      'canonical projection contract',
    );
  });

  it('fails Richard Bland closed on source, tree, branch-unit, namespace, identity, or projection drift', () => {
    const base = source(PLANS.richardBland);
    const mutations = [
      (document) => { document.sources[0].sha256 = '0'.repeat(64); },
      (document) => { document.provenance.source_bundle_hash = '0'.repeat(64); },
      (document) => { document.total_units_max = 62; },
      (document) => { document.requirement_groups[6].sections[0].receivers[0].options.pop(); },
      (document) => { document.data_quality_flags[2].severity = 'review'; },
      (document) => { document.course_namespace.institution_id = 'va:vccs'; },
      (document) => {
        document.course_unit_evidence.find((row) => row.code === 'MATH261').units = 3;
      },
      (document) => {
        document.course_unit_evidence.find((row) => row.code === 'MATH254').course_id += 1;
      },
      (document) => { document._id = 'va:as:another-college:cs'; },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(base);
      mutate(changed);
      const receipt = richardBlandFigure34NegativeProof(changed);
      expect(receipt.ready).toBe(false);
      expect(receipt.proof.source_authored_arithmetic).toBeUndefined();
    }
    const projected = projection(base, PLANS.richardBland);
    projected.analysis_contract.course_units = 'statewide_guess';
    expect(richardBlandFigure34NegativeProof(projected).reason).toContain(
      'canonical projection contract',
    );
  });
});
