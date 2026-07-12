/** Canonical account, access, and display-name store. */
const COLLECTION = 'team_members';

async function getMember(db, uid) {
  return db.collection(COLLECTION).findOne({ _id: String(uid) });
}

async function listMembers(db, filter = {}) {
  return db.collection(COLLECTION).find(filter).toArray();
}

async function recordPending(db, { uid, email, name }) {
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: String(uid), access_status: { $nin: ['granted', 'blocked'] } },
    {
      $set: {
        access_status: 'pending',
        email: email ?? null,
        identity_name: name ?? null,
        last_seen: now,
        updated_at: now,
      },
      $setOnInsert: { first_seen: now },
      $inc: { request_attempts: 1 },
    },
    { upsert: true }
  ).catch((error) => {
    // A granted or blocked row wins over a new request attempt.
    if (error.code !== 11000) throw error;
  });
}

async function dismissPending(db, uid) {
  const result = await db.collection(COLLECTION).updateOne(
    { _id: String(uid), access_status: 'pending' },
    { $set: { access_status: 'revoked', updated_at: new Date() }, $unset: { last_seen: '' } }
  );
  return result.matchedCount > 0;
}

async function grantMember(db, { uid, email, note, by }) {
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: String(uid) },
    {
      $set: {
        access_status: 'granted',
        email: email ?? null,
        note: note ?? null,
        granted_by: by ?? null,
        granted_at: now,
        updated_at: now,
      },
      $unset: { blocked_by: '', blocked_at: '', revoked_at: '', last_seen: '' },
    },
    { upsert: true }
  );
}

async function revokeMember(db, uid) {
  const now = new Date();
  const result = await db.collection(COLLECTION).updateOne(
    { _id: String(uid), access_status: 'granted' },
    { $set: { access_status: 'revoked', revoked_at: now, updated_at: now } }
  );
  return result.matchedCount > 0;
}

async function blockMember(db, { uid, email, name, by }) {
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: String(uid) },
    {
      $set: {
        access_status: 'blocked',
        email: email ?? null,
        identity_name: name ?? null,
        blocked_by: by ?? null,
        blocked_at: now,
        updated_at: now,
      },
      $unset: { granted_by: '', granted_at: '', revoked_at: '', last_seen: '' },
    },
    { upsert: true }
  );
}

async function unblockMember(db, uid) {
  const result = await db.collection(COLLECTION).updateOne(
    { _id: String(uid), access_status: 'blocked' },
    {
      $set: { access_status: 'revoked', updated_at: new Date() },
      $unset: { blocked_by: '', blocked_at: '' },
    }
  );
  return result.matchedCount > 0;
}

async function setMemberDisplayName(db, uid, name, by) {
  const clean = typeof name === 'string' ? name.trim() : '';
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: String(uid) },
    clean
      ? {
        $set: { display_name: clean, display_name_updated_by: by ?? null, updated_at: now },
        $setOnInsert: { access_status: 'profile_only' },
      }
      : {
        $unset: { display_name: '', display_name_updated_by: '' },
        $set: { updated_at: now },
        $setOnInsert: { access_status: 'profile_only' },
      },
    { upsert: true }
  );
  return clean || null;
}

module.exports = {
  COLLECTION,
  getMember,
  listMembers,
  recordPending,
  dismissPending,
  grantMember,
  revokeMember,
  blockMember,
  unblockMember,
  setMemberDisplayName,
};
