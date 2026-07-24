/**
 * California Figure 5 for a major with no paper baseline.
 *
 * Computer Science reproduces the published figure from hand-curated transfer
 * minimums, whose requirement groups carry the paper's own category ids. New
 * majors are ASSIST-driven end to end and have no such minimums, so their
 * version reads each college's exact stored ASSIST required groups. A district
 * misses a category when it cannot satisfy an unavoidable ASSIST group in that
 * category; cross-category alternatives are not mislabeled as independent
 * requirements. No modal tree, campus allowlist, or curation exclusion changes
 * the input. A campus that requires nothing in a category produces the source
 * figure's gray "not required" bar.
 *
 * Reads `assist_requirements_by_course_category`, whose verdicts are computed
 * with the same choose-N eligibility engine as the district coverage figures.
 * Each panel isolates its category, so a missing course in another discipline
 * cannot make this bar fail.
 */

/**
 * Panel colors, in panel order. The source figure uses six unrelated hues as
 * per-panel identifiers rather than discipline families — its Calculus panel is
 * red and its Advanced Math panel green — so these are identifiers too, and
 * they deliberately do NOT match the discipline colors in the Figure 2 extended
 * view. Validated as a categorical set in this order: worst adjacent pair
 * ΔE 11.9 deutan / 19.3 normal, chroma and contrast pass against the figure's
 * surface.
 */
export const PANEL_COLORS = [
  '#5E8C2A', '#A0446E', '#B8860B', '#2C6FB5', '#B03A2E', '#6A4C93',
]

/**
 * The panels a major declares, paired with their colors. Returns an empty list
 * for a major that declares none, so a figure renders nothing rather than
 * borrowing another major's course organization.
 */
export function panelsFor(major) {
  const declared = major?.courseTypes?.barrierPanels
  if (!Array.isArray(declared)) return []
  return declared.map((panel, index) => ({
    key: panel.key,
    label: panel.label,
    // Named `panelColor` rather than `color`: the Computer Science categories
    // already carry a `color` from the published baseline, and the panel
    // renderer must keep resolving those through its own lookup so the
    // reproduction is untouched.
    panelColor: PANEL_COLORS[index % PANEL_COLORS.length],
  }))
}

/**
 * One bar per campus per panel: the share of districts that cannot cover every
 * ASSIST requirement group in that category.
 *
 * `campuses` is the ordered campus list the figure draws (the paper's order),
 * so a campus with no template still occupies its column.
 */
export function buildAssistBarriersModel(rows = [], panels = [], campuses = []) {
  const bySchoolId = new Map(campuses.map((campus) => [Number(campus.schoolId), campus]))
  const districts = new Set()
  // key: `${categoryKey}|${campusId}` -> { required, missing:Set<district> }
  const cells = new Map()

  for (const row of rows) {
    const campus = bySchoolId.get(Number(row.school_id))
    const district = row.row_group_label || row.community_college_district
    const categories = row.assist_requirements_by_course_category
    if (!campus || !district || !categories) continue
    districts.add(district)

    for (const panel of panels) {
      const verdict = categories[panel.key]
      if (!verdict) continue
      const key = `${panel.key}|${campus.id}`
      if (!cells.has(key)) cells.set(key, { required: false, missing: new Set() })
      const cell = cells.get(key)
      // Requirement structure is campus-wide and should agree across its 72
      // district rows. OR-ing the flag prevents one malformed row from erasing
      // a genuinely required category.
      if (verdict.required) cell.required = true
      if (verdict.required && verdict.satisfied === false) cell.missing.add(district)
    }
  }

  const districtCount = districts.size
  return {
    districtCount,
    categories: panels.map((panel) => ({
      ...panel,
      campuses: campuses.map((campus) => {
        const cell = cells.get(`${panel.key}|${campus.id}`)
        const required = Boolean(cell?.required)
        const missing = required ? (cell?.missing.size ?? 0) : null
        return {
          ...campus,
          required,
          missing,
          pct: required && districtCount
            ? +((missing / districtCount) * 100).toFixed(1)
            : null,
        }
      }),
    })),
  }
}

// Temporary compatibility for downstream imports created with the first
// degree-template implementation. New code should use the ASSIST-specific name.
export const buildDegreeBarriersModel = buildAssistBarriersModel
