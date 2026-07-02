import React from 'react'
import { Alert, Spinner, Stack } from './ui'
import { useDataSummary } from '@frontend/query/hooks/useData'

/**
 * What the caller's dataset contains — count tiles + per-school majors.
 * Server-scoped: admins see everything ported; partners see exactly their
 * granted (school, major) subset. Used at the top of Stats and on the Data
 * page's Overview.
 */
export default function DatasetSummaryPanel({ compact = false }) {
  const q = useDataSummary()
  if (q.isLoading) return <div className='flex justify-center py-6'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the dataset summary.</Alert>
  const { dataset_version, schools = [], counts = {} } = q.data || {}

  const tiles = [
    { label: 'agreements', value: counts.agreements },
    { label: 'majors', value: counts.majors },
    { label: 'CC courses', value: counts.courses },
    { label: 'university courses', value: counts.university_courses },
    { label: 'community colleges', value: counts.community_colleges },
  ]

  return (
    <Stack gap='cozy'>
      <p className='text-caption text-ink-subtle'>
        Dataset <span className='font-mono text-ink-muted'>{dataset_version || '—'}</span>
        {q.data?.scoped ? ' · your granted subset' : ' · full ported dataset'}
      </p>
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
        {tiles.map((t) => (
          <div key={t.label} className='surface-card p-4'>
            <p className='text-stat font-mono'>{Number(t.value ?? 0).toLocaleString()}</p>
            <p className='text-caption text-ink-muted'>{t.label}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
          {schools.map((s) => (
            <div key={s.school_id} className='surface-card p-4'>
              <div className='flex items-baseline gap-2'>
                <p className='text-body-strong'>{s.school}</p>
                <span className='text-caption text-ink-subtle'>
                  {s.majors.length} major{s.majors.length === 1 ? '' : 's'} · {s.n_agreements} agreements
                </span>
              </div>
              <ul className='mt-1.5 text-caption text-ink-muted space-y-0.5'>
                {s.majors.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          ))}
          {!schools.length && (
            <p className='text-caption text-ink-subtle'>
              No majors in scope yet — the project admin selects your subset.
            </p>
          )}
        </div>
      )}
    </Stack>
  )
}
