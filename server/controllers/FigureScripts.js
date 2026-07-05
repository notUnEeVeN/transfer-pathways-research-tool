/**
 * Live-figure script endpoints.
 *
 * POST /figure-scripts synchronously dry-runs the submitted script in the
 * sandbox (see services/figureRunner.js) and only publishes what a successful
 * run captured — the caller gets the run log either way, in their terminal.
 * Code is readable by every console user ("View code" is the collaboration
 * story); run logs and the control surface stay owner-or-admin.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  validateScriptCode, getScript, setScriptEnabled, removeScript, listRuns,
} = require('../services/figureScripts');
const { getFigureAuthor, clearFigureLive } = require('../services/figures');
const { auditHandle, canModify } = require('./helpers');

const runtimeOf = (req) => req.app.locals.figureRuntime;

// Ownership of a slug: the figure's author when the figure exists, else the
// script's last publisher (covers a stored script whose figure was deleted).
// Handlers that already fetched the script pass it in to skip a re-query.
async function slugOwner(auditDb, slug, script = undefined) {
  const fig = await getFigureAuthor(auditDb, slug);
  if (fig.found) return { exists: true, owner: fig.author_uid };
  const s = script === undefined ? await getScript(auditDb, slug) : script;
  if (s) return { exists: true, owner: s.updated_by ?? null };
  return { exists: false, owner: null };
}

const failureBody = (out) => ({
  error: out.status === 'timeout'
    ? 'the script exceeded the run time limit'
    : 'the script run failed — see log',
  status: out.status,
  log: out.log,
});

exports.publish = asyncHandler(async (req, res) => {
  const { error, value: code } = validateScriptCode(req.body?.code);
  if (error) return res.status(400).json({ error });
  const auditDb = auditHandle(req);
  const enabled = req.body?.enabled !== false;

  let out;
  try {
    out = await runtimeOf(req).runLive({
      code,
      runsAs: req.user?.uid,
      trigger: 'publish',
      authorize: async (slug) => {
        const o = await slugOwner(auditDb, slug);
        return !o.exists || canModify(req.user, o.owner);
      },
      storeScript: { uid: req.user?.uid, enabled },
    });
  } catch (e) {
    if (e.code === 'QUEUE_FULL') return res.status(429).json({ error: e.message });
    throw e;
  }

  if (out.forbidden) {
    return res.status(403).json({ error: `'${out.slug}' was published by someone else — pick another slug` });
  }
  if (!out.ok) return res.status(422).json(failureBody(out));
  res.json({
    ok: true, slug: out.slug, dataset_version: out.dataset_version,
    duration_ms: out.duration_ms, log: out.log,
  });
});

exports.get = asyncHandler(async (req, res) => {
  const auditDb = auditHandle(req);
  const script = await getScript(auditDb, req.params.slug);
  if (!script) return res.status(404).json({ error: 'no script behind this slug' });
  const { owner } = await slugOwner(auditDb, req.params.slug, script);
  const mayModify = canModify(req.user, owner);
  const last_run = script.last_run
    ? { ...script.last_run, ...(mayModify ? {} : { log: undefined }) }
    : null;
  res.json({
    slug: String(script._id),
    code: script.code,
    enabled: script.enabled,
    updated_at: script.updated_at,
    consecutive_failures: script.consecutive_failures ?? 0,
    last_run,
    can_modify: mayModify,
  });
});

exports.refresh = asyncHandler(async (req, res) => {
  const auditDb = auditHandle(req);
  const script = await getScript(auditDb, req.params.slug);
  if (!script) return res.status(404).json({ error: 'no script behind this slug' });
  const { owner } = await slugOwner(auditDb, req.params.slug, script);
  if (!canModify(req.user, owner)) return res.sendStatus(403);

  let out;
  try {
    out = await runtimeOf(req).runLive({
      trigger: 'manual',
      expectedSlug: String(script._id),
      // Re-read inside the queued job so a republish that lands while this
      // refresh waits in line supplies the newer code. runsAs stays the
      // author's data scope, not the refresher's — a refresh recomputes the
      // same figure, it doesn't re-frame it around whoever clicked.
      loadCode: async () => {
        const fresh = await getScript(auditDb, req.params.slug);
        return fresh && { code: fresh.code, runsAs: fresh.updated_by ?? req.user?.uid };
      },
    });
  } catch (e) {
    if (e.code === 'QUEUE_FULL') return res.status(429).json({ error: e.message });
    throw e;
  }

  if (!out.ok) return res.status(422).json(failureBody(out));
  res.json({ ok: true, slug: out.slug, dataset_version: out.dataset_version, duration_ms: out.duration_ms });
});

exports.setEnabled = asyncHandler(async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  const auditDb = auditHandle(req);
  const script = await getScript(auditDb, req.params.slug);
  if (!script) return res.status(404).json({ error: 'no script behind this slug' });
  const { owner } = await slugOwner(auditDb, req.params.slug, script);
  if (!canModify(req.user, owner)) return res.sendStatus(403);
  await setScriptEnabled(auditDb, req.params.slug, req.body.enabled);
  res.json({ ok: true, slug: req.params.slug, enabled: req.body.enabled });
});

// Detach: remove the script (and its run history) but keep the figure as a
// plain static snapshot — the graceful downgrade path.
exports.detach = asyncHandler(async (req, res) => {
  const auditDb = auditHandle(req);
  const script = await getScript(auditDb, req.params.slug);
  if (!script) return res.status(404).json({ error: 'no script behind this slug' });
  const { owner } = await slugOwner(auditDb, req.params.slug, script);
  if (!canModify(req.user, owner)) return res.sendStatus(403);
  await removeScript(auditDb, req.params.slug);
  await clearFigureLive(auditDb, req.params.slug);
  res.json({ ok: true, slug: req.params.slug });
});

exports.runs = asyncHandler(async (req, res) => {
  const auditDb = auditHandle(req);
  const script = await getScript(auditDb, req.params.slug);
  if (!script) return res.status(404).json({ error: 'no script behind this slug' });
  const { owner } = await slugOwner(auditDb, req.params.slug, script);
  if (!canModify(req.user, owner)) return res.sendStatus(403);
  res.json({ runs: await listRuns(auditDb, req.params.slug) });
});
