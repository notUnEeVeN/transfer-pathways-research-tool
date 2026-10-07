import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Stack, StatStrip } from '../components/ui'
import { useCreditLoss } from '../shared/query/hooks/useData'
import { majorLabelFor } from '../shared/majors/majorLabel'
import { AnalysisLoading, HistogramRows, shortenSchool } from './chartBits'

const METRICS = [
  { value: 'courses', label: 'Courses', field: 'min_cc_courses', binStep: 1, unit: 'courses' },
  { value: 'units', label: 'Units', field: 'min_cc_units', binStep: 2, unit: 'units' },
]

const intFmt = new Intl.NumberFormat()
const numFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const numberOrNull = (value) => (value == null || value === '' ? null
  : Number.isFinite(Number(value)) ? Number(value) : null)
const displayNumber = (value) => Number.isFinite(value) ? numFmt.format(value) : '—'

export const majorDisplayName = majorLabelFor

export function buildModel(rows, metric) {
  const bySchool = new Map()
  let maxSlot = 0
  for (const r of rows) {
    const key = String(r.school_id)
    if (!bySchool.has(key)) {
      bySchool.set(key, { key, school: r.school, values: [], courses: [], units: [], manyToOne: [], blocked: 0 })
    }
    const g = bySchool.get(key)
    const value = numberOrNull(r[metric.field])
    if (Number.isFinite(value)) g.values.push(value)
    for (const [target, source] of [['courses', 'min_cc_courses'], ['units', 'min_cc_units'], ['manyToOne', 'many_to_one']]) {
      const measured = numberOrNull(r[source])
      if (measured != null) g[target].push(measured)
    }
    if (r.receivers_blocked > 0) g.blocked += 1
    if (value != null) maxSlot = Math.max(maxSlot, Math.round(value / metric.binStep))
  }

  const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null)
  const groups = [...bySchool.values()]
    .sort((a, b) => a.school.localeCompare(b.school, undefined, { sensitivity: 'base' }))
    .map((g) => {
      const bins = {}
      const colleges = new Map() // slot → college names, for tooltips
      for (const r of rows) {
        if (String(r.school_id) !== g.key) continue
        const value = numberOrNull(r[metric.field])
        if (value == null) continue
        const slot = Math.round(value / metric.binStep)
        if (!Number.isFinite(slot)) continue
        if (!colleges.has(slot)) colleges.set(slot, [])
        colleges.get(slot).push(r.community_college)
      }
      for (const [slot, names] of colleges) {
        const unique = [...new Set(names)]
        const shown = unique.slice(0, 5).join(', ') + (unique.length > 5 ? ` +${unique.length - 5} more` : '')
        bins[slot] = {
          count: names.length,
          title: `${g.school}\n${metric.value === 'units'
            ? `${Math.max(0, (slot - 0.5) * metric.binStep)}–<${(slot + 0.5) * metric.binStep} native units`
            : `${slot * metric.binStep} ${metric.unit}`} (cheapest path): ${names.length} agreement${names.length === 1 ? '' : 's'}\n${shown}`,
        }
      }
      return {
        key: g.key,
        label: shortenSchool(g.school),
        sub: `${intFmt.format(g.values.length)} agreements`,
        bins,
        meanSlot: mean(g.values) != null ? mean(g.values) / metric.binStep : null,
        meanCourses: mean(g.courses),
        meanUnits: mean(g.units),
        meanManyToOne: mean(g.manyToOne),
        blocked: g.blocked,
        n: g.values.length,
      }
    })

  return { groups, slots: maxSlot + 2 }
}

/**
 * Credit loss — distribution of the papers' cheapest-path size (optionSolver
 * min-set) per campus: how many CC courses (or units) the cheapest complete
 * path through each agreement requires. One histogram row per campus on a
 * shared scale; hairline tick = campus mean.
 */
export default function CreditLoss({ majorSlug = 'cs', majorLabel: configuredMajorLabel = '' }) {
  const [metricValue, setMetricValue] = useState('courses')
  const metric = METRICS.find((m) => m.value === metricValue) || METRICS[0]
  const majorLabel = majorDisplayName(majorSlug, configuredMajorLabel)
  const query = useCreditLoss(
    { majorSlug },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const rows = query.data?.rows || []
  const model = useMemo(() => buildModel(rows, metric), [rows, metric])
  const datasetVersion = query.data?.dataset_version || 'unversioned'

  const meanOf = (pick) => {
    const vals = rows.map(pick).filter(Number.isFinite)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  const blockedCount = rows.filter((r) => r.receivers_blocked > 0).length
  const missingUnits = rows.filter((r) => numberOrNull(r.min_cc_units) == null).length
  const estimatedCounts = rows.filter((r) => r.method_status === 'estimated').length

  if (query.isLoading) return <AnalysisLoading />
  if (query.isError) return <Alert type='error'>Could not load the credit-loss data.</Alert>

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-center gap-3' data-export-exclude>
      <div className='flex flex-col'>
        <span className='field-label'>Metric</span>
        <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
          {METRICS.map((m) => (
            <button
              key={m.value}
              type='button'
              onClick={() => setMetricValue(m.value)}
              className={`px-3 text-button border-r border-border last:border-r-0 ${
                metric.value === m.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <Button
        variant='secondary'
        leadingIcon={ArrowPathIcon}
        loading={query.isFetching && !query.isLoading}
        onClick={() => query.refetch()}
      >
        Refresh
      </Button>
      <div className='ml-auto flex flex-wrap items-center gap-2 text-caption text-ink-subtle text-right'>
        <span className='font-mono tabular-nums'>{datasetVersion}</span>
        <span>{query.isFetching ? 'Updating' : 'Live endpoint'}</span>
      </div>
    </div>
  )

  if (!rows.length) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='No agreements in scope' description='Try a broader major filter.' className='p-8' />
      </Stack>
    )
  }

  return (
    <Stack gap='section'>
      {controls}

      <div data-export-exclude>
        <StatStrip
          tiles={[
            { label: 'Agreements', value: intFmt.format(rows.length), sub: 'from /analysis/credit-loss' },
            { label: 'Mean cheapest path', value: `${displayNumber(meanOf((r) => r.min_cc_courses))} courses`, accent: true },
            { label: 'Mean units', value: displayNumber(meanOf((r) => r.min_cc_units)) },
            { label: 'With blocked receivers', value: intFmt.format(blockedCount), sub: 'agreements missing ≥1 articulation' },
          ]}
        />
      </div>

      <div className='surface-card p-4' data-export-root>
        <p className='text-label text-ink mb-1' data-export-major>{majorLabel}</p>
        <p className='text-caption text-ink-subtle mb-3'>
          Agreements by cheapest-path {metric.unit} required, per campus
        </p>
        {missingUnits > 0 && <p className='text-caption text-ink-muted mb-3'>
          {missingUnits} of {rows.length} agreements lack complete course-unit evidence; their unit totals are omitted from means and histograms.
        </p>}
        {estimatedCounts > 0 && <p className='text-caption text-ink-muted mb-3'>
          {estimatedCounts} of {rows.length} course-count results remain estimates because course identities or the minimum-course search are unresolved.
        </p>}
        {metric.value === 'units' && <p className='text-caption text-ink-muted mb-3'>
          Units use each sending college’s native calendar. Semester and quarter units are pooled without conversion; use course counts for a comparison independent of calendar. Each bar groups a two-unit interval.
        </p>}
        <HistogramRows
          rows={model.groups}
          slots={model.slots}
          slotLabel={(i) => intFmt.format(Math.round(i * metric.binStep))}
        />
      </div>

      {/* Table twin — every charted value reachable without hover. */}
      <div className='surface-card overflow-auto' data-export-exclude>
        <table className='min-w-full border-separate border-spacing-0'>
          <thead>
            <tr>
              {['Campus', 'Agreements', 'Mean courses', 'Mean units', 'Mean many-to-one', 'Blocked'].map((h, i) => (
                <th key={h} className={`border-b border-border px-3 py-2 text-label ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.groups.map((g) => (
              <tr key={g.key} className='hover:bg-surface-hover'>
                <td className='border-b border-border px-3 py-1.5 text-caption text-ink'>{g.label}</td>
                <td className='border-b border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums'>{intFmt.format(g.n)}</td>
                <td className='border-b border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums'>{displayNumber(g.meanCourses)}</td>
                <td className='border-b border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums'>{displayNumber(g.meanUnits)}</td>
                <td className='border-b border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums'>{displayNumber(g.meanManyToOne)}</td>
                <td className='border-b border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums'>{intFmt.format(g.blocked)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}
