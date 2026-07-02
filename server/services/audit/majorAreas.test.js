import { describe, it, expect } from 'vitest';
import { classifyArea, AREAS } from './majorAreas.js';

describe('classifyArea', () => {
  it('buckets representative majors', () => {
    expect(classifyArea('Computer Science')).toBe('Engineering & CS');
    expect(classifyArea('Mechanical Engineering')).toBe('Engineering & CS');
    // "engineer" wins over "chemist" because Engineering is checked first.
    expect(classifyArea('Chemical Engineering')).toBe('Engineering & CS');
    expect(classifyArea('Chemistry')).toBe('Physical Sci');
    expect(classifyArea('Mathematics')).toBe('Physical Sci');
    expect(classifyArea('Environmental Science')).toBe('Physical Sci');
    expect(classifyArea('Biology')).toBe('Bio Sci');
    expect(classifyArea('Nursing')).toBe('Bio Sci');
    expect(classifyArea('Economics')).toBe('Business / Econ');
    expect(classifyArea('Business Administration')).toBe('Business / Econ');
    expect(classifyArea('Psychology')).toBe('Social Sci');
    expect(classifyArea('Political Science')).toBe('Social Sci');
    expect(classifyArea('History')).toBe('Humanities');
    expect(classifyArea('Studio Art')).toBe('Arts');
    expect(classifyArea('Music')).toBe('Arts');
  });

  it('falls back to Other for unmatched / empty majors', () => {
    expect(classifyArea('Basket Weaving')).toBe('Other');
    expect(classifyArea('')).toBe('Other');
    expect(classifyArea(null)).toBe('Other');
    expect(classifyArea(undefined)).toBe('Other');
  });

  it('only ever returns a known area', () => {
    for (const m of ['Anything', 'Biology', 'Zzz', '']) {
      expect(AREAS).toContain(classifyArea(m));
    }
  });
});
