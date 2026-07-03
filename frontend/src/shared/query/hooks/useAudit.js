import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/apiClient'
import { useAuth } from '../../hooks/useAuth'
import { qk } from '../keys'

/**
 * Audit hooks for the internal desktop console. Every call hits /api/audit/*.
 *
 * Filter shape (passed to every read hook):
 *   { scope: 'all'|'uc', schoolIds: number[], majorContains: string,
 *     groupingId?: string }
 *
 * Filter is part of every query key so switching scope or narrowing
 * triggers a refetch (rather than returning stale rows from another scope).
 * When `groupingId` is set, the legacy scope/schoolIds/majorContains fields
 * are dropped from outgoing requests — the server uses the grouping's pair
 * list instead and ignores the legacy fields.
 */

// Convert a filter object to the URLSearchParams the server expects.
export function filterToParams(filter) {
  const p = {}
  if (filter?.groupingId) {
    p.groupingId = filter.groupingId
    return p
  }
  if (filter?.scope && filter.scope !== 'all') p.scope = filter.scope
  if (filter?.schoolIds?.length) p.schoolIds = filter.schoolIds.join(',')
  if (filter?.majorContains) p.majorContains = filter.majorContains
  return p
}

// ─────────── Cache invalidation sets ───────────
// Every audit query key starts ['audit', <resource>, ...]; `<resource>` is
// queryKey[1]. Each mutation invalidates only the caches it can actually
// move, so the two sets below intentionally differ (this is not drift).

// Writing a verdict can move any verdict-derived cache, so verify invalidates
// the full set.
const AUDIT_VERDICT_RESOURCES = ['stats', 'errors', 'conservative', 'flagged', 'stale', 'correct', 'next', 'templateVariants', 'bootstrap', 'matrix']

// Deleting a grouping invalidates any cache that could have been keyed by its
// (now-gone) grouping id.
const AUDIT_GROUPING_RESOURCES = ['bootstrap', 'stats', 'next', 'errors', 'templateVariants', 'matrix']

// Predicate factory: matches audit queries whose resource is in `resources`.
const auditResourceMatcher = (resources) => (q) =>
  q.queryKey[0] === 'audit' && resources.includes(q.queryKey[1])

/**
 * Single-call bootstrap for the entire audit page. The server computes
 * { stats, errors, template_variants, next } for every scope (all, uc)
 * in parallel and returns them as a nested payload. We hydrate the per-scope
 * caches so scope toggling is purely local lookup.
 *
 * Bootstrap key drops scope (see qk.auditBootstrap → _bootstrapKey) so the
 * same (schoolIds, majorContains) tuple maps to one fetch regardless of
 * scope — switching scope in the FilterBar does NOT trigger a new bootstrap.
 */
export function useAuditBootstrap(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useQuery({
    queryKey: qk.auditBootstrap(user?.uid, filter),
    queryFn: async () => {
      // Server ignores scope when no grouping is active — always returns all
      // scope payloads. When a groupingId is present, the server returns one
      // payload under `data.grouping` and the scope keys are null.
      const { data } = await apiClient.get('/audit/bootstrap', {
        params: filterToParams({ ...filter, scope: 'all' })
      })
      if (user?.uid) {
        if (data.grouping) {
          // Single-payload hydration. Every per-tab hook keys off the same
          // `filter` (with groupingId set) so one setQueryData per resource
          // primes the cache.
          qc.setQueryData(qk.auditStats(user.uid, filter),            data.grouping.stats)
          qc.setQueryData(qk.auditErrors(user.uid, filter),           data.grouping.errors)
          qc.setQueryData(qk.auditConservative(user.uid, filter),     data.grouping.conservative)
          qc.setQueryData(qk.auditFlagged(user.uid, filter),          data.grouping.flagged)
          qc.setQueryData(qk.auditStale(user.uid, filter),            data.grouping.stale)
          qc.setQueryData(qk.auditTemplateVariants(user.uid, filter), data.grouping.template_variants)
          qc.setQueryData(qk.auditNext(user.uid, filter),             data.grouping.next)
        } else {
          for (const scope of ['all', 'uc']) {
            const scoped = { ...filter, scope }
            qc.setQueryData(qk.auditStats(user.uid, scoped),            data[scope]?.stats)
            qc.setQueryData(qk.auditErrors(user.uid, scoped),           data[scope]?.errors)
            qc.setQueryData(qk.auditConservative(user.uid, scoped),     data[scope]?.conservative)
            qc.setQueryData(qk.auditFlagged(user.uid, scoped),          data[scope]?.flagged)
            qc.setQueryData(qk.auditStale(user.uid, scoped),            data[scope]?.stale)
            qc.setQueryData(qk.auditTemplateVariants(user.uid, scoped), data[scope]?.template_variants)
            qc.setQueryData(qk.auditNext(user.uid, scoped),             data[scope]?.next)
          }
        }
      }
      return data
    },
    enabled: !!user?.uid && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}

export function useAuditNext(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditNext(user?.uid, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/next', { params: filterToParams(filter) })
      return data
    },
    // `enabled` is gated by the caller — typically the Audit page passes
    // bootReady so initial mount waits for bootstrap to hydrate this cache
    // (avoids a redundant parallel /next request alongside /bootstrap).
    enabled: !!user?.uid && enabled,
    // The doc is random; we want to keep showing the SAME one across remounts
    // (tab switches, leaving /audit and coming back). useVerifyDoc's
    // onSettled invalidates this key so rotation still advances after
    // submitting a verdict.
    staleTime: Infinity,
    refetchOnWindowFocus: false
  })
}

export function useAuditDoc(docId, system) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditDoc(user?.uid, docId, system),
    queryFn: async () => {
      const params = system ? { system } : {}
      const { data } = await apiClient.get(`/audit/doc/${docId}`, { params })
      return data
    },
    enabled: !!user?.uid && !!docId,
    staleTime: 60 * 1000
  })
}

export function useAuditErrors(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditErrors(user?.uid, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/errors', { params: filterToParams(filter) })
      return data
    },
    enabled: !!user?.uid && enabled,
    // 5 min: verdict mutations invalidate this key (AUDIT_VERDICT_RESOURCES),
    // so re-entry is instant without serving stale post-write data.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Show stale data during refetch so tabs don't flash a loader after
    // verdicts invalidate the cache.
    placeholderData: (prev) => prev
  })
}

export function useAuditConservative(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditConservative(user?.uid, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/conservative', { params: filterToParams(filter) })
      return data
    },
    enabled: !!user?.uid && enabled,
    // 5 min — see useAuditErrors. Verdicts invalidate this key.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  })
}

export function useAuditFlagged(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditFlagged(user?.uid, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/flagged', { params: filterToParams(filter) })
      return data
    },
    enabled: !!user?.uid && enabled,
    // 5 min — see useAuditErrors. Verdicts invalidate this key.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  })
}

// Stale verdicts — audits whose stored raw_template_hash no longer matches
// the doc's current hash (parser change), or whose doc was deleted. Surfaces
// any tier; re-verifying via the Stale tab writes a fresh row with the
// current hash and the row exits this list automatically.
export function useAuditStale(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditStale(user?.uid, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/stale', { params: filterToParams(filter) })
      return data
    },
    enabled: !!user?.uid && enabled,
    // 5 min — see useAuditErrors. Verdicts invalidate this key.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  })
}

// Most-recent CORRECT verdicts. Unlike the other tier lists, `search` + `limit`
// are passed to the server (the correct set can be huge); both are part of the
// query key so a searched query is its own cache entry.
export function useAuditCorrect(filter, { search = '', limit = 200, enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditCorrect(user?.uid, filter, search, limit),
    queryFn: async () => {
      const params = { ...filterToParams(filter), limit }
      if (search) params.search = search
      const { data } = await apiClient.get('/audit/correct', { params })
      return data
    },
    enabled: !!user?.uid && enabled,
    // 5 min — see useAuditErrors. Verdicts invalidate this key.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  })
}

export function useAuditTemplateVariants(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditTemplateVariants(user?.uid, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/template-variants', { params: filterToParams(filter) })
      return data
    },
    enabled: !!user?.uid && enabled,
    refetchOnWindowFocus: false,
    // Bumped from 30s because the template-variants payload is the heaviest
    // single response in the app — re-fetching it on every tab visit was the
    // main source of perceived lag. Verdict mutations still invalidate this
    // key when needed, so freshness is preserved on the paths that matter.
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  })
}

// Coverage heatmap (UC campus × major area) + largest unverified templates.
// Lazy: the caller gates `enabled` so it only fetches when the matrix is shown.
export function useAuditMatrix(filter, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditMatrix(user?.uid, filter),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/matrix', { params: filterToParams(filter) })
      return data
    },
    enabled: !!user?.uid && enabled,
    // 5 min — see useAuditErrors. Verdicts invalidate this key.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  })
}

/* ─────────────────────────── mutations ─────────────────────────── */

/**
 * Record a per-doc verdict. Used by both the Verify tab and the Templates
 * tab — the Templates tab just hands in the sample doc_id and `source:
 * 'random_template_weighted'` so stats can count it as a random sample.
 *
 * Stats numbers are recomputed by the server from authoritative state; we
 * just invalidate and refetch. Optimistic bumps got this wrong in the past
 * (re-clicking an already-verified row would still +1 the counter) and the
 * local Mongo round-trip is fast enough that it feels instant.
 *
 * After a verdict, ALL filter buckets of stats / errors / next / template-
 * variants are invalidated (predicate match on the prefix) — a verdict in
 * one scope can change the totals other scopes display when the user
 * switches filter.
 */
export function useVerifyDoc() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ doc_id, result, notes, source, system, cells_in_error, scope }) => {
      const { data } = await apiClient.post('/audit/verify', {
        doc_id, result, notes, source, system, cells_in_error, scope
      })
      return data
    },
    onSettled: () => {
      if (!user?.uid) return
      qc.invalidateQueries({ predicate: auditResourceMatcher(AUDIT_VERDICT_RESOURCES) })
    }
  })
}

/* ─────────────────────────── Groupings ─────────────────────────── */

export function useAuditGroupings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditGroupings(user?.uid),
    queryFn: async () => {
      const { data } = await apiClient.get('/audit/groupings')
      return data
    },
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false
  })
}

export function useAuditGrouping(id) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditGrouping(user?.uid, id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/audit/groupings/${id}`)
      return data
    },
    enabled: !!user?.uid && !!id,
    staleTime: 60 * 1000
  })
}

export function useAuditSearch(q, { enabled = true, systems } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: qk.auditSearch(user?.uid, q),
    queryFn: async () => {
      const params = { q }
      if (systems?.length) params.systems = systems.join(',')
      const { data } = await apiClient.get('/audit/search', { params })
      return data
    },
    enabled: !!user?.uid && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  })
}

// Create / rename / delete groupings. Each mutation invalidates the
// groupings list AND any audit caches that might have been keyed by a
// grouping id (deleting a grouping invalidates its bucket so a stale
// active selection falls back to the legacy filter cleanly).
export function useCreateGrouping() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, members }) => {
      const { data } = await apiClient.post('/audit/groupings', { name, members })
      return data
    },
    onSettled: () => {
      if (!user?.uid) return
      qc.invalidateQueries({ queryKey: qk.auditGroupings(user.uid) })
    }
  })
}

export function useRenameGrouping() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }) => {
      const { data } = await apiClient.patch(`/audit/groupings/${id}`, { name })
      return data
    },
    onSettled: (_data, _err, vars) => {
      if (!user?.uid) return
      qc.invalidateQueries({ queryKey: qk.auditGroupings(user.uid) })
      if (vars?.id) qc.invalidateQueries({ queryKey: qk.auditGrouping(user.uid, vars.id) })
    }
  })
}

export function useDeleteGrouping() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const { data } = await apiClient.delete(`/audit/groupings/${id}`)
      return data
    },
    onSettled: () => {
      if (!user?.uid) return
      qc.invalidateQueries({ queryKey: qk.auditGroupings(user.uid) })
      // Any cached audit payloads that were keyed by a (now-deleted) grouping
      // id should refetch — predicate-match the whole audit prefix.
      qc.invalidateQueries({ predicate: auditResourceMatcher(AUDIT_GROUPING_RESOURCES) })
    }
  })
}
