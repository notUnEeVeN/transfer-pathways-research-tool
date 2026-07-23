#!/usr/bin/env node
/**
 * Enumerate every nonempty subset of the strictly reachable pinned UC computer
 * science programs for every California community college district.
 *
 * This is deliberately an offline research-data job. The append-only
 * checkpoint is the recovery log; the installed JSON and companion CSV files
 * are written only after the complete job set passes structural validation.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const programPins = require('../data/analysis/district-pathway-programs.v1.json');
const districtPlanner = require('../services/analysis/districtPathwayPlanner');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SCHEMA_VERSION = 1;
const CHECKPOINT_SCHEMA_VERSION = 1;
const METHOD_ID = 'district_pooled_portfolio_subsets_v3_exact_quality_strata';
const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  '../data/analysis/district-portfolio-subsets.v1.json',
);
const DEFAULT_NATIVE_LOAD = 15;
const DEFAULT_OPTIMIZER_BUDGET_MS = 5000;
const DEFAULT_OPTIMIZER_MAX_STATES = 1000000;
const DEFAULT_SCHEDULE_BUDGET_MS = 5000;
const DEFAULT_PROGRESS_INTERVAL_MS = 1000;
const ANALYSIS_SOURCE_FILES = Object.freeze([
  __filename,
  path.resolve(__dirname, '../services/analysis/districtPathwayPlanner.js'),
  path.resolve(__dirname, '../services/analysis/pathwayPlanner.js'),
  path.resolve(__dirname, '../services/analysis/minCourses.js'),
  path.resolve(__dirname, '../services/analysis/eligibility.js'),
  path.resolve(__dirname, '../services/analysis/termScheduler.js'),
  path.resolve(__dirname, '../services/prereqGraph.js'),
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    if (value instanceof Map) {
      return [...value.entries()]
        .sort(([left], [right]) => String(left).localeCompare(String(right)))
        .map(([key, item]) => [key, stableValue(item)]);
    }
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  return createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function analysisSourceManifest() {
  const serverRoot = path.resolve(__dirname, '..');
  const files = ANALYSIS_SOURCE_FILES.map((filePath) => {
    const contents = fs.readFileSync(filePath);
    return {
      path: path.relative(serverRoot, filePath).split(path.sep).join('/'),
      sha256: createHash('sha256').update(contents).digest('hex'),
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
  return {
    algorithm: 'sha256',
    files,
    combined_sha256: fingerprint(files),
  };
}

// Capture provenance immediately after Node has loaded this generator and its
// planner dependencies. A file edited while a long corpus load is in progress
// must not be mistaken for the code that is already executing in this process.
const LOADED_ANALYSIS_SOURCE = analysisSourceManifest();

function companionPath(output, suffix) {
  const resolved = path.resolve(output);
  return resolved.endsWith('.json')
    ? `${resolved.slice(0, -5)}.${suffix}`
    : `${resolved}.${suffix}`;
}

function usage() {
  return [
    'Usage:',
    '  npm run snapshot:district-portfolios -- [options]',
    '',
    'Generation:',
    '  --output path                    Detailed JSON artifact',
    '  --checkpoint path                Append-only NDJSON recovery log',
    '  --summary-csv path               One row per district-portfolio plan',
    '  --marginal-csv path              One row per paired campus addition',
    '  --native-load 15                 Native semester/quarter unit cap',
    '  --optimizer-budget-ms 5000       Per-plan course optimizer budget',
    '  --optimizer-max-states 1000000   Per-plan course optimizer state cap',
    '  --schedule-budget-ms 5000        Per-plan scheduler budget',
    '  --progress-interval-ms 1000      TTY refresh interval',
    '  --strict                         Reject bounded/estimated results',
    '',
    'Inspection and smoke runs:',
    '  --check                          Validate an existing --output offline',
    '  --dry-run                        Load inputs and print the work plan only',
    '  --district text                  Include matching district (repeatable)',
    '  --portfolio-size 1..9            Include one portfolio size only',
    '  --limit n                        Run only the first n deterministic jobs',
    '',
    'Compatible checkpoints resume automatically. Filtered or limited writes',
    'require an explicit --output so the canonical artifact cannot be replaced.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    outputExplicit: false,
    checkpoint: null,
    summaryCsv: null,
    marginalCsv: null,
    nativeLoad: DEFAULT_NATIVE_LOAD,
    optimizerBudgetMs: DEFAULT_OPTIMIZER_BUDGET_MS,
    optimizerMaxStates: DEFAULT_OPTIMIZER_MAX_STATES,
    scheduleBudgetMs: DEFAULT_SCHEDULE_BUDGET_MS,
    progressIntervalMs: DEFAULT_PROGRESS_INTERVAL_MS,
    districts: [],
    portfolioSize: null,
    limit: null,
    check: false,
    dryRun: false,
    strict: false,
    help: false,
  };
  const valueAfter = (index, flag) => {
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--output') {
      options.output = path.resolve(valueAfter(index, arg));
      options.outputExplicit = true;
      index += 1;
    } else if (arg === '--checkpoint') {
      options.checkpoint = path.resolve(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--summary-csv') {
      options.summaryCsv = path.resolve(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--marginal-csv') {
      options.marginalCsv = path.resolve(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--native-load') {
      options.nativeLoad = Number(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--optimizer-budget-ms') {
      options.optimizerBudgetMs = Number(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--optimizer-max-states') {
      options.optimizerMaxStates = Number(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--schedule-budget-ms') {
      options.scheduleBudgetMs = Number(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--progress-interval-ms') {
      options.progressIntervalMs = Number(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--district') {
      options.districts.push(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--portfolio-size') {
      options.portfolioSize = Number(valueAfter(index, arg));
      index += 1;
    } else if (arg === '--limit') {
      options.limit = Number(valueAfter(index, arg));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(options.nativeLoad) || options.nativeLoad < 6 || options.nativeLoad > 24) {
    throw new Error('--native-load must be between 6 and 24');
  }
  for (const [flag, value] of [
    ['--optimizer-budget-ms', options.optimizerBudgetMs],
    ['--schedule-budget-ms', options.scheduleBudgetMs],
  ]) {
    if (!Number.isFinite(value) || value < 50) throw new Error(`${flag} must be at least 50`);
  }
  if (!Number.isSafeInteger(options.optimizerMaxStates) || options.optimizerMaxStates < 1) {
    throw new Error('--optimizer-max-states must be a positive safe integer');
  }
  if (!Number.isFinite(options.progressIntervalMs)
    || options.progressIntervalMs < 100 || options.progressIntervalMs > 60000) {
    throw new Error('--progress-interval-ms must be between 100 and 60000');
  }
  if (options.portfolioSize != null
    && (!Number.isInteger(options.portfolioSize)
      || options.portfolioSize < 1 || options.portfolioSize > 9)) {
    throw new Error('--portfolio-size must be an integer from 1 through 9');
  }
  if (options.limit != null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  options.output = path.resolve(options.output);
  options.summaryCsv ||= companionPath(options.output, 'summary.csv');
  options.marginalCsv ||= companionPath(options.output, 'marginals.csv');
  return options;
}

async function atomicWrite(filePath, contents) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    const handle = await fs.promises.open(temporary, 'wx');
    try {
      await handle.writeFile(contents);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.promises.rename(temporary, filePath);
  } catch (error) {
    await fs.promises.unlink(temporary).catch(() => {});
    throw error;
  }
}

async function atomicWriteJson(filePath, value) {
  return atomicWrite(filePath, `${JSON.stringify(value)}\n`);
}

function scenarioKey(districtIndex, portfolioMask) {
  return `${Number(districtIndex)}:${Number(portfolioMask)}`;
}

function sameCheckpointHeader(left, right) {
  return left?.type === 'header'
    && right?.type === 'header'
    && left.run_fingerprint === right.run_fingerprint
    && stableSerialize(left) === stableSerialize(right);
}

async function loadCheckpoint(filePath, expectedHeader) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  let raw;
  try {
    raw = await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const handle = await fs.promises.open(filePath, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(expectedHeader)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return { records: new Map(), duplicateCount: 0, ignoredTornTail: false };
  }
  if (!raw) throw new Error(`Checkpoint is empty: ${filePath}`);
  const hasFinalNewline = raw.endsWith('\n');
  const lines = raw.split('\n');
  if (hasFinalNewline) lines.pop();
  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch (error) {
    throw new Error(`Invalid checkpoint header: ${error.message}`);
  }
  if (!sameCheckpointHeader(header, expectedHeader)) {
    throw new Error(`Checkpoint is incompatible with this corpus, method, parameter set, or filter: ${filePath}`);
  }
  const records = new Map();
  let duplicateCount = 0;
  let ignoredTornTail = false;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) throw new Error(`Invalid blank checkpoint line ${index + 1}`);
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      if (index === lines.length - 1 && !hasFinalNewline) {
        ignoredTornTail = true;
        break;
      }
      throw new Error(`Invalid checkpoint line ${index + 1}: ${error.message}`);
    }
    if (entry?.type !== 'scenario' || typeof entry.key !== 'string' || !entry.scenario) {
      throw new Error(`Invalid checkpoint entry on line ${index + 1}`);
    }
    const expectedKey = scenarioKey(entry.scenario.district_index, entry.scenario.portfolio_mask);
    if (entry.key !== expectedKey || entry.scenario.scenario_id !== expectedKey) {
      throw new Error(`Checkpoint key mismatch on line ${index + 1}`);
    }
    if (records.has(entry.key)) {
      if (stableSerialize(records.get(entry.key)) !== stableSerialize(entry.scenario)) {
        throw new Error(`Conflicting duplicate checkpoint entry for ${entry.key}`);
      }
      duplicateCount += 1;
      continue;
    }
    records.set(entry.key, entry.scenario);
  }
  if (ignoredTornTail) {
    const validPrefix = raw.slice(0, raw.lastIndexOf('\n') + 1);
    await fs.promises.truncate(filePath, Buffer.byteLength(validPrefix, 'utf8'));
  } else if (!hasFinalNewline) {
    // A crash can lose only the newline while leaving the final JSON object
    // intact. Normalize it before an append so two objects cannot be joined.
    await fs.promises.appendFile(filePath, '\n');
  }
  return { records, duplicateCount, ignoredTornTail };
}

class CheckpointWriter {
  constructor(filePath, syncEvery = 10) {
    this.filePath = filePath;
    this.syncEvery = syncEvery;
    this.pending = 0;
    this.handle = null;
  }

  async open() {
    this.handle = await fs.promises.open(this.filePath, 'a');
  }

  async append(scenario) {
    if (!this.handle) throw new Error('Checkpoint writer is not open.');
    const key = scenarioKey(scenario.district_index, scenario.portfolio_mask);
    await this.handle.writeFile(`${JSON.stringify({ type: 'scenario', key, scenario })}\n`);
    this.pending += 1;
    if (this.pending >= this.syncEvery) {
      await this.handle.datasync();
      this.pending = 0;
    }
  }

  async close() {
    if (!this.handle) return;
    try {
      if (this.pending) await this.handle.datasync();
    } finally {
      await this.handle.close();
      this.handle = null;
    }
  }
}

function bitCount(mask) {
  let value = Number(mask) >>> 0;
  let count = 0;
  while (value) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

function combinations(total, selected) {
  if (!Number.isInteger(total) || !Number.isInteger(selected)
    || selected < 0 || selected > total) return 0;
  const k = Math.min(selected, total - selected);
  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = result * (total - index + 1) / index;
  }
  return result;
}

function maskForSchoolIds(programs, schoolIds) {
  const selected = new Set((schoolIds || []).map(Number));
  return programs.reduce((mask, program, index) => (
    selected.has(Number(program.school_id)) ? mask | (1 << index) : mask
  ), 0) >>> 0;
}

function programsForMask(programs, mask) {
  return programs.filter((_, index) => Number(mask) & (1 << index));
}

function schoolIdForMajor(major) {
  return Number(major?.school_id ?? major?.target?.school_id);
}

function publicProgram(program, index) {
  return {
    program_index: index,
    school_id: Number(program.school_id ?? program.target?.school_id),
    school: program.school ?? program.target?.school ?? null,
    uc_code: program.uc_code ?? null,
    major: program.major ?? program.target?.major ?? null,
    raw_template_hash: program.raw_template_hash ?? null,
    template_fp: program.template_fp ?? null,
    representative_agreement_id: program.representative_agreement_id ?? null,
    representative_community_college_id:
      Number(program.representative_community_college_id) || null,
  };
}

function normalizePrepared(prepared) {
  if (!prepared || !Array.isArray(prepared.pinnedPrograms) || !Array.isArray(prepared.districts)) {
    throw new Error('_prepareDistricts must return { pinnedPrograms, districts }.');
  }
  const programs = prepared.pinnedPrograms.map(publicProgram);
  if (!programs.length || programs.length > 30) throw new Error('Prepared programs are missing or too numerous.');
  const programIds = programs.map((program) => program.school_id);
  if (programIds.some((id) => !Number.isFinite(id)) || new Set(programIds).size !== programIds.length) {
    throw new Error('Prepared programs must have unique numeric school IDs.');
  }
  const codeById = new Map(programs.map((program) => [program.school_id, program.uc_code]));
  const districts = prepared.districts.slice().sort((left, right) =>
    String(left.district).localeCompare(String(right.district))).map((raw, districtIndex) => {
    const supportedMajors = raw.supportedMajors || raw.supported_majors || [];
    const supportedSchoolIds = (raw.supported_school_ids || supportedMajors.map(schoolIdForMajor))
      .map(Number).filter(Number.isFinite);
    const unknown = supportedSchoolIds.filter((id) => !codeById.has(id));
    if (unknown.length) throw new Error(`${raw.district} has unknown supported school IDs: ${unknown.join(', ')}`);
    const unitSystem = raw.unitSystem || raw.unit_system;
    if (!['semester', 'quarter'].includes(unitSystem)) {
      throw new Error(`${raw.district} has an invalid unit system: ${unitSystem}`);
    }
    const memberColleges = raw.member_colleges || raw.memberColleges
      || (raw.colleges || []).map((college) => ({
        id: Number(college.source_id ?? college.id),
        name: college.name,
      }));
    return {
      districtIndex,
      raw,
      district: String(raw.district),
      region: raw.region || null,
      countiesServed: raw.counties_served || raw.countiesServed || [],
      memberColleges,
      unitSystem,
      catalog: raw.catalog,
      supportedMajors,
      majorBySchoolId: new Map(supportedMajors.map((major) => [schoolIdForMajor(major), major])),
      supportedSchoolIds,
      supportedCodes: supportedSchoolIds.map((id) => codeById.get(id)),
      reachableMask: maskForSchoolIds(programs, supportedSchoolIds),
      campusStatus: raw.campus_status || raw.campusStatus || null,
    };
  });
  return { programs, districts };
}

function selectDistricts(districts, filters) {
  if (!filters.length) return districts;
  const lowered = filters.map((value) => String(value).trim().toLocaleLowerCase()).filter(Boolean);
  const selected = districts.filter((district) => lowered.some((needle) =>
    district.district.toLocaleLowerCase().includes(needle)));
  if (!selected.length) throw new Error(`No district matched: ${filters.join(', ')}`);
  return selected;
}

function enumerateJobs({ programs, districts }, options = {}) {
  const selectedDistricts = selectDistricts(districts, options.districts || []);
  const jobs = [];
  for (const district of selectedDistricts) {
    for (let mask = 1; mask < (1 << programs.length); mask += 1) {
      if ((mask & district.reachableMask) !== mask) continue;
      const portfolioSize = bitCount(mask);
      if (options.portfolioSize != null && portfolioSize !== options.portfolioSize) continue;
      const selectedPrograms = programsForMask(programs, mask);
      jobs.push({
        key: scenarioKey(district.districtIndex, mask),
        district,
        portfolioMask: mask,
        portfolioSize,
        schoolIds: selectedPrograms.map((program) => program.school_id),
        codes: selectedPrograms.map((program) => program.uc_code),
      });
    }
  }
  jobs.sort((left, right) => left.district.districtIndex - right.district.districtIndex
    || left.portfolioSize - right.portfolioSize
    || left.portfolioMask - right.portfolioMask);
  return options.limit == null ? jobs : jobs.slice(0, options.limit);
}

function countJobs(jobs) {
  const bySize = {};
  const eligibleDistricts = {};
  for (const job of jobs) {
    bySize[job.portfolioSize] = (bySize[job.portfolioSize] || 0) + 1;
    if (!eligibleDistricts[job.portfolioSize]) eligibleDistricts[job.portfolioSize] = new Set();
    eligibleDistricts[job.portfolioSize].add(job.district.districtIndex);
  }
  return {
    total: jobs.length,
    by_portfolio_size: Object.fromEntries(Object.keys(bySize).sort((a, b) => a - b)
      .map((key) => [key, bySize[key]])),
    eligible_districts_by_size: Object.fromEntries(Object.keys(eligibleDistricts)
      .sort((a, b) => a - b)
      .map((key) => [key, eligibleDistricts[key].size])),
  };
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return 'unknown';
  let seconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  if (hours) return `${hours}h${String(minutes).padStart(2, '0')}m`;
  if (minutes) return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function estimateRemainingMs(remainingBySize, durationsBySize) {
  const allDurations = Object.values(durationsBySize).flat().filter(Number.isFinite);
  const globalMean = allDurations.length
    ? allDurations.reduce((sum, value) => sum + value, 0) / allDurations.length
    : null;
  if (globalMean == null) return null;
  return Object.entries(remainingBySize).reduce((total, [size, count]) => {
    const samples = (durationsBySize[size] || []).filter(Number.isFinite);
    const mean = samples.length
      ? samples.reduce((sum, value) => sum + value, 0) / samples.length
      : globalMean;
    return total + Number(count) * mean;
  }, 0);
}

class ProgressReporter {
  constructor({ jobs, completedScenarios, intervalMs, stream = process.stderr, tty = stream.isTTY }) {
    this.jobs = jobs;
    this.stream = stream;
    this.tty = Boolean(tty);
    this.intervalMs = intervalMs;
    this.startedAt = Date.now();
    this.lastPrintedAt = 0;
    this.completed = 0;
    this.resumed = completedScenarios.length;
    this.sessionCompleted = 0;
    this.statusCounts = {};
    this.durationsBySize = {};
    this.remainingBySize = {};
    for (const job of jobs) this.remainingBySize[job.portfolioSize] = (this.remainingBySize[job.portfolioSize] || 0) + 1;
    for (const scenario of completedScenarios) this.recordScenario(scenario, false);
  }

  recordScenario(scenario, decrement = true) {
    const size = Number(scenario.portfolio_size);
    const duration = Number(scenario.computation?.elapsed_ms);
    if (!this.durationsBySize[size]) this.durationsBySize[size] = [];
    if (Number.isFinite(duration)) {
      this.durationsBySize[size].push(duration);
      if (this.durationsBySize[size].length > 100) this.durationsBySize[size].shift();
    }
    if (decrement || this.remainingBySize[size] > 0) {
      this.remainingBySize[size] = Math.max(0, (this.remainingBySize[size] || 0) - 1);
    }
    this.completed += 1;
    if (decrement) this.sessionCompleted += 1;
    const status = scenario.plan?.status || 'unknown';
    this.statusCounts[status] = (this.statusCounts[status] || 0) + 1;
  }

  line(job, lastDuration = null) {
    const total = this.jobs.length;
    const percent = total ? (100 * this.completed / total).toFixed(1) : '100.0';
    const elapsed = Date.now() - this.startedAt;
    const eta = estimateRemainingMs(this.remainingBySize, this.durationsBySize);
    const rate = elapsed > 0 ? (1000 * this.sessionCompleted / elapsed).toFixed(2) : '0.00';
    const statuses = Object.entries(this.statusCounts).sort().map(([key, value]) => `${key} ${value}`).join(' ');
    const current = job ? `k=${job.portfolioSize} · ${job.district.district} · ${job.codes.join('/')}` : 'finalizing';
    const last = Number.isFinite(lastDuration) ? ` | last ${(lastDuration / 1000).toFixed(1)}s` : '';
    return `[${this.completed}/${total} ${percent}%] ${current}${last} | ${rate} new plans/s | elapsed ${formatDuration(elapsed)} | ETA ~${formatDuration(eta)}${this.resumed ? ` | resumed ${this.resumed}` : ''}${statuses ? ` | ${statuses}` : ''}`;
  }

  print(job, { force = false, lastDuration = null } = {}) {
    const now = Date.now();
    if (!force && now - this.lastPrintedAt < this.intervalMs
      && (!this.tty && this.completed % 25 !== 0)) return;
    const line = this.line(job, lastDuration);
    this.stream.write(this.tty ? `\r\x1b[2K${line}` : `${line}\n`);
    this.lastPrintedAt = now;
  }

  completedScenario(scenario, job) {
    this.recordScenario(scenario, true);
    this.print(job, { force: this.completed === this.jobs.length, lastDuration: scenario.computation.elapsed_ms });
  }

  finish() {
    if (this.tty) this.stream.write('\n');
  }
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

const round1 = (value) => {
  const numeric = finiteNumber(value);
  return numeric == null ? null : +numeric.toFixed(1);
};
const round3 = (value) => {
  const numeric = finiteNumber(value);
  return numeric == null ? null : +numeric.toFixed(3);
};

function percentile(values, probability) {
  const sorted = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * probability;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (at - low);
}

function stats(values) {
  const usable = values.map(finiteNumber).filter((value) => value != null);
  if (!usable.length) {
    return { n: 0, mean: null, median: null, q1: null, q3: null, min: null, max: null };
  }
  return {
    n: usable.length,
    mean: round1(usable.reduce((sum, value) => sum + value, 0) / usable.length),
    median: round1(percentile(usable, 0.5)),
    q1: round1(percentile(usable, 0.25)),
    q3: round1(percentile(usable, 0.75)),
    min: round1(Math.min(...usable)),
    max: round1(Math.max(...usable)),
  };
}

const METRICS = Object.freeze([
  'distinct_courses',
  'semester_equiv_units',
  'academic_years',
]);
const TERM_METRICS = Object.freeze(['min_terms', 'lower_bound_terms', 'upper_bound_terms']);
const EXACT_ONLY = 'exact_only';
const BOUNDED_SENSITIVITY = 'bounded_inclusive_sensitivity';

function resultQuality(scenario, dimension = 'course') {
  const plan = scenario?.plan;
  if (!plan || plan.prerequisite_status !== 'complete'
    || (plan.unresolved_prerequisite_groups || []).length) return 'unusable';
  const courseStatus = plan.course_status;
  if (courseStatus !== 'optimal' && courseStatus !== 'bounded') return 'unusable';
  if (dimension === 'course') return courseStatus === 'optimal' ? 'exact' : 'bounded';
  const scheduleStatus = plan.schedule_status;
  if (scheduleStatus !== 'optimal' && scheduleStatus !== 'bounded') return 'unusable';
  return courseStatus === 'optimal' && scheduleStatus === 'optimal' ? 'exact' : 'bounded';
}

function qualityAccepted(quality, scope) {
  return quality === 'exact' || (scope === BOUNDED_SENSITIVITY && quality === 'bounded');
}

function metricDimension(metric) {
  return metric === 'academic_years' || TERM_METRICS.includes(metric) ? 'schedule' : 'course';
}

function scenarioMetricValue(scenario, metric, scope) {
  if (!qualityAccepted(resultQuality(scenario, metricDimension(metric)), scope)) return null;
  return finiteNumber(scenario.plan?.[metric]);
}

function qualityCoverage(scenarios, scope) {
  return {
    total_scenarios: scenarios.length,
    eligible_course_scenarios: scenarios.filter((scenario) =>
      qualityAccepted(resultQuality(scenario, 'course'), scope)).length,
    eligible_schedule_scenarios: scenarios.filter((scenario) =>
      qualityAccepted(resultQuality(scenario, 'schedule'), scope)).length,
  };
}

function termStatsByUnitSystem(scenarios, scope, summarizeMetric = (rows, metric) =>
  stats(rows.map((scenario) => scenarioMetricValue(scenario, metric, scope)))) {
  return [...new Set(scenarios.map((scenario) => scenario.unit_system).filter(Boolean))]
    .sort().map((unitSystem) => {
      const rows = scenarios.filter((scenario) => scenario.unit_system === unitSystem);
      return {
        unit_system: unitSystem,
        scenario_count: rows.length,
        ...Object.fromEntries(TERM_METRICS.map((metric) => [metric, summarizeMetric(rows, metric)])),
      };
    });
}

function metricStats(scenarios, scope) {
  return {
    coverage: qualityCoverage(scenarios, scope),
    ...Object.fromEntries(METRICS.map((metric) => [
    metric,
    stats(scenarios.map((scenario) => scenarioMetricValue(scenario, metric, scope))),
    ])),
    terms_by_unit_system: termStatsByUnitSystem(scenarios, scope),
  };
}

function districtWeightedStats(scenarios, scope) {
  const byDistrict = new Map();
  for (const scenario of scenarios) {
    if (!byDistrict.has(scenario.district_index)) byDistrict.set(scenario.district_index, []);
    byDistrict.get(scenario.district_index).push(scenario);
  }
  const summarizeMetric = (metric) => {
    const districtMeans = [...byDistrict.values()].map((rows) => {
      const values = rows.map((row) => scenarioMetricValue(row, metric, scope))
        .filter((value) => value != null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
    });
    return stats(districtMeans);
  };
  return {
    coverage: qualityCoverage(scenarios, scope),
    ...Object.fromEntries(METRICS.map((metric) => [metric, summarizeMetric(metric)])),
    terms_by_unit_system: termStatsByUnitSystem(scenarios, scope, (rows, metric) => {
      const districts = new Map();
      for (const row of rows) {
        if (!districts.has(row.district_index)) districts.set(row.district_index, []);
        districts.get(row.district_index).push(row);
      }
      return stats([...districts.values()].map((districtRows) => {
        const values = districtRows.map((row) => scenarioMetricValue(row, metric, scope))
          .filter((value) => value != null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
      }));
    }),
  };
}

function valueOrNull(value) {
  return finiteNumber(value);
}

function difference(left, right) {
  const from = valueOrNull(left);
  const to = valueOrNull(right);
  return from == null || to == null ? null : round1(to - from);
}

function marginalEdges(snapshot) {
  const programByBit = new Map(snapshot.programs.map((program) => [
    1 << Number(program.program_index), program,
  ]));
  const scenarioByKey = new Map(snapshot.scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const districtByIndex = new Map(snapshot.districts.map((district) => [district.district_index, district]));
  const edges = [];
  for (const to of snapshot.scenarios) {
    for (const [bit, program] of programByBit) {
      if (!(to.portfolio_mask & bit)) continue;
      const fromMask = to.portfolio_mask & ~bit;
      const from = fromMask
        ? scenarioByKey.get(scenarioKey(to.district_index, fromMask))
        : null;
      if (fromMask && !from) continue;
      const district = districtByIndex.get(to.district_index);
      const fromPlan = from?.plan || {
        distinct_courses: 0,
        major_course_count: 0,
        prerequisite_course_count: 0,
        semester_equiv_units: 0,
        min_terms: 0,
        lower_bound_terms: 0,
        upper_bound_terms: 0,
        academic_years: 0,
      };
      const fromCourseQuality = from ? resultQuality(from, 'course') : 'exact';
      const toCourseQuality = resultQuality(to, 'course');
      const fromScheduleQuality = from ? resultQuality(from, 'schedule') : 'exact';
      const toScheduleQuality = resultQuality(to, 'schedule');
      edges.push({
        district_index: to.district_index,
        district: district?.district || null,
        reachable_count: district?.reachable_count ?? null,
        unit_system: district?.unit_system || to.unit_system || null,
        from_mask: fromMask,
        from_codes: from?.codes || [],
        added_school_id: program.school_id,
        added_code: program.uc_code,
        to_mask: to.portfolio_mask,
        to_codes: to.codes,
        portfolio_size: to.portfolio_size,
        from_scenario_id: from?.scenario_id || null,
        to_scenario_id: to.scenario_id,
        from_distinct_courses: valueOrNull(fromPlan.distinct_courses),
        to_distinct_courses: valueOrNull(to.plan?.distinct_courses),
        added_courses: difference(fromPlan.distinct_courses, to.plan?.distinct_courses),
        from_semester_equiv_units: valueOrNull(fromPlan.semester_equiv_units),
        to_semester_equiv_units: valueOrNull(to.plan?.semester_equiv_units),
        added_semester_equiv_units:
          difference(fromPlan.semester_equiv_units, to.plan?.semester_equiv_units),
        from_min_terms: valueOrNull(fromPlan.min_terms),
        to_min_terms: valueOrNull(to.plan?.min_terms),
        added_min_terms: difference(fromPlan.min_terms, to.plan?.min_terms),
        from_lower_bound_terms: valueOrNull(fromPlan.lower_bound_terms),
        to_lower_bound_terms: valueOrNull(to.plan?.lower_bound_terms),
        added_lower_bound_terms:
          difference(fromPlan.lower_bound_terms, to.plan?.lower_bound_terms),
        from_academic_years: valueOrNull(fromPlan.academic_years),
        to_academic_years: valueOrNull(to.plan?.academic_years),
        added_academic_years: difference(fromPlan.academic_years, to.plan?.academic_years),
        from_status: from?.plan?.status || 'empty_baseline',
        to_status: to.plan?.status || null,
        from_course_quality: fromCourseQuality,
        to_course_quality: toCourseQuality,
        from_schedule_quality: fromScheduleQuality,
        to_schedule_quality: toScheduleQuality,
      });
    }
  }
  return edges.sort((left, right) => left.district_index - right.district_index
    || left.portfolio_size - right.portfolio_size
    || left.to_mask - right.to_mask
    || left.added_school_id - right.added_school_id);
}

function summarizeMarginals(edges) {
  const edgeAccepted = (row, dimension, scope) =>
    qualityAccepted(row[`from_${dimension}_quality`], scope)
      && qualityAccepted(row[`to_${dimension}_quality`], scope);
  const districtWeighted = (rows, scope) => {
    const courseRows = rows.filter((row) => edgeAccepted(row, 'course', scope));
    const scheduleRows = rows.filter((row) => edgeAccepted(row, 'schedule', scope));
    const byDistrict = new Map();
    for (const row of courseRows) {
      if (!byDistrict.has(row.district_index)) byDistrict.set(row.district_index, []);
      byDistrict.get(row.district_index).push(row);
    }
    const scheduleByDistrict = new Map();
    for (const row of scheduleRows) {
      if (!scheduleByDistrict.has(row.district_index)) scheduleByDistrict.set(row.district_index, []);
      scheduleByDistrict.get(row.district_index).push(row);
    }
    const means = (field) => [...byDistrict.values()].map((districtRows) => {
      const values = districtRows.map((row) => finiteNumber(row[field]))
        .filter((value) => value != null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
    });
    const zeroPercentages = [...byDistrict.values()].map((districtRows) => (
      districtRows.length
        ? 100 * districtRows.filter((row) => row.added_courses === 0).length / districtRows.length
        : NaN
    ));
    return {
      district_count: byDistrict.size,
      added_course_stats: stats(means('added_courses')),
      added_semester_equiv_unit_stats: stats(means('added_semester_equiv_units')),
      schedule_district_count: scheduleByDistrict.size,
      added_academic_year_stats: stats([...scheduleByDistrict.values()].map((districtRows) => {
        const values = districtRows.map((row) => finiteNumber(row.added_academic_years))
          .filter((value) => value != null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
      })),
      zero_course_addition_pct_stats: stats(zeroPercentages),
    };
  };
  const summarize = (rows, scope) => {
    const courseRows = rows.filter((row) => edgeAccepted(row, 'course', scope));
    const scheduleRows = rows.filter((row) => edgeAccepted(row, 'schedule', scope));
    return {
    edge_count: rows.length,
    eligible_course_edge_count: courseRows.length,
    eligible_schedule_edge_count: scheduleRows.length,
    path_weighted: {
      added_course_stats: stats(courseRows.map((row) => row.added_courses)),
      added_semester_equiv_unit_stats:
        stats(courseRows.map((row) => row.added_semester_equiv_units)),
      added_academic_year_stats: stats(scheduleRows.map((row) => row.added_academic_years)),
      zero_course_additions: courseRows.filter((row) => row.added_courses === 0).length,
      zero_course_addition_pct: courseRows.length
        ? round1(100 * courseRows.filter((row) => row.added_courses === 0).length / courseRows.length)
        : null,
    },
    district_weighted: districtWeighted(rows, scope),
    term_deltas_by_unit_system: [...new Set(rows.map((row) => row.unit_system).filter(Boolean))]
      .sort().map((unitSystem) => {
        const allCalendarRows = rows.filter((row) => row.unit_system === unitSystem);
        const calendarRows = allCalendarRows.filter((row) => edgeAccepted(row, 'schedule', scope));
        return {
          unit_system: unitSystem,
          edge_count: allCalendarRows.length,
          eligible_edge_count: calendarRows.length,
          path_weighted_added_min_term_stats:
            stats(calendarRows.map((row) => row.added_min_terms)),
          district_weighted_added_min_term_stats: (() => {
            const groups = new Map();
            for (const row of calendarRows) {
              if (!groups.has(row.district_index)) groups.set(row.district_index, []);
              groups.get(row.district_index).push(row);
            }
            return stats([...groups.values()].map((districtRows) => {
              const values = districtRows.map((row) => finiteNumber(row.added_min_terms))
                .filter((value) => value != null);
              return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
            }));
          })(),
        };
      }),
    };
  };
  const summarizeScopes = (rows) => ({
    [EXACT_ONLY]: summarize(rows, EXACT_ONLY),
    [BOUNDED_SENSITIVITY]: summarize(rows, BOUNDED_SENSITIVITY),
  });
  const bySize = [...new Set(edges.map((edge) => edge.portfolio_size))].sort((a, b) => a - b)
    .map((portfolioSize) => ({
      portfolio_size: portfolioSize,
      ...summarizeScopes(edges.filter((edge) => edge.portfolio_size === portfolioSize)),
    }));
  const campusKeys = [...new Set(edges.map((edge) => `${edge.portfolio_size}|${edge.added_code}`))]
    .sort((left, right) => {
      const [leftSize, leftCode] = left.split('|');
      const [rightSize, rightCode] = right.split('|');
      return Number(leftSize) - Number(rightSize) || leftCode.localeCompare(rightCode);
    });
  const byCampusAndSize = campusKeys.map((key) => {
    const [size, code] = key.split('|');
    const rows = edges.filter((edge) => edge.portfolio_size === Number(size)
      && edge.added_code === code);
    return { portfolio_size: Number(size), added_code: code, ...summarizeScopes(rows) };
  });
  return { by_portfolio_size: bySize, by_added_campus_and_size: byCampusAndSize };
}

function portfolioBalancedStats(scenarios, scope) {
  const byPortfolio = new Map();
  for (const scenario of scenarios) {
    if (!byPortfolio.has(scenario.portfolio_mask)) byPortfolio.set(scenario.portfolio_mask, []);
    byPortfolio.get(scenario.portfolio_mask).push(scenario);
  }
  const summarizeMetric = (metric) => {
    const portfolioMeans = [...byPortfolio.values()].map((rows) => {
      const values = rows.map((row) => scenarioMetricValue(row, metric, scope))
        .filter((value) => value != null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
    });
    return stats(portfolioMeans);
  };
  return {
    coverage: qualityCoverage(scenarios, scope),
    ...Object.fromEntries(METRICS.map((metric) => [metric, summarizeMetric(metric)])),
    terms_by_unit_system: termStatsByUnitSystem(scenarios, scope, (rows, metric) => {
      const portfolios = new Map();
      for (const row of rows) {
        if (!portfolios.has(row.portfolio_mask)) portfolios.set(row.portfolio_mask, []);
        portfolios.get(row.portfolio_mask).push(row);
      }
      return stats([...portfolios.values()].map((portfolioRows) => {
        const values = portfolioRows.map((row) => scenarioMetricValue(row, metric, scope))
          .filter((value) => value != null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
      }));
    }),
  };
}

function submasks(mask) {
  const values = [0];
  for (let subset = mask; subset; subset = (subset - 1) & mask) values.push(subset);
  return values.sort((left, right) => bitCount(left) - bitCount(right) || left - right);
}

const SHAPLEY_METRICS = Object.freeze([
  'distinct_courses',
  'semester_equiv_units',
  'academic_years',
]);

function shapleyAnalysis(snapshot, scope = EXACT_ONLY) {
  const scenarioByKey = new Map(snapshot.scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const programByBit = new Map(snapshot.programs.map((program) => [
    1 << Number(program.program_index), program,
  ]));
  const rows = [];
  const efficiency = [];
  const skippedDistricts = [];
  for (const district of snapshot.districts) {
    const playerBits = [...programByBit.keys()].filter((bit) => district.reachable_mask & bit);
    if (!playerBits.length) continue;
    const expectedMasks = submasks(district.reachable_mask).filter(Boolean);
    if (expectedMasks.some((mask) => !scenarioByKey.has(scenarioKey(district.district_index, mask)))) {
      skippedDistricts.push({
        district_index: district.district_index,
        district: district.district,
        reason: 'incomplete_subset_lattice',
      });
      continue;
    }
    const full = scenarioByKey.get(scenarioKey(district.district_index, district.reachable_mask));
    const districtRows = [];
    for (const bit of playerBits) {
      const program = programByBit.get(bit);
      const otherMask = district.reachable_mask & ~bit;
      const bases = submasks(otherMask);
      const byBaseSize = [];
      const phi = {};
      for (const metric of SHAPLEY_METRICS) {
        const sizeMeans = [];
        for (let baseSize = 0; baseSize < playerBits.length; baseSize += 1) {
          const sameSize = bases.filter((mask) => bitCount(mask) === baseSize);
          const deltas = sameSize.map((baseMask) => {
            const from = baseMask
              ? scenarioMetricValue(
                scenarioByKey.get(scenarioKey(district.district_index, baseMask)),
                metric,
                scope,
              )
              : 0;
            const to = scenarioMetricValue(
              scenarioByKey.get(scenarioKey(district.district_index, baseMask | bit)),
              metric,
              scope,
            );
            return difference(from, to);
          }).filter(Number.isFinite);
          const mean = deltas.length === sameSize.length && deltas.length
            ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
            : null;
          sizeMeans.push(mean);
          let bucket = byBaseSize.find((item) => item.base_size === baseSize);
          if (!bucket) {
            bucket = { base_size: baseSize, coalition_count: sameSize.length };
            byBaseSize.push(bucket);
          }
          bucket[`${metric}_mean_marginal`] = round3(mean);
        }
        phi[metric] = sizeMeans.every(Number.isFinite)
          ? round3(sizeMeans.reduce((sum, value) => sum + value, 0) / playerBits.length)
          : null;
      }
      districtRows.push({
        district_index: district.district_index,
        district: district.district,
        reachable_count: playerBits.length,
        school_id: program.school_id,
        code: program.uc_code,
        weight_per_base_subset_size: round3(1 / playerBits.length),
        shapley: phi,
        by_base_subset_size: byBaseSize,
      });
    }
    rows.push(...districtRows);
    for (const metric of SHAPLEY_METRICS) {
      const contributions = districtRows.map((row) => finiteNumber(row.shapley[metric]));
      const fullValue = scenarioMetricValue(full, metric, scope);
      const sum = contributions.every((value) => value != null)
        ? contributions.reduce((total, value) => total + value, 0)
        : null;
      const residual = sum == null || fullValue == null ? null : round3(sum - fullValue);
      efficiency.push({
        district_index: district.district_index,
        district: district.district,
        metric,
        shapley_sum: round3(sum),
        full_plan_value: fullValue,
        residual,
        passed: residual == null ? null : Math.abs(residual) <= 0.01,
      });
    }
  }
  const aggregateByCampus = (inputRows) => [...new Set(inputRows.map((row) => row.code))]
    .sort().map((code) => {
    const campusRows = inputRows.filter((row) => row.code === code);
    return {
      code,
      district_rows: new Set(campusRows.map((row) => row.district_index)).size,
      ...Object.fromEntries(SHAPLEY_METRICS.map((metric) => [
        `${metric}_shapley_stats`,
        stats(campusRows.map((row) => row.shapley[metric])),
      ])),
    };
  });
  const byCampus = aggregateByCampus(rows);
  const maxReach = Math.max(0, ...snapshot.districts.map((district) => district.reachable_count));
  const balancedRows = rows.filter((row) => row.reachable_count === maxReach);
  return {
    result_scope: scope,
    method: 'For each district and campus, average its marginal addition within each base-coalition size, then weight every base size equally (1/n). This is the permutation-weighted Shapley value, not a uniform average over coalitions.',
    metrics: SHAPLEY_METRICS,
    district_campus_values: rows,
    by_campus_district_weighted: byCampus,
    balanced_max_reach_cohort: {
      reachable_count: maxReach,
      cohort_district_count: new Set(balancedRows.map((row) => row.district_index)).size,
      by_campus_district_weighted: aggregateByCampus(balancedRows),
    },
    efficiency_checks: efficiency,
    efficiency_failure_count: efficiency.filter((row) => row.passed === false).length,
    skipped_districts: skippedDistricts,
  };
}

function overlapSavings(scenario, scenarioByKey, scope = EXACT_ONLY) {
  const singletonValues = [];
  for (let bit = 1; bit <= scenario.portfolio_mask; bit <<= 1) {
    if (!(scenario.portfolio_mask & bit)) continue;
    const singleton = scenarioByKey.get(scenarioKey(scenario.district_index, bit));
    const value = scenarioMetricValue(singleton, 'distinct_courses', scope);
    if (value == null) return null;
    singletonValues.push(value);
  }
  const combined = scenarioMetricValue(scenario, 'distinct_courses', scope);
  return combined == null ? null : round1(singletonValues.reduce((sum, value) => sum + value, 0) - combined);
}

function buildDerived(snapshot, edges) {
  const scenarioByKey = new Map(snapshot.scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const sizes = [...new Set(snapshot.scenarios.map((scenario) => scenario.portfolio_size))]
    .sort((a, b) => a - b);
  const maxReach = Math.max(0, ...snapshot.districts.map((district) => district.reachable_count));
  const maxReachDistricts = new Set(snapshot.districts
    .filter((district) => district.reachable_count === maxReach)
    .map((district) => district.district_index));
  const aggregate = (rows, scope) => ({
    coverage: qualityCoverage(rows, scope),
    path_weighted: metricStats(rows, scope),
    district_weighted: districtWeightedStats(rows, scope),
    overlap_savings_course_stats:
      stats(rows.map((row) => overlapSavings(row, scenarioByKey, scope))),
  });
  const byPortfolioSize = sizes.map((portfolioSize) => {
    const rows = snapshot.scenarios.filter((scenario) => scenario.portfolio_size === portfolioSize);
    return {
      portfolio_size: portfolioSize,
      scenario_count: rows.length,
      district_count: new Set(rows.map((row) => row.district_index)).size,
      [EXACT_ONLY]: aggregate(rows, EXACT_ONLY),
      [BOUNDED_SENSITIVITY]: aggregate(rows, BOUNDED_SENSITIVITY),
    };
  });
  const fixedCohort = sizes.map((portfolioSize) => {
    const rows = snapshot.scenarios.filter((scenario) => scenario.portfolio_size === portfolioSize
      && maxReachDistricts.has(scenario.district_index));
    return {
      portfolio_size: portfolioSize,
      scenario_count: rows.length,
      district_count: new Set(rows.map((row) => row.district_index)).size,
      [EXACT_ONLY]: {
        ...aggregate(rows, EXACT_ONLY),
        portfolio_balanced: portfolioBalancedStats(rows, EXACT_ONLY),
      },
      [BOUNDED_SENSITIVITY]: {
        ...aggregate(rows, BOUNDED_SENSITIVITY),
        portfolio_balanced: portfolioBalancedStats(rows, BOUNDED_SENSITIVITY),
      },
      portfolio_signature_count: new Set(rows.map((row) => row.portfolio_mask)).size,
    };
  });
  const completeGrid = maxReachDistricts.size > 0 && fixedCohort.every((group) => {
    const expectedSignatures = combinations(maxReach, group.portfolio_size);
    return group.portfolio_signature_count === expectedSignatures
      && group.scenario_count === expectedSignatures * maxReachDistricts.size;
  });
  return {
    weighting_note: 'Path-weighted statistics give every district-portfolio path equal weight. District-weighted statistics first average paths within each district, then give districts equal weight.',
    result_scope_note: 'exact_only includes only proven-optimal course results and, for time metrics, proven-optimal schedules. bounded_inclusive_sensitivity additionally includes feasible bounded incumbents. An unavailable or fallback result is excluded from metrics produced by that stage; a non-exact scheduler does not erase a proven course/unit result. Estimated-prerequisite, unresolved, and nonfinite results are excluded from both.',
    by_portfolio_size: byPortfolioSize,
    fixed_max_reach_cohort: {
      reachable_count: maxReach,
      district_count: maxReachDistricts.size,
      complete_balanced_portfolio_grid: completeGrid,
      by_portfolio_size: fixedCohort,
    },
    marginals: summarizeMarginals(edges),
    shapley: {
      [EXACT_ONLY]: shapleyAnalysis(snapshot, EXACT_ONLY),
      [BOUNDED_SENSITIVITY]: shapleyAnalysis(snapshot, BOUNDED_SENSITIVITY),
    },
  };
}

function countStatuses(scenarios, field) {
  const counts = {};
  for (const scenario of scenarios) {
    const status = String(scenario.plan?.[field] || 'unknown');
    counts[status] = (counts[status] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function buildAudit(snapshot) {
  const scenarioByKey = new Map(snapshot.scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  let immediateEdges = 0;
  let comparedFeasibleEdges = 0;
  let violationCount = 0;
  const violations = [];
  let boundedIncumbentImprovementCount = 0;
  const boundedIncumbentImprovements = [];
  const objectiveOptimal = (plan) => plan?.course_status === 'optimal'
    && plan?.prerequisite_status === 'complete';
  const feasible = (plan) => plan && ['optimal', 'bounded'].includes(plan.course_status)
    && plan.prerequisite_status === 'complete'
    && finiteNumber(plan.distinct_courses) != null;
  for (const larger of snapshot.scenarios) {
    for (let bit = 1; bit <= larger.portfolio_mask; bit <<= 1) {
      if (!(larger.portfolio_mask & bit)) continue;
      const smallerMask = larger.portfolio_mask & ~bit;
      const smaller = smallerMask
        ? scenarioByKey.get(scenarioKey(larger.district_index, smallerMask))
        : null;
      if (smallerMask && !smaller) continue;
      immediateEdges += 1;
      const smallerPlan = smaller?.plan || {
        course_status: 'optimal',
        prerequisite_status: 'complete',
        distinct_courses: 0,
        native_units: 0,
      };
      if (!feasible(smallerPlan) || !feasible(larger.plan)) continue;
      comparedFeasibleEdges += 1;
      const smallCourses = valueOrNull(smallerPlan.distinct_courses);
      const largeCourses = valueOrNull(larger.plan.distinct_courses);
      const smallUnits = valueOrNull(smallerPlan.native_units);
      const largeUnits = valueOrNull(larger.plan.native_units);
      let reason = null;
      if (smallCourses > largeCourses) reason = 'course_count_decreased';
      else if (smallCourses === largeCourses && smallUnits != null
        && largeUnits != null && smallUnits > largeUnits + 0.05) {
        reason = 'tie_break_units_decreased';
      }
      if (!reason) continue;
      const finding = {
        district_index: larger.district_index,
        smaller: smaller?.scenario_id || `${larger.district_index}:0`,
        larger: larger.scenario_id,
        smaller_course_status: smallerPlan.course_status,
        larger_course_status: larger.plan.course_status,
        smaller_courses: smallCourses,
        larger_courses: largeCourses,
        smaller_native_units: smallUnits,
        larger_native_units: largeUnits,
        reason,
      };
      if (objectiveOptimal(smallerPlan)) {
        violationCount += 1;
        if (violations.length < 250) violations.push(finding);
      } else {
        boundedIncumbentImprovementCount += 1;
        if (boundedIncumbentImprovements.length < 250) boundedIncumbentImprovements.push(finding);
      }
    }
  }
  const suspicious = snapshot.scenarios.filter((scenario) => scenario.plan?.status !== 'optimal'
    || scenario.plan?.course_status !== 'optimal'
    || scenario.plan?.prerequisite_status !== 'complete'
    || scenario.plan?.schedule_status !== 'optimal'
    || (scenario.plan?.unresolved_prerequisite_groups || []).length);
  const bySize = [...new Set(snapshot.scenarios.map((scenario) => scenario.portfolio_size))]
    .sort((a, b) => a - b).map((portfolioSize) => {
      const rows = snapshot.scenarios.filter((scenario) => scenario.portfolio_size === portfolioSize);
      return {
        portfolio_size: portfolioSize,
        scenarios: rows.length,
        plan_status_counts: countStatuses(rows, 'status'),
        course_status_counts: countStatuses(rows, 'course_status'),
        prerequisite_status_counts: countStatuses(rows, 'prerequisite_status'),
        schedule_status_counts: countStatuses(rows, 'schedule_status'),
        role_attribution_status_counts: countStatuses(rows, 'role_attribution_status'),
      };
    });
  const expectedImmediateEdges = snapshot.canonical
    ? snapshot.districts.reduce((sum, district) => {
      const reachable = Number(district.reachable_count);
      return sum + (reachable ? reachable * (2 ** (reachable - 1)) : 0);
    }, 0)
    : null;
  return {
    structural_checks: 'passed',
    plan_status_counts: countStatuses(snapshot.scenarios, 'status'),
    course_status_counts: countStatuses(snapshot.scenarios, 'course_status'),
    prerequisite_status_counts: countStatuses(snapshot.scenarios, 'prerequisite_status'),
    schedule_status_counts: countStatuses(snapshot.scenarios, 'schedule_status'),
    role_attribution_status_counts: countStatuses(snapshot.scenarios, 'role_attribution_status'),
    by_portfolio_size: bySize,
    monotonicity: {
      method: 'Immediate subset-addition edges. An exact closed-course optimum is compared with every feasible superset incumbent, including bounded incumbents because each remains a valid upper bound.',
      immediate_edges: immediateEdges,
      expected_immediate_edges_from_district_reachability: expectedImmediateEdges,
      complete_immediate_edge_lattice:
        expectedImmediateEdges == null ? null : immediateEdges === expectedImmediateEdges,
      feasible_edges_compared: comparedFeasibleEdges,
      violation_count: violationCount,
      violations,
      truncated: violationCount > violations.length,
      bounded_incumbent_improvement_count: boundedIncumbentImprovementCount,
      bounded_incumbent_improvements: boundedIncumbentImprovements,
      bounded_list_truncated:
        boundedIncumbentImprovementCount > boundedIncumbentImprovements.length,
    },
    suspicious_plan_count: suspicious.length,
    suspicious_scenario_ids: suspicious.slice(0, 500).map((scenario) => scenario.scenario_id),
    suspicious_list_truncated: suspicious.length > 500,
  };
}

function csvCell(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, fields) {
  return `${[
    fields.map(csvCell).join(','),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(',')),
  ].join('\n')}\n`;
}

function summaryCsv(snapshot) {
  const districtByIndex = new Map(snapshot.districts.map((district) => [district.district_index, district]));
  const scenarioByKey = new Map(snapshot.scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const rows = snapshot.scenarios.map((scenario) => {
    const district = districtByIndex.get(scenario.district_index);
    return {
      scenario_id: scenario.scenario_id,
      district_index: scenario.district_index,
      district: district.district,
      region: district.region,
      unit_system: district.unit_system,
      reachable_count: district.reachable_count,
      reachable_codes: district.reachable_codes,
      portfolio_mask: scenario.portfolio_mask,
      portfolio_size: scenario.portfolio_size,
      portfolio_codes: scenario.codes,
      status: scenario.plan.status,
      course_status: scenario.plan.course_status,
      prerequisite_status: scenario.plan.prerequisite_status,
      schedule_status: scenario.plan.schedule_status,
      role_attribution_status: scenario.plan.role_attribution_status,
      course_result_quality: resultQuality(scenario, 'course'),
      schedule_result_quality: resultQuality(scenario, 'schedule'),
      distinct_courses: scenario.plan.distinct_courses,
      major_course_count: scenario.plan.major_course_count,
      prerequisite_course_count: scenario.plan.prerequisite_course_count,
      colleges_used: scenario.plan.colleges_used,
      semester_equiv_units: scenario.plan.semester_equiv_units,
      min_terms: scenario.plan.min_terms,
      lower_bound_terms: scenario.plan.lower_bound_terms,
      upper_bound_terms: scenario.plan.upper_bound_terms,
      academic_years: scenario.plan.academic_years,
      exact_only_overlap_savings_courses:
        overlapSavings(scenario, scenarioByKey, EXACT_ONLY),
      bounded_sensitivity_overlap_savings_courses:
        overlapSavings(scenario, scenarioByKey, BOUNDED_SENSITIVITY),
      computation_elapsed_ms: scenario.computation?.elapsed_ms,
    };
  });
  return toCsv(rows, [
    'scenario_id', 'district_index', 'district', 'region', 'unit_system',
    'reachable_count', 'reachable_codes', 'portfolio_mask', 'portfolio_size',
    'portfolio_codes', 'status', 'course_status', 'prerequisite_status',
    'schedule_status', 'role_attribution_status', 'course_result_quality',
    'schedule_result_quality', 'distinct_courses', 'major_course_count',
    'prerequisite_course_count', 'colleges_used', 'semester_equiv_units',
    'min_terms', 'lower_bound_terms', 'upper_bound_terms', 'academic_years',
    'exact_only_overlap_savings_courses', 'bounded_sensitivity_overlap_savings_courses',
    'computation_elapsed_ms',
  ]);
}

function marginalsCsv(edges) {
  return toCsv(edges, [
    'district_index', 'district', 'reachable_count', 'unit_system', 'from_mask', 'from_codes',
    'added_school_id', 'added_code', 'to_mask', 'to_codes', 'portfolio_size',
    'from_scenario_id', 'to_scenario_id', 'from_distinct_courses',
    'to_distinct_courses', 'added_courses', 'from_semester_equiv_units',
    'to_semester_equiv_units', 'added_semester_equiv_units', 'from_min_terms',
    'to_min_terms', 'added_min_terms', 'from_lower_bound_terms',
    'to_lower_bound_terms', 'added_lower_bound_terms', 'from_status', 'to_status',
    'from_academic_years', 'to_academic_years', 'added_academic_years',
    'from_course_quality', 'to_course_quality', 'from_schedule_quality',
    'to_schedule_quality',
  ]);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid district portfolio artifact: ${message}`);
}

function validatePlan(plan, scenario, generationParameters) {
  assert(plan && typeof plan === 'object', `${scenario.scenario_id} has no plan`);
  assert(Array.isArray(plan.courses), `${scenario.scenario_id} courses must be an array`);
  const courseIds = plan.courses.map((course) => String(course.course_id));
  assert(new Set(courseIds).size === courseIds.length,
    `${scenario.scenario_id} contains duplicate course IDs`);
  assert(finiteNumber(plan.distinct_courses) === courseIds.length,
    `${scenario.scenario_id} distinct_courses does not match courses`);
  const majorCount = plan.courses.filter((course) => course.role === 'major_preparation').length;
  const prerequisiteCount = plan.courses.filter((course) => course.role === 'prerequisite_only').length;
  assert(finiteNumber(plan.major_course_count) === majorCount,
    `${scenario.scenario_id} major_course_count does not match course roles`);
  assert(finiteNumber(plan.prerequisite_course_count) === prerequisiteCount,
    `${scenario.scenario_id} prerequisite_course_count does not match course roles`);
  assert(majorCount + prerequisiteCount === courseIds.length,
    `${scenario.scenario_id} has an unknown course role`);
  const collegeIds = new Set(plan.courses.map((course) => finiteNumber(course.community_college_id))
    .filter((value) => value != null));
  assert(finiteNumber(plan.colleges_used) === collegeIds.size,
    `${scenario.scenario_id} colleges_used does not match courses`);
  const selectedCollegeIds = (plan.selected_college_ids || []).map(finiteNumber)
    .filter((value) => value != null);
  assert(selectedCollegeIds.length === collegeIds.size
    && selectedCollegeIds.every((id) => collegeIds.has(id)),
  `${scenario.scenario_id} selected_college_ids does not match courses`);
  const courseUnits = plan.courses.map((course) => finiteNumber(course.native_units));
  const planNativeUnits = finiteNumber(plan.native_units);
  if (courseUnits.every((value) => value != null) && planNativeUnits != null) {
    const sum = courseUnits.reduce((total, value) => total + value, 0);
    assert(Math.abs(sum - planNativeUnits) < 0.11,
      `${scenario.scenario_id} native_units does not match courses`);
  }
  assert(Array.isArray(plan.terms), `${scenario.scenario_id} terms must be an array`);
  if (plan.terms.length) {
    const scheduledIds = plan.terms.flatMap((term) => (term.course_ids || []).map(String));
    assert(scheduledIds.length === courseIds.length
      && new Set(scheduledIds).size === scheduledIds.length
      && scheduledIds.every((id) => courseIds.includes(id)),
    `${scenario.scenario_id} terms do not cover every course exactly once`);
    const termByCourse = new Map(plan.terms.flatMap((term) =>
      (term.course_ids || []).map((id) => [String(id), Number(term.index)])));
    for (const course of plan.courses) {
      assert(Number(course.modeled_term) === termByCourse.get(String(course.course_id)),
        `${scenario.scenario_id} modeled_term does not match terms for ${course.course_id}`);
      for (const prerequisiteId of course.prerequisite_ids || []) {
        if (!termByCourse.has(String(prerequisiteId))) continue;
        assert(termByCourse.get(String(prerequisiteId)) < termByCourse.get(String(course.course_id)),
          `${scenario.scenario_id} schedules prerequisite ${prerequisiteId} too late`);
      }
    }
    for (const term of plan.terms) {
      const termUnits = finiteNumber(term.units);
      assert(termUnits != null
        && termUnits <= Number(generationParameters.native_load) + 0.11,
        `${scenario.scenario_id} exceeds the native unit cap in term ${term.index}`);
    }
  }
}

function validateSnapshot(snapshot, { verifyFingerprint = true } = {}) {
  assert(snapshot && typeof snapshot === 'object', 'root must be an object');
  assert(snapshot.schema_version === SCHEMA_VERSION, 'unsupported schema_version');
  assert(snapshot.method_id === METHOD_ID, 'unexpected method_id');
  assert(!Number.isNaN(Date.parse(snapshot.generated_at)), 'generated_at must be an ISO date');
  assert(typeof snapshot.source_fingerprint === 'string'
    && /^[a-f0-9]{64}$/.test(snapshot.source_fingerprint),
  'source_fingerprint must be sha256');
  assert(snapshot.analysis_source?.algorithm === 'sha256'
    && /^[a-f0-9]{64}$/.test(snapshot.analysis_source?.combined_sha256 || '')
    && Array.isArray(snapshot.analysis_source?.files)
    && snapshot.analysis_source.files.every((entry) =>
      typeof entry.path === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256 || '')),
  'analysis_source must contain a sha256 source manifest');
  assert(snapshot.analysis_source.combined_sha256
    === fingerprint(snapshot.analysis_source.files),
  'analysis_source combined_sha256 does not match its file manifest');
  assert(Number.isSafeInteger(snapshot.generation_parameters?.optimizer_max_states)
    && snapshot.generation_parameters.optimizer_max_states > 0,
  'optimizer_max_states must be a positive safe integer');
  assert(Array.isArray(snapshot.programs) && snapshot.programs.length >= 1, 'programs must be nonempty');
  assert(Array.isArray(snapshot.districts), 'districts must be an array');
  assert(Array.isArray(snapshot.scenarios), 'scenarios must be an array');
  if (snapshot.canonical) {
    assert(snapshot.programs.length === 9, 'canonical artifact must retain nine pinned programs');
    assert(snapshot.districts.length === 72, 'canonical artifact must retain all 72 districts');
  }
  assert(snapshot.scenario_counts?.total === snapshot.scenarios.length,
    'scenario_counts.total does not match scenarios');
  const programIds = snapshot.programs.map((program) => Number(program.school_id));
  assert(new Set(programIds).size === programIds.length, 'program school IDs must be unique');
  assert(snapshot.programs.every((program, index) => program.program_index === index),
    'program_index must match canonical program order');
  const districtByIndex = new Map(snapshot.districts.map((district) => [
    Number(district.district_index), district,
  ]));
  assert(districtByIndex.size === snapshot.districts.length, 'district indices must be unique');
  for (const [index, district] of snapshot.districts.entries()) {
    assert(index === 0
      || snapshot.districts[index - 1].district_index < district.district_index,
    'districts must remain in canonical district_index order');
    if (snapshot.canonical) {
      assert(district.district_index === index, 'canonical district_index must be contiguous');
    }
    assert(district.reachable_count === bitCount(district.reachable_mask),
      `${district.district} reachable_count does not match its mask`);
    const reachablePrograms = programsForMask(snapshot.programs, district.reachable_mask);
    assert(stableSerialize(district.reachable_school_ids)
      === stableSerialize(reachablePrograms.map((program) => program.school_id)),
    `${district.district} reachable_school_ids do not match its mask`);
    assert(stableSerialize(district.reachable_codes)
      === stableSerialize(reachablePrograms.map((program) => program.uc_code)),
    `${district.district} reachable_codes do not match its mask`);
  }
  const seen = new Set();
  let previousOrder = null;
  for (const scenario of snapshot.scenarios) {
    const key = scenarioKey(scenario.district_index, scenario.portfolio_mask);
    assert(scenario.scenario_id === key, `${key} has an invalid scenario_id`);
    assert(!seen.has(key), `duplicate scenario ${key}`);
    seen.add(key);
    const district = districtByIndex.get(Number(scenario.district_index));
    assert(district, `${key} references an unknown district`);
    assert(Number.isInteger(scenario.portfolio_mask) && scenario.portfolio_mask > 0,
      `${key} has an invalid portfolio mask`);
    assert((scenario.portfolio_mask & ~district.reachable_mask) === 0,
      `${key} is not a subset of district reachability`);
    assert(scenario.portfolio_size === bitCount(scenario.portfolio_mask),
      `${key} has the wrong portfolio size`);
    const expectedPrograms = programsForMask(snapshot.programs, scenario.portfolio_mask);
    assert(stableSerialize(scenario.school_ids) === stableSerialize(expectedPrograms.map((row) => row.school_id)),
      `${key} school_ids do not match its mask`);
    assert(stableSerialize(scenario.codes) === stableSerialize(expectedPrograms.map((row) => row.uc_code)),
      `${key} codes do not match its mask`);
    assert(scenario.unit_system === district.unit_system,
      `${key} unit_system does not match its district`);
    const order = [Number(scenario.district_index), Number(scenario.portfolio_size), Number(scenario.portfolio_mask)];
    if (previousOrder) {
      const ordered = previousOrder[0] < order[0]
        || (previousOrder[0] === order[0] && previousOrder[1] < order[1])
        || (previousOrder[0] === order[0] && previousOrder[1] === order[1]
          && previousOrder[2] < order[2]);
      assert(ordered, `scenarios are not in deterministic order near ${key}`);
    }
    previousOrder = order;
    validatePlan(scenario.plan, scenario, snapshot.generation_parameters);
  }
  const counted = countJobs(snapshot.scenarios.map((scenario) => ({
    portfolioSize: scenario.portfolio_size,
    district: { districtIndex: scenario.district_index },
  })));
  assert(stableSerialize(counted) === stableSerialize(snapshot.scenario_counts),
    'scenario_counts do not match scenario rows');
  assert(snapshot.derived && typeof snapshot.derived === 'object', 'derived summaries are missing');
  assert(Array.isArray(snapshot.derived.by_portfolio_size)
    && snapshot.derived.by_portfolio_size.every((group) =>
      group?.[EXACT_ONLY] && group?.[BOUNDED_SENSITIVITY])
    && snapshot.derived.shapley?.[EXACT_ONLY]
    && snapshot.derived.shapley?.[BOUNDED_SENSITIVITY],
  'derived summaries must separate exact-only and bounded sensitivity results');
  assert(snapshot.audit && typeof snapshot.audit === 'object', 'audit is missing');
  if (verifyFingerprint) {
    assert(typeof snapshot.artifact_fingerprint === 'string'
      && /^[a-f0-9]{64}$/.test(snapshot.artifact_fingerprint),
    'artifact_fingerprint must be sha256');
    const { artifact_fingerprint: installed, ...unsigned } = snapshot;
    assert(installed === fingerprint(unsigned), 'artifact_fingerprint does not match contents');
  }
  return snapshot;
}

function strictIssues(snapshot) {
  const issues = [];
  if (snapshot.audit.monotonicity?.violation_count) {
    issues.push(`${snapshot.audit.monotonicity.violation_count} exact nested-plan monotonicity violations`);
  }
  if (snapshot.derived?.shapley?.exact_only?.efficiency_failure_count) {
    issues.push(`${snapshot.derived.shapley.exact_only.efficiency_failure_count} exact-only Shapley efficiency failures`);
  }
  if (snapshot.canonical && snapshot.audit.monotonicity?.complete_immediate_edge_lattice === false) {
    issues.push('incomplete immediate-edge lattice');
  }
  for (const [field, label] of [
    ['status', 'plan'],
    ['course_status', 'course'],
    ['prerequisite_status', 'prerequisite'],
    ['schedule_status', 'schedule'],
  ]) {
    const accepted = field === 'prerequisite_status' ? 'complete' : 'optimal';
    const count = snapshot.scenarios.filter((scenario) => scenario.plan?.[field] !== accepted).length;
    if (count) issues.push(`${count} non-${accepted} ${label} results`);
  }
  const unresolved = snapshot.scenarios.filter((scenario) =>
    (scenario.plan?.unresolved_prerequisite_groups || []).length).length;
  if (unresolved) issues.push(`${unresolved} plans with unresolved prerequisite groups`);
  return issues;
}

function publicDistrict(district) {
  return {
    district_index: district.districtIndex,
    district: district.district,
    region: district.region,
    counties_served: district.countiesServed,
    unit_system: district.unitSystem,
    member_colleges: district.memberColleges,
    reachable_mask: district.reachableMask,
    reachable_count: district.supportedSchoolIds.length,
    reachable_school_ids: district.supportedSchoolIds,
    reachable_codes: district.supportedCodes,
    campus_status: district.campusStatus,
  };
}

function checkpointHeader({
  sourceFingerprint,
  analysisCodeFingerprint,
  plannerMethodId,
  generationParameters,
  filters,
  programs,
  districts,
  jobs,
}) {
  if (!/^[a-f0-9]{64}$/.test(String(sourceFingerprint || ''))
    || !/^[a-f0-9]{64}$/.test(String(analysisCodeFingerprint || ''))) {
    throw new Error('Checkpoint compatibility requires source and analysis-code SHA-256 fingerprints.');
  }
  const compatibility = {
    checkpoint_schema_version: CHECKPOINT_SCHEMA_VERSION,
    artifact_schema_version: SCHEMA_VERSION,
    method_id: METHOD_ID,
    planner_method_id: plannerMethodId,
    source_fingerprint: sourceFingerprint,
    analysis_code_fingerprint: analysisCodeFingerprint,
    generation_parameters: generationParameters,
    filters,
    program_ids: programs.map((program) => program.school_id),
    district_keys: districts.map((district) => `${district.districtIndex}:${district.district}`),
    job_keys_fingerprint: fingerprint(jobs.map((job) => job.key)),
  };
  return { type: 'header', ...compatibility, run_fingerprint: fingerprint(compatibility) };
}

function buildScenario(job, plan, elapsedMs) {
  return {
    scenario_id: job.key,
    district_index: job.district.districtIndex,
    portfolio_mask: job.portfolioMask,
    portfolio_size: job.portfolioSize,
    school_ids: job.schoolIds,
    codes: job.codes,
    unit_system: job.district.unitSystem,
    plan,
    computation: { elapsed_ms: elapsedMs },
  };
}

function plannerHelpers() {
  const prepareDistricts = districtPlanner._prepareDistricts
    || districtPlanner.prepareDistricts
    || districtPlanner._prepareDistrictContexts;
  const buildPlan = districtPlanner._buildPlan || districtPlanner.buildPlan;
  if (typeof prepareDistricts !== 'function' || typeof buildPlan !== 'function') {
    throw new Error('districtPathwayPlanner must export _prepareDistricts and _buildPlan.');
  }
  return { prepareDistricts, buildPlan };
}

function generationFilters(options) {
  return {
    districts: options.districts.slice().sort(),
    portfolio_size: options.portfolioSize,
    limit: options.limit,
  };
}

function isCanonical(options) {
  return options.districts.length === 0 && options.portfolioSize == null && options.limit == null;
}

function sourceFingerprint(context, generationParameters, analysisCodeFingerprint) {
  return fingerprint({
    method_id: METHOD_ID,
    planner_method_id: districtPlanner.METHOD_ID,
    planner_source_fingerprint: context.sourceFingerprint,
    analysis_code_fingerprint: analysisCodeFingerprint,
    program_pins: programPins,
    generation_parameters: generationParameters,
  });
}

async function connectAndPrepare(options) {
  const uri = process.env.MONGO_URI || process.env.TARGET_MONGO_URI;
  if (!uri) throw new Error('MONGO_URI or TARGET_MONGO_URI is required');
  const auditUri = process.env.AUDIT_MONGO_URI || uri;
  const dbName = process.env.DB_NAME || process.env.TARGET_DB_NAME || 'pmt_research';
  const client = await MongoClient.connect(uri, { compressors: ['zlib'] });
  const auditClient = auditUri === uri
    ? client
    : await MongoClient.connect(auditUri, { compressors: ['zlib'] });
  try {
    const db = client.db(dbName);
    const auditDb = auditClient.db(dbName);
    process.stderr.write('Loading pinned ASSIST programs, agreements, catalogs, and prerequisites...\n');
    const context = await districtPlanner.loadDistrictPathwayContext(db, auditDb);
    const { prepareDistricts } = plannerHelpers();
    process.stderr.write('Preparing district-pooled articulation choices once...\n');
    const prepared = normalizePrepared(prepareDistricts(context, {
      nativeLoad: options.nativeLoad,
      optimizerBudgetMs: options.optimizerBudgetMs,
      optimizerMaxStates: options.optimizerMaxStates,
      scheduleBudgetMs: options.scheduleBudgetMs,
      includeBlockers: false,
    }));
    return { context, prepared };
  } finally {
    if (auditClient !== client) await auditClient.close();
    await client.close();
  }
}

function workPlan(prepared, options, sourceFp, analysisCodeFingerprint, generationParameters) {
  const jobs = enumerateJobs(prepared, options);
  if (!jobs.length) throw new Error('The selected filters produce no district-portfolio scenarios.');
  const filters = generationFilters(options);
  // District metadata is a reachability denominator, not merely a lookup table
  // for rows with scenarios. Preserve zero-reach districts in canonical runs.
  const selectedDistricts = selectDistricts(prepared.districts, options.districts || []);
  const header = checkpointHeader({
    sourceFingerprint: sourceFp,
    analysisCodeFingerprint,
    plannerMethodId: districtPlanner.METHOD_ID,
    generationParameters,
    filters,
    programs: prepared.programs,
    districts: selectedDistricts,
    jobs,
  });
  const checkpoint = options.checkpoint
    || `${options.output}.${header.run_fingerprint.slice(0, 12)}.checkpoint.ndjson`;
  return {
    jobs,
    filters,
    selectedDistricts,
    header,
    checkpoint,
    counts: countJobs(jobs),
  };
}

function assertSafeOutput(options) {
  if (!isCanonical(options) && !options.outputExplicit && !options.dryRun) {
    throw new Error('Filtered or limited generation requires an explicit --output path.');
  }
}

async function checkArtifact(filePath, { strict = false } = {}) {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const snapshot = validateSnapshot(JSON.parse(raw));
  const issues = strictIssues(snapshot);
  if (strict && issues.length) throw new Error(`Strict validation failed: ${issues.join('; ')}`);
  const result = {
    ok: true,
    strict,
    path: path.resolve(filePath),
    generated_at: snapshot.generated_at,
    source_fingerprint: snapshot.source_fingerprint,
    analysis_code_fingerprint: snapshot.analysis_source.combined_sha256,
    artifact_fingerprint: snapshot.artifact_fingerprint,
    canonical: snapshot.canonical,
    districts: snapshot.districts.length,
    scenarios: snapshot.scenarios.length,
    scenario_counts: snapshot.scenario_counts,
    status_counts: snapshot.audit.plan_status_counts,
    monotonicity_violations: snapshot.audit.monotonicity.violation_count,
    strict_issues: issues,
    bytes: Buffer.byteLength(raw),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return snapshot;
}

async function generate(options) {
  assertSafeOutput(options);
  const generationParameters = {
    native_load: options.nativeLoad,
    optimizer_budget_ms: options.optimizerBudgetMs,
    optimizer_max_states: options.optimizerMaxStates,
    schedule_budget_ms: options.scheduleBudgetMs,
  };
  const { context, prepared } = await connectAndPrepare(options);
  const analysisSource = LOADED_ANALYSIS_SOURCE;
  const sourceFp = sourceFingerprint(
    context,
    generationParameters,
    analysisSource.combined_sha256,
  );
  const work = workPlan(
    prepared,
    options,
    sourceFp,
    analysisSource.combined_sha256,
    generationParameters,
  );
  const worstCaseMs = work.jobs.length
    * (options.optimizerBudgetMs + options.scheduleBudgetMs + 2000);
  const planReport = {
    canonical: isCanonical(options),
    source_fingerprint: sourceFp,
    analysis_code_fingerprint: analysisSource.combined_sha256,
    programs: prepared.programs.length,
    selected_districts: work.selectedDistricts.length,
    scenario_counts: work.counts,
    generation_parameters: generationParameters,
    configured_worst_case_stage_time: formatDuration(worstCaseMs),
    worst_case_stage_note: 'Includes the configured joint optimizer and scheduler time budgets plus capped 1s direct-seed and 1s role-attribution stages per scenario; the optimizer state cap is an independent early-stop condition. Corpus loading and I/O are additional.',
    output: options.output,
    summary_csv: options.summaryCsv,
    marginal_csv: options.marginalCsv,
    checkpoint: work.checkpoint,
    filters: work.filters,
  };
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify({ ok: true, dry_run: true, ...planReport }, null, 2)}\n`);
    return { dryRun: true, plan: planReport };
  }
  process.stderr.write(`${JSON.stringify(planReport, null, 2)}\n`);
  const checkpoint = await loadCheckpoint(work.checkpoint, work.header);
  const resumedScenarioCount = checkpoint.records.size;
  const jobByKey = new Map(work.jobs.map((job) => [job.key, job]));
  for (const [key, scenario] of checkpoint.records) {
    if (!jobByKey.has(key)) throw new Error(`Checkpoint contains unplanned scenario ${key}.`);
    validatePlan(scenario.plan, scenario, generationParameters);
  }
  process.stderr.write(
    `Resuming with ${checkpoint.records.size}/${work.jobs.length} scenarios complete`
      + `${checkpoint.ignoredTornTail ? ' (ignored one torn final line)' : ''}.\n`,
  );
  const reporter = new ProgressReporter({
    jobs: work.jobs,
    completedScenarios: [...checkpoint.records.values()],
    intervalMs: options.progressIntervalMs,
  });
  reporter.print(work.jobs.find((job) => !checkpoint.records.has(job.key)) || null, { force: true });
  const writer = new CheckpointWriter(work.checkpoint);
  await writer.open();
  let stopRequested = false;
  let stopSignal = null;
  const requestStop = (signal) => {
    stopRequested = true;
    stopSignal = signal;
    process.stderr.write(`\n${signal} received; the current plan will be checkpointed before stopping.\n`);
  };
  const onSigint = () => requestStop('SIGINT');
  const onSigterm = () => requestStop('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    const { buildPlan } = plannerHelpers();
    for (const job of work.jobs) {
      if (checkpoint.records.has(job.key)) continue;
      reporter.print(job);
      const selectedMajors = job.schoolIds.map((schoolId) => job.district.majorBySchoolId.get(schoolId));
      if (selectedMajors.some((major) => !major)) {
        throw new Error(`${job.key} cannot resolve every selected supported major.`);
      }
      const startedAt = Date.now();
      const plan = buildPlan({
        context,
        district: job.district.raw,
        supportedMajors: selectedMajors,
        catalog: job.district.catalog,
        unitSystem: job.district.unitSystem,
        params: {
          nativeLoad: options.nativeLoad,
          optimizerBudgetMs: options.optimizerBudgetMs,
          optimizerMaxStates: options.optimizerMaxStates,
          scheduleBudgetMs: options.scheduleBudgetMs,
        },
      });
      const scenario = buildScenario(job, plan, Date.now() - startedAt);
      validatePlan(scenario.plan, scenario, generationParameters);
      await writer.append(scenario);
      checkpoint.records.set(job.key, scenario);
      reporter.completedScenario(scenario, job);
      if (stopRequested) break;
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    await writer.close();
    reporter.finish();
  }
  if (stopRequested) {
    process.stderr.write(
      `Stopped after ${checkpoint.records.size}/${work.jobs.length}; resume with the same command.\n`,
    );
    return { interrupted: true, signal: stopSignal, completed: checkpoint.records.size };
  }
  assert(checkpoint.records.size === work.jobs.length,
    `checkpoint has ${checkpoint.records.size}/${work.jobs.length} completed jobs`);
  const scenarios = work.jobs.map((job) => checkpoint.records.get(job.key));
  const snapshot = {
    schema_version: SCHEMA_VERSION,
    method_id: METHOD_ID,
    generated_at: new Date().toISOString(),
    canonical: isCanonical(options),
    source_fingerprint: sourceFp,
    analysis_source: analysisSource,
    generation_parameters: generationParameters,
    filters: work.filters,
    method: {
      id: METHOD_ID,
      planner_method_id: districtPlanner.METHOD_ID,
      target: 'Every nonempty subset of each district\'s strictly reachable pinned UC computer science programs.',
      district_pooling: 'Complete articulation paths may come from any member college; path components are not split across colleges.',
      course_objective: 'Jointly minimize the complete prerequisite-closed actual course set, then its native units, for every selected campus portfolio.',
      weighting: 'The artifact preserves one row per real district-portfolio path so path-weighted and district-weighted summaries remain independently derivable.',
    },
    warnings: [
      'Major preparation only; general education, admission, degree, seat, timetable-conflict, and post-transfer requirements are outside this model.',
      'District plans assume students can cross-enroll at any member college.',
      'Schedules assume every selected course is offered every regular term without timetable conflicts.',
      'The prerequisite graph is a normative concept-matched model, not a complete empirical transcription of every college catalog; modeled sequencing can therefore differ from a local catalog.',
      'Cross-listed same_as identities are one physical completion and receive the union of modeled prerequisite obligations across their aliases, preventing an alias choice from erasing a known prerequisite.',
      'Major-preparation versus prerequisite-only roles are an explanatory partition inside the fixed joint plan. Consult role_attribution_status before interpreting that split; total distinct courses are the primary optimized outcome.',
      'Path-weighted summaries overrepresent districts with more reachable campus combinations; district-weighted summaries are reported separately.',
      'Derived paper-facing summaries are exact-only. A separately labeled bounded-inclusive sensitivity includes feasible bounded incumbents; unavailable, fallback, estimated-prerequisite, and unresolved results enter neither.',
    ],
    programs: prepared.programs,
    districts: work.selectedDistricts.map(publicDistrict),
    scenario_counts: work.counts,
    scenarios,
  };
  const edges = marginalEdges(snapshot);
  snapshot.derived = buildDerived(snapshot, edges);
  snapshot.audit = buildAudit(snapshot);
  const summaryText = summaryCsv(snapshot);
  const marginalText = marginalsCsv(edges);
  snapshot.companion_artifacts = {
    summary_csv: {
      filename: path.basename(options.summaryCsv),
      rows: snapshot.scenarios.length,
      sha256: createHash('sha256').update(summaryText).digest('hex'),
    },
    marginal_csv: {
      filename: path.basename(options.marginalCsv),
      rows: edges.length,
      sha256: createHash('sha256').update(marginalText).digest('hex'),
    },
  };
  snapshot.artifact_fingerprint = fingerprint(snapshot);
  validateSnapshot(snapshot);
  const issues = strictIssues(snapshot);
  if (options.strict && issues.length) {
    throw new Error(`Strict validation failed before installation: ${issues.join('; ')}`);
  }
  await atomicWrite(options.summaryCsv, summaryText);
  await atomicWrite(options.marginalCsv, marginalText);
  // Install the JSON manifest last so its presence means both companion tables
  // were successfully replaced for this run.
  await atomicWriteJson(options.output, snapshot);
  const rawBytes = Buffer.byteLength(`${JSON.stringify(snapshot)}\n`);
  const result = {
    ok: true,
    ...planReport,
    generated_at: snapshot.generated_at,
    artifact_fingerprint: snapshot.artifact_fingerprint,
    resumed_scenarios: resumedScenarioCount,
    status_counts: snapshot.audit.plan_status_counts,
    monotonicity_violations: snapshot.audit.monotonicity.violation_count,
    strict_issues: issues,
    json_bytes: rawBytes,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return { snapshot, edges, result };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (options.check) {
    await checkArtifact(options.output, { strict: options.strict });
    return;
  }
  const result = await generate(options);
  if (result?.interrupted) process.exitCode = result.signal === 'SIGINT' ? 130 : 143;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CHECKPOINT_SCHEMA_VERSION,
  DEFAULT_OUTPUT,
  METHOD_ID,
  SCHEMA_VERSION,
  CheckpointWriter,
  ProgressReporter,
  analysisSourceManifest,
  atomicWrite,
  atomicWriteJson,
  bitCount,
  buildAudit,
  buildDerived,
  checkpointHeader,
  checkArtifact,
  countJobs,
  enumerateJobs,
  estimateRemainingMs,
  finiteNumber,
  fingerprint,
  formatDuration,
  loadCheckpoint,
  marginalEdges,
  marginalsCsv,
  maskForSchoolIds,
  normalizePrepared,
  parseArgs,
  sameCheckpointHeader,
  scenarioKey,
  shapleyAnalysis,
  stats,
  strictIssues,
  summarizeMarginals,
  summaryCsv,
  validateSnapshot,
};
