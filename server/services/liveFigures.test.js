import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { createFigureRuntime } = cjs('./liveFigures');
const { upsertScript, getScript, removeScript } = cjs('./figureScripts');
const { upsertFigure } = cjs('./figures');
const { _resetDatasetVersionCache } = cjs('./datasetVersion');

let mongo;
let db;

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
const captured = (over = {}) => ({
  slug: 'fig-a', title: 'T', caption: null, source_url: null,
  dataset_version: null, formats: { svg: SVG }, ...over,
});
const ok = (payload) => ({ status: 'ok', exitCode: 0, log: 'fine', durationMs: 10, captured: payload });

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('live_figures_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => {
  for (const c of ['figures', 'figure_scripts', 'figure_runs', 'dataset_meta']) {
    await db.collection(c).deleteMany({});
  }
  await db.collection('dataset_meta').insertOne({ _id: 'current', dataset_version: 'v1' });
  _resetDatasetVersionCache();
});

describe('runLive', () => {
  it('loadCode is resolved inside the queued job, so a republished script wins over a stale snapshot', async () => {
    await upsertScript(db, 'fig-a', 'NEW CODE', { uid: 'u1', enabled: true });
    const runScript = vi.fn(async (opts) => ok(captured()));
    const runtime = createFigureRuntime({ db, auditDb: db, runScript });
    const out = await runtime.runLive({
      trigger: 'manual',
      expectedSlug: 'fig-a',
      loadCode: async () => {
        const s = await getScript(db, 'fig-a');
        return s && { code: s.code, runsAs: s.updated_by };
      },
    });
    expect(out.ok).toBe(true);
    expect(runScript.mock.calls[0][0].code).toBe('NEW CODE');
    expect(runScript.mock.calls[0][0].uid).toBe('u1');
  });

  it('a run whose script was removed mid-flight stores and records nothing', async () => {
    await upsertScript(db, 'fig-a', 'CODE', { uid: 'u1', enabled: true });
    await upsertFigure(db, captured(), { author_uid: 'u1', author_label: 'U' });
    const runScript = vi.fn(async () => {
      await removeScript(db, 'fig-a'); // owner detaches while the run executes
      await db.collection('figures').deleteMany({ _id: 'fig-a' }); // …or deletes outright
      return ok(captured({ formats: { svg: SVG } }));
    });
    const runtime = createFigureRuntime({ db, auditDb: db, runScript });
    const out = await runtime.runLive({
      code: 'CODE', runsAs: 'u1', trigger: 'dataset', expectedSlug: 'fig-a',
    });
    expect(out.ok).toBe(false);
    expect(out.log).toMatch(/removed while/i);
    expect(await db.collection('figures').countDocuments({})).toBe(0); // not resurrected
    expect(await db.collection('figure_runs').countDocuments({})).toBe(0);
  });

  it('loadCode returning nothing aborts before spawning anything', async () => {
    const runScript = vi.fn();
    const runtime = createFigureRuntime({ db, auditDb: db, runScript });
    const out = await runtime.runLive({
      trigger: 'manual', expectedSlug: 'ghost', loadCode: async () => null,
    });
    expect(out.ok).toBe(false);
    expect(runScript).not.toHaveBeenCalled();
  });
});
