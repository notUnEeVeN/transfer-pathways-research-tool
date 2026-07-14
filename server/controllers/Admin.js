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
const { setReleasedIds, setDisabledIds } = require('../services/analysisReleases');
const { listDisplayNames, setDisplayName } = require('../services/displayNames');
const {
  listMembers, grantMember, revokeMember,
} = require('../services/teamMembers');
const { AUDIT_RESULTS } = require('../services/audit/filters');

// Audit pulse — read-only auditing activity for the admin page. Deliberately
// no targets (the template pool is effectively unbounded): ALL-TIME verdict
// volume in Monday-start weekly buckets, the all-time per-person split, and
// what auditing has caught overall. Counts reflect each doc's LATEST verdict
// date (re-verdicts move a doc's row between weeks).
exports.getAuditPulse = asyncHandler(async (req, res) => {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  const rows = await auditDb.collection(AUDIT_RESULTS).find(
    { verified_at: { $exists: true } },
    { projection: { verified_at: 1, verifier_uid: 1, result: 1 } }
  ).toArray();

  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const firstAt = rows.length ? Math.min(...rows.map((r) => new Date(r.verified_at).getTime())) : monday.getTime();
  const start = new Date(monday.getTime() - Math.floor((monday.getTime() - firstAt) / WEEK_MS) * WEEK_MS);
  const weekCount = Math.max(1, Math.round((monday.getTime() - start.getTime()) / WEEK_MS) + 1);

  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    week_start: new Date(start.getTime() + i * WEEK_MS),
    count: 0, errors: 0, conservative: 0,
  }));
  const totals = { count: 0, errors: 0, conservative: 0 };
  const people = new Map();
  for (const row of rows) {
    const index = Math.floor((new Date(row.verified_at) - start) / WEEK_MS);
    if (index < 0 || index >= weekCount) continue;
    weeks[index].count += 1;
    totals.count += 1;
    const uid = row.verifier_uid ?? 'unknown';
    if (!people.has(uid)) people.set(uid, { count: 0, errors: 0, conservative: 0 });
    const person = people.get(uid);
    person.count += 1;
    if (row.result === 'error') { weeks[index].errors += 1; totals.errors += 1; person.errors += 1; }
    if (row.result === 'conservative') { weeks[index].conservative += 1; totals.conservative += 1; person.conservative += 1; }
  }
  const names = await listDisplayNames(auditDb);
  res.json({
    weeks,
    totals,
    people: [...people.entries()]
      .map(([uid, tallies]) => ({ uid, label: names.get(uid) || null, ...tallies }))
      .sort((a, b) => b.count - a.count),
  });
});

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

// ── working major visibility ──
// The ported dataset (everything in assist_agreements) is the admin inventory;
// `visible` selects exactly one working major for each campus. The same major
// name can exist at several campuses, so each choice remains a school+major
// pair. Deny-by-default: until choices are saved, partners see nothing.

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
  const schoolIds = pairs.map((p) => Number(p.school_id));
  if (new Set(schoolIds).size !== schoolIds.length) {
    return res.status(400).json({ error: 'choose at most one major per UC campus' });
  }
  const db = req.app.locals.db;
  const auditDb = req.app.locals.auditDb || db;
  const schools = await portedBySchool(db);
  const ported = new Set(
    schools.flatMap((s) => s.majors.map((m) => `${s.school_id}|${m}`))
  );
  const unknown = pairs.filter((p) => !ported.has(`${Number(p.school_id)}|${p.major}`));
  if (unknown.length) {
    return res.status(400).json({
      error: `not in the ported dataset: ${unknown.map((p) => `${p.school_id}:${p.major}`).join(' · ')}`,
    });
  }
  const selectedSchoolIds = new Set(schoolIds);
  const missing = schools.filter((school) => !selectedSchoolIds.has(Number(school.school_id)));
  if (missing.length) {
    return res.status(400).json({
      error: `choose one major for every UC campus; missing: ${missing.map((school) => school.school).join(' · ')}`,
    });
  }
  const visible = await setVisiblePairs(auditDb, pairs, req.user?.uid);
  res.json({ ok: true, visible });
});

// Built-in visual presentation settings. Published controls partner gallery
// visibility; hidden controls whether the card mounts anywhere, including the
// admin's own gallery. Each update changes only its own list.
exports.putAnalysisReleases = asyncHandler(async (req, res) => {
  const { released_ids } = req.body || {};
  if (!Array.isArray(released_ids) || released_ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'released_ids must be an array of analysis id strings' });
  }
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const saved = await setReleasedIds(auditDb, released_ids, req.user?.uid);
  res.json({ ok: true, released_ids: saved });
});

exports.putAnalysisDisabled = asyncHandler(async (req, res) => {
  const { disabled_ids } = req.body || {};
  if (!Array.isArray(disabled_ids) || disabled_ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'disabled_ids must be an array of analysis id strings' });
  }
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const saved = await setDisabledIds(auditDb, disabled_ids, req.user?.uid);
  res.json({ ok: true, disabled_ids: saved });
});

// Available to every console user (partner or admin): tells the frontend
// which role to render.
exports.getMe = asyncHandler(async (req, res) => {
  const uid = req.user?.uid ?? null;
  res.json({ uid, role: isAdmin(uid) ? 'admin' : 'partner' });
});
