import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaperArticulationHistogram, {
  PaperArticulationHistogramPreview,
  buildArticulationHistogramModel,
  buildPaperArticulationHistogramModel,
} from './PaperArticulationHistogram'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

function currentRows() {
  const gains = new Set(['UC4*|0', 'UC1*|53', 'UC1*|69'])
  return UC_ROWS.flatMap((campus) => DISTRICTS.map((district) => ({
    school_id: campus.id,
    school: campus.campus,
    row_group_label: district.name,
    fully_articulated: campus.bits[district.index] === '1'
      || gains.has(`${campus.id}|${district.index}`),
  })))
}

describe('paper articulation histogram', () => {
  const refetch = vi.fn()

  beforeEach(() => {
    refetch.mockReset()
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: currentRows() },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    })
  })

  it('recomputes the ten Figure 3 bins from current district coverage', () => {
    const model = buildArticulationHistogramModel(currentRows())

    expect(model.districtCount).toBe(72)
    expect(model.bins.map((bin) => bin.districts.length)).toEqual([3, 2, 1, 7, 6, 11, 8, 4, 10, 20])
    expect(model.bins.reduce((sum, bin) => sum + bin.districts.length, 0)).toBe(72)
  })

  it('reconstructs the frozen Figure 3 baseline from the paper matrix', () => {
    const model = buildPaperArticulationHistogramModel()

    expect(model.bins.map((bin) => bin.frequency)).toEqual([3, 2, 1, 7, 7, 10, 8, 4, 12, 18])
    expect(model.districtCount).toBe(72)
  })

  it('renders the paper-style histogram without redundant summary cards', () => {
    const { container } = render(<PaperArticulationHistogram />)

    expect(container.querySelectorAll('[data-histogram-bin]')).toHaveLength(10)
    expect(screen.getByRole('img', { name: /9 complete campuses\. 20 districts/i })).toBeTruthy()
    expect(screen.getByText('Number of UC campuses with complete articulation')).toBeTruthy()
    expect(screen.queryByText('Map-class agreement')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(screen.getByRole('img', { name: /9 complete campuses\. 18 districts/i })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Show differences' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Current data' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Show differences' }))
    expect(container.querySelectorAll('[data-difference="increase"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-difference="decrease"]')).toHaveLength(2)
    expect(screen.getByText('Added since paper')).toBeTruthy()
    expect(screen.getByRole('img', { name: /8 complete campuses\. 10 districts\. Paper baseline: 12; change: -2/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(useCoverage).toHaveBeenCalledWith(
      {
        majorContains: 'computer science',
        groupBy: 'district',
        requirements: 'paper',
        pin: 'paper',
      },
      expect.objectContaining({ refetchOnWindowFocus: false, refetchInterval: false })
    )
  })

  it('uses the publication skin only for current-data states', () => {
    const { container } = render(<PaperArticulationHistogram />)
    const modern = container.querySelector('[data-modern-california-figure="coverage-distribution"]')

    expect(modern).toBeTruthy()
    expect(modern.getAttribute('viewBox')).toBe('0 0 1240 698')
    expect(modern.style.fontFamily).toContain('Hanken Grotesk')
    expect(modern.querySelector('path[fill="#2E5C8A"]')).toBeTruthy()
    expect(modern.querySelector('[data-histogram-value-label]')?.getAttribute('font-size')).toBe('16')
    expect([...modern.querySelectorAll('text')].map((node) => node.textContent))
      .not.toContain('Distribution of complete campus articulation')

    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(container.querySelector('[data-modern-california-figure]')).toBeNull()
    expect(container.querySelector('svg[data-export-width="960"]')).toBeTruthy()
  })

  it('exports a figure-only current-data preview', () => {
    const { container } = render(<PaperArticulationHistogramPreview />)

    expect(container.querySelector('[data-modern-california-figure="coverage-distribution"]')).toBeTruthy()
    expect(container.querySelector('[data-export-exclude]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Paper baseline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh data' })).not.toBeInTheDocument()
  })
})
