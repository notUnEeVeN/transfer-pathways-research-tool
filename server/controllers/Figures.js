/**
 * Figure gallery endpoints + the served pmt.py client.
 *
 * All behind the standard guarded stack. Publishing is open to every console
 * user (the gallery is a shared whiteboard for a small trusted team). These
 * routes store rendered images only; LIVE figures — where the server does
 * re-run partner scripts, sandboxed — live in FigureScripts.js.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { currentDatasetVersion } = require('../services/datasetVersion');
const {
  validateFigurePayload, validateFigureMeta, resolveAuthorLabel,
  upsertFigure, listFigures, getFigureFormat, removeFigure,
  getFigureAuthor, updateFigureMeta,
} = require('../services/figures');
const { existsScript, removeScript } = require('../services/figureScripts');
const { pmtPy } = require('../client/pmtPy');
const { auditHandle, canModify } = require('./helpers');

exports.publish = asyncHandler(async (req, res) => {
  const { error, value } = validateFigurePayload(req.body);
  if (error) return res.status(400).json({ error });
  const auditDb = auditHandle(req);
  // A live figure's render is owned by its script. The AUTHOR (or an admin)
  // may still static-publish onto it — that's the documented local-iteration
  // loop, and the next refresh re-syncs — but anyone else is refused, exactly
  // like the script-publish hijack rule.
  if (await existsScript(auditDb, value.slug)) {
    const author = await getFigureAuthor(auditDb, value.slug);
    if (!canModify(req.user, author.found ? author.author_uid : null)) {
      return res.status(403).json({
        error: `'${value.slug}' is a live figure published by someone else — pick another slug`,
      });
    }
  }
  // Trust the client-reported version when present — it names the data the
  // figure was actually computed from; the current version may already be
  // newer, and the gallery's stale badge should reflect that honestly.
  if (!value.dataset_version) {
    value.dataset_version = await currentDatasetVersion(req.app.locals.db);
  }
  const author_label = await resolveAuthorLabel(auditDb, req.user);
  await upsertFigure(auditDb, value, { author_uid: req.user?.uid, author_label });
  res.json({ ok: true, slug: value.slug, dataset_version: value.dataset_version });
});

exports.list = asyncHandler(async (req, res) => {
  const [figures, dataset_version] = await Promise.all([
    listFigures(auditHandle(req)),
    currentDatasetVersion(req.app.locals.db),
  ]);
  res.json({ dataset_version, figures });
});

exports.download = asyncHandler(async (req, res) => {
  const file = await getFigureFormat(auditHandle(req), req.params.slug, req.params.format);
  if (!file) return res.status(404).json({ error: 'no such figure/format' });
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
});

exports.update = asyncHandler(async (req, res) => {
  const { error, value } = validateFigureMeta(req.body);
  if (error) return res.status(400).json({ error });
  const auditDb = auditHandle(req);
  const author = await getFigureAuthor(auditDb, req.params.slug);
  if (!author.found) return res.status(404).json({ error: 'no such figure' });
  if (!canModify(req.user, author.author_uid)) return res.sendStatus(403);
  await updateFigureMeta(auditDb, req.params.slug, value);
  res.json({ ok: true, slug: req.params.slug });
});

exports.remove = asyncHandler(async (req, res) => {
  const auditDb = auditHandle(req);
  const author = await getFigureAuthor(auditDb, req.params.slug);
  if (!author.found) return res.status(404).json({ error: 'no such figure' });
  if (!canModify(req.user, author.author_uid)) return res.sendStatus(403);
  await removeScript(auditDb, req.params.slug); // live figures take their script + run log along
  await removeFigure(auditDb, req.params.slug);
  res.json({ ok: true });
});

// The Python client, base URL baked in from the request (PUBLIC_API_URL
// overrides when the deployment sits behind a hostname the request can't see).
exports.pmtPy = asyncHandler(async (req, res) => {
  const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
  res.send(pmtPy(base));
});
