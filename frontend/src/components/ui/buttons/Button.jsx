import React from 'react'
import Spinner from '../feedback/Spinner'

// Height / padding / text / icon size per scale step. md is the workhorse;
// xl is reserved for hero / marketing CTAs.
const sizes = {
  sm: { h: 'h-8', px: 'px-3', text: 'text-button', gap: 'gap-1.5', icon: 'w-3.5 h-3.5', radius: 'rounded-md', circle: 'w-6 h-6', circleIcon: 'w-3 h-3' },
  md: { h: 'h-9', px: 'px-3.5', text: 'text-button', gap: 'gap-1.5', icon: 'w-4 h-4', radius: 'rounded-lg', circle: 'w-7 h-7', circleIcon: 'w-3.5 h-3.5' },
  lg: { h: 'h-10', px: 'px-4', text: 'text-body-strong', gap: 'gap-2', icon: 'w-4 h-4', radius: 'rounded-lg', circle: 'w-8 h-8', circleIcon: 'w-4 h-4' },
  xl: { h: 'h-12', px: 'px-5', text: 'text-body-strong', gap: 'gap-2', icon: 'w-5 h-5', radius: 'rounded-xl', circle: 'w-9 h-9', circleIcon: 'w-5 h-5' }
}

// Each variant: the button surface, and the fill used behind the circular
// trailing-icon chip (the signature CTA affordance).
const variants = {
  primary: {
    btn: 'bg-primary text-on-primary border-transparent hover:bg-primary-hover shadow-sm active:translate-y-px',
    circle: 'bg-on-primary/20 text-on-primary'
  },
  secondary: {
    btn: 'bg-surface text-ink border-border-strong hover:bg-surface-hover shadow-xs active:translate-y-px',
    circle: 'bg-primary-soft text-primary'
  },
  subtle: {
    btn: 'bg-primary-soft text-primary border-transparent hover:bg-primary/15 active:translate-y-px',
    circle: 'bg-primary text-on-primary'
  },
  ghost: {
    btn: 'bg-transparent text-ink-muted border-transparent hover:bg-surface-hover hover:text-ink',
    circle: 'bg-surface-hover text-ink'
  },
  // For action rows sitting ON a primary/brand surface (e.g. the onboarding
  // header): a light filled CTA and a light ghost, mirroring primary/ghost.
  inverse: {
    btn: 'bg-on-primary text-primary border-transparent hover:bg-on-primary/90 shadow-sm active:translate-y-px',
    circle: 'bg-primary-soft text-primary'
  },
  ghostInverse: {
    btn: 'bg-transparent text-on-primary border-transparent hover:bg-on-primary/10',
    circle: 'bg-on-primary/15 text-on-primary'
  },
  danger: {
    btn: 'bg-danger text-on-primary border-transparent hover:opacity-90 shadow-sm active:translate-y-px',
    circle: 'bg-on-primary/20 text-on-primary'
  },
  // Conservative verdict tier / caution — amber. (`warning` is a back-compat alias.)
  conservative: {
    btn: 'bg-conservative-soft text-conservative border-transparent hover:bg-conservative/20 active:translate-y-px',
    circle: 'bg-conservative text-on-primary'
  },
  warning: {
    btn: 'bg-conservative-soft text-conservative border-transparent hover:bg-conservative/20 active:translate-y-px',
    circle: 'bg-conservative text-on-primary'
  }
}

/**
 * The app's button. Borders + soft shadow depth, a crisp brand focus outline
 * (inherited from :focus-visible, no longer suppressed now that depth uses
 * shadow tokens), and a press nudge.
 *
 * Signature affordances:
 *  - `shape="pill"` for hero / marketing CTAs.
 *  - `iconCircle` renders the `trailingIcon` inside a contrasting circular chip
 *    pinned to the trailing edge — the "Join now ◯→" look. Pairs with `pill`.
 */
export default function Button({
  as: Comp = 'button',
  variant = 'primary',
  size = 'md',
  shape = 'default',
  type = 'button',
  leadingIcon: Leading,
  trailingIcon: Trailing,
  iconCircle = false,
  block = false,
  loading = false,
  disabled = false,
  className = '',
  style,
  children,
  ...rest
}) {
  const s = sizes[size] || sizes.md
  const v = variants[variant] || variants.primary
  const radius = shape === 'pill' ? 'rounded-pill' : s.radius
  // Native <button> takes type/disabled; an `as` element (e.g. Link) does not.
  const tagProps = Comp === 'button' ? { type, disabled: disabled || loading } : disabled ? { 'aria-disabled': true } : {}

  return (
    <Comp
      {...tagProps}
      style={style}
      className={`group/btn relative inline-flex items-center justify-center border ${radius} whitespace-nowrap transition-[background-color,box-shadow,transform,opacity,filter] duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 ${block ? 'w-full' : ''} ${s.h} ${iconCircle && Trailing ? `pl-4 pr-1.5` : s.px} ${s.text} ${s.gap} ${v.btn} ${className}`}
      {...rest}
    >
      {/* While loading, a spinner takes the leading slot and the trailing icon is
          suppressed — the label stays put, so the button reads as "⟳ Continue",
          never "Loading…". */}
      {loading ? (
        <Spinner className={`${s.icon} shrink-0`} />
      ) : (
        Leading && <Leading className={`${s.icon} shrink-0`} aria-hidden='true' />
      )}
      <span>{children}</span>
      {!loading && Trailing &&
        (iconCircle ? (
          <span
            className={`grid place-items-center shrink-0 rounded-full ${s.circle} ${v.circle} transition-transform duration-150 group-hover/btn:translate-x-0.5`}
            aria-hidden='true'
          >
            <Trailing className={s.circleIcon} />
          </span>
        ) : (
          <Trailing className={`${s.icon} shrink-0`} aria-hidden='true' />
        ))}
    </Comp>
  )
}
