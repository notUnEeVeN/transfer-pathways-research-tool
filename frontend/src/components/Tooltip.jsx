import React, { useState } from 'react'

/**
 * Tooltip - tiny desktop-local hover label. The shared frontend removed its
 * generic Tooltip; the internal console still needs one for dense operator
 * controls, so it lives with the desktop renderer instead of re-expanding the
 * public UI surface.
 */
export default function Tooltip({ children, content, disabled = false }) {
  const [open, setOpen] = useState(false)
  const show = open && !disabled && !!content

  return (
    <span
      className='relative inline-flex'
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {show && (
        <span
          role='tooltip'
          className='pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 max-w-xs -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-caption text-on-primary shadow-sm'
        >
          {content}
        </span>
      )}
    </span>
  )
}
