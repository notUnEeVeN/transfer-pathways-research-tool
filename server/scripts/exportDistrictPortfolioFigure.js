#!/usr/bin/env node

/**
 * Build the small, browser-facing snapshot used by the district portfolio
 * figure. The canonical artifact intentionally retains every course and term;
 * importing all 23 MB into the frontend would make the figure needlessly
 * expensive. This exporter keeps the displayed summaries traceable to that
 * artifact without duplicating its plan-level payload.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const DEFAULT_INPUT = path.resolve(
  __dirname,
  '../data/analysis/district-portfolio-subsets.v1.json',
);
const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  '../../frontend/src/analyses/data/district-portfolio-subsets.v1.json',
);

function parseArgs(argv) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--input') options.input = path.resolve(argv[++index]);
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function clone(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function commonReachableCodes(districts, count) {
  const members = districts.filter((district) => Number(district.reachable_count) === count);
  if (!members.length) return [];
  return (members[0].reachable_codes || [])
    .filter((code) => members.every((district) => (district.reachable_codes || []).includes(code)))
    .sort();
}

function buildFigureSnapshot(source) {
  if (source?.schema_version !== 1 || source?.canonical !== true) {
    throw new Error('Expected the canonical district-portfolio schema v1 artifact.');
  }
  if (!Array.isArray(source.districts) || source.districts.length !== 72) {
    throw new Error('Expected 72 community college districts.');
  }
  if (!Array.isArray(source.programs) || source.programs.length !== 9) {
    throw new Error('Expected nine pinned UC programs.');
  }
  if (source.audit?.structural_checks !== 'passed') {
    throw new Error('Canonical artifact structural checks have not passed.');
  }

  const auditBySize = new Map(
    (source.audit?.by_portfolio_size || []).map((row) => [Number(row.portfolio_size), row]),
  );
  const fixedBySize = new Map(
    (source.derived?.fixed_max_reach_cohort?.by_portfolio_size || [])
      .map((row) => [Number(row.portfolio_size), row]),
  );
  const rows = (source.derived?.by_portfolio_size || []).map((row) => {
    const portfolioSize = Number(row.portfolio_size);
    const audit = auditBySize.get(portfolioSize) || {};
    const fixed = fixedBySize.get(portfolioSize) || {};
    const exactCount = Number(audit.course_status_counts?.optimal || 0);
    const boundedCount = Number(audit.course_status_counts?.bounded || 0);
    const unavailableCount = Number(audit.course_status_counts?.unavailable || 0);
    const scenarioCount = Number(row.scenario_count || 0);
    const districtEqual = row.bounded_inclusive_sensitivity?.district_weighted || {};
    const pathWeighted = row.bounded_inclusive_sensitivity?.path_weighted || {};
    const exactOnly = row.exact_only?.district_weighted || {};
    const fixedDistrictEqual = fixed.bounded_inclusive_sensitivity?.district_weighted || {};

    return {
      portfolio_size: portfolioSize,
      scenario_count: scenarioCount,
      eligible_district_count: Number(row.district_count || 0),
      represented_district_count: Number(districtEqual.distinct_courses?.n || 0),
      usable_scenario_count: boundedCount + exactCount,
      exact_scenario_count: exactCount,
      bounded_scenario_count: boundedCount,
      unavailable_scenario_count: unavailableCount,
      exact_share_pct: scenarioCount ? Number(((exactCount / scenarioCount) * 100).toFixed(1)) : 0,
      district_equal: {
        distinct_courses: clone(districtEqual.distinct_courses),
        academic_years: clone(districtEqual.academic_years),
      },
      path_weighted: {
        distinct_courses: clone(pathWeighted.distinct_courses),
        academic_years: clone(pathWeighted.academic_years),
      },
      exact_only_district_equal: {
        distinct_courses: clone(exactOnly.distinct_courses),
        academic_years: clone(exactOnly.academic_years),
      },
      fixed_high_access_cohort: {
        distinct_courses: clone(fixedDistrictEqual.distinct_courses),
        academic_years: clone(fixedDistrictEqual.academic_years),
      },
      overlap_savings_courses: clone(
        row.bounded_inclusive_sensitivity?.overlap_savings_course_stats,
      ),
    };
  }).sort((left, right) => left.portfolio_size - right.portfolio_size);

  if (rows.length !== 7 || rows.some((row, index) => row.portfolio_size !== index + 1)) {
    throw new Error('Expected complete portfolio-size summaries from one through seven.');
  }

  const planStatuses = source.audit.plan_status_counts || {};
  const maximum = rows[rows.length - 1];
  const unsigned = {
    schema_version: 1,
    generated_at: source.generated_at,
    method_id: source.method_id,
    canonical_artifact_fingerprint: source.artifact_fingerprint,
    source_fingerprint: source.source_fingerprint,
    generation_parameters: clone(source.generation_parameters),
    programs: source.programs.map((program) => ({
      uc_code: program.uc_code,
      school_id: program.school_id,
      school: program.school,
      major: program.major,
    })),
    summary: {
      districts_total: source.districts.length,
      scenarios_total: Number(source.scenario_counts?.total || 0),
      usable_scenarios: Number(planStatuses.optimal || 0) + Number(planStatuses.bounded || 0),
      exact_scenarios: Number(planStatuses.optimal || 0),
      bounded_scenarios: Number(planStatuses.bounded || 0),
      unavailable_scenarios: Number(planStatuses.unavailable || 0),
      maximum_portfolio_size: maximum.portfolio_size,
      maximum_portfolio_districts: maximum.represented_district_count,
    },
    fixed_high_access_cohort: {
      district_count: Number(source.derived.fixed_max_reach_cohort?.district_count || 0),
      reachable_count: Number(source.derived.fixed_max_reach_cohort?.reachable_count || 0),
      complete_balanced_portfolio_grid:
        source.derived.fixed_max_reach_cohort?.complete_balanced_portfolio_grid === true,
      common_program_codes: commonReachableCodes(source.districts, maximum.portfolio_size),
    },
    rows,
    result_scope_note: source.derived?.result_scope_note,
    weighting_note: source.derived?.weighting_note,
  };
  return {
    ...unsigned,
    figure_snapshot_fingerprint: createHash('sha256')
      .update(JSON.stringify(unsigned))
      .digest('hex'),
  };
}

function validateFigureSnapshot(snapshot) {
  if (snapshot?.schema_version !== 1) throw new Error('Unexpected figure snapshot schema.');
  if (!Array.isArray(snapshot.rows) || snapshot.rows.length !== 7) {
    throw new Error('Figure snapshot must contain seven portfolio-size rows.');
  }
  if (snapshot.rows.some((row, index) => row.portfolio_size !== index + 1)) {
    throw new Error('Figure rows must be ordered one through seven.');
  }
  for (const row of snapshot.rows) {
    const mean = Number(row.district_equal?.distinct_courses?.mean);
    const years = Number(row.district_equal?.academic_years?.mean);
    if (!Number.isFinite(mean) || !Number.isFinite(years)) {
      throw new Error(`Portfolio size ${row.portfolio_size} lacks a displayable mean.`);
    }
    if (row.exact_scenario_count + row.bounded_scenario_count !== row.usable_scenario_count) {
      throw new Error(`Portfolio size ${row.portfolio_size} has inconsistent status counts.`);
    }
  }
  const stored = snapshot.figure_snapshot_fingerprint;
  const unsigned = { ...snapshot };
  delete unsigned.figure_snapshot_fingerprint;
  const expected = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
  if (stored !== expected) throw new Error('Figure snapshot fingerprint does not match.');
  return snapshot;
}

async function atomicWriteJson(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await fs.promises.writeFile(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx' });
    await fs.promises.rename(temporary, filePath);
  } catch (error) {
    await fs.promises.unlink(temporary).catch(() => {});
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write([
      'Usage: npm run snapshot:district-portfolios:figure -- [options]',
      '  --input path',
      '  --output path',
      '  --check',
    ].join('\n') + '\n');
    return;
  }
  const source = JSON.parse(await fs.promises.readFile(options.input, 'utf8'));
  const expected = validateFigureSnapshot(buildFigureSnapshot(source));
  if (options.check) {
    const installed = validateFigureSnapshot(
      JSON.parse(await fs.promises.readFile(options.output, 'utf8')),
    );
    if (JSON.stringify(installed) !== JSON.stringify(expected)) {
      throw new Error('Installed figure snapshot is stale. Regenerate it.');
    }
  } else {
    await atomicWriteJson(options.output, expected);
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: options.check ? 'check' : 'write',
    input: options.input,
    output: options.output,
    rows: expected.rows.length,
    scenarios: expected.summary.scenarios_total,
    fingerprint: expected.figure_snapshot_fingerprint,
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildFigureSnapshot,
  validateFigureSnapshot,
};
