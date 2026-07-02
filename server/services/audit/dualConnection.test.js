// Dual-connection audit test: proves the W4 split actually routes audit working
// state (audit_results / audit_groupings) to `auditDb` while reference data
// (agreements) stays on `db`. Uses one in-memory mongo with TWO logical db
// handles — distinct objects, like the real local-vs-Atlas pair, but cheap.
//
// The single-db suites can't catch a mis-threaded handle (auditDb defaults to db
// there); this one can — if any audit access were left on `db`, the count
// assertions below would fail.
const { ObjectId } = require('mongodb');
const { startInMemoryMongo } = require('../../test/mongoHarness');
const cache = require('../auditCache');
const Audit = require('../../controllers/Audit');

const oid = (n) => new ObjectId(String(n).padStart(24, '0'));

function agreement(id, over = {}) {
  return {
    _id: oid(id),
    uc_school_id: 100, uc_school: 'UC Alpha',
    community_college: 'CC One', community_college_id: 1,
    major: 'Computer Science', major_id: 'm-cs',
    raw_template_hash: 'hashA', template_fp: 'fpA', parser_output_hash: 'poA',
    ...over,
  };
}

function makeRes() {
  return {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    sendStatus(c) { this.statusCode = c; return this; },
  };
}

let harness, db, auditDb;
beforeAll(async () => {
  harness = await startInMemoryMongo();
  db = harness.client.db('pmt_ref_test');        // reference: agreements
  auditDb = harness.client.db('pmt_audit_test');  // audit working state (separate handle)
}, 120000);
afterAll(async () => { if (harness) await harness.stop(); });
beforeEach(async () => {
  cache.clear();
  await db.collection('uc_agreements').deleteMany({});
  await db.collection('audit_results').deleteMany({});
  await auditDb.collection('audit_results').deleteMany({});
  await auditDb.collection('audit_groupings').deleteMany({});
});

describe('audit dual-connection (auditDb separate from db)', () => {
  it('postVerify writes the verdict to auditDb, not the reference db', async () => {
    await db.collection('uc_agreements').insertOne(agreement(1));
    const res = makeRes();
    await Audit.postVerify({
      body: { doc_id: String(oid(1)), result: 'correct', system: 'uc' },
      user: { uid: 'u1' },
      app: { locals: { db, auditDb } },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(await auditDb.collection('audit_results').countDocuments()).toBe(1); // landed on the audit handle
    expect(await db.collection('audit_results').countDocuments()).toBe(0);       // NOT on the reference handle
  });

  it('a tier read joins auditDb verdicts against db agreements', async () => {
    await db.collection('uc_agreements').insertOne(agreement(2, { major: 'Biology' }));
    await auditDb.collection('audit_results').insertOne({
      doc_id: oid(2), result: 'error', system: 'uc',
      uc_school_id: 100, uc_school: 'UC Alpha', major: 'Biology',
      raw_template_hash: 'hashA', template_fp: 'fpA', parser_output_hash: 'poA',
      notes: 'x', source: 'verify', verified_at: '2026-05-01T00:00:00.000Z',
    });
    const res = makeRes();
    let nextErr;
    await Audit.getErrors({ query: {}, app: { locals: { db, auditDb } } }, res, (e) => { nextErr = e; });
    if (nextErr) throw nextErr;
    expect(res.statusCode).toBe(200);
    // The verdict (auditDb) joined to its agreement (db) — both handles exercised.
    expect(res.body.map((r) => r.major)).toEqual(['Biology']);
    expect(res.body[0].community_college).toBe('CC One');
  });

  it('groupings CRUD lives on auditDb, not the reference db', async () => {
    const res = makeRes();
    await Audit.createGrouping({
      body: { name: 'Bio at UCs', members: [{ system: 'uc', school_id: 100, major: 'Biology' }] },
      app: { locals: { db, auditDb } },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(await auditDb.collection('audit_groupings').countDocuments()).toBe(1);
    expect(await db.collection('audit_groupings').countDocuments()).toBe(0);
  });
});
