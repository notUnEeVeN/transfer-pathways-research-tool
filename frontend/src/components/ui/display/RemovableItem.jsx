import React from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import IconButton from '../buttons/IconButton'

/**
 * A removable item with a destructive remove affordance that warms to danger on
 * hover, so removing reads as a deliberate, reversible action. Two shapes:
 *
 *  - `row` (default): a flat bordered surface-card row with a leading slot (e.g.
 *    a Badge), the label/`children`, and an optional trailing control (e.g. a
 *    grade Select) — for stacked lists (secondary colleges, targets, courses).
 *  - `pill`: a compact inline pill of `label` — for wrap lists (Settings).
 *
 * Props: `variant` · `label` (pill text / row fallback) · `leading` ·
 * `children` (row label content) · `trailing` · `onRemove` · `removeLabel`
 * (accessible name for the remove control; defaults to "Remove {label}").
 */
export default function RemovableItem({ variant = 'row', label, leading, children, trailing, onRemove, removeLabel }) {
  const removeName = removeLabel || (label ? `Remove ${label}` : 'Remove')

  if (variant === 'pill') {
    return (
      <span className='inline-flex items-center gap-1.5 h-7 pl-3 pr-1 rounded-pill border border-border bg-surface text-body-strong text-ink'>
        <span className='truncate'>{label}</span>
        {onRemove && (
          <button
            type='button'
            onClick={onRemove}
            aria-label={removeName}
            className='grid place-items-center w-5 h-5 rounded-full text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger'
          >
            <XMarkIcon className='w-3.5 h-3.5' />
          </button>
        )}
      </span>
    )
  }

  return (
    <div className='group/row flex items-center gap-2 surface-card px-4 py-2.5'>
      {leading}
      <div className='min-w-0 flex-1'>{children ?? label}</div>
      {trailing}
      <IconButton
        icon={XMarkIcon}
        label={removeName}
        size='sm'
        onClick={onRemove}
        className='text-ink-subtle hover:text-danger hover:bg-danger-soft'
      />
    </div>
  )
}
