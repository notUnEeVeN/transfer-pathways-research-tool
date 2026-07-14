import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoverageHeatmap, { createCoverageColorScale, makeCellColor } from './CoverageHeatmap'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

const degreeRow = {
  school_id: 1,
  school: 'UC Test',
  major: 'Computer Science, B.S.',
  community_college_id: 10,
  community_college: 'Test College',
  community_college_ids: [10],
  row_group_kind: 'college',
  row_group_key: '10',
  row_group_label: 'Test College',
  receivers_required: 40,
  receivers_articulated: 16,
  pct_articulated: 40,
  fully_articulated: false,
}

describe('CoverageHeatmap requirement basis', () => {
  beforeEach(() => {
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { n: 1, rows: [degreeRow] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
  })

  it('defaults to live four-year graduation requirements and uses degree-specific language', () => {
    const { container } = render(<CoverageHeatmap />)

    expect(useCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ majorContains: 'computer science', requirements: 'degree' }),
      expect.any(Object)
    )
    expect(screen.queryByRole('textbox', { name: 'Degree program filter' })).toBeNull()
    expect(container.querySelector('[data-export-root]')).toBeTruthy()
    expect(screen.getByRole('button', { name: '4-year graduation requirements' })).toBeTruthy()
    expect(screen.getByText('Mean degree coverage')).toBeTruthy()
    expect(screen.getByText('Four-year degree coverage')).toBeTruthy()
    expect(screen.getByLabelText('Coverage color scale from 30% to 50%')).toBeTruthy()
    expect(screen.getByLabelText(/16 of 40 four-year graduation requirements have a community-college equivalent/)).toBeTruthy()
  })

  it('keeps both existing minimums modes selectable', () => {
    render(<CoverageHeatmap />)

    fireEvent.click(screen.getByRole('button', { name: '4-year graduation requirements' }))
    expect(screen.getByRole('option', { name: 'ASSIST minimums' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Hand-curated minimums' })).toBeTruthy()

    fireEvent.click(screen.getByRole('option', { name: 'ASSIST minimums' }))
    expect(useCoverage).toHaveBeenLastCalledWith(
      expect.objectContaining({ requirements: 'assist' }),
      expect.any(Object)
    )
  })
})

describe('CoverageHeatmap adaptive color scale', () => {
  it('clips isolated extremes and preserves a readable minimum span', () => {
    const values = [0, ...Array(98).fill(50), 100]
    expect(createCoverageColorScale(values)).toEqual({ min: 40, mid: 50, max: 60 })
    expect(createCoverageColorScale([100])).toEqual({ min: 80, mid: 90, max: 100 })
  })

  it('maps nearby values to visibly different colors inside the adaptive domain', () => {
    const scale = createCoverageColorScale([40, 45, 50])
    const low = makeCellColor(40, scale)
    const high = makeCellColor(50, scale)
    expect(low.backgroundColor).not.toBe(high.backgroundColor)
  })
})
