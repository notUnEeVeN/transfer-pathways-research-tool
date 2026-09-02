import { useLayoutEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/apiClient'
import { useAuth } from '../hooks/useAuth'

export const VA_PUBLICATION_POLL_MS = 15 * 1000

// Publication identities are intentionally session-local. Computed analyses
// are not persisted, but degree/prerequisite queries are; treating the first
// Virginia registry response in a browser session as a transition guarantees
// those older entries are cleared before they can be reused.
const publicationIdentityByClient = new WeakMap()

const text = (value) => (typeof value === 'string' ? value.trim() : '')
const isVirginiaSlug = (value, knownSlugs = new Set()) => {
  const slug = text(value)
  return knownSlugs.has(slug) || slug === 'va-cs' || slug.startsWith('va-')
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`
  }
  return JSON.stringify(value)
}

function gatedVirginiaMajors(payload) {
  const majors = Array.isArray(payload?.majors) ? payload.majors : []
  return majors.filter((major) => (
    major?.state === 'va'
    || isVirginiaSlug(major?.slug)
  ))
}

/**
 * Exact client-side identity of the server's Virginia publication decision.
 * The full receipt status is included (not only generation_id), so a changed
 * projection/evaluator/prerequisite hash revokes data even if a malformed
 * publisher accidentally reuses a generation label.
 */
export function virginiaPublicationIdentity(payload, { registryUnavailable = false } = {}) {
  const majors = gatedVirginiaMajors(payload)
  const slugs = new Set(majors.map((major) => text(major?.slug)).filter(Boolean))
  if (!slugs.size) slugs.add('va-cs')

  if (registryUnavailable || majors.length === 0) {
    return {
      ready: false,
      slugs,
      signature: registryUnavailable
        ? 'virginia-major-registry-unavailable'
        : 'virginia-publication-status-missing',
    }
  }

  const statuses = majors.map((major) => {
    const slug = text(major?.slug)
    const contract = text(major?.publicationGate?.contract)
    const publication = major?.analysisPublication
    return {
      slug,
      contract,
      publication: publication && typeof publication === 'object' ? publication : null,
      ready: Boolean(
        contract
        && publication?.ready === true
        && text(publication?.contract) === contract
        && text(publication?.major_slug) === slug
      ),
    }
  }).sort((left, right) => left.slug.localeCompare(right.slug))

  return {
    ready: statuses.every((status) => status.ready),
    slugs,
    signature: canonicalJson(statuses),
  }
}

/** True only for cache entries whose key proves that they derive from VA. */
export function isVirginiaDerivedQuery(query, knownSlugs = new Set(['va-cs'])) {
  const key = query?.queryKey
  if (!Array.isArray(key)) return false
  const root = text(key[0])
  const hasVirginiaSlug = key.some((part) => isVirginiaSlug(part, knownSlugs))

  if (root.startsWith('analysis-')) return hasVirginiaSlug
  if (root === 'degree-evaluation' || root === 'prereq-graph') return hasVirginiaSlug

  // /curated/degrees is a computed, mixed-state response with no slug in its
  // cache key. Drop that response as a whole so its VA rows cannot survive a
  // receipt transition; the raw degree-requirement-documents editor cache is
  // deliberately not matched.
  if (root === 'degree-requirements') return true

  // These are the Virginia corpus's statewide and institution-projected
  // prerequisite views. They are state-exclusive even though their keys use
  // institution names rather than a major slug.
  return root === 'va' && text(key[1]).startsWith('prerequisite-graph:')
}

export function removeVirginiaDerivedQueries(queryClient, knownSlugs) {
  const predicate = (query) => isVirginiaDerivedQuery(query, knownSlugs)
  // Start cancellation before removing the entries, so an in-flight response
  // from the revoked generation cannot land back in the cache afterward.
  const cancellation = queryClient.cancelQueries({ predicate }, { silent: true })
  if (cancellation?.catch) cancellation.catch(() => {})
  queryClient.removeQueries({ predicate })
}

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
  const queryClient = useQueryClient()
  const normalizedState = text(state).toLowerCase()
  const containsVirginia = normalizedState === 'va' || normalizedState === 'all'
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
    // v9 carries the major-scoped analysis-publication receipt. A cached v8
    // Virginia entry has no gate metadata and would otherwise look ready from
    // its static schema capabilities alone.
    queryKey: ['majors', 'v9', state ?? 'ca', user?.uid],
    queryFn: () => apiClient
      .get('/majors', { params: state ? { state } : {} })
      .then((r) => r.data),
    enabled: !!user?.uid,
    // California and Massachusetts retain their fetch-once registry policy.
    // A Virginia-containing registry is also the revocation channel for its
    // publication receipt, so an open tab rechecks it at a bounded interval.
    ...(containsVirginia
      ? {
          staleTime: VA_PUBLICATION_POLL_MS,
          refetchInterval: VA_PUBLICATION_POLL_MS,
          refetchIntervalInBackground: true,
        }
      : { staleTime: Infinity }),
  })

  const registryUnavailable = containsVirginia
    && Boolean(query.isError || query.isRefetchError)
  const publicationIdentity = containsVirginia
    ? virginiaPublicationIdentity(query.data, { registryUnavailable })
    : null

  // A layout effect runs before child passive effects (notably Compare's
  // CellSource reporter). That closes the ready-A -> ready-B window in which a
  // child could otherwise publish cells from A after seeing registry B.
  useLayoutEffect(() => {
    if (!containsVirginia || !user?.uid || !publicationIdentity) return
    let identities = publicationIdentityByClient.get(queryClient)
    if (!identities) {
      identities = new Map()
      publicationIdentityByClient.set(queryClient, identities)
    }
    const identityKey = String(user.uid)
    const previous = identities.get(identityKey)
    if (previous !== publicationIdentity.signature || !publicationIdentity.ready) {
      removeVirginiaDerivedQueries(queryClient, publicationIdentity.slugs)
    }
    identities.set(identityKey, publicationIdentity.signature)
  }, [
    containsVirginia,
    publicationIdentity?.ready,
    publicationIdentity?.signature,
    queryClient,
    user?.uid,
  ])

  // The CS resilience fallback is a California shape; a state corpus that
  // fails to load must surface as empty + isError, never as California CS.
  const fallback = state ? [] : CS_FALLBACK
  const sourceMajors = query.data?.majors?.length ? query.data.majors : fallback
  // A background registry failure cannot leave a previously ready VA receipt
  // authoritative. Preserve non-VA entries in an `all` registry, but expose
  // each gated VA major as unavailable until a fresh status response lands.
  const majors = registryUnavailable
    ? sourceMajors.map((major) => (gatedVirginiaMajors({ majors: [major] }).length
        ? {
            ...major,
            analysisPublication: {
              ...(major.analysisPublication || {}),
              ready: false,
              blocker: 'virginia_publication_status_unavailable',
              issues: [{ code: 'major_registry_request_failed' }],
            },
          }
        : major))
    : sourceMajors
  return {
    majors,
    defaultSlug: query.data?.default || fallback[0]?.slug || null,
    bySlug: new Map(majors.map((m) => [m.slug, m])),
    isLoading: query.isLoading,
    isError: query.isError || (normalizedState === 'va' && query.isRefetchError),
    error: query.error || null,
  }
}
