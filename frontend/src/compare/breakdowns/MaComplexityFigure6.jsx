import React, { useState } from 'react'
import { Alert, Badge, Spinner } from '../../components/ui'
import { usePathwayComplexity } from '../../shared/query/hooks/useData'
import { CA_DIFFERENCE_COLORS } from '../../analyses/californiaFigureStyle'

/**
 * The breakdown for the MA paper's Figure 6, printed against their own saved
 * workbooks.
 *
 * Everything on screen is read from server/data/ma/complexity-validation.json
 * — the same payload both panes render, through the same query key, so there
 * is one request and no second reading of the data. Not one number here is a
 * literal: if the artifact is re-derived, this panel moves with it.
 *
 * On-screen chrome only (`data-export-exclude`), exactly like PaperCreditLoss's
 * difference matrix. The exported figure stays the figure.
 */

const SOURCE_LABELS = { published: 'Printed figure', ours: 'Recomputed', diff: 'Difference' }

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

/** Published score, published resident, our score, our resident, and both deltas. */
function CellReceipt({ rowKey, colKey, pathways, override }) {
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
    ['Their published transfer score', pair.theirs, `${pair.their_hours ?? '—'} published hours`],
    ['Their published resident score', resident.theirs, `${resident.their_hours ?? '—'} published hours`],
    ['Their own tab computes Δ', tabDelta, 'transfer minus resident, from their Curricular Complexity tab'],
    ['Our recomputed transfer score', pair.ours, 'their prerequisite and corequisite edges, their course list'],
    ['Our recomputed resident score', resident.ours, null],
    ['Our Δ', oursDelta, 'the same quantity, computed from their saved files'],
  ]
  return (
    <div className='flex flex-col gap-1 bg-surface-sunken rounded-lg px-3 py-2'>
      {override && (
        <p className='text-caption text-warning'>
          The figure prints {signedInt(override.printed_delta)} for this cell.
        </p>
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
  const query = usePathwayComplexity({ majorSlug })
  const [openKey, setOpenKey] = useState(null)

  if (query.isLoading) return <div className='py-6 flex justify-center'><Spinner /></div>
  if (query.isError) return <Alert type='error'>Could not load the Figure 6 validation record.</Alert>

  const data = query.data || {}
  const coreqs = data.coreq_treatment || {}
  const withCoreqs = coreqs.with_coreqs || {}
  const withoutCoreqs = coreqs.without_coreqs || {}
  const figureCellMisses = data.figure_cell_misses || []
  const pathways = data.pathways || []
  const headline = data.headline_plus_15 || {}
  const overrideFor = (rowKey, colKey) => figureCellMisses
    .find((miss) => miss.cc === rowKey && miss.uni === colKey) || null

  const baselinePane = panes.find((pane) => pane.id === comparison?.baseline_pane) || panes[0]
  const subjectPane = panes.find((pane) => pane !== baselinePane) || panes[1]
  const paneName = (pane) => pane?.label || SOURCE_LABELS[pane?.knobs?.source ?? 'published']

  // Ranked by the size of the disagreement, so the argument leads with its
  // strongest cell rather than with whatever sorts first alphabetically.
  const ranked = [...(cellJoin?.cells || [])]
    .filter((cell) => !cell.agrees)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
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
        <p className='text-label'>Where Figure 6 disagrees with their own workbook</p>
        {cellJoin && (
          <Badge variant='neutral'>
            {ranked.length} of {cellJoin.matched} cells disagree
          </Badge>
        )}
      </div>

      {/* The whole argument, in the fewest words it survives being said in.
          Everything below is the receipt for one of these two points. */}
      <div className='flex flex-col gap-3'>
        <p className='text-caption text-ink-muted'>
          Almost every cell matches. The rest are two different problems.
        </p>

        <div className='flex flex-col gap-1'>
          <p className='text-body-strong text-ink'>1 · Two scores are 4 points off</p>
          <p className='text-caption text-ink-muted max-w-[70ch]'>
            Their sheets compute 164 and 174. The paper printed 160 and 170. The credits on one
            of those sheets moved too, so the sheet was edited after it went into the complexity
            tool and the figure kept the old number.
          </p>
          <p className='text-caption text-ink-muted max-w-[70ch]'>
            One of the two is a <em>resident</em> score. Every cell in that university&rsquo;s column
            is measured against it, so one stale number marks the whole column.
          </p>
        </div>

        <div className='flex flex-col gap-1'>
          <p className='text-body-strong text-ink'>2 · One cell contradicts their own spreadsheet</p>
          <p className='text-caption text-ink-muted max-w-[70ch]'>
            Springfield Technical × UMass Amherst. The figure prints −28. Their own tab computes
            +34. That is 62 points, and it flips the sign.
          </p>
          <p className='text-caption text-ink-muted max-w-[70ch]'>
            It is not a swapped row or column — no other cell holds −28, and Springfield&rsquo;s row
            is +34, +30, +30. The number was typed into the chart. Their own printed average for
            that column, +1.0, only works with −28 in it.
          </p>
        </div>
      </div>

      <Block title='Reproduction'>
        <p className='text-caption text-ink-muted max-w-[70ch]'>
          {withCoreqs.exact} of {withCoreqs.compared} published scores reproduce exactly from their
          own workbooks. Dropping corequisites drops that to {withoutCoreqs.exact}, so the
          disagreements are in their files, not in the method.
        </p>
      </Block>

      {Number.isFinite(headline.over_scored_pathways)
        && Number.isFinite(headline.over_all_pathways) && (
        <Block title='What the drift does to their headline'>
          <p className='text-caption text-ink-muted max-w-[78ch]'>
            The published “+15” is {headline.over_scored_pathways.toFixed(2)} over the pathways that
            carry a score, but {headline.over_all_pathways.toFixed(2)} over all{' '}
            {pathways.filter((p) => p.cc != null).length} transfer pathways in their own file.
          </p>
        </Block>
      )}

      <Block title={`Per cell · ${paneName(subjectPane)} minus ${paneName(baselinePane)}`}>
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
                      override={overrideFor(cell.rowKey, cell.colKey)} />
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
