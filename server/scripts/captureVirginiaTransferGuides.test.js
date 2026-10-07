import { describe, expect, it } from 'vitest';
import { expandCodes, parseGuide } from './captureVirginiaTransferGuides';

const table = (rows) => `<table>${rows.map(
  (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`,
).join('')}</table>`;

const HEADER = ['Complete at a Virginia Community College', 'Credits', 'Course Equivalent', 'Notes'];

describe('expandCodes', () => {
  it('reads a single code written with a space', () => {
    expect(expandCodes('MTH 263 Calculus I')).toEqual(['MTH263']);
  });

  it('carries the prefix across a comma list', () => {
    // "HIST 101, 102, 111, or 112" is a four-way choice. Without a sticky
    // prefix it reads as one course plus three stray integers, and a rule the
    // student can satisfy four ways looks like a single required course.
    expect(expandCodes('Any UCGS History: HIST 101, 102, 111, or 112'))
      .toEqual(['HIST101', 'HIST102', 'HIST111', 'HIST112']);
  });

  it('switches prefix when a new one appears', () => {
    expect(expandCodes('CSC 208 Discrete Structures or MTH 288 Discrete Math'))
      .toEqual(['CSC208', 'MTH288']);
  });

  it('handles a long mixed choice list', () => {
    expect(expandCodes(
      'BIO 101 Gen Biology I, CHM 111 Gen Chemistry I, PHY 201, GOL 105, GOL 106, or GOL 110',
    )).toEqual(['BIO101', 'CHM111', 'PHY201', 'GOL105', 'GOL106', 'GOL110']);
  });

  it('ignores credit figures and leading numbers that are not course numbers', () => {
    expect(expandCodes('Electives as needed to reach 60 pre-transfer credits')).toEqual([]);
  });

  it('yields nothing for a bare category with no prefix in scope', () => {
    expect(expandCodes('Any UCGS Art or Humanities')).toEqual([]);
  });
});

describe('parseGuide', () => {
  const guide = (rows) => parseGuide(table([HEADER, ...rows]), { slug: 's', title: 't' });

  it('classifies a single course, a choice, and a gen-ed category', () => {
    const { cc_items: items } = guide([
      ['ENG 111 College Comp I', '3', 'ENGL 110', ''],
      ['CST 100 Public Speaking or CST 110 Human Communication', '3', 'COMM 101', ''],
      ['Any UCGS History', '3', 'Liberal Learning Curriculum', ''],
    ]);
    expect(items.map((i) => i.kind)).toEqual(['course', 'course_choice', 'gened_category']);
    expect(items[1].cc_codes).toEqual(['CST100', 'CST110']);
  });

  it('marks a gen-ed category as assumed but still countable', () => {
    // Every VCCS college teaches the UCGS blocks, so these are satisfiable by
    // construction — but a coverage figure has to be able to show how much of
    // itself is assumption, so the flag travels with the row.
    const [item] = guide([['Any UCGS Art or Humanities', '3', 'Fine Arts Req', '']]).cc_items;
    expect(item).toMatchObject({ auto_satisfied: true, counts_toward_stats: true });
  });

  it('excludes credit-total and padding rows from the denominator', () => {
    const { cc_items: items } = guide([
      ['ENG 111', '3', 'ENGL 110', ''],
      ['Electives as needed to reach 60 pre-transfer credits', '11', '', ''],
      ['Pre-Transfer Credits', '60', '', ''],
    ]);
    expect(items.filter((i) => i.counts_toward_stats).map((i) => i.cc_codes)).toEqual([['ENG111']]);
  });

  it('stops at the post-transfer section so bachelor-side rows never count as CC requirements', () => {
    // The second half of a guide is the rest of the degree, taken after
    // transfer. Reading past the divider would add ~60 credits of four-year
    // coursework to the community-college requirement list.
    const { cc_items: items } = guide([
      ['MTH 263 Calculus I', '4', 'MATH 103', ''],
      ['Complete at University of Lynchburg', 'Credits', 'Notes', ''],
      ['CS 451', '3', '', ''],
      ['General Electives', '11', '', ''],
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].cc_codes).toEqual(['MTH263']);
  });

  it('accepts the alternate header wording some institutions use', () => {
    const parsed = parseGuide(table([
      ['Community College Course', 'Credits', 'Course Equivalent', 'Notes'],
      ['CSC 221 Intro to Programming', '3', 'CS 131', ''],
    ]), { slug: 's', title: 't' });
    expect(parsed.cc_items[0].cc_codes).toEqual(['CSC221']);
  });

  it('keeps a no-transfer-credit row as a real requirement row', () => {
    // "No Transfer Credit" is the receiver's explicit verdict, not a missing
    // value; dropping it would hide a course the guide tells students to take
    // that earns them nothing.
    const [item] = guide([['SDV 100 College Success Skills', '1', 'No Transfer Credit', '']]).cc_items;
    expect(item).toMatchObject({ kind: 'course', equivalent: 'No Transfer Credit' });
  });

  it('reads inline totals without counting the post-transfer total as a course', () => {
    const parsed = guide([
      ['CSC 221', '3', 'CS 101', ''],
      ['Credits Pre-Transfer: 60', '', '', ''],
      ['Complete at Radford University', 'Credits', 'Notes', ''],
      ['CS 300', '3', '', ''],
      ['Credits Post-Transfer: 60', '', '', ''],
    ]);
    expect(parsed.totals).toEqual({ pre_transfer_raw: '60', post_transfer_raw: '60' });
    expect(parsed.post_items.map((row) => row.requirement_text)).toEqual(['CS 300']);
  });

  it('preserves subject-restricted electives as named graduation requirements', () => {
    const parsed = guide([
      ['CSC 221', '3', 'CS 101', ''],
      ['Complete at University', 'Credits', 'Notes', ''],
      ['Senior Major Electives', '9', '', ''],
      ['CMSC upper-level electives', '12', '', ''],
      ['Restricted CMSC electives', '12-13', '', ''],
      ['Statistics Elective', '3', '', ''],
      ['Upper-Level General Elective', '0-2', '', ''],
      ['Unrestricted Elective (4 of 4)', '3', '', ''],
      ['Elective Courses', '14', '', ''],
    ]);
    expect(parsed.post_items.filter((row) => row.counts_toward_stats)
      .map((row) => row.requirement_text)).toEqual([
      'Senior Major Electives', 'CMSC upper-level electives',
      'Restricted CMSC electives', 'Statistics Elective',
    ]);
  });
});
