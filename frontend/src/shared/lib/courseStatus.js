/**
 * Course status — the single source of truth for the "planned / in progress /
 * completed" distinction that used to be smuggled inside `course_grade`
 * (`'PL'` = planned, `'IP'` = in progress, a letter = completed).
 *
 * STAGE 1 of the unified-timeline work (docs/plans/2026-06-15-unified-course-
 * timeline-design.md): every reader that branched on `course_grade === 'PL'`
 * now routes through these helpers, so a later stage can flip the source of
 * truth from the grade string to an explicit `status` field by editing ONE
 * function (`getCourseStatus`). Behavior is intentionally identical for now:
 * status is derived from the grade.
 */

export const STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
}

/** Map a raw `course_grade` to a status. A letter grade, empty string, or a
 *  missing grade all read as COMPLETED — matching the legacy GPA rule that
 *  counted anything other than 'PL'/'IP' as a real (completed) course. */
export function gradeToStatus(grade) {
  if (grade === 'PL') return STATUS.PLANNED
  if (grade === 'IP') return STATUS.IN_PROGRESS
  return STATUS.COMPLETED
}

/** Status of a stored user-course. Stage 1: derived from the grade (grade is
 *  still authoritative). A later stage will prefer an explicit `course.status`. */
export function getCourseStatus(course) {
  return gradeToStatus(course?.course_grade)
}

export const isPlanned = (course) => getCourseStatus(course) === STATUS.PLANNED

/**
 * "Real coursework": a course the student has actually taken or is taking — the
 * set the eligibility and plan evaluators treat as the true transcript. Exactly
 * reproduces the legacy `c.course_grade && c.course_grade !== 'PL'` filter: a
 * course with no grade at all is excluded.
 */
export const isRealCoursework = (course) => !!course?.course_grade && !isPlanned(course)

/**
 * "Counts toward GPA": a completed course (not planned, not in progress).
 * Reproduces the legacy gpa.js `g !== 'PL' && g !== 'IP'` check, including that
 * an empty grade counts as completed.
 */
export const countsTowardGpa = (course) => getCourseStatus(course) === STATUS.COMPLETED
