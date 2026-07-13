/** Canonical research-data API over the permanent compact schema. */
const { asyncHandler } = require('../middleware/asyncHandler');
const { majorScope, pairClause } = require('../services/majorVisibility');

const COLLECTIONS = Object.freeze({
  institutions: 'assist_institutions',
  courses: 'assist_courses',
  agreements: 'assist_agreements',
  admissions: 'admissions',
  requirements: 'curated_requirements',
  prerequisites: 'curated_prerequisites',
});

const REQUIREMENT_PREFIX = Object.freeze({
  transfer_minimum: 'transfer_minimum',
  degree: 'degree',
  ge_pattern: 'ge_pattern',
  igetc: 'igetc',
  associate_degree: 'associate_degree',
});
const REQUIREMENT_KINDS = Object.keys(REQUIREMENT_PREFIX);

function parseInstitutionId(value, expectedKind = null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = /^(cc|uc):(\d+)$/.exec(raw);
  if (match) {
    const kind = match[1] === 'cc' ? 'community_college' : 'university';
    if (expectedKind && kind !== expectedKind) return null;
    return { key: raw, sourceId: Number(match[2]), kind };
  }
  if (/^\d+$/.test(raw) && expectedKind) {
    const prefix = expectedKind === 'community_college' ? 'cc' : 'uc';
    return { key: `${prefix}:${raw}`, sourceId: Number(raw), kind: expectedKind };
  }
  return null;
}

exports.listInstitutions = asyncHandler(async (req, res) => {
  const kind = ['community_college', 'university'].includes(req.query.kind)
    ? req.query.kind
    : null;
  const rows = await req.app.locals.db.collection(COLLECTIONS.institutions)
    .find(kind ? { kind } : {})
    .sort({ name: 1 })
    .toArray();
  res.json({ rows });
});

exports.listCourses = asyncHandler(async (req, res) => {
  const requestedInstitution = String(req.query.institution_id || '').trim();
  const parsed = requestedInstitution
    ? parseInstitutionId(
      requestedInstitution,
      requestedInstitution.startsWith('uc:') ? 'university' : 'community_college'
    )
    : null;
  if (requestedInstitution && !parsed) {
    return res.status(400).json({ error: 'institution_id must be cc:<id> or uc:<id>' });
  }

  const ids = String(req.query.ids || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length > 500) return res.status(400).json({ error: 'ids supports at most 500 course ids' });
  if (!parsed && !ids.length) {
    return res.status(400).json({ error: 'institution_id or ids is required; use /exports/courses for the full catalog' });
  }

  const filter = ids.length ? { _id: { $in: ids } } : { institution_id: parsed.key };
  const rows = await req.app.locals.db.collection(COLLECTIONS.courses)
    .find(filter)
    .sort({ prefix: 1, number: 1 })
    .toArray();
  res.json({ rows });
});

exports.listAgreements = asyncHandler(async (req, res) => {
  const college = parseInstitutionId(req.query.college_id, 'community_college');
  const university = req.query.university_id
    ? parseInstitutionId(req.query.university_id, 'university')
    : null;
  if (!college) return res.status(400).json({ error: 'college_id=cc:<id> is required' });
  if (req.query.university_id && !university) {
    return res.status(400).json({ error: 'university_id must be uc:<id>' });
  }

  const visiblePairs = await majorScope(req);
  const filter = { college_id: college.key };
  if (university) filter.university_id = university.key;
  const major = String(req.query.major || '').trim();
  if (major) filter.major = major;
  if (visiblePairs != null) Object.assign(filter, pairClause(visiblePairs, 'uc_school_id'));

  const rows = await req.app.locals.db.collection(COLLECTIONS.agreements)
    .find(filter)
    .sort({ uc_school: 1, major: 1 })
    .toArray();
  res.json({ rows });
});

exports.listAdmissions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.institution_id) {
    const institution = parseInstitutionId(req.query.institution_id, 'university');
    if (!institution) return res.status(400).json({ error: 'institution_id must be uc:<id>' });
    filter.institution_id = institution.key;
  }
  const major = String(req.query.major || '').trim();
  if (major) filter.major = major;
  const visiblePairs = await majorScope(req);
  if (visiblePairs != null) Object.assign(filter, pairClause(visiblePairs, 'uc_school_id'));
  const rows = await req.app.locals.db.collection(COLLECTIONS.admissions)
    .find(filter)
    .sort({ uc_school: 1, major: 1 })
    .toArray();
  res.json({ rows });
});

exports.listRequirements = asyncHandler(async (req, res) => {
  const kind = String(req.query.kind || '').trim();
  if (kind && !REQUIREMENT_KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of ${REQUIREMENT_KINDS.join(', ')}` });
  }
  const rows = await req.app.locals.db.collection(COLLECTIONS.requirements)
    .find(kind ? { kind } : {})
    .toArray();
  res.json({ rows });
});

exports.putRequirement = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const kind = String(req.params.kind || '').trim();
  if (!REQUIREMENT_KINDS.includes(kind)) {
    return res.status(404).json({ error: 'unknown requirement kind' });
  }
  const row = req.body || {};
  const rawId = row._id ?? row.legacy_id;
  if (rawId == null || rawId === '') return res.status(400).json({ error: 'row _id required' });
  const prefix = `${REQUIREMENT_PREFIX[kind]}:`;
  const canonicalId = String(rawId).startsWith(prefix) ? String(rawId) : `${prefix}${rawId}`;
  const legacyId = row.legacy_id ?? String(rawId).replace(new RegExp(`^${prefix}`), '');
  const canonical = {
    ...row,
    _id: canonicalId,
    legacy_id: legacyId,
    kind,
    curated_by: req.user?.uid ?? null,
    curated_at: new Date(),
    updated_at: new Date(),
  };
  await db.collection(COLLECTIONS.requirements).replaceOne(
    { _id: canonicalId }, canonical, { upsert: true }
  );
  res.json({ ok: true, id: canonicalId });
});

exports.deleteRequirement = asyncHandler(async (req, res) => {
  const kind = String(req.params.kind || '').trim();
  if (!REQUIREMENT_KINDS.includes(kind)) {
    return res.status(404).json({ error: 'unknown requirement kind' });
  }
  const prefix = `${REQUIREMENT_PREFIX[kind]}:`;
  const rawId = decodeURIComponent(String(req.params.id));
  const canonicalId = rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
  const result = await req.app.locals.db.collection(COLLECTIONS.requirements)
    .deleteOne({ _id: canonicalId });
  if (!result.deletedCount) return res.status(404).json({ error: 'no such row' });
  res.json({ ok: true });
});

exports.listPrerequisites = asyncHandler(async (req, res) => {
  const rows = await req.app.locals.db.collection(COLLECTIONS.prerequisites).find().toArray();
  res.json({ rows });
});

exports.putPrerequisite = asyncHandler(async (req, res) => {
  const row = req.body || {};
  const rawId = row._id || row.course_id;
  if (!rawId) return res.status(400).json({ error: 'row _id required' });
  const id = String(rawId);
  const canonical = {
    ...row,
    _id: id,
    status: row.status || (row.course_id ? 'resolved' : 'needs_review'),
    curated_by: req.user?.uid ?? null,
    curated_at: new Date(),
  };
  await req.app.locals.db.collection(COLLECTIONS.prerequisites)
    .replaceOne({ _id: id }, canonical, { upsert: true });
  res.json({ ok: true, id });
});

exports.deletePrerequisite = asyncHandler(async (req, res) => {
  const id = decodeURIComponent(String(req.params.id));
  const result = await req.app.locals.db.collection(COLLECTIONS.prerequisites).deleteOne({ _id: id });
  if (!result.deletedCount) return res.status(404).json({ error: 'no such row' });
  res.json({ ok: true });
});

exports.putInstitutionProfile = asyncHandler(async (req, res) => {
  const parsed = parseInstitutionId(req.params.id, 'community_college');
  if (!parsed) return res.status(400).json({ error: 'institution id must be cc:<id>' });
  const { district, region, counties_served } = req.body || {};
  const result = await req.app.locals.db.collection(COLLECTIONS.institutions).updateOne(
    { _id: parsed.key },
    { $set: {
      district: district || null,
      region: region || null,
      counties_served: Array.isArray(counties_served) ? counties_served : [],
      curated_by: req.user?.uid ?? null,
      curated_at: new Date(),
    } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'no such institution' });
  res.json({ ok: true, id: parsed.key });
});

exports.deleteInstitutionProfile = asyncHandler(async (req, res) => {
  const parsed = parseInstitutionId(req.params.id, 'community_college');
  if (!parsed) return res.status(400).json({ error: 'institution id must be cc:<id>' });
  const result = await req.app.locals.db.collection(COLLECTIONS.institutions).updateOne(
    { _id: parsed.key },
    { $set: {
      district: null,
      region: null,
      counties_served: [],
      curated_by: req.user?.uid ?? null,
      curated_at: new Date(),
    } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'no such institution' });
  res.json({ ok: true });
});

exports.COLLECTIONS = COLLECTIONS;
exports.REQUIREMENT_KINDS = REQUIREMENT_KINDS;
exports.parseInstitutionId = parseInstitutionId;
