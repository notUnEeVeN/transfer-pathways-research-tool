// Which live analyses are "released" to partners on the Data → Analysis tab.
//
// The analysis registry itself is frontend code (each entry pairs an id with a
// React component); this config only stores the SET OF IDS that are live for
// partners. Admins always see every registered analysis (badged Draft/Released
// for preview) — releasing is presentation staging so iterative work ships one
// analysis at a time, not a per-analysis data boundary (they all read the
// already-gated /analysis/coverage endpoint).
//
//   dataset_config (audit handle):
//     { _id: 'analysis_releases', released_ids: [String], updated_by, updated_at }
//
// Default (no doc yet) is [] — hidden until explicitly released.
const CONFIG = 'dataset_config';
const DOC_ID = 'analysis_releases';

const TTL_MS = 15 * 1000;
let cache = { at: 0, loaded: false, ids: undefined };

// Pure trim/dedupe/string-filter. Non-array or junk entries collapse to a
// clean string[] so a bad body can never persist non-ids.
function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string') continue;
    const s = id.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function loadIds(auditDb) {
  const now = Date.now();
  if (cache.loaded && now - cache.at < TTL_MS) return cache.ids;
  const doc = await auditDb.collection(CONFIG).findOne({ _id: DOC_ID });
  cache = { at: now, loaded: true, ids: normalizeIds(doc?.released_ids) };
  return cache.ids;
}

async function getReleasedIds(auditDb) {
  return (await loadIds(auditDb)).slice(); // a copy — callers must not mutate the cache
}

async function setReleasedIds(auditDb, ids, uid) {
  const clean = normalizeIds(ids);
  await auditDb.collection(CONFIG).replaceOne(
    { _id: DOC_ID },
    { _id: DOC_ID, released_ids: clean, updated_by: uid ?? null, updated_at: new Date() },
    { upsert: true }
  );
  invalidateReleasesCache();
  return clean;
}

function invalidateReleasesCache() {
  cache = { at: 0, loaded: false, ids: undefined };
}

module.exports = { getReleasedIds, setReleasedIds, invalidateReleasesCache, normalizeIds };
