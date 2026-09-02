import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXCLUDED_CSCI_CODES,
  PERMITTED_MATH_CODES,
  buildWilliamMaryCurrentCatalogFigureEvidence,
  parsePublishedCredits,
} from './williamMaryCurrentCatalogFigureEvidence';
import {
  OUTPUT,
  buildFromCache,
} from '../../scripts/va/buildWilliamMaryCurrentCatalogFigureEvidence';
import {
  auditFourYearDocument,
} from './fourYearConstraints';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';

const SERVER = path.resolve(__dirname, '../..');
const CATALOGS = path.join(SERVER, '.va-catalogs');
const readText = (file) => fs.readFileSync(file, 'utf8');
const readJson = (file) => JSON.parse(readText(file));

const EXPECTED_ROSTER = [
  'CSCI301', 'CSCI303', 'CSCI304', 'CSCI312', 'CSCI315', 'CSCI321', 'CSCI324',
  'CSCI356', 'CSCI412', 'CSCI415', 'CSCI416', 'CSCI417', 'CSCI420', 'CSCI421',
  'CSCI423', 'CSCI423W', 'CSCI424', 'CSCI425', 'CSCI426', 'CSCI427', 'CSCI432',
  'CSCI434', 'CSCI435', 'CSCI436', 'CSCI437', 'CSCI437X', 'CSCI440', 'CSCI440W',
  'CSCI442', 'CSCI444', 'CSCI445', 'CSCI446', 'CSCI447', 'CSCI449', 'CSCI454',
  'CSCI455', 'CSCI464', 'CSCI465', 'CSCI466', 'CSCI490', 'CSCI495', 'CSCI495W',
  'CSCI496', 'CSCI496W', 'MATH413', 'MATH414',
];

function inputBundle() {
  const page = (suffix) => path.join(CATALOGS, 'pages', `william-mary__${suffix}`);
  const raw = path.join(CATALOGS, 'university-prerequisites', 'raw');
  return {
    programHtml: readText(page('program.html')),
    programText: readText(page('program.txt')),
    csciHtml: readText(page('course_catalog.html')),
    csciText: readText(page('course_catalog.txt')),
    geHtml: readText(page('ge.html')),
    geText: readText(page('ge.txt')),
    integrityManifest: readJson(path.join(
      CATALOGS, 'research', 'primary-source-integrity-manifest.json',
    )),
    mathHtml: readText(path.join(raw, 'william-mary', 'william-mary__math.html')),
    mathMetadata: readJson(path.join(raw, 'william-mary', 'william-mary__math.json')),
    robotsText: readText(path.join(raw, '_robots', 'catalog.wm.edu.txt')),
  };
}

function williamMaryProjection() {
  return cachedAcceptedSourcePlan().evaluatedDocuments.find((document) => (
    document.institution_id === 'va:uni:william-mary'
  ));
}

function blocker(audit, kind) {
  return audit.active_rules.find((row) => row.kind === kind);
}

describe('William & Mary current-catalog figure evidence', () => {
  it('parses fixed, range, and discrete published credit notations without flattening them', () => {
    expect(parsePublishedCredits('(3 Credits)')).toEqual({
      kind: 'published_fixed_credits', notation: '3',
      credit_hours_min: 3, credit_hours_max: 3,
    });
    expect(parsePublishedCredits('(1-3 Credits)')).toEqual({
      kind: 'published_variable_credits', notation: '1-3',
      credit_hours_min: 1, credit_hours_max: 3,
    });
    expect(parsePublishedCredits('(1,2 Credits)')).toEqual({
      kind: 'published_discrete_credits', notation: '1,2',
      credit_hours_min: 1, credit_hours_max: 2, published_values: [1, 2],
    });
    expect(parsePublishedCredits('(one to three Credits)')).toBeNull();
  });

  it('replays the retained source bundle byte-for-byte to the checked artifact', () => {
    const built = buildFromCache();
    expect(`${JSON.stringify(built, null, 2)}\n`).toBe(readText(OUTPUT));
    expect(built).toMatchObject({
      schema_version: 1,
      artifact: 'william_mary_2026_2027_current_catalog_figure_evidence',
      catalog_year: '2026-2027',
      publication_ready: false,
      source_contract: {
        retained_primary_source_integrity: { verified: true, issues: [] },
        math_catalog: {
          official_url: 'https://catalog.wm.edu/undergraduate/courses/math/',
          capture_scope: 'complete_official_math_subject_response',
          robots_http_status: 200,
          robots_crawl_delay_seconds: 0,
          original_acquisition_target_course_codes: [
            'MATH109', 'MATH111', 'MATH112', 'MATH131', 'MATH132', 'MATH214',
          ],
          original_target_list_included_math_413_414: false,
        },
      },
    });
  });

  it('enumerates the exact General roster, exclusions, credit shapes, and selection topology', () => {
    const general = buildFromCache().general_concentration;
    const roster = general.roster_contract;
    expect(roster.entries.map((row) => row.course_code)).toEqual(EXPECTED_ROSTER);
    expect(general.source_rule.excluded_csci_codes).toEqual(EXCLUDED_CSCI_CODES);
    expect(general.source_rule.permitted_math_codes).toEqual(PERMITTED_MATH_CODES);
    expect(roster).toMatchObject({
      structural_upper_level_csci_entries: 47,
      eligible_csci_entries: 44,
      permitted_math_entries: 2,
      eligible_entry_count: 46,
      witness_pool_avoiding_already_required_core_count: 41,
      credit_contributing_witness_pool_count: 37,
      unit_shape_counts: {
        fixed_zero_credit: 4,
        fixed_one_credit: 1,
        variable_one_to_three_credits: 2,
        fixed_three_credits: 39,
      },
    });
    expect(roster.excluded_csci_entries.map((row) => row.course_code))
      .toEqual(['CSCI320', 'CSCI430', 'CSCI498']);
    expect(roster.unit_shape_codes).toMatchObject({
      fixed_zero_credit: ['CSCI423W', 'CSCI440W', 'CSCI495W', 'CSCI496W'],
      fixed_one_credit: ['CSCI437X'],
      variable_one_to_three_credits: ['CSCI420', 'CSCI490'],
    });
    expect(roster.selection_constraints).toEqual([
      expect.objectContaining({
        kind: 'choose_at_most_one', course_codes: ['MATH413', 'MATH414'],
      }),
      expect.objectContaining({
        kind: 'required_together', selected_course_code: 'CSCI437X',
        required_course_codes: ['CSCI437'], timing: 'corequisite',
      }),
    ]);
    expect(roster.entries.filter((row) => (
      row.rule_membership === 'textually_in_level_pool_but_already_required_in_core'
    )).map((row) => row.course_code)).toEqual([
      'CSCI301', 'CSCI303', 'CSCI304', 'CSCI312', 'CSCI423',
    ]);
  });

  it('proves that exact 12-credit paths have non-unique four-, five-, or six-course cardinality', () => {
    const interpretation = buildFromCache().general_concentration.paper_interpretation;
    expect(interpretation.unique).toBe(false);
    expect(interpretation.exact_feasible_credit_contributing_course_counts)
      .toEqual([4, 5, 6]);
    expect(interpretation.witnesses.map(({ course_count, credits }) => (
      { course_count, credits }
    ))).toEqual([
      { course_count: 4, credits: 12 },
      { course_count: 5, credits: 12 },
      { course_count: 6, credits: 12 },
    ]);
    const six = interpretation.witnesses[2].assignments.map((row) => row.course_code);
    expect(six).toContain('CSCI437X');
    expect(six).toContain('CSCI437');
    for (const witness of interpretation.witnesses) {
      expect(witness.assignments.some((row) => (
        ['CSCI301', 'CSCI303', 'CSCI304', 'CSCI312', 'CSCI423']
          .includes(row.course_code)
      ))).toBe(false);
    }
    expect(interpretation.figure_1.ready).toBe(false);
    expect(interpretation.figure_6.ready).toBe(false);
  });

  it('distinguishes three exact zero-increment language routes from four open course/credit routes', () => {
    const language = buildFromCache().foreign_language_proficiency;
    expect(language.source_rule.routes).toHaveLength(7);
    expect(language.paper_interpretation).toMatchObject({
      unique: false,
      zero_increment_route_exists: true,
      zero_increment_is_universal: false,
      exact_zero_increment_options: [1, 2, 6],
      open_course_or_credit_options: [3, 4, 5, 7],
      figure_3: {
        ready: true,
        method: 'optimistic_best_case_source_valid_zero_increment_route',
        selected_options: [1, 2, 6],
      },
      figure_4: {
        ready: true,
        method: 'optimistic_best_case_source_valid_zero_increment_route',
        selected_options: [1, 2, 6],
      },
      figure_6: { ready: false },
    });
    const routes = new Map(language.source_rule.routes.map((row) => [row.option, row]));
    for (const option of [1, 2, 6]) {
      expect(routes.get(option)).toMatchObject({
        college_course_increment: 0,
        college_credit_increment: 0,
      });
    }
    expect(routes.get(3)).toMatchObject({
      college_course_increment: { min: 1, max: null },
      evidence_class: 'qualifying_transfer_course_identity_and_credits_open',
    });
    expect(language.source_rule.placement_evidence).toEqual({
      placement_selects_enrollment_not_completion: true,
      zero_increment_inference_from_placement_forbidden: true,
    });
    expect(language.source_rule.exception_evidence).toEqual({
      committee_may_substitute_other_courses: true,
      substituted_course_identity_and_credits_open: true,
    });
  });

  it('retains the pure transfer-grade threshold and every CS residency dimension', () => {
    const policy = buildFromCache().transfer_and_residency_policy;
    expect(policy).toMatchObject({
      verified: true,
      issues: [],
      source_receipts: {
        program_response_sha256: '8f943153b3a8489b2074fc16fbaaec55c8622d6aa7403e9913b668832675bad6',
        program_relevant_html_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        degree_policy_response_sha256: '0fa9acb97573a446ebf90ed18e6a22fbba2c010d776f620e42847452030dfa37',
        degree_policy_relevant_html_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      transfer_grade_threshold: {
        minimum_letter_grade: 'C',
        minimum_grade_points: 2,
        c_minus_acceptable: false,
        pass_fail_requires_instructor_certification_at_or_above_threshold: true,
        paper_method: {
          figures: ['3', '4'],
          conditioned_input: 'hypothetical_grade_eligible_successful_pathway',
          pure_grade_threshold_changes_course_identity: false,
          pure_grade_threshold_changes_applied_units: false,
          separately_blocks_paper_figures: false,
        },
      },
      computer_science_residency: {
        overall_resident_credits_minimum: 60,
        major_resident_credits_minimum: 15,
        resident_fraction_of_minimum_major_course_count: 0.5,
        external_300_400_major_courses_maximum: 2,
      },
    });
    expect(policy.transfer_grade_threshold.exact_rule_text).toContain(
      'A grade of “C” (2.0) or higher is required (“C-” is not acceptable).',
    );
    expect(policy.computer_science_residency.exact_program_rule_text).toContain(
      'at most two courses can count towards the CS major',
    );
  });

  it('fails closed when any source rule, retained provenance row, or robots receipt drifts', () => {
    const mutations = [
      {
        issue: 'program:twelve_credit_rule',
        mutate: (input) => {
          input.programHtml = input.programHtml.replace(
            '12 credits chosen from any 300-400 level computer science courses.',
            '11 credits chosen from any 300-400 level computer science courses.',
          );
        },
      },
      {
        issue: 'roster:csci437x_corequisite',
        mutate: (input) => {
          input.csciHtml = input.csciHtml.replace(
            'This course is to be taken in together with CSCI-437',
            'This course is to be taken in together with CSCI-438',
          );
        },
      },
      {
        issue: 'math:robots_evidence',
        mutate: (input) => { input.mathMetadata.robots.crawl_delay_seconds = 1; },
      },
      {
        issue: 'math:math_original_capture_target_scope',
        mutate: (input) => { input.mathMetadata.target_course_codes.push('MATH413'); },
      },
      {
        issue: 'language:exact_completion_route_lists',
        mutate: (input) => {
          input.geHtml = input.geHtml.replace(
            'both the Oral and Writing Proficiency ACTFL standardized tests',
            'the Oral Proficiency ACTFL standardized test',
          );
        },
      },
      {
        issue: 'retained_sources:program_manifest_row',
        mutate: (input) => {
          const row = input.integrityManifest.exact_local_byte_matches.find((entry) => (
            entry.institution === 'william-mary' && entry.source_id === 'major'
          ));
          row.declared_sha256 = '0'.repeat(64);
        },
      },
      {
        issue: 'transfer_and_residency:unique_transfer_grade_rule',
        mutate: (input) => {
          input.geHtml = input.geHtml.replace(
            'A grade of “C” (2.0) or higher is required',
            'A grade of “C-” (1.7) or higher is required',
          );
        },
      },
      {
        issue: 'transfer_and_residency:unique_program_residency_rule',
        mutate: (input) => {
          input.programHtml = input.programHtml.replace(
            'a total of at most two courses can count towards the CS major',
            'a total of at most three courses can count towards the CS major',
          );
        },
      },
    ];
    for (const { issue, mutate } of mutations) {
      const input = inputBundle();
      mutate(input);
      expect(() => buildWilliamMaryCurrentCatalogFigureEvidence(input), issue)
        .toThrow(issue);
    }
  });

  it('changes neither retained composition nor canonical projection and leaves exact gates closed', () => {
    const sourceFile = path.join(CATALOGS, 'composed', 'william-mary.json');
    const sourceBytesBefore = readText(sourceFile);
    const sourceBefore = JSON.parse(sourceBytesBefore);
    const projectionBefore = williamMaryProjection();
    const stableProjection = (projection) => {
      const stable = structuredClone(projection);
      delete stable.updated_at;
      return JSON.stringify(stable);
    };
    const projectionBytesBefore = stableProjection(projectionBefore);

    const evidence = buildFromCache();

    expect(readText(sourceFile)).toBe(sourceBytesBefore);
    expect(stableProjection(williamMaryProjection())).toBe(projectionBytesBefore);
    expect(evidence.canonical_effect).toMatchObject({
      verified_requirement_or_composition_mutation_required: false,
      projection_mutation_required: false,
      runtime_gate_change_supported: true,
    });
    for (const document of [sourceBefore, projectionBefore]) {
      const audit = auditFourYearDocument(document);
      expect(audit.summary.ready_by_figure).toEqual({
        1: false, 3: true, 4: true, 6: false,
      });
      expect(blocker(audit, 'open_course_category_with_exclusions')).toMatchObject({
        supported: false, affected_figures: ['1', '6'],
      });
      expect(blocker(audit, 'foreign_language_proficiency_variable_credit')).toMatchObject({
        supported: false, affected_figures: ['6'],
      });
    }
  });
});
