/**
 * Maryland agreement -> the shape `RequirementsLedger` reads.
 *
 * The console already has one ASSIST-style requirements renderer, shared by the
 * major modal and the audit console. Maryland uses it rather than a second
 * bespoke layout so a reader comparing the two states is looking at the same
 * two-column, AND/OR-bracketed presentation and can trust that a visual
 * difference means a data difference.
 *
 * The stored Maryland document is deliberately NOT reshaped to suit the
 * renderer: it stays in the form the eligibility engine consumes, and the
 * display translation happens here. Two small differences need bridging.
 *
 *   receiving.parent_id  the ledger resolves receiving courses through
 *                        `universityCoursesById[parent_id]`. Maryland stores
 *                        the canonical id on `receiving.course_id`, so it is
 *                        copied across and the lookup is keyed by the same
 *                        string.
 *   receiving.kind       the ledger understands 'course' | 'series' |
 *                        'ge_area', and falls through to a generic
 *                        "Requirement" row for anything else, reading
 *                        `receiving.name`. Maryland's category slots
 *                        ("Science Elective", "ANCS Ancient Studies") are
 *                        exactly that case, so they keep a non-course kind and
 *                        gain a `name`.
 */

/** Split `md:crs:...` course docs into the two lookups the ledger wants. */
export function courseLookups(courses = []) {
  const sending = []
  const universityCoursesById = {}
  for (const c of courses) {
    if (c.side === 'receiving') {
      universityCoursesById[c._id] = {
        prefix: c.prefix ?? '',
        number: c.number ?? '',
        title: c.title ?? null,
        min_units: c.min_units ?? c.units ?? null,
        max_units: c.max_units ?? c.units ?? null,
      }
    } else {
      // The ledger matches sending courses on `course_id`.
      sending.push({
        course_id: c._id,
        prefix: c.prefix ?? '',
        number: c.number ?? '',
        title: c.title ?? null,
        units: c.units ?? null,
      })
    }
  }
  return { sending, universityCoursesById }
}

/**
 * Above this many satisfying courses a requirement is a catalog subset, not a
 * short choice list, and printing every code buries the rest of the tree.
 * Maryland's breadth slots routinely carry 20-45 (one Montgomery humanities
 * requirement lists 45), so those collapse to a count via the ledger's existing
 * `category_match` affordance.
 */
export const COLLAPSE_ABOVE = 8

/** Total courses named across a receiver's options. */
function optionCourseCount(receiver) {
  return (receiver.options || []).reduce((n, o) => n + (o.course_ids || []).length, 0)
}

/**
 * @param {object} agreement an /md/agreements/:id response
 * @param {{ onlyGaps?: boolean, collapseAbove?: number }} [opts]
 *   `onlyGaps` drops every receiver that already has an equivalent, and any
 *   section or group left empty. `collapseAbove` sets the count past which a
 *   long option list becomes a summary row — pass Infinity to print every code.
 * @returns {object|null} a `major`-shaped object for RequirementsLedger
 */
export function toLedgerMajor(agreement, {
  onlyGaps = false, collapseAbove = COLLAPSE_ABOVE,
} = {}) {
  if (!agreement || !Array.isArray(agreement.requirement_groups)) return null

  const groups = agreement.requirement_groups.map((group) => {
    const sections = (group.sections || []).map((section) => {
      const receivers = (section.receivers || [])
        .filter((r) => !onlyGaps || r.articulation_status === 'not_articulated')
        .map((r) => {
          const recv = r.receiving || {}
          const isCourse = recv.kind === 'course' && recv.course_id
          const count = optionCourseCount(r)
          // Never collapse a gap row: "no equivalency found" is the whole
          // point of the view and has no list to shorten anyway.
          const collapse = count > collapseAbove && r.articulation_status !== 'not_articulated'
          return {
            ...r,
            // A collapsed receiver keeps its options (the engine and the count
            // still read them) and additionally carries category_match, which
            // the ledger prefers — so the row prints "N qualifying courses"
            // instead of N course codes.
            ...(collapse
              ? { category_match: { qualifying_count: count, caption: 'Qualifying courses at this college' } }
              : {}),
            collapsed_count: collapse ? count : null,
            receiving: isCourse
              ? { ...recv, kind: 'course', parent_id: recv.course_id }
              // Non-course slots render through the ledger's generic
              // "Requirement" row, which reads `name`.
              : { ...recv, kind: 'requirement', name: recv.title || recv.label || 'Requirement' },
          }
        })
      return { ...section, receivers }
    }).filter((s) => s.receivers.length)

    return { ...group, sections }
  }).filter((g) => g.sections.length)

  return { ...agreement, requirement_groups: groups }
}
