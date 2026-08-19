import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import {
  EvidenceCohortControl, EvidenceSummary, TransferEvidenceCaveats, buildRateMatrix,
  defaultDegreeMode, degreeModesForMajor, methodDetail, paperRedCellColor,
  shortenSchool,
} from './TransferCreditRate'
import ColorDomainLegend from './ColorDomainLegend'

/**
 * Cost of modeled pathway hours above 120 — the MA paper's Figure 5 construct
 * on California data, with the final PDF available as an explicit MA source.
 *
 * A flat annual/term charge needs an explicit load denominator before it can be
 * expressed per unit. The paper's own cost workbook implies one campus-constant
 * rate and its final Figure 5 uses the 12-unit-per-term basis. The 15-unit view
 * is an explicitly labeled sensitivity: the same charge over 30 rather than 24
 * annual semester units, hence 20% less per unit.
 *
 * Rates come from the campus record, and the server does the modeled arithmetic
 * so downloads carry both the hours and cost. Source metadata rides the row;
 * when it is absent the visual says so instead of asserting a provenance.
 */
export const LOAD_VIEWS = [
  { value: 'minimum', label: 'Minimum load (paper)', units: 12 },
  { value: 'standard', label: 'Standard load (15u)', units: 15 },
]

export const EXTRA_COST_SOURCES = [
  { value: 'pdf', label: 'Final paper' },
  { value: 'archive-detail', label: 'Our recalculation' },
]

const normalizeMaExtraCostSource = (source) => (
  source === 'pdf' ? 'pdf' : 'archive-detail'
)

export function extraCostValue(row, source = 'ours', load = 'minimum') {
  if (source === 'pdf') {
    if (load === 'standard') {
      // The paper publishes only its 12-unit-load value. A 15-unit view is an
      // explicitly labeled sensitivity using the same dollars spread across
      // 30 rather than 24 annual semester units: exactly 24/30 = 0.8.
      return Number.isFinite(row?.published_pdf_extra_cost_usd)
        ? Math.round(row.published_pdf_extra_cost_usd * 0.8)
        : null
    }
    return row?.published_pdf_extra_cost_usd
  }
  if (source === 'archive-detail') {
    // Match the final Figure 5 matrix's exact 49-pair cohort. Twelve additional
    // deposited pathways belong to the all-61 summary population and must not
    // change this audit pane's mean.
    if (!Number.isFinite(row?.published_pdf_extra_cost_usd)) return null
    const hours = row?.archived_pathway_sheet_extra_hours
    const annual = row?.tuition_annual_resident_usd
    if (!Number.isFinite(hours) || !Number.isFinite(annual)) return null
    // The recovered MA campus charge is annualized on the same 12-unit-per-
    // term basis as the paper. Price the deposited Figure 4 numerator itself,
    // not our general pathway model, and round only the final dollar result.
    return Math.round(hours * annual / (load === 'standard' ? 30 : 24))
  }
  return load === 'standard'
    ? row?.modeled_cost_above_120_standard_load_usd
    : row?.modeled_cost_above_120_usd
}

export function extraCostEntries(data, source = 'ours', load = 'minimum') {
  return (data?.rows || []).flatMap((row) => {
    const value = extraCostValue(row, source, load)
    return Number.isFinite(value) ? [{
      rowKey: row.college_name,
      rowLabel: row.college_name,
      colKey: row.school,
      colLabel: row.school,
      value,
    }] : []
  })
}

const money = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})
const unitFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const receiptUnitFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 })
const dollars = (value) => (Number.isFinite(value) ? money.format(value) : '')

// Cost is open-ended above zero, and $0 is a real result (nothing extra to take),
// so anchor the ramp at 0 exactly as the extra-units figure does.
const costScale = (values) => ({ min: 0, max: Math.max(1, ...values.filter(Number.isFinite)) })

function cellTitle(row, col, cell, view, source, cost) {
  if (!cell) return `${row.name}\n${col.school}\nNo agreement to verify against`
  if (!Number.isFinite(cost)) {
    return [
      row.name,
      col.school,
      source === 'pdf'
        ? 'This pair is not reported in the final paper Figure 5'
        : (Number.isFinite(source === 'archive-detail'
          ? cell.archived_pathway_sheet_extra_hours
          : cell.modeled_hours_above_120) && cell.tuition_annual_resident_usd == null
          ? 'No tuition rate is on file for this campus'
          : methodDetail(cell) || 'Not enough curated information to model this pair'),
    ].filter(Boolean).join('\n')
  }
  if (source === 'pdf') {
    const recalculatedCost = extraCostValue(cell, 'archive-detail', view.value)
    return [
      row.name,
      col.school,
      view.value === 'minimum'
        ? `Final paper Figure 5: ${money.format(cost)}`
        : `15-unit-load sensitivity from final Figure 5: ${money.format(cost)}`,
      Number.isFinite(cell.published_pdf_extra_hours)
        ? `${unitFmt.format(cell.published_pdf_extra_hours)} final-paper hours above 120`
        : null,
      view.value === 'standard'
        ? 'Sensitivity only: 80% of the published 12-unit-load cost; it is not a printed paper value.'
        : 'Transcribed from the final PDF; blank cells are pairs the figure did not report.',
      Number.isFinite(recalculatedCost)
        ? `Our recalculation: ${money.format(recalculatedCost)}`
        : null,
    ].filter(Boolean).join('\n')
  }
  if (source === 'archive-detail') {
    const annual = cell.tuition_annual_resident_usd
    const archiveHours = cell.archived_pathway_sheet_extra_hours
    const denominator = view.units * 2
    return [
      row.name,
      col.school,
      `Our Figure 5 recalculation: ${money.format(cost)}`,
      `${unitFmt.format(archiveHours)} recalculated Figure 4 hours above 120 × annual charge ÷ ${denominator}, then rounded once`,
      Number.isFinite(cell.published_pdf_extra_cost_usd)
        ? `Final paper Figure 5: ${money.format(cell.published_pdf_extra_cost_usd)}`
        : null,
      cell.tuition_source
        ? `Recovered paper-rate source: ${cell.tuition_source}`
        : (Number.isFinite(annual) ? 'Recovered paper-rate source metadata is not recorded on the campus row.' : null),
      cell.tuition_source_url ? `Source URL: ${cell.tuition_source_url}` : null,
      Number.isFinite(annual)
        ? `${money.format(annual)} annual resident charge over a ${view.units}-unit-per-term load`
        : null,
      view.value === 'standard'
        ? 'Sensitivity only: the paper publishes the 12-unit-load result, not this 15-unit-load value.'
        : null,
    ].filter(Boolean).join('\n')
  }
  const annual = cell.tuition_annual_resident_usd
  const perUnit = Number.isFinite(annual) ? annual / (view.units * 2) : null
  return [
    row.name,
    col.school,
    `Cost of modeled pathway hours above 120: ${money.format(cost)}`,
    `${unitFmt.format(cell.modeled_hours_above_120)} semester hours above 120`
      + (perUnit ? ` at ${money.format(perUnit)} per unit` : ''),
    Number.isFinite(cell.modeled_hours_above_120_unrounded)
      ? `Pricing receipt: ${receiptUnitFmt.format(cell.modeled_hours_above_120_unrounded)} unrounded hours × annual charge ÷ ${view.units * 2}, then rounded to whole dollars.`
      : null,
    cell.tuition_source
      ? `Rate source: ${cell.tuition_source}`
      : (Number.isFinite(annual) ? 'Rate source metadata is not recorded on the campus row.' : null),
    cell.tuition_source_url ? `Source URL: ${cell.tuition_source_url}` : null,
    Number.isFinite(annual) && !/CurrComp Master/i.test(cell.tuition_source || '')
      ? `${money.format(annual)} annual resident tuition and fees over a ${view.units}-unit-per-term load`
      : null,
    cell.tuition_price_year ? `Price year: ${cell.tuition_price_year}` : null,
    methodDetail(cell),
  ].filter(Boolean).join('\n')
}

function CostTable({ model, view, source }) {
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
                const value = model.cellValue(row.key, col.key)
                return (
                  <td key={col.key}
                    title={cellTitle(row, col, cell, view, source, value)}
                    aria-label={cellTitle(row, col, cell, view, source, value)}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-16'
                    style={paperRedCellColor(value, model.colorScale)}>
                    {dollars(value)}
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
  defaultDegreeType = null, defaultVerifiedOnly = true,
  defaultSource = 'pdf', defaultLoadView = 'minimum', onViewChange,
  comparisonColorScale = null,
}) {
  const degreeModes = useMemo(() => degreeModesForMajor({
    majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels,
  }), [majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels])
  // The seed prop is null, not a slot literal: a major without an A.S.-T has
  // to resolve its own opening cohort, so only a pinned value may override it.
  const [degreeType, setDegreeType] = useState(() => defaultDegreeType || defaultDegreeMode(degreeModes))
  // See TransferCreditRate: a state corpus has one source, no curation cohorts.
  // A paper corpus shows another author's published values; being
  // state-scoped is not the test. Virginia is state-scoped but the data is
  // ours and verified, so it keeps the California control set. Mirrors the
  // server's own join condition (`capabilities.paperBaselines && state`).
  const paperCorpus = Boolean(major?.state && major?.capabilities?.paperBaselines)
  const corpusState = String(major?.state || '').toLowerCase()
  const californiaCorpus = corpusState === 'ca'
    || (!corpusState && !String(majorSlug).includes('-'))
  const [verifiedOnly, setVerifiedOnly] = useState(defaultVerifiedOnly)
  const [source, setSource] = useState(defaultSource)
  const [loadView, setLoadView] = useState(defaultLoadView)
  const effectiveSource = paperCorpus ? normalizeMaExtraCostSource(source) : 'ours'
  const effectiveLoadView = paperCorpus ? 'minimum' : loadView
  useEffect(() => {
    if (!degreeModes.some((mode) => mode.value === degreeType)) {
      setDegreeType(defaultDegreeMode(degreeModes))
    }
  }, [degreeModes, degreeType])
  useEffect(() => {
    onViewChange?.({
      defaultDegreeType: degreeType,
      defaultVerifiedOnly: verifiedOnly,
      defaultSource: paperCorpus ? effectiveSource : source,
      defaultLoadView: effectiveLoadView,
    })
  }, [degreeType, verifiedOnly, source, paperCorpus, effectiveSource, effectiveLoadView, onViewChange])
  const view = LOAD_VIEWS.find((v) => v.value === effectiveLoadView) || LOAD_VIEWS[0]
  const queryVerifiedOnly = paperCorpus ? false : verifiedOnly
  const query = useTransferCreditRate(degreeType, { majorSlug, verifiedOnly: queryVerifiedOnly })
  const rows = query.data?.rows || []
  const localModel = useMemo(
    () => buildRateMatrix(rows, (row) => extraCostValue(row, effectiveSource, view.value), costScale),
    [rows, effectiveSource, view.value]
  )
  const model = useMemo(() => (
    Number.isFinite(comparisonColorScale?.min) && Number.isFinite(comparisonColorScale?.max)
      ? { ...localModel, colorScale: comparisonColorScale }
      : localModel
  ), [localModel, comparisonColorScale])
  const missingTuition = useMemo(
    () => [...new Set(rows
      .filter((row) => effectiveSource !== 'pdf'
        && Number.isFinite(effectiveSource === 'archive-detail'
          ? (Number.isFinite(row.published_pdf_extra_cost_usd)
            ? row.archived_pathway_sheet_extra_hours
            : null)
          : row.modeled_hours_above_120)
        && row.tuition_annual_resident_usd == null)
      .map((r) => r.school))],
    [rows, effectiveSource]
  )
  const unprovenancedTuition = useMemo(
    () => [...new Set(rows
      .filter((row) => effectiveSource !== 'pdf'
        && Number.isFinite(row.tuition_annual_resident_usd)
        && !row.tuition_source)
      .map((row) => row.school))],
    [rows, effectiveSource]
  )

  if (query.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (query.isError) {
    return <Alert type='error'>Could not load the transfer credit data.</Alert>
  }

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
      {!paperCorpus && <div className='flex flex-col'>
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
      </div>}
      {paperCorpus && (
        <div className='flex flex-col' data-control-group='source'>
          <span className='field-label'>Source</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {EXTRA_COST_SOURCES.map((item) => (
              <button key={item.value} type='button' aria-pressed={effectiveSource === item.value}
                onClick={() => setSource(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  effectiveSource === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {!paperCorpus && <div className='flex flex-col'>
        <span className='field-label'>Full-time load</span>
        <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
          {LOAD_VIEWS.map((mode) => (
            <button key={mode.value} type='button' onClick={() => setLoadView(mode.value)}
              className={`px-3 text-button border-r border-border last:border-r-0 ${
                effectiveLoadView === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
              }`}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>}
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
              sourceLabel={paperCorpus
                ? (effectiveSource === 'pdf'
                  ? (view.value === 'minimum'
                    ? 'Final PDF Figure 5 (reported pairs only)'
                    : '15-unit-load sensitivity from final PDF Figure 5')
                  : effectiveSource === 'archive-detail'
                    ? (view.value === 'minimum'
                      ? 'Our recalculation from the authors’ Figure 4 data and campus rates (same 49 reported pairs)'
                      : '15-unit-load sensitivity from our Figure 4 recalculation')
                    : 'Our reconstruction from the recovered pathway workbooks')
                : null}
              cellKind={paperCorpus && effectiveSource === 'pdf'
                ? (view.value === 'minimum' ? 'reported' : 'sensitivity')
                : paperCorpus && effectiveSource === 'archive-detail'
                  ? (view.value === 'minimum' ? 'raw-rerun' : 'sensitivity')
                  : 'modeled'}
              collegeCount={model.rows.length} cellCount={model.valueCount} />
          </p>
          {missingTuition.length > 0 && (
            <p className='mt-1 text-caption text-ink-muted'>
              No tuition rate is on file for {missingTuition.join(', ')}; those columns stay blank rather than assume one.
            </p>
          )}
          {unprovenancedTuition.length > 0 && (
            <p className='mt-1 text-caption text-warning'>
              Rate source and price-year metadata are not recorded for {unprovenancedTuition.length} {unprovenancedTuition.length === 1 ? 'campus' : 'campuses'} in this view; treat the dollar comparison as provisional until those records are sourced.
            </p>
          )}
          {!paperCorpus && <TransferEvidenceCaveats rows={rows} majorSlug={majorSlug} />}
        </div>
        <ColorDomainLegend scale={model.colorScale} formatValue={dollars} />
        <CostTable model={model} view={view} source={effectiveSource} />
      </div>
    </Stack>
  )
}

// The props a pinned view may seed. Every `viewKnobs` entry on the registry
// must name one of these; the contract test fails the build otherwise.
TransferExtraCost.viewProps = [
  'defaultDegreeType', 'defaultVerifiedOnly', 'defaultSource', 'defaultLoadView',
]
