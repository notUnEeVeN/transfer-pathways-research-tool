import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Stack, StatStrip } from '../components/ui'
import { useTimeToDegree } from '../shared/query/hooks/useData'
import { AnalysisLoading, shortenSchool } from './chartBits'
import MajorPicker from '../shared/majors/MajorPicker'
import { useMajorSelection } from '../shared/majors/MajorContext'


const intFmt = new Intl.NumberFormat()
const numFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const usdFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/**
 * Time to degree — the MA paper's transfer-credit-rate lens over curated
 * associate degrees: how many ADT units actually count toward each matching
 * agreement's cheapest path, what's lost, and (with institution tuition) what
 * the loss costs. One meter row per degree × agreement, worst rate first.
 */
export default function TimeToDegree() {
  const { slug: majorSlug, setSlug } = useMajorSelection()
  const query = useTimeToDegree(
    { majorSlug },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const rows = query.data?.rows || []
  const datasetVersion = query.data?.dataset_version || 'unversioned'

  const sorted = useMemo(
    () => rows.slice().sort((a, b) => (a.transfer_credit_rate_pct ?? 101) - (b.transfer_credit_rate_pct ?? 101)),
    [rows]
  )
  const meanOf = (pick) => {
    const vals = rows.map(pick).filter(Number.isFinite)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }
  const costs = rows.map((r) => Number(r.est_lost_cost_usd)).filter(Number.isFinite)
  const hasCosts = costs.length > 0

  if (query.isLoading) return <AnalysisLoading />
  if (query.isError) return <Alert type='error'>Could not load the time-to-degree data.</Alert>

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-center gap-3' data-export-exclude>
      <MajorPicker value={majorSlug} onChange={setSlug} className='w-60 max-w-full' />
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
        <EmptyState
          card
          className='p-8'
          title='No associate degrees curated yet'
          description='This analysis compares curated associate-degree course lists against each matching agreement. Add degrees through the curated data API and per-credit tuition to university institution profiles; matching rows then appear automatically.'
        />
      </Stack>
    )
  }

  return (
    <Stack gap='section'>
      {controls}

      <div data-export-exclude>
        <StatStrip
          tiles={[
            { label: 'Degree × agreement pairs', value: intFmt.format(rows.length), sub: 'from /analysis/time-to-degree' },
            { label: 'Mean transfer credit rate', value: `${pctFmt.format(meanOf((r) => r.transfer_credit_rate_pct) ?? 0)}%`, accent: true },
            { label: 'Mean lost units', value: numFmt.format(meanOf((r) => r.lost_units)) },
            ...(hasCosts
              ? [{ label: 'Mean est. lost cost', value: usdFmt.format(meanOf((r) => r.est_lost_cost_usd)) }]
              : [{ label: 'Est. lost cost', value: '—', sub: 'add institution tuition to cost the loss' }]),
          ]}
        />
      </div>

      <div className='surface-card p-4' data-export-root>
        <p className='text-caption text-ink-subtle mb-3'>
          Share of associate-degree units counting toward the agreement's cheapest path — lowest first
        </p>
        <div className='max-h-[28rem] overflow-y-auto pr-1'>
          {sorted.map((r, i) => {
            const rate = Number(r.transfer_credit_rate_pct)
            const title = [
              `${r.community_college} → ${r.school}`,
              `${r.assoc_degree} · ${r.major}`,
              `${numFmt.format(r.transferable_units)} of ${numFmt.format(r.assoc_degree_units)} units transfer (${pctFmt.format(rate)}%)`,
              `${numFmt.format(r.lost_units)} units lost${Number.isFinite(r.est_lost_cost_usd) ? ` ≈ ${usdFmt.format(r.est_lost_cost_usd)}` : ''}`,
            ].join('\n')
            return (
              <div key={`${r.community_college_id}|${r.school_id}|${r.assoc_degree}|${i}`} className='flex items-center gap-3 py-1'>
                <div className='w-64 shrink-0 min-w-0'>
                  <span className='block truncate text-caption text-ink' title={`${r.community_college} → ${r.school}`}>
                    {r.community_college} → {shortenSchool(r.school)}
                  </span>
                  <span className='block truncate text-tag text-ink-subtle' title={r.assoc_degree}>{r.assoc_degree}</span>
                </div>
                <div className='flex-1 h-3 rounded-pill bg-primary-soft' title={title} aria-label={title}>
                  <div
                    className='h-full rounded-pill bg-primary transition-opacity hover:opacity-75'
                    style={{ width: `${Math.max(0, Math.min(100, rate))}%` }}
                  />
                </div>
                <span className='w-14 shrink-0 text-right text-caption font-mono tabular-nums text-ink'>
                  {Number.isFinite(rate) ? `${pctFmt.format(rate)}%` : '-'}
                </span>
                <span className='w-28 shrink-0 text-right text-tag text-ink-subtle font-mono tabular-nums'>
                  {numFmt.format(r.lost_units)} lost{Number.isFinite(r.est_lost_cost_usd) ? ` · ${usdFmt.format(r.est_lost_cost_usd)}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Stack>
  )
}
