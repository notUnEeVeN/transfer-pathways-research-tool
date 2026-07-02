import { initializeApp } from 'firebase/app'
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth'

// Only `firebase/app` + `firebase/auth` are initialized eagerly here, because
// `auth` is needed by the app shell (AuthProvider) and the landing CTA. Firestore
// and Analytics are deliberately split into ./firestore and ./analytics so that
// importing `auth` does NOT pull `firebase/firestore` + `firebase/analytics`
// (~tens of KB gz + an analytics network beacon) onto the first-paint path.
//
// We use initializeAuth (not getAuth) and omit the default popupRedirectResolver
// — the app never uses it, and getAuth would otherwise eagerly fetch a ~90 KiB
// cross-origin auth iframe on Safari/mobile during construction. Google sign-in
// is handled by Google Identity Services (lib/googleIdentity + GoogleAuthButton),
// which returns an ID token we exchange via signInWithCredential. The persistence
// list matches getAuth's default so session restoration is unchanged.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // No authDomain: it only drove Firebase's OAuth popup/redirect handler, which
  // the app doesn't use (Google sign-in is Google Identity Services). Email
  // verification / password reset / the /auth/action handler use the apiKey.
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

const app = initializeApp(firebaseConfig)
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
})

export { app, auth }
