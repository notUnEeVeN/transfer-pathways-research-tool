import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import {
  EvidenceCohortControl, EvidenceSummary, TransferEvidenceCaveats, buildRateMatrix,
  defaultDegreeMode, degreeModesForMajor, methodDetail, paperRedCellColor,
  shortenSchool, unitSystemName,
} from './TransferCreditRate'
import ColorDomainLegend from './ColorDomainLegend'

/**
 * The MA paper's Figure 4 construct: total modeled pathway hours above the
 * 120-semester-hour bachelor's benchmark. On a 120-hour resident curriculum
 * this equals unused associate-degree units; on the recovered MA curricula it
 * can differ by up to three hours, so the server returns both measures by name.
 */
const unitFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const plus = (value) => (Number.isFinite(value) ? `+${unitFmt.format(value)}` : '')

export const EXTRA_UNIT_SOURCES = [
  { value: 'pdf', label: 'Final paper' },
  { value: 'archive-detail', label: 'Our recalculation' },
]

const normalizeMaExtraUnitSource = (source) => (
  source === 'pdf' ? 'pdf' : 'archive-detail'
)

export function extraUnitValue(row, source = 'ours') {
  if (source === 'pdf') return row?.published_pdf_extra_hours
  if (source === 'archive-detail') {
    // This is a Figure 4 audit source, so keep the exact 49-pair population
    // printed in Figure 4. The deposited workbook also contains 12 pathways
    // omitted from the final matrix; including them would make the pane mean
    // answer a different question even though the matched-cell join was sound.
    return Number.isFinite(row?.published_pdf_extra_hours)
      ? row?.archived_pathway_sheet_extra_hours
      : null
  }
  return row?.modeled_hours_above_120
}

// The comparison adapter consumes the figure's own reading rather than
// re-deriving a look-alike formula in the registry.
export function extraUnitEntries(data, source = 'ours') {
  return (data?.rows || []).flatMap((row) => {
    const value = extraUnitValue(row, source)
    return Number.isFinite(value) ? [{
      rowKey: row.college_name,
      rowLabel: row.college_name,
      colKey: row.school,
      colLabel: row.school,
      value,
    }] : []
  })
}

// Extra units are open-ended above zero — anchor the ramp at 0 so "+0" is
// always the palest cell, and let the observed maximum set the dark end.
const extraScale = (values) => ({ min: 0, max: Math.max(1, ...values.filter(Number.isFinite)) })

function cellTitle(row, col, cell, source, value) {
  if (!cell) return `${row.name}\n${col.school}\nNo agreement to verify against`
  if (!Number.isFinite(value)) {
    return [
      row.name,
      col.school,
      source === 'pdf'
        ? 'This pair is not reported in the final paper Figure 4'
        : methodDetail(cell) || 'Not enough curated information to model this pair',
    ].join('\n')
  }
  if (source === 'pdf') {
    return [
      row.name,
      col.school,
      `Final paper Figure 4: ${plus(value)} semester hours above 120`,
      Number.isFinite(cell.archived_pathway_sheet_extra_hours)
        ? `Our recalculation: ${plus(cell.archived_pathway_sheet_extra_hours)} hours above 120`
        : null,
      'Transcribed from the final PDF; blank cells are pairs the figure did not report.',
    ].filter(Boolean).join('\n')
  }
  if (source === 'archive-detail') {
    return [
      row.name,
      col.school,
      `Our recalculation: ${plus(value)} semester hours above 120`,
      Number.isFinite(cell.archived_pathway_sheet_total_hours)
        ? `${unitFmt.format(cell.archived_pathway_sheet_total_hours)} recalculated total semester hours; max(0, total − 120)`
        : null,
      Number.isFinite(cell.published_pdf_extra_hours)
        ? `Final paper Figure 4: ${plus(cell.published_pdf_extra_hours)} hours above 120`
        : null,
      'Calculated from the authors’ released pathway data with the paper’s formula.',
    ].filter(Boolean).join('\n')
  }
  const nativeUnits = unitSystemName(cell.as_unit_system)
  const nativeExtra = Number.isFinite(cell.extra_units) ? unitFmt.format(cell.extra_units) : '—'
  const applied = Number.isFinite(cell.transferred_units) ? unitFmt.format(cell.transferred_units) : '—'
  const total = Number.isFinite(cell.as_total_units) ? unitFmt.format(cell.as_total_units) : '—'
  return [
    row.name,
    col.school,
    `Modeled pathway: ${plus(value)} semester hours above 120`,
    Number.isFinite(cell.modeled_pathway_units_semester)
      ? `${unitFmt.format(cell.modeled_pathway_units_semester)} total modeled semester hours`
      : null,
    `${nativeExtra} ${nativeUnits} do not apply after ${applied} of ${total} ${nativeUnits} apply`,
    Number.isFinite(cell.published_pdf_extra_hours)
      ? `Final paper Figure 4: ${plus(cell.published_pdf_extra_hours)} hours above 120`
      : null,
    methodDetail(cell),
  ].filter(Boolean).join('\n')
}

function ExtraTable({ model, source }) {
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
              Average hours above 120
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
                    title={cellTitle(row, col, cell, source, value)}
                    aria-label={cellTitle(row, col, cell, source, value)}
                    className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                    style={paperRedCellColor(value, model.colorScale)}>
                    {plus(value)}
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
                style={paperRedCellColor(model.columnMeans[i], model.colorScale)}>
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

export default function TransferExtraUnits({
  majorSlug = 'cs', majorLabel = '', degreeAnalysisSlots = null,
  degreeSlotLabels = null, major = null,
  defaultDegreeType = null, defaultVerifiedOnly = true,
  defaultSource = 'pdf', onViewChange, comparisonColorScale = null,
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
  const [verifiedOnly, setVerifiedOnly] = useState(defaultVerifiedOnly)
  const [source, setSource] = useState(defaultSource)
  const effectiveSource = paperCorpus ? normalizeMaExtraUnitSource(source) : 'ours'
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
    })
  }, [degreeType, verifiedOnly, source, paperCorpus, effectiveSource, onViewChange])
  const queryVerifiedOnly = paperCorpus ? false : verifiedOnly
  const query = useTransferCreditRate(degreeType, { majorSlug, verifiedOnly: queryVerifiedOnly })
  const rows = query.data?.rows || []
  const localModel = useMemo(
    () => buildRateMatrix(rows, (row) => extraUnitValue(row, effectiveSource), extraScale),
    [rows, effectiveSource]
  )
  const model = useMemo(() => (
    Number.isFinite(comparisonColorScale?.min) && Number.isFinite(comparisonColorScale?.max)
      ? { ...localModel, colorScale: comparisonColorScale }
      : localModel
  ), [localModel, comparisonColorScale])

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
            {EXTRA_UNIT_SOURCES.map((item) => (
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
                  ? 'Final PDF Figure 4 (reported pairs only)'
                  : effectiveSource === 'archive-detail'
                    ? 'Our recalculation from the authors’ source data (same 49 reported pairs)'
                    : 'Our reconstruction from the recovered pathway workbooks')
                : null}
              cellKind={paperCorpus
                ? (effectiveSource === 'pdf' ? 'reported' : 'recomputed')
                : 'modeled'}
              collegeCount={model.rows.length} cellCount={model.valueCount} />
          </p>
          {!paperCorpus && <TransferEvidenceCaveats rows={rows} majorSlug={majorSlug} />}
        </div>
        <ColorDomainLegend scale={model.colorScale} formatValue={plus}
          suffix='semester hours above 120' />
        <ExtraTable model={model} source={effectiveSource} />
      </div>
    </Stack>
  )
}

// The props a pinned view may seed. Every `viewKnobs` entry on the registry
// must name one of these; the contract test fails the build otherwise.
TransferExtraUnits.viewProps = ['defaultDegreeType', 'defaultVerifiedOnly', 'defaultSource']
