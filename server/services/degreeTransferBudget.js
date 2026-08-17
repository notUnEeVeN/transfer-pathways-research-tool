/**
 * How a transfer student's units land against a four-year degree.
 *
 * The document states what the campus requires. This states what happens to a
 * transfer student under those requirements, and the two are deliberately kept
 * apart: every figure here is derived on read, so it cannot go stale the way a
 * stored one does. (UCLA Biology carried a `unit_audit` block asserting a 35-unit
 * GE remainder and 18 units of elective capacity for a day after both had
 * changed — that is the failure this module exists to prevent.)
 *
 * ── Satisfying a requirement is not the same as transferring units ──────────
 *
 * A student who completes IGETC or Cal-GETC has *satisfied* the campus general
 * education requirement. Full stop — they do not repeat any of it after
 * transferring. What the cap limits is how much of that work carries unit
 * credit toward the degree. Modelling the shortfall as "general education
 * earned at the university" states something false about the student's
 * transcript; the honest statement is that general education is done and some
 * number of units must still be earned, in anything.
 *
 * ── What the student must do after transferring ─────────────────────────────
 *
 *   university units = max( requirements that cannot transfer,
 *                           total − units actually transferred )
 *
 * Two different things can bind:
 *
 *   - **The cap.** The usual case. A college can satisfy more of the degree
 *     than the campus will award credit for, so the student arrives having done
 *     the work but needing units. UCLA: 180 − 105 = 75 to earn, of which 60 is
 *     upper division and 15 is anything at all.
 *
 *   - **The requirements.** If what cannot transfer is *larger* than the gap the
 *     cap leaves, the cap never binds and the student transfers less than it
 *     allows. A campus needing 60 upper-division units on a 120-unit degree with
 *     a 70-unit cap can only take 60 units of transfer credit, not 70.
 *
 * Taking the cap as the answer is right only while the first case holds. It
 * holds for every California document we have today — Berkeley 50 against 36,
 * Davis 75 against 64, UCLA 75 against 60, Merced 50 against 44 — which is why
 * the error was invisible. It is not a rule, it is a coincidence with four
 * data points.
 */

const CAP_BY_SYSTEM = Object.freeze({ semester: 70, quarter: 105 });

const sum = (numbers) => numbers.reduce((a, b) => a + b, 0);

const isUpperDivision = (group) => /^upper/.test(String(group.course_level || ''));

/**
 * Work that can only be done after transferring, in either vocabulary.
 *
 * Two conventions are in use and both are legitimate. The Biology and Economics
 * documents say `course_level: 'upper_division'` with `cc_articulable: false`;
 * the computer-science documents leave `course_level` unset throughout and mark
 * the same fact as `tier: 'nontransferable'`, which is what degreeSlots has
 * always read. Recognising only the first made every CS document report zero
 * university-side requirement, so the whole degree looked transferable.
 *
 * The reading belongs here rather than in the documents: a curator should not
 * have to restate a fact in a second vocabulary to make a calculation notice it.
 */
const isUniversityOnly = (group) => isUpperDivision(group)
  || group.cc_articulable === false
  || String(group.tier || '') === 'nontransferable'
  || (group.sections || []).length > 0
    && (group.sections || []).every((s) => String(s.tier || group.tier || '') === 'nontransferable');

// A section that states slots but no units is priced the way degreeSlots prices
// it. Counting those as zero made a document's requirements vanish and every
// college look fully covered.
const ASSUMED_UNITS_PER_COURSE = 4;

/** Units a group asks for, collapsing a choice to the cheapest path a college can supply. */
function groupUnits(group) {
  const sections = group.sections || [];
  const units = (section) => (section.unit_advisement != null
    ? Number(section.unit_advisement)
    : (Number(section.section_advisement) || (section.receivers || []).length || 0)
      * ASSUMED_UNITS_PER_COURSE);
  const isChoice = String(group.group_conjunction || '').toLowerCase() === 'or' && sections.length > 1;
  if (!isChoice) return sum(sections.map(units));
  // A block no college articulates cannot set the floor — it would price the
  // degree on a route nobody can take. Where reach is unrecorded, assume live.
  const reachable = sections.filter((s) => (s.articulation_reach ?? 1) > 0);
  return Math.min(...(reachable.length ? reachable : sections).map(units));
}

/** The campus rule, preferring what the document states over what the calendar implies. */
function transferCap(degree) {
  const stored = degree.transfer_unit_cap;
  const units = typeof stored === 'object' && stored !== null ? Number(stored.units) : Number(stored);
  if (Number.isFinite(units)) return units;
  let system = String(degree.unit_system || '').toLowerCase();
  if (system !== 'quarter' && system !== 'semester') {
    // Same fallback degreeSlots uses: the campus graduation minimum gives the
    // calendar away, 180 quarter units against 120 semester. Several documents
    // never stored `unit_system`, and without this the cap silently vanished
    // and every unit of a 120-unit degree looked transferable.
    const total = Number(degree.total_units);
    if (!Number.isFinite(total)) return null;
    system = total >= 150 ? 'quarter' : 'semester';
  }
  return CAP_BY_SYSTEM[system] ?? null;
}

function upperDivisionMinimum(degree) {
  const stored = degree.upper_division_minimum;
  const units = typeof stored === 'object' && stored !== null ? Number(stored.units) : Number(stored);
  return Number.isFinite(units) ? units : null;
}

/**
 * @param degree                     a `kind: 'degree'` document
 * @param opts.satisfiedUnits        units of transferable requirement a particular
 *                                   college can actually satisfy. Omit for the
 *                                   ceiling — a college that articulates everything.
 */
function computeTransferBudget(degree, opts = {}) {
  const groups = degree.requirement_groups || [];
  const total = Number(degree.total_units) || 0;
  const cap = transferCap(degree);

  // Requirements split by where they can be discharged, never by where the units
  // end up. A lower-division course no college articulates sits with the upper
  // division here: both are work the student can only do after transferring.
  const transferableGroups = groups.filter((g) => !isUniversityOnly(g));
  const universityGroups = groups.filter(isUniversityOnly);

  const transferableUnits = sum(transferableGroups.map(groupUnits));
  const universityRequired = sum(universityGroups.map(groupUnits));
  const upperDivisionUnits = sum(groups.filter(isUpperDivision).map(groupUnits));

  // What this college satisfies, bounded by what exists to satisfy.
  const satisfied = Math.min(
    opts.satisfiedUnits == null ? transferableUnits : Number(opts.satisfiedUnits),
    transferableUnits,
  );
  // A requirement the college cannot satisfy is done after transferring, so it
  // joins the work that cannot transfer.
  const unsatisfied = transferableUnits - satisfied;
  // A campus floor the major does not reach on its own is real work too: UC
  // Merced Biology names 43 upper-division units against a 44-unit minimum, so
  // one further upper-division unit is required. Deriving it here keeps it from
  // being stored as a padding group that goes stale the next time the major
  // moves — which is how "Additional upper-division capacity" groups appeared.
  const upperMinimum = upperDivisionMinimum(degree);
  const upperShortfall = upperMinimum == null ? 0 : Math.max(0, upperMinimum - upperDivisionUnits);
  const mustEarnAtUniversity = universityRequired + unsatisfied + upperShortfall;

  // Units with no requirement attached are free electives, and a free elective
  // is ordinary UC-transferable coursework — a student whose requirements are
  // light takes more of them at the college rather than carrying an empty cap.
  // So the ceiling on transfer is not what the requirements happen to weigh; it
  // is whatever room the degree has left once the university-only work is set
  // aside. Treating electives as university work stranded 36 units on campus in
  // a case where 30 of them could plainly have been transferred.
  const room = total - mustEarnAtUniversity;
  const transferred = cap == null ? room : Math.min(cap, room);
  const universityUnits = total - transferred;

  // Name whichever limit actually produced the figure, in that order: the cap
  // when there was more room than it allows, otherwise the reason the room ran
  // short — this college's articulation, or the degree's own university-only
  // requirements.
  const binding = cap != null && room > cap ? 'transfer_cap'
    : unsatisfied > 0 ? 'articulation'
      : 'university_requirements';

  return {
    total,
    cap,
    unit_system: degree.unit_system || null,
    requirements: {
      transferable: transferableUnits,
      university: universityRequired,
      upper_division: upperDivisionUnits,
      stated: transferableUnits + universityRequired,
    },
    // Requirements the college discharges. Distinct from units carried: a
    // student may satisfy every general education requirement and still bring
    // fewer units than that work was worth.
    satisfied,
    transferred,
    university: {
      total: universityUnits,
      // Requirements that can only be discharged after transferring: the upper
      // division, anything with no articulation, and whatever this college
      // could not satisfy.
      required: mustEarnAtUniversity,
      // Units with no requirement attached, taken on campus only because the
      // degree has a floor to reach and the cap is already full.
      unallocated: universityUnits - mustEarnAtUniversity,
    },
    binding,
    upper_division_minimum: upperMinimum,
    // How much further upper-division work the campus floor demands beyond what
    // the major names. Zero when the major already clears it, null where the
    // campus states no floor at all (UC Irvine).
    upper_division_shortfall: upperMinimum == null ? null : upperShortfall,
    // The document states requirements, not a closed budget. Stating fewer units
    // than the degree needs is normal and expected — the difference is elective.
    within_total: transferableUnits + universityRequired <= total,
    // How much of the degree the document actually accounts for. Everything it
    // does not name is treated as free elective, and free electives transfer —
    // so a thinly modelled degree reads as highly transferable for a reason
    // that says nothing about the college. A document naming 28 of 120 units
    // scores 90% at a college covering barely half of what it names.
    //
    // Consumers should gate on this the way the Virginia overview gates on a
    // complete catalogue record: report the unit percentage where the document
    // models the degree, and withhold it where it does not.
    modeled_share: total ? (transferableUnits + universityRequired) / total : null,
  };
}

module.exports = { computeTransferBudget, groupUnits, transferCap, upperDivisionMinimum };
