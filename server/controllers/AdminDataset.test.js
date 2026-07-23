import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { getDataset } = cjs('./Admin');
const { listMajors, programPairs } = cjs('../config/majors');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('admin_dataset_controller_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.dropDatabase();
  await db.collection('assist_institutions').insertMany(
    [7, 46, 79, 89, 117, 120, 128, 132, 144].map((schoolId) => ({
      _id: `uc:${schoolId}`,
      kind: 'university',
      source_id: schoolId,
      name: `Campus ${schoolId}`,
    }))
  );
  await db.collection('assist_agreements').insertMany([
    ...listMajors().flatMap((major) => programPairs(major)).map((pair) => ({
      uc_school_id: pair.school_id,
      uc_school: `Campus ${pair.school_id}`,
      community_college_id: 1,
      major: pair.major,
    })),
    {
      uc_school_id: 79,
      uc_school: 'Campus 79',
      community_college_id: 1,
      major: 'Future Data Science, B.S.',
    },
  ]);
  await db.collection('curated_requirements').insertOne({ kind: 'future_kind' });
});

function run() {
  return new Promise((resolve, reject) => {
    const req = { app: { locals: { db, auditDb: db } } };
    const res = {
      body: null,
      json(body) { this.body = body; resolve(this); return this; },
    };
    const maybe = getDataset(req, res, (error) => (error ? reject(error) : resolve(res)));
    Promise.resolve(maybe).catch(reject);
  });
}

describe('GET /admin/dataset', () => {
  it('separates major families, campus programs, and repeated source labels', async () => {
    const res = await run();
    const meta = res.body.meta;

    expect(meta.major_summary).toEqual({
      research_major_families: 3,
      configured_campus_programs: 27,
      available_campus_programs: 27,
      distinct_source_program_labels: 20,
      unmapped_campus_programs: 1,
    });
    expect(meta.major_families.map((major) => major.slug)).toEqual(['cs', 'bio', 'econ']);
    expect(meta.major_families.every((major) => (
      major.expected_programs === 9 && major.available_programs === 9
    ))).toBe(true);
    expect(meta.major_families.find((major) => major.slug === 'cs').programs).toHaveLength(9);
    expect(meta.unmapped_programs).toEqual([
      expect.objectContaining({ school_id: 79, source_program: 'Future Data Science, B.S.' }),
    ]);
  });

  it('discovers new research collections instead of using a fixed count list', async () => {
    const res = await run();
    expect(res.body.meta.collections).toContainEqual({ name: 'curated_requirements', count: 1 });
    expect(res.body.meta.counts.curated_requirements).toBe(1);
  });
});
