/** Human judgments stored in the permanent curated collections. */
const { asyncHandler } = require('../middleware/asyncHandler');
const { getValidationCohort, setValidationCohort } = require('../services/asDegreeValidation');
const { proposeAsDegreeEdit } = require('../services/asDegreeAssist');

const MAPPINGS = 'curated_mappings';
const REQUIREMENTS = 'curated_requirements';

const CANONICAL_CATEGORIES = [
  'calculus', 'advanced_math', 'discrete_math', 'other_math',
  'intro_programming', 'data_structures', 'computer_org', 'other_computing',
  'science', 'non_stem',
];
const BROAD_AXES = ['computing', 'math', 'science', 'non_stem'];

const stamp = (req) => ({ curated_by: req.user?.uid ?? null, curated_at: new Date() });
const curationDb = (req) => req.app.locals.auditDb || req.app.locals.db;

let anthropicClient = null;
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

exports.listCategories = asyncHandler(async (req, res) => {
  const rows = await curationDb(req).collection(MAPPINGS)
    .find({ kind: 'course_category' }).toArray();
  const categories = rows.map(({ _id, kind, course_id, legacy_id, ...row }) => ({
    ...row,
    _id: Number(legacy_id ?? String(course_id).replace(/^university:/, '')),
  }));
  res.json({ categories, canonical: CANONICAL_CATEGORIES, broad: BROAD_AXES });
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
  const db = curationDb(req);
  const id = `course_category:${parentId}`;
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
  const rows = await curationDb(req).collection(MAPPINGS)
    .find({ kind: 'receiver_override' }).toArray();
  const overrides = rows.map(({ _id, kind, receiver_hash, legacy_id, ...row }) => ({
    ...row,
    _id: String(receiver_hash ?? legacy_id),
  }));
  res.json({ overrides });
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
  const db = curationDb(req);
  const id = `receiver_override:${hashId}`;
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

exports.postAsDegreeAssist = asyncHandler(async (req, res) => {
  const instruction = String(req.body?.instruction || '').trim();
  if (!instruction) return res.status(400).json({ error: 'instruction required' });

  // Log every valid attempt before client construction or provider/database
  // work so unavailable-provider and failed-proposal requests remain auditable.
  console.log(`[ai-assist] uid=${req.user?.uid ?? 'unknown'} doc=${req.params.id} instruction=${JSON.stringify(instruction.slice(0, 200))}`);

  const anthropic = getAnthropic();
  if (!anthropic) {
    return res.status(503).json({
      error: 'ai_assist_unavailable',
      detail: 'ANTHROPIC_API_KEY is not configured on the server.',
    });
  }
  try {
    const { validateAsDegree } = require('./CanonicalData');
    const result = await proposeAsDegreeEdit(
      req.app.locals.db,
      { recordId: req.params.id, instruction },
      { anthropic, validate: validateAsDegree },
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error?.message || 'AI assist could not produce a valid proposal.' });
  }
});

exports.CANONICAL_CATEGORIES = CANONICAL_CATEGORIES;
exports.BROAD_AXES = BROAD_AXES;
