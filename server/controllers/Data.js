/**
 * Data-explorer endpoints — the partners' window into the research database.
 * Everything is scoped by partner visibility (admins see all ported data).
 *
 *   GET /data/summary          — what the caller's dataset contains: majors
 *       per school, agreement counts, and course counts. Admins see the full
 *       ported catalogs; partners see the CC/university courses their visible
 *       agreements reference.
 *   GET /data/raw-assist/:id   — the raw ASSIST.org API payload for one
 *       agreement (live per-major fetch through the session proxy; the same
 *       upstream JSON the parser's raw_cache mirrors).
 */
const { ObjectId } = require('mongodb');
const { asyncHandler } = require('../middleware/asyncHandler');
const { majorScope, pairAllowed, pairClause, scopeTag } = require('../services/majorVisibility');
const { fetchRawAgreement } = require('../services/assistProxy');

const TTL_MS = 60 * 1000;
const summaryCache = new Map(); // scopeTag → { at, payload }

// Walk an agreement's receivers, collecting referenced CC course_ids and
// university parent_ids (mirrors scripts/port.py referenced_ids). Ids stay
// RAW — course ids are numeric since the 2026-07 parser update.
function collectRefs(doc, courseIds, parentIds) {
  for (const group of doc.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const recv of section.receivers || []) {
        const receiving = recv.receiving || {};
        if (receiving.kind === 'course') parentIds.add(receiving.parent_id);
        else if (receiving.kind === 'series') (receiving.parent_ids || []).forEach((p) => parentIds.add(p));
        for (const opt of recv.options || []) {
          (opt.course_ids || []).forEach((id) => { if (id != null) courseIds.add(id); });
        }
      }
    }
  }
}

exports.getSummary = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const pairs = await majorScope(req);
  const tag = scopeTag(pairs);
  const hit = summaryCache.get(tag);
  if (hit && Date.now() - hit.at < TTL_MS) return res.json(hit.payload);

  const match = pairs != null ? pairClause(pairs, 'uc_school_id') : {};
  const [groups, nColleges, settings] = await Promise.all([
    db.collection('assist_agreements').aggregate([
      { $match: match },
      {
        $group: {
          _id: { school_id: '$uc_school_id', school: '$uc_school' },
          majors: { $addToSet: '$major' },
          n_agreements: { $sum: 1 },
        },
      },
      { $sort: { '_id.school': 1 } },
    ]).toArray(),
    db.collection('assist_institutions').countDocuments({ kind: 'community_college' }),
    (req.app.locals.auditDb || db).collection('settings')
      .findOne({ _id: 'app' }, { projection: { last_data_refresh_at: 1 } }),
  ]);

  // Courses in scope: whole collections for admins (that's exactly what was
  // ported); for partners, only what their visible agreements reference.
  let nCourses;
  let nUniversityCourses;
  if (pairs == null) {
    [nCourses, nUniversityCourses] = await Promise.all([
      db.collection('assist_courses').countDocuments({ side: 'sending' }),
      db.collection('assist_courses').countDocuments({ side: 'receiving' }),
    ]);
  } else if (!pairs.length) {
    nCourses = 0;
    nUniversityCourses = 0;
  } else {
    const courseIds = new Set();
    const parentIds = new Set();
    for await (const doc of db.collection('assist_agreements').find(match, { projection: { requirement_groups: 1 } })) {
      collectRefs(doc, courseIds, parentIds);
    }
    parentIds.delete(null);
    nCourses = courseIds.size;
    nUniversityCourses = parentIds.size;
  }

  const payload = {
    last_data_refresh_at: settings?.last_data_refresh_at ?? null,
    scoped: pairs != null,
    schools: groups.map((g) => ({
      school_id: g._id.school_id,
      school: g._id.school,
      majors: g.majors.sort(),
      n_agreements: g.n_agreements,
    })),
    counts: {
      agreements: groups.reduce((s, g) => s + g.n_agreements, 0),
      majors: groups.reduce((s, g) => s + g.majors.length, 0),
      courses: nCourses,
      university_courses: nUniversityCourses,
      community_colleges: nColleges,
    },
  };
  summaryCache.set(tag, { at: Date.now(), payload });
  res.json(payload);
});

exports.getRawAssist = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid agreement id' });
  const doc = await db.collection('assist_agreements').findOne(
    { _id: new ObjectId(req.params.id) },
    { projection: { uc_school_id: 1, community_college_id: 1, major: 1, major_id: 1 } }
  );
  if (!doc) return res.status(404).json({ error: 'not found' });
  const pairs = await majorScope(req);
  if (!pairAllowed(pairs, doc.uc_school_id, doc.major)) {
    return res.status(404).json({ error: 'not found' });
  }
  if (!doc.major_id) return res.status(404).json({ error: 'agreement has no ASSIST major id' });
  try {
    const raw = await fetchRawAgreement(doc.community_college_id, doc.uc_school_id, doc.major_id);
    res.json(raw);
  } catch (e) {
    console.error('data.getRawAssist:', e.message);
    res.status(502).json({ error: 'assist.org fetch failed — try again shortly' });
  }
});
