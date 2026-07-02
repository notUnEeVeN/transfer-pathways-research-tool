import React from 'react'
import ProgressRing from './ProgressRing'

/**
 * A ProgressRing wired to the app's completion semantic: green when `complete`
 * (done / eligible), brand blue otherwise — the same color rule used everywhere
 * a thing is "done". Pass `label` (the thing being measured) and it builds the
 * "<label>: N percent" accessible description. Thin wrapper so the tone rule and
 * aria phrasing live in one place across all the readiness rings.
 */
export default function CompletionRing({ value = 0, complete = false, label, size = 40, stroke = 4, className = '' }) {
  return (
    <ProgressRing
      value={value}
      size={size}
      stroke={stroke}
      tone={complete ? 'success' : 'brand'}
      ariaLabel={label ? `${label}: ${Math.round(value)} percent` : undefined}
      className={className}
    />
  )
}
