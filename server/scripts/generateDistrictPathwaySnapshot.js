#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const programPins = require('../data/analysis/district-pathway-programs.v1.json');
const {
  districtPathwaysDataFromContext,
  loadDistrictPathwayContext,
} = require('../services/analysis/districtPathwayPlanner');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  '../../frontend/src/analyses/data/district-multi-campus-pathways.v1.json',
);

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    nativeLoad: 15,
    optimizerBudgetMs: 5000,
    scheduleBudgetMs: 5000,
    blockerBudgetMs: 1500,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else if (arg === '--native-load') options.nativeLoad = Number(argv[++index]);
    else if (arg === '--optimizer-budget-ms') options.optimizerBudgetMs = Number(argv[++index]);
    else if (arg === '--schedule-budget-ms') options.scheduleBudgetMs = Number(argv[++index]);
    else if (arg === '--blocker-budget-ms') options.blockerBudgetMs = Number(argv[++index]);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.nativeLoad) || options.nativeLoad < 6 || options.nativeLoad > 24) {
    throw new Error('--native-load must be between 6 and 24');
  }
  for (const key of ['optimizerBudgetMs', 'scheduleBudgetMs', 'blockerBudgetMs']) {
    if (!Number.isFinite(options[key]) || options[key] < 50) throw new Error(`${key} is invalid`);
  }
  return options;
}

function validate(snapshot) {
  if (snapshot?.schema_version !== 1) throw new Error('Unexpected schema version.');
  if (!Array.isArray(snapshot.programs) || snapshot.programs.length !== 9) {
    throw new Error('Snapshot must contain nine pinned programs.');
  }
  if (!Array.isArray(snapshot.districts) || snapshot.districts.length !== 72) {
    throw new Error('Snapshot must contain 72 districts.');
  }
  if (!Array.isArray(snapshot.groups) || snapshot.groups.length !== 10) {
    throw new Error('Snapshot must contain groups zero through nine.');
  }
  if (snapshot.groups.some((group, index) => group.supported_count !== index)) {
    throw new Error('Snapshot groups are not ordered zero through nine.');
  }
  if (snapshot.groups.reduce((sum, group) => sum + group.district_count, 0) !== 72) {
    throw new Error('Snapshot group counts do not sum to 72.');
  }
  for (const row of snapshot.districts) {
    if (row.supported_count === 0 && row.plan !== null) {
      throw new Error(`${row.district} has a workload plan for zero supported programs.`);
    }
    if (row.supported_count > 0 && !row.plan) {
      throw new Error(`${row.district} is missing its workload plan.`);
    }
  }
  if (snapshot.artifact_fingerprint) {
    const stored = snapshot.artifact_fingerprint;
    const unsigned = { ...snapshot };
    delete unsigned.artifact_fingerprint;
    const expected = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');
    if (stored !== expected) throw new Error('Artifact fingerprint does not match its contents.');
  }
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

async function check(filePath) {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const snapshot = validate(JSON.parse(raw));
  process.stdout.write(`${JSON.stringify({
    ok: true,
    path: filePath,
    generated_at: snapshot.generated_at,
    source_fingerprint: snapshot.source_fingerprint,
    artifact_fingerprint: snapshot.artifact_fingerprint,
    districts: snapshot.districts.length,
    distribution: snapshot.groups.map((group) => group.district_count),
  }, null, 2)}\n`);
}

async function generate(options) {
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
    process.stderr.write('Loading pinned ASSIST programs, agreements, and course catalogs...\n');
    const context = await loadDistrictPathwayContext(db, auditDb);
    process.stderr.write('Building 72 district-pooled plans...\n');
    const snapshot = districtPathwaysDataFromContext(context, {
      nativeLoad: options.nativeLoad,
      optimizerBudgetMs: options.optimizerBudgetMs,
      scheduleBudgetMs: options.scheduleBudgetMs,
      blockerBudgetMs: options.blockerBudgetMs,
      onProgress: ({ completed, total, district, supported_count: supportedCount }) => {
        process.stderr.write(`[${completed}/${total}] ${district} · ${supportedCount} reachable\n`);
      },
    });
    snapshot.generation_parameters = {
      native_load: options.nativeLoad,
      optimizer_budget_ms: options.optimizerBudgetMs,
      schedule_budget_ms: options.scheduleBudgetMs,
      blocker_budget_ms: options.blockerBudgetMs,
    };
    snapshot.source_fingerprint = createHash('sha256').update(JSON.stringify({
      planner_source_fingerprint: context.sourceFingerprint,
      program_pins: programPins,
      native_load: options.nativeLoad,
      optimizer_budget_ms: options.optimizerBudgetMs,
      schedule_budget_ms: options.scheduleBudgetMs,
      blocker_budget_ms: options.blockerBudgetMs,
    })).digest('hex');
    snapshot.artifact_fingerprint = createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex');
    validate(snapshot);
    await atomicWriteJson(options.output, snapshot);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      output: options.output,
      generated_at: snapshot.generated_at,
      source_fingerprint: snapshot.source_fingerprint,
      districts: snapshot.districts.length,
      distribution: snapshot.groups.map((group) => group.district_count),
      mean_supported_count: snapshot.summary.mean_supported_count,
      exact_course_plans: snapshot.summary.exact_course_plans,
      exact_schedules: snapshot.summary.exact_schedules,
    }, null, 2)}\n`);
  } finally {
    if (auditClient !== client) await auditClient.close();
    await client.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write([
      'Usage: npm run snapshot:district-pathways -- [options]',
      '  --check',
      '  --output path',
      '  --native-load 15',
      '  --optimizer-budget-ms 5000',
      '  --schedule-budget-ms 5000',
      '  --blocker-budget-ms 1500',
    ].join('\n') + '\n');
    return;
  }
  if (options.check) await check(options.output);
  else await generate(options);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
