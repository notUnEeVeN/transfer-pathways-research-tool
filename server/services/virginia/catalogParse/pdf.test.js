import { describe, expect, it } from 'vitest';
import { narrowToProgram } from './pdf';

const CAMP_PARSE = {
  program_identity_start_anchor: 'Associate of Science COMPUTER SCIENCE',
  program_identity_anchors: [
    'Plan Code:      246',
    'CIP Code:       11.0701',
    'NEW degree plan, effective Fall 2024.',
  ],
  requirements_start_anchor: 'AS Computer Science (246)',
  requirements_end_anchor: 'COMPUTER SUPPORT SPECIALIST',
  program_printed_pages: [265, 267],
  program_pdf_pages: [1, 3],
};

const CAMP_TEXT = [
  [
    'Associate of Science COMPUTER SCIENCE',
    'Program: Computer Science',
    'Award: Associate of Science',
    'NEW degree plan, effective Fall 2024.',
    'Plan Code:      246',
    'CIP Code:       11.0701',
    // This is deliberately beyond the generic parser's 80-line course probe.
    // The registry anchors, rather than a widened heuristic, locate the table.
    ...Array.from({ length: 85 }, (_, i) => `Program narrative line ${i + 1}`),
    '265',
  ].join('\n'),
  [
    'AS Computer Science (246)',
    'Required Courses and Credits',
    'ENG 111 College Composition I 3',
    'MTH 161 Pre-Calculus I 3',
    'CSC 221 Introduction to Problem Solving and Programming 3',
    'SDV 100 College Success Skills 1',
    '266',
  ].join('\n'),
  [
    'CSC 222 Object-Oriented Programming 4',
    'CSC 223 Data Structures and Analysis of Algorithms 4',
    'Total Program Credits 61',
    'COMPUTER SUPPORT SPECIALIST',
    'ITE 152 Introduction to Digital and Information Literacy 3',
    '267',
  ].join('\n'),
].join('\f');

describe('Virginia whole-catalog PDF narrowing', () => {
  it('fails closed when course-rich catalog text has no Computer Science heading', () => {
    const text = `
      2026-2027 Undergraduate Catalog
      Information Systems Program
      The catalog contains many courses from programs other than Computer Science.
      IT 101 Introduction to Information Systems
      IT 201 Systems Analysis
      BUS 220 Business Statistics
      MTH 263 Calculus I
      PHY 241 University Physics I
      ENG 111 College Composition
    `;

    const result = narrowToProgram(text);

    expect(result).toMatchObject({
      found: false,
      text: '',
      start: null,
      end: null,
      lines: 0,
    });
    expect(result.reason).toMatch(/no Computer Science section/i);
  });

  it('rejects HTML before looking for catalog headings or course codes', () => {
    const result = narrowToProgram(`<!doctype html><html><body>
      <h1>Computer Science Program</h1>
      CSC 101 CSC 102 CSC 201 CSC 202
    </body></html>`);

    expect(result).toMatchObject({ found: false, text: '', lines: 0 });
    expect(result.reason).toMatch(/HTML/);
  });

  it('returns only the located Computer Science program window', () => {
    const text = `
      Computer Science Program
      Associate of Science in Computer Science
      This curriculum prepares students for transfer to a four-year institution.
      Students complete the following required courses and approved electives.
      CSC 110 Introduction to Computing
      CSC 205 Computer Organization
      MTH 263 Calculus I
      PHY 241 University Physics I
      Students must also complete all general education and graduation requirements.
      Business Administration Program
      BUS 100 Introduction to Business
      ACC 211 Principles of Accounting
    `;

    const result = narrowToProgram(text);

    expect(result.found).toBe(true);
    expect(result.text).toContain('Associate of Science in Computer Science');
    expect(result.text).toContain('CSC 205 Computer Organization');
    expect(result.text).not.toContain('Business Administration Program');
    expect(result.text).not.toContain('ACC 211');
    expect(result.lines).toBeGreaterThan(4);
  });

  it('uses configured requirement, identity, and page evidence for a PDF-only program', () => {
    expect(narrowToProgram(CAMP_TEXT).found).toBe(false);

    const result = narrowToProgram(CAMP_TEXT, CAMP_PARSE);

    expect(result).toMatchObject({
      found: true,
      mode: 'configured_anchors',
      start_page: 2,
      end_page: 3,
      reason: null,
      evidence: {
        requirements_start: { anchor: 'AS Computer Science (246)', page: 2 },
        requirements_end: { anchor: 'COMPUTER SUPPORT SPECIALIST', page: 3 },
        program_identity_start: { anchor: 'Associate of Science COMPUTER SCIENCE', page: 1 },
        pages: {
          configured_pdf_pages: [1, 3],
          configured_printed_pages: [265, 267],
          printed_folios: [
            { pdf_page: 1, expected_printed_page: 265, printed_page_found: true },
            { pdf_page: 2, expected_printed_page: 266, printed_page_found: true },
            { pdf_page: 3, expected_printed_page: 267, printed_page_found: true },
          ],
        },
      },
    });
    expect(result.evidence.program_identity_anchors.map((item) => item.anchor)).toEqual([
      'Plan Code: 246',
      'CIP Code: 11.0701',
      'NEW degree plan, effective Fall 2024.',
    ]);
    expect(result.text).toContain('CSC 223 Data Structures and Analysis of Algorithms');
    expect(result.text).not.toContain('Program narrative line');
    expect(result.text).not.toContain('COMPUTER SUPPORT SPECIALIST');
    expect(result.text).not.toContain('ITE 152');
  });

  it('fails closed when either configured requirement anchor is missing', () => {
    const noStart = narrowToProgram(CAMP_TEXT, {
      ...CAMP_PARSE,
      requirements_start_anchor: 'AS Computer Science (999)',
    });
    const noEnd = narrowToProgram(CAMP_TEXT, {
      ...CAMP_PARSE,
      requirements_end_anchor: 'NEXT PROGRAM THAT DOES NOT EXIST',
    });

    expect(noStart).toMatchObject({ found: false, text: '', lines: 0 });
    expect(noStart.reason).toMatch(/requirements_start_anchor not found/i);
    expect(noStart.missing_evidence).toContainEqual(expect.objectContaining({
      kind: 'requirements_start_anchor',
      anchor: 'AS Computer Science (999)',
    }));
    expect(noEnd).toMatchObject({ found: false, text: '', lines: 0 });
    expect(noEnd.reason).toMatch(/requirements_end_anchor not found/i);
  });

  it('fails closed when configured degree identity or cited pages do not match', () => {
    const wrongIdentity = narrowToProgram(CAMP_TEXT, {
      ...CAMP_PARSE,
      program_identity_anchors: [...CAMP_PARSE.program_identity_anchors, 'CIP Code: 11.9999'],
    });
    const wrongPages = narrowToProgram(CAMP_TEXT, {
      ...CAMP_PARSE,
      program_pdf_pages: [10, 12],
    });

    expect(wrongIdentity).toMatchObject({ found: false, text: '', lines: 0 });
    expect(wrongIdentity.reason).toMatch(/identity evidence not found/i);
    expect(wrongPages).toMatchObject({ found: false, text: '', lines: 0 });
    expect(wrongPages.reason).toMatch(/outside program_pdf_pages 10-12/i);
  });
});
