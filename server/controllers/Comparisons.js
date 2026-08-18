/**
 * Saved-comparison endpoints.
 *
 * Everyone-equal to create, edit and annotate — a comparison is team working
 * state like a task, not a verified artefact, so there is no admin gate and
 * gating it behind one would defeat a tool whose point is that it gets written
 * in freely. Two exceptions: deleting the document is author-or-admin
 * (canModify), and editing or deleting a note is author-only, enforced in the
 * service. Validation lives there too (ComparisonError -> its status here).
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { getDisplayName } = require('../services/displayNames');
const {
  ComparisonError, listComparisons, getComparison, createComparison,
  updateComparison, deleteComparison, addNote, editNote, deleteNote,
} = require('../services/comparisons');
const { auditHandle, canModify } = require('./helpers');

const handler = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ComparisonError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

// Who a write is stamped with, resolved here and never read from the body. An
// admin-set display name wins, as it does for task assignees and figure
// authors; a pmtr_ API token carries a uid and no name or email at all
// (middleware/auth.js), so the label has to tolerate null.
const authorStamp = async (auditDb, user) => {
  const uid = user?.uid ?? null;
  const named = uid ? await getDisplayName(auditDb, uid) : null;
  return { uid, label: named || user?.name || user?.email || null };
};

const missing = (res) => res.status(404).json({ error: 'no such comparison' });

exports.list = handler(async (req, res) => {
  const comparisons = await listComparisons(auditHandle(req), {
    fingerprint: String(req.query?.fingerprint || '').trim() || null,
    limit: req.query?.limit,
  });
  res.json({ comparisons });
});

exports.get = handler(async (req, res) => {
  const comparison = await getComparison(auditHandle(req), req.params.id);
  if (!comparison) return missing(res);
  res.json({ comparison });
});

exports.create = handler(async (req, res) => {
  const auditDb = auditHandle(req);
  const comparison = await createComparison(auditDb, req.body || {}, await authorStamp(auditDb, req.user));
  res.status(201).json({ comparison });
});

exports.update = handler(async (req, res) => {
  const auditDb = auditHandle(req);
  const comparison = await updateComparison(
    auditDb, req.params.id, req.body || {}, await authorStamp(auditDb, req.user)
  );
  if (!comparison) return missing(res);
  res.json({ comparison });
});

exports.remove = handler(async (req, res) => {
  const auditDb = auditHandle(req);
  const comparison = await getComparison(auditDb, req.params.id);
  if (!comparison) return missing(res);
  if (!canModify(req.user, comparison.author_uid)) return res.sendStatus(403);
  await deleteComparison(auditDb, req.params.id);
  res.sendStatus(204);
});

exports.addNote = handler(async (req, res) => {
  const auditDb = auditHandle(req);
  const comparison = await addNote(
    auditDb, req.params.id, req.body || {}, await authorStamp(auditDb, req.user)
  );
  if (!comparison) return missing(res);
  res.json({ comparison });
});

exports.editNote = handler(async (req, res) => {
  const auditDb = auditHandle(req);
  const comparison = await editNote(
    auditDb, req.params.id, req.params.noteId, req.body || {}, await authorStamp(auditDb, req.user)
  );
  if (!comparison) return missing(res);
  res.json({ comparison });
});

exports.deleteNote = handler(async (req, res) => {
  const auditDb = auditHandle(req);
  const comparison = await deleteNote(
    auditDb, req.params.id, req.params.noteId, await authorStamp(auditDb, req.user)
  );
  if (!comparison) return missing(res);
  res.json({ comparison });
});
