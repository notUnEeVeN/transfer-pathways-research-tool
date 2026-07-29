/**
 * Read-only API over the Maryland (ARTSYS) corpus.
 *
 * Deliberately isolated from the California stack. This controller touches only
 * `artsys_*` collections, shares no route prefix, no id grammar and no
 * controller code with `CanonicalData.js`, and is mounted from a single line in
 * routes/api.js. Deleting this file, routes/maryland.js and that line removes
 * Maryland entirely — the California console cannot notice.
 *
 * The isolation is on purpose while the second state is exploratory: merging
 * the two corpora would mean reconciling id grammars, a `system` dimension
 * through every existing query, and a major vocabulary that does not overlap.
 * None of that is worth doing before the data has been looked at.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  isMajorArticulable, isGroupCompleted, allArticulatingCourses,
} = require('../services/analysis/eligibility');

const COLLECTIONS = Object.freeze({
  institutions: 'artsys_institutions',
  courses: 'artsys_courses',
  agreements: 'artsys_agreements',
  meta: 'artsys_import_meta',
});

/**
 * The page this agreement was scraped from. ARTSYS renders one guide per
 * (program × receiving university) and takes the sending college as a query
 * parameter, so the pair stored on every document reconstructs the exact URL a
 * reader can open to check the import against the source.
 */
const ARTSYS_BASE = 'https://artsys.usmd.edu';
function sourceUrl(doc) {
  if (doc?.guide_id == null || !doc?.college_id) return null;
  const senderId = String(doc.college_id).replace(/^md:cc:/, '');
  return `${ARTSYS_BASE}/program_transfer_guides/${doc.guide_id}?sender_university_id=${senderId}`;
}

const AGREEMENT_LIST_PROJECTION = Object.freeze({
  college_id: 1, college_name: 1, university_id: 1, university_name: 1,
  major: 1, effective: 1, guide_id: 1,
});

/**
 * Count receivers and gaps without shipping the whole tree to the client.
 *
 * Two different gap numbers, and only one of them is a gap:
 *
 *   `missing`  every receiver marked not_articulated. This INCLUDES unchosen
 *              alternatives inside satisfied choose-one lists — a language
 *              requirement listing fifteen options marks fourteen for a college
 *              that needs one. Effectively every Maryland agreement has a
 *              nonzero `missing`, which makes it useless as a filter and
 *              misleading as a headline.
 *   `binding`  not_articulated receivers sitting in a group the eligibility
 *              engine reports unsatisfied. This is the project's existing
 *              definition of binding (spare alternatives in satisfied choice
 *              lists are not binding), and it is the number that answers
 *              "what actually blocks this student".
 *
 * The engine is evaluated against the synthetic "took everything articulable"
 * transcript, the same basis `isMajorArticulable` uses, so a group counts as
 * unsatisfied only when no local coursework could satisfy it.
 */
function summarize(agreement) {
  const taken = allArticulatingCourses(agreement);
  let receivers = 0;
  let missing = 0;
  let binding = 0;
  let bindingGroups = 0;
  for (const group of agreement.requirement_groups || []) {
    const satisfied = isGroupCompleted(group, taken, [], true);
    let groupMissing = 0;
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        receivers += 1;
        if (receiver.articulation_status !== 'not_articulated') continue;
        missing += 1;
        groupMissing += 1;
        if (!satisfied) binding += 1;
      }
    }
    if (groupMissing && !satisfied) bindingGroups += 1;
  }
  return {
    receivers,
    missing,
    binding,
    groups: (agreement.requirement_groups || []).length,
    bindingGroups,
  };
}

/** Institutions, split by kind. */
exports.listInstitutions = asyncHandler(async (req, res) => {
  const kind = ['community_college', 'university'].includes(req.query.kind) ? req.query.kind : null;
  const rows = await req.app.locals.db.collection(COLLECTIONS.institutions)
    .find(kind ? { kind } : {}).sort({ kind: 1, name: 1 }).toArray();
  res.json({ rows });
});

/**
 * Corpus overview. Every figure here is a plain count over stored documents —
 * no modelling, no derived rate — so the landing view cannot quietly assert
 * something the data does not say.
 */
exports.summary = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const [institutions, courses, agreements, meta] = await Promise.all([
    db.collection(COLLECTIONS.institutions).find({}, { projection: { kind: 1 } }).toArray(),
    db.collection(COLLECTIONS.courses).countDocuments(),
    db.collection(COLLECTIONS.agreements).countDocuments(),
    db.collection(COLLECTIONS.meta).findOne({ _id: 'current' }),
  ]);
  const [sending, receiving] = await Promise.all([
    db.collection(COLLECTIONS.courses).countDocuments({ side: 'sending' }),
    db.collection(COLLECTIONS.courses).countDocuments({ side: 'receiving' }),
  ]);
  const programs = await db.collection(COLLECTIONS.agreements).distinct('major');
  res.json({
    state: 'MD',
    source: 'artsys',
    colleges: institutions.filter((i) => i.kind === 'community_college').length,
    universities: institutions.filter((i) => i.kind === 'university').length,
    agreements,
    programs: programs.length,
    courses,
    sending_courses: sending,
    receiving_courses: receiving,
    imported_at: meta?.imported_at ?? null,
    validation: meta?.validation ?? null,
  });
});

/** Distinct programs, optionally filtered by receiving university or text. */
exports.listPrograms = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.university_id) filter.university_id = String(req.query.university_id);
  const q = String(req.query.q || '').trim();
  if (q) filter.major = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const rows = await req.app.locals.db.collection(COLLECTIONS.agreements).aggregate([
    { $match: filter },
    { $group: {
      _id: { major: '$major', university_id: '$university_id' },
      university_name: { $first: '$university_name' },
      guide_id: { $first: '$guide_id' },
      effective: { $first: '$effective' },
      colleges: { $sum: 1 },
    } },
    { $project: {
      _id: 0, major: '$_id.major', university_id: '$_id.university_id',
      university_name: 1, guide_id: 1, effective: 1, colleges: 1,
    } },
    { $sort: { major: 1, university_name: 1 } },
  ]).toArray();
  res.json({ rows });
});

/**
 * Agreement headers for a college, a university, or both.
 *
 * `verdicts=1` additionally runs the eligibility engine over each match and
 * attaches the completeness verdict and gap counts, so the browser can filter
 * a college's ~570 agreements down to the ones that actually have gaps. It is
 * opt-in because it means reading every requirement tree rather than a
 * projection — cheap for one college, wasteful for a bare listing.
 */
exports.listAgreements = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.college_id) filter.college_id = String(req.query.college_id);
  if (req.query.university_id) filter.university_id = String(req.query.university_id);
  if (req.query.major) filter.major = String(req.query.major);
  if (!Object.keys(filter).length) {
    return res.status(400).json({ error: 'college_id, university_id or major is required' });
  }
  const withVerdicts = String(req.query.verdicts || '') === '1';
  const rows = await req.app.locals.db.collection(COLLECTIONS.agreements)
    .find(filter, withVerdicts ? {} : { projection: AGREEMENT_LIST_PROJECTION })
    .sort({ university_name: 1, major: 1 }).toArray();
  if (!withVerdicts) {
    return res.json({ rows: rows.map((doc) => ({ ...doc, source_url: sourceUrl(doc) })) });
  }
  res.json({
    rows: rows.map((doc) => {
      const stats = summarize(doc);
      const { requirement_groups: _tree, ...header } = doc;
      return {
        ...header, ...stats,
        complete_path_exists: isMajorArticulable(doc, true),
        source_url: sourceUrl(doc),
      };
    }),
  });
});

/**
 * One agreement, whole, plus every course it references.
 *
 * The courses ship with the document because the shared ASSIST renderer
 * (`RequirementsLedger`) resolves course ids against lookup tables rather than
 * reading names off the tree. Sending them per agreement keeps the client from
 * having to hold Maryland's 30,660-course sending catalog to draw one page.
 *
 * The eligibility verdict comes from the same vendored engine the California
 * analyses use, so a reader can see the two corpora are judged by identical
 * rules rather than taking it on trust.
 */
exports.getAgreement = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const doc = await db.collection(COLLECTIONS.agreements).findOne({ _id: String(req.params.id) });
  if (!doc) return res.status(404).json({ error: 'no such agreement' });

  const sendingIds = new Set();
  const receivingIds = new Set();
  for (const group of doc.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        if (receiver.receiving?.course_id) receivingIds.add(receiver.receiving.course_id);
        for (const option of receiver.options || []) {
          for (const id of option.course_ids || []) sendingIds.add(id);
        }
      }
    }
  }
  const courses = await db.collection(COLLECTIONS.courses)
    .find({ _id: { $in: [...sendingIds, ...receivingIds] } }).toArray();

  res.json({
    ...doc,
    summary: summarize(doc),
    complete_path_exists: isMajorArticulable(doc, true),
    complete_path_exists_permissive: isMajorArticulable(doc, false),
    source_url: sourceUrl(doc),
    courses,
  });
});

/**
 * Per-college rollup for one program, or across all programs.
 *
 * `missing_entries` counts every receiver marked not_articulated. That number
 * INCLUDES unchosen alternatives inside satisfied choose-one lists — a guide
 * listing fifteen languages marks fourteen "not articulated" for a college that
 * needs only one, and none of those fourteen is a gap. It is reported because
 * it is what the documents literally say, but `complete` is the figure to read:
 * it comes from the eligibility engine, which honours the choose-N logic.
 */
exports.collegeRollup = asyncHandler(async (req, res) => {
  const filter = {};
  const major = String(req.query.major || '').trim();
  const universityId = String(req.query.university_id || '').trim();
  if (major) filter.major = major;
  if (universityId) filter.university_id = universityId;

  const cursor = req.app.locals.db.collection(COLLECTIONS.agreements).find(filter);
  const byCollege = new Map();
  for await (const doc of cursor) {
    const key = doc.college_id;
    const row = byCollege.get(key) || {
      college_id: key, college_name: doc.college_name, agreements: 0,
      complete: 0, receivers: 0, missing_entries: 0, binding_gaps: 0,
    };
    const stats = summarize(doc);
    row.agreements += 1;
    row.receivers += stats.receivers;
    row.missing_entries += stats.missing;
    row.binding_gaps += stats.binding;
    if (isMajorArticulable(doc, true)) row.complete += 1;
    byCollege.set(key, row);
  }
  const rows = [...byCollege.values()]
    .map((r) => ({
      ...r,
      complete_rate: r.agreements ? r.complete / r.agreements : null,
      binding_rate: r.receivers ? r.binding_gaps / r.receivers : null,
      missing_entry_rate: r.receivers ? r.missing_entries / r.receivers : null,
    }))
    .sort((a, b) => (b.complete_rate ?? 0) - (a.complete_rate ?? 0));
  res.json({
    scope: { major: major || null, university_id: universityId || null },
    rows,
    note: 'complete_rate is the eligibility-engine verdict and honours choose-N logic. '
      + 'binding_rate counts only not_articulated receivers inside groups the engine '
      + 'reports unsatisfied. missing_entry_rate counts every not_articulated receiver, '
      + 'including unchosen alternatives in satisfied choice lists, so it overstates gaps.',
  });
});

/**
 * Program × college completeness grid for one major-title filter — the data
 * behind the Maryland coverage-matrix figure. One row per stored agreement
 * whose program title matches `q` (case-insensitive contains), carrying only
 * identity and the strict-engine verdict; the client shapes the grid.
 */
exports.coverageMatrix = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q (program title contains) is required' });
  const filter = { major: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
  const docs = await req.app.locals.db.collection(COLLECTIONS.agreements).find(filter).toArray();
  const rows = docs.map((doc) => ({
    college_id: doc.college_id,
    college_name: doc.college_name,
    university_id: doc.university_id,
    university_name: doc.university_name,
    major: doc.major,
    complete: isMajorArticulable(doc, true),
  })).sort((a, b) => String(a.university_name).localeCompare(String(b.university_name))
    || String(a.major).localeCompare(String(b.major))
    || String(a.college_name).localeCompare(String(b.college_name)));
  res.json({
    scope: { q },
    rows,
    note: 'complete is the strict eligibility-engine verdict and honours choose-N logic.',
  });
});

exports.COLLECTIONS = COLLECTIONS;
exports.sourceUrl = sourceUrl;
exports.summarize = summarize;
