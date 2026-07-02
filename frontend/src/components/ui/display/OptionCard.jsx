import React from 'react'

/**
 * A large selectable card — icon chip, title, supporting line, optional trailing
 * slot — for picking (or toggling) one option among a few. Selected state lifts
 * to a primary border + ring with a solid-primary icon chip; the surface fill
 * stays constant (only the border, ring, and chip change). Unselected is a quiet
 * bordered surface with a soft-blue chip. Use for choices that deserve more
 * presence than a radio or a Switch (onboarding steps, settings).
 *
 * Props: `icon` (Heroicon component), `title`, `description`, `selected`,
 * `onClick`, `trailing` (a node shown at the right — e.g. a CompletionCheck or
 * an arrow), `disabled` (dims the card and blocks clicks), `className`.
 */
export default function OptionCard({
  icon: Icon,
  title,
  description,
  selected = false,
  onClick,
  trailing = null,
  disabled = false,
  className = ''
}) {
  return (
    <button
      type='button'
      onClick={() => !disabled && onClick?.()}
      aria-pressed={selected}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border bg-surface p-4 text-left transition-[background-color,border-color] duration-150 ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-surface-hover'
      } ${
        selected
          ? 'border-primary ring-1 ring-primary/30'
          : `border-border ${disabled ? '' : 'hover:border-border-strong'}`
      } ${className}`}
    >
      {Icon && (
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors ${
            selected ? 'bg-primary text-on-primary' : 'bg-primary-soft text-primary'
          }`}
        >
          <Icon className='h-5 w-5' />
        </span>
      )}
      <span className='min-w-0 flex-1'>
        <span className='block text-body-strong'>{title}</span>
        {description && <span className='block text-caption text-ink-muted'>{description}</span>}
      </span>
      {trailing && <span className='shrink-0'>{trailing}</span>}
    </button>
  )
}
