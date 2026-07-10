import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/apiClient'
import { useAuth } from '../../hooks/useAuth'

// Data-explorer hooks. Everything the server returns here is already scoped
// to the caller's visibility (admins: everything ported; partners: the
// granted (school, major) pairs).

export function useDataSummary() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['data-summary', user?.uid],
    queryFn: () => apiClient.get('/data/summary').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useColleges() {
  const { user } = useAuth()
  return useQuery({
    // 'geo' bumps the key past the pre-geography cache: /community-colleges now
    // carries district/region/counties_served, and the old response is
    // persisted to IndexedDB with staleTime:Infinity, so without a new key the
    // browser would keep serving colleges with no geography (empty filters).
    queryKey: ['colleges', 'geo', user?.uid],
    queryFn: () => apiClient.get('/community-colleges').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: Infinity,
  })
}

export function useSchools() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['schools', user?.uid],
    queryFn: () => apiClient.get('/schools').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: Infinity,
  })
}

export function useCcCourses(collegeId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['cc-courses', user?.uid, collegeId],
    queryFn: () => apiClient.get(`/courses/${collegeId}`).then((r) => r.data),
    enabled: !!user?.uid && collegeId != null,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUniversityCourses(schoolId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['university-courses', user?.uid, schoolId],
    queryFn: () => apiClient.get(`/university-courses/${schoolId}`).then((r) => r.data),
    enabled: !!user?.uid && schoolId != null,
    staleTime: 10 * 60 * 1000,
  })
}

// One college × one school → that pair's (visible) agreements, grouped by school.
export function useAgreementsBatch(collegeId, schoolId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['agreements-batch', user?.uid, collegeId, schoolId],
    queryFn: () =>
      apiClient
        .get(`/uc-agreements-batch/${collegeId}`, { params: { school_id: schoolId } })
        .then((r) => r.data),
    enabled: !!user?.uid && collegeId != null && schoolId != null,
    staleTime: 10 * 60 * 1000,
  })
}

// Scoped per-agreement articulation coverage (the papers' heatmap input).
// One fetch covers the whole visible subset; components index client-side.
export function useCoverage(params = {}, options = {}) {
  const { user } = useAuth()
  const majorContains = String(params.majorContains || '').trim()
  const groupBy = ['college', 'district', 'county'].includes(params.groupBy) ? params.groupBy : 'college'
  const requirements = ['assist', 'paper'].includes(params.requirements) ? params.requirements : 'assist'
  const pin = ['paper', 'settings'].includes(params.pin) ? params.pin : null
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: ['analysis-coverage', user?.uid, majorContains, groupBy, requirements, pin],
    queryFn: () =>
      apiClient
        .get('/analysis/coverage', {
          params: {
            ...(majorContains ? { majorContains } : {}),
            ...(groupBy !== 'college' ? { groupBy } : {}),
            ...(requirements !== 'assist' ? { requirements } : {}),
            ...(pin ? { pin } : {}),
          },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && enabled,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

// Per-college ASSIST-vs-hand-curated minimums comparison for one (campus, major,
// college). Returns the unified per-requirement table + per-side summaries;
// powers the Data tab's college comparison view (Level 2).
export function useRequirementComparison({ schoolId, major, communityCollegeId } = {}, options = {}) {
  const { user } = useAuth()
  const school_id = Number(schoolId)
  const community_college_id = Number(communityCollegeId)
  const majorName = String(major || '').trim()
  const { enabled = true, ...queryOptions } = options
  const ready = Number.isFinite(school_id) && Number.isFinite(community_college_id) && !!majorName
  return useQuery({
    queryKey: ['analysis-requirement-comparison', user?.uid, school_id, community_college_id, majorName],
    queryFn: () =>
      apiClient
        .get('/analysis/requirement-comparison', {
          params: { school_id, major: majorName, community_college_id },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && enabled && ready,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

// The rest of the /analysis family — same scoping and caching contract as
// useCoverage. One fetch per (endpoint × filter); components shape client-side.
function useAnalysisEndpoint(key, path, params = {}, options = {}) {
  const { user } = useAuth()
  const majorContains = String(params.majorContains || '').trim()
  const schoolIds = (params.schoolIds || []).map(Number).filter(Number.isFinite)
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: [key, user?.uid, majorContains, schoolIds.join(',')],
    queryFn: () =>
      apiClient
        .get(path, {
          params: {
            ...(majorContains ? { majorContains } : {}),
            ...(schoolIds.length ? { schoolIds: schoolIds.join(',') } : {}),
          },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && enabled,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

export function useCreditLoss(params = {}, options = {}) {
  return useAnalysisEndpoint('analysis-credit-loss', '/analysis/credit-loss', params, options)
}

// choice-cost requires an ORDERED schoolIds list; disabled until one is picked.
export function useChoiceCost(params = {}, options = {}) {
  const hasSchools = (params.schoolIds || []).length > 0
  return useAnalysisEndpoint('analysis-choice-cost', '/analysis/choice-cost', params, {
    ...options,
    enabled: hasSchools && (options.enabled ?? true),
  })
}

export function useCategoryGaps(params = {}, options = {}) {
  return useAnalysisEndpoint('analysis-category-gaps', '/analysis/category-gaps', params, options)
}

export function useComplexity(params = {}, options = {}) {
  return useAnalysisEndpoint('analysis-complexity', '/analysis/complexity', params, options)
}

export function useTimeToDegree(params = {}, options = {}) {
  return useAnalysisEndpoint('analysis-time-to-degree', '/analysis/time-to-degree', params, options)
}

export function useAnalysisRaw(collection, options = {}) {
  const { user } = useAuth()
  const safeCollection = String(collection || '').trim()
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: ['analysis-raw', user?.uid, safeCollection],
    queryFn: () => apiClient.get(`/analysis/raw/${safeCollection}`).then((r) => r.data),
    enabled: !!user?.uid && !!safeCollection && enabled,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

// ── editable reference tables (curation ref CRUD) ──
// Read + write via /curation/ref so edits refetch consistently.

export function useRefTable(table) {
  const { user } = useAuth()
  const safeTable = String(table || '').trim()
  return useQuery({
    queryKey: ['ref-table', safeTable, user?.uid],
    queryFn: () => apiClient.get(`/curation/ref/${safeTable}`).then((r) => r.data),
    enabled: !!user?.uid && !!safeTable,
    staleTime: 60 * 1000,
  })
}

export function useSaveRefRow(table) {
  const qc = useQueryClient()
  const safeTable = String(table || '').trim()
  return useMutation({
    mutationFn: (row) => apiClient.put(`/curation/ref/${safeTable}`, row).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ref-table', safeTable] }),
  })
}

export function useDeleteRefRow(table) {
  const qc = useQueryClient()
  const safeTable = String(table || '').trim()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/curation/ref/${safeTable}/${encodeURIComponent(id)}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ref-table', safeTable] }),
  })
}

// ── personal API tokens (programmatic access) ──

export function useApiTokens() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['api-tokens', user?.uid],
    queryFn: () => apiClient.get('/tokens').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  })
}

export function useCreateApiToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (label) => apiClient.post('/tokens', { label }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-tokens'] }),
  })
}

export function useRevokeApiToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/tokens/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-tokens'] }),
  })
}

// The live raw ASSIST.org payload for one stored agreement.
export function useRawAssist(agreementId, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['raw-assist', agreementId],
    queryFn: () => apiClient.get(`/data/raw-assist/${agreementId}`).then((r) => r.data),
    enabled: !!user?.uid && !!agreementId && enabled,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
}

// ── published figures (the shared stats gallery) ──

export function useFigures() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['figures', user?.uid],
    queryFn: () => apiClient.get('/figures').then((r) => r.data),
    enabled: !!user?.uid,
    // Teammates publish from their notebooks while the tab is open.
    refetchInterval: 30 * 1000,
  })
}

export function useDeleteFigure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug) => apiClient.delete(`/figures/${slug}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['figures'] }),
  })
}

// Metadata-only edit (title/caption/source_url). The image itself changes only
// by re-publishing the slug from the notebook. Owner-or-admin, enforced server-side.
export function useEditFigure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, fields }) => apiClient.patch(`/figures/${slug}`, fields).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['figures'] }),
  })
}

// ── live figures (scripts the server re-runs on data changes) ──

// The script behind a live figure. Fetched when the View-code modal opens;
// includes last_run (log for owner/admin only) and the server's can_modify.
export function useFigureScript(slug, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['figure-script', slug, user?.uid],
    queryFn: () => apiClient.get(`/figure-scripts/${slug}`).then((r) => r.data),
    enabled: !!user?.uid && !!slug && enabled,
    staleTime: 0,
  })
}

// Owner/admin: re-run the script right now (synchronous on the server; the
// promise resolves when the run finishes either way).
export function useRefreshFigureScript() {
  const qc = useQueryClient()
  const invalidate = (slug) => {
    qc.invalidateQueries({ queryKey: ['figures'] })
    qc.invalidateQueries({ queryKey: ['figure-script', slug] })
  }
  return useMutation({
    mutationFn: (slug) => apiClient.post(`/figure-scripts/${slug}/refresh`).then((r) => r.data),
    // Refresh the gallery and modal on failure too — the run log and the
    // amber state are the interesting parts of a failed run.
    onSuccess: (_data, slug) => invalidate(slug),
    onError: (_err, slug) => invalidate(slug),
  })
}

export function useSetFigureScriptEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, enabled }) =>
      apiClient.put(`/figure-scripts/${slug}/enabled`, { enabled }).then((r) => r.data),
    onSuccess: (_data, { slug }) => {
      qc.invalidateQueries({ queryKey: ['figures'] })
      qc.invalidateQueries({ queryKey: ['figure-script', slug] })
    },
  })
}

// Owner/admin: drop the script, keep the figure as a static snapshot.
export function useDetachFigureScript() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug) => apiClient.delete(`/figure-scripts/${slug}`).then((r) => r.data),
    onSuccess: (_data, slug) => {
      qc.invalidateQueries({ queryKey: ['figures'] })
      qc.invalidateQueries({ queryKey: ['figure-script', slug] })
    },
  })
}

// starter.py client, base URL baked in server-side. staleTime 0 → refetch on mount
// so redeploys show up (cache persists to IndexedDB; stale-forever would survive
// reloads).
export function usePmtPy() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['starter-py', user?.uid],
    queryFn: () => apiClient.get('/client/starter.py', { responseType: 'text' }).then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 0,
  })
}

// Browser download of a figure format (needs the auth header, so no <a href>).
export async function downloadFigure(slug, format) {
  const res = await apiClient.get(`/figures/${slug}/${format}`, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] || ''
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || `${slug}.${format}`
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// ── tasks (shared board) ──

export function useTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', user?.uid],
    // Whole { rows, dataset_version } envelope — consumers want the version too.
    queryFn: () => apiClient.get('/tasks').then((r) => r.data),
    enabled: !!user?.uid,
    // Teammates edit the shared board while the tab is open (same reasoning
    // as useFigures).
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  })
}

export function useTaskRoster() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['task-roster', user?.uid],
    queryFn: () => apiClient.get('/tasks/roster').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (task) => apiClient.post('/tasks', task).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

// Optimistic: drag-and-drop moves a card locally, so the board must not flicker
// back while the PUT is in flight. Patch the cached row immediately, roll back
// on error, and reconcile with the server in onSettled either way.
export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }) => apiClient.put(`/tasks/${id}`, patch).then((r) => r.data),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previous = qc.getQueriesData({ queryKey: ['tasks'] })
      qc.setQueriesData({ queryKey: ['tasks'] }, (old) => {
        if (!old?.rows) return old
        return {
          ...old,
          rows: old.rows.map((row) => (row._id === id ? { ...row, ...patch } : row)),
        }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      for (const [queryKey, data] of context?.previous || []) qc.setQueryData(queryKey, data)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/tasks/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
