import { describe, expect, it } from 'vitest';
import { parseCatalogPage, parseRequisiteClause } from './parsePrereqs';

describe('prerequisite clause parsing', () => {
  it('reads an AND of ORs the way catalogues write it', () => {
    // UC San Diego CSE 100, verbatim.
    expect(parseRequisiteClause(
      'CSE 21 or MATH 154 or MATH 158 or MATH 184 or MATH 188 and CSE 12 and CSE 15L or CSE 29 or ECE 15'
    )).toEqual([
      ['CSE 21', 'MATH 154', 'MATH 158', 'MATH 184', 'MATH 188'],
      ['CSE 12'],
      ['CSE 15L', 'CSE 29', 'ECE 15'],
    ]);
  });

  it('stops at the first clause that is no longer about prerequisites', () => {
    // Everything after the semicolon names courses but is not a requirement.
    expect(parseRequisiteClause(
      'CSE 12; restricted to undergraduates. Students may not receive credit for both CSE 100R and CSE 100.'
    )).toEqual([['CSE 12']]);
  });

  it('yields nothing for a clause that names no course', () => {
    expect(parseRequisiteClause('consent of instructor')).toEqual([]);
    expect(parseRequisiteClause('senior standing with substantial programming experience')).toEqual([]);
  });

  it('does not read a shorter code out of a longer one', () => {
    // "MATH 15AB" must not yield "MATH 15A".
    expect(parseRequisiteClause('MATH 15AB')).toEqual([['MATH 15AB']]);
  });

  it('de-duplicates repeated alternatives within a conjunct', () => {
    expect(parseRequisiteClause('CSE 12 or CSE 12')).toEqual([['CSE 12']]);
  });

  it('handles a course code written without a space', () => {
    expect(parseRequisiteClause('CSE100 and MATH20C')).toEqual([['CSE 100'], ['MATH 20C']]);
  });

  it('keeps multi-word department prefixes whole', () => {
    // Reading only the last word turns "BIO SCI 97" into "SCI 97", which
    // resolves to no course at all.
    expect(parseRequisiteClause('BIO SCI 97 and CHEM 1C'))
      .toEqual([['BIO SCI 97'], ['CHEM 1C']]);
    expect(parseRequisiteClause('I&C SCI 33 or CSE 43'))
      .toEqual([['I&C SCI 33', 'CSE 43']]);
  });

  it('does not swallow an ordinary word before a code', () => {
    expect(parseRequisiteClause('two courses from MATH 20A')).toEqual([['MATH 20A']]);
    expect(parseRequisiteClause('MATH 20A and MATH 20B'))
      .toEqual([['MATH 20A'], ['MATH 20B']]);
  });

  it('reads a comma list as alternatives only when the clause says "or"', () => {
    expect(parseRequisiteClause('CSE 5J, or CSE 12')).toEqual([['CSE 5J', 'CSE 12']]);
    expect(parseRequisiteClause('CSE 12, CSE 15L and MATH 20A'))
      .toEqual([['CSE 12'], ['CSE 15L'], ['MATH 20A']]);
  });
});

describe('UC San Diego catalogue pages', () => {
  const page = `
    <p class="course-name">CSE 12. Basic Data Structures (4)</p>
    <p class="course-descriptions">Uses C++. <strong><em>Prerequisites:</em></strong>
      CSE 8B or CSE 11.</p>
    <p class="course-name">CSE 190. Topics (4)</p>
    <p class="course-descriptions">Varies. <strong><em>Prerequisites:</em></strong>
      consent of instructor.</p>`;

  it('extracts code, title, units and structured prerequisites', () => {
    const [twelve, ninety] = parseCatalogPage('ucsd', page);
    expect(twelve).toMatchObject({
      code: 'CSE 12', title: 'Basic Data Structures', units: '4',
      requires: [['CSE 8B', 'CSE 11']],
    });
    // A real course with a real clause that gates on nothing enumerable.
    expect(ninety.code).toBe('CSE 190');
    expect(ninety.requires).toEqual([]);
  });
});
