import React from 'react'
import { Alert, Spinner, Stack, StatStrip } from './ui'
import { useDataSummary, useCoverage } from '@frontend/query/hooks/useData'

/**
 * Dataset overview — a refresh-status chip strip and a campus summary table
 * (majors · agreements · mean coverage under BOTH minimum sources: the
 * hand-curated hard minimum and the full ASSIST-stated minimum — the same two
 * the Agreements tab compares per college). Server-scoped: every number reflects
 * the caller's granted subset. `compact` renders only the chip strip (used atop
 * the audit Stats page). The `/api/data/summary` route itself now shows once,
 * in DataPage's SubNav bar, rather than repeated here.
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

  // Same 7 counts as the compact bar, in the shared StatStrip tile shell
  // (mockup v2:115-122). The refreshed date keeps plain figures — it has a
  // "/" in it — every other tile is a pure-digit count, so gets `tabular`.
  const tiles = stats.map(([label, value], i) => ({
    label,
    value: i === 0 ? value : <span className='tabular'>{value}</span>,
  }))

  return (
    <Stack gap='comfortable'>
      <StatStrip tiles={tiles} />
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
// Hairline div-grid table (mockup v2:124-151) — shares its column template
// between the header row and every data row so the two can't drift apart.
const CAMPUS_TABLE_COLS = 'grid grid-cols-[2.2fr_1fr_1fr_2.6fr_2.6fr] gap-3.5'

function CampusTable({ schools }) {
  const assistCoverage = useCoverage()
  const websiteCoverage = useCoverage({ requirements: 'paper' })
  const meanAssist = React.useMemo(() => meanBySchoolOf(assistCoverage.data), [assistCoverage.data])
  const meanWebsite = React.useMemo(() => meanBySchoolOf(websiteCoverage.data), [websiteCoverage.data])

  if (!schools.length) {
    return <p className='text-caption text-ink-subtle'>No majors in the dataset yet.</p>
  }

  return (
    <div className='surface-card overflow-hidden'>
      <div className='px-[22px] pt-[18px] pb-1.5 flex items-baseline gap-2.5'>
        <p className='text-label'>Majors tracked per receiving campus</p>
        <span className='text-[12.5px] text-ink-subtle'>{schools.length} campus{schools.length === 1 ? '' : 'es'}</span>
      </div>
      <div className={`${CAMPUS_TABLE_COLS} px-[22px] py-2.5 border-b border-border/60`}>
        <span className='text-label'>Campus</span>
        <span className='text-label'>Majors</span>
        <span className='text-label'>Agreements</span>
        <span className='text-label'>Mean hand-curated coverage</span>
        <span className='text-label'>Mean ASSIST coverage</span>
      </div>
      {schools.map((s) => (
        <div key={s.school_id}
          className={`${CAMPUS_TABLE_COLS} items-center px-[22px] py-[13px] border-b border-border/40 last:border-0 hover:bg-surface-hover`}>
          <p className='text-[14px] font-semibold truncate min-w-0'>{s.school}</p>
          <p className='text-[13.5px] tabular text-ink-muted'>{s.majors.length}</p>
          <p className='text-[13.5px] tabular text-ink-muted'>{s.n_agreements}</p>
          <CampusCoverageCell pct={meanWebsite.get(s.school_id)} loading={websiteCoverage.isLoading} />
          <CampusCoverageCell pct={meanAssist.get(s.school_id)} loading={assistCoverage.isLoading} />
        </div>
      ))}
    </div>
  )
}

// One coverage bar + value: success fill at/above the "essentially complete"
// threshold, primary fill below it — mirrors AgreementsBrowser's per-college
// coverage bars, just with its own ≥90 threshold (mockup v2:141-148).
function CampusCoverageCell({ pct, loading }) {
  if (loading) return <span className='text-caption text-ink-subtle'>…</span>
  if (pct == null) return <span className='text-caption text-ink-subtle'>—</span>
  const v = Math.max(0, Math.min(100, pct))
  return (
    <span className='inline-flex items-center gap-2.5'>
      <span className='inline-block w-[110px] h-1.5 rounded-pill bg-surface-sunken overflow-hidden'>
        <span className={`block h-full rounded-pill ${v >= 90 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${v}%` }} />
      </span>
      <span className='text-[13.5px] font-[550] text-ink'>{pct}%</span>
    </span>
  )
}
