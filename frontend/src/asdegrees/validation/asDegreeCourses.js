/**
 * Flatten an AS-degree document to one course list per requirement group, and
 * write edits back into the stored nested shape.
 *
 * Storage mirrors the agreement skeleton — groups → sections → receivers →
 * options → course_ids — because the pathway engines evaluate these documents
 * directly. A person checking a scraped degree against a catalog page does not
 * think in those terms; they think "this group requires these courses". This
 * module is the whole translation, so the UI never has to mention a section, a
 * receiver, or an option.
 */

/** Every course id named anywhere under one group, de-duplicated, in order. */
export function groupCourseIds(group) {
  const seen = new Set()
  const ids = []
  for (const section of group?.sections || []) {
    for (const receiver of section?.receivers || []) {
      for (const option of receiver?.options || []) {
        for (const id of option?.course_ids || []) {
          const n = Number(id)
          if (!Number.isFinite(n) || seen.has(n)) continue
          seen.add(n)
          ids.push(n)
        }
      }
    }
  }
  return ids
}

/** `${prefix} ${number}` with the title, for display and search. */
export function courseLabel(course) {
  if (!course) return null
  const code = [course.prefix, course.number].filter(Boolean).join(' ').trim()
  return [code, course.title].filter(Boolean).join(' — ') || String(course.course_id ?? '')
}

/**
 * Replace a group's courses.
 *
 * The group keeps ONE section holding ONE receiver whose options are the
 * courses, which is the shape almost every scraped group already has. A group
 * whose nesting encodes something richer (a genuine choose-N) is left alone by
 * the caller — the AI-assist path rewrites those, so this never silently
 * flattens meaning it cannot represent.
 */
export function setGroupCourses(group, courseIds) {
  const ids = [...new Set(courseIds.map(Number).filter(Number.isFinite))]
  const section = group?.sections?.[0] || {}
  const receiver = section?.receivers?.[0] || {}
  return {
    ...group,
    // A human touched it, so it is no longer machine-extracted.
    source: 'curated',
    confidence: null,
    sections: [{
      ...section,
      receivers: [{
        ...receiver,
        options: ids.map((id) => ({ course_ids: [id] })),
        options_conjunction: 'or',
      }],
    }],
  }
}

/**
 * True when a group's nesting says more than a flat course list can — several
 * receivers, or an option naming multiple courses (a real "A and B" pairing).
 * Those are shown read-only with a note pointing at the assist box.
 */
export function isComplexGroup(group) {
  const sections = group?.sections || []
  if (sections.length > 1) return true
  const receivers = sections[0]?.receivers || []
  if (receivers.length > 1) return true
  return (receivers[0]?.options || []).some((o) => (o?.course_ids || []).length > 1)
}
