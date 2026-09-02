import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const {
  AMBIGUOUS_UNIT_POOL, assemblePathway, asDegreeCourseIds,
  buildExactVirginiaParentMap, compileValidatedVirginiaFormulaCorpora,
  pathwayComplexityData, resolveCcParents, resolveUcParents, scorePathway,
  VA_EXACT_FORMULA_ADAPTER, VA_PREREQUISITE_MODEL_BLOCKER,
  virginiaPathwaySourceGate,
} = cjs('./pathwayComplexity');
const { canonicalSourceContract } = cjs('./canonicalSourceContract');
const {
  CTZN410_SEQUENCE_EVIDENCE,
} = cjs('./longwoodConstraintProofs');
const {
  canonicalJson: canonicalVirginiaPrerequisiteJson,
  sha256: sha256VirginiaPrerequisiteValue,
} = cjs('../virginia/pathwayComplexityPrerequisites');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('pathway_complexity_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

// Real configured pair (UCSC × cs) so the config-driven scoping resolves; every
// document below is synthetic.
const SCHOOL = 132;
const PROGRAM = 'Computer Science B.S.';

async function seed() {
  await db.collection('curated_requirements').insertMany([
    {
      _id: `degree:${SCHOOL}:cs`,
      kind: 'degree',
      major_slug: 'cs',
      school_id: SCHOOL,
      school: 'UC Santa Cruz',
      unit_system: 'quarter',
      requirement_groups: [
        {
          title: 'Lower-division major requirements',
          tier: 'transferable',
          category: 'lower-division',
          sections: [{
            category: 'lower-division',
            unit_advisement: 5,
            receivers: [{ receiving: { kind: 'course', parent_id: 1 } }],
          }],
        },
        {
          title: 'Upper-division major requirements',
          tier: 'nontransferable',
          category: 'upper-division',
          sections: [
            {
              category: 'upper-division',
              unit_advisement: 5,
              receivers: [{ receiving: { kind: 'requirement', code: 'CSE 101', name: 'CSE 101' } }],
            },
            {
              category: 'upper-division',
              unit_advisement: 10,
              eligibility: { rule: 'catalogue pool', subject: 'computing', courses_required: 2 },
              receivers: [{ receiving: { kind: 'requirement', name: 'Two upper-division electives' } }],
            },
          ],
        },
      ],
    },
    {
      _id: 'as_degree:5:cs:ast',
      kind: 'as_degree',
      status: 'found',
      major_slug: 'cs',
      degree_type: 'ast',
      community_college_id: 5,
      requirement_groups: [{
        sections: [{
          section_advisement: 1,
          receivers: [{
            articulation_status: 'articulated',
            options: [{ course_ids: [501], course_conjunction: 'and' }],
          }],
        }],
      }],
    },
  ]);
  await db.collection('assist_agreements').insertOne({
    _id: 'ag1',
    uc_school_id: SCHOOL,
    community_college_id: 5,
    major: PROGRAM,
    requirement_groups: [{
      sections: [{
        receivers: [{
          receiving: { kind: 'course', parent_id: 1 },
          articulation_status: 'articulated',
          options: [{ course_ids: [501] }],
        }],
      }],
    }],
  });
  await db.collection('curated_prerequisites').insertMany([
    { _id: `uc:${SCHOOL}:CSE 12`, course_id: `uc:${SCHOOL}:CSE 12`, institution_id: `uc:${SCHOOL}`, course_code: 'CSE 12', units: 5, prerequisite_ids: [], status: 'resolved' },
    { _id: `uc:${SCHOOL}:CSE 101`, course_id: `uc:${SCHOOL}:CSE 101`, institution_id: `uc:${SCHOOL}`, course_code: 'CSE 101', units: 5, prerequisite_ids: [`uc:${SCHOOL}:CSE 12`], status: 'resolved' },
  ]);
  await db.collection('assist_courses').insertMany([
    { _id: 'r1', institution_id: `uc:${SCHOOL}`, source_id: 1, side: 'receiving', parent_id: 1, prefix: 'CSE', number: '12' },
    { _id: 's1', institution_id: 'cc:x', source_id: 501, side: 'sending', course_id: 501, units: 5 },
  ]);
  await db.collection('assist_institutions').insertOne({
    _id: 'cc:5', kind: 'community_college', source_id: 5, name: 'Test College',
  });
}

describe('pathwayComplexityData', () => {
  it('consumes covered requirements, rewires their edges to the CC courses, and scores pools as slots', async () => {
    await seed();
    const rows = await pathwayComplexityData(db, null, { majorSlug: 'cs', degreeType: 'ast' });
    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(row.college_name).toBe('Test College');
    // CSE 12 was articulated and the AS carried its sending course, so it left
    // the pathway (consumed) — the pathway is the CC course, the named upper
    // course, and the two pool slots.
    expect(row.requirements_consumed).toBe(1);
    expect(row.n_courses).toBe(4);
    expect(row.n_placeholder).toBe(2);
    // CSE 101's prerequisite pointed at CSE 12, which the CC course replaced:
    // the edge must REWIRE, not vanish.
    expect(row.n_edges).toBe(1);
    // cc:501 (delay 2 + blocking 1 = 3) + CSE 101 (delay 2 + blocking 0 = 2)
    // + two isolated slots (delay 1 + blocking 0 = 1 each) — the same
    // arithmetic used by the independently validated graph scorer.
    expect(row.complexity).toBe(7);
    // The resident pathway has the same shape (CSE 12 → CSE 101 + slots), so
    // this minimal transfer is complexity-neutral.
    expect(row.resident_complexity).toBe(7);
    expect(row.delta_vs_resident).toBe(0);
  });

  it('keeps unarticulated requirements as university vertices (the offerings gap)', async () => {
    await seed();
    // Remove the articulation: the AS still has the course, but nothing maps it.
    await db.collection('assist_agreements').updateOne({ _id: 'ag1' }, {
      $set: { 'requirement_groups.0.sections.0.receivers.0.articulation_status': 'not_articulated' },
    });
    const rows = await pathwayComplexityData(db, null, { majorSlug: 'cs', degreeType: 'ast' });
    const row = rows[0];
    expect(row.requirements_consumed).toBe(0);
    // CSE 12 stays in the pathway alongside the CC course that could not be applied.
    expect(row.n_courses).toBe(5);
    expect(row.n_edges).toBe(1); // CSE 101 -> CSE 12, unrewired
  });

  it('can restrict the live cohort to explicitly verified associate-degree sources', async () => {
    await seed();
    expect(await pathwayComplexityData(db, null, {
      majorSlug: 'cs', degreeType: 'ast', verifiedOnly: true,
    })).toEqual([]);

    await db.collection('curated_requirements').updateOne(
      { _id: 'as_degree:5:cs:ast' },
      { $set: { 'verification.verified': true } },
    );
    const rows = await pathwayComplexityData(db, null, {
      majorSlug: 'cs', degreeType: 'ast', verifiedOnly: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source_verified: true });
  });

  it('excludes no-degree sentinel records even when they carry a verified flag', async () => {
    await seed();
    const source = await db.collection('curated_requirements')
      .findOne({ _id: 'as_degree:5:cs:ast' });
    await db.collection('curated_requirements').insertOne({
      ...source,
      _id: 'as_degree:5:cs:ast:none-found',
      status: 'none_found',
      verification: { verified: true },
    });
    await db.collection('curated_requirements').updateOne(
      { _id: 'as_degree:5:cs:ast' },
      { $set: { 'verification.verified': true } },
    );

    const rows = await pathwayComplexityData(db, null, {
      majorSlug: 'cs', degreeType: 'ast', verifiedOnly: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].record_id).toBe('as_degree:5:cs:ast');
  });
});

describe('UC prerequisite choice semantics', () => {
  const inSet = new Set(['uc:a', 'uc:b', 'uc:c', 'cc:replacement']);

  it('keeps one available alternative from each required prerequisite group', () => {
    expect(resolveUcParents({
      prerequisiteGroups: [['uc:a', 'uc:b'], ['uc:c']],
      legacyIds: ['uc:a', 'uc:b', 'uc:c'],
      inSet,
      substitution: new Map(),
    })).toEqual(['uc:a', 'uc:c']);
  });

  it('uses the first in-path alternative and follows an articulated substitution', () => {
    expect(resolveUcParents({
      prerequisiteGroups: [['uc:missing', 'uc:b'], ['uc:replaced', 'uc:c']],
      legacyIds: [],
      inSet,
      substitution: new Map([['uc:replaced', ['cc:replacement']]]),
    })).toEqual(['uc:b', 'cc:replacement']);
  });

  it('preserves flat prerequisite ids for legacy rows without grouped data', () => {
    expect(resolveUcParents({
      prerequisiteGroups: undefined,
      legacyIds: ['uc:a', 'uc:b', 'uc:missing'],
      inSet,
      substitution: new Map(),
    })).toEqual(['uc:a', 'uc:b']);
  });

  it('selects only the prerequisite edge without removing independently required alternatives', () => {
    const vertices = new Map([
      ['uc:a', { kind: 'uc', catalogId: 'uc:a' }],
      ['uc:b', { kind: 'uc', catalogId: 'uc:b' }],
      ['uc:c', { kind: 'uc', catalogId: 'uc:c' }],
    ]);
    const score = scorePathway({ vertices, substitution: new Map() }, {
      ccPrereqs: new Map(),
      ucPrereqsById: new Map([['uc:c', ['uc:a', 'uc:b']]]),
      ucPrerequisiteGroupsById: new Map([['uc:c', [['uc:a', 'uc:b']]]]),
    });
    expect(score).toMatchObject({ n_courses: 3, n_edges: 1 });
  });
});

describe('community-college prerequisite choice semantics', () => {
  const inSet = new Set(['cc:intro-a', 'cc:intro-b', 'cc:math']);

  it('chooses one in-path course from each required concept group', () => {
    expect(resolveCcParents({
      prerequisiteGroups: [
        { concept: 'intro programming', anyOf: ['cc:intro-a', 'cc:intro-b'] },
        { concept: 'calculus', anyOf: ['cc:missing', 'cc:math'] },
      ],
      legacyIds: ['cc:intro-a', 'cc:intro-b', 'cc:math'],
      inSet,
    })).toEqual(['cc:intro-a', 'cc:math']);
  });

  it('preserves flat projected edges when grouped data is unavailable', () => {
    expect(resolveCcParents({
      prerequisiteGroups: undefined,
      legacyIds: ['cc:intro-a', 'cc:intro-b', 'cc:missing'],
      inSet,
    })).toEqual(['cc:intro-a', 'cc:intro-b']);
  });
});

describe('receiving-series articulation', () => {
  it('consumes one sending option once for the whole UC series and rewires every member', () => {
    const articulation = { options: [[501]], parentIds: [1, 2] };
    const pathway = assemblePathway({
      degree: {
        requirement_groups: [{
          tier: 'transferable',
          sections: [{
            category: 'lower-division',
            receivers: [
              { receiving: { kind: 'course', parent_id: 1 } },
              { receiving: { kind: 'course', parent_id: 2 } },
              { receiving: { kind: 'course', parent_id: 3 } },
            ],
          }],
        }],
      },
      asIds: [501],
      agreementByParent: new Map([[1, articulation], [2, articulation]]),
      ucCatalog: new Map([
        ['UC 1', { id: 'uc:1', units: 4 }],
        ['UC 2', { id: 'uc:2', units: 4 }],
        ['UC 3', { id: 'uc:3', units: 4 }],
      ]),
      ucCodeByParent: new Map([[1, 'UC 1'], [2, 'UC 2'], [3, 'UC 3']]),
      ccUnits: new Map([[501, 4]]),
    });

    expect([...pathway.vertices.keys()]).toEqual(['cc:501', 'uc:3']);
    expect(pathway.consumed).toBe(2);
    expect(pathway.substitution).toEqual(new Map([
      ['uc:1', ['cc:501']],
      ['uc:2', ['cc:501']],
    ]));

    const score = scorePathway(pathway, {
      ccPrereqs: new Map([['cc:501', []]]),
      ucPrereqsById: new Map([['uc:3', ['uc:2']]]),
      ucPrerequisiteGroupsById: new Map([['uc:3', [['uc:2']]]]),
    });
    expect(score).toMatchObject({ n_courses: 2, n_edges: 1, complexity: 5 });
  });
});

describe('state-scoped Figure 6 course identity', () => {
  const namedLowerDivisionDegree = (overrides = {}) => ({
    ...overrides,
    requirement_groups: [{
      tier: 'transferable',
      sections: [{
        category: 'lower-division',
        receivers: [{ receiving: { kind: 'course', code: 'CSE 101' } }],
      }],
    }],
  });
  const assembly = (degree) => assemblePathway({
    degree,
    asIds: [],
    agreementByParent: new Map(),
    ucCatalog: new Map([['CSE 101', { id: 'uc:cse101', units: 5 }]]),
    ucCodeByParent: new Map(),
    ccUnits: new Map(),
  });

  it('retains the parent implementation\'s CA placeholder when no parent-id lookup exists', () => {
    const pathway = assembly(namedLowerDivisionDegree());
    expect([...pathway.vertices.values()]).toEqual([{
      units: null,
      kind: 'slot',
      catalogId: null,
      unresolvedCourseCode: null,
    }]);
  });

  it('uses the display-code identity fallback only for a canonical Virginia source', () => {
    const pathway = assembly(namedLowerDivisionDegree({
      state: 'va',
      analysis_contract: canonicalSourceContract(),
    }));
    expect([...pathway.vertices.entries()]).toEqual([['uc:cse101', {
      units: 5,
      kind: 'uc',
      catalogId: 'uc:cse101',
      unresolvedCourseCode: null,
    }]]);
  });
});

describe('associate-degree course selection', () => {
  const receiver = (id) => ({ options: [{ course_ids: [id] }] });
  const unitPool = {
    requirement_groups: [{
      label_seen: 'Support Courses — select 6 units',
      sections: [{
        unit_advisement: 6,
        receivers: [receiver(1), receiver(2), receiver(3), receiver(4)],
      }],
    }],
  };
  const units = new Map([[1, 3], [2, 3], [3, 3], [4, 3]]);

  it('fails closed when a named choose-by-unit pool does not preserve its grouping', () => {
    expect(asDegreeCourseIds(unitPool, units)).toMatchObject({
      ids: [],
      method_status: 'excluded',
      exclusion_reason: AMBIGUOUS_UNIT_POOL,
    });
  });

  it('uses the shared exact subset selector for an explicitly requested diagnostic', () => {
    const selection = asDegreeCourseIds(unitPool, units, { strictUnitPools: false });
    expect(selection).toMatchObject({
      ids: [1, 2],
      selected_units: 6,
      method_status: 'ok',
    });
  });

  it('keeps a Foothill-shaped A.S.-T at ten courses and rejects the flattened local A.S. pools', () => {
    const ast = {
      requirement_groups: [{
        label_seen: 'Core and support courses',
        sections: [{ section_advisement: 10, receivers: Array.from({ length: 10 }, (_, i) => receiver(100 + i)) }],
      }],
    };
    const astUnits = new Map(Array.from({ length: 10 }, (_, i) => [100 + i, i < 4 ? 4.5 : 5]));
    expect(asDegreeCourseIds(ast, astUnits)).toMatchObject({
      ids: Array.from({ length: 10 }, (_, i) => 100 + i),
      method_status: 'ok',
    });

    const localAs = {
      requirement_groups: [
        { label_seen: 'Core', sections: [{ section_advisement: 5, receivers: Array.from({ length: 5 }, (_, i) => receiver(200 + i)) }] },
        { label_seen: 'Programming sequences', sections: [{ unit_advisement: 13.5, receivers: Array.from({ length: 9 }, (_, i) => receiver(300 + i)) }] },
        { label_seen: 'Support Courses', sections: [{ unit_advisement: 18, receivers: Array.from({ length: 48 }, (_, i) => receiver(400 + i)) }] },
      ],
    };
    expect(asDegreeCourseIds(localAs, new Map())).toMatchObject({
      method_status: 'excluded',
      exclusion_reason: AMBIGUOUS_UNIT_POOL,
    });
  });

  it('solves an explicit Virginia unit pool and retains a named GE menu', () => {
    const virginia = {
      state: 'va', analysis_contract: canonicalSourceContract(),
      total_units: 10, total_units_max: 10,
      requirement_groups: [
        {
          group_conjunction: 'And',
          sections: [{ section_advisement: 1, receivers: [receiver(1)] }],
        },
        {
          ge_area: 'source_named_humanities_menu',
          group_conjunction: 'And',
          sections: [{
            section_advisement: 1,
            unit_advisement: 3,
            unit_advisement_max: 3,
            receivers: [{
              options_conjunction: 'or',
              options: [{ course_ids: [2] }, { course_ids: [3] }],
            }],
          }],
        },
        { units_fill: true, sections: [] },
      ],
    };
    expect(asDegreeCourseIds(virginia, new Map([[1, 3], [2, 3], [3, 3]])))
      .toMatchObject({
        ids: [1, 2],
        selected_units: 6,
        method_status: 'ok',
      });
  });

  it('keeps exact AND-inside-OR Virginia routes indivisible', () => {
    const virginia = {
      state: 'va', analysis_contract: canonicalSourceContract(),
      total_units: 6, total_units_max: 6,
      requirement_groups: [{
        label_seen: '(CHM 111 + CHM 112) OR (PHY 241 + PHY 242)',
        group_conjunction: 'Or',
        sections: [
          { section_advisement: 1, receivers: [{ options: [{ course_ids: [10, 11] }] }] },
          { section_advisement: 1, receivers: [{ options: [{ course_ids: [20, 21] }] }] },
        ],
      }],
    };
    const unitsById = new Map([[10, 3], [11, 3], [20, 3], [21, 3]]);
    expect(asDegreeCourseIds(virginia, unitsById)).toMatchObject({
      ids: [10, 11],
      selected_units: 6,
      method_status: 'ok',
    });
  });

  it('does not invent one value for a receiver-less Virginia aggregate credit range', () => {
    const virginia = {
      state: 'va', analysis_contract: canonicalSourceContract(),
      total_units: 60, total_units_max: 62,
      requirement_groups: [{
        ge_area: 'destination_aligned_transfer_core',
        sections: [{ unit_advisement: 16, unit_advisement_max: 18, receivers: [] }],
      }],
    };
    expect(asDegreeCourseIds(virginia, new Map())).toMatchObject({
      method_status: 'excluded',
      exclusion_reason: 'associate_aggregate_requirement_ambiguous',
    });
  });
});

const vccsNone = (courseKey) => ({
  course_key: courseKey,
  owner_namespace: 'va:vccs',
  status: 'none',
  source: 'vccs_master_course_file',
  source_url: `https://courses.vccs.edu/courses/${courseKey.slice(3)}`,
  raw_requisites: null,
  groups: [],
});

const universityNone = (courseKey, owner = 'va:uni:9205') => ({
  course_key: courseKey,
  owner_namespace: owner,
  status: 'none',
  source: 'institution_catalog',
  source_url: `https://catalog.example.edu/courses/${courseKey.split(':').at(-1)}`,
  source_bundle_hash: 'official-catalog-sha256',
  raw_requisites: null,
  groups: [],
});

const exactGroup = (paths, id = 'formula:choice') => ({
  id,
  kind: 'prerequisite',
  formula: 'paths_or__conditions_and',
  paths: paths.map((allOf, index) => ({
    id: `${id}:path:${index}`,
    raw: allOf.map((condition) => condition.course_key || condition.raw).join(' and '),
    all_of: allOf,
  })),
});

function exactVirginiaCorpora(overrides = {}) {
  const target = {
    course_key: 'va:CSC200',
    owner_namespace: 'va:vccs',
    status: 'parsed',
    source: 'vccs_master_course_file',
    source_url: 'https://courses.vccs.edu/courses/CSC200',
    raw_requisites: '(CSC 100 and MTH 100) or ITE 100',
    groups: [exactGroup([
      [{ type: 'course', course_key: 'va:CSC100', code: 'CSC100' }, { type: 'course', course_key: 'va:MTH100', code: 'MTH100' }],
      [{ type: 'course', course_key: 'va:ITE100', code: 'ITE100' }],
    ])],
    ...overrides,
  };
  return compileValidatedVirginiaFormulaCorpora({
    communityCollegeRows: [target, vccsNone('va:CSC100'), vccsNone('va:MTH100'), vccsNone('va:ITE100')],
    universityRows: [universityNone('va:uni:9205:CS100')],
    requiredCommunityCollegeKeys: ['va:CSC200'],
    requiredUniversityKeys: ['va:uni:9205:CS100'],
  });
}

describe('exact Virginia Figure 6 formula adapter', () => {
  it('advertises exact formula support without changing the Virginia publication gate', () => {
    expect(VA_EXACT_FORMULA_ADAPTER).toMatchObject({
      integrated: true,
      formula: 'paths_or__conditions_and',
      semantics: 'groups_and__paths_or__conditions_and',
      ambiguous_path_policy: 'fail_closed',
    });
  });

  it('keeps AND members together while choosing exactly one represented OR path', () => {
    const compiled = exactVirginiaCorpora();
    expect(compiled).toMatchObject({ ready: true, issues: [] });
    const graph = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: ['va:CSC200', 'va:CSC100', 'va:MTH100', 'va:uni:9205:CS100'],
    });
    expect(graph.ready).toBe(true);
    expect(graph.parents_by_course_key.get('va:CSC200')).toEqual(['va:CSC100', 'va:MTH100']);
    expect(graph.selected_paths).toMatchObject([{
      course_key: 'va:CSC200',
      formula_id: 'formula:choice',
      path_id: 'formula:choice:path:0',
      parents: ['va:CSC100', 'va:MTH100'],
    }]);

    const alternative = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: ['va:CSC200', 'va:ITE100', 'va:uni:9205:CS100'],
    });
    expect(alternative.ready).toBe(true);
    expect(alternative.parents_by_course_key.get('va:CSC200')).toEqual(['va:ITE100']);
  });

  it('fails closed instead of unioning or arbitrarily picking two represented OR paths', () => {
    const compiled = exactVirginiaCorpora();
    const graph = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [
        'va:CSC200', 'va:CSC100', 'va:MTH100', 'va:ITE100', 'va:uni:9205:CS100',
      ],
    });
    expect(graph).toMatchObject({
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      parents_by_course_key: null,
    });
    expect(graph.issues.map((issue) => issue.code))
      .toContain('multiple_formula_paths_represented');
  });

  it('requires shared contract validation and rejects missing or unparsed rows', () => {
    const compiled = exactVirginiaCorpora({ status: 'unparsed', groups: [] });
    expect(compiled).toMatchObject({
      ready: false,
      blocker: VA_PREREQUISITE_MODEL_BLOCKER,
      corpora: [],
    });
    expect(compiled.issues.map((issue) => issue.code))
      .toContain('requisite_status_not_publishable');
  });

  it('does not silently turn a placement alternative into an empty edge', () => {
    const compiled = exactVirginiaCorpora({
      raw_requisites: 'CSC 100 or placement',
      groups: [exactGroup([
        [{ type: 'course', course_key: 'va:CSC100', code: 'CSC100' }],
        [{ type: 'non_course', condition: 'placement', raw: 'by placement' }],
      ])],
    });
    expect(compiled.ready).toBe(true);
    const graph = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: ['va:CSC200', 'va:CSC100', 'va:uni:9205:CS100'],
    });
    expect(graph.ready).toBe(false);
    expect(graph.issues.map((issue) => issue.code))
      .toContain('non_course_formula_path_unresolved');
  });

  it('accepts only the exact source-bound Longwood Perspective course bindings', () => {
    const targetKey = CTZN410_SEQUENCE_EVIDENCE.course_key;
    const owner = 'va:uni:9214';
    const target = {
      course_key: targetKey,
      owner_namespace: owner,
      status: 'parsed',
      source: 'institution_catalog',
      source_url: 'https://www.longwood.edu/site-assets/courses-from-banner/',
      source_bundle_hash: 'official-longwood-bundle',
      raw_requisites: 'Completion of three perspective level courses. The fourth perspectives level course must be taken prior to or concurrently with CTZN 410.',
      groups: [exactGroup([
        CTZN410_SEQUENCE_EVIDENCE.conditions,
      ], `${targetKey}:prerequisite:0`)],
    };
    const compile = (row = target) => compileValidatedVirginiaFormulaCorpora({
      communityCollegeRows: [vccsNone('va:CSC100')],
      universityRows: [row],
      requiredCommunityCollegeKeys: ['va:CSC100'],
      requiredUniversityKeys: [targetKey],
    });
    const compiled = compile();
    expect(compiled.ready).toBe(true);
    const slots = [
      'va:uni:9214:PSYC335',
      'va:uni:9214:RELI301',
      'va:uni:9214:MATH301',
      'va:uni:9214:SPAN320',
    ];
    const bindings = {
      [targetKey]: Object.fromEntries(
        CTZN410_SEQUENCE_EVIDENCE.conditions.map((condition, index) => [
          sha256VirginiaPrerequisiteValue(
            canonicalVirginiaPrerequisiteJson(condition),
          ),
          index === 0 ? slots.slice(0, 3) : slots.slice(3),
        ]),
      ),
    };
    const graph = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [targetKey],
      pathwayVertexKeys: [targetKey, ...slots],
      nonCourseConditionBindings: bindings,
    });
    expect(graph.ready).toBe(true);
    expect(graph.parents_by_course_key.get(targetKey)).toEqual(slots);

    const unbound = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [targetKey],
      pathwayVertexKeys: [targetKey, ...slots],
    });
    expect(unbound.ready).toBe(false);
    expect(unbound.issues.map((issue) => issue.code))
      .toContain('non_course_formula_path_unresolved');

    const missingSlot = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [targetKey],
      pathwayVertexKeys: [targetKey, ...slots.slice(0, 3)],
      nonCourseConditionBindings: bindings,
    });
    expect(missingSlot.ready).toBe(false);
    expect(JSON.stringify(missingSlot.issues))
      .toContain('non_course_condition_binding_vertex_missing');

    const wrongOwnerBindings = structuredClone(bindings);
    const firstConditionHash = Object.keys(wrongOwnerBindings[targetKey])[0];
    wrongOwnerBindings[targetKey][firstConditionHash][0] = 'va:uni:9999:PSYC335';
    const wrongOwner = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [targetKey],
      pathwayVertexKeys: [targetKey, ...slots, 'va:uni:9999:PSYC335'],
      nonCourseConditionBindings: wrongOwnerBindings,
    });
    expect(wrongOwner.ready).toBe(false);
    expect(JSON.stringify(wrongOwner.issues))
      .toContain('non_course_condition_binding_shape_invalid');

    const changedTarget = structuredClone(target);
    changedTarget.groups[0].paths[0].all_of[1].concurrent_allowed = false;
    const changed = compile(changedTarget);
    const staleBinding = buildExactVirginiaParentMap({
      compiledCorpora: changed.corpora,
      pathwayCourseKeys: [targetKey],
      pathwayVertexKeys: [targetKey, ...slots],
      nonCourseConditionBindings: bindings,
    });
    expect(staleBinding.ready).toBe(false);
    expect(staleBinding.issues.map((issue) => issue.code))
      .toContain('non_course_formula_path_unresolved');
  });

  it('rewires one university prerequisite to the entire selected sending sequence', () => {
    const universityTarget = {
      course_key: 'va:uni:9205:CS200',
      owner_namespace: 'va:uni:9205',
      status: 'parsed',
      source: 'institution_catalog',
      source_url: 'https://catalog.example.edu/courses/CS200',
      source_bundle_hash: 'official-catalog-sha256',
      raw_requisites: 'CS 100',
      groups: [exactGroup([[
        { type: 'course', course_key: 'va:uni:9205:CS100', code: 'CS100' },
      ]], 'va:uni:9205:CS200:prerequisite:0')],
    };
    const compiled = compileValidatedVirginiaFormulaCorpora({
      communityCollegeRows: [vccsNone('va:CSC100'), vccsNone('va:MTH100')],
      universityRows: [universityTarget, universityNone('va:uni:9205:CS100')],
      requiredCommunityCollegeKeys: ['va:CSC100', 'va:MTH100'],
      requiredUniversityKeys: ['va:uni:9205:CS200'],
    });
    expect(compiled.ready).toBe(true);
    const graph = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: ['va:CSC100', 'va:MTH100', 'va:uni:9205:CS200'],
      substitutions: new Map([['va:uni:9205:CS100', ['va:CSC100', 'va:MTH100']]]),
    });
    expect(graph.ready).toBe(true);
    expect(graph.parents_by_course_key.get('va:uni:9205:CS200'))
      .toEqual(['va:CSC100', 'va:MTH100']);
  });
});

const readyVirginiaSource = (kind, overrides = {}) => ({
  _id: kind === 'degree' ? 'degree:9205:va-cs' : 'as_degree:9301:va-cs:local_as',
  kind,
  state: 'va',
  analysis_contract: canonicalSourceContract(),
  status: kind === 'degree' ? undefined : 'found',
  va_requirement_status: 'extracted',
  va_requirement_id: kind === 'degree' ? 'va:degree:bridgewater:cs' : 'va:as:blue-ridge:cs',
  source_method: 'official_catalog_composition',
  analysis_ready: true,
  acceptance: {
    accepted: true,
    ready_for_analysis: true,
    catalog: { checks: [] },
    analysis_ready: { checks: [] },
  },
  verification: { verified: true, stale: false },
  provenance: { source_bundle_hash: `${kind}-hash` },
  ...(kind === 'degree' ? {
    total_units: 3,
    unit_audit: {
      graduation_minimum: 3,
      modeled_units: 3,
      upper_division: { status: 'none_stated', reason: 'No aggregate rule.' },
      residency: { status: 'none_stated', reason: 'No numeric rule.' },
    },
    requirement_groups: [{
      title: 'Lower-division major', course_level: 'lower_division',
      sections: [{ unit_advisement: 3, receivers: [{
        receiving: { kind: 'course', parent_id: 1, units: 3 },
      }] }],
    }],
  } : {}),
  ...overrides,
});

describe('Virginia Figure 6 publication gate', () => {
  it('blocks even accepted degree trees until both prerequisite namespaces are integrated', () => {
    const gate = virginiaPathwaySourceGate(
      readyVirginiaSource('as_degree'),
      readyVirginiaSource('degree'),
    );
    expect(gate).toMatchObject({
      ready: false,
      reason: VA_PREREQUISITE_MODEL_BLOCKER,
      associate: { ready: true },
      bachelor: { ready: true },
    });
    expect(gate.warning).toMatch(/VCCS requisite formulas and university-local prerequisites/i);
  });

  it('returns an explicit null-metric row instead of scoring a disconnected Virginia graph', async () => {
    const degree = readyVirginiaSource('degree', {
      major_slug: 'va-cs', school_id: 9205, school: 'Bridgewater College',
      program: 'Computer Science, B.S.', unit_system: 'semester',
    });
    const associate = readyVirginiaSource('as_degree', {
      major_slug: 'va-cs', degree_type: 'local_as', community_college_id: 9301,
      college_name: 'Blue Ridge Community College', total_units: 3, total_units_max: 3,
      requirement_groups: [{
        group_conjunction: 'And',
        sections: [{ section_advisement: 1, receivers: [{ options: [{ course_ids: [5001] }] }] }],
      }],
    });
    await db.collection('curated_requirements').insertMany([degree, associate]);
    await db.collection('assist_agreements').insertOne({
      state: 'va', uc_school_id: 9205, community_college_id: 9301,
      major: 'Computer Science, B.S.', requirement_groups: [],
    });
    await db.collection('assist_courses').insertOne({
      state: 'va', side: 'sending', course_id: 5001, units: 3,
    });
    await db.collection('assist_institutions').insertOne({
      state: 'va', kind: 'community_college', source_id: 9301,
      name: 'Blue Ridge Community College',
    });

    const rows = await pathwayComplexityData(db, null, {
      majorSlug: 'va-cs', degreeType: 'local_as', verifiedOnly: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      method_status: 'excluded',
      exclusion_reason: VA_PREREQUISITE_MODEL_BLOCKER,
      complexity: null,
      resident_complexity: null,
      delta_vs_resident: null,
    });
  });
});
