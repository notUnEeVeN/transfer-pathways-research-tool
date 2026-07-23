import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ArticulationCoverageMap, { buildCoverageMapModel } from './ArticulationCoverageMap'
import { districtIncome } from '../shared/countyIncome'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

// Service-area counties as the coverage endpoint reports them, so the income
// join is exercised: Allan Hancock spans three, Los Angeles one.
const COUNTIES_BY_DISTRICT = {
  0: ['San Luis Obispo', 'Santa Barbara', 'Ventura'],
  26: ['Los Angeles'],
}

function currentRows() {
  const gains = new Set([
    'UC4*|0',   // UC Santa Barbara × Allan Hancock
    'UC1*|53',  // UC Davis × Santa Barbara
    'UC1*|69',  // UC Davis × West Valley-Mission
  ])
  return UC_ROWS.flatMap((campus) => DISTRICTS.map((district) => ({
    school_id: campus.id,
    school: campus.campus,
    row_group_label: district.name,
    community_college_counties: COUNTIES_BY_DISTRICT[district.index] || ['Santa Clara'],
    fully_articulated: campus.bits[district.index] === '1'
      || gains.has(`${campus.id}|${district.index}`),
  })))
}

describe('articulation coverage map', () => {
  const refetchHandCurated = vi.fn()
  const refetchAssist = vi.fn()

  beforeEach(() => {
    refetchHandCurated.mockReset()
    refetchAssist.mockReset()
    useCoverage.mockReset()
    useCoverage.mockImplementation((params) => ({
      data: { rows: currentRows() },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: params.requirements === 'assist' ? refetchAssist : refetchHandCurated,
    }))
  })

  it('keeps all paper display classes while exposing the three exact-count gains', () => {
    const model = buildCoverageMapModel(currentRows())

    expect(model.mapped).toBe(72)
    expect(model.sameBucket).toBe(72)
    expect(model.sameExact).toBe(69)
    expect(model.bucketCounts).toEqual({ low: 13, middle: 25, high: 34 })
    expect(model.changed.map((district) => [district.index, district.paperCount, district.currentCount]))
      .toEqual([[0, 4, 5], [53, 8, 9], [69, 8, 9]])
    expect(model.districts[0].coveredCampusCodes).toHaveLength(5)
    expect(model.districts[0].coveredCampusCodes).toContain('UCSB')
    expect(model.districts.every((district) => (
      district.coveredCampusCodes.length === district.currentCount
    ))).toBe(true)
  })

  it('joins county income onto each district, weighted by returns filed', () => {
    const model = buildCoverageMapModel(currentRows())
    const allanHancock = model.districts[0]
    const losAngeles = model.districts[26]

    expect(allanHancock.counties).toEqual(['San Luis Obispo', 'Santa Barbara', 'Ventura'])
    expect(losAngeles.income.counties).toEqual(['Los Angeles'])
    // Weighted, so the three-county value sits between its parts, not at their
    // unweighted mean, and is dominated by the largest county.
    const parts = ['San Luis Obispo', 'Santa Barbara', 'Ventura']
      .map((county) => districtIncome([county]).meanAgiPerReturn)
    expect(allanHancock.income.meanAgiPerReturn).toBeGreaterThan(Math.min(...parts))
    expect(allanHancock.income.meanAgiPerReturn).toBeLessThan(Math.max(...parts))
    expect(allanHancock.income.returns).toBe(
      ['San Luis Obispo', 'Santa Barbara', 'Ventura']
        .reduce((sum, county) => sum + districtIncome([county]).returns, 0)
    )

    expect(districtIncome([])).toBeNull()
    expect(districtIncome(['Nowhere'])).toBeNull()
  })

  it('omits the Computer Science paper baseline when building another major', () => {
    const model = buildCoverageMapModel(currentRows(), { includePaperBaseline: false })

    expect(model.sameBucket).toBeNull()
    expect(model.sameExact).toBeNull()
    expect(model.changed).toEqual([])
    expect(model.districts.every((district) => (
      district.paperCount == null
      && district.paperBucket == null
      && district.delta == null
      && district.exactMatch == null
      && district.bucketMatch == null
    ))).toBe(true)
  })

  it('zooms smoothly on scroll, keeping the point under the cursor fixed', () => {
    const { container } = render(<ArticulationCoverageMap />)
    const svg = container.querySelector('[data-export-root] svg')
    // jsdom has no layout, so give the SVG the size the viewBox assumes.
    svg.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 520, height: 680, right: 520, bottom: 680,
    })
    const mapLayer = container.querySelector('[data-map-layer]')
    const scaleOf = (node) => Number(node.getAttribute('transform').match(/scale\(([\d.]+)\)/)[1])

    expect(scaleOf(mapLayer)).toBe(1)

    fireEvent.wheel(svg, { deltaY: -120, clientX: 260, clientY: 340 })
    const zoomedIn = scaleOf(mapLayer)
    expect(zoomedIn).toBeGreaterThan(1)
    // Continuous, not stepped: a smaller wheel delta moves it less.
    fireEvent.wheel(svg, { deltaY: -20, clientX: 260, clientY: 340 })
    const nudged = scaleOf(mapLayer)
    expect(nudged - zoomedIn).toBeLessThan(zoomedIn - 1)

    // Scrolling back out returns to the floor and re-centres.
    fireEvent.wheel(svg, { deltaY: 2000, clientX: 260, clientY: 340 })
    expect(mapLayer.getAttribute('transform')).toContain('scale(1)')
    expect(mapLayer.getAttribute('transform')).toContain('translate(0 0)')
  })

  it('keeps markers a constant size on screen while zooming', () => {
    const { container } = render(<ArticulationCoverageMap />)
    const svg = container.querySelector('[data-export-root] svg')
    svg.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 520, height: 680, right: 520, bottom: 680,
    })
    const mapLayer = container.querySelector('[data-map-layer]')
    const scaleOf = () => Number(mapLayer.getAttribute('transform').match(/scale\(([\d.]+)\)/)[1])
    // A low-coverage district draws as a square, so its side is the size.
    const squareSide = () => Number(
      container.querySelector('[data-bucket="low"] rect').getAttribute('width')
    )

    const sideAtRest = squareSide()
    fireEvent.wheel(svg, { deltaY: -400, clientX: 260, clientY: 340 })
    const zoom = scaleOf()

    expect(zoom).toBeGreaterThan(1)
    // Drawn side shrinks by exactly the zoom, so the on-screen size is unchanged.
    expect(squareSide() * zoom).toBeCloseTo(sideAtRest, 4)
  })

  it('renders compact map details, exact differences, and the original paper reference', () => {
    const { container } = render(<ArticulationCoverageMap />)

    expect(container.querySelectorAll('[data-district-marker]')).toHaveLength(72)
    expect(container.querySelectorAll('[data-bucket="low"]')).toHaveLength(13)
    expect(container.querySelectorAll('[data-bucket="middle"]')).toHaveLength(25)
    expect(container.querySelectorAll('[data-bucket="high"]')).toHaveLength(34)
    expect(container.querySelector('[data-bucket="low"] rect[fill="#fe4f32"]')).toBeTruthy()
    expect(container.querySelector('[data-bucket="middle"] circle[fill="#fae745"]')).toBeTruthy()
    expect(container.querySelector('[data-bucket="high"] polygon[fill="#60f088"]')).toBeTruthy()
    expect(screen.queryByText(/Fully articulated UC campuses \(of 9\)/i)).not.toBeInTheDocument()
    expect(screen.getByText('Lower coverage')).toBeTruthy()
    expect(screen.getByText('Moderate coverage')).toBeTruthy()
    expect(screen.getByText('Higher coverage')).toBeTruthy()
    const mapSvg = container.querySelector('svg[data-export-width]')
    expect(mapSvg.getAttribute('viewBox')).toBe('0 0 520 680')
    expect(mapSvg.getAttribute('data-export-width')).toBe('520')
    expect(mapSvg.querySelector('[data-major-label]'))
      .toHaveTextContent('Major: Computer Science')
    expect(screen.queryByText('Map-class agreement')).not.toBeInTheDocument()
    expect(screen.queryByText('Exact-count agreement')).not.toBeInTheDocument()
    expect(screen.queryByText('Current class totals')).not.toBeInTheDocument()
    expect(screen.queryByText('Mapped districts')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Show differences' })).not.toBeDisabled()
    const allanHancock = screen.getByRole('img', {
      name: /Allan Hancock.*5 of 9.*paper baseline 4/i,
    })
    expect(allanHancock).toBeTruthy()

    fireEvent.mouseEnter(allanHancock)
    let tooltip = screen.getByRole('status')
    expect(tooltip).toHaveTextContent('UCSB')
    expect(tooltip).not.toHaveTextContent('UC Santa Barbara')
    expect(tooltip).toHaveTextContent('Paper 4 · change +1')
    expect(container.querySelector('[data-export-root]').contains(tooltip)).toBe(false)
    fireEvent.mouseLeave(allanHancock)

    const fullCoverageDistrict = screen.getByRole('img', {
      name: /Santa Barbara Community College District.*9 of 9/i,
    })
    fireEvent.mouseEnter(fullCoverageDistrict)
    tooltip = screen.getByRole('status')
    expect(tooltip).not.toHaveTextContent('Articulated campuses')
    // Income shows for every district, and the requirement-source tag is gone.
    expect(tooltip.querySelector('[data-district-income]')).toBeTruthy()
    expect(tooltip).toHaveTextContent(/Mean income per tax return/)
    expect(tooltip).not.toHaveTextContent(/Hand-curated minimums/)
    fireEvent.mouseLeave(fullCoverageDistrict)

    fireEvent.click(screen.getByRole('switch', { name: 'Show differences' }))
    expect(container.querySelectorAll('[data-count-change="gain"]')).toHaveLength(3)
    expect(screen.getByText('More campuses than paper')).toBeTruthy()

    const mapLayer = container.querySelector('[data-map-layer]')
    expect(mapLayer.getAttribute('transform')).toContain('scale(1)')

    fireEvent.click(screen.getByRole('button', { name: 'Original figure' }))
    expect(screen.getByRole('img', { name: /Original California paper Figure 4/i })).toBeTruthy()
    expect(container.querySelector('[data-major-label]')).toBeNull()
    expect(screen.getByRole('switch', { name: 'Show differences' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Refresh data' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ASSIST' }))
    expect(screen.getByText(/district–campus rows · ASSIST minimums/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetchAssist).toHaveBeenCalledOnce()
    expect(useCoverage).toHaveBeenCalledWith(
      {
        majorSlug: 'cs',
        groupBy: 'district',
        requirements: 'paper',
        pin: 'paper',
      },
      expect.objectContaining({ refetchOnWindowFocus: false, refetchInterval: false })
    )
    expect(useCoverage).toHaveBeenCalledWith(
      {
        majorSlug: 'cs',
        groupBy: 'district',
        requirements: 'assist',
        pin: 'settings',
      },
      expect.objectContaining({
        refetchOnWindowFocus: false,
        refetchInterval: false,
        enabled: true,
      })
    )
  })

  it('uses only unpinned ASSIST coverage and current-state controls for Biology', () => {
    const { container } = render(<ArticulationCoverageMap majorSlug='bio' />)

    expect(container.querySelector('[data-control-group="version"]')).toBeNull()
    expect(container.querySelector('[data-control-group="comparison"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Original figure' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hand-curated' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ASSIST' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Show differences' })).not.toBeInTheDocument()
    expect(screen.getByText(/district–campus rows · ASSIST minimums/i)).toBeInTheDocument()
    const mapSvg = container.querySelector('[data-export-root] svg')
    expect(mapSvg.querySelector('[data-major-label]'))
      .toHaveTextContent('Major: Biology')
    expect(mapSvg.querySelector('title')).toHaveTextContent('Biology: California articulation coverage')
    expect(mapSvg.querySelector('desc')).toHaveTextContent('for Biology')

    expect(useCoverage).toHaveBeenCalledTimes(2)
    for (const [params] of useCoverage.mock.calls) {
      expect(params).toEqual({
        majorSlug: 'bio',
        groupBy: 'district',
        requirements: 'assist',
      })
    }
    expect(useCoverage.mock.calls.some(([, options]) => options.enabled === false)).toBe(true)
    expect(useCoverage.mock.calls.some(([, options]) => options.enabled === true)).toBe(true)

    const allanHancock = screen.getByRole('img', {
      name: /Allan Hancock.*5 of 9 University of California campuses fully articulated/i,
    })
    expect(allanHancock).not.toHaveAccessibleName(/paper baseline/i)
    fireEvent.mouseEnter(allanHancock)
    expect(screen.getByRole('status')).not.toHaveTextContent(/Paper|change \+1/i)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetchAssist).toHaveBeenCalledOnce()
  })

  it('labels Economics and arbitrary future-major exports without falling back to CS', () => {
    const view = render(<ArticulationCoverageMap majorSlug='econ' />)
    const label = () => view.container.querySelector('[data-export-root] [data-major-label]')

    expect(label()).toHaveTextContent('Major: Economics')

    view.rerender(<ArticulationCoverageMap majorSlug='environmental-science' />)
    expect(label()).toHaveTextContent('Major: Environmental Science')
    expect(label()).not.toHaveTextContent('Computer Science')
  })
})
