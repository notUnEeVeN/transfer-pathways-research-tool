import React from 'react'

/**
 * HBarList — a horizontal bar list. Each row is a label + count line over a thin
 * rounded track whose fill width is the row's `pct` (relative to the leader).
 * Used for ranked breakdowns like "users by home college".
 *
 * `rows`: [{ label, value, pct, colorClass }]. When `pct` is omitted it is
 * derived from value / max(value). `colorClass` is a token background utility
 * (defaults to `bg-primary`).
 *
 * Token-class based: the only inline style is each fill's width % (geometry).
 */
export default function HBarList({ rows = [], className = '' }) {
  const max = rows.length ? Math.max(...rows.map((r) => r.value || 0), 0) : 0
  const widthOf = (r) => {
    if (r.pct != null) return r.pct
    return max > 0 ? +(((r.value || 0) / max) * 100).toFixed(1) : 0
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {rows.map((r, i) => (
        <div key={r.label ?? i}>
          <div className='flex justify-between text-caption mb-1.5'>
            <span className='text-ink'>{r.label}</span>
            <span className='text-ink-muted text-body-strong font-mono'>{(r.value ?? 0).toLocaleString()}</span>
          </div>
          <div className='h-[7px] rounded-pill overflow-hidden bg-surface-muted'>
            <span
              className={`block h-full rounded-pill ${r.colorClass || 'bg-primary'}`}
              style={{ width: `${widthOf(r)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
