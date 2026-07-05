/**
 * Refresh scheduler — keeps live figures current without anyone asking.
 *
 * Two independent signals:
 *   1. dataset_version (pollTick) — port.py bumps it by writing Mongo directly
 *      from the admin's machine, so the server POLLS dataset_meta rather than
 *      expecting a webhook. On a change (or at boot), every enabled script
 *      whose last successful run predates the current version is re-run.
 *   2. curation drift (sweepTick) — audit verdicts, curation overlays, and
 *      visible-major changes alter analysis output WITHOUT a version bump.
 *      Successful writes to those routes set a dirty flag (markDirtyOnWrite);
 *      the sweeper re-runs all enabled scripts, at most once per interval.
 *
 * Guard rails: a per-figure failure streak trips a breaker (auto-disable, the
 * author re-enables after fixing), and admins can pause the whole runner via
 * dataset_config/figure_runner. While paused, version changes and dirtiness
 * are retained, not consumed — unpausing catches up on the next tick.
 *
 * Scripts run strictly one after another so a sweep never saturates the run
 * queue; interactive publishes just interleave.
 */
const { listEnabledScripts, setScriptEnabled, getScript } = require('./figureScripts');
const { _resetDatasetVersionCache } = require('./datasetVersion');
const { SCHEDULED_TIMEOUT_MS } = require('./liveFigures');

const CONFIG_COLLECTION = 'dataset_config';
const CONFIG_ID = 'figure_runner';

const DEFAULT_POLL_MS = 5 * 60 * 1000;
const DEFAULT_SWEEP_MS = 15 * 60 * 1000;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;

// Successful writes to these surfaces change analysis output without a
// dataset_version bump.
const DIRTYING_PATH_RE = /^\/(curation\/|audit\/verify|admin\/visible-majors)/;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function getRunnerPaused(auditDb) {
  const doc = await auditDb.collection(CONFIG_COLLECTION).findOne({ _id: CONFIG_ID }, { projection: { paused: 1 } });
  return !!doc?.paused;
}

async function setRunnerPaused(auditDb, paused, uid = null) {
  await auditDb.collection(CONFIG_COLLECTION).updateOne(
    { _id: CONFIG_ID },
    { $set: { paused: !!paused, updated_at: new Date(), updated_by: uid } },
    { upsert: true }
  );
  return !!paused;
}

function createRefreshScheduler({
  db,
  auditDb,
  runtime,
  pollMs = Number(process.env.FIGURE_REFRESH_POLL_MS) || DEFAULT_POLL_MS,
  sweepMs = Number(process.env.FIGURE_REFRESH_SWEEP_MS) || DEFAULT_SWEEP_MS,
  maxConsecutiveFailures = DEFAULT_MAX_CONSECUTIVE_FAILURES,
  log = console,
}) {
  let dirty = false;
  let timers = [];

  async function runOne(script, trigger) {
    try {
      const out = await runtime.runLive({
        trigger,
        expectedSlug: script.slug,
        timeoutMs: SCHEDULED_TIMEOUT_MS,
        // Resolved inside the run queue: a republish that lands while this run
        // waits in line supplies the newer code, and a detach aborts the run.
        loadCode: async () => {
          const fresh = await getScript(auditDb, script.slug);
          return fresh?.enabled ? { code: fresh.code, runsAs: fresh.updated_by ?? script.runs_as } : null;
        },
      });
      if (!out.ok && (out.consecutive_failures ?? 0) >= maxConsecutiveFailures) {
        await setScriptEnabled(auditDb, script.slug, false);
        log.warn(`[figures] auto-disabled '${script.slug}' after ${out.consecutive_failures} consecutive failed refreshes`);
      }
    } catch (e) {
      // QUEUE_FULL or an unexpected runner error — the sweep must outlive it,
      // and the script stays stale, so the next poll retries it.
      log.warn(`[figures] scheduled run for '${script.slug}' did not complete: ${e.message}`);
    }
  }

  // trigger 'dataset': only scripts without a successful compute at `current`.
  // Every poll is a reconcile pass, so failed or queue-rejected runs are
  // retried next tick (bounded by the failure breaker) instead of waiting for
  // the next version bump.
  // trigger 'curation': every enabled script (staleness is invisible here).
  async function runStale(trigger, current = null) {
    if (await getRunnerPaused(auditDb)) return { paused: true, ran: 0 };
    const scripts = await listEnabledScripts(auditDb);
    let ran = 0;
    for (const script of scripts) {
      if (trigger === 'dataset' && current && script.last_dataset_version === current) continue;
      await runOne(script, trigger); // strictly sequential — see module header
      ran += 1;
    }
    return { paused: false, ran };
  }

  async function pollTick() {
    // Read dataset_meta directly: currentDatasetVersion()'s 30s module cache
    // would silently cap the poll cadence and stamp stale versions on runs.
    const meta = await db.collection('dataset_meta')
      .findOne({ _id: 'current' }, { projection: { dataset_version: 1 } });
    const current = meta?.dataset_version ?? null;
    if (current == null) return; // no dataset yet — nothing to track
    _resetDatasetVersionCache(); // downstream version stamps see what we saw
    await runStale('dataset', current);
  }

  async function sweepTick() {
    if (!dirty) return;
    dirty = false;
    try {
      const { paused } = await runStale('curation');
      if (paused) dirty = true; // retained for the post-unpause sweep
    } catch (e) {
      dirty = true; // transient failure must not eat the curation signal
      throw e;
    }
  }

  function start() {
    const poll = setInterval(() => pollTick().catch((e) => log.warn(`[figures] poll failed: ${e.message}`)), pollMs);
    const sweep = setInterval(() => sweepTick().catch((e) => log.warn(`[figures] sweep failed: ${e.message}`)), sweepMs);
    for (const t of [poll, sweep]) t.unref?.();
    timers = [poll, sweep];
    // Boot reconcile right away — the caller starts us after listen(), so
    // loopback API calls from scripts already work.
    pollTick().catch((e) => log.warn(`[figures] boot reconcile failed: ${e.message}`));
  }

  function stop() {
    for (const t of timers) clearInterval(t);
    timers = [];
  }

  return {
    start,
    stop,
    pollTick,
    sweepTick,
    markDirty: () => { dirty = true; },
    isDirty: () => dirty,
    _clearDirty: () => { dirty = false; },
  };
}

// Express middleware: flag the scheduler after any successful write to a
// surface that feeds the analyses. Attached once, ahead of the API routes.
function markDirtyOnWrite(scheduler) {
  return (req, res, next) => {
    if (MUTATING_METHODS.has(req.method) && DIRTYING_PATH_RE.test(req.path)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) scheduler.markDirty();
      });
    }
    next();
  };
}

module.exports = { createRefreshScheduler, markDirtyOnWrite, getRunnerPaused, setRunnerPaused };
