/**
 * Saved comparisons — the compare tab's exhibits and the notes written on them.
 *
 * A comparison is an ordered list of 2-6 Views (one figure, one major, one
 * pinned knob set) plus a baseline pointer and prose. It is deliberately NOT a
 * figure: nothing here is published, frozen, or exportable as an artifact, and
 * no cell value is ever stored. A comparison re-runs the live queries every
 * time it is opened, because its whole job is to be *currently* true;
 * `verdict_at_pin` is the single snapshot, kept so a number that has since
 * moved can announce itself instead of silently contradicting a note.
 *
 * Storage (audit handle) — team working state alongside tasks and
 * published_figures, never joined against the reference handle:
 *   comparisons: { _id: slug, schema_version, title, kind,
 *                  panes[{ id, figure, major, knobs, label, fingerprint }],
 *                  baseline_pane, breakdown_id, verdict_at_pin, notes[],
 *                  author_uid, author_label, created_at,
 *                  updated_at, updated_by_uid, updated_by_label }
 *
 * NOTES ARE USER-AUTHORED, ABSOLUTELY. This module builds the store, the
 * validation and the stamps; it never writes note content. `text` is stored
 * byte-exact — no trim into storage, no normalization, no templating — the
 * store ships with zero rows, and `updateComparison` drops any `notes` key
 * before its $set so a metadata save is structurally incapable of clobbering
 * prose. The only writes to notes[] are addNote/editNote/deleteNote.
 *
 * Validation is SHAPE ONLY. A server-side copy of the frontend ANALYSES
 * registry would rot, so an unknown `figure` id is stored as given and fails
 * closed in the client through getAnalysisById() -> null. `major` is the one
 * exception: config/majors.js is genuinely the server's.
 */
const crypto = require('crypto');
const { getMajor } = require('../config/majors');

const COLLECTION = 'comparisons';
const SCHEMA_VERSION = 1;

// Copied from services/figures.js, which declares both without exporting them.
// The control-key vocabulary is deliberately the same one published figures
// already validate, and is mirrored again in frontend/src/compare/viewKnobs.js.
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CONTROL_KEY_RE = /^[a-z][a-z0-9_-]{0,31}$/;
// A note id is a client-minted uuid, so it is checked for shape only.
const NOTE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const MIN_PANES = 2;
const MAX_PANES = 6;
const MAX_KNOB_BYTES = 2 * 1024;
const MAX_NOTE_CHARS = 20000;
const MAX_TEXT_CHARS = 200;
const MAX_FINGERPRINT_CHARS = 512;
// A pinned grouped distribution has one entry per shared category (four course
// types today). The cap is a storage backstop, not a modelling limit.
const MAX_DISTRIBUTION_GROUPS = 64;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

// Caller-side failures carry the status the controller should send. 400 is the
// default; 409 is a taken slug; 403 is someone else's note. Anything else
// forwards to the central error handler.
class ComparisonError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const fail = (message) => { throw new ComparisonError(message); };

const isScalar = (value) => (
  typeof value === 'string' || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value))
);

// ── field validators (each throws ComparisonError or returns the clean value) ──

// Captions — titles, pane labels, anchor labels. Trimmed, unlike note text:
// these are names, not prose.
const cleanText = (name, value) => {
  if (value == null) return null;
  if (typeof value !== 'string') fail(`${name} must be a string or null`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > MAX_TEXT_CHARS) fail(`${name} must be ${MAX_TEXT_CHARS} characters or fewer`);
  return text;
};

const cleanNumber = (name, value) => (
  Number.isFinite(value) ? value : fail(`${name} must be a number`)
);

const cleanFingerprint = (value) => {
  if (typeof value !== 'string' || !value) return null;
  if (value.length > MAX_FINGERPRINT_CHARS) fail('fingerprint is too long');
  return value;
};

function cleanKnobs(raw, paneId) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) fail(`pane "${paneId}" knobs must be an object`);
  const knobs = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CONTROL_KEY_RE.test(key)) fail(`pane "${paneId}" has an invalid knob key "${key}"`);
    if (!isScalar(value)) fail(`pane "${paneId}" knob "${key}" must be a string, boolean, or number`);
    knobs[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(knobs)) > MAX_KNOB_BYTES) {
    fail(`pane "${paneId}" knobs exceed 2KB`);
  }
  return knobs;
}

// The sorted `k=v&k=v` half of a fingerprint. Booleans serialize 1/0 so a
// toggle addresses the same view however the client typed it.
function canonicalKnobs(knobs) {
  const source = knobs && typeof knobs === 'object' ? knobs : {};
  const entries = [];
  for (const [key, value] of Object.entries(source)) {
    if (!isScalar(value)) continue;
    entries.push(`${key}=${typeof value === 'boolean' ? (value ? '1' : '0') : String(value)}`);
  }
  entries.sort();
  return entries.join('&');
}

/**
 * Canonical address of a pane — an INDEX, never an identity.
 *
 * ONE DELIBERATE ASYMMETRY with the mirror in frontend/src/compare/viewKnobs.js:
 * the client elides knobs equal to the figure's declared default, because it
 * has the registry. The server has no registry and must not grow one, so it
 * cannot know a value is a default and keeps every knob — it canonicalizes
 * ordering and boolean form only. The client therefore mints the authoritative
 * fingerprint and sends it; this is the fallback for a pane that arrives
 * without one, and it may be over-specific, never wrong. An over-specific
 * fingerprint only degrades discovery; nothing is lost, because identity is
 * the slug.
 */
function fingerprintOf(pane) {
  const figure = String(pane?.figure || '');
  const major = String(pane?.major || '');
  const knobs = canonicalKnobs(pane?.knobs);
  return `${figure}@${major}${knobs ? `?${knobs}` : ''}`;
}

function cleanPanes(raw) {
  if (!Array.isArray(raw) || raw.length < MIN_PANES || raw.length > MAX_PANES) {
    fail(`panes must be an array of ${MIN_PANES}-${MAX_PANES} views`);
  }
  const seen = new Set();
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`pane ${index + 1} must be an object`);
    }
    const id = String(entry.id ?? '');
    if (!SLUG_RE.test(id)) fail(`pane ${index + 1} needs an id of a-z 0-9 - _ (e.g. "p1")`);
    if (seen.has(id)) fail(`duplicate pane id "${id}"`);
    seen.add(id);
    // Shape only: which figure ids exist is the frontend registry's business.
    const figure = String(entry.figure ?? '');
    if (!SLUG_RE.test(figure)) fail(`pane "${id}" needs a figure id`);
    const major = String(entry.major ?? '');
    if (!getMajor(major)) fail(`pane "${id}" names an unknown major "${major}"`);

    const pane = {
      id,
      figure,
      major,
      knobs: cleanKnobs(entry.knobs, id),
      label: cleanText(`pane "${id}" label`, entry.label),
    };
    pane.fingerprint = cleanFingerprint(entry.fingerprint) ?? fingerprintOf(pane);
    return pane;
  });
}

const cleanBaseline = (value, panes) => {
  if (value == null || value === '') return panes[0].id;
  const id = String(value);
  if (!panes.some((pane) => pane.id === id)) fail(`baseline_pane "${id}" is not one of the panes`);
  return id;
};

// SLUG_RE only. Unlike an INTERACTIVE_RENDERERS id, a breakdown id gates no
// execution — an unknown one resolves to null client-side — so there is
// nothing here to allowlist.
const cleanBreakdown = (value) => {
  if (value == null || value === '') return null;
  const id = String(value);
  if (!SLUG_RE.test(id)) fail('breakdown_id must be 1-64 chars of a-z 0-9 - _');
  return id;
};

const VERDICT_FIELDS = ['matched', 'agreeing', 'dropped', 'mean_delta', 'max_abs_delta', 'max_cell'];

// A number that may legitimately be absent — an empty population has no mean,
// and storing 0 for it would claim a reading nobody took.
const cleanNullableNumber = (name, value) => {
  if (value == null) return null;
  return Number.isFinite(value) ? value : fail(`${name} must be a number or null`);
};

const cleanDistributionSide = (name, raw) => {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail(`${name} must be an object or null`);
  return {
    n: cleanNumber(`${name}.n`, raw.n),
    mean: cleanNullableNumber(`${name}.mean`, raw.mean),
    median: cleanNullableNumber(`${name}.median`, raw.median),
  };
};

const cleanDistributionPair = (name, raw) => ({
  baseline: cleanDistributionSide(`${name}.baseline`, raw.baseline),
  subject: cleanDistributionSide(`${name}.subject`, raw.subject),
  mean_delta: cleanNullableNumber(`${name}.mean_delta`, raw.mean_delta),
  median_delta: cleanNullableNumber(`${name}.median_delta`, raw.median_delta),
});

/**
 * The pinnable reading for a pair whose corpora share no institutions.
 *
 * Cross-state comparisons cannot produce a cell join, so before this they
 * pinned nothing and any later movement went unrecorded. What they can pin is
 * each side's own population summary and the gap between them. Grouped
 * distributions keep their categories separate, because pooling unequal
 * populations lets a category-mix change masquerade as a real shift.
 */
function cleanDistribution(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('verdict_at_pin.distribution must be an object or null');
  if (raw.mode === 'grouped') {
    if (!Array.isArray(raw.groups)) fail('verdict_at_pin.distribution.groups must be an array');
    if (raw.groups.length > MAX_DISTRIBUTION_GROUPS) fail(`verdict_at_pin.distribution.groups must hold ${MAX_DISTRIBUTION_GROUPS} groups or fewer`);
    const out = {
      mode: 'grouped',
      group_by: cleanText('verdict_at_pin.distribution.group_by', raw.group_by),
      groups: raw.groups.map((group, index) => {
        const name = `verdict_at_pin.distribution.groups[${index}]`;
        if (typeof group !== 'object' || group == null) fail(`${name} must be an object`);
        return {
          key: cleanText(`${name}.key`, group.key),
          label: cleanText(`${name}.label`, group.label),
          ...cleanDistributionPair(name, group),
        };
      }),
    };
    // The pooled overall number is optional and stays optional here, so a
    // figure that declined to pool cannot acquire one by round-tripping.
    if (raw.baseline != null || raw.subject != null) Object.assign(out, cleanDistributionPair('verdict_at_pin.distribution', raw));
    return out;
  }
  return { mode: 'pair', ...cleanDistributionPair('verdict_at_pin.distribution', raw) };
}

const sameDistribution = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function cleanVerdict(raw, existing = null) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('verdict_at_pin must be an object or null');
  // Pinning is an act, so the moment it happened is the server's to stamp —
  // but only when the reading actually changed. Re-stamping on an unrelated
  // metadata save (a rename) would keep resetting the clock on the drift
  // banner, which exists precisely to say how old the pinned numbers are.
  if (raw.distribution != null) {
    const distribution = cleanDistribution(raw.distribution);
    const same = existing && sameDistribution(existing.distribution, distribution);
    return {
      computed_at: same && existing.computed_at ? existing.computed_at : new Date(),
      distribution,
    };
  }
  const same = existing && VERDICT_FIELDS.every((field) => existing[field] === raw[field]);
  return {
    computed_at: same && existing.computed_at ? existing.computed_at : new Date(),
    matched: cleanNumber('verdict_at_pin.matched', raw.matched),
    agreeing: cleanNumber('verdict_at_pin.agreeing', raw.agreeing),
    dropped: cleanNumber('verdict_at_pin.dropped', raw.dropped),
    mean_delta: cleanNumber('verdict_at_pin.mean_delta', raw.mean_delta),
    max_abs_delta: cleanNumber('verdict_at_pin.max_abs_delta', raw.max_abs_delta),
    max_cell: cleanText('verdict_at_pin.max_cell', raw.max_cell),
  };
}

// The gallery lane. State is not a field anywhere in this design — it rides on
// the major — so "states" is just "the majors differ and so do their states".
// More than one axis moving at once is honestly reported as mixed.
function kindOf(panes) {
  const majors = new Set(panes.map((pane) => pane.major));
  if (majors.size === 1) return 'versions';
  if (new Set(panes.map((pane) => canonicalKnobs(pane.knobs))).size > 1) return 'mixed';
  const states = new Set(panes.map((pane) => getMajor(pane.major)?.state || 'ca'));
  return states.size > 1 ? 'states' : 'majors';
}

// Fallback name for a comparison saved without one: a generated LABEL, the
// same category as an export filename, never prose. The server holds no figure
// titles by design, so this reads the ids it stores; the client sends the
// figure's real title when it has one, and either is renamed freely after.
function derivedTitle(panes) {
  const figures = [...new Set(panes.map((pane) => pane.figure))];
  const majors = [...new Set(panes.map((pane) => getMajor(pane.major)?.label || pane.major))];
  const captions = panes.map((pane, index) => pane.label || `View ${index + 1}`);
  const name = `${figures.join(' / ')} · ${majors.join(' / ')} · ${captions.join(' vs ')}`;
  // Six long captions can outrun the field; clipping a generated placeholder
  // costs nothing, because identity is the slug and the name is renamed freely.
  return name.length > MAX_TEXT_CHARS ? `${name.slice(0, MAX_TEXT_CHARS - 1)}…` : name;
}

// ── notes ──

// The house rule, in code. `text` is validated and then stored EXACTLY as
// submitted: leading and trailing whitespace, blank lines and all. Nothing in
// this module writes, rewrites, summarizes or seeds note content.
// Precedent: controllers/Virginia.js.
function cleanNoteText(value) {
  if (typeof value !== 'string') fail('note text must be a string');
  if (!value.trim()) fail('a note needs some text');
  if (value.length > MAX_NOTE_CHARS) fail(`a note must be ${MAX_NOTE_CHARS} characters or fewer`);
  return value;
}

// An anchor points at a cell the overlay computed, so its keys are stored
// unchanged — trimming one would leave a note pointing at a cell that no
// longer matches, silently.
const cleanCellKey = (name, value) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} is required`);
  if (value.length > MAX_TEXT_CHARS) fail(`${name} must be ${MAX_TEXT_CHARS} characters or fewer`);
  return value;
};

function cleanAnchor(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('anchor must be an object or null');
  return {
    rowKey: cleanCellKey('anchor.rowKey', raw.rowKey),
    colKey: cleanCellKey('anchor.colKey', raw.colKey),
    label: cleanText('anchor.label', raw.label),
  };
}

const mintNoteId = (raw, used) => {
  const id = typeof raw === 'string' && NOTE_ID_RE.test(raw) ? raw : null;
  return id && !used.has(id) ? id : crypto.randomUUID();
};

// Author-only, the deleteTaskLogNote precedent (services/tasks.js). Everything
// else about a comparison is everyone-equal; prose is the one thing only its
// writer may rewrite or retract, because an edited note still reads as its
// author's sentence.
const requireAuthor = (note, uid, verb) => {
  if ((note.author_uid ?? null) !== (uid ?? null)) {
    throw new ComparisonError(`only the author can ${verb} a note`, 403);
  }
};

const findNote = (doc, noteId) => (
  (doc.notes || []).find((note) => note.id === noteId) || fail('no such note')
);

// ── storage ──

// server.js wires the other collections' indexes at boot; `comparisons` is
// indexed lazily on first use instead, so a deployment that never opens the
// tab never creates the collection. createIndex is idempotent, one round trip
// per handle per process is enough, and a failure must not fail the request.
const indexed = new WeakSet();

async function ensureComparisonIndexes(auditDb) {
  if (!auditDb || indexed.has(auditDb)) return;
  try {
    await auditDb.collection(COLLECTION).createIndex({ 'panes.fingerprint': 1 }); // discovery
    await auditDb.collection(COLLECTION).createIndex({ updated_at: -1 }); // gallery ordering
    indexed.add(auditDb);
  } catch (e) {
    console.warn(`[comparisons] index setup failed: ${e.message}`);
  }
}

async function listComparisons(auditDb, { fingerprint = null, limit = DEFAULT_LIMIT } = {}) {
  await ensureComparisonIndexes(auditDb);
  const capped = Math.min(Math.max(Math.trunc(Number(limit)) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const match = fingerprint ? { 'panes.fingerprint': String(fingerprint) } : {};
  return auditDb.collection(COLLECTION).aggregate([
    { $match: match },
    { $sort: { updated_at: -1 } },
    { $limit: capped },
    {
      $project: {
        title: 1, kind: 1, panes: 1, author_label: 1, updated_at: 1,
        note_count: { $size: { $ifNull: ['$notes', []] } },
      },
    },
  ]).toArray();
}

async function getComparison(auditDb, id) {
  return auditDb.collection(COLLECTION).findOne({ _id: String(id) });
}

async function createComparison(auditDb, body = {}, { uid = null, label = null } = {}) {
  await ensureComparisonIndexes(auditDb);
  const slug = body.slug == null || body.slug === '' ? null : String(body.slug);
  if (slug !== null && !SLUG_RE.test(slug)) {
    fail('slug must be 1-64 chars of a-z 0-9 - _ (e.g. "ma-fig6-printed-vs-workbook")');
  }
  const panes = cleanPanes(body.panes);
  const now = new Date();
  const doc = {
    // Opaque and immutable. Notes can never be orphaned by a knob rename
    // because identity is this, not the fingerprint.
    _id: slug ?? `cmp-${crypto.randomBytes(4).toString('hex')}`,
    schema_version: SCHEMA_VERSION,
    title: cleanText('title', body.title) ?? derivedTitle(panes),
    kind: kindOf(panes),
    panes,
    baseline_pane: cleanBaseline(body.baseline_pane, panes),
    breakdown_id: cleanBreakdown(body.breakdown_id),
    verdict_at_pin: cleanVerdict(body.verdict_at_pin),
    notes: [],
    author_uid: uid,
    author_label: label,
    created_at: now,
    updated_at: now,
    updated_by_uid: uid,
    updated_by_label: label,
  };
  try {
    await auditDb.collection(COLLECTION).insertOne(doc);
  } catch (e) {
    // A slug is durable identity: the first writer keeps it.
    if (e?.code === 11000) throw new ComparisonError(`'${doc._id}' is taken — choose another slug`, 409);
    throw e;
  }
  return doc;
}

async function updateComparison(auditDb, id, body = {}, { uid = null, label = null } = {}) {
  const existing = await getComparison(auditDb, id);
  if (!existing) return null;

  // `notes` is destructured off the body and dropped on the floor. A metadata
  // save must be structurally incapable of touching prose — this is the one
  // place worth spending paranoia, so the strip happens before any $set is
  // built rather than by trusting a field allowlist to stay complete.
  const { notes: _prose, ...patch } = body || {};

  const panes = 'panes' in patch ? cleanPanes(patch.panes) : existing.panes;
  const $set = { updated_at: new Date(), updated_by_uid: uid, updated_by_label: label };
  // Clearing the name is allowed: it falls back to the derived one rather than
  // failing, so the box can never disagree with what is stored.
  if ('title' in patch) $set.title = cleanText('title', patch.title) ?? derivedTitle(panes);
  if ('panes' in patch) {
    $set.panes = panes;
    $set.kind = kindOf(panes);
  }
  // Re-validated against the panes as they will be, so replacing the pane list
  // cannot leave the baseline pointing at a pane that no longer exists. A
  // baseline the caller names must be one of them; a carried-forward one that
  // was just closed falls back to the first pane, because 400ing a legal
  // "close this pane" edit would be worse than picking the only other answer.
  if ('baseline_pane' in patch) {
    $set.baseline_pane = cleanBaseline(patch.baseline_pane, panes);
  } else if ('panes' in patch) {
    $set.baseline_pane = panes.some((pane) => pane.id === existing.baseline_pane)
      ? existing.baseline_pane
      : panes[0].id;
  }
  if ('breakdown_id' in patch) $set.breakdown_id = cleanBreakdown(patch.breakdown_id);
  if ('verdict_at_pin' in patch) {
    $set.verdict_at_pin = cleanVerdict(patch.verdict_at_pin, existing.verdict_at_pin);
  }

  return auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: String(id) }, { $set }, { returnDocument: 'after' }
  );
}

async function deleteComparison(auditDb, id) {
  const { deletedCount } = await auditDb.collection(COLLECTION).deleteOne({ _id: String(id) });
  return deletedCount > 0;
}

async function addNote(auditDb, id, body = {}, { uid = null, label = null } = {}) {
  const text = cleanNoteText(body?.text);
  const anchor = cleanAnchor(body?.anchor);
  const existing = await auditDb.collection(COLLECTION).findOne(
    { _id: String(id) }, { projection: { 'notes.id': 1 } }
  );
  if (!existing) return null;

  const now = new Date();
  const note = {
    id: mintNoteId(body?.id, new Set((existing.notes || []).map((row) => row.id))),
    text,
    anchor,
    // Authorship is stamped here and nowhere else: a caller cannot claim to be
    // someone else by putting a name in the body.
    author_uid: uid,
    author_label: label,
    created_at: now,
    updated_at: null,
  };
  return auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: String(id) },
    {
      $push: { notes: note },
      $set: { updated_at: now, updated_by_uid: uid, updated_by_label: label },
    },
    { returnDocument: 'after' }
  );
}

async function editNote(auditDb, id, noteId, body = {}, { uid = null, label = null } = {}) {
  const text = cleanNoteText(body?.text);
  const existing = await getComparison(auditDb, id);
  if (!existing) return null;
  requireAuthor(findNote(existing, noteId), uid, 'edit');

  const now = new Date();
  return auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: String(id) },
    {
      $set: {
        'notes.$[note].text': text,
        'notes.$[note].updated_at': now,
        updated_at: now,
        updated_by_uid: uid,
        updated_by_label: label,
      },
    },
    { arrayFilters: [{ 'note.id': noteId }], returnDocument: 'after' }
  );
}

async function deleteNote(auditDb, id, noteId, { uid = null, label = null } = {}) {
  const existing = await getComparison(auditDb, id);
  if (!existing) return null;
  requireAuthor(findNote(existing, noteId), uid, 'delete');

  return auditDb.collection(COLLECTION).findOneAndUpdate(
    { _id: String(id) },
    {
      $pull: { notes: { id: noteId } },
      $set: { updated_at: new Date(), updated_by_uid: uid, updated_by_label: label },
    },
    { returnDocument: 'after' }
  );
}

module.exports = {
  ComparisonError,
  listComparisons, getComparison, createComparison, updateComparison, deleteComparison,
  addNote, editNote, deleteNote,
  fingerprintOf, kindOf, ensureComparisonIndexes,
  COLLECTION, SCHEMA_VERSION, MIN_PANES, MAX_PANES, MAX_NOTE_CHARS,
};
