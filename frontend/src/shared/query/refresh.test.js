import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real QueryClient and QueryObserver, with only the two hooks the modules
// under test call replaced: this suite has to observe what actually happens to
// a cache, not what a hook was asked to do.
const mocks = vi.hoisted(() => ({ client: null }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useMutation: (config) => config,
    useQueryClient: () => mocks.client,
  }
})
vi.mock('../api/apiClient', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'user-1' } }) }))

import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { ANALYSIS_KEY_PREFIX, refreshAnalyses, useRefreshAnalyses, consumeForceRefresh } from './refresh'
import { useSaveAsDegree, useSaveDegreeRequirement, useSaveRefRow } from './hooks/useData'

// Every root key the app actually caches under, split the way the caching
// policy splits them. The refresh and the curated-save flush must both cover
// the first group and leave the other two alone.
const COMPUTED_ANALYSES = [
  ['analysis-coverage', 'strict-pmt-v3', 'user-1', 'cs', '', 'district', 'assist', null],
  ['analysis-transfer-credit-rate', 'v6', 'user-1', 'cs', 'local_as', 'all'],
  ['analysis-credit-loss', 'user-1', 'cs', '', ''],
  ['analysis-pathway-complexity', 'v1', 'cs', 'user-1'],
  ['analysis-multi-campus-pathways', 'v2', 'user-1', 'average', 'cs', '1,2', null, 15, 15],
  ['analysis-requirement-comparison', 'user-1', 1, 21, 'Computer Science'],
]

const SOURCE_AND_CURATION = [
  ['institutions', 'community-college', 'ca', 'user-1'],
  ['cc-courses', 'user-1', 'cc:21'],
  ['agreements-batch', 'user-1', 21, 1],
  ['degree-requirements', 'v4', 'user-1'],
  ['degree-evaluation', 'user-1', 1, 21, 'cs'],
  ['as-degrees', 'user-1', 'all', 'cs'],
  ['ref-table', 'transfer_minimums', 'user-1'],
  ['tasks', 'user-1'],
]

let client
const unsubscribes = []

// An observed query — the only kind a refresh refetches, since an unobserved
// result is nothing anyone is reading.
function mount(queryKey, queryFn) {
  const observer = new QueryObserver(client, { queryKey, queryFn, retry: false })
  unsubscribes.push(observer.subscribe(() => {}))
  return observer
}

// A refetch asked for while the first fetch is still in the air joins that
// fetch instead of starting a second one, so every case below starts from a
// settled cache — otherwise the test would be measuring that dedupe.
const settle = () => vi.waitFor(() => {
  const queries = client.getQueryCache().getAll()
  expect(queries.length).toBeGreaterThan(0)
  expect(queries.every((query) => query.state.fetchStatus === 'idle')).toBe(true)
})

const seed = (queryKey) => client.setQueryData(queryKey, { rows: [] })
const isInvalidated = (queryKey) => client.getQueryState(queryKey).isInvalidated === true

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mocks.client = client
})

afterEach(() => {
  for (const unsubscribe of unsubscribes.splice(0)) unsubscribe()
  client.clear()
})

describe('refreshAnalyses', () => {
  it('refetches the analyses on screen and nothing else', async () => {
    const calls = new Map()
    const fn = (queryKey) => {
      calls.set(String(queryKey), 0)
      return () => {
        calls.set(String(queryKey), calls.get(String(queryKey)) + 1)
        return Promise.resolve({ rows: [] })
      }
    }
    for (const queryKey of [...COMPUTED_ANALYSES, ...SOURCE_AND_CURATION]) {
      mount(queryKey, fn(queryKey))
    }
    await settle()
    expect([...calls.values()].every((count) => count === 1)).toBe(true)

    await refreshAnalyses(client)

    for (const queryKey of COMPUTED_ANALYSES) {
      expect(calls.get(String(queryKey)), `${queryKey[0]} should refetch`).toBe(2)
    }
    for (const queryKey of SOURCE_AND_CURATION) {
      expect(calls.get(String(queryKey)), `${queryKey[0]} should be left alone`).toBe(1)
    }
  })

  it('marks unobserved analyses stale instead of re-running the whole session', async () => {
    const mounted = vi.fn().mockResolvedValue({ rows: [] })
    const unobserved = ['analysis-coverage', 'strict-pmt-v3', 'user-1', 'bio', '', 'college', 'assist', null]
    mount(['analysis-credit-loss', 'user-1', 'cs', '', ''], mounted)
    seed(unobserved)
    seed(['institutions', 'community-college', 'ca', 'user-1'])
    await settle()

    await refreshAnalyses(client)

    expect(mounted).toHaveBeenCalledTimes(2)
    // Not refetched, but owed one: the session cache refetches an invalidated
    // query the next time it mounts.
    expect(isInvalidated(unobserved)).toBe(true)
    expect(isInvalidated(['institutions', 'community-college', 'ca', 'user-1'])).toBe(false)
  })

  it('narrows to one major, wherever the slug sits in the key', async () => {
    const cs = vi.fn().mockResolvedValue({ rows: [] })
    const bio = vi.fn().mockResolvedValue({ rows: [] })
    // Slug at index 3 for coverage, index 2 for credit-loss.
    mount(['analysis-coverage', 'strict-pmt-v3', 'user-1', 'cs', '', 'district', 'assist', null], cs)
    mount(['analysis-credit-loss', 'user-1', 'bio', '', ''], bio)
    await settle()

    await refreshAnalyses(client, { majorSlug: 'cs' })

    expect(cs).toHaveBeenCalledTimes(2)
    expect(bio).toHaveBeenCalledTimes(1)
    expect(isInvalidated(['analysis-credit-loss', 'user-1', 'bio', '', ''])).toBe(false)
  })

  it('covers every major when the narrowing is null', async () => {
    const cs = vi.fn().mockResolvedValue({ rows: [] })
    const bio = vi.fn().mockResolvedValue({ rows: [] })
    mount(['analysis-credit-loss', 'user-1', 'cs', '', ''], cs)
    mount(['analysis-credit-loss', 'user-1', 'bio', '', ''], bio)
    await settle()

    await refreshAnalyses(client, { majorSlug: null })

    expect(cs).toHaveBeenCalledTimes(2)
    expect(bio).toHaveBeenCalledTimes(2)
  })

  it('rejects when a refetch fails, so a caller cannot claim a refresh it did not get', async () => {
    mount(
      ['analysis-coverage', 'strict-pmt-v3', 'user-1', 'cs', '', 'district', 'assist', null],
      vi.fn().mockRejectedValue(new Error('coverage recompute failed'))
    )
    await settle()

    await expect(refreshAnalyses(client)).rejects.toThrow('coverage recompute failed')
  })
})

describe('useRefreshAnalyses', () => {
  it('reports the round in flight and hands its promise to the caller', async () => {
    let release
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    mount(['analysis-credit-loss', 'user-1', 'cs', '', ''], queryFn)
    await settle()

    const { result } = renderHook(() => useRefreshAnalyses())
    expect(result.current.isRefreshing).toBe(false)

    let pending
    act(() => { pending = result.current.refresh({ majorSlug: 'cs' }) })
    await waitFor(() => expect(result.current.isRefreshing).toBe(true))

    await act(async () => {
      release({ rows: [] })
      await pending
    })
    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(result.current.isRefreshing).toBe(false)
  })
})

// The session cache is only safe because a curated save still flushes every
// computed analysis. These run the real onSuccess handlers against a real cache.
describe('curated saves invalidate computed analyses', () => {
  const savers = {
    'a degree template': () => useSaveDegreeRequirement(),
    'a reference row': () => useSaveRefRow('transfer_minimums'),
    'an associate degree': () => useSaveAsDegree(),
  }

  for (const [label, useSaver] of Object.entries(savers)) {
    it(`saving ${label} invalidates every analysis and no source data`, async () => {
      for (const queryKey of [...COMPUTED_ANALYSES, ...SOURCE_AND_CURATION]) seed(queryKey)

      await useSaver().onSuccess()

      for (const queryKey of COMPUTED_ANALYSES) {
        expect(isInvalidated(queryKey), `${queryKey[0]} should be flushed`).toBe(true)
      }
      expect(isInvalidated(['institutions', 'community-college', 'ca', 'user-1'])).toBe(false)
      expect(isInvalidated(['cc-courses', 'user-1', 'cc:21'])).toBe(false)
    })
  }

  it('matches on the prefix the analysis keys are built from', () => {
    for (const [rootKey] of COMPUTED_ANALYSES) {
      expect(String(rootKey).startsWith(ANALYSIS_KEY_PREFIX)).toBe(true)
    }
    for (const [rootKey] of SOURCE_AND_CURATION) {
      expect(String(rootKey).startsWith(ANALYSIS_KEY_PREFIX)).toBe(false)
    }
  })
})

describe('forced recomputation for server-cached analyses', () => {
  it('marks each affected key once, and consuming it clears the mark', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const key = [`${ANALYSIS_KEY_PREFIX}pathway-complexity`, 'v1', 'ma-cs', 'u1']
    client.setQueryData(key, { rows: [] })

    await refreshAnalyses(client, {})

    // The endpoint reads a permanent Mongo cache, so a refresh has to say so.
    expect(consumeForceRefresh(key)).toBe(true)
    // One shot: a later background refetch must not pay for a reassembly.
    expect(consumeForceRefresh(key)).toBe(false)
  })

  it('does not mark a key the refresh was narrowed away from', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const other = [`${ANALYSIS_KEY_PREFIX}pathway-complexity`, 'v1', 'cs', 'u1']
    client.setQueryData(other, { rows: [] })

    await refreshAnalyses(client, { majorSlug: 'ma-cs' })

    expect(consumeForceRefresh(other)).toBe(false)
  })
})
