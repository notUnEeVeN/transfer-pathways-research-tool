import React, { useRef } from 'react'

/**
 * Vertical single-select list for switching between sections — eligibility
 * schools, FAQ topics, and the like. The selected row gets a soft tint with
 * dark text (not primary-colored); unselected rows are muted with a hover tint.
 *
 * Listbox-style keyboard nav: ArrowUp/ArrowDown move the selection (focus
 * follows selection), Home/End jump to the first/last item.
 *
 *   <NavList
 *     items={[{ id: 'basics', label: 'The basics' }]}
 *     selectedId={topic}
 *     onSelect={setTopic}
 *     ariaLabel='Topics'
 *   />
 */
export default function NavList({ items, selectedId, onSelect, ariaLabel, className = '' }) {
  const refs = useRef([])

  const focusIndex = (idx) => {
    const clamped = Math.max(0, Math.min(items.length - 1, idx))
    const el = refs.current[clamped]
    if (el) el.focus()
    if (items[clamped]) onSelect(items[clamped].id)
  }

  const onKeyDown = (e, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusIndex(idx + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusIndex(idx - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusIndex(items.length - 1)
    }
  }

  return (
    <nav className={`flex flex-col gap-0.5 ${className}`} aria-label={ariaLabel}>
      {items.map((item, idx) => {
        const active = selectedId === item.id
        return (
          <button
            key={item.id}
            ref={(el) => (refs.current[idx] = el)}
            type='button'
            onClick={() => onSelect(item.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex items-center gap-3 px-3 h-10 rounded-md text-left transition-colors ${
              active
                ? 'bg-primary-soft text-body-strong text-ink'
                : 'text-body text-ink-muted hover:bg-surface-hover hover:text-ink'
            }`}
          >
            {active && (
              <span
                aria-hidden='true'
                className='absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-pill bg-primary'
              />
            )}
            <span className='truncate flex-1 min-w-0'>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
