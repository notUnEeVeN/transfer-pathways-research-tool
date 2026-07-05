/**
 * Live-figure runtime — the one pipeline every script execution goes through,
 * whether triggered by pmt.publish("file.py", ...), the card's Refresh button,
 * or the scheduler.
 *
 *   run the script (queued, as its author) → validate the captured publish
 *   payload → authorize → store figure + script → record the run.
 *
 * Storage outcomes by trigger:
 *   - publish: nothing is stored unless the dry-run succeeds end-to-end, so a
 *     failed first publish leaves zero residue.
 *   - refresh/scheduled (expectedSlug set): failures keep the last good render,
 *     flip live.status to 'error', and are recorded so the breaker can count.
 *
 * One runtime instance exists per process (app.locals.figureRuntime), created
 * at boot; tests inject a stub runScript and their own queue bounds.
 */
const { runAsUser, createRunQueue } = require('./figureRunner');
const { pmtPy } = require('../client/pmtPy');
const {
  validateFigurePayload, resolveAuthorLabel, upsertFigure, markFigureLive,
} = require('./figures');
const { upsertScript, recordRun, getScript } = require('./figureScripts');
const { currentDatasetVersion } = require('./datasetVersion');

const INTERACTIVE_TIMEOUT_MS = 60 * 1000;
const SCHEDULED_TIMEOUT_MS = 120 * 1000;

function createFigureRuntime({
  db,
  auditDb,
  runScript = runAsUser,
  pythonBin = process.env.PYTHON_BIN || 'python3',
  port = process.env.PORT || 3000,
  queueOpts = { concurrency: 1, maxPending: 8 },
} = {}) {
  // Scripts talk to this same server over loopback; the rendered pmt.py bakes
  // the loopback base in AND the runner sets PMT_API_URL, so even a script
  // bundling its own stale pmt.py copy lands on the right host.
  const apiBaseUrl = `http://127.0.0.1:${port}`;
  const pmtSource = pmtPy(apiBaseUrl);
  const queue = createRunQueue(queueOpts);

  /**
   * Execute a script as its author and store the outcome.
   *   code/runsAs — the script text and executing identity (publish path), OR
   *   loadCode    — async () => ({ code, runsAs } | null), resolved INSIDE the
   *                 queued job so a republish that lands while this run waits
   *                 in line wins over a stale snapshot (refresh/scheduled).
   *   expectedSlug — set for refresh/scheduled runs: the captured slug must
   *                  match, and failures are recorded against it.
   *   authorize(slug) — publish-time ownership check, called after capture
   *                  validation and before anything is stored.
   *   storeScript — {uid, enabled} to upsert the script doc (publish only).
   * Rejects with err.code 'QUEUE_FULL' when the runner is saturated.
   */
  async function runLive({ code, runsAs, trigger, expectedSlug = null, authorize = null, storeScript = null, loadCode = null, timeoutMs = INTERACTIVE_TIMEOUT_MS }) {
    const started_at = new Date();
    const run = await queue.push(async () => {
      const src = loadCode ? await loadCode() : { code, runsAs };
      if (!src) return { src: null, result: null };
      const result = await runScript({
        auditDb, uid: src.runsAs, code: src.code, pmtSource, pythonBin, apiBaseUrl, timeoutMs,
      });
      return { src, result };
    });
    if (!run.src) {
      // The script vanished before its turn (detached/deleted) — nothing ran.
      return { ok: false, status: 'skipped', log: '[runner] the script no longer exists — nothing ran', duration_ms: 0 };
    }
    const effectiveRunsAs = run.src.runsAs ?? null;
    const result = run.result;
    const base = { status: result.status, log: result.log, duration_ms: result.durationMs };

    // Delete/detach can land while a run is in flight; storing or recording
    // afterwards would resurrect the figure. Publish runs (no expectedSlug)
    // are exempt — creating the docs is their whole point.
    const stillLive = async () => !expectedSlug || !!(await getScript(auditDb, expectedSlug));

    const fail = async (note) => {
      const log = note ? `${result.log}\n[runner] ${note}` : result.log;
      const out = { ...base, ok: false, log };
      if (expectedSlug && (await stillLive())) {
        await markFigureLive(auditDb, expectedSlug, { status: 'error' });
        out.consecutive_failures = await recordRun(auditDb, expectedSlug, {
          status: result.status === 'ok' ? 'error' : result.status,
          trigger, started_at, duration_ms: result.durationMs, log,
        });
      }
      return out;
    };

    if (result.status !== 'ok') return fail();
    if (!result.captured) return fail('the script finished without calling pmt.publish()');

    const { error, value } = validateFigurePayload(result.captured);
    if (error) return fail(`publish payload rejected: ${error}`);
    if (expectedSlug && value.slug !== expectedSlug) {
      return fail(`this live figure is '${expectedSlug}' but the script publishes '${value.slug}' — slugs must match`);
    }
    if (authorize && (await authorize(value.slug)) !== true) {
      return { ...base, ok: false, forbidden: true, slug: value.slug };
    }
    if (!(await stillLive())) {
      return { ...base, ok: false, log: `${result.log}\n[runner] the script was removed while running — nothing stored` };
    }

    if (!value.dataset_version) value.dataset_version = await currentDatasetVersion(db);
    const author_label = await resolveAuthorLabel(auditDb, { uid: effectiveRunsAs });
    if (storeScript) await upsertScript(auditDb, value.slug, run.src.code, storeScript);
    await upsertFigure(auditDb, value, { author_uid: effectiveRunsAs, author_label });
    await markFigureLive(auditDb, value.slug, { status: 'ok' });
    const consecutive_failures = await recordRun(auditDb, value.slug, {
      status: 'ok', trigger, started_at,
      duration_ms: result.durationMs, dataset_version: value.dataset_version, log: result.log,
    });

    return { ...base, ok: true, slug: value.slug, dataset_version: value.dataset_version, consecutive_failures };
  }

  return { runLive };
}

module.exports = { createFigureRuntime, INTERACTIVE_TIMEOUT_MS, SCHEDULED_TIMEOUT_MS };
