import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/apiClient'
import { useAuth } from '../hooks/useAuth'

// The onboarded majors, from GET /api/majors. The server config is the single
// source of truth, so there is no mirrored client-side copy of program pins,
// category vocabularies, or capability flags.

// If the request fails the console still has to render, so fall back to the
// major that has always been there. Capabilities are permissive here: the CS
// dataset supports every figure, and gating off a failed fetch would hide
// working views. URL-backed surfaces also receive `isError`, allowing them to
// pause rather than mistake this resilience fallback for a validated deep link.
export const CS_FALLBACK = [{
  slug: 'cs',
  label: 'Computer Science (CA)',
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
  // Identity rollup: the Computer Science typing module's four categories are
  // already the MA figure's four columns, and there is no extended variant.
  courseTypes: {
    module: 'cs',
    excludeGeGroups: true,
    axes: {
      faithful: [
        { key: 'computing', label: 'Computing', categories: ['computing'] },
        { key: 'math', label: 'Math', categories: ['math'] },
        { key: 'science', label: 'Science', categories: ['science'] },
        { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
      ],
    },
  },
  degreeTemplateEvidence: {
    total: 9,
    explicitlyVerified: 9,
    catalogYears: 'not recorded on the legacy CS templates',
    staleResearchStatus: 0,
  },
  capabilities: {
    assistAgreements: true,
    caCreditLossArtifact: true,
    agreementPathways: true,
    asDegrees: true, paperBaselines: true, transferMinimums: true,
    degreeTemplates: true, courseCategories: true, courseTypeFigures: true,
    prerequisites: true,
    snapshots: [],
  },
}]

export function useMajors({ state } = {}) {
  const { user } = useAuth()
  const query = useQuery({
    // Versioned so an entry persisted by an older build (before the
    // capability flags existed) can never hydrate this shape.
    // v5 adds proof-aware per-agreement pathway readiness. A persisted older
    // response must not make an exploratory solver card appear ready (or hide
    // the audited CS version) until the browser cache expires.
    // v6 adds the unitCoverage capability: a stale payload without it would
    // re-open the California unit lenses on the Massachusetts heatmap.
    // v7 carries the course-type GE-denominator flag into comparison
    // contracts; an older cached major would falsely describe the same server
    // results as GE-inclusive and either refuse or mislabel Figure 2.
    // v8 carries the audited bachelor-template verification/catalog receipt.
    queryKey: ['majors', 'v8', state ?? 'ca', user?.uid],
    queryFn: () => apiClient
      .get('/majors', { params: state ? { state } : {} })
      .then((r) => r.data),
    enabled: !!user?.uid,
    staleTime: Infinity,
  })
  // The CS resilience fallback is a California shape; a state corpus that
  // fails to load must surface as empty + isError, never as California CS.
  const fallback = state ? [] : CS_FALLBACK
  const majors = query.data?.majors?.length ? query.data.majors : fallback
  return {
    majors,
    defaultSlug: query.data?.default || fallback[0]?.slug || null,
    bySlug: new Map(majors.map((m) => [m.slug, m])),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error || null,
  }
}
