/** Sign-in requests and blocks backed by team_members. */
const {
  recordPending, dismissPending, blockMember, unblockMember,
} = require('./teamMembers');

async function recordRequest(auditDb, { uid, email, name } = {}) {
  if (typeof uid !== 'string' || !uid.trim()) throw new Error('uid required');
  await recordPending(auditDb, { uid, email, name });
}

async function listPendingRequests(auditDb, { isAdminUid = () => false } = {}) {
  const rows = await auditDb.collection('team_members')
    .find({ access_status: 'pending' })
    .sort({ last_seen: -1 })
    .toArray();
  return rows
    .filter((row) => !isAdminUid(String(row._id)))
    .map((row) => ({
      uid: String(row._id),
      email: row.email ?? null,
      name: row.identity_name ?? row.display_name ?? null,
      first_seen: row.first_seen ?? null,
      last_seen: row.last_seen ?? null,
      attempts: row.request_attempts ?? 0,
    }));
}

async function removeRequest(auditDb, uid) {
  return dismissPending(auditDb, uid);
}

async function blockUid(auditDb, { uid, email, name, blockedBy } = {}) {
  if (typeof uid !== 'string' || !uid.trim()) throw new Error('uid required');
  await blockMember(auditDb, { uid, email, name, by: blockedBy });
}

async function isBlocked(auditDb, uid) {
  if (typeof uid !== 'string' || !uid) return false;
  return Boolean(await auditDb.collection('team_members').findOne(
    { _id: uid, access_status: 'blocked' }, { projection: { _id: 1 } }
  ));
}

async function unblockUid(auditDb, uid) {
  return unblockMember(auditDb, uid);
}

async function listBlocked(auditDb) {
  const rows = await auditDb.collection('team_members')
    .find({ access_status: 'blocked' })
    .sort({ blocked_at: -1 })
    .toArray();
  return rows.map((row) => ({
    uid: String(row._id),
    email: row.email ?? null,
    name: row.identity_name ?? row.display_name ?? null,
    blocked_by: row.blocked_by ?? null,
    blocked_at: row.blocked_at ?? null,
  }));
}

module.exports = {
  recordRequest, listPendingRequests, removeRequest,
  blockUid, unblockUid, isBlocked, listBlocked,
};
