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
  rate: 80, prescribed_units: 42, transferred_units: 24,
  as_total_units: 60, as_unit_system: 'semester',
  elective_slack_units: 8, absorbed_units: 8,
  extra_units: extra,
  ...over,
})

const rows = [
  row(10, 'CC Alpha', 1, 'UC Berkeley', 28),
  row(10, 'CC Alpha', 2, 'UC Merced', 0),
  row(20, 'CC Beta', 1, 'UC Berkeley', null, { extra_units: null }),
]

describe('TransferExtraUnits', () => {
  it('renders extra units as +N with a null cell left blank', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits />)
    expect(mockRate).toHaveBeenCalledWith('local_cs_as')
    expect(screen.getAllByText('+28').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+0').length).toBeGreaterThan(0)
    expect(screen.getByText('Mean extra units')).toBeInTheDocument()
    // +0 cells stat counts the fully absorbed pair.
    expect(screen.getByText('loss fully absorbed by elective slack')).toBeInTheDocument()
  })

  it('switches degree cohorts through the shared modes', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits />)
    fireEvent.click(screen.getByRole('button', { name: 'CS A.S.-T' }))
    expect(mockRate).toHaveBeenLastCalledWith('ast')
  })
})
