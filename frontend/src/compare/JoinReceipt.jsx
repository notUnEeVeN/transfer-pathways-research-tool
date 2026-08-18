import React, { useState } from 'react'

/**
 * What the join actually did, permanently on screen.
 *
 * Not a footnote: an inner join that silently discards the pairs one corpus
 * studied and the other did not understates disagreement, and in a meeting the
 * rows you dropped are the first thing someone asks about. So the counts are
 * always visible and the dropped keys are one disclosure away.
 */
export default function JoinReceipt({ grain, assessment, join, baselineLabel, subjectLabel }) {
  const [open, setOpen] = useState(false)
  if (!join) return null

  // `side` names the pane that was MISSING the cell, so it reads as "only in
  // the other one".
  const onlyInSubject = join.dropped.filter((cell) => cell.side === 'baseline')
  const onlyInBaseline = join.dropped.filter((cell) => cell.side === 'subject')
  const nonNumeric = join.dropped.filter((cell) => cell.side === 'value')

  return (
    <section className='surface-card px-[22px] py-3.5' data-export-exclude>
      <div className='flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-ink-muted'>
        {grain && <><span className='ink-subtle'>grain</span> <span className='text-ink'>{grain}</span> ·</>}
        <span className='text-ink'>{assessment.join}</span> ·
        {/* The headline finding, in words: the figures draw the difference,
            this says how much of it there is. */}
        <span className='text-ink'>
          <span className='tabular'>{join.agreeing}</span> of{' '}
          <span className='tabular'>{join.matched}</span> cells agree
        </span> ·
        <span>matched <span className='text-ink tabular'>{join.matched}</span></span> ·
        <span>only in {baselineLabel} <span className='text-ink tabular'>{onlyInBaseline.length}</span></span> ·
        <span>only in {subjectLabel} <span className='text-ink tabular'>{onlyInSubject.length}</span></span> ·
        <span>dropped <span className='text-ink tabular'>{join.dropped.length}</span></span>
        {!!join.dropped.length && (
          <button type='button' onClick={() => setOpen((value) => !value)} aria-expanded={open}
            className='ml-auto rounded-pill border border-border px-2.5 py-0.5 text-tag
              ink-muted hover:border-border-strong hover:text-ink'>
            {open ? 'Hide dropped' : `Show ${join.dropped.length} dropped`}
          </button>
        )}
      </div>
      {open && (
        <ul className='mt-2.5 flex flex-col gap-1 border-t border-border pt-2.5'>
          {join.dropped.map((cell) => (
            <li key={`${cell.side}:${cell.key}`} className='text-caption ink-subtle'>
              <span className='text-ink'>{cell.rowLabel} × {cell.colLabel}</span>
              {' — '}
              {cell.side === 'value'
                ? 'a value that is not a number in one pane'
                : `only in ${cell.side === 'baseline' ? subjectLabel : baselineLabel}`}
            </li>
          ))}
        </ul>
      )}
      {!!nonNumeric.length && !open && (
        <p className='mt-1 text-caption ink-subtle'>
          {nonNumeric.length} of the dropped cells carried a value that is not a number.
        </p>
      )}
    </section>
  )
}
