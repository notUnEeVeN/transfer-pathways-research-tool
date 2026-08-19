import React from 'react'
import { Button } from '../components/ui'
import { verdictDrift } from './delta'
import { fmtDate } from '../shared/fmtDate'

/**
 * A comparison re-runs live queries by design — its whole job is to be
 * *currently* true — and coverage with requirements=degree deliberately
 * bypasses the server cache so a template edit lands on the next request. So a
 * note written in August can be silently contradicted in November by an edit
 * nobody connected to it.
 *
 * `verdict_at_pin` is the reconciliation: the numbers observed when the
 * comparison was pinned, rendered against the numbers on screen right now.
 * This banner is the difference between a research tool and a source of
 * confidently wrong claims, which is why it ships in increment 1.
 */

const FIELD_LABELS = {
  matched: 'matched',
  agreeing: 'agreeing',
  dropped: 'dropped',
  mean_delta: 'mean Δ',
  max_abs_delta: 'max |Δ|',
  max_cell: 'largest Δ at',
}

const show = (value) => (value === null || value === undefined ? '—' : String(value))

export default function VerdictDrift({ pinned, current, onRepin, repinning = false, pinnable = false }) {
  const changes = verdictDrift(pinned, current)

  // Nothing pinned yet. A saved comparison with no pinned reading cannot drift
  // and cannot be checked later, so offer the pin rather than staying silent —
  // that silence is exactly how the eight saved exhibits ended up unpinned.
  if (!pinned) {
    if (!pinnable || !onRepin) return null
    return (
      <div className='surface-card border-l-[3px] border-l-border-strong px-[22px] py-4' data-export-exclude>
        <div className='flex items-start gap-3'>
          <p className='min-w-0 flex-1 text-caption text-ink-muted'>
            No numbers are pinned, so later movement in either pane will go unrecorded.
          </p>
          <Button variant='secondary' size='sm' onClick={onRepin} disabled={repinning}>
            {repinning ? 'Pinning…' : 'Pin these numbers'}
          </Button>
        </div>
      </div>
    )
  }

  if (!changes) return null

  return (
    <div className='surface-card border-l-[3px] border-l-prov-ca px-[22px] py-4' data-export-exclude>
      <div className='flex items-start gap-3'>
        <div className='min-w-0 flex-1'>
          <p className='text-body-strong text-ink'>This comparison has moved since it was pinned.</p>
          <ul className='mt-1.5 flex flex-col gap-0.5'>
            {changes.map((change) => (
              <li key={change.field} className='text-caption text-ink-muted'>
                {FIELD_LABELS[change.field] || change.field}:{' '}
                <span className='tabular ink-subtle line-through'>{show(change.from)}</span>
                {' → '}
                <span className='tabular text-ink'>{show(change.to)}</span>
              </li>
            ))}
          </ul>
          {pinned?.computed_at && (
            <p className='mt-1.5 text-caption ink-subtle'>Pinned {fmtDate(pinned.computed_at)}</p>
          )}
        </div>
        {onRepin && (
          <Button variant='secondary' size='sm' onClick={onRepin} disabled={repinning}>
            {repinning ? 'Re-pinning…' : 'Re-pin'}
          </Button>
        )}
      </div>
    </div>
  )
}
