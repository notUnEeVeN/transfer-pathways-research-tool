import React, { useMemo, useState } from 'react'
import { Alert, Badge, Spinner } from '../components/ui'
import { usePathwayComplexity } from '../shared/query/hooks/useData'
import { paperDivergingCellColor } from './maHeatmapColors'
import { shortenSchool } from './TransferCreditRate'

/**
 * Curricular complexity of transfer pathways — the MA paper's Figure 6
 * (Heileman et al. structural complexity, h(G) = Σ delay + blocking), rendered
 * in the paper's own visual form: a community-college × university matrix of
 * signed deltas (transfer pathway minus the campus's resident curriculum) on
 * a diverging green-to-red ramp, with the Average row along the bottom.
 *
 * Two corpora, one figure:
 *  - Engine corpora (California) score live pathways — the associate degree's
 *    courses plus every unsatisfied university requirement. The server caches
 *    the computation, so the matrix opens without re-scoring on every view.
 *  - The Massachusetts corpus renders `mode: 'paper'`: the committed
 *    reproduction of the paper's Figure 6 from their own recovered workbooks
 *    (58 of 60 published scores matched exactly; the two divergent pathways
 *    are footnoted).
 */

const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN)
// Half rounds AWAY from zero (−25.5 → −26), matching the paper's own print
// convention so the published view's Average row reads exactly as the figure.
const signedInt = (value) => (Number.isFinite(value)
  ? `${value >= 0 ? '+' : '−'}${Math.round(Math.abs(value))}`
  : '')

/**
 * Build the matrix model: rows (colleges) × columns (universities), each cell
 * one pathway's Δ vs resident. `cells` maps `${row}|${column}` to
 * { delta, title }.
 */
function buildDeltaModel(entries) {
  const columns = [...new Set(entries.map((e) => e.column))].sort((a, b) => a.localeCompare(b))
  const rows = [...new Set(entries.map((e) => e.row))].sort((a, b) => a.localeCompare(b))
  const cells = new Map(entries.map((e) => [`${e.row}|${e.column}`, e]))
  const rowMeans = rows.map((row) => mean(columns
    .map((column) => cells.get(`${row}|${column}`)?.delta)
    .filter(Number.isFinite)))
  const columnMeans = columns.map((column) => mean(rows
    .map((row) => cells.get(`${row}|${column}`)?.delta)
    .filter(Number.isFinite)))
  const deltas = entries.map((e) => e.delta).filter(Number.isFinite)
  return {
    columns,
    rows,
    cells,
    rowMeans,
    columnMeans,
    overallMean: mean(deltas),
    colorScale: { maxAbs: Math.max(1, ...deltas.map(Math.abs)) },
    valueCount: deltas.length,
  }
}

function DeltaMatrix({ model, columnLabel = (name) => name }) {
  return (
    <div className='surface-card overflow-auto max-h-[72vh]'>
      <table className='border-separate border-spacing-0 min-w-full'>
        <thead>
          <tr>
            <th className='sticky top-0 left-0 z-30 bg-surface border-b border-r border-border px-3 py-2 text-left text-label min-w-56'>
              Community college
            </th>
            {model.columns.map((column) => (
              <th key={column}
                className='sticky top-0 z-20 bg-surface border-b border-r border-border px-2 py-2 text-left align-bottom min-w-24'>
                <span className='block text-tag text-ink leading-tight whitespace-normal'>{columnLabel(column)}</span>
              </th>
            ))}
            <th className='sticky top-0 right-0 z-30 bg-surface border-b border-l border-border px-3 py-2 text-right text-label min-w-24'>
              Average
            </th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row, rowIndex) => (
            <tr key={row} className='group'>
              <th className='sticky left-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-r border-border px-3 py-1.5 text-left text-caption text-ink min-w-56'>
                {row}
              </th>
              {model.columns.map((column) => {
                const cell = model.cells.get(`${row}|${column}`)
                return (
                  <td key={column}
                    title={cell?.title || `${row}\n${column}\nNo pathway modeled for this pair`}
                    aria-label={cell?.title || `${row} × ${column}: no pathway modeled`}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                    style={paperDivergingCellColor(cell?.delta ?? null, model.colorScale)}>
                    {signedInt(cell?.delta ?? null)}{cell?.flagged ? '*' : ''}
                  </td>
                )
              })}
              <td className='sticky right-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-l border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
                {signedInt(model.rowMeans[rowIndex])}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th className='sticky left-0 bottom-0 z-30 bg-surface border-t border-r border-border px-3 py-2 text-left text-label min-w-56'>
              Average
            </th>
            {model.columns.map((column, i) => (
              <td key={column}
                className='sticky bottom-0 z-20 border-t border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                style={paperDivergingCellColor(model.columnMeans[i], model.colorScale)}>
                {signedInt(model.columnMeans[i])}
              </td>
            ))}
            <td className='sticky right-0 bottom-0 z-30 bg-surface border-t border-l border-border px-3 py-2 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
              {signedInt(model.overallMean)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Massachusetts: the paper's own Figure 6, reproduced from their workbooks. */
/**
 * The Massachusetts pairs carry two deltas: the paper's printed figure
 * (published transfer score minus published resident score) and our
 * recomputation of the same quantity from their saved workbooks. `view`
 * selects which one fills the matrix — or their difference, which is +0
 * everywhere the printed figure is faithful to their own files. A cell is
 * flagged wherever the two deltas disagree; a drifted RESIDENT score shifts
 * its university's entire column, which is exactly the argument the flag
 * makes visible.
 */
function paperEntries(data, view = 'published') {
  const pathways = data?.pathways || []
  const residentByUni = new Map(pathways
    .filter((p) => p.cc == null)
    .map((p) => [p.uni, p]))
  // Cells the FIGURE itself prints differently from their own complexity tab
  // (found by reconciling printed column averages against the tab). The
  // published view honors the printed value — that is the figure as the paper
  // shows it — and the flag carries the contradiction.
  const figureMiss = new Map((data?.figure_cell_misses || [])
    .map((m) => [`${m.cc}|${m.uni}`, m]))
  return pathways
    .filter((p) => p.cc != null)
    .map((p) => {
      const resident = residentByUni.get(p.uni)
      const deltaOurs = resident ? p.ours - resident.ours : null
      const deltaTab = resident && Number.isFinite(p.theirs) && Number.isFinite(resident.theirs)
        ? p.theirs - resident.theirs
        : null
      const override = figureMiss.get(`${p.cc}|${p.uni}`)
      const deltaPrinted = override ? override.printed_delta : deltaTab
      const difference = Number.isFinite(deltaOurs) && Number.isFinite(deltaPrinted)
        ? deltaOurs - deltaPrinted
        : null
      const delta = view === 'ours' ? deltaOurs : view === 'diff' ? difference : deltaPrinted
      return {
        row: p.cc,
        column: p.uni,
        delta,
        flagged: Number.isFinite(difference) && difference !== 0,
        title: [
          `${p.cc} → ${p.uni}`,
          override
            ? `Printed figure: ${signedInt(override.printed_delta)} — contradicts their own complexity tab (Δ ${signedInt(deltaTab) || '—'})`
            : `Published: score ${Number.isFinite(p.theirs) ? p.theirs : '—'} vs resident ${Number.isFinite(resident?.theirs) ? resident.theirs : '—'} (Δ ${signedInt(deltaTab) || '—'})`,
          `Recomputed from their sheets: score ${p.ours} vs resident ${resident?.ours ?? '—'} (Δ ${signedInt(deltaOurs) || '—'})`,
          Number.isFinite(difference) && difference !== 0
            ? `Disagreement of ${signedInt(difference)} — a typed value drifted from their saved files`
            : Number.isFinite(difference) ? 'Printed figure reproduced exactly' : 'No published score for this pair',
        ].join('\n'),
      }
    })
}

/** Engine corpora: one entry per scored pathway. */
function liveEntries(rows) {
  return rows.map((r) => ({
    row: r.college_name,
    column: r.school,
    delta: r.delta_vs_resident,
    title: [
      `${r.college_name} → ${r.school}`,
      `Transfer pathway complexity ${Math.round(r.complexity)} vs resident ${Math.round(r.resident_complexity)} (Δ ${signedInt(r.delta_vs_resident)})`,
      Number.isFinite(r.edge_info_pct) ? `Prerequisite status known for ${Math.round(r.edge_info_pct)}% of the pathway's courses` : null,
    ].filter(Boolean).join('\n'),
  }))
}

const PAPER_VIEWS = [
  { value: 'published', label: 'Paper (published)' },
  { value: 'ours', label: 'Ours (recomputed)' },
  { value: 'diff', label: 'Difference' },
]

export default function PathwayComplexity({ majorSlug = 'cs' }) {
  const query = usePathwayComplexity({ majorSlug })
  const data = query.data
  const isPaper = data?.mode === 'paper'
  const rows = data?.rows || []
  // The paper corpus opens on the figure as printed — the comparison baseline —
  // and toggles to our recomputation or the per-cell difference.
  const [paperView, setPaperView] = useState('published')

  const model = useMemo(() => buildDeltaModel(
    isPaper ? paperEntries(data, paperView) : liveEntries(rows),
  ), [isPaper, data, rows, paperView])

  if (query.isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (query.isError) return <Alert type='error'>Could not load pathway complexity.</Alert>
  if (!model.valueCount) {
    return <Alert type='info'>No pathways to score for this major yet.</Alert>
  }

  const misses = isPaper ? (data?.misses || []) : []
  const edgeCoverage = isPaper ? null : mean(rows.map((r) => r.edge_info_pct).filter(Number.isFinite))

  const flaggedCount = isPaper
    ? [...model.cells.values()].filter((cell) => cell.flagged).length
    : 0

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
        <div>
          <p className='text-caption text-ink-muted'>
            {isPaper && paperView === 'diff' ? 'Mean disagreement (ours − published)' : 'Mean Δ vs the campus’s own curriculum'}
          </p>
          <p className='text-title font-[680] tabular-nums'>{signedInt(model.overallMean)}</p>
        </div>
        <Badge variant='neutral'>{model.valueCount} pathways</Badge>
        {isPaper && <Badge variant='neutral'>paper reproduction</Badge>}
        {!isPaper && Number.isFinite(edgeCoverage) && (
          <Badge variant='neutral'>{edgeCoverage.toFixed(0)}% edge data</Badge>
        )}
        {isPaper && (
          <div className='ml-auto flex flex-col' data-export-exclude>
            <span className='field-label'>Source</span>
            <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
              {PAPER_VIEWS.map((view) => (
                <button key={view.value} type='button' onClick={() => setPaperView(view.value)}
                  className={`px-3 text-button border-r border-border last:border-r-0 ${
                    paperView === view.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                  }`}>
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <DeltaMatrix model={model} columnLabel={isPaper ? (name) => name : shortenSchool} />

      {isPaper && (misses.length > 0 || (data?.figure_cell_misses || []).length > 0) && (
        <p className='text-caption text-warning max-w-[78ch]'>
          * Cells where the printed figure disagrees with their own files ({flaggedCount} of{' '}
          {model.valueCount}). Two typed scores drifted —{' '}
          {misses.map((m) => `${m.pathway} (published ${m.theirs}, their sheet computes ${m.ours})`).join('; ')} —
          and a drifted resident score shifts its university&rsquo;s entire column of deltas.
          {(data?.figure_cell_misses || []).length > 0 && (
            <> And typed into the figure itself:{' '}
            {(data.figure_cell_misses).map((f) => `${f.cc} × ${f.uni} prints ${signedInt(f.printed_delta)} though their own complexity tab computes ${signedInt(f.tab_delta)}`).join('; ')}
            {' '}— proven by the printed column average, which is only reachable with the printed cell.</>
          )}
        </p>
      )}

      <p className='text-caption text-ink-muted max-w-[78ch]'>
        {isPaper ? (
          paperView === 'published' ? (
            <>The paper&rsquo;s Figure 6 as printed: each cell is their published transfer-minus-resident
            structural complexity delta, h(G) = Σ (delay + blocking). This is the comparison
            baseline — toggle to <em>Ours (recomputed)</em> for the same quantity computed by our
            implementation from their recovered workbooks (58 of 60 published scores match to the
            integer), or to <em>Difference</em> to isolate exactly where the printed figure departs
            from their own files.</>
          ) : paperView === 'ours' ? (
            <>Our recomputation of the paper&rsquo;s Figure 6: each cell is the transfer-minus-resident
            complexity delta computed by our implementation from the paper&rsquo;s own recovered
            workbooks — their prerequisite and corequisite edges, their course lists. It matches
            their published scores on 58 of 60 pathways to the integer and reproduces the paper&rsquo;s
            +15 headline; green cells are pathways genuinely lighter than the resident degree.</>
          ) : (
            <>Recomputed minus published, per cell: +0 wherever the printed figure is faithful to
            their own saved workbooks — which is everywhere except the flagged cells. The nonzero
            cells all trace to the two typed scores above, not to any methodological difference:
            our implementation and their published tool agree to the integer wherever their files
            agree with their figure.</>
          )
        ) : (
          <>Each cell is the difference in structural complexity h(G) = Σ (delay + blocking) between the
          transfer pathway (the associate degree&rsquo;s courses plus every unsatisfied university
          requirement) and the campus&rsquo;s own four-year curriculum — the paper&rsquo;s Figure 6 measure,
          which our implementation reproduced on 58 of 60 of their pathways exactly. Green cells are
          pathways genuinely lighter than the resident degree: where articulation is strong, transfer
          carries fewer courses and scheduling constraints. Prerequisite status is known for
          {' '}{Number.isFinite(edgeCoverage) ? edgeCoverage.toFixed(0) : '—'}% of pathway courses on average;
          the unknown remainder is mostly placeholder slots, so missing edges can only understate
          complexity.</>
        )}
      </p>
    </div>
  )
}
