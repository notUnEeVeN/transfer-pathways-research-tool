import React from 'react'
import { Check } from '@untitledui-pro/icons/duotone';
// Two sizes: `md` for sections / groups / majors / list rows, `sm` for the
// per-course marks inside the Cal-GETC / UC-7 pattern modals.
const SIZES = {
  sm: { box: 'w-3.5 h-3.5', icon: 'w-2.5 h-2.5' },
  md: { box: 'w-5 h-5', icon: 'w-3 h-3' }
}

/**
 * The one completion mark used everywhere a thing is "complete" — a filled
 * green circle with a white check. Used for completed courses, sections,
 * groups, majors, and transfer patterns so every "done" state looks identical.
 * Render nothing for the incomplete state (callers supply their own placeholder
 * if they need to hold the column's width).
 */
export default function CompletionCheck({ size = 'md', className = '', label = 'Complete' }) {
  const s = SIZES[size] || SIZES.md
  return (
    <span
      role='img'
      aria-label={label}
      className={`grid place-items-center rounded-full bg-success-solid shrink-0 ${s.box} ${className}`}
    >
      <Check className={`text-white ${s.icon}`} strokeWidth={3} />
    </span>
  )
}
