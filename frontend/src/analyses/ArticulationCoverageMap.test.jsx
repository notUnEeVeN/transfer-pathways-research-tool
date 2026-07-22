import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ArticulationCoverageMap, { buildCoverageMapModel } from './ArticulationCoverageMap'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

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
    fully_articulated: campus.bits[district.index] === '1'
      || gains.has(`${campus.id}|${district.index}`),
  })))
}

describe('articulation coverage map', () => {
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

  it('keeps all paper display classes while exposing the three exact-count gains', () => {
    const model = buildCoverageMapModel(currentRows())

    expect(model.mapped).toBe(72)
    expect(model.sameBucket).toBe(72)
    expect(model.sameExact).toBe(69)
    expect(model.bucketCounts).toEqual({ low: 13, middle: 25, high: 34 })
    expect(model.changed.map((district) => [district.index, district.paperCount, district.currentCount]))
      .toEqual([[0, 4, 5], [53, 8, 9], [69, 8, 9]])
  })

  it('renders one uncluttered current-data map with the paper display classes', () => {
    const { container } = render(<ArticulationCoverageMap />)

    expect(container.querySelectorAll('[data-district-marker]')).toHaveLength(72)
    expect(container.querySelectorAll('[data-bucket="low"]')).toHaveLength(13)
    expect(container.querySelectorAll('[data-bucket="middle"]')).toHaveLength(25)
    expect(container.querySelectorAll('[data-bucket="high"]')).toHaveLength(34)
    expect(screen.getByText(/same coverage bands as paper Figure 4/i)).toBeTruthy()
    expect(screen.queryByText('Map-class agreement')).not.toBeInTheDocument()
    expect(screen.queryByText('Exact-count agreement')).not.toBeInTheDocument()
    expect(screen.queryByText('Current class totals')).not.toBeInTheDocument()
    expect(screen.queryByText('Mapped districts')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Allan Hancock.*5 of 9.*paper count 4/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
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
})
