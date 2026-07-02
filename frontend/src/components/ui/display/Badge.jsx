import React from 'react'

const tones = {
  neutral: 'bg-surface-hover text-ink-muted',
  // primary-hover (a touch darker than primary) keeps the small accent label AA
  // on its own soft tint over warm stone — text-primary alone falls to 4.26:1.
  accent: 'bg-primary-soft text-primary-hover',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  // Amber — over-prepared verdict tier / caution (internal-tool only).
  conservative: 'bg-conservative-soft text-conservative'
}

/**
 * Small status pill. No border, soft fill only. Single line, tabular numerals
 * for consistent width when used in tables. The one badge vocabulary app-wide.
 * No "warning" / orange tone — use `neutral` for in-progress / partial states.
 *
 * Pass `icon` (a Heroicon component) for a leading glyph. `wrap` opts out of the
 * single-line default for badge-like pills holding variable-length prose: the
 * label wraps within its column instead of forcing min-content width.
 */
export default function Badge({ variant = 'neutral', icon: Icon, wrap = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 rounded-pill text-tag tabular-nums ${
        wrap ? 'self-start max-w-full min-h-5 py-0.5 whitespace-normal wrap-break-word' : 'h-5 whitespace-nowrap'
      } ${tones[variant] || tones.neutral} ${className}`}
    >
      {Icon && <Icon className='w-3 h-3 shrink-0' aria-hidden='true' />}
      {children}
    </span>
  )
}
