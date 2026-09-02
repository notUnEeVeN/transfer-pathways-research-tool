/**
 * General-education classification for Virginia associate requirement groups.
 *
 * Virginia's composed sources record a group's general-education role in two
 * different ways.  Some colleges stamp `ge_area` directly (J. Sargeant
 * Reynolds names its UCGS blocks); most do not, and carry the same fact only
 * in the authored `label_seen` -- "History elective", "UCGS Block IV --
 * Natural Sciences", "Humanities from two distinct categories".
 *
 * The credit model reads `ge_area` and nothing else, so an untagged group
 * supplied zero general-education units.  Ten of the nineteen Virginia
 * associate degrees carried no `ge_area` at all, which is why a Virginia
 * associate degree contributed ~0 GE units against bachelor programs that
 * demand ~44% breadth, and why Virginia's unit-utilization read 18% where
 * California reads 57%.
 *
 * This module resolves that classification from the retained label only. It
 * never mutates a stored document, so every verified Virginia source keeps its
 * exact major-core hash; `geBlocks` consults it as a fallback when the authored
 * `ge_area` is absent.
 *
 * Scope rules applied here, so the table can be reviewed as policy:
 *
 *   - Written and oral communication, humanities/fine arts/literature,
 *     history, social and behavioral science, and natural science are the
 *     UCGS general-education blocks and are classified.
 *   - Mathematics is classified ONLY where the source names a general UCGS
 *     mathematics block. A computer-science degree's calculus and discrete
 *     mathematics are major preparation, not breadth, and stay unclassified so
 *     they cannot be double counted as GE.
 *   - Student development (SDV) alone is an institutional completion
 *     requirement, not a UCGS block, and stays unclassified. Where a source
 *     merges SDV into a composition group, the group is classified by its
 *     dominant composition content.
 *   - Named major requirements, technical selections, and open elective
 *     capacity stay unclassified.
 */

const AREAS = Object.freeze({
  WRITTEN: 'va_ucgs_written_communication',
  ORAL: 'va_ucgs_oral_communication',
  HUMANITIES: 'va_ucgs_humanities_fine_arts_literature',
  HISTORY: 'va_ucgs_history',
  SOCIAL: 'va_ucgs_social_behavioral_science',
  NATURAL: 'va_ucgs_natural_science',
  MATHEMATICS: 'va_ucgs_mathematics',
  INFORMATION_LITERACY: 'va_ucgs_information_literacy',
  GENERAL: 'va_ucgs_general_education_elective',
});

const normalize = (value) => String(value ?? '')
  .replace(/—|–/g, '-')
  .toLowerCase()
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Exact authored labels, normalized. An exact table rather than a loose regex:
// a label that has not been reviewed must fall through unclassified instead of
// being guessed into a credit-bearing block.
const CLASSIFIED = new Map(Object.entries({
  // --- written communication (UCGS Block I) -------------------------------
  'written communication': AREAS.WRITTEN,
  'ucgs block i written communication': AREAS.WRITTEN,
  'b s destination written communication': AREAS.WRITTEN,
  'second written communication course': AREAS.WRITTEN,
  'student development and written communication': AREAS.WRITTEN,
  'college success and written communication': AREAS.WRITTEN,
  'student development and communication': AREAS.WRITTEN,
  'written and oral communication': AREAS.WRITTEN,
  'communication ethics and student development': AREAS.WRITTEN,

  // --- oral communication -------------------------------------------------
  'oral communication': AREAS.ORAL,
  'communication': AREAS.ORAL,

  // --- humanities, fine arts, literature (UCGS Block II) ------------------
  'humanities': AREAS.HUMANITIES,
  'humanities or fine arts': AREAS.HUMANITIES,
  'humanities from two distinct categories': AREAS.HUMANITIES,
  'two humanities electives from different clusters': AREAS.HUMANITIES,
  'arts and literature': AREAS.HUMANITIES,
  'arts and humanities': AREAS.HUMANITIES,
  'arts humanities and literature from two different categories': AREAS.HUMANITIES,
  'literature': AREAS.HUMANITIES,
  'literature elective': AREAS.HUMANITIES,
  'english literature at the 200 level': AREAS.HUMANITIES,
  'humanities literature or fine arts elective': AREAS.HUMANITIES,
  'communication humanities or fine arts': AREAS.HUMANITIES,
  'ucgs block ii humanities art and literature': AREAS.HUMANITIES,
  'ucgs block ii arts humanities and literature': AREAS.HUMANITIES,
  'ucgs block ii art or humanities non literature': AREAS.HUMANITIES,
  'ucgs fine arts or literature': AREAS.HUMANITIES,
  'ucgs humanities fine arts or literature': AREAS.HUMANITIES,
  'ucgs non literature humanities or fine arts': AREAS.HUMANITIES,
  'ucgs literature': AREAS.HUMANITIES,
  'the art of language and ideas': AREAS.HUMANITIES,
  'the language and history of fine arts': AREAS.HUMANITIES,
  'the human experience': AREAS.HUMANITIES,

  // --- history (UCGS Block VI) -------------------------------------------
  'history': AREAS.HISTORY,
  'history elective': AREAS.HISTORY,
  'united states history': AREAS.HISTORY,
  'ucgs history': AREAS.HISTORY,
  'ucgs block vi history': AREAS.HISTORY,

  // --- social and behavioral science (UCGS Block III) ---------------------
  'social science': AREAS.SOCIAL,
  'social science elective': AREAS.SOCIAL,
  'social science elective excluding history': AREAS.SOCIAL,
  'social and behavioral sciences': AREAS.SOCIAL,
  'social and behavioral science elective': AREAS.SOCIAL,
  'social or behavioral science elective': AREAS.SOCIAL,
  'ucgs social or behavioral science': AREAS.SOCIAL,
  'ucgs non history social or behavioral science': AREAS.SOCIAL,
  'ucgs block iii social and behavioral sciences': AREAS.SOCIAL,
  'ucgs block iii social and behavioral science': AREAS.SOCIAL,
  'u s and world cultures': AREAS.SOCIAL,

  // --- natural science (UCGS Block IV) ------------------------------------
  'natural science': AREAS.NATURAL,
  'natural science sequence': AREAS.NATURAL,
  'laboratory science': AREAS.NATURAL,
  'laboratory sciences': AREAS.NATURAL,
  'laboratory science sequence': AREAS.NATURAL,
  'science with laboratory elective': AREAS.NATURAL,
  'physical and life sciences with laboratory': AREAS.NATURAL,
  'two distinct introductory laboratory science selections': AREAS.NATURAL,
  'second laboratory science course': AREAS.NATURAL,
  'two course physics sequence': AREAS.NATURAL,
  'b s destination laboratory science': AREAS.NATURAL,
  'ucgs block iv natural sciences': AREAS.NATURAL,
  'ucgs laboratory science i': AREAS.NATURAL,
  'approved transfer elective laboratory science ii': AREAS.NATURAL,
  'investigation of the natural world': AREAS.NATURAL,

  // --- mathematics: ONLY an explicit general UCGS block -------------------
  'ucgs block v mathematics': AREAS.MATHEMATICS,

  // --- information literacy ----------------------------------------------
  'digital and information literacy': AREAS.INFORMATION_LITERACY,

  // --- explicitly named general-education electives -----------------------
  'general education elective': AREAS.GENERAL,
  'ucgs general education elective': AREAS.GENERAL,
}));

/**
 * Resolve the general-education area of a Virginia associate requirement
 * group from its authored label. Returns null when the label is a major
 * requirement, an open elective, or simply has not been reviewed.
 */
function virginiaGeAreaForLabel(label) {
  return CLASSIFIED.get(normalize(label)) || null;
}

function virginiaGeArea(group) {
  if (group?.ge_area) return String(group.ge_area);
  return virginiaGeAreaForLabel(group?.label_seen);
}


/**
 * General-education units a Virginia associate degree supplies through groups
 * that ENUMERATE their eligible courses.
 *
 * `geBlocks` deliberately excludes these: an enumerated group is also a named
 * requirement the associate planner must satisfy, so counting it there would
 * inflate the planner's aggregate demand and make valid plans infeasible.
 * But the credit model still has to know the student leaves with those GE
 * credits in hand -- the bachelor side holds open `ge_area` breadth receivers
 * that no named articulation can ever match.
 *
 * So this is a supply-only figure. It never reaches `planAssociateDegree`, and
 * `applyAssociateUnits` still caps GE at the units left AFTER direct
 * articulation, so a course that already landed on a named bachelor
 * requirement cannot also be spent here.
 */
function virginiaEnumeratedGeUnits(doc, { exactSource = false } = {}) {
  // Virginia-only. The label table is written against Virginia's authored
  // vocabulary; running it over a California or Massachusetts document could
  // match an unrelated label and move a published figure.
  if (!exactSource) return 0;
  let units = 0;
  for (const group of doc?.requirement_groups || []) {
    if (group?.units_fill) continue;
    // Groups without enumerated courses already flow through `geBlocks`.
    const hasReceivers = (group?.sections || [])
      .some((section) => (section?.receivers || []).length > 0);
    if (!hasReceivers) continue;
    // An authored `ge_area` is an open-category marker in Virginia, not a
    // general-education one, so only the reviewed label table decides here.
    if (group?.ge_area) continue;
    if (!virginiaGeAreaForLabel(group?.label_seen)) continue;
    const stated = Number((group.sections || [])[0]?.unit_advisement);
    if (Number.isFinite(stated) && stated > 0) units += stated;
  }
  return units;
}

module.exports = {
  AREAS,
  virginiaEnumeratedGeUnits,
  CLASSIFIED,
  virginiaGeArea,
  virginiaGeAreaForLabel,
};
