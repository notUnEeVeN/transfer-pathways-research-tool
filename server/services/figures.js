/**
 * Published figures — the team's shared statistics gallery.
 *
 * Partners render figures on their own machines and publish only the finished
 * SVG/PNG/PDF files through pmt.publish(fig, ...). One document is stored per
 * slug (latest owner publish wins); no Python code is uploaded or executed.
 *
 * Storage (audit handle):
 *   published_figures: { _id: slug, title, caption, source_url, author_uid,
 *              author_label, formats: { svg: Binary, png: Binary, pdf: Binary },
 *              created_at, updated_at }
 */
const { getDisplayName } = require('./displayNames');
const { getMember } = require('./teamMembers');

const COLLECTION = 'published_figures';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const FORMATS = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf' };
// Keep the whole BSON document safely below MongoDB's 16 MiB document limit.
// Binary is stored directly instead of base64, which also avoids 33% storage
// overhead. A normal 300-dpi paper figure is comfortably below this total.
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

const b64Bytes = (s) => Math.floor((s.length * 3) / 4);

// Returns { error } or { value: clean payload }.
function validateFigurePayload(body = {}) {
  const { slug, title, caption, source_url, formats } = body;
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { error: 'slug must be 1-64 chars of a-z 0-9 - _ (e.g. "coverage-heatmap")' };
  }
  if (typeof title !== 'string' || !title.trim()) return { error: 'title required' };
  if (!formats || typeof formats !== 'object' || typeof formats.svg !== 'string' || !formats.svg) {
    return { error: 'formats.svg required (base64) — publish from pmt.py renders it automatically' };
  }
  const clean = {};
  let totalBytes = 0;
  for (const [fmt, data] of Object.entries(formats)) {
    if (!(fmt in FORMATS)) return { error: `unknown format "${fmt}" (svg, png, pdf)` };
    if (typeof data !== 'string' || !data) continue;
    totalBytes += b64Bytes(data);
    clean[fmt] = data;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return { error: `figure files exceed ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB total — reduce the PNG size/dpi` };
  }
  return {
    value: {
      slug,
      title: title.trim(),
      caption: typeof caption === 'string' && caption.trim() ? caption.trim() : null,
      source_url: typeof source_url === 'string' && source_url.trim() ? source_url.trim() : null,
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
  const member = await getMember(auditDb, user.uid);
  if (member?.email) return member.email;
  const token = await auditDb.collection('api_tokens').findOne(
    { uid: user.uid, ephemeral: { $ne: true }, label: { $type: 'string', $ne: '' } },
    { projection: { label: 1 }, sort: { last_used_at: -1, created_at: -1 } }
  );
  return token?.label ?? shortUidLabel(user.uid);
}

async function upsertFigure(auditDb, payload, { author_uid, author_label }) {
  const now = new Date();
  const { slug, formats, ...rest } = payload;
  const binaryFormats = Object.fromEntries(
    Object.entries(formats).map(([format, value]) => [format, Buffer.from(value, 'base64')])
  );
  await auditDb.collection(COLLECTION).updateOne(
    { _id: slug },
    {
      $set: {
        ...rest,
        formats: binaryFormats,
        author_uid: author_uid ?? null,
        author_label: author_label ?? null,
        updated_at: now,
      },
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
    svg: formats?.svg ? Buffer.from(formats.svg.buffer ?? formats.svg).toString('base64') : null,
    ...rest,
  }));
}

async function getFigureFormat(auditDb, slug, format) {
  const contentType = FORMATS[format];
  if (!contentType) return null;
  const doc = await auditDb.collection(COLLECTION).findOne(
    { _id: slug },
    { projection: { [`formats.${format}`]: 1 } }
  );
  const data = doc?.formats?.[format];
  if (!data) return null;
  return {
    contentType,
    buffer: Buffer.from(data.buffer ?? data),
    filename: `${slug}.${format}`,
  };
}

async function removeFigure(auditDb, slug) {
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: slug });
  return deletedCount > 0;
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
  getFigureAuthor, updateFigureMeta,
  COLLECTION,
};
