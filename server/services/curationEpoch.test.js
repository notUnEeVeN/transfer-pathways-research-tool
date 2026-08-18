import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { bumpCurationEpoch, curationEpoch } = cjs('./curationEpoch');

describe('curation epoch', () => {
  it('advances on every curated write so a cache key built from it cannot be reused', () => {
    const before = curationEpoch();
    bumpCurationEpoch();
    expect(curationEpoch()).toBe(before + 1);
    bumpCurationEpoch();
    expect(curationEpoch()).toBe(before + 2);
  });

  // The reason it exists: the analysis memo keys on it, so a save retires
  // every memoized analysis rather than letting the client's post-save
  // refetch be answered with pre-edit rows.
  it('changes the analysis cache key it is folded into', () => {
    const key = () => `coverage|e:${curationEpoch()}|cs`;
    const before = key();
    bumpCurationEpoch();
    expect(key()).not.toBe(before);
  });
});
