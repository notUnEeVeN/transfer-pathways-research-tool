import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/apiClient'
import { useAuth } from '../hooks/useAuth'

// The onboarded majors, from GET /api/majors. The server config is the single
// source of truth, so there is no mirrored client-side copy of program pins,
// category vocabularies, or capability flags.

// If the request fails the console still has to render, so fall back to the
// major that has always been there. Capabilities are permissive here: the CS
// dataset supports every figure, and gating off a failed fetch would hide
// working views.
const CS_FALLBACK = [{
  slug: 'cs',
  label: 'Computer Science',
  capabilities: { asDegrees: true, paperBaselines: true, transferMinimums: true, snapshots: [] },
}]

export function useMajors() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['majors', user?.uid],
    queryFn: () => apiClient.get('/majors').then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: Infinity,
  })
  const majors = query.data?.majors?.length ? query.data.majors : CS_FALLBACK
  return {
    majors,
    defaultSlug: query.data?.default || CS_FALLBACK[0].slug,
    bySlug: new Map(majors.map((m) => [m.slug, m])),
    isLoading: query.isLoading,
  }
}
