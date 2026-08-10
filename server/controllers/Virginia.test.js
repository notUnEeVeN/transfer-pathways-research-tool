import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  prerequisiteGraph, courses, course, matrix, degrees,
} = cjs('./Virginia');
const { courseIdFor } = cjs('../services/virginia/courseIdentity');
const apiRouter = cjs('../routes/api');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('virginia_controller_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

function request(query = {}, rest = {}) {
  return { ...rest, query, app: { locals: { db } } };
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

describe('Virginia course identity API', () => {
  beforeEach(async () => {
    await db.collection('va_courses').insertMany([
      {
        _id: 'va:crs:CSC221', course_id: courseIdFor('CSC221'), course_key: 'va:CSC221',
        code: 'CSC221', title: 'Programming I', credits: 3, department: 'Computer Science',
        offered_by: ['Sample Community College'],
        articulates_to: [
          {
            institution: 'Sample University', identifier: 'CS 108',
            name: 'Introduction to Computing', notes: null,
          },
          {
            institution: 'Sample University', identifier: 'CS 109',
            name: 'Computing II', notes: null,
          },
        ],
      },
      {
        // Deliberately lacks the newer identity fields: the API backfills old
        // Virginia imports rather than requiring a data migration first.
        _id: 'va:crs:ENG111',
        code: 'ENG111', title: 'College Composition I', credits: 3, department: 'English',
        offered_by: ['Sample Community College'],
        articulates_to: [{
          institution: 'Bucket University', identifier: 'TRNS1XX',
          name: 'Transfer elective', notes: null,
        }],
      },
    ]);
  });

  it('exposes VCCS ids on unfiltered and college-filtered course rows', async () => {
    const unfiltered = await run(courses, request());
    expect(unfiltered.body.courses.find((row) => row.code === 'CSC221')).toMatchObject({
      _id: 'va:crs:CSC221',
      course_id: 1059498355,
      course_key: 'va:CSC221',
    });

    const byCollege = await run(courses, request({ college: 'Sample Community College' }));
    expect(byCollege.body.courses).toHaveLength(2);
    expect(byCollege.body.courses.every((row) => Number.isInteger(row.course_id))).toBe(true);
    expect(byCollege.body.courses.every((row) => row.course_key === `va:${row.code}`)).toBe(true);
  });

  it('keeps the VCCS id and adds a university parent_id on receiver rows', async () => {
    const response = await run(courses, request({ receiver: 'Sample University' }));
    expect(response.body.courses).toEqual([
      expect.objectContaining({
        course_id: 1059498355,
        course_key: 'va:CSC221',
        lands_as: expect.objectContaining({
          identifier: 'CS 108', code: 'CS108', parent_id: 1144834976,
        }),
        landings: [
          expect.objectContaining({ identifier: 'CS 108', parent_id: 1144834976 }),
          expect.objectContaining({ identifier: 'CS 109', parent_id: courseIdFor('CS109') }),
        ],
      }),
    ]);
  });

  it('returns null instead of minting a parent_id for an elective bucket', async () => {
    const response = await run(courses, request({ receiver: 'Bucket University' }));
    expect(response.body.courses[0].lands_as).toMatchObject({
      identifier: 'TRNS1XX', code: 'TRNS1XX', parent_id: null,
    });
  });

  it('adds the same identities to every university target in course detail', async () => {
    const response = await run(course, request({}, { params: { code: 'CSC221' } }));
    expect(response.body.course).toMatchObject({
      course_id: 1059498355,
      course_key: 'va:CSC221',
      articulates_to: [
        { parent_id: 1144834976, code: 'CS108' },
        { parent_id: courseIdFor('CS109'), code: 'CS109' },
      ],
    });

    const legacy = await run(course, request({}, { params: { code: 'ENG111' } }));
    expect(legacy.body.course).toMatchObject({
      course_id: courseIdFor('ENG111'),
      course_key: 'va:ENG111',
      articulates_to: [{ code: 'TRNS1XX', parent_id: null }],
    });
  });

  it('uses one parent_id contract from a transfer landing through a degree lookup', async () => {
    const parentId = courseIdFor('CS108');
    await db.collection('va_requirements').insertOne({
      _id: 'va:degree:sample-university:cs',
      kind: 'degree',
      school_id: 'va:uni:sample-university',
      school: 'Sample University',
      status: 'extracted',
      codes_seen: ['CS108'],
      course_titles: { CS108: 'University Introduction to Computing' },
      requirement_groups: [{
        title: 'Major', sections: [{
          receivers: [{
            receiving: { kind: 'course', parent_id: parentId, units: 3 },
            code_seen: 'CS108',
            options: [],
          }],
        }],
      }],
    });
    // A VCCS row with the same printed code must never lend its title or
    // credit value to the university-side object.
    await db.collection('va_courses').insertOne({
      _id: 'va:crs:CS108',
      course_id: parentId,
      course_key: 'va:CS108',
      code: 'CS108',
      title: 'VCCS Same-code Course',
      credits: 1,
    });

    const landingResponse = await run(courses, request({ receiver: 'Sample University' }));
    const degreeResponse = await run(degrees, request({ institution: 'Sample University' }));
    const landingParentId = landingResponse.body.courses[0].lands_as.parent_id;
    expect(landingParentId).toBe(parentId);
    expect(degreeResponse.body.university_courses_by_id[landingParentId]).toMatchObject({
      parent_id: parentId,
      code: 'CS108',
      title: 'University Introduction to Computing',
      min_units: 3,
      max_units: 3,
    });
  });

  it('counts one shared course once when it has multiple targets at a university', async () => {
    await db.collection('va_institutions').insertOne({
      _id: 'va:inst:sample-community-college',
      name: 'Sample Community College',
      level: 'community_college',
    });
    const response = await run(matrix, request());
    expect(response.body.receivers).toContain('Sample University');
    const collegeIndex = response.body.colleges.indexOf('Sample Community College');
    const receiverIndex = response.body.receivers.indexOf('Sample University');
    expect(response.body.cells[collegeIndex][receiverIndex]).toBe(1);
  });
});

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
  it('does not borrow metadata from an unrelated same-code college course', async () => {
    await db.collection('va_requirements').insertOne({
      _id: 'va:as:richard-bland-college:cs',
      kind: 'as_degree',
      college_id: 'va:cc:richard-bland-college',
      status: 'extracted',
      codes_seen: ['HIST101', 'CSC221'],
      course_titles: {
        HIST101: 'Western Civilization to 1715',
        CSC221: 'Richard Bland Programming',
      },
      requirement_groups: [{
        title: 'Program', sections: [{ receivers: [{
          receiving: null,
          options: [{
            course_ids: [courseIdFor('HIST101'), courseIdFor('CSC221')],
            course_keys: ['va:HIST101', 'va:CSC221'],
          }],
        }] }],
      }],
    });
    await db.collection('va_courses').insertMany([
      {
        _id: 'va:crs:HIST101', course_id: courseIdFor('HIST101'),
        course_key: 'va:HIST101', code: 'HIST101',
        title: 'Unrelated Institution History', credits: 2,
        offered_by: ['Eastern Mennonite University'],
      },
      {
        _id: 'va:crs:CSC221', course_id: courseIdFor('CSC221'),
        course_key: 'va:CSC221', code: 'CSC221',
        title: 'VCCS Programming', credits: 3,
        offered_by: ['Richard Bland College'],
      },
    ]);

    const res = await run(degrees, request({ institution: 'Richard Bland College' }));
    expect(res.body.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'HIST101', title: 'Western Civilization to 1715', units: null,
      }),
      expect.objectContaining({
        code: 'CSC221', title: 'Richard Bland Programming', units: 3,
      }),
    ]));
  });

  it('resolves requested codes for a known institution with no degree document', async () => {
    await db.collection('va_institutions').insertMany([
      {
        _id: 'va:inst:empty-university',
        name: 'Empty University',
        level: 'four_year',
      },
      {
        _id: 'va:inst:empty-community-college',
        name: 'Empty Community College',
        level: 'community_college',
      },
    ]);

    const university = await run(degrees, request({
      institution: 'Empty University',
      codes: 'CS 108,CS110',
    }));
    expect(university.statusCode).toBe(200);
    expect(university.body.degrees).toEqual([]);
    expect(university.body.courses).toEqual([]);
    expect(university.body.university_courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parent_id: courseIdFor('CS108'), code: 'CS108',
        institution: 'Empty University', school_id: 'va:uni:empty-university',
        document_named: false,
        identity_source: 'requested_code',
      }),
      expect.objectContaining({
        parent_id: courseIdFor('CS110'), code: 'CS110', document_named: false,
        identity_source: 'requested_code',
      }),
    ]));

    const college = await run(degrees, request({
      institution: 'Empty Community College',
      codes: 'CSC221,MTH263',
    }));
    expect(college.statusCode).toBe(200);
    expect(college.body.university_courses).toEqual([]);
    expect(college.body.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        course_id: courseIdFor('CSC221'), course_key: 'va:CSC221',
        document_named: false, identity_source: 'requested_code',
      }),
      expect.objectContaining({
        course_id: courseIdFor('MTH263'), course_key: 'va:MTH263',
        document_named: false, identity_source: 'requested_code',
      }),
    ]));
  });

  it('rejects placeholder codes and unknown institutions in identity requests', async () => {
    await db.collection('va_institutions').insertOne({
      _id: 'va:inst:empty-university',
      name: 'Empty University',
      level: 'four_year',
    });
    const invalid = await run(degrees, request({
      institution: 'Empty University', codes: 'CS108,TRNS1XX',
    }));
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body.invalid_codes).toEqual(['TRNS1XX']);

    const unknown = await run(degrees, request({
      institution: 'Unknown University', codes: 'CS108',
    }));
    expect(unknown.statusCode).toBe(400);
    expect(unknown.body.error).toContain('unknown Virginia institution');
  });

  it('lists every A.S. catalog course id even when the tree does not reference it yet', async () => {
    await db.collection('va_requirements').insertOne({
      _id: 'va:as:test-college:cs',
      kind: 'as_degree',
      college_id: 'va:cc:test-college',
      status: 'extracted',
      codes_seen: ['CSC221', 'MTH263'],
      course_titles: { CSC221: 'Programming I', MTH263: 'Calculus I' },
      requirement_groups: [{
        title: 'Major', sections: [{
          receivers: [{
            receiving: null,
            options: [{ course_ids: [courseIdFor('CSC221')], course_keys: ['va:CSC221'] }],
          }],
        }],
      }],
    });

    const res = await run(degrees, request({ institution: 'Test College' }));
    expect(res.body.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        course_id: 1059498355, course_key: 'va:CSC221', code: 'CSC221', title: 'Programming I',
      }),
      expect.objectContaining({
        course_id: 1012786453, course_key: 'va:MTH263', code: 'MTH263', title: 'Calculus I',
      }),
    ]));
  });

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
      codes_seen: ['CS108', 'CS109', 'CS110'],
      course_titles: {
        CS108: 'Intro to Computing', CS109: 'Computing II', CS110: 'Computing III',
      },
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
    expect(byId[111]).toMatchObject({
      parent_id: 111, code: 'CS108', institution: 'Test University',
      prefix: 'CS', number: '108', title: 'Intro to Computing',
    });
    expect(byId[222]).toMatchObject({
      parent_id: 222, code: 'CS109', institution: 'Test University',
      prefix: 'CS', number: '109', title: 'Computing II',
    });

    // CS110 is named by the source catalog but intentionally absent from the
    // current requirement tree. Its id must still be discoverable so a
    // researcher can repair or extend that tree.
    expect(res.body.university_courses).toContainEqual(expect.objectContaining({
      parent_id: 914981327,
      code: 'CS110',
      institution: 'Test University',
      title: 'Computing III',
    }));
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
