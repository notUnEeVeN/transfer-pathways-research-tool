import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  exportCsAstDegrees,
  exportLocalCsAsDegrees,
  _parseMultiCampusPathwayParams,
  _resolveMajorScope,
} = cjs('./Analysis');
const { getMajor } = cjs('../config/majors');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('analysis_controller_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });

function run(handler, query = {}) {
  const req = {
    query,
    user: { uid: 'researcher-1' },
    app: { locals: { db, auditDb: db } },
  };
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      headers: {},
      status(code) { this.statusCode = code; return this; },
      setHeader(name, value) { this.headers[name] = value; },
      json(value) { this.body = value; resolve(this); return this; },
      send(value) { this.body = value; resolve(this); return this; },
    };
    handler(req, res, (error) => error ? reject(error) : resolve(res));
  });
}

describe('CS A.S.-T export', () => {
  it('declares and returns only the fixed ast cohort', async () => {
    await db.collection('assist_institutions').insertOne({
      _id: 'cc:10', kind: 'community_college', source_id: 10, name: 'Example College',
    });
    await db.collection('assist_courses').insertOne({
      _id: 'cc:100', course_id: 100, prefix: 'CS', number: '1', title: 'Programming', units: 4,
    });
    const shared = {
      kind: 'as_degree', community_college_id: 10, college_id: 'cc:10', status: 'found',
      requirement_groups: [{ sections: [{ receivers: [{ options: [{ course_ids: [100] }] }] }] }],
    };
    await db.collection('curated_requirements').insertMany([
      { ...shared, _id: 'as_degree:10:ast', degree_type: 'ast', degree_title_seen: 'Computer Science A.S.-T' },
      { ...shared, _id: 'as_degree:10:local', degree_type: 'local_cs_as', degree_title_seen: 'Computer Science A.S.' },
    ]);

    const response = await run(exportCsAstDegrees);

    expect(response.statusCode).toBe(200);
    expect(response.body.params.degree_type).toBe('ast');
    expect(response.body.n).toBe(1);
    expect(response.body.rows[0]).toMatchObject({
      _id: 'as_degree:10:ast', degree_type: 'ast', college_name: 'Example College',
    });
    expect(response.body.rows[0].courses_by_id['cc:100']).toMatchObject({ code: 'CS 1', units: 4 });
  });

  it('provides the local CS A.S. as a separate fixed cohort', async () => {
    const response = await run(exportLocalCsAsDegrees);

    expect(response.statusCode).toBe(200);
    expect(response.body.params.degree_type).toBe('local_cs_as');
    expect(response.body.n).toBe(1);
    expect(response.body.rows[0]).toMatchObject({
      _id: 'as_degree:10:local', degree_type: 'local_cs_as', college_name: 'Example College',
    });
    expect(response.body.rows[0].courses_by_id['cc:100']).toMatchObject({ code: 'CS 1', units: 4 });
  });
});

describe('major scope resolution', () => {
  // `major` already means "exact ASSIST program name" elsewhere in the API
  // (requirement-comparison, visible pairs), so the slug param is majorSlug.
  it('resolves a slug to that major\'s exact campus/program mapping', () => {
    expect(_resolveMajorScope({ majorSlug: 'cs' }))
      .toEqual({ slug: 'cs', majorPrograms: getMajor('cs').programs, majorContains: '' });
  });

  it('keeps the legacy majorContains filter working', () => {
    expect(_resolveMajorScope({ majorContains: 'econom' }))
      .toEqual({ slug: null, majorPrograms: null, majorContains: 'econom' });
  });

  it('defaults to exact canonical CS so new majors cannot widen old callers', () => {
    expect(_resolveMajorScope({}))
      .toEqual({ slug: 'cs', majorPrograms: getMajor('cs').programs, majorContains: '' });
  });

  it('reports unknown slugs with the onboarded list', () => {
    expect(_resolveMajorScope({ majorSlug: 'underwater-basket-weaving' }))
      .toEqual({ error: 'unknown major: underwater-basket-weaving', known: ['cs', 'bio', 'econ'] });
  });
});

describe('multi-campus pathway request parameters', () => {
  it('treats campus goals as a sorted, de-duplicated set', () => {
    expect(_parseMultiCampusPathwayParams({ schoolIds: '89,79,89' })).toEqual({
      schoolIds: [79, 89],
      mode: 'average',
      communityCollegeId: null,
      semesterLoad: 15,
      quarterLoad: 15,
    });
  });

  it('accepts a specific college and calendar-specific loads', () => {
    expect(_parseMultiCampusPathwayParams({
      schoolIds: '79', mode: 'college', communityCollegeId: '51',
      semesterLoad: '12.5', quarterLoad: '18',
    })).toEqual({
      schoolIds: [79],
      mode: 'college',
      communityCollegeId: 51,
      semesterLoad: 12.5,
      quarterLoad: 18,
    });
  });

  it.each([
    [{}, 'schoolIds'],
    [{ schoolIds: '79,nope' }, 'schoolIds'],
    [{ schoolIds: '79', mode: 'college' }, 'communityCollegeId'],
    [{ schoolIds: '79', mode: 'average', communityCollegeId: '51' }, 'communityCollegeId'],
    [{ schoolIds: '79', semesterLoad: '25' }, 'semesterLoad'],
    [{ schoolIds: '79', quarterLoad: '5' }, 'quarterLoad'],
  ])('rejects an invalid request %#', (query, field) => {
    expect(_parseMultiCampusPathwayParams(query).error).toContain(field);
  });
});
