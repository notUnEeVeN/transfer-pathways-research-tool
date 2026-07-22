import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const {
  multiCampusPathwaysData,
  loadMultiCampusPathwayContext,
  multiCampusPathwaysDataFromContext,
  _buildCatalogs,
  _calendarForCollege,
  _chosenPrerequisites,
  _clearSingletonBaselineCache,
  _closePrerequisites,
  _singletonBaselineCacheStats,
  _solveDirect,
} = cjs('./pathwayPlanner');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('pathway_planner_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  _clearSingletonBaselineCache();
  await db.dropDatabase();
});

const receiver = (hash, ownId, sharedId) => ({
  hash_id: hash,
  receiving: { kind: 'course', parent_id: hash, units: 4 },
  articulation_status: 'articulated',
  options_conjunction: 'or',
  options: [
    { course_ids: [ownId], course_conjunction: 'and' },
    { course_ids: [sharedId], course_conjunction: 'and' },
  ],
});

const agreement = (collegeId, schoolId, major, ownId, sharedId) => ({
  _id: `${collegeId}-${schoolId}`,
  community_college_id: collegeId,
  college_id: `cc:${collegeId}`,
  community_college: collegeId === 40 ? 'Quarter College' : 'Semester College',
  uc_school_id: schoolId,
  university_id: `uc:${schoolId}`,
  uc_school: schoolId === 79 ? 'UC Berkeley' : 'UC Davis',
  major,
  requirement_groups: [{
    is_required: true,
    sections: [{ receivers: [receiver(`r-${collegeId}-${schoolId}`, ownId, sharedId)] }],
  }],
});

const course = (id, collegeId, units, concept) => ({
  _id: `cc:${id}`,
  side: 'sending',
  course_id: id,
  community_college_id: collegeId,
  institution_id: `cc:${collegeId}`,
  prefix: concept === 'intro' ? 'CS' : 'MATH',
  number: String(id),
  title: `Course ${id}`,
  units,
  same_as: [],
  concept,
  concept_source: 'reviewed_test',
});

async function seedTwoCollegePortfolio() {
  await db.collection('assist_institutions').insertMany([
    { _id: 'uc:79', kind: 'university', source_id: 79, name: 'UC Berkeley' },
    { _id: 'uc:89', kind: 'university', source_id: 89, name: 'UC Davis' },
    { _id: 'cc:2', kind: 'community_college', source_id: 2, name: 'Semester College' },
    { _id: 'cc:40', kind: 'community_college', source_id: 40, name: 'Quarter College' },
  ]);
  await db.collection('assist_agreements').insertMany([
    agreement(2, 79, 'Berkeley CS', 21, 23),
    agreement(2, 89, 'Davis CS', 22, 23),
    agreement(40, 79, 'Berkeley CS', 401, 403),
    agreement(40, 89, 'Davis CS', 402, 403),
  ]);
  await db.collection('assist_courses').insertMany([
    course(21, 2, 3, 'standalone'), course(22, 2, 3, 'standalone'),
    course(23, 2, 4, 'data'), course(24, 2, 3, 'intro'),
    course(401, 40, 5, 'standalone'), course(402, 40, 5, 'standalone'),
    course(403, 40, 6, 'data'), course(404, 40, 5, 'intro'),
  ]);
  await db.collection('curated_requirements').insertMany([
    { _id: 'prereq_concept:standalone', kind: 'prereq_concept', slug: 'standalone', requires: [] },
    { _id: 'prereq_concept:intro', kind: 'prereq_concept', slug: 'intro', requires: [] },
    { _id: 'prereq_concept:data', kind: 'prereq_concept', slug: 'data', requires: ['intro'] },
  ]);
}

const visiblePairs = [
  { school_id: 79, major: 'Berkeley CS' },
  { school_id: 89, major: 'Davis CS' },
];

describe('multiCampusPathwaysData', () => {
  it('loads the corpus once and calculates several campus subsets from that fixed context', async () => {
    await seedTwoCollegePortfolio();
    const context = await loadMultiCampusPathwayContext(db, db, {
      schoolIds: [79, 89], visiblePairs, includeSourceFingerprint: true,
      retainSingletonBaselines: true,
    });

    const first = multiCampusPathwaysDataFromContext(context, {
      schoolIds: [79], mode: 'average', semesterLoad: 15, quarterLoad: 15,
    });
    await db.collection('assist_agreements').deleteMany({});
    const second = multiCampusPathwaysDataFromContext(context, {
      schoolIds: [89], mode: 'average', semesterLoad: 15, quarterLoad: 15,
    });

    expect(context.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(2);
    expect(second.rows.every((row) => row.status === 'optimal')).toBe(true);
  });

  it('jointly chooses a shared course, adds its prerequisite, and keeps calendars native', async () => {
    await seedTwoCollegePortfolio();

    const result = await multiCampusPathwaysData(db, db, {
      schoolIds: [89, 79], mode: 'average', semesterLoad: 15, quarterLoad: 15,
      visiblePairs,
    });

    expect(result.params.school_ids).toEqual([79, 89]);
    expect(result.rows).toHaveLength(2);
    const semester = result.rows.find((row) => row.community_college_id === 2);
    const quarter = result.rows.find((row) => row.community_college_id === 40);
    expect(semester).toMatchObject({
      unit_system: 'semester', status: 'optimal',
      combined: {
        major_course_count: 1,
        prerequisite_course_count: 1,
        distinct_courses: 2,
        native_units: 7,
        min_terms: 2,
        unit_lower_bound_terms: 1,
        sequence_lower_bound_terms: 2,
        optionality_premium_courses: 1,
      },
    });
    expect(quarter).toMatchObject({
      unit_system: 'quarter', status: 'optimal',
      combined: { distinct_courses: 2, native_units: 11, semester_equiv_units: 7.3, min_terms: 2 },
    });
    expect(result.calendar_groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ unit_system: 'semester', n: 1, exact_n: 1, distribution: [{ terms: 2, count: 1 }] }),
      expect.objectContaining({ unit_system: 'quarter', n: 1, exact_n: 1, distribution: [{ terms: 2, count: 1 }] }),
    ]));
    expect(result.summary).toMatchObject({
      mean_distinct_courses_n: 2,
      mean_semester_equiv_units_n: 2,
      mean_optionality_premium_courses_n: 2,
    });
    expect(result.summary).not.toHaveProperty('mean_optionality_premium_terms');
  });

  it('returns detailed courses, earlier prerequisites, and single-campus baselines', async () => {
    await seedTwoCollegePortfolio();

    const result = await multiCampusPathwaysData(db, db, {
      schoolIds: [79, 89], mode: 'college', communityCollegeId: 2,
      semesterLoad: 15, quarterLoad: 15, visiblePairs,
    });

    expect(result.row.community_college).toBe('Semester College');
    expect(result.terms.map((term) => term.course_ids)).toEqual([['24'], ['23']]);
    expect(result.terms.map((term) => term.course_count)).toEqual([1, 1]);
    expect(result.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({ course_id: '24', role: 'prerequisite_only', modeled_term: 1, school_ids: [79, 89] }),
      expect.objectContaining({ course_id: '23', role: 'major_preparation', modeled_term: 2, prerequisite_ids: ['24'] }),
    ]));
    expect(result.row.campuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ school_id: 79, distinct_courses: 1, estimated_terms: 1 }),
      expect.objectContaining({ school_id: 89, distinct_courses: 1, estimated_terms: 1 }),
    ]));
  });

  it('is invariant to campus input order', async () => {
    await seedTwoCollegePortfolio();
    const common = { mode: 'college', communityCollegeId: 2, semesterLoad: 15, quarterLoad: 15, visiblePairs };
    const first = await multiCampusPathwaysData(db, db, { ...common, schoolIds: [79, 89] });
    const second = await multiCampusPathwaysData(db, db, { ...common, schoolIds: [89, 79] });

    expect(second.params.school_ids).toEqual(first.params.school_ids);
    expect(second.row.combined).toMatchObject({
      distinct_courses: first.row.combined.distinct_courses,
      native_units: first.row.combined.native_units,
      min_terms: first.row.combined.min_terms,
      optionality_premium_courses: first.row.combined.optionality_premium_courses,
      product_complete: first.row.combined.product_complete,
      strict_complete: first.row.combined.strict_complete,
    });
    expect(second.courses).toEqual(first.courses);
  });

  it('reuses singleton baselines and invalidates them when effective inputs change', async () => {
    await seedTwoCollegePortfolio();
    const common = {
      schoolIds: [79, 89], mode: 'college', communityCollegeId: 2,
      semesterLoad: 15, quarterLoad: 15, visiblePairs,
    };

    await multiCampusPathwaysData(db, db, common);
    expect(_singletonBaselineCacheStats()).toMatchObject({ size: 2, hits: 0, misses: 2 });

    await multiCampusPathwaysData(db, db, { ...common, schoolIds: [89, 79] });
    expect(_singletonBaselineCacheStats()).toMatchObject({ size: 2, hits: 2, misses: 2 });

    await db.collection('assist_agreements').updateOne(
      { _id: '2-79' },
      { $set: {
        'requirement_groups.0.sections.0.receivers.0.options': [
          { course_ids: [21, 24], course_conjunction: 'and' },
        ],
      } },
    );
    const agreementChanged = await multiCampusPathwaysData(db, db, common);
    expect(agreementChanged.row.campuses.find((campus) => campus.school_id === 79))
      .toMatchObject({ direct_course_count: 2, distinct_courses: 2, native_units: 6 });
    expect(_singletonBaselineCacheStats()).toMatchObject({ hits: 3, misses: 3 });

    await db.collection('assist_courses').updateOne({ course_id: 21 }, { $set: { units: 5 } });
    const catalogChanged = await multiCampusPathwaysData(db, db, common);
    expect(catalogChanged.row.campuses.find((campus) => campus.school_id === 79))
      .toMatchObject({ direct_course_count: 2, distinct_courses: 2, native_units: 8 });
    expect(_singletonBaselineCacheStats()).toMatchObject({ hits: 3, misses: 5 });

    await db.collection('curated_mappings').insertOne({
      _id: 'receiver_override:r-2-89',
      kind: 'receiver_override', receiver_hash: 'r-2-89', exclude: true,
    });
    const overrideChanged = await multiCampusPathwaysData(db, db, common);
    expect(overrideChanged.row.campuses.find((campus) => campus.school_id === 89))
      .toMatchObject({ direct_course_count: 0, distinct_courses: 0, native_units: 0 });
    expect(_singletonBaselineCacheStats()).toMatchObject({ hits: 3, misses: 7 });
  });

  it('recomputes singleton schedules when the unit load changes', async () => {
    await seedTwoCollegePortfolio();
    await db.collection('assist_agreements').updateOne(
      { _id: '2-79' },
      { $set: {
        'requirement_groups.0.sections.0.receivers.0.options': [
          { course_ids: [21], course_conjunction: 'and' },
        ],
      } },
    );
    await db.collection('assist_courses').updateOne({ course_id: 21 }, { $set: { units: 7 } });
    const common = {
      schoolIds: [79], mode: 'college', communityCollegeId: 2,
      quarterLoad: 15, visiblePairs,
    };

    const roomy = await multiCampusPathwaysData(db, db, { ...common, semesterLoad: 15 });
    expect(roomy.row.campuses[0]).toMatchObject({
      estimated_terms: 1, schedule_status: 'optimal',
    });
    expect(_singletonBaselineCacheStats()).toMatchObject({ hits: 0, misses: 1 });

    const constrained = await multiCampusPathwaysData(db, db, { ...common, semesterLoad: 6 });
    expect(constrained.row.campuses[0]).toMatchObject({
      estimated_terms: null, schedule_status: 'cap_too_low',
    });
    expect(_singletonBaselineCacheStats()).toMatchObject({ hits: 1, misses: 1 });
  });

  it('expires singleton baselines after sixty seconds', async () => {
    await seedTwoCollegePortfolio();
    const params = {
      schoolIds: [79, 89], mode: 'college', communityCollegeId: 2,
      semesterLoad: 15, quarterLoad: 15, visiblePairs,
    };
    const clock = vi.spyOn(Date, 'now');
    const startedAt = Date.now();
    try {
      clock.mockReturnValue(startedAt);
      await multiCampusPathwaysData(db, db, params);
      expect(_singletonBaselineCacheStats()).toMatchObject({ size: 2, hits: 0, misses: 2 });

      clock.mockReturnValue(startedAt + 60_001);
      await multiCampusPathwaysData(db, db, params);
      expect(_singletonBaselineCacheStats()).toMatchObject({ size: 2, hits: 0, misses: 4 });
    } finally {
      clock.mockRestore();
    }
  });

  it('labels unresolved prerequisite evidence as estimated even when course proof is bounded', async () => {
    await seedTwoCollegePortfolio();
    await db.collection('assist_courses').deleteOne({ course_id: 24 });
    await db.collection('assist_agreements').updateMany(
      { community_college_id: 2 },
      { $push: {
        'requirement_groups.0.sections.0.receivers.0.options': {
          course_ids: ['999'], course_conjunction: 'and',
        },
      } },
    );

    const result = await multiCampusPathwaysData(db, db, {
      schoolIds: [79, 89], mode: 'average', semesterLoad: 15, quarterLoad: 15,
      visiblePairs,
    });
    const semester = result.rows.find((row) => row.community_college_id === 2);
    expect(semester).toMatchObject({
      status: 'estimated',
      plan_status: 'bounded',
      prerequisite_status: 'estimated',
      schedule_status: 'optimal',
    });
    expect(result.calendar_groups.find((group) => group.unit_system === 'semester'))
      .toMatchObject({ exact_n: 0, bounded_n: 0, estimated_n: 1, unavailable_n: 0 });
  });
});

describe('pathway planner normalization', () => {
  it('uses reviewed calendar identities and does not assume a new college is semester', () => {
    expect(_calendarForCollege(2)).toBe('semester');
    expect(_calendarForCollege(40)).toBe('quarter');
    expect(_calendarForCollege(999)).toBe('unknown');
  });

  it('makes real same-as relationships reciprocal', () => {
    const catalogs = _buildCatalogs([
      { course_id: 1, community_college_id: 2, institution_id: 'cc:2', units: 3, same_as: [{ course_id: 2 }] },
      { course_id: 2, community_college_id: 2, institution_id: 'cc:2', units: 3, same_as: [] },
    ]);
    expect(catalogs.get(2).courses.get('1').same_as).toEqual([{ course_id: '2' }]);
    expect(catalogs.get(2).courses.get('2').same_as).toEqual([{ course_id: '1' }]);
  });

  it('keeps an unresolved prerequisite explicit instead of adding a zero-unit placeholder', () => {
    const catalog = new Map([['1', { course_id: '1', units: 3, same_as: [] }]]);
    const closure = _closePrerequisites(
      ['1'], catalog, new Map([['cc:1', [{ concept: 'missing', anyOf: [] }]]]),
    );
    expect(closure.ids).toEqual(['1']);
    expect(closure.unresolved_groups).toEqual([{ course_id: '1', concept: 'missing' }]);
  });

  it('shows one earlier satisfier for an any-of prerequisite group', () => {
    const requirements = new Map([
      ['data', [{ concept: 'intro', anyOf: ['early', 'late'] }]],
    ]);
    const terms = new Map([['early', 1], ['data', 2], ['late', 4]]);

    expect(_chosenPrerequisites('data', requirements, terms)).toEqual(['early']);
  });

  it('does not prove an optimum when a missing shared alternative could be smaller', () => {
    const major = (hash, ownId) => ({
      requirement_groups: [{
        is_required: true,
        sections: [{ receivers: [receiver(hash, ownId, 'missing-shared')] }],
      }],
    });
    const catalog = new Map([
      ['A', { course_id: 'A', units: 3, same_as: [] }],
      ['B', { course_id: 'B', units: 3, same_as: [] }],
    ]);

    const solved = _solveDirect([major('one', 'A'), major('two', 'B')], catalog, 1000);
    expect(solved.product_complete).toBe(true);
    expect(solved.ids).toEqual(['A', 'B']);
    expect(solved.missing_reference_ids).toEqual(['missing-shared']);
    expect(solved.optimizer).toMatchObject({
      catalog_complete: false,
      optimality_proven: false,
    });
  });
});
