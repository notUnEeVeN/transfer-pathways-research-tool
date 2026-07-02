/**
 * Admin endpoints (ADMIN_UIDS only — see middleware/requireAdmin).
 *
 * Dataset visibility: what the research cluster currently holds, as written
 * by scripts/port.py (dataset_meta / dataset_changelog on the reference
 * handle). The actual porting runs locally via that script — this server
 * never holds source-cluster credentials.
 *
 * Access management: partner access lives in the `access_grants` collection
 * (audit handle), keyed by Firebase UID, so admins add/remove partners from
 * the app without a redeploy. Admins themselves come from env only.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { invalidateGrantsCache, isAdmin } = require('../services/access');
const { getVisibleMajors, setVisibleMajors } = require('../services/majorVisibility');

const GRANTS = 'access_grants';

exports.getDataset = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const meta = await db.collection('dataset_meta').findOne({ _id: 'current' });
  const changelog = await db
    .collection('dataset_changelog')
    .find({}, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .limit(20)
    .toArray();
  res.json({ meta, changelog });
});

// Who can use the console right now: role of the caller's own view comes from
// /access/me; this lists everyone for the management UI.
exports.listAccess = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const grants = await auditDb.collection(GRANTS).find().sort({ granted_at: 1 }).toArray();
  res.json({
    partners: grants.map((g) => ({
      uid: String(g._id),
      email: g.email ?? null,
      note: g.note ?? null,
      granted_by: g.granted_by ?? null,
      granted_at: g.granted_at ?? null,
    })),
  });
});

exports.grantAccess = asyncHandler(async (req, res) => {
  const { uid, email, note } = req.body || {};
  if (!uid || typeof uid !== 'string' || !uid.trim()) {
    return res.status(400).json({ error: 'uid required (the partner\'s Firebase UID)' });
  }
  const cleanUid = uid.trim();
  if (isAdmin(cleanUid)) {
    return res.status(400).json({ error: 'That UID is already an admin (ADMIN_UIDS)' });
  }
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  await auditDb.collection(GRANTS).replaceOne(
    { _id: cleanUid },
    {
      _id: cleanUid,
      email: typeof email === 'string' ? email.trim() : null,
      note: typeof note === 'string' ? note.trim() : null,
      granted_by: req.user?.uid ?? null,
      granted_at: new Date(),
    },
    { upsert: true }
  );
  invalidateGrantsCache();
  res.json({ ok: true });
});

exports.revokeAccess = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const { deletedCount } = await auditDb.collection(GRANTS).deleteOne({ _id: req.params.uid });
  invalidateGrantsCache();
  if (!deletedCount) return res.status(404).json({ error: 'no grant for that uid' });
  res.json({ ok: true });
});

// ── partner major visibility ──
// The ported dataset (everything in uc_agreements) is the admin's universe;
// `visible` is the subset partners can see. Deny-by-default: until the admin
// selects majors, partners see nothing.

exports.getVisibleMajors = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const [ported, visible] = await Promise.all([
    db.collection('uc_agreements').distinct('major'),
    getVisibleMajors(auditDb),
  ]);
  res.json({ ported: ported.sort(), visible });
});

exports.putVisibleMajors = asyncHandler(async (req, res) => {
  const { majors } = req.body || {};
  if (!Array.isArray(majors) || majors.some((m) => typeof m !== 'string')) {
    return res.status(400).json({ error: 'majors must be an array of major names' });
  }
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const ported = new Set(await db.collection('uc_agreements').distinct('major'));
  const unknown = majors.filter((m) => !ported.has(m));
  if (unknown.length) {
    return res.status(400).json({ error: `not in the ported dataset: ${unknown.join(' · ')}` });
  }
  await setVisibleMajors(auditDb, majors, req.user?.uid);
  res.json({ ok: true, visible: majors });
});

// Available to every console user (partner or admin): tells the frontend
// which role to render.
exports.getMe = asyncHandler(async (req, res) => {
  const uid = req.user?.uid ?? null;
  res.json({ uid, role: isAdmin(uid) ? 'admin' : 'partner' });
});
