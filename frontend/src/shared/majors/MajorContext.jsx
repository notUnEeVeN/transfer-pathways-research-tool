import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readUrlParam, writeUrlParam } from '../urlState'
import { useMajors, CS_FALLBACK } from './useMajors'

// The onboarded majors, fetched once and shared, plus the major each surface
// has chosen. Each surface asks a different question — what does this college
// offer in Biology, what does Berkeley require for Economics — so the choice is
// kept per scope, not globally. But every surface sharing a scope shares one
// choice held here, so the picker and the panes below it change together in a
// single render rather than drifting until a pane remounts.

const MajorContext = createContext(null)

// One session-scoped record of every scope's chosen major. Survives navigation
// within a tab; a remembered slug is always re-validated against the majors the
// server currently offers before it is used (see useMajorChoice).
const CHOICES_KEY = 'major-choices'

function loadChoices() {
  try {
    const raw = sessionStorage.getItem(CHOICES_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function MajorProvider({ children }) {
  const { majors, defaultSlug, bySlug, isLoading, isError, error } = useMajors()
  const [choices, setChoices] = useState(loadChoices)

  const setChoice = useCallback((scope, slug) => {
    setChoices((prev) => {
      if (prev[scope] === slug) return prev
      const next = { ...prev, [scope]: slug }
      try { sessionStorage.setItem(CHOICES_KEY, JSON.stringify(next)) } catch { /* storage full/disabled */ }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ majors, defaultSlug, bySlug, isLoading, isError, error, choices, setChoice }),
    [majors, defaultSlug, bySlug, error, isError, isLoading, choices, setChoice],
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
  choices: {},
  setChoice: () => {},
}

/** The onboarded majors and the shared per-scope choices. Safe outside a MajorProvider. */
export function useMajorSelection() {
  return useContext(MajorContext) ?? NO_PROVIDER
}

/**
 * One surface's chosen major, kept independent of every other surface but
 * shared by everything on the same surface.
 *
 * `scope` names the surface ('colleges', 'campuses', 'visuals'); surfaces
 * sharing a scope share a choice held in context, so switching the major in the
 * picker updates the panes beneath it in the same render. The choice survives
 * navigation within the tab but is always re-validated against the majors the
 * server currently offers, so a remembered slug can't outlive the major it names.
 */
export function useMajorChoice(scope, { urlParam = null } = {}) {
  const {
    majors, defaultSlug, bySlug, isLoading, isError, error, choices, setChoice,
  } = useMajorSelection()
  const stored = choices[scope] ?? null
  const [urlSlug, setUrlSlug] = useState(() => urlParam ? readUrlParam(urlParam) : null)
  const candidate = urlParam && bySlug.has(urlSlug) ? urlSlug : stored
  const slug = bySlug.has(candidate) ? candidate : defaultSlug

  const setSlug = useCallback((next) => {
    const value = String(next || '').trim()
    if (!bySlug.has(value)) return
    setChoice(scope, value)
    if (urlParam) {
      setUrlSlug(value)
      writeUrlParam(urlParam, value)
    }
  }, [bySlug, setChoice, scope, urlParam])

  useEffect(() => {
    if (!urlParam || typeof window === 'undefined') return undefined
    const onPopState = () => {
      const next = readUrlParam(urlParam)
      setUrlSlug(next)
      if (bySlug.has(next)) setChoice(scope, next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [bySlug, setChoice, scope, urlParam])

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
