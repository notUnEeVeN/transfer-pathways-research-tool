/**
 * Published figures — the team's shared statistics gallery.
 *
 * Partners publish live analysis scripts through pmt.py (served at
 * /client/pmt.py). The runner captures the rendered SVG/PNG/PDF here, one doc
 * per slug (latest wins), stamped with the dataset_version the data was
 * fetched at. The console's Data → Analysis tab lists them for everyone;
 * downloads feed the paper.
 *
 * Storage (audit handle):
 *   figures: { _id: slug, title, caption, source_url, author_uid,
 *              author_label, dataset_version, formats: { svg, png, pdf },
 *              created_at, updated_at }
 */
const { getDisplayName } = require('./displayNames');

const COLLECTION = 'figures';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const FORMATS = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf' };
// Per-format decoded cap. 300-dpi PNGs of dense heatmaps run a few MB;
// anything past this is a mistake, not a figure.
const MAX_FORMAT_BYTES = 12 * 1024 * 1024;

const b64Bytes = (s) => Math.floor((s.length * 3) / 4);

// Returns { error } or { value: clean payload }.
function validateFigurePayload(body = {}) {
  const { slug, title, caption, source_url, dataset_version, formats } = body;
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { error: 'slug must be 1-64 chars of a-z 0-9 - _ (e.g. "coverage-heatmap")' };
  }
  if (typeof title !== 'string' || !title.trim()) return { error: 'title required' };
  if (!formats || typeof formats !== 'object' || typeof formats.svg !== 'string' || !formats.svg) {
    return { error: 'formats.svg required (base64) — publish from pmt.py renders it automatically' };
  }
  const clean = {};
  for (const [fmt, data] of Object.entries(formats)) {
    if (!(fmt in FORMATS)) return { error: `unknown format "${fmt}" (svg, png, pdf)` };
    if (typeof data !== 'string' || !data) continue;
    if (b64Bytes(data) > MAX_FORMAT_BYTES) {
      return { error: `${fmt} exceeds ${Math.round(MAX_FORMAT_BYTES / 1024 / 1024)}MB — reduce the figure size/dpi` };
    }
    clean[fmt] = data;
  }
  return {
    value: {
      slug,
      title: title.trim(),
      caption: typeof caption === 'string' && caption.trim() ? caption.trim() : null,
      source_url: typeof source_url === 'string' && source_url.trim() ? source_url.trim() : null,
      dataset_version: typeof dataset_version === 'string' && dataset_version ? dataset_version : null,
      formats: clean,
    },
  };
}

const shortUidLabel = (uid) => (uid ? `UID ${String(uid).slice(0, 8)}` : null);

// The publisher's display name. Firebase tokens carry an email; pmtr_ tokens
// (the usual publish path) only carry a uid, so fall back to the partner's
// grant email, then a durable token label, then a short UID label.
async function resolveAuthorLabel(auditDb, user = {}) {
  // An admin-set display name wins over everything, so names read consistently
  // across task assignees and figure authors (services/displayNames.js).
  if (user.uid) {
    const name = await getDisplayName(auditDb, user.uid);
    if (name) return name;
  }
  if (user.email) return user.email;
  if (!user.uid) return null;
  const grant = await auditDb.collection('access_grants').findOne({ _id: user.uid }, { projection: { email: 1 } });
  if (grant?.email) return grant.email;
  const token = await auditDb.collection('api_tokens').findOne(
    { uid: user.uid, ephemeral: { $ne: true }, label: { $type: 'string', $ne: '' } },
    { projection: { label: 1 }, sort: { last_used_at: -1, created_at: -1 } }
  );
  return token?.label ?? shortUidLabel(user.uid);
}

async function upsertFigure(auditDb, payload, { author_uid, author_label }) {
  const now = new Date();
  const { slug, ...rest } = payload;
  await auditDb.collection(COLLECTION).updateOne(
    { _id: slug },
    {
      $set: { ...rest, author_uid: author_uid ?? null, author_label: author_label ?? null, updated_at: now },
      $setOnInsert: { created_at: now },
    },
    { upsert: true }
  );
}

async function listFigures(auditDb) {
  const docs = await auditDb.collection(COLLECTION)
    .find({}, { projection: { 'formats.png': 0, 'formats.pdf': 0 } })
    .sort({ updated_at: -1 })
    .toArray();
  return docs.map(({ _id, formats, ...rest }) => ({
    slug: String(_id),
    svg: formats?.svg ?? null,
    ...rest,
  }));
}

async function getFigureFormat(auditDb, slug, format) {
  const contentType = FORMATS[format];
  if (!contentType) return null;
  const doc = await auditDb.collection(COLLECTION).findOne(
    { _id: slug },
    { projection: { [`formats.${format}`]: 1, dataset_version: 1 } }
  );
  const data = doc?.formats?.[format];
  if (!data) return null;
  return {
    contentType,
    buffer: Buffer.from(data, 'base64'),
    filename: `${slug}${doc.dataset_version ? `__${doc.dataset_version}` : ''}.${format}`,
  };
}

async function removeFigure(auditDb, slug) {
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: slug });
  return deletedCount > 0;
}

// Live-figure state, maintained by the figure runner. computed_at only moves
// on success: an error keeps the last good render (and its timestamp) visible.
async function markFigureLive(auditDb, slug, { status }) {
  const $set = { mode: 'live', 'live.status': status };
  if (status === 'ok') $set['live.computed_at'] = new Date();
  await auditDb.collection(COLLECTION).updateOne({ _id: slug }, { $set });
}

async function clearFigureLive(auditDb, slug) {
  await auditDb.collection(COLLECTION).updateOne({ _id: slug }, { $unset: { mode: '', live: '' } });
}

// author_uid for edit/delete gating. found:false = missing (404); null author
// = legacy row (admin-only).
async function getFigureAuthor(auditDb, slug) {
  const doc = await auditDb.collection(COLLECTION).findOne(
    { _id: slug }, { projection: { author_uid: 1 } });
  if (!doc) return { found: false };
  return { found: true, author_uid: doc.author_uid ?? null };
}

// Metadata-only edit (the image changes only via re-publish). Returns { error }
// or { value } with the provided, cleaned fields.
function validateFigureMeta(body = {}) {
  const out = {};
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return { error: 'title must be a non-empty string' };
    }
    out.title = body.title.trim();
  }
  if (body.caption !== undefined) {
    out.caption = typeof body.caption === 'string' && body.caption.trim() ? body.caption.trim() : null;
  }
  if (body.source_url !== undefined) {
    out.source_url = typeof body.source_url === 'string' && body.source_url.trim() ? body.source_url.trim() : null;
  }
  if (Object.keys(out).length === 0) {
    return { error: 'nothing to update (title, caption, or source_url)' };
  }
  return { value: out };
}

async function updateFigureMeta(auditDb, slug, fields) {
  const { matchedCount } = await auditDb.collection(COLLECTION).updateOne(
    { _id: slug },
    { $set: { ...fields, updated_at: new Date() } }
  );
  return matchedCount > 0;
}

module.exports = {
  validateFigurePayload, validateFigureMeta, resolveAuthorLabel,
  upsertFigure, listFigures, getFigureFormat, removeFigure,
  getFigureAuthor, updateFigureMeta, markFigureLive, clearFigureLive,
};
