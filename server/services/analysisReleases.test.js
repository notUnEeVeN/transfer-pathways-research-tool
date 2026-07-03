import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  getReleasedIds, setReleasedIds, invalidateReleasesCache, normalizeIds,
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

describe('normalizeIds', () => {
  it('is a pure trim/dedupe/string-filter (non-array → [])', () => {
    expect(normalizeIds(['x', ' x ', 'y', 1, undefined, ''])).toEqual(['x', 'y']);
    expect(normalizeIds('nope')).toEqual([]);
    expect(normalizeIds(undefined)).toEqual([]);
  });
});
