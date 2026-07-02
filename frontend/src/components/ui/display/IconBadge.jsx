import React from 'react'

const tones = {
  brand: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-hover text-ink-muted'
}

const sizes = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5' },
  lg: { box: 'w-12 h-12 rounded-xl', icon: 'w-6 h-6' }
}

/**
 * A soft-tinted icon chip. The one shared treatment for the icon callouts that
 * were hand-rolled across auth, empty states, and confirmation screens. Tone
 * carries meaning (brand / success / danger / neutral). Decorative by
 * default; pass `title` for an accessible name when it stands alone.
 */
export default function IconBadge({ icon: Icon, tone = 'brand', size = 'md', title, className = '' }) {
  const s = sizes[size] || sizes.md
  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      className={`grid place-items-center shrink-0 ${s.box} ${tones[tone] || tones.brand} ${className}`}
    >
      {Icon && <Icon className={s.icon} />}
    </span>
  )
}
