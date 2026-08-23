import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const { transferCreditRateData } = cjs('./transferCreditRate');
const maFigure3GrayDetail = cjs('../../data/ma/figure3-gray-detail.json');

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
  majorSlug = null,
  researchStatus = null,
  totalUnits = 120,
  unitSystem = null,
  annualTuition = null,
  tuitionSource = null,
  tuitionBasis = null,
  verified = null,
  groups,
}) {
  await db.collection('curated_requirements').insertOne({
    _id: `degree:${schoolId}`,
    kind: 'degree',
    ...(majorSlug ? { major_slug: majorSlug } : {}),
    school_id: schoolId,
    school,
    program,
    ...(researchStatus ? { research_status: researchStatus } : {}),
    ...(typeof verified === 'boolean' ? { verification: { verified } } : {}),
    ...(unitSystem ? { unit_system: unitSystem } : {}),
    total_units: totalUnits,
    requirement_groups: groups,
  });
  await db.collection('assist_institutions').insertOne({
    _id: `uc:${schoolId}`,
    kind: 'university',
    source_id: schoolId,
    name: school,
    ...(annualTuition != null ? { tuition_annual_resident_usd: annualTuition } : {}),
    ...(tuitionSource ? { tuition_source: tuitionSource } : {}),
    ...(tuitionBasis ? { tuition_basis: tuitionBasis } : {}),
  });
}

async function seedAsDegree({
  collegeId,
  degreeType = 'local_as',
  majorSlug = 'cs',
  totalUnits = 60,
  unitSystem = 'semester',
  verified,
  analysisReady,
  groups,
}) {
  await db.collection('curated_requirements').insertOne({
    _id: `as_degree:${collegeId}:${degreeType}`,
    kind: 'as_degree',
    degree_type: degreeType,
    major_slug: majorSlug,
    status: 'found',
    community_college_id: collegeId,
    college_id: `cc:${collegeId}`,
    college_name: `College ${collegeId}`,
    total_units: totalUnits,
    unit_system: unitSystem,
    ...(typeof verified === 'boolean' ? { verification: { verified } } : {}),
    ...(typeof analysisReady === 'boolean' ? { analysis_ready: analysisReady } : {}),
    requirement_groups: groups,
  });
  await db.collection('assist_institutions').updateOne(
    { _id: `cc:${collegeId}` },
    { $setOnInsert: {
      kind: 'community_college',
      source_id: collegeId,
      name: `College ${collegeId}`,
    } },
    { upsert: true },
  );
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

async function cellFor({ collegeId, schoolId, degreeType = 'local_as' }) {
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

describe('transferCreditRateData v4', () => {
  it('freezes the direct MA Figure 3 gray-row rerun independently of the typed summary tab', () => {
    expect(maFigure3GrayDetail.summary).toMatchObject({
      cells: 61,
      matches_final_pdf_at_printed_precision: 42,
      mismatches_final_pdf_at_printed_precision: 19,
    });
    expect(maFigure3GrayDetail.summary.archive_gray_detail_mean_pct).toBeCloseTo(64.6824664734, 8);
    expect(maFigure3GrayDetail.objective_duplicate_blocks_removed).toHaveLength(3);
    const uncapped = maFigure3GrayDetail.cells.find((cell) => cell.pair === 'Fitchburg × MassBay');
    expect(uncapped).toMatchObject({
      archive_gray_units: 69,
      archive_as_total_units: 68,
      archive_gray_detail_display_pct: 101,
      final_pdf_pct: 100,
      matches_final_pdf_at_printed_precision: false,
    });
  });

  it('limits the high-fidelity cohort to verified records in the exact degree slot', async () => {
    await seedTemplate({
      schoolId: 70,
      researchStatus: 'ai_researched_needs_human_verification',
      groups: [{
        title: 'Breadth', tier: 'breadth', sections: [{
          section_advisement: 1,
          unit_advisement: 6,
          receivers: [geReceiver('GE', { assume: true })],
        }],
      }],
    });
    await seedAsDegree({
      collegeId: 701,
      verified: true,
      analysisReady: false,
      groups: [asGeGroup(6)],
    });
    await seedAsDegree({
      collegeId: 702,
      verified: false,
      groups: [asGeGroup(6)],
    });
    // Verification of another slot at the same college must not authorize the
    // selected local A.S. record.
    await seedAsDegree({
      collegeId: 702,
      degreeType: 'ast',
      verified: true,
      groups: [asGeGroup(6)],
    });
    await seedAgreement({ schoolId: 70, collegeId: 701, receivers: [] });
    await seedAgreement({ schoolId: 70, collegeId: 702, receivers: [] });

    const allRows = await transferCreditRateData(db, null, { degreeType: 'local_as' });
    expect(allRows.map((item) => item.community_college_id).sort()).toEqual([701, 702]);
    expect(allRows.every((item) => /four-year graduation template/i.test(item.method_warning))).toBe(true);

    const verifiedRows = await transferCreditRateData(db, null, {
      degreeType: 'local_as', verifiedOnly: true,
    });
    expect(verifiedRows).toHaveLength(1);
    expect(verifiedRows[0]).toMatchObject({
      community_college_id: 701,
      degree_type: 'local_as',
      source_verified: true,
      degree_template_verified: false,
      degree_template_assumed_valid: false,
    });
    expect(verifiedRows[0].method_warning).toMatch(/four-year graduation template/i);
    expect(verifiedRows[0].method_warning).toMatch(/human-verified but is not marked analysis-ready/i);
    expect(verifiedRows[0].method_warning).toMatch(/still requires human verification/i);

    await db.collection('curated_requirements').updateOne(
      { _id: 'degree:70' },
      { $set: { verification: { verified: true, verified_at: '2026-08-18T00:00:00Z' } } },
    );
    const explicitlyVerified = await transferCreditRateData(db, null, {
      degreeType: 'local_as', verifiedOnly: true,
    });
    expect(explicitlyVerified[0]).toMatchObject({
      degree_template_verified: true,
      degree_template_assumed_valid: false,
      degree_template_status_conflict: true,
    });
    expect(explicitlyVerified[0].method_warning || '')
      .not.toMatch(/four-year graduation template/i);
  });

  it('reports the share of all bachelor requirements and lower-division requirements fulfilled by the AS degree', async () => {
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
        {
          title: 'Upper-division coursework', tier: 'nontransferable', sections: [
            {
              section_advisement: 3,
              unit_advisement: 12,
              receivers: Array.from({ length: 3 }, () => ({ receiving: { kind: 'requirement' } })),
            },
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
    // Figure 3 follows the MA gray-row rule: named + actual GE/breadth only.
    // The six units of unrestricted-elective capacity still count for
    // Figures 4/5, but cannot inflate Figure 3's numerator.
    expect(cell.paper_equivalent_transferred_units).toBe(12);
    expect(cell.paper_equivalent_as_unit_utilization_pct).toBe(20);
    expect(cell.degree_unit_system).toBe('semester');
    // The full degree is measured against the campus's stated 120-unit
    // minimum, not the 30 modeled units — a thinly modelled template must not
    // read as more complete than a thorough one.
    expect(cell.full_degree_required_units).toBe(120);
    expect(cell.full_degree_fulfilled_units).toBe(18);
    expect(cell.full_degree_completion_pct).toBe(15);
    expect(cell.lower_division_required_units).toBe(18);
    expect(cell.lower_division_fulfilled_units).toBe(18);
    expect(cell.lower_division_completion_pct).toBe(100);
    expect(cell.rate).toBe(15);
    // AS-unit utilization remains separately for the replacement-coursework visual.
    expect(cell.as_unit_utilization_pct).toBe(30);
    expect(cell.extra_units).toBe(42);
    expect(cell.extra_units_semester).toBe(42);
    expect(cell.modeled_pathway_units_semester).toBe(162);
    expect(cell.modeled_hours_above_120).toBe(42);
    expect(cell.method_status).toBe('estimated');
    expect(cell.method_warning).toMatch(/elective credit assumes/i);
    expect(cell.transferred_units).toBeLessThanOrEqual(cell.as_total_units);
    expect(cell.rate).toBeGreaterThanOrEqual(0);
    expect(cell.rate).toBeLessThanOrEqual(100);
  });

  it('separates unused AS units from the paper-style pathway total minus 120', async () => {
    const seedPair = async ({ schoolId, collegeId, totalUnits, unitSystem }) => {
      await seedTemplate({
        schoolId,
        totalUnits,
        unitSystem,
        annualTuition: 24000,
        tuitionSource: 'Test tuition schedule',
        groups: [namedGroup([{
          section_advisement: 1,
          receivers: [ucCourse(schoolId * 100 + 1)],
        }])],
      });
      await seedAsDegree({
        collegeId,
        groups: [asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(collegeId * 100 + 1)],
        }])],
      });
      await seedCourses([[collegeId * 100 + 1, 4]]);
      await seedAgreement({
        schoolId,
        collegeId,
        receivers: [articulated(
          { kind: 'course', parent_id: schoolId * 100 + 1 },
          [collegeId * 100 + 1],
        )],
      });
    };

    await seedPair({ schoolId: 28, collegeId: 280, totalUnits: 123, unitSystem: 'semester' });
    await seedPair({ schoolId: 29, collegeId: 290, totalUnits: 180, unitSystem: 'quarter' });

    const semester = await cellFor({ collegeId: 280, schoolId: 28 });
    expect(semester.extra_units_semester).toBe(56);
    expect(semester.modeled_pathway_units_semester).toBe(179);
    expect(semester.modeled_hours_above_120).toBe(59);
    expect(semester.extra_cost_usd).toBe(56000);
    expect(semester.modeled_cost_above_120_usd).toBe(59000);
    expect(semester.modeled_cost_above_120_standard_load_usd).toBe(47200);
    expect(semester.tuition_source).toBe('Test tuition schedule');

    // A 180-quarter-unit graduation minimum is exactly 120 semester units, so
    // the two Figure-4 candidates coincide there.
    const quarter = await cellFor({ collegeId: 290, schoolId: 29 });
    expect(quarter.extra_units_semester).toBe(57.3);
    expect(quarter.modeled_pathway_units_semester).toBe(177.3);
    expect(quarter.modeled_hours_above_120).toBe(57.3);
    expect(quarter.modeled_hours_above_120_unrounded).toBeCloseTo(57.333333, 6);
    expect(quarter.modeled_cost_above_120_usd).toBe(57333);
  });

  it('reads canonical tuition provenance from tuition_basis', async () => {
    await seedTemplate({
      schoolId: 30,
      school: 'UC Provenance',
      totalUnits: 120,
      annualTuition: 12000,
      tuitionBasis: {
        year: '2025-26',
        source: 'UCOP Total Charges by Campus 2025-26',
        source_url: 'https://www.ucop.edu/example.pdf',
      },
      groups: [namedGroup([{
        section_advisement: 1,
        receivers: [ucCourse(3001)],
      }])],
    });
    await seedAsDegree({
      collegeId: 300,
      groups: [asNamedGroup([{
        section_advisement: 1,
        receivers: [asReceiver(30001)],
      }])],
    });
    await seedCourses([[30001, 4]]);
    await seedAgreement({
      schoolId: 30,
      collegeId: 300,
      receivers: [articulated(
        { kind: 'course', parent_id: 3001 },
        [30001],
      )],
    });

    const cell = await cellFor({ collegeId: 300, schoolId: 30 });
    expect(cell.tuition_source).toBe('UCOP Total Charges by Campus 2025-26');
    expect(cell.tuition_source_url).toBe('https://www.ucop.edu/example.pdf');
    expect(cell.tuition_price_year).toBe('2025-26');
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
    // 6 of the stated 120-unit degree.
    expect(cell.rate).toBe(5);
    expect(cell.as_unit_utilization_pct).toBe(10);
    expect(cell.extra_units).toBe(54);
  });

  it('closes a unit pool whose alternatives are stored as options on one receiver', async () => {
    // The Virginia catalog importer stores a pool's alternatives as options on
    // a single receiver, while California stores one receiver per alternative.
    // Both describe the same "select 6 units from the following" pool, so both
    // must close it. Before the unit-pool split, this shape could only ever
    // spend one option and the whole cell was excluded.
    await seedTemplate({
      schoolId: 22,
      groups: [namedGroup([{
        section_advisement: 2,
        receivers: [ucCourse(2201), ucCourse(2202)],
      }])],
    });
    await seedAsDegree({
      collegeId: 220,
      groups: [asNamedGroup([{
        section_advisement: null,
        unit_advisement: 6,
        receivers: [asReceiver(22, 23, 24, 25)],
      }], 'Select 6 units from the following')],
    });
    await seedCourses([[22, 3], [23, 3], [24, 3], [25, 3]]);
    await seedAgreement({
      schoolId: 22,
      collegeId: 220,
      receivers: [
        articulated({ kind: 'course', parent_id: 2201 }, [22]),
        articulated({ kind: 'course', parent_id: 2202 }, [23]),
      ],
    });

    const cell = await cellFor({ collegeId: 220, schoolId: 22 });
    expect(cell.method_status).not.toBe('excluded');
    expect(cell.named_units).toBe(6);
    expect(cell.named_transferred_units).toBe(6);
  });

  it('allows an overshoot smaller than one course, and rejects one larger', async () => {
    // `total_units` is a stated minimum and courses are indivisible, so a plan
    // that lands a little above the floor is ordinary. A plan a whole course
    // or more above it is describing a different degree.
    await seedTemplate({
      schoolId: 24,
      groups: [namedGroup([{ section_advisement: 1, receivers: [ucCourse(2401)] }])],
    });
    await seedAsDegree({
      collegeId: 240,
      totalUnits: 10,
      groups: [asNamedGroup([{
        section_advisement: null, unit_advisement: 11, receivers: [asReceiver(41), asReceiver(42)],
      }], 'Select 11 units')],
    });
    await seedCourses([[41, 6], [42, 6]]);
    await seedAgreement({
      schoolId: 24,
      collegeId: 240,
      receivers: [articulated({ kind: 'course', parent_id: 2401 }, [41])],
    });

    // 12 units selected against a 10-unit degree: 2 over, and the largest
    // course is 6, so the overshoot is unavoidable granularity.
    const ok = await cellFor({ collegeId: 240, schoolId: 24 });
    expect(ok.method_status).not.toBe('excluded');
    expect(ok.named_units).toBe(12);
    expect(ok.method_warning).toMatch(/do not divide evenly/);

    // Same shape, but the courses are small enough that 2 units over is a
    // whole extra course.
    await seedTemplate({
      schoolId: 25,
      groups: [namedGroup([{ section_advisement: 1, receivers: [ucCourse(2501)] }])],
    });
    await seedAsDegree({
      collegeId: 250,
      totalUnits: 10,
      groups: [asNamedGroup([{
        section_advisement: null, unit_advisement: 11, receivers: [
          asReceiver(51), asReceiver(52), asReceiver(53), asReceiver(54), asReceiver(55), asReceiver(56),
        ],
      }], 'Select 11 units')],
    });
    await seedCourses([[51, 2], [52, 2], [53, 2], [54, 2], [55, 2], [56, 2]]);
    await seedAgreement({
      schoolId: 25,
      collegeId: 250,
      receivers: [articulated({ kind: 'course', parent_id: 2501 }, [51])],
    });

    const rejected = await cellFor({ collegeId: 250, schoolId: 25 });
    expect(rejected.method_status).toBe('excluded');
    expect(rejected.method_warning).toMatch(/larger than its largest single course|more than its largest single course/);
  });

  it('does not split a choose-N section, whose receivers each spend one option', async () => {
    // Splitting here would let a single stated slot draw several courses.
    await seedTemplate({
      schoolId: 23,
      groups: [namedGroup([{
        section_advisement: 1,
        receivers: [ucCourse(2301)],
      }])],
    });
    await seedAsDegree({
      collegeId: 230,
      groups: [asNamedGroup([{
        section_advisement: 1,
        unit_advisement: null,
        receivers: [asReceiver(32, 33, 34)],
      }], 'Select one of the following')],
    });
    await seedCourses([[32, 3], [33, 3], [34, 3]]);
    await seedAgreement({
      schoolId: 23,
      collegeId: 230,
      receivers: [articulated({ kind: 'course', parent_id: 2301 }, [32])],
    });

    const cell = await cellFor({ collegeId: 230, schoolId: 23 });
    expect(cell.named_units).toBe(3);
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
      degreeType: 'local_as', majorSlug: 'cs',
    });
    const scoped = rows.filter((row) => row.community_college_id === 79 && row.school_id === 79);
    expect(scoped).toHaveLength(1);
    const [cell] = scoped;
    expect(cell).toMatchObject({ major_slug: 'cs', named_transferred_units: 0 });
  });

  it('models an Economics local A.A. and does not mistake repeated internal option wording for alternative degrees', async () => {
    await seedTemplate({
      schoolId: 79,
      school: 'UC Berkeley',
      program: 'Economics, B.A.',
      majorSlug: 'econ',
      groups: [namedGroup([{
        section_advisement: 2,
        receivers: [ucCourse(7901), ucCourse(7902)],
      }])],
    });
    await seedAsDegree({
      collegeId: 790,
      degreeType: 'local_other',
      majorSlug: 'econ',
      groups: [
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(7901)],
        }], 'Calculus - complete one option'),
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(7902)],
        }], 'List A - select one option'),
      ],
    });
    await seedCourses([[7901, 4], [7902, 4]]);
    await seedAgreement({
      schoolId: 79,
      collegeId: 790,
      major: 'Economics, B.A.',
      receivers: [
        articulated({ kind: 'course', parent_id: 7901 }, [7901]),
        articulated({ kind: 'course', parent_id: 7902 }, [7902]),
      ],
    });

    const rows = await transferCreditRateData(db, null, {
      degreeType: 'local_other',
      majorSlug: 'econ',
      majorPrograms: { 79: ['Economics, B.A.'] },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      major_slug: 'econ',
      degree_type: 'local_other',
      named_transferred_units: 8,
      transferred_units: 8,
    });
    expect(rows[0].full_degree_completion_pct).toBeGreaterThan(0);
    expect(rows[0].method_warning || '').not.toMatch(/group-level choose-one/i);
  });

  it('still excludes source groups that are explicitly separate named options', async () => {
    await seedTemplate({
      schoolId: 80,
      groups: [namedGroup([{
        section_advisement: 1,
        receivers: [ucCourse(8001)],
      }])],
    });
    await seedAsDegree({
      collegeId: 800,
      groups: [
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(8001)],
        }], 'Networking Option (18 units)'),
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(8002)],
        }], 'Programming Option (18 units)'),
      ],
    });
    await seedCourses([[8001, 4], [8002, 4]]);
    await seedAgreement({
      schoolId: 80,
      collegeId: 800,
      receivers: [articulated({ kind: 'course', parent_id: 8001 }, [8001])],
    });

    const cell = await cellFor({ collegeId: 800, schoolId: 80 });
    expect(cell.full_degree_completion_pct).toBeNull();
    expect(cell.method_status).toBe('excluded');
    expect(cell.method_warning).toMatch(/group-level choose-one/i);
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
    expect(cell.paper_equivalent_transferred_units).toBeCloseTo(26.7, 1);
    expect(cell.paper_equivalent_as_unit_utilization_pct).toBeCloseTo(44.4, 1);
    expect(cell.extra_units).toBeCloseTo(23.3, 1);
  });

  it('does not sweep an explicitly non-UC-transferable selected course into elective capacity', async () => {
    await seedTemplate({
      schoolId: 55,
      groups: [{
        title: 'Unrestricted electives', tier: 'transferable', sections: [{
          section_advisement: 1,
          unit_advisement: 60,
          receivers: [geReceiver('ELECTIVE', { assume: true })],
        }],
      }],
    });
    await seedAsDegree({
      collegeId: 550,
      groups: [asNamedGroup([{
        section_advisement: 1,
        receivers: [asReceiver(5501)],
      }])],
    });
    await seedCourses([[5501, 4, false]]);
    await seedAgreement({ schoolId: 55, collegeId: 550, receivers: [] });

    const cell = await cellFor({ collegeId: 550, schoolId: 55 });
    expect(cell.known_nontransferable_units).toBe(4);
    expect(cell.elective_counted_units).toBe(56);
    expect(cell.transferred_units).toBe(56);
    expect(cell.extra_units).toBe(4);
    expect(cell.method_warning).toMatch(/explicitly not UC-transferable/i);
  });

  it('prefers a UC-transferable associate-degree option before counting replacement coursework', async () => {
    await seedTemplate({
      schoolId: 56,
      groups: [{
        title: 'Unrestricted electives', tier: 'transferable', sections: [{
          section_advisement: 1,
          unit_advisement: 60,
          receivers: [geReceiver('ELECTIVE', { assume: true })],
        }],
      }],
    });
    await seedAsDegree({
      collegeId: 560,
      groups: [asNamedGroup([{
        section_advisement: 1,
        receivers: [asReceiver(5601, 5602)],
      }])],
    });
    await seedCourses([
      [5601, 4, false],
      [5602, 4, true],
    ]);
    await seedAgreement({ schoolId: 56, collegeId: 560, receivers: [] });

    const cell = await cellFor({ collegeId: 560, schoolId: 56 });
    expect(cell.known_nontransferable_units).toBe(0);
    expect(cell.elective_counted_units).toBe(60);
    expect(cell.transferred_units).toBe(60);
    expect(cell.extra_units).toBe(0);
  });

  it('allows a small unit-pool overshoot to avoid known nontransferable coursework', async () => {
    await seedTemplate({
      schoolId: 57,
      groups: [{
        title: 'Unrestricted electives', tier: 'transferable', sections: [{
          section_advisement: 1,
          unit_advisement: 60,
          receivers: [geReceiver('ELECTIVE', { assume: true })],
        }],
      }],
    });
    await seedAsDegree({
      collegeId: 570,
      groups: [asNamedGroup([{
        section_advisement: null,
        unit_advisement: 3,
        receivers: [asReceiver(5701), asReceiver(5702)],
      }], 'Support courses - select at least 3 units')],
    });
    await seedCourses([
      [5701, 3, false],
      [5702, 4, true],
    ]);
    await seedAgreement({ schoolId: 57, collegeId: 570, receivers: [] });

    const cell = await cellFor({ collegeId: 570, schoolId: 57 });
    expect(cell.named_units).toBe(4);
    expect(cell.known_nontransferable_units).toBe(0);
    expect(cell.extra_units).toBe(0);
  });

  it('uses distinct courses across independently required associate-degree lists', async () => {
    await seedTemplate({
      schoolId: 58,
      groups: [namedGroup([{
        section_advisement: 2,
        receivers: [ucCourse(58001), ucCourse(58002)],
      }])],
    });
    await seedAsDegree({
      collegeId: 580,
      groups: [
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(5801)],
        }], 'List A - select one course'),
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(5801, 5802)],
        }], 'List B - select one course or an unused List A course'),
      ],
    });
    await seedCourses([[5801, 4], [5802, 4]]);
    await seedAgreement({
      schoolId: 58,
      collegeId: 580,
      receivers: [
        articulated({ kind: 'course', parent_id: 58001 }, [5801]),
        articulated({ kind: 'course', parent_id: 58002 }, [5802]),
      ],
    });

    const cell = await cellFor({ collegeId: 580, schoolId: 58 });
    expect(cell.named_units).toBe(8);
    expect(cell.named_transferred_units).toBe(8);
    expect(cell.method_status).not.toBe('excluded');
  });

  it('excludes a degree when two required lists only resolve to the same course', async () => {
    await seedTemplate({
      schoolId: 59,
      groups: [namedGroup([{
        section_advisement: 1,
        receivers: [ucCourse(59001)],
      }])],
    });
    await seedAsDegree({
      collegeId: 590,
      groups: [
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(5901)],
        }], 'List A - select one course'),
        asNamedGroup([{
          section_advisement: 1,
          receivers: [asReceiver(5901)],
        }], 'List B - select one course not used above'),
      ],
    });
    await seedCourses([[5901, 4]]);
    await seedAgreement({
      schoolId: 59,
      collegeId: 590,
      receivers: [articulated({ kind: 'course', parent_id: 59001 }, [5901])],
    });

    const cell = await cellFor({ collegeId: 590, schoolId: 59 });
    expect(cell.method_status).toBe('excluded');
    expect(cell.full_degree_completion_pct).toBeNull();
    expect(cell.method_warning).toMatch(/distinct resolved choices/i);
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
    // 8 of the stated 120-unit degree.
    expect(cell.rate).toBe(6.7);
    expect(cell.as_unit_utilization_pct).toBeCloseTo(13.3, 1);
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
    // The conversion still lands 6 semester units on the campus side; the
    // full-degree share now reads them against the stated 120-unit minimum.
    expect(cell.full_degree_required_units).toBe(120);
    expect(cell.full_degree_fulfilled_units).toBe(6);
    expect(cell.full_degree_completion_pct).toBe(5);
    expect(cell.lower_division_completion_pct).toBe(100);
    expect(cell.extra_units).toBe(81);
    expect(cell.extra_units_semester).toBe(54);
  });

  it('keeps a booleans-only agreement null rather than reading absent mappings as zero', async () => {
    // Massachusetts pairs outside the paper's 50-mile study carry
    // requirement-level verdicts but no course mappings; the credit-rate
    // figures must leave them blank the way the paper left them unstudied.
    await seedTemplate({
      schoolId: 27,
      groups: [namedGroup([{ section_advisement: 1, receivers: [ucCourse(2701)] }])],
    });
    await seedAsDegree({
      collegeId: 270,
      groups: [asNamedGroup([{ section_advisement: 1, receivers: [asReceiver(70)] }])],
    });
    await seedCourses([[70, 4]]);
    await db.collection('assist_agreements').insertOne({
      uc_school_id: 27,
      community_college_id: 270,
      major: 'Computer Science B.S.',
      pairing: 'booleans-only',
      requirement_groups: [{ sections: [{ receivers: [
        articulated({ kind: 'course', parent_id: 2701 }, [70]),
      ] }] }],
    });

    const cell = await cellFor({ collegeId: 270, schoolId: 27 });
    expect(cell.rate).toBeNull();
    expect(cell.method_status).toBe('unavailable');
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
    expect(cell.full_degree_completion_pct).toBeNull();
    expect(cell.lower_division_completion_pct).toBeNull();
    expect(cell.full_degree_required_units).toBe(120);
    expect(cell.lower_division_required_units).toBe(4);
    expect(cell.prescribed_units).toBeNull();
    expect(cell.transferred_units).toBeNull();
    expect(cell.extra_units).toBeNull();
    expect(cell.extra_units_semester).toBeNull();
    expect(cell.modeled_pathway_units_semester).toBeNull();
    expect(cell.modeled_hours_above_120).toBeNull();
    expect(cell.modeled_cost_above_120_usd).toBeNull();
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

// The figure's denominators and vocabulary must follow the modelling standard
// the other California figures already use, or the same document produces
// different answers in different charts. Berkeley MCB is the cautionary tale:
// its twelve-track emphasis Or-group summed to a 392-unit denominator against
// a stated 120, and section-level `tier: 'transferable'` under nontransferable
// groups reported all of it as lower division — the 11% column.
describe('transferCreditRateData standardized denominators and vocabulary', () => {
  it('measures the full degree against its stated unit minimum, not the modeled sum', async () => {
    await seedTemplate({
      schoolId: 21,
      totalUnits: 120,
      groups: [
        namedGroup([{ section_advisement: 1, unit_advisement: 8, receivers: [ucCourse(2101)] }]),
        {
          title: 'Upper-division coursework', tier: 'nontransferable', sections: [
            { section_advisement: 1, unit_advisement: 40, receivers: [{ receiving: { kind: 'requirement' } }] },
          ],
        },
      ],
    });
    await seedAsDegree({
      collegeId: 210,
      groups: [asNamedGroup([{ section_advisement: 1, receivers: [asReceiver(21)] }])],
    });
    await seedCourses([[21, 8]]);
    await seedAgreement({
      schoolId: 21,
      collegeId: 210,
      receivers: [articulated({ kind: 'course', parent_id: 2101 }, [21])],
    });

    const cell = await cellFor({ collegeId: 210, schoolId: 21 });
    expect(cell.full_degree_required_units).toBe(120);
    expect(cell.full_degree_fulfilled_units).toBe(8);
    expect(cell.full_degree_completion_pct).toBe(6.7);
    // Lower division still measures the CC-completable requirements alone.
    expect(cell.lower_division_required_units).toBe(8);
    expect(cell.lower_division_completion_pct).toBe(100);
  });

  it('charges an Or choice one path in the denominator', async () => {
    await seedTemplate({
      schoolId: 22,
      totalUnits: 120,
      groups: [{
        title: 'Lower-division mathematics — one complete sequence',
        tier: 'transferable',
        group_conjunction: 'Or',
        sections: [
          { section_advisement: 1, unit_advisement: 8, receivers: [ucSeries(2201, 2202)] },
          { section_advisement: 1, unit_advisement: 10, receivers: [ucSeries(2203, 2204)] },
        ],
      }],
    });
    await seedAsDegree({
      collegeId: 220,
      groups: [asNamedGroup([{ section_advisement: 2, receivers: [asReceiver(22), asReceiver(23)] }])],
    });
    await seedCourses([[22, 4], [23, 4]]);
    await seedAgreement({
      schoolId: 22,
      collegeId: 220,
      receivers: [
        articulated({ kind: 'series', parent_ids: [2201, 2202] }, [22, 23]),
      ],
    });

    const cell = await cellFor({ collegeId: 220, schoolId: 22 });
    // 8 cheapest-path units, not 18 summed alternatives.
    expect(cell.lower_division_required_units).toBe(8);
    expect(cell.lower_division_fulfilled_units).toBe(8);
    expect(cell.lower_division_completion_pct).toBe(100);
  });

  it('credits an Or choice one path in the numerator, not one per alternative', async () => {
    await seedTemplate({
      schoolId: 23,
      totalUnits: 120,
      groups: [{
        title: 'Statistics — one course',
        tier: 'transferable',
        group_conjunction: 'Or',
        sections: [
          { section_advisement: 1, unit_advisement: 4, receivers: [ucCourse(2301)] },
          { section_advisement: 1, unit_advisement: 4, receivers: [ucCourse(2302)] },
        ],
      }],
    });
    // The associate degree carries BOTH alternatives' CC courses.
    await seedAsDegree({
      collegeId: 230,
      groups: [asNamedGroup([{ section_advisement: 2, receivers: [asReceiver(30), asReceiver(31)] }])],
    });
    await seedCourses([[30, 4], [31, 4]]);
    await seedAgreement({
      schoolId: 23,
      collegeId: 230,
      receivers: [
        articulated({ kind: 'course', parent_id: 2301 }, [30]),
        articulated({ kind: 'course', parent_id: 2302 }, [31]),
      ],
    });

    const cell = await cellFor({ collegeId: 230, schoolId: 23 });
    // One statistics requirement exists; satisfying it twice is not 8 units.
    expect(cell.named_transferred_units).toBe(4);
    expect(cell.lower_division_required_units).toBe(4);
    expect(cell.lower_division_fulfilled_units).toBe(4);
  });

  it('lets a nontransferable group override contradictory section tiers', async () => {
    await seedTemplate({
      schoolId: 24,
      totalUnits: 120,
      groups: [
        namedGroup([{ section_advisement: 1, unit_advisement: 4, receivers: [ucCourse(2401)] }]),
        {
          // Berkeley MCB's rebuilt shape: the group says university-only in
          // both vocabularies, the sections still say transferable.
          title: 'Upper-division emphasis',
          tier: 'nontransferable',
          course_level: 'upper_division',
          cc_articulable: false,
          sections: [
            { tier: 'transferable', section_advisement: 1, unit_advisement: 24, receivers: [{ receiving: { kind: 'requirement' } }] },
          ],
        },
      ],
    });
    await seedAsDegree({
      collegeId: 240,
      groups: [asNamedGroup([{ section_advisement: 1, receivers: [asReceiver(40)] }])],
    });
    await seedCourses([[40, 4]]);
    await seedAgreement({
      schoolId: 24,
      collegeId: 240,
      receivers: [articulated({ kind: 'course', parent_id: 2401 }, [40])],
    });

    const cell = await cellFor({ collegeId: 240, schoolId: 24 });
    // The 24 upper-division units belong to the university side.
    expect(cell.lower_division_required_units).toBe(4);
    expect(cell.lower_division_completion_pct).toBe(100);
  });

  it('honors an authored zero-unit requirement instead of re-pricing it', async () => {
    await seedTemplate({
      schoolId: 25,
      totalUnits: 120,
      groups: [
        namedGroup([{ section_advisement: 1, unit_advisement: 4, receivers: [ucCourse(2501)] }]),
        {
          // Berkeley's American Cultures: a real requirement that double-counts
          // with breadth, authored at zero units.
          title: 'American Cultures', tier: 'transferable', sections: [
            { section_advisement: 1, unit_advisement: 0, receivers: [geReceiver('AC', { assume: true })] },
          ],
        },
      ],
    });
    await seedAsDegree({
      collegeId: 250,
      groups: [
        asNamedGroup([{ section_advisement: 1, receivers: [asReceiver(50)] }]),
        asGeGroup(20),
      ],
    });
    await seedCourses([[50, 4]]);
    await seedAgreement({
      schoolId: 25,
      collegeId: 250,
      receivers: [articulated({ kind: 'course', parent_id: 2501 }, [50])],
    });

    const cell = await cellFor({ collegeId: 250, schoolId: 25 });
    // No phantom four-unit GE demand from the zero-unit overlay.
    expect(cell.ge_demand_units).toBe(0);
    expect(cell.ge_counted_units).toBe(0);
    expect(cell.lower_division_required_units).toBe(4);
  });

  it('includes legacy associate-degree rows that predate the major stamp', async () => {
    await seedTemplate({
      schoolId: 26,
      totalUnits: 120,
      groups: [namedGroup([{ section_advisement: 1, unit_advisement: 4, receivers: [ucCourse(2601)] }])],
    });
    await seedAsDegree({
      collegeId: 260,
      majorSlug: null,
      groups: [asNamedGroup([{ section_advisement: 1, receivers: [asReceiver(60)] }])],
    });
    await seedCourses([[60, 4]]);
    await seedAgreement({
      schoolId: 26,
      collegeId: 260,
      receivers: [articulated({ kind: 'course', parent_id: 2601 }, [60])],
    });

    // No majorSlug: the default major owns unstamped legacy rows, and the
    // scoping clause (not a bare equality) is what lets them match.
    const rows = await transferCreditRateData(db, null, { degreeType: 'local_as' });
    expect(rows.map((row) => row.community_college_id)).toContain(260);
  });

  it('joins published and deposited-detail sources onto paper-corpus rows, and only there', async () => {
    await db.collection('curated_requirements').insertMany([
      {
        _id: 'degree:9001:ma-cs', kind: 'degree', school_id: 9001, school: 'MCLA',
        program: 'Computer Science, B.S.', major_slug: 'ma-cs', state: 'ma',
        total_units: 120, unit_system: 'semester',
        requirement_groups: [{
          title: 'Lower-division major requirements', tier: 'transferable',
          sections: [{
            section_advisement: 1, unit_advisement: 4, tier: 'transferable',
            receivers: [{ receiving: { kind: 'course', parent_id: 9001000, code: 'COMP 151', name: 'Computer Science I' } }],
          }],
        }, {
          title: 'GE: general education and electives', tier: 'transferable',
          sections: [{
            section_advisement: 1, unit_advisement: 3, tier: 'transferable',
            receivers: [{ receiving: { kind: 'course', parent_id: 9001050, code: 'ELEC XXX', name: 'Humanities' } }],
          }],
        }],
      },
      {
        _id: 'as_degree:ma:9101:local_as', kind: 'as_degree', degree_type: 'local_as',
        major_slug: 'ma-cs', state: 'ma', status: 'found',
        college_id: 'ma:cc:9101', community_college_id: 9101,
        college_name: 'Berkshire Community College', total_units: 7, unit_system: 'semester',
        verification: { verified: true },
        requirement_groups: [{
          title: 'Associate degree requirements',
          sections: [{ section_advisement: 2, receivers: [
            { receiving: { kind: 'requirement', parent_id: null }, articulation_status: null,
              options: [{ course_ids: [9101001], course_conjunction: 'and' }] },
            { receiving: { kind: 'requirement', parent_id: null }, articulation_status: null,
              options: [{ course_ids: [9101002], course_conjunction: 'and' }] },
          ] }],
        }],
      },
    ]);
    await db.collection('assist_courses').insertMany([
      { _id: 'ma:sending:9101001', institution_id: 'ma:cc:9101', side: 'sending',
        course_id: 9101001, prefix: 'CSC', number: '101', title: 'Programming I',
        units: 4, community_college_id: 9101, state: 'ma' },
      { _id: 'ma:sending:9101002', institution_id: 'ma:cc:9101', side: 'sending',
        course_id: 9101002, prefix: 'HUM', number: '101', title: 'World Cultures',
        units: 3, community_college_id: 9101, state: 'ma' },
    ]);
    await db.collection('assist_agreements').insertOne({
      _id: 'ma:agreement:9001:9101', university_id: 'ma:uni:9001', college_id: 'ma:cc:9101',
      uc_school_id: 9001, community_college_id: 9101,
      major: 'Computer Science, B.S.', state: 'ma', pairing: 'order-approximate',
      requirement_groups: [{ sections: [{ receivers: [
        { receiving: { kind: 'course', parent_id: 9001000, code: 'COMP 151', name: 'Computer Science I' },
          articulation_status: 'articulated',
          options: [{ course_ids: [9101001], course_conjunction: 'and' }] },
        { receiving: { kind: 'course', parent_id: 9001050, code: 'ELEC XXX', name: 'Humanities' },
          articulation_status: 'articulated',
          options: [{ course_ids: [9101002], course_conjunction: 'and' }] },
      ] }] }],
    });
    await db.collection('ma_paper_baselines').insertMany([
      { measure: 'pct_as', school_id: 9001, community_college_id: 9101,
        school: 'MCLA', college_name: 'Berkshire Community College', value: 0.385 },
      { measure: 'pct_as_pdf', school_id: 9001, community_college_id: 9101,
        school: 'MCLA', college_name: 'Berkshire Community College', value: 0.42 },
      { measure: 'extra_hours_pdf', school_id: 9001, community_college_id: 9101,
        school: 'MCLA', college_name: 'Berkshire Community College', value: 26 },
      { measure: 'extra_cost_pdf', school_id: 9001, community_college_id: 9101,
        school: 'MCLA', college_name: 'Berkshire Community College', value: 13202 },
      { measure: 'pct_as', school_id: 9001, community_college_id: null,
        school: 'MCLA', value: 1 },
    ]);

    const rows = await transferCreditRateData(db, null, { degreeType: 'local_as', majorSlug: 'ma-cs' });
    const cell = rows.find((row) => row.community_college_id === 9101 && row.school_id === 9001);
    // Both published revisions ride the row — the repo workbook's tally and
    // the final PDF's printed value — beside our recomputation, so the
    // figure's source selector can show any of the three.
    expect(cell.published_as_transfer_pct).toBe(38.5);
    expect(cell.published_pdf_as_transfer_pct).toBe(42);
    expect(cell.published_pdf_extra_hours).toBe(26);
    expect(cell.published_pdf_extra_cost_usd).toBe(13202);
    expect(cell.archived_pathway_sheet_total_hours).toBe(146);
    expect(cell.archived_pathway_sheet_extra_hours).toBe(26);
    expect(cell.archived_pathway_sheet_source).toMatch(/deposited 2024 pathway sheet/i);
    expect(cell.archive_gray_detail_as_transfer_pct).toBeCloseTo(38.4615384615, 8);
    expect(cell.archive_gray_detail_numerator_units).toBe(25);
    expect(cell.archive_gray_detail_denominator_units).toBe(65);
    expect(cell.archive_gray_detail_blue_units_excluded).toBe(12);
    expect(cell.archive_gray_detail_matches_final_pdf).toBe(true);
    expect(cell.archive_gray_detail_delta_vs_final_pdf_pp).toBeCloseTo(0.4615384615, 8);
    expect(cell.archive_gray_detail_source).toMatch(/gray replacement-row Column H credits/i);
    expect(cell.archive_gray_detail_source).toMatch(/blue unrestricted-elective-only rows excluded/i);
    expect(cell.as_unit_utilization_pct).toBe(100);
    // The CS-only flavor drops the GE-group receiver's 3 units: 4 of 7.
    expect(cell.as_cs_only_utilization_pct).toBe(57.1);

    // California rows never carry the field: no paper corpus, no join.
    const caRows = await transferCreditRateData(db, null, { degreeType: 'local_as' });
    for (const row of caRows) {
      expect(row.published_as_transfer_pct).toBeUndefined();
      expect(row.published_pdf_as_transfer_pct).toBeUndefined();
      expect(row.published_pdf_extra_hours).toBeUndefined();
      expect(row.published_pdf_extra_cost_usd).toBeUndefined();
      expect(row.archived_pathway_sheet_total_hours).toBeUndefined();
      expect(row.archived_pathway_sheet_extra_hours).toBeUndefined();
      expect(row.archived_pathway_sheet_source).toBeUndefined();
      expect(row.archive_gray_detail_as_transfer_pct).toBeUndefined();
      expect(row.archive_gray_detail_numerator_units).toBeUndefined();
      expect(row.archive_gray_detail_denominator_units).toBeUndefined();
      expect(row.archive_gray_detail_blue_units_excluded).toBeUndefined();
      expect(row.archive_gray_detail_source).toBeUndefined();
      expect(row.as_cs_only_utilization_pct).toBeUndefined();
    }
  });
});
