import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/apiClient'
import { useAuth } from '../../hooks/useAuth'
import { qk } from '../keys'

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
    queryKey: ['institutions', 'community-college', user?.uid],
    queryFn: () => apiClient
      .get('/assist/institutions', { params: { kind: 'community_college' } })
      .then((r) => r.data.rows.map((row) => ({ ...row, id: row.source_id }))),
    enabled: !!user?.uid,
    staleTime: Infinity,
  })
}

export function useSchools() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['institutions', 'university', user?.uid],
    queryFn: () => apiClient
      .get('/assist/institutions', { params: { kind: 'university' } })
      .then((r) => ({ uc: r.data.rows.map((row) => ({ ...row, id: row.source_id })) })),
    enabled: !!user?.uid,
    staleTime: Infinity,
  })
}

export function useCcCourses(collegeId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['cc-courses', user?.uid, collegeId],
    queryFn: () => apiClient
      .get('/assist/courses', { params: { institution_id: `cc:${collegeId}` } })
      .then((r) => r.data.rows),
    enabled: !!user?.uid && collegeId != null,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUniversityCourses(schoolId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['university-courses', user?.uid, schoolId],
    queryFn: () => apiClient
      .get('/assist/courses', { params: { institution_id: `uc:${schoolId}` } })
      .then((r) => r.data.rows),
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
        .get('/assist/agreements', {
          params: { college_id: `cc:${collegeId}`, university_id: `uc:${schoolId}` },
        })
        .then((r) => [{
          school_id: Number(schoolId),
          school_name: r.data.rows[0]?.uc_school || null,
          agreements: r.data.rows,
        }]),
    enabled: !!user?.uid && collegeId != null && schoolId != null,
    staleTime: 10 * 60 * 1000,
  })
}

// Scoped per-agreement articulation coverage (the papers' heatmap input).
// One fetch covers the whole visible subset; components index client-side.
export function useCoverage(params = {}, options = {}) {
  const { user } = useAuth()
  const majorSlug = String(params.majorSlug || '').trim()
  const majorContains = String(params.majorContains || '').trim()
  const groupBy = ['college', 'district', 'county'].includes(params.groupBy) ? params.groupBy : 'college'
  const requirements = ['degree', 'assist', 'paper'].includes(params.requirements) ? params.requirements : 'assist'
  const pin = ['paper', 'settings'].includes(params.pin) ? params.pin : null
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: qk.coverage(
      user?.uid, majorSlug, majorContains, groupBy, requirements, pin
    ),
    queryFn: () =>
      apiClient
        .get('/analysis/coverage', {
          params: {
            ...(majorSlug ? { majorSlug } : {}),
            ...(majorContains ? { majorContains } : {}),
            ...(groupBy !== 'college' ? { groupBy } : {}),
            ...(requirements !== 'assist' ? { requirements } : {}),
            ...(pin ? { pin } : {}),
          },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && enabled,
    // Coverage is a computed snapshot, not source data. Drop it as soon as no
    // visual observes it so navigating away and back always waits for one
    // current response instead of painting an older in-memory result first.
    gcTime: 0,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

// Per college × campus, the share of all bachelor's requirements and of only
// lower-division requirements fulfilled by the selected major's associate
// degree.
// The result is edited frequently, so it is never persisted and every mount
// fetches the current calculation (an in-memory result may bridge that fetch).
// degree_type: 'ast' | 'local_as' | 'local_other'.
export function useTransferCreditRate(degreeType = 'local_as', options = {}) {
  const { user } = useAuth()
  const type = ['ast', 'local_as', 'local_other'].includes(degreeType) ? degreeType : 'local_as'
  const { enabled = true, majorSlug = 'cs', verifiedOnly = false, ...queryOptions } = options
  const scopedMajor = String(majorSlug || '').trim() || 'cs'
  const sourceCohort = verifiedOnly === true ? 'verified' : 'all'
  return useQuery({
    // Keep the all-record and verified-only matrices in separate cache slots;
    // their rows, averages, and warning assumptions are deliberately distinct.
    queryKey: ['analysis-transfer-credit-rate', 'v6', user?.uid, scopedMajor, type, sourceCohort],
    queryFn: () =>
      apiClient
        .get('/analysis/transfer-credit-rate', {
          params: {
            degree_type: type,
            majorSlug: scopedMajor,
            ...(verifiedOnly === true ? { verified_only: true } : {}),
          },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && enabled,
    ...queryOptions,
    staleTime: 0,
    refetchOnMount: 'always',
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
        .get('/curated/requirement-comparison', {
          params: { school_id, major: majorName, community_college_id },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && enabled && ready,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
}

// Remaining built-in visual analyses share one scoped, cacheable query shape.
// choice-cost is the exception: schoolIds is ordered because each step measures
// the incremental cost of adding that campus to the student's options.
function useAnalysisEndpoint(key, path, params = {}, options = {}) {
  const { user } = useAuth()
  // majorSlug is the current way to scope an analysis; majorContains is the
  // older free-text filter, kept for callers that still pass one.
  const majorSlug = String(params.majorSlug || '').trim()
  const majorContains = String(params.majorContains || '').trim()
  const schoolIds = (params.schoolIds || []).map(Number).filter(Number.isFinite)
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: [key, user?.uid, majorSlug, majorContains, schoolIds.join(',')],
    queryFn: () =>
      apiClient
        .get(path, {
          params: {
            ...(majorSlug ? { majorSlug } : {}),
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

// Joint, order-independent preparation plan for one or more UC campuses.
// Unlike choice-cost, `schoolIds` is a set: sorting it here keeps equivalent
// selections on one cache entry. College mode stays disabled until a college
// is selected, so opening the visual never sends an invalid request.
export function useMultiCampusPathways(params = {}, options = {}) {
  const { user } = useAuth()
  const majorSlug = String(params.majorSlug || 'cs').trim()
  const schoolIds = [...new Set((params.schoolIds || [])
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0))]
    .sort((a, b) => a - b)
  const mode = params.mode === 'college' ? 'college' : 'average'
  const communityCollegeId = Number(params.communityCollegeId)
  const semesterLoad = Number(params.semesterLoad) || 15
  const quarterLoad = Number(params.quarterLoad) || 15
  const { enabled = true, ...queryOptions } = options
  const hasCollege = Number.isFinite(communityCollegeId) && communityCollegeId > 0
  const ready = schoolIds.length > 0
    && (mode === 'average' || hasCollege)

  return useQuery({
    queryKey: [
      'analysis-multi-campus-pathways', 'v2', user?.uid, mode,
      majorSlug,
      schoolIds.join(','), mode === 'college' ? communityCollegeId : null,
      semesterLoad, quarterLoad,
    ],
    queryFn: () => apiClient
      .get('/analysis/multi-campus-pathways', {
        params: {
          schoolIds: schoolIds.join(','),
          majorSlug,
          mode,
          ...(mode === 'college' ? { communityCollegeId } : {}),
          semesterLoad,
          quarterLoad,
        },
      })
      .then((r) => r.data),
    enabled: !!user?.uid && enabled && ready,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    ...queryOptions,
  })
}

// One manually generated artifact contains every non-empty combination of the
// nine configured UC goals. A mount refresh checks for a newly generated file,
// while the previously persisted artifact remains renderable during that
// request. Campus switching itself never creates another query.
export function useMultiCampusPathwaysSnapshot(options = {}) {
  const { user } = useAuth()
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: ['analysis-multi-campus-pathways-snapshot', 'v1', user?.uid],
    queryFn: () => apiClient
      .get('/analysis/multi-campus-pathways/snapshot')
      .then((response) => response.data),
    enabled: !!user?.uid && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      const status = Number(error?.response?.status)
      if ([401, 403, 409].includes(status)) return false
      return failureCount < 2
    },
    ...queryOptions,
  })
}

// ── editable curated/reference data ──

const REQUIREMENT_KIND = {
  transfer_minimums: 'transfer_minimum',
  ge_patterns: 'ge_pattern',
  igetc_areas: 'igetc',
  prereq_concepts: 'prereq_concept',
}

export function useRefTable(table) {
  const { user } = useAuth()
  const safeTable = String(table || '').trim()
  return useQuery({
    queryKey: ['ref-table', safeTable, user?.uid],
    queryFn: async () => {
      if (safeTable === 'community_college_geography') {
        const { data } = await apiClient.get('/assist/institutions', { params: { kind: 'community_college' } })
        return {
          rows: data.rows.map((row) => ({
            ...row,
            _id: row.source_id,
            community_college: row.name,
          })),
        }
      }
      if (safeTable === 'course_prerequisites') {
        const { data } = await apiClient.get('/curated/prerequisites')
        return data
      }
      const kind = REQUIREMENT_KIND[safeTable]
      if (!kind) throw new Error(`Unknown curated resource: ${safeTable}`)
      const { data } = await apiClient.get('/curated/requirements', { params: { kind } })
      return data
    },
    enabled: !!user?.uid && !!safeTable,
    staleTime: 60 * 1000,
  })
}

// Hand-gathered full-degree requirements enriched into the agreement shape the
// shared ledger renders directly.
export function useDegreeRequirements() {
  const { user } = useAuth()
  return useQuery({
    // Bump the version whenever the response shape changes so a persisted
    // (IndexedDB) response from an older shape can't hydrate and crash the tab.
    queryKey: ['degree-requirements', 'v4', user?.uid],
    queryFn: () => apiClient.get('/curated/degrees').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

// Canonical, un-enriched degree documents. The structured editor works on this
// shape so saving never persists display-only category counts or CC matches.
export function useDegreeRequirementDocuments() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['degree-requirement-documents', user?.uid],
    queryFn: () => apiClient
      .get('/curated/requirements', { params: { kind: 'degree' } })
      .then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useSaveDegreeRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (document) => apiClient
      .put('/curated/requirements/degree', document)
      .then((r) => r.data),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['degree-requirement-documents'] }),
        qc.invalidateQueries({ queryKey: ['degree-requirements'] }),
        qc.invalidateQueries({ queryKey: ['degree-evaluation'] }),
        qc.invalidateQueries({
          predicate: (query) => String(query.queryKey[0] || '').startsWith('analysis-'),
        }),
      ])
    },
  })
}

// One degree evaluated against one community college: the merged ledger + the
// share of the four-year degree that transfers. 404s (no template for a campus)
// don't retry — the caller shows an empty state.
export function useDegreeEvaluation(schoolId, collegeId, majorSlug, options = {}) {
  const { user } = useAuth()
  const sid = Number(schoolId)
  const cid = Number(collegeId)
  const slug = String(majorSlug || '').trim()
  const ready = Number.isFinite(sid) && Number.isFinite(cid) && !!slug
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: ['degree-evaluation', user?.uid, sid, cid, slug],
    queryFn: () =>
      apiClient
        .get('/curated/degree-evaluation', {
          params: { school_id: sid, community_college_id: cid, majorSlug: slug },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && ready && enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
    ...queryOptions,
  })
}

const invalidateCuratedData = (qc, safeTable) => Promise.all([
  qc.invalidateQueries({ queryKey: ['ref-table', safeTable] }),
  qc.invalidateQueries({ queryKey: ['prereq-graph'] }),
  qc.invalidateQueries({
    predicate: (query) => String(query.queryKey[0] || '').startsWith('analysis-'),
  }),
  qc.invalidateQueries({ queryKey: ['degree-evaluation'] }),
])

export function useSaveRefRow(table) {
  const qc = useQueryClient()
  const safeTable = String(table || '').trim()
  return useMutation({
    mutationFn: (row) => {
      if (safeTable === 'community_college_geography') {
        return apiClient.put(`/assist/institutions/cc:${row._id}`, row).then((r) => r.data)
      }
      if (safeTable === 'course_prerequisites') {
        return apiClient.put('/curated/prerequisites', row).then((r) => r.data)
      }
      return apiClient.put(`/curated/requirements/${REQUIREMENT_KIND[safeTable]}`, row).then((r) => r.data)
    },
    onSuccess: () => invalidateCuratedData(qc, safeTable),
  })
}

export function useDeleteRefRow(table) {
  const qc = useQueryClient()
  const safeTable = String(table || '').trim()
  return useMutation({
    mutationFn: (id) => {
      if (safeTable === 'community_college_geography') {
        return apiClient.delete(`/assist/institutions/cc:${id}/profile`).then((r) => r.data)
      }
      if (safeTable === 'course_prerequisites') {
        return apiClient.delete(`/curated/prerequisites/${encodeURIComponent(id)}`).then((r) => r.data)
      }
      const kind = REQUIREMENT_KIND[safeTable]
      return apiClient.delete(`/curated/requirements/${kind}/${encodeURIComponent(id)}`).then((r) => r.data)
    },
    onSuccess: () => invalidateCuratedData(qc, safeTable),
  })
}

export function usePrereqGraph(collegeId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['prereq-graph', user?.uid, collegeId ?? 'all'],
    queryFn: () => apiClient
      .get('/curated/prerequisite-graph', {
        params: collegeId != null ? { college_id: `cc:${collegeId}` } : {},
      })
      .then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useSaveCourseConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, concept, note, language }) => apiClient
      .put(`/assist/courses/${encodeURIComponent(id)}/concept`, { concept, note, language })
      .then((r) => r.data),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['prereq-graph'] }),
      qc.invalidateQueries({ queryKey: ['cc-courses'] }),
      qc.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] || '').startsWith('analysis-'),
      }),
    ]),
  })
}

// Data → Associate Degrees: statewide record QA, optionally isolated to one
// stable category. The CS A.S.-T view uses the server filter so the response
// itself — not just the rendered rows — is the analysis cohort. `major`
// defaults to the server's own default ('cs') and must ride the query key —
// otherwise two majors would share one cache entry.
export function useAsDegrees(degreeType = null, major = 'cs') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degrees', user?.uid, degreeType || 'all', major],
    queryFn: () => apiClient
      .get('/curated/as-degrees', { params: { major, ...(degreeType ? { degree_type: degreeType } : {}) } })
      .then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useAsDegreeAvailability() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degree-availability', user?.uid],
    queryFn: () => apiClient.get('/curated/as-degree-availability').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

// Per-college, per-major associate-degree verification state (verified /
// present / absent), derived from the stored records alone so every major is
// covered — powers the Overview landscape, the Community Colleges list dots,
// and the college drill-in header.
export function useAsDegreeVerification() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degree-verification', user?.uid],
    queryFn: () => apiClient.get('/curated/as-degree-verification').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useAsDegreeDetail(collegeId, major = 'cs') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['as-degree-detail', user?.uid, collegeId, major],
    queryFn: () => apiClient
      .get('/curated/as-degrees', { params: { college_id: collegeId, major } })
      .then((r) => r.data),
    enabled: !!user?.uid && !!collegeId,
    staleTime: 60 * 1000,
  })
}

// Admin-only hand-edit history for one verified document (as_degree or degree),
// newest first — who saved, when, and the field-level changes. Gate the call on
// the caller's admin role via `enabled`.
export function useRequirementRevisions(kind, id, { enabled = true } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['requirement-revisions', user?.uid, kind, id],
    queryFn: () => apiClient
      .get(`/curated/requirements/${kind}/${encodeURIComponent(id)}/revisions`)
      .then((r) => r.data),
    enabled: !!user?.uid && enabled && !!kind && !!id,
    staleTime: 30 * 1000,
  })
}

export function useSaveAsDegree() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (doc) => apiClient.put('/curated/requirements/as_degree', doc).then((r) => r.data),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['as-degrees'] }),
      qc.invalidateQueries({ queryKey: ['as-degree-availability'] }),
      qc.invalidateQueries({ queryKey: ['as-degree-verification'] }),
      qc.invalidateQueries({ queryKey: ['as-degree-detail'] }),
    ]),
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
    queryFn: () => apiClient.get('/gallery').then((r) => r.data),
    enabled: !!user?.uid,
    // Teammates publish from their notebooks while the tab is open.
    refetchInterval: 30 * 1000,
  })
}

export function useDeleteFigure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug) => apiClient.delete(`/gallery/${slug}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['figures'] }),
  })
}

// Metadata-only edit (title/caption/source_url). The image itself changes only
// by re-publishing the slug from the notebook. Owner-or-admin, enforced server-side.
export function useEditFigure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, fields }) => apiClient.patch(`/gallery/${slug}`, fields).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['figures'] }),
  })
}

// starter.py client, base URL baked in server-side. staleTime 0 → refetch on mount
// so redeploys show up (cache persists to IndexedDB; stale-forever would survive
// reloads).
export function usePmtPy() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['starter-py', user?.uid],
    queryFn: () => apiClient.get('/client.py', { responseType: 'text' }).then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 0,
  })
}

// Browser download of a figure format (needs the auth header, so no <a href>).
export async function downloadFigure(slug, format) {
  const res = await apiClient.get(`/gallery/${slug}/${format}`, { responseType: 'blob' })
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

const putTaskInCache = (queryClient, task) => {
  queryClient.setQueriesData({ queryKey: ['tasks'] }, (old) => {
    if (!old?.rows) return old
    return { ...old, rows: old.rows.map((row) => (row._id === task._id ? task : row)) }
  })
}

export function useAddTaskStageNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage, note }) =>
      apiClient.post(`/tasks/${id}/stages/${stage}/notes`, { note }).then((response) => response.data),
    onSuccess: (task) => putTaskInCache(qc, task),
  })
}

export function useCompleteTaskStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage, note }) =>
      apiClient.post(`/tasks/${id}/stages/${stage}/complete`, { note }).then((response) => response.data),
    onSuccess: (task) => putTaskInCache(qc, task),
  })
}

export function useReopenTaskStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage, note }) =>
      apiClient.post(`/tasks/${id}/stages/${stage}/reopen`, { note }).then((response) => response.data),
    onSuccess: (task) => putTaskInCache(qc, task),
  })
}

// Stage-note management (log-only). Authors may delete their own review notes.
// Owners resolve somebody else's note; authors may resolve their own only on a
// task they do not own. Both mutations return the updated task.
export function useDeleteTaskStageNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, logId }) =>
      apiClient.delete(`/tasks/${id}/log/${logId}`).then((response) => response.data),
    onSuccess: (task) => putTaskInCache(qc, task),
  })
}

export function useResolveTaskStageNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, logId, resolved }) =>
      apiClient.post(`/tasks/${id}/log/${logId}/resolve`, { resolved }).then((response) => response.data),
    onSuccess: (task) => putTaskInCache(qc, task),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete(`/tasks/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
