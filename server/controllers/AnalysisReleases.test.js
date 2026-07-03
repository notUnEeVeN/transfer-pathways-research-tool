import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// CJS controllers loaded through one native require graph so the service's
// module-level releases cache is a single instance shared with the handlers.
const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { invalidateReleasesCache } = cjs('../services/analysisReleases');
const { getReleases } = cjs('./Analysis');
const { putAnalysisReleases } = cjs('./Admin');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('analysis_releases_controller_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.collection('dataset_config').deleteMany({});
  invalidateReleasesCache();
});

function fakeReq(user, { body } = {}) {
  return { user, body, app: { locals: { db, auditDb: db } } };
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    sendStatus(c) { this.statusCode = c; return this; },
  };
  return res;
}

const run = (handler, req) => new Promise((resolve, reject) => {
  const res = fakeRes();
  const maybe = handler(req, res, (err) => (err ? reject(err) : resolve(res)));
  Promise.resolve(maybe).then(() => resolve(res), reject);
});

describe('GET /analysis/releases', () => {
  it('defaults to [] (hidden until released)', async () => {
    const res = await run(getReleases, fakeReq({ uid: 'partner' }));
    expect(res.body).toEqual({ released_ids: [] });
  });

  it('returns the saved release set to any console user', async () => {
    await run(putAnalysisReleases, fakeReq({ uid: 'admin' }, { body: { released_ids: ['coverage-heatmap'] } }));
    const res = await run(getReleases, fakeReq({ uid: 'partner' }));
    expect(res.body).toEqual({ released_ids: ['coverage-heatmap'] });
  });
});

describe('PUT /admin/analysis-releases', () => {
  it('sets releases (trim + dedupe) and echoes the cleaned set', async () => {
    const res = await run(putAnalysisReleases, fakeReq({ uid: 'admin' }, { body: { released_ids: [' a ', 'a', 'b'] } }));
    expect(res.body).toMatchObject({ ok: true, released_ids: ['a', 'b'] });
    const doc = await db.collection('dataset_config').findOne({ _id: 'analysis_releases' });
    expect(doc.released_ids).toEqual(['a', 'b']);
    expect(doc.updated_by).toBe('admin');
  });

  it('400s when released_ids is not an array', async () => {
    const res = await run(putAnalysisReleases, fakeReq({ uid: 'admin' }, { body: { released_ids: 'x' } }));
    expect(res.statusCode).toBe(400);
  });

  it('400s when an entry is not a string', async () => {
    const res = await run(putAnalysisReleases, fakeReq({ uid: 'admin' }, { body: { released_ids: ['ok', 3] } }));
    expect(res.statusCode).toBe(400);
  });
});
