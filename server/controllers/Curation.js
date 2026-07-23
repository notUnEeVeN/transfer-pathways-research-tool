/** Human judgments stored in the permanent curated collections. */
const { asyncHandler } = require('../middleware/asyncHandler');
const { getValidationCohort, setValidationCohort } = require('../services/asDegreeValidation');
const { getMajor, defaultMajor } = require('../config/majors');
const { majorDocumentClause } = require('../config/majorDocumentScope');

const MAPPINGS = 'curated_mappings';
const REQUIREMENTS = 'curated_requirements';

// The category vocabulary is per-major and lives in config/majors.js.
// Resolves ?majorSlug=, defaulting to the first onboarded major.
function majorFromQuery(req) {
  const slug = String(req.query.majorSlug || '').trim() || defaultMajor().slug;
  return getMajor(slug) || { error: `unknown major: ${slug}` };
}

// Existing mapping documents predate the major dimension and belong to the
// legacy owner. The scoping rule is shared with pathways and the planner in
// config/majorDocumentScope; mapping ids keep their own legacy-readable form
// in mappingId below.
function majorMappingClause(slug) {
  return majorDocumentClause(slug);
}

function mappingId(kind, key, slug) {
  return slug === defaultMajor().slug
    ? `${kind}:${key}`
    : `${kind}:${slug}:${key}`;
}

const stamp = (req) => ({ curated_by: req.user?.uid ?? null, curated_at: new Date() });
const curationDb = (req) => req.app.locals.auditDb || req.app.locals.db;

exports.listCategories = asyncHandler(async (req, res) => {
  const major = majorFromQuery(req);
  if (major.error) return res.status(400).json({ error: major.error });
  const rows = await curationDb(req).collection(MAPPINGS)
    .find({ kind: 'course_category', ...majorMappingClause(major.slug) }).toArray();
  const categories = rows.map(({ _id, kind, course_id, legacy_id, ...row }) => ({
    ...row,
    _id: Number(legacy_id ?? String(course_id).replace(/^university:/, '')),
  }));
  res.json({
    categories,
    canonical: major.categories.map((c) => c.key),
    broad: major.broadAxes,
  });
});

exports.putCategory = asyncHandler(async (req, res) => {
  const parentId = Number(req.params.parentId);
  if (!Number.isFinite(parentId)) return res.status(400).json({ error: 'numeric parentId required' });
  const major = majorFromQuery(req);
  if (major.error) return res.status(400).json({ error: major.error });
  const canonical = major.categories.map((c) => c.key);
  const { category, broad, note } = req.body || {};
  if (category != null && !canonical.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${canonical.join(', ')}` });
  }
  if (broad != null && !major.broadAxes.includes(broad)) {
    return res.status(400).json({ error: `broad must be one of ${major.broadAxes.join(', ')}` });
  }
  const db = curationDb(req);
  const id = mappingId('course_category', parentId, major.slug);
  if (category == null && broad == null) {
    await db.collection(MAPPINGS).deleteOne({ _id: id });
    return res.json({ ok: true, cleared: true });
  }
  await db.collection(MAPPINGS).replaceOne(
    { _id: id },
    {
      _id: id,
      kind: 'course_category',
      course_id: `university:${parentId}`,
      legacy_id: parentId,
      major_slug: major.slug,
      category: category ?? null,
      broad: broad ?? null,
      note: note ?? null,
      ...stamp(req),
    },
    { upsert: true }
  );
  res.json({ ok: true });
});

exports.listOverrides = asyncHandler(async (req, res) => {
  const major = majorFromQuery(req);
  if (major.error) return res.status(400).json({ error: major.error });
  const rows = await curationDb(req).collection(MAPPINGS)
    .find({ kind: 'receiver_override', ...majorMappingClause(major.slug) }).toArray();
  const overrides = rows.map(({ _id, kind, receiver_hash, legacy_id, ...row }) => ({
    ...row,
    _id: String(receiver_hash ?? legacy_id),
  }));
  res.json({ overrides });
});

exports.putOverride = asyncHandler(async (req, res) => {
  const hashId = String(req.params.hashId || '').trim();
  if (!hashId) return res.status(400).json({ error: 'hashId required' });
  const major = majorFromQuery(req);
  if (major.error) return res.status(400).json({ error: major.error });
  const canonical = major.categories.map((c) => c.key);
  const { exclude, category, broad, note } = req.body || {};
  if (category != null && !canonical.includes(category)) {
    return res.status(400).json({ error: `category must be one of ${canonical.join(', ')}` });
  }
  if (broad != null && !major.broadAxes.includes(broad)) {
    return res.status(400).json({ error: `broad must be one of ${major.broadAxes.join(', ')}` });
  }
  const db = curationDb(req);
  const id = mappingId('receiver_override', hashId, major.slug);
  if (exclude == null && category == null && broad == null) {
    await db.collection(MAPPINGS).deleteOne({ _id: id });
    return res.json({ ok: true, cleared: true });
  }
  await db.collection(MAPPINGS).replaceOne(
    { _id: id },
    {
      _id: id,
      kind: 'receiver_override',
      receiver_hash: hashId,
      legacy_id: hashId,
      major_slug: major.slug,
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

exports.listAssocDegrees = asyncHandler(async (req, res) => {
  const rows = await curationDb(req).collection(REQUIREMENTS)
    .find({ kind: 'associate_degree' }).toArray();
  const degrees = rows.map(({ kind, institution_id, legacy_id, ...row }) => ({
    ...row,
    _id: legacy_id ?? String(row._id).replace(/^associate_degree:/, ''),
    community_college_id: Number(String(institution_id || '').replace(/^cc:/, '')),
    course_ids: (row.course_ids || []).map((id) => String(id).replace(/^cc:/, '')),
  }));
  res.json({ degrees });
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
  const legacyId = `${ccId}:${String(name).trim()}`;
  const id = `associate_degree:${legacyId}`;
  await curationDb(req).collection(REQUIREMENTS).replaceOne(
    { _id: id },
    {
      _id: id,
      kind: 'associate_degree',
      legacy_id: legacyId,
      institution_id: `cc:${ccId}`,
      community_college_id: ccId,
      name: String(name).trim(),
      course_ids: course_ids.map((value) => `cc:${String(value).replace(/^cc:/, '')}`),
      units: Number.isFinite(Number(units)) ? Number(units) : null,
      note: note ?? null,
      ...stamp(req),
    },
    { upsert: true }
  );
  res.json({ ok: true, id: legacyId });
});

exports.deleteAssocDegree = asyncHandler(async (req, res) => {
  const result = await curationDb(req).collection(REQUIREMENTS)
    .deleteOne({ _id: `associate_degree:${req.params.id}` });
  if (!result.deletedCount) return res.status(404).json({ error: 'no such degree doc' });
  res.json({ ok: true });
});

exports.getAsDegreeValidationCohort = asyncHandler(async (req, res) => {
  res.json(await getValidationCohort(curationDb(req), req.app.locals.db));
});

exports.putAsDegreeValidationCohort = asyncHandler(async (req, res) => {
  const ids = req.body?.college_ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'college_ids array required' });
  res.json(await setValidationCohort(curationDb(req), ids, req.user?.uid));
});
