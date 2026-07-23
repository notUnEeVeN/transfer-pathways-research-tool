import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChoiceCost, { majorDisplayName } from './ChoiceCost'
import { useChoiceCost, useSchools } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({
  useChoiceCost: vi.fn(),
  useSchools: vi.fn(),
}))

const SCHOOLS = {
  uc: [
    { id: 79, name: 'UC Berkeley' },
    { id: 89, name: 'UC Davis' },
  ],
}

const ROWS = [{
  community_college_id: 2,
  community_college: 'Berkeley City College',
  total_courses: 5,
  steps: [
    { school_id: 79, has_agreement: true, additional_courses: 4 },
    { school_id: 89, has_agreement: true, additional_courses: 1 },
  ],
}]

describe('cost of applying to more campuses', () => {
  beforeEach(() => {
    useSchools.mockReset()
    useChoiceCost.mockReset()
    useSchools.mockReturnValue({ data: SCHOOLS, isLoading: false, isError: false })
    useChoiceCost.mockReturnValue({
      data: { rows: ROWS, dataset_version: 'test-econ' },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
  })

  it('queries Economics and visibly names it inside the export root', () => {
    const { container } = render(<ChoiceCost majorSlug='econ' />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(useChoiceCost).toHaveBeenCalledWith(
      { majorSlug: 'econ', schoolIds: [79, 89] },
      expect.objectContaining({ refetchOnWindowFocus: false, refetchInterval: false })
    )
    expect(exportRoot).toHaveTextContent('Economics')
    expect(exportRoot).not.toHaveTextContent('Computer Science')
    expect(exportRoot.querySelector('[data-export-major]')).toHaveTextContent('Economics')
  })

  it('keeps canonical and future-major labels deterministic', () => {
    expect(majorDisplayName('cs')).toBe('Computer Science')
    expect(majorDisplayName('bio')).toBe('Biology')
    expect(majorDisplayName('data-science')).toBe('Data Science')
  })
})
