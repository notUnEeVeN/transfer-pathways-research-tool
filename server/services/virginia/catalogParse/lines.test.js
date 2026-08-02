import { describe, it, expect } from 'vitest';
import { parseTextProgram, parseRow } from './lines';
import { creditsFromHeading, parseInstruction, codesIn } from './normalize';

describe('course codes in catalog text', () => {
  it('finds a code with no space before it', () => {
    // Catalog text runs together at column boundaries. A left `\b` never
    // matches between `3` and `C`, which is how 16 courses once read as 2.
    expect(codesIn('Credits: 3CSC 221 Introduction')).toEqual(['CSC221']);
  });

  it('strips the credit and semester markers Acalog glues onto the next code', () => {
    expect(codesIn('CRENG111')).toEqual(['ENG111']);
    expect(codesIn('IICSC223')).toEqual(['CSC223']);
  });

  it('reads four-digit university numbering', () => {
    expect(codesIn('CS 1114 and ENGL 1105')).toEqual(['CS1114', 'ENGL1105']);
  });

  it('does not mistake page furniture for a course', () => {
    expect(codesIn('ROOM 214, PHONE 540')).toEqual([]);
  });
});

describe('credit figures in headings', () => {
  it('reads a figure printed with no space before the unit', () => {
    // `(6cr)` — the same missing-boundary trap, in the other direction.
    expect(creditsFromHeading('Written Communication (6cr)').credits).toMatchObject({ min: 6, max: 6 });
  });

  it('reads a range', () => {
    expect(creditsFromHeading('Transfer Electives (7-10)').credits).toMatchObject({ min: 7, max: 10 });
  });

  it('takes the last parenthetical, not the first', () => {
    const heading = 'Transfer Electives (Prerequisites if needed) (7-10)';
    expect(creditsFromHeading(heading).credits).toMatchObject({ min: 7, max: 10 });
  });

  it('is null when the heading states no figure', () => {
    expect(creditsFromHeading('Major Requirements')).toBeNull();
  });

  it('does not read a state program code as a credit figure', () => {
    // `Computer Science Degree, AS 246` prints the state program code, not 246
    // credits. Believing it makes the group swamp the whole degree.
    expect(creditsFromHeading('Computer Science Degree, AS 246 Credits')).toBeNull();
  });
});

describe('the degree total', () => {
  const total = (line) => parseTextProgram(`Major Requirements\nCSC 221 Intro\n${line}`).total_credits;

  it('reads the unit-first form', () => {
    expect(total('Total Minimum Credits - 60')).toMatchObject({ min: 60 });
  });

  it('reads the number-first form', () => {
    expect(total('Program Total: 60-64 Credits')).toMatchObject({ min: 60, max: 64 });
  });

  it('leaves a bare term subtotal as the group credit, not the degree total', () => {
    const tree = parseTextProgram('First Semester\nCSC 221 Intro\nTotal 16-17\nSecond Semester\nCSC 222 OOP\nTotal 14\nProgram Total: 60 Credits');
    expect(tree.total_credits).toMatchObject({ min: 60 });
    expect(tree.groups[0].credits).toMatchObject({ min: 16, max: 17 });
    expect(tree.groups[1].credits).toMatchObject({ min: 14 });
  });
});

describe('instructions', () => {
  it('reads a spelled-out course count', () => {
    expect(parseInstruction('Choose any two courses from the options below')).toMatchObject({ courses: 2 });
  });

  it('separates a credit ask from a course count', () => {
    const parsed = parseInstruction('Choose any two courses (6cr) from the options below');
    expect(parsed.courses).toBe(2);
    expect(parsed.credits).toMatchObject({ min: 6 });
  });

  it('reads a spread constraint across categories', () => {
    const parsed = parseInstruction('Choose any two courses (6cr) - selections must be from two different categories');
    expect(parsed.distinct_sections).toBe(2);
  });

  it('treats "one of the following" as a choice of one', () => {
    expect(parseInstruction('Select one of the following:')).toMatchObject({ courses: 1 });
  });
});

describe('a printed requirement row', () => {
  it('splits alternatives on the connector that sits between them', () => {
    const row = parseRow('CSC 205: Computer Organization or MTH 265 Calculus III');
    expect(row.codes.map((c) => c.code)).toEqual(['CSC205', 'MTH265']);
    expect(row.conjunction).toBe('or');
  });

  it('keeps a sequence as a required pair', () => {
    const row = parseRow('MTH 161: Precalculus I /MTH 162 Precalculus II');
    expect(row.conjunction).toBe('and');
  });

  it('assigns each title to its own course', () => {
    const row = parseRow('ENG 112: College Composition II or ENG 113: Technical-Professional Writing');
    expect(row.codes).toEqual([
      { code: 'ENG112', title: 'College Composition II' },
      { code: 'ENG113', title: 'Technical-Professional Writing' },
    ]);
  });

  it('records a line with no course as a category', () => {
    const row = parseRow('Any World Language');
    expect(row.codes).toEqual([]);
    expect(row.category).toBe('Any World Language');
  });
});

const GERMANNA = `
Computer Science Curriculum Degree Requirements:
Student Development (1cr)
SDV 100: College Success Skills or SDV 101
Written Communication (6cr)
ENG 111: College Composition I
ENG 112: College Composition II or ENG 113: Technical-Professional Writing
Arts, Humanities, and Literature (6cr)

Choose any two courses (6cr) from the options below - selections must be from two different categories

Art

ART 101: History of Art: Prehistoric to Gothic
ART 102: History of Art: Renaissance to Modern

Humanities

HUM 201: Early Humanities
PHI 220: Ethics

Literature

ENG 225: Reading Literature
Major Requirements (17cr)
CSC 221: Introduction to Problem Solving and Programming
CSC 205: Computer Organization or MTH 265 Calculus III
Total Minimum Credits - 60
Suggested Scheduling:
First Year
First Five
SDV 100: College Success Skills
CSC 221: Introduction to Problem Solving and Programming
Total Credits: 16-18
`;

const INLINE_CREDITS = `
Admissions Requirements:
Placement into MTH 263 (Calculus I) or completion of MTH 167 (Precalculus with Trigonometry)
Fall Semester- Year 1
SDV 100 - College Success Skills Credits: 1
ENG 111 - College Composition I Credits: 3
UCGS Block III: Social and Behavioral Sciences: Credits: 3
Spring Semester- Year 1
CSC 208 - Introduction to Discrete Structures Credits: 3 Or MTH 288 - Discrete Mathematics
PHY 241 - University Physics I Credits: 4 Or CHM 111 - General Chemistry I
Total Program Credits: 60-61
`;

describe('a page that prints Credits on every row', () => {
  const tree = parseTextProgram(INLINE_CREDITS);

  it('groups by term instead of promoting every row to a group', () => {
    // Here a credit figure marks a row, not a heading — the opposite of the
    // Acalog convention. Reading it the Acalog way makes each course its own
    // group and the degree unreadable.
    expect(tree.groups.map((g) => g.title)).toEqual(['Fall Semester- Year 1', 'Spring Semester- Year 1']);
  });

  it('ignores courses named in prose before the first heading', () => {
    // "Placement into MTH 263 or completion of MTH 167" is an admissions note.
    // Counting it as a requirement adds courses the degree never asked for.
    const codes = tree.groups.flatMap((g) => g.sections.flatMap((s) => s.rows.flatMap((r) => r.codes.map((c) => c.code))));
    expect(codes).not.toContain('MTH167');
  });

  it('takes the credit figure off the row and out of the title', () => {
    const sdv = tree.groups[0].sections[0].rows[0];
    expect(sdv.codes[0]).toEqual({ code: 'SDV100', title: 'College Success Skills' });
    expect(sdv.credits).toMatchObject({ min: 1 });
  });

  it('keeps a credit-bearing line with no course as a requirement', () => {
    const block = tree.groups[0].sections[0].rows.find((r) => !r.codes.length);
    expect(block.category).toMatch(/UCGS Block III/);
    expect(block.credits).toMatchObject({ min: 3 });
  });

  it('reads an alternative stated after the credit figure', () => {
    const row = tree.groups[1].sections[0].rows[0];
    expect(row.codes.map((c) => c.code)).toEqual(['CSC208', 'MTH288']);
    expect(row.conjunction).toBe('or');
  });

  it('reads the degree total, not a row credit', () => {
    expect(tree.total_credits).toMatchObject({ min: 60, max: 61 });
  });
});

describe('an Acalog program page', () => {
  const tree = parseTextProgram(GERMANNA);

  it('opens a group at every credit-bearing heading', () => {
    expect(tree.groups.map((g) => g.title)).toEqual([
      'Student Development',
      'Written Communication',
      'Arts, Humanities, and Literature',
      'Major Requirements',
    ]);
  });

  it('stops before the suggested schedule', () => {
    // The schedule restates the same courses. Reading past it counts the
    // degree twice — the most expensive available mistake on these pages.
    expect(tree.stopped_at).toMatch(/Suggested Scheduling/);
    const major = tree.groups.find((g) => g.title === 'Major Requirements');
    const rows = major.sections.flatMap((s) => s.rows);
    expect(rows.filter((r) => r.codes.some((c) => c.code === 'CSC221'))).toHaveLength(1);
  });

  it('reads the degree total, not a semester subtotal', () => {
    expect(tree.total_credits).toMatchObject({ min: 60 });
  });

  it('keeps sub-headings as sections of one group, not as groups', () => {
    const arts = tree.groups.find((g) => g.title === 'Arts, Humanities, and Literature');
    expect(arts.sections.map((s) => s.label)).toEqual(['Art', 'Humanities', 'Literature']);
  });

  it('scopes a group-opening instruction to the whole group', () => {
    // "choose two ... from two different categories" binds across Art,
    // Humanities and Literature. Filing it on the first section would bind it
    // to Art alone and leave the other two unadvised.
    const arts = tree.groups.find((g) => g.title === 'Arts, Humanities, and Literature');
    expect(arts.choose).toBe(2);
    expect(arts.distinct_sections).toBe(2);
    expect(arts.sections.every((s) => s.choose == null)).toBe(true);
  });
});
