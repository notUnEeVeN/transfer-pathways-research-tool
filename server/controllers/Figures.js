/**
 * Published visual gallery endpoints + the served pmt.py client.
 *
 * All behind the standard guarded stack. Publishing is open to every console
 * user (the gallery is a shared whiteboard for a small trusted team). The
 * Static figures render locally; interactive publications store only a
 * validated reference to a renderer shipped with the frontend.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  validateFigurePayload, validateFigureMeta, resolveAuthorLabel,
  upsertFigure, listFigures, getFigureFormat, removeFigure,
  getFigureAuthor, getFigurePublicationScope, updateFigureMeta,
} = require('../services/figures');
const {
  VA_ANALYSIS_MAJOR,
  virginiaAnalysisPublicationStatus,
} = require('../services/virginia/analysisPublicationGate');
const { pmtPy } = require('../client/pmtPy');
const { auditHandle, canModify } = require('./helpers');

const PUBLICATION_BINDING_FIELDS = Object.freeze([
  'contract',
  'major_slug',
  'generation_id',
  'projection_manifest_sha256',
  'publication_evaluator_fingerprint_sha256',
  'transfer_equivalency_condition_report_sha256',
  'pathway_complexity_prerequisite_report_sha256',
]);

function publicationBinding(status) {
  return Object.fromEntries(PUBLICATION_BINDING_FIELDS.map((field) => [field, status?.[field] ?? null]));
}

function figurePublicationCurrent(figure, status) {
  if (figure?.major_slug !== VA_ANALYSIS_MAJOR) return true;
  if (status?.ready !== true || !figure?.analysis_publication) return false;
  return PUBLICATION_BINDING_FIELDS.every(
    (field) => figure.analysis_publication[field] === status[field]
  );
}

async function vaPublicationStatus(req) {
  return virginiaAnalysisPublicationStatus(req.app?.locals?.db);
}

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
  if (value.major_slug === VA_ANALYSIS_MAJOR) {
    const status = await vaPublicationStatus(req);
    if (status.ready !== true) {
      return res.status(503).json({
        error: 'Virginia figures require the current passing analysis publication receipt',
        blocker: status.blocker,
        issues: status.issues,
      });
    }
    value.analysis_publication = publicationBinding(status);
  } else {
    value.analysis_publication = null;
  }
  const author_label = await resolveAuthorLabel(auditDb, req.user);
  await upsertFigure(auditDb, value, { author_uid: req.user?.uid, author_label });
  res.json({ ok: true, slug: value.slug });
});

exports.list = asyncHandler(async (req, res) => {
  const figures = await listFigures(auditHandle(req));
  if (!figures.some((figure) => figure.major_slug === VA_ANALYSIS_MAJOR)) {
    return res.json({ figures });
  }
  const status = await vaPublicationStatus(req);
  return res.json({ figures: figures.filter((figure) => figurePublicationCurrent(figure, status)) });
});

exports.download = asyncHandler(async (req, res) => {
  const scope = await getFigurePublicationScope(auditHandle(req), req.params.slug);
  if (!scope) return res.status(404).json({ error: 'no such figure/format' });
  if (scope.major_slug === VA_ANALYSIS_MAJOR) {
    const status = await vaPublicationStatus(req);
    if (!figurePublicationCurrent(scope, status)) {
      return res.status(404).json({ error: 'no such figure/format' });
    }
  }
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

exports.figurePublicationCurrent = figurePublicationCurrent;
exports.publicationBinding = publicationBinding;
