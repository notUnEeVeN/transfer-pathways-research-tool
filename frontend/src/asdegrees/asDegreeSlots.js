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
 * The defaults and descriptions below stay major-neutral. A major may supply
 * a small `degreeSlotLabels` override through the server major registry when
 * the award itself differs — Economics' `ast` slot is an A.A.-T, for example.
 * Keeping that override in major metadata avoids hard-coded subject branches
 * here while preserving the familiar A.S.-T default for CS and Biology.
 */

export const AS_DEGREE_SLOTS = ['ast', 'local_as', 'local_other']

/** Short tab/chip copy. */
export const DEGREE_TYPE_LABEL = {
  ast: 'A.S.-T',
  local_as: 'Local A.S.',
  local_other: 'Other',
}

/** One-line description shown alongside the active degree type. */
export const DEGREE_TYPE_DESCRIPTION = {
  ast: 'Statewide transfer degree',
  local_as: 'College-defined degree',
  local_other: 'Other college-defined degree',
}

/** Canonical statewide-first display order. */
export const DEGREE_TYPE_ORDER = { ast: 0, local_as: 1, local_other: 2 }

/** Display label for a slot, falling back to its default then the raw value. */
export function slotLabel(slot, overrides = null) {
  return overrides?.[slot] || DEGREE_TYPE_LABEL[slot] || slot
}
