import React from 'react'

const sizes = {
  sm: { box: 'w-7 h-7', icon: 'w-4 h-4' },
  md: { box: 'w-9 h-9', icon: 'w-5 h-5' },
  lg: { box: 'w-10 h-10', icon: 'w-5 h-5' }
}

const variants = {
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-hover border-transparent',
  surface: 'bg-surface text-ink-muted hover:text-ink border-border-strong hover:bg-surface-hover shadow-xs',
  soft: 'bg-primary-soft text-primary hover:bg-primary/15 border-transparent',
  primary: 'bg-primary text-on-primary hover:bg-primary-hover border-transparent shadow-sm'
}

/**
 * Icon-only button. Square (default) or circular. Always needs an accessible
 * `label` (used for both aria-label and the native tooltip). The brand focus
 * outline is inherited from :focus-visible.
 */
export default function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  shape = 'square',
  className = '',
  ...rest
}) {
  const s = sizes[size] || sizes.md
  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      className={`grid place-items-center shrink-0 border transition-[background-color,color,box-shadow] duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
        shape === 'circle' ? 'rounded-full' : 'rounded-lg'
      } ${s.box} ${variants[variant] || variants.ghost} ${className}`}
      {...rest}
    >
      {Icon && <Icon className={s.icon} aria-hidden='true' />}
    </button>
  )
}
