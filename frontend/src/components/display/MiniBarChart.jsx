import React from 'react'

/**
 * MiniBarChart — a compact flex row of vertical bars, one per value. Each value
 * is mapped to a height percentage of the tallest bar; bars shade via token
 * classes (older/lower bars sit on `bg-primary-soft`, the current/peak bars on
 * `bg-primary`), or a caller-supplied `colorFn(value, index, max)` returning a
 * token class. Optional start / mid / end axis labels sit under the row.
 *
 * Purely presentational and token-class based — only the per-bar height % is an
 * inline style (chart geometry), never a colour.
 */
export default function MiniBarChart({
  data = [],
  height = 96,
  colorFn,
  labels,
  className = '',
}) {
  const max = data.length ? Math.max(...data, 0) : 0

  // Default shading: bottom third soft, the peak bright, the rest mid. Keeps the
  // "recent/peak pops" read from the design without hard-coding hexes.
  const defaultColor = (v) => {
    if (max <= 0) return 'bg-surface-muted'
    const ratio = v / max
    if (ratio >= 0.85) return 'bg-primary'
    if (ratio >= 0.6) return 'bg-primary/60'
    return 'bg-primary-soft'
  }
  const pick = colorFn || defaultColor

  return (
    <div className={className}>
      <div className='flex items-end gap-1' style={{ height }} role='img' aria-label='bar chart'>
        {data.map((v, i) => {
          const pct = max > 0 ? Math.max((v / max) * 100, 2) : 2
          return (
            <i
              key={i}
              className={`flex-1 rounded-t-sm ${pick(v, i, max)}`}
              style={{ height: `${pct}%` }}
              title={String(v)}
            />
          )
        })}
      </div>
      {labels && labels.length > 0 && (
        <div className='flex justify-between mt-2.5 text-label text-ink-subtle font-mono'>
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}
