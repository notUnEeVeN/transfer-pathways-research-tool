import React from 'react'
import { Badge } from '../../components/ui'

/**
 * Figure 3's direct audit: final-paper percentages against the paper formula
 * applied to the authors' available course-plan data. Numeric claims are
 * derived only from the two panes' comparable-cell payloads. The four
 * explanatory patterns are meeting questions, not alternative mismatch lists.
 */

const sourceOf = (pane) => pane?.knobs?.source ?? 'pdf'

// The paper's whole-percentage display uses spreadsheet/Python half-even
// rounding. Preserve that rule so an exact x.5 input does not become a false
// mismatch merely because JavaScript rounds positive ties upward.
function roundHalfEven(value) {
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
  return finite.length
    ? finite.reduce((sum, value) => sum + value, 0) / finite.length
    : null
}

const pct3 = (value) => (Number.isFinite(value) ? `${value.toFixed(3)}%` : '—')

function Block({ title, children }) {
  return (
    <section className='flex flex-col gap-1.5'>
      <p className='text-label'>{title}</p>
      {children}
    </section>
  )
}

export default function MaTransferCreditFigure3({ panes = [], comparison, join, delta }) {
  const cellJoin = join || delta
  const cells = cellJoin?.cells || []
  const baselinePane = panes.find((pane) => pane.id === comparison?.baseline_pane) || panes[0]
  const pdfPane = panes.find((pane) => sourceOf(pane) === 'pdf')
  const recalculatedPane = panes.find((pane) => sourceOf(pane) === 'archive-gray-detail')
  const valueFor = (cell, pane) => {
    if (!cell || !pane) return null
    return pane.id === baselinePane?.id ? cell.baseline : cell.subject
  }
  const pdfValue = (cell) => valueFor(cell, pdfPane)
  const recalculatedValue = (cell) => valueFor(cell, recalculatedPane)
  const comparable = cells.filter((cell) => (
    Number.isFinite(pdfValue(cell)) && Number.isFinite(recalculatedValue(cell))
  ))
  // Figure 3 prints whole percentages. Reproduction therefore means that the
  // direct result rounds to the printed paper cell, not that hidden decimals
  // are exactly equal.
  const reproduced = comparable.filter((cell) => (
    roundHalfEven(recalculatedValue(cell)) === roundHalfEven(pdfValue(cell))
  ))
  const differences = comparable.length - reproduced.length
  const pdfMean = mean(comparable.map(pdfValue))
  const recalculatedMean = mean(comparable.map(recalculatedValue))

  return (
    <div className='flex flex-col gap-4' data-export-exclude>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-label'>Figure 3 source reconciliation</p>
        {cellJoin && (
          <>
            <Badge variant='neutral'>
              {reproduced.length} of {comparable.length} reproduce at paper whole-% precision
            </Badge>
            <Badge variant='danger'>
              {differences} recalculation difference{differences === 1 ? '' : 's'}
            </Badge>
          </>
        )}
      </div>

      <Block title='Direct result'>
        {comparable.length ? (
          <p className='text-caption text-ink-muted max-w-[86ch]'>
            Across the {comparable.length} matched pathways, the final-paper cell mean is{' '}
            <span className='text-ink tabular-nums'>{pct3(pdfMean)}</span>; our recalculated mean is{' '}
            <span className='text-ink tabular-nums'>{pct3(recalculatedMean)}</span>. The{' '}
            {differences} non-reproducing values are potential paper errors or unprovided
            final-input revisions; the available files do not prove which.
          </p>
        ) : (
          <p className='text-caption text-ink-muted'>The matched Figure 3 cells are not available yet.</p>
        )}
      </Block>

      <Block title='What may explain the differences'>
        <p className='text-caption text-ink-muted max-w-[86ch]'>
          These clues overlap. They explain what to ask the authors; they are not separate
          mismatch lists and do not turn any value into a proven error.
        </p>
        <ol className='list-decimal pl-5 space-y-2 text-caption text-ink-muted max-w-[92ch]'>
          <li>
            <span className='text-ink'>Nine coordinated Figure 3/Figure 4 changes.</span>{' '}
            The same nine pathways gain applicable credit here while their excess hours fall
            to zero in Figure 4. That coherent movement suggests a later pathway revision whose
            final input sheets were not provided.
          </li>
          <li>
            <span className='text-ink'>Selective blue-credit and cap patterns.</span>{' '}
            Several paper cells reproduce only if unrestricted-elective-only blue credit is
            selectively counted; two also require a 100% cap. The paper gives no exception rule,
            so a final method detail or final input may be missing.
          </li>
          <li>
            <span className='text-ink'>Two possible stale 63-credit denominators.</span>{' '}
            Westfield–STCC&apos;s 67% equals 42/63 and Worcester–STCC&apos;s 60% equals 38/63,
            while the available associate-degree total is 61 credits. This explanation is
            conditional on 42 and 38 being the final numerators.
          </li>
          <li>
            <span className='text-ink'>Four unresolved cells.</span>{' '}
            Dartmouth–Massasoit, Bridgewater–Roxbury, Framingham–Massasoit, and
            Framingham–Middlesex do not reproduce under any consistent treatment of the
            available blue credit.
          </li>
        </ol>
      </Block>
    </div>
  )
}
