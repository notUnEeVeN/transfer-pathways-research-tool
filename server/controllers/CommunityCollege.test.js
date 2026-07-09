import { describe, it, expect } from 'vitest';
import CommunityCollege from './CommunityCollege';

const { _mergeGeography: mergeGeography } = CommunityCollege;

describe('mergeGeography', () => {
  const geo = [
    { _id: 10, district: 'North District', region: 'Bay Area', counties_served: ['Alameda', 'Contra Costa'] },
    { _id: 20, district: 'South District', region: 'Southern', counties_served: ['Los Angeles'] },
  ];

  it('attaches district/region/counties by college id', () => {
    const out = mergeGeography([{ id: 10, name: 'Alpha College' }], geo);
    expect(out[0]).toMatchObject({
      id: 10,
      name: 'Alpha College',
      district: 'North District',
      region: 'Bay Area',
      counties_served: ['Alameda', 'Contra Costa'],
    });
  });

  it('leaves the original fields intact and matches on numeric id even if the college id is a string', () => {
    const out = mergeGeography([{ id: '20', name: 'Beta College', extra: 1 }], geo);
    expect(out[0].extra).toBe(1);
    expect(out[0].district).toBe('South District');
  });

  it('fills null/[] for colleges with no geography row (uniform shape)', () => {
    const out = mergeGeography([{ id: 999, name: 'Orphan College' }], geo);
    expect(out[0]).toMatchObject({ district: null, region: null, counties_served: [] });
  });
});
