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
    // Version the cached shape so clients do not briefly render the legacy
    // flat distinct-major payload after the coverage inventory ships.
    queryKey: ['admin-dataset', 'coverage-v2', user?.uid],
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

export function useVisualSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['visual-settings', user?.uid],
    queryFn: () => apiClient.get('/analysis/releases').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  })
}

export function useSetPublishedVisuals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids) => apiClient.put('/admin/analysis-releases', { released_ids: ids }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visual-settings'] }),
  })
}

export function useSetHiddenVisuals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids) => apiClient.put('/admin/analysis-disabled', { disabled_ids: ids }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visual-settings'] }),
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

// ── team display names (admin) ──

export function useTeam() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-team', user?.uid],
    queryFn: () => apiClient.get('/admin/team').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  })
}

// Audit pulse — read-only auditing activity for the admin page (10 weeks of
// verdict volume, this week's per-person split, and what was caught).
export function useAuditPulse() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['admin-audit-pulse', user?.uid],
    queryFn: () => apiClient.get('/admin/audit-pulse').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

export function useSetTeamName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uid, name }) => apiClient.put(`/admin/team/${uid}`, { name }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-team'] })
      // Names feed the task assignee picker and any resolved author label.
      qc.invalidateQueries({ queryKey: ['task-roster'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['figures'] })
    },
  })
}
