import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, InformationCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

// Same tone language as the inline Alert: success / error / info, each a colored
// left accent + icon. role/aria-live differ so screen readers announce errors
// assertively and the rest politely.
const variants = {
  success: { icon: CheckCircleIcon, fg: 'text-success', bar: 'bg-success', role: 'status', live: 'polite' },
  error: { icon: XCircleIcon, fg: 'text-danger', bar: 'bg-danger', role: 'alert', live: 'assertive' },
  info: { icon: InformationCircleIcon, fg: 'text-primary', bar: 'bg-primary', role: 'status', live: 'polite' }
}

// How long the leave transition runs before the toast is unmounted. Matches the
// duration-150 on the card below.
const EXIT_MS = 150

/**
 * A single floating toast card. Owns its own auto-dismiss timer (paused on hover),
 * its X button, and the leave animation. `duration == null` means it persists
 * until dismissed (used for errors). Calls `onRemove(id)` once it has animated out.
 */
export default function ToastItem({ id, type = 'info', message, duration, onRemove }) {
  const v = variants[type] || variants.info
  const Icon = v.icon
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef(null)

  const close = useCallback(() => setLeaving(true), [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    if (duration == null || leaving) return
    clearTimer()
    timerRef.current = window.setTimeout(close, duration)
  }, [duration, leaving, close, clearTimer])

  // Auto-dismiss timer — paused while the stack is hovered (see handlers below).
  useEffect(() => {
    startTimer()
    return clearTimer
  }, [startTimer, clearTimer])

  // Once leaving, unmount after the exit transition runs. As an effect (not a
  // side-effect inside setLeaving) this stays clean under StrictMode double-mount.
  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => onRemove(id), EXIT_MS)
    return () => clearTimeout(t)
  }, [leaving, id, onRemove])

  return (
    <div
      role={v.role}
      aria-live={v.live}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      className={`pointer-events-auto relative w-full flex items-start gap-2 pl-4 pr-2 py-3 surface-elevated overflow-hidden transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none motion-safe:animate-[toastIn_180ms_var(--ease-out)] ${
        leaving ? 'opacity-0 -translate-y-1.5' : 'opacity-100 translate-y-0'
      }`}
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1 ${v.bar}`} />
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${v.fg}`} />
      <div className='text-body min-w-0 flex-1'>{message}</div>
      <button
        type='button'
        onClick={close}
        aria-label='Dismiss'
        className='grid place-items-center w-7 h-7 shrink-0 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-hover transition-colors'
      >
        <XMarkIcon className='w-4 h-4' />
      </button>
    </div>
  )
}
