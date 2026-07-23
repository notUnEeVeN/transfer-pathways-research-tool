import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { multiCampusPathwaysSnapshot } = cjs('./Analysis');
const { invalidateVisibilityCache } = cjs('../services/majorVisibility');
const {
  COMBINED_FIELDS,
  buildMultiCampusSnapshot,
  clearMultiCampusSnapshotCache,
} = cjs('../services/analysis/pathwaySnapshot');

let mongo;
let db;
let directory;
let originalPath;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('analysis_snapshot_controller_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  await db.dropDatabase();
  invalidateVisibilityCache();
  clearMultiCampusSnapshotCache();
  directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'analysis-snapshot-controller-'));
  originalPath = process.env.MULTI_CAMPUS_SNAPSHOT_PATH;
  process.env.MULTI_CAMPUS_SNAPSHOT_PATH = path.join(directory, 'snapshot.json');
});

afterEach(async () => {
  if (originalPath == null) delete process.env.MULTI_CAMPUS_SNAPSHOT_PATH;
  else process.env.MULTI_CAMPUS_SNAPSHOT_PATH = originalPath;
  clearMultiCampusSnapshotCache();
  await fs.promises.rm(directory, { recursive: true, force: true });
});

function combined(seed = 1) {
  return Object.fromEntries(COMBINED_FIELDS.map((field, index) => [
    field,
    field.endsWith('complete') ? true : seed + index,
  ]));
}

function makeSnapshot(load, generatedAt, program = 'Electrical Engineering & Computer Sciences, B.S.') {
  const context = {
    targets: [{ school_id: 79, school: 'UC Berkeley', major: program, program }],
    colleges: [{ source_id: 2, name: 'Semester College' }],
    sourceFingerprint: 'a'.repeat(64),
    calendarForCollege: () => 'semester',
  };
  const combination = {
    mask: 1,
    school_ids: [79],
    summary: { colleges_total: 1 },
    calendar_groups: [{ unit_system: 'semester', n: 1 }],
    rows: [{
      status: 'optimal', plan_status: 'optimal', prerequisite_status: 'complete',
      schedule_status: 'optimal', warnings: [], strict_complete_mask: 1,
      combined: combined(),
    }],
    method: { id: 'joint_major_preparation_v2' },
    global_warnings: ['Major preparation only.'],
  };
  return buildMultiCampusSnapshot({
    context,
    combinations: new Map([[1, combination]]),
    semesterLoad: load,
    quarterLoad: load,
    generatedAt,
  });
}

function run(headers = {}) {
  const req = {
    query: {}, headers, user: { uid: 'researcher-1' },
    app: { locals: { db, auditDb: db } },
  };
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200, body: null, headers: {},
      status(code) { this.statusCode = code; return this; },
      setHeader(name, value) { this.headers[name] = value; },
      json(value) { this.body = value; resolve(this); return this; },
      send(value) { this.body = value; resolve(this); return this; },
    };
    multiCampusPathwaysSnapshot(req, res, (error) => error ? reject(error) : resolve(res));
  });
}

describe('multi-campus snapshot endpoint', () => {
  it('serves a compatible guarded artifact, honors ETags, and reloads an atomic replacement', async () => {
    await db.collection('settings').insertOne({
      _id: 'app', visible_pairs: [{ school_id: 79, major: 'Berkeley CS' }],
    });
    const first = makeSnapshot(15, '2026-07-21T12:00:00.000Z');
    await fs.promises.writeFile(process.env.MULTI_CAMPUS_SNAPSHOT_PATH, JSON.stringify(first));

    const response = await run();
    expect(response.statusCode).toBe(200);
    expect(response.body.default_load_profile).toBe('s15-q15');
    expect(response.headers.ETag).toBe(`"${first.artifact_fingerprint}"`);
    expect(response.headers['Cache-Control']).toBe('private, no-cache');
    expect((await run({ 'if-none-match': response.headers.ETag })).statusCode).toBe(304);

    const second = makeSnapshot(12, '2026-07-21T12:01:00.000Z');
    const replacement = path.join(directory, 'replacement.json');
    await fs.promises.writeFile(replacement, JSON.stringify(second));
    await fs.promises.rename(replacement, process.env.MULTI_CAMPUS_SNAPSHOT_PATH);
    const replaced = await run({ 'if-none-match': response.headers.ETag });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.body.default_load_profile).toBe('s12-q12');
    expect(replaced.headers.ETag).toBe(`"${second.artifact_fingerprint}"`);
  });

  it('returns a clear unavailable response when no artifact is installed', async () => {
    const response = await run();
    expect(response.statusCode).toBe(503);
    expect(response.body.error).toMatch(/not been generated/);
  });

  it('refuses a snapshot whose programs are no longer the configured ones', async () => {
    // A valid artifact, generated from a program that is no longer pinned for
    // computer science in config/majors.js.
    const stale = makeSnapshot(15, '2026-07-21T12:00:00.000Z', 'Retired CS Program');
    await fs.promises.writeFile(process.env.MULTI_CAMPUS_SNAPSHOT_PATH, JSON.stringify(stale));
    const response = await run();
    expect(response.statusCode).toBe(409);
    expect(response.body.error).toMatch(/configured programs have changed/);
  });
});
