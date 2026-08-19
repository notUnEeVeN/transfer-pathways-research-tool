import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const {
  AMBIGUOUS_UNIT_POOL, assemblePathway, asDegreeCourseIds,
  pathwayComplexityData, resolveCcParents, resolveUcParents, scorePathway,
} = cjs('./pathwayComplexity');

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
      status: 'found',
      major_slug: 'cs',
      degree_type: 'ast',
      community_college_id: 5,
      requirement_groups: [{
        sections: [{
          section_advisement: 1,
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
    // arithmetic used by the independently validated graph scorer.
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

  it('can restrict the live cohort to explicitly verified associate-degree sources', async () => {
    await seed();
    expect(await pathwayComplexityData(db, null, {
      majorSlug: 'cs', degreeType: 'ast', verifiedOnly: true,
    })).toEqual([]);

    await db.collection('curated_requirements').updateOne(
      { _id: 'as_degree:5:cs:ast' },
      { $set: { 'verification.verified': true } },
    );
    const rows = await pathwayComplexityData(db, null, {
      majorSlug: 'cs', degreeType: 'ast', verifiedOnly: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source_verified: true });
  });

  it('excludes no-degree sentinel records even when they carry a verified flag', async () => {
    await seed();
    const source = await db.collection('curated_requirements')
      .findOne({ _id: 'as_degree:5:cs:ast' });
    await db.collection('curated_requirements').insertOne({
      ...source,
      _id: 'as_degree:5:cs:ast:none-found',
      status: 'none_found',
      verification: { verified: true },
    });
    await db.collection('curated_requirements').updateOne(
      { _id: 'as_degree:5:cs:ast' },
      { $set: { 'verification.verified': true } },
    );

    const rows = await pathwayComplexityData(db, null, {
      majorSlug: 'cs', degreeType: 'ast', verifiedOnly: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].record_id).toBe('as_degree:5:cs:ast');
  });
});

describe('UC prerequisite choice semantics', () => {
  const inSet = new Set(['uc:a', 'uc:b', 'uc:c', 'cc:replacement']);

  it('keeps one available alternative from each required prerequisite group', () => {
    expect(resolveUcParents({
      prerequisiteGroups: [['uc:a', 'uc:b'], ['uc:c']],
      legacyIds: ['uc:a', 'uc:b', 'uc:c'],
      inSet,
      substitution: new Map(),
    })).toEqual(['uc:a', 'uc:c']);
  });

  it('uses the first in-path alternative and follows an articulated substitution', () => {
    expect(resolveUcParents({
      prerequisiteGroups: [['uc:missing', 'uc:b'], ['uc:replaced', 'uc:c']],
      legacyIds: [],
      inSet,
      substitution: new Map([['uc:replaced', ['cc:replacement']]]),
    })).toEqual(['uc:b', 'cc:replacement']);
  });

  it('preserves flat prerequisite ids for legacy rows without grouped data', () => {
    expect(resolveUcParents({
      prerequisiteGroups: undefined,
      legacyIds: ['uc:a', 'uc:b', 'uc:missing'],
      inSet,
      substitution: new Map(),
    })).toEqual(['uc:a', 'uc:b']);
  });

  it('selects only the prerequisite edge without removing independently required alternatives', () => {
    const vertices = new Map([
      ['uc:a', { kind: 'uc', catalogId: 'uc:a' }],
      ['uc:b', { kind: 'uc', catalogId: 'uc:b' }],
      ['uc:c', { kind: 'uc', catalogId: 'uc:c' }],
    ]);
    const score = scorePathway({ vertices, substitution: new Map() }, {
      ccPrereqs: new Map(),
      ucPrereqsById: new Map([['uc:c', ['uc:a', 'uc:b']]]),
      ucPrerequisiteGroupsById: new Map([['uc:c', [['uc:a', 'uc:b']]]]),
    });
    expect(score).toMatchObject({ n_courses: 3, n_edges: 1 });
  });
});

describe('community-college prerequisite choice semantics', () => {
  const inSet = new Set(['cc:intro-a', 'cc:intro-b', 'cc:math']);

  it('chooses one in-path course from each required concept group', () => {
    expect(resolveCcParents({
      prerequisiteGroups: [
        { concept: 'intro programming', anyOf: ['cc:intro-a', 'cc:intro-b'] },
        { concept: 'calculus', anyOf: ['cc:missing', 'cc:math'] },
      ],
      legacyIds: ['cc:intro-a', 'cc:intro-b', 'cc:math'],
      inSet,
    })).toEqual(['cc:intro-a', 'cc:math']);
  });

  it('preserves flat projected edges when grouped data is unavailable', () => {
    expect(resolveCcParents({
      prerequisiteGroups: undefined,
      legacyIds: ['cc:intro-a', 'cc:intro-b', 'cc:missing'],
      inSet,
    })).toEqual(['cc:intro-a', 'cc:intro-b']);
  });
});

describe('receiving-series articulation', () => {
  it('consumes one sending option once for the whole UC series and rewires every member', () => {
    const articulation = { options: [[501]], parentIds: [1, 2] };
    const pathway = assemblePathway({
      degree: {
        requirement_groups: [{
          tier: 'transferable',
          sections: [{
            category: 'lower-division',
            receivers: [
              { receiving: { kind: 'course', parent_id: 1 } },
              { receiving: { kind: 'course', parent_id: 2 } },
              { receiving: { kind: 'course', parent_id: 3 } },
            ],
          }],
        }],
      },
      asIds: [501],
      agreementByParent: new Map([[1, articulation], [2, articulation]]),
      ucCatalog: new Map([
        ['UC 1', { id: 'uc:1', units: 4 }],
        ['UC 2', { id: 'uc:2', units: 4 }],
        ['UC 3', { id: 'uc:3', units: 4 }],
      ]),
      ucCodeByParent: new Map([[1, 'UC 1'], [2, 'UC 2'], [3, 'UC 3']]),
      ccUnits: new Map([[501, 4]]),
    });

    expect([...pathway.vertices.keys()]).toEqual(['cc:501', 'uc:3']);
    expect(pathway.consumed).toBe(2);
    expect(pathway.substitution).toEqual(new Map([
      ['uc:1', ['cc:501']],
      ['uc:2', ['cc:501']],
    ]));

    const score = scorePathway(pathway, {
      ccPrereqs: new Map([['cc:501', []]]),
      ucPrereqsById: new Map([['uc:3', ['uc:2']]]),
      ucPrerequisiteGroupsById: new Map([['uc:3', [['uc:2']]]]),
    });
    expect(score).toMatchObject({ n_courses: 2, n_edges: 1, complexity: 5 });
  });
});

describe('associate-degree course selection', () => {
  const receiver = (id) => ({ options: [{ course_ids: [id] }] });
  const unitPool = {
    requirement_groups: [{
      label_seen: 'Support Courses — select 6 units',
      sections: [{
        unit_advisement: 6,
        receivers: [receiver(1), receiver(2), receiver(3), receiver(4)],
      }],
    }],
  };
  const units = new Map([[1, 3], [2, 3], [3, 3], [4, 3]]);

  it('fails closed when a named choose-by-unit pool does not preserve its grouping', () => {
    expect(asDegreeCourseIds(unitPool, units)).toMatchObject({
      ids: [],
      method_status: 'excluded',
      exclusion_reason: AMBIGUOUS_UNIT_POOL,
    });
  });

  it('uses the shared exact subset selector for an explicitly requested diagnostic', () => {
    const selection = asDegreeCourseIds(unitPool, units, { strictUnitPools: false });
    expect(selection).toMatchObject({
      ids: [1, 2],
      selected_units: 6,
      method_status: 'ok',
    });
  });

  it('keeps a Foothill-shaped A.S.-T at ten courses and rejects the flattened local A.S. pools', () => {
    const ast = {
      requirement_groups: [{
        label_seen: 'Core and support courses',
        sections: [{ section_advisement: 10, receivers: Array.from({ length: 10 }, (_, i) => receiver(100 + i)) }],
      }],
    };
    const astUnits = new Map(Array.from({ length: 10 }, (_, i) => [100 + i, i < 4 ? 4.5 : 5]));
    expect(asDegreeCourseIds(ast, astUnits)).toMatchObject({
      ids: Array.from({ length: 10 }, (_, i) => 100 + i),
      method_status: 'ok',
    });

    const localAs = {
      requirement_groups: [
        { label_seen: 'Core', sections: [{ section_advisement: 5, receivers: Array.from({ length: 5 }, (_, i) => receiver(200 + i)) }] },
        { label_seen: 'Programming sequences', sections: [{ unit_advisement: 13.5, receivers: Array.from({ length: 9 }, (_, i) => receiver(300 + i)) }] },
        { label_seen: 'Support Courses', sections: [{ unit_advisement: 18, receivers: Array.from({ length: 48 }, (_, i) => receiver(400 + i)) }] },
      ],
    };
    expect(asDegreeCourseIds(localAs, new Map())).toMatchObject({
      method_status: 'excluded',
      exclusion_reason: AMBIGUOUS_UNIT_POOL,
    });
  });
});
