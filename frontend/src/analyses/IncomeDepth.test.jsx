import { describe, expect, it } from 'vitest'
import { buildIncomeDepthModel } from './IncomeDepth'

const lookup = new Map([
  ['rich district', 200_000],
  ['middle district', 100_000],
  ['poor district', 55_000],
  ['unpriced district', undefined],
])

const row = (district, coverage, nColleges = 1) => ({
  district,
  coverage_all: coverage,
  n_colleges: nColleges,
  colleges: [`${district} College`],
})

describe('buildIncomeDepthModel', () => {
  it('joins rows to income, drops unmatched districts, and counts them', () => {
    const model = buildIncomeDepthModel([
      row('Rich District', 0.8),
      row('Middle District', 0.6),
      row('Poor District', 0.3),
      row('Unpriced District', 0.5),
      row('Unknown District', 0.4),
    ], lookup)

    expect(model.points.map((p) => p.district)).toEqual(
      ['Rich District', 'Middle District', 'Poor District'])
    expect(model.unmatched).toBe(2)
  })

  it('computes positive correlations when depth rises with income', () => {
    const model = buildIncomeDepthModel([
      row('Rich District', 0.8),
      row('Middle District', 0.6),
      row('Poor District', 0.3),
    ], lookup)
    expect(model.pearson).toBeGreaterThan(0.9)
    expect(model.spearman).toBe(1)
  })

  it('labels the extremes and the richest district only', () => {
    const many = new Map(Array.from({ length: 8 }, (_, i) => [`district ${i}`, 60_000 + i * 20_000]))
    const model = buildIncomeDepthModel(
      Array.from({ length: 8 }, (_, i) => row(`District ${i}`, 0.2 + i * 0.09)),
      many
    )
    // Top two by coverage (7, 6), bottom three (2, 1, 0), richest (7 again).
    expect([...model.labeled].sort()).toEqual(
      ['District 0', 'District 1', 'District 2', 'District 6', 'District 7'])
  })

  it('reports no correlations below three points instead of a misleading number', () => {
    const model = buildIncomeDepthModel([row('Rich District', 0.8), row('Poor District', 0.2)], lookup)
    expect(model.pearson).toBeNull()
    expect(model.spearman).toBeNull()
    expect(model.fit).toBeNull()
    expect(model.points).toHaveLength(2)
  })

  it('fits coverage on log income: slope reads as coverage points per doubling', () => {
    // Exact construction: coverage = 0.2 + 0.1 * log2(income / 50k) — every
    // doubling of income adds 10 coverage points, so the fit must recover 0.1.
    const incomes = new Map([
      ['a district', 50_000], ['b district', 100_000],
      ['c district', 200_000], ['d district', 400_000],
    ])
    const model = buildIncomeDepthModel([
      row('A District', 0.2), row('B District', 0.3),
      row('C District', 0.4), row('D District', 0.5),
    ], incomes)
    expect(model.fit.slopePerDoubling).toBeCloseTo(0.1)
    expect(model.fit.r2).toBeCloseTo(1)
    expect(model.fit.predict(800_000)).toBeCloseTo(0.6)
  })
})
