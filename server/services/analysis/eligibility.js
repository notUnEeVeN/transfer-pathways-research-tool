/**
 * Faithful vendored port of Plan My Transfer's eligibility engine
 * (server/shared/eligibility/{constants,predicates,rollups}.js). This is the
 * single source of truth for "does a community college satisfy a UC campus's
 * ASSIST-stated requirements", shared in spirit with analysis/pmt_eligibility.py
 * (the two independent ports cross-check each other, and both are locked against
 * PMT's own golden outcomes — see eligibility.test.js).
 *
 * The predicates below are byte-faithful to PMT EXCEPT for one deliberate
 * modification, gated by a `strict` flag that only `isReceiverAvailable`
 * branches on: PMT default-ACCEPTS unmet ASSIST demand (it caps every ask at
 * what articulates locally); under `strict` we count an unarticulated receiver
 * as achievable demand, so the cap becomes the full stated ask and genuine
 * choose-N gaps surface. `isMajorArticulable` is the credit-loss/heatmap entry
 * point. Display-only helpers (ledger text, group display stats) are not ported.
 */

// --- constants.js ----------------------------------------------------------

const gradeToGPA = {
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0, 'D-': 0.7,
  F: 0.0,
};
const meetsCOrBetter = (gpa) => gpa >= 2.0;

// --- predicates.js ---------------------------------------------------------

const courseEarnsCredit = (c) => {
  const grade = c?.course_grade;
  if (!grade || grade === 'PL' || grade === 'IP') return true;
  const gpa = gradeToGPA[grade];
  if (gpa === undefined) return true;
  return meetsCOrBetter(gpa);
};

const isCourseCompleted = (courseId, userCourses) => {
  if (userCourses.some((c) => c.course_id === courseId && courseEarnsCredit(c))) return true;
  return userCourses.some((u) => courseEarnsCredit(u) && u.same_as?.some((peer) => peer.course_id === courseId));
};

const isOptionCompleted = (option, userCourses) => {
  if (!option || !Array.isArray(option.course_ids) || option.course_ids.length === 0) return false;
  const conj = (option.course_conjunction || 'and').toLowerCase();
  if (conj === 'or') return option.course_ids.some((id) => isCourseCompleted(id, userCourses));
  return option.course_ids.every((id) => isCourseCompleted(id, userCourses));
};

const isReceiverCompleted = (receiver, userCourses, crossCc = []) => {
  if (!receiver) return false;
  const options = receiver.options || [];
  if (options.length > 0) {
    const conj = (receiver.options_conjunction || 'and').toLowerCase();
    const results = options.map((opt) => isOptionCompleted(opt, userCourses));
    const direct = conj === 'or' ? results.some(Boolean) : results.every(Boolean);
    if (direct) return true;
  }
  if (receiver.hash_id) {
    return crossCc.some((s) => s.hash_id === receiver.hash_id);
  }
  return false;
};

const isReceiverAvailable = (receiver, crossCc = [], strict = false) => {
  if (!receiver) return false;
  if (receiver.articulation_status !== 'not_articulated') return true;
  // THE ONE DELIBERATE MODIFICATION (see module header): under strict an
  // unarticulated receiver counts as achievable demand, removing PMT's cap.
  if (strict) return true;
  if (!receiver.hash_id) return false;
  return crossCc.some((s) => s.hash_id === receiver.hash_id);
};

const calculateUnitsFromCompletedReceivers = (receivers, userCourses, crossCc = []) => {
  let total = 0;
  for (const receiver of receivers || []) {
    if (!isReceiverCompleted(receiver, userCourses, crossCc)) continue;
    const ucUnits = receiver.receiving?.units;
    if (ucUnits != null) { total += ucUnits; continue; }
    const opt = (receiver.options || []).find((o) => isOptionCompleted(o, userCourses));
    if (!opt) continue;
    for (const courseId of opt.course_ids || []) {
      const userCourse = userCourses.find((c) => c.course_id === courseId);
      if (userCourse) total += userCourse.course_units || 0;
    }
  }
  return total;
};

const availableCount = (receivers, crossCc = [], strict = false) =>
  (receivers || []).filter((r) => isReceiverAvailable(r, crossCc, strict)).length;

const availableUnits = (receivers, crossCc = [], strict = false) =>
  (receivers || []).reduce((sum, r) => (isReceiverAvailable(r, crossCc, strict) ? sum + (r.receiving?.units || 0) : sum), 0);

const sectionMaxContribution = (section, crossCc = [], strict = false) => {
  const reachable = availableCount(section?.receivers, crossCc, strict);
  if (section?.section_advisement != null) return Math.min(section.section_advisement, reachable);
  return reachable;
};

const sectionContribution = (section, userCourses, crossCc = []) => {
  const done = (section?.receivers || []).filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length;
  if (section?.section_advisement != null) return Math.min(done, section.section_advisement);
  return done;
};

const sectionIsReachable = (section, crossCc = [], strict = false) => availableCount(section?.receivers, crossCc, strict) > 0;

const sumTopK = (arr, k) => [...arr].sort((a, b) => b - a).slice(0, k).reduce((n, c) => n + c, 0);

const groupCappedContribution = (group, userCourses, crossCc = []) => {
  const contributions = (group?.sections || []).map((s) => sectionContribution(s, userCourses, crossCc));
  if (group?.group_max_distinct_sections != null) return sumTopK(contributions, group.group_max_distinct_sections);
  return contributions.reduce((n, c) => n + c, 0);
};

const orSectionsAreBareBuckets = (group) =>
  group?.group_advisement != null &&
  (group.group_conjunction || 'And').toLowerCase() === 'or' &&
  (group.sections || []).every((s) => s.section_advisement == null && s.unit_advisement == null);

const getEffectiveGroupAsk = (group, crossCc = [], strict = false) => {
  if (group?.group_advisement == null) return 0;
  const conj = (group.group_conjunction || 'And').toLowerCase();
  if (conj === 'or' && !orSectionsAreBareBuckets(group)) return group.group_advisement;
  const maxima = (group.sections || []).map((s) => sectionMaxContribution(s, crossCc, strict));
  const totalMaxPossible =
    group.group_max_distinct_sections != null
      ? sumTopK(maxima, group.group_max_distinct_sections)
      : maxima.reduce((n, c) => n + c, 0);
  return Math.min(group.group_advisement, totalMaxPossible);
};

const dBucketQualifyingCount = (group, userCourses, crossCc = [], strict = false) => {
  const minPerSection = group?.group_section_min_courses || 1;
  const required = group?.group_min_distinct_sections || 0;
  let reachable = 0;
  let completedReachable = 0;
  for (const s of group?.sections || []) {
    if (availableCount(s.receivers, crossCc, strict) < minPerSection) continue;
    reachable += 1;
    if ((s.receivers || []).filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length >= minPerSection) {
      completedReachable += 1;
    }
  }
  const autoCredit = Math.max(0, required - reachable);
  return Math.min(completedReachable + autoCredit, required);
};

const isSectionCompleted = (section, userCourses, crossCc = [], strict = false) => {
  if (!section || !Array.isArray(section.receivers)) return false;
  if (availableCount(section.receivers, crossCc, strict) === 0) return true;
  if (section.unit_advisement != null) {
    const effective = Math.min(section.unit_advisement, availableUnits(section.receivers, crossCc, strict));
    const total = calculateUnitsFromCompletedReceivers(section.receivers, userCourses, crossCc);
    return total >= effective;
  }
  if (section.section_advisement != null) {
    const effective = Math.min(section.section_advisement, availableCount(section.receivers, crossCc, strict));
    const done = section.receivers.filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length;
    return done >= effective;
  }
  return section.receivers.some((r) => isReceiverCompleted(r, userCourses, crossCc));
};

const isGroupCompleted = (group, userCourses, crossCc = [], strict = false) => {
  if (!group || !Array.isArray(group.sections)) return false;
  if (group.group_unit_advisement != null) {
    const total = group.sections.reduce((sum, s) => sum + calculateUnitsFromCompletedReceivers(s.receivers, userCourses, crossCc), 0);
    const achievable = group.sections.reduce((sum, s) => sum + availableUnits(s.receivers, crossCc, strict), 0);
    return total >= Math.min(group.group_unit_advisement, achievable);
  }
  const conj = (group.group_conjunction || 'And').toLowerCase();
  if (group.group_advisement != null) {
    if (conj === 'or' && !orSectionsAreBareBuckets(group)) {
      const reachable = group.sections.filter((s) => sectionIsReachable(s, crossCc, strict));
      if (reachable.length === 0) return true;
      return reachable.some((s) => isSectionCompleted(s, userCourses, crossCc, strict));
    }
    if (group.group_min_distinct_sections != null) {
      return dBucketQualifyingCount(group, userCourses, crossCc, strict) >= group.group_min_distinct_sections;
    }
    const effective = getEffectiveGroupAsk(group, crossCc, strict);
    const totalContribution = groupCappedContribution(group, userCourses, crossCc);
    return totalContribution >= effective;
  }
  if (conj === 'or') {
    const reachable = group.sections.filter((s) => sectionIsReachable(s, crossCc, strict));
    if (reachable.length === 0) return true;
    return reachable.some((s) => isSectionCompleted(s, userCourses, crossCc, strict));
  }
  return group.sections.every((s) => isSectionCompleted(s, userCourses, crossCc, strict));
};

const isMajorCompleted = (major, userCourses, crossCc = [], strict = false) => {
  const required = (major?.requirement_groups || []).filter((g) => g.is_required);
  if (required.length === 0) return false;
  return required.every((g) => isGroupCompleted(g, userCourses, crossCc, strict));
};

const calculateCompletedUnits = (group, userCourses, crossCc = []) =>
  (group.sections || []).reduce((total, s) => total + calculateUnitsFromCompletedReceivers(s.receivers, userCourses, crossCc), 0);

// --- rollups.js ------------------------------------------------------------

const sectionEffectiveAsk = (section, crossCc = [], strict = false) => {
  const articulated = availableCount(section.receivers, crossCc, strict);
  if (section.section_advisement != null) return Math.min(section.section_advisement, articulated);
  if (section.unit_advisement != null) return Math.min(section.unit_advisement, availableUnits(section.receivers, crossCc, strict));
  return Math.min(1, articulated);
};

const sectionDoneCount = (section, userCourses, ask, crossCc = []) => {
  if (section.unit_advisement != null) {
    return Math.min(calculateUnitsFromCompletedReceivers(section.receivers, userCourses, crossCc), ask);
  }
  const done = (section.receivers || []).filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length;
  return Math.min(done, ask);
};

const calculateMajorCompletionPercentage = (major, userCourses, crossCc = [], strict = false) => {
  const required = (major?.requirement_groups || []).filter((g) => g.is_required);
  if (required.length === 0) return 0;
  let totalAsk = 0;
  let totalDone = 0;
  for (const group of required) {
    let groupAsk = 0;
    let groupDone = 0;
    if (group.group_advisement != null) {
      const groupConj = (group.group_conjunction || 'And').toLowerCase();
      if (groupConj === 'or' && !orSectionsAreBareBuckets(group)) {
        const reachable = (group.sections || []).filter((s) => sectionIsReachable(s, crossCc, strict));
        let bestAsk = Infinity;
        let bestDone = 0;
        for (const s of reachable) {
          const ask = sectionEffectiveAsk(s, crossCc, strict);
          const done = sectionDoneCount(s, userCourses, ask, crossCc);
          if (done >= ask) { bestAsk = ask; bestDone = ask; break; }
          if (ask < bestAsk) { bestAsk = ask; bestDone = done; }
        }
        groupAsk = bestAsk === Infinity ? 0 : bestAsk;
        groupDone = bestDone;
      } else if (group.group_min_distinct_sections != null) {
        groupAsk = group.group_min_distinct_sections;
        groupDone = Math.min(dBucketQualifyingCount(group, userCourses, crossCc, strict), groupAsk);
      } else {
        groupAsk = getEffectiveGroupAsk(group, crossCc, strict);
        const totalContribution = groupCappedContribution(group, userCourses, crossCc);
        groupDone = Math.min(totalContribution, groupAsk);
      }
    } else if (group.group_unit_advisement != null) {
      const achievable = (group.sections || []).reduce((sum, s) => sum + availableUnits(s.receivers, crossCc, strict), 0);
      groupAsk = Math.min(group.group_unit_advisement, achievable);
      groupDone = Math.min(calculateCompletedUnits(group, userCourses, crossCc), groupAsk);
    } else if ((group.group_conjunction || 'And').toLowerCase() === 'or') {
      const reachable = (group.sections || []).filter((s) => sectionIsReachable(s, crossCc, strict));
      let bestAsk = Infinity;
      let bestDone = 0;
      for (const s of reachable) {
        const ask = sectionEffectiveAsk(s, crossCc, strict);
        const done = sectionDoneCount(s, userCourses, ask, crossCc);
        if (done >= ask) { bestAsk = ask; bestDone = ask; break; }
        if (ask < bestAsk) { bestAsk = ask; bestDone = done; }
      }
      groupAsk = bestAsk === Infinity ? 0 : bestAsk;
      groupDone = bestDone;
    } else {
      for (const s of group.sections || []) {
        const ask = sectionEffectiveAsk(s, crossCc, strict);
        groupAsk += ask;
        groupDone += sectionDoneCount(s, userCourses, ask, crossCc);
      }
    }
    totalAsk += groupAsk;
    totalDone += groupDone;
  }
  if (totalAsk === 0) return 0;
  return Math.min((totalDone / totalAsk) * 100, 100);
};

// --- articulability adapter (the heatmap / credit-loss entry point) ---------

/**
 * Synthetic "took everything that articulates" transcript: every course id in
 * any articulation option, graded A. Makes every articulated receiver
 * "completed" while unarticulated receivers (no options) stay unmet.
 */
const allArticulatingCourses = (major) => {
  const seen = new Set();
  const courses = [];
  for (const group of major?.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        if (receiver.articulation_status !== 'articulated') continue;
        for (const opt of receiver.options || []) {
          for (const cid of opt.course_ids || []) {
            if (seen.has(cid)) continue;
            seen.add(cid);
            courses.push({ course_id: cid, course_grade: 'A', course_units: 3, same_as: [] });
          }
        }
      }
    }
  }
  return courses;
};

/**
 * Does this college fully satisfy the campus's ASSIST-stated minimums? strict
 * defaults true (shipped behavior): unmet stated demand is a gap. strict=false
 * reproduces PMT's default-ACCEPT.
 */
const isMajorArticulable = (major, strict = true) =>
  isMajorCompleted(major, allArticulatingCourses(major), [], strict);

module.exports = {
  gradeToGPA,
  meetsCOrBetter,
  courseEarnsCredit,
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
  getEffectiveGroupAsk,
  dBucketQualifyingCount,
  isSectionCompleted,
  isGroupCompleted,
  isMajorCompleted,
  calculateCompletedUnits,
  calculateMajorCompletionPercentage,
  allArticulatingCourses,
  isMajorArticulable,
};
