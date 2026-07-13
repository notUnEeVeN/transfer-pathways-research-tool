// Console-wide visibility, with one (school, major) PAIR per configured campus.
// The research cluster holds every major the admin has ported; a single config
// doc selects the project's working major at each UC. Pair granularity still
// matters because the same major name can exist at several campuses. The
// selection scopes every console surface for every account (admin included);
// the Admin tab retains the full ported inventory. Partners additionally get
// deny-by-default before any selection exists.
//
//   settings (audit handle):
//     { _id: 'app', visible_pairs: [{ school_id: Number, major: String }] }
//
// Enforcement is server-side at the query builders (audit filters, agreements
// batch, analysis) — the frontend never sees data outside the subset, so
// partners' stats pages automatically reflect exactly the granted pairs.
const crypto = require('crypto');
const { isAdmin } = require('./access');

const CONFIG = 'settings';
const DOC_ID = 'app';

const TTL_MS = 15 * 1000;
let cache = { at: 0, loaded: false, pairs: undefined }; // pairs: undefined = no config doc yet

const normalizePair = (p) => ({ school_id: Number(p.school_id), major: String(p.major) });

// Preserve the first saved choice when reading an older config that allowed
// several majors at one campus. New writes are also validated by the endpoint.
function onePairPerSchool(pairs = []) {
  const seen = new Set();
  const clean = [];
  for (const raw of pairs || []) {
    const pair = normalizePair(raw);
    if (seen.has(pair.school_id)) continue;
    seen.add(pair.school_id);
    clean.push(pair);
  }
  return clean;
}

// Raw config state: undefined when no selection has ever been saved,
// else the saved pairs (possibly []).
async function loadConfig(auditDb) {
  const now = Date.now();
  if (cache.loaded && now - cache.at < TTL_MS) return cache.pairs;
  const doc = await auditDb.collection(CONFIG).findOne({ _id: DOC_ID });
  cache = { at: now, loaded: true, pairs: doc ? onePairPerSchool(doc.visible_pairs) : undefined };
  return cache.pairs;
}

async function getVisiblePairs(auditDb) {
  return (await loadConfig(auditDb)) ?? [];
}

// Uncached read of the saved selection, for callers that must reflect the
// current working dataset immediately rather than within the visibility cache's
// TTL (e.g. the paper figures' ASSIST view, which resolves each campus's
// program from this selection). Returns normalized pairs; [] when unset.
async function readVisiblePairsUncached(auditDb) {
  const doc = await auditDb.collection(CONFIG).findOne({ _id: DOC_ID });
  return doc ? onePairPerSchool(doc.visible_pairs) : [];
}

async function setVisiblePairs(auditDb, pairs, uid) {
  const clean = onePairPerSchool(pairs);
  await auditDb.collection(CONFIG).updateOne(
    { _id: DOC_ID },
    {
      $set: {
        visible_pairs: clean,
        updated_by: uid ?? null,
        updated_at: new Date(),
      },
    },
    { upsert: true }
  );
  invalidateVisibilityCache();
  return clean;
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
  getVisiblePairs, readVisiblePairsUncached, setVisiblePairs, invalidateVisibilityCache,
  majorScope, pairAllowed, pairClause, scopeTag, onePairPerSchool,
};
