import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const { transferCreditRateData } = cjs('./transferCreditRate');

let mongo;
let db;

const recv = (parentId, options, status = 'articulated') => ({
  receiving: { kind: 'course', parent_id: parentId },
  articulation_status: status,
  options: options.map((ids) => ({ course_ids: ids, course_conjunction: 'and' })),
});

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('transfer_credit_rate_test');

  // Campus template requiring parents 101 (calc), 102 (physics), 103 (cs1),
  // plus GE-satisfiable breadth: 2 H/SS courses + 2 R&C courses at the
  // assumed ~4u each → 16u of GE demand. The assume-satisfiable AHI slot
  // needs no coursework, so it adds none.
  await db.collection('curated_requirements').insertOne({
    _id: 'degree:1', kind: 'degree', school_id: 1, school: 'UC Test',
    requirement_groups: [
      {
        sections: [{
          receivers: [
            { receiving: { kind: 'course', parent_id: 101 } },
            { receiving: { kind: 'course', parent_id: 102 } },
            { receiving: { kind: 'course', parent_id: 103 } },
          ],
        }],
      },
      {
        title: 'Breadth', sections: [
          { section_advisement: 2, receivers: [{ receiving: { kind: 'ge_area', code: 'H/SS', name: 'H/SS breadth' } }] },
          { section_advisement: 2, receivers: [{ receiving: { kind: 'ge_area', code: 'R&C', name: 'Reading & Composition' } }] },
          { section_advisement: 1, receivers: [{ receiving: { kind: 'ge_area', code: 'AHI', name: 'American History & Institutions' }, assume_satisfiable: true }] },
        ],
      },
    ],
  });

  // College 10's local CS A.S.:
  //   - calc (5u, transfers via parent 101)
  //   - phys A only (4u) — the campus needs the FULL series [physA, physB],
  //     so the series guard keeps it from transferring
  //   - choose 1 of {cs1-heavy 4u, cs1-light 3u} — both transfer via 103, the
  //     lower-unit pick must win
  //   - Cal-GETC block, stated 30 units → verified
  //   - electives-to-total group → excluded from both sides
  await db.collection('curated_requirements').insertOne({
    _id: 'asd:10', kind: 'as_degree', degree_type: 'local_cs_as', status: 'found',
    community_college_id: 10, college_id: 'cc:10',
    requirement_groups: [
      {
        ge_area: null, units_fill: false,
        sections: [
          { section_advisement: 2, receivers: [recv(null, [[1]]), recv(null, [[2]])] },
          { section_advisement: 1, receivers: [recv(null, [[3]]), recv(null, [[4]])] },
        ],
      },
      { ge_area: 'calgetc', units_fill: false, sections: [{ unit_advisement: 30, receivers: [] }] },
      { ge_area: null, units_fill: true, sections: [] },
    ],
  });

  // College 20's local CS A.S.: one 4-unit articulating course, local GE
  // pattern (18u, unverifiable — denominator only).
  await db.collection('curated_requirements').insertOne({
    _id: 'asd:20', kind: 'as_degree', degree_type: 'local_cs_as', status: 'found',
    community_college_id: 20, college_id: 'cc:20',
    requirement_groups: [
      { ge_area: null, units_fill: false, sections: [{ section_advisement: 1, receivers: [recv(null, [[5]])] }] },
      { ge_area: 'local_pattern', units_fill: false, sections: [{ unit_advisement: 18, receivers: [] }] },
    ],
  });

  // College 30's local CS A.S. has NO agreement with UC Test → null cell.
  await db.collection('curated_requirements').insertOne({
    _id: 'asd:30', kind: 'as_degree', degree_type: 'local_cs_as', status: 'found',
    community_college_id: 30, college_id: 'cc:30',
    requirement_groups: [
      { ge_area: null, units_fill: false, sections: [{ section_advisement: 1, receivers: [recv(null, [[5]])] }] },
    ],
  });

  // College 50's local pattern states NO unit count (the Santiago case) —
  // the Title 5 statutory 18u minimum stands in, so GE never drops to zero.
  await db.collection('curated_requirements').insertOne({
    _id: 'asd:50', kind: 'as_degree', degree_type: 'local_cs_as', status: 'found',
    community_college_id: 50, college_id: 'cc:50',
    requirement_groups: [
      { ge_area: null, units_fill: false, sections: [{ section_advisement: 1, receivers: [recv(null, [[5]])] }] },
      { ge_area: 'local_pattern', units_fill: false, sections: [{ unit_advisement: null, receivers: [] }] },
    ],
  });

  // An A.S.-T at college 10 so the other degree_type has its own cohort.
  await db.collection('curated_requirements').insertOne({
    _id: 'asd:10:ast', kind: 'as_degree', degree_type: 'ast', status: 'found',
    community_college_id: 10, college_id: 'cc:10',
    requirement_groups: [
      { ge_area: null, units_fill: false, sections: [{ section_advisement: 1, receivers: [recv(null, [[1]])] }] },
      { ge_area: 'calgetc', units_fill: false, sections: [{ unit_advisement: 34, receivers: [] }] },
    ],
  });

  await db.collection('assist_agreements').insertMany([
    {
      uc_school_id: 1, community_college_id: 10,
      requirement_groups: [{
        sections: [{
          receivers: [
            recv(101, [[1]]),          // calc articulates
            recv(102, [[2, 9]]),       // physics needs course 9 too — degree lacks it
            recv(103, [[3], [4]]),     // either cs1 variant articulates
          ],
        }],
      }],
    },
    {
      uc_school_id: 1, community_college_id: 20,
      requirement_groups: [{
        sections: [{ receivers: [recv(101, [[5]])] }],
      }],
    },
    {
      uc_school_id: 1, community_college_id: 50,
      requirement_groups: [{
        sections: [{ receivers: [recv(101, [[5]])] }],
      }],
    },
  ]);

  await db.collection('assist_courses').insertMany([
    { side: 'sending', course_id: 1, units: 5 },
    { side: 'sending', course_id: 2, units: 4 },
    { side: 'sending', course_id: 3, units: 4 },
    { side: 'sending', course_id: 4, units: 3 },
    { side: 'sending', course_id: 5, units: 4 },
    { side: 'sending', course_id: 9, units: 4 },
  ]);
  await db.collection('assist_institutions').insertMany([
    { kind: 'community_college', source_id: 10, name: 'CC Alpha' },
    { kind: 'community_college', source_id: 20, name: 'CC Beta' },
  ]);
}, 60_000);

afterAll(async () => { await mongo.stop(); });

describe('transferCreditRateData', () => {
  it('applies the series guard, lower-unit choose-N, GE verification, and elective exclusion', async () => {
    const rows = await transferCreditRateData(db, null, { degreeType: 'local_cs_as' });
    const cell = rows.find((r) => r.community_college_id === 10 && r.school_id === 1);
    // Named picks: calc 5u (transfers), physA 4u (blocked by the series
    // guard), cs1-light 3u (lower-unit transferring pick beats the 4u one).
    expect(cell.named_units).toBe(12);
    expect(cell.named_transferred_units).toBe(8);
    // GE: Cal-GETC states 30u, but the campus can only absorb its 16u of
    // GE-satisfiable demand — the rest is lost credit. Electives add nothing.
    expect(cell.ge_units).toBe(30);
    expect(cell.ge_demand_units).toBe(16);
    expect(cell.ge_counted_units).toBe(16);
    expect(cell.ge_verified_units).toBe(16);
    expect(cell.ge_assumed_units).toBe(0);
    expect(cell.prescribed_units).toBe(42);
    expect(cell.transferred_units).toBe(24);
    expect(cell.rate).toBe(+((100 * 24) / 42).toFixed(1));
  });

  it('counts a local GE pattern on the ASSUMED basis, capped at campus demand', async () => {
    const rows = await transferCreditRateData(db, null, { degreeType: 'local_cs_as' });
    const cell = rows.find((r) => r.community_college_id === 20 && r.school_id === 1);
    // Named 4u transfers; of the 18u local GE, only the campus's 16u of
    // GE-satisfiable demand counts — assumed basis, labeled as such.
    expect(cell.ge_units).toBe(18);
    expect(cell.ge_counted_units).toBe(16);
    expect(cell.ge_verified_units).toBe(0);
    expect(cell.ge_assumed_units).toBe(16);
    expect(cell.prescribed_units).toBe(22);
    expect(cell.transferred_units).toBe(20);
    expect(cell.rate).toBe(+((100 * 20) / 22).toFixed(1));
  });

  it('defaults an unsized local GE block to the Title 5 statutory 18u minimum', async () => {
    const rows = await transferCreditRateData(db, null, { degreeType: 'local_cs_as' });
    const cell = rows.find((r) => r.community_college_id === 50 && r.school_id === 1);
    // No stated unit ask — the statutory minimum stands in instead of zero.
    expect(cell.ge_units).toBe(18);
    expect(cell.ge_counted_units).toBe(16);
    expect(cell.prescribed_units).toBe(22);
    expect(cell.transferred_units).toBe(20);
    expect(cell.rate).toBe(+((100 * 20) / 22).toFixed(1));
  });

  it('returns a null cell when the pair has no agreement (unverifiable, not zero)', async () => {
    const rows = await transferCreditRateData(db, null, { degreeType: 'local_cs_as' });
    const cell = rows.find((r) => r.community_college_id === 30 && r.school_id === 1);
    expect(cell.rate).toBeNull();
    expect(cell.prescribed_units).toBeNull();
  });

  it('counts an unlabelled general-education unit block on the assumed basis', async () => {
    // GE recognized only by its catalog label — no ge_area pattern tag.
    await db.collection('curated_requirements').insertOne({
      _id: 'asd:40', kind: 'as_degree', degree_type: 'local_cs_as', status: 'found',
      community_college_id: 40, college_id: 'cc:40',
      requirement_groups: [
        { ge_area: null, units_fill: false, sections: [{ section_advisement: 1, receivers: [recv(null, [[5]])] }] },
        { ge_area: null, units_fill: false, label_seen: 'General Education Requirements',
          sections: [{ unit_advisement: 20, receivers: [] }] },
      ],
    });
    await db.collection('assist_agreements').insertOne({
      uc_school_id: 1, community_college_id: 40,
      requirement_groups: [{ sections: [{ receivers: [recv(101, [[5]])] }] }],
    });

    const rows = await transferCreditRateData(db, null, { degreeType: 'local_cs_as' });
    const cell = rows.find((r) => r.community_college_id === 40 && r.school_id === 1);
    expect(cell.ge_units).toBe(20);
    expect(cell.ge_counted_units).toBe(16);
    expect(cell.ge_verified_units).toBe(0);
    expect(cell.ge_assumed_units).toBe(16);
    expect(cell.prescribed_units).toBe(24); // named 4u + unlabelled GE 20u
    expect(cell.transferred_units).toBe(20);
    expect(cell.rate).toBe(+((100 * 20) / 24).toFixed(1));
  });

  it('scopes to the requested degree type', async () => {
    const rows = await transferCreditRateData(db, null, { degreeType: 'ast' });
    expect(rows).toHaveLength(1);
    const cell = rows[0];
    expect(cell.record_id).toBe('asd:10:ast');
    // calc 5u transfers + Cal-GETC capped at the campus's 16u GE demand.
    expect(cell.prescribed_units).toBe(39);
    expect(cell.transferred_units).toBe(21);
    expect(cell.rate).toBe(+((100 * 21) / 39).toFixed(1));
  });
});
