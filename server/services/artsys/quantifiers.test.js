import { describe, it, expect } from 'vitest';
import { parseGroupRule } from './quantifiers';

// The header vocabulary measured across a 60-guide sample
// (docs/state-expansion-feasibility.md §3.5). Each case below is a real header
// string, so a rendering change on the ARTSYS side fails a test instead of
// silently producing a requirement nobody asked for.
describe('parseGroupRule', () => {
  it('reads an explicit course count', () => {
    const r = parseGroupRule('Computer Science Courses complete the following 11 requirements 33 credits');
    expect(r.group_advisement).toBe(11);
    expect(r.constructs).toContain('complete_following_N');
  });

  // The single most consequential rule in this file: on a course-count group
  // the credit figure is the SUM of the listed courses, not a constraint.
  // Treating "33 credits" as a unit advisement would demand 33 units on top of
  // the 11 courses and inflate every degree in the corpus.
  it('does not turn descriptive credits into a unit advisement', () => {
    const r = parseGroupRule('Computer Science Courses complete the following 11 requirements 33 credits');
    expect(r.group_unit_advisement).toBeNull();
    expect(r.stated_credits).toEqual({ min: 33, max: 33 });
  });

  it('uses credits as the constraint when no course count is stated', () => {
    const r = parseGroupRule('Technical take the following courses, take 6 credits 6 credits');
    expect(r.group_advisement).toBeNull();
    expect(r.group_unit_advisement).toBe(6);
  });

  it('takes the low end of a credit range', () => {
    const r = parseGroupRule('GEP: Science take one GEP: Science course. 3 - 4 credits');
    expect(r.stated_credits).toEqual({ min: 3, max: 4 });
    expect(r.group_advisement).toBe(1);
  });

  it('reads word numbers', () => {
    expect(parseGroupRule('complete two courses from the following:').group_advisement).toBe(2);
    expect(parseGroupRule('Take one of the following').group_advisement).toBe(1);
  });

  it('prefers "complete one of" over the looser take-N rule', () => {
    const r = parseGroupRule("GEP: English Composition complete one of these courses with a \"C\" grade or better. 3 credits");
    expect(r.group_advisement).toBe(1);
    expect(r.min_grade).toBe('C');
  });

  it('reads a distribution minimum', () => {
    const r = parseGroupRule('GEP: Social Sciences take 2 GEP: Social Science courses. Courses must come from at least 2 different disciplines');
    expect(r.group_advisement).toBe(2);
    expect(r.group_min_distinct_sections).toBe(2);
  });

  it('reads "N courses from K of the following groups"', () => {
    const r = parseGroupRule('Complete 1 course from 1 of the following groups 3 credits');
    expect(r.group_advisement).toBe(1);
    expect(r.group_min_distinct_sections).toBe(1);
  });

  it('reads an "each from a different category" distribution', () => {
    const r = parseGroupRule('General Education Program - Mode of Inquiry, Humanities take 2 courses, 1 each from a different category below');
    expect(r.group_advisement).toBe(2);
    expect(r.group_min_distinct_sections).toBe(2);
  });

  it('reads a maximum', () => {
    const r = parseGroupRule("Major electives complete up to 3 of these courses with a 'C' grade or better. 6 - 9 credits");
    expect(r.group_max_courses).toBe(3);
  });

  it('flags complete-all groups', () => {
    const r = parseGroupRule('Complete all of the courses below');
    expect(r.complete_all).toBe(true);
    expect(r.group_advisement).toBeNull();
  });

  it('records the no-double-count constraint', () => {
    const r = parseGroupRule('General Biology Concentration Courses No course may double count to fulfill requirements. 12 - 14 credits');
    expect(r.no_double_count).toBe(true);
  });

  it('reports a header it cannot read rather than guessing', () => {
    const r = parseGroupRule('Consult with an academic advisor');
    expect(r.matched).toBe(false);
    expect(r.group_advisement).toBeNull();
    expect(r.group_unit_advisement).toBeNull();
  });

  it('is safe on empty input', () => {
    const r = parseGroupRule('');
    expect(r.matched).toBe(false);
    expect(r.constructs).toEqual([]);
  });
});
