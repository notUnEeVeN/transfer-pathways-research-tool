import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { startInMemoryMongo } from '../test/mongoHarness';
import maryland from './Maryland';
import { parseGuide } from '../services/artsys/parseGuide';
import { transformGuide } from '../services/artsys/transform';

// Exercises the read API over a real mongod seeded from the committed guide
// fixture, so the controller is tested against the same documents the importer
// actually produces rather than a hand-written approximation of them.
let mongo;
let db;

/** Minimal express double: resolves with {status, body}. */
const call = (fn, { query = {}, params = {} } = {}) => new Promise((resolve, reject) => {
  const req = { app: { locals: { db } }, query, params };
  const res = {
    json: (body) => resolve({ status: 200, body }),
    status: (status) => ({ json: (body) => resolve({ status, body }) }),
  };
  Promise.resolve(fn(req, res, reject)).catch(reject);
});

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('md_api_test');
  const html = fs.readFileSync(
    path.resolve(__dirname, '../test/fixtures/artsys/guide-3354-montgomery.html'), 'utf8'
  );
  const built = transformGuide(parseGuide(html, { guideId: 3354 }));
  await db.collection('artsys_institutions').insertMany(built.institutions);
  await db.collection('artsys_courses').insertMany(built.courses);
  await db.collection('artsys_agreements').insertOne(built.agreement);
  await db.collection('artsys_import_meta').insertOne({
    _id: 'current', imported_at: new Date('2026-07-27'),
    validation: { skeleton_mismatches: 0, unmatched_headers: 0 },
  });
}, 60000);

afterAll(async () => { await mongo?.stop(); });

describe('GET /md/summary', () => {
  it('counts the corpus without deriving anything', async () => {
    const { status, body } = await call(maryland.summary);
    expect(status).toBe(200);
    expect(body.state).toBe('MD');
    expect(body.colleges).toBe(1);
    expect(body.universities).toBe(1);
    expect(body.agreements).toBe(1);
    expect(body.programs).toBe(1);
    expect(body.sending_courses + body.receiving_courses).toBe(body.courses);
    expect(body.validation.skeleton_mismatches).toBe(0);
  });
});

describe('GET /md/institutions', () => {
  it('filters by kind', async () => {
    const cc = await call(maryland.listInstitutions, { query: { kind: 'community_college' } });
    expect(cc.body.rows.map((r) => r.name)).toEqual(['Montgomery College']);
    const uni = await call(maryland.listInstitutions, { query: { kind: 'university' } });
    expect(uni.body.rows.map((r) => r.name)).toEqual(['Capitol Technology University']);
  });

  it('ignores an unknown kind rather than erroring', async () => {
    const { body } = await call(maryland.listInstitutions, { query: { kind: 'nonsense' } });
    expect(body.rows).toHaveLength(2);
  });
});

describe('GET /md/agreements', () => {
  it('requires at least one filter', async () => {
    const { status } = await call(maryland.listAgreements);
    expect(status).toBe(400);
  });

  it('lists headers for a college without shipping the tree', async () => {
    const { body } = await call(maryland.listAgreements, { query: { college_id: 'md:cc:1768' } });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].major).toBe('Computer Science, B.S.');
    expect(body.rows[0].requirement_groups).toBeUndefined();
  });

  // verdicts=1 reads the trees but must never ship them — the browser lists
  // ~570 agreements per college and the payload would be enormous.
  it('attaches verdicts without shipping the tree', async () => {
    const { body } = await call(maryland.listAgreements,
      { query: { college_id: 'md:cc:1768', verdicts: '1' } });
    expect(body.rows[0].requirement_groups).toBeUndefined();
    expect(body.rows[0].complete_path_exists).toBe(false);
    expect(body.rows[0].binding).toBeGreaterThan(0);
  });
});

describe('GET /md/agreements/:id course payload', () => {
  // The shared RequirementsLedger resolves ids against lookup tables, so an
  // agreement must arrive with every course it references or the tree renders
  // as bare "#md:crs:..." placeholders.
  it('ships every referenced course', async () => {
    const { body } = await call(maryland.getAgreement, { params: { id: 'md:agr:3354:1768' } });
    const byId = new Map(body.courses.map((c) => [c._id, c]));
    for (const g of body.requirement_groups) {
      for (const s of g.sections) {
        for (const r of s.receivers) {
          if (r.receiving?.course_id) expect(byId.has(r.receiving.course_id)).toBe(true);
          for (const o of r.options) for (const id of o.course_ids) expect(byId.has(id)).toBe(true);
        }
      }
    }
    expect(body.courses.some((c) => c.side === 'receiving')).toBe(true);
    expect(body.courses.some((c) => c.side === 'sending')).toBe(true);
  });
});

describe('GET /md/agreements/:id', () => {
  it('returns the tree with the engine verdict attached', async () => {
    const { status, body } = await call(maryland.getAgreement, { params: { id: 'md:agr:3354:1768' } });
    expect(status).toBe(200);
    expect(body.summary).toMatchObject({ receivers: 29, missing: 6, groups: 6 });
    // Blocking gaps are a subset of raw not-articulated entries by construction.
    expect(body.summary.binding).toBeLessThanOrEqual(body.summary.missing);
    // Montgomery cannot satisfy every Capitol Tech CS requirement; the
    // permissive PMT default accepts unmet demand and therefore passes.
    expect(body.complete_path_exists).toBe(false);
    expect(body.complete_path_exists_permissive).toBe(true);
  });

  it('404s on an unknown id', async () => {
    const { status } = await call(maryland.getAgreement, { params: { id: 'md:agr:nope' } });
    expect(status).toBe(404);
  });
});

describe('GET /md/college-rollup', () => {
  it('reports the engine verdict and the raw entry count separately', async () => {
    const { body } = await call(maryland.collegeRollup);
    expect(body.rows).toHaveLength(1);
    const row = body.rows[0];
    expect(row.college_name).toBe('Montgomery College');
    expect(row.agreements).toBe(1);
    expect(row.complete).toBe(0);
    expect(row.complete_rate).toBe(0);
    expect(row.missing_entries).toBe(6);
    expect(row.missing_entry_rate).toBeCloseTo(6 / 29, 5);
    expect(row.binding_gaps).toBeLessThanOrEqual(row.missing_entries);
    expect(row.binding_rate).toBeLessThanOrEqual(row.missing_entry_rate);
    // The response must carry the caveat: missing_entry_rate counts unchosen
    // alternatives in satisfied choice lists and overstates real gaps.
    expect(body.note).toMatch(/overstates/);
    expect(body.note).toMatch(/binding_rate/);
  });

  it('scopes to a program', async () => {
    const hit = await call(maryland.collegeRollup, { query: { major: 'Computer Science, B.S.' } });
    expect(hit.body.rows).toHaveLength(1);
    const miss = await call(maryland.collegeRollup, { query: { major: 'Basket Weaving' } });
    expect(miss.body.rows).toHaveLength(0);
  });
});

describe('GET /md/coverage-matrix', () => {
  it('returns one verdict row per matching agreement and requires q', async () => {
    const { body } = await call(maryland.coverageMatrix, { query: { q: 'computer science' } });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      college_name: 'Montgomery College', complete: false,
    });
    expect(body.rows[0].university_name).toBeTruthy();
    const bare = await call(maryland.coverageMatrix);
    expect(bare.status).toBe(400);
  });
});

describe('source provenance', () => {
  // Every agreement must be traceable to the ARTSYS page it was parsed from,
  // otherwise a reader has no way to check the import against the source.
  it('reconstructs the exact guide URL from stored fields', async () => {
    const { body } = await call(maryland.getAgreement, { params: { id: 'md:agr:3354:1768' } });
    expect(body.source_url)
      .toBe('https://artsys.usmd.edu/program_transfer_guides/3354?sender_university_id=1768');
  });

  it('includes it on list rows too', async () => {
    const { body } = await call(maryland.listAgreements, { query: { college_id: 'md:cc:1768' } });
    expect(body.rows[0].source_url).toContain('/program_transfer_guides/3354');
    const withVerdicts = await call(maryland.listAgreements,
      { query: { college_id: 'md:cc:1768', verdicts: '1' } });
    expect(withVerdicts.body.rows[0].source_url).toContain('sender_university_id=1768');
  });

  it('returns null rather than a broken URL when fields are missing', () => {
    expect(maryland.sourceUrl({})).toBeNull();
    expect(maryland.sourceUrl(null)).toBeNull();
  });
});

describe('isolation', () => {
  it('reads only artsys_ collections', () => {
    expect(Object.values(maryland.COLLECTIONS).every((n) => n.startsWith('artsys_'))).toBe(true);
  });
});
