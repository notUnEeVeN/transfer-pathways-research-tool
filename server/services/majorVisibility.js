// Console-wide visibility, per (school, major) PAIR. The research cluster
// holds every major the admin has PORTED; a single config doc holds the
// admin-selected school+major combinations that form the project's WORKING
// DATASET — pair granularity because the same major name ("Computer Science
// B.S.") exists at several UCs. The selection scopes EVERY console surface
// for every account (admin included); the Admin tab is where the full ported
// universe stays visible and the selection is edited. Partners additionally
// get deny-by-default before any selection exists.
//
//   dataset_config (audit handle):
//     { _id: 'partner_access', visible_pairs: [{ school_id: Number, major: String }] }
//
// Enforcement is server-side at the query builders (audit filters, agreements
// batch, analysis) — the frontend never sees data outside the subset, so
// partners' stats pages automatically reflect exactly the granted pairs.
const crypto = require('crypto');
const { isAdmin } = require('./access');

const CONFIG = 'dataset_config';
const DOC_ID = 'partner_access';

const TTL_MS = 15 * 1000;
let cache = { at: 0, loaded: false, pairs: undefined }; // pairs: undefined = no config doc yet

const normalizePair = (p) => ({ school_id: Number(p.school_id), major: String(p.major) });

// Raw config state: undefined when no selection has ever been saved,
// else the saved pairs (possibly []).
async function loadConfig(auditDb) {
  const now = Date.now();
  if (cache.loaded && now - cache.at < TTL_MS) return cache.pairs;
  const doc = await auditDb.collection(CONFIG).findOne({ _id: DOC_ID });
  cache = { at: now, loaded: true, pairs: doc ? (doc.visible_pairs || []).map(normalizePair) : undefined };
  return cache.pairs;
}

async function getVisiblePairs(auditDb) {
  return (await loadConfig(auditDb)) ?? [];
}

async function setVisiblePairs(auditDb, pairs, uid) {
  await auditDb.collection(CONFIG).replaceOne(
    { _id: DOC_ID },
    {
      _id: DOC_ID,
      visible_pairs: pairs.map(normalizePair),
      updated_by: uid ?? null,
      updated_at: new Date(),
    },
    { upsert: true }
  );
  invalidateVisibilityCache();
}

function invalidateVisibilityCache() {
  cache = { at: 0, loaded: false, pairs: undefined };
}

/**
 * The visibility scope for a request. The saved selection is the project's
 * WORKING DATASET, so it scopes everyone — the admin included; the Admin tab
 * is where the full ported universe remains visible and the selection is
 * changed. Only before any selection has been saved do the roles diverge:
 * admins are unrestricted (null) so a fresh deployment isn't empty, while
 * partners are denied (deny-by-default).
 */
async function majorScope(req) {
  const auditDb = req.app.locals.auditDb || req.app.locals.db;
  const pairs = await loadConfig(auditDb);
  if (pairs === undefined) return isAdmin(req.user?.uid) ? null : [];
  return pairs;
}

// True when a (schoolId, major) combination is inside the scope. `null`
// scope = admin = everything.
function pairAllowed(pairs, schoolId, major) {
  if (pairs == null) return true;
  return pairs.some((p) => p.school_id === Number(schoolId) && p.major === String(major));
}

// Mongo clause matching only the visible pairs (for a collection whose school
// id lives in `idField`). Empty scope matches nothing.
function pairClause(pairs, idField) {
  if (!pairs.length) return { _id: { $exists: false } };
  return { $or: pairs.map((p) => ({ [idField]: p.school_id, major: p.major })) };
}

// Short stable tag for cache keys, so admin (unscoped) and partner (scoped)
// results never share an entry — and a visibility edit changes the tag.
function scopeTag(pairs) {
  if (pairs == null) return 'all';
  const joined = pairs.map((p) => `${p.school_id}|${p.major}`).sort().join(' ');
  return crypto.createHash('md5').update(joined).digest('hex').slice(0, 10);
}

module.exports = {
  getVisiblePairs, setVisiblePairs, invalidateVisibilityCache,
  majorScope, pairAllowed, pairClause, scopeTag,
};
