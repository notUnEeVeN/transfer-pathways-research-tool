import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  DESTINATIONS, buildModel, validateModel, replaceAtomically,
} = cjs('./migrateCanonicalSchema');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('canonical_migration_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  await db.dropDatabase();
  const agreementId = new ObjectId();
  await Promise.all([
    db.collection('community_colleges').insertOne({ _id: new ObjectId(), id: 10, name: 'CC Test' }),
    db.collection('uc_schools').insertOne({ _id: new ObjectId(), id: 20, name: 'UC Test' }),
    db.collection('courses').insertOne({
      _id: new ObjectId(), course_id: 100, community_college_id: 10,
      prefix: 'CS', number: '1', title: 'Intro', units: 3, same_as: [],
    }),
    db.collection('university_courses').insertOne({
      _id: new ObjectId(), parent_id: 200, university_id: 20,
      prefix: 'CS', number: '10', title: 'Intro', min_units: 4, max_units: 4,
    }),
    db.collection('uc_agreements').insertOne({
      _id: agreementId,
      uc_school: 'UC Test', uc_school_id: 20,
      community_college: 'CC Test', community_college_id: 10,
      major: 'Computer Science', requirement_groups: [],
    }),
    db.collection('uc_major_admissions').insertOne({
      _id: new ObjectId(), uc_school: 'UC Test', uc_school_id: 20,
      major: 'Computer Science', year: 2026, stats: [],
    }),
    db.collection('ref_uc_transfer_requirements').insertOne({
      _id: 'minimum', school_id: 20, school: 'UC Test', receiving_code: 'CS 10',
    }),
    db.collection('ref_uc_degree_requirements').insertOne({
      _id: 'degree:20', school_id: 20, school: 'UC Test', program: 'Computer Science',
      requirement_groups: [],
    }),
    db.collection('ref_prerequisites').insertOne({
      _id: 'cc-test:cs-1', college: 'CC Test', course_code: 'CS 1', prerequisites: [],
    }),
    db.collection('audit_results').insertOne({
      _id: new ObjectId(), doc_id: agreementId, system: 'uc', result: 'correct',
    }),
    db.collection('access_grants').insertOne({ _id: 'user-1', email: 'user@example.edu' }),
    db.collection('dataset_config').insertOne({
      _id: 'partner_access', visible_pairs: [{ school_id: 20, major: 'Computer Science' }],
    }),
  ]);
});

describe('canonical schema migration', () => {
  it('builds, validates, indexes, and atomically installs every destination', async () => {
    const model = await buildModel(db);
    const validation = await validateModel(model);
    expect(Object.values(validation.checks).every(Boolean)).toBe(true);

    for (const name of DESTINATIONS) {
      await replaceAtomically(db, name, model.collections[name]);
    }

    expect(await db.collection('assist_institutions').countDocuments()).toBe(2);
    expect(await db.collection('assist_courses').countDocuments()).toBe(2);
    expect(await db.collection('assist_agreements').countDocuments()).toBe(1);
    expect(await db.collection('agreement_reviews').countDocuments()).toBe(1);
    expect(await db.collection('curated_requirements').findOne({ _id: 'degree:20' }))
      .toMatchObject({ kind: 'degree', legacy_id: '20' });
    expect(await db.collection('curated_requirements').countDocuments({ _id: 'degree:degree:20' }))
      .toBe(0);
    expect(await db.collection('team_members').findOne({ _id: 'user-1' }))
      .toMatchObject({ access_status: 'granted', email: 'user@example.edu' });

    const courseIndexes = await db.collection('assist_courses').indexes();
    expect(courseIndexes.map((index) => index.key)).toContainEqual({ side: 1, source_id: 1 });
    const agreementIndexes = await db.collection('assist_agreements').indexes();
    expect(agreementIndexes.map((index) => index.key))
      .toContainEqual({ community_college_id: 1, uc_school_id: 1, major: 1 });

    await expect(db.collection('assist_courses').insertOne({ _id: 'invalid' })).rejects.toThrow();
    expect(await db.collection('community_colleges').countDocuments()).toBe(1);
  });

  it('keeps newer canonical team and figure work on a rerun', async () => {
    let model = await buildModel(db);
    for (const name of DESTINATIONS) await replaceAtomically(db, name, model.collections[name]);

    const now = new Date('2030-01-01T00:00:00Z');
    await db.collection('team_members').updateOne(
      { _id: 'user-1' }, { $set: { display_name: 'Ada', updated_at: now } }
    );
    await db.collection('published_figures').insertOne({
      _id: 'figure-a', title: 'Figure A', formats: { svg: Buffer.from('<svg/>') }, updated_at: now,
    });

    model = await buildModel(db);
    expect(model.collections.team_members.find((row) => row._id === 'user-1').display_name).toBe('Ada');
    expect(model.collections.published_figures.map((row) => row._id)).toContain('figure-a');
  });
});
