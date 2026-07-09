import { describe, it, expect } from 'vitest';
import { geoOptions, matchesGeo, hasActiveGeo } from './collegeGeo';

const colleges = [
  { id: 1, name: 'Alpha', region: 'Bay Area', district: 'North', counties_served: ['Alameda', 'Contra Costa'] },
  { id: 2, name: 'Beta', region: 'Bay Area', district: 'North', counties_served: ['Alameda'] },
  { id: 3, name: 'Gamma', region: 'Southern', district: 'South', counties_served: ['Los Angeles'] },
  { id: 4, name: 'Delta', region: null, district: null, counties_served: [] }, // unmapped
];

describe('geoOptions', () => {
  it('returns distinct, sorted regions/districts/counties and drops nulls', () => {
    expect(geoOptions(colleges)).toEqual({
      regions: ['Bay Area', 'Southern'],
      districts: ['North', 'South'],
      counties: ['Alameda', 'Contra Costa', 'Los Angeles'],
    });
  });

  it('narrows districts to the chosen region (regions stay the full set)', () => {
    const o = geoOptions(colleges, { region: 'Southern' });
    expect(o.regions).toEqual(['Bay Area', 'Southern']);
    expect(o.districts).toEqual(['South']);
    expect(o.counties).toEqual(['Los Angeles']);
  });

  it('narrows counties to the chosen region + district', () => {
    expect(geoOptions(colleges, { region: 'Bay Area', district: 'North' }).counties)
      .toEqual(['Alameda', 'Contra Costa']);
  });

  it('is safe on empty input', () => {
    expect(geoOptions()).toEqual({ regions: [], districts: [], counties: [] });
  });
});

describe('matchesGeo', () => {
  it('an empty filter matches everything', () => {
    expect(colleges.every((c) => matchesGeo(c, {}))).toBe(true);
  });

  it('filters by district and region', () => {
    expect(colleges.filter((c) => matchesGeo(c, { district: 'North' })).map((c) => c.id)).toEqual([1, 2]);
    expect(colleges.filter((c) => matchesGeo(c, { region: 'Southern' })).map((c) => c.id)).toEqual([3]);
  });

  it('county matches membership in counties_served', () => {
    expect(colleges.filter((c) => matchesGeo(c, { county: 'Alameda' })).map((c) => c.id)).toEqual([1, 2]);
    expect(colleges.filter((c) => matchesGeo(c, { county: 'Contra Costa' })).map((c) => c.id)).toEqual([1]);
  });

  it('combines filters with AND', () => {
    expect(colleges.filter((c) => matchesGeo(c, { region: 'Bay Area', county: 'Contra Costa' })).map((c) => c.id)).toEqual([1]);
    expect(colleges.filter((c) => matchesGeo(c, { district: 'North', county: 'Los Angeles' }))).toEqual([]);
  });

  it('never excludes the unmapped college unless a geo filter is set', () => {
    expect(matchesGeo(colleges[3], {})).toBe(true);
    expect(matchesGeo(colleges[3], { region: 'Bay Area' })).toBe(false);
  });
});

describe('hasActiveGeo', () => {
  it('is true only when some filter is set', () => {
    expect(hasActiveGeo({})).toBe(false);
    expect(hasActiveGeo({ county: 'Alameda' })).toBe(true);
  });
});
