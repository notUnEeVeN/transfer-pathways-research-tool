/**
 * Sign-in request endpoints.
 *
 * POST /access/request sits OUTSIDE the console allowlist gate on purpose:
 * its whole audience is authenticated-but-ungranted accounts. Identity comes
 * from the verified Firebase token (req.user); the request body is ignored.
 * Admin list/dismiss live under /admin with the usual admin gate.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { isAdmin, isConsoleAllowed, invalidateGrantsCache } = require('../services/access');
const {
  recordRequest, listPendingRequests, removeRequest,
  blockUid, unblockUid, isBlocked, listBlocked,
} = require('../services/accessRequests');

const auditHandle = (req) => req.app.locals.auditDb || req.app.locals.db;

exports.postRequest = asyncHandler(async (req, res) => {
  // Browser flow only — a pmtr_ token belongs to an already-granted account,
  // and tokens shouldn't be able to write presence records for their owner.
  if (req.user?.api_token) return res.sendStatus(403);
  const auditDb = auditHandle(req);
  const { uid, email, name } = req.user || {};
  if (await isConsoleAllowed(uid, auditDb)) return res.json({ granted: true });
  // Rejected accounts don't get to re-file a request — their denied screen
  // shows "declined" instead of "waiting".
  if (await isBlocked(auditDb, uid)) return res.json({ granted: false, blocked: true });
  await recordRequest(auditDb, { uid, email, name });
  res.json({ granted: false, requested: true });
});

exports.adminList = asyncHandler(async (req, res) => {
  const requests = await listPendingRequests(auditHandle(req), { isAdminUid: (u) => isAdmin(u) });
  res.json({ requests });
});

exports.adminDismiss = asyncHandler(async (req, res) => {
  const ok = await removeRequest(auditHandle(req), req.params.uid);
  if (!ok) return res.status(404).json({ error: 'no pending request for that uid' });
  res.json({ ok: true });
});

// ── Reject (deny-list) ──
// Block a uid: clears its pending request AND revokes any live grant, so a
// currently-signed-in partner is bounced back to the denied screen on their
// next access re-check (see useAccessMe's poll). Admins are env-bootstrapped
// and can't be blocked.
exports.adminBlock = asyncHandler(async (req, res) => {
  const { uid, email, name } = req.body || {};
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  if (!cleanUid) return res.status(400).json({ error: 'uid required' });
  if (isAdmin(cleanUid)) {
    return res.status(400).json({ error: 'That UID is an admin (ADMIN_UIDS) and cannot be blocked' });
  }
  const auditDb = auditHandle(req);
  await blockUid(auditDb, { uid: cleanUid, email, name, blockedBy: req.user?.uid });
  invalidateGrantsCache();
  res.json({ ok: true });
});

exports.adminListBlocked = asyncHandler(async (req, res) => {
  res.json({ blocked: await listBlocked(auditHandle(req)) });
});

exports.adminUnblock = asyncHandler(async (req, res) => {
  const ok = await unblockUid(auditHandle(req), req.params.uid);
  if (!ok) return res.status(404).json({ error: 'no block for that uid' });
  res.json({ ok: true });
});
