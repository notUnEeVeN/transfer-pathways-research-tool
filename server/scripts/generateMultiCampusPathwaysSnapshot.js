#!/usr/bin/env node
/**
 * Manually freeze every nonempty subset of the nine configured UC programs.
 *
 * Generation is intentionally offline. The website reads the installed JSON
 * artifact and never starts this long-running calculation itself.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const {
  loadMultiCampusPathwayContext,
  multiCampusPathwaysDataFromContext,
} = require('../services/analysis/pathwayPlanner');
const {
  DEFAULT_SNAPSHOT_PATH,
  SNAPSHOT_SCHEMA_VERSION,
  buildMultiCampusSnapshot,
  compactMultiCampusCombination,
  loadProfileKey,
  schoolIdsForMask,
  validateMultiCampusSnapshot,
} = require('../services/analysis/pathwaySnapshot');

dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function usage() {
  return [
    'Usage:',
    '  npm run snapshot:multi-campus -- [--semester-load 15] [--quarter-load 15]',
    '      [--output path] [--checkpoint path]',
    '  npm run snapshot:multi-campus -- --check [--output path]',
    '',
    'A compatible checkpoint resumes automatically. Use a different checkpoint',
    'path when the source fingerprint or selected load changes.',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    semesterLoad: 15,
    quarterLoad: 15,
    output: DEFAULT_SNAPSHOT_PATH,
    checkpoint: null,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--semester-load') options.semesterLoad = Number(argv[++index]);
    else if (arg === '--quarter-load') options.quarterLoad = Number(argv[++index]);
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else if (arg === '--checkpoint') options.checkpoint = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.semesterLoad) || options.semesterLoad < 6
    || options.semesterLoad > 24) throw new Error('semester-load must be between 6 and 24');
  if (!Number.isFinite(options.quarterLoad) || options.quarterLoad < 6
    || options.quarterLoad > 30) throw new Error('quarter-load must be between 6 and 30');
  options.output = path.resolve(options.output);
  return options;
}

async function atomicWriteJson(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    const handle = await fs.promises.open(temporary, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(value)}\n`);
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

function checkpointHeader(context, options, campuses, colleges) {
  return {
    type: 'header',
    checkpoint_schema_version: 1,
    snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
    source_fingerprint: context.sourceFingerprint,
    semester_load: options.semesterLoad,
    quarter_load: options.quarterLoad,
    school_ids: campuses.map((campus) => campus.school_id),
    community_college_ids: colleges.map((college) => college.community_college_id),
  };
}

function sameCheckpoint(left, right) {
  const fields = [
    'checkpoint_schema_version', 'snapshot_schema_version', 'source_fingerprint',
    'semester_load', 'quarter_load', 'school_ids', 'community_college_ids',
  ];
  return fields.every((field) => JSON.stringify(left?.[field]) === JSON.stringify(right?.[field]));
}

async function loadCheckpoint(filePath, expectedHeader) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  let raw;
  try {
    raw = await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.promises.writeFile(filePath, `${JSON.stringify(expectedHeader)}\n`, { flag: 'wx' });
    return new Map();
  }
  const lines = raw.split('\n').filter(Boolean);
  if (!lines.length) throw new Error(`Checkpoint is empty: ${filePath}`);
  const header = JSON.parse(lines[0]);
  if (!sameCheckpoint(header, expectedHeader)) {
    throw new Error(`Checkpoint does not match this data/load profile: ${filePath}`);
  }
  const combinations = new Map();
  for (const [lineIndex, line] of lines.slice(1).entries()) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      if (lineIndex === lines.length - 2 && !raw.endsWith('\n')) break;
      throw new Error(`Invalid checkpoint line ${lineIndex + 2}: ${error.message}`);
    }
    if (entry.type !== 'combination' || !Number.isInteger(entry.mask)) {
      throw new Error(`Invalid checkpoint entry on line ${lineIndex + 2}`);
    }
    combinations.set(entry.mask, entry.combination);
  }
  return combinations;
}

async function appendCheckpoint(filePath, mask, combination) {
  const line = JSON.stringify({ type: 'combination', mask, combination });
  await fs.promises.appendFile(filePath, `${line}\n`);
}

async function checkSnapshot(filePath) {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const snapshot = validateMultiCampusSnapshot(JSON.parse(raw));
  const profile = snapshot.load_profiles[snapshot.default_load_profile];
  process.stdout.write(`${JSON.stringify({
    ok: true,
    path: filePath,
    generated_at: snapshot.generated_at,
    source_fingerprint: snapshot.source_fingerprint,
    campuses: snapshot.campuses.length,
    colleges: snapshot.colleges.length,
    combinations: Object.keys(profile.combinations).length,
    semester_load: profile.semester_load,
    quarter_load: profile.quarter_load,
    bytes: Buffer.byteLength(raw),
  }, null, 2)}\n`);
}

async function generate(options) {
  const uri = process.env.MONGO_URI || process.env.TARGET_MONGO_URI;
  if (!uri) throw new Error('MONGO_URI or TARGET_MONGO_URI is required');
  const auditUri = process.env.AUDIT_MONGO_URI || uri;
  const dbName = process.env.DB_NAME || process.env.TARGET_DB_NAME || 'pmt_research';
  const mainClient = await MongoClient.connect(uri, { compressors: ['zlib'] });
  const auditClient = auditUri === uri
    ? mainClient
    : await MongoClient.connect(auditUri, { compressors: ['zlib'] });
  try {
    const db = mainClient.db(dbName);
    const auditDb = auditClient.db(dbName);
    const universityRows = await db.collection('assist_institutions')
      .find({ kind: 'university' }, { projection: { source_id: 1 } })
      .sort({ source_id: 1 })
      .toArray();
    const schoolIds = universityRows.map((row) => Number(row.source_id)).filter(Number.isFinite);
    if (schoolIds.length !== 9 || new Set(schoolIds).size !== 9) {
      throw new Error(`Expected exactly nine UC campuses; found ${schoolIds.length}.`);
    }
    process.stderr.write('Loading planner corpus once...\n');
    const context = await loadMultiCampusPathwayContext(db, auditDb, {
      schoolIds,
      visiblePairs: null,
      includeSourceFingerprint: true,
      retainSingletonBaselines: true,
    });
    const campuses = context.targets.map((target) => ({
      school_id: Number(target.school_id),
      school: target.school,
      major: target.major,
      program: target.program || target.major,
    })).sort((left, right) => left.school_id - right.school_id);
    const colleges = context.colleges.map((college) => ({
      community_college_id: Number(college.source_id),
      community_college: college.name,
      unit_system: context.calendarForCollege(Number(college.source_id)),
      calendar_source: 'PMT reviewed college calendar file, 2026-06-08',
    }));
    const profileKey = loadProfileKey(options.semesterLoad, options.quarterLoad);
    const checkpointPath = options.checkpoint || [
      options.output,
      profileKey,
      context.sourceFingerprint.slice(0, 12),
      'checkpoint.ndjson',
    ].join('.');
    const header = checkpointHeader(context, options, campuses, colleges);
    const combinations = await loadCheckpoint(checkpointPath, header);
    const total = (1 << campuses.length) - 1;
    process.stderr.write(`Resuming with ${combinations.size} of ${total} combinations complete.\n`);
    const startedAt = Date.now();
    for (let mask = 1; mask <= total; mask += 1) {
      if (combinations.has(mask)) continue;
      const selectedSchoolIds = schoolIdsForMask(campuses, mask);
      const combinationStarted = Date.now();
      const result = multiCampusPathwaysDataFromContext(context, {
        schoolIds: selectedSchoolIds,
        mode: 'average',
        semesterLoad: options.semesterLoad,
        quarterLoad: options.quarterLoad,
      });
      const compact = compactMultiCampusCombination(result, { campuses, colleges });
      combinations.set(mask, compact);
      await appendCheckpoint(checkpointPath, mask, compact);
      process.stderr.write(
        `[${combinations.size}/${total}] mask ${mask} (${selectedSchoolIds.join(',')}) `
        + `${((Date.now() - combinationStarted) / 1000).toFixed(1)}s\n`,
      );
    }
    const snapshot = buildMultiCampusSnapshot({
      context,
      combinations,
      semesterLoad: options.semesterLoad,
      quarterLoad: options.quarterLoad,
    });
    await atomicWriteJson(options.output, snapshot);
    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const raw = Buffer.from(`${JSON.stringify(snapshot)}\n`);
    const gzipBytes = zlib.gzipSync(raw).length;
    process.stdout.write(
      `Installed ${Object.keys(snapshot.load_profiles[profileKey].combinations).length} combinations `
      + `at ${options.output} (${elapsedSeconds}s, ${raw.length} raw bytes, ${gzipBytes} gzip bytes).\n`,
    );
  } finally {
    if (auditClient !== mainClient) await auditClient.close();
    await mainClient.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return process.stdout.write(`${usage()}\n`);
  if (options.check) return checkSnapshot(options.output);
  return generate(options);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  atomicWriteJson,
  checkSnapshot,
  checkpointHeader,
  loadCheckpoint,
  parseArgs,
  sameCheckpoint,
};
