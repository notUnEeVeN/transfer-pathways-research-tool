/**
 * Figure scripts — the code behind LIVE figures.
 *
 * A live figure is a published figure (see figures.js) plus the script that
 * produced it. The runner (figureRunner.js) re-executes the script on data
 * changes; this module owns the script docs and the run log.
 *
 * Storage (audit handle):
 *   figure_scripts: { _id: slug, code, enabled, created_by, updated_by,
 *                     created_at, updated_at, consecutive_failures,
 *                     last_run: { status, trigger, started_at, duration_ms,
 *                                 dataset_version, log } | null,
 *                     history: [{ code, updated_by, updated_at }] }  // newest first
 *   figure_runs:    one doc per execution, same shape as last_run + slug,
 *                   TTL-expired after 30 days.
 */
const { TOKEN_LITERAL_RE } = require('./apiTokens');

const COLLECTION = 'figure_scripts';
const RUNS = 'figure_runs';

const MAX_CODE_BYTES = 200 * 1024;
const HISTORY_CAP = 20;
const LAST_RUN_LOG_CAP = 16 * 1024;
const RUNS_TTL_DAYS = 30;

function validateScriptCode(code) {
  if (typeof code !== 'string' || !code.trim()) return { error: 'code required (the script file contents)' };
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    return { error: 'script exceeds 200KB — figure scripts should be small, self-contained files' };
  }
  if (TOKEN_LITERAL_RE.test(code)) {
    // Stored scripts are peer-visible via "View code" — a pasted credential
    // would leak to every console user.
    return {
      error: 'the script contains a hardcoded API token — remove it; the runner provides '
        + 'credentials via the PMT_TOKEN environment variable (which pmt.py already reads)',
    };
  }
  return { value: code };
}

async function upsertScript(auditDb, slug, code, { uid, enabled = true }) {
  const now = new Date();
  const col = auditDb.collection(COLLECTION);
  const prev = await col.findOne({ _id: slug }, { projection: { code: 1, updated_by: 1, updated_at: 1 } });
  if (!prev) {
    await col.insertOne({
      _id: slug,
      code,
      enabled: !!enabled,
      created_by: uid ?? null,
      updated_by: uid ?? null,
      created_at: now,
      updated_at: now,
      consecutive_failures: 0,
      last_run: null,
      history: [],
    });
    return;
  }
  await col.updateOne(
    { _id: slug },
    {
      $set: { code, enabled: !!enabled, updated_by: uid ?? null, updated_at: now },
      $push: {
        history: {
          $each: [{ code: prev.code, updated_by: prev.updated_by ?? null, updated_at: prev.updated_at ?? null }],
          $position: 0,
          $slice: HISTORY_CAP,
        },
      },
    }
  );
}

// history (up to 20 prior full code copies) is write-only insurance — never
// served, so never fetched.
async function getScript(auditDb, slug) {
  return auditDb.collection(COLLECTION).findOne({ _id: slug }, { projection: { history: 0 } });
}

async function existsScript(auditDb, slug) {
  return !!(await auditDb.collection(COLLECTION).findOne({ _id: slug }, { projection: { _id: 1 } }));
}

async function setScriptEnabled(auditDb, slug, enabled) {
  // Re-enabling forgives the failure streak so the breaker starts fresh.
  const $set = enabled
    ? { enabled: true, consecutive_failures: 0 }
    : { enabled: false };
  const { matchedCount } = await auditDb.collection(COLLECTION).updateOne({ _id: slug }, { $set });
  return matchedCount > 0;
}

// Persist one execution: append to the run log, refresh the embedded
// last_run, and maintain the failure streak. Returns the streak so the
// scheduler can trip its breaker.
async function recordRun(auditDb, slug, run) {
  const started_at = run.started_at ?? new Date();
  const entry = {
    status: run.status,
    trigger: run.trigger ?? null,
    started_at,
    duration_ms: run.duration_ms ?? null,
    dataset_version: run.dataset_version ?? null,
    log: typeof run.log === 'string' ? run.log.slice(0, LAST_RUN_LOG_CAP) : '',
  };
  await auditDb.collection(RUNS).insertOne({ slug, ...entry });
  const ok = run.status === 'ok';
  // last_ok_dataset_version is the version of the render actually on display —
  // failures must not erase it, or the scheduler forgets what is stale.
  const update = ok
    ? { $set: { last_run: entry, consecutive_failures: 0, last_ok_dataset_version: entry.dataset_version } }
    : { $set: { last_run: entry }, $inc: { consecutive_failures: 1 } };
  const doc = await auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: slug },
    update,
    { returnDocument: 'after', projection: { consecutive_failures: 1 } }
  );
  return doc?.consecutive_failures ?? 0;
}

async function removeScript(auditDb, slug) {
  await auditDb.collection(RUNS).deleteMany({ slug });
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: slug });
  return deletedCount > 0;
}

async function listEnabledScripts(auditDb) {
  const docs = await auditDb.collection(COLLECTION)
    .find(
      { enabled: true },
      { projection: { code: 1, updated_by: 1, consecutive_failures: 1, last_ok_dataset_version: 1 } }
    )
    .sort({ _id: 1 })
    .toArray();
  // runs_as: scheduled refreshes execute with the last publisher's data scope.
  // last_dataset_version lets the scheduler skip scripts already computed at
  // the current version (boot reconcile without a redeploy stampede).
  return docs.map((d) => ({
    slug: String(d._id),
    code: d.code,
    runs_as: d.updated_by ?? null,
    consecutive_failures: d.consecutive_failures ?? 0,
    last_dataset_version: d.last_ok_dataset_version ?? null,
  }));
}

async function listRuns(auditDb, slug, limit = 20) {
  return auditDb.collection(RUNS)
    .find({ slug }, { projection: { _id: 0, slug: 0 } })
    // _id tie-break: same-millisecond runs still list newest-first.
    .sort({ started_at: -1, _id: -1 })
    .limit(limit)
    .toArray();
}

async function ensureFigureScriptIndexes(auditDb) {
  await auditDb.collection(RUNS).createIndex(
    { started_at: 1 },
    { expireAfterSeconds: RUNS_TTL_DAYS * 24 * 60 * 60 }
  );
  await auditDb.collection(RUNS).createIndex({ slug: 1, started_at: -1 });
}

module.exports = {
  validateScriptCode, upsertScript, getScript, existsScript, setScriptEnabled,
  recordRun, removeScript, listEnabledScripts, listRuns,
  ensureFigureScriptIndexes,
};
