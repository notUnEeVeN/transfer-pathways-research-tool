import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const { transferCreditRateData } = cjs('./transferCreditRate');

let mongo;
let db;

const asReceiver = (...courseIds) => ({
  receiving: { kind: 'requirement', parent_id: null },
  articulation_status: null,
  options: courseIds.map((courseId) => ({ course_ids: [courseId], course_conjunction: 'and' })),
});

const articulated = (receiving, ...options) => ({
  receiving,
  articulation_status: 'articulated',
  options: options.map((courseIds) => ({ course_ids: courseIds, course_conjunction: 'and' })),
});

const ucCourse = (parentId, extra = {}) => ({
  receiving: { kind: 'course', parent_id: parentId },
  ...extra,
});

const ucSeries = (...parentIds) => ({
  receiving: { kind: 'series', parent_ids: parentIds, conjunction: 'and' },
});

const geReceiver = (code, { assume = false, areas = [] } = {}) => ({
  receiving: { kind: 'ge_area', code, name: code },
  ge_areas: areas,
  assume_satisfiable: assume,
});

const namedGroup = (sections, title = 'Required courses') => ({
  title,
  tier: 'transferable',
  sections,
});

const asNamedGroup = (sections, label = 'Required courses') => ({
  label_seen: label,
  ge_area: null,
  units_fill: false,
  sections,
});

const asGeGroup = (units, pattern = 'calgetc') => ({
  label_seen: 'General Education',
  ge_area: pattern,
  units_fill: false,
  sections: [{ section_advisement: null, unit_advisement: units, receivers: [] }],
});

async function seedTemplate({
  schoolId,
  school = `UC ${schoolId}`,
  program = 'Computer Science, B.S.',
  totalUnits = 120,
  groups,
}) {
  await db.collection('curated_requirements').insertOne({
    _id: `degree:${schoolId}`,
    kind: 'degree',
    school_id: schoolId,
    school,
    program,
    total_units: totalUnits,
    requirement_groups: groups,
  });
  await db.collection('assist_institutions').insertOne({
    _id: `uc:${schoolId}`,
    kind: 'university',
    source_id: schoolId,
    name: school,
  });
}

async function seedAsDegree({
  collegeId,
  degreeType = 'local_cs_as',
  totalUnits = 60,
  unitSystem = 'semester',
  groups,
}) {
  await db.collection('curated_requirements').insertOne({
    _id: `as_degree:${collegeId}:${degreeType}`,
    kind: 'as_degree',
    degree_type: degreeType,
    status: 'found',
    community_college_id: collegeId,
    college_id: `cc:${collegeId}`,
    college_name: `College ${collegeId}`,
    total_units: totalUnits,
    unit_system: unitSystem,
    requirement_groups: groups,
  });
  await db.collection('assist_institutions').insertOne({
    _id: `cc:${collegeId}`,
    kind: 'community_college',
    source_id: collegeId,
    name: `College ${collegeId}`,
  });
}

async function seedCourses(rows) {
  if (!rows.length) return;
  await db.collection('assist_courses').insertMany(rows.map(([courseId, units, ucTransferable = true]) => ({
    _id: `sending:${courseId}`,
    side: 'sending',
    course_id: courseId,
    units,
    uc_transferable: ucTransferable,
  })));
}

async function seedAgreement({ schoolId, collegeId, major = 'Computer Science B.S.', receivers = [] }) {
  await db.collection('assist_agreements').insertOne({
    uc_school_id: schoolId,
    community_college_id: collegeId,
    major,
    requirement_groups: [{ sections: [{ receivers }] }],
  });
}

async function cellFor({ collegeId, schoolId, degreeType = 'local_cs_as' }) {
  const rows = await transferCreditRateData(db, null, { degreeType });
  return rows.find((row) => row.community_college_id === collegeId && row.school_id === schoolId);
}

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('transfer_credit_rate_test');
}, 60_000);

beforeEach(async () => {
  await db.dropDatabase();
});

afterAll(async () => {
  await mongo.stop();
});

describe('transferCreditRateData v2', () => {
  it('uses the whole associate degree as the denominator and applies direct, GE, and elective units once', async () => {
    await seedTemplate({
      schoolId: 1,
      groups: [
        namedGroup([{ section_advisement: 1, receivers: [ucCourse(101)] }]),
        {
          title: 'Breadth', tier: 'breadth', sections: [
            { section_advisement: 2, receivers: [geReceiver('GE', { areas: ['3A', '4'] })] },
          ],
        },
        {
          title: 'Unrestricted electives', tier: 'transferable', sections: [
            { section_advisement: 1, unit_advisement: 6, receivers: [geReceiver('ELECTIVE', { assume: true })] },
          ],
        },
      ],
    });
    await seedAsDegree({
      collegeId: 10,
      groups: [
        asNamedGroup([{ section_advisement: 1, receivers: [asReceiver(1)] }]),
        asGeGroup(20),
        { label_seen: 'Electives to degree total', ge_area: null, units_fill: true, sections: [] },
      ],
    });
    await seedCourses([[1, 4]]);
    await seedAgreement({
      schoolId: 1,
      collegeId: 10,
      receivers: [articulated({ kind: 'course', parent_id: 101 }, [1])],
    });

    const cell = await cellFor({ collegeId: 10, schoolId: 1 });
    expect(cell.prescribed_units).toBe(60);
    expect(cell.as_total_units).toBe(60);
    expect(cell.named_transferred_units).toBe(4);
    expect(cell.ge_counted_units).toBe(8);
    expect(cell.elective_counted_units).toBe(6);
    expect(cell.transferred_units).toBe(18);
    expect(cell.rate).toBe(30);
    expect(cell.extra_units).toBe(42);
    expect(cell.extra_units_semester).toBe(42);
    expect(cell.method_status).toBe('estimated');
    expect(cell.method_warning).toMatch(/elective credit assumes/i);
    expect(cell.transferred_units).toBeLessThanOrEqual(cell.as_total_units);
    expect(cell.rate).toBeGreaterThanOrEqual(0);
    expect(cell.rate).toBeLessThanOrEqual(100);
  });

  it('solves a true unit-based associate-degree choice pool instead of taking every listed course', async () => {
    await seedTemplate({
      schoolId: 2,
      groups: [namedGroup([{
        section_advisement: 2,
        receivers: [ucCourse(201), ucCourse(202)],
      }])],
    });
    await seedAsDegree({
      collegeId: 20,
      groups: [asNamedGroup([{
        section_advisement: null,
        unit_advisement: 6,
        receivers: [asReceiver(2), asReceiver(3), asReceiver(4), asReceiver(5)],
      }], 'Select 6 units from the following')],
    });
    await seedCourses([[2, 3], [3, 3], [4, 3], [5, 3]]);
    await seedAgreement({
      schoolId: 2,
      collegeId: 20,
      receivers: [
        articulated({ kind: 'course', parent_id: 201 }, [2]),
        articulated({ kind: 'course', parent_id: 202 }, [3]),
      ],
    });

    const cell = await cellFor({ collegeId: 20, schoolId: 2 });
    expect(cell.named_units).toBe(6);
    expect(cell.named_transferred_units).toBe(6);
    expect(cell.transferred_units).toBe(6);
    expect(cell.rate).toBe(10);
    expect(cell.extra_units).toBe(54);
  });

  it('uses only the agreement whose normalized major matches the UC degree template', async () => {
    await seedTemplate({
      schoolId: 3,
      program: 'Computer Science, B.S. (CS26)',
      groups: [namedGroup([{
        section_advisement: 2,
        receivers: [ucCourse(301), ucCourse(302)],
      }])],
    });
    await seedAsDegree({
      collegeId: 30,
      groups: [asNamedGroup([{
        section_advisement: 2,
        receivers: [asReceiver(6), asReceiver(7)],
      }])],
    });
    await seedCourses([[6, 4], [7, 4]]);
    await seedAgreement({
      schoolId: 3,
      collegeId: 30,
      major: 'CSE: Computer Science B.S.',
      receivers: [articulated({ kind: 'course', parent_id: 301 }, [6])],
    });
    await seedAgreement({
      schoolId: 3,
      collegeId: 30,
      major: 'Mathematics/Computer Science B.S.',
      receivers: [articulated({ kind: 'course', parent_id: 302 }, [7])],
    });

    const cell = await cellFor({ collegeId: 30, schoolId: 3 });
    expect(cell.named_units).toBe(8);
    expect(cell.named_transferred_units).toBe(4);
    expect(cell.transferred_units).toBe(4);
    expect(cell.method_warning || '').not.toMatch(/major fallback/i);
  });

  it('excludes adjacent CS programs when called with the configured CS slug', async () => {
    await seedTemplate({
      schoolId: 79,
      school: 'UC Berkeley',
      program: 'Electrical Engineering & Computer Sciences, B.S.',
      groups: [namedGroup([{
        section_advisement: 1,
        receivers: [ucCourse(7901)],
      }])],
    });
    await seedAsDegree({
      collegeId: 79,
      groups: [asNamedGroup([{
        section_advisement: 1,
        receivers: [asReceiver(790)],
      }])],
    });
    await seedCourses([[790, 4]]);
    await seedAgreement({
      schoolId: 79,
      collegeId: 79,
      major: 'Electrical Engineering & Computer Sciences, B.S.',
      receivers: [],
    });
    await seedAgreement({
      schoolId: 79,
      collegeId: 79,
      major: 'Computer Science, B.A.',
      receivers: [articulated({ kind: 'course', parent_id: 7901 }, [790])],
    });
    await db.collection('curated_requirements').insertOne({
      _id: 'degree:79:cs-mislabeled',
      kind: 'degree',
      major_slug: 'cs',
      school_id: 79,
      school: 'UC Berkeley',
      program: 'Computer Science, B.A.',
      total_units: 120,
      requirement_groups: [namedGroup([{
        section_advisement: 1,
        receivers: [ucCourse(7901)],
      }])],
    });

    const rows = await transferCreditRateData(db, null, {
      degreeType: 'local_cs_as', majorSlug: 'cs',
    });
    const scoped = rows.filter((row) => row.community_college_id === 79 && row.school_id === 79);
    expect(scoped).toHaveLength(1);
    const [cell] = scoped;
    expect(cell).toMatchObject({ major_slug: 'cs', named_transferred_units: 0 });
  });

  it('enforces UC choose-N capacity and requires the complete sending option for a series', async () => {
    await seedTemplate({
      schoolId: 4,
      groups: [namedGroup([
        { section_advisement: 1, receivers: [ucCourse(401), ucCourse(402)] },
        { section_advisement: 1, receivers: [ucSeries(403, 404)] },
      ])],
    });
    await seedAsDegree({
      collegeId: 40,
      groups: [asNamedGroup([{
        section_advisement: 3,
        receivers: [asReceiver(8), asReceiver(9), asReceiver(10)],
      }])],
    });
    await seedCourses([[8, 3], [9, 3], [10, 3], [11, 3]]);
    await seedAgreement({
      schoolId: 4,
      collegeId: 40,
      receivers: [
        articulated({ kind: 'course', parent_id: 401 }, [8]),
        articulated({ kind: 'course', parent_id: 402 }, [9]),
        articulated({ kind: 'series', parent_ids: [403, 404], conjunction: 'and' }, [10, 11]),
      ],
    });

    const incomplete = await cellFor({ collegeId: 40, schoolId: 4 });
    expect(incomplete.named_units).toBe(9);
    expect(incomplete.named_transferred_units).toBe(3);

    await seedAsDegree({
      collegeId: 41,
      groups: [asNamedGroup([{
        section_advisement: 4,
        receivers: [asReceiver(8), asReceiver(9), asReceiver(10), asReceiver(11)],
      }])],
    });
    await seedAgreement({
      schoolId: 4,
      collegeId: 41,
      receivers: [
        articulated({ kind: 'course', parent_id: 401 }, [8]),
        articulated({ kind: 'course', parent_id: 402 }, [9]),
        articulated({ kind: 'series', parent_ids: [403, 404], conjunction: 'and' }, [10, 11]),
      ],
    });

    const complete = await cellFor({ collegeId: 41, schoolId: 4 });
    expect(complete.named_units).toBe(12);
    // The 6u sending bundle satisfies one default 4u UC series slot. Its 2u
    // excess is not named-requirement credit unless explicit elective room
    // absorbs it, so 3u from choose-one + 4u from the series = 7u.
    expect(complete.named_transferred_units).toBe(7);
  });

  it('caps a larger sending course at the authored UC requirement capacity', async () => {
    await seedTemplate({
      schoolId: 45,
      groups: [namedGroup([{
        section_advisement: 1,
        unit_advisement: 4,
        receivers: [ucCourse(4501)],
      }])],
    });
    await seedAsDegree({
      collegeId: 45,
      groups: [asNamedGroup([{
        section_advisement: 1,
        receivers: [asReceiver(450)],
      }])],
    });
    await seedCourses([[450, 6]]);
    await seedAgreement({
      schoolId: 45,
      collegeId: 45,
      receivers: [articulated({ kind: 'course', parent_id: 4501 }, [450])],
    });

    const cell = await cellFor({ collegeId: 45, schoolId: 45 });
    expect(cell.named_units).toBe(6);
    expect(cell.named_transferred_units).toBe(4);
    expect(cell.transferred_units).toBe(4);
    expect(cell.extra_units).toBe(56);
  });

  it('treats Davis-style assumed Cal-GETC as GE capacity, ELECTIVE as elective capacity, and AH&I as zero-work', async () => {
    await seedTemplate({
      schoolId: 5,
      school: 'UC Davis',
      totalUnits: 180,
      groups: [
        {
          title: 'Cal-GETC', tier: 'breadth', sections: [
            { section_advisement: 1, unit_advisement: 40, receivers: [geReceiver('Cal-GETC', { assume: true })] },
          ],
        },
        {
          title: 'AH&I', tier: 'breadth', sections: [
            { section_advisement: 1, unit_advisement: 4, receivers: [geReceiver('AH&I', { assume: true })] },
          ],
        },
        {
          title: 'Unrestricted electives', tier: 'transferable', sections: [
            { section_advisement: 3, unit_advisement: 15, receivers: [geReceiver('ELECTIVE', { assume: true })] },
          ],
        },
      ],
    });
    await seedAsDegree({ collegeId: 50, groups: [asGeGroup(34)] });
    await seedAgreement({ schoolId: 5, collegeId: 50, receivers: [] });

    const cell = await cellFor({ collegeId: 50, schoolId: 5 });
    expect(cell.ge_demand_units).toBeCloseTo(26.7, 1);
    expect(cell.ge_counted_units).toBeCloseTo(26.7, 1);
    expect(cell.elective_demand_units).toBeCloseTo(10, 1);
    expect(cell.elective_counted_units).toBeCloseTo(10, 1);
    expect(cell.transferred_units).toBeCloseTo(36.7, 1);
    expect(cell.extra_units).toBeCloseTo(23.3, 1);
  });

  it('counts a GE fallback authored on a Berkeley-style course receiver', async () => {
    await seedTemplate({
      schoolId: 6,
      school: 'UC Berkeley',
      groups: [namedGroup([
        {
          section_advisement: 1,
          ge_areas: ['1A'],
          receivers: [ucCourse(601, { ge_areas: ['1A'] })],
        },
        {
          section_advisement: 1,
          ge_areas: ['1B'],
          receivers: [ucCourse(602, { ge_areas: ['1B'] })],
        },
      ], 'Reading and Composition')],
    });
    await seedAsDegree({ collegeId: 60, groups: [asGeGroup(20)] });
    await seedAgreement({ schoolId: 6, collegeId: 60, receivers: [] });

    const cell = await cellFor({ collegeId: 60, schoolId: 6 });
    expect(cell.named_transferred_units).toBe(0);
    expect(cell.ge_demand_units).toBe(8);
    expect(cell.ge_counted_units).toBe(8);
    expect(cell.transferred_units).toBe(8);
    expect(cell.rate).toBeCloseTo(13.3, 1);
  });

  it('converts semester-campus capacity into quarter-college units and returns semester-equivalent extra units', async () => {
    await seedTemplate({
      schoolId: 7,
      totalUnits: 120,
      groups: [{
        title: 'Breadth', tier: 'breadth', sections: [
          { section_advisement: 1, unit_advisement: 6, receivers: [geReceiver('GE', { areas: ['3A'] })] },
        ],
      }],
    });
    await seedAsDegree({
      collegeId: 70,
      totalUnits: 90,
      unitSystem: 'quarter',
      groups: [asGeGroup(51)],
    });
    await seedAgreement({ schoolId: 7, collegeId: 70, receivers: [] });

    const cell = await cellFor({ collegeId: 70, schoolId: 7 });
    expect(cell.ge_demand_units).toBe(9);
    expect(cell.ge_counted_units).toBe(9);
    expect(cell.transferred_units).toBe(9);
    expect(cell.extra_units).toBe(81);
    expect(cell.extra_units_semester).toBe(54);
  });

  it('keeps a pair with no agreement null rather than treating it as zero credit', async () => {
    await seedTemplate({
      schoolId: 8,
      groups: [namedGroup([{ section_advisement: 1, receivers: [ucCourse(801)] }])],
    });
    await seedAsDegree({
      collegeId: 80,
      groups: [asNamedGroup([{ section_advisement: 1, receivers: [asReceiver(80)] }])],
    });
    await seedCourses([[80, 4]]);

    const cell = await cellFor({ collegeId: 80, schoolId: 8 });
    expect(cell.rate).toBeNull();
    expect(cell.prescribed_units).toBeNull();
    expect(cell.transferred_units).toBeNull();
    expect(cell.extra_units).toBeNull();
    expect(cell.extra_units_semester).toBeNull();
  });

  it('excludes a structurally impossible selected named plan instead of breaking whole-degree bounds', async () => {
    await seedTemplate({
      schoolId: 9,
      groups: [namedGroup([{
        section_advisement: 2,
        receivers: [ucCourse(901), ucCourse(902)],
      }])],
    });
    await seedAsDegree({
      collegeId: 90,
      totalUnits: 10,
      groups: [asNamedGroup([{
        section_advisement: 2,
        receivers: [asReceiver(90), asReceiver(91)],
      }], 'Alternative pathway requirements')],
    });
    await seedCourses([[90, 6], [91, 6]]);
    await seedAgreement({
      schoolId: 9,
      collegeId: 90,
      receivers: [
        articulated({ kind: 'course', parent_id: 901 }, [90]),
        articulated({ kind: 'course', parent_id: 902 }, [91]),
      ],
    });

    const cell = await cellFor({ collegeId: 90, schoolId: 9 });
    expect(cell.named_units).toBe(12);
    expect(cell.rate).toBeNull();
    expect(cell.transferred_units).toBeNull();
    expect(cell.extra_units).toBeNull();
    expect(cell.method_status).toBe('excluded');
    expect(cell.method_warning).toMatch(/named plan|degree total/i);
  });
});
