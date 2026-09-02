import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  prerequisiteGraph, summary, institutions, courses, course, matrix, degrees, coverage, putDegree,
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

const officialSource = (id, kind, url) => ({ id, kind, label: `${kind} source`, url });
const templateReceiver = (receiving) => ({
  receiving, articulation_status: null, options: [], options_conjunction: 'or',
});
const degreeSection = (units, receivers, sourceRefs, rest = {}) => ({
  section_advisement: 1,
  unit_advisement: units,
  source_refs: sourceRefs,
  receivers,
  ...rest,
});

function acceptedDegreeForPut() {
  const cs101 = courseIdFor('CS101');
  return {
    _id: 'va:degree:sample-university:cs',
    kind: 'degree',
    school_id: 'va:uni:sample-university',
    institution_id: 'va:uni:sample-university',
    school: 'Sample University',
    major_slug: 'cs',
    program: 'Computer Science, B.S.',
    degree_variant: 'B.S.',
    catalog_year: '2026-2027',
    unit_system: 'semester',
    total_units: 120,
    academic_unit: 'Department of Computer Science',
    ge_authority: 'University Core',
    source_url: 'https://catalog.sample.edu/programs/computer-science-bs',
    codes_seen: ['CS101'],
    course_titles: { CS101: 'Introduction to Computer Science' },
    sources: [
      officialSource('major', 'major', 'https://catalog.sample.edu/programs/computer-science-bs'),
      officialSource('ge', 'ge', 'https://catalog.sample.edu/general-education'),
      officialSource('graduation', 'graduation', 'https://catalog.sample.edu/graduation'),
    ],
    requirement_layers: {
      major: { status: 'complete', source_refs: ['major'] },
      ge_college: { status: 'complete', source_refs: ['ge'] },
      university_graduation: { status: 'complete', source_refs: ['graduation'] },
    },
    unit_audit: {
      graduation_minimum: 120,
      modeled_units: 120,
      upper_division: {
        status: 'required', minimum_units: 30, modeled_units: 30,
        source_refs: ['graduation'],
      },
      residency: {
        status: 'none_stated',
        reason: 'No numeric residency rule is stated for this validation fixture.',
        source_refs: ['graduation'],
      },
    },
    requirement_groups: [
      {
        title: 'Lower-division major', requirement_layer: 'major',
        group_conjunction: 'And', tier: 'transferable', course_level: 'lower_division',
        cc_articulable: true, source_refs: ['major'],
        sections: [degreeSection(3, [templateReceiver({
          kind: 'course', parent_id: cs101, units: 3,
        })], ['major'])],
      },
      {
        title: 'General education after overlap', requirement_layer: 'ge_college',
        group_conjunction: 'And', tier: 'breadth', course_level: 'lower_division',
        cc_articulable: true, source_refs: ['ge'],
        sections: [degreeSection(30, [templateReceiver({
          kind: 'ge_area', parent_id: null, code: 'VA-GE', name: 'University Core',
        })], ['ge'])],
      },
      {
        title: 'Upper-division major', requirement_layer: 'major',
        group_conjunction: 'And', tier: 'nontransferable', course_level: 'upper_division',
        cc_articulable: false, source_refs: ['major'],
        sections: [degreeSection(30, [templateReceiver({
          kind: 'requirement', parent_id: null, name: 'Upper-division major block',
        })], ['major'], { cc_articulable: false })],
      },
      {
        title: 'Remaining university credit', requirement_layer: 'university_graduation',
        group_conjunction: 'And', tier: 'nontransferable', course_level: 'residency',
        cc_articulable: false, source_refs: ['graduation'],
        sections: [degreeSection(57, [templateReceiver({
          kind: 'requirement', parent_id: null, name: 'Remaining degree credit',
        })], ['graduation'], { cc_articulable: false })],
      },
    ],
    verification: { verified: false, notes: null },
  };
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

describe('Virginia public institution cohort API', () => {
  beforeEach(async () => {
    await db.collection('va_institutions').insertMany([
      {
        _id: 'va:inst:george-mason-university', name: 'George Mason University',
        level: 'four_year', course_count: 0, receives_count: 1,
      },
      {
        _id: 'va:inst:randolph-macon-college', name: 'Randolph-Macon College',
        level: 'four_year', course_count: 0, receives_count: 1,
      },
      {
        _id: 'va:inst:george-washington-university', name: 'George Washington University',
        level: 'four_year', course_count: 0, receives_count: 1,
      },
      {
        _id: 'va:inst:virginia-tech', name: 'Virginia Tech',
        level: 'four_year', course_count: 0, receives_count: 1,
      },
      {
        _id: 'va:inst:virginia-polytechnic-institute-and-state-university',
        name: 'Virginia Polytechnic Institute and State University',
        level: 'four_year', course_count: 0, receives_count: 2,
      },
      {
        _id: 'va:inst:sample-community-college', name: 'Sample Community College',
        level: 'community_college', course_count: 1, receives_count: 0,
      },
    ]);
    await db.collection('va_courses').insertOne({
      _id: 'va:crs:CSC221', code: 'CSC221', title: 'Programming I', credits: 3,
      department: 'Computer Science', offered_by: ['Sample Community College'],
      articulates_to: [
        { institution: 'George Mason University', identifier: 'CS 112', name: 'Introduction' },
        { institution: 'Virginia Tech', identifier: 'CS 1114', name: 'Introduction' },
        { institution: 'Randolph-Macon College', identifier: 'CSCI 111', name: 'Introduction' },
      ],
      counts: { with_notes: 0 },
      imported_at: new Date('2026-08-10T00:00:00Z'),
    });
  });

  it('returns the exact public 15 first while retaining secondary and external receivers', async () => {
    const response = await run(institutions, request({ level: 'four_year' }));
    expect(response.statusCode).toBe(200);
    expect(response.body.cohorts.schev_public_four_year.institution_count).toBe(15);
    expect(response.body.institutions.slice(0, 15).every((row) => row.is_primary)).toBe(true);
    expect(response.body.institutions.filter((row) => row.is_primary)).toHaveLength(15);

    const uva = response.body.institutions.find((row) => row.name === 'University of Virginia');
    const vmi = response.body.institutions.find((row) => row.name === 'Virginia Military Institute');
    for (const missing of [uva, vmi]) {
      expect(missing).toMatchObject({
        corpus_present: false,
        course_count: 0,
        receives_count: 0,
        degree_status: 'none',
        collection_status: 'not_collected',
        needs_collection: true,
      });
    }

    expect(response.body.institutions.find((row) => row.name === 'Randolph-Macon College')).toMatchObject({
      cohort: 'other_four_year', is_primary: false,
    });
    expect(response.body.institutions.find((row) => row.name === 'George Washington University')).toMatchObject({
      cohort: 'external_receiver', is_primary: false,
    });
    expect(response.body.institutions.filter((row) => row.name.includes('Virginia Tech'))).toHaveLength(0);
    expect(response.body.institutions.filter((row) => (
      row.institution_slug === 'virginia-polytechnic-institute-and-state-university'
    ))).toHaveLength(1);
  });

  it('filters public and secondary cohorts without silently dropping them unfiltered', async () => {
    const publicResponse = await run(institutions, request({
      level: 'four_year', cohort: 'schev_public_four_year',
    }));
    expect(publicResponse.body.institutions).toHaveLength(15);
    expect(publicResponse.body.institutions.every((row) => row.is_primary)).toBe(true);

    const secondary = await run(institutions, request({
      level: 'four_year', cohort: 'other_four_year',
    }));
    expect(secondary.body.institutions.map((row) => row.name)).toContain('Randolph-Macon College');
    expect(secondary.body.institutions.map((row) => row.name)).not.toContain('George Washington University');
  });

  it('ignores superseded and out-of-scope catalog documents when reporting degree status', async () => {
    await db.collection('va_requirements').insertMany([
      {
        _id: 'va:degree:george-mason-university:retired-cs',
        source: 'institution_catalog', status: 'superseded',
        school_id: 'va:uni:george-mason-university', codes_seen: ['CS110'], total_units: 120,
      },
      {
        _id: 'va:degree:randolph-macon-college:out-of-scope-cs',
        source: 'institution_catalog', status: 'out_of_scope',
        school_id: 'va:uni:randolph-macon-college', codes_seen: ['CSCI111'], total_units: 120,
      },
      {
        _id: 'va:degree:virginia-polytechnic-institute-and-state-university:cs',
        source: 'institution_catalog', status: 'extracted',
        school_id: 'va:uni:virginia-polytechnic-institute-and-state-university',
        codes_seen: ['CS1114'], total_units: 123,
      },
    ]);

    const response = await run(institutions, request({ level: 'four_year' }));
    const bySlug = new Map(response.body.institutions.map((row) => [row.institution_slug, row]));

    expect(bySlug.get('george-mason-university')).toMatchObject({
      degree_status: 'none', collection_status: 'not_collected', degree_courses: 0,
    });
    expect(bySlug.get('randolph-macon-college')).toMatchObject({
      degree_status: 'none', collection_status: 'not_collected', degree_courses: 0,
    });
    expect(bySlug.get('virginia-polytechnic-institute-and-state-university')).toMatchObject({
      degree_status: 'full', collection_status: 'catalog_collected', degree_courses: 1,
      degree_units: 123,
    });
  });

  it('resolves aliases for receiver courses and degree owners', async () => {
    const courseResponse = await run(courses, request({
      receiver: 'Virginia Polytechnic Institute and State University',
    }));
    expect(courseResponse.body).toMatchObject({
      receiver: 'Virginia Polytechnic Institute and State University',
      receiver_sources: expect.arrayContaining(['Virginia Tech']),
      total: 1,
    });
    expect(courseResponse.body.courses[0].lands_as.identifier).toBe('CS 1114');

    const degreeResponse = await run(degrees, request({ institution: 'Virginia Tech' }));
    expect(degreeResponse.body).toMatchObject({
      institution: 'Virginia Polytechnic Institute and State University',
      requested_institution: 'Virginia Tech',
      institution_slug: 'virginia-polytechnic-institute-and-state-university',
      owner_id: 'va:uni:virginia-polytechnic-institute-and-state-university',
      degrees: [],
    });
  });

  it('builds an exact 15-column public matrix, including zero-evidence UVA and VMI columns', async () => {
    const response = await run(matrix, request({ cohort: 'schev_public_four_year' }));
    expect(response.body.receivers).toHaveLength(15);
    expect(response.body.receivers).toContain('University of Virginia');
    expect(response.body.receivers).toContain('Virginia Military Institute');
    expect(response.body.receivers).not.toContain('Randolph-Macon College');
    const college = response.body.colleges.indexOf('Sample Community College');
    expect(response.body.cells[college][response.body.receivers.indexOf('George Mason University')]).toBe(1);
    expect(response.body.cells[college][response.body.receivers.indexOf('University of Virginia')]).toBe(0);
  });

  it('accepts zero-corpus public universities in prerequisite scope', async () => {
    for (const university of ['University of Virginia', 'Virginia Military Institute']) {
      const response = await run(prerequisiteGraph, request({ university }));
      expect(response.statusCode).toBe(200);
      expect(response.body.projection).toMatchObject({
        mode: 'transfer_preparation',
        university: { name: university, level: 'four_year' },
      });
      expect(response.body.courses).toEqual([]);
    }
  });

  it('reports the stable public denominator separately from broad corpus counts', async () => {
    const response = await run(summary, request());
    expect(response.body).toMatchObject({ public_four_year: 15, courses: 1 });
    expect(response.body.four_year).toBe(5);
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
  it('scopes Richard Bland MATH251 without changing the legacy code hash', async () => {
    await db.collection('va_requirements').insertOne({
      _id: 'va:as:richard-bland-college:cs',
      kind: 'as_degree',
      college_id: 'va:cc:richard-bland-college',
      status: 'extracted',
      course_namespace: {
        kind: 'institution_local',
        institution_id: 'va:cc:richard-bland-college',
        vccs_master_applicable: false,
        identity_contract: 'owner_plus_course_id',
        scoped_key_format: 'va:cc:richard-bland-college:<code>',
        source_refs: ['major'],
      },
      codes_seen: ['MATH251', 'CSCI221'],
      course_titles: {
        MATH251: 'Calculus I',
        CSCI221: 'Programming for Computer Science & Engineering Majors I',
      },
      requirement_groups: [{
        title: 'Program', sections: [{ receivers: [{
          receiving: null,
          options: [{
            course_ids: [courseIdFor('MATH251'), courseIdFor('CSCI221')],
            course_keys: ['va:MATH251', 'va:CSCI221'],
          }],
        }] }],
      }],
    });
    await db.collection('va_courses').insertOne({
      _id: 'va:crs:MATH251', course_id: courseIdFor('MATH251'),
      course_key: 'va:MATH251', code: 'MATH251',
      title: 'Database Queries', credits: 3,
      offered_by: ['James Madison University'],
    });
    await db.collection('va_requirements').insertOne({
      _id: 'va:degree:james-madison-university:cs',
      kind: 'degree',
      school_id: 'va:uni:james-madison-university',
      status: 'extracted',
      codes_seen: ['MATH251'],
      course_titles: { MATH251: 'Database Queries' },
      requirement_groups: [{
        title: 'Program', sections: [{ receivers: [{
          code_seen: 'MATH251',
          receiving: { kind: 'course', parent_id: courseIdFor('MATH251'), units: 3 },
          options: [],
        }] }],
      }],
    });

    const res = await run(degrees, request({ institution: 'Richard Bland College' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.degrees[0].course_namespace).toMatchObject({
      kind: 'institution_local',
      identity_contract: 'owner_plus_course_id',
    });
    expect(res.body.courses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        course_id: courseIdFor('MATH251'),
        course_key: 'va:MATH251',
        code: 'MATH251',
        title: 'Calculus I',
        units: null,
        college_id: 'va:cc:richard-bland-college',
        institution_id: 'va:cc:richard-bland-college',
        identity_scope: 'institution_local',
        scoped_course_key: 'va:cc:richard-bland-college:MATH251',
      }),
      expect.objectContaining({
        course_id: courseIdFor('CSCI221'),
        course_key: 'va:CSCI221',
        code: 'CSCI221',
        college_id: 'va:cc:richard-bland-college',
        institution_id: 'va:cc:richard-bland-college',
        identity_scope: 'institution_local',
        scoped_course_key: 'va:cc:richard-bland-college:CSCI221',
      }),
    ]));
    expect(res.body.courses.every((courseRow) => (
      courseRow.identity_scope === 'institution_local'
      && courseRow.college_id === 'va:cc:richard-bland-college'
    ))).toBe(true);

    const jmu = await run(degrees, request({ institution: 'James Madison University' }));
    expect(jmu.body.university_courses).toEqual([expect.objectContaining({
      parent_id: courseIdFor('MATH251'),
      code: 'MATH251',
      title: 'Database Queries',
      school_id: 'va:uni:james-madison-university',
    })]);
    const rbcMath251 = res.body.courses.find((courseRow) => courseRow.code === 'MATH251');
    expect(rbcMath251.course_id).toBe(jmu.body.university_courses[0].parent_id);
    expect(rbcMath251.scoped_course_key)
      .toBe('va:cc:richard-bland-college:MATH251');
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
    expect(res.body.courses.every((courseRow) => (
      !Object.hasOwn(courseRow, 'identity_scope')
      && !Object.hasOwn(courseRow, 'scoped_course_key')
    ))).toBe(true);
  });

  it('names the members of a series instead of rendering their raw ids', async () => {
    // A series receiver carries `parent_ids` and no singular `parent_id`, with
    // its codes in one separator-delimited string aligned to those ids. Source
    // compositions use `+` for an AND sequence. Resolving only
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
            code_seen: 'CS108 + CS109',
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

describe('Virginia degree verification gate', () => {
  it('rejects a stale degree save instead of overwriting a newer publication', async () => {
    const current = acceptedDegreeForPut();
    current.updated_at = new Date('2026-08-10T12:00:00.000Z');
    await db.collection('va_requirements').insertOne(current);
    const stale = structuredClone(current);
    stale.updated_at = new Date('2026-08-09T12:00:00.000Z');
    stale.requirement_groups[0].title = 'Stale browser title';

    const response = await run(putDegree, request({}, {
      params: { id: stale._id },
      body: stale,
      user: { uid: 'researcher-1', name: 'Researcher One' },
    }));

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toContain('Refresh');
    const stored = await db.collection('va_requirements').findOne({ _id: current._id });
    expect(stored.requirement_groups[0].title).toBe(current.requirement_groups[0].title);
  });

  it('lets a person sign a partial document and reports the failed parse as context', async () => {
    const partial = acceptedDegreeForPut();
    partial.requirement_layers.ge_college.status = 'missing';
    partial.verification.verified = true;

    const response = await run(putDegree, request({}, {
      params: { id: partial._id },
      body: partial,
      user: { uid: 'researcher-1', name: 'Researcher One' },
    }));

    expect(response.statusCode).toBe(200);
    // The parse still fails, and the caller is still told so — it just does not
    // veto the signature of the person who read the catalog page.
    expect(response.body.acceptance).toMatchObject({ accepted: false });
    expect(response.body.acceptance.catalog.failed).toContain('four_year_layers');
    const stored = await db.collection('va_requirements').findOne({ _id: partial._id });
    expect(stored.acceptance.accepted).toBe(false);
    expect(stored.verification).toMatchObject({
      verified: true, verified_by: 'researcher-1', verified_by_label: 'Researcher One',
    });
    const revisions = await db.collection('va_revisions').find({ doc_id: partial._id }).toArray();
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ by_uid: 'researcher-1', verified: true, created: true });
  });

  it('never takes the verdict or the verifier label from the request body', async () => {
    const degree = acceptedDegreeForPut();
    degree.verification = {
      verified: true,
      verified_by: 'somebody-else',
      verified_by_label: 'Somebody Else',
      verified_at: new Date('2020-01-01T00:00:00.000Z'),
    };

    const response = await run(putDegree, request({}, {
      params: { id: degree._id },
      body: degree,
      user: { uid: 'researcher-9', name: 'Researcher Nine' },
    }));

    expect(response.statusCode).toBe(200);
    const stored = await db.collection('va_requirements').findOne({ _id: degree._id });
    expect(stored.verification.verified_by).toBe('researcher-9');
    expect(stored.verification.verified_by_label).toBe('Researcher Nine');
    expect(new Date(stored.verification.verified_at).getUTCFullYear())
      .toBeGreaterThan(2020);
  });

  it('clears the verifier stamp when a signed document is reopened', async () => {
    const degree = acceptedDegreeForPut();
    degree.verification = {
      verified: true,
      verified_by: 'researcher-1',
      verified_by_label: 'Researcher One',
      verified_at: new Date('2026-08-01T00:00:00.000Z'),
      notes: 'Walked the catalog, the GE page and the graduation page.',
    };
    await db.collection('va_requirements').insertOne(degree);
    const reopened = structuredClone(degree);
    reopened.verification.verified = false;

    const response = await run(putDegree, request({}, {
      params: { id: reopened._id },
      body: reopened,
      user: { uid: 'researcher-2', name: 'Researcher Two' },
    }));

    expect(response.statusCode).toBe(200);
    const stored = await db.collection('va_requirements').findOne({ _id: reopened._id });
    expect(stored.verification).toMatchObject({
      verified: false, verified_by: null, verified_by_label: null, verified_at: null,
    });
    // Reopening a verdict never edits the note a person wrote.
    expect(stored.verification.notes).toBe('Walked the catalog, the GE page and the graduation page.');
  });

  it('server-validates and stamps a complete degree instead of trusting body acceptance', async () => {
    const degree = acceptedDegreeForPut();
    degree.acceptance = { accepted: true, forged: true };
    degree.verification.verified = true;

    const response = await run(putDegree, request({}, {
      params: { id: degree._id },
      body: degree,
      user: { uid: 'researcher-1', name: 'Researcher One' },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.acceptance).toMatchObject({ accepted: true, ready_for_analysis: true });
    const stored = await db.collection('va_requirements').findOne({ _id: degree._id });
    expect(stored.acceptance).toMatchObject({ accepted: true, ready_for_analysis: true });
    expect(stored.acceptance).not.toHaveProperty('forged');
    expect(stored.collection_status).toBe('analysis_ready');
    expect(stored.research_status).toBe('human_verified_analysis_ready');
    expect(stored.verification).toMatchObject({
      verified: true,
      verified_by: 'researcher-1',
      verified_by_label: 'Researcher One',
      stale: false,
    });
  });

  it('reopens a signed degree when its requirements change', async () => {
    const degree = acceptedDegreeForPut();
    degree.verification = {
      verified: true,
      verified_by: 'researcher-1',
      verified_by_label: 'Researcher One',
      verified_at: new Date('2026-08-01T00:00:00.000Z'),
    };
    await db.collection('va_requirements').insertOne(degree);
    const edited = structuredClone(degree);
    edited.requirement_groups[0].title = 'Revised lower-division major';

    const response = await run(putDegree, request({}, {
      params: { id: edited._id },
      body: edited,
      user: { uid: 'researcher-2', name: 'Researcher Two' },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.verification_reopened).toBe(true);
    const stored = await db.collection('va_requirements').findOne({ _id: edited._id });
    expect(stored.verification).toMatchObject({
      verified: false,
      stale: true,
      stale_reason: 'degree content changed after verification',
      previous: expect.objectContaining({ verified: true, verified_by: 'researcher-1' }),
    });
    expect(stored.verification.verified_at).toBeNull();
    expect(stored.research_status).toBe('human_verification_reopened_after_edit');
  });

  it('preserves the signed verdict when only the verifier notes change', async () => {
    const degree = acceptedDegreeForPut();
    const signedAt = new Date('2026-08-01T00:00:00.000Z');
    degree.verification = {
      verified: true,
      verified_by: 'researcher-1',
      verified_by_label: 'Researcher One',
      verified_at: signedAt,
      notes: 'Initial source walk complete.',
    };
    await db.collection('va_requirements').insertOne(degree);
    const edited = structuredClone(degree);
    edited.verification.notes = 'Source walk complete; clarified the overlap note.';

    const response = await run(putDegree, request({}, {
      params: { id: edited._id },
      body: edited,
      user: { uid: 'researcher-2', name: 'Researcher Two' },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.verification_reopened).toBe(false);
    const stored = await db.collection('va_requirements').findOne({ _id: edited._id });
    expect(stored.verification).toMatchObject({
      verified: true,
      verified_by: 'researcher-1',
      verified_by_label: 'Researcher One',
      notes: 'Source walk complete; clarified the overlap note.',
      stale: false,
    });
    expect(new Date(stored.verification.verified_at).toISOString()).toBe(signedAt.toISOString());
  });
});

describe('Virginia verification coverage', () => {
  const coverageRow = (id, institution, level, rest = {}) => ({
    _id: id, institution, level, ...rest,
  });
  const asDocument = (slug, suffix, rest = {}) => ({
    _id: `va:as:${slug}:cs:${suffix}`, kind: 'as_degree', college_id: `va:cc:${slug}`,
    status: 'extracted', source: 'institution_catalog', requirement_groups: [], ...rest,
  });
  const bsDocument = (slug, rest = {}) => ({
    _id: `va:degree:${slug}:cs`, kind: 'degree', school_id: `va:uni:${slug}`,
    status: 'extracted', source: 'institution_catalog', requirement_groups: [], ...rest,
  });

  it('counts every live document as verifiable, whatever the parser made of it', async () => {
    await db.collection('va_coverage').insertMany([
      coverageRow('va:cov:cc:sample-community-college', 'Sample Community College', 'community_college'),
      coverageRow('va:cov:cc:second-community-college', 'Second Community College', 'community_college'),
      coverageRow('va:cov:uni:george-mason-university', 'George Mason University', 'four_year'),
    ]);
    await db.collection('va_requirements').insertMany([
      // The shape that could not be signed before: `acceptance` was never
      // computed for it at all, so the gate read it as a failure.
      asDocument('sample-community-college', 'A', {
        source: 'transferva_program_map', primary: true,
        verification: { verified: true, verified_by_label: 'Roy Martinez' },
      }),
      asDocument('second-community-college', 'B', {
        collection_status: 'major_only',
        acceptance: { accepted: false, ready_for_analysis: false, catalog: { failed: ['as_units'] } },
        verification: { verified: false },
      }),
      bsDocument('george-mason-university', {
        collection_status: 'catalog_accepted',
        acceptance: { accepted: true, ready_for_analysis: false },
        verification: { verified: false, notes: 'https://catalog.gmu.edu/mason-core/' },
      }),
    ]);

    const response = await run(coverage, request());

    expect(response.body.verification).toMatchObject({
      documents: 3, live: 3, reviewable: 3, verifiable: 3, verified: 1,
      as_live: 2, as_verifiable: 2, as_verified: 1,
      // The B.S. document carries only a source link, which is not a sign-off.
      bs_live: 1, bs_verifiable: 1, bs_verified: 0,
    });
    const college = response.body.coverage.find((row) => row.institution === 'Sample Community College');
    const unaccepted = college.documents.as_degree.find((d) => d.doc_id.endsWith(':A'));
    // Acceptance survives as context on the document, and only as context.
    expect(unaccepted).toMatchObject({ live: true, verified: true, catalog_accepted: false });
    const second = response.body.coverage.find((row) => row.institution === 'Second Community College');
    expect(second.documents.as_degree.find((d) => d.doc_id.endsWith(':B'))).toMatchObject({
      live: true, verified: false, catalog_accepted: false, collection_status: 'major_only',
    });
  });

  // Virginia's `verification.notes` is a single free-text box that was used as a
  // working scratchpad during collection — most of the live documents carrying
  // one hold the source URLs they were built from, and one reads "lots of
  // missing classes". Counting those as verified would report a job nobody did,
  // so only the signed verdict counts here. California differs because there a
  // note is created BY the act of verifying.
  it('does not treat a collection note as a verification verdict', async () => {
    const sourceUrl = 'https://catalog.example.edu/mason-core/';
    await db.collection('va_coverage').insertMany([
      coverageRow('va:cov:cc:sample-community-college', 'Sample Community College', 'community_college'),
      coverageRow('va:cov:cc:second-community-college', 'Second Community College', 'community_college'),
    ]);
    await db.collection('va_requirements').insertMany([
      asDocument('sample-community-college', 'NOTED', { verification: { verified: false, notes: sourceUrl } }),
      asDocument('second-community-college', 'SIGNED', { verification: { verified: true } }),
    ]);

    const response = await run(coverage, request());

    expect(response.body.verification).toMatchObject({ live: 2, verified: 1 });
    const college = response.body.coverage.find((row) => row.institution === 'Sample Community College');
    expect(college.documents.as_degree.find((d) => d.doc_id.endsWith(':NOTED'))).toMatchObject({
      verified: false, has_notes: true,
    });
    const second = response.body.coverage.find((row) => row.institution === 'Second Community College');
    expect(second.documents.as_degree.find((d) => d.doc_id.endsWith(':SIGNED'))).toMatchObject({
      verified: true,
    });
    // Reading coverage never touches the text a person wrote.
    const stored = await db.collection('va_requirements')
      .findOne({ _id: 'va:as:sample-community-college:cs:NOTED' });
    expect(stored.verification.notes).toBe(sourceUrl);
  });

  it('reports live work, verified work and uncollected institutions per level', async () => {
    await db.collection('va_coverage').insertMany([
      coverageRow('va:cov:cc:sample-community-college', 'Sample Community College', 'community_college', { outcome: 'captured' }),
      coverageRow('va:cov:cc:empty-community-college', 'Empty Community College', 'community_college'),
      coverageRow('va:cov:uni:george-mason-university', 'George Mason University', 'four_year', { outcome: 'captured' }),
      coverageRow('va:cov:uni:randolph-macon-college', 'Randolph-Macon College', 'four_year', { outcome: 'captured' }),
    ]);
    await db.collection('va_requirements').insertMany([
      asDocument('sample-community-college', 'A', { verification: { verified: true } }),
      bsDocument('george-mason-university', { verification: { verified: false, notes: 'Walked the Mason Core pages.' } }),
      bsDocument('randolph-macon-college', { verification: { verified: true } }),
    ]);

    const response = await run(coverage, request());
    const { levels, outside_primary_cohort: outside } = response.body.verification;

    expect(levels.community_college).toMatchObject({
      cohort: 'virginia_two_year',
      institutions: 2, not_collected: 1, live: 1, verified: 1,
    });
    // The four-year block is the SCHEV public cohort, which the coverage rows
    // fill out to 15 whether or not anything has been collected for them yet.
    expect(levels.four_year).toMatchObject({
      cohort: 'schev_public_four_year',
      // One live document carrying a working note but no signed verdict: it is
      // live, it is not verified, and the note is reported separately so the
      // page can distinguish "somebody wrote something" from "somebody signed".
      institutions: 15, not_collected: 14, live: 1, verified: 0,
      verdict_signed: 0, noted: 1,
    });
    // Randolph-Macon is a private partner: outside the bar, never uncounted.
    expect(outside).toMatchObject({ institutions: 1, live: 1, verified: 1 });
    expect(levels.community_college.live + levels.four_year.live + outside.live)
      .toBe(response.body.verification.live);
    expect(levels.community_college.verified + levels.four_year.verified + outside.verified)
      .toBe(response.body.verification.verified);
  });

  it('does not mark a degree verified in the rails on the strength of a source link', async () => {
    await db.collection('va_institutions').insertOne({
      _id: 'va:inst:george-mason-university', name: 'George Mason University',
      level: 'four_year', course_count: 0, receives_count: 0,
    });
    await db.collection('va_requirements').insertOne(bsDocument('george-mason-university', {
      codes_seen: ['CS112'], total_units: 120,
      collection_status: 'major_only', acceptance: { accepted: false, ready_for_analysis: false },
      verification: { verified: false, notes: 'https://catalog.gmu.edu/mason-core/' },
    }));

    const response = await run(institutions, request({ level: 'four_year' }));

    // The note here is the catalog URL the document was built from, not a
    // sign-off, so the rail must still show the degree as unverified.
    expect(response.body.institutions.find((row) => row.name === 'George Mason University'))
      .toMatchObject({ degree_status: 'full', degree_verified: false });
  });
});
