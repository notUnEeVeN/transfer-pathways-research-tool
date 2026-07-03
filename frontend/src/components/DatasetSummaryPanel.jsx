import React from 'react'
import { Alert, Spinner, Stack } from './ui'
import { useDataSummary, useCoverage } from '@frontend/query/hooks/useData'

/**
 * Dataset overview — structure follows the approved design: a dataset
 * identity chip strip, a campus summary table (majors · agreements · mean
 * coverage), and the dataset version history. Server-scoped: every number
 * reflects the caller's granted subset. `compact` renders only the chip
 * strip (used atop the audit Stats page).
 */
export default function DatasetSummaryPanel({ compact = false }) {
  const q = useDataSummary()
  if (q.isLoading) return <div className='flex justify-center py-6'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the dataset summary.</Alert>
  const { dataset_version, schools = [], counts = {}, changelog = [], scoped } = q.data || {}

  const chips = [
    ['Dataset', dataset_version || '—'],
    ['Agreements', Number(counts.agreements ?? 0).toLocaleString()],
    ['Majors', Number(counts.majors ?? 0).toLocaleString()],
    ['Campuses', schools.length],
    ['Colleges', Number(counts.community_colleges ?? 0).toLocaleString()],
    ['CC courses', Number(counts.courses ?? 0).toLocaleString()],
    ['UC courses', Number(counts.university_courses ?? 0).toLocaleString()],
    ['Scope', scoped ? 'selected subset' : 'all ported'],
  ]

  const chipStrip = (
    <div className='surface-card px-4 py-3 flex flex-wrap items-baseline gap-x-6 gap-y-2'>
      {chips.map(([label, value]) => (
        <span key={label} className='inline-flex items-baseline gap-1.5'>
          <span className='text-label text-ink-subtle'>{label}</span>
          <span className='text-body-strong font-mono tabular-nums text-ink'>{value}</span>
        </span>
      ))}
    </div>
  )

  if (compact) return chipStrip

  return (
    <Stack gap='comfortable'>
      {chipStrip}
      <CampusTable schools={schools} />
      <VersionHistory changelog={changelog} current={dataset_version} />
    </Stack>
  )
}

// Campus | Majors | Agreements | Mean coverage — the design's overview table.
function CampusTable({ schools }) {
  const coverage = useCoverage()
  const meanBySchool = React.useMemo(() => {
    const acc = new Map()
    for (const r of coverage.data?.rows || []) {
      if (r.pct_articulated == null) continue
      const cur = acc.get(r.school_id) || { sum: 0, n: 0 }
      cur.sum += r.pct_articulated
      cur.n += 1
      acc.set(r.school_id, cur)
    }
    return acc
  }, [coverage.data])

  if (!schools.length) {
    return <p className='text-caption text-ink-subtle'>No majors in scope yet — the project admin selects the subset.</p>
  }

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
            <th className='px-4 py-2 text-label whitespace-nowrap'>Mean coverage</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border/60'>
          {schools.map((s) => {
            const m = meanBySchool.get(s.school_id)
            const mean = m && m.n ? +(m.sum / m.n).toFixed(1) : null
            return (
              <tr key={s.school_id}>
                <td className='px-4 py-2 text-body'>{s.school}</td>
                <td className='px-4 py-2 text-caption font-mono tabular-nums'>{s.majors.length}</td>
                <td className='px-4 py-2 text-caption font-mono tabular-nums'>{s.n_agreements}</td>
                <td className='px-4 py-2'>
                  {coverage.isLoading ? <span className='text-caption text-ink-subtle'>…</span>
                    : mean == null ? <span className='text-caption text-ink-subtle'>—</span>
                    : (
                      <span className='inline-flex items-center gap-2'>
                        <span className='inline-block w-28 h-1.5 rounded-pill bg-surface-muted border border-border overflow-hidden'>
                          <span className='block h-full bg-primary/60' style={{ width: `${Math.min(100, mean)}%` }} />
                        </span>
                        <span className='text-caption font-mono tabular-nums text-ink'>{mean}%</span>
                      </span>
                    )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className='px-4 py-2 text-caption text-ink-subtle'>Mean of per-agreement articulation coverage across the campus's in-scope majors.</p>
    </div>
  )
}

function VersionHistory({ changelog, current }) {
  if (!changelog.length) return null
  const actionLabel = { init: 'initialized', add: 'majors added', remove: 'majors removed', refresh: 'refreshed from source' }
  return (
    <div className='surface-card p-4'>
      <div className='flex items-baseline gap-2 mb-2'>
        <p className='text-label'>Dataset versions</p>
        <span className='text-caption text-ink-subtle'>last {changelog.length}</span>
      </div>
      <div className='divide-y divide-border/60'>
        {changelog.map((e) => (
          <div key={`${e.dataset_version}-${e.at}`} className='py-2 flex items-baseline gap-3'>
            <span className='text-body-strong font-mono shrink-0'>{e.dataset_version}</span>
            {e.dataset_version === current && (
              <span className='text-caption text-success shrink-0'>current</span>
            )}
            <span className='text-caption text-ink-muted'>{actionLabel[e.action] || e.action}</span>
            <span className='ml-auto text-caption text-ink-subtle whitespace-nowrap'>
              {e.at ? new Date(e.at).toLocaleString() : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
