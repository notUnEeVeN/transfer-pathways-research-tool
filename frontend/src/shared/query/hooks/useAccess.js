import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/apiClient'
import { useAuth } from '../../hooks/useAuth'

// Role + admin data hooks for the research console. The server is the security
// boundary — these only decide what UI to render.

export function useAccessMe() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['access-me', user?.uid],
    queryFn: () => apiClient.get('/access/me').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: Infinity,
    retry: false,
    // While denied (403), keep knocking every 10s — the moment an admin grants
    // access, the query flips to success and the console unlocks without a
    // reload. While allowed, re-check every 45s so a revoked/blocked account is
    // bounced back to the denied screen within a minute (no reload needed).
    refetchInterval: (query) => (query.state.status === 'error' ? 10_000 : 45_000),
  })
}

// Files (or refreshes) the caller's sign-in request — used by the denied
// screen so the admin sees the attempt under Admin → Sign-in requests.
export function useRequestAccess() {
  return useMutation({
    mutationFn: () => apiClient.post('/access/request').then((r) => r.data),
  })
}

export function useAccessRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-access-requests', user?.uid],
    queryFn: () => apiClient.get('/admin/access-requests').then((r) => r.data),
    enabled: !!user?.uid,
    // New sign-in attempts should appear while the admin has the page open.
    refetchInterval: 15 * 1000,
  })
}

export function useDismissAccessRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uid) => apiClient.delete(`/admin/access-requests/${uid}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-access-requests'] }),
  })
}

// Reject a sign-in request → deny-list. Clears the request, revokes any live
// grant, and stops the account from re-requesting (its screen shows "declined").
export function useBlockAccessRequest() {
  const qc = useQueryClient()
  return useMutation({
    // body: { uid, email, name } — email/name are display labels only.
    mutationFn: (body) => apiClient.post('/admin/access-blocks', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-access-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-access-blocks'] })
      qc.invalidateQueries({ queryKey: ['admin-access'] }) // block revokes any grant
    },
  })
}

export function useBlockedAccounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-access-blocks', user?.uid],
    queryFn: () => apiClient.get('/admin/access-blocks').then((r) => r.data),
    enabled: !!user?.uid,
  })
}

export function useUnblockAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uid) => apiClient.delete(`/admin/access-blocks/${uid}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-access-blocks'] }),
  })
}

export function useAdminDataset() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-dataset', user?.uid],
    queryFn: () => apiClient.get('/admin/dataset').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useAdminAccessList() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-access', user?.uid],
    queryFn: () => apiClient.get('/admin/access').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  })
}

export function useVisibleMajors() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-visible-majors', user?.uid],
    queryFn: () => apiClient.get('/admin/visible-majors').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  })
}

export function useSetVisibleMajors() {
  const qc = useQueryClient()
  return useMutation({
    // pairs: [{ school_id, major }] — visibility is per school+major.
    mutationFn: (pairs) => apiClient.put('/admin/visible-majors', { pairs }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-visible-majors'] }),
  })
}

// Which live analyses are released to partners (Data → Analysis tab). Console-
// gated read, same result for everyone — the Data page filters unreleased ones
// out for partners and badges Draft/Released for admins.
export function useAnalysisReleases() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['analysis-releases'],
    queryFn: () => apiClient.get('/analysis/releases').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  })
}

export function useSetAnalysisReleases() {
  const qc = useQueryClient()
  return useMutation({
    // releasedIds: string[] — the full set of released analysis ids.
    mutationFn: (releasedIds) =>
      apiClient.put('/admin/analysis-releases', { released_ids: releasedIds }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analysis-releases'] }),
  })
}

// Dataset refresh (admin): background job on the server; poll while running.
export function useRefreshStatus() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-refresh-status', user?.uid],
    queryFn: () => apiClient.get('/admin/refresh-dataset').then((r) => r.data),
    enabled: !!user?.uid,
    refetchInterval: (query) => (query.state.data?.running ? 1500 : false),
  })
}

export function useStartRefresh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/admin/refresh-dataset').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-refresh-status'] }),
  })
}

export function useGrantAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiClient.post('/admin/access', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-access'] })
      // Granting clears the uid's pending sign-in request and any prior block.
      qc.invalidateQueries({ queryKey: ['admin-access-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-access-blocks'] })
    },
  })
}

export function useRevokeAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uid) => apiClient.delete(`/admin/access/${uid}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-access'] }),
  })
}
