/**
 * Personal API tokens — durable credentials for partners' scripts/notebooks.
 *
 * Firebase ID tokens expire hourly, which is unusable for programmatic
 * access. A console user generates a token in the app (API docs tab); their
 * scripts then send `Authorization: Bearer pmtr_…`. The middleware maps the
 * token back to the owner's uid, so EVERY existing enforcement layer —
 * console allowlist, admin role, (school, major) visibility — applies to
 * token requests exactly as it does in the browser.
 *
 * Storage (audit handle), one doc per token, keyed by hash — the plaintext
 * is shown once at creation and never stored:
 *   api_tokens: { _id: sha256(token), uid, label, created_at, last_used_at }
 *
 * The figure runner mints short-lived credentials the same way, with two
 * extra fields: { ephemeral: true, expires_at }. They authenticate through
 * the exact same path (so every enforcement layer applies), stop working at
 * expires_at even if a crash skips revocation, and never show up in the
 * user-facing token list.
 */
const crypto = require('crypto');

const COLLECTION = 'api_tokens';
const PREFIX = 'pmtr_';
const TOKEN_RE = /^pmtr_[A-Za-z0-9_-]{30,}$/;
// The same pattern, unanchored: finds a real credential pasted INSIDE text
// (figure scripts are stored and peer-visible, so uploads are scanned).
const TOKEN_LITERAL_RE = /pmtr_[A-Za-z0-9_-]{30,}/;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function looksLikeApiToken(raw) {
  return TOKEN_RE.test(String(raw || ''));
}

function generateToken() {
  return `${PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
}

// hash → { at, uid|null, ephemeral, expires_at|null } — keeps the per-request
// lookup off the DB. Expiry is re-checked on every read so a cached ephemeral
// token dies on time.
const TTL_MS = 60 * 1000;
const cache = new Map();

const liveUid = (entry) =>
  entry.expires_at && entry.expires_at.getTime() <= Date.now() ? null : entry.uid;

// Full resolution: { uid, ephemeral } for a live token, null otherwise. The
// ephemeral flag is what the auth middleware uses to make runner-minted
// credentials read-only.
async function resolveApiToken(auditDb, raw) {
  if (!looksLikeApiToken(raw)) return null;
  const hash = sha256(raw);
  const hit = cache.get(hash);
  if (hit && Date.now() - hit.at < TTL_MS) {
    const uid = liveUid(hit);
    return uid ? { uid, ephemeral: !!hit.ephemeral } : null;
  }
  const doc = await auditDb.collection(COLLECTION).findOne({ _id: hash });
  const entry = {
    at: Date.now(),
    uid: doc?.uid ?? null,
    ephemeral: !!doc?.ephemeral,
    expires_at: doc?.expires_at ?? null,
  };
  cache.set(hash, entry);
  const uid = liveUid(entry);
  if (uid) {
    // Fire-and-forget freshness marker; precision doesn't matter.
    auditDb.collection(COLLECTION)
      .updateOne({ _id: hash }, { $set: { last_used_at: new Date() } })
      .catch(() => {});
  }
  return uid ? { uid, ephemeral: entry.ephemeral } : null;
}

async function uidForToken(auditDb, raw) {
  return (await resolveApiToken(auditDb, raw))?.uid ?? null;
}

async function createToken(auditDb, uid, label) {
  const token = generateToken();
  await auditDb.collection(COLLECTION).insertOne({
    _id: sha256(token),
    uid,
    label: String(label || '').trim() || null,
    created_at: new Date(),
    last_used_at: null,
  });
  return token; // plaintext — shown once
}

async function createEphemeralToken(auditDb, uid, { ttlMs = 10 * 60 * 1000 } = {}) {
  const token = generateToken();
  const hash = sha256(token);
  await auditDb.collection(COLLECTION).insertOne({
    _id: hash,
    uid,
    label: 'figure-runner',
    ephemeral: true,
    created_at: new Date(),
    last_used_at: null,
    expires_at: new Date(Date.now() + ttlMs),
  });
  const revoke = async () => {
    await auditDb.collection(COLLECTION).deleteOne({ _id: hash });
    cache.delete(hash);
  };
  return { token, revoke };
}

async function listTokens(auditDb, uid) {
  const docs = await auditDb.collection(COLLECTION)
    .find({ uid, ephemeral: { $ne: true } }, { projection: { uid: 0 } })
    .sort({ created_at: 1 })
    .toArray();
  return docs.map((d) => ({
    id: d._id, // the hash — safe to expose, cannot be inverted to the token
    label: d.label,
    created_at: d.created_at,
    last_used_at: d.last_used_at,
  }));
}

async function revokeToken(auditDb, uid, id) {
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: id, uid });
  cache.delete(id);
  return deletedCount > 0;
}

function _clearTokenCache() {
  cache.clear();
}

// Crash-skipped ephemeral runner tokens die at expires_at anyway (checked at
// resolution time); the TTL index just tidies the leftover docs.
async function ensureTokenIndexes(auditDb) {
  await auditDb.collection(COLLECTION).createIndex(
    { expires_at: 1 },
    { expireAfterSeconds: 0, partialFilterExpression: { ephemeral: true } }
  );
}

module.exports = {
  looksLikeApiToken, uidForToken, resolveApiToken, createToken, createEphemeralToken,
  listTokens, revokeToken, generateToken, ensureTokenIndexes, _clearTokenCache,
  TOKEN_LITERAL_RE,
};
