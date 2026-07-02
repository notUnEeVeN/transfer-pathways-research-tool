import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ToastItem from './ToastItem'
import { ToastContext } from './ToastContext'

// Auto-dismiss for success/info. Errors persist (duration: null) so a failure
// isn't missed while the eye is elsewhere.
const DEFAULT_DURATION = 5000

function reducer(state, action) {
  switch (action.type) {
    case 'add':
      // Newest on top — it slides in above the rest of the stack.
      return [action.toast, ...state]
    case 'remove':
      return state.filter((t) => t.id !== action.id)
    default:
      return state
  }
}

/**
 * Mounts once near the app root. Provides the imperative `useToast()` API and
 * renders the floating stack into a body portal, so toasts overlay the page and
 * never participate in document flow (zero content shift). The portal only mounts
 * client-side, so the prerender pass emits nothing and hydration matches.
 */
export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(reducer, [])
  const idRef = useRef(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const remove = useCallback((id) => dispatch({ type: 'remove', id }), [])

  const push = useCallback((type, message, opts = {}) => {
    if (!message) return null
    const id = (idRef.current += 1)
    const duration = opts.duration !== undefined ? opts.duration : type === 'error' ? null : DEFAULT_DURATION
    dispatch({ type: 'add', toast: { id, type, message, duration } })
    return id
  }, [])

  const toast = useMemo(
    () => ({
      success: (message, opts) => push('success', message, opts),
      error: (message, opts) => push('error', message, opts),
      info: (message, opts) => push('info', message, opts),
      dismiss: remove
    }),
    [push, remove]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <div className='fixed top-4 left-1/2 -translate-x-1/2 z-120 flex w-[min(92vw,420px)] flex-col items-center gap-2 pointer-events-none'>
            {toasts.map((t) => (
              <ToastItem key={t.id} {...t} onRemove={remove} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}
