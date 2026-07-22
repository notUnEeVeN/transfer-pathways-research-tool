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
  as_total_units: 60, as_unit_system: 'semester', transferred_units: 54.3,
  named_transferred_units: 20, ge_counted_units: 30, elective_counted_units: 4.3,
  method_status: 'ok',
  ...over,
})

const rows = [
  row(10, 'CC Alpha', 1, 'UC Berkeley', 90.5),
  row(10, 'CC Alpha', 2, 'UC Merced', 100),
  row(20, 'CC Beta', 1, 'UC Berkeley', null, {
    transferred_units: null,
    method_status: 'unavailable',
    method_warning: 'No verified articulation agreement for this pair.',
  }),
  row(20, 'CC Beta', 2, 'UC Merced', 60),
]

describe('buildRateMatrix', () => {
  it('averages only computable cells and leaves the rest blank', () => {
    const model = buildRateMatrix(rows)
    expect(model.columns.map((c) => c.school)).toEqual(['UC Berkeley', 'UC Merced'])
    expect(model.rows.map((r) => r.name)).toEqual(['CC Alpha', 'CC Beta'])
    expect(model.cells.has('20|1')).toBe(false) // null rate → blank cell
    expect(model.records.has('20|1')).toBe(true) // explanation remains available
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
    expect(screen.getAllByText('Average')).toHaveLength(2)
    expect(screen.queryByText('Mean degree applied')).not.toBeInTheDocument()
    expect(screen.queryByText('Whole degree applies')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Degree applied to graduation: 90.5%/i)).toHaveAttribute(
      'aria-label', expect.stringMatching(/named requirements 20 · GE and breadth 30 · free electives 4.3 semester units/i)
    )
    expect(screen.getByRole('note')).toHaveTextContent('Each associate-degree unit is applied at most once')
    expect(screen.getByRole('note')).toHaveTextContent('1 cell includes a method warning')
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
