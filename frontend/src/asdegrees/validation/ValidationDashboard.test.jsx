import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ValidationDashboard from './ValidationDashboard'

const mocks = vi.hoisted(() => ({
  cohort: {
    college_ids: [110, 42],
    colleges: [
      {
        college_id: 110,
        name: 'Alpha College',
        degrees: [
          {
            record_id: 'as_degree:110:cs:ast',
            degree_type: 'ast',
            status: 'found',
            verified: true,
            groups_total: 4,
            groups_curated: 4,
          },
          {
            record_id: 'as_degree:110:cs:local_as',
            degree_type: 'local_as',
            status: 'found',
            verified: false,
            groups_total: 3,
            groups_curated: 1,
          },
        ],
      },
      {
        college_id: 42,
        name: 'Beta College',
        degrees: [],
      },
    ],
  },
  setCohort: vi.fn().mockResolvedValue({ college_ids: [] }),
}))

vi.mock('./useValidation', () => ({
  useValidationCohort: () => ({ data: mocks.cohort, isLoading: false, isError: false }),
  useSetValidationCohort: () => ({
    mutateAsync: mocks.setCohort,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('../../shared/query/hooks/useData', () => ({
  useColleges: () => ({
    data: [
      { id: 110, name: 'Alpha College' },
      { id: 42, name: 'Beta College' },
      { id: 77, name: 'Gamma College' },
    ],
    isLoading: false,
  }),
}))

beforeEach(() => {
  mocks.setCohort.mockReset()
  mocks.setCohort.mockResolvedValue({ college_ids: [] })
})

describe('ValidationDashboard', () => {
  it('shows each school and all three validation progress signals', () => {
    render(<ValidationDashboard onOpenEditor={() => {}} />)

    expect(screen.getByText('Alpha College')).toBeInTheDocument()
    expect(screen.getByText('Beta College')).toBeInTheDocument()
    expect(screen.getByText('Degrees found')).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
    expect(screen.getByText('Groups curated')).toBeInTheDocument()
    expect(screen.getByText('5/7')).toBeInTheDocument()
    expect(screen.getByText('Records verified')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('A.S.-T · 4/4 groups')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('No AS-degree records yet')).toBeInTheDocument()
  })

  it('hands the selected college id to the editor integration callback', () => {
    const onOpenEditor = vi.fn()
    render(<ValidationDashboard onOpenEditor={onOpenEditor} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Alpha College editor' }))

    expect(onOpenEditor).toHaveBeenCalledWith(110)
  })

  it('adds and removes schools by replacing the cohort id list', async () => {
    render(<ValidationDashboard onOpenEditor={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Choose a college' }))
    fireEvent.click(screen.getByRole('option', { name: 'Gamma College' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to cohort' }))
    await waitFor(() => expect(mocks.setCohort).toHaveBeenCalledWith({ college_ids: [110, 42, 77] }))

    fireEvent.click(screen.getByRole('button', { name: 'Remove Beta College from cohort' }))
    await waitFor(() => expect(mocks.setCohort).toHaveBeenLastCalledWith({ college_ids: [110] }))
  })
})
