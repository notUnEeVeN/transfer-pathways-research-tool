import { VA_COVERAGE_ROWS } from './vaCoverageRows'
import { VA_CREDIT_RATE_ROWS } from './vaCreditRateRows'

// The gallery and Comparison must consume the same frozen source and controls.
// The live Virginia API models a different pathway and cannot supply its deltas.
export const isVaGuideCorpus = (major) => major?.slug === 'va-cs' || major?.state === 'va'

export function vaFigureView(pane = {}) {
  return {
    basis: pane.knobs?.['va-basis'] === 'scheduled' ? 'scheduled' : 'catalog',
    allColleges: pane.knobs?.['va-all-colleges'] === true,
    measure: ['units_ge', 'units', 'paper'].includes(pane.knobs?.['va-measure'])
      ? pane.knobs['va-measure'] : 'units_ge',
  }
}

const coverageCache = new Map()
export function vaCoverageData({ basis = 'catalog', allColleges = false, measure = 'units_ge' } = {}) {
  const key = `${basis}${allColleges ? '_all' : ''}`
  const cacheKey = `${key}|${measure}`
  if (!coverageCache.has(cacheKey)) {
    const bundle = VA_COVERAGE_ROWS[key]
    const rows = measure === 'units' ? bundle.rows.map((row) => ({
      ...row,
      pct_named_requirement_courses: row.va_units_no_ge_pct,
      named_requirement_courses_total: row.va_units_no_ge_total,
      named_requirement_courses_articulated: row.va_units_no_ge_articulated,
    })) : bundle.rows
    coverageCache.set(cacheKey, { ...bundle, rows, dataset_version: VA_COVERAGE_ROWS.built_at })
  }
  return coverageCache.get(cacheKey)
}

export function vaCreditRateData({ basis = 'catalog', allColleges = false } = {}) {
  return VA_CREDIT_RATE_ROWS[`${basis}${allColleges ? '_all' : ''}`]
}

export function frozenFigureQuery(query, data) {
  return { ...query, data, isLoading: false, isError: false, isFetching: false }
}

export const VA_FIGURE_KNOBS = [
  {
    key: 'va-basis', label: 'Course supply', type: 'select',
    prop: 'defaultVaBasis', default: 'catalog',
    options: [{ value: 'catalog', label: 'In the catalogue' }, { value: 'scheduled', label: 'Currently scheduled' }],
    appliesWhen: isVaGuideCorpus,
  },
  {
    key: 'va-all-colleges', label: 'All VCCS colleges', type: 'toggle',
    prop: 'defaultVaAllColleges', default: false,
    appliesWhen: isVaGuideCorpus,
  },
]
