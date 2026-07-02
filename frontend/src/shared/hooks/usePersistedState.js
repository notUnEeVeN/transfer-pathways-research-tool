import { useEffect, useState } from 'react'

/**
 * sessionStorage-backed useState. Survives route changes within a tab but not
 * a full browser close. For view-scratch state, e.g. the eligibility browser's
 * selected tab/school.
 */
export function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw != null ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      if (value === undefined || value === null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // sessionStorage full / disabled — fall back to in-memory only.
    }
  }, [key, value])
  return [value, setValue]
}
