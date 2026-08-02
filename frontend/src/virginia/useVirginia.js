import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@frontend/api/apiClient'
import { useAuth } from '@frontend/hooks/useAuth'

/**
 * Query hooks for the Transfer Virginia course corpus.
 *
 * Kept in this folder rather than folded into the California data layer so the
 * second state stays a directory that can be deleted, not a diff spread through
 * shared hooks. Keys are prefixed `va-` for the same reason: no cache entry is
 * shared with the California console, so a stale-cache bug cannot cross states.
 *
 * Every key carries the uid, matching the house rule that signing out and in as
 * a different account cannot serve the previous user's rows.
 */
// NOTE: no query here uses `staleTime: Infinity`. The app persists its query
// cache for 24h (see main.jsx), so an Infinity staleTime means a result
// captured before an import is served from storage forever and never
// refetched — which is exactly how the institution rails came to show 0 after
// the corpus landed. Corpus data is re-importable, so it always gets a finite
// staleTime and revalidates.
const useVa = (key, path, params, options = {}) => {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['va', key, user?.uid, ...(params ? [params] : [])],
    queryFn: () => apiClient.get(path, params ? { params } : undefined).then((r) => r.data),
    enabled: !!user?.uid && (options.enabled ?? true),
    staleTime: options.staleTime ?? 5 * 60 * 1000,
  })
}

/** Corpus-level counts. `imported: false` means the import has not been run. */
export function useVaSummary() {
  return useVa('summary', '/va/summary', null, { staleTime: 60 * 1000 })
}

/** Institutions, optionally one level (`community_college` | `four_year`). */
export function useVaInstitutions(level) {
  return useVa(`institutions:${level || 'all'}`, '/va/institutions',
    level ? { level } : null, { staleTime: 5 * 60 * 1000 })
}

/** Distinct departments with course counts. */
export function useVaDepartments() {
  return useVa('departments', '/va/departments', null, { staleTime: 5 * 60 * 1000 })
}

/** Course list under the active filters. */
export function useVaCourses({ q = '', department = '', college = '', receiver = '', limit = 200 } = {}) {
  const params = { limit }
  if (q) params.q = q
  if (department) params.department = department
  if (college) params.college = college
  if (receiver) params.receiver = receiver
  return useVa('courses', '/va/courses', params)
}

/** One course in full — only fetched once a row is opened. */
export function useVaCourse(code) {
  return useVa(`course:${code || 'none'}`, code ? `/va/courses/${code}` : '/va/courses',
    null, { enabled: !!code, staleTime: 5 * 60 * 1000 })
}

/** College × university shared-course counts. */
export function useVaMatrix() {
  return useVa('matrix', '/va/matrix', null, { staleTime: 5 * 60 * 1000 })
}

/** CS degrees for one institution — catalog document plus any program map. */
export function useVaDegrees(institution) {
  return useVa(`degrees:${institution || 'none'}`, '/va/degrees',
    institution ? { institution } : null, { enabled: !!institution })
}

/** Which institutions offer CS and whether requirements are collected. */
export function useVaCoverage() {
  return useVa('coverage', '/va/coverage', null)
}

/**
 * Save a hand-edit to a degree document.
 *
 * Same contract as the California requirement editor: the whole document is
 * PUT back, the server stamps who and when, and the verdict is taken from the
 * signed-in user rather than the payload. Invalidates the institution's degree
 * query so the pane re-reads what was actually stored.
 */
export function useSaveVaDegree(institution) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (doc) => apiClient.put(`/va/degrees/${encodeURIComponent(doc._id)}`, doc)
      .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({
      queryKey: ['va', `degrees:${institution || 'none'}`, user?.uid],
    }),
  })
}

/** Hand-edit history for one degree document. Admin-only on the server. */
export function useVaDegreeRevisions(id, enabled = false) {
  return useVa(`revisions:${id || 'none'}`, id ? `/va/degrees/${encodeURIComponent(id)}/revisions` : '/va/coverage',
    null, { enabled: !!id && enabled })
}
