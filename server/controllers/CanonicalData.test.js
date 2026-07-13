import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { listRequirements, putRequirement, putPrerequisite } = cjs('./CanonicalData');

let mongo;
let db;
let auditDb;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('canonical_data_test');
  auditDb = mongo.client.db('canonical_data_audit_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  await Promise.all([db.dropDatabase(), auditDb.dropDatabase()]);
});

function request({ body = {}, params = {}, query = {} } = {}) {
  return {
    body,
    params,
    query,
    user: { uid: 'curator-1' },
    app: { locals: { db, auditDb } },
  };
}

function run(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; resolve(this); return this; },
    };
    handler(req, res, (error) => error ? reject(error) : resolve(res));
  });
}

describe('canonical curated-data storage', () => {
  it('writes and lists degree templates from the research database', async () => {
    const body = {
      _id: 'degree:79',
      kind: 'degree',
      school_id: 79,
      school: 'UC Berkeley',
      program: 'EECS, B.S.',
      requirement_groups: [],
    };
    await run(putRequirement, request({ params: { kind: 'degree' }, body }));

    const stored = await db.collection('curated_requirements').findOne({ _id: 'degree:79' });
    expect(stored).toMatchObject({
      kind: 'degree', legacy_id: '79', curated_by: 'curator-1', program: 'EECS, B.S.',
    });
    expect(stored.updated_at).toBeInstanceOf(Date);
    expect(await auditDb.collection('curated_requirements').countDocuments()).toBe(0);

    const response = await run(listRequirements, request({ query: { kind: 'degree' } }));
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]._id).toBe('degree:79');
  });

  it('keeps curated prerequisites with the research dataset as well', async () => {
    await run(putPrerequisite, request({ body: {
      _id: 'cc:1:math-2', course_id: 'cc:1:math-2', prerequisites: ['cc:1:math-1'],
    } }));
    expect(await db.collection('curated_prerequisites').countDocuments()).toBe(1);
    expect(await auditDb.collection('curated_prerequisites').countDocuments()).toBe(0);
  });
});
