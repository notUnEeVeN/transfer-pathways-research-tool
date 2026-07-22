// Static baseline for the California paper's Figure 5 (course barriers).
//
// The percentages below are TRANSCRIBED from the published figure, not
// recomputed, so the baseline view is provably the paper's own chart. The
// counts are the district counts those percentages imply out of the paper's
// 72 districts (every printed value is an exact multiple of 1/72).
//
// Categories, colors and the campus order come from the paper's own
// `question_2-3/district-level/{helper,course_analysis}.py`
// (COURSE_GROUPS + UC_NAME_INDICES): a requirement group joins a category
// when its group id contains one of the category's patterns, first match
// wins, so the pattern order below must not be reshuffled.

export const NOT_REQUIRED = null

export const PAPER_DISTRICT_COUNT = 72

// Campus row order is the paper's: most transfer requirements first. The
// asterisk marks a quarter-system campus, exactly as printed.
export const CAMPUSES = [
  { id: 'UC1*', schoolId: 89, campus: 'UC Davis', quarter: true },
  { id: 'UC2', schoolId: 144, campus: 'UC Merced', quarter: false },
  { id: 'UC3*', schoolId: 7, campus: 'UC San Diego', quarter: true },
  { id: 'UC4*', schoolId: 128, campus: 'UC Santa Barbara', quarter: true },
  { id: 'UC5*', schoolId: 117, campus: 'UC Los Angeles', quarter: true },
  { id: 'UC6', schoolId: 79, campus: 'UC Berkeley', quarter: false },
  { id: 'UC7*', schoolId: 132, campus: 'UC Santa Cruz', quarter: true },
  { id: 'UC8*', schoolId: 120, campus: 'UC Irvine', quarter: true },
  { id: 'UC9*', schoolId: 46, campus: 'UC Riverside', quarter: true },
]

// Panel order = the paper's 2x3 grid, read left to right, top row first.
export const COURSE_CATEGORIES = [
  { key: 'calculus', label: 'Calculus', color: '#EC2424', patterns: ['calc'] },
  { key: 'intro-programming', label: 'Intro Programming', color: '#25ADA7', patterns: ['intro', 'program'] },
  { key: 'data-structures', label: 'Data Structures', color: '#8F35B3', patterns: ['data', 'struct'] },
  { key: 'advanced-math', label: 'Advanced Math', color: '#0B7C3C', patterns: ['linear', 'differential'] },
  { key: 'computer-organization', label: 'Computer Organization', color: '#0C5382', patterns: ['organ', 'system', 'computer'] },
  { key: 'discrete-math', label: 'Discrete Math', color: '#FF9F1C', patterns: ['discrete'] },
]

// Percentage of the 72 districts missing an articulated equivalent, per
// campus, as printed in Figure 5. `null` = the campus does not require the
// course (the paper's gray bar).
export const PAPER_MISSING_PCT = {
  calculus: [5.6, 2.8, 4.2, 1.4, 4.2, 2.8, 1.4, 1.4, 1.4],
  'intro-programming': [31.9, 6.9, 34.7, 19.4, 34.7, null, 23.6, 45.8, 20.8],
  'data-structures': [52.8, 9.7, 40.3, 27.8, null, null, null, null, null],
  'advanced-math': [null, 4.2, 5.6, 4.2, 6.9, 4.2, null, null, null],
  'computer-organization': [25.0, null, null, null, null, null, 23.6, null, null],
  'discrete-math': [20.8, null, 31.9, 8.3, null, null, 19.4, null, null],
}

/** The category a curated requirement group belongs to, paper rules. */
export function categoryOfGroupId(groupId) {
  const text = String(groupId || '').trim().toLowerCase()
  if (!text) return null
  return COURSE_CATEGORIES.find((category) =>
    category.patterns.some((pattern) => text.includes(pattern))
  ) || null
}

/** Districts the printed percentage stands for, out of the paper's 72. */
export function paperMissingDistricts(categoryKey, campusIndex) {
  const pct = PAPER_MISSING_PCT[categoryKey]?.[campusIndex]
  return pct == null ? null : Math.round((pct / 100) * PAPER_DISTRICT_COUNT)
}

/** The frozen Figure 5 grid: one entry per category x campus cell. */
export function buildPaperCourseBarriersModel() {
  return {
    districtCount: PAPER_DISTRICT_COUNT,
    categories: COURSE_CATEGORIES.map((category) => ({
      ...category,
      campuses: CAMPUSES.map((campus, index) => {
        const pct = PAPER_MISSING_PCT[category.key][index]
        return {
          ...campus,
          required: pct != null,
          missing: paperMissingDistricts(category.key, index),
          pct,
        }
      }),
    })),
  }
}
