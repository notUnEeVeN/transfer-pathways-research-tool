import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack, StatStrip } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import {
  DEGREE_MODES, TransferMethodNote, buildRateMatrix, methodDetail,
  methodWarningCount, paperRedCellColor, shortenSchool, unitSystemName,
} from './TransferCreditRate'

/**
 * Modeled replacement coursework: associate-degree units that the curated
 * full graduation model cannot apply. The heatmap converts native
 * semester/quarter values to semester-equivalent units so every college shares
 * one comparable scale. This is modeled coursework, not an observed outcome.
 */
const intFmt = new Intl.NumberFormat()
const unitFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const plus = (value) => (Number.isFinite(value) ? `+${unitFmt.format(value)}` : '')

// Extra units are open-ended above zero — anchor the ramp at 0 so "+0" is
// always the palest cell, and let the observed maximum set the dark end.
const extraScale = (values) => ({ min: 0, max: Math.max(1, ...values.filter(Number.isFinite)) })

function cellTitle(row, col, cell) {
  if (!cell) return `${row.name}\n${col.school}\nNo agreement to verify against`
  if (!Number.isFinite(cell.extra_units_semester)) {
    return [
      row.name,
      col.school,
      methodDetail(cell) || 'Not enough curated information to model this pair',
    ].join('\n')
  }
  const nativeUnits = unitSystemName(cell.as_unit_system)
  const nativeExtra = Number.isFinite(cell.extra_units) ? unitFmt.format(cell.extra_units) : '—'
  const applied = Number.isFinite(cell.transferred_units) ? unitFmt.format(cell.transferred_units) : '—'
  const total = Number.isFinite(cell.as_total_units) ? unitFmt.format(cell.as_total_units) : '—'
  return [
    row.name,
    col.school,
    `Modeled replacement coursework: ${plus(cell.extra_units_semester)} semester-equivalent units`,
    `${nativeExtra} ${nativeUnits} do not apply after ${applied} of ${total} ${nativeUnits} apply`,
    methodDetail(cell),
  ].filter(Boolean).join('\n')
}

function ExtraTable({ model }) {
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
            <th className='sticky top-0 right-0 z-30 bg-surface border-b border-l border-border px-3 py-2 text-right text-label min-w-32'>
              Average (semester equivalent)
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
                return (
                  <td key={col.key}
                    title={cellTitle(row, col, cell)}
                    aria-label={cellTitle(row, col, cell)}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                    style={paperRedCellColor(cell?.extra_units_semester ?? null, model.colorScale, true)}>
                    {plus(cell?.extra_units_semester ?? null)}
                  </td>
                )
              })}
              <td className='sticky right-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-l border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
                {plus(row.mean)}
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
                style={paperRedCellColor(model.columnMeans[i], model.colorScale, true)}>
                {plus(model.columnMeans[i])}
              </td>
            ))}
            <td className='sticky right-0 bottom-0 z-30 bg-surface border-t border-l border-border px-3 py-2 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
              {plus(model.overallMean)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function TransferExtraUnits() {
  const [degreeType, setDegreeType] = useState('local_cs_as')
  const query = useTransferCreditRate(degreeType)
  const rows = query.data?.rows || []
  const model = useMemo(
    () => buildRateMatrix(rows, (r) => r.extra_units_semester, extraScale),
    [rows]
  )
  const warningCount = methodWarningCount(rows)

  if (query.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (query.isError) {
    return <Alert type='error'>Could not load the transfer credit data.</Alert>
  }

  const zeroCells = [...model.cells.values()].filter((c) => c.extra_units_semester === 0).length
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
          {
            label: 'Mean replacement units',
            value: Number.isFinite(model.overallMean) ? plus(model.overallMean) : '—',
            sub: 'semester-equivalent units',
          },
          { label: 'Colleges', value: intFmt.format(model.rows.length), sub: `${intFmt.format(model.valueCount)} modeled college and campus pairs` },
          {
            label: 'No replacement units',
            value: intFmt.format(zeroCells),
            sub: 'college and campus pairs',
            accent: zeroCells > 0,
          },
        ]} />
      </div>
      <div data-export-root className='flex flex-col gap-3'>
        <ExtraTable model={model} />
        <TransferMethodNote warningCount={warningCount}>
          Each cell shows associate-degree units that do not apply through a named course, general education or breadth, or documented elective requirement in the curated graduation model. Quarter-unit results are converted to semester-equivalent units for comparison; these are modeled replacement units, not observed student outcomes.
        </TransferMethodNote>
      </div>
    </Stack>
  )
}
