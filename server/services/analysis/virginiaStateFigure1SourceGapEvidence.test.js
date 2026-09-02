import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_CSCI_MENU,
  EXPECTED_MATH_MENU,
  EXPECTED_SCIENCE_MENU,
  GE_REUSE_RULE,
  RETAINED_PATHS,
  SOURCE_RECEIPTS,
  auditVirginiaStateFigure1SourceGapEvidence,
  buildVirginiaStateFigure1SourceGapEvidence,
  extractProgramFacts,
  virginiaStateFigure1SourceGapGate,
} from './virginiaStateFigure1SourceGapEvidence';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SERVER_ROOT = path.resolve(__dirname, '../..');
const ARTIFACT_PATH = path.join(
  SERVER_ROOT,
  '.va-catalogs/research/virginia-state-figure1-source-gap.json',
);
const readRepo = (repoPath) => fs.readFileSync(path.join(REPO_ROOT, repoPath), 'utf8');
const artifact = () => JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
const sources = () => ({
  programHtml: readRepo(RETAINED_PATHS.program_html),
  programText: readRepo(RETAINED_PATHS.program_text),
  generalEducationText: readRepo(RETAINED_PATHS.general_education_text),
  policyStatementsHtml: readRepo(RETAINED_PATHS.policy_statements_html),
  policyStatementsText: readRepo(RETAINED_PATHS.policy_statements_text),
});

describe('Virginia State Figure 1 source-gap evidence', () => {
  it('replays byte-for-byte from the retained current official source subset', () => {
    const built = buildVirginiaStateFigure1SourceGapEvidence(sources());
    expect(built.verification).toEqual({ verified: true, issues: [] });
    expect(built).toEqual(artifact());
    expect(auditVirginiaStateFigure1SourceGapEvidence(artifact(), sources()))
      .toMatchObject({ verified: true, errors: [] });
    expect(built.evidence_fingerprint_sha256)
      .toBe('c25f24aa4f7821e6a6b2bd20305d29e30fd2ade85a6522d1b5351dc9eedb6887');
  });

  it('proves the exact closed roster but not a closed selection topology', () => {
    const facts = extractProgramFacts(sources().programHtml, sources().programText);
    expect(facts).toMatchObject({
      verified: true,
      unrestricted_credits: 6,
      restricted_credits: 13,
      combined_elective_credits: 19,
      menu_alternative_counts: {
        csci: 21,
        math_statistics: 18,
        laboratory_science: 8,
        total: 47,
      },
      underlying_course_code_count: 49,
      per_menu_published_hours: {
        csci: null,
        math_statistics: null,
        laboratory_science: null,
      },
      fixed_required_roster_intersection: [],
    });
    expect(EXPECTED_CSCI_MENU).toHaveLength(21);
    expect(EXPECTED_MATH_MENU).toHaveLength(18);
    expect(EXPECTED_SCIENCE_MENU).toHaveLength(8);
    expect(facts.roster_sha256)
      .toBe('bdc4fcc9e6062363675068c93a77b4b8daa48840de5e6201f8eabc00a8fb754b');
  });

  it('does not promote the conflicting plan of study into a hidden distribution', () => {
    const value = artifact().conflicting_non_authoritative_topology;
    expect(value.current_catalog_plan_of_study).toEqual({
      csci_math_stat_elective_hours: [3],
      csci_330_plus_elective_hours: [6],
      math_restricted_elective_hours: [3],
      laboratory_science_hours: [4, 4],
      csci_470_hours: [3],
      csci_471_row_count: 0,
    });
    expect(value.current_catalog_summary_core_uses_csci_471).toBe(true);
    expect(value.official_department_page).toMatchObject({
      catalog_year_label: null,
      csci_470_present: true,
      csci_471_present: false,
    });
    expect(value.official_department_page.row_total_conflicts).toHaveLength(3);
    expect(value.arithmetic_ambiguity).toMatchObject({
      if_csci_math_stat_is_restricted_and_one_lab_is_ge: 16,
      if_csci_math_stat_is_not_restricted_and_one_lab_is_ge: 13,
      published_restricted_total: 13,
    });
    expect(value.authority_decision).toMatch(/^Do not promote/);
  });

  it('keeps the exact GE rule narrower than a made-up bachelor no-double-count rule', () => {
    const value = artifact();
    expect(value.exact_published_facts.general_education_reuse).toEqual({
      ge_and_major_same_course: 'explicitly_allowed',
      same_course_in_two_ge_areas: 'explicitly_forbidden',
      exact_rule: GE_REUSE_RULE,
    });
    expect(value.exact_published_facts.fixed_required_roster_intersection).toEqual([]);
    expect(value.unresolved_topology.universal_undergraduate_major_slot_no_double_count_rule)
      .toBe(false);
    const graduateControl = value.attempted_official_routes.find(
      (row) => row.id === 'graduate_duplicate_credit_negative_control',
    );
    expect(graduateControl.scope).toMatch(/^graduate-only/);
    expect(graduateControl.result).toMatch(/cannot be promoted to this bachelor degree/);
  });

  it('pins every attempted route to an official owner and records nonretained bytes as receipts only', () => {
    expect(artifact().attempted_official_routes).toEqual(SOURCE_RECEIPTS);
    expect(SOURCE_RECEIPTS).toHaveLength(9);
    for (const route of SOURCE_RECEIPTS) {
      expect(['catalog.vsu.edu', 'www.vsu.edu']).toContain(new URL(route.url).hostname);
      expect(route.http_status).toBe(200);
      expect(route.response_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(route.response_bytes).toBeGreaterThan(1000);
      if (route.retention === 'current_hash_receipt_only') {
        expect(route.retained_html_path).toBeNull();
        expect(route.retained_text_path).toBeNull();
      }
    }
  });

  it('remains fail-closed even when every retained receipt matches', () => {
    const gate = virginiaStateFigure1SourceGapGate(artifact(), sources());
    expect(gate).toMatchObject({
      supported: false,
      status: 'blocked_source_gap',
      affected_figures: ['1', '6'],
      issues: [],
    });
    expect(artifact().disposition).toMatchObject({
      publishable_for_figure_1: false,
      publishable_for_figure_6: false,
      safe_for_figures_3_4_aggregate_only: true,
      mutation_authorized: false,
    });
  });

  it('rejects source drift, invented distributions, and a false publication promotion', () => {
    const sourceDrift = sources();
    sourceDrift.programHtml += '\n';
    expect(auditVirginiaStateFigure1SourceGapEvidence(artifact(), sourceDrift))
      .toMatchObject({ verified: false });

    const invented = structuredClone(artifact());
    invented.unresolved_topology.exact_submenu_credit_distribution = true;
    invented.exact_published_facts.per_menu_published_hours = {
      csci: 6, math_statistics: 3, laboratory_science: 4,
    };
    expect(auditVirginiaStateFigure1SourceGapEvidence(invented, sources()).errors)
      .toContain('artifact_does_not_match_current_retained_source_receipt');

    const promoted = structuredClone(artifact());
    promoted.disposition.status = 'resolved';
    promoted.disposition.publishable_for_figure_1 = true;
    promoted.disposition.mutation_authorized = true;
    expect(auditVirginiaStateFigure1SourceGapEvidence(promoted, sources()).errors)
      .toContain('artifact_not_fail_closed');
  });

  it('asks VSU for every fact needed to close the blocker without changing core content', () => {
    const request = artifact().institutional_request;
    for (const required of [
      '13 restricted-elective credits',
      'CSCI menu',
      'MATH/STAT menu',
      'BIOL/CHEM/PHYS laboratory-science menu',
      'minimum or maximum credits/courses',
      'equal 13 or may exceed it',
      'repeated CSCI 298 registrations',
      'General Education science area',
      'count only once toward the 120-credit degree',
    ]) expect(request.exact_question).toContain(required);
    expect(request.acceptable_closure).toMatch(/explicitly effective for the 2026-2027/);
  });
});
