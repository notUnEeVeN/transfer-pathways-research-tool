import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startInMemoryMongo } from '../../test/mongoHarness';
import {
  coverageData, creditLossData, choiceCostData, categoryGapsData,
  complexityData, timeToDegreeData, receiversExportData,
} from './pathways';

let mongo;
let db;

const recv = (options, { status = 'articulated', hash = 'h', parentId = 1, oc = 'or' } = {}) => ({
  receiving: { kind: 'course', parent_id: parentId },
  articulation_status: status,
  not_articulated_reason: status === 'articulated' ? null : 'NoCourseArticulated',
  options,
  options_conjunction: oc,
  hash_id: hash,
});
const opt = (ids, cc = 'and') => ({ course_ids: ids, course_conjunction: cc });
// "Complete all listed" — the ASSIST parser stores section_advisement = the
// receiver count for that (agreements.py), so a genuinely-missing receiver
// leaves the choose-N minimum unmet. (A null advisement would mean "any one".)
const oneGroup = (receivers, isRequired = true) => [{
  is_required: isRequired, group_conjunction: 'And', group_advisement: null,
  group_unit_advisement: null,
  sections: [{ section_advisement: receivers.length, unit_advisement: null, receivers }],
}];

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('pathways_test');

  // Two UC agreements at School 1 for CC 10 and CC 20, one CSU untouched.
  await db.collection('uc_agreements').insertMany([
    {
      uc_school: 'UC Test', uc_school_id: 1,
      community_college: 'CC Alpha', community_college_id: 10,
      major: 'Computer Science B.S.',
      requirement_groups: oneGroup([
        recv([opt(['calcA'])], { hash: 'r-calc', parentId: 101 }),           // calculus, 1 course
        recv([opt(['cs1a', 'cs1b'])], { hash: 'r-cs1', parentId: 102 }),     // intro programming, 2 courses
        recv([opt(['reco'])], { hash: 'r-reco', parentId: 103 }),            // will be curation-excluded
      ]),
    },
    {
      uc_school: 'UC Test', uc_school_id: 1,
      community_college: 'CC Beta', community_college_id: 20,
      major: 'Computer Science B.S.',
      requirement_groups: oneGroup([
        recv([opt(['calcB'])], { hash: 'r-calc', parentId: 101 }),
        recv([], { status: 'not_articulated', hash: 'r-cs1', parentId: 102 }), // missing intro programming
      ]),
    },
    {
      uc_school: 'UC Other', uc_school_id: 2,
      community_college: 'CC Alpha', community_college_id: 10,
      major: 'Computer Science B.S.',
      requirement_groups: oneGroup([
        recv([opt(['calcA'])], { hash: 'r-calc2', parentId: 101 }), // shares calcA with School 1
        recv([opt(['ds1'])], { hash: 'r-ds', parentId: 104 }),
      ]),
    },
    {
      // Choose-1-of-2 with an unarticulated alternative — the phantom-blocker
      // case the fix targets: articulate 1 of the 2 and the campus minimum is met.
      uc_school: 'UC Choose', uc_school_id: 3,
      community_college: 'CC Gamma', community_college_id: 30,
      major: 'Computer Science B.S.',
      requirement_groups: [{
        is_required: true, group_conjunction: 'And', group_advisement: null, group_unit_advisement: null,
        sections: [{
          section_advisement: 1, unit_advisement: null, receivers: [
            recv([opt(['calcG'])], { hash: 'r-choose-art', parentId: 201 }),
            recv([], { status: 'not_articulated', hash: 'r-choose-unart', parentId: 202 }),
          ],
        }],
      }],
    },
  ]);
  await db.collection('courses').insertMany([
    { course_id: 'calcA', units: 5, community_college_id: 10 },
    { course_id: 'cs1a', units: 3, community_college_id: 10 },
    { course_id: 'cs1b', units: 3, community_college_id: 10 },
    { course_id: 'calcB', units: 4, community_college_id: 20 },
    { course_id: 'ds1', units: 4, community_college_id: 10 },
    { course_id: 'ge1', units: 3, community_college_id: 10 },
    { course_id: 'calcG', units: 4, community_college_id: 30 },
  ]);

  // Curation: categories, an exclusion, calendars/tuition, prereqs, an ADT.
  await db.collection('curation_course_categories').insertMany([
    { _id: 101, category: 'calculus', broad: 'math' },
    { _id: 102, category: 'intro_programming', broad: 'computing' },
    { _id: 104, category: 'data_structures', broad: 'computing' },
  ]);
  await db.collection('curation_receiver_overrides').insertMany([
    { _id: 'r-reco', exclude: true },
  ]);
  await db.collection('ref_campus_calendars').insertMany([
    { _id: 1, system: 'quarter' },
    { _id: 2, system: 'semester' },
  ]);
  await db.collection('ref_tuition').insertMany([{ _id: 1, per_credit_usd: 100 }]);
  await db.collection('ref_cc_districts').insertMany([
    { _id: 10, district: 'North', region: 'Bay', counties_served: ['Alpha'] },
    { _id: 20, district: 'North', region: 'Bay', counties_served: ['Alpha', 'Beta'] },
    { _id: 30, district: 'South', region: 'Bay', counties_served: ['Gamma'] },
  ]);
  await db.collection('ref_uc_transfer_requirements').insertMany([
    {
      _id: 'uct-calc-a', school_id: 1, school: 'UC Test', uc_code: 'UCT',
      group_id: 'Calc', set_id: 'A', source_order: 0,
      receiving_code: 'CALC', parent_ids: [101], matched: true,
    },
    {
      _id: 'uco-alt-a', school_id: 2, school: 'UC Other', uc_code: 'UCO',
      group_id: 'Either', set_id: 'A', source_order: 0,
      receiving_code: 'MISSING', parent_ids: [], matched: false,
    },
    {
      _id: 'uco-alt-b', school_id: 2, school: 'UC Other', uc_code: 'UCO',
      group_id: 'Either', set_id: 'B', source_order: 1,
      receiving_code: 'DS', parent_ids: [104], matched: true,
    },
  ]);
  await db.collection('curation_prereqs').insertMany([
    { _id: 'cc:cs1b', prereqs: ['cc:cs1a'] },
    { _id: 'cc:cs1a', prereqs: [] },
  ]);
  await db.collection('curation_assoc_degrees').insertMany([
    {
      _id: '10:CS ADT', community_college_id: 10, name: 'CS ADT',
      course_ids: ['calcA', 'cs1a', 'cs1b', 'ge1'], units: null,
    },
  ]);
  await db.collection('dataset_meta').insertOne({ _id: 'current', dataset_version: 'test-v1' });
}, 60_000);

afterAll(async () => { await mongo.stop(); });

const P = { scope: 'uc', majorContains: 'computer science' };

describe('coverageData', () => {
  it('counts required receivers minus curation exclusions', async () => {
    const rows = await coverageData(db, db, P);
    const alpha = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha.receivers_required).toBe(2); // r-reco excluded
    expect(alpha.receivers_articulated).toBe(2);
    expect(alpha.fully_articulated).toBe(true);
    expect(alpha.community_college_district).toBe('North');
    expect(alpha.community_college_counties).toEqual(['Alpha']);
    const beta = rows.find((r) => r.community_college_id === 20);
    expect(beta.pct_articulated).toBe(50);
    expect(beta.fully_articulated).toBe(false);
  });

  it('honors choose-N: an unarticulated alternative does not block when the minimum is met', async () => {
    const rows = await coverageData(db, db, P);
    const gamma = rows.find((r) => r.community_college_id === 30 && r.school_id === 3);
    // section_advisement=1 (choose 1 of 2) → the true minimum is 1, and it articulates,
    // so coverage is 100% of the minimum (not the naive 1/2 receiver count).
    expect(gamma.pct_articulated).toBe(100);
    expect(gamma.fully_articulated).toBe(true);
  });

  it('groups by district/county using best-of articulation across member colleges', async () => {
    const districtRows = await coverageData(db, db, { ...P, groupBy: 'district' });
    const district = districtRows.find((r) => r.row_group_label === 'North' && r.school_id === 1);
    expect(district.community_college_ids).toEqual([10, 20]);
    expect(district.receivers_required).toBe(2);
    expect(district.receivers_articulated).toBe(2);
    expect(district.fully_articulated).toBe(true);

    const countyRows = await coverageData(db, db, { ...P, groupBy: 'county' });
    const betaCounty = countyRows.find((r) => r.row_group_label === 'Beta' && r.school_id === 1);
    expect(betaCounty.community_college_ids).toEqual([20]);
    expect(betaCounty.pct_articulated).toBe(50);
  });

  it('can evaluate curated paper requirements instead of all ASSIST-required receivers', async () => {
    const rows = await coverageData(db, db, { ...P, requirements: 'paper' });
    const beta = rows.find((r) => r.community_college_id === 20 && r.school_id === 1);
    expect(beta.requirements).toBe('paper');
    expect(beta.receivers_required).toBe(1);
    expect(beta.receivers_articulated).toBe(1);
    expect(beta.fully_articulated).toBe(true); // r-cs1 is missing, but not in the curated hard set.

    const alphaOther = rows.find((r) => r.community_college_id === 10 && r.school_id === 2);
    expect(alphaOther.requirement_groups_required).toBe(1);
    expect(alphaOther.requirement_groups_satisfied).toBe(1);
    expect(alphaOther.fully_articulated).toBe(true); // alternative set B is satisfied.
  });
});

describe('creditLossData', () => {
  it('solves min courses, joins units, flags many-to-one, normalizes calendars', async () => {
    const rows = await creditLossData(db, db, P);
    const alpha = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha.min_cc_courses).toBe(3);        // calcA + cs1a + cs1b
    expect(alpha.min_cc_units).toBe(11);         // 5 + 3 + 3
    expect(alpha.many_to_one).toBe(1);           // intro programming takes 2 CC courses
    expect(alpha.campus_calendar).toBe('quarter');
    expect(alpha.semester_equiv_required).toBe(1.33); // 2 receivers × 2/3, rounded to 2dp
    expect(alpha.district).toBe('North');
    const beta = rows.find((r) => r.community_college_id === 20);
    expect(beta.receivers_blocked).toBe(1);
  });
});

describe('choiceCostData', () => {
  it('reports incremental courses per added school, reusing overlap', async () => {
    const rows = await choiceCostData(db, db, { ...P, schoolIds: [1, 2] });
    const alpha = rows.find((r) => r.community_college_id === 10);
    const [first, second] = alpha.steps;
    expect(first.additional_courses).toBe(3);  // calcA, cs1a, cs1b
    expect(second.additional_courses).toBe(1); // ds1 only — calcA already taken
    expect(alpha.total_courses).toBe(4);
  });
});

describe('categoryGapsData', () => {
  it('rolls missing articulation up per school × category', async () => {
    const rows = await categoryGapsData(db, db, P);
    const introAtSchool1 = rows.find((r) => r.school_id === 1 && r.category === 'intro_programming');
    expect(introAtSchool1.ccs_with_requirement).toBe(2);
    expect(introAtSchool1.ccs_missing_articulation).toBe(1); // CC Beta
    expect(introAtSchool1.pct_missing).toBe(50);
    const calcAtSchool1 = rows.find((r) => r.school_id === 1 && r.category === 'calculus');
    expect(calcAtSchool1.ccs_missing_articulation).toBe(0);
  });
});

describe('complexityData', () => {
  it('computes delay/blocking over the curated prereq graph', async () => {
    const rows = await complexityData(db, db, P);
    const alpha = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha.n_courses).toBe(3);
    expect(alpha.n_prereq_edges).toBe(1); // cs1a → cs1b
    expect(alpha.max_delay).toBe(2);      // chain cs1a → cs1b
    const cs1b = alpha.per_course.find((c) => c.key === 'cc:cs1b');
    const cs1a = alpha.per_course.find((c) => c.key === 'cc:cs1a');
    expect(cs1b.delay).toBe(2);
    expect(cs1a.blocking).toBe(1);
  });
});

describe('receiversExportData', () => {
  it('flattens one row per receiver with agreement + group context and raw options', async () => {
    const rows = await receiversExportData(db, db, P);
    const alpha = rows.filter((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(alpha).toHaveLength(3); // includes the curation-excluded one — exports are raw
    const calc = alpha.find((r) => r.hash_id === 'r-calc');
    expect(calc.kind).toBe('course');
    expect(calc.parent_ids).toEqual([101]);
    expect(calc.is_required).toBe(true);
    expect(calc.articulation_status).toBe('articulated');
    expect(calc.options[0].course_ids).toEqual(['calcA']);
    const missing = rows.find((r) => r.community_college_id === 20 && r.hash_id === 'r-cs1');
    expect(missing.articulation_status).toBe('not_articulated');
    expect(missing.n_options).toBe(0);
  });

  it('honors the visibility pair scope', async () => {
    const rows = await receiversExportData(db, db, {
      ...P, visiblePairs: [{ school_id: 2, major: 'Computer Science B.S.' }],
    });
    expect(rows.every((r) => r.school_id === 2)).toBe(true);
  });
});

describe('timeToDegreeData', () => {
  it('computes the transfer credit rate + costed lost units for curated ADTs', async () => {
    const rows = await timeToDegreeData(db, db, P);
    const adt = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    expect(adt.assoc_degree).toBe('CS ADT');
    expect(adt.assoc_degree_units).toBe(14);   // 5+3+3+3
    expect(adt.transferable_units).toBe(11);   // ge1 doesn't map
    expect(adt.transfer_credit_rate_pct).toBeCloseTo(78.6, 1);
    expect(adt.lost_units).toBe(3);
    expect(adt.est_lost_cost_usd).toBe(300);
  });
});
