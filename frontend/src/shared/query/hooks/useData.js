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
    queryKey: ['colleges', user?.uid],
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
  const { enabled = true, ...queryOptions } = options
  return useQuery({
    queryKey: ['analysis-coverage', user?.uid, majorContains, groupBy, requirements],
    queryFn: () =>
      apiClient
        .get('/analysis/coverage', {
          params: {
            ...(majorContains ? { majorContains } : {}),
            ...(groupBy !== 'college' ? { groupBy } : {}),
            ...(requirements !== 'assist' ? { requirements } : {}),
          },
        })
        .then((r) => r.data),
    enabled: !!user?.uid && enabled,
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
  })
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

// The pmt.py client, served by the API with the base URL baked in.
export function usePmtPy() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pmt-py', user?.uid],
    queryFn: () => apiClient.get('/client/pmt.py', { responseType: 'text' }).then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: Infinity,
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
