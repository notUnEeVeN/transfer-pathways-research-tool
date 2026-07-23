/**
 * The three associate-degree slots every major carries at every college.
 *
 * Major-neutral on purpose: before this, 'local_cs_as' baked Computer Science
 * into the type name while 'ast' was shared, so a second major could neither
 * reuse the vocabulary nor avoid colliding with CS. The major now lives in the
 * document's major_slug and in the row id, never in the slot name.
 */
const AS_DEGREE_SLOTS = Object.freeze(['ast', 'local_as', 'local_other']);

/** Tab and chip copy. The major supplies the subject; the slot the award. */
const SLOT_LABELS = Object.freeze({
  ast: 'A.S.-T',
  local_as: 'Local A.S.',
  local_other: 'Other',
});

/**
 * Pre-migration CS type names to slots. The ONLY place these strings may
 * appear after the migration lands — scripts/migrateAsDegreeSlots.js reads it
 * to rewrite historical rows, and nothing else should.
 */
const LEGACY_TYPE_TO_SLOT = Object.freeze({
  ast: 'ast',
  local_cs_as: 'local_as',
  local_computing: 'local_other',
});

const AS_DEGREE_ID_RE = /^(\d+):([a-z0-9_]+):([a-z0-9_]+)$/;

/** `<communityCollegeId>:<majorSlug>:<slot>` — the as_degree legacy_id. */
function asDegreeRowId(collegeId, majorSlug, slot) {
  return `${Number(collegeId)}:${majorSlug}:${slot}`;
}

/** Null for anything that is not a three-segment id, including the old form. */
function parseAsDegreeRowId(rawId) {
  const match = AS_DEGREE_ID_RE.exec(String(rawId ?? ''));
  if (!match) return null;
  return {
    communityCollegeId: Number(match[1]),
    majorSlug: match[2],
    slot: match[3],
  };
}

module.exports = {
  AS_DEGREE_SLOTS,
  SLOT_LABELS,
  LEGACY_TYPE_TO_SLOT,
  asDegreeRowId,
  parseAsDegreeRowId,
};
