import React from 'react'

/**
 * A hairline rule. With a `label`, becomes a centered "or"-style separator
 * (replaces the hand-rolled dividers in the auth screens).
 */
export default function Divider({ label, className = '' }) {
  if (!label) return <div className={`h-px bg-border ${className}`} role='separator' />
  return (
    <div className={`flex items-center gap-3 ${className}`} role='separator' aria-label={typeof label === 'string' ? label : undefined}>
      <span className='flex-1 h-px bg-border' />
      <span className='text-caption text-ink-subtle shrink-0'>{label}</span>
      <span className='flex-1 h-px bg-border' />
    </div>
  )
}
