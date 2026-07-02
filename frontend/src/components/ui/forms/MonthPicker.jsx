import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useAnchoredRect } from '../overlays/useAnchoredRect'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Splits a 'YYYY-MM' value into { year, month } (month 1-12), or null. Guards
// the shape and month range so a malformed value yields null rather than an
// out-of-bounds month name (e.g. "undefined 2026").
function parseValue(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const [y, m] = value.split('-').map(Number)
  if (!y || m < 1 || m > 12) return null
  return { year: y, month: m }
}

// Formats a 'YYYY-MM' value as e.g. "September 2026".
function formatValue(value) {
  const parsed = parseValue(value)
  if (!parsed) return ''
  return `${MONTHS_LONG[parsed.month - 1]} ${parsed.year}`
}

/**
 * Calendar-style month picker. Renders a form-field-styled trigger that opens an
 * anchored popover with a year stepper and a 3-column month grid. Composes like
 * an <Input> (same label / hint markup) so it drops into forms. `onChange` is
 * called with the new 'YYYY-MM' string directly (not an event), or '' on clear.
 *
 * The panel is rendered via a portal (position: fixed, anchored to the trigger
 * with useAnchoredRect) so it escapes ancestor `overflow` clipping — e.g. inside
 * the CheckoutPanel Modal, whose body/frame clip with overflow-auto/hidden. Same
 * pattern as Combobox/Select. Outside-click + Escape close, guarding both the
 * trigger wrapper and the portaled panel.
 */
export default function MonthPicker({
  value,
  onChange,
  label,
  hint,
  placeholder = 'Select a month',
  disablePast = false,
  max,
  className = ''
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const rect = useAnchoredRect(triggerRef, open)

  const parsed = parseValue(value)
  const maxParsed = parseValue(max)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  const [displayYear, setDisplayYear] = useState(parsed?.year ?? currentYear)

  // Re-sync the displayed year to the value's year whenever the panel opens, so
  // reopening lands on the selected month rather than wherever it was left.
  useEffect(() => {
    if (open) setDisplayYear(parseValue(value)?.year ?? currentYear)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    // Guard both refs: the panel is portaled to <body>, so it is NOT a DOM child
    // of wrapRef — a single-ref check would treat clicks inside it as "outside".
    const onDoc = (e) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selectMonth = (monthIndex) => {
    const mm = String(monthIndex + 1).padStart(2, '0')
    onChange?.(`${displayYear}-${mm}`)
    setOpen(false)
  }

  const clear = (e) => {
    e.stopPropagation()
    onChange?.('')
  }

  // A month is disabled if:
  // - (disablePast) it's before the current calendar month AND it isn't the
  //   currently selected value — so editing a record whose saved month has
  //   since passed keeps that month re-selectable; or
  // - (max) it's strictly after the max month — applied uniformly (a value above
  //   max shouldn't normally exist, so there's no selected-value exception).
  const isDisabled = (monthIndex) => {
    const m = monthIndex + 1
    if (maxParsed) {
      const isAfterMax =
        displayYear > maxParsed.year || (displayYear === maxParsed.year && m > maxParsed.month)
      if (isAfterMax) return true
    }
    if (!disablePast) return false
    const isPast = displayYear < currentYear || (displayYear === currentYear && m < currentMonth)
    const isSelected = parsed && parsed.year === displayYear && parsed.month === m
    return isPast && !isSelected
  }

  // Once the displayed year reaches max's year, paging forward would only reveal
  // disabled months — so block the next-year chevron there.
  const atMaxYear = maxParsed && displayYear >= maxParsed.year

  const panel = open && rect && (
    <div
      ref={panelRef}
      aria-label='Choose month'
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 200,
        boxShadow: 'var(--shadow-lg)'
      }}
      className='w-64 surface-elevated p-3 flex flex-col gap-3'
    >
      <div className='flex items-center justify-between'>
        <button
          type='button'
          onClick={() => setDisplayYear((y) => y - 1)}
          aria-label='Previous year'
          className='h-7 w-7 grid place-items-center rounded-full hover:bg-surface-hover text-ink-subtle hover:text-ink transition-colors'
        >
          <ChevronLeftIcon className='w-4 h-4' />
        </button>
        <span className='text-body-strong tabular-nums'>{displayYear}</span>
        <button
          type='button'
          onClick={() => setDisplayYear((y) => y + 1)}
          disabled={atMaxYear}
          aria-label='Next year'
          className={`h-7 w-7 grid place-items-center rounded-full transition-colors ${
            atMaxYear
              ? 'text-ink-subtle opacity-40 cursor-not-allowed'
              : 'hover:bg-surface-hover text-ink-subtle hover:text-ink'
          }`}
        >
          <ChevronRightIcon className='w-4 h-4' />
        </button>
      </div>

      <div className='grid grid-cols-3 gap-1'>
        {MONTHS.map((m, i) => {
          const selected = parsed && parsed.year === displayYear && parsed.month === i + 1
          const disabled = isDisabled(i)
          return (
            <button
              key={m}
              type='button'
              disabled={disabled}
              onClick={() => selectMonth(i)}
              className={`py-2 rounded-md text-body transition-colors ${
                selected
                  ? 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover'
                  : disabled
                    ? 'text-ink opacity-40 cursor-not-allowed'
                    : 'text-ink hover:bg-surface-hover'
              }`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className='flex flex-col'>
      {label && <span className='field-label'>{label}</span>}
      <div ref={wrapRef} className={`relative ${className}`}>
        <button
          ref={triggerRef}
          type='button'
          onClick={() => setOpen((v) => !v)}
          aria-haspopup='dialog'
          aria-expanded={open}
          className='input-field pr-8 w-full text-left flex items-center gap-2 cursor-pointer focus:input-field-focus'
        >
          <CalendarIcon className='w-4 h-4 shrink-0 text-ink-subtle' />
          <span className={`flex-1 truncate ${parsed ? 'text-ink' : 'text-ink-subtle'}`}>
            {parsed ? formatValue(value) : placeholder}
          </span>
        </button>
        {parsed && (
          <button
            type='button'
            onClick={clear}
            aria-label='Clear month'
            className='absolute right-2.5 top-1/2 -translate-y-1/2 grid place-items-center w-5 h-5 rounded-full text-ink-subtle hover:text-ink hover:bg-surface-hover transition-colors'
          >
            <XMarkIcon className='w-4 h-4' />
          </button>
        )}
      </div>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
      {hint && <p className='text-caption mt-2'>{hint}</p>}
    </div>
  )
}
