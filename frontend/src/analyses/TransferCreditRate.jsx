import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack, StatStrip } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import { createCoverageColorScale } from './CoverageHeatmap'

/**
 * Transfer credit rate — the MA paper's Figure 3 construct on our CA data:
 * college × campus, the percent of the CS associate degree's PRESCRIBED units
 * (named courses + GE pattern; free electives excluded) that transfer toward
 * the campus's four-year graduation requirements. Live endpoint — the figure
 * follows every degree-record and articulation edit. The local CS A.S. is the
 * primary credit-loss cohort (per the degree-type analysis); the A.S.-T view
 * is the standardized-transfer benchmark.
 */
export const DEGREE_MODES = [
  { value: 'local_cs_as', label: 'Local CS A.S.' },
  { value: 'ast', label: 'CS A.S.-T' },
]

const intFmt = new Intl.NumberFormat()
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const pct = (value) => (Number.isFinite(value) ? `${pctFmt.format(value)}%` : '')

// The MA paper's palette: matplotlib `Reds`, inverted — a LOW rate reads as
// dark maroon, a high rate fades toward pale pink. Monochrome by design;
// the domain still auto-fits the data (createCoverageColorScale) so the
// band the cells actually occupy uses the full ramp.
const PAPER_RED_STOPS = [
  [255, 245, 240], [254, 224, 210], [252, 187, 161], [252, 146, 114],
  [251, 106, 74], [239, 59, 44], [203, 24, 29], [165, 15, 21], [103, 0, 13],
]

export function paperRedCellColor(value, scale, darkHigh = false) {
  if (!Number.isFinite(value)) {
    return { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-subtle)' }
  }
  const span = Math.max(1, scale.max - scale.min)
  // Rate view: high value → light end (paper Fig. 3). Extra-units view
  // passes darkHigh — more lost units → darker (paper Fig. 4).
  const position01 = Math.max(0, Math.min(1, (value - scale.min) / span))
  const normalized = darkHigh ? position01 : 1 - position01
  const position = normalized * (PAPER_RED_STOPS.length - 1)
  const index = Math.min(PAPER_RED_STOPS.length - 2, Math.floor(position))
  const t = position - index
  const lo = PAPER_RED_STOPS[index]
  const hi = PAPER_RED_STOPS[index + 1]
  const rgb = lo.map((channel, i) => Math.round(channel + (hi[i] - channel) * t))
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  return {
    backgroundColor: `rgb(${rgb.join(' ')})`,
    color: luminance > 0.55 ? '#1a1a1a' : 'white',
  }
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

// Shared by the Fig. 3 (rate) and Fig. 4 (extra units) cards — `getValue`
// picks the measure; `makeScale` its color domain.
export function buildRateMatrix(rows, getValue = (r) => r.rate, makeScale = createCoverageColorScale) {
  const colMap = new Map()
  const rowMap = new Map()
  const cells = new Map()
  const values = []
  for (const r of rows) {
    if (!colMap.has(r.school_id)) colMap.set(r.school_id, { key: r.school_id, school: r.school })
    if (!rowMap.has(r.community_college_id)) {
      rowMap.set(r.community_college_id, { key: r.community_college_id, name: r.college_name })
    }
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
    cells,
    cellValue,
    columnMeans,
    overallMean: average(values),
    valueCount: values.length,
    colorScale: makeScale(values),
  }
}

function geNote(cell) {
  if (!cell.ge_units) return 'GE: none stored'
  const counted = cell.ge_counted_units ?? 0
  const basis = !cell.ge_assumed_units
    ? 'verified by pattern'
    : !cell.ge_verified_units
      ? 'assumed via dual-qualifying courses'
      : `${cell.ge_verified_units}u verified · ${cell.ge_assumed_units}u assumed`
  return `GE: ${counted}/${cell.ge_units}u count (campus GE ask ${cell.ge_demand_units ?? 0}u; ${basis})`
}

function cellTitle(row, col, cell) {
  if (!cell) return `${row.name}\n${col.school}\nNo agreement to verify against`
  return [
    row.name,
    col.school,
    `Transfer credit rate: ${pct(cell.rate)}`,
    `${cell.transferred_units} of ${cell.prescribed_units} prescribed units transfer`,
    `Named courses: ${cell.named_transferred_units}/${cell.named_units}u · ${geNote(cell)}`,
  ].join('\n')
}

function RateTable({ model }) {
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
              </th>
              {model.columns.map((col) => {
                const cell = model.cells.get(`${row.key}|${col.key}`)
                return (
                  <td key={col.key}
                    title={cellTitle(row, col, cell)}
                    aria-label={cellTitle(row, col, cell)}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                    style={paperRedCellColor(cell?.rate ?? null, model.colorScale)}>
                    {pct(cell?.rate ?? null)}
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
  const query = useTransferCreditRate(degreeType)
  const rows = query.data?.rows || []
  const model = useMemo(() => buildRateMatrix(rows), [rows])

  if (query.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (query.isError) {
    return <Alert type='error'>Could not load the transfer credit rates.</Alert>
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
      <div data-export-exclude>
        <StatStrip tiles={[
          { label: 'Mean transfer credit rate', value: pct(model.overallMean) || '—', accent: true },
          { label: 'Colleges', value: intFmt.format(model.rows.length), sub: `${intFmt.format(model.valueCount)} computable cells` },
          {
            label: 'Full-transfer cells',
            value: intFmt.format([...model.cells.values()].filter((c) => c.rate === 100).length),
            sub: 'every prescribed unit lands',
          },
        ]} />
      </div>
      <div data-export-root className='flex flex-col gap-3'>
        <RateTable model={model} />
      </div>
    </Stack>
  )
}
