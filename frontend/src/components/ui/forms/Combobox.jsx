import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Fuse from 'fuse.js'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import { useAnchoredRect } from '../overlays/useAnchoredRect'
import { computePopupPlacement } from '../overlays/popupPlacement'

export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  className = ''
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const popupRef = useRef(null)
  const rect = useAnchoredRect(inputRef, open)

  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)) || null, [options, value])

  const fuse = useMemo(() => new Fuse(options, { keys: ['label'], threshold: 0.3 }), [options])
  const filtered = useMemo(() => {
    if (!query) return options
    return fuse.search(query).map((r) => r.item)
  }, [options, query, fuse])

  useEffect(() => {
    const onDoc = (e) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        popupRef.current &&
        !popupRef.current.contains(e.target)
      ) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  const commit = (opt) => {
    onChange?.(opt.value)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (open && filtered[activeIndex]) {
        e.preventDefault()
        commit(filtered[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  // Flip the popup above the input when it's near the bottom of the viewport,
  // so the results list never gets clipped off-screen. maxHeight is clamped to
  // the free space on the chosen side.
  const placement = rect
    ? computePopupPlacement({ rect, viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0 })
    : null

  const popup = open && rect && placement && (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 200,
        ...(placement.placeAbove
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 })
      }}
    >
      {filtered.length > 0 ? (
        <ul
          role='listbox'
          className='overflow-auto surface-elevated p-1'
          style={{ maxHeight: placement.maxHeight, boxShadow: 'var(--shadow-lg)' }}
        >
          {filtered.slice(0, 200).map((opt, idx) => {
            const isActive = idx === activeIndex
            const isSelected = selected && String(selected.value) === String(opt.value)
            return (
              <li
                key={opt.value}
                role='option'
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(opt)
                }}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-body cursor-pointer transition-colors ${isActive ? 'bg-primary-soft text-ink' : 'text-ink-muted'}`}
              >
                <span className='truncate'>{opt.label}</span>
                {isSelected && <CheckIcon className='w-4 h-4 text-primary shrink-0' />}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className='surface-elevated p-3 text-body text-ink-subtle' style={{ boxShadow: 'var(--shadow-lg)' }}>
          No results
        </div>
      )}
    </div>
  )

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className='relative'>
        <input
          ref={inputRef}
          className={`input-field pr-8 focus:input-field-focus ${
            selected ? 'placeholder:text-ink' : 'placeholder:text-ink-subtle'
          }`}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : ''}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          aria-expanded={open}
          aria-autocomplete='list'
          role='combobox'
        />
        <div className='absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none'>
          <ChevronUpDownIcon className='w-4 h-4 text-ink-subtle' />
        </div>
      </div>
      {typeof document !== 'undefined' && popup ? createPortal(popup, document.body) : null}
    </div>
  )
}
