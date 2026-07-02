import React from 'react'

/**
 * Inline filter tabs — recessed pill with an elevated active tab. Used for
 * in-page filters (UC/CSU, Timeline/Transcript, etc.).
 *
 * Single-select (default): `value` is a scalar; one tab is active and
 * `onChange` fires with the clicked tab's value.
 *
 * Multi-select (`multiple`): `value` is an array; any number of tabs can be
 * active at once. `onChange` fires with the clicked tab's value (the toggled
 * item) — let the parent add/remove it from the array.
 */
export default function Tabs({ value, onChange, options, multiple = false, className = '' }) {
  const isActive = (v) => (multiple ? Array.isArray(value) && value.includes(v) : v === value)
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-lg surface-sunken shrink-0 ${className}`}
      role={multiple ? 'group' : 'tablist'}
    >
      {options.map((opt) => {
        const active = isActive(opt.value)
        return (
          <button
            key={opt.value}
            type='button'
            role={multiple ? undefined : 'tab'}
            aria-selected={multiple ? undefined : active}
            aria-pressed={multiple ? active : undefined}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center whitespace-nowrap px-4 h-8 rounded-md text-button transition-[background-color,color] duration-150 ${
              active ? 'bg-primary text-on-primary' : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
