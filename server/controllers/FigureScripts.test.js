import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { publish, get, refresh, setEnabled, detach, runs } = cjs('./FigureScripts');
const figuresController = cjs('./Figures');
const { createFigureRuntime } = cjs('../services/liveFigures');
const { _resetDatasetVersionCache } = cjs('../services/datasetVersion');

let mongo;
let db;
let runtime;
let runStub; // per-test runner behavior; runtime delegates here

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
const SVG2 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>').toString('base64');

const okResult = (captured, over = {}) => ({
  status: 'ok', exitCode: 0, log: 'ran fine', durationMs: 1234, captured, ...over,
});
const capturedPayload = (over = {}) => ({
  slug: 'live-fig', title: 'Live figure', caption: null, source_url: null,
  dataset_version: null, formats: { svg: SVG }, ...over,
});

beforeAll(async () => {
  process.env.ADMIN_UIDS = 'admin1';
  mongo = await startInMemoryMongo();
  db = mongo.client.db('figure_scripts_ctrl_test');
  runtime = createFigureRuntime({
    db, auditDb: db,
    runScript: (opts) => runStub(opts),
    queueOpts: { concurrency: 1, maxPending: 0 },
  });
});
afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  for (const c of ['figures', 'figure_scripts', 'figure_runs', 'dataset_meta', 'access_grants']) {
    await db.collection(c).deleteMany({});
  }
  await db.collection('dataset_meta').insertOne({ _id: 'current', dataset_version: '2026-07-01-v1' });
  _resetDatasetVersionCache();
  runStub = vi.fn(async () => okResult(capturedPayload()));
});

function fakeReq(user, { body = {}, params = {} } = {}) {
  return {
    user, body, params,
    protocol: 'https',
    get: (h) => (h.toLowerCase() === 'host' ? 'api.example.test' : undefined),
    app: { locals: { db, auditDb: db, figureRuntime: runtime } },
  };
}

function fakeRes() {
  return {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    sendStatus(c) { this.statusCode = c; this.body = String(c); return this; },
    json(o) { this.body = o; return this; },
  };
}

const run = (handler, req) => new Promise((resolve, reject) => {
  const res = fakeRes();
  const maybe = handler(req, res, (err) => (err ? reject(err) : resolve(res)));
  Promise.resolve(maybe).then(() => resolve(res), reject);
});

const CODE = 'import pmt\n# build fig\npmt.publish(fig, "live-fig", "Live figure")\n';

describe('POST /figure-scripts (publish a live figure)', () => {
  it('dry-runs the script, stores figure + script + run, marks it live', async () => {
    const res = await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, slug: 'live-fig', dataset_version: '2026-07-01-v1' });
    expect(res.body.log).toContain('ran fine');

    const fig = await db.collection('figures').findOne({ _id: 'live-fig' });
    expect(fig.mode).toBe('live');
    expect(fig.live.status).toBe('ok');
    expect(fig.author_uid).toBe('u1');
    expect(fig.formats.svg).toBe(SVG);

    const script = await db.collection('figure_scripts').findOne({ _id: 'live-fig' });
    expect(script.code).toBe(CODE);
    expect(script.enabled).toBe(true);
    expect(script.last_run.status).toBe('ok');
    expect(script.last_run.trigger).toBe('publish');

    expect(await db.collection('figure_runs').countDocuments({ slug: 'live-fig' })).toBe(1);
    expect(runStub).toHaveBeenCalledOnce();
    expect(runStub.mock.calls[0][0].uid).toBe('u1');
  });

  it('respects enabled=false (published but not auto-refreshed)', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE, enabled: false } }));
    expect((await db.collection('figure_scripts').findOne({ _id: 'live-fig' })).enabled).toBe(false);
  });

  it('a failing script publishes nothing and returns the log', async () => {
    runStub = vi.fn(async () => ({ status: 'error', exitCode: 1, log: 'Traceback: boom', durationMs: 90, captured: null }));
    const res = await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    expect(res.statusCode).toBe(422);
    expect(res.body.log).toContain('boom');
    expect(await db.collection('figures').countDocuments({})).toBe(0);
    expect(await db.collection('figure_scripts').countDocuments({})).toBe(0);
    expect(await db.collection('figure_runs').countDocuments({})).toBe(0);
  });

  it('a script that never calls publish() is rejected with a pointed message', async () => {
    runStub = vi.fn(async () => okResult(null));
    const res = await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    expect(res.statusCode).toBe(422);
    expect(res.body.log).toContain('pmt.publish');
    expect(await db.collection('figure_scripts').countDocuments({})).toBe(0);
  });

  it('a captured payload that fails figure validation is rejected', async () => {
    runStub = vi.fn(async () => okResult(capturedPayload({ slug: 'Bad Slug!' })));
    const res = await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    expect(res.statusCode).toBe(422);
    expect(await db.collection('figures').countDocuments({})).toBe(0);
  });

  it('rejects hardcoded tokens before running anything', async () => {
    const bad = `TOKEN = "pmtr_${'a'.repeat(32)}"\n${CODE}`;
    const res = await run(publish, fakeReq({ uid: 'u1' }, { body: { code: bad } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('PMT_TOKEN');
    expect(runStub).not.toHaveBeenCalled();
  });

  it("forbids capturing someone else's slug (figure hijack)", async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    const res = await run(publish, fakeReq({ uid: 'u2' }, { body: { code: CODE } }));
    expect(res.statusCode).toBe(403);
    const fig = await db.collection('figures').findOne({ _id: 'live-fig' });
    expect(fig.author_uid).toBe('u1');
    expect((await db.collection('figure_scripts').findOne({ _id: 'live-fig' })).updated_by).toBe('u1');
  });

  it('lets an admin republish over anyone', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    const res = await run(publish, fakeReq({ uid: 'admin1' }, { body: { code: CODE } }));
    expect(res.statusCode).toBe(200);
    expect((await db.collection('figures').findOne({ _id: 'live-fig' })).author_uid).toBe('admin1');
  });

  it('answers 429 when the runner queue is saturated', async () => {
    let release;
    runStub = vi.fn(() => new Promise((r) => { release = () => r(okResult(capturedPayload())); }));
    const first = run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    await vi.waitFor(() => expect(runStub).toHaveBeenCalledOnce());
    const res = await run(publish, fakeReq({ uid: 'u2' }, { body: { code: CODE } }));
    expect(res.statusCode).toBe(429);
    release();
    expect((await first).statusCode).toBe(200);
  });
});

describe('GET /figure-scripts/:slug (view code)', () => {
  beforeEach(async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
  });

  it('shows any console user the code and run status', async () => {
    const res = await run(get, fakeReq({ uid: 'u2' }, { params: { slug: 'live-fig' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe(CODE);
    expect(res.body.enabled).toBe(true);
    expect(res.body.last_run.status).toBe('ok');
  });

  it('hides the run log from non-owners, shows it to owner and admin', async () => {
    expect((await run(get, fakeReq({ uid: 'u2' }, { params: { slug: 'live-fig' } }))).body.last_run.log).toBeUndefined();
    expect((await run(get, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' } }))).body.last_run.log).toContain('ran fine');
    expect((await run(get, fakeReq({ uid: 'admin1' }, { params: { slug: 'live-fig' } }))).body.last_run.log).toContain('ran fine');
  });

  it('404s on a slug with no script (static figures included)', async () => {
    expect((await run(get, fakeReq({ uid: 'u1' }, { params: { slug: 'ghost' } }))).statusCode).toBe(404);
  });
});

describe('POST /figure-scripts/:slug/refresh', () => {
  beforeEach(async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
  });

  it('re-runs as the script author and updates the stored render', async () => {
    runStub = vi.fn(async () => okResult(capturedPayload({ formats: { svg: SVG2 } })));
    const res = await run(refresh, fakeReq({ uid: 'admin1' }, { params: { slug: 'live-fig' } }));
    expect(res.statusCode).toBe(200);
    expect(runStub.mock.calls[0][0].uid).toBe('u1'); // author's data scope, not the admin's
    const fig = await db.collection('figures').findOne({ _id: 'live-fig' });
    expect(fig.formats.svg).toBe(SVG2);
    const runsCount = await db.collection('figure_runs').countDocuments({ slug: 'live-fig', trigger: 'manual' });
    expect(runsCount).toBe(1);
  });

  it('a failed refresh keeps the last good render and flips live.status to error', async () => {
    runStub = vi.fn(async () => ({ status: 'timeout', exitCode: null, log: 'killed', durationMs: 60_000, captured: null }));
    const res = await run(refresh, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' } }));
    expect(res.statusCode).toBe(422);
    const fig = await db.collection('figures').findOne({ _id: 'live-fig' });
    expect(fig.live.status).toBe('error');
    expect(fig.formats.svg).toBe(SVG); // last good render intact
    expect((await db.collection('figure_scripts').findOne({ _id: 'live-fig' })).consecutive_failures).toBe(1);
  });

  it('rejects a refresh whose script publishes a different slug', async () => {
    runStub = vi.fn(async () => okResult(capturedPayload({ slug: 'other-fig' })));
    const res = await run(refresh, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' } }));
    expect(res.statusCode).toBe(422);
    expect(res.body.log).toContain('other-fig');
    expect(await db.collection('figures').countDocuments({ _id: 'other-fig' })).toBe(0);
  });

  it('forbids non-owners from triggering refreshes', async () => {
    const res = await run(refresh, fakeReq({ uid: 'u2' }, { params: { slug: 'live-fig' } }));
    expect(res.statusCode).toBe(403);
    expect(runStub).toHaveBeenCalledOnce(); // only the publish, not the refresh
  });

  it('404s when there is no script', async () => {
    expect((await run(refresh, fakeReq({ uid: 'u1' }, { params: { slug: 'ghost' } }))).statusCode).toBe(404);
  });
});

describe('PUT /figure-scripts/:slug/enabled + DELETE /figure-scripts/:slug', () => {
  beforeEach(async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
  });

  it('owner toggles auto-refresh off and on', async () => {
    const off = await run(setEnabled, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' }, body: { enabled: false } }));
    expect(off.statusCode).toBe(200);
    expect((await db.collection('figure_scripts').findOne({ _id: 'live-fig' })).enabled).toBe(false);
    await run(setEnabled, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' }, body: { enabled: true } }));
    expect((await db.collection('figure_scripts').findOne({ _id: 'live-fig' })).enabled).toBe(true);
  });

  it('rejects non-boolean bodies and non-owners', async () => {
    expect((await run(setEnabled, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' }, body: {} }))).statusCode).toBe(400);
    expect((await run(setEnabled, fakeReq({ uid: 'u2' }, { params: { slug: 'live-fig' }, body: { enabled: false } }))).statusCode).toBe(403);
  });

  it('detach removes script + runs but keeps the figure as a static snapshot', async () => {
    const res = await run(detach, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' } }));
    expect(res.statusCode).toBe(200);
    expect(await db.collection('figure_scripts').countDocuments({})).toBe(0);
    expect(await db.collection('figure_runs').countDocuments({})).toBe(0);
    const fig = await db.collection('figures').findOne({ _id: 'live-fig' });
    expect(fig).not.toBeNull();
    expect(fig.mode).toBeUndefined();
    expect(fig.live).toBeUndefined();
  });

  it('forbids detach by non-owners', async () => {
    expect((await run(detach, fakeReq({ uid: 'u2' }, { params: { slug: 'live-fig' } }))).statusCode).toBe(403);
    expect(await db.collection('figure_scripts').countDocuments({})).toBe(1);
  });
});

describe('GET /figure-scripts/:slug/runs', () => {
  beforeEach(async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
  });

  it('owner and admin see the run history; others are refused', async () => {
    expect((await run(runs, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' } }))).body.runs).toHaveLength(1);
    expect((await run(runs, fakeReq({ uid: 'admin1' }, { params: { slug: 'live-fig' } }))).body.runs).toHaveLength(1);
    expect((await run(runs, fakeReq({ uid: 'u2' }, { params: { slug: 'live-fig' } }))).statusCode).toBe(403);
  });
});

describe('static ↔ live interplay (Figures controller)', () => {
  const staticBody = { slug: 'live-fig', title: 'Static overwrite', formats: { svg: SVG } };

  it('lets the OWNER static-publish onto their live slug (local iteration keeps working)', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    const res = await run(figuresController.publish, fakeReq({ uid: 'u1' }, { body: staticBody }));
    expect(res.statusCode).toBe(200);
    const fig = await db.collection('figures').findOne({ _id: 'live-fig' });
    expect(fig.title).toBe('Static overwrite'); // render replaced now; next refresh re-syncs
    expect(await db.collection('figure_scripts').countDocuments({ _id: 'live-fig' })).toBe(1); // script untouched
  });

  it("blocks OTHERS from static-publishing onto someone's live slug", async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    const res = await run(figuresController.publish, fakeReq({ uid: 'u2' }, { body: staticBody }));
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('live');
    expect((await db.collection('figures').findOne({ _id: 'live-fig' })).title).toBe('Live figure');
  });

  it('deleting a live figure cascades to its script and runs', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: { code: CODE } }));
    const res = await run(figuresController.remove, fakeReq({ uid: 'u1' }, { params: { slug: 'live-fig' } }));
    expect(res.statusCode).toBe(200);
    expect(await db.collection('figures').countDocuments({})).toBe(0);
    expect(await db.collection('figure_scripts').countDocuments({})).toBe(0);
    expect(await db.collection('figure_runs').countDocuments({})).toBe(0);
  });
});
