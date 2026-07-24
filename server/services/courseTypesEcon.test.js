import { describe, expect, it } from 'vitest';
import {
  typeOfCourseCode, typeOfText, categoriesOfReceiver,
} from './courseTypesEcon';
import { getMajor } from '../config/majors';

describe('economics course typing', () => {
  it('reads statistics taught by an economics department as statistics', () => {
    // UCLA, UCSB and UC Irvine teach the statistics requirement under ECON.
    // Prefix alone would file it as economics coursework and hide the
    // requirement entirely.
    expect(typeOfCourseCode(117, 'ECON', '41', 'Probability and Statistics for Economists')).toBe('statistics');
    expect(typeOfCourseCode(128, 'ECON', '5', 'Statistics for Economics')).toBe('statistics');
    expect(typeOfCourseCode(89, 'STA', '013', 'Elementary Statistics')).toBe('statistics');
  });

  it('separates intermediate theory from principles', () => {
    expect(typeOfCourseCode(117, 'ECON', '11', 'Microeconomic Theory')).toBe('econ_theory');
    expect(typeOfCourseCode(128, 'ECON', '10A', 'Intermediate Microeconomic Theory')).toBe('econ_theory');
    expect(typeOfCourseCode(7, 'ECON', '1', 'Principles of Microeconomics')).toBe('econ_principles');
  });

  it('keeps principles together where a campus does not name micro and macro', () => {
    // Berkeley and Irvine state the sequence without naming the halves.
    // Splitting would print "not required" at campuses that require both.
    expect(typeOfCourseCode(79, 'ECON', '1', 'Introduction to Economics')).toBe('econ_principles');
    expect(typeOfCourseCode(79, 'ECON', '2', 'Introduction to Economics, Lecture Format')).toBe('econ_principles');
    expect(typeOfCourseCode(120, 'ECON', '20A', 'Basic Economics I')).toBe('econ_principles');
  });

  it('reads economics-flavoured math as calculus, not statistics', () => {
    expect(typeOfCourseCode(132, 'AM', '11A', 'Mathematical Methods for Economists I')).toBe('calculus');
    expect(typeOfCourseCode(128, 'MATH', '34A', 'Calculus for Social and Life Sciences')).toBe('calculus');
  });

  it('splits COGS by what the course actually is', () => {
    // Merced's COGS 1 is an introductory social science; Irvine's COGS 14P is
    // part of its computer-education requirement. The prefix is the same.
    expect(typeOfCourseCode(144, 'COGS', '1', 'Introduction to Cognitive Science')).toBe('other_social');
    expect(typeOfCourseCode(120, 'COGS', '14P', 'Scientific Python Programming')).toBe('computing');
    expect(typeOfCourseCode(120, 'SOC SCI', '3A', 'Computer-Based Research in the Social Sciences')).toBe('computing');
    expect(typeOfCourseCode(144, 'POLI', '1', 'American Politics')).toBe('other_social');
  });

  it('types the free-text social science requirement', () => {
    expect(typeOfText('School additional Social Sciences — two distinct courses after ECON 20A/B'))
      .toBe('other_social');
    expect(typeOfText('UCI GE remaining after Economics/School overlap')).toBe('non_stem');
    expect(typeOfText('UC-transferable elective capacity to 180 units')).toBe('non_stem');
  });

  it('returns an array from the receiver callback', () => {
    const courses = { 1: { prefix: 'ECON', number: '1', title: 'Principles of Microeconomics' } };
    expect(categoriesOfReceiver(7, { receiving: { kind: 'course', parent_id: 1 } }, null, courses))
      .toEqual(['econ_principles']);
  });

});

describe('economics figure taxonomy', () => {
  const { courseTypes, categories } = getMajor('econ');

  it('assigns every fine category to exactly one column in each axis set', () => {
    const keys = categories.map((category) => category.key);
    for (const [name, axes] of Object.entries(courseTypes.axes)) {
      const assigned = axes.flatMap((axis) => axis.categories);
      expect(new Set(assigned).size, `${name} assigns a category twice`).toBe(assigned.length);
      expect([...assigned].sort()).toEqual([...keys].sort());
    }
  });

  it('keeps the same four-column shape as the other majors', () => {
    expect(courseTypes.axes.faithful.map((axis) => axis.label))
      .toEqual(['Economics', 'Math', 'Other Social Science', 'Non-STEM']);
    expect(courseTypes.axes.faithful).toHaveLength(getMajor('cs').courseTypes.axes.faithful.length);
  });

  it('fills the supporting-discipline slot with other social sciences', () => {
    // Computer Science fills that slot with Science and Biology with Chemistry
    // & Physics. Economics requires no lab science at all.
    const supporting = courseTypes.axes.faithful[2];
    expect(supporting.categories).toEqual(['other_social']);
  });

  it('gives Figure 5 six panels drawn from the declared categories', () => {
    const keys = new Set(categories.map((category) => category.key));
    expect(courseTypes.barrierPanels).toHaveLength(6);
    for (const panel of courseTypes.barrierPanels) expect(keys).toContain(panel.key);
  });
});
