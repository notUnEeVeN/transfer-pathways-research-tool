import React from 'react'

function StatTile({ label, value, sub, accent = false }) {
  return (
    <div className='flex-1 min-w-0 px-6 py-5'>
      <p className='text-label'>{label}</p>
      <p className={`text-stat font-mono mt-2 truncate ${accent ? 'text-primary' : ''}`}>{value}</p>
      {sub && <p className='text-label text-ink-subtle mt-1.5 truncate'>{sub}</p>}
    </div>
  )
}

/**
 * Horizontal strip of metric tiles, separated by hairlines. Stripe Dashboard
 * "Balance / Volume / Payouts" pattern. Pass an array of
 * { label, value, accent }.
 *
 * `bare` drops the card chrome (surface + border + radius) so several strips
 * can be stacked inside one card with `divide-y` to form a true grid — no gaps.
 */
export default function StatStrip({ tiles, className = '', bare = false }) {
  // Bare strips compose into a grid (see StatsBlock) and go responsive: a row
  // of tiles on md+, stacked into a single column on narrow screens so the
  // values don't get crushed.
  const base = bare
    ? 'flex flex-col md:flex-row md:items-stretch divide-y md:divide-y-0 md:divide-x divide-border'
    : 'surface-raised flex items-stretch divide-x divide-border overflow-hidden'
  return (
    <div className={`${base} ${className}`}>
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  )
}
