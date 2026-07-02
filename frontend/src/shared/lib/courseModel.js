/**
 * Shared course/target model helpers — the single source of the synthetic
 * planned-course shape and the target→major lookup. Keep these centralized: a
 * drift in this shape is a silent eligibility bug.
 */

import { STATUS, isRealCoursework } from './courseStatus'

/**
 * Turn a catalog course into a synthetic "planned" user-course record — used
 * wherever a plan/tray course must be fed into the eligibility evaluators as if
 * the student had taken it, and as the shape the Roadmap persists for a newly
 * added course. `c` is a catalog course (`{ course_id, units, prefix, number,
 * title, same_as, community_college_*, uc_transferable }`). `source` marks who
 * created the row ('user' for a hand-added course, 'ai' for a plan-generated
 * one) — see docs/plans/2026-06-15-unified-course-timeline-design.md.
 */
export function toSyntheticUserCourse(c, { source = 'user' } = {}) {
  return {
    course_id: c.course_id,
    course_units: c.units,
    course_grade: 'PL',
    status: STATUS.PLANNED,
    source,
    prefix: c.prefix,
    number: c.number,
    title: c.title,
    same_as: c.same_as || [],
    community_college_name: c.community_college_name,
    community_college_id: c.community_college_id,
    uc_transferable: !!c.uc_transferable
  }
}

/**
 * Select the course set eligibility should be evaluated against — the single
 * shared selector behind both the Eligibility page's "include planned" toggle
 * and (conceptually) the planner's virtual transcript. `includePlanned` (default
 * true, matching the page's long-standing behavior) keeps the full list —
 * planned + in-progress + completed, i.e. "what you'll have after your plan".
 * When false, only real coursework (in-progress + completed) counts, i.e. "what
 * you've earned so far". Planned (status 'planned' / grade 'PL') is the only
 * thing the toggle drops; in-progress always counts.
 */
export function selectEligibilityCourses(allCourses, includePlanned = true) {
  const list = allCourses || []
  return includePlanned ? list : list.filter(isRealCoursework)
}

/**
 * Resolve a plan target (`{ school_type, school_id, major }`) to its major
 * object in the catalog (`data.homeCollege.ucSchools` / `csuSchools[].majors`).
 * Returns null when the school or major can't be found.
 */
export function resolveTargetMajor(data, target) {
  if (!data || !target) return null
  const list = target.school_type === 'UC' ? data.homeCollege?.ucSchools || [] : data.homeCollege?.csuSchools || []
  const school = list.find((s) => s.id === Number(target.school_id))
  if (!school) return null
  return (school.majors || []).find((m) => m.major === target.major) || null
}
