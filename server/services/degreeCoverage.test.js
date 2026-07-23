import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { evaluateDegreeAtCollege } = cjs('./degreeCoverage');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('degree_coverage_major_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const degree = ({ slug, program, parentId, legacy = false }) => ({
  _id: legacy ? 'degree:79' : `degree:79:${slug}`,
  kind: 'degree',
  school_id: 79,
  school: 'UC Berkeley',
  ...(legacy ? {} : { major_slug: slug }),
  program,
  requirement_groups: [{
    title: 'Major preparation',
    tier: 'transferable',
    sections: [{
      section_advisement: 1,
      receivers: [{ receiving: { kind: 'course', parent_id: parentId } }],
    }],
  }],
});

const agreement = ({ major, parentId, articulated }) => ({
  uc_school_id: 79,
  community_college_id: 101,
  major,
  requirement_groups: [{
    sections: [{
      receivers: [{
        receiving: { kind: 'course', parent_id: parentId },
        articulation_status: articulated ? 'articulated' : 'not_articulated',
        options: [],
      }],
    }],
  }],
});

describe('degree coverage major isolation', () => {
  it('selects the requested template and only its exact configured agreement', async () => {
    await db.collection('curated_requirements').insertMany([
      degree({
        slug: 'cs',
        program: 'Electrical Engineering & Computer Sciences, B.S.',
        parentId: 10,
      }),
      degree({ slug: 'bio', program: 'Molecular and Cell Biology, B.A.', parentId: 20 }),
    ]);
    await db.collection('assist_agreements').insertMany([
      // The canonical CS agreement does not articulate the degree course.
      agreement({
        major: 'Electrical Engineering & Computer Sciences, B.S.',
        parentId: 10,
        articulated: false,
      }),
      // This adjacent CS program would create a false positive under the old
      // campus-only union query.
      agreement({ major: 'Computer Science, B.A.', parentId: 10, articulated: true }),
      agreement({ major: 'Molecular and Cell Biology, B.A.', parentId: 20, articulated: true }),
    ]);

    const cs = await evaluateDegreeAtCollege(db, {
      schoolId: 79, communityCollegeId: 101, majorSlug: 'cs',
    });
    expect(cs).toMatchObject({
      major_slug: 'cs',
      program: 'Electrical Engineering & Computer Sciences, B.S.',
      n_agreements: 1,
      completion: { total: 1, covered: 0 },
    });

    const bio = await evaluateDegreeAtCollege(db, {
      schoolId: 79, communityCollegeId: 101, majorSlug: 'bio',
    });
    expect(bio).toMatchObject({
      major_slug: 'bio', program: 'Molecular and Cell Biology, B.A.', n_agreements: 1,
      completion: { total: 1, covered: 1 },
    });
  });

  it('uses an unstamped historical template for CS only', async () => {
    await db.collection('curated_requirements').insertOne(degree({
      slug: 'cs', program: 'EECS, B.S.', parentId: 10, legacy: true,
    }));
    await db.collection('assist_agreements').insertOne(agreement({
      major: 'Electrical Engineering & Computer Sciences, B.S.',
      parentId: 10,
      articulated: true,
    }));

    expect(await evaluateDegreeAtCollege(db, {
      schoolId: 79, communityCollegeId: 101, majorSlug: 'cs',
    })).toMatchObject({ major_slug: 'cs', completion: { covered: 1 } });
    expect(await evaluateDegreeAtCollege(db, {
      schoolId: 79, communityCollegeId: 101, majorSlug: 'bio',
    })).toBeNull();
  });

  it('rejects a stamped sibling program even when the slug says CS', async () => {
    await db.collection('curated_requirements').insertOne(degree({
      slug: 'cs', program: 'Computer Science, B.A.', parentId: 10,
    }));

    expect(await evaluateDegreeAtCollege(db, {
      schoolId: 79, communityCollegeId: 101, majorSlug: 'cs',
    })).toBeNull();
  });
});
