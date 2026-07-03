/**
 * Sign-in requests — the "knock on the door" record behind the admin's
 * one-click grant flow.
 *
 * When a signed-in Google account without a grant lands on the console, the
 * denied screen POSTs /access/request and the attempt is upserted here (one
 * doc per uid, identity taken from the verified Firebase token — never from
 * the client body). Admins list these under Admin → Sign-in requests and
 * grant or dismiss; granting (controllers/Admin.grantAccess) removes the
 * request doc, and the partner's polling denied screen unlocks by itself.
 *
 * Rejecting instead adds the uid to `access_blocks` (the deny-list): the
 * request is cleared, the account can no longer file a request, and its denied
 * screen switches from "waiting" to "declined". Admins un-block from the same
 * panel. Blocking a currently-granted partner also revokes the grant (done in
 * the controller, which owns the grants cache).
 *
 * Storage (audit handle):
 *   access_requests: { _id: uid, email, name, first_seen, last_seen, attempts }
 *   access_blocks:   { _id: uid, email, name, blocked_by, blocked_at }
 */
const COLLECTION = 'access_requests';
const BLOCKS = 'access_blocks';

async function recordRequest(auditDb, { uid, email, name } = {}) {
  if (typeof uid !== 'string' || !uid.trim()) throw new Error('uid required');
  const now = new Date();
  await auditDb.collection(COLLECTION).updateOne(
    { _id: uid },
    {
      $set: { email: email ?? null, name: name ?? null, last_seen: now },
      $setOnInsert: { first_seen: now },
      $inc: { attempts: 1 },
    },
    { upsert: true }
  );
}

// Pending = not yet granted, not blocked, and not an admin. Granting/blocking
// both clear the request doc, so the grant/block checks here are safety nets
// for a request doc that outlived either action.
async function listPendingRequests(auditDb, { isAdminUid = () => false } = {}) {
  const [requests, grants, blocks] = await Promise.all([
    auditDb.collection(COLLECTION).find().sort({ last_seen: -1 }).toArray(),
    auditDb.collection('access_grants').find({}, { projection: { _id: 1 } }).toArray(),
    auditDb.collection(BLOCKS).find({}, { projection: { _id: 1 } }).toArray(),
  ]);
  const granted = new Set(grants.map((g) => String(g._id)));
  const blocked = new Set(blocks.map((b) => String(b._id)));
  return requests
    .filter((r) => {
      const id = String(r._id);
      return !granted.has(id) && !blocked.has(id) && !isAdminUid(id);
    })
    .map(({ _id, ...rest }) => ({ uid: String(_id), ...rest }));
}

async function removeRequest(auditDb, uid) {
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: uid });
  return deletedCount > 0;
}

// ── Deny-list (reject) ──
// Blocking upserts one doc per uid and clears any pending request. Identity is
// stamped from the token (email/name), never the client body.
async function blockUid(auditDb, { uid, email, name, blockedBy } = {}) {
  if (typeof uid !== 'string' || !uid.trim()) throw new Error('uid required');
  await auditDb.collection(BLOCKS).updateOne(
    { _id: uid },
    { $set: { email: email ?? null, name: name ?? null, blocked_by: blockedBy ?? null, blocked_at: new Date() } },
    { upsert: true }
  );
  await removeRequest(auditDb, uid);
}

async function isBlocked(auditDb, uid) {
  if (typeof uid !== 'string' || !uid) return false;
  return !!(await auditDb.collection(BLOCKS).findOne({ _id: uid }, { projection: { _id: 1 } }));
}

async function unblockUid(auditDb, uid) {
  const { deletedCount } = await auditDb.collection(BLOCKS).deleteOne({ _id: uid });
  return deletedCount > 0;
}

async function listBlocked(auditDb) {
  const rows = await auditDb.collection(BLOCKS).find().sort({ blocked_at: -1 }).toArray();
  return rows.map(({ _id, ...rest }) => ({ uid: String(_id), ...rest }));
}

module.exports = {
  recordRequest, listPendingRequests, removeRequest,
  blockUid, unblockUid, isBlocked, listBlocked,
};
