import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_SEMANTIC_SHA256,
  EXPECTED_MATH_ROSTER,
  buildVirginiaMilitaryInstituteOpenRuleEvidence,
  extractAppliedMathematicsRoster,
  parseBoundedPdf,
  parseResidenceRule,
  verifyComposition,
  virginiaMilitaryInstituteOpenRuleEvidenceIssue,
} from './virginiaMilitaryInstituteOpenRuleEvidence';
import {
  FILES,
  RAW_DIR,
  REVIEW_DIR,
  PDF_URL,
  registrarPdfLinks,
  robotsAllows,
} from '../../scripts/va/captureVirginiaMilitaryInstituteOpenRuleSources';
import {
  OUTPUT,
  buildFromCache,
} from '../../scripts/va/buildVirginiaMilitaryInstituteOpenRuleEvidence';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { auditFourYearDocument } from './fourYearConstraints';

const SERVER = path.resolve(__dirname, '../..');
const CATALOGS = path.join(SERVER, '.va-catalogs');
const readText = (file) => fs.readFileSync(file, 'utf8');
const readJson = (file) => JSON.parse(readText(file));

function inputBundle() {
  const page = (suffix) => path.join(
    CATALOGS, 'pages', `virginia-military-institute__${suffix}`,
  );
  const research = path.join(CATALOGS, 'research', 'vmi-open-rule-sources');
  return {
    programHtml: readText(page('program.html')),
    programText: readText(page('program.txt')),
    courseCatalogHtml: readText(page('course_catalog.html')),
    courseCatalogText: readText(page('course_catalog.txt')),
    geHtml: readText(page('ge.html')),
    geText: readText(page('ge.txt')),
    graduationHtml: readText(page('graduation.html')),
    graduationText: readText(page('graduation.txt')),
    integrityManifest: readJson(path.join(
      CATALOGS, 'research', 'primary-source-integrity-manifest.json',
    )),
    captureMetadata: readJson(path.join(research, 'capture.json')),
    boundedPageText: readText(path.join(
      research, 'vmi-2025-2026-academic-catalog__bounded-pages.txt',
    )),
    composition: readJson(path.join(
      CATALOGS, 'composed', 'virginia-military-institute.json',
    )),
  };
}

function vmiSourceProjection() {
  return cachedAcceptedSourcePlan().evaluatedDocuments.find((document) => (
    document.institution_id === 'va:uni:virginia-military-institute'
  ));
}

describe('VMI supplemental open-rule source evidence', () => {
  it('keeps raw response bytes in the ignored page cache and durable evidence bounded', () => {
    expect(RAW_DIR).toContain(path.join('.va-catalogs', 'pages'));
    expect(REVIEW_DIR).toContain(path.join('.va-catalogs', 'research'));
    expect(FILES.pdf).toContain(RAW_DIR);
    expect(FILES.robots).toContain(RAW_DIR);
    expect(FILES.registrar).toContain(RAW_DIR);
    expect(FILES.excerpt).toContain(REVIEW_DIR);
    expect(FILES.metadata).toContain(REVIEW_DIR);
    expect(robotsAllows('User-agent: *\nDisallow:', new URL(PDF_URL).pathname)).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow: /wp-content/', new URL(PDF_URL).pathname))
      .toBe(false);
    expect(registrarPdfLinks(`<a href="${PDF_URL}">VMI Catalog 2025-2026</a>`))
      .toEqual([{ text: 'VMI Catalog 2025-2026', href: PDF_URL }]);
  });

  it('replays the retained sources exactly to the checked artifact', () => {
    const evidence = buildFromCache();
    expect(`${JSON.stringify(evidence, null, 2)}\n`).toBe(readText(OUTPUT));
    expect(virginiaMilitaryInstituteOpenRuleEvidenceIssue(evidence)).toBeNull();
    expect(ARTIFACT_SEMANTIC_SHA256).toBe(
      '5416c20adecc19de50380cb7ea9d4c636025cef6c7a85b233786eb9789cc4cd5',
    );
    expect(evidence).toMatchObject({
      schema_version: 1,
      artifact: 'vmi_2025_2026_open_rule_source_evidence',
      catalog_year: '2025-2026',
      publication_ready: false,
      source_contract: {
        retained_primary_sources: { verified: true, issues: [] },
        official_catalog_pdf: {
          verified: true, issues: [],
          pdf_sha256: '244f93ee26e73f8639512bfa7b5e383af3d196ab5c02f4559d20628066390c32',
          pdf_bytes: 10270130,
          bounded_page_text_sha256: 'a1e0d504f1beed7544e5cd10c75c7382fe60c26e02b524867a722d8fc8b611c9',
        },
      },
    });
  });

  it('enumerates the exact Applied Mathematics section and eligible identities', () => {
    const roster = extractAppliedMathematicsRoster(inputBundle().courseCatalogHtml);
    expect(roster).toMatchObject({
      verified: true, issues: [], published_entry_count: 39,
      at_or_above_200_count: 30, exact_single_identity_count: 28,
      selectable_single_identity_excluding_required_MA220_count: 27,
      structural_section: {
        heading: 'APPLIED MATHEMATICS', next_heading: 'ARABIC',
        heading_row_index: 20, next_heading_row_index: 60,
      },
    });
    expect(roster.entries.map((row) => row.course_code)).toEqual(EXPECTED_MATH_ROSTER);
    expect(roster.selectable_single_identity_codes).toContain('MA331X');
    expect(roster.selectable_single_identity_codes).not.toContain('MA220');
    expect(roster.selectable_single_identity_codes).not.toContain('MA451-459');
  });

  it('proves an exact cross-allocation math/C&C witness without inventing units', () => {
    const evidence = buildFromCache();
    expect(evidence.approved_math_elective_level_floor).toMatchObject({
      source_verified: true,
      paper_witness_exact: true,
      deterministic_witness: {
        course_code: 'MA331X', allocation: 'open mathematics elective', credits: 3,
        civilizations_and_cultures_designation: true,
        prerequisite_formula: { kind: 'course', code: 'MA124' },
        prerequisite_course_already_required: true,
      },
    });
    expect(evidence.core_overlay_inside_free_electives).toMatchObject({
      source_verified: true,
      paper_witness_exact: true,
      localization_finding: {
        authored_kind_literal_both_courses_inside_free_electives_supported: false,
        description_inside_published_allocation_supported: true,
      },
      deterministic_cross_allocation_witness: {
        study_abroad_used: false, total_designated_courses: 2,
        incremental_credits_above_published_degree_total: 0,
        free_elective_credits_consumed: 3, free_elective_credits_remaining: 21,
      },
    });
    const assignments = evidence.core_overlay_inside_free_electives
      .deterministic_cross_allocation_witness.assignments;
    expect(assignments.map(({ course_code, allocation }) => ({ course_code, allocation })))
      .toEqual([
        { course_code: 'MA331X', allocation: 'open mathematics elective' },
        { course_code: 'MA330WX', allocation: 'free electives' },
      ]);
    expect(assignments[1]).toMatchObject({
      selected_prerequisite_branch: { kind: 'course', code: 'MA123' },
      full_prerequisite_formula: {
        kind: 'any_of', operands: [
          { kind: 'course', code: 'MA123' },
          { kind: 'permission', authority: 'instructor' },
        ],
      },
      selected_prerequisite_course_already_required: true,
    });
  });

  it('keeps the structurally plausible BI 101/102 sequence fail-closed for approval', () => {
    const evidence = buildFromCache();
    expect(evidence.approved_science_sequence).toMatchObject({
      source_rule_verified: true,
      exact_approved_roster_verified: false,
      paper_witness_exact: false,
      bounded_candidate: {
        course_codes: ['BI101', 'BI102'], total_credits: 8,
        same_eligible_subject: true, each_has_laboratory: true,
        continuation_relationship_explicit: true,
      },
      figures_blocked: ['1', '3', '4', '6'],
    });
    expect(evidence.approved_science_sequence.unresolved_fact)
      .toContain('structural fit is not approval');
    expect(evidence.paper_capability_delta.residency_is_only_remaining_blocker).toBe(false);
  });

  it('preserves both residence branches and every unmodeled timing dimension', () => {
    const parsed = parseResidenceRule(inputBundle().graduationHtml);
    expect(parsed).toMatchObject({
      verified: true, issues: [],
      conditional_branches: [
        { advanced_standing_credit: false, minimum_semesters: 6, resident_fraction: 0.75 },
        { advanced_standing_credit: true, minimum_semesters: 6, resident_fraction: 0.5 },
      ],
      additional_dimensions: {
        summer_intersession_and_internet_transfer_maximum_credits: 18,
        concurrent_full_time_fall_spring_internet_transfer_allowed: false,
        post_final_full_time_semester_transfer_maximum_credits: 10,
        post_final_courses_must_be_preapproved: true,
        final_grade_deadline_relative_to_commencement_days: 7,
      },
    });
    expect(buildFromCache().conditional_residency_by_advanced_standing).toMatchObject({
      source_rule_verified: true, executable_for_paper_figures: false,
      figures_blocked: ['3', '4'],
    });
  });

  it('reports the exact integrated blocker delta while residual rules stay closed', () => {
    const evidence = buildFromCache();
    expect(evidence.paper_capability_delta).toEqual({
      central_runtime_integrated: true,
      exact_source_capabilities_available_for_integration: [
        'approved_math_elective_level_floor',
        'core_overlay_inside_published_allocation_via_cross_group_witness',
      ],
      current_blocking_audit_receipt_count_by_figure: {
        '1': 3, '3': 5, '4': 5, '6': 3,
      },
      integrated_blocker_reduction_by_figure: {
        '1': {
          resolved: 2, residual_audit_receipt_count: 1,
          residual: ['requirement_groups[0].analysis_constraints[0]:approved_science_sequence'],
        },
        '3': {
          resolved: 2, residual_audit_receipt_count: 3,
          residual: [
            'requirement_groups[0].analysis_constraints[0]:approved_science_sequence',
            'requirement_groups[8].analysis_constraints[0]:conditional_residency_by_advanced_standing',
            'unit_audit.residency:residency',
          ],
        },
        '4': {
          resolved: 2, residual_audit_receipt_count: 3,
          residual: [
            'requirement_groups[0].analysis_constraints[0]:approved_science_sequence',
            'requirement_groups[8].analysis_constraints[0]:conditional_residency_by_advanced_standing',
            'unit_audit.residency:residency',
          ],
        },
        '6': {
          resolved: 2, residual_audit_receipt_count: 1,
          residual: ['requirement_groups[0].analysis_constraints[0]:approved_science_sequence'],
        },
      },
      residual_semantic_blockers_by_figure: {
        '1': ['approved_science_sequence'],
        '3': ['approved_science_sequence', 'conditional_residency_and_transfer_policy'],
        '4': ['approved_science_sequence', 'conditional_residency_and_transfer_policy'],
        '6': ['approved_science_sequence'],
      },
      residency_is_only_remaining_blocker: false,
    });
    const audit = auditFourYearDocument(vmiSourceProjection());
    for (const kind of [
      'approved_science_sequence', 'conditional_residency_by_advanced_standing',
    ]) {
      expect(audit.active_rules.find((row) => row.kind === kind), kind)
        .toMatchObject({ supported: false });
    }
    for (const kind of [
      'approved_math_elective_level_floor', 'core_overlay_inside_free_electives',
    ]) {
      expect(audit.active_rules.find((row) => row.kind === kind), kind)
        .toMatchObject({ supported: true, evaluator: 'evaluateVmiConstraint' });
    }
  });

  it('fails closed on source, page geometry, formula, designation, branch, and carrier drift', () => {
    const cases = [
      {
        label: 'program math floor', expected: 'program:** MA Elective',
        mutate: (input) => {
          input.programText = input.programText.replace(
            '** MA Elective must be 200 level or higher',
            '** MA Elective must be 300 level or higher',
          );
        },
      },
      {
        label: 'GE overlay cardinality', expected: 'ge:Civilizations And Cultures',
        mutate: (input) => {
          input.geText = input.geText.replace(
            '2 courses, one of which may be replaced',
            '3 courses, one of which may be replaced',
          );
        },
      },
      {
        label: 'catalog course boundary', expected: 'math_roster:',
        mutate: (input) => {
          input.courseCatalogHtml = input.courseCatalogHtml.replace(
            'preview_course_nopop.php?catoid=39&amp;coid=42296',
            'preview_course_nopop.php?catoid=40&amp;coid=42296',
          );
        },
      },
      {
        label: 'MA331 prerequisite', expected: 'pdf:ma331_formula_or_designation',
        mutate: (input) => {
          input.boundedPageText = input.boundedPageText.replace(
            'MA 124 Note: Civilizations', 'MA 125 Note: Civilizations',
          );
        },
      },
      {
        label: 'MA330 designation', expected: 'pdf:ma330_formula_or_designation',
        mutate: (input) => {
          input.boundedPageText = input.boundedPageText.replace(
            'Civilizations & Cultures\nCourse (X).',
            'Civilizations & Cultures\nCourse.',
          );
        },
      },
      {
        label: 'science continuation', expected: 'pdf:bi102_continuation',
        mutate: (input) => {
          input.boundedPageText = input.boundedPageText.replace(
            'This course is a continuation of BI 101.',
            'This course follows BI 101.',
          );
        },
      },
      {
        label: 'residence branch', expected: 'residency:',
        mutate: (input) => {
          input.graduationHtml = input.graduationHtml.replace(
            'six semesters and 50%', 'seven semesters and 50%',
          );
        },
      },
      {
        label: 'constraint carrier kind', expected: 'composition:exact_open_rule_carriers',
        mutate: (input) => {
          input.composition.requirement_groups[7].analysis_constraints[0].kind =
            'core_overlay_anywhere';
        },
      },
      {
        label: 'PDF capture hash', expected: 'pdf:capture_metadata',
        mutate: (input) => { input.captureMetadata.pdf_sha256 = '0'.repeat(64); },
      },
    ];
    for (const { label, expected, mutate } of cases) {
      const input = inputBundle();
      mutate(input);
      expect(() => buildVirginiaMilitaryInstituteOpenRuleEvidence(input), label)
        .toThrow(expected);
    }
  });

  it('rejects artifact tampering, especially a fabricated science approval', () => {
    const evidence = buildFromCache();
    const promoted = structuredClone(evidence);
    promoted.approved_science_sequence.exact_approved_roster_verified = true;
    promoted.approved_science_sequence.paper_witness_exact = true;
    expect(virginiaMilitaryInstituteOpenRuleEvidenceIssue(promoted))
      .toBe('VMI open-rule source facts, fail-closed decisions, or mutation boundary changed');

    const relocalized = structuredClone(evidence);
    relocalized.core_overlay_inside_free_electives.localization_finding
      .authored_kind_literal_both_courses_inside_free_electives_supported = true;
    expect(virginiaMilitaryInstituteOpenRuleEvidenceIssue(relocalized)).not.toBeNull();
  });

  it('changes neither the reviewed composition nor the accepted source projection', () => {
    const compositionFile = path.join(
      CATALOGS, 'composed', 'virginia-military-institute.json',
    );
    const compositionBytes = readText(compositionFile);
    const stableProjection = (document) => {
      const copy = structuredClone(document);
      delete copy.updated_at;
      return JSON.stringify(copy);
    };
    const sourceBefore = stableProjection(vmiSourceProjection());
    const compositionBefore = readJson(compositionFile);
    expect(verifyComposition(compositionBefore)).toMatchObject({ verified: true, issues: [] });

    const evidence = buildFromCache();

    expect(readText(compositionFile)).toBe(compositionBytes);
    expect(stableProjection(vmiSourceProjection())).toBe(sourceBefore);
    expect(evidence.canonical_effect).toEqual({
      verified_requirement_or_composition_mutations: 0,
      accepted_source_mutations: 0,
      projection_mutations: 0,
      central_evaluator_changes: 2,
      database_writes: 0,
      constraint_carrier_sha256: '52a999880a1c72a4cda9be0805eb28424b79a8f6775f630d04db028bea381a47',
    });
  });

  it('parses the exact four bounded catalog course blocks only', () => {
    const parsed = parseBoundedPdf(inputBundle().boundedPageText);
    expect(parsed).toMatchObject({ verified: true, issues: [] });
    expect(Object.keys(parsed.exact_course_entries)).toEqual([
      'MA330WX', 'MA331X', 'BI101', 'BI102',
    ]);
    expect(parsed.exact_course_entries.BI101).toMatchObject({
      credits: 4, lecture_hours: 3, lab_hours: 3,
    });
    expect(parsed.exact_course_entries.BI102).toMatchObject({
      credits: 4, lecture_hours: 3, lab_hours: 3, continuation_of: 'BI101',
    });
  });
});
