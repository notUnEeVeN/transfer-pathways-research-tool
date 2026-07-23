import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransferCreditRate, { buildRateMatrix } from './TransferCreditRate'

const mockRate = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useTransferCreditRate: (...a) => mockRate(...a),
}))

const row = (collegeId, name, schoolId, school, fullRate, lowerRate, over = {}) => ({
  community_college_id: collegeId, college_name: name,
  school_id: schoolId, school,
  full_degree_completion_pct: fullRate,
  lower_division_completion_pct: lowerRate,
  full_degree_required_units: 120,
  lower_division_required_units: 60,
  full_degree_fulfilled_units: Number.isFinite(fullRate) ? fullRate * 1.2 : null,
  lower_division_fulfilled_units: Number.isFinite(lowerRate) ? lowerRate * 0.6 : null,
  degree_unit_system: 'semester',
  rate: 90.5,
  as_total_units: 60, as_unit_system: 'semester', transferred_units: 54.3,
  named_transferred_units: 20, ge_counted_units: 30, elective_counted_units: 4.3,
  method_status: 'ok',
  ...over,
})

const rows = [
  row(10, 'CC Alpha', 1, 'UC Berkeley', 45.2, 90.5),
  row(10, 'CC Alpha', 2, 'UC Merced', 50, 100),
  row(20, 'CC Beta', 1, 'UC Berkeley', null, null, {
    transferred_units: null,
    method_status: 'unavailable',
    method_warning: 'No verified articulation agreement for this pair.',
  }),
  row(20, 'CC Beta', 2, 'UC Merced', 30, 60),
]

describe('buildRateMatrix', () => {
  it('averages only computable cells and leaves the rest blank', () => {
    const model = buildRateMatrix(rows)
    expect(model.columns.map((c) => c.school)).toEqual(['UC Berkeley', 'UC Merced'])
    expect(model.rows.map((r) => r.name)).toEqual(['CC Alpha', 'CC Beta'])
    expect(model.cells.has('20|1')).toBe(false) // null rate → blank cell
    expect(model.records.has('20|1')).toBe(true) // explanation remains available
    expect(model.rows[1].mean).toBe(30) // Beta averages its one computable cell
    expect(model.columnMeans[0]).toBe(45.2)
    expect(model.valueCount).toBe(3)
  })
})

describe('TransferCreditRate', () => {
  it('defaults to the local CS A.S. cohort and renders the matrix', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    expect(mockRate).toHaveBeenCalledWith('local_as')
    expect(screen.getByText('CC Alpha')).toBeInTheDocument()
    // The cell value repeats in the column-average row (one computable cell).
    expect(screen.getAllByText('45.2%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Average')).toHaveLength(2)
    expect(screen.queryByText('Mean degree applied')).not.toBeInTheDocument()
    expect(screen.queryByText('Whole degree applies')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Bachelor’s requirements fulfilled: 45.2%/i)).toHaveAttribute(
      'aria-label', expect.stringMatching(/AS units applied once: named requirements 20 · GE and breadth 30 · free electives 4.3 semester units/i)
    )
    expect(screen.getByLabelText(/CC Beta\s+UC Merced\s+Bachelor’s requirements fulfilled: 30%/i))
      .toHaveStyle({ backgroundColor: 'rgb(255 255 255)' })
    expect(screen.getByLabelText(/CC Alpha\s+UC Merced\s+Bachelor’s requirements fulfilled: 50%/i))
      .toHaveStyle({ backgroundColor: 'rgb(103 0 13)' })
    expect(screen.getByRole('note')).toHaveTextContent('The denominator is the receiving bachelor’s requirements')
    expect(screen.getByRole('note')).toHaveTextContent('1 cell includes a method warning')
  })

  it('switches from all bachelor’s requirements to lower-division requirements', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    fireEvent.click(screen.getByRole('button', { name: 'Lower-division only' }))
    expect(screen.getByText(/Transferable and breadth requirements; university-only work is excluded/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Lower-division requirements fulfilled: 90.5%/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/54.3 of 60 semester units/i))
    expect(screen.getByLabelText(/CC Alpha\s+UC Merced\s+Lower-division requirements fulfilled: 100%/i))
      .toHaveStyle({ backgroundColor: 'rgb(103 0 13)' })
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
