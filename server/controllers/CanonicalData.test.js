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

  it('accepts an OR-group in requires and rejects a group with an unknown slug', async () => {
    await put(concept('calc_1'));
    await put(concept('bus_calc_1'));
    const ok = await put(concept('discrete', [['calc_1', 'bus_calc_1']]));
    expect(ok.statusCode).toBe(200);
    const stored = await db.collection('curated_requirements').findOne({ _id: 'prereq_concept:discrete' });
    expect(stored.requires).toEqual([['calc_1', 'bus_calc_1']]);
    const bad = await put(concept('discrete2', [['calc_1', 'ghost']]));
    expect(bad.statusCode).toBe(400);
    expect(bad.body.error).toMatch(/unknown concept: ghost/);
    const empty = await put(concept('discrete3', [[]]));
    expect(empty.statusCode).toBe(400);
    expect(empty.body.error).toMatch(/OR-group/);
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

describe('as_degree_template kind', () => {
  const seedConcepts = () => db.collection('curated_requirements').insertMany([
    { _id: 'prereq_concept:cs_1', kind: 'prereq_concept', slug: 'cs_1', requires: [] },
    { _id: 'prereq_concept:cs_2_oop', kind: 'prereq_concept', slug: 'cs_2_oop', requires: ['cs_1'] },
    { _id: 'prereq_concept:calc_1', kind: 'prereq_concept', slug: 'calc_1', requires: [] },
  ]);

  const template = () => ({
    _id: 'as_degree_template:cs',
    slug: 'cs',
    name: 'AS in Computer Science (statewide template)',
    total_units_min: 60,
    groups: [
      {
        group_id: 'core_programming', label: 'Programming core', is_required: true,
        sections: [{ section_advisement: null, unit_advisement: null,
          slots: [{ concepts: ['cs_1'] }, { concepts: ['cs_2_oop'] }] }],
      },
      {
        group_id: 'ge_natural_sciences', label: 'GE: Natural Sciences', is_required: true,
        ge_area: 'natural_sciences',
        sections: [{ section_advisement: null, unit_advisement: 3, slots: [] }],
      },
      { group_id: 'electives', label: 'Electives to total', units_fill: true },
    ],
  });

  it('accepts a well-formed template and stamps curated_by', async () => {
    await seedConcepts();
    const res = await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: template() }));
    expect(res.statusCode).toBe(200);
    const stored = await db.collection('curated_requirements').findOne({ _id: 'as_degree_template:cs' });
    expect(stored).toMatchObject({ kind: 'as_degree_template', legacy_id: 'cs', curated_by: 'curator-1' });
  });

  it('rejects a slot referencing an unknown concept', async () => {
    await seedConcepts();
    const body = template();
    body.groups[0].sections[0].slots.push({ concepts: ['quantum_basket_weaving'] });
    const res = await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unknown concept: quantum_basket_weaving/);
  });

  it('rejects a bad ge_area, a duplicate group_id, and sections on a units_fill group', async () => {
    await seedConcepts();
    const badArea = template();
    badArea.groups[1].ge_area = 'underwater_arts';
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: badArea }))).statusCode).toBe(400);

    const dup = template();
    dup.groups[1].group_id = 'core_programming';
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: dup }))).statusCode).toBe(400);

    const filled = template();
    filled.groups[2].sections = [{ slots: [] }];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: filled }))).statusCode).toBe(400);
  });

  it('rejects a non-ge_area section with no slots and a non-positive advisement', async () => {
    await seedConcepts();
    const empty = template();
    empty.groups[0].sections[0].slots = [];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: empty }))).statusCode).toBe(400);

    const negative = template();
    negative.groups[0].sections[0].section_advisement = 0;
    expect((await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body: negative }))).statusCode).toBe(400);
  });

  it('400s (not 500s) a null entry in groups', async () => {
    await seedConcepts();
    const body = template();
    body.groups.push(null);
    const res = await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/each group must be an object/);
  });

  it('400s (not 500s) a null entry in a group\'s sections', async () => {
    await seedConcepts();
    const body = template();
    body.groups[0].sections.push(null);
    const res = await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/each section must be an object/);
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
