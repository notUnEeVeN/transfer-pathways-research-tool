import React, { createContext, useContext, useMemo } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useMajors, CS_FALLBACK } from './useMajors'

// The console's current major. Selection is contextual — each surface renders
// its own picker — but the choice is shared so moving between Data, Visuals and
// Audit keeps the major you were looking at.

const MajorContext = createContext(null)

export function MajorProvider({ children }) {
  const { majors, defaultSlug, bySlug, isLoading } = useMajors()
  const [stored, setSlug] = usePersistedState('major-selection', null)
  // A stored slug can outlive the major it names (config edit, revoked
  // access), so always resolve against what the server currently offers.
  const slug = bySlug.has(stored) ? stored : defaultSlug

  const value = useMemo(
    () => ({ slug, setSlug, major: bySlug.get(slug) || null, majors, isLoading }),
    [slug, setSlug, bySlug, majors, isLoading],
  )
  return <MajorContext.Provider value={value}>{children}</MajorContext.Provider>
}

// Outside a provider there is nothing to fetch against, so this is a plain
// constant rather than a second query — it keeps every consuming component
// renderable on its own, without a QueryClient.
const NO_PROVIDER = {
  slug: CS_FALLBACK[0].slug,
  setSlug: () => {},
  major: CS_FALLBACK[0],
  majors: CS_FALLBACK,
  isLoading: false,
}

/**
 * The selected major. Safe outside a MajorProvider, where it reports the single
 * long-standing major so a component can be rendered in isolation.
 */
export function useMajorSelection() {
  return useContext(MajorContext) ?? NO_PROVIDER
}
