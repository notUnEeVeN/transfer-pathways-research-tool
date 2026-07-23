/**
 * Read-only views of the hand-gathered full-degree requirements
 * (`curated_requirements`, kind `degree`): the template list (agreement-shaped
 * groups the shared RequirementsLedger renders directly) and one degree
 * evaluated against a community college (the "4-year degree" tab). See
 * docs/figures/degree-coverage-sources.md.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const {
  buildDegreeGroups,
  buildLedgerGroups,
  loadUniversityCourses,
  computeUnitBudget,
  degreeUnitSystem,
} = require('../services/degreeSlots');
const { evaluateDegreeAtCollege } = require('../services/degreeCoverage');
const { defaultMajor, getMajor, listMajors } = require('../config/majors');

const COLLECTION = 'curated_requirements';

exports.list = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const docs = await db.collection(COLLECTION).find({ kind: 'degree' }).sort({ school_id: 1 }).toArray();
  const calendars = await db.collection('assist_institutions')
    .find({ kind: 'university' }, { projection: { source_id: 1, academic_calendar: 1, _id: 0 } })
    .toArray();
  const calendarBySchool = new Map(calendars.map((row) => [Number(row.source_id), row.academic_calendar]));

  const rows = [];
  for (const doc of docs) {
    const universityCoursesById = await loadUniversityCourses(db, doc.requirement_groups);
    const { total } = buildDegreeGroups(doc.requirement_groups, { universityCoursesById });
    const ledger = buildLedgerGroups(doc.requirement_groups, { template: true });
    rows.push({
      _id: doc._id,
      school_id: doc.school_id,
      school: doc.school,
      // All legacy degree templates predate the major dimension and are CS.
      // Exposing that identity lets the frontend isolate templates now; the
      // next editor save persists the field on the canonical document.
      major_slug: doc.major_slug || defaultMajor().slug,
      program: doc.program,
      total_units: doc.total_units ?? null,
      unit_system: degreeUnitSystem(doc, calendarBySchool.get(Number(doc.school_id))),
      source_url: doc.source_url || null,
      // New major-dimensional templates carry their own official verification
      // trail instead of using the historical CS-only static source map.
      sources: Array.isArray(doc.sources) ? doc.sources : [],
      catalog_year: doc.catalog_year || null,
      college: doc.college || null,
      academic_unit: doc.academic_unit || null,
      ge_authority: doc.ge_authority || null,
      degree_variant: doc.degree_variant || null,
      research_status: doc.research_status || null,
      source_method: doc.source_method || null,
      unit_audit: doc.unit_audit || null,
      modeling_notes: Array.isArray(doc.modeling_notes) ? doc.modeling_notes : [],
      verification_notes: doc.verification_notes || [],
      units_summary: computeUnitBudget(doc.requirement_groups),
      updated_at: doc.updated_at || null,
      total,
      requirement_groups: ledger.requirement_groups,
      university_courses_by_id: universityCoursesById,
    });
  }
  res.json({ rows, generated_at: new Date() });
});

// One degree evaluated against one community college.
// ?school_id= & ?community_college_id= & ?majorSlug=cs.
exports.evaluate = asyncHandler(async (req, res) => {
  const school_id = Number(req.query.school_id);
  const community_college_id = Number(req.query.community_college_id);
  if (!Number.isFinite(school_id) || !Number.isFinite(community_college_id)) {
    return res.status(400).json({ error: 'school_id and community_college_id are required' });
  }
  const majorSlug = String(req.query.majorSlug || defaultMajor().slug).trim();
  if (!getMajor(majorSlug)) {
    return res.status(400).json({
      error: `unknown major: ${majorSlug}`,
      known: listMajors().map((major) => major.slug),
    });
  }
  const result = await evaluateDegreeAtCollege(req.app.locals.db, {
    schoolId: school_id, communityCollegeId: community_college_id, majorSlug,
  });
  if (!result) return res.status(404).json({ error: 'no degree template for this campus yet' });
  res.json(result);
});
