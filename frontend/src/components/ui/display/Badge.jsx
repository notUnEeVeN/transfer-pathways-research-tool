import React from 'react'

const tones = {
  neutral: 'bg-surface-sunken text-ink-muted',
  accent: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  // Lavender — over-prepared verdict tier / caution (internal-tool only).
  conservative: 'bg-conservative-soft text-conservative',
  // Mint fill with success ink — the Data Verification task-type chip.
  verify: 'bg-primary-soft text-success'
}

/**
 * Small status pill. No border, soft fill only, height auto. Single line by
 * default. The one badge vocabulary app-wide. No "warning" / orange tone —
 * use `neutral` for in-progress / partial states.
 *
 * Pass `icon` (a Heroicon component) for a leading glyph. `wrap` opts out of the
 * single-line default for badge-like pills holding variable-length prose: the
 * label wraps within its column instead of forcing min-content width. Callers
 * showing pure-digit content should add `tabular` themselves — it's no longer
 * baked into the base class.
 */
export default function Badge({ variant = 'neutral', icon: Icon, wrap = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-[3px] rounded-pill text-tag ${
        wrap ? 'self-start max-w-full whitespace-normal wrap-break-word' : 'whitespace-nowrap'
      } ${tones[variant] || tones.neutral} ${className}`}
    >
      {Icon && <Icon className='w-3 h-3 shrink-0' aria-hidden='true' />}
      {children}
    </span>
  )
}
