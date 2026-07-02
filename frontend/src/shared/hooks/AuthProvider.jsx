import React, { useEffect, useState, startTransition } from 'react'
import { auth } from '../lib/firebase'
import { AuthContext } from './authContext'

/**
 * Owns the Firebase Auth user state only. User-doc data (community college,
 * courses, etc.) is owned by the `useUserData` query in src/query/hooks/ —
 * keeping auth state and Firestore data separate means a token refresh
 * doesn't trigger a Firestore re-fetch, and Firestore updates don't slam
 * through onAuthStateChanged.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      // Mark the auth-state update as non-urgent. The marketing routes are
      // prerendered and hydrated with their below-fold sections still streaming
      // in as lazy chunks, so that Suspense boundary is dehydrated for a real
      // window after first paint. An *urgent* setState here can land on the
      // boundary before it finishes hydrating and trip React #421 ("…received
      // an update before it finished hydrating"), forcing that subtree to throw
      // away the server HTML and client-render. startTransition lets React
      // finish hydrating first; auth-driven UI swaps are inherently non-urgent.
      startTransition(() => {
        setUser(authUser)
        setLoading(false)
      })
    })
    return () => unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}
