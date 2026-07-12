// Spec for the Templates-tab clustering read. Pins the bucket output AND guards
// the memory fix: the agreements scan must STREAM (cursor) rather than buffer
// the whole collection with .toArray() — the unbounded read that could churn
// the Atlas WiredTiger cache during an auditing session.
const { ObjectId } = require('mongodb');
const { startInMemoryMongo } = require('../../test/mongoHarness');
const cache = require('../auditCache');
const { _templateVariantsData } = require('./templates');

// Wrap one collection's find() cursor so we can assert HOW it's consumed.
function makeStreamGuardDb(realDb, guardColl) {
  const flags = { toArrayCalled: false, streamed: false };
  const wrap = {
    flags,
    collection(name) {
      const c = realDb.collection(name);
      if (name !== guardColl) return c;
      return new Proxy(c, {
        get(t, p) {
          if (p === 'find') {
            return (...a) => {
              const cur = t.find(...a);
              return new Proxy(cur, {
                get(ct, cp) {
                  if (cp === 'toArray') { flags.toArrayCalled = true; return ct.toArray.bind(ct); }
                  if (cp === 'batchSize') { flags.streamed = true; return ct.batchSize.bind(ct); }
                  if (cp === Symbol.asyncIterator) { flags.streamed = true; return ct[Symbol.asyncIterator].bind(ct); }
                  const v = ct[cp];
                  return typeof v === 'function' ? v.bind(ct) : v;
                },
              });
            };
          }
          const v = t[p];
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
    },
  };
  return wrap;
}

const rg = (rid) => [{ is_required: true, group_conjunction: 'And', sections: [{ receivers: [{ hash_id: rid }] }] }];
const ALL = { scope: 'all', schoolIds: [], majorContains: '', pairs: [] };

let harness, db;

beforeAll(async () => {
  harness = await startInMemoryMongo();
  db = harness.client.db('pmt_templates_test');
}, 120000);

afterAll(async () => { if (harness) await harness.stop(); });

beforeEach(async () => {
  cache.clear();
  await db.collection('assist_agreements').deleteMany({});
  await db.collection('agreement_reviews').deleteMany({});
  await db.collection('assist_agreements').insertMany([
    // cluster h1: 3 docs, same (school 100, CS)
    { _id: new ObjectId(), uc_school_id: 100, uc_school: 'UC Alpha', major: 'CS', major_id: 'm1', community_college: 'CC A', raw_template_hash: 'h1', requirement_groups: rg('r1') },
    { _id: new ObjectId(), uc_school_id: 100, uc_school: 'UC Alpha', major: 'CS', major_id: 'm1', community_college: 'CC B', raw_template_hash: 'h1', requirement_groups: rg('r1') },
    { _id: new ObjectId(), uc_school_id: 100, uc_school: 'UC Alpha', major: 'CS', major_id: 'm1', community_college: 'CC C', raw_template_hash: 'h1', requirement_groups: rg('r1') },
    // cluster h2: 1 doc, same (school 100, CS) but a different template
    { _id: new ObjectId(), uc_school_id: 100, uc_school: 'UC Alpha', major: 'CS', major_id: 'm1', community_college: 'CC D', raw_template_hash: 'h2', requirement_groups: rg('r2') },
    // cluster h3: 2 docs, (school 200, Bio)
    { _id: new ObjectId(), uc_school_id: 200, uc_school: 'UC Beta', major: 'Bio', major_id: 'm2', community_college: 'CC A', raw_template_hash: 'h3', requirement_groups: rg('r3') },
    { _id: new ObjectId(), uc_school_id: 200, uc_school: 'UC Beta', major: 'Bio', major_id: 'm2', community_college: 'CC B', raw_template_hash: 'h3', requirement_groups: rg('r3') },
  ]);
});

it('clusters agreements into one row per (school, major, template hash)', async () => {
  const rows = await _templateVariantsData(db, ALL);
  const byKey = Object.fromEntries(rows.map((r) => [`${r.school_id}|${r.major}|${r.raw_template_hash}`, r]));
  expect(rows).toHaveLength(3);
  expect(byKey['100|CS|h1'].n_docs).toBe(3);
  expect(byKey['100|CS|h2'].n_docs).toBe(1);
  expect(byKey['200|Bio|h3'].n_docs).toBe(2);
  expect(byKey['100|CS|h1'].result).toBeNull(); // no verdicts seeded
});

it('streams the agreements scan instead of buffering with toArray()', async () => {
  const guard = makeStreamGuardDb(db, 'assist_agreements');
  cache.clear();
  await _templateVariantsData(guard, ALL);
  expect(guard.flags.toArrayCalled).toBe(false); // must NOT materialize the whole collection
  expect(guard.flags.streamed).toBe(true);       // must iterate a cursor (batchSize / async-iterator)
});
