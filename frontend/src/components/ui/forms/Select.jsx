import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import { useAnchoredRect } from '../overlays/useAnchoredRect'
import { computePopupPlacement } from '../overlays/popupPlacement'

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  className = '',
  disabled = false,
  ...rest
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const popupRef = useRef(null)
  const rect = useAnchoredRect(triggerRef, open)

  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)) || null, [options, value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        popupRef.current &&
        !popupRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => String(o.value) === String(value))
      setActiveIndex(idx === -1 ? 0 : idx)
    }
  }, [open, options, value])

  const commit = (opt) => {
    setOpen(false)
    onChange?.(opt.value)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open && options[activeIndex]) commit(options[activeIndex])
      else setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Flip the popup above the trigger when it's near the bottom of the viewport,
  // so the list never gets clipped off-screen (e.g. a grade dropdown on the last
  // course row). maxHeight is clamped to the free space on the chosen side.
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
      {options.length > 0 ? (
        <ul
          role='listbox'
          className='overflow-auto surface-elevated p-1'
          style={{ maxHeight: placement.maxHeight, boxShadow: 'var(--shadow-lg)' }}
        >
          {options.map((opt, idx) => {
            const isActive = idx === activeIndex
            const isSelected = selected && String(selected.value) === String(opt.value)
            return (
              <li
                key={opt.value}
                role='option'
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={(e) => {
                  e.stopPropagation()
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
          No options
        </div>
      )}
    </div>
  )

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type='button'
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={open}
        className={`input-field pr-8 w-full text-left flex items-center cursor-pointer focus:input-field-focus ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        {...rest}
      >
        <span className={`flex-1 truncate ${selected ? 'text-ink' : 'text-ink-subtle'}`}>
          {selected ? selected.label : placeholder}
        </span>
      </button>
      <ChevronUpDownIcon className='w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-subtle' />
      {typeof document !== 'undefined' && popup ? createPortal(popup, document.body) : null}
    </div>
  )
}
