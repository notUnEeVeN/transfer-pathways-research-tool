import React, { useEffect, useRef, useState } from 'react'
import { renderGoogleButton } from '../../lib/googleIdentity'

/**
 * Renders Google Identity Services' "Sign in with Google" button and routes the
 * returned ID token to `onCredential`. GIS only allows its OWN rendered button
 * (there's no API to launch the ID-token flow from a custom click target), so
 * this component owns the button lifecycle: lazy GIS load, responsive width via
 * ResizeObserver, and a "Signing in…" overlay while `onCredential` resolves.
 *
 * @param {(idToken: string) => Promise<void>|void} onCredential
 * @param {(msg: string) => void} [onError]
 * @param {'continue_with'|'signup_with'|'signin_with'} [text]
 * @param {'rectangular'|'pill'|'square'|'circle'} [shape]  GIS button shape
 * @param {boolean} [fullWidth]  measure container + render the button to fit (≤400px)
 * @param {boolean} [disabled]
 * @param {string} [className]   layout classes for the wrapper
 */
export default function GoogleIdentityButton({
  onCredential,
  onError,
  text = 'continue_with',
  shape = 'rectangular',
  fullWidth = true,
  disabled = false,
  className = ''
}) {
  const containerRef = useRef(null)
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)

  // Latest onCredential without forcing a button re-render.
  const cbRef = useRef(onCredential)
  cbRef.current = onCredential

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let unregister = null
    let disposed = false
    let lastWidth = -1

    const handle = async (idToken) => {
      setWorking(true)
      try {
        await cbRef.current?.(idToken)
      } finally {
        if (!disposed) setWorking(false)
      }
    }

    const renderAt = async (width) => {
      try {
        const prev = unregister
        el.replaceChildren() // clear any previously-rendered GIS button
        unregister = await renderGoogleButton(el, { onCredential: handle, width, text, shape })
        if (prev) prev()
        if (disposed && unregister) {
          unregister()
          unregister = null
        }
      } catch (_) {
        if (disposed) return
        setFailed(true)
        onError?.('Google sign-in is unavailable right now. Please use email instead.')
      }
    }

    if (fullWidth) {
      // Read the CONTAINER width (set by parent layout), not the button's own
      // size. Render is debounced and deferred OUT of the observer callback so
      // mutating the container can't re-enter the observer in the same frame —
      // which the browser reports as "ResizeObserver loop … undelivered
      // notifications" (and a modal's open animation would fire it repeatedly).
      let renderTimer = null
      const ro = new ResizeObserver((entries) => {
        const cw = Math.floor(entries[0].contentRect.width)
        if (cw <= 0) return
        const w = Math.min(400, Math.max(200, cw))
        if (w === lastWidth) return
        lastWidth = w
        if (renderTimer) clearTimeout(renderTimer)
        renderTimer = setTimeout(() => {
          renderTimer = null
          renderAt(w)
        }, 100)
      })
      ro.observe(el)
      return () => {
        disposed = true
        if (renderTimer) clearTimeout(renderTimer)
        ro.disconnect()
        if (unregister) unregister()
      }
    }

    renderAt(undefined) // content-sized (inline placements, e.g. landing CTA)
    return () => {
      disposed = true
      if (unregister) unregister()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullWidth, text, shape])

  if (failed) return null

  return (
    <div
      className={`relative ${fullWidth ? 'w-full' : 'inline-flex'} ${
        disabled ? 'opacity-60 pointer-events-none' : ''
      } ${className}`}
    >
      <div ref={containerRef} className={fullWidth ? 'flex justify-center' : ''} />
      {working && (
        <div className='absolute inset-0 flex items-center justify-center rounded-md bg-primary/80'>
          <span className='text-sm font-medium text-tertiary'>Signing in…</span>
        </div>
      )}
    </div>
  )
}
