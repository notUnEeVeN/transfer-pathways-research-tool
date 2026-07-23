import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}))

vi.mock('../../shared/api/apiClient', () => ({
  default: { get: mocks.get, put: mocks.put },
}))

vi.mock('../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'research-partner' } }),
}))

import { useSetValidationCohort, useValidationCohort } from './useValidation'

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

beforeEach(() => {
  mocks.get.mockReset()
  mocks.put.mockReset()
})

describe('AS-degree validation cohort hooks', () => {
  it('loads the shared cohort for the signed-in user', async () => {
    const payload = { college_ids: [110], colleges: [{ college_id: 110, degrees: [] }] }
    mocks.get.mockResolvedValue({ data: payload })
    const { wrapper } = setup()

    const { result } = renderHook(() => useValidationCohort(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.get).toHaveBeenCalledWith('/curated/as-degree-validation-cohort')
    expect(result.current.data).toEqual(payload)
  })

  it('replaces the cohort and invalidates its cached query', async () => {
    mocks.put.mockResolvedValue({ data: { college_ids: [110] } })
    const { queryClient, wrapper } = setup()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useSetValidationCohort(), { wrapper })

    await act(() => result.current.mutateAsync({ college_ids: [110] }))

    expect(mocks.put).toHaveBeenCalledWith(
      '/curated/as-degree-validation-cohort',
      { college_ids: [110] },
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['as-degree-validation-cohort', 'research-partner'],
    })
  })
})
