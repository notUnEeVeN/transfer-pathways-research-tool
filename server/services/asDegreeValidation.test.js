import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { getValidationCohort, setValidationCohort } = cjs('./asDegreeValidation');
const { validateAsDegree } = cjs('../controllers/CanonicalData');

// Lightweight stub for validateAsDegree's own db calls (assist_institutions
// and, only when template_ref is set, curated_requirements) — no need for
// the in-memory mongo harness above, which is for the cohort tests.
function fakeDb(institutionsById = {}) {
  return {
    collection(name) {
      if (name === 'assist_institutions') {
        return { findOne: async ({ _id }) => institutionsById[_id] || null };
      }
      if (name === 'curated_requirements') {
        return { findOne: async () => null };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  };
}

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
        _id: 'as_degree:110:cs:local_as',
        kind: 'as_degree',
        college_id: 'cc:110',
        community_college_id: 110,
        degree_type: 'local_as',
        major_slug: 'cs',
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
        _id: 'as_degree:110:cs:ast',
        kind: 'as_degree',
        college_id: 'cc:110',
        community_college_id: 110,
        degree_type: 'ast',
        major_slug: 'cs',
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
            record_id: 'as_degree:110:cs:ast',
            degree_type: 'ast',
            status: 'found',
            verified: true,
            groups_total: 0,
            groups_curated: 0,
          },
          {
            record_id: 'as_degree:110:cs:local_as',
            degree_type: 'local_as',
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

describe('major-scoped as_degree identity', () => {
  // A minimal non-'found' row: status short-circuits before the catalog fields.
  const row = (over = {}) => ({
    legacy_id: '110:cs:ast',
    community_college_id: 110,
    college_id: 'cc:110',
    degree_type: 'ast',
    major_slug: 'cs',
    status: 'none_found',
    ...over,
  });
  const db = fakeDb({ 'cc:110': { kind: 'community_college' } });

  it('accepts a three-segment id whose segments all agree', async () => {
    expect(await validateAsDegree(db, row())).toBeNull();
  });

  it('rejects the pre-migration two-segment id', async () => {
    expect(await validateAsDegree(db, row({ legacy_id: '110:ast' })))
      .toMatch(/<community_college_id>:<major>:<slot>/);
  });

  it('rejects a retired CS type name', async () => {
    expect(await validateAsDegree(db, row({
      legacy_id: '110:cs:local_cs_as', degree_type: 'local_cs_as',
    }))).toMatch(/degree_type must be one of ast, local_as, local_other/);
  });

  it('rejects a major that is not configured', async () => {
    expect(await validateAsDegree(db, row({
      legacy_id: '110:astronomy:ast', major_slug: 'astronomy',
    }))).toMatch(/major_slug must be a configured major/);
  });

  it('rejects a major_slug that disagrees with the id', async () => {
    expect(await validateAsDegree(db, row({ major_slug: 'bio' })))
      .toMatch(/major_slug must match the major segment/);
  });
});
