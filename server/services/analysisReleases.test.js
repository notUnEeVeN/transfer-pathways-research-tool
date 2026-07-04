import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  getReleasedIds, setReleasedIds, getDisabledIds, setDisabledIds,
  invalidateReleasesCache, normalizeIds,
} from './analysisReleases';

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('analysis_releases_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.collection('dataset_config').deleteMany({});
  invalidateReleasesCache();
});

describe('getReleasedIds', () => {
  it('defaults to [] when nothing has been released (hidden until released)', async () => {
    expect(await getReleasedIds(db)).toEqual([]);
  });

  it('returns the saved ids', async () => {
    await setReleasedIds(db, ['coverage-heatmap'], 'admin');
    expect(await getReleasedIds(db)).toEqual(['coverage-heatmap']);
  });

  it('returns a copy — mutating the result never changes stored state', async () => {
    await setReleasedIds(db, ['a'], 'admin');
    const ids = await getReleasedIds(db);
    ids.push('b');
    expect(await getReleasedIds(db)).toEqual(['a']);
  });
});

describe('setReleasedIds', () => {
  it('upserts one config doc with who/when and reflects immediately (cache invalidated)', async () => {
    await setReleasedIds(db, ['paper-district-heatmap'], 'admin-1');
    const doc = await db.collection('dataset_config').findOne({ _id: 'analysis_releases' });
    expect(doc.released_ids).toEqual(['paper-district-heatmap']);
    expect(doc.updated_by).toBe('admin-1');
    expect(doc.updated_at).toBeInstanceOf(Date);
    expect(await getReleasedIds(db)).toEqual(['paper-district-heatmap']);
  });

  it('trims, drops empties/non-strings, and dedupes', async () => {
    await setReleasedIds(db, ['  a  ', 'a', '', 'b', 3, null, 'b'], 'admin');
    expect(await getReleasedIds(db)).toEqual(['a', 'b']);
  });

  it('can clear all releases back to []', async () => {
    await setReleasedIds(db, ['a', 'b'], 'admin');
    await setReleasedIds(db, [], 'admin');
    expect(await getReleasedIds(db)).toEqual([]);
  });
});

describe('disabled ids', () => {
  it('defaults to [] when nothing has been disabled (all analyses visible to admins)', async () => {
    expect(await getDisabledIds(db)).toEqual([]);
  });

  it('round-trips: set → get, with who/when stamped on the shared doc', async () => {
    await setDisabledIds(db, ['complexity', 'time-to-degree'], 'admin-1');
    expect(await getDisabledIds(db)).toEqual(['complexity', 'time-to-degree']);
    const doc = await db.collection('dataset_config').findOne({ _id: 'analysis_releases' });
    expect(doc.disabled_ids).toEqual(['complexity', 'time-to-degree']);
    expect(doc.updated_by).toBe('admin-1');
  });

  it('released and disabled sets never clobber each other (independent $set writes)', async () => {
    await setReleasedIds(db, ['coverage-heatmap'], 'admin');
    await setDisabledIds(db, ['complexity'], 'admin');
    await setReleasedIds(db, ['coverage-heatmap', 'credit-loss'], 'admin');
    expect(await getDisabledIds(db)).toEqual(['complexity']);
    await setDisabledIds(db, [], 'admin');
    expect(await getReleasedIds(db)).toEqual(['coverage-heatmap', 'credit-loss']);
  });

  it('normalizes junk like the released set does', async () => {
    await setDisabledIds(db, ['  a  ', 'a', '', 7, null], 'admin');
    expect(await getDisabledIds(db)).toEqual(['a']);
  });
});

describe('normalizeIds', () => {
  it('is a pure trim/dedupe/string-filter (non-array → [])', () => {
    expect(normalizeIds(['x', ' x ', 'y', 1, undefined, ''])).toEqual(['x', 'y']);
    expect(normalizeIds('nope')).toEqual([]);
    expect(normalizeIds(undefined)).toEqual([]);
  });
});
