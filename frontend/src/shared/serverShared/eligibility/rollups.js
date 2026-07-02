import {
  orSectionsAreBareBuckets,
  sectionIsReachable,
  groupCappedContribution,
  getEffectiveGroupAsk,
  calculateCompletedUnits,
  calculateUnitsFromCompletedReceivers,
  isReceiverCompleted,
  availableCount,
  availableUnits,
  dBucketQualifyingCount
} from './predicates.js';

const sectionEffectiveAsk = (section, crossCc = []) => {
  const articulated = availableCount(section.receivers, crossCc);
  if (section.section_advisement != null) return Math.min(section.section_advisement, articulated);
  // Unit-based section: weigh by the real unit ask (capped at achievable
  // units), measured against completed units in sectionDoneCount. Mirrors
  // isSectionCompleted so the section reads as satisfied (done == ask) on the
  // percentage exactly when the boolean says it is — an earlier units/4
  // approximation counting receivers could disagree for non-4-unit courses.
  if (section.unit_advisement != null) return Math.min(section.unit_advisement, availableUnits(section.receivers, crossCc));
  // "any one block" → effective ask is 1.
  return Math.min(1, articulated);
};

const sectionDoneCount = (section, userCourses, ask, crossCc = []) => {
  if (section.unit_advisement != null) {
    return Math.min(calculateUnitsFromCompletedReceivers(section.receivers, userCourses, crossCc), ask);
  }
  const done = (section.receivers || []).filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length;
  return Math.min(done, ask);
};

/**
 * Major completion %, weighted by effective advisements (capped at articulated count).
 *
 * `crossCc` (default []) is the cross-CC equivalency record set, threaded
 * through to the completion predicates.
 */
const calculateMajorCompletionPercentage = (major, userCourses, crossCc = []) => {
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
        // OR + group_advisement with per-section asks: pick-one-section
        // semantic — the student is on a single alternative path. Pick
        // the section with the smallest effective ask that's furthest
        // along (cheapest path with the most progress). Matches
        // isGroupCompleted (any one section satisfied → group complete).
        //
        // Skip unreachable sections — they'd report ask=0 (section_
        // advisement capped against zero available receivers), making
        // them "satisfied without effort" and falsely dominating the
        // "smallest ask" pick. The student should be guided toward a
        // reachable path. Falls back to all-unreachable = 0/0 (group
        // ignored in the rollup), matching the vacuous behavior in
        // isGroupCompleted.
        const reachable = (group.sections || []).filter((s) => sectionIsReachable(s, crossCc));
        let bestAsk = Infinity;
        let bestDone = 0;
        for (const s of reachable) {
          const ask = sectionEffectiveAsk(s, crossCc);
          const done = sectionDoneCount(s, userCourses, ask, crossCc);
          if (done >= ask) {
            bestAsk = ask;
            bestDone = ask;
            break;
          }
          if (ask < bestAsk) {
            bestAsk = ask;
            bestDone = done;
          }
        }
        groupAsk = bestAsk === Infinity ? 0 : bestAsk;
        groupDone = bestDone;
      } else {
        if (group.group_min_distinct_sections != null) {
          // D-bucket: weigh by distinct areas (auto-crediting unarticulated
          // areas), mirroring isGroupCompleted so % and boolean stay aligned.
          groupAsk = group.group_min_distinct_sections;
          groupDone = Math.min(dBucketQualifyingCount(group, userCourses, crossCc), groupAsk);
        } else {
          // AND + group_advisement: sum capped section contributions, clamp
          // to effective ask. Mirrors isGroupCompleted exactly so percentage
          // and boolean stay aligned — groupCappedContribution also enforces
          // the C-bucket area cap (only the best K areas count).
          groupAsk = getEffectiveGroupAsk(group, crossCc);
          const totalContribution = groupCappedContribution(group, userCourses, crossCc);
          groupDone = Math.min(totalContribution, groupAsk);
        }
      }
    } else if (group.group_unit_advisement != null) {
      // Unit-based group: treat each unit as one "ask" point, capped at the
      // units the CC can actually articulate (mirrors isGroupCompleted).
      const achievable = (group.sections || []).reduce((sum, s) => sum + availableUnits(s.receivers, crossCc), 0);
      groupAsk = Math.min(group.group_unit_advisement, achievable);
      groupDone = Math.min(calculateCompletedUnits(group, userCourses, crossCc), groupAsk);
    } else if ((group.group_conjunction || 'And').toLowerCase() === 'or') {
      // OR-group (no group_advisement): best section wins. Same
      // reachability filter as the per-section-asks branch — unreachable
      // sections report ask=0 and would dominate the "smallest ask" pick.
      const reachable = (group.sections || []).filter((s) => sectionIsReachable(s, crossCc));
      let bestAsk = Infinity;
      let bestDone = 0;
      for (const s of reachable) {
        const ask = sectionEffectiveAsk(s, crossCc);
        const done = sectionDoneCount(s, userCourses, ask, crossCc);
        if (done >= ask) {
          // section fully satisfied — definitive
          bestAsk = ask;
          bestDone = ask;
          break;
        }
        if (ask < bestAsk) {
          bestAsk = ask;
          bestDone = done;
        }
      }
      groupAsk = bestAsk === Infinity ? 0 : bestAsk;
      groupDone = bestDone;
    } else {
      // AND-group (default): sum sections, each capped at its effective ask.
      for (const s of group.sections || []) {
        const ask = sectionEffectiveAsk(s, crossCc);
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

export { calculateMajorCompletionPercentage };
