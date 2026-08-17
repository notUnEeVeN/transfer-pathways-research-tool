import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const { pathwayComplexityData } = cjs('./pathwayComplexity');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('pathway_complexity_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

// Real configured pair (UCSC × cs) so the config-driven scoping resolves; every
// document below is synthetic.
const SCHOOL = 132;
const PROGRAM = 'Computer Science B.S.';

async function seed() {
  await db.collection('curated_requirements').insertMany([
    {
      _id: `degree:${SCHOOL}:cs`,
      kind: 'degree',
      major_slug: 'cs',
      school_id: SCHOOL,
      school: 'UC Santa Cruz',
      unit_system: 'quarter',
      requirement_groups: [
        {
          title: 'Lower-division major requirements',
          tier: 'transferable',
          category: 'lower-division',
          sections: [{
            category: 'lower-division',
            unit_advisement: 5,
            receivers: [{ receiving: { kind: 'course', parent_id: 1 } }],
          }],
        },
        {
          title: 'Upper-division major requirements',
          tier: 'nontransferable',
          category: 'upper-division',
          sections: [
            {
              category: 'upper-division',
              unit_advisement: 5,
              receivers: [{ receiving: { kind: 'requirement', code: 'CSE 101', name: 'CSE 101' } }],
            },
            {
              category: 'upper-division',
              unit_advisement: 10,
              eligibility: { rule: 'catalogue pool', subject: 'computing', courses_required: 2 },
              receivers: [{ receiving: { kind: 'requirement', name: 'Two upper-division electives' } }],
            },
          ],
        },
      ],
    },
    {
      _id: 'as_degree:5:cs:ast',
      kind: 'as_degree',
      major_slug: 'cs',
      degree_type: 'ast',
      community_college_id: 5,
      requirement_groups: [{
        sections: [{
          unit_advisement: 5,
          receivers: [{
            articulation_status: 'articulated',
            options: [{ course_ids: [501], course_conjunction: 'and' }],
          }],
        }],
      }],
    },
  ]);
  await db.collection('assist_agreements').insertOne({
    _id: 'ag1',
    uc_school_id: SCHOOL,
    community_college_id: 5,
    major: PROGRAM,
    requirement_groups: [{
      sections: [{
        receivers: [{
          receiving: { kind: 'course', parent_id: 1 },
          articulation_status: 'articulated',
          options: [{ course_ids: [501] }],
        }],
      }],
    }],
  });
  await db.collection('curated_prerequisites').insertMany([
    { _id: `uc:${SCHOOL}:CSE 12`, course_id: `uc:${SCHOOL}:CSE 12`, institution_id: `uc:${SCHOOL}`, course_code: 'CSE 12', units: 5, prerequisite_ids: [], status: 'resolved' },
    { _id: `uc:${SCHOOL}:CSE 101`, course_id: `uc:${SCHOOL}:CSE 101`, institution_id: `uc:${SCHOOL}`, course_code: 'CSE 101', units: 5, prerequisite_ids: [`uc:${SCHOOL}:CSE 12`], status: 'resolved' },
  ]);
  await db.collection('assist_courses').insertMany([
    { _id: 'r1', institution_id: `uc:${SCHOOL}`, source_id: 1, side: 'receiving', parent_id: 1, prefix: 'CSE', number: '12' },
    { _id: 's1', institution_id: 'cc:x', source_id: 501, side: 'sending', course_id: 501, units: 5 },
  ]);
  await db.collection('assist_institutions').insertOne({
    _id: 'cc:5', kind: 'community_college', source_id: 5, name: 'Test College',
  });
}

describe('pathwayComplexityData', () => {
  it('consumes covered requirements, rewires their edges to the CC courses, and scores pools as slots', async () => {
    await seed();
    const rows = await pathwayComplexityData(db, null, { majorSlug: 'cs', degreeType: 'ast' });
    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(row.college_name).toBe('Test College');
    // CSE 12 was articulated and the AS carried its sending course, so it left
    // the pathway (consumed) — the pathway is the CC course, the named upper
    // course, and the two pool slots.
    expect(row.requirements_consumed).toBe(1);
    expect(row.n_courses).toBe(4);
    expect(row.n_placeholder).toBe(2);
    // CSE 101's prerequisite pointed at CSE 12, which the CC course replaced:
    // the edge must REWIRE, not vanish.
    expect(row.n_edges).toBe(1);
    // cc:501 (delay 2 + blocking 1 = 3) + CSE 101 (delay 2 + blocking 0 = 2)
    // + two isolated slots (delay 1 + blocking 0 = 1 each) — the same
    // arithmetic the validated module used to reproduce the paper 58/60.
    expect(row.complexity).toBe(7);
    // The resident pathway has the same shape (CSE 12 → CSE 101 + slots), so
    // this minimal transfer is complexity-neutral.
    expect(row.resident_complexity).toBe(7);
    expect(row.delta_vs_resident).toBe(0);
  });

  it('keeps unarticulated requirements as university vertices (the offerings gap)', async () => {
    await seed();
    // Remove the articulation: the AS still has the course, but nothing maps it.
    await db.collection('assist_agreements').updateOne({ _id: 'ag1' }, {
      $set: { 'requirement_groups.0.sections.0.receivers.0.articulation_status': 'not_articulated' },
    });
    const rows = await pathwayComplexityData(db, null, { majorSlug: 'cs', degreeType: 'ast' });
    const row = rows[0];
    expect(row.requirements_consumed).toBe(0);
    // CSE 12 stays in the pathway alongside the CC course that could not be applied.
    expect(row.n_courses).toBe(5);
    expect(row.n_edges).toBe(1); // CSE 101 -> CSE 12, unrewired
  });
});
