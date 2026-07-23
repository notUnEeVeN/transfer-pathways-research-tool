// Characterization harness for the duplicated audit stats pipeline.
//
// controllers/Audit.js computes the same ~25-field stats payload TWICE:
//   - _statsData          — issues its own DB aggregations per call
//   - buildScope (inside _buildBootstrapPayload) — pure JS over data the
//                           bootstrap pre-fetched once
//
// These tests pin the current payloads against a seeded fixture (snapshot +
// hand-computed anchors) and, crucially, assert the two pipelines produce
// IDENTICAL stats for the same DB state. The cross-equality assertions are
// the safety net for the upcoming dedup: if both already agree, extracting a
// shared stats function is correct by construction; if they diverge, that is
// a latent bug to flag BEFORE refactoring.
//
// Stats are exercised via _statsData directly (its thin HTTP wrapper
// /audit/stats was removed as superseded by /audit/bootstrap); bootstrap stays
// driven through the getBootstrap handler. Both reuse existing exports.

// vitest globals (describe/it/expect/beforeAll/afterAll/beforeEach) are enabled
// via `globals: true` in vitest.config.mjs — no import needed.
const { ObjectId } = require('mongodb');
const { startInMemoryMongo } = require('../../test/mongoHarness');
const cache = require('../auditCache');
const Audit = require('../../controllers/Audit');
const { _statsData } = require('./stats');
const { parseFilter } = require('./filters');

// ───────── fixture builders ─────────

const oid = (n) => new ObjectId(String(n).padStart(24, '0'));
const GHOST_ID = oid(99); // verdict points here; no agreement doc seeded

// Use real configured campus/program pairs so these audit-pipeline
// characterizations exercise the same fail-closed scope as production.
const UCB = {
  id: 79,
  school: 'UC Berkeley',
  cs: 'Electrical Engineering & Computer Sciences, B.S.',
  bio: 'Molecular and Cell Biology, B.A.',
};
const UCD = {
  id: 89,
  school: 'UC Davis',
  cs: 'Computer Science B.S.',
  bio: 'Biological Sciences B.S.',
  econ: 'Economics A.B.',
};

// requirement_groups carrying exactly `nReceivers` receivers (only the
// receiver count drives the cell/propagation math).
function reqGroups(nReceivers) {
  return [{
    is_required: true,
    sections: [{ receivers: Array.from({ length: nReceivers }, (_, i) => ({ hash_id: `r${i}` })) }],
  }];
}

function agreement(id, over) {
  return {
    _id: oid(id),
    uc_school_id: UCB.id,
    uc_school: UCB.school,
    community_college: 'CC One',
    community_college_id: 1,
    major: UCB.cs,
    major_id: 'm-cs',
    raw_template_hash: 'hashA',
    template_fp: 'fpA',
    parser_output_hash: 'poA',
    requirement_groups: reqGroups(2),
    ...over,
  };
}

function verdict(docId, over) {
  return {
    doc_id: docId,
    system: 'uc',
    uc_school_id: UCB.id,
    uc_school: UCB.school,
    major: UCB.cs,
    major_id: 'm-cs',
    result: 'correct',
    source: 'verify',
    raw_template_hash: 'hashA',
    template_fp: 'fpA',
    parser_output_hash: 'poA',
    receivers_checked: 2,
    cells_in_error: 0,
    notes: '',
    resolution_notes: '',
    verified_at: '2026-05-01T00:00:00.000Z',
    ...over,
  };
}

// 8 agreements across 3 template clusters + an empty-rg doc + a no-hash doc.
const AGREEMENTS = [
  agreement(11),                                                        // cluster A (UCB/CS/hashA) ×3
  agreement(12),
  agreement(13),
  agreement(21, { major: UCB.bio, major_id: 'm-bio', raw_template_hash: 'hashB', template_fp: 'fpB', parser_output_hash: 'poB', requirement_groups: reqGroups(3) }), // cluster B
  agreement(31, { uc_school_id: UCD.id, uc_school: UCD.school, community_college: 'CC Two', community_college_id: 2, major: UCD.cs, raw_template_hash: 'hashC', template_fp: 'fpC', parser_output_hash: 'poC', requirement_groups: reqGroups(1) }), // cluster C ×2
  agreement(32, { uc_school_id: UCD.id, uc_school: UCD.school, community_college: 'CC Two', community_college_id: 2, major: UCD.cs, raw_template_hash: 'hashC', template_fp: 'fpC', parser_output_hash: 'poC', requirement_groups: reqGroups(1) }),
  agreement(41, { uc_school_id: UCD.id, uc_school: UCD.school, major: UCD.bio, major_id: 'm-bio', raw_template_hash: 'hashE', template_fp: 'fpE', parser_output_hash: 'poE', requirement_groups: [] }),          // empty rg → excluded from clusters, counted in total_docs
  agreement(51, { uc_school_id: UCD.id, uc_school: UCD.school, major: UCD.econ, major_id: 'm-econ', raw_template_hash: null, template_fp: 'fpNH', parser_output_hash: 'poNH', requirement_groups: reqGroups(2) }), // no raw_template_hash → excluded from clusters, counted in total_docs
];

// 7 verdicts: 5 live (one per tier + a resolved error) + 2 stale (hash drift, deleted doc).
const VERDICTS = [
  verdict(oid(11), { result: 'error', cells_in_error: 1, notes: 'err note', verified_at: '2026-05-01T00:00:00.000Z' }), // v1 live error
  verdict(oid(12), { result: 'conservative', verified_at: '2026-05-02T00:00:00.000Z' }),                                 // v2 live conservative
  verdict(oid(21), { result: 'correct', source: 'random_template_weighted', major: UCB.bio, major_id: 'm-bio', raw_template_hash: 'hashB', template_fp: 'fpB', parser_output_hash: 'poB', receivers_checked: 3, verified_at: '2026-05-03T00:00:00.000Z' }), // v3 live correct (direct)
  verdict(oid(31), { result: 'flagged', source: 'template', uc_school_id: UCD.id, uc_school: UCD.school, major: UCD.cs, raw_template_hash: 'hashC', template_fp: 'fpC', parser_output_hash: 'poC', receivers_checked: 1, verified_at: '2026-05-04T00:00:00.000Z' }), // v4 live flagged (NON-direct source)
  verdict(oid(32), { result: 'error', status: 'resolved', resolution_notes: 'fixed', uc_school_id: UCD.id, uc_school: UCD.school, major: UCD.cs, raw_template_hash: 'hashC', template_fp: 'fpC', parser_output_hash: 'poC', receivers_checked: 1, cells_in_error: 1, verified_at: '2026-05-05T00:00:00.000Z' }), // v5 live resolved error
  verdict(oid(13), { result: 'error', raw_template_hash: 'OLDHASH', cells_in_error: 1, verified_at: '2026-05-06T00:00:00.000Z' }), // v6 STALE (raw_template_hash drift vs current hashA)
  verdict(GHOST_ID, { result: 'error', uc_school_id: UCD.id, uc_school: UCD.school, major: UCD.econ, major_id: 'm-econ', raw_template_hash: 'hashX', template_fp: 'fpX', parser_output_hash: 'poX', receivers_checked: 1, cells_in_error: 1, verified_at: '2026-05-07T00:00:00.000Z' }), // v7 STALE (doc deleted)
];

// ───────── handler drivers ─────────

// Fake reqs run as the test admin (ADMIN_UIDS below). Major visibility is now
// a console-wide configured-pair scope, so these fixtures deliberately use
// canonical pairs; the scope helper itself is covered separately.
function makeReq(db, query) {
  return { query, user: { uid: 'test-admin' }, app: { locals: { db } } };
}
function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
async function callStats(db, query = {}) {
  cache.clear(); // both pipelines memoize 30s — clear so we read the seeded DB
  return _statsData(db, await parseFilter(makeReq(db, query)));
}
async function callBootstrap(db, query = {}) {
  cache.clear();
  const res = makeRes();
  await Audit.getBootstrap(makeReq(db, query), res);
  if (res.statusCode !== 200) throw new Error(`getBootstrap ${res.statusCode}: ${JSON.stringify(res.body)}`);
  return res.body;
}
async function callTemplateVariants(db, query = {}) {
  cache.clear();
  const res = makeRes();
  let nextErr;
  await Audit.getTemplateVariants(makeReq(db, query), res, (err) => { nextErr = err; }); // asyncHandler-wrapped
  if (nextErr) throw nextErr;
  if (res.statusCode !== 200) throw new Error(`getTemplateVariants ${res.statusCode}: ${JSON.stringify(res.body)}`);
  return res.body;
}
// Generic driver returning the full res (statusCode + body) — for handlers
// where the status code is part of what we're characterizing (groupings CRUD).
async function callHandler(handler, db, { query = {}, params = {}, body = {} } = {}) {
  cache.clear();
  const res = makeRes();
  let nextErr;
  await handler({ query, params, body, user: { uid: 'test-admin' }, app: { locals: { db } } }, res, (err) => { nextErr = err; });
  if (nextErr) throw nextErr;
  return res;
}

// ───────── snapshot normalization ─────────

// Recursively sort object keys so a pure refactor that preserves values but
// changes key insertion order keeps the snapshot green.
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  }
  return v;
}
// Strip non-deterministic fields: the random `next` sample doc, and the
// random sample_* identity on unaudited template-variant rows.
function stripVolatile(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  for (const scope of ['all', 'uc', 'grouping']) {
    const s = clone[scope];
    if (!s) continue;
    delete s.next;
    for (const tv of s.template_variants || []) {
      delete tv.sample_doc_id;
      delete tv.sample_cc;
      delete tv.sample_university_id;
    }
  }
  return clone;
}

// ───────── suite ─────────

let harness, db;

beforeAll(async () => {
  process.env.ADMIN_UIDS = 'test-admin';
  harness = await startInMemoryMongo();
  db = harness.client.db('pmt_audit_test');
}, 120000);

afterAll(async () => {
  if (harness) await harness.stop();
});

beforeEach(async () => {
  cache.clear();
  await db.collection('assist_agreements').deleteMany({});
  await db.collection('agreement_reviews').deleteMany({});
  await db.collection('assist_agreements').insertMany(AGREEMENTS.map((d) => ({ ...d, requirement_groups: d.requirement_groups.map((g) => ({ ...g })) })));
  await db.collection('agreement_reviews').insertMany(VERDICTS.map((v) => ({ ...v })));
});

describe('audit stats — _statsData (getStats)', () => {
  it('pins the hand-computable count anchors', async () => {
    const s = await callStats(db, { scope: 'all' });
    // Docs: 8 seeded (incl. empty-rg + no-hash). Live verdicts: v1-v5. Stale: v6,v7.
    expect(s.total_docs).toBe(8);
    expect(s.n_audited).toBe(5);
    expect(s.n_stale).toBe(2);
    expect(s.n_errors).toBe(2);        // v1 + v5 (resolved error still counts as Tier 3)
    expect(s.n_resolved).toBe(1);      // v5
    expect(s.n_conservative).toBe(1);  // v2
    expect(s.n_flagged).toBe(1);       // v4
    expect(s.n_correct).toBe(1);       // v3
    // Clusters: (UCB/CS/hashA), (UCB/Bio/hashB), (UCD/CS/hashC); empty-rg + no-hash excluded.
    expect(s.n_majors).toBe(3);
    expect(s.n_templates).toBe(3);
    expect(s.n_templates_audited).toBe(3);
    expect(s.n_templates_errors).toBe(2);   // clusters A + C have a live error
    expect(s.n_templates_correct).toBe(1);
    // Cells: receivers 2+2+2+3+1+1+0+2 = 13, ×2 = 26.
    expect(s.n_cells_total).toBe(26);
    expect(s.n_cells_audited).toBe(18);     // live rc 2+2+3+1+1 = 9, ×2
    expect(s.n_cells_in_error).toBe(2);     // v1 + v5
  });

  it('matches the pinned stats snapshot', async () => {
    const s = await callStats(db, { scope: 'all' });
    expect(sortKeys(s)).toMatchSnapshot();
  });

  // The strict analogue of n_random_clusters_error: random-sample clusters
  // whose worst verdict deviates AT ALL (error, conservative, or flagged).
  // Feeds the Stats page's strict-mismatch hero gauge (observed k/n).
  it('exports n_random_clusters_strict, counting non-error deviations too', async () => {
    await db.collection('agreement_reviews').deleteMany({});
    await db.collection('agreement_reviews').insertMany([
      // Cluster A (UCB/CS/hashA): worst = conservative → strict but NOT error.
      verdict(oid(11), { result: 'conservative' }),
      // Cluster B (UCB/Bio/hashB): correct → neither.
      verdict(oid(21), { result: 'correct', source: 'random_template_weighted', major: UCB.bio, major_id: 'm-bio', raw_template_hash: 'hashB', template_fp: 'fpB', parser_output_hash: 'poB', receivers_checked: 3 }),
    ]);
    const s = await callStats(db, { scope: 'all' });
    expect(s.n_random_clusters).toBe(2);
    expect(s.n_random_clusters_error).toBe(0);
    expect(s.n_random_clusters_strict).toBe(1);
  });
});

describe('audit bootstrap — buildScope (getBootstrap)', () => {
  it('returns all + uc payloads with grouping null', async () => {
    const b = await callBootstrap(db, {});
    expect(b.all).toBeTruthy();
    expect(b.uc).toBeTruthy();
    expect(b.grouping).toBeNull();
  });

  it('surfaces the expected tier rows', async () => {
    const b = await callBootstrap(db, {});
    expect(b.all.errors).toHaveLength(1);        // v1 (v5 resolved → excluded from rows)
    expect(b.all.conservative).toHaveLength(1);  // v2
    expect(b.all.flagged).toHaveLength(1);       // v4
    expect(b.all.stale).toHaveLength(2);         // v6 (raw_drift) + v7 (deleted)
    const reasons = b.all.stale.map((r) => r.reason).sort();
    expect(reasons).toEqual(['deleted', 'raw_drift']);
  });

  it('matches the pinned bootstrap snapshot', async () => {
    const b = await callBootstrap(db, {});
    expect(sortKeys(stripVolatile(b))).toMatchSnapshot();
  });
});

describe('dedup guard — _statsData stats === buildScope stats', () => {
  it('agrees for scope=all', async () => {
    const stats = await callStats(db, { scope: 'all' });
    const boot = await callBootstrap(db, {});
    expect(boot.all.stats).toEqual(stats);
  });

  it('agrees for scope=uc', async () => {
    const stats = await callStats(db, { scope: 'uc' });
    const boot = await callBootstrap(db, {});
    expect(boot.uc.stats).toEqual(stats);
  });

});

describe('audit template variants — _templateVariantsData (getTemplateVariants)', () => {
  it('buckets docs into template clusters with worst-tier result', async () => {
    const rows = await callTemplateVariants(db, { scope: 'all' });
    // Clusters: UCB/CS/hashA (3 docs, worst tier error), UCB/Bio/hashB (1, correct),
    // UCD/CS/hashC (2, error), UCD/Econ (no-hash doc → fp cluster, unaudited).
    // docEmpty (empty requirement_groups) is excluded.
    const byKey = Object.fromEntries(rows.map((r) => [`${r.school_id}|${r.major}`, r]));
    expect(rows).toHaveLength(4);
    expect(byKey[`${UCB.id}|${UCB.cs}`].result).toBe('error');
    expect(byKey[`${UCB.id}|${UCB.cs}`].n_docs).toBe(3);
    expect(byKey[`${UCB.id}|${UCB.bio}`].result).toBe('correct');
    expect(byKey[`${UCD.id}|${UCD.cs}`].result).toBe('error');
    expect(byKey[`${UCD.id}|${UCD.econ}`].result).toBeNull();        // unaudited cluster
    expect(byKey[`${UCD.id}|${UCD.econ}`].n_audited_docs).toBe(0);
  });

  it('matches the pinned template-variants snapshot', async () => {
    const rows = await callTemplateVariants(db, { scope: 'all' });
    expect(sortKeys(rows)).toMatchSnapshot();
  });
});

// Characterization for the bootstrap memory refactor (replacing the full
// uc_agreements .toArray() with a streamed pass + verdict-scoped doc reads).
// These pin the parts the snapshot strips (template sample identity) or doesn't
// isolate (per-cluster aggregates and stale enrichment read THROUGH the
// bootstrap, plus the grouping path's templates) so a behaviour drift in the
// rewrite fails loudly rather than silently. All assertions are green on the
// pre-refactor implementation.
describe('audit bootstrap — memory-refactor characterization', () => {
  it('populates template sample identity (a real in-cluster doc) for every row', async () => {
    const b = await callBootstrap(db, {});
    const tv = b.all.template_variants;
    expect(tv.length).toBeGreaterThan(0);
    for (const row of tv) {
      expect(row.sample_doc_id).toBeTruthy();
      expect(row.sample_cc).toBeTruthy();
      // bucket is keyed by school_id, so the sample doc's university id matches.
      expect(row.sample_university_id).toBe(row.school_id);
    }
    // The audited UCB/CS cluster surfaces one of its own docs (11,12,13).
    const csA = tv.find((r) => r.school_id === UCB.id && r.major === UCB.cs);
    expect(['000000000000000000000011', '000000000000000000000012', '000000000000000000000013'])
      .toContain(csA.sample_doc_id);
  });

  it('pins per-cluster doc/receiver/parser-shape/audited aggregates in the bootstrap payload', async () => {
    const b = await callBootstrap(db, {});
    const byKey = Object.fromEntries(b.all.template_variants.map((r) => [`${r.school_id}|${r.major}`, r]));
    // cluster A: docs 11,12,13; live verdicts v1(error)@11 + v2(cons)@12 (v6@13 is stale → unaudited here).
    expect(byKey[`${UCB.id}|${UCB.cs}`].n_docs).toBe(3);
    expect(byKey[`${UCB.id}|${UCB.cs}`].n_groups).toBe(1);
    expect(byKey[`${UCB.id}|${UCB.cs}`].n_receivers).toBe(2);
    expect(byKey[`${UCB.id}|${UCB.cs}`].n_parser_shapes).toBe(1);
    expect(byKey[`${UCB.id}|${UCB.cs}`].n_audited_docs).toBe(2);
    // cluster C: docs 31,32; v4(flagged)@31 + v5(resolved error)@32 → worst tier error.
    expect(byKey[`${UCD.id}|${UCD.cs}`].n_docs).toBe(2);
    expect(byKey[`${UCD.id}|${UCD.cs}`].n_audited_docs).toBe(2);
    expect(byKey[`${UCD.id}|${UCD.cs}`].result).toBe('error');
    // no-raw-hash doc 51 clusters by template_fp; unaudited.
    expect(byKey[`${UCD.id}|${UCD.econ}`].n_docs).toBe(1);
    expect(byKey[`${UCD.id}|${UCD.econ}`].n_audited_docs).toBe(0);
    expect(byKey[`${UCD.id}|${UCD.econ}`].result).toBeNull();
  });

  it('enriches in-scope stale (drift) rows from the agreement doc, nulls deleted ones', async () => {
    const b = await callBootstrap(db, {});
    const drift = b.all.stale.find((r) => r.reason === 'raw_drift'); // v6 @ doc 13
    expect(drift).toBeTruthy();
    expect(drift.major).toBe(UCB.cs);
    expect(drift.community_college).toBe('CC One');
    expect(drift.current_raw_template_hash).toBe('hashA');
    expect(drift.prior_raw_template_hash).toBe('OLDHASH');
    const deleted = b.all.stale.find((r) => r.reason === 'deleted'); // v7 ghost id
    expect(deleted.community_college).toBeNull();
    expect(deleted.major).toBe(UCD.econ); // falls back to the verdict's denormalized field
  });

});
