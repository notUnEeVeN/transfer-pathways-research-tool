import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const { articulationDepthData, layerCounts } = cjs('./articulationDepth');

let mongo; let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('articulation_depth_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const receiver = (articulated) => ({
  receiving: null,
  articulation_status: articulated ? 'articulated' : 'not_articulated',
  not_articulated_reason: null,
  options: [],
  options_conjunction: 'and',
  hash_id: null,
});

const group = (isRequired, receivers) => ({
  is_required: isRequired,
  group_conjunction: 'And',
  sections: [{ section_advisement: null, unit_advisement: null, receivers }],
});

const PROGRAMS = { 79: ['CS, B.S.'], 7: ['Computer Science B.S.'] };

const agreement = (schoolId, major, collegeId, groups) => ({
  uc_school_id: schoolId,
  major,
  community_college_id: collegeId,
  requirement_groups: groups,
});

async function seed() {
  await db.collection('assist_institutions').insertMany([
    { _id: 'cc:1', kind: 'community_college', source_id: 1, name: 'Alpha College', district: 'North District' },
    { _id: 'cc:2', kind: 'community_college', source_id: 2, name: 'Beta College', district: 'North District' },
    { _id: 'cc:3', kind: 'community_college', source_id: 3, name: 'Gamma College', district: 'South District' },
  ]);
  await db.collection('assist_agreements').insertMany([
    // Campus 79 encodes required + recommended. Alpha: 2/2 required, 0/2
    // recommended -> all 2/4. Gamma: 1/2 required, 2/2 recommended -> all 3/4.
    agreement(79, 'CS, B.S.', 1, [
      group(true, [receiver(true), receiver(true)]),
      group(false, [receiver(false), receiver(false)]),
    ]),
    agreement(79, 'CS, B.S.', 3, [
      group(true, [receiver(true), receiver(false)]),
      group(false, [receiver(true), receiver(true)]),
    ]),
    // Campus 7 encodes NO recommended layer (UCLA/UCSD style). Alpha: 1/2.
    agreement(7, 'Computer Science B.S.', 1, [
      group(true, [receiver(true), receiver(false)]),
    ]),
  ]);
}

describe('layerCounts', () => {
  it('splits receiver counts by the required flag and honors the union', () => {
    const groups = [
      group(true, [receiver(true), receiver(false)]),
      group(false, [receiver(true)]),
    ];
    expect(layerCounts(groups, 'required')).toEqual({ total: 2, articulated: 1 });
    expect(layerCounts(groups, 'recommended')).toEqual({ total: 1, articulated: 1 });
    expect(layerCounts(groups, 'all')).toEqual({ total: 3, articulated: 2 });
  });
});

describe('articulationDepthData', () => {
  it('averages each college across campuses on each campus’s own universe, then rolls up by district', async () => {
    await seed();
    const rows = await articulationDepthData(db, db, {
      majorPrograms: PROGRAMS, visiblePairs: null,
    });

    expect(rows.map((r) => r.district)).toEqual(['North District', 'South District']);

    const north = rows[0];
    // Alpha: campus 79 all-share 2/4 = 0.5; campus 7 all-share 1/2 = 0.5 ->
    // college mean 0.5. Beta has no agreements -> excluded from the rollup.
    expect(north.n_colleges).toBe(1);
    expect(north.colleges).toEqual(['Alpha College']);
    expect(north.coverage_all).toBeCloseTo(0.5);
    // Required: (2/2 + 1/2) / 2 = 0.75. Recommended: only campus 79 encodes
    // one -> 0/2 = 0.
    expect(north.coverage_required).toBeCloseTo(0.75);
    expect(north.coverage_recommended).toBeCloseTo(0);

    const south = rows[1];
    expect(south.coverage_all).toBeCloseTo(3 / 4);
    expect(south.coverage_required).toBeCloseTo(0.5);
    expect(south.coverage_recommended).toBeCloseTo(1);
  });

  it('respects partner visibility by dropping non-granted campus pairs', async () => {
    await seed();
    const rows = await articulationDepthData(db, db, {
      majorPrograms: PROGRAMS,
      visiblePairs: [{ school_id: 7, major: 'Computer Science B.S.' }],
    });
    // Only campus 7 is visible: Gamma has no campus-7 agreement, so only
    // Alpha survives, at campus 7's 1/2 with no recommended layer anywhere.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ district: 'North District', n_colleges: 1 });
    expect(rows[0].coverage_all).toBeCloseTo(0.5);
    expect(rows[0].coverage_recommended).toBeNull();
  });

  it('returns nothing without a configured program scope', async () => {
    await seed();
    expect(await articulationDepthData(db, db, { majorPrograms: null, visiblePairs: null }))
      .toEqual([]);
  });
});
