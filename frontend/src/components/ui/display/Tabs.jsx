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
      // w-fit: a flex-column parent (Stack) would otherwise stretch the pill
      // to the container's full width.
      className={`inline-flex items-center gap-0.5 p-[3px] rounded-pill surface-sunken shrink-0 w-fit ${className}`}
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
            className={`inline-flex items-center justify-center whitespace-nowrap px-[15px] h-auto py-[6.5px] rounded-pill text-[13px] transition-[background-color,color] duration-150 ${
              active ? 'bg-primary text-on-primary font-[650] hover:bg-primary-hover' : 'text-ink-muted font-medium hover:text-ink hover:bg-surface-hover'
            }`}
          >
            {/* A bold invisible twin reserves the active (650-weight) width so
                the pill row never shifts when the selection moves. */}
            <span className='grid'>
              <span aria-hidden='true' className='invisible font-[650] col-start-1 row-start-1'>{opt.label}</span>
              <span className='col-start-1 row-start-1'>{opt.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
