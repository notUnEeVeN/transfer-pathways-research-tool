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
const { getVisiblePairs, setVisiblePairs } = require('../services/majorVisibility');
const { startRefresh, jobStatus } = require('../services/porter');

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
// `visible` is the (school, major) PAIR subset partners can see — pair
// granularity because the same major name exists at several campuses.
// Deny-by-default: until the admin selects pairs, partners see nothing.

// The ported universe, grouped by school for the admin UI.
async function portedBySchool(db) {
  const groups = await db.collection('uc_agreements').aggregate([
    { $group: { _id: { school_id: '$uc_school_id', school: '$uc_school' }, majors: { $addToSet: '$major' } } },
    { $sort: { '_id.school': 1 } },
  ]).toArray();
  return groups.map((g) => ({
    school_id: g._id.school_id,
    school: g._id.school,
    majors: g.majors.sort(),
  }));
}

exports.getVisibleMajors = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const [schools, visible] = await Promise.all([
    portedBySchool(db),
    getVisiblePairs(auditDb),
  ]);
  res.json({ schools, visible });
});

exports.putVisibleMajors = asyncHandler(async (req, res) => {
  const { pairs } = req.body || {};
  if (
    !Array.isArray(pairs) ||
    pairs.some((p) => !p || !Number.isFinite(Number(p.school_id)) || typeof p.major !== 'string' || !p.major)
  ) {
    return res.status(400).json({ error: 'pairs must be an array of { school_id, major }' });
  }
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const ported = new Set(
    (await portedBySchool(db)).flatMap((s) => s.majors.map((m) => `${s.school_id}|${m}`))
  );
  const unknown = pairs.filter((p) => !ported.has(`${Number(p.school_id)}|${p.major}`));
  if (unknown.length) {
    return res.status(400).json({
      error: `not in the ported dataset: ${unknown.map((p) => `${p.school_id}:${p.major}`).join(' · ')}`,
    });
  }
  await setVisiblePairs(auditDb, pairs, req.user?.uid);
  res.json({ ok: true, visible: pairs.map((p) => ({ school_id: Number(p.school_id), major: p.major })) });
});

// ── dataset refresh (re-port from the source DB after parser updates) ──
// Kicks off a background job; the panel polls the status endpoint. Replaced
// agreements get NEW _ids (the parser rebuild regenerates them), so verdicts
// recorded against replaced docs are orphaned — correct after a parser fix.

exports.postRefreshDataset = asyncHandler(async (req, res) => {
  try {
    res.status(202).json(startRefresh(req.app.locals.db));
  } catch (e) {
    if (e.code === 'BUSY') return res.status(409).json({ error: e.message });
    if (e.code === 'UNCONFIGURED') return res.status(501).json({ error: e.message });
    throw e;
  }
});

exports.getRefreshStatus = asyncHandler(async (req, res) => {
  res.json(jobStatus());
});

// Available to every console user (partner or admin): tells the frontend
// which role to render.
exports.getMe = asyncHandler(async (req, res) => {
  const uid = req.user?.uid ?? null;
  res.json({ uid, role: isAdmin(uid) ? 'admin' : 'partner' });
});
