import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const {
  UnknownVirginiaInstitutionError,
  graphKey,
  normalizeRequisiteFormulas,
  virginiaPrerequisiteGraphData,
} = cjs('./prereqGraph');

let mongo;
let db;

const ALPHA = 'Alpha Community College';
const BETA = 'Beta Community College';
const RICHARD_BLAND = 'Richard Bland College';
const UNIVERSITY = 'Example State University';
const EMPTY_UNIVERSITY = 'University With No Equivalencies';

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('va_prereq_graph_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const concept = (slug, requires = []) => ({
  _id: `prereq_concept:${slug}`, kind: 'prereq_concept', slug,
  name: slug, discipline: slug.startsWith('cs_') ? 'cs' : 'math', requires,
});

const landing = (code) => ({
  institution: UNIVERSITY, identifier: `U ${code}`, name: `${code} transfer credit`, notes: null,
});

const course = (code, offeredBy, { accepted = false, extra = {} } = {}) => ({
  _id: `va:crs:${code}`,
  course_id: 900_000_000 + code.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0),
  code,
  title: `${code} title`,
  credits: 3,
  department: code.match(/^[A-Z]+/)?.[0],
  offered_by: offeredBy,
  articulates_to: accepted ? [landing(code)] : [],
  ...extra,
});

async function seed() {
  const courses = [
    course('CSC221', [ALPHA, BETA]),
    course('CSC222', [ALPHA]),
    course('CSC223', [ALPHA, BETA], { accepted: true }),
    course('CSC208', [BETA]),
    course('MTH161', [ALPHA]),
    course('MTH162', [ALPHA]),
    course('MTH167', [BETA]),
    course('MTH263', [ALPHA, BETA], { accepted: true }),
    course('MTH264', [ALPHA]),
    course('MTH265', [BETA]),
    course('MTH266', [ALPHA], { accepted: true }),
    course('ART100', ['Private Four-Year College'], { accepted: true }),
    course('RBCS101', [RICHARD_BLAND], { accepted: true }),
  ];
  await db.collection('va_courses').insertMany(courses);
  await db.collection('va_institutions').insertMany([
    { _id: 'va:inst:alpha-community-college', name: ALPHA, level: 'community_college' },
    { _id: 'va:inst:beta-community-college', name: BETA, level: 'community_college' },
    { _id: 'va:inst:richard-bland-college', name: RICHARD_BLAND, level: 'community_college' },
    { _id: 'va:inst:example-state-university', name: UNIVERSITY, level: 'four_year' },
    { _id: 'va:inst:university-with-no-equivalencies', name: EMPTY_UNIVERSITY, level: 'four_year' },
    { _id: 'va:inst:private-four-year-college', name: 'Private Four-Year College', level: 'four_year' },
  ]);
  await db.collection('curated_requirements').insertMany([
    concept('cs_1'),
    concept('cs_2', ['cs_1']),
    concept('cs_3', ['cs_2']),
    concept('discrete'),
    concept('precalc_1'),
    concept('precalc_2', ['precalc_1']),
    concept('precalc_combined'),
    concept('calc_1', [['precalc_2', 'precalc_combined']]),
    concept('calc_2', ['calc_1']),
    concept('linear_alg', ['calc_2']),
  ]);

  const mappingConcept = {
    CSC221: 'cs_1', CSC222: 'cs_2', CSC223: 'cs_3', CSC208: 'discrete',
    MTH161: 'precalc_1', MTH162: 'precalc_2', MTH167: 'precalc_combined',
    MTH263: 'calc_1', MTH264: 'calc_2', MTH265: 'calc_2', MTH266: 'linear_alg',
    ART100: null, RBCS101: 'cs_1',
  };
  await db.collection('va_course_concepts').insertMany(Object.entries(mappingConcept).map(([code, mappedConcept]) => ({
    _id: `va:concept:${code}`,
    // Mix both source identities to enforce va:CODE response normalization.
    course_key: code === 'CSC221' ? `va:crs:${code}` : `va:${code}`,
    code,
    concept: mappedConcept,
    concept_source: 'va_cs_sweep_v1',
    concept_confidence: 0.9,
    supply_kind: code === 'RBCS101' ? 'richard_bland_scope' : 'vccs_requirement_scope',
    flags: code === 'RBCS101'
      ? ['richard_bland_scope', 'institution_local', 'non_vccs'] : [],
  })));

  await db.collection('va_course_requisites').insertMany([
    {
      _id: 'va:req:CSC223', course_key: 'va:crs:CSC223', code: 'CSC223', status: 'published',
      source_url: 'https://courses.vccs.edu/courses/CSC223',
      groups: [
        { kind: 'prerequisite', any_of: [{ course_key: 'va:CSC222', code: 'CSC222' }], raw: 'Prerequisite: CSC 222.' },
        { kind: 'corequisite', any_of: [{ course_key: 'va:CSC208', code: 'CSC208' }], raw: 'Corequisite: CSC 208.' },
      ],
    },
    {
      _id: 'va:req:CSC222', course_key: 'va:CSC222', code: 'CSC222', status: 'published',
      groups: [{ kind: 'prerequisite', any_of: [{ code: 'CSC221' }] }],
    },
    {
      _id: 'va:req:MTH263', course_key: 'va:MTH263', code: 'MTH263', status: 'published',
      groups: [{
        kind: 'prerequisite',
        raw: 'MTH 167 or both MTH 161 and MTH 162.',
        any_of: [{ code: 'MTH167' }, { code: 'MTH161' }, { code: 'MTH162' }],
        paths: [
          { all_of: [{ code: 'MTH167' }] },
          { all_of: [{ code: 'MTH161' }, { code: 'MTH162' }] },
        ],
      }],
    },
    {
      _id: 'va:req:MTH266', course_key: 'va:MTH266', code: 'MTH266', status: 'published',
      groups: [{
        kind: 'prerequisite',
        paths: [
          { all_of: [{ code: 'MTH265', minimum_grade: 'B' }] },
          { all_of: [{ code: 'MTH264', minimum_grade: 'C' }] },
        ],
      }],
    },
  ]);

  await db.collection('va_requirements').insertMany([
    {
      _id: 'va:as:alpha-community-college:cs', kind: 'as_degree', major_slug: 'cs',
      college_id: 'va:cc:alpha-community-college', status: 'extracted',
      codes_seen: ['CSC223', 'MTH263', 'MTH266'], requirement_groups: [],
    },
    {
      _id: 'va:as:beta-community-college:cs', kind: 'as_degree', major_slug: 'cs',
      college_id: 'va:cc:beta-community-college', status: 'url_only',
      codes_seen: [], requirement_groups: [],
    },
  ]);

  // A California row with the same subject must never leak into the endpoint.
  await db.collection('assist_courses').insertOne({
    _id: 'cc:1', side: 'sending', course_id: 1, institution_id: 'cc:1',
    prefix: 'CSC', number: '223', concept: 'bogus', concept_source: 'test',
  });
}

describe('Virginia prerequisite formula normalization', () => {
  it('normalizes both va:crs and va course identities to va:CODE', () => {
    expect(graphKey('va:crs:CSC223')).toBe('va:CSC223');
    expect(graphKey('va:CSC 223')).toBe('va:CSC223');
  });

  it('preserves OR paths, AND conditions, and per-condition grades', () => {
    const [formula] = normalizeRequisiteFormulas({
      course_key: 'va:crs:MTH263',
      groups: [{
        kind: 'prerequisite',
        paths: [
          { all_of: [{ code: 'MTH167', minimum_grade: 'B' }] },
          { all_of: [{ code: 'MTH161' }, { code: 'MTH162', minimum_grade: 'C' }] },
        ],
      }],
    });
    expect(formula.paths).toHaveLength(2);
    expect(formula.paths[1].all_of.map((condition) => condition.course_key))
      .toEqual(['va:MTH161', 'va:MTH162']);
    expect(formula.paths[0].all_of[0].minimum_grade).toBe('B');
    expect(formula.paths[1].all_of[1].minimum_grade).toBe('C');
  });

  it('retains non-course conditions without inventing a course identity', () => {
    const [formula] = normalizeRequisiteFormulas({
      course_key: 'va:CSC223',
      groups: [{
        kind: 'prerequisite',
        paths: [{ all_of: [
          { code: 'CSC222' },
          { type: 'non_course', text: 'Instructor consent', raw: 'consent of instructor' },
        ] }],
      }],
    });
    expect(formula.paths[0].all_of).toEqual([
      expect.objectContaining({ type: 'course', course_key: 'va:CSC222' }),
      expect.objectContaining({ type: 'non_course', text: 'Instructor consent' }),
    ]);
    expect(formula.paths[0].all_of[1]).not.toHaveProperty('course_key');
  });

  it('round-trips every source group and condition in the generated Virginia artifact', () => {
    const artifact = JSON.parse(readFileSync(
      new URL('../../../scripts/data/va_course_requisites.json', import.meta.url),
      'utf8',
    ));
    let sourceConditions = 0;
    let normalizedConditions = 0;
    let nonCourseConditions = 0;
    for (const row of artifact.rows) {
      const formulas = normalizeRequisiteFormulas(row);
      expect(formulas).toHaveLength(row.groups.length);
      sourceConditions += row.groups.flatMap((group) => group.paths || [])
        .reduce((sum, path) => sum + (path.all_of || []).length, 0);
      normalizedConditions += formulas.flatMap((formula) => formula.paths)
        .reduce((sum, path) => sum + path.all_of.length, 0);
      nonCourseConditions += formulas.flatMap((formula) => formula.paths)
        .flatMap((path) => path.all_of).filter((condition) => condition.type === 'non_course').length;
    }
    expect(normalizedConditions).toBe(sourceConditions);
    expect(nonCourseConditions).toBeGreaterThan(0);

    const mth263 = artifact.rows.find((row) => row.code === 'MTH263');
    const [formula] = normalizeRequisiteFormulas(mth263);
    expect(formula.paths.map((path) => path.all_of.map((condition) => condition.course_key)))
      .toEqual([['va:MTH167'], ['va:MTH161', 'va:MTH162']]);
  });
});

describe('virginiaPrerequisiteGraphData', () => {
  beforeEach(seed);

  it('keeps the statewide graph Virginia-only and excludes no-CC artifacts', async () => {
    const data = await virginiaPrerequisiteGraphData(db);
    expect(data.projection.mode).toBe('canonical');
    expect(data.courses.some((row) => row.key === 'va:ART100')).toBe(false);
    expect(data.courses.some((row) => row.key === 'va:RBCS101')).toBe(true);
    expect(data.stats.excluded_no_cc_artifacts).toBe(1);
    expect(data.stats.institution_local).toBe(1);
    expect(data.stats.richard_bland_only).toBe(1);
    expect(data.coverage_warnings.map((warning) => warning.code))
      .toEqual(expect.arrayContaining(['excluded_no_cc_supply', 'institution_local_courses']));
    expect(data.courses.some((row) => row.key === 'cc:1')).toBe(false);
    expect(data.sources.courses.collection).toBe('va_courses');
  });

  it('uses all offered CS-corpus courses, annotates degree coverage, and exposes gaps', async () => {
    const data = await virginiaPrerequisiteGraphData(db, { college: 'va:cc:alpha-community-college' });
    expect(data.projection.mode).toBe('community_college');
    expect(data.scope.course_scope_source).toBe('va_courses.offered_by');
    expect(data.scope.requirement_annotation_source).toBe('va_requirements');
    expect(data.courses.filter((row) => row.in_scope).map((row) => row.key).sort())
      .toEqual([
        'va:CSC221', 'va:CSC222', 'va:CSC223',
        'va:MTH161', 'va:MTH162', 'va:MTH263', 'va:MTH264', 'va:MTH266',
      ]);
    expect(data.courses.filter((row) => row.role === 'prerequisite_only').map((row) => row.key).sort())
      .toEqual([]);
    expect(data.missing.map((row) => row.key).sort())
      .toEqual(['va:CSC208', 'va:MTH167', 'va:MTH265']);
    expect(data.gaps).toHaveLength(1);
    expect(data.gaps[0]).toMatchObject({
      dependent_course_key: 'va:CSC223', kind: 'corequisite',
      status: 'missing_course_supply', missing_course_keys: ['va:CSC208'],
    });
    expect(data.stats).toMatchObject({
      in_scope: 8, examined: 8, mapped: 8, prerequisite_only: 0,
      missing_prerequisites: 3, gaps: 1,
    });
  });

  it('returns lossless published rules and marks flat edges as visual projections', async () => {
    const data = await virginiaPrerequisiteGraphData(db, { college: ALPHA });
    const calcRule = data.rules.find((rule) => rule.course_key === 'va:MTH263');
    expect(calcRule.paths).toHaveLength(2);
    expect(calcRule.paths[1].all_of.map((condition) => condition.course_key))
      .toEqual(['va:MTH161', 'va:MTH162']);
    expect(calcRule.paths[0].available).toBe(false);
    expect(calcRule.paths[1].available).toBe(true);

    const calcEdges = data.edges.filter((edge) => edge.to === 'va:MTH263');
    expect(calcEdges).toHaveLength(3);
    expect(calcEdges.every((edge) => edge.formula_semantics.includes('visual_projection'))).toBe(true);
    expect(new Set(calcEdges.map((edge) => edge.path_id)).size).toBe(2);

    const gradeBySource = new Map(data.edges.filter((edge) => edge.to === 'va:MTH266')
      .map((edge) => [edge.from, edge.minimum_grade]));
    expect(gradeBySource).toEqual(new Map([['va:MTH265', 'B'], ['va:MTH264', 'C']]));
    expect(data.edges).toContainEqual(expect.objectContaining({
      from: 'va:CSC208', to: 'va:CSC223', kind: 'corequisite', available: false,
      missing: true, source_status: 'published', provisional: false,
    }));
    expect(data.concept_rules).toContainEqual(expect.objectContaining({ from: 'cs_2', to: 'cs_3' }));
  });

  it('applies an audited college-local rule only to that college projection', async () => {
    await db.collection('va_courses').updateOne({ code: 'CSC222' }, {
      $addToSet: { offered_by: BETA },
    });
    await db.collection('va_course_requisites').updateOne({ code: 'CSC222' }, {
      $set: {
        local_override_audit: {
          differences: [{
            college_name: ALPHA,
            source_url: 'https://courses.vccs.edu/colleges/alpha/courses/CSC222',
            local_status: 'parsed',
            local_raw: 'Prerequisite: MTH 161',
            local_groups: [{
              kind: 'prerequisite',
              paths: [{ all_of: [{ code: 'MTH161' }] }],
            }],
          }],
        },
      },
    });

    const statewide = await virginiaPrerequisiteGraphData(db);
    expect(statewide.edges).toContainEqual(expect.objectContaining({
      from: 'va:CSC221', to: 'va:CSC222',
    }));
    expect(statewide.edges.some((edge) => edge.from === 'va:MTH161' && edge.to === 'va:CSC222'))
      .toBe(false);

    const alpha = await virginiaPrerequisiteGraphData(db, { college: ALPHA });
    expect(alpha.edges).toContainEqual(expect.objectContaining({
      from: 'va:MTH161', to: 'va:CSC222', flags: expect.arrayContaining(['local_override_applied']),
    }));
    expect(alpha.edges.some((edge) => edge.from === 'va:CSC221' && edge.to === 'va:CSC222'))
      .toBe(false);

    const beta = await virginiaPrerequisiteGraphData(db, { college: BETA });
    expect(beta.edges).toContainEqual(expect.objectContaining({
      from: 'va:CSC221', to: 'va:CSC222',
    }));
  });

  it('keeps non-course conditions lossless without hiding missing course supply', async () => {
    await db.collection('va_courses').insertMany([
      course('CSC296', [ALPHA]),
      course('CSC298', [ALPHA]),
      course('CSC299', [ALPHA]),
    ]);
    await db.collection('va_course_concepts').insertMany([
      { course_key: 'va:CSC296', code: 'CSC296', concept: 'cs_3', examined: true, source: 'va_cs_sweep_v1' },
      { course_key: 'va:CSC298', code: 'CSC298', concept: 'cs_3', examined: true, source: 'va_cs_sweep_v1' },
      { course_key: 'va:CSC299', code: 'CSC299', concept: 'cs_3', examined: true, source: 'va_cs_sweep_v1' },
    ]);
    await db.collection('va_course_requisites').insertMany([
      {
        course_key: 'va:CSC296', status: 'published', groups: [{
          kind: 'prerequisite', paths: [{ all_of: [
            { code: 'CSC221' },
            { type: 'non_course', text: 'Department approval' },
          ] }],
        }],
      },
      {
        course_key: 'va:CSC298', status: 'published', groups: [{
          kind: 'prerequisite', paths: [{ all_of: [
            { type: 'non_course', text: 'Placement test' },
          ] }],
        }],
      },
      {
        course_key: 'va:CSC299', status: 'published', groups: [{
          kind: 'prerequisite', paths: [{ all_of: [
            { code: 'CSC297' },
            { type: 'non_course', text: 'Instructor consent' },
          ] }],
        }],
      },
    ]);

    const data = await virginiaPrerequisiteGraphData(db, { college: ALPHA });
    const externalOnly = data.rules.find((rule) => rule.course_key === 'va:CSC298');
    expect(externalOnly.paths[0].all_of[0]).toMatchObject({
      type: 'non_course', text: 'Placement test', external: true,
    });
    expect(data.edges.some((edge) => edge.to === 'va:CSC298')).toBe(false);
    expect(data.gaps.some((gap) => gap.dependent_course_key === 'va:CSC298')).toBe(false);

    const mixedAvailable = data.rules.find((rule) => rule.course_key === 'va:CSC296');
    expect(mixedAvailable).toMatchObject({
      course_supply_satisfiable: true,
      satisfiable_in_projection: null,
    });
    expect(data.gaps.some((gap) => gap.dependent_course_key === 'va:CSC296')).toBe(false);

    const mixed = data.rules.find((rule) => rule.course_key === 'va:CSC299');
    expect(mixed.course_supply_satisfiable).toBe(false);
    expect(mixed.satisfiable_in_projection).toBe(false);
    expect(data.edges).toContainEqual(expect.objectContaining({
      from: 'va:CSC297', to: 'va:CSC299', missing: true,
    }));
    expect(data.gaps).toContainEqual(expect.objectContaining({
      dependent_course_key: 'va:CSC299', missing_course_keys: ['va:CSC297'],
    }));
  });

  it('keeps an unsafe raw rule for verification but emits no authoritative edge', async () => {
    await db.collection('va_courses').insertOne(course('CSC297', [ALPHA]));
    await db.collection('va_course_concepts').insertOne({
      course_key: 'va:CSC297', code: 'CSC297', concept: 'cs_3', examined: true, source: 'va_cs_sweep_v1',
    });
    await db.collection('va_course_requisites').insertOne({
      course_key: 'va:CSC297', code: 'CSC297', status: 'unparsed',
      raw_requisites: 'Prerequisite prose the parser could not safely model.',
      source_url: 'https://courses.vccs.edu/courses/CSC297',
      flags: ['unsafe_parse'],
      groups: [],
    });

    const data = await virginiaPrerequisiteGraphData(db, { college: ALPHA });
    expect(data.rules.find((rule) => rule.course_key === 'va:CSC297')).toMatchObject({
      raw: 'Prerequisite prose the parser could not safely model.',
      source_status: 'unparsed', provisional: true,
    });
    expect(data.edges.some((edge) => edge.to === 'va:CSC297')).toBe(false);
    expect(data.courses.find((row) => row.key === 'va:CSC297')).toMatchObject({
      requisite_status: 'unparsed', requisite_flags: ['unsafe_parse'],
    });
  });

  it('uses requisite artifact metadata for a real closure node absent from va_courses', async () => {
    await db.collection('va_courses').insertOne(course('CSC300', [ALPHA]));
    await db.collection('va_course_concepts').insertMany([
      { course_key: 'va:CSC300', code: 'CSC300', concept: 'cs_3', examined: true, source: 'va_cs_sweep_v1' },
      { course_key: 'va:CSC299', code: 'CSC299', concept: 'cs_2', examined: true, source: 'va_cs_sweep_v1' },
    ]);
    await db.collection('va_course_requisites').insertMany([
      {
        course_key: 'va:CSC300', status: 'published',
        groups: [{ kind: 'prerequisite', any_of: [{ code: 'CSC299' }] }],
      },
      {
        course_key: 'va:CSC299', code: 'CSC299', title: 'Synthetic prerequisite', credits: 4,
        vccs_colleges: [ALPHA], status: 'none', groups: [],
      },
    ]);

    const data = await virginiaPrerequisiteGraphData(db, { college: ALPHA });
    expect(data.courses.find((row) => row.key === 'va:CSC299')).toMatchObject({
      title: 'Synthetic prerequisite', units: 4, role: 'prerequisite_only',
      available: true, missing: false, source: 'va_course_requisites',
    });
    expect(data.missing.some((row) => row.key === 'va:CSC299')).toBe(false);
    expect(data.edges).toContainEqual(expect.objectContaining({
      from: 'va:CSC299', to: 'va:CSC300', missing: false,
    }));
  });

  it('labels a university view as transfer preparation and excludes accepted records with no CC supply', async () => {
    const data = await virginiaPrerequisiteGraphData(db, { university: 'va:inst:example-state-university' });
    expect(data.projection.mode).toBe('transfer_preparation');
    expect(data.projection.disclaimer).toMatch(/not university.local prerequisites/i);
    expect(data.courses.some((row) => row.key === 'va:ART100')).toBe(false);
    expect(data.courses.some((row) => row.key === 'va:RBCS101')).toBe(false);
    const csc = data.courses.find((row) => row.key === 'va:CSC223');
    expect(csc.lands_as).toMatchObject({ institution: UNIVERSITY, identifier: 'U CSC223' });
    expect(data.sources.university_projection).toMatch(/not university-local/i);
    expect(data.stats.missing_prerequisites).toBe(0);
    expect(data.stats.excluded_no_cc_artifacts).toBe(1);
    expect(data.stats.excluded_non_vccs_transfer_rows).toBe(1);
    expect(data.coverage_warnings).toContainEqual(expect.objectContaining({
      code: 'excluded_non_vccs_transfer_rows', count: 1,
    }));
  });

  it('uses the requirement-derived direct scope and rejects same-code four-year collisions', async () => {
    await db.collection('va_courses').insertOne(course('CSC201', ['Private Four-Year College'], {
      accepted: true,
      extra: { title: 'Unrelated four-year cybersecurity course' },
    }));
    await db.collection('va_course_concepts').insertMany([
      {
        course_key: 'va:CSC201', code: 'CSC201', title_seen: 'Legacy VCCS Computer Science I',
        concept: 'cs_1', concept_source: 'degree_scope:legacy_exact', concept_confidence: 0.7,
        scope_role: 'major_preparation', scope_colleges: [ALPHA], flags: ['needs_review'],
      },
      {
        course_key: 'va:MTH173', code: 'MTH173', title_seen: null,
        concept: null, concept_source: 'degree_scope:examined_null', concept_confidence: 1,
        scope_role: 'major_preparation', scope_colleges: [ALPHA], flags: ['legacy_or_unresolved'],
      },
    ]);
    await db.collection('va_course_requisites').insertMany([
      {
        course_key: 'va:CSC201', code: 'CSC201', title: 'Legacy VCCS Computer Science I',
        status: 'missing', groups: [], scope_role: 'major_preparation', scope_colleges: [ALPHA],
        flags: ['legacy_or_unresolved', 'no_master_course'],
      },
      {
        course_key: 'va:MTH173', code: 'MTH173', title: null,
        status: 'missing', groups: [], scope_role: 'major_preparation', scope_colleges: [ALPHA],
        flags: ['legacy_or_unresolved', 'no_master_course'],
      },
    ]);

    const statewide = await virginiaPrerequisiteGraphData(db);
    expect(statewide.scope.course_scope_source).toBe('va_prerequisite_scope_artifacts');
    expect(statewide.courses.filter((row) => row.in_scope).map((row) => row.key).sort())
      .toEqual(['va:CSC201', 'va:MTH173']);
    expect(statewide.courses.find((row) => row.key === 'va:CSC201')).toMatchObject({
      title: 'Legacy VCCS Computer Science I',
      offered_by: [ALPHA],
      lands_as: null,
      source: 'va_course_requisites',
    });
    expect(statewide.courses.find((row) => row.key === 'va:CSC201').flags)
      .toContain('legacy_or_unresolved');

    const receiving = await virginiaPrerequisiteGraphData(db, { university: UNIVERSITY });
    expect(receiving.stats.in_scope).toBe(0);
    expect(receiving.courses).toEqual([]);
  });

  it('rejects same-code records supplied by a different community college', async () => {
    await db.collection('va_courses').insertOne(course('ART231', [BETA], {
      accepted: true,
      extra: { title: 'Different-college ART231 rendering' },
    }));
    await db.collection('va_course_concepts').insertOne({
      course_key: 'va:ART231', code: 'ART231', title_seen: 'Richard Bland ART231',
      concept: null, concept_source: 'degree_scope:examined_null', concept_confidence: 1,
      scope_role: 'major_preparation', scope_colleges: [RICHARD_BLAND],
      supply_kind: 'richard_bland_scope',
      flags: ['richard_bland_scope', 'institution_local', 'transfer_record_scope_collision'],
    });
    await db.collection('va_course_requisites').insertOne({
      course_key: 'va:ART231', code: 'ART231', title: 'Richard Bland ART231',
      status: 'missing', groups: [], scope_role: 'major_preparation',
      scope_colleges: [RICHARD_BLAND], supply_kind: 'richard_bland_scope',
      flags: ['richard_bland_scope', 'institution_local', 'transfer_record_scope_collision'],
    });

    const richardBland = await virginiaPrerequisiteGraphData(db, { college: RICHARD_BLAND });
    expect(richardBland.projection).toMatchObject({
      mode: 'community_college',
      label: expect.stringMatching(/course mapping review/i),
      disclaimer: expect.stringMatching(/no published institution-local prerequisite policy/i),
    });
    expect(richardBland.projection.disclaimer).not.toMatch(/published VCCS prerequisites projected/i);
    expect(richardBland.courses.filter((row) => row.in_scope)).toEqual([
      expect.objectContaining({
        key: 'va:ART231', title: 'Richard Bland ART231', offered_by: [RICHARD_BLAND],
        source: 'va_course_requisites',
      }),
    ]);

    const wrongCollege = await virginiaPrerequisiteGraphData(db, { college: BETA });
    expect(wrongCollege.stats.in_scope).toBe(0);
    const receiving = await virginiaPrerequisiteGraphData(db, { university: UNIVERSITY });
    expect(receiving.stats.in_scope).toBe(0);
  });

  it('retains requirement-derived colleges when Transfer Virginia supply only partially overlaps', async () => {
    await db.collection('va_courses').insertOne(course('CSC299', [ALPHA]));
    await db.collection('va_course_concepts').insertOne({
      course_key: 'va:CSC299', code: 'CSC299', title_seen: 'Scoped elective',
      concept: null, concept_source: 'vccs_master:examined_null', concept_confidence: 1,
      scope_role: 'major_preparation', scope_colleges: [ALPHA, BETA],
      supply_kind: 'vccs_requirement_scope', flags: [],
    });
    await db.collection('va_course_requisites').insertOne({
      course_key: 'va:CSC299', code: 'CSC299', title: 'Scoped elective',
      status: 'none', groups: [], scope_role: 'major_preparation',
      scope_colleges: [ALPHA, BETA], vccs_colleges: [ALPHA, BETA],
      supply_kind: 'vccs_requirement_scope', flags: [],
    });

    const beta = await virginiaPrerequisiteGraphData(db, { college: BETA });
    expect(beta.courses.filter((row) => row.in_scope)).toEqual([
      expect.objectContaining({
        key: 'va:CSC299',
        offered_by: expect.arrayContaining([ALPHA, BETA]),
        flags: expect.arrayContaining(['requirement_scope_supply_unconfirmed']),
      }),
    ]);
    expect(beta.stats.requirement_scope_supply_unconfirmed).toBe(1);
    expect(beta.scope).toMatchObject({ incomplete: true, coverage: 'incomplete' });
    expect(beta.coverage_warnings).toContainEqual(expect.objectContaining({
      code: 'requirement_scope_supply_unconfirmed', count: 1,
    }));

    const alpha = await virginiaPrerequisiteGraphData(db, { college: ALPHA });
    expect(alpha.stats.requirement_scope_supply_unconfirmed).toBe(0);
    expect(alpha.coverage_warnings.some((row) =>
      row.code === 'requirement_scope_supply_unconfirmed')).toBe(false);

    const statewide = await virginiaPrerequisiteGraphData(db);
    expect(statewide.stats.requirement_scope_supply_unconfirmed).toBe(0);
    expect(statewide.coverage_warnings.some((row) =>
      row.code === 'requirement_scope_supply_unconfirmed')).toBe(false);
  });

  it('does not project VCCS rules or mappings onto Richard Bland local identities', async () => {
    await db.collection('va_courses').insertOne(course('MIX201', [ALPHA, RICHARD_BLAND], {
      accepted: true, extra: { title: 'Shared-code rendering' },
    }));
    await db.collection('va_course_concepts').insertOne({
      course_key: 'va:MIX201', code: 'MIX201', title_seen: 'VCCS MIX201',
      concept: 'cs_3', concept_source: 'vccs_master:statewide_exact', concept_confidence: 1,
      scope_role: 'major_preparation', scope_colleges: [ALPHA, RICHARD_BLAND],
      supply_kind: 'vccs_requirement_scope', flags: [],
      institution_overrides: [{
        institution: RICHARD_BLAND, title: 'Richard Bland local MIX201', concept: null,
      }],
    });
    await db.collection('va_course_requisites').insertOne({
      course_key: 'va:MIX201', code: 'MIX201', title: 'VCCS MIX201', status: 'parsed',
      source: 'vccs_master_course_file', scope_role: 'major_preparation',
      scope_colleges: [ALPHA, RICHARD_BLAND], supply_kind: 'vccs_requirement_scope', flags: [],
      institution_overrides: [{
        institution: RICHARD_BLAND, title: 'Richard Bland local MIX201', concept: null,
      }],
      groups: [{ kind: 'prerequisite', paths: [{ all_of: [{ code: 'CSC221' }] }] }],
    });

    const vccs = await virginiaPrerequisiteGraphData(db, { college: ALPHA });
    expect(vccs.courses.find((row) => row.key === 'va:MIX201').concept).toBe('cs_3');
    expect(vccs.edges).toContainEqual(expect.objectContaining({
      from: 'va:CSC221', to: 'va:MIX201', kind: 'prerequisite',
    }));

    const vccsPair = await virginiaPrerequisiteGraphData(db, {
      college: ALPHA, university: UNIVERSITY,
    });
    expect(vccsPair.courses.find((row) => row.key === 'va:MIX201')).toMatchObject({
      in_scope: true,
      lands_as: expect.objectContaining({ institution: UNIVERSITY }),
    });

    const richardBland = await virginiaPrerequisiteGraphData(db, { college: RICHARD_BLAND });
    expect(richardBland.edges).toEqual([]);
    expect(richardBland.rules).toEqual([]);
    expect(richardBland.courses.find((row) => row.key === 'va:MIX201')).toMatchObject({
      title: 'Richard Bland local MIX201', concept: null, requisite_status: 'not_applicable',
      scope_kind: 'institution_local', source: 'institution_local_override',
      source_label: expect.stringMatching(/institution-local course identity/i),
    });
    expect(richardBland.stats.institution_local).toBe(1);
    expect(richardBland.stats.requisite_not_applicable).toBe(1);

    const pair = await virginiaPrerequisiteGraphData(db, {
      college: RICHARD_BLAND, university: UNIVERSITY,
    });
    expect(pair.projection).toMatchObject({
      mode: 'college_to_university',
      label: expect.stringMatching(/local mapping review/i),
      disclaimer: expect.stringMatching(/no Richard Bland prerequisite policy is claimed/i),
    });
    expect(pair.stats.in_scope).toBe(0);
    expect(pair.courses).toEqual([]);
  });

  it('intersects college supply, CS scope, and university acceptance in pair mode', async () => {
    const data = await virginiaPrerequisiteGraphData(db, {
      college: ALPHA,
      university: UNIVERSITY,
    });
    expect(data.projection.mode).toBe('college_to_university');
    expect(data.courses.filter((row) => row.in_scope).map((row) => row.key).sort())
      .toEqual(['va:CSC223', 'va:MTH263', 'va:MTH266']);
    expect(data.courses.find((row) => row.key === 'va:CSC221')).toMatchObject({
      role: 'prerequisite_only', accepted_by_university: false,
    });
    expect(data.courses.some((row) => row.key === 'va:ART100')).toBe(false);
  });

  it('returns an empty 200-shaped graph for a valid selector with no results', async () => {
    const data = await virginiaPrerequisiteGraphData(db, { university: EMPTY_UNIVERSITY });
    expect(data.stats.no_result).toBe(true);
    expect(data.stats.in_scope).toBe(0);
    expect(data.courses).toEqual([]);
    expect(data.edges).toEqual([]);
    expect(data.rules).toEqual([]);
  });

  it('rejects unknown selectors instead of silently returning no data', async () => {
    await expect(virginiaPrerequisiteGraphData(db, { college: 'Imaginary Community College' }))
      .rejects.toBeInstanceOf(UnknownVirginiaInstitutionError);
    await expect(virginiaPrerequisiteGraphData(db, { university: 'va:uni:not-real' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('handles an entirely absent Virginia import without failing canonical mode', async () => {
    await db.dropDatabase();
    const data = await virginiaPrerequisiteGraphData(db);
    expect(data.courses).toEqual([]);
    expect(data.rules).toEqual([]);
    expect(data.missing).toEqual([]);
    expect(data.concepts).toEqual([]);
    expect(data.stats).toMatchObject({
      in_scope: 0, examined: 0, mapped: 0, no_result: true, corpus_available: false,
    });
    expect(data.scope).toMatchObject({ coverage: 'unavailable', corpus_imported: false });
    expect(data.coverage_warnings).toContainEqual(expect.objectContaining({
      code: 'prerequisite_corpus_not_imported',
    }));
  });

  it('rejects a mixed-generation two-collection import', async () => {
    await db.collection('va_course_concepts').updateMany({}, {
      $set: { import_generation: 'generation-a' },
    });
    await db.collection('va_course_requisites').updateMany({}, {
      $set: { import_generation: 'generation-b' },
    });
    const data = await virginiaPrerequisiteGraphData(db);
    expect(data.courses).toEqual([]);
    expect(data.concepts).toEqual([]);
    expect(data.stats).toMatchObject({
      no_result: true, corpus_available: false, corpus_status: 'generation_mismatch',
    });
    expect(data.scope).toMatchObject({
      coverage: 'unavailable', corpus_imported: false, corpus_status: 'generation_mismatch',
    });
    expect(data.coverage_warnings).toContainEqual(expect.objectContaining({
      code: 'prerequisite_corpus_not_imported',
      message: expect.stringMatching(/different import generations/i),
    }));
  });
});
