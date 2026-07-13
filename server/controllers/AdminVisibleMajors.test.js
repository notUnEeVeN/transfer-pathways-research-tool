import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { putVisibleMajors } = cjs('./Admin');
const { invalidateVisibilityCache } = cjs('../services/majorVisibility');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('admin_visible_majors_controller_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.collection('settings').deleteMany({});
  await db.collection('assist_agreements').deleteMany({});
  await db.collection('assist_agreements').insertMany([
    { uc_school_id: 7, uc_school: 'UC San Diego', major: 'Computer Science B.S.' },
    { uc_school_id: 7, uc_school: 'UC San Diego', major: 'Mathematics/Computer Science B.S.' },
    { uc_school_id: 79, uc_school: 'UC Berkeley', major: 'Computer Science B.A.' },
  ]);
  invalidateVisibilityCache();
});

function fakeReq(pairs) {
  return {
    user: { uid: 'admin' },
    body: { pairs },
    app: { locals: { db, auditDb: db } },
  };
}

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const run = (pairs) => new Promise((resolve, reject) => {
  const res = fakeRes();
  const maybe = putVisibleMajors(fakeReq(pairs), res, (error) => (error ? reject(error) : resolve(res)));
  Promise.resolve(maybe).then(() => resolve(res), reject);
});

describe('PUT /admin/visible-majors', () => {
  it('saves exactly one major for every ported UC campus', async () => {
    const pairs = [
      { school_id: 7, major: 'Computer Science B.S.' },
      { school_id: 79, major: 'Computer Science B.A.' },
    ];
    const res = await run(pairs);

    expect(res.body).toEqual({ ok: true, visible: pairs });
    const doc = await db.collection('settings').findOne({ _id: 'app' });
    expect(doc.visible_pairs).toEqual(pairs);
  });

  it('rejects two selected majors for the same campus', async () => {
    const res = await run([
      { school_id: 7, major: 'Computer Science B.S.' },
      { school_id: 7, major: 'Mathematics/Computer Science B.S.' },
      { school_id: 79, major: 'Computer Science B.A.' },
    ]);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('at most one major per UC campus');
  });

  it('rejects a selection that omits a ported campus', async () => {
    const res = await run([{ school_id: 7, major: 'Computer Science B.S.' }]);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('missing: UC Berkeley');
  });
});
