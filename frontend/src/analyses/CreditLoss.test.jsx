import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreditLoss, { majorDisplayName, buildModel } from './CreditLoss'
import { useCreditLoss } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCreditLoss: vi.fn() }))

const ROWS = [{
  school_id: 79,
  school: 'UC Berkeley',
  community_college: 'Berkeley City College',
  min_cc_courses: 4,
  min_cc_units: 12,
  many_to_one: 0,
  receivers_blocked: 0,
}]

describe('minimum transfer coursework', () => {
  beforeEach(() => {
    useCreditLoss.mockReset()
    useCreditLoss.mockReturnValue({
      data: { rows: ROWS, dataset_version: 'test-bio' },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
  })

  it('queries Biology and visibly names it inside the export root', () => {
    const { container } = render(<CreditLoss majorSlug='bio' />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(useCreditLoss).toHaveBeenCalledWith(
      { majorSlug: 'bio' },
      expect.objectContaining({ refetchOnWindowFocus: false, refetchInterval: false })
    )
    expect(exportRoot).toHaveTextContent('Biology')
    expect(exportRoot).not.toHaveTextContent('Computer Science')
    expect(exportRoot.querySelector('[data-export-major]')).toHaveTextContent('Biology')
  })

  it('uses a sanitized title-cased label for a future major slug', () => {
    expect(majorDisplayName('environmental_science')).toBe('Environmental Science')
    expect(majorDisplayName('<script>public-health</script>')).toBe('Script Public Health Script')
    expect(majorDisplayName('')).toBe('Selected Major')
  })
})

const rows = [
  { school_id: 1, school: 'UC Example', community_college: 'Missing', min_cc_courses: 3, min_cc_units: null },
  { school_id: 1, school: 'UC Example', community_college: 'Known zero', min_cc_courses: 0, min_cc_units: 0 },
  { school_id: 1, school: 'UC Example', community_college: 'Fractional credit', min_cc_courses: 1, min_cc_units: 1.5 },
]
describe('CreditLoss incomplete unit evidence', () => {
  beforeEach(() => {
    useCreditLoss.mockReturnValue({ data: { rows }, isLoading: false, isError: false })
  })
  it('omits missing credit while preserving zero and genuine fractional credit in the histogram and mean', () => {
    const metric = { value: 'units', field: 'min_cc_units', binStep: 2, unit: 'units' }
    const model = buildModel(rows, metric)
    expect(model.groups[0].n).toBe(2)
    expect(model.groups[0].meanUnits).toBe(0.75)
    expect(model.groups[0].bins[0].count).toBe(1)
    expect(model.groups[0].bins[0].title).not.toContain('Missing')
    expect(model.groups[0].bins[1].title).toContain('1–<3 native units')
    expect(buildModel([rows[0]], metric).groups[0].meanUnits).toBeNull()
  })

  it('exposes the omitted unit population and the native-calendar unit basis', () => {
    render(<CreditLoss />)
    expect(screen.getByText(/1 of 3 agreements lack complete course-unit evidence/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Units' }))
    expect(screen.getByText(/Semester and quarter units are pooled without conversion/)).toBeInTheDocument()
  })
})
