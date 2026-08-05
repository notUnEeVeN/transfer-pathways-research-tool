import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { prerequisiteGraph, degrees } = cjs('./Virginia');
const apiRouter = cjs('../routes/api');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('virginia_controller_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

function request(query = {}) {
  return { query, app: { locals: { db } } };
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

describe('Virginia prerequisite graph controller', () => {
  it('is registered only on the Virginia API namespace', () => {
    const paths = apiRouter.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
    expect(paths).toContain('/va/prerequisite-graph');
    expect(paths).not.toContain('/curated/virginia-prerequisite-graph');
  });

  it('returns the isolated graph contract and accepts stable selectors', async () => {
    await db.collection('va_institutions').insertMany([
      { _id: 'va:inst:sample-community-college', name: 'Sample Community College', level: 'community_college' },
      { _id: 'va:inst:sample-university', name: 'Sample University', level: 'four_year' },
    ]);
    await db.collection('va_courses').insertOne({
      _id: 'va:crs:CSC221', code: 'CSC221', title: 'Programming I', credits: 3,
      offered_by: ['Sample Community College'],
      articulates_to: [{ institution: 'Sample University', identifier: 'CS 101', name: 'Programming I' }],
    });
    await db.collection('va_course_concepts').insertOne({
      course_key: 'va:CSC221', code: 'CSC221', concept: null,
      examined: true, source: 'va_cs_sweep_v1',
    });
    await db.collection('va_course_requisites').insertOne({
      course_key: 'va:CSC221', code: 'CSC221', status: 'none', groups: [],
    });

    const response = await run(prerequisiteGraph, request({
      college: 'va:cc:sample-community-college',
      university: 'va:inst:sample-university',
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.projection.mode).toBe('college_to_university');
    expect(response.body.courses).toEqual([
      expect.objectContaining({ key: 'va:CSC221', role: 'transfer_preparation', in_scope: true }),
    ]);
    expect(response.body).toMatchObject({
      rules: [], edges: [], missing: [],
      stats: { in_scope: 1, examined: 1, mapped: 0 },
    });
    expect(response.body.sources.courses.collection).toBe('va_courses');
  });

  it('turns an unknown college or university selector into a 400 response', async () => {
    await db.collection('va_institutions').insertOne({
      _id: 'va:inst:sample-community-college', name: 'Sample Community College', level: 'community_college',
    });
    const unknownCollege = await run(prerequisiteGraph, request({ college: 'Not A College' }));
    expect(unknownCollege.statusCode).toBe(400);
    expect(unknownCollege.body.error).toBe('unknown Virginia college: Not A College');

    const unknownUniversity = await run(prerequisiteGraph, request({ university: 'va:uni:not-a-university' }));
    expect(unknownUniversity.statusCode).toBe(400);
    expect(unknownUniversity.body.error).toContain('unknown Virginia university');
  });

  it('handles missing Virginia collections in canonical mode', async () => {
    const response = await run(prerequisiteGraph, request());
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      courses: [], rules: [], edges: [], missing: [],
      stats: { in_scope: 0, no_result: true },
      projection: { mode: 'canonical' },
    });
  });
});

describe('Virginia degree course naming', () => {
  it('names the members of a series instead of rendering their raw ids', async () => {
    // A series receiver carries `parent_ids` and no singular `parent_id`, with
    // its codes in one `/`-separated string aligned to those ids. Resolving only
    // the singular id left every series member unnamed, and the ledger prints an
    // unresolved id as `#1140373011` — bare numbers where a course should be.
    await db.collection('va_requirements').insertOne({
      _id: 'va:degree:test-university:cs',
      kind: 'degree',
      school_id: 'va:uni:test-university',
      school: 'Test University',
      status: 'extracted',
      course_titles: { CS108: 'Intro to Computing', CS109: 'Computing II' },
      requirement_groups: [{
        title: 'Major', sections: [{
          receivers: [{
            receiving: { kind: 'series', parent_ids: [111, 222] },
            code_seen: 'CS108 / CS109',
            options: [],
          }],
        }],
      }],
    });

    const res = await run(degrees, request({ institution: 'Test University' }));
    expect(res.statusCode).toBe(200);
    const byId = res.body.university_courses_by_id;
    expect(byId[111]).toMatchObject({ prefix: 'CS', number: '108', title: 'Intro to Computing' });
    expect(byId[222]).toMatchObject({ prefix: 'CS', number: '109', title: 'Computing II' });
  });

  it('leaves a superseded document out of the response', async () => {
    await db.collection('va_requirements').insertMany([
      { _id: 'a', kind: 'as_degree', college_id: 'va:cc:test-college', status: 'extracted', requirement_groups: [] },
      { _id: 'b', kind: 'as_degree', college_id: 'va:cc:test-college', status: 'superseded', requirement_groups: [] },
      { _id: 'c', kind: 'as_degree', college_id: 'va:cc:test-college', status: 'out_of_scope', requirement_groups: [] },
    ]);
    const res = await run(degrees, request({ institution: 'Test College' }));
    expect(res.body.degrees.map((d) => d._id)).toEqual(['a']);
  });
});
