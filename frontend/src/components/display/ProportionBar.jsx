import React from 'react'

/**
 * ProportionBar — a single rounded-pill track split into proportional segments,
 * with a dot/label/count/percent legend below and an optional "as of" caption.
 *
 * `segments`: [{ label, value, pct, colorClass }]. `pct` drives the segment
 * width and the legend percent; if omitted it is derived from value / Σvalue.
 * `colorClass` is a token background utility (e.g. `bg-success`, `bg-primary`,
 * `bg-conservative`, `bg-surface-muted`).
 *
 * Token-class based: the only inline style is each segment's width % (geometry).
 */
export default function ProportionBar({
  segments = [],
  barHeight = 10,
  timestamp,
  className = '',
}) {
  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0)
  const pctOf = (s) => (s.pct != null ? s.pct : total > 0 ? +(((s.value || 0) / total) * 100).toFixed(1) : 0)

  return (
    <div className={className}>
      <div
        className='flex gap-0.5 rounded-pill overflow-hidden bg-surface-muted'
        style={{ height: barHeight }}
        role='img'
        aria-label='proportion bar'
      >
        {segments.map((s, i) => (
          <span
            key={s.label ?? i}
            className={`h-full ${s.colorClass || 'bg-surface-muted'}`}
            style={{ width: `${pctOf(s)}%` }}
            title={`${s.label}: ${pctOf(s)}%`}
          />
        ))}
      </div>

      <div className='flex flex-col gap-2 mt-4'>
        {segments.map((s, i) => (
          <div key={s.label ?? i} className='flex items-center gap-2 text-caption'>
            <span className={`w-2 h-2 rounded-pill shrink-0 ${s.colorClass || 'bg-surface-muted'}`} />
            <span className='text-ink'>{s.label}</span>
            <span className='ml-auto text-body-strong font-mono'>{(s.value ?? 0).toLocaleString()}</span>
            <span className='w-12 text-right text-ink-subtle font-mono'>{pctOf(s)}%</span>
          </div>
        ))}
      </div>

      {timestamp && <p className='text-caption text-ink-subtle mt-4'>{timestamp}</p>}
    </div>
  )
}
