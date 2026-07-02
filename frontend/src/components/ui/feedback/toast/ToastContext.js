import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

// No-op API for trees without a provider (isolated unit tests, the SSR pass before
// hydration) so callers never have to guard `useToast()`.
export const NOOP_TOAST = Object.freeze({
  success: () => {},
  error: () => {},
  info: () => {},
  dismiss: () => {}
})

/**
 * Imperative toast API: `toast.success/error/info(message, { duration })` and
 * `toast.dismiss(id)`. Errors persist by default; pass `{ duration: ms }` to
 * override, or `{ duration: null }` to make any toast sticky.
 */
export function useToast() {
  return useContext(ToastContext) || NOOP_TOAST
}
