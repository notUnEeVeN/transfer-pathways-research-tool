import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COVERAGE_QUERY_VERSION } from '../keys'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(),
  useQuery: mocks.useQuery,
  useQueryClient: vi.fn(),
}))
vi.mock('../../api/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

import apiClient from '../../api/apiClient'
import { useCoverage, useTransferCreditRate } from './useData'

describe('useCoverage', () => {
  beforeEach(() => mocks.useQuery.mockReset())

  it('versions every dimension and discards inactive computed snapshots', () => {
    useCoverage({
      majorSlug: 'econ', groupBy: 'district', requirements: 'assist',
    })

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: [
        'analysis-coverage', COVERAGE_QUERY_VERSION, 'user-1',
        'econ', '', 'district', 'assist', null,
      ],
      enabled: true,
      gcTime: 0,
    }))
  })
})

describe('useTransferCreditRate', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset()
    apiClient.get.mockReset()
  })

  it('separates and requests the verified-only evidence cohort', async () => {
    apiClient.get.mockResolvedValue({ data: { rows: [] } })

    useTransferCreditRate('ast', { majorSlug: 'bio', verifiedOnly: true })

    const queryOptions = mocks.useQuery.mock.calls[0][0]
    expect(queryOptions.queryKey).toEqual([
      'analysis-transfer-credit-rate', 'v6', 'user-1', 'bio', 'ast', 'verified',
    ])
    await queryOptions.queryFn()
    expect(apiClient.get).toHaveBeenCalledWith('/analysis/transfer-credit-rate', {
      params: { degree_type: 'ast', majorSlug: 'bio', verified_only: true },
    })
  })
})
