import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useTransferCreditRate } from '../shared/query/hooks/useData'
import { VA_CREDIT_RATE_ROWS } from './vaCreditRateRows'
import { AS_DEGREE_SLOTS, slotLabel } from '../asdegrees/asDegreeSlots'
import { majorShortLabelFor } from '../shared/majors/majorLabel'
import { createCoverageColorScale } from './CoverageHeatmap'
import ColorDomainLegend from './ColorDomainLegend'
import { TRANSFER_CREDIT_RATE_MEASURES } from './measures'
import { paperRedCellColor } from './maHeatmapColors'
import { degreeTemplateEvidenceLabel } from './templateEvidence'

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

// The MA scope is the final Massachusetts paper's Figure 3: associate-degree
// credits replacing named or GE/breadth bachelor requirements over the
// associate degree's OWN total. Unrestricted-elective-only padding is not in
// the strict Figure 3 numerator.
export const MA_AS_SIDE_SCOPE = 'ma-as-side'

// The other direction on the same rows: not how much of the associate degree
// gets used, but how much of the BACHELOR'S degree it completes. The paper
// never published this measure — it is ours, computed from their deposited
// pathway sheets — so it has no published/archived source to choose between.
// Validated directly against the raw workbooks: summing the resident
// requirement credits their transfer sheets remove gives 35.8% over the 61
// studied pathways, against 36.1% through the import pipeline.
export const MA_BACHELOR_SIDE_SCOPE = 'ma-bachelor-side'

export const MA_LENSES = [
  { value: MA_AS_SIDE_SCOPE, label: 'Associate credit used' },
  { value: MA_BACHELOR_SIDE_SCOPE, label: 'Bachelor’s completed' },
]

// Massachusetts exposes only the final paper and our direct recalculation.
// Older saved links may name superseded draft sources; normalize them to the
// direct recalculation instead of restoring draft UI.
export const MA_SOURCES = [
  { value: 'pdf', label: 'Final paper' },
  { value: 'archive-gray-detail', label: 'Our recalculation' },
]

function normalizeMaSource(source) {
  // Saved views from the previous generic reconstruction used `ours` (and a
  // GE toggle that resolved to `ours-cs`). Reopen them on the direct gray-row
  // audit source instead of silently retaining the superseded CA-style model.
  if (!source || source === 'pdf') return 'pdf'
  if (source === 'auto') return 'auto'
  return 'archive-gray-detail'
}

export function maSourceValue(row, source) {
  if (normalizeMaSource(source) === 'archive-gray-detail') {
    return row?.archive_gray_detail_as_transfer_pct
  }
  return row?.published_pdf_as_transfer_pct
}

export function rateForScope(row, scope, maSource = 'auto') {
  // Ours on both corpora, so it reads the same field California does — that
  // sameness is the point of putting it beside the paper's own measure.
  if (scope === MA_BACHELOR_SIDE_SCOPE) return row?.full_degree_completion_pct
  if (scope === MA_AS_SIDE_SCOPE) {
    if (maSource === 'auto') {
      // No explicit selection (California's comparison lens): published values
      // do not exist there, so this resolves to our recomputation.
      return row?.published_pdf_as_transfer_pct
        ?? row?.published_as_transfer_pct
        ?? row?.paper_equivalent_as_unit_utilization_pct
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
  if (scope === MA_BACHELOR_SIDE_SCOPE) return 'Bachelor’s requirements completed by the associate degree'
  if (scope === MA_AS_SIDE_SCOPE) return 'Associate-degree credit applied (MA-paper equivalent)'
  return scope === 'lower-division'
    ? 'Lower-division requirements fulfilled'
    : 'Bachelor’s requirements fulfilled'
}

function scopeDescription(scope, maSource = 'auto') {
  if (scope === MA_BACHELOR_SIDE_SCOPE) {
    return 'Share of the bachelor’s degree the associate degree completes: resident requirement credits the transfer pathway removes, over the resident degree total. Ours, not a measure the paper published — the same statistic California shows.'
  }
  if (scope === MA_AS_SIDE_SCOPE) {
    const sources = {
      pdf: 'Showing the FINAL PAPER’s Figure 3 as printed. Blank cells are pairs the paper did not study.',
      'archive-gray-detail': 'Showing OUR RECALCULATION from the authors’ released course-plan data: applicable credits divided by the cleaned associate-degree total. Unrestricted-elective-only credit is excluded and the numerator is not capped. The 61-cell mean is 64.68%; 42 cells reproduce the final paper at its printed precision.',
      auto: 'Named articulation plus actual GE/breadth credit over the associate degree’s own total. Unrestricted-elective-only capacity is excluded, matching the Massachusetts Figure 3 rule.',
    }
    return `${sources[normalizeMaSource(maSource)] || sources.auto} Every Massachusetts cell’s hover compares the final-paper value with our recalculation.`
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

export function EvidenceSummary({
  verifiedOnly, collegeCount, cellCount, sourceLabel = null, cellKind = 'modeled',
}) {
  return (
    <>
      <span>{sourceLabel || (verifiedOnly ? 'Verified associate-degree programs only' : 'All sourced associate-degree programs')}</span>
      <span className='text-ink-subtle'> · {intFmt.format(collegeCount)} {collegeCount === 1 ? 'college' : 'colleges'} · {intFmt.format(cellCount)} {cellKind} {cellCount === 1 ? 'cell' : 'cells'}</span>
    </>
  )
}

/** Evidence debt and exclusions shared by Figures 3–5. */
export function TransferEvidenceCaveats({ rows = [], majorSlug = null }) {
  const templates = new Map()
  for (const row of rows) {
    const key = String(row.school_id ?? row.school ?? '')
    if (key && !templates.has(key)) templates.set(key, row)
  }
  const templateRows = [...templates.values()]
  const carriesTemplateEvidence = templateRows.some((row) => (
    typeof row.degree_template_verified === 'boolean'
  ))
  const verifiedTemplates = templateRows.filter((row) => row.degree_template_verified === true)
  const staleStatuses = templateRows.filter((row) => row.degree_template_status_conflict === true)
  const catalogYears = [...new Set(templateRows
    .map((row) => String(row.degree_catalog_year || '').trim().replace(/^2025-2026$/, '2025-26'))
    .filter(Boolean))].sort()
  const excluded = rows.filter((row) => row.method_status === 'excluded')
  const excludedColleges = [...new Set(excluded.map((row) => row.college_name).filter(Boolean))].sort()
  const modeled = rows.filter((row) => Number.isFinite(row.as_unit_utilization_pct))
  const assumptionCells = majorSlug === 'econ'
    ? modeled.filter((row) => Number(row.ge_assumed_units) > 0
      || Number(row.elective_counted_units) > 0)
    : []

  if (!carriesTemplateEvidence && !excluded.length && !assumptionCells.length) return null
  return (
    <div className='mt-1 space-y-1 text-caption text-ink-muted'>
      {carriesTemplateEvidence && (
        <p>
          Bachelor templates: {intFmt.format(verifiedTemplates.length)}/{intFmt.format(templateRows.length)} carry explicit verification records
          {catalogYears.length ? ` · catalog years ${catalogYears.join(' and ')}` : ''}.
          {staleStatuses.length > 0
            ? ` ${intFmt.format(staleStatuses.length)} retain stale pre-verification research-status text; the explicit verification records are authoritative.`
            : ''}
        </p>
      )}
      {excluded.length > 0 && (
        <p className='text-warning'>
          {intFmt.format(excluded.length)} college×campus {excluded.length === 1 ? 'cell is' : 'cells are'} excluded from the modeled distribution because the stored degree choice cannot be resolved
          {excludedColleges.length ? ` (${excludedColleges.join(', ')})` : ''}; excluded cells remain blank.
        </p>
      )}
      {assumptionCells.length > 0 && (
        <p className='text-warning'>
          {intFmt.format(assumptionCells.length)} of {intFmt.format(modeled.length)} modeled Economics cells apply assumed GE and/or elective capacity. A 100% utilization cell therefore does not mean every course has a direct articulation.
        </p>
      )}
    </div>
  )
}

// Shared by the Fig. 3 (rate) and Fig. 4 (extra units) cards — `getValue`
// picks the measure; `makeScale` its color domain.
/**
 * A choice control where the SELECTED option is the highlighted one. A single
 * button whose label flips between states cannot say whether it is showing what
 * is selected or what clicking would do.
 */
export function SegmentedChoice({ label, value, options, onChange }) {
  return (
    <div className='flex flex-col'>
      <span className='field-label'>{label}</span>
      <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'
        role='group' aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type='button'
              aria-pressed={selected}
              title={option.hint || undefined}
              onClick={() => onChange(option.value)}
              className={`px-3 text-button border-r border-border last:border-r-0 transition-colors ${
                selected
                  ? 'bg-primary text-on-primary font-medium'
                  : 'text-ink-muted hover:bg-surface-hover'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

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

function paperEquivalentApplicationNote(cell) {
  const buckets = [
    ['named requirements', cell.named_transferred_units],
    ['actual GE and breadth', cell.ge_counted_units],
  ].filter(([, value]) => Number.isFinite(value))
  if (!buckets.length) return null
  const excluded = Number.isFinite(cell.elective_counted_units)
    ? ` · unrestricted-elective-only capacity excluded ${units(cell.elective_counted_units)}`
    : ''
  return `Strict Figure 3 numerator: ${buckets.map(([label, value]) => `${label} ${units(value)}`).join(' · ')}${excluded} ${unitSystemName(cell.as_unit_system)}`
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
    const hasPublished = Number.isFinite(cell.published_pdf_as_transfer_pct)
      || Number.isFinite(cell.archive_gray_detail_as_transfer_pct)
    return [
      row.name,
      col.school,
      `${scopeLabel(scope)}: ${pct(rate)}`,
      hasPublished
        ? `Final paper ${pct(cell.published_pdf_as_transfer_pct)} · our recalculation ${pct(cell.archive_gray_detail_as_transfer_pct)} (${units(cell.archive_gray_detail_numerator_units)} applicable of ${units(cell.archive_gray_detail_denominator_units)} associate-degree units; ${units(cell.archive_gray_detail_blue_units_excluded)} unrestricted-elective-only units excluded; no cap)`
        : `${units(cell.paper_equivalent_transferred_units)} of ${units(cell.as_total_units)} ${unitSystemName(cell.as_unit_system)} of the associate degree replace named or GE/breadth requirements`,
      hasPublished ? null : paperEquivalentApplicationNote(cell),
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

/** Resolve the exact controls used by the mounted Figure 3. */
export function transferCreditViewForPane(pane = {}, major = null) {
  const modes = degreeModesForMajor({
    majorSlug: pane.major,
    majorLabel: major?.label || '',
    degreeAnalysisSlots: major?.degreeAnalysisSlots,
    degreeSlotLabels: major?.degreeSlotLabels,
  })
  const requestedDegree = pane.knobs?.degree
  const degreeType = modes.some((mode) => mode.value === requestedDegree)
    ? requestedDegree : defaultDegreeMode(modes)
  const paperCorpus = Boolean(major?.state && major?.capabilities?.paperBaselines)
  const maEquivalent = paperCorpus || pane.knobs?.['ma-equivalent'] !== false
  // On a paper corpus the reader picks the direction: the paper's own AS-side
  // measure, or the bachelor-side one California shows.
  const maLens = paperCorpus && pane.knobs?.lens === MA_BACHELOR_SIDE_SCOPE
    ? MA_BACHELOR_SIDE_SCOPE : MA_AS_SIDE_SCOPE
  const scope = maEquivalent ? maLens : (pane.knobs?.scope || 'lower-division')
  // The bachelor-side measure is ours on both corpora, so it carries no
  // published-versus-archived choice — and reporting one would wrongly imply
  // the paper printed a value to compare against.
  const source = paperCorpus && scope === MA_AS_SIDE_SCOPE
    ? normalizeMaSource(pane.knobs?.source || 'pdf') : 'auto'
  const includeGe = pane.knobs?.ge !== false
  const effectiveSource = source
  return {
    degreeType,
    verifiedOnly: !paperCorpus && pane.knobs?.verified !== false,
    paperCorpus,
    maEquivalent,
    scope,
    source,
    effectiveSource,
    includeGe,
  }
}

export function transferCreditComparisonCells(data, pane, major) {
  const view = transferCreditViewForPane(pane, major)
  const source = view.paperCorpus ? view.effectiveSource : 'auto'
  const model = buildRateMatrix(data?.rows || [], (row) => rateForScope(row, view.scope, source))
  return model.rows.flatMap((row) => model.columns.map((column) => ({
    rowKey: row.key,
    rowLabel: row.name,
    colKey: column.key,
    colLabel: column.school,
    value: model.cellValue(row.key, column.key),
  })))
}

export function transferCreditComparisonContract(pane, major) {
  const view = transferCreditViewForPane(pane, major)
  const asSide = view.scope === MA_AS_SIDE_SCOPE
  const sourceLabels = {
    pdf: 'final MA PDF transcription',
    'archive-gray-detail': 'our direct recalculation from the authors’ course-plan data',
    auto: 'curated named articulation + actual GE/breadth model',
  }
  return {
    measure: asSide ? 'associate-degree-credit-utilization' : 'bachelor-requirement-completion',
    unit: 'percentage points',
    grain: 'community college × university campus',
    keys: { rows: 'community college', columns: 'university campus' },
    semantics: asSide ? {
      numerator: view.source === 'archive-gray-detail'
        ? 'applicable credit in the authors’ released course-plan data'
        : 'associate-degree credit replacing named or GE/breadth bachelor requirements',
      denominator: 'associate-degree total credit',
      ge: 'counts only when it satisfies an actual bachelor GE/breadth requirement',
      unrestricted_elective_capacity: false,
      weighting: 'each studied college × campus pathway equally',
    } : {
      numerator: 'fulfilled bachelor requirement units',
      denominator: view.scope === 'lower-division'
        ? 'lower-division bachelor requirement units' : 'all bachelor requirement units',
      ge: true,
      weighting: 'each modeled college × campus pathway equally',
    },
    context: {
      source: sourceLabels[view.source] || view.source,
      cohort: `${major?.label || pane.major} · ${view.degreeType}${view.verifiedOnly ? ' · verified only' : ''}`,
      bachelor_template_evidence: degreeTemplateEvidenceLabel(major),
      scope: view.scope,
      display_scale: 'adaptive per pane in gallery; fixed 0–100 and shared across panes in Comparison',
    },
  }
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
  degreeSlotLabels = null, onMeasureChange, onViewChange, major = null,
  defaultDegreeType = null, defaultScope = 'lower-division',
  defaultMaEquivalent = true, defaultMaSource = 'pdf', defaultMaGeOn = true,
  defaultMaLens = MA_AS_SIDE_SCOPE,
  defaultVerifiedOnly = true, comparisonColorScale = null,
}) {
  const degreeModes = useMemo(() => degreeModesForMajor({
    majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels,
  }), [majorSlug, majorLabel, degreeAnalysisSlots, degreeSlotLabels])
  // The opening cohort is major-specific (A.S.-T only where the major has
  // one), so the seed overrides it only when a view actually pinned a slot.
  const [degreeType, setDegreeType] = useState(() => defaultDegreeType ?? defaultDegreeMode(degreeModes))
  const [scope, setScope] = useState(defaultScope)
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
  const [maToggle, setMaEquivalent] = useState(defaultMaEquivalent)
  // Locked on for a paper corpus: the published measure is the figure there,
  // and the toggle to leave it is not rendered.
  const maEquivalent = paperCorpus ? true : maToggle
  // Which version of the paper's measure a paper corpus displays: the final
  // PDF as printed (default), or our direct recalculation. A mismatch is a
  // potential error or unexplained input revision until final inputs exist.
  const [maSource, setMaSource] = useState(() => normalizeMaSource(defaultMaSource))
  // Which direction the paper corpus measures in. Opens on the paper's own
  // measure — reproducing the published figure is this tab's native state.
  const [maLens, setMaLens] = useState(() => (
    defaultMaLens === MA_BACHELOR_SIDE_SCOPE ? MA_BACHELOR_SIDE_SCOPE : MA_AS_SIDE_SCOPE
  ))
  // Retained only so old saved-view payloads remain schema-compatible. The
  // direct gray-row source has one fixed rule and no longer exposes a GE knob.
  const [maGeOn] = useState(defaultMaGeOn)
  const [verifiedOnly, setVerifiedOnly] = useState(defaultVerifiedOnly)
  useEffect(() => {
    if (!degreeModes.some((mode) => mode.value === degreeType)) {
      setDegreeType(defaultDegreeMode(degreeModes))
    }
  }, [degreeModes, degreeType])
  // The MA state overlays the scope control: the same rows, the associate
  // degree's own denominator. The bachelor-side scope keeps its selection for
  // when the toggle releases.
  const activeScope = maEquivalent ? (paperCorpus ? maLens : MA_AS_SIDE_SCOPE) : scope
  useEffect(() => {
    onMeasureChange?.(maEquivalent
      ? TRANSFER_CREDIT_RATE_MEASURES[activeScope] || TRANSFER_CREDIT_RATE_MEASURES[MA_AS_SIDE_SCOPE]
      : TRANSFER_CREDIT_RATE_MEASURES.default)
  }, [maEquivalent, activeScope, onMeasureChange])
  // What a pinned view saves is the reader's own selection: `maToggle`, not
  // `maEquivalent`, because the latter is forced on for a paper corpus and
  // reopening on a forced value would credit the reader with a choice the
  // figure made. Legacy `ours` source values are normalized above to the new
  // direct `archive-gray-detail` source.
  useEffect(() => {
    onViewChange?.({
      defaultDegreeType: degreeType,
      defaultScope: scope,
      defaultVerifiedOnly: verifiedOnly,
      defaultMaEquivalent: maToggle,
      defaultMaSource: maSource,
      defaultMaGeOn: maGeOn,
      defaultMaLens: maLens,
    })
  }, [degreeType, scope, verifiedOnly, maToggle, maSource, maGeOn, maLens, onViewChange])
  const effectiveMaSource = normalizeMaSource(maSource)
  // Catalogue membership is what a college publishes; scheduled is what it is
  // currently running. The guides are identical for every college, so supply is
  // the only thing that separates two rows.
  const [vaBasis, setVaBasis] = useState('catalog')
  // The seven VCCS colleges with no computer-science associate degree can still
  // teach the courses a guide names; off by default because the pathway does
  // not formally exist there.
  const [vaAllColleges, setVaAllColleges] = useState(false)

  // Virginia is measured from published transfer guides rather than from the
  // corpus this endpoint evaluates: a college that cannot teach a course its
  // guide names sends the student to a substitute, and that substitute arrives
  // as credit the bachelor's applies to nothing. The rows are pre-shaped
  // exactly like the endpoint's, so everything below is identical for all three
  // states and the scales stay comparable.
  const vaRateRows = majorSlug === 'va-cs' ? VA_CREDIT_RATE_ROWS : null
  const vaRateKey = `${vaBasis}${vaAllColleges ? '_all' : ''}`
  const query = useTransferCreditRate(degreeType, {
    majorSlug,
    verifiedOnly: paperCorpus ? false : verifiedOnly,
    // Only Virginia short-circuits the request; adding `enabled` unconditionally
    // would change the call every other corpus makes.
    ...(vaRateRows ? { enabled: false } : {}),
  })
  const rows = vaRateRows ? vaRateRows[vaRateKey].rows : (query.data?.rows || [])
  const localModel = useMemo(
    () => buildRateMatrix(rows, (row) => rateForScope(row, activeScope, paperCorpus ? effectiveMaSource : 'auto')),
    [rows, activeScope, paperCorpus, effectiveMaSource]
  )
  const model = useMemo(() => (
    Number.isFinite(comparisonColorScale?.min) && Number.isFinite(comparisonColorScale?.max)
      ? { ...localModel, colorScale: comparisonColorScale }
      : localModel
  ), [localModel, comparisonColorScale])

  if (!vaRateRows && query.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (!vaRateRows && query.isError) {
    return <Alert type='error'>Could not load bachelor’s requirement completion.</Alert>
  }

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
      {vaRateRows && (
        <SegmentedChoice
          label='Course supply'
          value={vaBasis}
          onChange={setVaBasis}
          options={[
            { value: 'catalog', label: 'In the catalogue', hint: 'Courses the college publishes' },
            { value: 'scheduled', label: 'Currently scheduled', hint: 'Courses the college is running now' },
          ]}
        />
      )}
      {vaRateRows && (
        <SegmentedChoice
          label='Colleges'
          value={vaAllColleges ? 'all' : 'cs'}
          onChange={(v) => setVaAllColleges(v === 'all')}
          options={[
            { value: 'cs', label: 'With a CS degree', hint: 'The 16 publishing a computer-science associate degree' },
            { value: 'all', label: 'All 23', hint: 'Every VCCS college' },
          ]}
        />
      )}
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
        <div className='flex flex-col' data-control-group='ma-lens'>
          <span className='field-label'>Measure</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {MA_LENSES.map((item) => (
              <button key={item.value} type='button' aria-pressed={maLens === item.value}
                onClick={() => setMaLens(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  maLens === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {paperCorpus && (
        <div className='flex flex-col' data-control-group='ma-source'>
          <span className='field-label'>Source</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {MA_SOURCES.map((item) => (
              <button key={item.value} type='button' aria-pressed={maSource === item.value}
                onClick={() => setMaSource(item.value)}
                disabled={maLens === MA_BACHELOR_SIDE_SCOPE}
                title={maLens === MA_BACHELOR_SIDE_SCOPE
                  ? 'The paper never published this measure, so there is no published version to compare against.'
                  : undefined}
                className={`px-3 text-button border-r border-border last:border-r-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  maSource === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
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
                ? (effectiveMaSource === 'pdf'
                  ? 'Final PDF Figure 3 (reported pairs only)'
                  : 'Our recalculation from the authors’ course-plan data')
                : null}
              cellKind={paperCorpus
                ? (effectiveMaSource === 'pdf' ? 'reported' : 'recomputed')
                : 'modeled'}
              collegeCount={model.rows.length} cellCount={model.valueCount} />
          </p>
          {!paperCorpus && <TransferEvidenceCaveats rows={rows} majorSlug={majorSlug} />}
        </div>
        <ColorDomainLegend scale={model.colorScale} formatValue={pct} />
        <RateTable model={model} scope={activeScope} maSource={paperCorpus ? effectiveMaSource : 'auto'} />
      </div>
    </Stack>
  )
}

// The props a pinned view may seed. Every `viewKnobs` entry on the registry
// must name one of these; the contract test fails the build otherwise.
TransferCreditRate.viewProps = [
  'defaultDegreeType', 'defaultScope', 'defaultVerifiedOnly',
  'defaultMaEquivalent', 'defaultMaSource', 'defaultMaGeOn', 'defaultMaLens',
]
