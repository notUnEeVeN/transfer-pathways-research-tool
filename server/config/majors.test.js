import { describe, it, expect } from 'vitest';
import {
  getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery,
} from './majors';
import { _paperMajors as PAPER_MAJORS } from '../services/analysis/pathways';

describe('majors config', () => {
  it('cs is the default and the only onboarded major', () => {
    expect(defaultMajor().slug).toBe('cs');
    expect(listMajors().map((m) => m.slug)).toEqual(['cs']);
  });

  it('cs program pins are byte-identical to the paper pins', () => {
    expect(getMajor('cs').programs).toEqual(PAPER_MAJORS);
  });

  it('preserves the stored trailing space in the Merced program name', () => {
    expect(getMajor('cs').programs[144]).toContain('COMPUTER SCIENCE AND ENGINEERING, B.S. ');
  });

  it('cs match string and capabilities', () => {
    const cs = getMajor('cs');
    expect(cs.match).toBe('computer science');
    expect(cs.capabilities.asDegrees).toBe(true);
    expect(cs.capabilities.paperBaselines).toBe(true);
    expect(cs.capabilities.transferMinimums).toBe(true);
  });

  it('unknown slug returns null', () => {
    expect(getMajor('bio')).toBeNull();
    expect(getMajor('')).toBeNull();
    expect(getMajor(undefined)).toBeNull();
  });

  it('serializeMajors is JSON-safe (regexes become {source, flags})', () => {
    const json = JSON.parse(JSON.stringify(serializeMajors()));
    const cs = json.find((m) => m.slug === 'cs');
    expect(cs.coursePatterns.discreteMath.source).toContain('discrete');
    expect(typeof cs.coursePatterns.discreteMath.flags).toBe('string');
    expect(Array.isArray(cs.coursePatterns.computingPrefixes)).toBe(true);
    expect(cs.coursePatterns.textRules[0]).toHaveProperty('pattern.source');
    expect(cs.coursePatterns.textRules[0]).toHaveProperty('type');
  });

  it('majorScopeFromQuery: slug wins, contains kept for back-compat', () => {
    expect(majorScopeFromQuery({ major: 'cs' }))
      .toEqual({ slug: 'cs', majorContains: 'computer science' });
    expect(majorScopeFromQuery({ majorContains: 'econom' }))
      .toEqual({ slug: null, majorContains: 'econom' });
    expect(majorScopeFromQuery({})).toEqual({ slug: null, majorContains: '' });
    expect(majorScopeFromQuery({ major: 'nope' }))
      .toEqual({ error: 'unknown major: nope', known: ['cs'] });
  });

  it('majorScopeFromQuery prefers the slug when both are supplied', () => {
    expect(majorScopeFromQuery({ major: 'cs', majorContains: 'ignored' }))
      .toEqual({ slug: 'cs', majorContains: 'computer science' });
  });
});
