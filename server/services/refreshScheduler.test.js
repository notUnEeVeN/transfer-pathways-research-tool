import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { createRefreshScheduler, markDirtyOnWrite, setRunnerPaused, getRunnerPaused } = cjs('./refreshScheduler');
const { upsertScript, recordRun, getScript } = cjs('./figureScripts');
const { _resetDatasetVersionCache } = cjs('./datasetVersion');

let mongo;
let db;
let runLive; // stubbed runtime call
let scheduler;

const setVersion = async (v) => {
  await db.collection('dataset_meta').updateOne(
    { _id: 'current' }, { $set: { dataset_version: v } }, { upsert: true });
  _resetDatasetVersionCache();
};

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('scheduler_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });

beforeEach(async () => {
  for (const c of ['figure_scripts', 'figure_runs', 'dataset_meta', 'dataset_config']) {
    await db.collection(c).deleteMany({});
  }
  _resetDatasetVersionCache();
  runLive = vi.fn(async () => ({ ok: true, status: 'ok', consecutive_failures: 0 }));
  scheduler = createRefreshScheduler({
    db, auditDb: db,
    runtime: { runLive: (opts) => runLive(opts) },
    log: { warn: () => {} },
  });
});

const addScript = async (slug, { enabled = true, lastVersion = null } = {}) => {
  await upsertScript(db, slug, `# ${slug}`, { uid: 'author-1', enabled });
  if (lastVersion) {
    await recordRun(db, slug, { status: 'ok', trigger: 'publish', log: '', dataset_version: lastVersion });
  }
};

describe('pollTick (dataset version watcher)', () => {
  it('boot reconcile: re-runs only scripts whose last run predates the current version', async () => {
    await setVersion('v2');
    await addScript('fresh', { lastVersion: 'v2' });
    await addScript('stale', { lastVersion: 'v1' });
    await addScript('never-ran');

    await scheduler.pollTick();
    const slugs = runLive.mock.calls.map(([o]) => o.expectedSlug).sort();
    expect(slugs).toEqual(['never-ran', 'stale']);
    expect(runLive.mock.calls[0][0].trigger).toBe('dataset');
    // code + identity are resolved lazily inside the run queue
    const src = await runLive.mock.calls[0][0].loadCode();
    expect(src.runsAs).toBe('author-1');
    expect(src.code).toContain('#');
  });

  it('does nothing while the version stays put, runs stale scripts on a bump', async () => {
    await setVersion('v1');
    await addScript('fig', { lastVersion: 'v1' });
    await scheduler.pollTick();
    expect(runLive).not.toHaveBeenCalled();

    await scheduler.pollTick();
    expect(runLive).not.toHaveBeenCalled();

    await setVersion('v2');
    await scheduler.pollTick();
    expect(runLive).toHaveBeenCalledOnce();
  });

  it('skips disabled scripts entirely', async () => {
    await setVersion('v2');
    await addScript('off', { enabled: false, lastVersion: 'v1' });
    await scheduler.pollTick();
    expect(runLive).not.toHaveBeenCalled();
  });

  it('while paused nothing runs, and the catch-up happens after unpausing', async () => {
    await setVersion('v2');
    await addScript('fig', { lastVersion: 'v1' });
    await setRunnerPaused(db, true);

    await scheduler.pollTick();
    expect(runLive).not.toHaveBeenCalled();

    await setRunnerPaused(db, false);
    await scheduler.pollTick();
    expect(runLive).toHaveBeenCalledOnce();
  });

  it('keeps sweeping the rest when one script rejects (queue full etc.)', async () => {
    await setVersion('v2');
    await addScript('a', { lastVersion: 'v1' });
    await addScript('b', { lastVersion: 'v1' });
    runLive = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'QUEUE_FULL' }))
      .mockResolvedValue({ ok: true, status: 'ok', consecutive_failures: 0 });
    await scheduler.pollTick();
    expect(runLive).toHaveBeenCalledTimes(2);
  });

  it('a script whose run failed or was skipped is retried on the NEXT poll, not the next bump', async () => {
    await setVersion('v2');
    await addScript('flaky', { lastVersion: 'v1' });
    runLive = vi.fn(async () => ({ ok: false, status: 'error', consecutive_failures: 1 }));
    await scheduler.pollTick();
    expect(runLive).toHaveBeenCalledTimes(1);
    // still stale (no successful compute at v2 recorded) → poll again retries
    await scheduler.pollTick();
    expect(runLive).toHaveBeenCalledTimes(2);
  });

  it('reads the dataset version fresh (not through the 30s module cache)', async () => {
    await setVersion('v1');
    await addScript('fig', { lastVersion: 'v1' });
    await scheduler.pollTick(); // warms the module cache at v1
    // bump WITHOUT resetting the module cache — the scheduler must see it anyway
    await db.collection('dataset_meta').updateOne({ _id: 'current' }, { $set: { dataset_version: 'v2' } });
    await scheduler.pollTick();
    expect(runLive).toHaveBeenCalledOnce();
  });
});

describe('sweepTick (curation drift)', () => {
  it('runs all enabled scripts once after markDirty, then goes quiet', async () => {
    await setVersion('v1');
    await addScript('fig', { lastVersion: 'v1' }); // fresh — curation sweep runs it anyway

    await scheduler.sweepTick();
    expect(runLive).not.toHaveBeenCalled();

    scheduler.markDirty();
    await scheduler.sweepTick();
    expect(runLive).toHaveBeenCalledOnce();
    expect(runLive.mock.calls[0][0].trigger).toBe('curation');

    await scheduler.sweepTick();
    expect(runLive).toHaveBeenCalledOnce();
  });

  it('stays dirty while paused so the sweep happens after unpausing', async () => {
    await setVersion('v1');
    await addScript('fig');
    scheduler.markDirty();
    await setRunnerPaused(db, true);
    await scheduler.sweepTick();
    expect(runLive).not.toHaveBeenCalled();

    await setRunnerPaused(db, false);
    await scheduler.sweepTick();
    expect(runLive).toHaveBeenCalledOnce();
  });

  it('restores the dirty flag when the sweep itself blows up, so the signal is not lost', async () => {
    const broken = createRefreshScheduler({
      db,
      auditDb: { collection: () => { throw new Error('mongo hiccup'); } },
      runtime: { runLive },
      log: { warn: () => {} },
    });
    broken.markDirty();
    await expect(broken.sweepTick()).rejects.toThrow('mongo hiccup');
    expect(broken.isDirty()).toBe(true);
  });
});

describe('failure breaker', () => {
  it('auto-disables a script after the failure streak crosses the limit', async () => {
    await setVersion('v2');
    await addScript('flaky', { lastVersion: 'v1' });
    runLive = vi.fn(async () => ({ ok: false, status: 'error', consecutive_failures: 5 }));
    await scheduler.pollTick();
    expect((await getScript(db, 'flaky')).enabled).toBe(false);
  });

  it('leaves the script enabled below the limit', async () => {
    await setVersion('v2');
    await addScript('flaky', { lastVersion: 'v1' });
    runLive = vi.fn(async () => ({ ok: false, status: 'error', consecutive_failures: 4 }));
    await scheduler.pollTick();
    expect((await getScript(db, 'flaky')).enabled).toBe(true);
  });
});

describe('markDirtyOnWrite middleware', () => {
  const fire = (method, path, statusCode = 200) => {
    const mw = markDirtyOnWrite(scheduler);
    const req = { method, path };
    const res = new EventEmitter();
    res.statusCode = statusCode;
    mw(req, res, () => {});
    res.emit('finish');
  };

  it('flags successful writes to curation, audit verdicts, and visible-majors', () => {
    for (const [m, p] of [
      ['PUT', '/curation/categories/x'],
      ['DELETE', '/curation/assoc-degrees/3'],
      ['POST', '/audit/verify'],
      ['PUT', '/admin/visible-majors'],
    ]) {
      scheduler._clearDirty();
      fire(m, p);
      expect(scheduler.isDirty(), `${m} ${p}`).toBe(true);
    }
  });

  it('ignores reads, unrelated paths, and failed writes', () => {
    for (const [m, p, s] of [
      ['GET', '/curation/categories', 200],
      ['POST', '/figures', 200],
      ['POST', '/figure-scripts', 200],
      ['PUT', '/curation/categories/x', 500],
      ['POST', '/audit/verify', 403],
    ]) {
      scheduler._clearDirty();
      fire(m, p, s);
      expect(scheduler.isDirty(), `${m} ${p} ${s}`).toBe(false);
    }
  });
});

describe('runner pause state', () => {
  it('round-trips through dataset_config', async () => {
    expect(await getRunnerPaused(db)).toBe(false);
    await setRunnerPaused(db, true);
    expect(await getRunnerPaused(db)).toBe(true);
    await setRunnerPaused(db, false);
    expect(await getRunnerPaused(db)).toBe(false);
  });
});
