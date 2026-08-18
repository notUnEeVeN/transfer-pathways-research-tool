import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import { ANALYSIS_KEY_PREFIX } from './refresh'

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
      // Coming back to the tab does not reload the console. Focus refetching
      // was the single largest source of unasked-for loading here — every
      // stale query in the app fired at once, on a surface where the reader
      // had usually left the tab precisely to go read something else. The two
      // queries that genuinely need it (the shared task board and the figure
      // gallery, both written by teammates while a tab sits open) turn it back
      // on for themselves in hooks/useData.js.
      refetchOnWindowFocus: false,
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
 * another. Analyses are held in memory for the session instead (see the
 * session-cache block in hooks/useData.js), so this exclusion is also what
 * bounds that: a reload starts every analysis from the server again.
 *
 * `comparisons` is excluded for a different reason: it holds written notes, and
 * a note saved a minute ago must never be shadowed on first paint by a 24h-old
 * copy of the document it lives in.
 */
export function shouldPersistQuery(query) {
  const rootKey = String(query?.queryKey?.[0] || '')
  return query?.state?.status === 'success'
    && !['access-me', 'majors', 'comparisons'].includes(rootKey)
    && !rootKey.startsWith(ANALYSIS_KEY_PREFIX)
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
