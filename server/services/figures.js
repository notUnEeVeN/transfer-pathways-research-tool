/**
 * Published figures — the team's shared statistics gallery.
 *
 * Partners run their analysis scripts locally (pmt.py, served at
 * /client/pmt.py) and call pmt.publish(fig, slug, title): the rendered
 * SVG/PNG/PDF land here, one doc per slug (latest wins), stamped with the
 * dataset_version the data was fetched at. The console's Data → Analysis tab
 * lists them for everyone; downloads feed the paper.
 *
 * Storage (audit handle):
 *   figures: { _id: slug, title, caption, source_url, author_uid,
 *              author_label, dataset_version, formats: { svg, png, pdf },
 *              created_at, updated_at }
 */
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

// The publisher's display name. Firebase tokens carry an email; pmtr_ tokens
// (the usual publish path) only carry a uid, so fall back to the partner's
// grant email, then the token label.
async function resolveAuthorLabel(auditDb, user = {}) {
  if (user.email) return user.email;
  if (!user.uid) return null;
  const grant = await auditDb.collection('access_grants').findOne({ _id: user.uid }, { projection: { email: 1 } });
  if (grant?.email) return grant.email;
  const token = await auditDb.collection('api_tokens').findOne({ uid: user.uid }, { projection: { label: 1 } });
  return token?.label ?? null;
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

module.exports = {
  validateFigurePayload, resolveAuthorLabel,
  upsertFigure, listFigures, getFigureFormat, removeFigure,
};
