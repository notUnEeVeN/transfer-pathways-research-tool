// Role-based access for the research console.
//
// Two tiers:
//   admin   — Firebase UIDs in the ADMIN_UIDS env var (comma-separated).
//             Bootstrapped from env so the deployment always has an owner.
//             Admins manage the dataset and partner access from the app.
//   partner — UIDs whose `team_members.access_status` is granted (managed by
//             admins via /admin/access; no redeploy needed to add/remove).
//
// The backend is the real security boundary; any client-side role mirror only
// hides UI. Grants are cached briefly per-process to keep the per-request
// check off the database.
function parseUids(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

// Env is read per call (cached on the raw value) so module-load order and
// tests stay simple.
let cachedRaw;
let cachedAdmins = new Set();
function adminUids(env = process.env) {
  const raw = env.ADMIN_UIDS || '';
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedAdmins = parseUids(raw);
  }
  return cachedAdmins;
}

function isAdmin(uid, env = process.env) {
  return typeof uid === 'string' && adminUids(env).has(uid);
}

const GRANTS_TTL_MS = 30 * 1000;
let grantsCache = { at: 0, uids: new Set() };

async function grantedUids(auditDb) {
  const now = Date.now();
  if (now - grantsCache.at > GRANTS_TTL_MS) {
    const docs = await auditDb.collection('team_members')
      .find({ access_status: 'granted' }, { projection: { _id: 1 } }).toArray();
    grantsCache = { at: now, uids: new Set(docs.map((d) => String(d._id))) };
  }
  return grantsCache.uids;
}

// Called by the admin controller after a grant/revoke so changes apply
// immediately instead of after the TTL.
function invalidateGrantsCache() {
  grantsCache = { at: 0, uids: new Set() };
}

async function isConsoleAllowed(uid, auditDb, env = process.env) {
  if (typeof uid !== 'string' || !uid) return false;
  if (isAdmin(uid, env)) return true;
  return (await grantedUids(auditDb)).has(uid);
}

module.exports = { parseUids, adminUids, isAdmin, isConsoleAllowed, invalidateGrantsCache };
