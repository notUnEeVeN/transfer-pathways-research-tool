/**
 * Evaluate a hand-gathered four-year degree from `curated_requirements` against
 * one community college: how much of the whole degree transfers, and which
 * requirements that college can satisfy.
 *
 * The college's articulations come from its real agreements with this UC; the
 * readable grouped view + the counting live in services/degreeSlots.js.
 */
const {
  buildDegreeGroups,
  buildLedgerGroups,
  loadUniversityCourses,
  loadCollegeGeAreas,
  degreeUnitSystem,
} = require('./degreeSlots');
const { defaultMajor, getMajor, programPairClause } = require('../config/majors');

const COLLECTION = 'curated_requirements';

async function evaluateDegreeAtCollege(db, { schoolId, communityCollegeId, majorSlug }) {
  const school_id = Number(schoolId);
  const community_college_id = Number(communityCollegeId);
  const selectedMajor = getMajor(majorSlug || defaultMajor().slug);
  if (!selectedMajor) return null;

  // Prefer explicitly dimensional templates. Unstamped templates are the
  // historical CS set and may only be used by CS; Biology/Economics must fail
  // closed until their own templates exist.
  const configuredPrograms = selectedMajor.programs?.[school_id] || [];
  let degree = await db.collection(COLLECTION).findOne({
    kind: 'degree',
    school_id,
    major_slug: selectedMajor.slug,
    program: { $in: configuredPrograms },
  });
  if (!degree && selectedMajor.slug === defaultMajor().slug) {
    degree = await db.collection(COLLECTION).findOne({
      kind: 'degree', school_id, major_slug: { $exists: false },
    });
  }
  if (!degree) return null;

  // What this CC articulates for this UC: the set of parent_ids, and the CC
  // course options that satisfy each — unioned across the CC's agreements.
  const agreements = await db.collection('assist_agreements')
    .find({
      uc_school_id: school_id,
      community_college_id,
      ...programPairClause(selectedMajor),
    })
    .project({ requirement_groups: 1 })
    .toArray();
  const optionsByParent = new Map();
  const articulated = new Set();
  for (const agr of agreements) {
    for (const g of agr.requirement_groups || []) {
      for (const s of g.sections || []) {
        for (const r of s.receivers || []) {
          if (r.articulation_status !== 'articulated') continue;
          const pids = r.receiving?.kind === 'series' ? (r.receiving.parent_ids || []) : [r.receiving?.parent_id];
          for (const pid of pids) {
            if (pid == null) continue;
            articulated.add(Number(pid));
            if (!optionsByParent.has(Number(pid)) && (r.options || []).length) optionsByParent.set(Number(pid), r.options);
          }
        }
      }
    }
  }

  // CC course codes for the ones that satisfy a degree requirement.
  const usedCourseIds = new Set();
  for (const opts of optionsByParent.values()) for (const o of opts) for (const cid of o.course_ids || []) usedCourseIds.add(Number(cid));
  const coursesById = new Map();
  if (usedCourseIds.size) {
    const rows = await db.collection('assist_courses')
      .find({ side: 'sending', course_id: { $in: [...usedCourseIds] } }, { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, _id: 0 } })
      .toArray();
    for (const c of rows) coursesById.set(Number(c.course_id), c);
  }
  const universityCoursesById = await loadUniversityCourses(db, degree.requirement_groups);
  // The college's own course GE-area tags satisfy the R&C / H/SS breadth slots
  // that ASSIST's major-prep agreements never carry.
  const ccGeAreas = await loadCollegeGeAreas(db, community_college_id);
  const university = await db.collection('assist_institutions').findOne(
    { kind: 'university', source_id: school_id },
    { projection: { academic_calendar: 1, _id: 0 } }
  );

  const { total, covered, by_tier, units } = buildDegreeGroups(degree.requirement_groups, {
    articulated, optionsByParent, universityCoursesById, coursesById, ccGeAreas,
  });
  // Merged agreement-shaped groups so the frontend renders this tab through the
  // shared RequirementsLedger, matching the Rendered tab.
  const ledger = buildLedgerGroups(degree.requirement_groups, { articulated, optionsByParent, coursesById, ccGeAreas });
  const unitSystem = degreeUnitSystem(degree, university?.academic_calendar);
  const unitPct = units.total
    ? Math.round((100 * units.covered) / units.total)
    : null;

  return {
    school_id,
    school: degree.school,
    major_slug: selectedMajor.slug,
    program: degree.program,
    total_units: degree.total_units ?? null,
    unit_system: unitSystem,
    modeled_total_units: units.total,
    community_college_id,
    n_agreements: agreements.length,
    completion: {
      total, covered, pct: total ? Math.round((100 * covered) / total) : null, by_tier,
      // Unit-weighted coverage is primary. The denominator is the sum of the
      // hand-authored requirement groups, which can legitimately exceed the
      // university-wide minimum for a particular program.
      units: {
        total: units.total,
        covered: units.covered,
        pct: unitPct,
        unit_system: unitSystem,
        stated_minimum: degree.total_units ?? null,
      },
    },
    requirement_groups: ledger.requirement_groups,
    courses: ledger.courses,
    university_courses_by_id: universityCoursesById,
  };
}

module.exports = { evaluateDegreeAtCollege };
