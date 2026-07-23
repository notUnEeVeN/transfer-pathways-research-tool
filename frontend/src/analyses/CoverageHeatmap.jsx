import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Select, Spinner, Stack } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import {
  PAPER_RED_LOW_TO_HIGH_GRADIENT,
  paperRedCellColor,
} from './maHeatmapColors'
import MajorPicker from '../shared/majors/MajorPicker'
import { useMajorSelection } from '../shared/majors/MajorContext'

const ROW_MODES = [
  { value: 'college', label: 'College', noun: 'colleges', header: 'Community college' },
  { value: 'district', label: 'District', noun: 'districts', header: 'Community college district' },
  { value: 'county', label: 'County', noun: 'counties', header: 'County served' },
]

// The denominator for each heatmap cell. Full-degree coverage follows MA Fig. 1
// and reads the editable four-year templates; the two prior minimums views stay
// available for direct comparison.
const REQ_MODES = [
  { value: 'degree', label: '4-year graduation plan (by units)' },
  { value: 'assist', label: 'ASSIST minimums' },
  { value: 'paper', label: 'Hand-curated minimums' },
]

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

function rowCoverageValue(row, reqMode) {
  return reqMode === 'degree'
    ? numberOrNull(row.pct_degree_units ?? row.pct_articulated)
    : numberOrNull(row.pct_articulated)
}

function cellCoverageValue(cell, reqMode) {
  if (!cell) return null
  if (reqMode === 'degree' && cell.hasDegreeUnits && cell.degreeUnitsModeled > 0) {
    return (cell.degreeUnitsCovered / cell.degreeUnitsModeled) * 100
  }
  return cell.n ? cell.sum / cell.n : null
}

function buildHeatmap(rows, reqMode) {
  const rowMap = new Map()
  const colMap = new Map()
  const cellMap = new Map()

  for (const r of rows) {
    const rowKey = String(r.row_group_key || r.community_college_id)
    const colKey = `${r.school_id}|${r.major}`
    const value = rowCoverageValue(r, reqMode)

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
      return cellCoverageValue(cell, reqMode)
    })
    return { ...row, values: rowValues, mean: average(rowValues) }
  })
  const columnMeans = columns.map((col) =>
    average(tableRows.map((row) => {
      const cell = cellMap.get(`${row.key}|${col.key}`)
      return cellCoverageValue(cell, reqMode)
    }))
  )
  const values = [...cellMap.values()]
    .map((cell) => cellCoverageValue(cell, reqMode))
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
  }
}

function cellTitle(row, col, cell, value, reqMode) {
  const bits = [
    row.name,
    col.school,
    col.major,
    reqMode === 'degree'
      ? `Potential graduation-unit coverage: ${pct(value)}`
      : `Coverage: ${pct(value)}`,
  ]
  if (cell) {
    if (reqMode === 'degree') {
      if (cell.hasDegreeUnits) {
        const unitSystem = cell.degreeUnitSystem === 'quarter' ? 'quarter' : 'semester'
        bits.push(`${unitFmt.format(cell.degreeUnitsCovered)} of ${unitFmt.format(cell.degreeUnitsModeled)} modeled ${unitSystem} units have a community-college equivalent`)
      }
      bits.push(`Secondary slot count: ${intFmt.format(cell.receiversArticulated)} of ${intFmt.format(cell.receiversRequired)} requirements have an equivalent`)
    } else {
      bits.push(`${intFmt.format(cell.receiversArticulated)} of ${intFmt.format(cell.receiversRequired)} required receivers articulated`)
    }
  }
  return bits.join('\n')
}

function HeatmapTable({ model, rowMode, reqMode }) {
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
                const value = cellCoverageValue(cell, reqMode)
                return (
                  <td
                    key={col.key}
                    title={cellTitle(row, col, cell, value, reqMode)}
                    aria-label={cellTitle(row, col, cell, value, reqMode)}
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
  return (
    <div className='flex flex-wrap items-center gap-3 text-caption text-ink-subtle'>
      <span className='text-label'>
        {reqMode === 'degree' ? 'Potential graduation-unit coverage' : 'Coverage'}
      </span>
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
export default function CoverageHeatmap({ presentation = false }) {
  const [rowModeValue, setRowModeValue] = useState('college')
  const [reqMode, setReqMode] = useState('degree')
  const rowMode = ROW_MODES.find((m) => m.value === rowModeValue) || ROW_MODES[0]
  // Fetch on mount with no polling; template saves invalidate this query and
  // Refresh remains available for externally edited data.
  const { slug: majorSlug, setSlug, major } = useMajorSelection()
  // ASSIST-only majors have no hand-curated minimums and, until their degree
  // templates are authored, no graduation plan to measure against.
  const caps = major?.capabilities || {}
  // Hand-curated minimums will never exist for ASSIST-only majors, so that mode
  // is dropped. The graduation-plan mode stays: its templates are pending, and
  // it renders empty until they are authored.
  const reqModes = REQ_MODES.filter((m) => m.value !== 'paper' || caps.transferMinimums !== false)
  const activeReqMode = reqModes.some((m) => m.value === reqMode) ? reqMode : 'assist'
  const coverage = useCoverage(
    { majorSlug, groupBy: rowMode.value, requirements: activeReqMode },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const rows = coverage.data?.rows || []
  const model = useMemo(() => buildHeatmap(rows, activeReqMode), [rows, activeReqMode])
  const datasetVersion = coverage.data?.dataset_version || 'unversioned'

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
          <div className='flex flex-col'>
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
          </div>
          {!presentation && (
            <div className='flex flex-col min-w-64'>
              <span className='field-label'>Requirement basis</span>
              <Select value={activeReqMode} onChange={setReqMode} options={reqModes} />
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
        <MajorPicker value={majorSlug} onChange={setSlug} className='w-60 max-w-full' />
        <div className='flex flex-col'>
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
        </div>
        {!presentation && (
          <div className='flex flex-col min-w-64'>
            <span className='field-label'>Requirement basis</span>
            <Select value={activeReqMode} onChange={setReqMode} options={reqModes} />
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

      <div data-export-root className='flex flex-col gap-6'>
        <HeatmapTable model={model} rowMode={rowMode} reqMode={activeReqMode} />
        <Legend reqMode={activeReqMode} scale={model.colorScale} />
        {activeReqMode === 'degree' && (
          <p className='text-caption text-ink-subtle max-w-4xl'>
            Percentage of modeled UC graduation units with a community-college equivalent. Each campus is calculated in its own native quarter or semester units. Requirement-slot counts remain available in each cell tooltip as secondary context.
          </p>
        )}
      </div>
    </Stack>
  )
}
