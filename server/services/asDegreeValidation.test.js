import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { getValidationCohort, setValidationCohort } = cjs('./asDegreeValidation');

let mongo;
let auditDb;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  auditDb = mongo.client.db('as_degree_validation_audit_test');
  db = mongo.client.db('as_degree_validation_data_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  await Promise.all([auditDb.dropDatabase(), db.dropDatabase()]);
});

describe('as-degree validation cohort', () => {
  it('stores deduped numeric ids with who/when stamps', async () => {
    const result = await setValidationCohort(
      auditDb,
      [110, 110, '42', '', 0, -1, 3.5, 'not-an-id'],
      'uid-1',
    );

    expect(result).toEqual({ college_ids: [110, 42] });
    const stored = await auditDb.collection('settings').findOne({ _id: 'as_degree_validation' });
    expect(stored.college_ids).toEqual([110, 42]);
    expect(stored.updated_by).toBe('uid-1');
    expect(stored.updated_at).toBeInstanceOf(Date);
  });

  it('joins the cohort with per-college degree progress', async () => {
    const updatedAt = new Date('2026-07-22T12:00:00.000Z');
    await auditDb.collection('settings').insertOne({
      _id: 'as_degree_validation',
      college_ids: [110],
      updated_by: 'uid-1',
      updated_at: updatedAt,
    });
    await db.collection('assist_institutions').insertOne({
      _id: 'cc:110',
      kind: 'community_college',
      name: 'Allan Hancock College',
    });
    await db.collection('curated_requirements').insertMany([
      {
        _id: 'as_degree:110:local_cs_as',
        kind: 'as_degree',
        college_id: 'cc:110',
        community_college_id: 110,
        degree_type: 'local_cs_as',
        status: 'found',
        verification: { verified: false },
        requirement_groups: [
          { group_id: 'core', source: 'curated' },
          { group_id: 'math', source: 'extracted' },
          // Older hand-reviewed rows can carry the group stamp even if their
          // source was not migrated to `curated` yet.
          { group_id: 'science', source: 'extracted', curated_by: 'uid-2' },
        ],
      },
      {
        _id: 'as_degree:110:ast',
        kind: 'as_degree',
        college_id: 'cc:110',
        community_college_id: 110,
        degree_type: 'ast',
        status: 'found',
        verification: { verified: true },
        requirement_groups: [],
      },
    ]);

    const result = await getValidationCohort(auditDb, db);

    expect(result).toEqual({
      college_ids: [110],
      colleges: [{
        college_id: 110,
        name: 'Allan Hancock College',
        degrees: [
          {
            record_id: 'as_degree:110:ast',
            degree_type: 'ast',
            status: 'found',
            verified: true,
            groups_total: 0,
            groups_curated: 0,
          },
          {
            record_id: 'as_degree:110:local_cs_as',
            degree_type: 'local_cs_as',
            status: 'found',
            verified: false,
            groups_total: 3,
            groups_curated: 2,
          },
        ],
      }],
      updated_by: 'uid-1',
      updated_at: updatedAt,
    });
  });

  it('keeps selected colleges visible when they do not have degree rows yet', async () => {
    await auditDb.collection('settings').insertOne({
      _id: 'as_degree_validation', college_ids: ['42'], updated_by: null, updated_at: null,
    });
    await db.collection('assist_institutions').insertOne({
      _id: 'cc:42', kind: 'community_college', name: 'College of the Desert',
    });

    const result = await getValidationCohort(auditDb, db);

    expect(result.college_ids).toEqual([42]);
    expect(result.colleges).toEqual([{
      college_id: 42, name: 'College of the Desert', degrees: [],
    }]);
  });

  it('returns an empty cohort when the settings doc is missing', async () => {
    await expect(getValidationCohort(auditDb, db)).resolves.toEqual({
      college_ids: [],
      colleges: [],
      updated_by: null,
      updated_at: null,
    });
  });
});
