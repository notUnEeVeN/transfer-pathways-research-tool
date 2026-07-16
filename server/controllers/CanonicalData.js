/** Canonical research-data API over the permanent compact schema. */
const { asyncHandler } = require('../middleware/asyncHandler');
const { majorScope, pairClause } = require('../services/majorVisibility');
const { prerequisiteGraphData } = require('../services/prereqGraph');

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
  prereq_concept: 'prereq_concept',
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

// ── prereq_concept validation ──
// The concept vocabulary is the normative prerequisite model (see
// docs/superpowers/specs/2026-07-15-prerequisite-concept-graph-design.md);
// writes must keep the rule graph acyclic and self-consistent.
const CONCEPT_SLUG_RE = /^[a-z0-9_]+$/;
const CONCEPT_DISCIPLINES = ['math', 'physics', 'chem', 'cs', 'bio', 'engr', 'stats', 'other'];

async function validatePrereqConcept(db, canonical) {
  const slug = String(canonical.slug || '');
  if (!CONCEPT_SLUG_RE.test(slug)) return 'slug must match ^[a-z0-9_]+$';
  if (slug !== String(canonical.legacy_id)) return 'slug must equal the row id';
  if (!CONCEPT_DISCIPLINES.includes(canonical.discipline)) {
    return `discipline must be one of ${CONCEPT_DISCIPLINES.join(', ')}`;
  }
  const requires = canonical.requires;
  if (!Array.isArray(requires) || requires.some((r) => typeof r !== 'string')) {
    return 'requires must be an array of concept slugs';
  }
  const rows = await db.collection(COLLECTIONS.requirements)
    .find({ kind: 'prereq_concept' }, { projection: { slug: 1, requires: 1 } })
    .toArray();
  const graph = new Map(rows.map((r) => [String(r.slug), (r.requires || []).map(String)]));
  graph.set(slug, requires.map(String));
  for (const r of requires) {
    if (!graph.has(String(r))) return `requires references unknown concept: ${r}`;
  }
  const state = new Map(); // 'visiting' | 'done'
  const visit = (node, path) => {
    if (state.get(node) === 'done') return null;
    if (state.get(node) === 'visiting') return [...path, node];
    state.set(node, 'visiting');
    for (const next of graph.get(node) || []) {
      const cycle = visit(next, [...path, node]);
      if (cycle) return cycle;
    }
    state.set(node, 'done');
    return null;
  };
  const cycle = visit(slug, []);
  if (cycle) return `requires would create a cycle: ${cycle.join(' → ')}`;
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
  if (kind === 'prereq_concept') {
    const invalid = await validatePrereqConcept(db, canonical);
    if (invalid) return res.status(400).json({ error: invalid });
  }
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
  if (kind === 'prereq_concept') {
    const slug = canonicalId.slice(prefix.length);
    const [dependents, mapped] = await Promise.all([
      req.app.locals.db.collection(COLLECTIONS.requirements)
        .countDocuments({ kind: 'prereq_concept', requires: slug }),
      req.app.locals.db.collection(COLLECTIONS.courses)
        .countDocuments({ concept: slug }),
    ]);
    if (dependents || mapped) {
      return res.status(400).json({
        error: `concept is referenced by ${dependents} concept(s) and ${mapped} course(s); reassign them first`,
      });
    }
  }
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

// Computed view over the concept vocabulary + course mapping (like
// /curated/degree-evaluation: a view over curated tables, so it lives here).
exports.prerequisiteGraph = asyncHandler(async (req, res) => {
  const requested = String(req.query.college_id || '').trim();
  const parsed = requested ? parseInstitutionId(requested, 'community_college') : null;
  if (requested && !parsed) return res.status(400).json({ error: 'college_id must be cc:<id>' });
  const data = await prerequisiteGraphData(req.app.locals.db, { collegeKey: parsed?.key ?? null });
  res.json(data);
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

// Course→concept mapping: enrichment fields on the sending-course doc (the
// spec's §1B). Human console edits only — imports use scripts/import_course_concepts.py.
exports.putCourseConcept = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const id = decodeURIComponent(String(req.params.id || ''));
  if (!/^cc:.+$/.test(id)) return res.status(400).json({ error: 'course id must be cc:<course_id>' });
  const { concept = null, note = '' } = req.body || {};
  if (concept != null) {
    const known = await db.collection(COLLECTIONS.requirements)
      .findOne({ _id: `prereq_concept:${concept}` }, { projection: { _id: 1 } });
    if (!known) return res.status(400).json({ error: `unknown concept slug: ${concept}` });
  }
  const course = await db.collection(COLLECTIONS.courses)
    .findOne({ _id: id, side: 'sending' }, { projection: { title: 1 } });
  if (!course) return res.status(404).json({ error: 'no such sending course' });
  await db.collection(COLLECTIONS.courses).updateOne(
    { _id: id },
    { $set: {
      concept: concept ?? null,
      concept_source: 'console_edit',
      concept_confidence: 1,
      concept_title_seen: course.title ?? null,
      concept_note: String(note || ''),
      concept_curated_by: req.user?.uid ?? null,
      concept_curated_at: new Date(),
    } }
  );
  res.json({ ok: true, id });
});

exports.COLLECTIONS = COLLECTIONS;
exports.REQUIREMENT_KINDS = REQUIREMENT_KINDS;
exports.parseInstitutionId = parseInstitutionId;
