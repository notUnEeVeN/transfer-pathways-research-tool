/**
 * Evaluate a hand-gathered four-year degree from `curated_requirements` against
 * one community college: how much of the whole degree transfers, and which
 * requirements that college can satisfy.
 *
 * The college's articulations come from its real agreements with this UC; the
 * readable grouped view + the counting live in services/degreeSlots.js.
 */
const { buildDegreeGroups, loadUniversityCourses, loadCollegeGeAreas } = require('./degreeSlots');

const COLLECTION = 'curated_requirements';

async function evaluateDegreeAtCollege(db, { schoolId, communityCollegeId }) {
  const school_id = Number(schoolId);
  const community_college_id = Number(communityCollegeId);
  const degree = await db.collection(COLLECTION).findOne({ kind: 'degree', school_id });
  if (!degree) return null;

  // What this CC articulates for this UC: the set of parent_ids, and the CC
  // course options that satisfy each — unioned across the CC's agreements.
  const agreements = await db.collection('assist_agreements')
    .find({ uc_school_id: school_id, community_college_id })
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
      .find({ side: 'sending', course_id: { $in: [...usedCourseIds] } }, { projection: { course_id: 1, prefix: 1, number: 1, _id: 0 } })
      .toArray();
    for (const c of rows) coursesById.set(Number(c.course_id), c);
  }
  const universityCoursesById = await loadUniversityCourses(db, degree.requirement_groups);
  // The college's own course GE-area tags satisfy the R&C / H/SS breadth slots
  // that ASSIST's major-prep agreements never carry.
  const ccGeAreas = await loadCollegeGeAreas(db, community_college_id);

  const { total, covered, by_tier, groups } = buildDegreeGroups(degree.requirement_groups, {
    articulated, optionsByParent, universityCoursesById, coursesById, ccGeAreas,
  });

  return {
    school_id,
    school: degree.school,
    program: degree.program,
    total_units: degree.total_units ?? null,
    community_college_id,
    n_agreements: agreements.length,
    completion: { total, covered, pct: total ? Math.round((100 * covered) / total) : null, by_tier },
    groups,
  };
}

module.exports = { evaluateDegreeAtCollege };
