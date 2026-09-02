import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PHASE_TIMEOUT_MS,
  RADFORD_SCIENCE_PHASE_TIMEOUT_MS,
  RELEASE_PHASES,
  optionsFrom,
  runReleaseCheck,
  selectedPhases,
} from './checkRelease';

describe('Virginia one-command release check', () => {
  it('contains no mutating command-line option', () => {
    expect(RELEASE_PHASES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(RELEASE_PHASES.map((entry) => entry.id)).size).toBe(RELEASE_PHASES.length);
    for (const entry of RELEASE_PHASES) {
      expect(Array.isArray(entry.args)).toBe(true);
      expect(entry.args).not.toContain('--apply');
      expect(entry.args).not.toContain('--write');
      expect(entry.args).not.toContain('--restore');
      expect(entry.timeoutMs).toBeGreaterThan(0);
    }
  });

  it('passes a bounded timeout to every child command', () => {
    const phases = RELEASE_PHASES.slice(0, 1);
    const spawn = vi.fn(() => ({ status: 0, signal: null }));
    runReleaseCheck({ phases, spawn, stdout: { write: vi.fn() } });
    expect(spawn).toHaveBeenCalledWith(
      phases[0].command,
      phases[0].args,
      expect.objectContaining({
        timeout: DEFAULT_PHASE_TIMEOUT_MS,
        killSignal: 'SIGTERM',
      }),
    );
  });

  it('invokes the catalog plan with an argument array and dotenv environment', () => {
    const catalog = RELEASE_PHASES.find((entry) => entry.id === 'catalog_plan');
    expect(catalog).toMatchObject({
      command: process.execPath,
      args: [
        '-r', 'dotenv/config', 'scripts/importVirginiaCatalogDegrees.js',
        '--accepted-compositions-only', '--source-plan', '--dry-run',
      ],
      env: { DOTENV_CONFIG_PATH: '.env' },
    });
  });

  it('makes the human-verification review a failing release gate', () => {
    const review = RELEASE_PHASES.find((entry) => entry.id === 'verification_review');
    expect(review.args).toContain('--require-clean');
  });

  it('replays the official VCU transfer-policy receipt before publication', () => {
    const evidence = RELEASE_PHASES.find((entry) => (
      entry.id === 'vcu_transfer_policy_evidence'
    ));
    expect(evidence).toMatchObject({
      args: ['scripts/va/captureVcuTransferPolicyEvidence.js'],
    });
  });

  it('replays the official Radford completed-transfer-degree receipt', () => {
    const evidence = RELEASE_PHASES.find((entry) => (
      entry.id === 'radford_transfer_degree_evidence'
    ));
    expect(evidence).toMatchObject({
      args: ['scripts/va/captureRadfordTransferDegreeEvidence.js'],
    });
    const science = RELEASE_PHASES.find((entry) => (
      entry.id === 'radford_science_pair_evidence'
    ));
    expect(science).toMatchObject({
      label: expect.stringMatching(/strict normalized full-page replay/),
      args: ['scripts/va/captureRadfordSciencePairEvidence.js'],
      timeoutMs: RADFORD_SCIENCE_PHASE_TIMEOUT_MS,
    });
    expect(RADFORD_SCIENCE_PHASE_TIMEOUT_MS).toBeGreaterThan(3 * 120 * 1000);
    const collegeScience = RELEASE_PHASES.find((entry) => (
      entry.id === 'radford_college_science_pair_evidence'
    ));
    expect(collegeScience).toMatchObject({
      args: ['scripts/va/captureRadfordCollegeSciencePairEvidence.js'],
    });
    expect(RELEASE_PHASES.find((entry) => (
      entry.id === 'radford_remaining_science_pair_capture'
    ))).toMatchObject({
      args: ['scripts/va/captureRadfordRemainingSciencePairEvidence.js'],
    });
    expect(RELEASE_PHASES.find((entry) => (
      entry.id === 'radford_remaining_science_pair_evidence'
    ))).toMatchObject({
      args: ['scripts/va/buildRadfordRemainingSciencePairEvidence.js'],
    });
    const index = Object.fromEntries(RELEASE_PHASES.map((entry, position) => [
      entry.id, position,
    ]));
    expect(index.radford_science_pair_evidence)
      .toBeLessThan(index.publication_audit);
    expect(index.radford_remaining_science_pair_capture)
      .toBeLessThan(index.radford_remaining_science_pair_evidence);
    expect(index.radford_remaining_science_pair_evidence)
      .toBeLessThan(index.publication_audit);
  });

  it('replays every supplemental exact university-policy receipt', () => {
    expect(Object.fromEntries(RELEASE_PHASES.map((entry) => [entry.id, entry.args])))
      .toMatchObject({
        cnu_cpen371w_prerequisite_evidence: [
          'scripts/va/captureCnuCpen371wPrerequisiteEvidence.js',
        ],
        vsu_arabic_prerequisite_evidence: [
          'scripts/va/captureVirginiaStateArabicPrerequisiteEvidence.js',
        ],
        vsu_prerequisite_closure_evidence: [
          'scripts/va/buildVirginiaStatePrerequisiteClosureEvidence.js',
        ],
        norfolk_state_prerequisite_closure_evidence: [
          'scripts/va/buildNorfolkStatePrerequisiteClosureEvidence.js',
        ],
        vcu_prerequisite_closure_evidence: [
          'scripts/va/checkVcuPrerequisiteClosure.js',
        ],
        small_university_prerequisite_closure_evidence: [
          'scripts/va/buildSmallUniversityPrerequisiteClosureEvidence.js',
        ],
        university_prerequisite_tail_closure_evidence: [
          'scripts/va/checkUniversityPrerequisiteTailClosure.js',
        ],
        radford_randolph_macon_prerequisite_tail_evidence: [
          'scripts/va/buildRadfordRandolphMaconPrerequisiteTailEvidence.js',
        ],
        figure6_noncourse_prerequisite_disposition: [
          'scripts/va/checkFigure6NonCoursePrerequisiteDisposition.js',
        ],
        shenandoah_prerequisite_discovery: [
          'scripts/va/captureShenandoahAcalogDiscovery.js',
        ],
        virginia_tech_graduate_cs_prerequisite_evidence: [
          'scripts/va/captureVirginiaTechGraduateCsPrerequisiteEvidence.js',
        ],
        virginia_tech_recursive_prerequisite_closure_evidence: [
          'scripts/va/checkVirginiaTechRecursivePrerequisiteClosure.js',
        ],
        remaining_university_prerequisite_closure_evidence: [
          'scripts/va/buildRemainingUniversityPrerequisiteClosureEvidence.js',
        ],
        vcu_egmn_outside_scope_prerequisite_evidence: [
          'scripts/va/buildVcuEgmnOutsideScopePrerequisiteEvidence.js',
        ],
        radford_uva_wise_recursive_prerequisite_evidence: [
          'scripts/va/buildRadfordUvaWiseRecursivePrerequisiteEvidence.js',
        ],
        virginia_state_figure1_source_gap: [
          'scripts/va/buildVirginiaStateFigure1SourceGapEvidence.js',
        ],
        longwood_civitae_evidence: ['scripts/va/captureLongwoodCivitaeFigureEvidence.js'],
        tidewater_figure34_open_rule_evidence: [
          'scripts/va/checkTidewaterFigure34OpenRules.js',
        ],
        randolph_macon_collegiate_attribute_capture: [
          'scripts/va/captureRandolphMaconCollegiateAttributeSources.js',
        ],
        randolph_macon_collegiate_attribute_evidence: [
          'scripts/va/buildRandolphMaconCollegiateAttributeEvidence.js',
        ],
        virginia_tech_pathways_evidence: [
          'scripts/va/captureVirginiaTechPathwaysCapacity.js',
        ],
        virginia_tech_equivalency_quantity_evidence: [
          'scripts/va/captureVirginiaTechEquivalencyQuantityEvidence.js',
        ],
        virginia_tech_transfer_policy_evidence: [
          'scripts/va/captureVirginiaTechTransferPolicyEvidence.js',
        ],
        virginia_tech_csc222_java_evidence: [
          'scripts/va/captureVirginiaTechCsc222JavaEvidence.js',
        ],
        virginia_tech_csc222_java_blocked_cohort_evidence: [
          'scripts/va/captureVirginiaTechCsc222JavaBlockedCohortEvidence.js',
        ],
        vmi_open_rule_capture: [
          'scripts/va/captureVirginiaMilitaryInstituteOpenRuleSources.js',
        ],
        vmi_open_rule_evidence: [
          'scripts/va/buildVirginiaMilitaryInstituteOpenRuleEvidence.js',
        ],
      });
  });

  it('replays the exact prerequisite sources before their derived university artifacts', () => {
    const index = Object.fromEntries(RELEASE_PHASES.map((entry, position) => [entry.id, position]));
    for (const evidenceId of [
      'cnu_cpen371w_prerequisite_evidence',
      'vsu_arabic_prerequisite_evidence',
      'vsu_prerequisite_closure_evidence',
      'norfolk_state_prerequisite_closure_evidence',
      'vcu_prerequisite_closure_evidence',
      'small_university_prerequisite_closure_evidence',
      'university_prerequisite_tail_closure_evidence',
      'radford_randolph_macon_prerequisite_tail_evidence',
      'figure6_noncourse_prerequisite_disposition',
      'shenandoah_prerequisite_discovery',
      'virginia_tech_graduate_cs_prerequisite_evidence',
      'virginia_tech_recursive_prerequisite_closure_evidence',
      'remaining_university_prerequisite_closure_evidence',
      'vcu_egmn_outside_scope_prerequisite_evidence',
      'radford_uva_wise_recursive_prerequisite_evidence',
    ]) {
      expect(index[evidenceId]).toBeLessThan(index.university_acquisition);
    }
    expect(index.university_acquisition).toBeLessThan(index.university_candidates);
    expect(index.remaining_university_prerequisite_closure_evidence)
      .toBeLessThan(index.vcu_egmn_outside_scope_prerequisite_evidence);
    expect(index.vcu_egmn_outside_scope_prerequisite_evidence)
      .toBeLessThan(index.radford_uva_wise_recursive_prerequisite_evidence);
    expect(index.radford_uva_wise_recursive_prerequisite_evidence)
      .toBeLessThan(index.university_acquisition);
    expect(index.university_candidates).toBeLessThan(index.university_review);
    expect(index.randolph_macon_collegiate_attribute_capture)
      .toBeLessThan(index.randolph_macon_collegiate_attribute_evidence);
    expect(index.randolph_macon_collegiate_attribute_evidence)
      .toBeLessThan(index.catalog_plan);
  });

  it('recounts the Figure 3/4 source-gap inventory as a release invariant', () => {
    expect(RELEASE_PHASES.find((entry) => entry.id === 'figure34_source_gap_audit'))
      .toMatchObject({ args: ['scripts/va/auditFigure34SourceBlockers.js'] });
  });

  it('replays the exact VT CSC 222 blocked cohort before the publication audit', () => {
    const blocked = RELEASE_PHASES.find((entry) => (
      entry.id === 'virginia_tech_csc222_java_blocked_cohort_evidence'
    ));
    expect(blocked).toMatchObject({
      label: 'Virginia Tech 15-cell CSC 222 Java blocked-cohort evidence replays fail-closed',
      args: ['scripts/va/captureVirginiaTechCsc222JavaBlockedCohortEvidence.js'],
    });
    const index = Object.fromEntries(RELEASE_PHASES.map((entry, position) => [entry.id, position]));
    expect(index.virginia_tech_csc222_java_evidence)
      .toBeLessThan(index.virginia_tech_csc222_java_blocked_cohort_evidence);
    expect(index.virginia_tech_csc222_java_blocked_cohort_evidence)
      .toBeLessThan(index.publication_audit);
  });

  it('runs the cell-sensitive CA/MA Figure 1-6 fingerprint as a release gate', () => {
    const baseline = RELEASE_PHASES.find((entry) => entry.id === 'shared_baseline');
    expect(baseline).toMatchObject({ args: ['scripts/figureBaseline.js'] });
    const index = Object.fromEntries(RELEASE_PHASES.map((entry, position) => [entry.id, position]));
    expect(index.shared_baseline).toBeLessThan(index.server_tests);
    expect(index.shared_baseline).toBeLessThan(index.frontend_tests);
  });

  it('requires both exact rollback contracts before either publication plan', () => {
    const rollback = RELEASE_PHASES.find((entry) => entry.id === 'rollback_readiness');
    expect(rollback).toMatchObject({ args: ['scripts/va/auditRollbackReadiness.js'] });
    const index = Object.fromEntries(RELEASE_PHASES.map((entry, position) => [entry.id, position]));
    expect(index.rollback_readiness).toBeLessThan(index.projection_plan);
    expect(index.rollback_readiness).toBeLessThan(index.figure6_plan);
  });

  it('can omit only the expensive regression/build phases', () => {
    const selected = selectedPhases({ skipTests: true });
    expect(selected.length).toBeLessThan(RELEASE_PHASES.length);
    expect(selected.every((entry) => entry.testPhase !== true)).toBe(true);
    expect(selected.some((entry) => entry.id === 'publication_audit')).toBe(true);
    expect(selected.some((entry) => entry.id === 'shared_baseline')).toBe(true);
  });

  it('rejects unknown options', () => {
    expect(optionsFrom([])).toEqual({ skipTests: false });
    expect(optionsFrom(['--skip-tests'])).toEqual({ skipTests: true });
    expect(() => optionsFrom(['--apply'])).toThrow(/unknown option/);
  });

  it('runs every phase and fails closed without stopping at the first failure', () => {
    const phases = RELEASE_PHASES.slice(0, 3);
    const statuses = [0, 7, 0];
    const spawn = vi.fn(() => ({ status: statuses.shift(), signal: null }));
    const stdout = { write: vi.fn() };
    const report = runReleaseCheck({ phases, spawn, stdout });

    expect(spawn).toHaveBeenCalledTimes(3);
    expect(report.ready).toBe(false);
    expect(report.failures.map((failure) => failure.id)).toEqual([phases[1].id]);
  });

  it('never treats an empty phase inventory as a ready release', () => {
    const report = runReleaseCheck({ phases: [], stdout: { write: vi.fn() } });
    expect(report).toMatchObject({
      ready: false,
      failures: [{ id: 'phase_inventory', status: 1 }],
    });
  });
});
