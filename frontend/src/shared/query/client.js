import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

/**
 * TanStack Query is the single data layer for the app. The QueryClient lives
 * for the lifetime of the page; the persister mirrors successful queries to
 * IndexedDB so a returning visitor sees data on the very first paint.
 *
 * Cache key conventions live in ./keys.js. Hooks per data domain live in
 * ./hooks/*.
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Most of our data (agreements, course catalog, colleges list) is
      // stable for the day. 5 min stale gives an instant-feeling SWR on
      // navigation but still picks up changes within a session.
      staleTime: 5 * 60 * 1000,
      // Keep in memory for 24 h between mounts.
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
      // 30s axios timeout is gone — handled here. Failed queries surface
      // as `error` to the caller, never an infinite spinner.
      networkMode: 'online'
    },
    mutations: {
      retry: 0
    }
  }
})

/**
 * Persist source/catalog queries, but never computed analyses. Analysis
 * results depend on the current algorithm and canonical dataset; rehydrating
 * an old result can otherwise paint one answer before the live request paints
 * another. Individual hooks may still retain them briefly in memory when that
 * is safe; coverage snapshots are discarded as soon as their visual unmounts.
 */
export function shouldPersistQuery(query) {
  const rootKey = String(query?.queryKey?.[0] || '')
  return query?.state?.status === 'success'
    && !['access-me', 'majors'].includes(rootKey)
    && !rootKey.startsWith('analysis-')
}

const idbStorage = {
  getItem: (key) => get(key),
  setItem: (key, value) => set(key, value),
  removeItem: (key) => del(key)
}

export const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'pmt-query-cache-v1',
  throttleTime: 1000
})
