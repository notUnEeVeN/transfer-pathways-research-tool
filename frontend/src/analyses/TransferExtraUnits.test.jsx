import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransferExtraUnits from './TransferExtraUnits'

const mockRate = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useTransferCreditRate: (...a) => mockRate(...a),
}))

const row = (collegeId, name, schoolId, school, extra, over = {}) => ({
  community_college_id: collegeId, college_name: name,
  school_id: schoolId, school,
  rate: 80, transferred_units: 40,
  as_total_units: 60, as_unit_system: 'semester',
  extra_units: extra,
  extra_units_semester: extra,
  method_status: 'ok',
  ...over,
})

const rows = [
  row(10, 'CC Alpha', 1, 'UC Berkeley', 30, {
    as_total_units: 90,
    as_unit_system: 'quarter',
    transferred_units: 60,
    extra_units_semester: 20,
  }),
  row(10, 'CC Alpha', 2, 'UC Merced', 0),
  row(20, 'CC Beta', 1, 'UC Berkeley', null, {
    extra_units_semester: null,
    method_status: 'unavailable',
    method_warning: 'No verified articulation agreement for this pair.',
  }),
]

describe('TransferExtraUnits', () => {
  it('uses semester-equivalent units for the heatmap and keeps native units in the tooltip', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits />)
    expect(mockRate).toHaveBeenCalledWith('local_cs_as')
    expect(screen.getAllByText('+20').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+0').length).toBeGreaterThan(0)
    expect(screen.queryByText('Mean replacement units')).not.toBeInTheDocument()
    expect(screen.queryByText('No replacement units')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Modeled replacement coursework: \+20 semester-equivalent units/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/30 quarter units do not apply/i))
    expect(screen.getByLabelText(/CC Alpha\s+UC Merced\s+Modeled replacement coursework: \+0 semester-equivalent units/i))
      .toHaveStyle({ backgroundColor: 'rgb(255 255 255)' })
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Modeled replacement coursework: \+20 semester-equivalent units/i))
      .toHaveStyle({ backgroundColor: 'rgb(103 0 13)' })
    expect(screen.getByRole('note')).toHaveTextContent('modeled replacement units, not observed student outcomes')
  })

  it('switches degree cohorts through the shared modes', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits />)
    fireEvent.click(screen.getByRole('button', { name: 'CS A.S.-T' }))
    expect(mockRate).toHaveBeenLastCalledWith('ast')
  })
})
