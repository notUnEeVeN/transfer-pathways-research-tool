/**
 * Published visuals — the team's shared statistics gallery.
 *
 * The beginner path stays deliberately small: partners render figures on their
 * own machines and publish only finished SVG/PNG/PDF files. A named interactive
 * publication instead stores a validated renderer manifest; the frontend then
 * mounts the same audited React component as the corresponding built-in. No
 * Python or JavaScript supplied by a researcher is uploaded or executed.
 *
 * Storage (audit handle):
 *   published_figures static root:
 *     { _id: slug, title, caption, source_url, author_uid, author_label,
 *       publication_type: 'static', formats: { svg, png, pdf },
 *       controls?, variants?, default_variant?,
 *       created_at, updated_at }
 *
 *   published_figures interactive root:
 *     { _id: slug, title, caption, source_url, author_uid, author_label,
 *       publication_type: 'interactive',
 *       visual: { id, options }, created_at, updated_at }
 *
 *   published_figures non-default variant:
 *     { _id: `${slug}::${key}`, record_type: 'figure_variant',
 *       figure_slug: slug, variant_key: key, formats: { svg, png, pdf } }
 *
 * The root always owns the default files, preserving the original one-document
 * contract. Extra variants are child records so a multi-state figure cannot
 * run into MongoDB's 16 MiB document limit.
 */
const { getDisplayName } = require('./displayNames');
const { getMember } = require('./teamMembers');

const COLLECTION = 'published_figures';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CONTROL_KEY_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const FORMATS = { svg: 'image/svg+xml', png: 'image/png', pdf: 'application/pdf' };
const VARIANT_RECORD = 'figure_variant';
const STATIC_PUBLICATION = 'static';
const INTERACTIVE_PUBLICATION = 'interactive';
// Interactive publication is intentionally allowlisted. A renderer id is a
// capability exposed by this codebase, never a module path supplied by a user.
const INTERACTIVE_RENDERERS = new Set(['paper-credit-loss']);
const MAX_VARIANTS = 16;
const MAX_VISUAL_OPTIONS_BYTES = 32 * 1024;
// Each stored file set remains safely below MongoDB's 16 MiB document limit.
// The larger request cap covers several independent child records in one
// publication while still bounding memory use for this private API.
const MAX_FILESET_BYTES = 12 * 1024 * 1024;
const MAX_PUBLISH_BYTES = 48 * 1024 * 1024;

const b64Bytes = (s) => Math.floor((s.length * 3) / 4);

function validateFormats(formats, field = 'formats') {
  if (!formats || typeof formats !== 'object' || typeof formats.svg !== 'string' || !formats.svg) {
    return { error: `${field}.svg required (base64) - publish from pmt.py renders it automatically` };
  }
  const clean = {};
  let totalBytes = 0;
  for (const [fmt, data] of Object.entries(formats)) {
    if (!(fmt in FORMATS)) return { error: `unknown format "${fmt}" (svg, png, pdf)` };
    if (typeof data !== 'string' || !data) continue;
    totalBytes += b64Bytes(data);
    clean[fmt] = data;
  }
  if (totalBytes > MAX_FILESET_BYTES) {
    return { error: `${field} files exceed 12MB total - reduce the PNG size/dpi` };
  }
  return { value: clean, totalBytes };
}

function validateControls(rawControls, variants) {
  if (rawControls == null) return { value: [] };
  if (!Array.isArray(rawControls) || rawControls.length > 6) {
    return { error: 'controls must be an array with at most 6 entries' };
  }
  const controls = [];
  const seen = new Set();
  for (const raw of rawControls) {
    if (!raw || typeof raw !== 'object' || !CONTROL_KEY_RE.test(String(raw.key || ''))) {
      return { error: 'each control needs a lowercase key (a-z, 0-9, - or _)' };
    }
    const key = String(raw.key);
    if (seen.has(key)) return { error: `duplicate control key "${key}"` };
    seen.add(key);
    const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : key;
    if (raw.type === 'toggle') {
      controls.push({ key, label, type: 'toggle', default: Boolean(raw.default) });
      continue;
    }
    if (raw.type !== 'select' || !Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 12) {
      return { error: `control "${key}" must be a toggle or a select with 2-12 options` };
    }
    const optionValues = new Set();
    const options = [];
    for (const option of raw.options) {
      const value = String(option?.value ?? '').trim();
      const optionLabel = String(option?.label ?? '').trim();
      if (!value || !optionLabel || optionValues.has(value)) {
        return { error: `control "${key}" has an invalid or duplicate option` };
      }
      optionValues.add(value);
      options.push({ value, label: optionLabel });
    }
    const fallback = options[0].value;
    const defaultValue = optionValues.has(String(raw.default)) ? String(raw.default) : fallback;
    controls.push({ key, label, type: 'select', options, default: defaultValue });
  }

  for (const variant of variants) {
    const state = variant.state || {};
    for (const control of controls) {
      if (!(control.key in state)) return { error: `variant "${variant.key}" is missing state.${control.key}` };
      if (control.type === 'toggle' && typeof state[control.key] !== 'boolean') {
        return { error: `variant "${variant.key}" state.${control.key} must be true or false` };
      }
      if (control.type === 'select' && !control.options.some((option) => option.value === String(state[control.key]))) {
        return { error: `variant "${variant.key}" has an unknown state.${control.key}` };
      }
    }
  }
  return { value: controls };
}

// Returns { error } or { value: clean payload }.
function validateFigurePayload(body = {}) {
  const { slug, title, caption, source_url, formats } = body;
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { error: 'slug must be 1-64 chars of a-z 0-9 - _ (e.g. "coverage-heatmap")' };
  }
  if (typeof title !== 'string' || !title.trim()) return { error: 'title required' };
  const metadata = {
    slug,
    title: title.trim(),
    caption: typeof caption === 'string' && caption.trim() ? caption.trim() : null,
    source_url: typeof source_url === 'string' && source_url.trim() ? source_url.trim() : null,
  };

  // A named visual is rendered by a component already shipped with the app.
  // It is mutually exclusive with static files so each publication has one
  // unambiguous rendering contract.
  if (body.visual != null) {
    if (formats != null || body.variants != null || body.controls != null || body.default_variant != null) {
      return { error: 'visual publications cannot include formats, variants, or static controls' };
    }
    if (body.source != null) {
      return { error: 'source is not a publishing option; use source_url for provenance' };
    }
    const id = String(body.visual || '').trim();
    if (!INTERACTIVE_RENDERERS.has(id)) {
      return { error: `unknown interactive visual "${id}"` };
    }
    const options = body.options == null ? {} : body.options;
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return { error: 'interactive options must be an object' };
    }
    let optionsBytes;
    try {
      optionsBytes = Buffer.byteLength(JSON.stringify(options));
    } catch {
      return { error: 'interactive options must be JSON-serializable' };
    }
    if (optionsBytes > MAX_VISUAL_OPTIONS_BYTES) {
      return { error: 'interactive options exceed 32KB' };
    }
    return {
      value: {
        ...metadata,
        publication_type: INTERACTIVE_PUBLICATION,
        visual: { id, options: { ...options } },
      },
    };
  }

  let totalBytes = 0;
  let cleanFormats = null;
  let variants = null;

  if (body.variants != null) {
    if (!Array.isArray(body.variants) || body.variants.length < 2 || body.variants.length > MAX_VARIANTS) {
      return { error: `variants must contain 2-${MAX_VARIANTS} figure states` };
    }
    const seen = new Set();
    variants = [];
    for (const raw of body.variants) {
      const key = String(raw?.key || '');
      if (!SLUG_RE.test(key) || seen.has(key)) return { error: `invalid or duplicate variant key "${key}"` };
      seen.add(key);
      const checked = validateFormats(raw.formats, `variants.${key}.formats`);
      if (checked.error) return checked;
      totalBytes += checked.totalBytes;
      const state = raw.state && typeof raw.state === 'object' && !Array.isArray(raw.state)
        ? { ...raw.state }
        : {};
      variants.push({
        key,
        label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : key,
        state,
        formats: checked.value,
      });
    }
    const defaultVariant = String(body.default_variant || variants[0].key);
    if (!seen.has(defaultVariant)) return { error: 'default_variant must name one of the variants' };
    const controls = validateControls(body.controls, variants);
    if (controls.error) return controls;
    if (totalBytes > MAX_PUBLISH_BYTES) {
      return { error: 'variant files exceed 48MB total - reduce the number of variants or PNG dpi' };
    }
    cleanFormats = variants.find((variant) => variant.key === defaultVariant).formats;
    return {
      value: {
        ...metadata,
        publication_type: STATIC_PUBLICATION,
        formats: cleanFormats,
        variants,
        controls: controls.value,
        default_variant: defaultVariant,
      },
    };
  }

  const checked = validateFormats(formats);
  if (checked.error) return checked;
  return {
    value: {
      ...metadata,
      publication_type: STATIC_PUBLICATION,
      formats: checked.value,
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
  const {
    slug, formats, variants, controls, default_variant, visual,
    publication_type = STATIC_PUBLICATION, ...rest
  } = payload;
  const interactive = publication_type === INTERACTIVE_PUBLICATION;
  const toBinary = (input) => Object.fromEntries(
    Object.entries(input).map(([format, value]) => [format, Buffer.from(value, 'base64')])
  );
  const children = interactive ? [] : (variants || [])
    .filter((variant) => variant.key !== default_variant)
    .map((variant) => ({
      _id: `${slug}::${variant.key}`,
      record_type: VARIANT_RECORD,
      figure_slug: slug,
      variant_key: variant.key,
      title: rest.title,
      state: variant.state,
      formats: toBinary(variant.formats),
      created_at: now,
      updated_at: now,
    }));

  await auditDb.collection(COLLECTION).deleteMany({ figure_slug: slug, record_type: VARIANT_RECORD });
  if (children.length) await auditDb.collection(COLLECTION).insertMany(children);

  const variantMeta = (!interactive && variants)
    ? variants.map(({ key, label, state }) => ({ key, label, state }))
    : null;
  // Keep an empty formats object on interactive roots while deployed databases
  // transition from the original validator that required this field. The list
  // endpoint projects it out, and interactive cards never request asset files.
  const storedFormats = interactive ? {} : toBinary(formats);
  await auditDb.collection(COLLECTION).updateOne(
    { _id: slug },
    {
      $set: {
        ...rest,
        record_type: 'figure',
        publication_type,
        formats: storedFormats,
        author_uid: author_uid ?? null,
        author_label: author_label ?? null,
        updated_at: now,
        ...(interactive ? { visual } : {}),
        ...(variantMeta ? { variants: variantMeta, controls, default_variant } : {}),
      },
      $unset: interactive
        ? { variants: '', controls: '', default_variant: '' }
        : { visual: '', ...(!variantMeta ? { variants: '', controls: '', default_variant: '' } : {}) },
      $setOnInsert: { created_at: now },
    },
    { upsert: true }
  );
}

async function listFigures(auditDb) {
  const docs = await auditDb.collection(COLLECTION)
    .find({ record_type: { $ne: VARIANT_RECORD } }, { projection: { formats: 0, record_type: 0 } })
    .sort({ updated_at: -1 })
    .toArray();
  return docs.map(({ _id, ...rest }) => ({ slug: String(_id), ...rest }));
}

async function getFigureFormat(auditDb, slug, format, variantKey = null) {
  const contentType = FORMATS[format];
  if (!contentType) return null;
  const root = await auditDb.collection(COLLECTION).findOne(
    { _id: slug },
    { projection: { default_variant: 1, [`formats.${format}`]: 1 } }
  );
  if (!root) return null;
  const useRoot = !variantKey || variantKey === root.default_variant;
  const doc = useRoot ? root : await auditDb.collection(COLLECTION).findOne(
    { figure_slug: slug, variant_key: variantKey, record_type: VARIANT_RECORD },
    { projection: { [`formats.${format}`]: 1 } }
  );
  const data = doc?.formats?.[format];
  if (!data) return null;
  return {
    contentType,
    buffer: Buffer.from(data.buffer ?? data),
    filename: `${slug}${variantKey ? `-${variantKey}` : ''}.${format}`,
  };
}

async function removeFigure(auditDb, slug) {
  const root = await auditDb.collection(COLLECTION).deleteOne({ _id: slug });
  if (!root.deletedCount) return false;
  await auditDb.collection(COLLECTION).deleteMany({ figure_slug: slug, record_type: VARIANT_RECORD });
  return true;
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

async function ensureFigureIndexes(auditDb) {
  if (!auditDb) return;
  await auditDb.collection(COLLECTION).createIndex({ record_type: 1, updated_at: -1 });
  await auditDb.collection(COLLECTION).createIndex(
    { figure_slug: 1, variant_key: 1 },
    { partialFilterExpression: { record_type: VARIANT_RECORD } }
  );
}

module.exports = {
  validateFigurePayload, validateFigureMeta, resolveAuthorLabel,
  upsertFigure, listFigures, getFigureFormat, removeFigure,
  getFigureAuthor, updateFigureMeta, ensureFigureIndexes,
  COLLECTION, VARIANT_RECORD, STATIC_PUBLICATION, INTERACTIVE_PUBLICATION,
  INTERACTIVE_RENDERERS,
};
