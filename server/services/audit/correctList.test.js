// Handler-driven test (zero new exports) for the Correct list endpoint.
// Mirrors statsPipeline.test.js: real in-memory mongo, seed collections,
// drive the asyncHandler-wrapped getCorrect directly.
const { ObjectId } = require('mongodb');
const { startInMemoryMongo } = require('../../test/mongoHarness');
const cache = require('../auditCache');
const Audit = require('../../controllers/Audit');

const oid = (n) => new ObjectId(String(n).padStart(24, '0'));

// Agreement doc; hashes default so a verdict with the same hashes is "live".
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
// Verdict row; hashes default to the agreement's so it partitions LIVE.
function verdict(id, over = {}) {
  return {
    doc_id: oid(id), result: 'correct', system: 'uc',
    uc_school_id: 100, uc_school: 'UC Alpha', major: 'Computer Science',
    raw_template_hash: 'hashA', template_fp: 'fpA', parser_output_hash: 'poA',
    notes: '', source: 'verify', verified_at: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

async function callCorrect(db, query = {}) {
  cache.clear();
  const res = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let nextErr;
  await Audit.getCorrect({ query, user: { uid: 'test-admin' }, app: { locals: { db } } }, res, (e) => { nextErr = e; });
  if (nextErr) throw nextErr;
  if (res.statusCode !== 200) throw new Error(`getCorrect ${res.statusCode}: ${JSON.stringify(res.body)}`);
  return res.body;
}

let harness, db;
beforeAll(async () => {
  process.env.ADMIN_UIDS = 'test-admin'; // admin view — visibility scope not under test here
  harness = await startInMemoryMongo();
  db = harness.client.db('pmt_audit_test');
}, 120000);
afterAll(async () => { if (harness) await harness.stop(); });
beforeEach(async () => {
  cache.clear();
  await db.collection('assist_agreements').deleteMany({});
  await db.collection('agreement_reviews').deleteMany({});
});

describe('GET /audit/correct — _correctData', () => {
  it('returns only LIVE correct verdicts, most-recent first, with the list row shape', async () => {
    await db.collection('assist_agreements').insertMany([
      agreement(1, { major: 'Biology', major_id: 'm-bio' }),
      agreement(2, { major: 'Chemistry', major_id: 'm-chem' }),
      agreement(3, { major: 'Physics', major_id: 'm-phys' }),
    ]);
    await db.collection('agreement_reviews').insertMany([
      verdict(1, { major: 'Biology',   verified_at: '2026-05-01T00:00:00.000Z' }),
      verdict(2, { major: 'Chemistry', verified_at: '2026-05-03T00:00:00.000Z' }), // newest
      verdict(3, { major: 'Physics',   result: 'conservative' }),                  // wrong tier → excluded
    ]);

    const rows = await callCorrect(db);
    expect(rows.map((r) => r.major)).toEqual(['Chemistry', 'Biology']); // desc by verified_at, no Physics
    const r0 = rows[0];
    expect(r0.id).toBe(String(oid(2)));
    expect(r0.result).toBe('correct');
    expect(r0.system).toBe('uc');
    expect(r0.uc_school).toBe('UC Alpha');
    expect(r0.community_college).toBe('CC One');
    expect(typeof r0.assist_url).toBe('string');
  });

  it('drops STALE correct verdicts (hash drift)', async () => {
    await db.collection('assist_agreements').insertMany([agreement(1, { major: 'Biology' })]);
    await db.collection('agreement_reviews').insertMany([
      verdict(1, { major: 'Biology', raw_template_hash: 'OLDHASH' }), // drifted → stale → excluded
    ]);
    expect(await callCorrect(db)).toEqual([]);
  });

  it('search filters by denormalized major/school; limit caps the count', async () => {
    await db.collection('assist_agreements').insertMany([
      agreement(1, { major: 'Biology', major_id: 'm-bio' }),
      agreement(2, { major: 'Chemistry', major_id: 'm-chem' }),
    ]);
    await db.collection('agreement_reviews').insertMany([
      verdict(1, { major: 'Biology' }),
      verdict(2, { major: 'Chemistry', verified_at: '2026-05-02T00:00:00.000Z' }),
    ]);
    const onlyChem = await callCorrect(db, { search: 'chem' });
    expect(onlyChem.map((r) => r.major)).toEqual(['Chemistry']);

    const capped = await callCorrect(db, { limit: '1' });
    expect(capped).toHaveLength(1);
    expect(capped[0].major).toBe('Chemistry'); // newest survives the cap
  });
});
