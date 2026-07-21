/**
 * "How this is measured" — the definition of a figure's statistic, shown
 * beside the figure itself.
 *
 * It exists so a collaborator can check whether we compute a quantity the way
 * they do without opening code or asking. Shared by the Visuals gallery and
 * the research showcase so the two can never drift apart.
 */

import React from 'react'

export default function MeasurePanel({ measure, className = '', ...rest }) {
  if (!measure) return null
  return (
    <section className={`rounded-2xl border border-border bg-surface-muted px-6 py-5 ${className}`}
      aria-label='How this is measured' {...rest}>
      <div className='flex items-baseline justify-between gap-4'>
        <p className='text-label'>How this is measured</p>
        <p className='text-caption text-ink-subtle'>{measure.grain}</p>
      </div>
      <p className='mt-3 text-body-strong text-pretty'>{measure.expression}</p>
      <p className='mt-3 text-caption text-ink-muted text-pretty'>{measure.watchFor}</p>
    </section>
  )
}
