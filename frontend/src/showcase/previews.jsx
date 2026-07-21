/**
 * Hand-drawn frozen previews for the showcase stage.
 *
 * These render instantly and never read the API, so they double as the
 * fallback shown when an account has no release for the related live visual.
 */

import React from 'react'
import { Badge } from '../components/ui'

const COMPLETE_PATHS_BY_CAMPUS = [
  { campus: 'Berkeley', districts: 69 },
  { campus: 'Merced', districts: 64 },
  { campus: 'Riverside', districts: 57 },
  { campus: 'Santa Barbara', districts: 50 },
  { campus: 'Santa Cruz', districts: 47 },
  { campus: 'Irvine', districts: 39 },
  { campus: 'Davis', districts: 30 },
  { campus: 'San Diego', districts: 0 },
  { campus: 'Los Angeles', districts: 0 },
]

function EvidenceBadge({ status }) {
  const variant = status === 'Audited' ? 'success' : 'conservative'
  return <Badge variant={variant}>{status}</Badge>
}

function CompletePathsPreview() {
  return (
    <div className='grid h-full grid-cols-[minmax(0,1fr)_190px] items-center gap-8' role='img'
      aria-label='Complete community college district paths by UC campus, ranging from 69 districts at Berkeley to none at San Diego and Los Angeles'>
      <div className='rounded-2xl border border-border bg-surface px-6 py-5'>
        <div className='flex items-end justify-between gap-4 border-b border-border pb-4'>
          <div>
            <p className='text-body-strong'>Districts with a complete path</p>
            <p className='mt-1 text-caption'>Current required ASSIST groups for each selected program.</p>
          </div>
          <span className='text-tag text-ink-subtle'>out of 72</span>
        </div>
        <div className='mt-4 flex flex-col gap-2.5'>
          {COMPLETE_PATHS_BY_CAMPUS.map((row) => (
            <div key={row.campus} className='grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-3'>
              <span className='truncate text-caption text-ink-muted'>{row.campus}</span>
              <div className='h-3 overflow-hidden rounded-pill bg-surface-sunken'>
                <div className={`h-full rounded-pill ${row.districts ? 'bg-primary' : 'bg-danger'}`}
                  style={{ width: row.districts ? `${(row.districts / 72) * 100}%` : '3px' }} />
              </div>
              <span className='text-right text-tag text-ink-muted'>{row.districts}</span>
            </div>
          ))}
        </div>
      </div>
      <div className='flex flex-col gap-4'>
        <div className='rounded-2xl bg-primary-soft px-5 py-6 text-center'>
          <p className='text-display-lg text-primary'>5</p>
          <p className='mt-2 text-body-strong'>campuses for a typical district</p>
        </div>
        <div className='rounded-2xl bg-surface-muted px-5 py-5 text-center'>
          <p className='text-stat-lg'>356 of 648</p>
          <p className='mt-2 text-caption'>district and campus paths are complete</p>
        </div>
      </div>
    </div>
  )
}

function RequirementCoveragePreview() {
  return (
    <div className='flex h-full flex-col justify-center rounded-2xl border border-border bg-surface px-8 py-7'
      role='img' aria-label='Potential graduation-unit coverage divides modeled UC graduation units with a community-college equivalent by all modeled graduation units'>
      <div className='flex items-end justify-between gap-5'>
        <div>
          <p className='text-body-strong'>Potential graduation-unit coverage</p>
          <p className='mt-1 text-caption'>Across 115 colleges and nine selected UC programs.</p>
        </div>
        <Badge variant='conservative'>Live measure</Badge>
      </div>
      <div className='mt-8 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-4 text-center'>
        <div className='rounded-2xl bg-primary-soft px-5 py-6'>
          <p className='text-body-strong text-primary'>Modeled units with an equivalent</p>
          <p className='mt-2 text-caption'>Courses available before transfer</p>
        </div>
        <div className='grid place-items-center text-display-lg text-ink-subtle'>÷</div>
        <div className='rounded-2xl bg-surface-muted px-5 py-6'>
          <p className='text-body-strong'>All modeled graduation units</p>
          <p className='mt-2 text-caption'>The complete UC graduation plan</p>
        </div>
      </div>
      <div className='mt-7 grid grid-cols-2 gap-3 border-t border-border pt-5 text-caption text-ink-muted'>
        <p className='rounded-xl bg-success-soft p-4'>Each UC plan stays in its native quarter or semester units.</p>
        <p className='rounded-xl bg-surface-muted p-4'>Requirement slots remain available as secondary context.</p>
      </div>
    </div>
  )
}

function PairedDegreePreview() {
  const rows = [
    { label: 'Local computer science degree', rate: 62.6, extra: '22.4 replacement units' },
    { label: 'Associate Degree for Transfer', rate: 74.6, extra: '15.3 replacement units' },
  ]
  return (
    <div className='flex h-full flex-col justify-center rounded-2xl border border-border bg-surface px-8 py-7'
      role='img' aria-label='In 19 matched semester-system colleges, local degrees average 62.6 percent alignment and transfer degrees average 74.6 percent'>
      <div className='flex items-end justify-between gap-5'>
        <div>
          <p className='text-body-strong'>Matched degree comparison</p>
          <p className='mt-1 text-caption'>The same 19 semester-system colleges and the same nine UC programs.</p>
        </div>
        <Badge variant='conservative'>Descriptive result</Badge>
      </div>
      <div className='mt-8 flex flex-col gap-7'>
        {rows.map((row) => (
          <div key={row.label}>
            <div className='mb-2 flex items-end justify-between gap-4'>
              <div>
                <p className='text-body-strong'>{row.label}</p>
                <p className='text-caption'>{row.extra} in the working model</p>
              </div>
              <p className='text-stat-lg'>{row.rate.toFixed(1)}%</p>
            </div>
            <div className='h-5 overflow-hidden rounded-pill bg-surface-sunken'>
              <div className='h-full rounded-pill bg-primary' style={{ width: `${row.rate}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className='mt-7 flex items-center justify-between gap-5 border-t border-border pt-5'>
        <p className='text-caption text-ink-muted'>The transfer degree is higher in 131 of 189 matched campus comparisons.</p>
        <p className='shrink-0 text-body-strong text-success'>9.2 fewer semester units</p>
      </div>
    </div>
  )
}

function VisualPreview({ kind }) {
  if (kind === 'complete-paths') return <CompletePathsPreview />
  if (kind === 'requirement-coverage') return <RequirementCoveragePreview />
  return <PairedDegreePreview />
}

export { EvidenceBadge, VisualPreview }
