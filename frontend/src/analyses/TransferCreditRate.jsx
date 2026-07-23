import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import { createCoverageColorScale } from './CoverageHeatmap'
import { paperRedCellColor } from './maHeatmapColors'

export { paperRedCellColor } from './maHeatmapColors'

/**
 * Degree credit toward graduation: for each college × campus pair, the share
 * of the receiving bachelor's requirements fulfilled by the associate degree.
 * The scope control compares the complete four-year model with only the work a
 * community college can perform (transferable + breadth tiers).
 */
export const DEGREE_MODES = [
  { value: 'local_cs_as', label: 'Local CS A.S.' },
  { value: 'ast', label: 'CS A.S.-T' },
]

export const REQUIREMENT_SCOPES = [
  { value: 'full-degree', label: 'All bachelor’s requirements' },
  { value: 'lower-division', label: 'Lower-division only' },
]

const intFmt = new Intl.NumberFormat()
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const unitFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const pct = (value) => (Number.isFinite(value) ? `${pctFmt.format(value)}%` : '')

export function unitSystemName(system) {
  return system === 'quarter' ? 'quarter units' : 'semester units'
}

function units(value) {
  return Number.isFinite(value) ? unitFmt.format(value) : '—'
}

export function shortenSchool(school) {
  return String(school || '')
    .replace(/^University of California,\s*/i, '')
    .replace(/^UC\s+/i, '')
    .trim()
}

function average(values) {
  const nums = values.filter(Number.isFinite)
  if (!nums.length) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

export function rateForScope(row, scope) {
  return scope === 'lower-division'
    ? row?.lower_division_completion_pct
    : row?.full_degree_completion_pct
}

function fulfilledForScope(row, scope) {
  return scope === 'lower-division'
    ? row?.lower_division_fulfilled_units
    : row?.full_degree_fulfilled_units
}

function requiredForScope(row, scope) {
  return scope === 'lower-division'
    ? row?.lower_division_required_units
    : row?.full_degree_required_units
}

function scopeLabel(scope) {
  return scope === 'lower-division'
    ? 'Lower-division requirements fulfilled'
    : 'Bachelor’s requirements fulfilled'
}

function scopeDescription(scope) {
  return scope === 'lower-division'
    ? 'Transferable and breadth requirements; university-only work is excluded.'
    : 'The complete modeled graduation plan, including upper-division and university-only work.'
}

// Shared by the Fig. 3 (rate) and Fig. 4 (extra units) cards — `getValue`
// picks the measure; `makeScale` its color domain.
export function buildRateMatrix(rows, getValue = (r) => r.full_degree_completion_pct, makeScale = createCoverageColorScale) {
  const colMap = new Map()
  const rowMap = new Map()
  const records = new Map()
  const cells = new Map()
  const values = []
  for (const r of rows) {
    if (!colMap.has(r.school_id)) colMap.set(r.school_id, { key: r.school_id, school: r.school })
    if (!rowMap.has(r.community_college_id)) {
      rowMap.set(r.community_college_id, { key: r.community_college_id, name: r.college_name })
    }
    records.set(`${r.community_college_id}|${r.school_id}`, r)
    if (Number.isFinite(getValue(r))) {
      cells.set(`${r.community_college_id}|${r.school_id}`, r)
      values.push(getValue(r))
    }
  }
  const cellValue = (rowKey, colKey) => {
    const cell = cells.get(`${rowKey}|${colKey}`)
    return cell ? getValue(cell) : null
  }
  const columns = [...colMap.values()].sort((a, b) => a.school.localeCompare(b.school))
  const tableRows = [...rowMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => ({
      ...row,
      mean: average(columns.map((col) => cellValue(row.key, col.key))),
    }))
  const columnMeans = columns.map((col) =>
    average(tableRows.map((row) => cellValue(row.key, col.key))))
  return {
    columns,
    rows: tableRows,
    records,
    cells,
    cellValue,
    columnMeans,
    overallMean: average(values),
    valueCount: values.length,
    colorScale: makeScale(values),
  }
}

export function methodDetail(cell) {
  if (!cell) return null
  if (cell.method_warning) return String(cell.method_warning)
  const status = String(cell.method_status || '').trim()
  if (!status || status.toLowerCase() === 'ok') return null
  return `Method status: ${status.replaceAll('_', ' ')}`
}

export function methodWarningCount(rows) {
  const warningStatuses = new Set(['warning', 'excluded', 'unavailable', 'unsupported'])
  return rows.filter((row) => row.method_warning
    || warningStatuses.has(String(row.method_status || '').toLowerCase())).length
}

function applicationNote(cell) {
  const buckets = [
    ['named requirements', cell.named_transferred_units],
    ['GE and breadth', cell.ge_counted_units],
    ['free electives', cell.elective_counted_units],
  ].filter(([, value]) => Number.isFinite(value))
  if (!buckets.length) return null
  return `AS units applied once: ${buckets.map(([label, value]) => `${label} ${units(value)}`).join(' · ')} ${unitSystemName(cell.as_unit_system)}`
}

function cellTitle(row, col, cell, scope) {
  if (!cell) return `${row.name}\n${col.school}\nNo agreement to verify against`
  const rate = rateForScope(cell, scope)
  if (!Number.isFinite(rate)) {
    return [
      row.name,
      col.school,
      methodDetail(cell) || 'Not enough curated information to model this pair',
    ].join('\n')
  }
  return [
    row.name,
    col.school,
    `${scopeLabel(scope)}: ${pct(rate)}`,
    `${units(fulfilledForScope(cell, scope))} of ${units(requiredForScope(cell, scope))} ${unitSystemName(cell.degree_unit_system)} in this requirement scope`,
    applicationNote(cell),
    methodDetail(cell),
  ].filter(Boolean).join('\n')
}

export function TransferMethodNote({ children, warningCount = 0 }) {
  return (
    <div role='note' className='surface-card px-4 py-3 text-caption text-ink-muted'>
      <span className='font-semibold text-ink'>How this is modeled: </span>
      {children}
      {warningCount > 0 && (
        <span className='text-ink-subtle'> {intFmt.format(warningCount)} {warningCount === 1 ? 'cell includes' : 'cells include'} a method warning; open the cell for details.</span>
      )}
    </div>
  )
}

function RateTable({ model, scope }) {
  return (
    <div className='surface-card overflow-auto max-h-[72vh]'>
      <table className='border-separate border-spacing-0 min-w-full'>
        <thead>
          <tr>
            <th className='sticky top-0 left-0 z-30 bg-surface border-b border-r border-border px-3 py-2 text-left text-label min-w-56'>
              Community college
            </th>
            {model.columns.map((col) => (
              <th key={col.key}
                className='sticky top-0 z-20 bg-surface border-b border-r border-border px-2 py-2 text-left align-bottom min-w-24'>
                <span className='block text-tag text-ink leading-tight whitespace-normal'>{shortenSchool(col.school)}</span>
              </th>
            ))}
            <th className='sticky top-0 right-0 z-30 bg-surface border-b border-l border-border px-3 py-2 text-right text-label min-w-24'>
              Average
            </th>
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr key={row.key} className='group'>
              <th className='sticky left-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-r border-border px-3 py-1.5 text-left text-caption text-ink min-w-56'>
                {row.name}
              </th>
              {model.columns.map((col) => {
                const cell = model.records.get(`${row.key}|${col.key}`)
                const value = rateForScope(cell, scope)
                return (
                  <td key={col.key}
                    title={cellTitle(row, col, cell, scope)}
                    aria-label={cellTitle(row, col, cell, scope)}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                    style={paperRedCellColor(value ?? null, model.colorScale)}>
                    {pct(value ?? null)}
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
              <td key={col.key}
                className='sticky bottom-0 z-20 border-t border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                style={paperRedCellColor(model.columnMeans[i], model.colorScale)}>
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

export default function TransferCreditRate() {
  // Local CS A.S. is the headline cohort; A.S.-T is the standardized benchmark.
  const [degreeType, setDegreeType] = useState('local_cs_as')
  const [scope, setScope] = useState('full-degree')
  const query = useTransferCreditRate(degreeType)
  const rows = query.data?.rows || []
  const model = useMemo(
    () => buildRateMatrix(rows, (row) => rateForScope(row, scope)),
    [rows, scope]
  )
  const warningCount = methodWarningCount(rows)

  if (query.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (query.isError) {
    return <Alert type='error'>Could not load bachelor’s requirement completion.</Alert>
  }

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
      <div className='flex flex-col'>
        <span className='field-label'>Degree</span>
        <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
          {DEGREE_MODES.map((mode) => (
            <button key={mode.value} type='button' onClick={() => setDegreeType(mode.value)}
              className={`px-3 text-button border-r border-border last:border-r-0 ${
                degreeType === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
              }`}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <div className='flex flex-col' data-control-group='scope'>
        <span className='field-label'>Requirements counted</span>
        <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
          {REQUIREMENT_SCOPES.map((item) => (
            <button key={item.value} type='button' onClick={() => setScope(item.value)}
              className={`px-3 text-button border-r border-border last:border-r-0 ${
                scope === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
              }`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <Button variant='secondary' leadingIcon={ArrowPathIcon}
        loading={query.isFetching && !query.isLoading} onClick={() => query.refetch()}>
        Refresh
      </Button>
      <div className='ml-auto flex h-9 items-center text-caption text-ink-subtle'>
        {query.isFetching ? 'Updating' : 'Live endpoint'}
      </div>
    </div>
  )

  if (!rows.length) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='No degree records'
          description='No analyzable associate-degree records exist for this degree type yet.' className='p-8' />
      </Stack>
    )
  }

  return (
    <Stack gap='section'>
      {controls}
      <div data-export-root className='flex flex-col gap-3'>
        <div className='surface-card px-4 py-3'>
          <p className='text-label'>{REQUIREMENT_SCOPES.find((item) => item.value === scope)?.label}</p>
          <p className='mt-1 text-caption text-ink-muted'>{scopeDescription(scope)}</p>
        </div>
        <RateTable model={model} scope={scope} />
        <TransferMethodNote warningCount={warningCount}>
          The denominator is the receiving bachelor’s requirements, not the associate degree. The full view includes university-only upper-division work; the lower-division view excludes that tier. Associate-degree units are applied at most once to articulated courses, general education or breadth, and documented elective room. Blank cells lack enough curated information.
        </TransferMethodNote>
      </div>
    </Stack>
  )
}
