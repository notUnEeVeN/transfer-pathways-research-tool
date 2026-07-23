// Console-wide scope is the union of exact campus/program pairs in the major
// config. Atlas can temporarily hold additional imported programs while a new
// field is being researched, but those rows do not enter the website, audit,
// or analyses until the field is deliberately configured. Adding Biology or
// Economics therefore cannot change a Computer Science result.
//
//   settings (audit handle):
//     { _id: 'app', visible_pairs: [{ school_id: Number, major: String }] }
//
// Enforcement is server-side at the query builders (audit filters, agreements
// batch, analysis) — the frontend never sees data outside the subset, so
// partners' stats pages automatically reflect exactly the granted pairs.
const crypto = require('crypto');
const { listMajors, programPairs } = require('../config/majors');

const CONFIG = 'settings';
const DOC_ID = 'app';

const TTL_MS = 15 * 1000;
let cache = { at: 0, loaded: false, pairs: undefined }; // pairs: undefined = no config doc yet

const normalizePair = (p) => ({ school_id: Number(p.school_id), major: String(p.major) });

// Normalize the saved selection: numeric ids, string majors, exact duplicates
// dropped, order preserved. A campus may carry several majors — one per
// onboarded field (CS, Biology, Economics) — so only whole-pair duplicates
// are collapsed.
function normalizePairs(pairs = []) {
  const seen = new Set();
  const clean = [];
  for (const raw of pairs || []) {
    const pair = normalizePair(raw);
    const key = `${pair.school_id}|${pair.major}`;
    if (seen.has(key)) continue;
    seen.add(key);
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
  cache = { at: now, loaded: true, pairs: doc ? normalizePairs(doc.visible_pairs) : undefined };
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
  return doc ? normalizePairs(doc.visible_pairs) : [];
}

async function setVisiblePairs(auditDb, pairs, uid) {
  const clean = normalizePairs(pairs);
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
 * The configured exact pair scope for every request. This is intentionally
 * independent of the historical `settings.app.visible_pairs` selector: major
 * onboarding has one source of truth (`config/majors.js`) and fails closed.
 * Account-level access remains enforced upstream by requireAuditAccess.
 *
 * The settings helpers remain for backwards-compatible Admin/settings reads;
 * they no longer decide what enters a website query or figure.
 */
async function majorScope() {
  return normalizePairs(listMajors().flatMap((major) => programPairs(major)));
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
  majorScope, pairAllowed, pairClause, scopeTag, normalizePairs,
};
