import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  coverage: coverageEndpoint,
  transferCreditRate: transferCreditRateEndpoint,
  pathwayComplexity: pathwayComplexityEndpoint,
  exportCsAstDegrees,
  exportLocalCsAsDegrees,
  _parseMultiCampusPathwayParams,
  _requiresCompleteDistrictMatrix,
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
      major_slug: 'cs',
      requirement_groups: [{ sections: [{ receivers: [{ options: [{ course_ids: [100] }] }] }] }],
    };
    await db.collection('curated_requirements').insertMany([
      { ...shared, _id: 'as_degree:10:ast', degree_type: 'ast', degree_title_seen: 'Computer Science A.S.-T' },
      { ...shared, _id: 'as_degree:10:local', degree_type: 'local_as', degree_title_seen: 'Computer Science A.S.' },
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
    expect(response.body.params.degree_type).toBe('local_as');
    expect(response.body.n).toBe(1);
    expect(response.body.rows[0]).toMatchObject({
      _id: 'as_degree:10:local', degree_type: 'local_as', college_name: 'Example College',
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
      .toEqual({ error: 'unknown major: underwater-basket-weaving', known: ['cs', 'bio', 'econ', 'ma-cs', 'va-cs'] });
  });
});

describe('associate-degree analysis request scope', () => {
  it('uses the configured Economics transfer cohort by default', async () => {
    const response = await run(transferCreditRateEndpoint, { majorSlug: 'econ' });

    expect(response.statusCode).toBe(200);
    expect(response.body.params).toMatchObject({
      majorSlug: 'econ',
      degree_type: 'ast',
      verified_only: false,
      degree_templates_assumed_valid: false,
      method: 'bachelors_completion_v4',
    });
  });

  it('accepts and reports the verified associate-degree cohort', async () => {
    const response = await run(transferCreditRateEndpoint, {
      majorSlug: 'econ', verified_only: 'true',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.params).toMatchObject({
      majorSlug: 'econ',
      degree_type: 'ast',
      verified_only: true,
      degree_templates_assumed_valid: false,
      degree_template_evidence: 'per-template explicit verification record',
    });
  });

  it('rejects an ambiguous verified-only value', async () => {
    const response = await run(transferCreditRateEndpoint, {
      majorSlug: 'econ', verified_only: 'yes',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/verified_only must be true or false/i);
  });

  it('accepts the researched Economics local A.A. slot', async () => {
    const response = await run(transferCreditRateEndpoint, {
      majorSlug: 'econ', degree_type: 'local_other',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.params.degree_type).toBe('local_other');
  });

  it('rejects an unknown associate-degree slot instead of silently changing cohorts', async () => {
    const response = await run(transferCreditRateEndpoint, {
      majorSlug: 'econ', degree_type: 'certificate',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/degree_type must be one of/i);
  });

  it('keeps a major without analysis-ready associate-degree inputs gated', async () => {
    // Every configured major now has imported associate-degree records, so the
    // gate is exercised against a major whose capability is switched off rather
    // than against whichever one happens to be pending. The guard is what is
    // under test; which major trips it is incidental and changes as data lands.
    const bio = getMajor('bio');
    const original = bio.capabilities.asDegrees;
    bio.capabilities.asDegrees = false;
    try {
      const response = await run(transferCreditRateEndpoint, { majorSlug: 'bio' });

      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        error: 'capability_required', capability: 'asDegrees', major: 'bio',
      });
    } finally {
      bio.capabilities.asDegrees = original;
    }
  });

  it('serves the associate-degree model for a major whose records are in', async () => {
    const response = await run(transferCreditRateEndpoint, { majorSlug: 'bio' });

    expect(response.statusCode).toBe(200);
  });
});

describe('pathway complexity paper corpora', () => {
  it('serves the committed Massachusetts reproduction instead of a live assembly', async () => {
    const response = await run(pathwayComplexityEndpoint, { majorSlug: 'ma-cs' });

    expect(response.statusCode).toBe(200);
    expect(response.body.mode).toBe('paper');
    // The validation snapshot: 11 resident curricula + 61 transfer pathways.
    // Final PDF, archived tab and independent recomputation stay distinct.
    expect(response.body.pathways).toHaveLength(72);
    expect(response.body.archive_score_differences.map((m) => m.pathway)).toEqual([
      'UMass Dartmouth x Bristol',
    ]);
    expect(response.body.final_pdf.summary).toEqual({ n: 49, sum: 715, mean: 14.591837 });
    expect(response.body.headline_means.final_pdf.mean).toBeCloseTo(14.59, 2);
    expect(response.body.artifact_differences).toHaveLength(2);
  });

  it('keeps Virginia on the live path rather than borrowing a snapshot', async () => {
    // va-cs declares the prerequisites capability (the graph service and tab
    // exist) but its requisite collections are not yet imported, so the live
    // assembly finds no pathways. The guard that matters: paperBaselines is
    // false, so Virginia must never inherit the Massachusetts snapshot.
    const response = await run(pathwayComplexityEndpoint, { majorSlug: 'va-cs' });

    expect(response.statusCode).toBe(200);
    expect(response.body.mode).toBeUndefined();
    expect(response.body.rows).toEqual([]);
  });

  it('serves live corpora from the analysis cache without recomputing', async () => {
    // A cached full-corpus result: the endpoint must serve these rows
    // (scoped to the configured pairs) and report cached: true. The row uses
    // a real configured cs campus so the scope filter keeps it. Figure 6 opens
    // on A.S.-T even though older analyses list local_as first.
    const csSchoolId = Number(Object.keys(getMajor('cs').programs)[0]);
    await db.collection('curated_requirements').insertMany([
      {
        _id: 'as_degree:figure6:found', kind: 'as_degree', status: 'found',
        major_slug: 'cs', degree_type: 'ast', community_college_id: 10,
        verification: { verified: true },
      },
      {
        _id: 'as_degree:figure6:none-found', kind: 'as_degree', status: 'none_found',
        major_slug: 'cs', degree_type: 'ast', verification: { verified: true },
      },
    ]);
    await db.collection('analysis_cache').replaceOne(
      { _id: 'pathway-complexity:v3:cs:ast:verified' },
      {
        _id: 'pathway-complexity:v3:cs:ast:verified',
        kind: 'pathway-complexity',
        model_version: 'v3',
        major_slug: 'cs',
        degree_type: 'ast',
        verified_only: true,
        computed_at: '2026-08-17T00:00:00.000Z',
        rows: [
          {
            school_id: csSchoolId, school: 'UC Example', community_college_id: 10,
            college_name: 'Example College', record_id: 'as_degree:10:cs:ast',
            complexity: 120, resident_complexity: 100, delta_vs_resident: 20,
            edge_info_pct: 80, method_status: 'ok',
          },
          {
            school_id: csSchoolId, school: 'UC Example', community_college_id: 11,
            college_name: 'Ambiguous College', record_id: 'as_degree:11:cs:ast',
            complexity: null, resident_complexity: 100, delta_vs_resident: null,
            method_status: 'excluded', exclusion_reason: 'ambiguous_named_unit_pool',
            method_warning: 'The stored grouping is ambiguous.',
          },
        ],
      },
      { upsert: true },
    );

    const response = await run(pathwayComplexityEndpoint, { majorSlug: 'cs' });

    expect(response.statusCode).toBe(200);
    expect(response.body.cached).toBe(true);
    expect(response.body.degree_type).toBe('ast');
    expect(response.body.verified_only).toBe(true);
    expect(response.body.model_version).toBe('v3');
    expect(response.body.computed_at).toBe('2026-08-17T00:00:00.000Z');
    expect(response.body.rows).toHaveLength(2);
    expect(response.body.rows[0].college_name).toBe('Example College');
    // The earlier export fixture contributes one unverified found A.S.-T;
    // the none_found sentinel above must not inflate any cohort count.
    expect(response.body.source_cohort).toEqual({
      degree_documents_total: 2,
      degree_documents_verified: 1,
      degree_documents_included: 1,
      unverified_degree_documents_omitted: 1,
      omitted_unverified_degree_documents: [{
        record_id: 'as_degree:10:ast',
        community_college_id: 10,
        college_name: 'Example College',
      }],
    });
    expect(response.body.exclusions).toMatchObject({
      degree_count: 1,
      pathway_count: 1,
      degrees: [{
        record_id: 'as_degree:11:cs:ast',
        college_name: 'Ambiguous College',
        reason: 'ambiguous_named_unit_pool',
      }],
    });

    await db.collection('analysis_cache').deleteOne({ _id: 'pathway-complexity:v3:cs:ast:verified' });
    await db.collection('curated_requirements').deleteMany({
      _id: { $in: ['as_degree:figure6:found', 'as_degree:figure6:none-found'] },
    });
  });

  it('keeps verified and all-resolved Figure 6 cohorts in separate caches', async () => {
    const csSchoolId = Number(Object.keys(getMajor('cs').programs)[0]);
    const cachedRow = (college_name, delta_vs_resident) => ({
      school_id: csSchoolId,
      school: 'UC Example',
      community_college_id: 10,
      college_name,
      record_id: `as_degree:10:cs:ast:${college_name}`,
      complexity: 100 + delta_vs_resident,
      resident_complexity: 100,
      delta_vs_resident,
      method_status: 'ok',
    });
    await db.collection('analysis_cache').insertMany([
      {
        _id: 'pathway-complexity:v3:cs:ast:verified',
        rows: [cachedRow('Verified College', 1)],
        computed_at: '2026-08-18T00:00:00.000Z',
      },
      {
        _id: 'pathway-complexity:v3:cs:ast:all',
        rows: [cachedRow('All Sources College', 2)],
        computed_at: '2026-08-18T00:00:00.000Z',
      },
    ]);

    const verified = await run(pathwayComplexityEndpoint, { majorSlug: 'cs' });
    const all = await run(pathwayComplexityEndpoint, {
      majorSlug: 'cs', verified_only: 'false',
    });
    expect(verified.body.rows[0].college_name).toBe('Verified College');
    expect(verified.body.verified_only).toBe(true);
    expect(all.body.rows[0].college_name).toBe('All Sources College');
    expect(all.body.verified_only).toBe(false);
  });

  it('rejects an invalid Figure 6 verification cohort', async () => {
    const response = await run(pathwayComplexityEndpoint, {
      majorSlug: 'cs', verified_only: 'sometimes',
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/verified_only must be true or false/i);
  });

  it('rejects an unknown Figure 6 associate-degree slot', async () => {
    const response = await run(pathwayComplexityEndpoint, {
      majorSlug: 'cs', degree_type: 'certificate',
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/degree_type must be one of/i);
  });
});

describe('configured-major district coverage completeness', () => {
  it('requires completeness for exact district ASSIST even with partial visibility', () => {
    expect(_requiresCompleteDistrictMatrix(
      { slug: 'bio', majorPrograms: getMajor('bio').programs },
      { groupBy: 'district', requirements: 'assist', visiblePairs: [
        { school_id: 1, major: 'one visible program' },
      ] },
    )).toBe(true);
  });

  it('fails closed when an exact configured major is missing canonical campus templates', async () => {
    await expect(run(coverageEndpoint, {
      majorSlug: 'bio', groupBy: 'district', requirements: 'assist',
    })).rejects.toMatchObject({
      code: 'incomplete_coverage_matrix',
      statusCode: 409,
    });
  });

  it('keeps legacy free-text district coverage sparse-compatible', async () => {
    const response = await run(coverageEndpoint, {
      majorContains: 'not-present', groupBy: 'district', requirements: 'assist',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ n: 0, rows: [] });
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
