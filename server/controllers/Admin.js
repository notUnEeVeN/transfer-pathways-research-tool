/**
 * Admin endpoints (ADMIN_UIDS only — see middleware/requireAdmin).
 *
 * Dataset visibility: current counts and last refresh time. Historical port
 * versions/changelog were intentionally removed from the permanent model.
 *
 * Access management lives in `team_members`, keyed by Firebase UID, so admins
 * add/remove partners from the app without a redeploy. Admins themselves come
 * from env only.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { invalidateGrantsCache, isAdmin, adminUids } = require('../services/access');
const { getVisiblePairs, setVisiblePairs } = require('../services/majorVisibility');
const { listDisplayNames, setDisplayName } = require('../services/displayNames');
const {
  listMembers, grantMember, revokeMember,
} = require('../services/teamMembers');

// Team roster with editable display names. Everyone who can be an assignee —
// env admins + granted partners — with the name the admin has set (or the
// email/uid fallback shown so the admin knows who each account is).
exports.listTeam = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const [grants, names] = await Promise.all([
    listMembers(auditDb, { access_status: 'granted' }),
    listDisplayNames(auditDb),
  ]);
  const emailOf = new Map(grants.map((g) => [String(g._id), g.email ?? null]));
  const admins = adminUids();
  const uids = [...new Set([...admins, ...grants.map((g) => String(g._id))])];
  const rows = uids
    .map((uid) => ({ uid, name: names.get(uid) ?? null, email: emailOf.get(uid) ?? null, is_admin: admins.has(uid) }))
    .sort((a, b) => String(a.name || a.email || a.uid).localeCompare(String(b.name || b.email || b.uid)));
  res.json({ rows });
});

exports.setTeamName = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const name = await setDisplayName(auditDb, req.params.uid, req.body?.name, req.user?.uid);
  res.json({ ok: true, uid: req.params.uid, name });
});

exports.getDataset = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const [settings, ...values] = await Promise.all([
    auditDb.collection('settings').findOne({ _id: 'app' }),
    ...['assist_agreements', 'assist_courses', 'assist_institutions', 'admissions']
      .map((name) => db.collection(name).estimatedDocumentCount()),
  ]);
  const names = ['assist_agreements', 'assist_courses', 'assist_institutions', 'admissions'];
  const counts = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const majors = await db.collection('assist_agreements').distinct('major');
  res.json({
    meta: {
      updated_at: settings?.last_data_refresh_at ?? null,
      counts,
      majors: { agreements: majors.sort() },
    },
    changelog: [],
  });
});

// Who can use the console right now: role of the caller's own view comes from
// /access/me; this lists everyone for the management UI.
exports.listAccess = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const grants = await auditDb.collection('team_members')
    .find({ access_status: 'granted' }).sort({ granted_at: 1 }).toArray();
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
  await grantMember(auditDb, {
    uid: cleanUid,
    email: typeof email === 'string' ? email.trim() : null,
    note: typeof note === 'string' ? note.trim() : null,
    by: req.user?.uid,
  });
  invalidateGrantsCache();
  res.json({ ok: true });
});

exports.revokeAccess = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const revoked = await revokeMember(auditDb, req.params.uid);
  invalidateGrantsCache();
  if (!revoked) return res.status(404).json({ error: 'no grant for that uid' });
  res.json({ ok: true });
});

// ── partner major visibility ──
// The ported dataset (everything in assist_agreements) is the admin's universe;
// `visible` is the (school, major) PAIR subset partners can see — pair
// granularity because the same major name exists at several campuses.
// Deny-by-default: until the admin selects pairs, partners see nothing.

// The ported universe, grouped by school for the admin UI.
async function portedBySchool(db) {
  const groups = await db.collection('assist_agreements').aggregate([
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

// Available to every console user (partner or admin): tells the frontend
// which role to render.
exports.getMe = asyncHandler(async (req, res) => {
  const uid = req.user?.uid ?? null;
  res.json({ uid, role: isAdmin(uid) ? 'admin' : 'partner' });
});
