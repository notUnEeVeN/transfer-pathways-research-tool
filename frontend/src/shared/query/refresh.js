import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Explicit refresh for computed analyses.
 *
 * Everything under /analysis/* is held for the session (see the session-cache
 * block in ./hooks/useData.js) instead of being refetched every time a figure
 * mounts. Two things keep that honest: a curated save invalidates every query
 * under this prefix, and the reader can ask for a recomputation here. This
 * module is that second half — the Refresh controls on Compare and Visuals call
 * it, and nothing else in the app forces an analysis to re-run.
 */

// Every computed-analysis query key starts with this. It is also what the
// curated-save invalidation predicates match on and what shouldPersistQuery
// refuses to write to IndexedDB, so a new analysis hook joins all three
// behaviours by naming its root key `analysis-<something>`.
export const ANALYSIS_KEY_PREFIX = 'analysis-'

const isAnalysisQuery = (query) =>
  String(query?.queryKey?.[0] || '').startsWith(ANALYSIS_KEY_PREFIX)

// Narrowing is a membership test over the key's segments, not a lookup at a
// fixed index: the major slug sits at a different position in every hook
// (coverage puts it after the uid, credit-loss before its filters,
// multi-campus-pathways after the mode). An analysis that names no major at
// all — today only the generated multi-campus snapshot — is reached by an
// unnarrowed call.
const mentionsMajor = (query, majorSlug) =>
  (query?.queryKey || []).slice(1).some((part) => part === majorSlug)

/**
 * Recompute the analyses the reader is looking at, and mark the rest as owed a
 * recomputation the next time they mount.
 *
 * `options.majorSlug` narrows to one major so a single pane's Refresh does not
 * re-run every other major's analyses; pass null (or nothing) to cover them all.
 * The returned promise rejects if a refetch fails, so a caller can tell a
 * refresh that landed from one that only looked like it did.
 */
/**
 * One-shot "recompute, do not serve me your cache" marks.
 *
 * Some analyses are cached on the SERVER — pathway-complexity reads a permanent
 * Mongo document unless the request carries `?refresh=1` — so refetching them
 * returns the same stored answer forever. An explicit refresh marks those keys
 * here; the query function consumes the mark and adds the parameter. It is a
 * mark rather than a query option because a query's `meta` is read-only once
 * built, and it is consumed on read so a later background refetch does not keep
 * paying for a full reassembly.
 */
const forceOnce = new Set()
const markOf = (queryKey) => JSON.stringify(queryKey)

export function markForceRefresh(queryKey) {
  forceOnce.add(markOf(queryKey))
}

export function consumeForceRefresh(queryKey) {
  const mark = markOf(queryKey)
  if (!forceOnce.has(mark)) return false
  forceOnce.delete(mark)
  return true
}

/**
 * Mark every cached analysis (optionally one major's) to recompute rather than
 * be served from a server-side cache on its next fetch.
 *
 * Exported because a curated SAVE needs it too, not only the Refresh button: a
 * save invalidates pathway-complexity and the figure dutifully refetches, but
 * without the mark that refetch reads the same permanent Mongo document and the
 * edit never appears.
 */
export function markAnalysesForForceRefresh(queryClient, options = {}) {
  const majorSlug = String(options?.majorSlug || '').trim()
  for (const query of queryClient.getQueryCache().findAll({
    predicate: (q) => isAnalysisQuery(q) && (!majorSlug || mentionsMajor(q, majorSlug)),
  })) {
    markForceRefresh(query.queryKey)
  }
}

export function refreshAnalyses(queryClient, options = {}) {
  const majorSlug = String(options?.majorSlug || '').trim()
  markAnalysesForForceRefresh(queryClient, options)

  // refetchType belongs on the FILTERS argument, not the options — the query
  // core reads `filters.refetchType`, so passing it second silently falls back
  // to refetching everything.
  return queryClient.invalidateQueries(
    {
      predicate: (query) => isAnalysisQuery(query)
        && (!majorSlug || mentionsMajor(query, majorSlug)),
      // Refetch what is mounted; everything else is left invalidated, which the
      // session cache honours by refetching it on its next mount. Refreshing a
      // whole session's worth of unobserved results would be a request storm of
      // its own, and none of it would be on screen.
      refetchType: 'active',
    },
    { throwOnError: true }
  )
}

/**
 * `{ refresh, isRefreshing }` for a refresh control. `refresh(options)` takes
 * the same options as refreshAnalyses and returns its promise.
 */
export function useRefreshAnalyses() {
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  // A pane refresh and a workspace refresh can overlap, and they cover
  // different sets of queries — so both run, and the control stays busy until
  // the last one settles rather than clearing on the first.
  const pendingRef = useRef(0)

  const refresh = useCallback((options = {}) => {
    pendingRef.current += 1
    setIsRefreshing(true)
    return refreshAnalyses(queryClient, options).finally(() => {
      pendingRef.current -= 1
      if (pendingRef.current === 0) setIsRefreshing(false)
    })
  }, [queryClient])

  return { refresh, isRefreshing }
}
