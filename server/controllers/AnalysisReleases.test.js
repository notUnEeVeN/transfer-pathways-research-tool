import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// CJS controllers loaded through one native require graph so the service's
// module-level releases cache is a single instance shared with the handlers.
const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { invalidateReleasesCache } = cjs('../services/analysisReleases');
const { getReleases } = cjs('./Analysis');
const { putAnalysisReleases, putAnalysisDisabled } = cjs('./Admin');

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
  await db.collection('settings').deleteMany({});
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
  it('defaults to [] for both sets (hidden from partners, all enabled for admins)', async () => {
    const res = await run(getReleases, fakeReq({ uid: 'partner' }));
    expect(res.body).toEqual({ released_ids: [], disabled_ids: [] });
  });

  it('returns the saved release + disabled sets to any console user', async () => {
    await run(putAnalysisReleases, fakeReq({ uid: 'admin' }, { body: { released_ids: ['coverage-heatmap'] } }));
    await run(putAnalysisDisabled, fakeReq({ uid: 'admin' }, { body: { disabled_ids: ['complexity'] } }));
    const res = await run(getReleases, fakeReq({ uid: 'partner' }));
    expect(res.body).toEqual({ released_ids: ['coverage-heatmap'], disabled_ids: ['complexity'] });
  });
});

describe('PUT /admin/analysis-releases', () => {
  it('sets releases (trim + dedupe) and echoes the cleaned set', async () => {
    const res = await run(putAnalysisReleases, fakeReq({ uid: 'admin' }, { body: { released_ids: [' a ', 'a', 'b'] } }));
    expect(res.body).toMatchObject({ ok: true, released_ids: ['a', 'b'] });
    const doc = await db.collection('settings').findOne({ _id: 'app' });
    expect(doc.visual_published_ids).toEqual(['a', 'b']);
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

describe('PUT /admin/analysis-disabled', () => {
  it('sets the disabled set (trim + dedupe) without touching releases', async () => {
    await run(putAnalysisReleases, fakeReq({ uid: 'admin' }, { body: { released_ids: ['a'] } }));
    const res = await run(putAnalysisDisabled, fakeReq({ uid: 'admin' }, { body: { disabled_ids: [' b ', 'b', 'c'] } }));
    expect(res.body).toMatchObject({ ok: true, disabled_ids: ['b', 'c'] });
    const doc = await db.collection('settings').findOne({ _id: 'app' });
    expect(doc.visual_published_ids).toEqual(['a']);
    expect(doc.visual_hidden_ids).toEqual(['b', 'c']);
  });

  it('400s when disabled_ids is not an array of strings', async () => {
    const bad1 = await run(putAnalysisDisabled, fakeReq({ uid: 'admin' }, { body: { disabled_ids: 'x' } }));
    expect(bad1.statusCode).toBe(400);
    const bad2 = await run(putAnalysisDisabled, fakeReq({ uid: 'admin' }, { body: { disabled_ids: ['ok', 3] } }));
    expect(bad2.statusCode).toBe(400);
  });
});
