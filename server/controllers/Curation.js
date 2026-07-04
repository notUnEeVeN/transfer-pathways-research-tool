/**
 * Curation endpoints — the human-judgment layer the papers' analyses need on
 * top of the raw ASSIST data. All console users (admins + partners) can
 * curate; every write is stamped with who/when. Collections live on the audit
 * handle (working state, like verdicts), keyed so they survive re-porting:
 *
 *   curation_course_categories — canonical course category per UNIVERSITY
 *     course (`_id` = parent_id). Categories drive the papers' course-barrier
 *     and per-category analyses (Calculus, Intro Programming, Data
 *     Structures, …) plus the broad computing/math/science/non-STEM axis.
 *
 *   curation_receiver_overrides — per-receiver (`_id` = hash_id) judgment
 *     calls: exclude a receiver from analysis (e.g. "recommended", not
 *     strictly required) and/or categorize non-course receivers
 *     (requirement/ge_area/series kinds that have no parent_id).
 *
 *   curation_prereqs — prerequisite edges for curricular-complexity and
 *     pathway analyses. `_id` = `cc:<course_id>` or `uni:<parent_id>`;
 *     `prereqs` lists keys in the same format. ASSIST has no prereq data, so
 *     these are entered/verified by hand (or a scraper writing through this
 *     same endpoint).
 *
 *   curation_assoc_degrees — associate-degree (ADT/ASCS) requirement docs per
 *     community college, for transfer-credit-rate / time-to-degree analyses.
 *
 *   ref_* reference tables (small, whitelisted): campus calendars
 *     (quarter/semester), tuition per credit, CC districts, campus locations.
 */
const { asyncHandler } = require('../middleware/asyncHandler');

const CATEGORIES = 'curation_course_categories';
const OVERRIDES = 'curation_receiver_overrides';
const PREREQS = 'curation_prereqs';
const ASSOC = 'curation_assoc_degrees';

// Canonical course categories (CA-paper granularity) + broad axis (MA paper).
const CANONICAL_CATEGORIES = [
  'calculus', 'advanced_math', 'discrete_math', 'other_math',
  'intro_programming', 'data_structures', 'computer_org', 'other_computing',
  'science', 'non_stem',
];
const BROAD_AXES = ['computing', 'math', 'science', 'non_stem'];

// Editable reference tables (References tab). CRUD below is keyed by _id and
// stamps the curator; add a table here to make it editable.
const REF_TABLES = new Set([
  'ref_campus_calendars', // { _id: <university_id>, system: 'quarter'|'semester' }
  'ref_tuition',          // { _id: <university_id>, per_credit_usd, source }
  'ref_cc_districts',     // { _id: <cc_id>, community_college, district, region, counties_served[] }
  'ref_locations',        // { _id: '<kind>:<id>', kind: 'cc'|'university', lat, lng }
  'ref_uc_transfer_requirements', // UC hard minimums { _id, uc_code, school_id, school, group_id, set_id, receiving_code, matched, matched_courses[] }
  'ref_prerequisites',    // CC course prereqs { _id, college, course_code, course_name, units, prerequisites[] }
  'ref_ge_patterns',      // Cal-GETC / UC-7 { _id, pattern, area_code, area_name, subgroup_code, subgroup_name, required, note }
  'ref_igetc',            // IGETC { _id, area_code, area_name, sub_area, sub_name, required_courses, required_units, note }
]);

const stamp = (req) => ({ curated_by: req.user?.uid ?? null, curated_at: new Date() });
const curationDb = (req) => req.app.locals.auditDb || req.app.locals.db;

// ── course categories ──

exports.listCategories = asyncHandler(async (req, res) => {
  const docs = await curationDb(req).collection(CATEGORIES).find().toArray();
  res.json({ categories: docs, canonical: CANONICAL_CATEGORIES, broad: BROAD_AXES });
});

exports.putCategory = asyncHandler(async (req, res) => {
  const parentId = Number(req.params.parentId);
  if (!Number.isFinite(parentId)) return res.status(400).json({ error: 'numeric parentId required' });
  const { category, broad, note } = req.body || {};
  if (category != null && !CANONICAL_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${CANONICAL_CATEGORIES.join(', ')}` });
  }
  if (broad != null && !BROAD_AXES.includes(broad)) {
    return res.status(400).json({ error: `broad must be one of ${BROAD_AXES.join(', ')}` });
  }
  if (category == null && broad == null) {
    await curationDb(req).collection(CATEGORIES).deleteOne({ _id: parentId });
    return res.json({ ok: true, cleared: true });
  }
  await curationDb(req).collection(CATEGORIES).replaceOne(
    { _id: parentId },
    { _id: parentId, category: category ?? null, broad: broad ?? null, note: note ?? null, ...stamp(req) },
    { upsert: true }
  );
  res.json({ ok: true });
});

// ── receiver overrides ──

exports.listOverrides = asyncHandler(async (req, res) => {
  res.json({ overrides: await curationDb(req).collection(OVERRIDES).find().toArray() });
});

exports.putOverride = asyncHandler(async (req, res) => {
  const hashId = String(req.params.hashId || '').trim();
  if (!hashId) return res.status(400).json({ error: 'hashId required' });
  const { exclude, category, broad, note } = req.body || {};
  if (category != null && !CANONICAL_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${CANONICAL_CATEGORIES.join(', ')}` });
  }
  if (broad != null && !BROAD_AXES.includes(broad)) {
    return res.status(400).json({ error: `broad must be one of ${BROAD_AXES.join(', ')}` });
  }
  if (exclude == null && category == null && broad == null) {
    await curationDb(req).collection(OVERRIDES).deleteOne({ _id: hashId });
    return res.json({ ok: true, cleared: true });
  }
  await curationDb(req).collection(OVERRIDES).replaceOne(
    { _id: hashId },
    {
      _id: hashId,
      exclude: exclude === true,
      category: category ?? null,
      broad: broad ?? null,
      note: note ?? null,
      ...stamp(req),
    },
    { upsert: true }
  );
  res.json({ ok: true });
});

// ── prerequisites ──

const PREREQ_KEY = /^(cc:.+|uni:\d+)$/;

exports.listPrereqs = asyncHandler(async (req, res) => {
  res.json({ prereqs: await curationDb(req).collection(PREREQS).find().toArray() });
});

exports.putPrereqs = asyncHandler(async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!PREREQ_KEY.test(key)) {
    return res.status(400).json({ error: 'key must be cc:<course_id> or uni:<parent_id>' });
  }
  const { prereqs, note } = req.body || {};
  if (!Array.isArray(prereqs) || prereqs.some((p) => !PREREQ_KEY.test(String(p)))) {
    return res.status(400).json({ error: 'prereqs must be an array of cc:<course_id> / uni:<parent_id> keys' });
  }
  if (!prereqs.length && !String(note || '').trim()) {
    await curationDb(req).collection(PREREQS).deleteOne({ _id: key });
    return res.json({ ok: true, cleared: true });
  }
  await curationDb(req).collection(PREREQS).replaceOne(
    { _id: key },
    { _id: key, prereqs: prereqs.map(String), note: note ?? null, ...stamp(req) },
    { upsert: true }
  );
  res.json({ ok: true });
});

// ── associate degrees ──

exports.listAssocDegrees = asyncHandler(async (req, res) => {
  res.json({ degrees: await curationDb(req).collection(ASSOC).find().toArray() });
});

exports.putAssocDegree = asyncHandler(async (req, res) => {
  const { community_college_id, name, course_ids, units, note } = req.body || {};
  const ccId = Number(community_college_id);
  if (!Number.isFinite(ccId) || !String(name || '').trim()) {
    return res.status(400).json({ error: 'community_college_id (number) and name required' });
  }
  if (!Array.isArray(course_ids)) {
    return res.status(400).json({ error: 'course_ids must be an array of CC course_ids' });
  }
  const id = `${ccId}:${String(name).trim()}`;
  await curationDb(req).collection(ASSOC).replaceOne(
    { _id: id },
    {
      _id: id,
      community_college_id: ccId,
      name: String(name).trim(),
      course_ids: course_ids.map(String),
      units: Number.isFinite(Number(units)) ? Number(units) : null,
      note: note ?? null,
      ...stamp(req),
    },
    { upsert: true }
  );
  res.json({ ok: true, id });
});

exports.deleteAssocDegree = asyncHandler(async (req, res) => {
  const { deletedCount } = await curationDb(req).collection(ASSOC).deleteOne({ _id: req.params.id });
  if (!deletedCount) return res.status(404).json({ error: 'no such degree doc' });
  res.json({ ok: true });
});

// ── reference tables ──

exports.getRefTable = asyncHandler(async (req, res) => {
  const table = req.params.table;
  if (!REF_TABLES.has(table)) return res.status(404).json({ error: 'unknown reference table' });
  res.json({ rows: await curationDb(req).collection(table).find().toArray() });
});

exports.putRefRow = asyncHandler(async (req, res) => {
  const table = req.params.table;
  if (!REF_TABLES.has(table)) return res.status(404).json({ error: 'unknown reference table' });
  const row = req.body || {};
  if (row._id == null || row._id === '') return res.status(400).json({ error: 'row _id required' });
  // Numeric ids arrive as strings from forms; ref tables keyed by institution
  // id store them as numbers so they join against the reference collections.
  const id = /^\d+$/.test(String(row._id)) ? Number(row._id) : row._id;
  await curationDb(req).collection(table).replaceOne(
    { _id: id },
    { ...row, _id: id, ...stamp(req) },
    { upsert: true }
  );
  res.json({ ok: true });
});

exports.deleteRefRow = asyncHandler(async (req, res) => {
  const table = req.params.table;
  if (!REF_TABLES.has(table)) return res.status(404).json({ error: 'unknown reference table' });
  const raw = req.params.id;
  const id = /^\d+$/.test(String(raw)) ? Number(raw) : raw;
  const { deletedCount } = await curationDb(req).collection(table).deleteOne({ _id: id });
  if (!deletedCount) return res.status(404).json({ error: 'no such row' });
  res.json({ ok: true });
});

exports.CANONICAL_CATEGORIES = CANONICAL_CATEGORIES;
exports.BROAD_AXES = BROAD_AXES;
exports.REF_TABLES = REF_TABLES;
