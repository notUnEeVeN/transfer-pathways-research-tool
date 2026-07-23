import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { readUrlParam, writeUrlParam } from '../urlState'
import { useMajors, CS_FALLBACK } from './useMajors'

// The onboarded majors, fetched once and shared. The provider deliberately
// holds NO selected major: each surface asks a different question — what does
// this college offer in Biology, what does Berkeley require for Economics —
// so each keeps its own choice via useMajorChoice().

const MajorContext = createContext(null)

export function MajorProvider({ children }) {
  const { majors, defaultSlug, bySlug, isLoading, isError, error } = useMajors()
  const value = useMemo(
    () => ({ majors, defaultSlug, bySlug, isLoading, isError, error }),
    [majors, defaultSlug, bySlug, error, isError, isLoading],
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
  isError: false,
  error: null,
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
export function useMajorChoice(scope, { urlParam = null } = {}) {
  const {
    majors, defaultSlug, bySlug, isLoading, isError, error,
  } = useMajorSelection()
  const [stored, setStored] = usePersistedState(`major-choice:${scope}`, null)
  const [urlSlug, setUrlSlug] = useState(() => urlParam ? readUrlParam(urlParam) : null)
  const candidate = urlParam && bySlug.has(urlSlug) ? urlSlug : stored
  const slug = bySlug.has(candidate) ? candidate : defaultSlug

  const setSlug = useCallback((next) => {
    const value = String(next || '').trim()
    if (!bySlug.has(value)) return
    setStored(value)
    if (urlParam) {
      setUrlSlug(value)
      writeUrlParam(urlParam, value)
    }
  }, [bySlug, setStored, urlParam])

  useEffect(() => {
    if (!urlParam || typeof window === 'undefined') return undefined
    const onPopState = () => {
      const next = readUrlParam(urlParam)
      setUrlSlug(next)
      if (bySlug.has(next)) setStored(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [bySlug, setStored, urlParam])

  useEffect(() => {
    if (!urlParam || isLoading || isError) return
    // Do not erase a deep-linked major while /majors is still represented by
    // the CS-only loading fallback. Once the real registry arrives, replace an
    // invalid/missing value with the validated selection.
    if (!bySlug.has(urlSlug)) {
      setUrlSlug(slug)
      writeUrlParam(urlParam, slug, { replace: true })
    }
  }, [bySlug, isError, isLoading, slug, urlParam, urlSlug])

  return {
    slug,
    setSlug,
    major: bySlug.get(slug) || null,
    majors,
    isLoading,
    isError,
    error,
  }
}
