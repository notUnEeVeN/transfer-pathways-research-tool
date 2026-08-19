import React, { useState } from 'react'
import { Alert, Badge, Spinner } from '../../components/ui'
import { usePathwayComplexity } from '../../shared/query/hooks/useData'
import { CA_DIFFERENCE_COLORS } from '../../analyses/californiaFigureStyle'

/**
 * Raw-data rerun audit for the MA paper's Figure 6.
 *
 * Everything on screen is read from server/data/ma/complexity-validation.json
 * — the same payload both panes render, through the same query key, so there
 * is one request and no second reading of the data. Not one number here is a
 * literal: if the artifact is re-derived, this panel moves with it.
 *
 * On-screen chrome only (`data-export-exclude`), exactly like PaperCreditLoss's
 * difference matrix. The exported figure stays the figure.
 */

const SOURCE_LABELS = {
  published: 'Final PDF', ours: 'Deposited-graph rerun', diff: 'Raw rerun − PDF',
}

// Half rounds AWAY from zero, matching the figure's own print convention so a
// cell here reads exactly as the cell in the matrix above it.
const signedInt = (value) => (Number.isFinite(value)
  ? `${value >= 0 ? '+' : '−'}${Math.round(Math.abs(value))}`
  : '—')

const deltaColor = (value) => (value > 0 ? CA_DIFFERENCE_COLORS.lost : CA_DIFFERENCE_COLORS.gained)

function Block({ title, children }) {
  return (
    <section className='flex flex-col gap-1.5'>
      <p className='text-label'>{title}</p>
      {children}
    </section>
  )
}

/** Final-PDF delta, deposited-graph rerun, then the typed tab as a secondary clue. */
function CellReceipt({ rowKey, colKey, pathways, finalPdf, artifact }) {
  const pair = pathways.find((p) => p.cc === rowKey && p.uni === colKey)
  const resident = pathways.find((p) => p.cc == null && p.uni === colKey)
  if (!pair || !resident) {
    return <p className='text-caption text-ink-muted'>No scored pathway for this pair in their workbooks.</p>
  }
  const tabDelta = Number.isFinite(pair.theirs) && Number.isFinite(resident.theirs)
    ? pair.theirs - resident.theirs
    : null
  const oursDelta = pair.ours - resident.ours
  const rows = [
    ['Final PDF Δ', finalPdf, 'literal Figure 6 transcription'],
    ['Raw-graph transfer score', pair.ours, 'deposited course list and prerequisite/corequisite edges'],
    ['Raw-graph resident score', resident.ours, null],
    ['Raw-graph rerun Δ', oursDelta, 'transfer minus resident'],
    ['Typed archive-tab Δ', tabDelta, 'secondary forensic clue only'],
  ]
  const secondaryNote = artifact?.classification === 'final_pdf_vs_archived_tab'
    ? 'Secondary clue: the deposited typed score tab agrees with the raw-graph rerun; both differ from the final PDF, consistent with an unprovided later graph or pathway revision.'
    : artifact
      ? 'Secondary clue: the deposited typed score tab differs from the raw-graph rerun, making a manual score carry-forward plausible.'
      : null
  return (
    <div className='flex flex-col gap-1 bg-surface-sunken rounded-lg px-3 py-2'>
      {secondaryNote && (
        <p className='text-caption text-warning'>{secondaryNote}</p>
      )}
      {rows.map(([label, value, note]) => (
        <div key={label} className='flex items-baseline gap-2 text-caption'>
          <span className='text-ink-muted min-w-56'>{label}</span>
          <span className='font-mono tabular-nums text-ink'>
            {Number.isFinite(value) ? (label.includes('Δ') ? signedInt(value) : value) : '—'}
          </span>
          {note && <span className='text-tag text-ink-subtle'>{note}</span>}
        </div>
      ))}
    </div>
  )
}

export default function MaComplexityFigure6({
  panes = [], comparison, join, delta, selectedCell, onSelectCell,
}) {
  // The workspace passes the joinCells result as `join`; `delta` is accepted
  // for the same object so either caller name renders.
  const cellJoin = join || delta
  const majorSlug = panes[0]?.major || 'ma-cs'
  const degreeType = panes[0]?.knobs?.degree || 'local_as'
  const query = usePathwayComplexity({ majorSlug, degreeType })
  const [openKey, setOpenKey] = useState(null)

  if (query.isLoading) return <div className='py-6 flex justify-center'><Spinner /></div>
  if (query.isError) return <Alert type='error'>Could not load the Figure 6 validation record.</Alert>

  const data = query.data || {}
  const coreqs = data.coreq_treatment || {}
  const withCoreqs = coreqs.with_coreqs || {}
  const withoutCoreqs = coreqs.without_coreqs || {}
  const finalPdfCells = data.final_pdf?.cells || {}
  const artifactDifferences = data.artifact_differences || []
  const pathways = data.pathways || []
  const headline = data.headline_means || {}
  const artifactFor = (rowKey, colKey) => artifactDifferences
    .find((entry) => entry.cc === rowKey && entry.uni === colKey) || null

  const baselinePane = panes.find((pane) => pane.id === comparison?.baseline_pane) || panes[0]
  const subjectPane = panes.find((pane) => pane !== baselinePane) || panes[1]
  const paneName = (pane) => pane?.label || SOURCE_LABELS[pane?.knobs?.source ?? 'published']

  // Ranked by absolute artifact difference, without assigning a cause.
  const ranked = [...(cellJoin?.cells || [])]
    .filter((cell) => !cell.agrees)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const reproduced = Math.max(0, (cellJoin?.matched ?? 0) - ranked.length)
  const activeKey = selectedCell ?? openKey
  // The workspace anchors a note to the cell object, so the whole cell travels
  // upward — collapsing sends null, which is the signal to clear the anchor.
  const toggle = (cell) => {
    const closing = activeKey === cell.key
    setOpenKey(closing ? null : cell.key)
    onSelectCell?.(closing ? null : cell)
  }

  return (
    <div className='surface-card p-4 flex flex-col gap-4' data-export-exclude>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-label'>Figure 6 raw-data rerun audit</p>
        {cellJoin && (
          <>
            <Badge variant='neutral'>{reproduced} of {cellJoin.matched} cells reproduce</Badge>
            <Badge variant='danger'>
              {ranked.length} potential raw-rerun disagreement{ranked.length === 1 ? '' : 's'}
            </Badge>
          </>
        )}
      </div>

      <div className='flex flex-col gap-3'>
        <p className='text-caption text-ink-muted'>
          We applied the paper&rsquo;s complexity formula to the deposited course graphs and compared
          those results directly with the final PDF. Every mismatch is a potential paper error or
          an unexplained final-input revision. The final-version graphs were not deposited, so the
          available evidence cannot decide between those explanations.
        </p>
      </div>

      <Block title='Formula check inside the deposited repository'>
        <p className='text-caption text-ink-muted max-w-[70ch]'>
          {withCoreqs.exact} of {withCoreqs.compared} scores in the archived repository tab
          reproduce from the archived workbook graphs. Ignoring corequisites matches{' '}
          {withoutCoreqs.exact}; this supports treating corequisites as graph edges for the archived
          calculation. This component-score check is secondary to the final-PDF/raw-graph comparison.
        </p>
      </Block>

      {Number.isFinite(headline.final_pdf?.mean) && (
        <Block title='Means by source'>
          <p className='text-caption text-ink-muted max-w-[78ch]'>
            Final PDF: {headline.final_pdf.mean.toFixed(2)} over {headline.final_pdf.n} printed cells.
            {' '}Archived score tab: {headline.archived_tab?.mean?.toFixed(2) ?? '—'} over{' '}
            {headline.archived_tab?.n ?? '—'} cells. Recomputed archived workbooks on that scored
            cohort: {headline.recomputed_archived_workbooks_scored?.mean?.toFixed(2) ?? '—'}.
            Recomputed across all archived workbook pathways:{' '}
            {headline.recomputed_all_archived_workbooks?.mean?.toFixed(2) ?? '—'}.
          </p>
        </Block>
      )}

      <Block title={`Potential disagreements · ${paneName(subjectPane)} minus ${paneName(baselinePane)}`}>
        {!ranked.length ? (
          <p className='text-caption text-ink-muted'>
            {cellJoin?.matched
              ? 'Every matched cell agrees exactly.'
              : 'No matched cells to rank yet.'}
          </p>
        ) : (
          <ul className='flex flex-col gap-1'>
            {ranked.map((cell) => {
              const open = activeKey === cell.key
              return (
                <li key={cell.key} className='flex flex-col gap-1'>
                  <button type='button' onClick={() => toggle(cell)}
                    aria-expanded={open}
                    className='flex items-baseline gap-3 text-left px-2 py-1.5 rounded-lg hover:bg-surface-hover'>
                    <span className='font-mono tabular-nums text-caption min-w-14 text-right'
                      style={{ color: deltaColor(cell.delta) }}>
                      {signedInt(cell.delta)}
                    </span>
                    <span className='text-caption text-ink'>{cell.rowLabel} × {cell.colLabel}</span>
                    <span className='text-tag text-ink-subtle ml-auto tabular-nums'>
                      {signedInt(cell.baseline)} → {signedInt(cell.subject)}
                    </span>
                  </button>
                  {open && (
                    <CellReceipt rowKey={cell.rowKey} colKey={cell.colKey} pathways={pathways}
                      finalPdf={finalPdfCells?.[cell.rowKey]?.[cell.colKey]}
                      artifact={artifactFor(cell.rowKey, cell.colKey)} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {cellJoin?.dropped?.length > 0 && (
          <p className='text-tag text-ink-subtle'>
            {cellJoin.dropped.length} cell{cellJoin.dropped.length === 1 ? '' : 's'} appear in one
            pane only and are not differenced.
          </p>
        )}
      </Block>
    </div>
  )
}
