import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const {
  METHOD_ID,
  _blockerWitness,
  _buildPlan,
  _districtCatalog,
  _poolReceiver,
  _summarizeGroups,
} = cjs('./districtPathwayPlanner');

const catalogCourse = (courseId, units = 3) => ({
  course_id: String(courseId),
  code: `COURSE ${courseId}`,
  title: `Course ${courseId}`,
  units,
  same_as: [],
});

const articulationReceiver = ({
  hash = 'shared-receiver',
  options,
  optionsConjunction = 'or',
}) => ({
  hash_id: hash,
  receiving: { kind: 'course', parent_id: 9001, units: 4 },
  articulation_status: 'articulated',
  options_conjunction: optionsConjunction,
  options,
});

describe('district pathway pure helpers', () => {
  it('passes a configured optimizer state limit through the district plan', () => {
    const major = {
      school_id: 79,
      requirement_groups: [{
        is_required: true,
        sections: [{ receivers: [articulationReceiver({
          hash: 'single-course',
          options: [{ course_ids: ['1001'], course_conjunction: 'and' }],
        })] }],
      }],
    };
    const catalog = new Map([['1001', {
      ...catalogCourse('1001'),
      community_college_id: 101,
      community_college: 'Example College',
    }]]);

    const plan = _buildPlan({
      context: { projectedGroups: new Map() },
      district: {},
      supportedMajors: [major],
      catalog,
      unitSystem: 'semester',
      params: {
        nativeLoad: 15,
        optimizerBudgetMs: 1000,
        optimizerMaxStates: 19,
        scheduleBudgetMs: 1000,
      },
    });

    expect(METHOD_ID).toContain('configurable_state_limit');
    expect(plan.optimizer.max_states).toBe(19);
    expect(plan.assumptions.optimizer_max_states).toBe(19);
  });

  it('pools complete AND paths as OR alternatives without splitting a college path', () => {
    const catalog = new Map(
      ['10', '11', '12', '20', '21', '22'].map((id) => [id, catalogCourse(id)]),
    );
    const firstCollege = articulationReceiver({
      optionsConjunction: 'and',
      options: [
        { course_ids: ['10'], course_conjunction: 'and' },
        { course_ids: ['11', '12'], course_conjunction: 'or' },
      ],
    });
    const secondCollege = articulationReceiver({
      optionsConjunction: 'or',
      options: [
        { course_ids: ['20', '21'], course_conjunction: 'and' },
        { course_ids: ['22'], course_conjunction: 'and' },
      ],
    });
    const canonical = {
      ...articulationReceiver({
        options: [{ course_ids: ['stale'], course_conjunction: 'and' }],
      }),
      label: 'Canonical UC requirement',
    };
    const telemetry = { cartesian_fallbacks: 0 };

    const pooled = _poolReceiver(
      canonical,
      [firstCollege, secondCollege],
      catalog,
      telemetry,
    );

    expect(pooled).toMatchObject({
      label: 'Canonical UC requirement',
      articulation_status: 'articulated',
      options_conjunction: 'or',
      not_articulated_reason: null,
    });
    expect(pooled.options).toEqual([
      { course_ids: ['22'], course_conjunction: 'and' },
      { course_ids: ['10', '11'], course_conjunction: 'and' },
      { course_ids: ['10', '12'], course_conjunction: 'and' },
      { course_ids: ['20', '21'], course_conjunction: 'and' },
    ]);
    expect(telemetry.cartesian_fallbacks).toBe(0);
  });

  it('emits all 0–9 reachability groups and excludes null plans from statistics', () => {
    const groups = _summarizeGroups([
      {
        supported_count: 2,
        plan: {
          distinct_courses: null,
          academic_years: null,
          lower_bound_years: null,
          schedule_status: 'unavailable',
          prerequisite_status: 'complete',
        },
      },
      {
        supported_count: 2,
        plan: {
          distinct_courses: 0,
          academic_years: 0,
          lower_bound_years: 0,
          schedule_status: 'optimal',
          prerequisite_status: 'complete',
        },
      },
      {
        supported_count: 9,
        plan: {
          distinct_courses: 18,
          academic_years: 2.5,
          lower_bound_years: 2,
          schedule_status: 'bounded',
          prerequisite_status: 'estimated',
        },
      },
    ]);

    expect(groups.map((group) => group.supported_count)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(groups.map((group) => group.district_count)).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0, 1]);
    expect(groups[2]).toMatchObject({
      course_stats: { n: 1, mean: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0 },
      academic_year_stats: { n: 1, mean: 0 },
      lower_bound_year_stats: { n: 1, mean: 0 },
      exact_schedule_count: 1,
      bounded_schedule_count: 0,
      estimated_plan_count: 0,
    });
    expect(groups[0].course_stats).toEqual({
      n: 0, mean: null, median: null, q1: null, q3: null, min: null, max: null,
    });
  });

  it('keeps visually identical courses from different colleges distinct by course ID', () => {
    const context = {
      catalogs: new Map([
        [101, { courses: new Map([['1001', {
          ...catalogCourse('1001'), code: 'CS 101', title: 'Introduction to Programming',
        }]]) }],
        [202, { courses: new Map([['2002', {
          ...catalogCourse('2002'), code: 'CS 101', title: 'Introduction to Programming',
        }]]) }],
      ]),
    };
    const colleges = [
      { source_id: 101, name: 'North College', district: 'Example CCD' },
      { source_id: 202, name: 'South College', district: 'Example CCD' },
    ];

    const { catalog, collegeById } = _districtCatalog(context, colleges);

    expect([...catalog.keys()]).toEqual(['1001', '2002']);
    expect(catalog.get('1001')).toMatchObject({
      code: 'CS 101', community_college_id: 101, community_college: 'North College',
    });
    expect(catalog.get('2002')).toMatchObject({
      code: 'CS 101', community_college_id: 202, community_college: 'South College',
    });
    expect(catalog.get('1001')).not.toBe(catalog.get('2002'));
    expect(collegeById.get(101).name).toBe('North College');
    expect(collegeById.get(202).name).toBe('South College');
  });

  it('returns a minimum choose-one blocker witness instead of every unavailable receiver', () => {
    const unavailable = (hash, parentId) => ({
      hash_id: hash,
      receiving: { kind: 'course', parent_id: parentId, units: 4 },
      articulation_status: 'not_articulated',
      options: [],
      options_conjunction: 'or',
    });
    const major = {
      school_id: 79,
      requirement_groups: [{
        is_required: true,
        group_advisement: 1,
        group_conjunction: 'And',
        sections: [{
          receivers: [
            unavailable('missing-a', 5001),
            unavailable('missing-b', 5002),
          ],
        }],
      }],
    };
    const receivingCourses = new Map([
      [5001, { parent_id: 5001, prefix: 'CS', number: '10', title: 'First option' }],
      [5002, { parent_id: 5002, prefix: 'CS', number: '20', title: 'Second option' }],
    ]);

    const witness = _blockerWitness(major, new Map(), receivingCourses, 5_000);

    expect(witness.blocker_count).toBe(1);
    expect(witness.blockers).toHaveLength(1);
    expect(['missing-a', 'missing-b']).toContain(witness.blockers[0].receiver_hash);
    expect(witness.blockers[0].receiving_courses).toHaveLength(1);
    expect(witness.optimality_proven).toBe(true);
  });
});
