import { describe, it, expect } from 'vitest';
import {
  parseCourseCode, isWildcard, codeInBand, satisfies, consumeMatches,
} from './vaCourseCodes';

describe('parseCourseCode', () => {
  it('reads a concrete VCCS code', () => {
    expect(parseCourseCode('MTH263')).toMatchObject({ kind: 'concrete', prefix: 'MTH', number: 263 });
  });

  it('reads a concrete four-digit code with a space', () => {
    expect(parseCourseCode('ENGL 1105')).toMatchObject({ kind: 'concrete', prefix: 'ENGL', number: 1105 });
  });

  it('derives a three-digit band from a two-X run', () => {
    expect(parseCourseCode('SOCY2XX')).toMatchObject({
      kind: 'level_wildcard', prefix: 'SOCY', bands: [[200, 299]],
    });
  });

  it('derives a four-digit band from a three-X run', () => {
    expect(parseCourseCode('CS 4XXX')).toMatchObject({
      kind: 'level_wildcard', prefix: 'CS', bands: [[4000, 4999]],
    });
  });

  it('reads the user-cited ACCT2XX form with no separator', () => {
    expect(parseCourseCode('ACCT2XX')).toMatchObject({
      kind: 'level_wildcard', prefix: 'ACCT', bands: [[200, 299]],
    });
  });

  it('carries two bands for a slashed level', () => {
    expect(parseCourseCode('CS 4/5XXX')).toMatchObject({
      kind: 'level_wildcard', prefix: 'CS', bands: [[4000, 4999], [5000, 5999]],
    });
  });

  it('ignores a trailing designation letter (Virginia Tech Pathways codes)', () => {
    expect(parseCourseCode('MATH1XXP')).toMatchObject({
      kind: 'level_wildcard', prefix: 'MATH', bands: [[100, 199]],
    });
    expect(parseCourseCode('PHYS1XXX4')).toMatchObject({ kind: 'level_wildcard', prefix: 'PHYS' });
    expect(parseCourseCode('ART1XX6A')).toMatchObject({ kind: 'level_wildcard', prefix: 'ART', bands: [[100, 199]] });
  });

  it('keeps a real course concrete despite a trailing designation', () => {
    expect(parseCourseCode('BIO101L')).toMatchObject({ kind: 'concrete', prefix: 'BIO', number: 101 });
    expect(parseCourseCode('ED200SL')).toMatchObject({ kind: 'concrete', prefix: 'ED', number: 200 });
    expect(parseCourseCode('PE118+')).toMatchObject({ kind: 'concrete', prefix: 'PE', number: 118 });
  });

  it('does not read a level-plus-area marker as a course numbered 1', () => {
    // "LANG1GC" is 100-level language credit toward a global-culture area, not
    // LANG 1. Reading it as a course would let elective credit satisfy a
    // named requirement.
    expect(parseCourseCode('LANG1GC').kind).toBe('generic_credit');
    expect(parseCourseCode('TRNS1SS').kind).toBe('generic_credit');
    expect(parseCourseCode('ENGL2HC')).toMatchObject({ kind: 'generic_credit', prefix: 'ENGL', bands: [[200, 299]] });
  });

  it('reads slot-bookkeeping prefixes as subjectless generic credit', () => {
    expect(parseCourseCode('PreReq8')).toMatchObject({ kind: 'generic_credit', prefix: null });
    expect(parseCourseCode('LABSCI1')).toMatchObject({ kind: 'generic_credit', prefix: null });
  });

  it('strips the O-for-zero placeholder from a prefix', () => {
    expect(parseCourseCode('PSYCOO2')).toMatchObject({ kind: 'open_wildcard', prefix: 'PSYC' });
    expect(parseCourseCode('SOCIOO1')).toMatchObject({ kind: 'open_wildcard', prefix: 'SOCI' });
  });

  it('reads the dash form as an open wildcard with no level', () => {
    expect(parseCourseCode('ENGH----')).toMatchObject({
      kind: 'open_wildcard', prefix: 'ENGH', bands: [[0, Infinity]],
    });
  });

  it('reads institution-specific elective markers, keeping the level', () => {
    expect(parseCourseCode('SOC2ELE')).toMatchObject({ kind: 'generic_credit', prefix: 'SOC', bands: [[200, 299]] });
    expect(parseCourseCode('LIT1REQ')).toMatchObject({ kind: 'generic_credit', prefix: 'LIT', bands: [[100, 199]] });
  });

  it('reads a run of letter O as a placeholder, not a course number', () => {
    // Several four-years write CSOOO where CS000 is meant.
    expect(parseCourseCode('CSOOO')).toMatchObject({ kind: 'open_wildcard', prefix: 'CS' });
    expect(parseCourseCode('CS000')).toMatchObject({ kind: 'open_wildcard', prefix: 'CS' });
  });

  it('reads subjectless free credit with no prefix at all', () => {
    expect(parseCourseCode('ELECTIVE')).toMatchObject({ kind: 'generic_credit', prefix: null });
    expect(parseCourseCode('TRNFREE')).toMatchObject({ kind: 'generic_credit', prefix: null });
  });

  it('reads a GE area marker as generic credit in that area', () => {
    expect(parseCourseCode('GESCI')).toMatchObject({ kind: 'generic_credit', prefix: 'SCI' });
    expect(parseCourseCode('GEHUM')).toMatchObject({ kind: 'generic_credit', prefix: 'HUM' });
  });

  it('falls back to generic credit rather than inventing a course', () => {
    // The conservative direction: an unrecognised string can never satisfy a
    // named requirement, so an unknown spelling understates rather than inflates.
    expect(parseCourseCode('ENGLNOTMJ').kind).toBe('generic_credit');
    expect(parseCourseCode('QUANTELCT').kind).toBe('generic_credit');
    expect(parseCourseCode('').kind).toBe('unparsed');
    expect(parseCourseCode(null).kind).toBe('unparsed');
  });
});

describe('isWildcard', () => {
  it('separates generic identifiers from real courses', () => {
    expect(isWildcard('SOCY2XX')).toBe(true);
    expect(isWildcard('ENGH----')).toBe(true);
    expect(isWildcard('SOC2ELE')).toBe(true);
    expect(isWildcard('TRNFREE')).toBe(true);
    expect(isWildcard('MATH113')).toBe(false);
    expect(isWildcard('ENGL 1105')).toBe(false);
  });
});

describe('codeInBand', () => {
  it('accepts a real course inside the band', () => {
    expect(codeInBand('SOCY2XX', 'SOCY251')).toBe(true);
    expect(codeInBand('CS 4XXX', 'CS 4974')).toBe(true);
  });

  it('rejects the wrong level or the wrong subject', () => {
    expect(codeInBand('SOCY2XX', 'SOCY101')).toBe(false);
    expect(codeInBand('SOCY2XX', 'HIST201')).toBe(false);
  });

  it('accepts any level for the open dash form', () => {
    expect(codeInBand('CS----', 'CS 1114')).toBe(true);
    expect(codeInBand('CS----', 'CS 4974')).toBe(true);
    expect(codeInBand('CS----', 'MATH113')).toBe(false);
  });
});

describe('satisfies', () => {
  it('matches concrete to concrete only when the code is the same', () => {
    expect(satisfies('MATH113', 'MATH113')).toBe(true);
    expect(satisfies('MATH113', 'MATH114')).toBe(false);
  });

  it('never lets a lecture equivalency satisfy its laboratory', () => {
    // Norfolk State requires the series "BIO110 + BIO110L". Virginia publishes
    // an equivalency for the lecture (BIO101 → BIO110) and none for the lab, so
    // the series cannot be completed. Ignoring the suffix credited it anyway.
    expect(satisfies('BIO110L', 'BIO110')).toBe(false);
    expect(satisfies('BIO110', 'BIO110L')).toBe(false);
    expect(satisfies('BIO110L', 'BIO110L')).toBe(true);
  });

  it('lets a real course satisfy a generic requirement slot', () => {
    // New River writes "CSC 1XX" as a categorical allowance.
    expect(satisfies('CSC 1XX', 'CSC110')).toBe(true);
  });

  it('NEVER lets generic transfer credit satisfy a named requirement', () => {
    // The core Virginia rule: "lands as SOCY2XX" is unspecified elective
    // credit and cannot stand in for a required SOCY 251.
    expect(satisfies('SOCY251', 'SOCY2XX')).toBe(false);
    expect(satisfies('ENGH101', 'ENGH----')).toBe(false);
  });

  it('lets generic credit satisfy a generic slot in the same subject and band', () => {
    expect(satisfies('SOCY2XX', 'SOCY2XX')).toBe(true);
    expect(satisfies('SOCY2XX', 'SOCY251')).toBe(true);
  });

  it('rejects generic credit against a generic slot in another band', () => {
    expect(satisfies('SOCY1XX', 'SOCY2XX')).toBe(false);
  });

  it('treats an open wildcard as overlapping every band of its subject', () => {
    expect(satisfies('CS 4XXX', 'CS----')).toBe(true);
    expect(satisfies('MATH1XX', 'CS----')).toBe(false);
  });

  it('never lets a subjectless requirement act as a wildcard for any subject', () => {
    // Requirement prose parses to no subject. If that counted as "any subject",
    // generic CS credit would satisfy a literature slot and English credit a
    // science slot — both observed before this rule was tightened.
    expect(satisfies('Mason Core Literature', 'CS----')).toBe(false);
    expect(satisfies('Additional qualifying natural science', 'ENGH----')).toBe(false);
  });

  it('still lets free elective credit fill an explicitly free slot', () => {
    expect(satisfies('ELECTIVE', 'TRNFREE')).toBe(true);
  });
});

describe('consumeMatches', () => {
  it('spends each supply row once, so repeated slots do not double-count', () => {
    // Two identical generic slots, one qualifying course: exactly one is met.
    const result = consumeMatches(['SOCY2XX', 'SOCY2XX'], ['SOCY251']);
    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toEqual(['SOCY2XX']);
    expect(result.leftover).toEqual([]);
  });

  it('meets both slots when two qualifying courses exist', () => {
    const result = consumeMatches(['SOCY2XX', 'SOCY2XX'], ['SOCY251', 'SOCY268']);
    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toEqual([]);
  });

  it('reports the supply it never spent', () => {
    const result = consumeMatches(['MATH113'], ['MATH113', 'SOCY251']);
    expect(result.leftover).toEqual(['SOCY251']);
  });

  it('does not let one generic credit cover a named course plus a generic slot', () => {
    const result = consumeMatches(['SOCY251', 'SOCY2XX'], ['SOCY2XX']);
    // The named requirement is unmet (generic credit cannot name-match) and the
    // generic slot consumes the single credit.
    expect(result.matched).toEqual([{ demand: 'SOCY2XX', supply: 'SOCY2XX' }]);
    expect(result.unmatched).toEqual(['SOCY251']);
  });
});
