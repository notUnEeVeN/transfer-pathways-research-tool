// ensureAuditIndexes creates the two read indexes the audit paths rely on
// (system+doc_id point lookups, system+result verdict tallies) on the
// agreement_reviews collection. Uses a fake collection that records the createIndexes
// call, plus a real in-memory Mongo to prove the specs are accepted end-to-end.
const { startInMemoryMongo } = require('../../test/mongoHarness');
const { ensureAuditIndexes } = require('./indexes');
const { AUDIT_RESULTS } = require('./filters');

describe('ensureAuditIndexes', () => {
  it('creates the two agreement-review indexes', async () => {
    let target = null;
    let specs = null;
    const db = {
      collection: (name) => {
        target = name;
        return {
          findOne: async () => ({ _id: 'already-migrated' }),
          createIndexes: async (s) => { specs = s; },
        };
      },
    };

    await ensureAuditIndexes(db);

    expect(target).toBe(AUDIT_RESULTS);
    const keys = specs.map((s) => s.key);
    expect(keys).toContainEqual({ system: 1, doc_id: 1 });
    expect(keys).toContainEqual({ system: 1, result: 1 });
  });

  it('is a no-op when db is missing (boot must not crash)', async () => {
    await expect(ensureAuditIndexes(null)).resolves.toBeUndefined();
    await expect(ensureAuditIndexes(undefined)).resolves.toBeUndefined();
  });

  describe('against a real in-memory Mongo', () => {
    let harness, db;
    beforeAll(async () => {
      harness = await startInMemoryMongo();
      db = harness.client.db('pmt_audit_index_test');
    }, 120000);
    afterAll(async () => { if (harness) await harness.stop(); });

    it('creates the indexes idempotently (second call does not throw)', async () => {
      await ensureAuditIndexes(db);
      await ensureAuditIndexes(db); // idempotent

      const idx = await db.collection(AUDIT_RESULTS).indexes();
      const keys = idx.map((i) => i.key);
      expect(keys).toContainEqual({ system: 1, doc_id: 1 });
      expect(keys).toContainEqual({ system: 1, result: 1 });
    });
  });
});
