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
export const CS_FALLBACK = [{
  slug: 'cs',
  label: 'Computer Science',
  // Fail closed to the canonical CS campus/program pairs while the server
  // config is loading or unavailable. A substring fallback would reintroduce
  // adjacent CS programs into the data browser.
  programs: {
    7: ['CSE: Computer Science B.S.'],
    46: ['Computer Science, B.S.'],
    79: ['Electrical Engineering & Computer Sciences, B.S.'],
    89: ['Computer Science B.S.'],
    117: ['Computer Science/B.S.'],
    120: ['Computer Science, B.S.'],
    128: ['Computer Science, B.S.'],
    132: ['Computer Science B.S.'],
    144: ['COMPUTER SCIENCE AND ENGINEERING, B.S. '],
  },
  capabilities: {
    asDegrees: true, paperBaselines: true, transferMinimums: true,
    degreeTemplates: true, snapshots: [],
  },
}]

export function useMajors() {
  const { user } = useAuth()
  const query = useQuery({
    // Versioned so an entry persisted by an older build (before the
    // capability flags existed) can never hydrate this shape.
    queryKey: ['majors', 'v2', user?.uid],
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
