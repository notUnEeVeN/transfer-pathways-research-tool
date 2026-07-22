/**
 * County income reference — California Franchise Tax Board, table B-7
 * "Adjusted Gross Income by County", taxable year in the committed extract.
 *
 * The extract is built by `analysis/fetch_ftb_income.py` from the state open
 * data portal and committed as `analysis/data/ftb_county_income.v1.json`, so
 * every figure and reference view reads the same numbers as the same year.
 *
 * There is no California-government income series for community college
 * districts, so a district value is a returns-weighted roll-up of its
 * service-area counties. Read `CAVEATS` before putting a number in front of
 * anyone: it is a mean per tax return, not median household income.
 */
import countyIncome from '../../../analysis/data/ftb_county_income.v1.json'

export const INCOME_DATASET = {
  version: countyIncome.dataset_version,
  taxableYear: countyIncome.taxable_year,
  measure: countyIncome.measure,
  measureLabel: countyIncome.measure_label,
  source: countyIncome.source,
  crossCheck: countyIncome.cross_check,
  caveats: countyIncome.caveats,
  retrievedAt: countyIncome.retrieved_at,
}

const moneyFmt = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})

export function formatIncome(value) {
  return Number.isFinite(value) ? moneyFmt.format(value) : '—'
}

function normalizeCounty(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

const byCounty = new Map(
  Object.entries(countyIncome.counties).map(([county, stats]) => [
    normalizeCounty(county), { county, ...stats },
  ])
)

/** One county's returns, total AGI and mean AGI per return, or null. */
export function countyIncomeFor(county) {
  return byCounty.get(normalizeCounty(county)) || null
}

/**
 * Mean adjusted gross income per return across a set of counties, weighted by
 * the returns filed in each — so a district spanning a large county and a small
 * one reads mostly as the large one, which is where most of its residents are.
 *
 * Returns null when nothing matches, rather than a zero that would read as a
 * real number.
 */
export function districtIncome(counties = []) {
  let returns = 0
  let income = 0
  const parts = []
  for (const county of counties) {
    const stats = countyIncomeFor(county)
    if (!stats?.returns) continue
    parts.push(stats)
    returns += stats.returns
    income += stats.adjusted_gross_income
  }
  if (!returns) return null
  return {
    meanAgiPerReturn: Math.round(income / returns),
    returns,
    adjustedGrossIncome: income,
    counties: parts.map((stats) => stats.county),
    parts,
    taxableYear: countyIncome.taxable_year,
  }
}
