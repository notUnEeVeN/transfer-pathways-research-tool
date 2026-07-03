import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// Everything under test is CJS. Loading it through one native require graph
// (instead of mixing ESM imports with the controllers' internal requires)
// keeps services/access's module-level grants cache a single instance, so
// invalidateGrantsCache() here actually clears what the controllers read.
const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { invalidateGrantsCache } = cjs('../services/access');
const { postRequest, adminList, adminDismiss, adminBlock, adminListBlocked, adminUnblock } = cjs('./AccessRequests');
const { grantAccess } = cjs('./Admin');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('access_requests_controller_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.collection('access_requests').deleteMany({});
  await db.collection('access_grants').deleteMany({});
  await db.collection('access_blocks').deleteMany({});
  invalidateGrantsCache();
});

function fakeReq(user, { params = {} } = {}) {
  return { user, params, app: { locals: { db, auditDb: db } } };
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

describe('POST /access/request', () => {
  it('records a request for a signed-in, ungranted browser user', async () => {
    const res = await run(postRequest, fakeReq({ uid: 'u1', email: 'a@b.edu', name: 'Ada' }));
    expect(res.body).toMatchObject({ granted: false, requested: true });
    const doc = await db.collection('access_requests').findOne({ _id: 'u1' });
    expect(doc).toMatchObject({ email: 'a@b.edu', name: 'Ada', attempts: 1 });
  });

  it('no-ops with granted:true when the caller already has access', async () => {
    await db.collection('access_grants').insertOne({ _id: 'u1' });
    const res = await run(postRequest, fakeReq({ uid: 'u1', email: 'a@b.edu' }));
    expect(res.body).toMatchObject({ granted: true });
    expect(await db.collection('access_requests').countDocuments()).toBe(0);
  });

  it('rejects API-token callers', async () => {
    const res = await run(postRequest, fakeReq({ uid: 'u1', api_token: true }));
    expect(res.statusCode).toBe(403);
    expect(await db.collection('access_requests').countDocuments()).toBe(0);
  });
});

describe('GET /admin/access-requests', () => {
  it('lists pending requests', async () => {
    await run(postRequest, fakeReq({ uid: 'u1', email: 'a@b.edu', name: 'Ada' }));
    const res = await run(adminList, fakeReq({ uid: 'admin' }));
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0]).toMatchObject({ uid: 'u1', email: 'a@b.edu' });
  });
});

describe('DELETE /admin/access-requests/:uid', () => {
  it('dismisses a pending request', async () => {
    await run(postRequest, fakeReq({ uid: 'u1', email: 'a@b.edu' }));
    const res = await run(adminDismiss, fakeReq({ uid: 'admin' }, { params: { uid: 'u1' } }));
    expect(res.body).toMatchObject({ ok: true });
    expect(await db.collection('access_requests').countDocuments()).toBe(0);
  });

  it('404s when there is nothing to dismiss', async () => {
    const res = await run(adminDismiss, fakeReq({ uid: 'admin' }, { params: { uid: 'nope' } }));
    expect(res.statusCode).toBe(404);
  });
});

describe('grantAccess integration', () => {
  it('granting a uid clears its pending request', async () => {
    await run(postRequest, fakeReq({ uid: 'u1', email: 'a@b.edu' }));
    const req = fakeReq({ uid: 'admin' });
    req.body = { uid: 'u1', email: 'a@b.edu', note: '' };
    const res = await run(grantAccess, req);
    expect(res.body).toMatchObject({ ok: true });
    expect(await db.collection('access_requests').countDocuments()).toBe(0);
    expect(await db.collection('access_grants').countDocuments({ _id: 'u1' })).toBe(1);
  });

  it('granting a previously blocked uid clears the block (grant wins)', async () => {
    await db.collection('access_blocks').insertOne({ _id: 'u1', blocked_at: new Date() });
    const req = fakeReq({ uid: 'admin' });
    req.body = { uid: 'u1', email: 'a@b.edu', note: '' };
    await run(grantAccess, req);
    expect(await db.collection('access_blocks').countDocuments({ _id: 'u1' })).toBe(0);
    expect(await db.collection('access_grants').countDocuments({ _id: 'u1' })).toBe(1);
  });
});

describe('POST /access/request when blocked', () => {
  it('returns blocked:true and records no request', async () => {
    await db.collection('access_blocks').insertOne({ _id: 'u1', blocked_at: new Date() });
    const res = await run(postRequest, fakeReq({ uid: 'u1', email: 'a@b.edu' }));
    expect(res.body).toMatchObject({ granted: false, blocked: true });
    expect(await db.collection('access_requests').countDocuments({ _id: 'u1' })).toBe(0);
  });
});

describe('POST /admin/access-blocks (reject)', () => {
  it('blocks a uid, clears its pending request, and revokes any grant', async () => {
    await run(postRequest, fakeReq({ uid: 'u1', email: 'a@b.edu' }));
    await db.collection('access_grants').insertOne({ _id: 'u1' }); // was granted before
    invalidateGrantsCache();
    const req = fakeReq({ uid: 'admin' });
    req.body = { uid: 'u1', email: 'a@b.edu', name: 'Ada' };
    const res = await run(adminBlock, req);
    expect(res.body).toMatchObject({ ok: true });
    expect(await db.collection('access_blocks').countDocuments({ _id: 'u1' })).toBe(1);
    expect(await db.collection('access_requests').countDocuments({ _id: 'u1' })).toBe(0);
    expect(await db.collection('access_grants').countDocuments({ _id: 'u1' })).toBe(0);
  });

  it('400s without a uid', async () => {
    const req = fakeReq({ uid: 'admin' });
    req.body = {};
    const res = await run(adminBlock, req);
    expect(res.statusCode).toBe(400);
  });

  it('refuses to block an admin uid (admins are bootstrapped from env)', async () => {
    const prev = process.env.ADMIN_UIDS;
    process.env.ADMIN_UIDS = 'boss';
    try {
      const req = fakeReq({ uid: 'admin' });
      req.body = { uid: 'boss' };
      const res = await run(adminBlock, req);
      expect(res.statusCode).toBe(400);
      expect(await db.collection('access_blocks').countDocuments({ _id: 'boss' })).toBe(0);
    } finally {
      process.env.ADMIN_UIDS = prev;
    }
  });
});

describe('GET /admin/access-blocks', () => {
  it('lists blocked accounts', async () => {
    const req = fakeReq({ uid: 'admin' });
    req.body = { uid: 'u1', email: 'a@b.edu' };
    await run(adminBlock, req);
    const res = await run(adminListBlocked, fakeReq({ uid: 'admin' }));
    expect(res.body.blocked).toHaveLength(1);
    expect(res.body.blocked[0]).toMatchObject({ uid: 'u1', email: 'a@b.edu' });
  });
});

describe('DELETE /admin/access-blocks/:uid (un-block)', () => {
  it('un-blocks, then 404s when there is nothing to un-block', async () => {
    const req = fakeReq({ uid: 'admin' });
    req.body = { uid: 'u1' };
    await run(adminBlock, req);
    const ok = await run(adminUnblock, fakeReq({ uid: 'admin' }, { params: { uid: 'u1' } }));
    expect(ok.body).toMatchObject({ ok: true });
    expect(await db.collection('access_blocks').countDocuments({ _id: 'u1' })).toBe(0);
    const none = await run(adminUnblock, fakeReq({ uid: 'admin' }, { params: { uid: 'u1' } }));
    expect(none.statusCode).toBe(404);
  });
});
