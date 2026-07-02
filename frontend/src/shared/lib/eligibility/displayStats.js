import {
  isReceiverCompleted,
  isSectionCompleted,
  calculateUnitsFromCompletedReceivers,
  getEffectiveGroupAsk,
  orSectionsAreBareBuckets,
  sectionIsReachable,
  sectionContribution,
  groupCappedContribution,
  allReceiversAreSeries,
  availableCount,
  availableUnits,
  dBucketQualifyingCount
} from './predicates'

/**
 * Unified group-level display stat that stays in sync with isGroupCompleted.
 * Returns { done, total, originalTotal, kind, label } describing the primary
 * "where am I in this group" progress.
 *
 *   group_unit_advisement   → units
 *   group_advisement (OR)   → sections fully satisfied vs. effective ask
 *   group_advisement (AND)  → floor + free model (same as percentage calc)
 *   single section with own advisement → promoted up
 *   multiple sections with own advisements but no group ask
 *                            → synthesized sum of per-section asks
 *   fallback                → sections completed count
 *
 * `crossCc` (default []) is the cross-CC equivalency record set, threaded
 * through to the completion predicates.
 */
export const getGroupDisplayStat = (group, userCourses, crossCc = []) => {
  const sections = group?.sections || []

  if (group?.group_unit_advisement != null) {
    const done = sections.reduce((n, s) => n + calculateUnitsFromCompletedReceivers(s.receivers, userCourses, crossCc), 0)
    // Cap to the units the CC can actually articulate, mirroring
    // isGroupCompleted and the percentage roll-up — otherwise a complete group
    // shows e.g. "4 / 12" when only 4 of the 12 asked units articulate here.
    const achievable = sections.reduce((n, s) => n + availableUnits(s.receivers, crossCc), 0)
    const effective = Math.min(group.group_unit_advisement, achievable)
    return {
      done: Math.min(done, effective),
      total: effective,
      originalTotal: group.group_unit_advisement,
      label: 'units'
    }
  }

  if (group?.group_advisement != null) {
    const conj = (group.group_conjunction || 'And').toLowerCase()
    const effective = getEffectiveGroupAsk(group, crossCc)
    // D-bucket (Anthro): "pick K of N sections, ≥M from each." The parser
    // encodes this as group_advisement=K*M + group_min_distinct_sections=K
    // + group_section_min_courses=M. The "K sections" framing reads more
    // naturally than "K*M courses with constraints" — the user picks
    // sections, not raw course counts. Eligibility math is unchanged
    // (isGroupCompleted still enforces both K and M).
    if (group.group_min_distinct_sections != null) {
      const target = group.group_min_distinct_sections
      // Use the same credited-area count as isGroupCompleted / the rollup
      // (auto-credits unreachable areas, only filling a genuine shortfall) so
      // the chip can't disagree with the boolean and the percentage.
      return {
        done: dBucketQualifyingCount(group, userCourses, crossCc),
        total: target,
        originalTotal: target,
        label: target === 1 ? 'section' : 'sections'
      }
    }
    if (conj === 'or' && !orSectionsAreBareBuckets(group)) {
      // OR + group_advisement with per-section asks ("Complete N courses
      // from A, B, C, or D" where each section spells out its own ask).
      // Pick-one-section semantic: the student is on a single alternative
      // path, so show progress on whichever section is furthest along.
      // Total = group_advisement (the per-path course count). Mirrors the
      // best-section-wins logic in calculateMajorCompletionPercentage so
      // the percentage and the boolean and the header all agree.
      //
      // Reachability filter matches isGroupCompleted: unreachable sections
      // are excluded so the chip doesn't claim "0 / 2 courses" against an
      // alternative path the student couldn't take. If every section is
      // unreachable, the group is vacuously satisfied — suppress the chip
      // by returning total=0.
      const reachable = sections.filter((s) => sectionIsReachable(s, crossCc))
      if (reachable.length === 0) {
        return { done: 0, total: 0, originalTotal: group.group_advisement, label: 'courses' }
      }
      const bestProgress = reachable.reduce((best, s) => Math.max(best, sectionContribution(s, userCourses, crossCc)), 0)
      const seriesUnit = allReceiversAreSeries(group)
      return {
        done: Math.min(bestProgress, group.group_advisement),
        total: group.group_advisement,
        originalTotal: group.group_advisement,
        label: seriesUnit ? 'series' : group.group_advisement === 1 ? 'course' : 'courses'
      }
    }
    // AND, or OR-bare-buckets: course-counting via capped per-section
    // contributions. Matches isGroupCompleted exactly so the displayed
    // numerator can't outrun what really counts (including the C-bucket area
    // cap, where only the best K areas count). When every receiver in the
    // group is kind='series' the count is in series (each receiver IS a
    // series); otherwise it's in courses.
    const totalContribution = groupCappedContribution(group, userCourses, crossCc)
    const seriesUnit = allReceiversAreSeries(group)
    return {
      done: Math.min(totalContribution, effective),
      total: effective,
      originalTotal: group.group_advisement,
      label: seriesUnit ? 'series' : effective === 1 ? 'course' : 'courses'
    }
  }

  // No group_advisement / group_unit_advisement.
  //
  // Single-section group: promote the section's own ask to the group header
  // — the group IS the section, so the natural unit is whatever the section
  // counts (courses or units).
  if (sections.length === 1) {
    const only = sections[0]
    if (only.section_advisement != null) {
      const articulated = availableCount(only.receivers, crossCc)
      const effective = Math.min(only.section_advisement, articulated)
      const done = Math.min(
        (only.receivers || []).filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length,
        effective
      )
      const seriesUnit = (only.receivers || []).every((r) => r.receiving?.kind === 'series')
      return {
        done,
        total: effective,
        originalTotal: only.section_advisement,
        label: seriesUnit && (only.receivers || []).length > 0 ? 'series' : effective === 1 ? 'course' : 'courses'
      }
    }
    if (only.unit_advisement != null) {
      const done = calculateUnitsFromCompletedReceivers(only.receivers, userCourses, crossCc)
      // Cap to achievable units, matching isSectionCompleted (which caps the
      // unit ask to availableUnits) so a complete section reads as done.
      const effective = Math.min(only.unit_advisement, availableUnits(only.receivers, crossCc))
      return {
        done: Math.min(done, effective),
        total: effective,
        originalTotal: only.unit_advisement,
        label: only.unit_advisement === 1 ? 'unit' : 'units'
      }
    }
    // Single section with no ask — fall through to the multi-section path,
    // which will read it as "1 section, X completed".
  }

  // Multi-section group with no group-level ask. The principle we apply
  // here: section advisements describe section requirements, not group
  // requirements. The group header reports the group's native unit —
  // SECTIONS — and the per-section asks render on each section card below.
  //
  //   OR conj  → need any 1 section
  //   AND conj → need every section
  //
  // Counting completions via isSectionCompleted means the math mirrors
  // isGroupCompleted exactly (some-for-OR, every-for-AND). OR uses the
  // reachable subset only — see the reachability rationale in
  // isGroupCompleted's OR + per-section-asks branch (a section with no
  // articulated receivers would vacuously satisfy and falsely complete
  // the group, so we force the student toward a reachable alternative).
  const conj = (group.group_conjunction || 'And').toLowerCase()
  const reachableSections = sections.filter((s) => sectionIsReachable(s, crossCc))
  if (conj === 'or') {
    const reachableCompleted = reachableSections.reduce(
      (n, s) => n + (isSectionCompleted(s, userCourses, crossCc) ? 1 : 0),
      0
    )
    return {
      done: Math.min(reachableCompleted, 1),
      total: Math.min(1, reachableSections.length),
      originalTotal: 1,
      label: 'section'
    }
  }
  // AND: numerator is completed sections among the REACHABLE subset.
  // Counting over the full sections list would include unreachable
  // sections that vacuously satisfy isSectionCompleted (section_advisement
  // caps to 0 against availableCount=0 → 0 ≥ 0 → true). For a major like
  // UCSD Literatures in English at a CC where only 3 of 13 sections
  // articulate, the user shouldn't see "10 / 3 sections complete" before
  // taking anything — they should see "0 / 3" + "10 not reached."
  const completedCount = reachableSections.reduce((n, s) => n + (isSectionCompleted(s, userCourses, crossCc) ? 1 : 0), 0)
  return {
    done: completedCount,
    total: reachableSections.length,
    originalTotal: sections.length,
    label: reachableSections.length === 1 ? 'section' : 'sections'
  }
}
