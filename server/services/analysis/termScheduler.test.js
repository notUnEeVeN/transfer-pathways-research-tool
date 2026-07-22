import { describe, expect, it } from 'vitest';
import { minimumTermSchedule } from './termScheduler';

const course = (course_id, units) => ({ course_id, units });
const requirements = (entries) => new Map(Object.entries(entries).map(([id, groups]) => [
  id,
  groups.map((anyOf) => ({ anyOf })),
]));
const loads = (result, byId) => result.schedule.map((term) =>
  term.course_ids.reduce((total, id) => total + byId[id], 0));

describe('minimumTermSchedule', () => {
  it('finds the exact two-term packing without prerequisites', () => {
    const courses = [course('A', 6), course('B', 6), course('C', 4), course('D', 4)];
    const result = minimumTermSchedule({ courses, unitCap: 10 });
    expect(result.status).toBe('optimal');
    expect(result.min_terms).toBe(2);
    expect(loads(result, { A: 6, B: 6, C: 4, D: 4 })).toEqual([10, 10]);
  });

  it('lets a prerequisite chain dominate the unit-only floor', () => {
    const result = minimumTermSchedule({
      courses: [course('A', 3), course('B', 3), course('C', 3)],
      requirementsByCourse: requirements({ B: [['A']], C: [['B']] }),
      unitCap: 15,
    });
    expect(result.unit_lower_bound_terms).toBe(1);
    expect(result.sequence_lower_bound_terms).toBe(3);
    expect(result.min_terms).toBe(3);
    expect(result.schedule.map((term) => term.course_ids)).toEqual([['A'], ['B'], ['C']]);
  });

  it('schedules a fork and join under the hard cap', () => {
    const result = minimumTermSchedule({
      courses: [course('A', 4), course('B', 4), course('C', 4), course('D', 4)],
      requirementsByCourse: requirements({ B: [['A']], C: [['A']], D: [['B'], ['C']] }),
      unitCap: 8,
    });
    expect(result.min_terms).toBe(3);
    expect(result.schedule.map((term) => term.course_ids)).toEqual([
      ['A'], ['B', 'C'], ['D'],
    ]);
  });

  it('treats alternatives as any-of rather than requiring every variant', () => {
    const result = minimumTermSchedule({
      courses: [course('JAVA1', 3), course('CPP1', 3), course('DATA', 3)],
      requirementsByCourse: requirements({ DATA: [['JAVA1', 'CPP1']] }),
      unitCap: 6,
    });
    expect(result.min_terms).toBe(2);
    expect(result.schedule[0].course_ids).toEqual(['CPP1', 'JAVA1']);
    expect(result.schedule[1].course_ids).toEqual(['DATA']);
  });

  it('relaxes a long path when a shorter prerequisite alternative resolves later', () => {
    const courses = ['A0', 'A1', 'A2', 'B', 'M', 'Z']
      .map((course_id) => course(course_id, 1));
    const result = minimumTermSchedule({
      courses,
      requirementsByCourse: requirements({
        A1: [['A0']],
        A2: [['A1']],
        B: [['Z']],
        M: [['A2', 'B']],
      }),
      unitCap: 10,
    });

    expect(result).toMatchObject({
      status: 'optimal',
      optimal: true,
      min_terms: 3,
      sequence_lower_bound_terms: 3,
    });
  });

  it('reports cycles instead of manufacturing a finite sequence', () => {
    const result = minimumTermSchedule({
      courses: [course('A', 3), course('B', 3)],
      requirementsByCourse: requirements({ A: [['B']], B: [['A']] }),
      unitCap: 15,
    });
    expect(result.status).toBe('prerequisite_cycle');
    expect(result.min_terms).toBeNull();
  });

  it('reports a unit cap below an individual course', () => {
    const result = minimumTermSchedule({ courses: [course('LAB', 6)], unitCap: 5 });
    expect(result).toMatchObject({
      status: 'cap_too_low', minimum_unit_cap: 6, oversized_course_ids: ['LAB'],
    });
  });

  it('does not silently schedule a course whose units are missing', () => {
    const result = minimumTermSchedule({ courses: [course('UNKNOWN', null)], unitCap: 15 });
    expect(result.status).toBe('incomplete_units');
    expect(result.missing_unit_course_ids).toEqual(['UNKNOWN']);
  });

  it('counts a duplicate course id once and rejects conflicting unit records', () => {
    const deduplicated = minimumTermSchedule({
      courses: [course('A', 4), course('A', 4), course('B', 4)],
      unitCap: 8,
    });
    expect(deduplicated.min_terms).toBe(1);
    expect(deduplicated.schedule[0].course_ids).toEqual(['A', 'B']);

    const conflicting = minimumTermSchedule({
      courses: [course('A', 3), course('A', 4)],
      unitCap: 8,
    });
    expect(conflicting).toMatchObject({
      status: 'inconsistent_courses',
      conflicting_course_ids: ['A'],
    });
  });

  it('is deterministic when the input course order changes', () => {
    const input = {
      courses: [course('A', 5), course('B', 5), course('C', 5), course('D', 5)],
      requirementsByCourse: requirements({ C: [['A']], D: [['B']] }),
      unitCap: 10,
    };
    const first = minimumTermSchedule(input);
    const second = minimumTermSchedule({ ...input, courses: [...input.courses].reverse() });
    expect(second.schedule).toEqual(first.schedule);
    expect(second.min_terms).toBe(2);
  });

  it('returns certified bounds when exact search is deliberately disabled', () => {
    const result = minimumTermSchedule({
      courses: [course('A', 4), course('B', 4), course('C', 4)],
      unitCap: 8,
      maxExactCourses: 2,
    });
    expect(result).toMatchObject({
      status: 'bounded', optimal: false, lower_bound_terms: 2, upper_bound_terms: 2,
    });
    expect(result.schedule).toHaveLength(2);
  });

  it('uses a list-based bounded schedule beyond the 32-bit mask range', () => {
    const courses = Array.from({ length: 32 }, (_, index) => course(`C${index}`, 1));
    const result = minimumTermSchedule({ courses, unitCap: 10 });

    expect(result).toMatchObject({
      status: 'bounded',
      optimal: false,
      lower_bound_terms: 4,
      upper_bound_terms: 4,
      unit_lower_bound_terms: 4,
    });
    expect(result.schedule.flatMap((term) => term.course_ids)).toHaveLength(32);
    expect(result.schedule.every((term) => term.course_ids.length <= 10)).toBe(true);
  });
});
