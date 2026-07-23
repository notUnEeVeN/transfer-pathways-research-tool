import { describe, it, expect } from 'vitest';
import {
  AS_DEGREE_SLOTS, LEGACY_TYPE_TO_SLOT, asDegreeRowId, parseAsDegreeRowId,
} from './asDegreeSlots';

describe('as-degree slots', () => {
  it('is exactly the three major-neutral slots', () => {
    expect(AS_DEGREE_SLOTS).toEqual(['ast', 'local_as', 'local_other']);
  });

  it('maps every pre-migration CS type onto a slot', () => {
    expect(LEGACY_TYPE_TO_SLOT).toEqual({
      ast: 'ast', local_cs_as: 'local_as', local_computing: 'local_other',
    });
  });

  it('round-trips a row id through build and parse', () => {
    expect(asDegreeRowId(110, 'cs', 'ast')).toBe('110:cs:ast');
    expect(parseAsDegreeRowId('110:cs:ast'))
      .toEqual({ communityCollegeId: 110, majorSlug: 'cs', slot: 'ast' });
  });

  it('rejects a pre-migration two-segment id', () => {
    expect(parseAsDegreeRowId('110:ast')).toBeNull();
    expect(parseAsDegreeRowId('')).toBeNull();
    expect(parseAsDegreeRowId('cc110:cs:ast')).toBeNull();
  });
});
