/**
 * Pure text/status rules for the requirements ledger — extracted verbatim from
 * RequirementsLedger.jsx so the fidelity golden harness can lock the exact
 * strings and status objects users (and the auditor) see without rendering
 * React. The ledger imports everything back from here; behavior is identical.
 *
 * These functions are part of the locked L3 display surface (see
 * docs/superpowers/specs/2026-06-10-fidelity-regression-safety-design.md).
 * Changing any output string or status shape will fail the golden test in
 * src/test/fidelity/ — regenerate goldens consciously via `just goldens-regen`.
 */
import {
  isReceiverCompleted,
  isReceiverAvailable,
  isSectionCompleted,
  isGroupCompleted,
  sectionContribution,
  sectionMaxContribution,
  calculateUnitsFromCompletedReceivers
} from '../../lib/eligibility'

// The actual reason a requirement has no community-college course, shown on the
// row itself (mirrors what assist.org states per course).
export const NOT_ARTICULATED_REASON = {
  must_take_at_university: 'Must be taken at the university after transfer',
  never_articulated: 'Never articulated — take at the university',
  no_course_articulated: 'No course articulates — you can transfer without it'
}

// Footnote on a section where nothing articulates at a community college.
export const NO_CC_NOTE = 'Requirements with no community-college equivalent are completed at the university.'

// Row copy for a receiver with no usable CC path. `notArt` is the caller's
// `articulation_status === 'not_articulated'`; rows that merely lack options
// fall back to the no-course-articulated phrasing, and unknown reason codes
// fall back to the generic line.
export function notArticulatedCopy(receiver, notArt) {
  return (
    NOT_ARTICULATED_REASON[notArt ? receiver.not_articulated_reason : 'no_course_articulated'] ||
    'Take at the university'
  )
}

export function unitText(min, max) {
  if (min == null) return null
  return min === max ? `${min}u` : `${min}–${max}u`
}

// How many of this section's receivers you must complete. "Complete N of:" when
// it's a choice; plain "Complete:" when you need them all (covers the single-
// course case too — same phrasing either way).
export function sectionRule(section, group, receivers, soleStat, pooled) {
  if (section.unit_advisement) return `Complete ${section.unit_advisement} units of:`

  // A GE category receiver is one placeholder for many catalog courses. Its
  // section_advisement is the real number of courses required, even though the
  // renderer intentionally receives only one category row.
  const category = receivers.length === 1 ? receivers[0]?.category_match : null
  if (category) {
    const count = category.required_count ?? section.section_advisement ?? 1
    return `Complete ${count} ${count === 1 ? 'course' : 'courses'} from:`
  }

  // The "choose N" count when this section is itself a choice; null = take all.
  let choice = null
  if (section.section_advisement != null) {
    if (section.section_advisement < receivers.length) choice = section.section_advisement
  } else if (
    group.group_min_distinct_sections != null &&
    group.group_section_min_courses != null &&
    group.group_section_min_courses < receivers.length
  ) {
    choice = group.group_section_min_courses
  } else if (soleStat) {
    // Single-section group whose "complete N" lives at the group level. Use the
    // original ask — `total` is reachability-capped and collapses to 0 when
    // every receiver is non-articulated, which would read as "Complete 0 of:".
    const ask = soleStat.originalTotal != null ? soleStat.originalTotal : soleStat.total
    if (/unit/.test(soleStat.label)) return `Complete ${ask} units of:`
    if (ask < receivers.length) choice = ask
  }

  // Under a group-level pooled advisement ("Complete N courses across the
  // sections below") the sections are buckets: a plain list needs no
  // instruction, and a choice reads as "Select N of:" rather than "Complete".
  if (pooled) return choice != null ? `Select ${choice} of:` : ''
  return choice != null ? `Complete ${choice} of:` : 'Complete all of:'
}

// Status: 'done' (you completed it), 'none' (nothing actionable at a CC — show
// no pill; the per-row reasons explain it), 'pool' (a bare bucket inside a
// pooled group — no per-section target, so no pill of its own), or a
// 'progress' done/total ratio.
export function sectionStatus(section, group, userCourses, crossCc, soleStat, pooled) {
  const receivers = section.receivers || []
  const articulated = receivers.filter((r) => isReceiverAvailable(r, crossCc)).length
  const completedReceivers = receivers.filter((r) => isReceiverCompleted(r, userCourses, crossCc)).length
  const complete = isSectionCompleted(section, userCourses, crossCc)

  // Nothing here can be satisfied at a community college — don't show a
  // misleading "0 / N" CC progress, and don't label it; the per-row reasons
  // (must-take-at-university / no-course-articulated) speak for themselves.
  if (articulated === 0 && completedReceivers === 0) return { kind: 'none' }

  // Bare bucket inside a pooled group ("Complete N courses across the sections
  // below"): the bucket has no own advisement, so it has no independent
  // completion target — its courses just feed the group pool. Don't mark it
  // "Done" or show a "0 / N" ratio off a single course (the "any one
  // satisfies" rule for unadvised sections is wrong in a pool). Completed
  // course rows still render green individually; the group rule and the
  // group's completion carry the real progress. When the whole group is
  // satisfied, SectionCard promotes this to 'done'.
  if (pooled && section.section_advisement == null && section.unit_advisement == null) {
    return { kind: 'pool' }
  }

  // Single-section group whose "complete N" lives at the GROUP level (the lone
  // section carries no advisement of its own). isSectionCompleted falls back to
  // "any one articulated receiver satisfies it", which would flip the card to
  // Done off a single course while the group still needs N units/courses. Defer
  // to the group's authoritative stat so the section can't outrun the group.
  if (soleStat && section.section_advisement == null && section.unit_advisement == null) {
    if (soleStat.done >= soleStat.total) return { kind: 'done' }
    return {
      kind: 'progress',
      done: soleStat.done,
      total: soleStat.total,
      unit: /unit/.test(soleStat.label) ? 'u' : ''
    }
  }

  if (complete) return { kind: 'done' }

  // Single-section group: progress comes from the group's authoritative stat
  // (which resolves a group-level "complete N").
  if (soleStat) {
    return {
      kind: 'progress',
      done: soleStat.done,
      total: soleStat.total,
      unit: /unit/.test(soleStat.label) ? 'u' : ''
    }
  }

  if (section.unit_advisement) {
    return {
      kind: 'progress',
      done: calculateUnitsFromCompletedReceivers(receivers, userCourses, crossCc),
      total: section.unit_advisement,
      unit: 'u'
    }
  }
  if (section.section_advisement != null) {
    const ask =
      section.section_advisement >= receivers.length
        ? receivers.length
        : Math.min(section.section_advisement, articulated || receivers.length)
    return { kind: 'progress', done: Math.min(completedReceivers, ask), total: ask }
  }
  if (group.group_min_distinct_sections != null && group.group_section_min_courses != null) {
    return { kind: 'progress', done: completedReceivers, total: group.group_section_min_courses }
  }
  return { kind: 'progress', done: completedReceivers, total: receivers.length }
}

// Group-level rule across its sections — the single source of how sections
// combine (replacing per-card AND/OR connectors that could contradict it).
//
// Shown only when there's a genuine choice. Needing every section says nothing
// (the stacked sections already imply it), and slack that's merely auto-
// satisfied (non-articulated) sections is left to their per-section note.
export function groupRule(group, stat, sectionCount, notNeededCount) {
  if (sectionCount <= 1) return null
  // D-bucket distribution: state the section count ("Complete 3 of these 4
  // sections"); each section card already shows its own per-area advisement.
  // Always shown — the generic suppression below would wrongly hide it when an
  // area is unarticulated.
  if (group.group_min_distinct_sections != null) {
    const n = group.group_min_distinct_sections
    return `Complete ${n} of these ${sectionCount} sections.`
  }
  // C-bucket area cap: "Complete N courses from at most K of these M
  // sections." Only the best K areas count toward completion (enforced by
  // groupCappedContribution / isGroupCompleted), so the student must know
  // not to spread the N courses across more than K sections.
  if (group.group_max_distinct_sections != null) {
    const k = group.group_max_distinct_sections
    const n = stat.originalTotal != null ? stat.originalTotal : stat.total
    const noun = /series/.test(stat.label) ? 'series' : n === 1 ? 'course' : 'courses'
    return `Complete ${n} ${noun} from at most ${k} of these ${sectionCount} sections.`
  }
  // Use the original ASSIST ask, not `total` — `total` is reachability-capped
  // (it drops to 0 when nothing in the sections articulates, which is right for
  // eligibility but wrong for an advisement meant to mirror ASSIST).
  const ask = stat.originalTotal != null ? stat.originalTotal : stat.total
  if (stat.label === 'section' || stat.label === 'sections') {
    const slack = sectionCount - ask
    if (slack <= 0 || slack <= notNeededCount) return null
    return `Complete ${ask} of these ${sectionCount} sections.`
  }
  if (/unit/.test(stat.label)) return `Complete ${ask} ${ask === 1 ? 'unit' : 'units'} across the sections below.`
  const noun = /series/.test(stat.label) ? 'series' : ask === 1 ? 'course' : 'courses'
  return `Complete ${ask} ${noun} across the sections below.`
}

export function sectionHidden(section, group, showMissing, userCourses, crossCc) {
  if (!showMissing) return false
  const hasGroupAdvisement = group.group_advisement != null
  const conj = (group.group_conjunction || 'And').toLowerCase()
  if (hasGroupAdvisement) {
    if (isGroupCompleted(group, userCourses, crossCc)) return true
    if (conj === 'or') return isSectionCompleted(section, userCourses, crossCc)
    return sectionContribution(section, userCourses, crossCc) >= sectionMaxContribution(section, crossCc)
  }
  if (group.group_unit_advisement != null) return isGroupCompleted(group, userCourses, crossCc)
  return isSectionCompleted(section, userCourses, crossCc)
}
