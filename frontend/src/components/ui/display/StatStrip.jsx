import React from 'react'

function StatTile({ label, value, sub, accent = false, tone }) {
  // `tone='danger'` wins when passed (e.g. an Errors count); otherwise
  // `accent` reads as a success/positive signal. Neither set → plain ink.
  const valueTone = tone === 'danger' ? 'text-danger' : accent ? 'text-success' : ''
  return (
    <div className='flex-1 min-w-0 px-[22px] py-4'>
      <p className='text-label'>{label}</p>
      <p className={`text-stat mt-1.5 truncate ${valueTone}`}>{value}</p>
      {sub && <p className='text-caption mt-1 truncate'>{sub}</p>}
    </div>
  )
}

/**
 * Horizontal strip of metric tiles, separated by hairlines. Stripe Dashboard
 * "Balance / Volume / Payouts" pattern. Pass an array of
 * { label, value, sub, accent, tone }.
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
    : 'surface-card flex items-stretch divide-x divide-border/60 overflow-hidden'
  return (
    <div className={`${base} ${className}`}>
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  )
}
