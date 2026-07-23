import React, { createContext, useContext, useMemo } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useMajors, CS_FALLBACK } from './useMajors'

// The onboarded majors, fetched once and shared. The provider deliberately
// holds NO selected major: each surface asks a different question — what does
// this college offer in Biology, what does Berkeley require for Economics —
// so each keeps its own choice via useMajorChoice().

const MajorContext = createContext(null)

export function MajorProvider({ children }) {
  const { majors, defaultSlug, bySlug, isLoading } = useMajors()
  const value = useMemo(
    () => ({ majors, defaultSlug, bySlug, isLoading }),
    [majors, defaultSlug, bySlug, isLoading],
  )
  return <MajorContext.Provider value={value}>{children}</MajorContext.Provider>
}

// Outside a provider there is nothing to fetch against, so this is a plain
// constant rather than a second query — it keeps every consuming component
// renderable on its own, without a QueryClient.
const NO_PROVIDER = {
  majors: CS_FALLBACK,
  defaultSlug: CS_FALLBACK[0].slug,
  bySlug: new Map(CS_FALLBACK.map((m) => [m.slug, m])),
  isLoading: false,
}

/** The onboarded majors. Safe outside a MajorProvider. */
export function useMajorSelection() {
  return useContext(MajorContext) ?? NO_PROVIDER
}

/**
 * One surface's chosen major, kept independent of every other surface.
 *
 * `scope` names the surface ('colleges', 'campuses', 'visuals'); surfaces
 * sharing a scope share a choice, which is what keeps the Visuals gallery
 * internally consistent. The choice survives navigation within the tab but is
 * always re-validated against the majors the server currently offers, so a
 * remembered slug can't outlive the major it names.
 */
export function useMajorChoice(scope) {
  const { majors, defaultSlug, bySlug } = useMajorSelection()
  const [stored, setSlug] = usePersistedState(`major-choice:${scope}`, null)
  const slug = bySlug.has(stored) ? stored : defaultSlug
  return { slug, setSlug, major: bySlug.get(slug) || null, majors }
}
