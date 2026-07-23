import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreditLoss, { majorDisplayName } from './CreditLoss'
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
