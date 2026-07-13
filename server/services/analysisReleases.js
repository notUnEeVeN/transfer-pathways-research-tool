// Which built-in visuals are published to partners, and which are hidden from
// the admin's own Visuals tab.
//
// The analysis registry itself is frontend code (each entry pairs an id with a
// React component); this config only stores ID SETS:
//   released_ids — published for partners. Admins see every non-disabled
//     analysis (badged Admin only/Published) — publishing is presentation staging so
//     iterative work ships one analysis at a time, not a per-analysis data
//     boundary (they all read the already-gated /analysis endpoints).
//   disabled_ids — hidden from EVERYONE, admins included. A hidden analysis
//     is not mounted at all, so nothing is fetched or computed for it — the
//     admin's "park it until I work on it" switch. Disabled wins over released.
//
//   settings (audit handle):
//     { _id: 'app', visual_published_ids: [String], visual_hidden_ids: [String],
//       updated_by, updated_at }
//
// Default (no doc yet) is [] for both — hidden from partners until explicitly
// released, visible to admins until explicitly disabled.
const CONFIG = 'settings';
const DOC_ID = 'app';
const RELEASED_FIELD = 'visual_published_ids';
const DISABLED_FIELD = 'visual_hidden_ids';

const TTL_MS = 15 * 1000;
let cache = { at: 0, loaded: false, released: undefined, disabled: undefined };

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

async function loadConfig(auditDb) {
  const now = Date.now();
  if (cache.loaded && now - cache.at < TTL_MS) return cache;
  const doc = await auditDb.collection(CONFIG).findOne({ _id: DOC_ID });
  cache = {
    at: now,
    loaded: true,
    released: normalizeIds(doc?.[RELEASED_FIELD]),
    disabled: normalizeIds(doc?.[DISABLED_FIELD]),
  };
  return cache;
}

async function getReleasedIds(auditDb) {
  return (await loadConfig(auditDb)).released.slice(); // a copy — callers must not mutate the cache
}

async function getDisabledIds(auditDb) {
  return (await loadConfig(auditDb)).disabled.slice();
}

// Each setter $sets only its own list (plus who/when), so releasing never
// clobbers the disabled set and vice versa.
async function saveIds(auditDb, field, ids, uid) {
  const clean = normalizeIds(ids);
  await auditDb.collection(CONFIG).updateOne(
    { _id: DOC_ID },
    { $set: { [field]: clean, updated_by: uid ?? null, updated_at: new Date() } },
    { upsert: true }
  );
  invalidateReleasesCache();
  return clean;
}

async function setReleasedIds(auditDb, ids, uid) {
  return saveIds(auditDb, RELEASED_FIELD, ids, uid);
}

async function setDisabledIds(auditDb, ids, uid) {
  return saveIds(auditDb, DISABLED_FIELD, ids, uid);
}

function invalidateReleasesCache() {
  cache = { at: 0, loaded: false, released: undefined, disabled: undefined };
}

module.exports = {
  getReleasedIds, setReleasedIds,
  getDisabledIds, setDisabledIds,
  invalidateReleasesCache, normalizeIds,
};
