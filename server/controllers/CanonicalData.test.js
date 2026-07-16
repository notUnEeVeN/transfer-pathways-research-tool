import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { listRequirements, putRequirement, putPrerequisite, deleteRequirement, putCourseConcept, prerequisiteGraph } = cjs('./CanonicalData');

let mongo;
let db;
let auditDb;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('canonical_data_test');
  auditDb = mongo.client.db('canonical_data_audit_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  await Promise.all([db.dropDatabase(), auditDb.dropDatabase()]);
});

function request({ body = {}, params = {}, query = {} } = {}) {
  return {
    body,
    params,
    query,
    user: { uid: 'curator-1' },
    app: { locals: { db, auditDb } },
  };
}

function run(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; resolve(this); return this; },
    };
    handler(req, res, (error) => error ? reject(error) : resolve(res));
  });
}

describe('canonical curated-data storage', () => {
  it('writes and lists degree templates from the research database', async () => {
    const body = {
      _id: 'degree:79',
      kind: 'degree',
      school_id: 79,
      school: 'UC Berkeley',
      program: 'EECS, B.S.',
      requirement_groups: [],
    };
    await run(putRequirement, request({ params: { kind: 'degree' }, body }));

    const stored = await db.collection('curated_requirements').findOne({ _id: 'degree:79' });
    expect(stored).toMatchObject({
      kind: 'degree', legacy_id: '79', curated_by: 'curator-1', program: 'EECS, B.S.',
    });
    expect(stored.updated_at).toBeInstanceOf(Date);
    expect(await auditDb.collection('curated_requirements').countDocuments()).toBe(0);

    const response = await run(listRequirements, request({ query: { kind: 'degree' } }));
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]._id).toBe('degree:79');
  });

  it('keeps curated prerequisites with the research dataset as well', async () => {
    await run(putPrerequisite, request({ body: {
      _id: 'cc:1:math-2', course_id: 'cc:1:math-2', prerequisites: ['cc:1:math-1'],
    } }));
    expect(await db.collection('curated_prerequisites').countDocuments()).toBe(1);
    expect(await auditDb.collection('curated_prerequisites').countDocuments()).toBe(0);
  });
});

describe('prereq_concept kind', () => {
  const put = (body) => run(putRequirement, request({ params: { kind: 'prereq_concept' }, body }));
  const del = (id) => run(deleteRequirement, request({ params: { kind: 'prereq_concept', id } }));
  const concept = (slug, requires = [], extra = {}) => ({
    _id: `prereq_concept:${slug}`, slug, name: slug, discipline: 'math', requires, note: '', ...extra,
  });

  it('upserts a valid concept with stamps', async () => {
    const res = await put(concept('calc_1'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, id: 'prereq_concept:calc_1' });
    const stored = await db.collection('curated_requirements').findOne({ _id: 'prereq_concept:calc_1' });
    expect(stored).toMatchObject({ kind: 'prereq_concept', legacy_id: 'calc_1', slug: 'calc_1', curated_by: 'curator-1' });
  });

  it('rejects a malformed slug', async () => {
    const res = await put(concept('Calc 1!'));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/slug/);
  });

  it('rejects an unknown discipline', async () => {
    const res = await put(concept('calc_1', [], { discipline: 'underwater_basketweaving' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/discipline must be one of/);
  });

  it('rejects requires referencing an unknown concept', async () => {
    const res = await put(concept('calc_2', ['calc_1']));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unknown concept: calc_1/);
  });

  it('rejects a cycle', async () => {
    await put(concept('calc_1'));
    await put(concept('calc_2', ['calc_1']));
    const res = await put(concept('calc_1', ['calc_2']));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cycle/);
  });

  it('accepts satisfies naming known concepts and rejects unknown or self', async () => {
    await put(concept('linear_alg'));
    await put(concept('diff_eq'));
    const ok = await put(concept('linear_alg_diff_eq', [], { satisfies: ['linear_alg', 'diff_eq'] }));
    expect(ok.statusCode).toBe(200);
    const unknown = await put(concept('combo_2', [], { satisfies: ['ghost'] }));
    expect(unknown.statusCode).toBe(400);
    expect(unknown.body.error).toMatch(/unknown concept: ghost/);
    const self = await put(concept('combo_3', [], { satisfies: ['combo_3'] }));
    expect(self.statusCode).toBe(400);
    expect(self.body.error).toMatch(/itself/);
  });

  it('stamps hand_curated source when none is given', async () => {
    await put(concept('calc_1'));
    const stored = await db.collection('curated_requirements').findOne({ _id: 'prereq_concept:calc_1' });
    expect(stored.source).toBe('hand_curated');
  });

  it('preserves an explicit source', async () => {
    await put(concept('calc_1', [], { source: 'llm_session_v1' }));
    const stored = await db.collection('curated_requirements').findOne({ _id: 'prereq_concept:calc_1' });
    expect(stored.source).toBe('llm_session_v1');
  });

  it('dedupes duplicate slugs in requires', async () => {
    await put(concept('calc_1'));
    await put(concept('calc_2', ['calc_1', 'calc_1']));
    const stored = await db.collection('curated_requirements').findOne({ _id: 'prereq_concept:calc_2' });
    expect(stored.requires).toEqual(['calc_1']);
  });

  it('rejects deleting a concept other concepts require', async () => {
    await put(concept('calc_1'));
    await put(concept('calc_2', ['calc_1']));
    const res = await del('prereq_concept:calc_1');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/referenced/);
  });

  it('rejects deleting a concept a course maps to', async () => {
    await put(concept('calc_1'));
    await db.collection('assist_courses').insertOne({
      _id: 'cc:1', side: 'sending', course_id: 1, institution_id: 'cc:10',
      concept: 'calc_1', concept_source: 'llm_session_v1',
    });
    const res = await del('prereq_concept:calc_1');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/1 course/);
  });

  it('deletes an unreferenced concept', async () => {
    await put(concept('calc_1'));
    const res = await del('prereq_concept:calc_1');
    expect(res.body).toEqual({ ok: true });
  });
});

describe('putCourseConcept', () => {
  beforeEach(async () => {
    await db.collection('curated_requirements').insertOne({
      _id: 'prereq_concept:calc_1', kind: 'prereq_concept', legacy_id: 'calc_1',
      slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [],
    });
    await db.collection('assist_courses').insertMany([
      { _id: 'cc:42', side: 'sending', course_id: 42, institution_id: 'cc:10', title: 'Calculus I' },
      { _id: 'university:9', side: 'receiving', parent_id: 9, institution_id: 'uc:1', title: 'Math 1A' },
    ]);
  });

  const putConcept = (id, body) =>
    run(putCourseConcept, request({ params: { id }, body }));

  it('stamps the mapping fields on a sending course', async () => {
    const res = await putConcept('cc:42', { concept: 'calc_1', note: 'obvious' });
    expect(res.body).toEqual({ ok: true, id: 'cc:42' });
    const stored = await db.collection('assist_courses').findOne({ _id: 'cc:42' });
    expect(stored).toMatchObject({
      concept: 'calc_1', concept_source: 'console_edit', concept_confidence: 1,
      concept_title_seen: 'Calculus I', concept_note: 'obvious', concept_curated_by: 'curator-1',
    });
    expect(stored.concept_curated_at).toBeInstanceOf(Date);
  });

  it('clears to examined-not-relevant with concept null', async () => {
    await putConcept('cc:42', { concept: 'calc_1' });
    const res = await putConcept('cc:42', { concept: null });
    expect(res.statusCode).toBe(200);
    const stored = await db.collection('assist_courses').findOne({ _id: 'cc:42' });
    expect(stored.concept).toBeNull();
    expect(stored.concept_source).toBe('console_edit');
  });

  it('400s an unknown concept slug', async () => {
    const res = await putConcept('cc:42', { concept: 'underwater_calc' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unknown concept slug/);
  });

  it('400s a non-string concept', async () => {
    const res = await putConcept('cc:42', { concept: ['calc_1'] });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('concept must be a string slug or null');
  });

  it('404s a missing course and 400s a non-cc id', async () => {
    expect((await putConcept('cc:999', { concept: 'calc_1' })).statusCode).toBe(404);
    expect((await putConcept('university:9', { concept: 'calc_1' })).statusCode).toBe(400);
  });
});

describe('prerequisiteGraph endpoint', () => {
  it('400s a malformed college_id', async () => {
    const res = await run(prerequisiteGraph, request({ query: { college_id: 'nope' } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/college_id must be cc:<id>/);
  });

  it('returns the concept DAG without a college and the full payload with one', async () => {
    await db.collection('curated_requirements').insertOne({
      _id: 'prereq_concept:calc_1', kind: 'prereq_concept', legacy_id: 'calc_1',
      slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [],
    });
    await db.collection('assist_courses').insertOne({
      _id: 'cc:1', side: 'sending', course_id: 1, institution_id: 'cc:10',
      title: 'Calc I', concept: 'calc_1', concept_source: 'llm_session_v1',
    });
    const bare = await run(prerequisiteGraph, request({ query: {} }));
    expect(bare.body.concepts).toHaveLength(1);
    expect(bare.body.courses).toBeUndefined();

    const scoped = await run(prerequisiteGraph, request({ query: { college_id: 'cc:10' } }));
    expect(scoped.body.courses).toHaveLength(1);
    expect(scoped.body.courses[0].key).toBe('cc:1');
  });
});
