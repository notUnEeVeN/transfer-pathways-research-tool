// Google Identity Services (GIS) loader + thin wrapper.
//
// We use GIS's rendered "Sign in with Google" button to obtain a Google ID
// token, which the app exchanges for a Firebase session via signInWithCredential
// (see components/auth/googleAuth). GIS opens Google's own first-party popup
// synchronously inside the click and delivers the token via callback, so it works
// reliably across browsers including Safari/iOS.
//
// The GIS script is loaded lazily (on first button mount) so it stays off the
// landing first-paint path. `initialize` registers ONE global callback, so we
// route the received credential to a stack of handlers — the active button
// (top of stack) wins, which correctly handles a modal opening over a page that
// also has a Google button.

const GIS_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise = null
let initialized = false
const handlerStack = []

function getClientId() {
  return import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''
}

function loadScript() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('GIS unavailable outside the browser'))
      return
    }
    if (window.google?.accounts?.id) {
      resolve()
      return
    }
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    const onload = () => resolve()
    const onerror = () => reject(new Error('Failed to load Google Identity Services'))
    if (existing) {
      existing.addEventListener('load', onload)
      existing.addEventListener('error', onerror)
      return
    }
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.addEventListener('load', onload)
    s.addEventListener('error', onerror)
    document.head.appendChild(s)
  })
  return scriptPromise
}

function ensureInitialized() {
  if (initialized) return true
  const clientId = getClientId()
  if (!clientId) {
    console.error('[googleIdentity] VITE_GOOGLE_OAUTH_CLIENT_ID is not set — Google sign-in is disabled.')
    return false
  }
  window.google.accounts.id.initialize({
    client_id: clientId,
    // Explicit button flow only — no automatic One Tap prompt.
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: (response) => {
      const handler = handlerStack[handlerStack.length - 1]
      if (handler && response?.credential) handler(response.credential)
    }
  })
  initialized = true
  return true
}

/**
 * Render the GIS button into `el` and route its credential to `onCredential`.
 * Returns an unregister fn (call on unmount / before re-render).
 *
 * @param {HTMLElement} el
 * @param {object} opts
 * @param {(idToken: string) => void} opts.onCredential
 * @param {number} [opts.width]  pixel width (200–400); omit for content-sized
 * @param {string} [opts.text]   'continue_with' | 'signup_with' | 'signin_with'
 * @param {string} [opts.theme]  'outline' | 'filled_blue' | 'filled_black'
 * @param {string} [opts.shape]  'rectangular' | 'pill' | 'square' | 'circle'
 */
export async function renderGoogleButton(
  el,
  { onCredential, width, text = 'continue_with', theme = 'outline', shape = 'rectangular' } = {}
) {
  await loadScript()
  if (!ensureInitialized()) throw new Error('Google Identity Services not configured')

  handlerStack.push(onCredential)
  window.google.accounts.id.renderButton(el, {
    type: 'standard',
    theme,
    text,
    shape,
    size: 'large',
    logo_alignment: 'left',
    ...(width ? { width } : {})
  })

  return () => {
    const i = handlerStack.lastIndexOf(onCredential)
    if (i !== -1) handlerStack.splice(i, 1)
  }
}
