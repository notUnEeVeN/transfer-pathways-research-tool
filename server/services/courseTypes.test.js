import { describe, it, expect } from 'vitest';
import { typeOfCourseCode, typeOfText, typeOfSection, typeOfReceiver } from './courseTypes';

describe('course types', () => {
  it('types a requirement by the university course code, as the paper does', () => {
    expect(typeOfCourseCode('CSE', '11', 'Introduction to Programming')).toBe('computing');
    expect(typeOfCourseCode('I&C SCI', '31', 'Introduction to Programming')).toBe('computing');
    expect(typeOfCourseCode('COM SCI', '31', 'Introduction to Computer Science I')).toBe('computing');
    expect(typeOfCourseCode('MATH', '20A', 'Calculus')).toBe('math');
    expect(typeOfCourseCode('PSTAT', '120A', 'Probability')).toBe('math');
    expect(typeOfCourseCode('PHYSICS', '7A', 'Physics for Scientists')).toBe('science');
    expect(typeOfCourseCode('ENGR', '065', 'Circuit Theory')).toBe('science');
    expect(typeOfCourseCode('WCWP', '100', 'Warren College Writing')).toBe('non_stem');
  });

  it('always counts discrete math as math, whatever the prefix says', () => {
    expect(typeOfCourseCode('CSE', '20', 'Discrete Mathematics')).toBe('math');
    expect(typeOfCourseCode('CMPSC', '40', 'Foundations of Computer Science')).toBe('math');
    expect(typeOfText('CS 111 — Discrete Structures')).toBe('math');
  });

  it('resolves a cross-listed code to its computing side', () => {
    expect(typeOfCourseCode('EE/CS', '120A', 'Logic Design')).toBe('computing');
  });

  it('types free-text blocks by their documented rules', () => {
    expect(typeOfText('Upper-division major coursework — 20 courses')).toBe('computing');
    expect(typeOfText('Technical electives — 8 courses, at least 32 units')).toBe('computing');
    expect(typeOfText('CSE electives — 24 units')).toBe('computing');
    expect(typeOfText('Unrestricted electives — any UC-transferable coursework')).toBe('non_stem');
    expect(typeOfText('GE: Humanities & Social Sciences breadth')).toBe('non_stem');
    expect(typeOfText('List B — 12 units from PHYS 1–7 series, CHEM 1A–C + lab')).toBe('science');
    expect(typeOfText('Statistics — MATH 181A / MATH 183 / ECON 120A')).toBe('math');
  });

  it('keeps writing requirements out of computing even when a CS course satisfies them', () => {
    // UC Irvine's block is 17 major courses, one of which carries the upper-division
    // writing designation; UC Santa Cruz's is a communication requirement.
    expect(typeOfText('Upper-division major coursework — 17 courses (incl. I&C SCI 139W = GE Ib upper-division writing)')).toBe('computing');
    expect(typeOfText('Disciplinary Communication (DC) — CSE 115A, CSE 185E')).toBe('non_stem');
    expect(typeOfText('Engineering Writing + Ethics — one W/EW course')).toBe('non_stem');
  });

  it('reads a section through its first real course, then its text', () => {
    const universityCourses = { 101: { prefix: 'MATH', number: '20A', title: 'Calculus' } };
    const courseSection = {
      receivers: [{ receiving: { kind: 'course', parent_id: 101 } }],
    };
    const blockSection = {
      receivers: [{ receiving: { kind: 'requirement', name: 'Systems electives — 12 units' } }],
    };

    expect(typeOfSection(courseSection, { title: 'Lower-division' }, universityCourses)).toBe('math');
    expect(typeOfSection(blockSection, { title: 'Upper division' }, universityCourses)).toBe('computing');
    expect(typeOfReceiver(courseSection.receivers[0], null, universityCourses)).toBe('math');
  });

  it('falls back to the group title when a receiver carries no name', () => {
    const section = { receivers: [{ receiving: { kind: 'requirement' } }] };
    expect(typeOfSection(section, { title: 'Physics sequence' }, {})).toBe('science');
  });
});
