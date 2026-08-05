import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { startInMemoryMongo } from '../test/mongoHarness';
import { COLLECTIONS, INDEXES, VALIDATORS, replaceAtomically } from './importArtsys';
import { parseGuide } from '../services/artsys/parseGuide';
import { transformGuide } from '../services/artsys/transform';

// The write path against a real mongod: validators, indexes and the atomic
// rename all behave differently from a hand-rolled fake, and a schema mistake
// here fails silently at import time rather than at review time.
let mongo;
let db;
let built;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('artsys_test');
  const html = fs.readFileSync(
    path.resolve(__dirname, '../test/fixtures/artsys/guide-3354-montgomery.html'), 'utf8'
  );
  built = transformGuide(parseGuide(html, { guideId: 3354 }));
}, 60000);

afterAll(async () => { await mongo?.stop(); });

describe('artsys collections', () => {
  it('installs institutions, courses and agreements atomically', async () => {
    await replaceAtomically(db, COLLECTIONS.institutions, built.institutions);
    await replaceAtomically(db, COLLECTIONS.courses, built.courses);
    await replaceAtomically(db, COLLECTIONS.agreements, [built.agreement]);

    expect(await db.collection(COLLECTIONS.institutions).countDocuments()).toBe(2);
    expect(await db.collection(COLLECTIONS.courses).countDocuments()).toBe(built.courses.length);
    expect(await db.collection(COLLECTIONS.agreements).countDocuments()).toBe(1);
  });

  it('leaves no staging collection behind', async () => {
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    expect(names.filter((n) => n.startsWith('__next_'))).toEqual([]);
  });

  // The whole point of the separate namespace: an import must not be able to
  // touch the California corpus even by accident.
  it('never creates an assist_ collection', async () => {
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    expect(names.some((n) => n.startsWith('assist_'))).toBe(false);
    expect(names.every((n) => n.startsWith('artsys_'))).toBe(true);
  });

  it('builds the declared indexes', async () => {
    for (const name of [COLLECTIONS.institutions, COLLECTIONS.courses, COLLECTIONS.agreements]) {
      const indexes = await db.collection(name).indexes();
      const declared = INDEXES[name].length;
      expect(indexes.length).toBe(declared + 1); // + _id_
    }
  });

  it('enforces one agreement per (college, university, program)', async () => {
    await expect(
      db.collection(COLLECTIONS.agreements).insertOne({ ...built.agreement, _id: 'md:agr:other' })
    ).rejects.toThrow();
  });

  it('rejects a document from the wrong source', async () => {
    await expect(
      db.collection(COLLECTIONS.institutions).insertOne({
        _id: 'md:cc:999', institution_id: 'md:cc:999', artsys_id: 999,
        kind: 'community_college', name: 'X', source: 'assist',
      })
    ).rejects.toThrow();
  });

  it('rejects an institution of an unknown kind', async () => {
    await expect(
      db.collection(COLLECTIONS.institutions).insertOne({
        _id: 'md:x:1', institution_id: 'md:x:1', artsys_id: 1,
        kind: 'high_school', name: 'X', source: 'artsys',
      })
    ).rejects.toThrow();
  });

  it('rejects an agreement with no requirement groups field', async () => {
    const { requirement_groups: _drop, ...withoutGroups } = built.agreement;
    await expect(
      db.collection(COLLECTIONS.agreements).insertOne({ ...withoutGroups, _id: 'md:agr:bad' })
    ).rejects.toThrow();
  });

  it('replaces rather than appends when rerun', async () => {
    await replaceAtomically(db, COLLECTIONS.agreements, [built.agreement]);
    expect(await db.collection(COLLECTIONS.agreements).countDocuments()).toBe(1);
  });

  it('round-trips the requirement tree through BSON intact', async () => {
    const stored = await db.collection(COLLECTIONS.agreements).findOne({ _id: built.agreement._id });
    const receivers = stored.requirement_groups.flatMap((g) => g.sections.flatMap((s) => s.receivers));
    expect(receivers).toHaveLength(29);
    expect(receivers.filter((r) => r.articulation_status === 'not_articulated')).toHaveLength(6);
    expect(stored.requirement_groups[0].sections.map((s) => s.receivers.length)).toEqual([10, 3]);
  });
});

describe('VALIDATORS', () => {
  it('cover every written collection', () => {
    for (const name of [COLLECTIONS.institutions, COLLECTIONS.courses, COLLECTIONS.agreements]) {
      expect(VALIDATORS[name]).toBeTruthy();
    }
  });
});
