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

export function useGrantAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiClient.post('/admin/access', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-access'] }),
  })
}

export function useRevokeAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uid) => apiClient.delete(`/admin/access/${uid}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-access'] }),
  })
}
