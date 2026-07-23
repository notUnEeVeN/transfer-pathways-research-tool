import React, { createContext, useContext, useMemo } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useMajors } from './useMajors'

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

/**
 * The selected major. Safe outside a MajorProvider — falls back to the first
 * onboarded major so a component can be rendered in isolation (tests, stories).
 */
export function useMajorSelection() {
  const ctx = useContext(MajorContext)
  const fallback = useMajors()
  if (ctx) return ctx
  return {
    slug: fallback.defaultSlug,
    setSlug: () => {},
    major: fallback.bySlug.get(fallback.defaultSlug) || null,
    majors: fallback.majors,
    isLoading: fallback.isLoading,
  }
}
