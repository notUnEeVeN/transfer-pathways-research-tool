import React, { useState } from 'react'
import { Badge } from '../../components/ui'

/**
 * Figure 4's one audit baseline: the final PDF against the paper formula
 * applied directly to the authors' lowest-level pathway-sheet totals. Every mismatch
 * stays in the primary ledger. Possible manual-summary mistakes or later
 * coordinated revisions are secondary explanations, never filters.
 */

const sourceOf = (pane) => pane?.knobs?.source ?? 'pdf'

const mean = (values) => {
  const finite = values.filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}

const hours = (value, digits = 3) => (Number.isFinite(value)
  ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
  : '—')

const plusHours = (value) => (Number.isFinite(value) ? `+${hours(value, 1)}` : '—')

function manualSummaryPair(cell) {
  const row = `${cell?.rowKey || ''} ${cell?.rowLabel || ''}`
  const column = `${cell?.colKey || ''} ${cell?.colLabel || ''}`
  if (/Quinsigamond/i.test(row) && /Fitchburg/i.test(column)) return 'Fitchburg × Quinsigamond'
  if (/Bunker Hill/i.test(row) && /UMass Boston/i.test(column)) return 'UMass Boston × Bunker Hill'
  if (/MassBay/i.test(row) && /UMass Boston/i.test(column)) return 'UMass Boston × MassBay'
  return null
}

const pairName = (cell) => manualSummaryPair(cell)
  || `${cell?.colLabel ?? cell?.colKey ?? 'University'} × ${cell?.rowLabel ?? cell?.rowKey ?? 'college'}`

function secondaryClassification(cell, pdf, detail) {
  const manual = manualSummaryPair(cell)
  const coordinated = pdf === 0 && detail > 0
  if (manual && coordinated) {
    return {
      label: 'Revision pattern + manual-summary signature',
      detail: 'This cell both follows the hand-entered master and belongs to the positive-to-zero group that also moves coherently in Figure 3. A later revision is therefore plausible even though the detail and summary artifacts disagree.',
    }
  }
  if (manual) {
    return {
      label: 'Manual-summary signature',
      detail: 'The final paper follows the hand-entered master value rather than the authors’ detail-sheet total. That makes a manual carry-forward plausible, but final-version sheets are still needed to prove it.',
    }
  }
  if (coordinated) {
    return {
      label: 'Coordinated zeroing pattern',
      detail: 'This belongs to the coordinated group where a positive recalculated result became zero in the final paper. A later input revision is plausible, but the missing final sheets prevent verification.',
    }
  }
  return {
    label: 'Unexplained input difference',
    detail: 'Our recalculation and the final paper differ. The available files do not identify whether the cause is an error or an unprovided final-input revision.',
  }
}

function Block({ title, children }) {
  return (
    <section className='flex flex-col gap-1.5'>
      <p className='text-label'>{title}</p>
      {children}
    </section>
  )
}

export default function MaExtraUnitsFigure4({
  panes = [], comparison, join, delta, selectedCell, onSelectCell,
}) {
  const cellJoin = join || delta
  const cells = cellJoin?.cells || []
  const [openKey, setOpenKey] = useState(null)

  const baselinePane = panes.find((pane) => pane.id === comparison?.baseline_pane) || panes[0]
  const pdfPane = panes.find((pane) => sourceOf(pane) === 'pdf')
  const detailPane = panes.find((pane) => sourceOf(pane) === 'archive-detail')
  const valueFor = (cell, pane) => {
    if (!cell || !pane) return null
    return pane.id === baselinePane?.id ? cell.baseline : cell.subject
  }
  const pdfValue = (cell) => valueFor(cell, pdfPane)
  const detailValue = (cell) => valueFor(cell, detailPane)
  const changed = cells.filter((cell) => (
    Number.isFinite(pdfValue(cell))
      && Number.isFinite(detailValue(cell))
      && Math.abs(pdfValue(cell) - detailValue(cell)) > 0.1
  ))
  const manualSummary = changed.filter((cell) => manualSummaryPair(cell))
  const coordinatedZeroing = changed.filter((cell) => (
    pdfValue(cell) === 0 && detailValue(cell) > 0
  ))
  const reproduced = Math.max(0, (cellJoin?.matched ?? cells.length) - changed.length)

  const byUniversity = new Map()
  for (const cell of cells) {
    const value = pdfValue(cell)
    if (!Number.isFinite(value)) continue
    const key = String(cell.colKey ?? cell.colLabel ?? '')
    if (!byUniversity.has(key)) byUniversity.set(key, [])
    byUniversity.get(key).push(value)
  }
  const universityMeans = [...byUniversity.values()].map(mean).filter(Number.isFinite)
  const positiveMeans = universityMeans.filter((value) => value > 0)
  const visibleMin = universityMeans.length ? Math.min(...universityMeans) : null
  const visibleMax = universityMeans.length ? Math.max(...universityMeans) : null
  const visiblePositiveMin = positiveMeans.length ? Math.min(...positiveMeans) : null

  const activeKey = selectedCell ?? openKey
  const toggle = (cell) => {
    const closing = activeKey === cell.key
    setOpenKey(closing ? null : cell.key)
    onSelectCell?.(closing ? null : cell)
  }

  return (
    <div className='surface-card p-4 flex flex-col gap-4' data-export-exclude>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-label'>Figure 4 source reconciliation</p>
        <Badge variant='danger'>Confirmed mixed-cohort prose range</Badge>
        {cellJoin && (
          <>
            <Badge variant='neutral'>{reproduced} of {cellJoin.matched} cells reproduce</Badge>
            <Badge variant='danger'>
              {changed.length} recalculation difference{changed.length === 1 ? '' : 's'}
            </Badge>
          </>
        )}
      </div>

      <Block title='What is confirmed'>
        {Number.isFinite(visibleMin) && Number.isFinite(visibleMax) ? (
          <p className='text-caption text-ink-muted max-w-[86ch]'>
            The paper says university-average extra hours range &ldquo;from six to 35.&rdquo;
            In the {cellJoin?.matched ?? cells.length} matched final-PDF Figure 4 cells, the live
            column means range {hours(visibleMin)}–{hours(visibleMax)}; positive means range{' '}
            {hours(visiblePositiveMin)}–{hours(visibleMax)}. The separately audited all-61 Figure 7
            cohort ranges 0–33.875, or 6–33.875 among positive means. No one cohort yields both
            prose endpoints: six comes from the 61-path cohort, while 35 is the rounded maximum of
            the displayed Figure 4 cohort. This is a confirmed scope error in the sentence, not an
            arithmetic error in the 49 printed cells.
          </p>
        ) : (
          <p className='text-caption text-ink-muted'>The matched final-PDF cells are not available yet.</p>
        )}
      </Block>

      <Block title='Raw-data rerun disagreements'>
        <p className='text-caption text-ink-muted max-w-[86ch]'>
          We applied <span className='font-mono'>max(0, pathway-sheet total − 120)</span> to the
          authors&rsquo; source pathway sheets and compared the result with the final paper. Every value below is
          a potential error or an unexplained final-input revision. The final-version source sheets
          are not available, so the evidence cannot decide between those explanations.
        </p>
        {!changed.length ? (
          <p className='text-caption text-ink-muted'>Every matched cell reproduces in our recalculation.</p>
        ) : (
          <ul className='flex flex-col gap-1'>
            {changed.map((cell) => {
              const open = activeKey === cell.key
              const classification = secondaryClassification(
                cell, pdfValue(cell), detailValue(cell)
              )
              return (
                <li key={cell.key} className='flex flex-col gap-1'>
                  <button type='button' onClick={() => toggle(cell)} aria-expanded={open}
                    className='flex flex-wrap items-baseline gap-x-3 gap-y-1 text-left px-2 py-1.5 rounded-lg hover:bg-surface-hover'>
                    <span className='text-caption text-ink'>{pairName(cell)}</span>
                    <span className='text-tag text-ink-subtle'>{classification.label}</span>
                    <span className='text-tag text-ink-subtle ml-auto tabular-nums'>
                      Final paper {plusHours(pdfValue(cell))} · our recalculation {plusHours(detailValue(cell))}
                    </span>
                  </button>
                  {open && (
                    <div className='bg-surface-sunken rounded-lg px-3 py-2 text-caption text-ink-muted'>
                      <span className='text-ink'>{classification.label}:</span>{' '}
                      {classification.detail}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Block>

      <Block title='Secondary pattern—not a different mismatch list'>
        <p className='text-caption text-ink-muted max-w-[86ch]'>
          All {changed.length} values above remain recalculation differences. As a secondary clue,
          {' '}{manualSummary.length} match a manual-summary carry-forward signature and{' '}
          {coordinatedZeroing.length} fit the coordinated positive-to-zero revision pattern. These
          categories overlap for Fitchburg × Quinsigamond. These hypotheses explain what to ask the
          authors; they do not remove cells from the audit.
        </p>
        {cellJoin?.dropped?.length > 0 && (
          <p className='text-tag text-ink-subtle'>
            {cellJoin.dropped.length} cell{cellJoin.dropped.length === 1 ? '' : 's'} occur in one
            source only and are not differenced.
          </p>
        )}
      </Block>
    </div>
  )
}
