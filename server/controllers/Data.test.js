import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { getSummary } = cjs('./Data');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('data_controller_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  for (const name of ['assist_agreements', 'assist_institutions', 'curated_requirements', 'settings']) {
    await db.collection(name).deleteMany({});
  }
});

function run(handler, uid = 'admin-1') {
  const req = { query: {}, user: { uid }, app: { locals: { db, auditDb: db } } };
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; resolve(this); return this; },
    };
    handler(req, res, (error) => (error ? reject(error) : resolve(res)));
  });
}

describe('GET /data/summary curated layer', () => {
  it('counts each curated kind: templates + notes, minimum campuses, AS degrees, concepts', async () => {
    const prevAdmins = process.env.ADMIN_UIDS;
    process.env.ADMIN_UIDS = 'admin-1';
    try {
      await db.collection('curated_requirements').insertMany([
        // Two degree templates; one carries verification notes.
        { _id: 'degree:1', kind: 'degree', school_id: 1, verification_notes: [{ text: 'checked' }] },
        { _id: 'degree:2', kind: 'degree', school_id: 2 },
        // Three minimum rows across two campuses → 2 campuses covered.
        { _id: 'tm:1', kind: 'transfer_minimum', school_id: 1 },
        { _id: 'tm:2', kind: 'transfer_minimum', school_id: 1 },
        { _id: 'tm:3', kind: 'transfer_minimum', school_id: 2 },
        // Two AS-degree records at one college, one at another.
        { _id: 'asd:1', kind: 'as_degree', college_id: 'cc:10' },
        { _id: 'asd:2', kind: 'as_degree', college_id: 'cc:10' },
        { _id: 'asd:3', kind: 'as_degree', college_id: 'cc:20' },
        { _id: 'pc:1', kind: 'prereq_concept' },
      ]);

      const res = await run(getSummary);
      expect(res.body.curated).toEqual({
        degree_templates: 2,
        degree_templates_with_notes: 1,
        transfer_minimum_campuses: 2,
        prereq_concepts: 1,
        as_degree_records: 3,
        as_degree_colleges: 2,
      });
    } finally {
      if (prevAdmins === undefined) delete process.env.ADMIN_UIDS;
      else process.env.ADMIN_UIDS = prevAdmins;
    }
  });
});
