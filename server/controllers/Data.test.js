import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { getSummary } = cjs('./Data');

let mongo;
let db;

// The exact program string config pins for UC Berkeley; the scope clause
// matches on (school_id, major), so an approximate label would score zero.
const BERKELEY = 'Electrical Engineering & Computer Sciences, B.S.';

const callSummary = async () => {
  const req = { app: { locals: { db } }, query: {}, user: null };
  let payload = null;
  const res = { json: (body) => { payload = body; return res; }, status: () => res };
  await getSummary(req, res, (error) => { if (error) throw error; });
  return payload;
};

const agreement = (id, schoolId, school, collegeId, extra = {}) => ({
  _id: id,
  uc_school_id: schoolId,
  uc_school: school,
  major: BERKELEY,
  community_college_id: collegeId,
  requirement_groups: [{
    sections: [{
      receivers: [{
        receiving: { kind: 'course', parent_id: 1000 + schoolId },
        options: [{ course_ids: [collegeId * 10] }],
      }],
    }],
  }],
  ...extra,
});

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('data_summary_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

describe('getSummary', () => {
  // The regression this pins: `majorScope` spans every state so the state
  // pages resolve, and the California explorer consumed it unfiltered. The
  // Massachusetts and Virginia agreements carry `university_name` rather than
  // ASSIST's `uc_school`, so each arrived as a school row with a BLANK name
  // (27 of them once Virginia landed), and the college count absorbed their
  // colleges too.
  it('reports only California, never the state corpora sharing the collections', async () => {
    await db.collection('assist_agreements').insertMany([
      agreement('ca1', 79, 'UC Berkeley', 3),
      agreement('ca2', 79, 'UC Berkeley', 4),
      // Both state corpora exactly as they are stored: their own configured
      // program string (so the scope clause DOES admit them), no `uc_school`,
      // stamped with a state. Only the state clause keeps them out.
      {
        ...agreement('ma1', 9001, undefined, 9101, { state: 'ma' }),
        major: 'Computer Science, B.S.',
        university_name: 'Bridgewater',
      },
      {
        ...agreement('va1', 9210, undefined, 9301, { state: 'va' }),
        major: 'Computer Science, B.S.',
        university_name: 'George Mason University',
      },
    ]);
    await db.collection('assist_institutions').insertMany([
      { _id: 'cc:3', kind: 'community_college', source_id: 3, name: 'Los Angeles City College' },
      { _id: 'cc:4', kind: 'community_college', source_id: 4, name: 'Santa Monica College' },
      { _id: 'ma:cc:9101', kind: 'community_college', source_id: 9101, name: 'Berkshire Community College', state: 'ma' },
      { _id: 'va:cc:9301', kind: 'community_college', source_id: 9301, name: 'Blue Ridge Community College', state: 'va' },
    ]);

    const payload = await callSummary();

    expect(payload.schools).toHaveLength(1);
    expect(payload.schools[0]).toMatchObject({ school_id: 79, school: 'UC Berkeley', n_agreements: 2 });
    // No nameless row survived, which is what the blank rows looked like.
    expect(payload.schools.every((row) => row.school)).toBe(true);
    expect(payload.counts.agreements).toBe(2);
    // The two California colleges only — not Berkshire or Blue Ridge.
    expect(payload.counts.community_colleges).toBe(2);
    // Course counts come from the California agreements' own references.
    expect(payload.counts.courses).toBe(2);
    expect(payload.counts.university_courses).toBe(1);
  });
});
