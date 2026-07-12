import React from 'react'
import { Alert, Spinner, Stack } from './ui'
import { useDataSummary, useCoverage } from '@frontend/query/hooks/useData'

/**
 * Dataset overview — a refresh-status chip strip and a campus summary table
 * (majors · agreements · mean coverage under BOTH minimum sources: the
 * hand-curated hard minimum and the full ASSIST-stated minimum — the same two
 * the Agreements tab compares per college). Server-scoped: every number reflects
 * the caller's granted subset. `compact` renders only the chip strip (used atop
 * the audit Stats page).
 */
export default function DatasetSummaryPanel({ compact = false }) {
  const q = useDataSummary()
  if (q.isLoading) return <div className='flex justify-center py-6'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the dataset summary.</Alert>
  const { last_data_refresh_at, schools = [], counts = {} } = q.data || {}

  const stats = [
    ['Refreshed', last_data_refresh_at ? new Date(last_data_refresh_at).toLocaleDateString() : '—'],
    ['Agreements', Number(counts.agreements ?? 0).toLocaleString()],
    ['Majors', Number(counts.majors ?? 0).toLocaleString()],
    ['Campuses', schools.length],
    ['Colleges', Number(counts.community_colleges ?? 0).toLocaleString()],
    ['CC courses', Number(counts.courses ?? 0).toLocaleString()],
    ['UC courses', Number(counts.university_courses ?? 0).toLocaleString()],
  ]

  // Design-matched top bar: label-over-value segments separated by rules.
  const statBar = (
    <div className='surface-card px-4 py-3 flex flex-wrap divide-x divide-border'>
      {stats.map(([label, value], i) => (
        <div key={label} className={`flex flex-col gap-0.5 pr-6 ${i === 0 ? '' : 'pl-6'}`}>
          <span className='text-label text-ink-subtle'>{label}</span>
          <span className='text-body-strong font-mono tabular-nums text-ink'>{value}</span>
        </div>
      ))}
    </div>
  )

  if (compact) return statBar

  return (
    <Stack gap='comfortable'>
      {statBar}
      <CampusTable schools={schools} />
    </Stack>
  )
}

// Mean pct_articulated per school across a coverage query's rows.
function meanBySchoolOf(data) {
  const acc = new Map()
  for (const r of data?.rows || []) {
    if (r.pct_articulated == null) continue
    const cur = acc.get(r.school_id) || { sum: 0, n: 0 }
    cur.sum += r.pct_articulated
    cur.n += 1
    acc.set(r.school_id, cur)
  }
  const out = new Map()
  for (const [k, { sum, n }] of acc) out.set(k, n ? +(sum / n).toFixed(1) : null)
  return out
}

// Campus | Majors | Agreements | Mean hand-curated coverage | Mean ASSIST coverage.
function CampusTable({ schools }) {
  const assistCoverage = useCoverage()
  const websiteCoverage = useCoverage({ requirements: 'paper' })
  const meanAssist = React.useMemo(() => meanBySchoolOf(assistCoverage.data), [assistCoverage.data])
  const meanWebsite = React.useMemo(() => meanBySchoolOf(websiteCoverage.data), [websiteCoverage.data])

  if (!schools.length) {
    return <p className='text-caption text-ink-subtle'>No majors in the dataset yet.</p>
  }

  const pctCell = (value, loading) => (
    loading ? <span className='text-caption text-ink-subtle'>…</span>
      : value == null ? <span className='text-caption text-ink-subtle'>—</span>
      : <span className='text-ink'>{value}%</span>
  )

  return (
    <div className='surface-card overflow-x-auto'>
      <div className='px-4 pt-3 pb-1 flex items-baseline gap-2'>
        <p className='text-label'>Majors tracked per receiving campus</p>
        <span className='text-caption text-ink-subtle'>{schools.length} campus{schools.length === 1 ? '' : 'es'}</span>
      </div>
      <table className='w-full text-left'>
        <thead>
          <tr className='border-b border-border'>
            <th className='px-4 py-2 text-label'>Campus</th>
            <th className='px-4 py-2 text-label whitespace-nowrap'>Majors</th>
            <th className='px-4 py-2 text-label whitespace-nowrap'>Agreements</th>
            <th className='px-4 py-2 text-label whitespace-nowrap'>Mean hand-curated coverage</th>
            <th className='px-4 py-2 text-label whitespace-nowrap'>Mean ASSIST coverage</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border/60'>
          {schools.map((s) => (
            <tr key={s.school_id}>
              <td className='px-4 py-2 text-body'>{s.school}</td>
              <td className='px-4 py-2 text-caption font-mono tabular-nums'>{s.majors.length}</td>
              <td className='px-4 py-2 text-caption font-mono tabular-nums'>{s.n_agreements}</td>
              <td className='px-4 py-2 text-caption font-mono tabular-nums'>
                {pctCell(meanWebsite.get(s.school_id), websiteCoverage.isLoading)}
              </td>
              <td className='px-4 py-2 text-caption font-mono tabular-nums'>
                {pctCell(meanAssist.get(s.school_id), assistCoverage.isLoading)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className='px-4 py-2 text-caption text-ink-subtle'>
        Mean articulation coverage across the campus's community colleges, under the hand-curated hard minimum
        and the full ASSIST-stated minimum. Compare course-by-course per college in the Agreements tab.
      </p>
    </div>
  )
}
