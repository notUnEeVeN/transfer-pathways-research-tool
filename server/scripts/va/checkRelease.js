#!/usr/bin/env node
/**
 * One-command, non-publishing Virginia publication check.
 *
 * The command intentionally runs every phase even after a failure so a single
 * invocation produces the complete remediation list.  None of the child
 * commands receives --write or --apply, and the phase inventory is exported
 * so tests can enforce that invariant.
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SERVER_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(SERVER_ROOT, '..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend');
const NODE = process.execPath;
const SERVER_VITEST = path.join(SERVER_ROOT, 'node_modules/.bin/vitest');
const FRONTEND_VITEST = path.join(FRONTEND_ROOT, 'node_modules/.bin/vitest');
const FRONTEND_VITE = path.join(FRONTEND_ROOT, 'node_modules/.bin/vite');
const DEFAULT_PHASE_TIMEOUT_MS = 3 * 60 * 1000;
// The official Radford robots policy requires a 120-second delay between its
// four course requests. Three mandatory gaps alone consume six minutes.
const RADFORD_SCIENCE_PHASE_TIMEOUT_MS = 8 * 60 * 1000;

const phase = (id, label, cwd, command, args, options = {}) => Object.freeze({
  id,
  label,
  cwd,
  command,
  args: Object.freeze(args),
  timeoutMs: DEFAULT_PHASE_TIMEOUT_MS,
  ...options,
});

const RELEASE_PHASES = Object.freeze([
  phase(
    'vccs_scope',
    'canonical 19-plan VCCS/Richard Bland scope has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildCanonicalVccsCourseScope.js'],
  ),
  phase(
    'vccs_corpus',
    'VCCS concept and prerequisite artifacts rebuild byte-for-byte',
    SERVER_ROOT,
    NODE,
    ['scripts/buildVirginiaPrerequisites.js', '--check'],
  ),
  phase(
    'vccs_publication_corpus',
    'strict owner-scoped VCCS Figure 6 publication artifact has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildVccsFigure6PrerequisiteCorpus.js'],
  ),
  phase(
    'vccs_gaps',
    'VCCS prerequisite gap evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildVccsPrerequisiteGapEvidence.js'],
  ),
  phase(
    'southwest_vccs_evidence',
    'Southwest VCCS owner-course evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['services/virginia/southwestVccsPrerequisiteEvidence.js'],
  ),
  phase(
    'laurel_ridge_vccs_evidence',
    'Laurel Ridge VCCS prerequisite-closure evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['services/virginia/laurelRidgeVccsPrerequisiteEvidence.js'],
  ),
  phase(
    'university_scope',
    'receiving-university prerequisite scope has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildUniversityPrerequisiteScope.js'],
  ),
  phase(
    'cnu_cpen371w_prerequisite_evidence',
    'CNU CPEN 371W exact current identity and prerequisite receipts replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureCnuCpen371wPrerequisiteEvidence.js'],
  ),
  phase(
    'vsu_arabic_prerequisite_evidence',
    'Virginia State Arabic exact prerequisite and admission-restriction receipts replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaStateArabicPrerequisiteEvidence.js'],
  ),
  phase(
    'vsu_prerequisite_closure_evidence',
    'Virginia State exact prerequisite closure and catalog-conflict evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildVirginiaStatePrerequisiteClosureEvidence.js'],
  ),
  phase(
    'norfolk_state_prerequisite_closure_evidence',
    'Norfolk State exact prerequisite closure, missing-entry, and sequence evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildNorfolkStatePrerequisiteClosureEvidence.js'],
  ),
  phase(
    'vcu_prerequisite_closure_evidence',
    'VCU exact prerequisite closure dispositions replay from retained entries',
    SERVER_ROOT,
    NODE,
    ['scripts/va/checkVcuPrerequisiteClosure.js'],
  ),
  phase(
    'small_university_prerequisite_closure_evidence',
    'Six-university exact prerequisite/corequisite closure evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildSmallUniversityPrerequisiteClosureEvidence.js'],
  ),
  phase(
    'university_prerequisite_tail_closure_evidence',
    'JMU, ODU, and William & Mary tail entries replay with reciprocal-cycle blocking',
    SERVER_ROOT,
    NODE,
    ['scripts/va/checkUniversityPrerequisiteTailClosure.js'],
  ),
  phase(
    'radford_randolph_macon_prerequisite_tail_evidence',
    'Radford and Randolph-Macon exact zero-course-edge tail evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildRadfordRandolphMaconPrerequisiteTailEvidence.js'],
  ),
  phase(
    'figure6_noncourse_prerequisite_disposition',
    'Figure 6 exact zero-edge non-course dispositions replay without dropping constraints',
    SERVER_ROOT,
    NODE,
    ['scripts/va/checkFigure6NonCoursePrerequisiteDisposition.js'],
  ),
  phase(
    'shenandoah_prerequisite_discovery',
    'Shenandoah exact current course-discovery attempts replay without unsafe absence inference',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureShenandoahAcalogDiscovery.js'],
  ),
  phase(
    'virginia_tech_graduate_cs_prerequisite_evidence',
    'Virginia Tech graduate CS prerequisite entries replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaTechGraduateCsPrerequisiteEvidence.js'],
  ),
  phase(
    'virginia_tech_recursive_prerequisite_closure_evidence',
    'Virginia Tech recursive corequisites and preserved semantic/runtime blockers replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/checkVirginiaTechRecursivePrerequisiteClosure.js'],
  ),
  phase(
    'remaining_university_prerequisite_closure_evidence',
    'remaining exact university prerequisite formulas and zero-edge rows replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildRemainingUniversityPrerequisiteClosureEvidence.js'],
  ),
  phase(
    'vcu_egmn_outside_scope_prerequisite_evidence',
    'VCU EGMN exact formulas and structural-none entries replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildVcuEgmnOutsideScopePrerequisiteEvidence.js'],
  ),
  phase(
    'radford_uva_wise_recursive_prerequisite_evidence',
    'Radford and UVA Wise recursive prerequisite evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildRadfordUvaWiseRecursivePrerequisiteEvidence.js'],
  ),
  phase(
    'university_acquisition',
    'receiving-university official-entry acquisition has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/acquireUniversityPrerequisites.js'],
  ),
  phase(
    'university_candidates',
    'receiving-university prerequisite candidates have no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildUniversityPrerequisiteCandidates.js'],
  ),
  phase(
    'university_review',
    'receiving-university strict formula review has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildUniversityPrerequisiteReview.js'],
  ),
  phase(
    'william_mary_evidence',
    'William & Mary current-catalog non-uniqueness evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildWilliamMaryCurrentCatalogFigureEvidence.js'],
  ),
  phase(
    'virginia_state_figure1_source_gap',
    'Virginia State Figure 1 restricted-elective source gap replays exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildVirginiaStateFigure1SourceGapEvidence.js'],
  ),
  phase(
    'longwood_civitae_evidence',
    'Longwood exact Civitae Figure 3/4 evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureLongwoodCivitaeFigureEvidence.js'],
  ),
  phase(
    'tidewater_figure34_open_rule_evidence',
    'Tidewater Figure 3/4 open-rule evidence remains exact and fail-closed',
    SERVER_ROOT,
    NODE,
    ['scripts/va/checkTidewaterFigure34OpenRules.js'],
  ),
  phase(
    'randolph_macon_collegiate_attribute_capture',
    'Randolph-Macon official Collegiate attribute source bytes and robots receipt have no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureRandolphMaconCollegiateAttributeSources.js'],
  ),
  phase(
    'randolph_macon_collegiate_attribute_evidence',
    'Randolph-Macon published lower-bound attribute rosters rebuild exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildRandolphMaconCollegiateAttributeEvidence.js'],
  ),
  phase(
    'vcu_transfer_policy_evidence',
    'VCU transfer-oriented A.S. and residency policy evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVcuTransferPolicyEvidence.js'],
  ),
  phase(
    'radford_transfer_degree_evidence',
    'Radford completed-A.S. REAL policy evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureRadfordTransferDegreeEvidence.js'],
  ),
  phase(
    'radford_science_pair_evidence',
    'Radford science-pair raw receipts and strict normalized full-page replay have no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureRadfordSciencePairEvidence.js'],
    { timeoutMs: RADFORD_SCIENCE_PHASE_TIMEOUT_MS },
  ),
  phase(
    'radford_college_science_pair_evidence',
    'Radford college-specific science-pair equivalency receipts replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureRadfordCollegeSciencePairEvidence.js'],
  ),
  phase(
    'radford_remaining_science_pair_capture',
    'Radford remaining-pair official source bytes and robots receipts replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureRadfordRemainingSciencePairEvidence.js'],
  ),
  phase(
    'radford_remaining_science_pair_evidence',
    'Radford Richard Bland closure and Southwest blocker artifact rebuild exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildRadfordRemainingSciencePairEvidence.js'],
  ),
  phase(
    'virginia_tech_equivalency_quantity_evidence',
    'Virginia Tech exact VCCS split-credit quantities have no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaTechEquivalencyQuantityEvidence.js'],
  ),
  phase(
    'virginia_tech_transfer_policy_evidence',
    'Virginia Tech transferable-associate policy evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaTechTransferPolicyEvidence.js'],
  ),
  phase(
    'virginia_tech_csc222_java_evidence',
    'Virginia Tech CSC 222 Java articulation witness evidence replays exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaTechCsc222JavaEvidence.js'],
  ),
  phase(
    'virginia_tech_csc222_java_blocked_cohort_evidence',
    'Virginia Tech 15-cell CSC 222 Java blocked-cohort evidence replays fail-closed',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaTechCsc222JavaBlockedCohortEvidence.js'],
  ),
  phase(
    'virginia_tech_pathways_evidence',
    'Virginia Tech Pathways capacity evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaTechPathwaysCapacity.js'],
  ),
  phase(
    'vmi_open_rule_capture',
    'VMI official catalog PDF capture and robots receipt have no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/captureVirginiaMilitaryInstituteOpenRuleSources.js'],
  ),
  phase(
    'vmi_open_rule_evidence',
    'VMI exact mathematics and Core-overlay evidence has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildVirginiaMilitaryInstituteOpenRuleEvidence.js'],
  ),
  phase(
    'catalog_plan',
    'accepted Virginia source catalog rebuild is dry-run clean',
    SERVER_ROOT,
    NODE,
    [
      '-r',
      'dotenv/config',
      'scripts/importVirginiaCatalogDegrees.js',
      '--accepted-compositions-only',
      '--source-plan',
      '--dry-run',
    ],
    { env: Object.freeze({ DOTENV_CONFIG_PATH: '.env' }) },
  ),
  phase(
    'rollback_readiness',
    'projection and prerequisite rollback contracts are complete and fail closed',
    SERVER_ROOT,
    NODE,
    ['scripts/va/auditRollbackReadiness.js'],
  ),
  phase(
    'projection_plan',
    'shared-schema Virginia projection is dry-run clean',
    SERVER_ROOT,
    NODE,
    ['scripts/va/buildVaDocuments.js'],
  ),
  phase(
    'figure6_plan',
    'Figure 6 prerequisite publication contract passes',
    SERVER_ROOT,
    NODE,
    ['scripts/va/publishFigure6Prerequisites.js'],
  ),
  phase(
    'publication_audit',
    'all Virginia paper-figure publication gates pass',
    SERVER_ROOT,
    NODE,
    ['scripts/va/auditPublicationReadiness.js', '--source-plan'],
  ),
  phase(
    'figure34_source_gap_audit',
    'Figure 3/4 blocked-source cohort and remediation inventory replay exactly',
    SERVER_ROOT,
    NODE,
    ['scripts/va/auditFigure34SourceBlockers.js'],
  ),
  phase(
    'verification_review',
    'source-bundle human-verification receipts are current',
    SERVER_ROOT,
    NODE,
    ['scripts/va/reviewPublicationVerifications.js', '--require-clean'],
  ),
  phase(
    'shared_baseline',
    'California/Massachusetts figure fingerprint has no drift',
    SERVER_ROOT,
    NODE,
    ['scripts/figureBaseline.js'],
    { timeoutMs: 5 * 60 * 1000 },
  ),
  phase(
    'server_tests',
    'server regression suite passes',
    SERVER_ROOT,
    SERVER_VITEST,
    ['run'],
    { testPhase: true, timeoutMs: 10 * 60 * 1000 },
  ),
  phase(
    'frontend_tests',
    'frontend regression suite passes',
    FRONTEND_ROOT,
    FRONTEND_VITEST,
    ['run'],
    { testPhase: true, timeoutMs: 10 * 60 * 1000 },
  ),
  phase(
    'frontend_build',
    'production frontend build passes',
    FRONTEND_ROOT,
    FRONTEND_VITE,
    ['build'],
    { testPhase: true, timeoutMs: 5 * 60 * 1000 },
  ),
]);

function optionsFrom(argv = process.argv.slice(2)) {
  const supported = new Set(['--skip-tests']);
  const unknown = argv.filter((argument) => !supported.has(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  return { skipTests: argv.includes('--skip-tests') };
}

function selectedPhases({ skipTests = false } = {}) {
  return RELEASE_PHASES.filter((entry) => !(skipTests && entry.testPhase));
}

function runReleaseCheck({
  phases = RELEASE_PHASES,
  spawn = spawnSync,
  stdout = process.stdout,
} = {}) {
  if (!Array.isArray(phases) || phases.length === 0) {
    const failure = {
      id: 'phase_inventory',
      label: 'release phase inventory must be nonempty',
      status: 1,
      signal: null,
      error: 'no release phases were supplied',
    };
    stdout.write(
      '\nVirginia release check summary\n'
        + '  FAIL phase_inventory — no release phases were supplied\n'
        + '\nNOT READY: the release phase inventory is empty. Virginia remains disabled.\n',
    );
    return { ready: false, results: [failure], failures: [failure] };
  }
  const results = [];
  for (const entry of phases) {
    stdout.write(`\n[VA release] ${entry.id}: ${entry.label}\n`);
    const child = spawn(entry.command, entry.args, {
      cwd: entry.cwd,
      env: { ...process.env, ...(entry.env || {}) },
      stdio: 'inherit',
      shell: false,
      timeout: entry.timeoutMs,
      killSignal: 'SIGTERM',
    });
    const status = Number.isInteger(child.status) ? child.status : 1;
    results.push({
      id: entry.id,
      label: entry.label,
      status,
      signal: child.signal || null,
      error: child.error ? child.error.message : null,
    });
  }

  const failures = results.filter((result) => result.status !== 0);
  stdout.write('\nVirginia release check summary\n');
  for (const result of results) {
    stdout.write(`  ${result.status === 0 ? 'PASS' : 'FAIL'} ${result.id}${result.error ? ` — ${result.error}` : ''}\n`);
  }
  stdout.write(
    failures.length
      ? `\nNOT READY: ${failures.length}/${results.length} phase(s) failed. Virginia remains disabled.\n`
      : `\nREADY: all ${results.length} non-publishing phases passed.\n`,
  );
  return { ready: failures.length === 0, results, failures };
}

if (require.main === module) {
  try {
    const options = optionsFrom();
    const report = runReleaseCheck({ phases: selectedPhases(options) });
    if (!report.ready) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = {
  DEFAULT_PHASE_TIMEOUT_MS,
  RADFORD_SCIENCE_PHASE_TIMEOUT_MS,
  RELEASE_PHASES,
  optionsFrom,
  runReleaseCheck,
  selectedPhases,
};
