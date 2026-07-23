import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncomeAccess, {
  buildIncomeAccessModel, correlation, jitteredCampuses, standardizedRegression,
} from './IncomeAccess'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

function currentRows() {
  return UC_ROWS.flatMap((campus) => DISTRICTS.map((district) => ({
    school_id: campus.id,
    school: campus.campus,
    row_group_label: district.name,
    fully_articulated: campus.bits[district.index] === '1',
  })))
}

// ASSIST states a broader requirement set, so fewer district-campus pairs are
// complete: here the two quarter-system campuses drop out entirely.
function assistRows() {
  const dropped = new Set(['UC1*', 'UC3*'])
  return currentRows().map((row) => ({
    ...row,
    fully_articulated: row.fully_articulated && !dropped.has(row.school_id),
  }))
}

describe('income and transfer access', () => {
  const refetch = vi.fn()

  beforeEach(() => {
    refetch.mockReset()
    useCoverage.mockReset()
    useCoverage.mockImplementation((params) => ({
      data: { rows: params.requirements === 'assist' ? assistRows() : currentRows() },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    }))
  })

  it('recovers a known slope and R² from constructed data', () => {
    // y = 2*a - b exactly, so the standardized fit must recover that structure.
    const a = [1, 2, 3, 4, 5, 6, 7, 8]
    const b = [2, 1, 4, 3, 6, 5, 8, 7]
    const y = a.map((value, index) => 2 * value - b[index])
    const { betas, rSquared } = standardizedRegression(y, [a, b])

    expect(rSquared).toBeCloseTo(1, 6)
    expect(betas[0]).toBeGreaterThan(0)
    expect(betas[1]).toBeLessThan(0)
    expect(correlation(a, a)).toBeCloseTo(1, 9)
    expect(correlation(a, a.map((value) => -value))).toBeCloseTo(-1, 9)
  })

  it('joins every district to its income and ranks the quartiles', () => {
    const model = buildIncomeAccessModel(currentRows())

    expect(model.districts).toHaveLength(72)
    expect(model.districts.every((district) => district.income > 0)).toBe(true)
    expect(model.districts.every((district) => district.distanceKm > 0)).toBe(true)
    // Sorted by income, so quartile 1 is the poorest and 4 the richest.
    expect(model.quartiles.map((quartile) => quartile.index)).toEqual([1, 2, 3, 4])
    expect(model.quartiles[0].medianIncome).toBeLessThan(model.quartiles[3].medianIncome)
    // The finding: access rises with income, monotonically across quartiles.
    const access = model.quartiles.map((quartile) => quartile.campuses)
    expect(access[0]).toBeLessThan(access[3])
    expect([...access].sort((left, right) => left - right)).toEqual(access)
    // Districts with no access at all sit in the bottom half.
    expect(model.quartiles[2].zeroAccess + model.quartiles[3].zeroAccess).toBe(0)
    expect(model.correlation).toBeGreaterThan(0.4)
  })

  it('keeps income standing when population and distance are measured with it', () => {
    const { regression } = buildIncomeAccessModel(currentRows())
    const [income, population, distance] = regression.betas

    expect(income).toBeGreaterThan(0.2)
    expect(population).toBeGreaterThan(0)
    expect(distance).toBeLessThan(0)
    expect(regression.rSquared).toBeGreaterThan(0.5)
  })

  it('draws the scatter and the quartile bars as one stacked exhibit', () => {
    const { container } = render(<IncomeAccess />)
    const scatter = container.querySelector('[data-income-figure="scatter"]')
    const gradient = container.querySelector('[data-income-figure="gradient"]')

    // Both panels export together, and both are 960 wide as the handoff specifies.
    expect(scatter.getAttribute('data-export-width')).toBe('960')
    expect(gradient.getAttribute('data-export-width')).toBe('960')
    expect(container.querySelector('[data-export-root]').contains(gradient)).toBe(true)

    expect(scatter.querySelectorAll('[data-district-point]')).toHaveLength(72)
    // Uniform circles, coloured by coverage tier, per the design handoff.
    const paintOf = (campuses) => {
      const district = buildIncomeAccessModel(currentRows()).districts
        .find((item) => item.campuses === campuses)
      const node = scatter.querySelector(`[data-district-point="${district.key}"] circle`)
      return node.getAttribute('fill')
    }
    expect(scatter.querySelectorAll('[data-district-point] rect, [data-district-point] polygon'))
      .toHaveLength(0)
    expect(paintOf(2)).toBe('rgba(213,94,0,0.72)')
    expect(paintOf(5)).toBe('rgba(230,159,0,0.72)')
    expect(paintOf(9)).toBe('rgba(0,158,115,0.72)')

    // The quartile-mean trend sits on the scatter, unlabelled — the numbers are
    // read off the bars below, not printed twice.
    expect(scatter.querySelectorAll('[data-trend-point]')).toHaveLength(4)
    expect(scatter.querySelectorAll('[data-trend-point] text')).toHaveLength(0)
    expect(gradient.querySelectorAll('[data-quartile]')).toHaveLength(4)
    expect([...gradient.querySelectorAll('[data-quartile]')]
      .map((node) => node.textContent.match(/(\d\.\d)$/)[1])).toHaveLength(4)

    // Neither panel carries explanatory subtext: title, plot, legend, nothing else.
    expect(`${scatter.textContent} ${gradient.textContent}`)
      .not.toMatch(/Each dot|richest quarter|SD|R²|jitter/)
    expect(screen.getByRole('img', { name: /Los Angeles Community College District.*mean income per tax return/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('separates the discrete campus counts with a stable jitter', () => {
    // Same input, same offset, every render — and the end rows never cross the axis.
    expect(jitteredCampuses(5, 3)).toBe(jitteredCampuses(5, 3))
    expect(jitteredCampuses(5, 3)).not.toBe(jitteredCampuses(5, 4))
    expect(Math.abs(jitteredCampuses(5, 7) - 5)).toBeLessThan(0.29)
    expect(jitteredCampuses(9, 2)).toBeLessThanOrEqual(9)
    expect(jitteredCampuses(9, 2)).toBeGreaterThan(8.7)
    expect(jitteredCampuses(0, 2)).toBeGreaterThanOrEqual(0)
    expect(jitteredCampuses(0, 2)).toBeLessThan(0.3)
  })

  it('switches between the hand-curated and ASSIST requirement sets', () => {
    const { container } = render(<IncomeAccess />)
    const quartileMeans = () => [...container.querySelectorAll('[data-quartile]')]
      .map((node) => Number(node.textContent.match(/(\d+\.\d)$/)?.[1]))
    const pointCountOf = () => container.querySelectorAll('[data-district-point]').length

    // The figure opens on ASSIST, so read the looser set first by switching to it.
    fireEvent.click(screen.getByRole('button', { name: 'Hand-curated' }))
    const handCurated = quartileMeans()

    fireEvent.click(screen.getByRole('button', { name: 'ASSIST' }))
    expect(pointCountOf()).toBe(72)
    const assist = quartileMeans()

    // Fewer complete pairs under ASSIST, so every quartile mean falls, and the
    // income gradient survives the stricter reading.
    expect(assist.every((value, index) => value < handCurated[index])).toBe(true)
    expect(assist[0]).toBeLessThan(assist[3])

    expect(useCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ requirements: 'assist', pin: 'settings' }),
      expect.anything()
    )
  })

  it('uses only the selected Economics ASSIST state without baseline controls', () => {
    const { container } = render(<IncomeAccess majorSlug='econ' />)

    expect(container.querySelector('[data-control-group="version"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hand-curated' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ASSIST' })).not.toBeInTheDocument()
    expect(screen.getByText(
      'Economics transfer access and local income, district by district'
    )).toBeInTheDocument()
    expect(screen.getByText(
      'Economics programs reachable by local-income quartile'
    )).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/richer districts|far more/i)

    expect(useCoverage).toHaveBeenCalledTimes(2)
    for (const [params] of useCoverage.mock.calls) {
      expect(params).toEqual({
        majorSlug: 'econ',
        groupBy: 'district',
        requirements: 'assist',
      })
    }
    expect(useCoverage.mock.calls.some(([, options]) => options.enabled === false)).toBe(true)
    expect(useCoverage.mock.calls.some(([, options]) => options.enabled === true)).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
