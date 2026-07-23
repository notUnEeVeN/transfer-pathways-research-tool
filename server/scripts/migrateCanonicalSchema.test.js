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
    expect(await db.collection('curated_requirements').findOne({ _id: 'degree:20:cs' }))
      .toMatchObject({ kind: 'degree', legacy_id: '20:cs', major_slug: 'cs' });
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
  }, 20_000); // full build+validate+install; slow under parallel suite load

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

  it('preserves every settings document while normalizing settings.app', async () => {
    const cohortUpdatedAt = new Date('2026-07-22T20:00:00Z');
    await db.collection('settings').insertMany([
      {
        _id: 'app',
        visible_pairs: [{ school_id: 20, major: 'Computer Science' }],
        released_analysis_ids: ['paper-credit-loss'],
        last_refresh_counts: { uc_agreements: 1 },
        canonical_dirty: true,
      },
      {
        _id: 'as_degree_validation',
        college_ids: ['10', '42'],
        updated_by: 'user-1',
        updated_at: cohortUpdatedAt,
      },
    ]);

    const model = await buildModel(db);
    const app = model.collections.settings.find((row) => row._id === 'app');
    const cohort = model.collections.settings.find((row) => row._id === 'as_degree_validation');

    expect(model.collections.settings).toHaveLength(2);
    expect(app).toMatchObject({
      released_analysis_ids: ['paper-credit-loss'],
      last_refresh_counts: { uc_agreements: 1 },
      canonical_dirty: false,
    });
    expect(cohort).toEqual({
      _id: 'as_degree_validation',
      college_ids: ['10', '42'],
      updated_by: 'user-1',
      updated_at: cohortUpdatedAt,
    });

    // Exercise the relaxed collection validator as well as the in-memory
    // model: the cohort document must survive the atomic replacement.
    await replaceAtomically(db, 'settings', model.collections.settings);
    expect(await db.collection('settings').findOne({ _id: 'as_degree_validation' }))
      .toMatchObject({ college_ids: ['10', '42'], updated_by: 'user-1' });
  });

  it('carries curated district geography across a source-catalog rebuild', async () => {
    const curatedAt = new Date('2026-07-22T21:00:00Z');
    await db.collection('assist_institutions').insertOne({
      _id: 'cc:10',
      institution_id: 'cc:10',
      source_id: 10,
      kind: 'community_college',
      system: 'ccc',
      name: 'CC Test',
      district: 'Curated District',
      region: 'Bay Area',
      counties_served: ['Alpha', 'Beta'],
      district_source: 'console',
      district_source_college_name: 'CC Test',
      curated_by: 'user-1',
      curated_at: curatedAt,
    });

    const model = await buildModel(db);
    const college = model.collections.assist_institutions.find((row) => row._id === 'cc:10');
    expect(college).toMatchObject({
      district: 'Curated District',
      region: 'Bay Area',
      counties_served: ['Alpha', 'Beta'],
      district_source: 'console',
      district_source_college_name: 'CC Test',
      curated_by: 'user-1',
      curated_at: curatedAt,
    });
  });

  it('carries concept fields forward when rebuilding courses from legacy', async () => {
    // The beforeEach seeds a legacy CC course; stamp concept fields on its
    // current canonical row and rebuild.
    const legacy = await db.collection('courses').findOne({});
    const canonicalId = `cc:${legacy.course_id}`;
    await db.collection('assist_courses').updateOne(
      { _id: canonicalId },
      { $set: {
        _id: canonicalId, side: 'sending', source_id: legacy.course_id,
        institution_id: `cc:${legacy.community_college_id}`,
        concept: 'calc_1', concept_source: 'console_edit', concept_confidence: 1,
        concept_title_seen: 'Calculus I', concept_note: '',
        concept_curated_by: 'user-1', concept_curated_at: new Date(),
      } },
      { upsert: true }
    );
    const model = await buildModel(db);
    const rebuilt = model.collections.assist_courses.find((row) => row._id === canonicalId);
    expect(rebuilt).toMatchObject({
      concept: 'calc_1', concept_source: 'console_edit', concept_curated_by: 'user-1',
    });
    const untouched = model.collections.assist_courses.find((row) => row._id !== canonicalId);
    expect(untouched.concept).toBeUndefined();
  });

  it('carries concept fields forward on the receiving side too', async () => {
    // Same shape as the sending-side test, but stamping the seeded legacy
    // university course's canonical row — concept_confidence: 0 keeps a
    // falsy-but-valid value in play.
    const legacy = await db.collection('university_courses').findOne({});
    const canonicalId = `university:${legacy.parent_id}`;
    await db.collection('assist_courses').updateOne(
      { _id: canonicalId },
      { $set: {
        _id: canonicalId, side: 'receiving', source_id: legacy.parent_id,
        institution_id: `uc:${legacy.university_id}`,
        concept: 'calc_1', concept_source: 'llm_session_v1', concept_confidence: 0,
      } },
      { upsert: true }
    );
    const model = await buildModel(db);
    const rebuilt = model.collections.assist_courses.find((row) => row._id === canonicalId);
    expect(rebuilt).toMatchObject({
      concept: 'calc_1', concept_source: 'llm_session_v1', concept_confidence: 0,
    });
  });
});
