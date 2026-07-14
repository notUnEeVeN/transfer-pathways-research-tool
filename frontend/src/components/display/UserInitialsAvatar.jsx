import React from 'react'

const sizes = {
  sm: 'w-[30px] h-[30px] text-tag',
  md: 'w-[52px] h-[52px] text-heading',
}

/**
 * Compute 1–2 initials from an email's local part (the bit before `@`). Splits
 * on a separator (`.`, `_`, `-`, `+`) and takes the first char of each of the
 * first two segments; falls back to the first two letters of a single segment.
 * Always upper-cased. Returns '?' for an empty/garbage address.
 */
function initialsFromEmail(email = '') {
  const local = String(email).trim().split('@')[0] || ''
  const segments = local.split(/[._+-]+/).filter(Boolean)
  if (segments.length === 0) return '?'
  if (segments.length === 1) return segments[0].slice(0, 2).toUpperCase()
  return (segments[0][0] + segments[1][0]).toUpperCase()
}

/**
 * UserInitialsAvatar — a rounded-pill avatar showing initials derived from an
 * email. Forest fill with lime initials, matching the task-card treatment in
 * the handoff design. `sm` (~30px) is for list rows and `md` (~52px) for the
 * resolved-user header. Token classes only.
 */
export default function UserInitialsAvatar({ email, size = 'sm', className = '' }) {
  return (
    <span
      aria-hidden='true'
      className={`inline-flex items-center justify-center shrink-0 rounded-pill bg-on-accent text-accent font-medium ${
        sizes[size] || sizes.sm
      } ${className}`}
    >
      {initialsFromEmail(email)}
    </span>
  )
}
