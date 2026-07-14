import React, { useDeferredValue, useMemo, useState } from 'react'
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Input, Stack, StatStrip } from '../components/ui'
import { useComplexity } from '../shared/query/hooks/useData'
import { AnalysisLoading, HistogramRows, shortenSchool } from './chartBits'

const DEFAULT_MAJOR_FILTER = 'computer science'
const METRICS = [
  { value: 'complexity', label: 'Complexity', field: 'complexity', unit: 'complexity score' },
  { value: 'delay', label: 'Max delay', field: 'max_delay', unit: 'longest prereq chain' },
]

const intFmt = new Intl.NumberFormat()
const numFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

// Bin width targeting ≤ ~24 slots whatever the score range grows to.
function niceStep(maxValue) {
  for (const step of [1, 2, 5, 10, 20, 50, 100]) {
    if (maxValue / step <= 24) return step
  }
  return 200
}

function buildModel(rows, metric) {
  const values = rows.map((r) => Number(r[metric.field])).filter(Number.isFinite)
  const binStep = niceStep(Math.max(1, ...values))
  const bySchool = new Map()
  for (const r of rows) {
    const key = String(r.school_id)
    if (!bySchool.has(key)) bySchool.set(key, { key, school: r.school, rows: [] })
    bySchool.get(key).rows.push(r)
  }
  let maxSlot = 0
  const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null)
  const groups = [...bySchool.values()]
    .sort((a, b) => a.school.localeCompare(b.school, undefined, { sensitivity: 'base' }))
    .map((g) => {
      const bins = {}
      const slotColleges = new Map()
      const groupValues = []
      for (const r of g.rows) {
        const value = Number(r[metric.field])
        if (!Number.isFinite(value)) continue
        groupValues.push(value)
        const slot = Math.round(value / binStep)
        maxSlot = Math.max(maxSlot, slot)
        if (!slotColleges.has(slot)) slotColleges.set(slot, [])
        slotColleges.get(slot).push(r.community_college)
      }
      for (const [slot, names] of slotColleges) {
        const unique = [...new Set(names)]
        const shown = unique.slice(0, 5).join(', ') + (unique.length > 5 ? ` +${unique.length - 5} more` : '')
        bins[slot] = {
          count: names.length,
          title: `${g.school}\n${metric.unit} ≈ ${slot * binStep}: ${names.length} agreement${names.length === 1 ? '' : 's'}\n${shown}`,
        }
      }
      const m = mean(groupValues)
      return {
        key: g.key,
        label: shortenSchool(g.school),
        sub: `${intFmt.format(groupValues.length)} agreements`,
        bins,
        meanSlot: m != null ? m / binStep : null,
      }
    })
  return { groups, slots: maxSlot + 2, binStep }
}

/**
 * Curricular complexity — Curricular Analytics-style delay + blocking scores
 * of each agreement's cheapest pathway over the curated prerequisite graph
 * (curated_prerequisites). Coverage matters: with no prerequisite edges, every
 * course scores delay 1 / blocking 0 and "complexity" collapses to the course
 * count — the banner keeps that caveat in front of the reader.
 */
export default function Complexity() {
  const [majorFilter, setMajorFilter] = useState(DEFAULT_MAJOR_FILTER)
  const [metricValue, setMetricValue] = useState('complexity')
  const metric = METRICS.find((m) => m.value === metricValue) || METRICS[0]
  const deferredMajorFilter = useDeferredValue(majorFilter)
  const query = useComplexity(
    { majorContains: deferredMajorFilter },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const rows = query.data?.rows || []
  const model = useMemo(() => buildModel(rows, metric), [rows, metric])
  const datasetVersion = query.data?.dataset_version || 'unversioned'

  const meanOf = (pick) => {
    const vals = rows.map(pick).filter(Number.isFinite)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  const prereqCoverage = meanOf((r) => r.prereq_data_coverage_pct)
  const noPrereqData = !Number.isFinite(prereqCoverage) || prereqCoverage === 0

  if (query.isLoading) return <AnalysisLoading />
  if (query.isError) return <Alert type='error'>Could not load the complexity data.</Alert>

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-center gap-3' data-export-exclude>
      <Input
        label='Major filter'
        value={majorFilter}
        onChange={(e) => setMajorFilter(e.target.value)}
        placeholder='computer science'
        leadingIcon={MagnifyingGlassIcon}
        className='w-80 max-w-full'
      />
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

      <div data-export-root className='flex flex-col gap-6'>
        {noPrereqData && (
          <div>
            <Alert type='warning'>
              No prerequisite data has been curated yet, so
              every course scores delay 1 and blocking 0 — complexity currently equals
              the pathway's course count. Import or curate CC prerequisite chains to
              make these scores meaningful.
            </Alert>
          </div>
        )}

        <div data-export-exclude>
          <StatStrip
            tiles={[
              { label: 'Agreements', value: intFmt.format(rows.length), sub: 'from /analysis/complexity' },
              { label: 'Mean complexity', value: numFmt.format(meanOf((r) => r.complexity)), accent: true },
              { label: 'Mean max delay', value: numFmt.format(meanOf((r) => r.max_delay)), sub: 'longest prereq chain' },
              { label: 'Prereq data coverage', value: Number.isFinite(prereqCoverage) ? `${pctFmt.format(prereqCoverage)}%` : '0%', sub: 'of pathway courses with curated prereqs' },
            ]}
          />
        </div>

        <div className='surface-card p-4'>
          <p className='text-caption text-ink-subtle mb-3'>
            Agreements by pathway {metric.unit}, per campus
            {model.binStep > 1 && <span className='font-mono'> (bins of {model.binStep})</span>}
          </p>
          <HistogramRows
            rows={model.groups}
            slots={model.slots}
            slotLabel={(i) => intFmt.format(Math.round(i * model.binStep))}
          />
        </div>
      </div>
    </Stack>
  )
}
