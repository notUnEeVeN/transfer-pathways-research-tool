import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '../../lib/firebase'

/**
 * Exchange a Google ID token (from Google Identity Services) for a Firebase
 * user and sign in. Research-console variant of the website's helper: no
 * profile persistence or analytics — the console only needs the session.
 */
export async function signInWithGoogleIdToken(idToken) {
  const cred = GoogleAuthProvider.credential(idToken)
  const res = await signInWithCredential(auth, cred)
  return res.user
}
