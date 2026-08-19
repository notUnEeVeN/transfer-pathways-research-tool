import React from 'react'
import { PAPER_RED_LOW_TO_HIGH_GRADIENT } from './maHeatmapColors'

const fallbackFormat = (value) => String(value)

/**
 * Compact, export-safe receipt for a heatmap's display domain. A shared
 * comparison scale says so explicitly; gallery figures continue to disclose
 * their local adaptive domain.
 */
export default function ColorDomainLegend({
  scale,
  formatValue = fallbackFormat,
  suffix = '',
  gradient = PAPER_RED_LOW_TO_HIGH_GRADIENT,
}) {
  if (!Number.isFinite(scale?.min) || !Number.isFinite(scale?.max)) return null
  const mid = Number.isFinite(scale.mid) ? scale.mid : (scale.min + scale.max) / 2
  const prefix = scale.comparisonShared ? 'Shared comparison color domain' : 'Color domain'
  const suffixText = suffix ? ` ${suffix}` : ''
  const label = `${prefix}: ${formatValue(scale.min)}–${formatValue(scale.max)}${suffixText}`

  return (
    <div data-color-domain={scale.comparisonShared ? 'shared' : 'local'}
      className='surface-card flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-caption text-ink-subtle'
      aria-label={label}>
      <span className='text-label'>{label}</span>
      <div className='w-44 max-w-full' aria-hidden='true'>
        <div className='h-2 rounded-pill border border-border'
          style={{ background: gradient }} />
        <div className='mt-1 flex justify-between font-mono tabular-nums'>
          <span>{formatValue(scale.min)}</span>
          <span>{formatValue(mid)}</span>
          <span>{formatValue(scale.max)}</span>
        </div>
      </div>
    </div>
  )
}
