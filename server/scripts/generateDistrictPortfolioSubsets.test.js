import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cjs = createRequire(import.meta.url);
const {
  CheckpointWriter,
  analysisSourceManifest,
  buildDerived,
  checkpointHeader,
  countJobs,
  enumerateJobs,
  estimateRemainingMs,
  loadCheckpoint,
  parseArgs,
  shapleyAnalysis,
  stats,
  summarizeMarginals,
} = cjs('./generateDistrictPortfolioSubsets');

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.promises.rm(directory, { recursive: true, force: true })));
});

async function tempDirectory() {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'district-portfolios-'));
  temporaryDirectories.push(directory);
  return directory;
}

const programs = [
  { program_index: 0, school_id: 10, uc_code: 'A' },
  { program_index: 1, school_id: 20, uc_code: 'B' },
  { program_index: 2, school_id: 30, uc_code: 'C' },
];

function headerFor(overrides = {}) {
  return checkpointHeader({
    sourceFingerprint: 'a'.repeat(64),
    analysisCodeFingerprint: 'c'.repeat(64),
    plannerMethodId: 'planner_joint_closed_v1',
    generationParameters: {
      native_load: 15,
      optimizer_budget_ms: 5000,
      optimizer_max_states: 1000000,
      schedule_budget_ms: 5000,
    },
    filters: { districts: [], portfolio_size: null, limit: null },
    programs,
    districts: [{ districtIndex: 0, district: 'Alpha' }],
    jobs: [{ key: '0:1' }, { key: '0:2' }],
    ...overrides,
  });
}

describe('district portfolio generator CLI and worklist', () => {
  it('fingerprints every relevant analysis source file as checkpoint provenance', () => {
    const manifest = analysisSourceManifest();
    expect(manifest).toMatchObject({ algorithm: 'sha256' });
    expect(manifest.combined_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.files.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'scripts/generateDistrictPortfolioSubsets.js',
      'services/analysis/districtPathwayPlanner.js',
      'services/analysis/minCourses.js',
      'services/analysis/pathwayPlanner.js',
      'services/analysis/termScheduler.js',
      'services/prereqGraph.js',
    ]));
    expect(manifest.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
  });

  it('parses explicit outputs and research filters without ambiguous values', () => {
    const parsed = parseArgs([
      '--output', './sample.json',
      '--district', 'Foothill',
      '--district', 'West Hills',
      '--portfolio-size', '3',
      '--limit', '12',
      '--progress-interval-ms', '250',
      '--optimizer-max-states', '123456',
    ]);
    expect(parsed).toMatchObject({
      output: path.resolve('./sample.json'),
      outputExplicit: true,
      districts: ['Foothill', 'West Hills'],
      portfolioSize: 3,
      limit: 12,
      progressIntervalMs: 250,
      optimizerMaxStates: 123456,
    });
    expect(parsed.summaryCsv).toBe(path.resolve('./sample.summary.csv'));
    expect(parsed.marginalCsv).toBe(path.resolve('./sample.marginals.csv'));
    expect(() => parseArgs(['--output'])).toThrow(/requires a value/);
    expect(() => parseArgs(['--portfolio-size', '0'])).toThrow(/1 through 9/);
    expect(() => parseArgs(['--optimizer-max-states', '0'])).toThrow(/positive safe integer/);
  });

  it('enumerates deterministic nonempty reachable subsets and exact counts', () => {
    const districts = [
      { districtIndex: 0, district: 'Alpha', reachableMask: 0b011 },
      { districtIndex: 1, district: 'Beta', reachableMask: 0b100 },
      { districtIndex: 2, district: 'Zero', reachableMask: 0 },
    ];
    const jobs = enumerateJobs({ programs, districts }, {});
    expect(jobs.map((job) => job.key)).toEqual(['0:1', '0:2', '0:3', '1:4']);
    expect(countJobs(jobs)).toEqual({
      total: 4,
      by_portfolio_size: { 1: 3, 2: 1 },
      eligible_districts_by_size: { 1: 2, 2: 1 },
    });
    expect(enumerateJobs({ programs, districts }, { districts: ['beta'] })
      .map((job) => job.key)).toEqual(['1:4']);
    expect(enumerateJobs({ programs, districts }, { portfolioSize: 2 })
      .map((job) => job.key)).toEqual(['0:3']);
  });

  it('estimates remaining time separately by portfolio size', () => {
    expect(estimateRemainingMs(
      { 1: 2, 2: 1 },
      { 1: [100, 300], 2: [1000] },
    )).toBe(1400);
    expect(estimateRemainingMs({ 3: 2 }, {})).toBeNull();
  });
});

describe('district portfolio checkpoint recovery', () => {
  it('creates, appends, and resumes a compatible checkpoint', async () => {
    const directory = await tempDirectory();
    const checkpoint = path.join(directory, 'state.ndjson');
    const header = headerFor();
    expect((await loadCheckpoint(checkpoint, header)).records.size).toBe(0);
    const writer = new CheckpointWriter(checkpoint, 1);
    await writer.open();
    await writer.append({
      scenario_id: '0:1', district_index: 0, portfolio_mask: 1, portfolio_size: 1,
    });
    await writer.close();
    const resumed = await loadCheckpoint(checkpoint, header);
    expect([...resumed.records.keys()]).toEqual(['0:1']);

    const incompatible = headerFor({ plannerMethodId: 'planner_joint_closed_v2' });
    await expect(loadCheckpoint(checkpoint, incompatible)).rejects.toThrow(/incompatible/);
    const changedSource = headerFor({ analysisCodeFingerprint: 'd'.repeat(64) });
    await expect(loadCheckpoint(checkpoint, changedSource)).rejects.toThrow(/incompatible/);
  });

  it('truncates a torn final line before new rows are appended', async () => {
    const directory = await tempDirectory();
    const checkpoint = path.join(directory, 'state.ndjson');
    const header = headerFor();
    await loadCheckpoint(checkpoint, header);
    await fs.promises.appendFile(checkpoint, `${JSON.stringify({
      type: 'scenario',
      key: '0:1',
      scenario: { scenario_id: '0:1', district_index: 0, portfolio_mask: 1 },
    })}\n{"type":"scenario"`);

    const repaired = await loadCheckpoint(checkpoint, header);
    expect(repaired.ignoredTornTail).toBe(true);
    expect([...repaired.records.keys()]).toEqual(['0:1']);
    expect((await fs.promises.readFile(checkpoint, 'utf8')).endsWith('\n')).toBe(true);

    const writer = new CheckpointWriter(checkpoint, 1);
    await writer.open();
    await writer.append({
      scenario_id: '0:2', district_index: 0, portfolio_mask: 2, portfolio_size: 1,
    });
    await writer.close();
    expect([...(await loadCheckpoint(checkpoint, header)).records.keys()]).toEqual(['0:1', '0:2']);
  });

  it('rejects conflicting duplicate scenario keys', async () => {
    const directory = await tempDirectory();
    const checkpoint = path.join(directory, 'state.ndjson');
    const header = headerFor();
    await loadCheckpoint(checkpoint, header);
    const one = { scenario_id: '0:1', district_index: 0, portfolio_mask: 1, value: 1 };
    const two = { ...one, value: 2 };
    await fs.promises.appendFile(checkpoint, [
      JSON.stringify({ type: 'scenario', key: '0:1', scenario: one }),
      JSON.stringify({ type: 'scenario', key: '0:1', scenario: two }),
      '',
    ].join('\n'));
    await expect(loadCheckpoint(checkpoint, header)).rejects.toThrow(/Conflicting duplicate/);
  });
});

describe('derived research summaries', () => {
  it('does not coerce missing values to zero', () => {
    expect(stats([null, undefined, '', 2])).toEqual({
      n: 1, mean: 2, median: 2, q1: 2, q3: 2, min: 2, max: 2,
    });
  });

  it('reports path-weighted and district-equal paired marginals separately', () => {
    const summary = summarizeMarginals([
      { district_index: 0, portfolio_size: 2, added_code: 'A', added_courses: 0,
        added_semester_equiv_units: 0, added_academic_years: 0, unit_system: 'semester',
        from_course_quality: 'exact', to_course_quality: 'exact',
        from_schedule_quality: 'exact', to_schedule_quality: 'exact' },
      { district_index: 0, portfolio_size: 2, added_code: 'A', added_courses: 10,
        added_semester_equiv_units: 30, added_academic_years: 2, unit_system: 'semester',
        from_course_quality: 'exact', to_course_quality: 'exact',
        from_schedule_quality: 'exact', to_schedule_quality: 'exact' },
      { district_index: 1, portfolio_size: 2, added_code: 'A', added_courses: 0,
        added_semester_equiv_units: 0, added_academic_years: 0, unit_system: 'semester',
        from_course_quality: 'exact', to_course_quality: 'exact',
        from_schedule_quality: 'exact', to_schedule_quality: 'exact' },
    ]);
    const row = summary.by_portfolio_size[0].exact_only;
    expect(row.path_weighted.added_course_stats.mean).toBe(3.3);
    expect(row.district_weighted.added_course_stats.mean).toBe(2.5);
    expect(row.path_weighted.zero_course_addition_pct).toBe(66.7);
    expect(row.district_weighted.zero_course_addition_pct_stats.mean).toBe(75);
  });

  it('separates exact aggregates from bounded sensitivity and excludes unavailable edges', () => {
    const base = {
      district_index: 0,
      portfolio_size: 2,
      added_code: 'A',
      added_semester_equiv_units: 3,
      added_academic_years: 0.5,
      unit_system: 'semester',
      from_course_quality: 'exact',
      from_schedule_quality: 'exact',
    };
    const summary = summarizeMarginals([
      { ...base, added_courses: 1, to_course_quality: 'exact', to_schedule_quality: 'exact' },
      { ...base, added_courses: 3, to_course_quality: 'bounded', to_schedule_quality: 'bounded' },
      { ...base, added_courses: 99, to_course_quality: 'unusable', to_schedule_quality: 'unusable' },
    ]).by_portfolio_size[0];
    expect(summary.exact_only).toMatchObject({
      edge_count: 3,
      eligible_course_edge_count: 1,
      eligible_schedule_edge_count: 1,
    });
    expect(summary.exact_only.path_weighted.added_course_stats)
      .toMatchObject({ n: 1, mean: 1 });
    expect(summary.bounded_inclusive_sensitivity).toMatchObject({
      edge_count: 3,
      eligible_course_edge_count: 2,
      eligible_schedule_edge_count: 2,
    });
    expect(summary.bounded_inclusive_sensitivity.path_weighted.added_course_stats)
      .toMatchObject({ n: 2, mean: 2 });
  });

  it('excludes unavailable and fallback scenarios from portfolio aggregates', () => {
    const plan = (courseStatus, scheduleStatus, value, prerequisiteStatus = 'complete') => ({
      status: courseStatus === 'optimal' && scheduleStatus === 'optimal' ? 'optimal' : courseStatus,
      course_status: courseStatus,
      prerequisite_status: prerequisiteStatus,
      schedule_status: scheduleStatus,
      unresolved_prerequisite_groups: [],
      distinct_courses: value,
      semester_equiv_units: value,
      academic_years: value,
      min_terms: value,
      lower_bound_terms: value,
      upper_bound_terms: value,
    });
    const snapshot = {
      programs: [{ program_index: 0, school_id: 10, uc_code: 'A' }],
      districts: [0, 1, 2, 3, 4, 5].map((district_index) => ({
        district_index,
        district: `D${district_index}`,
        reachable_mask: 1,
        reachable_count: 1,
      })),
      scenarios: [
        { scenario_id: '0:1', district_index: 0, portfolio_mask: 1,
          portfolio_size: 1, unit_system: 'semester', plan: plan('optimal', 'optimal', 10) },
        { scenario_id: '1:1', district_index: 1, portfolio_mask: 1,
          portfolio_size: 1, unit_system: 'semester', plan: plan('bounded', 'bounded', 20) },
        { scenario_id: '2:1', district_index: 2, portfolio_mask: 1,
          portfolio_size: 1, unit_system: 'semester', plan: plan('unavailable', 'unavailable', 999) },
        { scenario_id: '3:1', district_index: 3, portfolio_mask: 1,
          portfolio_size: 1, unit_system: 'semester', plan: plan('optimal', 'optimal', 777, 'estimated') },
        { scenario_id: '4:1', district_index: 4, portfolio_mask: 1,
          portfolio_size: 1, unit_system: 'semester', plan: plan('fallback', 'fallback', 555) },
        { scenario_id: '5:1', district_index: 5, portfolio_mask: 1,
          portfolio_size: 1, unit_system: 'semester', plan: plan('optimal', 'fallback', 30) },
      ],
    };
    const derived = buildDerived(snapshot, []);
    const group = derived.by_portfolio_size[0];
    expect(group.exact_only.path_weighted.distinct_courses)
      .toMatchObject({ n: 2, mean: 20 });
    expect(group.exact_only.path_weighted.academic_years)
      .toMatchObject({ n: 1, mean: 10 });
    expect(group.bounded_inclusive_sensitivity.path_weighted.distinct_courses)
      .toMatchObject({ n: 3, mean: 20 });
    expect(group.exact_only.coverage).toMatchObject({
      total_scenarios: 6,
      eligible_course_scenarios: 2,
      eligible_schedule_scenarios: 1,
    });
    expect(group.bounded_inclusive_sensitivity.coverage).toMatchObject({
      total_scenarios: 6,
      eligible_course_scenarios: 3,
      eligible_schedule_scenarios: 2,
    });
  });

  it('uses equal base-subset-size Shapley weights and satisfies efficiency', () => {
    const scenarios = [];
    for (let mask = 1; mask < 8; mask += 1) {
      // Only the grand coalition has value. Uniformly averaging the four raw
      // coalitions would give 3; true three-player Shapley weighting gives 4.
      const value = mask === 7 ? 12 : 0;
      scenarios.push({
        scenario_id: `0:${mask}`,
        district_index: 0,
        portfolio_mask: mask,
        portfolio_size: mask.toString(2).replaceAll('0', '').length,
        plan: {
          status: 'optimal',
          course_status: 'optimal',
          prerequisite_status: 'complete',
          schedule_status: 'optimal',
          unresolved_prerequisite_groups: [],
          distinct_courses: value,
          semester_equiv_units: value,
          academic_years: value,
        },
      });
    }
    const result = shapleyAnalysis({
      programs,
      districts: [{
        district_index: 0,
        district: 'Alpha',
        reachable_mask: 7,
        reachable_count: 3,
      }],
      scenarios,
    });
    expect(result.district_campus_values).toHaveLength(3);
    for (const row of result.district_campus_values) {
      expect(row.weight_per_base_subset_size).toBe(0.333);
      expect(row.shapley.distinct_courses).toBe(4);
      expect(row.by_base_subset_size.map((bucket) =>
        bucket.distinct_courses_mean_marginal)).toEqual([0, 0, 12]);
    }
    expect(result.efficiency_failure_count).toBe(0);
    expect(result.efficiency_checks.find((row) => row.metric === 'distinct_courses'))
      .toMatchObject({ shapley_sum: 12, full_plan_value: 12, residual: 0, passed: true });
  });
});
