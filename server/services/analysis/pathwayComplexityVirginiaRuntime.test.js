import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const {
  VA_FIGURE6_PUBLICATION_COLLECTION,
  VA_PREREQUISITE_MODEL_BLOCKER,
  loadVirginiaFigure6PrerequisiteRuntime,
  pathwayComplexityData,
  resolveVirginiaReceivingCourseCode,
  scoreExactVirginiaPathway,
  virginiaFigure6RuntimeReady,
  virginiaPathwaySourceGate,
} = cjs('./pathwayComplexity');
const { canonicalSourceContract } = cjs('./canonicalSourceContract');
const {
  RECEIPT_ARTIFACT,
  RECEIPT_ATTESTATIONS,
  RECEIPT_DECISION,
  RECEIPT_METHOD,
  RECEIPT_STATEMENT,
  VA_FIGURE6_PREREQUISITE_CONTRACT,
  officialHostsForPrerequisiteScope,
  publicationGenerationFor,
  requiredUniversityCourseKeys,
  requiredVccsCourseKeys,
  sha256,
  sourceBundleHashForRows,
  verificationReceiptHash,
} = cjs('../virginia/pathwayComplexityPrerequisites');

const NOW = new Date('2026-08-24T12:00:00.000Z');
const UNIVERSITY_OWNER = 'va:uni:9205';
let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('pathway_complexity_va_runtime_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const courseCondition = (owner, code) => ({
  type: 'course',
  course_key: owner === 'va:vccs' ? `va:${code}` : `${owner}:${code}`,
  code,
});

const exactGroup = (courseKey, paths) => ({
  id: `${courseKey}:prerequisite:0`,
  kind: 'prerequisite',
  formula: 'paths_or__conditions_and',
  paths: paths.map((allOf, index) => ({
    id: `${courseKey}:prerequisite:0:path:${index}`,
    raw: allOf.map((condition) => condition.code || condition.raw).join(' and '),
    all_of: allOf,
  })),
});

function evidencedRow({ courseKey, owner, status = 'none', groups = [], rawRequisites = null }) {
  const code = courseKey.split(':').at(-1);
  const displayCode = code.replace(/^([A-Z]+)(\d)/, '$1 $2');
  const sourceUrl = owner === 'va:vccs'
    ? `https://courses.vccs.edu/courses/${code}`
    : `https://catalog.example.edu/courses/${code}`;
  const rawText = status === 'none'
    ? `${displayCode}. Catalog course entry. Prerequisites: None.`
    : `${displayCode}. Catalog course entry. Prerequisites: ${rawRequisites}.`;
  const contentSha256 = sha256(rawText);
  return {
    course_key: courseKey,
    owner_namespace: owner,
    status,
    source: owner === 'va:vccs' ? 'vccs_master_course_file' : 'institution_catalog',
    source_url: sourceUrl,
    source_content_sha256: contentSha256,
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: rawText,
      content_sha256: contentSha256,
    },
    ...(status === 'none' ? {
      explicit_none_evidence: {
        kind: 'official_explicit_none_statement',
        raw_text: 'Prerequisites: None.',
        source_content_sha256: contentSha256,
      },
    } : {}),
    raw_requisites: rawRequisites,
    groups,
  };
}

function stampBundleHashes(rows) {
  for (const owner of new Set(rows.map((row) => row.owner_namespace))) {
    const hash = sourceBundleHashForRows(rows, owner);
    for (const row of rows.filter((candidate) => candidate.owner_namespace === owner)) {
      row.source_bundle_hash = hash;
    }
  }
}

function publicationFixture({
  universityPaths = [[courseCondition(UNIVERSITY_OWNER, 'CS100')]],
  extraUniversityCodes = [],
} = {}) {
  const vccsScopeRows = [{ code: 'CSC100', colleges: ['Blue Ridge Community College'] }];
  const universityScope = {
    universities: [{
      school_id: 9205,
      owner_namespace: UNIVERSITY_OWNER,
      direct_named_course_codes: ['CS100', 'CS200'],
      cached_course_catalog: { official_url: 'https://catalog.example.edu/catalog' },
    }],
  };
  const communityCollegeRows = [evidencedRow({
    courseKey: 'va:CSC100', owner: 'va:vccs',
  })];
  const targetKey = `${UNIVERSITY_OWNER}:CS200`;
  const universityRows = [
    evidencedRow({ courseKey: `${UNIVERSITY_OWNER}:CS100`, owner: UNIVERSITY_OWNER }),
    ...extraUniversityCodes.map((code) => evidencedRow({
      courseKey: `${UNIVERSITY_OWNER}:${code}`, owner: UNIVERSITY_OWNER,
    })),
    evidencedRow({
      courseKey: targetKey,
      owner: UNIVERSITY_OWNER,
      status: 'parsed',
      rawRequisites: universityPaths
        .map((path) => path.map((condition) => condition.code).join(' and ')).join(' or '),
      groups: [exactGroup(targetKey, universityPaths)],
    }),
  ];
  stampBundleHashes(communityCollegeRows);
  stampBundleHashes(universityRows);
  const requiredCommunityCollegeKeys = requiredVccsCourseKeys(vccsScopeRows);
  const requiredUniversityKeys = requiredUniversityCourseKeys(universityScope);
  const publicationGeneration = publicationGenerationFor({
    communityCollegeRows,
    universityRows,
    requiredCommunityCollegeKeys,
    requiredUniversityKeys,
    officialHostsByOwner: officialHostsForPrerequisiteScope(universityScope),
  });
  const receiptBase = {
    schema_version: 1,
    artifact: RECEIPT_ARTIFACT,
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    decision: RECEIPT_DECISION,
    verification_method: RECEIPT_METHOD,
    verified_by: { kind: 'human', name: 'Independent Reviewer', role: 'data verifier' },
    verified_at: '2026-08-24T11:00:00.000Z',
    signed_statement: RECEIPT_STATEMENT,
    publication_generation: publicationGeneration,
    artifact_sha256: {
      community_college_corpus: 'a'.repeat(64),
      university_corpus: 'b'.repeat(64),
      vccs_scope: 'c'.repeat(64),
      university_scope: 'd'.repeat(64),
    },
    attestations: Object.fromEntries(RECEIPT_ATTESTATIONS.map((name) => [name, true])),
  };
  const receiptSha256 = verificationReceiptHash(receiptBase);
  const receiptId = `va:figure6:prerequisites:${publicationGeneration}`;
  const stamp = (row) => ({
    ...row,
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    publication_generation: publicationGeneration,
    verification_receipt_id: receiptId,
    verification_receipt_sha256: receiptSha256,
    published_at: NOW,
  });
  const receipt = {
    ...receiptBase,
    _id: receiptId,
    active: true,
    published_at: NOW,
    receipt_sha256: receiptSha256,
    corpus_counts: {
      community_college: communityCollegeRows.length,
      university: universityRows.length,
      required_community_college: requiredCommunityCollegeKeys.length,
      required_university: requiredUniversityKeys.length,
      owners: 1,
    },
  };
  return {
    communityCollegeRows: communityCollegeRows.map(stamp),
    universityRows: universityRows.map(stamp),
    receipt,
    vccsScopeRows,
    universityScope,
    publicationGeneration,
    receiptSha256,
  };
}

async function seedPublication(fixture, { receipt = true } = {}) {
  await db.collection(VA_FIGURE6_PREREQUISITE_CONTRACT.community_college.collection)
    .insertMany(fixture.communityCollegeRows);
  await db.collection(VA_FIGURE6_PREREQUISITE_CONTRACT.university.collection)
    .insertMany(fixture.universityRows);
  if (receipt) await db.collection(VA_FIGURE6_PUBLICATION_COLLECTION).insertOne(fixture.receipt);
}

const loadRuntime = (fixture) => loadVirginiaFigure6PrerequisiteRuntime(db, {
  vccsScopeRows: fixture.vccsScopeRows,
  universityScope: fixture.universityScope,
});

describe('Virginia Figure 6 runtime publication boundary', () => {
  it('loads and compiles exactly one complete, receipt-bound V2 publication', async () => {
    const fixture = publicationFixture();
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    expect(runtime).toMatchObject({
      ready: true,
      publication_generation: fixture.publicationGeneration,
      verification_receipt_sha256: fixture.receiptSha256,
      issues: [],
      source_report: { ready: true },
      compilation: { ready: true },
    });
    expect(virginiaFigure6RuntimeReady(runtime)).toBe(true);
    expect(runtime.corpora).toHaveLength(2);
  });

  it('fails closed for missing, duplicate, stale, or count-mismatched active receipts', async () => {
    const missing = publicationFixture();
    await seedPublication(missing, { receipt: false });
    expect((await loadRuntime(missing)).issues.map((issue) => issue.code))
      .toContain('active_verification_receipt_missing');

    await db.dropDatabase();
    const duplicate = publicationFixture();
    await seedPublication(duplicate);
    await db.collection(VA_FIGURE6_PUBLICATION_COLLECTION).insertOne({
      ...duplicate.receipt, _id: 'second-active-receipt',
    });
    expect((await loadRuntime(duplicate)).issues.map((issue) => issue.code))
      .toContain('multiple_active_verification_receipts');

    await db.dropDatabase();
    const stale = publicationFixture();
    stale.receipt.publication_generation = '0'.repeat(64);
    stale.receipt.corpus_counts.university += 1;
    await seedPublication(stale);
    const staleRuntime = await loadRuntime(stale);
    expect(staleRuntime.ready).toBe(false);
    expect(staleRuntime.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'verification_generation_mismatch',
      'publication_corpus_count_mismatch',
    ]));

    await db.dropDatabase();
    const unsigned = publicationFixture();
    delete unsigned.receipt.receipt_sha256;
    await seedPublication(unsigned);
    expect((await loadRuntime(unsigned)).issues.map((issue) => issue.code))
      .toContain('active_verification_receipt_hash_required');
  });

  it('rejects an incomplete direct corpus even when every remaining row carries the receipt stamp', async () => {
    const fixture = publicationFixture();
    fixture.universityRows = fixture.universityRows
      .filter((row) => row.course_key !== `${UNIVERSITY_OWNER}:CS100`);
    fixture.receipt.corpus_counts.university = fixture.universityRows.length;
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    expect(runtime.ready).toBe(false);
    expect(runtime.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'required_course_requisite_missing',
      'prerequisite_formula_closure_missing',
      'publication_generation_not_content_derived',
    ]));
  });
});

describe('Virginia exact pathway identity bridge and graph', () => {
  it('keeps lecture and lab receiving identities distinct despite legacy prefix/number collisions', () => {
    const published = new Set(['CPSC150', 'CPSC150L']);
    expect(resolveVirginiaReceivingCourseCode({
      prefix: 'CPSC', number: '150', title: 'CPSC150',
    }, published)).toBe('CPSC150');
    expect(resolveVirginiaReceivingCourseCode({
      prefix: 'CPSC', number: '150', title: 'CPSC150L',
    }, published)).toBe('CPSC150L');
  });

  it('rewires a university prerequisite through the complete articulated sending sequence', async () => {
    const fixture = publicationFixture();
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    const target = `${UNIVERSITY_OWNER}:CS200`;
    const prerequisite = `${UNIVERSITY_OWNER}:CS100`;
    const pathway = {
      vertices: new Map([
        ['cc:501', { kind: 'cc', units: 3 }],
        [target, { kind: 'uc', catalogId: target, units: 3 }],
      ]),
      substitution: new Map([[prerequisite, ['cc:501']]]),
    };
    const result = scoreExactVirginiaPathway(pathway, {
      prerequisiteRuntime: runtime,
      universityOwner: UNIVERSITY_OWNER,
      sendingCourses: [{ course_id: 501, course_key: 'va:CSC100' }],
    });
    expect(result).toMatchObject({
      ready: true,
      score: {
        n_courses: 2,
        n_placeholder: 0,
        n_edges: 1,
        complexity: 5,
        edge_info_pct: 100,
      },
    });
    expect(result.closure.graph.parents_by_course_key.get(target)).toEqual(['va:CSC100']);
    expect(result.selected_paths[0]).toMatchObject({
      course_key: target,
      path_id: `${target}:prerequisite:0:path:0`,
      parents: ['va:CSC100'],
    });
  });

  it('adds forced recursive AND closure as real graph vertices', async () => {
    const fixture = publicationFixture({
      universityPaths: [[
        courseCondition(UNIVERSITY_OWNER, 'CS100'),
        courseCondition(UNIVERSITY_OWNER, 'MATH100'),
      ]],
      extraUniversityCodes: ['MATH100'],
    });
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    const target = `${UNIVERSITY_OWNER}:CS200`;
    const result = scoreExactVirginiaPathway({
      vertices: new Map([[target, { kind: 'uc', catalogId: target }]]),
      substitution: new Map(),
    }, {
      prerequisiteRuntime: runtime,
      universityOwner: UNIVERSITY_OWNER,
    });
    expect(result.ready).toBe(true);
    expect(result.score).toMatchObject({ n_courses: 3, n_edges: 2, edge_info_pct: 100 });
    expect([...result.closure.course_keys].sort()).toEqual([
      `${UNIVERSITY_OWNER}:CS100`,
      `${UNIVERSITY_OWNER}:CS200`,
      `${UNIVERSITY_OWNER}:MATH100`,
    ]);
  });

  it('does not invent a branch for an unrepresented OR formula', async () => {
    const fixture = publicationFixture({
      universityPaths: [
        [courseCondition(UNIVERSITY_OWNER, 'CS100')],
        [courseCondition(UNIVERSITY_OWNER, 'MATH100')],
      ],
      extraUniversityCodes: ['MATH100'],
    });
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    const target = `${UNIVERSITY_OWNER}:CS200`;
    const result = scoreExactVirginiaPathway({
      vertices: new Map([[target, { kind: 'uc', catalogId: target }]]),
      substitution: new Map(),
    }, {
      prerequisiteRuntime: runtime,
      universityOwner: UNIVERSITY_OWNER,
    });
    expect(result).toMatchObject({ ready: false, blocker: VA_PREREQUISITE_MODEL_BLOCKER });
    expect(result.issues.map((issue) => issue.code))
      .toContain('no_complete_formula_path_in_pathway');
  });

  it('rejects local-key aliases and named university slots that miss the signed owner corpus', async () => {
    const fixture = publicationFixture();
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    const local = scoreExactVirginiaPathway({
      vertices: new Map([['cc:501', { kind: 'cc' }]]),
      substitution: new Map(),
    }, {
      prerequisiteRuntime: runtime,
      universityOwner: UNIVERSITY_OWNER,
      sendingCourses: [{ course_id: 501, course_key: 'va:cc:9317:CSC100' }],
    });
    expect(local.ready).toBe(false);
    expect(local.issues.map((issue) => issue.code))
      .toContain('course_identity_outside_published_corpus');

    const namedSlot = scoreExactVirginiaPathway({
      vertices: new Map([['slot:named', {
        kind: 'slot', unresolvedCourseCode: 'CS999',
      }]]),
      substitution: new Map(),
    }, {
      prerequisiteRuntime: runtime,
      universityOwner: UNIVERSITY_OWNER,
    });
    expect(namedSlot.ready).toBe(false);
    expect(namedSlot.issues.map((issue) => issue.code))
      .toContain('named_university_course_identity_unresolved');
  });
});

function readyVirginiaSource(kind, overrides = {}) {
  return {
    _id: kind === 'degree' ? 'degree:9205:va-cs' : 'as_degree:9301:va-cs:local_as',
    kind,
    state: 'va',
    analysis_contract: canonicalSourceContract(),
    status: kind === 'degree' ? undefined : 'found',
    va_requirement_status: 'extracted',
    va_requirement_id: kind === 'degree'
      ? 'va:degree:bridgewater-college:cs' : 'va:as:blue-ridge:cs',
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
      total_units: 6,
      unit_audit: {
        graduation_minimum: 6,
        modeled_units: 6,
        upper_division: { status: 'none_stated', reason: 'No aggregate rule.' },
        residency: { status: 'none_stated', reason: 'No numeric rule.' },
      },
    } : {}),
    ...overrides,
  };
}

describe('Virginia Figure 6 integrated scorer and figure-specific source gate', () => {
  it('scores the shared numeric projection only after exact identity and receipt bridging', async () => {
    const fixture = publicationFixture();
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    const degree = readyVirginiaSource('degree', {
      major_slug: 'va-cs',
      school_id: 9205,
      school: 'Bridgewater College',
      program: 'Computer Science, B.S.',
      unit_system: 'semester',
      requirement_groups: [
        {
          title: 'Lower division',
          group_conjunction: 'And',
          tier: 'transferable',
          course_level: 'lower_division',
          sections: [{
            section_advisement: 1,
            unit_advisement: 3,
            category: 'lower-division',
            receivers: [{ receiving: {
              kind: 'course', parent_id: 10, code: 'CS100', units: 3,
            } }],
          }],
        },
        {
          title: 'Upper division',
          group_conjunction: 'And',
          tier: 'nontransferable',
          course_level: 'upper_division',
          sections: [{
            section_advisement: 1,
            unit_advisement: 3,
            category: 'upper-division',
            receivers: [{ receiving: {
              kind: 'course', parent_id: 20, code: 'CS200', units: 3,
            } }],
          }],
        },
      ],
    });
    const associate = readyVirginiaSource('as_degree', {
      major_slug: 'va-cs',
      degree_type: 'local_as',
      community_college_id: 9301,
      college_name: 'Blue Ridge Community College',
      total_units: 3,
      total_units_max: 3,
      requirement_groups: [{
        group_conjunction: 'And',
        sections: [{
          section_advisement: 1,
          receivers: [{ options: [{
            course_ids: [501], source_course_keys: ['va:CSC100'],
          }] }],
        }],
      }],
    });
    await db.collection('curated_requirements').insertMany([degree, associate]);
    await db.collection('assist_agreements').insertOne({
      state: 'va',
      uc_school_id: 9205,
      community_college_id: 9301,
      major: 'Computer Science, B.S.',
      requirement_groups: [{ sections: [{ receivers: [{
        receiving: { kind: 'course', parent_id: 10 },
        articulation_status: 'articulated',
        options: [{ course_ids: [501] }],
      }] }] }],
    });
    await db.collection('assist_courses').insertMany([
      {
        state: 'va', side: 'sending', institution_id: 'va:vccs',
        course_id: 501, course_key: 'va:CSC100', units: 3,
      },
      {
        state: 'va', side: 'receiving', institution_id: UNIVERSITY_OWNER,
        parent_id: 10, prefix: 'CS', number: '100', min_units: 3,
      },
      {
        state: 'va', side: 'receiving', institution_id: UNIVERSITY_OWNER,
        parent_id: 20, prefix: 'CS', number: '200', min_units: 3,
      },
    ]);
    await db.collection('assist_institutions').insertOne({
      state: 'va', kind: 'community_college', source_id: 9301,
      name: 'Blue Ridge Community College',
    });

    const rows = await pathwayComplexityData(db, null, {
      majorSlug: 'va-cs',
      degreeType: 'local_as',
      verifiedOnly: true,
      virginiaPrerequisiteRuntime: runtime,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      method_status: 'ok',
      exclusion_reason: null,
      requirements_consumed: 1,
      n_courses: 2,
      n_edges: 1,
      complexity: 5,
      resident_complexity: 5,
      delta_vs_resident: 0,
      prerequisite_publication_generation: fixture.publicationGeneration,
      prerequisite_verification_receipt_sha256: fixture.receiptSha256,
      source_figures: ['6'],
      degree_source_figures: ['6'],
      source_figure_constraint_blockers: [],
      degree_source_figure_constraint_blockers: [],
    });
  });

  it('allows an out-of-scope administrative rule but still blocks an unknown Figure 6 rule', async () => {
    const fixture = publicationFixture();
    await seedPublication(fixture);
    const runtime = await loadRuntime(fixture);
    const associate = readyVirginiaSource('as_degree');
    const degree = readyVirginiaSource('degree', {
      analysis_ready: false,
      acceptance: {
        accepted: true,
        ready_for_analysis: false,
        catalog: { checks: [] },
        analysis_ready: { checks: [{ name: 'constraint_support', severity: 'fail' }] },
      },
      requirement_groups: [{
        title: 'Administrative requirement',
        group_conjunction: 'And',
        analysis_constraints: [{
          kind: 'general_education_assessment', status: 'evaluator_not_implemented',
        }],
        sections: [{
          section_advisement: 1,
          unit_advisement: 6,
          receivers: [{ receiving: { kind: 'requirement', name: 'Assessment', units: 6 } }],
        }],
      }],
    });
    expect(virginiaPathwaySourceGate(associate, degree, runtime)).toMatchObject({
      ready: true,
      bachelor: {
        complete_degree_ready: false,
        figures: ['6'],
        figure_constraint_blockers: [],
      },
    });

    const unknown = structuredClone(degree);
    unknown.requirement_groups[0].analysis_constraints = [{
      kind: 'advisor_approval', status: 'evaluator_not_implemented',
    }];
    expect(virginiaPathwaySourceGate(associate, unknown, runtime)).toMatchObject({
      ready: false,
      reason: 'virginia_source_not_publication_ready',
      bachelor: {
        complete_degree_ready: false,
        figures: ['6'],
        figure_constraint_blockers: [expect.objectContaining({ kind: 'advisor_approval' })],
      },
    });
  });
});
