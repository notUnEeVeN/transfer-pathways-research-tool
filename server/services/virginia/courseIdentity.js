/**
 * Stable course identities shared by every Virginia importer and API response.
 *
 * Virginia does not publish ASSIST-style numeric course ids, so the Virginia
 * corpus mints them deterministically from the canonical course code.  Both a
 * community-college `course_id` and a university `parent_id` use this function;
 * the field name records which side of a requirement the course occupies.
 */
const { createHash } = require('node:crypto');

const VA_ID_BASE = 900000000;
const CANONICAL_COURSE_CODE = /^[A-Z]{2,5}\d{2,4}[A-Z]?$/;
const PLACEHOLDER_COURSE_CODE = /^(?:X{2,5}0{2,4}|[A-Z]{2,5}0{3,4})$/;
const NON_COURSE_LANDING_NAME = /\b(?:elective|transfer|placeholder)\b|\b(?:general\s+(?:course\s+)?|no\s+|collegiate\s+|major\s+)credit\b|^general education$/i;

// Identity normalization is intentionally smaller than the catalog parser's
// `normCode`: that parser also repairs Acalog cell-gluing artifacts, which
// would misread a legitimate code such as ITE119 as TE119. Importers hand this
// helper an already-extracted code; only printed separators belong here.
const canonicalCourseCode = (code) => String(code ?? '')
  .replace(/\s*[-–—]\s*/g, '')
  .replace(/\s+/g, '')
  .toUpperCase();

function courseIdFor(code) {
  const canonical = canonicalCourseCode(code);
  // Transfer Virginia also publishes buckets such as TRNS1XX and CS----.
  // Those describe elective credit, not a university catalog course, and
  // must not receive a made-up parent_id that could be used in a degree.
  if (!CANONICAL_COURSE_CODE.test(canonical) || PLACEHOLDER_COURSE_CODE.test(canonical)) return null;
  return VA_ID_BASE
    + (createHash('sha1').update(`va:${canonical}`).digest().readUInt32BE(0) % 0x0fffffff);
}

function courseKeyFor(code) {
  const canonical = canonicalCourseCode(code);
  return courseIdFor(canonical) != null ? `va:${canonical}` : null;
}

/** A receiving id only for a concrete university catalog course landing. */
function parentIdForLanding(landing) {
  const parentId = courseIdFor(landing?.identifier);
  if (parentId == null || NON_COURSE_LANDING_NAME.test(String(landing?.name || '').trim())) return null;
  return parentId;
}

module.exports = {
  VA_ID_BASE,
  canonicalCourseCode,
  courseIdFor,
  courseKeyFor,
  parentIdForLanding,
};
