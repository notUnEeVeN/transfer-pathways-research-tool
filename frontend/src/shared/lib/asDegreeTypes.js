/**
 * Frontend counterpart of server/config/asDegreeSlots.js: the three
 * major-neutral associate-degree slots every major carries at every college.
 *
 * Major-neutral on purpose: before this, 'local_cs_as' baked Computer Science
 * into the type name while 'ast' was shared, so a second major could neither
 * reuse the vocabulary nor avoid colliding with CS. The major now lives in the
 * record's major_slug / record id, never in the slot name.
 *
 * This used to be copied independently in ValidationDashboard, AsDegreeQaTable,
 * and AsDegreeSchoolView, each free to drift from the others. Collapsed here
 * so there is exactly one place to update when a slot's copy changes.
 *
 * The associate-degree UI itself is still Computer-Science-only (the data has
 * only been gathered for CS), so these display strings stay CS-flavored on
 * purpose — generalizing the copy across majors is a later task.
 */

export const AS_DEGREE_SLOTS = ['ast', 'local_as', 'local_other']

/** Short tab/chip copy. */
export const DEGREE_TYPE_LABEL = {
  ast: 'CS A.S.-T',
  local_as: 'Local CS A.S.',
  local_other: 'Other computing',
}

/** One-line description shown alongside the active degree type. */
export const DEGREE_TYPE_DESCRIPTION = {
  ast: 'Statewide transfer degree',
  local_as: 'College-defined CS degree',
  local_other: 'Other college-defined computing degree',
}

/** Canonical statewide-first display order. */
export const DEGREE_TYPE_ORDER = { ast: 0, local_as: 1, local_other: 2 }
