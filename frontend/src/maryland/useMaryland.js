import { useQuery } from '@tanstack/react-query'
import apiClient from '@frontend/api/apiClient'
import { useAuth } from '@frontend/hooks/useAuth'

/**
 * Query hooks for the Maryland (ARTSYS) corpus.
 *
 * Kept in this folder rather than added to `shared/query/hooks/useData.js` so
 * the second state is a directory that can be deleted, not a diff spread
 * through the California data layer. Keys are prefixed `md-` for the same
 * reason: no cache entry is shared with the California console, so the two can
 * never be confused for one another in devtools or in a stale-cache bug.
 *
 * Every key carries the uid, matching the house rule that a sign-out and
 * sign-in as a different account cannot serve the previous user's rows.
 */

const useMd = (key, path, params, options = {}) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['md', key, user?.uid, ...(params ? [params] : [])],
    queryFn: () => apiClient.get(path, params ? { params } : undefined).then((r) => r.data),
    enabled: !!user?.uid && (options.enabled ?? true),
    staleTime: options.staleTime ?? 5 * 60 * 1000,
  })
}

/** Corpus-level counts for the landing view. */
export function useMdSummary() {
  return useMd('summary', '/md/summary', null, { staleTime: 60 * 1000 })
}

/** Community colleges (sending) or universities (receiving). */
export function useMdInstitutions(kind) {
  return useMd(`institutions:${kind || 'all'}`, '/md/institutions',
    kind ? { kind } : null, { staleTime: Infinity })
}

/** Distinct (program × receiving university) rows, optionally filtered. */
export function useMdPrograms({ universityId = null, q = '' } = {}) {
  const params = {}
  if (universityId) params.university_id = universityId
  if (q) params.q = q
  return useMd(`programs:${universityId || ''}:${q}`, '/md/programs',
    Object.keys(params).length ? params : null)
}

/** Agreement headers for one college, one university, or one program. */
export function useMdAgreements({
  collegeId = null, universityId = null, major = null, verdicts = false,
} = {}) {
  const params = {}
  if (collegeId) params.college_id = collegeId
  if (universityId) params.university_id = universityId
  if (major) params.major = major
  // Without a filter the endpoint 400s by design — a bare listing of 9,072
  // agreements is never what a caller wants.
  const ready = Object.keys(params).length > 0
  if (verdicts) params.verdicts = '1'
  return useMd(`agreements:${collegeId || ''}:${universityId || ''}:${major || ''}:${verdicts ? 'v' : ''}`,
    '/md/agreements', params, { enabled: ready })
}

/** One agreement in full, with the eligibility-engine verdict attached. */
export function useMdAgreement(id) {
  return useMd(`agreement:${id || ''}`, `/md/agreements/${encodeURIComponent(id || '')}`,
    null, { enabled: !!id })
}

/** Program × college strict-verdict grid for a program-title filter. */
export function useMdCoverageMatrix(q) {
  return useMd(`coverage-matrix:${q || ''}`, '/md/coverage-matrix',
    { q }, { enabled: !!q, staleTime: 5 * 60 * 1000 })
}

/** Per-college rollup, scoped to a program or receiving university. */
export function useMdCollegeRollup({ major = null, universityId = null } = {}) {
  const params = {}
  if (major) params.major = major
  if (universityId) params.university_id = universityId
  return useMd(`rollup:${major || ''}:${universityId || ''}`, '/md/college-rollup',
    Object.keys(params).length ? params : null)
}
