import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import { AS_DEGREE_SLOTS, slotLabel } from '../asdegrees/asDegreeSlots'
import { majorShortLabelFor } from '../shared/majors/majorLabel'
import { createCoverageColorScale } from './CoverageHeatmap'
import { TRANSFER_CREDIT_RATE_MEASURES } from './measures'
import { paperRedCellColor } from './maHeatmapColors'

export { paperRedCellColor } from './maHeatmapColors'

/**
 * Degree credit toward graduation: for each college × campus pair, the share
 * of the receiving bachelor's requirements fulfilled by the associate degree.
 * The scope control compares the complete four-year model with only the work a
 * community college can perform (transferable + breadth tiers).
 */
const DEFAULT_DEGREE_ANALYSIS_SLOTS = ['local_as', 'ast']

function degreeModeLabel(slot, awardLabel, majorSlug, configuredMajorLabel) {
  const subject = majorShortLabelFor(majorSlug, configuredMajorLabel)
  if (/^local\s+/i.test(awardLabel)) {
    return `Local ${subject} ${awardLabel.replace(/^local\s+/i, '')}`
  }
  if (slot === 'local_other' && awardLabel === 'Other') {
    return `${subject} other degree`
  }
  return `${subject} ${awardLabel}`
}

export function degreeModesForMajor({
  majorSlug = 'cs', majorLabel = '', degreeAnalysisSlots = null,
  degreeSlotLabels = null,
} = {}) {
  const configured = Array.isArray(degreeAnalysisSlots)
    ? [...new Set(degreeAnalysisSlots.filter((slot) => AS_DEGREE_SLOTS.includes(slot)))]
    : []
  const slots = configured.length ? configured : DEFAULT_DEGREE_ANALYSIS_SLOTS
  return slots.map((slot) => {
    const award = slotLabel(slot, degreeSlotLabels)
    return {
      value: slot,
      label: degreeModeLabel(slot, award, majorSlug, majorLabel),
    }
  })
}

// Backward-compatible export for figure manifests/tests that still consume
// the original CS modes directly.
export const DEGREE_MODES = degreeModesForMajor()

// The three transfer figures open on the A.S.-T cohort wherever the major has
// one: the transfer-designed degree is the pathway these figures are about,
// and it is the cohort the Massachusetts comparison prefers ("Associate's in
// CS Transfer"). The configured button order is untouched.
export function defaultDegreeMode(modes) {
  return (modes.find((mode) => mode.value === 'ast') || modes[0])?.value || 'local_as'
}

export const REQUIREMENT_SCOPES = [
  { value: 'full-degree', label: 'All bachelor’s requirements' },
  { value: 'lower-division', label: 'Lower-division only' },
]

export const EVIDENCE_COHORTS = [
  { value: 'all', label: 'All sourced programs' },
  { value: 'verified', label: 'Verified programs only' },
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

// The MA scope is the final Massachusetts paper's Figure 3: applied
// associate-degree units over the associate degree's OWN total, GE included —
// the inverse denominator of this figure's default bachelor-side measure.
export const MA_AS_SIDE_SCOPE = 'ma-as-side'

// The paper corpus carries THREE versions of its Figure 3 measure, for
// examining exactly where they differ: the final PDF's printed matrix (a
// newer revision of the hand tally), the repo workbook's tally (the older
// revision the paper's repository holds), and our recomputation from the
// pathway workbooks. On California — where nothing was published — the MA
// state shows our recomputation only.
export const MA_SOURCES = [
  { value: 'pdf', label: 'Final paper' },
  { value: 'repo', label: 'Repo workbook' },
  { value: 'ours', label: 'Ours' },
]

export function maSourceValue(row, source) {
  if (source === 'repo') return row?.published_as_transfer_pct
  if (source === 'ours') return row?.as_unit_utilization_pct
  // The paper mixed GE-inclusive and GE-skipping counts cell by cell, so our
  // recomputation ships in both flavors: the CS-only numerator counts credit
  // applied to the university's analyzed course list and nothing else.
  if (source === 'ours-cs') return row?.as_cs_only_utilization_pct
  return row?.published_pdf_as_transfer_pct
}

export function rateForScope(row, scope, maSource = 'auto') {
  if (scope === MA_AS_SIDE_SCOPE) {
    if (maSource === 'auto') {
      // No explicit selection (California's comparison lens): published values
      // do not exist there, so this resolves to our recomputation.
      return row?.published_pdf_as_transfer_pct
        ?? row?.published_as_transfer_pct
        ?? row?.as_unit_utilization_pct
    }
    return maSourceValue(row, maSource)
  }
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
  if (scope === MA_AS_SIDE_SCOPE) return 'Associate-degree credit applied (MA-paper equivalent)'
  return scope === 'lower-division'
    ? 'Lower-division requirements fulfilled'
    : 'Bachelor’s requirements fulfilled'
}

function scopeDescription(scope, maSource = 'auto') {
  if (scope === MA_AS_SIDE_SCOPE) {
    const sources = {
      pdf: 'Showing the FINAL PAPER’s Figure 3 as printed (the newer revision of their hand tally; its per-university averages mean 68%). Blank cells are pairs the paper did not study.',
      repo: 'Showing the REPO WORKBOOK’s tally (the older revision in the paper’s repository; mean 65.2%). Where it disagrees with the final paper, the tally moved between revisions.',
      ours: 'Showing OUR RECOMPUTATION, GE included — every associate-degree credit the paper’s own pathway workbook shows landing, over the degree’s own total. The paper’s carefully-counted cells equal this number exactly.',
      'ours-cs': 'Showing OUR RECOMPUTATION restricted to the university’s analyzed CS/math course list — credit applied to anything else (the GE and elective rows) is excluded. The paper’s under-counted cells fall between this floor and the GE-included rate, which is the evidence its counts mixed the two approaches.',
      auto: 'Applied associate-degree units over the associate degree’s own total, GE included — our recomputation of the Massachusetts paper’s Figure 3 measure.',
    }
    return `${sources[maSource] || sources.auto} Every cell’s hover lists all three versions.`
  }
  return scope === 'lower-division'
    ? 'Transferable and breadth requirements; university-only work is excluded.'
    : 'The complete modeled graduation plan, including upper-division and university-only work.'
}

export function EvidenceCohortControl({ verifiedOnly, onChange }) {
  return (
    <div className='flex flex-col' data-control-group='evidence'>
      <span className='field-label'>Associate-degree evidence</span>
      <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
        {EVIDENCE_COHORTS.map((item) => {
          const active = verifiedOnly === (item.value === 'verified')
          return (
            <button key={item.value} type='button' aria-pressed={active}
              onClick={() => onChange(item.value === 'verified')}
              className={`px-3 text-button border-r border-border last:border-r-0 ${
                active ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
              }`}>
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function EvidenceSummary({ verifiedOnly, collegeCount, cellCount, sourceLabel = null }) {
  return (
    <>
      <span>{sourceLabel || (verifiedOnly ? 'Verified associate-degree programs only' : 'All sourced associate-degree programs')}</span>
      <span className='text-ink-subtle'> · {intFmt.format(collegeCount)} {collegeCount === 1 ? 'college' : 'colleges'} · {intFmt.format(cellCount)} modeled {cellCount === 1 ? 'cell' : 'cells'}</span>
    </>
  )
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
  return `Associate-degree units applied once: ${buckets.map(([label, value]) => `${label} ${units(value)}`).join(' · ')} ${unitSystemName(cell.as_unit_system)}`
}

function cellTitle(row, col, cell, scope, maSource = 'auto') {
  if (!cell) return `${row.name}\n${col.school}\nNo agreement to verify against`
  const rate = rateForScope(cell, scope, maSource)
  if (!Number.isFinite(rate)) {
    return [
      row.name,
      col.school,
      methodDetail(cell) || 'Not enough curated information to model this pair',
    ].join('\n')
  }
  if (scope === MA_AS_SIDE_SCOPE) {
    const hasPublished = Number.isFinite(cell.published_as_transfer_pct)
      || Number.isFinite(cell.published_pdf_as_transfer_pct)
    return [
      row.name,
      col.school,
      `${scopeLabel(scope)}: ${pct(rate)}`,
      // All three versions ride every hover, so a difference is one glance
      // away whichever source the matrix is showing.
      hasPublished
        ? `Final paper ${pct(cell.published_pdf_as_transfer_pct)} · repo workbook ${pct(cell.published_as_transfer_pct)} · ours GE-included ${pct(cell.as_unit_utilization_pct)} (${units(cell.transferred_units)} of ${units(cell.as_total_units)} ${unitSystemName(cell.as_unit_system)}) · ours CS-only ${pct(cell.as_cs_only_utilization_pct)}`
        : `${units(cell.transferred_units)} of ${units(cell.as_total_units)} ${unitSystemName(cell.as_unit_system)} of the associate degree apply`,
      hasPublished ? null : applicationNote(cell),
      methodDetail(cell),
    ].filter(Boolean).join('\n')
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

function RateTable({ model, scope, maSource = 'auto' }) {
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
                const value = rateForScope(cell, scope, maSource)
                return (
                  <td key={col.key}
                    title={cellTitle(row, col, cell, scope, maSource)}
                    aria-label={cellTitle(row, col, cell, scope, maSource)}
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

export default function TransferCreditRate({
  majorSlug = 'cs', majorLabel = '', degreeAnalysisSlots = null,
  degreeSlotLabels = null, onMeasureChange, major = null,
}) {
  const degreeModes = useMemo(() => degreeModesForMajor({
    majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels,
  }), [majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels])
  const [degreeType, setDegreeType] = useState(() => defaultDegreeMode(degreeModes))
  const [scope, setScope] = useState('lower-division')
  // A PAPER corpus (the Massachusetts import) has exactly one source — the
  // recovered workbooks — so the California verified/unverified curation
  // cohorts do not exist there and the control disappears. It also OPENS on
  // the paper's own measure: reproducing the published figure is that tab's
  // native state, the bachelor-side scopes are ours.
  //
  // Being a state corpus is NOT the test. Virginia is state-scoped but the
  // data is ours — we gathered the requirements and equivalencies and verify
  // the associate degrees — so it keeps the full California control set. The
  // discriminator is whether an external paper publishes per-cell values to
  // compare against, which is exactly the server's own join condition
  // (`capabilities.paperBaselines && state` in transferCreditRate.js).
  const paperCorpus = Boolean(major?.state && major?.capabilities?.paperBaselines)
  const [maToggle, setMaEquivalent] = useState(paperCorpus)
  // Locked on for a paper corpus: the published measure is the figure there,
  // and the toggle to leave it is not rendered.
  const maEquivalent = paperCorpus ? true : maToggle
  // Which version of the paper's measure a paper corpus displays: the final
  // PDF as printed (default), the repo workbook's older tally, or our
  // recomputation — with a GE toggle on ours (default ON, their stated
  // method), because the paper's own counts mixed the two approaches.
  const [maSource, setMaSource] = useState('pdf')
  const [maGeOn, setMaGeOn] = useState(true)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  useEffect(() => {
    if (!degreeModes.some((mode) => mode.value === degreeType)) {
      setDegreeType(defaultDegreeMode(degreeModes))
    }
  }, [degreeModes, degreeType])
  // The MA state overlays the scope control: the same rows, the associate
  // degree's own denominator. The bachelor-side scope keeps its selection for
  // when the toggle releases.
  const activeScope = maEquivalent ? MA_AS_SIDE_SCOPE : scope
  useEffect(() => {
    onMeasureChange?.(maEquivalent
      ? TRANSFER_CREDIT_RATE_MEASURES[MA_AS_SIDE_SCOPE]
      : TRANSFER_CREDIT_RATE_MEASURES.default)
  }, [maEquivalent, onMeasureChange])
  const effectiveMaSource = maSource === 'ours' && !maGeOn ? 'ours-cs' : maSource
  const query = useTransferCreditRate(degreeType, { majorSlug, verifiedOnly })
  const rows = query.data?.rows || []
  const model = useMemo(
    () => buildRateMatrix(rows, (row) => rateForScope(row, activeScope, paperCorpus ? effectiveMaSource : 'auto')),
    [rows, activeScope, paperCorpus, effectiveMaSource]
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
      {/* The bachelor-side scopes are California modeling: the paper corpus
          publishes only the AS-side figure, and its degree docs' lower/upper
          delineation (solved from the matrix boundary) is too coarse to hang
          our completion scopes on. On a paper corpus the figure IS the
          published measure — no scope switch, no toggle-off. */}
      {!paperCorpus && (
        <div className='flex flex-col' data-control-group='scope'>
          <span className='field-label'>Requirements counted</span>
          <div className={`inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden ${maEquivalent ? 'opacity-50' : ''}`}>
            {REQUIREMENT_SCOPES.map((item) => (
              <button key={item.value} type='button' disabled={maEquivalent}
                onClick={() => setScope(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  !maEquivalent && scope === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                } ${maEquivalent ? 'cursor-not-allowed' : ''}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {!paperCorpus && (
        <div className='flex flex-col'>
          <span className='field-label'>Massachusetts comparison</span>
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
        </div>
      )}
      {paperCorpus && (
        <div className='flex flex-col' data-control-group='ma-source'>
          <span className='field-label'>Source</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {MA_SOURCES.map((item) => (
              <button key={item.value} type='button' aria-pressed={maSource === item.value}
                onClick={() => setMaSource(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  maSource === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {paperCorpus && maSource === 'ours' && (
        <div className='flex flex-col'>
          <span className='field-label'>Population</span>
          <button type='button' aria-pressed={maGeOn}
            onClick={() => setMaGeOn((v) => !v)}
            className={`h-9 px-3 rounded-lg border text-button transition-colors ${maGeOn
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border-strong bg-surface text-ink-muted hover:bg-surface-hover'}`}>
            Include GE
          </button>
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
            {maEquivalent
              ? 'MA-paper equivalent — associate-degree credit applied'
              : REQUIREMENT_SCOPES.find((item) => item.value === scope)?.label}
            <span className='text-ink-subtle'> · </span>
            <EvidenceSummary verifiedOnly={verifiedOnly}
              sourceLabel={paperCorpus ? 'Paper-source associate degrees (recovered workbooks)' : null}
              collegeCount={model.rows.length} cellCount={model.valueCount} />
          </p>
          <p className='mt-1 text-caption text-ink-muted'>{scopeDescription(activeScope, paperCorpus ? effectiveMaSource : 'auto')}</p>
          {verifiedOnly && !paperCorpus && (
            <p className='mt-1 text-caption text-ink-muted'>
              The associate-degree sources are human-verified; bachelor’s graduation templates are treated as valid for this comparison.
            </p>
          )}
        </div>
        <RateTable model={model} scope={activeScope} maSource={paperCorpus ? effectiveMaSource : 'auto'} />
        <TransferMethodNote warningCount={warningCount}>
          {maEquivalent
            ? 'The denominator is the associate degree’s own units — the Massachusetts paper’s transfer credit rate, general education included (their statewide average was 68% over pairs within 50 driving miles; this figure runs statewide). Associate-degree units are applied at most once to articulated courses, general education or breadth, and documented elective room. Blank cells lack enough curated information.'
            : 'The denominator is the receiving bachelor’s requirements, not the associate degree. The full view includes university-only upper-division work; the lower-division view excludes that tier. Associate-degree units are applied at most once to articulated courses, general education or breadth, and documented elective room. Blank cells lack enough curated information.'}
          {verifiedOnly
            ? ' This high-fidelity state limits the associate-degree side to programs marked human-verified. Other method and modeling warnings remain visible.'
            : rows.some((row) => row.source_verified !== true
              || row.source_analysis_ready === false
              || /needs[_\s-]+human[_\s-]+verification/i.test(row.degree_research_status || ''))
              && ' This all-record state is exploratory because it can include associate-degree or bachelor’s sources still awaiting review.'}
        </TransferMethodNote>
      </div>
    </Stack>
  )
}
