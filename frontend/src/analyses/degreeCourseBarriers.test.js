import { describe, expect, it } from 'vitest'
import { buildAssistBarriersModel, panelsFor, PANEL_COLORS } from './degreeCourseBarriers'

const CAMPUSES = [
  { id: 'UC1*', schoolId: 89, campus: 'UC Davis', quarter: true },
  { id: 'UC3*', schoolId: 7, campus: 'UC San Diego', quarter: true },
]

const BIO = {
  slug: 'bio',
  courseTypes: {
    barrierPanels: [
      { key: 'bio_series', label: 'Intro Biology' },
      { key: 'gen_chem', label: 'General Chemistry' },
      { key: 'organic_chem', label: 'Organic Chemistry' },
      { key: 'calculus', label: 'Calculus' },
      { key: 'statistics', label: 'Statistics' },
      { key: 'physics', label: 'Physics' },
    ],
  },
}

const verdict = (required, satisfied = null) => ({ required, satisfied })

/** Davis requires statistics and covers it; San Diego requires none. */
function rows() {
  const districts = ['Alpha District', 'Beta District', 'Gamma District', 'Delta District']
  return districts.flatMap((district, index) => ([
    {
      school_id: 89,
      row_group_label: district,
      assist_requirements_by_course_category: {
        bio_series: verdict(true, true),
        gen_chem: verdict(true, true),
        // Organic chemistry is short at the first two districts only.
        organic_chem: verdict(true, index >= 2),
        calculus: verdict(true, true),
        statistics: verdict(true, index !== 0),
        physics: verdict(true, true),
      },
    },
    {
      school_id: 7,
      row_group_label: district,
      assist_requirements_by_course_category: {
        bio_series: verdict(true, true),
        gen_chem: verdict(true, true),
        organic_chem: verdict(false),
        calculus: verdict(true, true),
        statistics: verdict(false),
        physics: verdict(true, index !== 3),
      },
    },
  ]))
}

describe('panelsFor', () => {
  it('pairs each declared panel with a color, in order', () => {
    const panels = panelsFor(BIO)
    expect(panels.map((panel) => panel.label)).toEqual([
      'Intro Biology', 'General Chemistry', 'Organic Chemistry',
      'Calculus', 'Statistics', 'Physics',
    ])
    expect(panels.map((panel) => panel.panelColor)).toEqual(PANEL_COLORS)
  })

  it('uses panelColor so the published Computer Science colors are untouched', () => {
    // The baseline categories carry their own `color`; the renderer must keep
    // resolving those through its own lookup, so a new major's color has to
    // arrive under a different name.
    expect(panelsFor(BIO)[0].color).toBeUndefined()
  })

  it('returns nothing for a major that declares no panels', () => {
    expect(panelsFor({ slug: 'cs' })).toEqual([])
    expect(panelsFor(null)).toEqual([])
  })
})

describe('buildAssistBarriersModel', () => {
  const model = buildAssistBarriersModel(rows(), panelsFor(BIO), CAMPUSES)
  const panel = (key) => model.categories.find((category) => category.key === key)
  const at = (key, id) => panel(key).campuses.find((campus) => campus.id === id)

  it('counts districts that cannot cover every lower-division slot', () => {
    expect(model.districtCount).toBe(4)
    // Two of four districts fall short on organic chemistry at Davis.
    expect(at('organic_chem', 'UC1*').missing).toBe(2)
    expect(at('organic_chem', 'UC1*').pct).toBe(50)
  })

  it('reports a fully covered category as required with no gaps', () => {
    expect(at('bio_series', 'UC1*')).toMatchObject({ required: true, missing: 0, pct: 0 })
  })

  it('marks a category the campus does not require as not required', () => {
    // San Diego requires no organic chemistry or statistics — the source
    // figure's gray bar, which must not read as "covered everywhere".
    expect(at('organic_chem', 'UC3*')).toMatchObject({ required: false, missing: null, pct: null })
    expect(at('statistics', 'UC3*').required).toBe(false)
  })

  it('keeps a partially covered slot from rounding away', () => {
    // One district of four misses one physics slot at San Diego.
    expect(at('physics', 'UC3*')).toMatchObject({ required: true, missing: 1, pct: 25 })
  })

  it('keeps every declared campus as a column even with no rows', () => {
    const sparse = buildAssistBarriersModel(rows().filter((row) => row.school_id === 89),
      panelsFor(BIO), CAMPUSES)
    expect(sparse.categories[0].campuses.map((campus) => campus.id)).toEqual(['UC1*', 'UC3*'])
    expect(sparse.categories[0].campuses[1].required).toBe(false)
  })

  it('produces six panels and no model at all without panels', () => {
    expect(model.categories).toHaveLength(6)
    expect(buildAssistBarriersModel(rows(), [], CAMPUSES).categories).toEqual([])
  })
})
