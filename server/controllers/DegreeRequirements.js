/**
 * Read-only views of the hand-gathered full-degree requirements
 * (`curated_requirements`, kind `degree`): the template list (agreement-shaped
 * groups the shared RequirementsLedger renders directly) and one degree
 * evaluated against a community college (the "4-year degree" tab). See
 * docs/figures/degree-coverage-sources.md.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { buildDegreeGroups, buildLedgerGroups, loadUniversityCourses } = require('../services/degreeSlots');
const { evaluateDegreeAtCollege } = require('../services/degreeCoverage');

const COLLECTION = 'curated_requirements';

exports.list = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const docs = await db.collection(COLLECTION).find({ kind: 'degree' }).sort({ school_id: 1 }).toArray();

  const rows = [];
  for (const doc of docs) {
    const universityCoursesById = await loadUniversityCourses(db, doc.requirement_groups);
    const { total } = buildDegreeGroups(doc.requirement_groups, { universityCoursesById });
    const ledger = buildLedgerGroups(doc.requirement_groups, { template: true });
    rows.push({
      _id: doc._id,
      school_id: doc.school_id,
      school: doc.school,
      program: doc.program,
      total_units: doc.total_units ?? null,
      source_url: doc.source_url || null,
      updated_at: doc.updated_at || null,
      total,
      requirement_groups: ledger.requirement_groups,
      university_courses_by_id: universityCoursesById,
    });
  }
  res.json({ rows, generated_at: new Date() });
});

// One degree evaluated against one community college.
// ?school_id= & ?community_college_id=.
exports.evaluate = asyncHandler(async (req, res) => {
  const school_id = Number(req.query.school_id);
  const community_college_id = Number(req.query.community_college_id);
  if (!Number.isFinite(school_id) || !Number.isFinite(community_college_id)) {
    return res.status(400).json({ error: 'school_id and community_college_id are required' });
  }
  const result = await evaluateDegreeAtCollege(req.app.locals.db, {
    schoolId: school_id, communityCollegeId: community_college_id,
  });
  if (!result) return res.status(404).json({ error: 'no degree template for this campus yet' });
  res.json(result);
});
