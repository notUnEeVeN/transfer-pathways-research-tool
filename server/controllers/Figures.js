/**
 * Static figure gallery endpoints + the served pmt.py client.
 *
 * All behind the standard guarded stack. Publishing is open to every console
 * user (the gallery is a shared whiteboard for a small trusted team). The
 * client renders locally and these routes store only finished image files.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  validateFigurePayload, validateFigureMeta, resolveAuthorLabel,
  upsertFigure, listFigures, getFigureFormat, removeFigure,
  getFigureAuthor, updateFigureMeta,
} = require('../services/figures');
const { pmtPy } = require('../client/pmtPy');
const { auditHandle, canModify } = require('./helpers');

exports.publish = asyncHandler(async (req, res) => {
  const { error, value } = validateFigurePayload(req.body);
  if (error) return res.status(400).json({ error });
  const auditDb = auditHandle(req);
  // A slug is durable ownership: its author can iterate by republishing, and
  // admins can recover/replace it, but another teammate must choose a new slug.
  const existing = await getFigureAuthor(auditDb, value.slug);
  if (existing.found && !canModify(req.user, existing.author_uid)) {
    return res.status(403).json({
      error: `'${value.slug}' belongs to another teammate — choose another slug`,
    });
  }
  const author_label = await resolveAuthorLabel(auditDb, req.user);
  await upsertFigure(auditDb, value, { author_uid: req.user?.uid, author_label });
  res.json({ ok: true, slug: value.slug });
});

exports.list = asyncHandler(async (req, res) => {
  res.json({ figures: await listFigures(auditHandle(req)) });
});

exports.download = asyncHandler(async (req, res) => {
  const file = await getFigureFormat(
    auditHandle(req), req.params.slug, req.params.format, req.params.variant || null
  );
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
  await removeFigure(auditDb, req.params.slug);
  res.json({ ok: true });
});

// The Python client, base URL baked in from the request (PUBLIC_API_URL
// overrides when the deployment sits behind a hostname the request can't see).
exports.pmtPy = asyncHandler(async (req, res) => {
  const configured = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  const root = configured.replace(/\/+$/, '');
  const base = root.endsWith('/api') ? root : `${root}/api`;
  res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
  res.send(pmtPy(base));
});
