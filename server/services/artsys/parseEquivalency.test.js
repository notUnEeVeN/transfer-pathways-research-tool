import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseEquivalencyModal, parseCourseModal, extractRequisites } from './parseEquivalency';

const fixture = (name) => fs.readFileSync(
  path.resolve(__dirname, '../../test/fixtures/artsys', name), 'utf8'
);

describe('parseEquivalencyModal', () => {
  const detail = parseEquivalencyModal(fixture('equivalency-28275355-with-description.html'));

  it('reads the articulation summary', () => {
    expect(detail.from).toBe('MONTGOMERY COLLEGE');
    expect(detail.to).toBe('CAPITOL TECHNOLOGY UNIVERSITY');
    expect(detail.effective).toBe('Fall 2013 - Currently Effective');
    expect(detail.counts_as).toBe('CS130 - Intro to Programming Using Java');
  });

  // The course is worth 4 credits and transfers as 3. Storing the awarded
  // figure as the course's units would understate what a student takes;
  // storing the course's units as awarded would overstate what they receive.
  it('keeps course units and awarded transfer credit apart', () => {
    expect(detail.sending[0].code).toBe('CMSC203');
    expect(detail.sending[0].units).toBe(4);
    expect(detail.awarded_min_units).toBe(3);
    expect(detail.awarded_max_units).toBe(3);
  });

  it('extracts prerequisite and corequisite prose separately', () => {
    const course = detail.sending[0];
    expect(course.prerequisite_text).toBe('A grade of C or better in CMSC 140 or consent of department.');
    expect(course.corequisite_text).toBe('MATH 181.');
    expect(course.mentioned_codes).toEqual(['CMSC140', 'MATH181']);
  });

  // Description coverage is a property of the college's data, not of the
  // parser: Montgomery populates catalog text, Carroll ships an empty <p>.
  // Prerequisite yield therefore varies by sending institution and a zero here
  // must not be read as a parse failure.
  it('returns nulls, not guesses, when the catalog text is empty', () => {
    const empty = parseEquivalencyModal(fixture('equivalency-empty-description.html'));
    expect(empty.sending[0].units).toBe(3);
    expect(empty.sending[0].description).toBeNull();
    expect(empty.sending[0].prerequisite_text).toBeNull();
    expect(empty.sending[0].mentioned_codes).toEqual([]);
    expect(empty.effective).toBe('Winter 1998 - Summer 2013');
  });
});

describe('parseCourseModal', () => {
  const course = parseCourseModal(fixture('course-15578718.html'));

  it('reads the institution, code, title and units', () => {
    expect(course.institution).toBe('Capitol Technology University');
    expect(course.code).toBe('CS120');
    expect(course.title).toBe('Intro to Programming Using Python');
    expect(course.units).toBe(3);
  });

  it('reads the catalog description', () => {
    expect(course.description).toMatch(/^The course will cover basic concepts/);
  });
});

describe('extractRequisites', () => {
  it('is safe on empty and missing input', () => {
    expect(extractRequisites(null)).toEqual({
      prerequisite_text: null, corequisite_text: null, mentioned_codes: [],
    });
    expect(extractRequisites('A course with no stated rule.').prerequisite_text).toBeNull();
  });

  it('handles both spacings of a course code', () => {
    const r = extractRequisites('PREREQUISITE: MATH 181 and ENGL101.');
    expect(r.mentioned_codes).toEqual(['MATH181', 'ENGL101']);
  });

  it('does not let a long description bleed into the rule', () => {
    const r = extractRequisites(
      'Intro course. PREREQUISITE: MATH 181. Students also complete a portfolio and present it.'
    );
    expect(r.prerequisite_text).toBe('MATH 181.');
  });
});
