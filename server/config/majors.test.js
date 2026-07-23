import { describe, it, expect } from 'vitest';
import {
  getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery,
} from './majors';
import { _paperMajors as PAPER_MAJORS } from '../services/analysis/pathways';

describe('majors config', () => {
  it('cs is the default; bio and econ are onboarded alongside it', () => {
    expect(defaultMajor().slug).toBe('cs');
    expect(listMajors().map((m) => m.slug)).toEqual(['cs', 'bio', 'econ']);
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
    expect(getMajor('nope')).toBeNull();
    expect(getMajor('')).toBeNull();
    expect(getMajor(undefined)).toBeNull();
  });

  it('serializeMajors survives a JSON round-trip with every field intact', () => {
    const json = JSON.parse(JSON.stringify(serializeMajors()));
    const cs = json.find((m) => m.slug === 'cs');
    expect(cs.label).toBe('Computer Science');
    expect(cs.programs['79']).toContain('Computer Science, B.A.');
    expect(cs.categories.map((c) => c.key)).toContain('discrete_math');
    expect(cs.capabilities.paperBaselines).toBe(true);
    // Nothing in the config is a RegExp, so nothing is lost to stringify.
    expect(json).toEqual(serializeMajors());
  });

  it('majorScopeFromQuery: slug wins, contains kept for back-compat', () => {
    expect(majorScopeFromQuery({ major: 'cs' }))
      .toEqual({ slug: 'cs', majorContains: 'computer science' });
    expect(majorScopeFromQuery({ majorContains: 'econom' }))
      .toEqual({ slug: null, majorContains: 'econom' });
    expect(majorScopeFromQuery({})).toEqual({ slug: null, majorContains: '' });
    expect(majorScopeFromQuery({ major: 'nope' }))
      .toEqual({ error: 'unknown major: nope', known: ['cs', 'bio', 'econ'] });
  });

  it('majorScopeFromQuery prefers the slug when both are supplied', () => {
    expect(majorScopeFromQuery({ major: 'cs', majorContains: 'ignored' }))
      .toEqual({ slug: 'cs', majorContains: 'computer science' });
  });
});
