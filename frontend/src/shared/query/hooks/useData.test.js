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
import { useCoverage, usePrereqGraph, useTransferCreditRate } from './useData'

describe('useCoverage', () => {
  beforeEach(() => mocks.useQuery.mockReset())

  it('versions every dimension and holds the computed snapshot for the session', () => {
    useCoverage({
      majorSlug: 'econ', groupBy: 'district', requirements: 'assist',
    })

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: [
        'analysis-coverage', COVERAGE_QUERY_VERSION, 'user-1',
        'econ', '', 'district', 'assist', null,
      ],
      enabled: true,
      // Survives unmount now: Compare opens and closes panes constantly, and
      // recomputing per mount made reading a request storm. Freshness comes
      // from curated-save invalidation and the explicit refresh instead.
      gcTime: 24 * 60 * 60 * 1000,
      staleTime: 30 * 60 * 1000,
    }))
  })

  // The half of the policy that keeps it honest: a query a curated save marked
  // stale must recompute on its next mount, or an edit made on the Data tab
  // would paint a superseded number here.
  it('still recomputes on mount once a curated save has invalidated it', () => {
    useCoverage({ majorSlug: 'econ' })

    const { refetchOnMount } = mocks.useQuery.mock.calls.at(-1)[0]
    expect(typeof refetchOnMount).toBe('function')
    expect(refetchOnMount({ state: { isInvalidated: true, dataUpdatedAt: Date.now() } })).toBe('always')
    expect(refetchOnMount({ state: { isInvalidated: false, dataUpdatedAt: Date.now() } })).toBe(false)
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

describe('usePrereqGraph', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset()
    apiClient.get.mockReset()
  })

  it('isolates the cache and request by major and college', async () => {
    apiClient.get.mockResolvedValue({ data: { concepts: [] } })

    usePrereqGraph(4, 'bio')

    const queryOptions = mocks.useQuery.mock.calls[0][0]
    expect(queryOptions.queryKey).toEqual([
      'prereq-graph', 'user-1', 'bio', 4,
    ])
    await queryOptions.queryFn()
    expect(apiClient.get).toHaveBeenCalledWith('/curated/prerequisite-graph', {
      params: { majorSlug: 'bio', college_id: 'cc:4' },
    })
  })

  it('keeps legacy callers explicitly scoped to the default CS major', async () => {
    apiClient.get.mockResolvedValue({ data: { concepts: [] } })

    usePrereqGraph(null)

    const queryOptions = mocks.useQuery.mock.calls[0][0]
    expect(queryOptions.queryKey).toEqual([
      'prereq-graph', 'user-1', 'cs', 'all',
    ])
    await queryOptions.queryFn()
    expect(apiClient.get).toHaveBeenCalledWith('/curated/prerequisite-graph', {
      params: { majorSlug: 'cs' },
    })
  })
})
