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
 */
const crypto = require('crypto');

const COLLECTION = 'api_tokens';
const PREFIX = 'pmtr_';
const TOKEN_RE = /^pmtr_[A-Za-z0-9_-]{30,}$/;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function looksLikeApiToken(raw) {
  return TOKEN_RE.test(String(raw || ''));
}

function generateToken() {
  return `${PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
}

// hash → { at, uid|null } — keeps the per-request lookup off the DB.
const TTL_MS = 60 * 1000;
const cache = new Map();

async function uidForToken(auditDb, raw) {
  if (!looksLikeApiToken(raw)) return null;
  const hash = sha256(raw);
  const hit = cache.get(hash);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.uid;
  const doc = await auditDb.collection(COLLECTION).findOne({ _id: hash });
  const uid = doc?.uid ?? null;
  cache.set(hash, { at: Date.now(), uid });
  if (uid) {
    // Fire-and-forget freshness marker; precision doesn't matter.
    auditDb.collection(COLLECTION)
      .updateOne({ _id: hash }, { $set: { last_used_at: new Date() } })
      .catch(() => {});
  }
  return uid;
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

async function listTokens(auditDb, uid) {
  const docs = await auditDb.collection(COLLECTION)
    .find({ uid }, { projection: { uid: 0 } })
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

module.exports = {
  looksLikeApiToken, uidForToken, createToken, listTokens, revokeToken,
  generateToken, _clearTokenCache,
};
