import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Spinner } from '../components/ui'
import { usePathwayComplexity } from '../shared/query/hooks/useData'
import ColorDomainLegend from './ColorDomainLegend'
import {
  PAPER_DIVERGING_LOW_TO_HIGH_GRADIENT,
  paperDivergingCellColor,
} from './maHeatmapColors'
import {
  EvidenceCohortControl, defaultDegreeMode, degreeModesForMajor, shortenSchool,
} from './TransferCreditRate'

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
 *  - The Massachusetts corpus renders `mode: 'paper'`: the literal final-PDF
 *    matrix alongside a separate recomputation of the archived workbooks.
 *    Those artifacts are never silently combined.
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
  const maxAbs = Math.max(1, ...deltas.map(Math.abs))
  return {
    columns,
    rows,
    cells,
    rowMeans,
    columnMeans,
    overallMean: mean(deltas),
    colorScale: { maxAbs, min: -maxAbs, mid: 0, max: maxAbs },
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

/**
 * Massachusetts exposes the final paper and our recalculation of the same
 * 49 printed pathways. The 12 additional archive pathways belong to a separate
 * all-61 summary population and never change this Figure 6 audit mean.
 */
export function paperEntries(data, view = 'published') {
  const pathways = data?.pathways || []
  const residentByUni = new Map(pathways
    .filter((p) => p.cc == null)
    .map((p) => [p.uni, p]))
  const pathwayByPair = new Map(pathways
    .filter((p) => p.cc != null)
    .map((p) => [`${p.cc}|${p.uni}`, p]))
  const pdfCells = data?.final_pdf?.cells || {}
  const entryFor = (cc, uni, p = pathwayByPair.get(`${cc}|${uni}`)) => {
    const resident = residentByUni.get(uni)
    const deltaOurs = resident && Number.isFinite(p?.ours) && Number.isFinite(resident.ours)
      ? p.ours - resident.ours : null
      const deltaPrinted = pdfCells?.[cc]?.[uni]
      const difference = Number.isFinite(deltaOurs) && Number.isFinite(deltaPrinted)
        ? deltaOurs - deltaPrinted
        : null
      const delta = view === 'ours' ? deltaOurs : view === 'diff' ? difference : deltaPrinted
    return {
      row: cc,
      column: uni,
      delta,
      flagged: Number.isFinite(difference) && difference !== 0,
      title: [
        `${cc} → ${uni}`,
        `Final paper: ${signedInt(deltaPrinted) || '—'}`,
        `Our recalculation: ${Number.isFinite(p?.ours) ? p.ours : '—'} vs resident ${resident?.ours ?? '—'} (Δ ${signedInt(deltaOurs) || '—'})`,
        Number.isFinite(difference)
          ? difference === 0
            ? 'The final paper and our recalculation agree.'
            : `Difference: ${signedInt(difference)} points; potential paper error or unexplained final-data revision.`
          : null,
      ].filter(Boolean).join('\n'),
    }
  }

  // The authoritative view enumerates the PDF itself. It must remain complete
  // even if an older repository snapshot lacks a pathway the final paper added.
  const sourcePairs = Object.entries(pdfCells).flatMap(([cc, byUniversity]) => (
    Object.keys(byUniversity || {}).map((uni) => ({
      cc, uni, p: pathwayByPair.get(`${cc}|${uni}`),
    }))
  ))
  return sourcePairs
    .map(({ cc, uni, p }) => entryFor(cc, uni, p))
    .filter((entry) => Number.isFinite(entry.delta))
}

/** Engine corpora: one entry per scored pathway. */
function liveEntries(rows) {
  return rows.filter((r) => Number.isFinite(r.delta_vs_resident)).map((r) => ({
    row: r.college_name,
    column: r.school,
    delta: r.delta_vs_resident,
    title: [
      `${r.college_name} → ${r.school}`,
      `Transfer pathway complexity ${Math.round(r.complexity)} vs resident ${Math.round(r.resident_complexity)} (Δ ${signedInt(r.delta_vs_resident)})`,
      Number.isFinite(r.n_courses) || Number.isFinite(r.n_edges) || Number.isFinite(r.n_placeholder)
        ? `Graph: ${Number.isFinite(r.n_courses) ? r.n_courses : '—'} vertices · ${Number.isFinite(r.n_edges) ? r.n_edges : '—'} prerequisite edges · ${Number.isFinite(r.n_placeholder) ? r.n_placeholder : '—'} placeholders`
        : null,
      Number.isFinite(r.as_courses) || Number.isFinite(r.as_selected_units)
        ? `Associate plan: ${Number.isFinite(r.as_courses) ? r.as_courses : '—'} selected courses · ${Number.isFinite(r.as_selected_units) ? r.as_selected_units : '—'} selected units`
        : null,
      Number.isFinite(r.requirements_consumed)
        ? `${r.requirements_consumed} university requirements satisfied by transferred associate-degree courses`
        : null,
      Number.isFinite(r.edge_info_pct) ? `Prerequisite status known for ${Math.round(r.edge_info_pct)}% of the pathway's courses` : null,
      r.source_verified === true
        ? `Associate-degree source: human-verified${r.source_catalog_year ? ` · catalog ${r.source_catalog_year}` : ''}`
        : r.source_verified === false
          ? `Associate-degree source: not human-verified${r.source_catalog_year ? ` · catalog ${r.source_catalog_year}` : ''}`
          : r.source_catalog_year ? `Associate-degree source: verification status unrecorded · catalog ${r.source_catalog_year}` : null,
      r.source_analysis_ready === false
        ? 'Source record is not marked analysis-ready.'
        : r.source_analysis_ready === true ? 'Source record is marked analysis-ready.' : null,
      r.method_warning || null,
    ].filter(Boolean).join('\n'),
  }))
}

const PAPER_VIEWS = [
  { value: 'published', label: 'Final paper' },
  { value: 'ours', label: 'Our recalculation' },
]

const normalizePaperView = (view) => (
  view === 'ours' || view === 'diff' ? 'ours' : 'published'
)

export default function PathwayComplexity({
  majorSlug = 'cs', majorLabel = '', degreeAnalysisSlots = null,
  defaultPaperView = 'published', defaultDegreeType = null,
  defaultVerifiedOnly = true, onViewChange, comparisonColorScale = null,
}) {
  const degreeModes = useMemo(() => degreeModesForMajor({
    majorSlug, majorLabel, degreeAnalysisSlots,
  }), [majorSlug, majorLabel, degreeAnalysisSlots])
  const [degreeType, setDegreeType] = useState(() => (
    degreeModes.some((mode) => mode.value === defaultDegreeType)
      ? defaultDegreeType : defaultDegreeMode(degreeModes)
  ))
  const [verifiedOnly, setVerifiedOnly] = useState(defaultVerifiedOnly)
  useEffect(() => {
    if (!degreeModes.some((mode) => mode.value === degreeType)) {
      setDegreeType(defaultDegreeMode(degreeModes))
    }
  }, [degreeModes, degreeType])
  const query = usePathwayComplexity({ majorSlug, degreeType, verifiedOnly })
  const data = query.data
  const isPaper = data?.mode === 'paper'
  const rows = data?.rows || []
  // The paper corpus opens on the figure as printed and offers one alternate:
  // our recalculation. Old saved difference views reopen on the recalculation.
  const [paperView, setPaperView] = useState(() => normalizePaperView(defaultPaperView))

  useEffect(() => {
    onViewChange?.({
      defaultPaperView: paperView,
      defaultDegreeType: degreeType,
      defaultVerifiedOnly: verifiedOnly,
    })
  }, [degreeType, paperView, verifiedOnly, onViewChange])

  const localModel = useMemo(() => buildDeltaModel(
    isPaper ? paperEntries(data, paperView) : liveEntries(rows),
  ), [isPaper, data, rows, paperView])
  const model = useMemo(() => (
    Number.isFinite(comparisonColorScale?.maxAbs)
      ? { ...localModel, colorScale: comparisonColorScale }
      : localModel
  ), [localModel, comparisonColorScale])

  if (query.isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (query.isError) return <Alert type='error'>Could not load pathway complexity.</Alert>
  if (!model.valueCount) {
    const excluded = data?.exclusions?.degree_count
      ?? new Set(rows.filter((row) => row.method_status === 'excluded').map((row) => row.record_id)).size
    const omitted = data?.source_cohort?.unverified_degree_documents_omitted || 0
    return (
      <div className='flex flex-col gap-3'>
        {!isPaper && (
          <div className='flex justify-end' data-export-exclude>
            <EvidenceCohortControl verifiedOnly={verifiedOnly} onChange={setVerifiedOnly} />
          </div>
        )}
        {excluded > 0 ? (
          <Alert type='info'>No pathways were scored. {excluded} degree template{excluded === 1 ? ' was' : 's were'} excluded because its stored course choices were not unambiguous.</Alert>
        ) : verifiedOnly && omitted > 0 ? (
          <Alert type='info'>No human-verified source degrees produce a scored pathway in this view. {omitted} unverified source document{omitted === 1 ? ' is' : 's are'} omitted; switch to All sourced programs only for an exploratory sensitivity.</Alert>
        ) : (
          <Alert type='info'>No pathways to score for this major yet.</Alert>
        )}
      </div>
    )
  }

  const scoredRows = rows.filter((row) => Number.isFinite(row.delta_vs_resident))
  const edgeCoverage = isPaper ? null : mean(scoredRows.map((r) => r.edge_info_pct).filter(Number.isFinite))
  const excludedDegrees = data?.exclusions?.degree_count
    ?? new Set(rows.filter((row) => row.method_status === 'excluded').map((row) => row.record_id)).size
  const sourceRows = new Map(rows.map((row) => [
    String(row.record_id || row.community_college_id || row.college_name), row,
  ]))
  const sourceCohort = data?.source_cohort || {}
  const sourceTotal = Number.isFinite(sourceCohort.degree_documents_total)
    ? sourceCohort.degree_documents_total : sourceRows.size
  const sourceVerified = Number.isFinite(sourceCohort.degree_documents_verified)
    ? sourceCohort.degree_documents_verified
    : [...sourceRows.values()].filter((row) => row.source_verified === true).length
  const sourceIncluded = Number.isFinite(sourceCohort.degree_documents_included)
    ? sourceCohort.degree_documents_included : sourceRows.size
  const notableOmittedSources = (sourceCohort.omitted_unverified_degree_documents || [])
    .filter((source) => /^(Foothill College|Palomar College)$/i.test(source.college_name || ''))

  return (
    <div data-export-root className='flex flex-col gap-3'>
      <p className='analysis-export-only text-caption text-ink-muted'>
        {[majorLabel || majorSlug,
          isPaper ? (PAPER_VIEWS.find((view) => view.value === paperView)?.label || paperView) : (
            degreeType === 'ast' ? 'A.S.-T' : degreeType === 'local_as' ? 'Local A.S.' : 'Other local'
          ),
          !isPaper ? (verifiedOnly ? 'Verified programs only' : 'All sourced programs') : null,
        ].filter(Boolean).join(' · ')}
      </p>

      <div className='flex flex-wrap items-end justify-between gap-x-6 gap-y-3'>
        <div>
          <p className='text-caption text-ink-muted'>
            Mean Δ vs the campus’s own curriculum
          </p>
          <p className='text-title font-[680] tabular-nums'>{signedInt(model.overallMean)}</p>
        </div>
        <div className='flex flex-wrap items-end justify-end gap-4' data-export-exclude>
          {!isPaper && degreeModes.length > 1 && (
            <div className='flex flex-col'>
              <span className='field-label'>Associate degree</span>
              <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
                {degreeModes.map((mode) => (
                  <button key={mode.value} type='button' aria-pressed={degreeType === mode.value}
                    onClick={() => setDegreeType(mode.value)}
                    className={`px-3 text-button border-r border-border last:border-r-0 ${
                      degreeType === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                    }`}>
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isPaper && (
            <EvidenceCohortControl verifiedOnly={verifiedOnly} onChange={setVerifiedOnly} />
          )}
          {isPaper && (
            <div className='flex flex-col'>
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
      </div>

      {!isPaper && !verifiedOnly && (
        <p className='border-l-2 border-prov-ca pl-3 text-caption text-ink-muted' data-export-exclude>
          <span className='font-[650] text-ink'>Exploratory view.</span>{' '}
          All resolvable source degrees are included; {sourceTotal > 0
            ? `${sourceVerified} of ${sourceTotal} are human-verified.`
            : 'verification is incomplete.'}
        </p>
      )}

      {!isPaper && verifiedOnly && notableOmittedSources.length > 0 && (
        <p className='border-l-2 border-border-strong pl-3 text-caption text-ink-muted'
          data-export-exclude>
          Verified-only view. {notableOmittedSources
            .map((source) => source.college_name).join(' and ')} {notableOmittedSources.length === 1
            ? 'is' : 'are'} omitted; use All sourced programs to inspect the exploratory outlier
          {notableOmittedSources.length === 1 ? '' : 's'}.
        </p>
      )}

      <ColorDomainLegend scale={model.colorScale} formatValue={signedInt}
        suffix='score points' gradient={PAPER_DIVERGING_LOW_TO_HIGH_GRADIENT} />

      <DeltaMatrix model={model} columnLabel={isPaper ? (name) => name : shortenSchool} />
    </div>
  )
}

// The props a pinned view may seed. Every `viewKnobs` entry on the registry
// must name one of these; the contract test fails the build otherwise.
PathwayComplexity.viewProps = ['defaultPaperView', 'defaultDegreeType', 'defaultVerifiedOnly']
