import React, { useState } from 'react'
import { Badge } from '../../components/ui'

/**
 * Reconciles the final Figure 1 matrix with the recovered final articulation workbook.
 *
 * Cell counts and values come only from ComparisonWorkspace's live join. The
 * prose headline (38.2%) is the paper's stated value; it is deliberately kept
 * separate from both means calculated below to avoid confusing the printed prose with the recalculated cell population.
 */

const sourceOf = (pane) => pane?.knobs?.['ma-source'] ?? 'pdf'

// Figure 1 was rendered through seaborn's `.0%` formatter, which delegates to
// round-half-to-even. Keeping that display rule here prevents an ordinary
// archive decimal from becoming a false cell discrepancy.
export function roundHalfEven(value) {
  if (!Number.isFinite(value)) return null
  const sign = value < 0 ? -1 : 1
  const magnitude = Math.abs(value)
  const lower = Math.floor(magnitude)
  const fraction = magnitude - lower
  if (Math.abs(fraction - 0.5) <= 1e-10) {
    return sign * (lower % 2 === 0 ? lower : lower + 1)
  }
  return sign * Math.round(magnitude)
}

const mean = (values) => {
  const finite = values.filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}

const pct = (value, digits = 2) => (Number.isFinite(value)
  ? `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}%`
  : '—')

function Block({ title, children }) {
  return (
    <section className='flex flex-col gap-1.5'>
      <p className='text-label'>{title}</p>
      {children}
    </section>
  )
}

export default function MaCoverageFigure1({
  panes = [], comparison, join, delta, selectedCell, onSelectCell,
}) {
  const cellJoin = join || delta
  const cells = cellJoin?.cells || []
  const [openKey, setOpenKey] = useState(null)

  const baselinePane = panes.find((pane) => pane.id === comparison?.baseline_pane) || panes[0]
  const pdfPane = panes.find((pane) => sourceOf(pane) === 'pdf')
  const archivePane = panes.find((pane) => sourceOf(pane) === 'archive')
  const valueFor = (cell, pane) => {
    if (!cell || !pane) return null
    return pane.id === baselinePane?.id ? cell.baseline : cell.subject
  }
  const pdfValue = (cell) => valueFor(cell, pdfPane)
  const archiveValue = (cell) => valueFor(cell, archivePane)

  const displayDifferences = cells.filter((cell) => (
    roundHalfEven(pdfValue(cell)) !== roundHalfEven(archiveValue(cell))
  ))
  const displayMatches = cells.length - displayDifferences.length
  const archiveMean = mean(cells.map(archiveValue))
  const printedPdfMean = mean(cells.map(pdfValue))

  const activeKey = selectedCell ?? openKey
  const toggle = (cell) => {
    const closing = activeKey === cell.key
    setOpenKey(closing ? null : cell.key)
    onSelectCell?.(closing ? null : cell)
  }

  return (
    <div className='surface-card p-4 flex flex-col gap-4' data-export-exclude>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-label'>Figure 1 source reconciliation</p>
        {cellJoin && (
          <Badge variant={displayDifferences.length === 1 ? 'conservative' : 'neutral'}>
            {displayMatches} of {cellJoin.matched} match at printed precision
          </Badge>
        )}
      </div>

      <p className='text-caption text-ink-muted max-w-[82ch]'>
        This compares the final PDF&rsquo;s printed whole percentages with our recalculation
        from the recovered final articulation workbook, using the paper&rsquo;s half-even
        display rounding. A difference requires checking the underlying source rows.
      </p>

      <Block title={displayDifferences.length === 1 ? 'Sole visible cell revision' : 'Visible cell revisions'}>
        {!displayDifferences.length ? (
          <p className='text-caption text-ink-muted'>No matched cell differs at printed precision.</p>
        ) : (
          <ul className='flex flex-col gap-1'>
            {displayDifferences.map((cell) => {
              const open = activeKey === cell.key
              return (
                <li key={cell.key} className='flex flex-col gap-1'>
                  <button type='button' onClick={() => toggle(cell)} aria-expanded={open}
                    className='flex flex-wrap items-baseline gap-x-3 gap-y-1 text-left px-2 py-1.5 rounded-lg hover:bg-surface-hover'>
                    <span className='text-caption text-ink'>{cell.rowLabel} × {cell.colLabel}</span>
                    <span className='text-tag text-ink-subtle ml-auto tabular-nums'>
                      Final PDF {pct(pdfValue(cell), 1)} · recalculation {pct(archiveValue(cell), 4)}
                      {' '}→ {pct(roundHalfEven(archiveValue(cell)), 0)}
                    </span>
                  </button>
                  {open && (
                    <div className='bg-surface-sunken rounded-lg px-3 py-2 text-caption text-ink-muted'>
                      The printed value and recalculated final-workbook ratio differ at
                      displayed precision. Check the source requirement and articulation rows.
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {cellJoin?.dropped?.length > 0 && (
          <p className='text-tag text-ink-subtle'>
            {cellJoin.dropped.length} cell{cellJoin.dropped.length === 1 ? '' : 's'} occur in one
            source only and are not included in the printed-precision count.
          </p>
        )}
      </Block>

      {Number.isFinite(archiveMean) && Number.isFinite(printedPdfMean) && (
        <Block title='38.2% headline caveat'>
          <p className='text-caption text-ink-muted max-w-[82ch]'>
            The matched recalculated ratios average {pct(archiveMean, 4)}
            {' '}(one decimal: {pct(archiveMean, 1)}); the final printed cells average
            {' '}{pct(printedPdfMean, 4)}. The paper’s prose reports 38.2%.
            These are separate summaries: cell rounding can change a mean, and the prose
            should be checked against the complete source population.
          </p>
        </Block>
      )}
    </div>
  )
}
