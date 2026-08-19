import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Select, Spinner, Stack } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import { COVERAGE_HEATMAP_MEASURES } from './measures'
import {
  PAPER_RED_LOW_TO_HIGH_GRADIENT,
  paperRedCellColor,
} from './maHeatmapColors'
import { degreeTemplateEvidenceLabel } from './templateEvidence'

const ROW_MODES = [
  { value: 'college', label: 'College', noun: 'colleges', header: 'Community college' },
  { value: 'district', label: 'District', noun: 'districts', header: 'Community college district' },
  { value: 'county', label: 'County', noun: 'counties', header: 'County served' },
]

// The denominator for each heatmap cell. Full-degree coverage reads the
// editable four-year templates; the two prior minimums views stay available
// for direct comparison.
const REQ_MODES = [
  { value: 'degree', label: '4-year graduation plan (by units)' },
  { value: 'assist', label: 'ASSIST minimums' },
  { value: 'paper', label: 'Hand-curated minimums' },
]

// The MA-paper equivalent stands apart from the basis dropdown as its own
// toggle — the cross-state comparison is the point of the port, so it should
// not hide among the bases. It reproduces the final Massachusetts paper's
// Figure 1 over the degree response: required courses at every level, GE
// excluded, binary per course. Its GE sub-toggle is our extension for
// GE-heavy majors, whose GE-excluded reading is dominated by the upper
// division.
export const MA_MODE = 'ma-courses'
export const MA_GE_MODE = 'ma-courses-ge'
const MA_MODES = new Set([MA_MODE, MA_GE_MODE])
const MA_FIG1_SOURCES = [
  { value: 'pdf', label: 'Final paper' },
  { value: 'archive', label: 'Our recalculation' },
]
const normalizeMaFigure1Source = (source) => (source === 'archive' ? 'archive' : 'pdf')
const requirementsParam = (mode) => (MA_MODES.has(mode) ? 'degree' : mode)

/**
 * The coverage request this figure makes, in one place. A delta adapter
 * differencing two panes must import this rather than re-derive it: the MA
 * lenses read the degree response, and a second derivation that forgot would
 * difference rows the figure beside it never drew.
 */
export function coverageQueryArgs({ majorSlug, rowMode, reqMode }) {
  return { majorSlug, groupBy: rowMode, requirements: requirementsParam(reqMode) }
}

const intFmt = new Intl.NumberFormat()
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const unitFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const DEFAULT_COLOR_SCALE = { min: 0, mid: 50, max: 100 }
const MIN_COLOR_SPAN = 20

const pct = (value) => (Number.isFinite(value) ? `${pctFmt.format(value)}%` : '-')

function shortenSchool(school) {
  return String(school || '')
    .replace(/^University of California,\s*/i, '')
    .replace(/^UC\s+/i, '')
    .trim()
}

function shortenMajor(major) {
  return String(major || '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*(B\.?[AS]\.?|Minor)\s*$/i, ' $1')
    .trim()
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

function quantile(sorted, q) {
  if (!sorted.length) return null
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const fraction = position - lower
  const upper = sorted[lower + 1]
  return upper == null ? sorted[lower] : sorted[lower] + fraction * (upper - sorted[lower])
}

// A fixed 0-100 domain hides meaningful variation when most cells occupy a
// narrow band. Trim only the extreme 2% at either end, round to readable 5-point
// bounds, and retain at least a 20-point domain so small noise is not overstated.
export function createCoverageColorScale(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return DEFAULT_COLOR_SCALE

  const low = quantile(sorted, 0.02)
  const high = quantile(sorted, 0.98)
  let min = Math.max(0, Math.floor(low / 5) * 5)
  let max = Math.min(100, Math.ceil(high / 5) * 5)

  if (max - min < MIN_COLOR_SPAN) {
    const center = (low + high) / 2
    min = Math.round((center - MIN_COLOR_SPAN / 2) / 5) * 5
    min = Math.max(0, Math.min(100 - MIN_COLOR_SPAN, min))
    max = min + MIN_COLOR_SPAN
  }

  return { min, mid: (min + max) / 2, max }
}

export function makeCellColor(value, scale = DEFAULT_COLOR_SCALE) {
  return paperRedCellColor(value, scale)
}

function average(values) {
  const nums = values.filter(Number.isFinite)
  if (!nums.length) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function rowCoverageValue(row, reqMode, maSource = 'archive') {
  if (reqMode === MA_MODE && maSource === 'pdf') {
    return numberOrNull(row.published_pdf_pct_named_requirement_courses)
  }
  if (reqMode === MA_MODE) return numberOrNull(row.pct_named_requirement_courses)
  if (reqMode === MA_GE_MODE) return numberOrNull(row.pct_named_requirement_courses_with_ge)
  return reqMode === 'degree'
    ? numberOrNull(row.pct_degree_units ?? row.pct_articulated)
    : numberOrNull(row.pct_articulated)
}

export function cellCoverageValue(cell, reqMode, maSource = 'archive') {
  if (!cell) return null
  if (reqMode === MA_MODE && maSource === 'pdf') {
    return cell.n > 0 ? cell.sum / cell.n : null
  }
  if (reqMode === MA_MODE) {
    return cell.maSlotsTotal > 0 ? (cell.maSlotsArticulated / cell.maSlotsTotal) * 100 : null
  }
  if (reqMode === MA_GE_MODE) {
    return cell.maGeTotal > 0 ? (cell.maGeArticulated / cell.maGeTotal) * 100 : null
  }
  if (reqMode === 'degree' && cell.hasDegreeUnits && cell.degreeUnitsModeled > 0) {
    return (cell.degreeUnitsCovered / cell.degreeUnitsModeled) * 100
  }
  return cell.n ? cell.sum / cell.n : null
}

export function buildHeatmap(rows, reqMode, { maSource = 'archive' } = {}) {
  const rowMap = new Map()
  const colMap = new Map()
  const cellMap = new Map()

  for (const r of rows) {
    const rowKey = String(r.row_group_key || r.community_college_id)
    const colKey = `${r.school_id}|${r.major}`
    const value = rowCoverageValue(r, reqMode, maSource)

    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, {
        key: rowKey,
        name: r.row_group_label || r.community_college || rowKey,
        kind: r.row_group_kind || 'college',
        sourceCount: Array.isArray(r.community_college_ids) ? r.community_college_ids.length : 1,
      })
    }
    if (!colMap.has(colKey)) {
      colMap.set(colKey, {
        key: colKey,
        school: r.school || `School ${r.school_id}`,
        schoolId: r.school_id,
        major: r.major || 'Unknown major',
        pdfColumnAverage: numberOrNull(r.published_pdf_named_requirement_column_average),
      })
    }

    if (Number.isFinite(value)) {
      const cellKey = `${rowKey}|${colKey}`
      const cell = cellMap.get(cellKey) || {
        sum: 0,
        n: 0,
        receiversRequired: 0,
        receiversArticulated: 0,
        degreeUnitsModeled: 0,
        degreeUnitsCovered: 0,
        hasDegreeUnits: false,
        degreeUnitSystem: null,
        maSlotsTotal: 0,
        maSlotsArticulated: 0,
        maGeTotal: 0,
        maGeArticulated: 0,
      }
      cell.sum += value
      cell.n += 1
      cell.receiversRequired += numberOrNull(r.degree_requirements_total ?? r.receivers_required) || 0
      cell.receiversArticulated += numberOrNull(r.degree_requirements_with_equivalent ?? r.receivers_articulated) || 0
      const modeledUnits = numberOrNull(r.degree_units_modeled_total)
      const coveredUnits = numberOrNull(r.degree_units_with_equivalent)
      if (modeledUnits != null && coveredUnits != null) {
        cell.degreeUnitsModeled += modeledUnits
        cell.degreeUnitsCovered += coveredUnits
        cell.hasDegreeUnits = true
      }
      cell.maSlotsTotal += numberOrNull(r.named_requirement_courses_total) || 0
      cell.maSlotsArticulated += numberOrNull(r.named_requirement_courses_articulated) || 0
      cell.maGeTotal += numberOrNull(r.named_requirement_courses_with_ge_total) || 0
      cell.maGeArticulated += numberOrNull(r.named_requirement_courses_with_ge_articulated) || 0
      if (r.degree_unit_system) cell.degreeUnitSystem = r.degree_unit_system
      cellMap.set(cellKey, cell)
    }
  }

  const columns = [...colMap.values()].sort((a, b) =>
    a.school.localeCompare(b.school, undefined, { sensitivity: 'base' }) ||
    a.major.localeCompare(b.major, undefined, { sensitivity: 'base' })
  )
  const tableRows = [...rowMap.values()].sort(sortByName).map((row) => {
    const rowValues = columns.map((col) => {
      const cell = cellMap.get(`${row.key}|${col.key}`)
      return cellCoverageValue(cell, reqMode, maSource)
    })
    return { ...row, values: rowValues, mean: average(rowValues) }
  })
  const columnMeans = columns.map((col) =>
    maSource === 'pdf' && Number.isFinite(col.pdfColumnAverage)
      ? col.pdfColumnAverage
      : average(tableRows.map((row) => {
      const cell = cellMap.get(`${row.key}|${col.key}`)
      return cellCoverageValue(cell, reqMode, maSource)
    }))
  )
  const values = [...cellMap.values()]
    .map((cell) => cellCoverageValue(cell, reqMode, maSource))
    .filter(Number.isFinite)
  const fullCount = values.filter((value) => value >= 100).length

  return {
    rows: tableRows,
    columns,
    columnMeans,
    cellMap,
    colorScale: createCoverageColorScale(values),
    fullCount,
    valueCount: values.length,
    overallMean: average(values),
    paperProseMean: maSource === 'pdf'
      ? rows.map((row) => numberOrNull(row.published_pdf_named_requirement_prose_mean))
        .find(Number.isFinite) ?? null
      : null,
  }
}

/** Resolve a saved comparison pane exactly as the mounted figure resolves it. */
export function coverageViewForPane(pane = {}, major = null) {
  const knobs = pane.knobs || {}
  const isPaperCorpus = Boolean(major?.state && major?.capabilities?.paperBaselines)
  // The final PDF publishes the 15-college matrix only. District/county
  // aggregation remains a live California lens, not an invented MA figure.
  const rowMode = isPaperCorpus ? 'college' : (knobs.rows || 'college')
  const maSource = isPaperCorpus
    ? normalizeMaFigure1Source(knobs['ma-source'])
    : 'archive'
  const unitLensAvailable = major?.capabilities?.unitCoverage !== false
  const maEquivalent = unitLensAvailable ? knobs['ma-equivalent'] !== false : true
  const includeGe = Boolean(knobs['ma-include-ge'])
  let reqMode = knobs.basis || 'degree'
  const supportsPaper = major?.capabilities?.transferMinimums
    ?? String(pane.major || '').trim().toLowerCase() === 'cs'
  if (!supportsPaper && reqMode === 'paper') reqMode = 'degree'
  if (maEquivalent) reqMode = includeGe ? MA_GE_MODE : MA_MODE
  return { rowMode, reqMode, maSource, ...coverageQueryArgs({ majorSlug: pane.major, rowMode, reqMode }) }
}

/** Cells consumed by Compare, taken from the same model the table renders. */
export function coverageComparisonCells(data, pane, major) {
  const { reqMode, maSource } = coverageViewForPane(pane, major)
  const model = buildHeatmap(data?.rows || [], reqMode, { maSource })
  return model.rows.flatMap((row) => model.columns.map((column, index) => ({
    rowKey: row.key,
    rowLabel: row.name,
    colKey: column.key,
    colLabel: `${column.school} — ${column.major}`,
    value: row.values[index],
  })))
}

export function coverageComparisonContract(pane, major) {
  const view = coverageViewForPane(pane, major)
  const maCourseLens = MA_MODES.has(view.reqMode)
  const includeGe = view.reqMode === MA_GE_MODE
  const sources = {
    degree: 'curated bachelor requirements + published equivalencies',
    assist: 'ASSIST transfer-minimum agreements',
    paper: 'hand-curated transfer minimums',
    [MA_MODE]: 'curated whole-degree course requirements + published equivalencies',
    [MA_GE_MODE]: 'curated whole-degree course requirements + GE certification + published equivalencies',
  }
  return {
    measure: maCourseLens
      ? 'required-course-articulation'
      : view.reqMode === 'degree' ? 'graduation-unit-coverage' : 'transfer-minimum-coverage',
    unit: 'percentage points',
    grain: `${view.rowMode} × university program`,
    keys: { rows: view.rowMode, columns: 'university program' },
    semantics: maCourseLens ? {
      denominator: 'named required courses, series expanded',
      scope: 'whole degree',
      ge: includeGe,
      weighting: 'each institution × program cell equally',
    } : view.reqMode === 'degree' ? {
      denominator: 'modeled graduation units',
      scope: 'whole degree',
      ge: true,
      weighting: 'each institution × program cell equally',
    } : {
      denominator: 'transfer-minimum requirement choices',
      scope: 'transfer admission minimums',
      ge: false,
      weighting: 'each institution × program cell equally',
    },
    context: {
      source: view.maSource === 'pdf'
        ? 'final PDF Figure 1 printed cells'
        : sources[view.reqMode],
      cohort: major?.label || pane.major,
      bachelor_template_evidence: degreeTemplateEvidenceLabel(major),
      display_scale: 'adaptive per pane in gallery; fixed 0–100 and shared across panes in Comparison',
    },
  }
}

function cellTitle(row, col, cell, value, reqMode, maSource = 'archive') {
  const bits = [
    row.name,
    col.school,
    col.major,
    MA_MODES.has(reqMode)
      ? `MA-equivalent articulation: ${pct(value)}`
      : reqMode === 'degree'
        ? `Potential graduation-unit coverage: ${pct(value)}`
        : `Coverage: ${pct(value)}`,
  ]
  if (cell) {
    if (reqMode === MA_MODE && maSource === 'pdf') {
      bits.push('Final-paper whole-percentage cell. The released data do not include the final hidden numerator and denominator; compare it with Our recalculation.')
    } else if (reqMode === MA_MODE) {
      bits.push(`${intFmt.format(cell.maSlotsArticulated)} of ${intFmt.format(cell.maSlotsTotal)} required courses articulate (every level, series expanded, GE excluded — the paper's binary counting)`)
    } else if (reqMode === MA_GE_MODE) {
      bits.push(`${intFmt.format(cell.maGeArticulated)} of ${intFmt.format(cell.maGeTotal)} required courses articulate (every level, GE included — lower-division GE cleared by certification)`)
    } else if (reqMode === 'degree') {
      if (cell.hasDegreeUnits) {
        const unitSystem = cell.degreeUnitSystem === 'quarter' ? 'quarter' : 'semester'
        bits.push(`${unitFmt.format(cell.degreeUnitsCovered)} of ${unitFmt.format(cell.degreeUnitsModeled)} modeled ${unitSystem} units have a community-college equivalent`)
      }
      bits.push(`Secondary slot count: ${intFmt.format(cell.receiversArticulated)} of ${intFmt.format(cell.receiversRequired)} requirements have an equivalent`)
    } else {
      bits.push(`${intFmt.format(cell.receiversArticulated)} of ${intFmt.format(cell.receiversRequired)} listed receivers are satisfied (the percentage follows the requirement’s choose-N rule)`)
    }
  }
  return bits.join('\n')
}

function HeatmapTable({ model, rowMode, reqMode, maSource = 'archive' }) {
  return (
    <div className='surface-card overflow-auto max-h-[72vh]'>
      <table className='border-separate border-spacing-0 min-w-full'>
        <thead>
          <tr>
            <th className='sticky top-0 left-0 z-30 bg-surface border-b border-r border-border px-3 py-2 text-left text-label min-w-56'>
              {rowMode.header}
            </th>
            {model.columns.map((col) => (
              <th
                key={col.key}
                className='sticky top-0 z-20 bg-surface border-b border-r border-border px-2 py-2 text-left align-bottom min-w-30 max-w-30'
              >
                <span className='block text-tag text-ink leading-tight whitespace-normal'>
                  {shortenSchool(col.school)}
                </span>
                <span className='block text-tag text-ink-subtle leading-tight whitespace-normal mt-0.5'>
                  {shortenMajor(col.major)}
                </span>
              </th>
            ))}
            <th className='sticky top-0 right-0 z-30 bg-surface border-b border-l border-border px-3 py-2 text-right text-label min-w-20'>
              Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.key} className='group'>
              <th className='sticky left-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-r border-border px-3 py-1.5 text-left text-caption text-ink min-w-56'>
                {row.name}
                {row.sourceCount > 1 && (
                  <span className='ml-1 text-ink-subtle font-mono'>({row.sourceCount})</span>
                )}
              </th>
              {model.columns.map((col, i) => {
                const cell = model.cellMap.get(`${row.key}|${col.key}`)
                const value = cellCoverageValue(cell, reqMode, maSource)
                return (
                  <td
                    key={col.key}
                    title={cellTitle(row, col, cell, value, reqMode, maSource)}
                    aria-label={cellTitle(row, col, cell, value, reqMode, maSource)}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                    style={makeCellColor(value, model.colorScale)}
                  >
                    {pct(value)}
                  </td>
                )
              })}
              <td className='sticky right-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-l border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
                {pct(row.mean)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th className='sticky left-0 bottom-0 z-30 bg-surface border-t border-r border-border px-3 py-2 text-left text-label min-w-56'>
              Average
            </th>
            {model.columns.map((col, i) => (
              <td
                key={col.key}
                className='sticky bottom-0 z-20 border-t border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                style={makeCellColor(model.columnMeans[i], model.colorScale)}
              >
                {pct(model.columnMeans[i])}
              </td>
            ))}
            <td className='sticky right-0 bottom-0 z-30 bg-surface border-t border-l border-border px-3 py-2 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
              {pct(model.overallMean)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Legend({ reqMode, scale }) {
  const domainLabel = `${scale.comparisonShared ? 'Shared comparison color domain' : 'Color domain'}: ${pct(scale.min)}–${pct(scale.max)}`
  return (
    <div className='flex flex-wrap items-center gap-3 text-caption text-ink-subtle'>
      <span className='text-label'>
        {MA_MODES.has(reqMode)
          ? 'MA-equivalent requirement articulation'
          : reqMode === 'degree' ? 'Potential graduation-unit coverage' : 'Coverage'}
      </span>
      <span data-color-domain={scale.comparisonShared ? 'shared' : 'local'}>{domainLabel}</span>
      <div className='w-64 max-w-full' aria-label={`Coverage color scale from ${pct(scale.min)} to ${pct(scale.max)}`}>
        <div
          className='h-2 rounded-pill border border-border'
          style={{ background: PAPER_RED_LOW_TO_HIGH_GRADIENT }}
        />
        <div className='mt-1 flex justify-between font-mono tabular-nums'>
          <span>&le;{pct(scale.min)}</span>
          <span>{pct(scale.mid)}</span>
          <span>&ge;{pct(scale.max)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * `presentation` locks the requirement basis to the four-year degree lens and
 * hides its selector. The showcase uses it so a walkthrough cannot land on the
 * minimums lenses, which answer a different question than the figure claims.
 */
export default function CoverageHeatmap({
  presentation = false,
  majorSlug = 'cs',
  major: majorProp = null,
  majorCapabilities,
  onMeasureChange,
  onViewChange,
  comparisonColorScale = null,
  defaultRowMode = 'college',
  defaultReqMode = 'degree',
  // Both the source-paper view and the California gallery open on the
  // paper-equivalent named-course lens; the graduation-unit lens remains an
  // explicit alternate view.
  defaultMaEquivalent = true,
  defaultMaIncludeGe = false,
  defaultMaSource = 'pdf',
}) {
  const [rowModeValue, setRowModeValue] = useState(defaultRowMode)
  const [reqMode, setReqMode] = useState(defaultReqMode)
  // A corpus can declare that the California unit-budget lenses do not model
  // it (Massachusetts: no transfer cap, no GE netting — the unit measure
  // computes garbage). There the paper's course lens is the only basis, so
  // the MA-equivalent state is forced on and its toggle disappears.
  const unitLensAvailable = majorCapabilities?.unitCoverage !== false
  const isPaperCorpus = Boolean(
    (majorProp?.state && majorProp?.capabilities?.paperBaselines)
      || (majorSlug === 'ma-cs' && majorCapabilities?.paperBaselines)
  )
  const [maToggle, setMaEquivalent] = useState(defaultMaEquivalent)
  const maEquivalent = unitLensAvailable ? maToggle : true
  const [maIncludeGe, setMaIncludeGe] = useState(defaultMaIncludeGe)
  const [maSource, setMaSource] = useState(() => normalizeMaFigure1Source(defaultMaSource))
  const rowMode = isPaperCorpus
    ? ROW_MODES[0]
    : (ROW_MODES.find((m) => m.value === rowModeValue) || ROW_MODES[0])
  // Hand-curated website minimums only exist for CS. Prefer the registry's
  // explicit capability when the caller has it, while failing closed for an
  // unrecognized/non-CS slug during incremental major-picker plumbing.
  const supportsPaperMode = majorCapabilities?.transferMinimums
    ?? String(majorSlug).trim().toLowerCase() === 'cs'
  const reqModes = supportsPaperMode
    ? REQ_MODES
    : REQ_MODES.filter((mode) => mode.value !== 'paper')

  // A major can change while this component stays mounted. Do not carry a
  // previously selected CS-only paper lens into Biology/Economics requests.
  useEffect(() => {
    if (!supportsPaperMode && reqMode === 'paper') setReqMode('degree')
  }, [reqMode, supportsPaperMode])

  // Fetch on mount with no polling; template saves invalidate this query and
  // Refresh remains available for externally edited data.
  const basisMode = presentation
    ? 'degree'
    : reqModes.some((m) => m.value === reqMode) ? reqMode : 'degree'
  const activeReqMode = !presentation && maEquivalent
    ? (maIncludeGe ? MA_GE_MODE : MA_MODE)
    : basisMode
  const activeMaSource = isPaperCorpus && activeReqMode === MA_MODE ? maSource : 'archive'

  // The figure's statistic changes with its controls, so the "How this is
  // measured" panel beside it must follow. The definitions live in
  // measures.js; the figure only reports which one is active.
  useEffect(() => {
    onMeasureChange?.(COVERAGE_HEATMAP_MEASURES[activeReqMode] || COVERAGE_HEATMAP_MEASURES.degree)
  }, [activeReqMode, onMeasureChange])

  // A pinned comparison must reopen on the controls the reader actually
  // selected, so the figure reports its own settings rather than the state its
  // seed props described. `maToggle`, never the `maEquivalent` a corpus without
  // the unit lens forces: pinning a value nobody chose would follow the view
  // into a corpus where that toggle is the reader's to set.
  useEffect(() => {
    onViewChange?.({
      defaultRowMode: rowMode.value,
      defaultReqMode: reqMode,
      defaultMaEquivalent: maToggle,
      defaultMaIncludeGe: maIncludeGe,
      defaultMaSource: maSource,
    })
  }, [rowMode.value, reqMode, maToggle, maIncludeGe, maSource, onViewChange])

  const coverage = useCoverage(
    coverageQueryArgs({ majorSlug, rowMode: rowMode.value, reqMode: activeReqMode }),
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const rows = coverage.data?.rows || []
  const localModel = useMemo(
    () => buildHeatmap(rows, activeReqMode, { maSource: activeMaSource }),
    [rows, activeReqMode, activeMaSource]
  )
  const model = useMemo(() => (
    Number.isFinite(comparisonColorScale?.min) && Number.isFinite(comparisonColorScale?.max)
      ? { ...localModel, colorScale: comparisonColorScale }
      : localModel
  ), [localModel, comparisonColorScale])
  const datasetVersion = coverage.data?.dataset_version || 'unversioned'
  const templateEvidence = degreeTemplateEvidenceLabel(majorProp)

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }

  if (coverage.isError) {
    return <Alert type='error'>Could not load the coverage data.</Alert>
  }

  if (!rows.length) {
    return (
      <Stack gap='section'>
        <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
          {!isPaperCorpus && <div className='flex flex-col'>
            <span className='field-label'>Rows</span>
            <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
              {ROW_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type='button'
                  onClick={() => setRowModeValue(mode.value)}
                  className={`px-3 text-button border-r border-border last:border-r-0 ${
                    rowMode.value === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>}
          {!presentation && unitLensAvailable && (
            <div className='flex flex-col min-w-64'>
              <span className='field-label'>Requirement basis</span>
              <Select value={basisMode} onChange={setReqMode} options={reqModes} disabled={maEquivalent} />
            </div>
          )}
          {!presentation && unitLensAvailable && (
            <div className='flex flex-col'>
              <span className='field-label'>Massachusetts comparison</span>
              <div className='flex gap-2'>
                <button
                  type='button'
                  aria-pressed={maEquivalent}
                  onClick={() => setMaEquivalent((v) => !v)}
                  className={`h-9 px-3 rounded-lg border text-button transition-colors ${maEquivalent
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-hover'}`}
                >
                  MA-paper equivalent
                </button>
                {maEquivalent && (
                  <button
                    type='button'
                    aria-pressed={maIncludeGe}
                    onClick={() => setMaIncludeGe((v) => !v)}
                    className={`h-9 px-3 rounded-lg border text-button transition-colors ${maIncludeGe
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-hover'}`}
                  >
                    Include GE
                  </button>
                )}
              </div>
            </div>
          )}
          {isPaperCorpus && (
            <div className='flex flex-col min-w-64'>
              <span className='field-label'>Massachusetts source</span>
              <Select value={maSource} onChange={setMaSource} options={MA_FIG1_SOURCES} />
            </div>
          )}
          <Button variant='secondary' leadingIcon={ArrowPathIcon} onClick={() => coverage.refetch()}>
            Refresh
          </Button>
        </div>
        <EmptyState card title='No coverage rows' description='No coverage data is available for the selected row and requirement settings.' className='p-8' />
      </Stack>
    )
  }

  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        {!isPaperCorpus && <div className='flex flex-col'>
          <span className='field-label'>Rows</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {ROW_MODES.map((mode) => (
              <button
                key={mode.value}
                type='button'
                onClick={() => setRowModeValue(mode.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  rowMode.value === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>}
        {!presentation && unitLensAvailable && (
          <div className='flex flex-col min-w-64'>
            <span className='field-label'>Requirement basis</span>
            <Select value={basisMode} onChange={setReqMode} options={reqModes} disabled={maEquivalent} />
          </div>
        )}
        {isPaperCorpus && (
          <div className='flex flex-col min-w-64'>
            <span className='field-label'>Massachusetts source</span>
            <Select value={maSource} onChange={setMaSource} options={MA_FIG1_SOURCES} />
          </div>
        )}
        {!presentation && unitLensAvailable && (
          <div className='flex flex-col'>
            <span className='field-label'>Massachusetts comparison</span>
            <div className='flex gap-2'>
              <button
                type='button'
                aria-pressed={maEquivalent}
                onClick={() => setMaEquivalent((v) => !v)}
                className={`h-9 px-3 rounded-lg border text-button transition-colors ${maEquivalent
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-hover'}`}
              >
                MA-paper equivalent
              </button>
              {maEquivalent && (
                <button
                  type='button'
                  aria-pressed={maIncludeGe}
                  onClick={() => setMaIncludeGe((v) => !v)}
                  className={`h-9 px-3 rounded-lg border text-button transition-colors ${maIncludeGe
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-hover'}`}
                >
                  Include GE
                </button>
              )}
            </div>
          </div>
        )}
        <Button
          variant='secondary'
          leadingIcon={ArrowPathIcon}
          loading={coverage.isFetching && !coverage.isLoading}
          onClick={() => coverage.refetch()}
        >
          Refresh
        </Button>
        <div className='ml-auto flex h-9 flex-wrap items-center gap-2 text-caption text-ink-subtle text-right'>
          <span className='font-mono tabular-nums'>{datasetVersion}</span>
          <span>{coverage.isFetching ? 'Updating' : 'Live endpoint'}</span>
        </div>
      </div>

      {/* The definition of the active statistic lives in the measure panel
          beside the figure (measures.js), not in figure footnotes. */}
      <div data-export-root className='flex flex-col gap-6'>
        {(activeReqMode === 'degree' || MA_MODES.has(activeReqMode)) && templateEvidence && (
          <div className='surface-card px-4 py-3 text-caption text-ink-muted'>
            Bachelor-template evidence: {templateEvidence}.
          </div>
        )}
        {isPaperCorpus && activeMaSource === 'pdf' && (
          <div className='surface-card px-4 py-3 text-caption text-ink-muted'>
            Final paper: Figure 1 as printed. The paper reports {pct(model.paperProseMean)};
            the 165 printed whole-number cells average {pct(model.overallMean)}.
            Cape Cod → UMass Dartmouth is 45% here versus 35% in our 11/31
            recalculation. The released data do not contain the final hidden ratio,
            so this remains a potential paper error or an unexplained final-data revision.
          </div>
        )}
        {isPaperCorpus && activeMaSource === 'archive' && (
          <div className='surface-card px-4 py-3 text-caption text-ink-muted'>
            Our recalculation: the authors’ released course-level data, evaluated
            with the paper’s required-course counting rule.
          </div>
        )}
        <HeatmapTable model={model} rowMode={rowMode} reqMode={activeReqMode} maSource={activeMaSource} />
        <Legend reqMode={activeReqMode} scale={model.colorScale} />
      </div>
    </Stack>
  )
}

// The props a pinned view may seed. Every `viewKnobs` entry on the registry
// must name one of these; the contract test fails the build otherwise.
CoverageHeatmap.viewProps = [
  'defaultRowMode',
  'defaultReqMode',
  'defaultMaEquivalent',
  'defaultMaIncludeGe',
  'defaultMaSource',
]
