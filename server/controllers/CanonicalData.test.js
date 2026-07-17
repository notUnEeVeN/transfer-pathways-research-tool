import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { listRequirements, putRequirement, putPrerequisite, deleteRequirement, putCourseConcept, prerequisiteGraph, asDegrees } = cjs('./CanonicalData');

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

  it('accepts a pattern-level ge_area like calgetc', async () => {
    await seedConcepts();
    const body = template();
    body.groups[1].ge_area = 'calgetc';
    const res = await run(putRequirement, request({ params: { kind: 'as_degree_template' }, body }));
    expect(res.statusCode).toBe(200);
  });
});

describe('as_degree kind', () => {
  const seedForDegree = async () => {
    await db.collection('assist_institutions').insertOne({
      _id: 'cc:110', kind: 'community_college', source_id: 110, name: 'Allan Hancock College',
    });
    await db.collection('curated_requirements').insertOne({
      _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs', groups: [],
    });
  };

  const degreeDoc = () => ({
    _id: 'as_degree:110:local_cs_as',
    community_college_id: 110,
    college_id: 'cc:110',
    degree_type: 'local_cs_as',
    major_slug: 'cs',
    template_ref: 'as_degree_template:cs',
    status: 'found',
    degree_title_seen: 'Computer Science, A.S.',
    catalog_url: 'https://catalog.hancockcollege.edu/cs-as',
    catalog_year: '2025-2026',
    unit_system: 'semester',
    total_units: 60,
    verification: { verified: false, verified_by: null, verified_at: null, notes: null },
    requirement_groups: [
      {
        is_required: true, group_conjunction: 'And',
        group_advisement: null, group_unit_advisement: null,
        group_min_distinct_sections: null, group_max_distinct_sections: null,
        group_section_min_courses: null,
        sections: [{
          section_advisement: null, unit_advisement: null,
          receivers: [
            { receiving: null, articulation_status: 'articulated', not_articulated_reason: null,
              options: [{ course_ids: [101], course_conjunction: 'and', course_keys: ['cc:101'] }],
              options_conjunction: 'and', hash_id: null },
            { receiving: null, articulation_status: 'articulated', not_articulated_reason: null,
              options: [{ course_ids: [102], course_conjunction: 'and', course_keys: ['cc:102'] }],
              options_conjunction: 'and', hash_id: null },
          ],
        }],
        group_id: 'core_programming', template_group: 'core_programming',
        label_seen: 'Required Core', source: 'extracted', confidence: 0.93,
        curated_by: null, ge_area: null, units_fill: false, unresolved_courses_seen: [],
      },
      { group_id: 'ge_humanities', template_group: 'ge_humanities',
        source: 'template_default', confidence: null, curated_by: null },
    ],
  });

  it('accepts a well-formed found doc', async () => {
    await seedForDegree();
    const res = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: degreeDoc() }));
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe('as_degree:110:local_cs_as');
  });

  it('accepts a doc with covered_concepts as an array of strings', async () => {
    await seedForDegree();
    const body = { ...degreeDoc(), covered_concepts: ['cs_1', 'discrete_math'] };
    const res = await run(putRequirement, request({ params: { kind: 'as_degree' }, body }));
    expect(res.statusCode).toBe(200);
    const stored = await db.collection('curated_requirements').findOne({ _id: 'as_degree:110:local_cs_as' });
    expect(stored.covered_concepts).toEqual(['cs_1', 'discrete_math']);
  });

  it('does not require covered_concepts', async () => {
    await seedForDegree();
    const res = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: degreeDoc() }));
    expect(res.statusCode).toBe(200);
  });

  it('rejects covered_concepts that is not an array of strings', async () => {
    await seedForDegree();
    const notArray = { ...degreeDoc(), covered_concepts: 'cs_1' };
    const resNotArray = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: notArray }));
    expect(resNotArray.statusCode).toBe(400);
    expect(resNotArray.body.error).toMatch(/covered_concepts must be an array of strings/);

    const badElement = { ...degreeDoc(), covered_concepts: ['cs_1', 42] };
    const resBadElement = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: badElement }));
    expect(resBadElement.statusCode).toBe(400);
    expect(resBadElement.body.error).toMatch(/covered_concepts must be an array of strings/);
  });

  it('stamps group-level curated_by on curated groups only', async () => {
    await seedForDegree();
    const body = degreeDoc();
    body.requirement_groups[0].source = 'curated';
    body.requirement_groups[0].confidence = null;
    await run(putRequirement, request({ params: { kind: 'as_degree' }, body }));
    const stored = await db.collection('curated_requirements').findOne({ _id: 'as_degree:110:local_cs_as' });
    expect(stored.requirement_groups[0].curated_by).toBe('curator-1');
    expect(stored.requirement_groups[0].curated_at).toBeInstanceOf(Date);
    expect(stored.requirement_groups[1].curated_by).toBe(null);
  });

  it('allows two degrees to coexist for the same college', async () => {
    await seedForDegree();
    const first = degreeDoc();
    const second = { ...degreeDoc(), _id: 'as_degree:110:ast', degree_type: 'ast' };
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: first }))).statusCode).toBe(200);
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: second }))).statusCode).toBe(200);
    const rows = await db.collection('curated_requirements')
      .find({ kind: 'as_degree', college_id: 'cc:110' }).toArray();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.degree_type).sort()).toEqual(['ast', 'local_cs_as']);
  });

  it('rejects a degree_type that does not match the id slug', async () => {
    await seedForDegree();
    const body = degreeDoc();
    body.degree_type = 'ast'; // id slug is still local_cs_as
    const res = await run(putRequirement, request({ params: { kind: 'as_degree' }, body }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/degree_type must match the slug part of the row id/);
  });

  it('rejects an unknown degree_type', async () => {
    await seedForDegree();
    const body = degreeDoc();
    body._id = 'as_degree:110:bogus_type';
    body.degree_type = 'bogus_type';
    const res = await run(putRequirement, request({ params: { kind: 'as_degree' }, body }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/degree_type must be one of/);
  });

  it('accepts a major_slug that differs from the id slug', async () => {
    await seedForDegree();
    const body = { ...degreeDoc(), _id: 'as_degree:110:ast', degree_type: 'ast', major_slug: 'cs' };
    const res = await run(putRequirement, request({ params: { kind: 'as_degree' }, body }));
    expect(res.statusCode).toBe(200);
    const stored = await db.collection('curated_requirements').findOne({ _id: 'as_degree:110:ast' });
    expect(stored.major_slug).toBe('cs');
    expect(stored.degree_type).toBe('ast');
  });

  it('rejects mismatched ids, unknown college, string course_ids, and bad mirrors', async () => {
    await seedForDegree();
    const wrongCc = degreeDoc();
    wrongCc.community_college_id = 111;
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: wrongCc }))).statusCode).toBe(400);

    const noCollege = degreeDoc();
    noCollege._id = 'as_degree:999:local_cs_as';
    noCollege.community_college_id = 999;
    noCollege.college_id = 'cc:999';
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: noCollege }))).statusCode).toBe(400);

    const stringIds = degreeDoc();
    stringIds.requirement_groups[0].sections[0].receivers[0].options[0].course_ids = ['cc:101'];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: stringIds }))).statusCode).toBe(400);

    const badMirror = degreeDoc();
    badMirror.requirement_groups[0].sections[0].receivers[0].options[0].course_keys = ['cc:999'];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: badMirror }))).statusCode).toBe(400);
  });

  it('rejects confidence on non-extracted groups and sections on template_default stubs', async () => {
    await seedForDegree();
    const conf = degreeDoc();
    conf.requirement_groups[1].confidence = 0.5;
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: conf }))).statusCode).toBe(400);

    const stub = degreeDoc();
    stub.requirement_groups[1].sections = [{ receivers: [] }];
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: stub }))).statusCode).toBe(400);
  });

  it('accepts none_found rows without a body and rejects them with one', async () => {
    await seedForDegree();
    const none = {
      _id: 'as_degree:110:local_cs_as', community_college_id: 110, college_id: 'cc:110',
      degree_type: 'local_cs_as', major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'none_found',
      catalog_url: 'https://catalog.hancockcollege.edu/programs',
      catalog_year: '2025-2026',
    };
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: none }))).statusCode).toBe(200);
    const withBody = { ...none, requirement_groups: [{ group_id: 'x' }] };
    expect((await run(putRequirement, request({ params: { kind: 'as_degree' }, body: withBody }))).statusCode).toBe(400);
  });

  it('400s (not 500s) a truthy non-array requirement_groups on a none_found/ambiguous row', async () => {
    // Regression guard: a naive `Array.isArray(x) && x.length` check lets a
    // truthy non-array (e.g. {} or a number) sail through validation as
    // "empty", and the dispatch's stamping loop
    // `for (const g of canonical.requirement_groups || [])` then throws
    // `TypeError: ... is not iterable` (an uncaught 500), since `{} || []`
    // and `7 || []` both evaluate to the truthy non-iterable value itself.
    await seedForDegree();
    const base = {
      _id: 'as_degree:110:local_cs_as', community_college_id: 110, college_id: 'cc:110',
      degree_type: 'local_cs_as', major_slug: 'cs', template_ref: 'as_degree_template:cs', status: 'none_found',
      catalog_url: 'https://catalog.hancockcollege.edu/programs',
      catalog_year: '2025-2026',
    };

    const objectShape = { ...base, requirement_groups: {} };
    const resObject = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: objectShape }));
    expect(resObject.statusCode).toBe(400);
    expect(resObject.body.error).toMatch(/a none_found row must not carry requirement_groups/);

    const scalarShape = { ...base, status: 'ambiguous', requirement_groups: 7 };
    const resScalar = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: scalarShape }));
    expect(resScalar.statusCode).toBe(400);
    expect(resScalar.body.error).toMatch(/a ambiguous row must not carry requirement_groups/);
  });

  it('400s (not 500s) a null entry in requirement_groups, sections, receivers, and options', async () => {
    await seedForDegree();
    const nullGroup = degreeDoc();
    nullGroup.requirement_groups.push(null);
    const resGroup = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: nullGroup }));
    expect(resGroup.statusCode).toBe(400);
    expect(resGroup.body.error).toMatch(/each group must be an object/);

    const nullSection = degreeDoc();
    nullSection.requirement_groups[0].sections.push(null);
    const resSection = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: nullSection }));
    expect(resSection.statusCode).toBe(400);
    expect(resSection.body.error).toMatch(/each section must be an object/);

    const nullReceiver = degreeDoc();
    nullReceiver.requirement_groups[0].sections[0].receivers.push(null);
    const resReceiver = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: nullReceiver }));
    expect(resReceiver.statusCode).toBe(400);
    expect(resReceiver.body.error).toMatch(/each receiver must be an object/);

    const nullOption = degreeDoc();
    nullOption.requirement_groups[0].sections[0].receivers[0].options.push(null);
    const resOption = await run(putRequirement, request({ params: { kind: 'as_degree' }, body: nullOption }));
    expect(resOption.statusCode).toBe(400);
    expect(resOption.body.error).toMatch(/each option must be an object/);
  });

  it('produces a body the golden eligibility engine evaluates unchanged', async () => {
    // The point of the shared skeleton (spec §7): no translation layer.
    const { isMajorArticulable } = cjs('../services/analysis/eligibility');
    const m = { requirement_groups: degreeDoc().requirement_groups.filter((g) => g.sections) };
    expect(isMajorArticulable(m, true)).toBe(true);
    expect(isMajorArticulable(m, false)).toBe(true);
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

describe('as_degree delete guards', () => {
  it('blocks deleting a template that as_degree rows reference', async () => {
    await db.collection('curated_requirements').insertMany([
      { _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs' },
      { _id: 'as_degree:110:cs', kind: 'as_degree', template_ref: 'as_degree_template:cs' },
    ]);
    const res = await run(deleteRequirement, request({ params: { kind: 'as_degree_template', id: 'cs' } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/referenced by 1 as_degree/);
  });

  it('blocks deleting a concept referenced by a template slot', async () => {
    await db.collection('curated_requirements').insertMany([
      { _id: 'prereq_concept:cs_1', kind: 'prereq_concept', slug: 'cs_1', requires: [] },
      { _id: 'as_degree_template:cs', kind: 'as_degree_template', slug: 'cs',
        groups: [{ group_id: 'core', sections: [{ slots: [{ concepts: ['cs_1'] }] }] }] },
    ]);
    const res = await run(deleteRequirement, request({ params: { kind: 'prereq_concept', id: 'cs_1' } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/template/);
  });

  it('allows deleting an unreferenced template', async () => {
    await db.collection('curated_requirements').insertOne(
      { _id: 'as_degree_template:old', kind: 'as_degree_template', slug: 'old' });
    const res = await run(deleteRequirement, request({ params: { kind: 'as_degree_template', id: 'old' } }));
    expect(res.statusCode).toBe(200);
  });
});

describe('asDegrees endpoint', () => {
  it('returns the overview and a 404 for an unknown college detail', async () => {
    const overview = await run(asDegrees, request({ query: {} }));
    expect(overview.statusCode).toBe(200);
    expect(overview.body).toHaveProperty('rows');
    const missing = await run(asDegrees, request({ query: { college_id: 'cc:424242' } }));
    expect(missing.statusCode).toBe(404);
  });
});
