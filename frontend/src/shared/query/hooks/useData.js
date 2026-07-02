import { useQuery } from '@tanstack/react-query'
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
