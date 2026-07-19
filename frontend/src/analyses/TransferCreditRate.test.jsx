import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransferCreditRate, { buildRateMatrix } from './TransferCreditRate'

const mockRate = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useTransferCreditRate: (...a) => mockRate(...a),
}))

const row = (collegeId, name, schoolId, school, rate, over = {}) => ({
  community_college_id: collegeId, college_name: name,
  school_id: schoolId, school,
  rate,
  prescribed_units: 42, transferred_units: 38,
  named_units: 12, named_transferred_units: 8,
  ge_units: 30, ge_verified_units: 30,
  ...over,
})

const rows = [
  row(10, 'CC Alpha', 1, 'UC Berkeley', 90.5),
  row(10, 'CC Alpha', 2, 'UC Merced', 100),
  row(20, 'CC Beta', 1, 'UC Berkeley', null, { prescribed_units: null, transferred_units: null }),
  row(20, 'CC Beta', 2, 'UC Merced', 60),
]

describe('buildRateMatrix', () => {
  it('averages only computable cells and leaves the rest blank', () => {
    const model = buildRateMatrix(rows)
    expect(model.columns.map((c) => c.school)).toEqual(['UC Berkeley', 'UC Merced'])
    expect(model.rows.map((r) => r.name)).toEqual(['CC Alpha', 'CC Beta'])
    expect(model.cells.has('20|1')).toBe(false) // null rate → blank cell
    expect(model.rows[1].mean).toBe(60) // Beta averages its one computable cell
    expect(model.columnMeans[0]).toBe(90.5)
    expect(model.valueCount).toBe(3)
  })
})

describe('TransferCreditRate', () => {
  it('defaults to the local CS A.S. cohort and renders the matrix', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    expect(mockRate).toHaveBeenCalledWith('local_cs_as')
    expect(screen.getByText('CC Alpha')).toBeInTheDocument()
    // The cell value repeats in the column-average row (one computable cell).
    expect(screen.getAllByText('90.5%').length).toBeGreaterThan(0)
    expect(screen.getByText('Average')).toBeInTheDocument()
    expect(screen.getByText('Mean transfer credit rate')).toBeInTheDocument()
  })

  it('switches to the A.S.-T cohort', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    fireEvent.click(screen.getByRole('button', { name: 'CS A.S.-T' }))
    expect(mockRate).toHaveBeenLastCalledWith('ast')
  })

  it('shows an empty state when the cohort has no records', () => {
    mockRate.mockReturnValue({ data: { rows: [] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    expect(screen.getByText('No degree records')).toBeInTheDocument()
  })
})
