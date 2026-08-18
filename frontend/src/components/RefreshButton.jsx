import React, { useEffect, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from './ui'

/**
 * The console's refresh affordance, in one place.
 *
 * The reading surfaces hold their figure data for a session instead of
 * refetching on every mount and every window focus, so the refetch a reader
 * used to get for free is now something they have to be able to ASK for. This
 * is what they ask with: one gesture, a spinner while it runs, and — once a
 * refresh has actually landed — how long ago that was. Curation surfaces keep
 * their own freshness guarantees; this control is what makes relaxing them on a
 * reading surface honest rather than quiet.
 *
 * It carries `data-export-exclude` itself rather than trusting each call site
 * to remember. A refresh control is chrome; it must never be baked into an
 * exported figure, and a rule that lives in the component cannot be forgotten
 * by the next one.
 */

// Minute-resolution age, in the same compact vocabulary the verification queue
// uses. Anything finer would be noise on a control the reader just clicked.
export function relativeAge(value, now = Date.now()) {
  const then = typeof value === 'number' ? value : Date.parse(value)
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function RefreshButton({
  onRefresh, refreshing = false, label = 'Refresh', title = null, updatedAt = null,
}) {
  // The caption is a clock, so it cannot be computed once and left there:
  // "Updated just now" still on screen ten minutes later is a false statement
  // about how old the numbers are. Ticking beats re-rendering the figure.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!updatedAt) return undefined
    const id = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [updatedAt])

  // Nothing is said until a refresh has landed. Before that this component does
  // not know when the cached data arrived, and guessing would be worse than
  // silence.
  const age = updatedAt ? relativeAge(updatedAt) : ''

  return (
    <span className='inline-flex items-center gap-2' data-export-exclude>
      <Button variant='secondary' size='sm' leadingIcon={ArrowPathIcon}
        loading={refreshing} onClick={onRefresh}
        // `title` doubles as the accessible name so several identical "Refresh"
        // buttons on one page can be told apart. Callers pass a title that
        // STARTS with the visible label, or the spoken name and the printed one
        // part company.
        title={title || undefined} aria-label={title || undefined}>
        {label}
      </Button>
      {age && <span className='text-caption ink-subtle'>Updated {age}</span>}
    </span>
  )
}
