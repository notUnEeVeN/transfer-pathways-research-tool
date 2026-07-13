import React from 'react'
import { Spinner } from '../components/ui'

/**
 * Shared pieces for the built-in analyses (Data → Analysis tab).
 *
 * Charts here follow MiniBarChart's philosophy: token classes carry color,
 * inline styles carry geometry only (heights/widths as percentages), so light
 * and dark mode both work with no chart-side theme code. Every mark carries a
 * native title/aria-label tooltip, and each analysis keeps a table view so no
 * value is reachable only by hover.
 */

export function shortenSchool(school) {
  return String(school || '')
    .replace(/^University of California,\s*/i, '')
    .replace(/^UC\s+/i, '')
    .trim()
}

/**
 * HistogramRows — small-multiples distribution, one row per group (campus) on
 * a SHARED integer slot scale, so rows compare honestly. `rows[].bins` maps
 * slot index → { count, title }; bar height = count against the global max.
 * A hairline tick marks each row's mean when `meanSlot` is set.
 */
export function HistogramRows({ rows, slots, slotLabel, countNoun = 'agreements', barClass = 'bg-primary', bandHeight = 52 }) {
  const slotIndexes = Array.from({ length: slots }, (_, i) => i)
  const maxCount = Math.max(1, ...rows.flatMap((r) => slotIndexes.map((i) => r.bins[i]?.count || 0)))
  // Aim for ~8 tick labels; slots are integers so steps stay integers.
  const tickEvery = Math.max(1, Math.ceil(slots / 8))

  return (
    <div>
      {rows.map((row) => (
        <div key={row.key} className='flex items-end gap-3 border-b border-border last:border-b-0 py-1.5'>
          <div className='w-40 shrink-0 pb-1'>
            <span className='block text-caption text-ink leading-tight'>{row.label}</span>
            {row.sub && <span className='block text-tag text-ink-subtle leading-tight'>{row.sub}</span>}
          </div>
          <div className='relative flex-1 flex items-end' style={{ height: bandHeight }}>
            {slotIndexes.map((i) => {
              const bin = row.bins[i]
              const pct = bin ? Math.max((bin.count / maxCount) * 100, 6) : 0
              return (
                <div key={i} className='flex-1 h-full flex items-end justify-center px-px'>
                  {bin && (
                    <div
                      title={bin.title}
                      aria-label={bin.title}
                      className={`w-full max-w-6 rounded-t-sm transition-opacity hover:opacity-75 ${barClass}`}
                      style={{ height: `${pct}%` }}
                    />
                  )}
                </div>
              )
            })}
            {Number.isFinite(row.meanSlot) && (
              <div
                title={`Mean: ${slotLabel(row.meanSlot)}`}
                className='absolute top-0 bottom-0 w-px bg-ink-subtle'
                style={{ left: `${((row.meanSlot + 0.5) / slots) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
      <div className='flex items-start gap-3 mt-1.5'>
        <div className='w-40 shrink-0' />
        <div className='flex-1 flex'>
          {slotIndexes.map((i) => (
            <div key={i} className='flex-1 text-center text-label text-ink-subtle font-mono'>
              {i % tickEvery === 0 ? slotLabel(i) : ''}
            </div>
          ))}
        </div>
      </div>
      <div className='flex items-center gap-3 mt-2 text-tag text-ink-subtle'>
        <div className='w-40 shrink-0' />
        <span className='inline-flex items-center gap-1.5'>
          <i className='inline-block w-px h-3 bg-ink-subtle' /> row mean · bar height = {countNoun} at that value
        </span>
      </div>
    </div>
  )
}

/** Standard loading card, shared by every analysis component. */
export function AnalysisLoading() {
  return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
}
