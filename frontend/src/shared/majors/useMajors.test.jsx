import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryClient: null,
  queryResult: null,
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}))
vi.mock('../api/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

import {
  VA_PUBLICATION_POLL_MS,
  isVirginiaDerivedQuery,
  useMajors,
  virginiaPublicationIdentity,
} from './useMajors'

const contract = 'va-analysis-publication-receipt-v1'

function vaMajor(generation = 'generation-1', overrides = {}) {
  return {
    slug: 'va-cs',
    state: 'va',
    publicationGate: { contract },
    analysisPublication: {
      ready: true,
      contract,
      major_slug: 'va-cs',
      generation_id: generation,
      projection_manifest_sha256: 'a'.repeat(64),
      publication_evaluator_fingerprint_sha256: 'b'.repeat(64),
      transfer_equivalency_condition_report_sha256: 'c'.repeat(64),
      pathway_complexity_prerequisite_report_sha256: 'd'.repeat(64),
      ...overrides,
    },
  }
}

function queryResult(majors = []) {
  return {
    data: { majors, default: majors[0]?.slug || 'cs' },
    isLoading: false,
    isError: false,
    isRefetchError: false,
    error: null,
  }
}

describe('Virginia publication registry polling', () => {
  beforeEach(() => {
    mocks.queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      removeQueries: vi.fn(),
    }
    mocks.queryResult = queryResult([])
    mocks.useQuery.mockReset()
    mocks.useQuery.mockImplementation(() => mocks.queryResult)
    mocks.useQueryClient.mockReset()
    mocks.useQueryClient.mockImplementation(() => mocks.queryClient)
  })

  it('polls Virginia-containing registries without changing CA or MA caching', () => {
    const california = renderHook(() => useMajors())
    let options = mocks.useQuery.mock.calls.at(-1)[0]
    expect(options.staleTime).toBe(Infinity)
    expect(options.refetchInterval).toBeUndefined()
    california.unmount()

    const massachusetts = renderHook(() => useMajors({ state: 'ma' }))
    options = mocks.useQuery.mock.calls.at(-1)[0]
    expect(options.staleTime).toBe(Infinity)
    expect(options.refetchInterval).toBeUndefined()
    massachusetts.unmount()

    const virginia = renderHook(() => useMajors({ state: 'va' }))
    options = mocks.useQuery.mock.calls.at(-1)[0]
    expect(options).toMatchObject({
      staleTime: VA_PUBLICATION_POLL_MS,
      refetchInterval: VA_PUBLICATION_POLL_MS,
      refetchIntervalInBackground: true,
    })
    virginia.unmount()

    const allStates = renderHook(() => useMajors({ state: 'all' }))
    options = mocks.useQuery.mock.calls.at(-1)[0]
    expect(options.refetchInterval).toBe(VA_PUBLICATION_POLL_MS)
    allStates.unmount()
  })

  it('evicts on first observation, generation/hash drift, and revocation', () => {
    mocks.queryResult = queryResult([vaMajor()])
    const hook = renderHook(() => useMajors({ state: 'va' }))

    // The first observation clears any degree/prerequisite entries restored
    // from the persisted browser cache.
    expect(mocks.queryClient.removeQueries).toHaveBeenCalledTimes(1)
    mocks.queryClient.removeQueries.mockClear()
    mocks.queryClient.cancelQueries.mockClear()

    mocks.queryResult = queryResult([vaMajor('generation-2')])
    hook.rerender()
    expect(mocks.queryClient.removeQueries).toHaveBeenCalledTimes(1)
    mocks.queryClient.removeQueries.mockClear()

    mocks.queryResult = queryResult([vaMajor('generation-2', {
      projection_manifest_sha256: 'e'.repeat(64),
    })])
    hook.rerender()
    expect(mocks.queryClient.removeQueries).toHaveBeenCalledTimes(1)
    mocks.queryClient.removeQueries.mockClear()

    mocks.queryResult = queryResult([vaMajor('generation-2', {
      ready: false,
      projection_manifest_sha256: 'e'.repeat(64),
      blocker: 'virginia_analysis_publication_receipt_required',
    })])
    hook.rerender()
    expect(mocks.queryClient.removeQueries).toHaveBeenCalledTimes(1)
    expect(hook.result.current.majors[0].analysisPublication.ready).toBe(false)

    const predicate = mocks.queryClient.removeQueries.mock.calls.at(-1)[0].predicate
    expect(predicate({ queryKey: ['analysis-transfer-credit-rate', 'v7', 'user-1', 'va-cs'] })).toBe(true)
    expect(predicate({ queryKey: ['analysis-transfer-credit-rate', 'v7', 'user-1', 'cs'] })).toBe(false)
  })

  it('fails a cached Virginia receipt closed when its background registry request fails', () => {
    mocks.queryResult = {
      ...queryResult([vaMajor()]),
      isRefetchError: true,
      error: new Error('offline'),
    }
    const { result } = renderHook(() => useMajors({ state: 'va' }))

    expect(result.current.isError).toBe(true)
    expect(result.current.majors[0].analysisPublication).toMatchObject({
      ready: false,
      blocker: 'virginia_publication_status_unavailable',
    })
    expect(mocks.queryClient.removeQueries).toHaveBeenCalledTimes(1)
  })
})

describe('Virginia derived-cache scoping', () => {
  it('matches Virginia analysis, evaluation, and prerequisite entries only', () => {
    const yes = [
      ['analysis-coverage', 'v3', 'user-1', 'va-cs'],
      ['analysis-pathway-complexity', 'v3', 'va-cs', 'local_as'],
      ['degree-evaluation', 'user-1', 1, 2, 'va-cs'],
      ['prereq-graph', 'user-1', 'va-cs', 'all'],
      ['va', 'prerequisite-graph:statewide', 'user-1'],
      ['degree-requirements', 'v4', 'user-1'],
    ]
    const no = [
      ['analysis-coverage', 'v3', 'user-1', 'cs'],
      ['analysis-transfer-credit-rate', 'v7', 'user-1', 'ma-cs'],
      ['degree-evaluation', 'user-1', 1, 2, 'cs'],
      ['prereq-graph', 'user-1', 'bio', 'all'],
      ['va', 'institutions:four_year', 'user-1'],
      ['degree-requirement-documents', 'user-1'],
    ]

    for (const queryKey of yes) expect(isVirginiaDerivedQuery({ queryKey })).toBe(true)
    for (const queryKey of no) expect(isVirginiaDerivedQuery({ queryKey })).toBe(false)
  })

  it('treats a missing or mismatched receipt as unavailable', () => {
    expect(virginiaPublicationIdentity(queryResult([]).data).ready).toBe(false)
    expect(virginiaPublicationIdentity(queryResult([
      vaMajor('generation-1', { major_slug: 'cs' }),
    ]).data).ready).toBe(false)
    expect(virginiaPublicationIdentity(queryResult([vaMajor()]).data).ready).toBe(true)
  })
})
