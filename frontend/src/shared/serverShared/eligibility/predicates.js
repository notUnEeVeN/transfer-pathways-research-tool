/**
 * Receiver-centric eligibility predicates.
 *
 * Agreement shape:
 *   major.requirement_groups[].sections[].receivers[]
 * Each receiver:
 *   {
 *     receiving: {kind, ...},          // UC/CSU side (course | series | requirement | ge_area)
 *     articulation_status,             // 'articulated' | 'not_articulated'
 *     not_articulated_reason,          // null | 'must_take_at_university' | 'no_course_articulated'
 *                                      // | 'never_articulated' | 'missing_articulation_entry'
 *     options: [{course_ids, course_conjunction: 'and'|'or'}],
 *     options_conjunction: 'and' | 'or',
 *     hash_id                          // hashed from receiving side (cross-CC fallback)
 *   }
 *
 * Cross-CC equivalency is passed in explicitly as `crossCc` — an array of
 * {hash_id, course_ids, community_college_name} records produced by
 * computeCrossCcEquivalents (below) from the student's secondary-college
 * coursework. A receiver whose hash_id appears in that set is credited even
 * if it doesn't articulate at the home CC. Callers that don't supply it
 * (default []) simply get no cross-CC fallback.
 */

import { gradeToGPA, meetsCOrBetter } from './constants.js';

// ---------------------------------------------------------------------------
// Course-level
// ---------------------------------------------------------------------------

/**
 * Whether a user-course earns credit toward a requirement. Planned (PL) and
 * in-progress (IP) courses count as "on track"; a completed letter grade only
 * counts at C or better (gpa >= 2.0) — D/F don't, matching the Cal-GETC/UC-7
 * "courses below a C don't count" rule. Missing/unknown grade labels are
 * treated leniently (count) so they're never silently dropped.
 */
const courseEarnsCredit = (c) => {
  const grade = c?.course_grade;
  if (!grade || grade === 'PL' || grade === 'IP') return true;
  const gpa = gradeToGPA[grade];
  if (gpa === undefined) return true;
  return meetsCOrBetter(gpa);
};

const isCourseCompleted = (courseId, userCourses) => {
  // Direct hit (only counts if the grade earns credit)
  if (userCourses.some((c) => c.course_id === courseId && courseEarnsCredit(c))) return true;
  // Same-as: user took a credit-earning course that lists `courseId` as a peer
  return userCourses.some((u) => courseEarnsCredit(u) && u.same_as?.some((peer) => peer.course_id === courseId));
};

// ---------------------------------------------------------------------------
// Option-level (one alternative CC path)
// ---------------------------------------------------------------------------

const isOptionCompleted = (option, userCourses) => {
  if (!option || !Array.isArray(option.course_ids) || option.course_ids.length === 0) return false;
  const conj = (option.course_conjunction || 'and').toLowerCase();
  if (conj === 'or') return option.course_ids.some((id) => isCourseCompleted(id, userCourses));
  return option.course_ids.every((id) => isCourseCompleted(id, userCourses));
};

// ---------------------------------------------------------------------------
// Receiver-level
// ---------------------------------------------------------------------------

/**
 * Whether a receiver is satisfied by the user's courses.
 *
 * Articulated receivers: options evaluated under options_conjunction.
 * Both articulated and not-articulated receivers fall back to the hash_id
 * lookup in `crossCc` — a student who completed the equivalent at another
 * CC (where it IS articulated) satisfies the same UC requirement even if
 * this CC doesn't articulate it.
 */
const isReceiverCompleted = (receiver, userCourses, crossCc = []) => {
  if (!receiver) return false;

  const options = receiver.options || [];
  if (options.length > 0) {
    const conj = (receiver.options_conjunction || 'and').toLowerCase();
    const results = options.map((opt) => isOptionCompleted(opt, userCourses));
    const direct = conj === 'or' ? results.some(Boolean) : results.every(Boolean);
    if (direct) return true;
  }

  // Cross-CC fallback: another community college's agreement already proved
  // this receiver (matched by hash_id of the receiving side).
  if (receiver.hash_id) {
    return crossCc.some((s) => s.hash_id === receiver.hash_id);
  }

  return false;
};

/**
 * Whether a receiver is achievable at all for this student — either it
 * articulates locally OR a cross-CC equivalent already satisfies it. Used as
 * the cap when displaying "X of Y achievable here" and when computing the
 * effective ASSIST advisement for completion checks.
 */
const isReceiverAvailable = (receiver, crossCc = []) => {
  if (!receiver) return false;
  if (receiver.articulation_status !== 'not_articulated') return true;
  if (!receiver.hash_id) return false;
  return crossCc.some((s) => s.hash_id === receiver.hash_id);
};

// ---------------------------------------------------------------------------
// Unit-counting
// ---------------------------------------------------------------------------

/**
 * Returns total UC/CSU units across receivers that are completed AND articulated.
 *
 * ASSIST expresses unit_advisement in UC/CSU units (the receiving side), so we
 * sum each completed receiver's `receiving.units` rather than the student's CC
 * course units. For requirement / ge_area receivers there's no specific UC
 * course → no fixed unit count → we fall back to the satisfying CC option's
 * units so a student isn't penalized for choosing those paths.
 */
const calculateUnitsFromCompletedReceivers = (receivers, userCourses, crossCc = []) => {
  let total = 0;
  for (const receiver of receivers || []) {
    if (!isReceiverCompleted(receiver, userCourses, crossCc)) continue;
    const ucUnits = receiver.receiving?.units;
    if (ucUnits != null) {
      total += ucUnits;
      continue;
    }
    // Requirement / ge_area: fall back to the satisfying option's CC units.
    const opt = (receiver.options || []).find((o) => isOptionCompleted(o, userCourses));
    if (!opt) continue;
    for (const courseId of opt.course_ids || []) {
      const userCourse = userCourses.find((c) => c.course_id === courseId);
      if (userCourse) total += userCourse.course_units || 0;
    }
  }
  return total;
};

// ---------------------------------------------------------------------------
// Section / group / major
// ---------------------------------------------------------------------------

/**
 * Count of receivers that can be satisfied — articulated locally OR already
 * cross-CC-fulfilled via hash. The parser stores ASSIST's raw advisement;
 * eligibility caps it here based on what's actually achievable for this
 * student ("complete 3, but only 2 are articulated here → 2 is the effective
 * ask; if cross-CC fills the 3rd, the cap rises back to 3").
 */
const availableCount = (receivers, crossCc = []) =>
  (receivers || []).filter((r) => isReceiverAvailable(r, crossCc)).length;

/**
 * UC/CSU units obtainable from the receivers that are achievable at this CC —
 * the unit analog of availableCount. Used to cap unit advisements so a "complete
 * N units" ask the CC can't fully articulate reduces to what's achievable here.
 */
const availableUnits = (receivers, crossCc = []) =>
  (receivers || []).reduce((sum, r) => (isReceiverAvailable(r, crossCc) ? sum + (r.receiving?.units || 0) : sum), 0);

/**
 * Maximum number of courses from this section that can count toward a
 * parent group's group_advisement total.
 *
 * In AND + group_advisement context, a section_advisement is a CAP (a
 * ceiling), not a floor: "Select 1 from these" means at most 1 of this
 * section's courses counts toward the parent group's stated ask, even if
 * the user takes more from the same subgroup. Sections without their own
 * advisement contribute up to their full reachable receiver count.
 */
const sectionMaxContribution = (section, crossCc = []) => {
  const reachable = availableCount(section?.receivers, crossCc);
  if (section?.section_advisement != null) {
    return Math.min(section.section_advisement, reachable);
  }
  return reachable;
};

/**
 * How many of the user's completed courses in this section actually count
 * toward a parent group's group_advisement total. Clamped at the section's
 * cap (section_advisement) when set — completing 2 in a "Select 1" subgroup
 * still only contributes 1 to the group total.
 */
const sectionContribution = (section, userCourses, crossCc = []) => {
  const done = (section?.receivers || []).filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length;
  if (section?.section_advisement != null) {
    return Math.min(done, section.section_advisement);
  }
  return done;
};

/**
 * A section is a viable "path" for an OR-group when at least one of its
 * receivers is reachable — otherwise it can never be selected as the
 * satisfying alternative and shouldn't count toward the group's cap.
 */
const sectionIsReachable = (section, crossCc = []) => availableCount(section?.receivers, crossCc) > 0;

/**
 * Pick the largest `k` values from `arr` and sum them. Used to honor the
 * C-bucket area cap (`group_max_distinct_sections`): only the best K areas'
 * contributions count toward the group.
 */
const sumTopK = (arr, k) =>
  [...arr].sort((a, b) => b - a).slice(0, k).reduce((n, c) => n + c, 0);

/**
 * Total completed contribution a group's sections make toward its
 * group_advisement, honoring the C-bucket area cap. Without
 * group_max_distinct_sections this is just the sum of per-section
 * contributions; with it, only the best K (= the cap) sections count, so
 * spreading across more areas than allowed can't satisfy the ask and extra
 * coursework in a surplus area can't reduce an already-satisfied group.
 */
const groupCappedContribution = (group, userCourses, crossCc = []) => {
  const contributions = (group?.sections || []).map((s) => sectionContribution(s, userCourses, crossCc));
  if (group?.group_max_distinct_sections != null) {
    return sumTopK(contributions, group.group_max_distinct_sections);
  }
  return contributions.reduce((n, c) => n + c, 0);
};

/**
 * ASSIST has two distinct OR-with-`group_advisement` patterns:
 *
 *   "Pick one alternative path"  — sections each carry their own
 *     section_/unit_advisement (e.g. "Complete 1 of MATH 31A/31B series OR
 *     MATH 3A/3B/3C series"). group_advisement is the per-path course
 *     count; any one section fully satisfied → group satisfied.
 *
 *   "Complete N courses from A, B, or C" — sections are just course
 *     buckets with no internal ask. The "Or" only signals that you can
 *     mix freely across the listed areas; group_advisement counts COURSES.
 *
 * Returns true for the second pattern (bare buckets). The two are handled
 * by separate branches in getEffectiveGroupAsk / isGroupCompleted / the
 * percentage and display helpers so the labels and math both fit.
 */
const orSectionsAreBareBuckets = (group) =>
  group?.group_advisement != null &&
  (group.group_conjunction || 'And').toLowerCase() === 'or' &&
  (group.sections || []).every((s) => s.section_advisement == null && s.unit_advisement == null);

/**
 * Whether the sections of a group_advisement group are alternative "buckets"
 * feeding a shared count, regardless of literal group_conjunction. Fires for
 * both OR-bare-buckets ("Complete N from A, B, or C") and AND-bare-buckets
 * ("Complete 1 from CHEM series AND from PHYS/MATH series" — where the
 * group_advisement-of-1 across no-advisement sections means the AND is
 * effectively a pool, not a strict per-section requirement).
 *
 * Used by the renderer to decide the inter-section conjunction: bare-bucket
 * pools render with OR between sections instead of the literal conjunction,
 * because visually each section is an alternative path.
 */
const groupSectionsAreAlternativePool = (group) =>
  group?.group_advisement != null &&
  (group.sections || []).every((s) => s.section_advisement == null && s.unit_advisement == null);

/**
 * Visual inter-section conjunction. Returns the string to render between
 * adjacent section cards inside a group, or `null` to suppress.
 *
 *   group has no group_advisement     → literal `group_conjunction`
 *   bare-bucket alternatives pool     → 'or' (pure alternatives)
 *   group_advisement + AND + mixed    → null (pool with caps; the
 *                                       group header "X / N courses"
 *                                       carries the meaning; AND would
 *                                       falsely imply "do all sections"
 *                                       when courses can sum across
 *                                       sections)
 *   group_advisement + OR + per-asks  → 'or' (alternative paths — pick one)
 *
 * The mixed-pool null case fires on UCSB-English-style groups where the
 * group says "Complete 2 from the following" with N sections, some of
 * which have their own caps (section_advisement=1) and some bare.
 */
const interSectionConjOf = (group) => {
  if (group?.group_advisement == null) return group?.group_conjunction;
  if (groupSectionsAreAlternativePool(group)) return 'or';
  const conj = (group.group_conjunction || 'And').toLowerCase();
  if (conj === 'and') return null;
  return group.group_conjunction;
};

/**
 * Whether every receiver in every section of a group is `kind='series'`.
 * When true, the group's count is meaningfully measured in series (each
 * receiver IS a series), so the display label switches from "course(s)"
 * to "series" for that group.
 */
const allReceiversAreSeries = (group) => {
  const sections = group?.sections || [];
  if (sections.length === 0) return false;
  for (const s of sections) {
    const receivers = s.receivers || [];
    if (receivers.length === 0) return false;
    for (const r of receivers) {
      if (r.receiving?.kind !== 'series') return false;
    }
  }
  return true;
};

/**
 * Effective group ask for display + completion checks.
 *
 *   AND group: ASSIST's group_advisement, capped at the total max possible
 *     contribution across sections. Each section's max contribution is
 *     bounded by its section_advisement cap (if any). Counted in courses.
 *
 *   OR group with per-section asks: ASSIST's "Complete N courses from A,
 *     B, C, or D" with each section carrying its own section_advisement
 *     means "pick one alternative path and complete its section_advisement
 *     courses." group_advisement is the courses count for the chosen path
 *     (typically equal to each section_advisement). Returned as-is.
 *
 *   OR-bare-buckets ("Complete N courses from A, B, or C" with no section
 *     asks): same courses semantics as AND — sum cap-bounded contributions.
 *
 * Returns 0 for groups that have no group_advisement.
 */
const getEffectiveGroupAsk = (group, crossCc = []) => {
  if (group?.group_advisement == null) return 0;
  const conj = (group.group_conjunction || 'And').toLowerCase();
  if (conj === 'or' && !orSectionsAreBareBuckets(group)) {
    // Pick-one-section semantic: group_advisement is the per-path course
    // count, not a multiplier over sections. The reachability cap doesn't
    // apply (only one section needs to be reachable for the group to be
    // satisfiable; if all sections are unreachable, isGroupCompleted will
    // return false naturally).
    return group.group_advisement;
  }
  // AND, or OR-bare-buckets ("Complete N courses from A, B, or C"): both
  // count courses. Sum cap-bounded max contributions across sections, cap
  // at the group's stated ask. For a C-bucket (group_max_distinct_sections)
  // only the best K areas can count, so the max possible is the top-K
  // section maxima — otherwise an ask larger than two areas can deliver
  // would never reduce to what's actually achievable.
  const maxima = (group.sections || []).map((s) => sectionMaxContribution(s, crossCc));
  const totalMaxPossible =
    group.group_max_distinct_sections != null
      ? sumTopK(maxima, group.group_max_distinct_sections)
      : maxima.reduce((n, c) => n + c, 0);
  return Math.min(group.group_advisement, totalMaxPossible);
};

/**
 * Distinct areas credited toward a D-bucket ("complete M courses from K of these
 * areas"). A reachable area (the CC articulates >= group_section_min_courses of
 * it) counts once the student completes that many. Areas the CC can't offer are
 * auto-credited (completed after transfer) — but ONLY to fill a genuine
 * shortfall: when at least K areas articulate, the student must complete the
 * full K (an unarticulated area doesn't reduce the ask). The group is satisfied
 * when the returned count reaches group_min_distinct_sections.
 */
const dBucketQualifyingCount = (group, userCourses, crossCc = []) => {
  const minPerSection = group?.group_section_min_courses || 1;
  const required = group?.group_min_distinct_sections || 0;
  let reachable = 0;
  let completedReachable = 0;
  for (const s of group?.sections || []) {
    if (availableCount(s.receivers, crossCc) < minPerSection) continue; // can't be done here
    reachable += 1;
    if ((s.receivers || []).filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length >= minPerSection) {
      completedReachable += 1;
    }
  }
  const autoCredit = Math.max(0, required - reachable); // only the unfillable gap
  return Math.min(completedReachable + autoCredit, required);
};

const isSectionCompleted = (section, userCourses, crossCc = []) => {
  if (!section || !Array.isArray(section.receivers)) return false;

  // Nothing here articulates at this CC → vacuously satisfied (completed after
  // transfer), the same way a capped advisement treats an unreachable ask. Keeps
  // a fully-unarticulated section from blocking an AND group.
  if (availableCount(section.receivers, crossCc) === 0) return true;

  if (section.unit_advisement != null) {
    const effective = Math.min(section.unit_advisement, availableUnits(section.receivers, crossCc));
    const total = calculateUnitsFromCompletedReceivers(section.receivers, userCourses, crossCc);
    return total >= effective;
  }

  if (section.section_advisement != null) {
    const effective = Math.min(section.section_advisement, availableCount(section.receivers, crossCc));
    const done = section.receivers.filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length;
    return done >= effective;
  }

  // No advisement → any one articulated receiver satisfies the section.
  return section.receivers.some((r) => isReceiverCompleted(r, userCourses, crossCc));
};

const isGroupCompleted = (group, userCourses, crossCc = []) => {
  if (!group || !Array.isArray(group.sections)) return false;

  if (group.group_unit_advisement != null) {
    const total = group.sections.reduce(
      (sum, s) => sum + calculateUnitsFromCompletedReceivers(s.receivers, userCourses, crossCc),
      0
    );
    const achievable = group.sections.reduce((sum, s) => sum + availableUnits(s.receivers, crossCc), 0);
    return total >= Math.min(group.group_unit_advisement, achievable);
  }

  const conj = (group.group_conjunction || 'And').toLowerCase();

  if (group.group_advisement != null) {
    if (conj === 'or' && !orSectionsAreBareBuckets(group)) {
      // "Complete N courses from A, B, C, or D" with per-section asks:
      // pick-one-section semantic. Any one alternative path completed
      // (per its own section_advisement / unit_advisement) satisfies the
      // group. group_advisement is the per-path course count, not a
      // multiplier over how many sections must be completed.
      //
      // Reachability filter: a section with zero articulated receivers
      // would vacuously satisfy via isSectionCompleted (its section_
      // advisement caps to 0 against availableCount=0, and 0 >= 0). When
      // alternatives exist, allowing the vacuous path would mark the
      // group complete without the student doing anything — forcing
      // them toward the reachable path is the honest answer. When every
      // section is unreachable at this CC, fall back to true so the
      // student isn't permanently stuck on a major they can't act on.
      const reachable = group.sections.filter((s) => sectionIsReachable(s, crossCc));
      if (reachable.length === 0) return true;
      return reachable.some((s) => isSectionCompleted(s, userCourses, crossCc));
    }
    // D-bucket ("M courses from K of these areas", group_min_distinct_sections):
    // the distinct-area count is the authoritative check. Areas the CC can't
    // articulate are auto-credited (see dBucketQualifyingCount). The raw
    // course-count check below does NOT apply — it would demand the full K×M
    // even when areas are auto-credited, which can force mutually-exclusive
    // areas (e.g. two alternate calculus tracks) no real student takes together.
    if (group.group_min_distinct_sections != null) {
      return dBucketQualifyingCount(group, userCourses, crossCc) >= group.group_min_distinct_sections;
    }
    // OR-bare-buckets falls through to the AND course-counting branch below
    // ("Complete N courses from A, B, or C" → count courses, mix freely).
    // AND group with advisement: sum each section's capped contribution
    // against the group's stated ask. A section_advisement is a CEILING on
    // how many of that section's courses count toward the group total — it
    // does NOT require the user to take any courses from that section, and
    // extra picks beyond the cap don't stack.
    //
    // groupCappedContribution also enforces the C-bucket area cap
    // (group_max_distinct_sections): only the best K areas count, so courses
    // spread across more areas than allowed can't reach the ask, while extra
    // work in a surplus area can't un-complete an already-satisfied group.
    const effective = getEffectiveGroupAsk(group, crossCc);
    const totalContribution = groupCappedContribution(group, userCourses, crossCc);
    return totalContribution >= effective;
  }

  // OR groups (no group_advisement): apply the reachability filter from
  // the per-section-asks branch. A section with no articulated receivers
  // would vacuously satisfy isSectionCompleted (section_advisement caps
  // to 0 against availableCount=0); on a multi-section OR group that's
  // wrong because the student has a real alternative path they're
  // expected to take. If every section is unreachable, fall back to
  // vacuous true so the student isn't stuck with no way forward.
  if (conj === 'or') {
    const reachable = group.sections.filter((s) => sectionIsReachable(s, crossCc));
    if (reachable.length === 0) return true;
    return reachable.some((s) => isSectionCompleted(s, userCourses, crossCc));
  }
  return group.sections.every((s) => isSectionCompleted(s, userCourses, crossCc));
};

const isMajorCompleted = (major, userCourses, crossCc = []) => {
  const required = (major?.requirement_groups || []).filter((g) => g.is_required);
  if (required.length === 0) return false;
  return required.every((g) => isGroupCompleted(g, userCourses, crossCc));
};

const calculateCompletedUnits = (group, userCourses, crossCc = []) => {
  return (group.sections || []).reduce(
    (total, s) => total + calculateUnitsFromCompletedReceivers(s.receivers, userCourses, crossCc),
    0
  );
};

// ---------------------------------------------------------------------------
// Cross-CC equivalency (explicit data flow)
// ---------------------------------------------------------------------------

/**
 * Walks every receiver across every secondary CC's agreements. When the
 * student's secondary-CC courses satisfy a receiver, records a
 * {hash_id, course_ids, community_college_name} entry so the primary-CC
 * agreement view can recognize cross-CC completion via hash_id. Pure: returns
 * the records array (callers thread it back in as the `crossCc` argument).
 *
 * `secondaryColleges` is `{collegeId: [receiver, receiver, ...]}` — the
 * deduped union of all receivers from that CC's agreements.
 */
const computeCrossCcEquivalents = (secondaryColleges, userCourses) => {
  const completed = [];
  const seenHashes = new Set();

  for (const receivers of Object.values(secondaryColleges || {})) {
    for (const receiver of receivers || []) {
      if (!receiver || !receiver.hash_id || seenHashes.has(receiver.hash_id)) continue;
      if (receiver.articulation_status === 'not_articulated') continue;

      // Find the first option fully matched by user's courses.
      let satisfyingOption = null;
      for (const opt of receiver.options || []) {
        if (!isOptionCompleted(opt, userCourses)) continue;
        satisfyingOption = opt;
        break;
      }
      if (!satisfyingOption) continue;

      // Pull the actual user-course records for this option to label the entry.
      const matched = (satisfyingOption.course_ids || [])
        .map((id) => userCourses.find((c) => c.course_id === id))
        .filter(Boolean);
      if (matched.length === 0) continue;

      completed.push({
        hash_id: receiver.hash_id,
        course_ids: matched.map((c) => `${c.prefix} ${c.number}`),
        community_college_name: matched[0].community_college_name
      });
      seenHashes.add(receiver.hash_id);
    }
  }

  return completed.filter((c) => c.course_ids?.length > 0);
};

export {
  isCourseCompleted,
  isOptionCompleted,
  isReceiverCompleted,
  isReceiverAvailable,
  calculateUnitsFromCompletedReceivers,
  availableCount,
  availableUnits,
  sectionMaxContribution,
  sectionContribution,
  sectionIsReachable,
  groupCappedContribution,
  orSectionsAreBareBuckets,
  groupSectionsAreAlternativePool,
  interSectionConjOf,
  allReceiversAreSeries,
  getEffectiveGroupAsk,
  dBucketQualifyingCount,
  isSectionCompleted,
  isGroupCompleted,
  isMajorCompleted,
  calculateCompletedUnits,
  computeCrossCcEquivalents,
};
