import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/apiClient'
import { useAuth } from '../../hooks/useAuth'

// Saved comparisons — team working state on the audit handle, alongside tasks
// and published figures.
//
// The root key is deliberately NOT `analysis-` prefixed: these are documents,
// not computed analyses, so the curated-save invalidation predicate must not
// flush them. It is also excluded from IndexedDB persistence in
// shared/query/client.js — a note written a minute ago must never be shadowed
// on the next paint by a 24h-old copy of the document it lives in.

const ROOT = 'comparisons'

const listKey = (uid, fingerprint) => [ROOT, 'v1', uid, fingerprint ?? '']
const docKey = (uid, id) => [ROOT, 'v1', uid, 'doc', id]

export function useComparisonList({ fingerprint = null } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: listKey(user?.uid, fingerprint),
    queryFn: () => apiClient
      .get('/comparisons', { params: fingerprint ? { fingerprint } : {} })
      .then((r) => r.data),
    enabled: !!user?.uid,
  })
}

// staleTime 0: a comparison is read to be argued from, so an open workspace
// must never show a version of the notes older than this mount.
export function useComparison(id) {
  const { user } = useAuth()
  return useQuery({
    queryKey: docKey(user?.uid, id),
    queryFn: () => apiClient.get(`/comparisons/${encodeURIComponent(id)}`).then((r) => r.data),
    enabled: !!user?.uid && !!id,
    staleTime: 0,
  })
}

// Every write answers with the whole document, so the open workspace is fed
// from the response before the refetch lands — a note must appear under the
// number the moment it is written, not one round trip later.
function useComparisonMutation(mutationFn) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      if (data?.comparison?._id) qc.setQueryData(docKey(user?.uid, data.comparison._id), data)
      qc.invalidateQueries({ queryKey: [ROOT] })
    },
  })
}

// POST when the draft has no id yet, PATCH once it does. The metadata PATCH
// never carries `notes` — the server strips the key too, so a save from either
// side is structurally incapable of clobbering prose.
export function useSaveComparison() {
  return useComparisonMutation(({ id = null, body }) => (id
    ? apiClient.patch(`/comparisons/${encodeURIComponent(id)}`, body).then((r) => r.data)
    : apiClient.post('/comparisons', body).then((r) => r.data)))
}

export function useDeleteComparison() {
  return useComparisonMutation((id) => apiClient.delete(`/comparisons/${encodeURIComponent(id)}`).then((r) => r.data))
}

// Note text travels byte-exact: nothing here trims, templates, or normalizes
// it, and nothing here ever authors one.
export function useAddNote() {
  return useComparisonMutation(({ id, text, anchor = null }) => apiClient
    .post(`/comparisons/${encodeURIComponent(id)}/notes`, { text, anchor })
    .then((r) => r.data))
}

export function useEditNote() {
  return useComparisonMutation(({ id, noteId, text }) => apiClient
    .patch(`/comparisons/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`, { text })
    .then((r) => r.data))
}

export function useDeleteNote() {
  return useComparisonMutation(({ id, noteId }) => apiClient
    .delete(`/comparisons/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`)
    .then((r) => r.data))
}
