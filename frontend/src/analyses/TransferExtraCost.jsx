import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import {
  EvidenceCohortControl, EvidenceSummary, TransferMethodNote, buildRateMatrix,
  defaultDegreeMode, degreeModesForMajor, methodDetail, methodWarningCount, paperRedCellColor,
  shortenSchool, unitSystemName,
} from './TransferCreditRate'

/**
 * Cost of the modeled replacement coursework — the MA paper's Figure 5 on
 * California data.
 *
 * A UC campus bills a flat rate per term, so a per-unit price has to be derived.
 * The paper derived one the same way (their institutions bill flat above 12
 * credits too), and their published figures reproduce as annual tuition and fees
 * over a 12-unit full-time load — Fitchburg State to within $2. The "standard
 * load" view divides by 15 units instead, the figure UCOP itself calls "a
 * standard, full-time unit load"; it is the same money over a realistic
 * schedule, and it is 20% cheaper per unit.
 *
 * Rates come from the campus record (UCOP Total Charges by Campus), and the
 * server does the arithmetic so downloads carry the cost too.
 */
const LOAD_VIEWS = [
  { value: 'minimum', label: 'Minimum load (paper)', field: 'extra_cost_usd', units: 12 },
  { value: 'standard', label: 'Standard load (15u)', field: 'extra_cost_standard_load_usd', units: 15 },
]

const money = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})
const unitFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const dollars = (value) => (Number.isFinite(value) ? money.format(value) : '')

// Cost is open-ended above zero, and $0 is a real result (nothing extra to take),
// so anchor the ramp at 0 exactly as the extra-units figure does.
const costScale = (values) => ({ min: 0, max: Math.max(1, ...values.filter(Number.isFinite)) })

function cellTitle(row, col, cell, view) {
  if (!cell) return `${row.name}\n${col.school}\nNo agreement to verify against`
  const cost = cell[view.field]
  if (!Number.isFinite(cost)) {
    return [
      row.name,
      col.school,
      Number.isFinite(cell.extra_units_semester) && cell.tuition_annual_resident_usd == null
        ? 'No published tuition on file for this campus'
        : methodDetail(cell) || 'Not enough curated information to model this pair',
    ].filter(Boolean).join('\n')
  }
  const annual = cell.tuition_annual_resident_usd
  const perUnit = Number.isFinite(annual) ? annual / (view.units * 2) : null
  const nativeUnits = unitSystemName(cell.as_unit_system)
  return [
    row.name,
    col.school,
    `Cost of replacement coursework: ${money.format(cost)}`,
    `${unitFmt.format(cell.extra_units_semester)} semester-equivalent units`
      + (perUnit ? ` at ${money.format(perUnit)} per unit` : ''),
    Number.isFinite(annual)
      ? `${money.format(annual)} annual tuition and fees over a ${view.units}-unit load`
      : null,
    Number.isFinite(cell.extra_units)
      ? `${unitFmt.format(cell.extra_units)} ${nativeUnits} in the college's own system`
      : null,
    methodDetail(cell),
  ].filter(Boolean).join('\n')
}

function CostTable({ model, view }) {
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
                return (
                  <td key={col.key}
                    title={cellTitle(row, col, cell, view)}
                    aria-label={cellTitle(row, col, cell, view)}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-16'
                    style={paperRedCellColor(cell?.[view.field] ?? null, model.colorScale)}>
                    {dollars(cell?.[view.field] ?? null)}
                  </td>
                )
              })}
              <td className='sticky right-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-l border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
                {dollars(row.mean)}
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
                className='sticky bottom-0 z-20 border-t border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-16'
                style={paperRedCellColor(model.columnMeans[i], model.colorScale)}>
                {dollars(model.columnMeans[i])}
              </td>
            ))}
            <td className='sticky right-0 bottom-0 z-30 bg-surface border-t border-l border-border px-3 py-2 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
              {dollars(model.overallMean)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function TransferExtraCost({
  majorSlug = 'cs', majorLabel = '', degreeAnalysisSlots = null,
  degreeSlotLabels = null, major = null,
}) {
  const degreeModes = useMemo(() => degreeModesForMajor({
    majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels,
  }), [majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels])
  const [degreeType, setDegreeType] = useState(() => defaultDegreeMode(degreeModes))
  // See TransferCreditRate: a state corpus has one source, no curation cohorts.
  // A paper corpus shows another author's published values; being
  // state-scoped is not the test. Virginia is state-scoped but the data is
  // ours and verified, so it keeps the California control set. Mirrors the
  // server's own join condition (`capabilities.paperBaselines && state`).
  const paperCorpus = Boolean(major?.state && major?.capabilities?.paperBaselines)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [loadView, setLoadView] = useState('minimum')
  useEffect(() => {
    if (!degreeModes.some((mode) => mode.value === degreeType)) {
      setDegreeType(defaultDegreeMode(degreeModes))
    }
  }, [degreeModes, degreeType])
  const view = LOAD_VIEWS.find((v) => v.value === loadView) || LOAD_VIEWS[0]
  const query = useTransferCreditRate(degreeType, { majorSlug, verifiedOnly })
  const rows = query.data?.rows || []
  const model = useMemo(
    () => buildRateMatrix(rows, (r) => r[view.field], costScale),
    [rows, view.field]
  )
  const warningCount = methodWarningCount(rows)
  const missingTuition = useMemo(
    () => [...new Set(rows
      .filter((r) => Number.isFinite(r.extra_units_semester) && r.tuition_annual_resident_usd == null)
      .map((r) => r.school))],
    [rows]
  )

  if (query.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (query.isError) {
    return <Alert type='error'>Could not load the transfer credit data.</Alert>
  }

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
      <div className='flex flex-col'>
        <span className='field-label'>Associate degree</span>
        <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
          {degreeModes.map((mode) => (
            <button key={mode.value} type='button' onClick={() => setDegreeType(mode.value)}
              className={`px-3 text-button border-r border-border last:border-r-0 ${
                degreeType === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
              }`}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <div className='flex flex-col'>
        <span className='field-label'>Full-time load</span>
        <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
          {LOAD_VIEWS.map((mode) => (
            <button key={mode.value} type='button' onClick={() => setLoadView(mode.value)}
              className={`px-3 text-button border-r border-border last:border-r-0 ${
                loadView === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
              }`}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      {!paperCorpus && <EvidenceCohortControl verifiedOnly={verifiedOnly} onChange={setVerifiedOnly} />}
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
          description={verifiedOnly
            ? 'No human-verified associate-degree programs exist for this degree type yet.'
            : 'No analyzable associate-degree records exist for this degree type yet.'} className='p-8' />
      </Stack>
    )
  }

  return (
    <Stack gap='section'>
      {controls}
      <div data-export-root className='flex flex-col gap-3'>
        <div className='surface-card px-4 py-3'>
          <p className='text-label'>
            <EvidenceSummary verifiedOnly={verifiedOnly}
              sourceLabel={paperCorpus ? 'Paper-source associate degrees (recovered workbooks)' : null}
              collegeCount={model.rows.length} cellCount={model.valueCount} />
          </p>
          {missingTuition.length > 0 && (
            <p className='mt-1 text-caption text-ink-muted'>
              No published tuition on file for {missingTuition.join(', ')}; those columns stay blank rather than assume a rate.
            </p>
          )}
        </div>
        <CostTable model={model} view={view} />
        <TransferMethodNote warningCount={warningCount}>
          Each cell prices the replacement coursework from the extra-units figure: semester-equivalent units that do not apply, multiplied by a per-unit rate derived from the campus’s annual resident tuition and fees over a {view.units}-unit full-time load. Campuses bill a flat rate per term, so a per-unit price must be derived; the {view.units === 12 ? 'minimum' : 'standard'}-load basis divides annual charges by {view.units} units across each term. Tuition and fees exclude health insurance, room, board and books. This is modeled cost, not an observed student bill.
          {verifiedOnly
            ? ' This high-fidelity state limits the associate-degree side to programs marked human-verified.'
            : ''}
        </TransferMethodNote>
      </div>
    </Stack>
  )
}
