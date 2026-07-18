import React from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, Button, Spinner, Stack, StatStrip } from './ui'
import {
  useAsDegreeAvailability, useCoverage, useDataSummary, useDegreeRequirements,
} from '@frontend/query/hooks/useData'

/**
 * Dataset overview — the landing map:
 *
 *   ported layer   — refresh chip strip (agreements / majors / campuses /
 *                    colleges / CC + UC courses)
 *   CS degrees     — the interesting statewide finding: which colleges offer a
 *                    local CS A.S., a CS A.S.-T, both, or neither
 *   campus table   — majors · agreements · graduation-template verification ·
 *                    mean coverage under BOTH minimum sources
 *
 * Server-scoped: ported numbers reflect the caller's granted subset. `compact`
 * renders only the chip strip (used atop the audit Stats page).
 * `onNavigate(tab)` — DataPage's changeTab — makes the section headers jump to
 * their hub; absent, the buttons hide.
 */
export default function DatasetSummaryPanel({ compact = false, onNavigate = null }) {
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
      <CsDegreeLandscapePanel onNavigate={onNavigate} />
      <CampusTable schools={schools} onNavigate={onNavigate} />
    </Stack>
  )
}

// Reused section chrome: label-weight heading + optional hub jump on the right.
function SectionHeader({ title, sub = null, hub = null, hubLabel = null, onNavigate = null }) {
  return (
    <div className='flex flex-wrap items-baseline gap-2.5 mb-2.5'>
      <p className='text-label'>{title}</p>
      {sub && <span className='text-[12.5px] text-ink-subtle'>{sub}</span>}
      {onNavigate && hub && (
        <Button variant='ghost' className='ml-auto' trailingIcon={ArrowRightIcon}
          onClick={() => onNavigate(hub)}>{hubLabel}</Button>
      )}
    </div>
  )
}

// The statewide CS-degree landscape, using distinct requirement records that
// are available for analysis. Headline figures are inclusive totals; the
// compact row below them is the mutually exclusive, one-college-per-group
// breakdown. Catalog-only data gaps and duplicate candidates stay out so the
// Overview agrees with the degree detail and export views.
function CsDegreeLandscapePanel({ onNavigate }) {
  const availability = useAsDegreeAvailability()
  if (availability.isError) return null // the Community Colleges hub reports the failure
  const rows = availability.data?.rows || []
  const seg = { both: 0, astOnly: 0, localOnly: 0, otherOnly: 0, none: 0 }
  const totals = { ast: 0, local: 0, other: 0 }
  for (const row of rows) {
    const ast = row.types?.ast?.status === 'available'
    const local = row.types?.local_cs_as?.status === 'available'
    const other = row.types?.local_computing?.status === 'available'
    if (ast) totals.ast += 1
    if (local) totals.local += 1
    if (other) totals.other += 1
    if (ast && local) seg.both += 1
    else if (ast) seg.astOnly += 1
    else if (local) seg.localOnly += 1
    else if (other) seg.otherOnly += 1
    else seg.none += 1
  }
  const loading = availability.isLoading
  const n = (v) => (loading ? '—' : <span className='tabular'>{v}</span>)
  const breakdown = [
    [seg.astOnly, 'A.S.-T only'],
    [seg.localOnly, 'local A.S. only'],
    [seg.both, 'both CS degrees'],
    [seg.otherOnly, 'other computing only'],
    [seg.none, 'no degree record'],
  ]
  return (
    <section aria-label='CS associate-degree landscape'>
      <SectionHeader title='CS associate-degree landscape'
        sub={loading ? null : `${rows.length} colleges · totals may overlap`}
        hub='articulation' hubLabel='Open Community Colleges' onNavigate={onNavigate} />
      <div className='surface-card overflow-hidden'>
        <StatStrip bare tiles={[
          {
            label: 'Schools with CS A.S.-T',
            value: n(totals.ast),
            accent: true,
          },
          {
            label: 'Schools with local CS A.S.',
            value: n(totals.local),
          },
          {
            label: 'Schools with another computing degree',
            value: n(totals.other),
          },
        ]} />
        <div className='border-t border-border/60 px-[22px] py-3.5'>
          <p className='text-label'>One-school-per-group breakdown</p>
          <div className='mt-2 flex flex-wrap gap-x-5 gap-y-1.5'>
            {breakdown.map(([value, label]) => (
              <span key={label} className='text-caption whitespace-nowrap'>
                <strong className='font-semibold tabular text-ink'>{loading ? '—' : value}</strong> {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
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

// Campus | Majors | Agreements | Graduation template | Mean hand-curated
// coverage | Mean ASSIST coverage. Hairline div-grid table (mockup v2:124-151)
// — shares its column template between the header row and every data row so
// the two can't drift apart.
const CAMPUS_TABLE_COLS = 'grid grid-cols-[2.2fr_1fr_1fr_1.3fr_2.4fr_2.4fr] gap-3.5'

function CampusTable({ schools, onNavigate = null }) {
  const assistCoverage = useCoverage()
  const websiteCoverage = useCoverage({ requirements: 'paper' })
  const degreeTemplates = useDegreeRequirements()
  const meanAssist = React.useMemo(() => meanBySchoolOf(assistCoverage.data), [assistCoverage.data])
  const meanWebsite = React.useMemo(() => meanBySchoolOf(websiteCoverage.data), [websiteCoverage.data])
  const templateBySchool = React.useMemo(
    () => new Map((degreeTemplates.data?.rows || []).map((row) => [Number(row.school_id), row])),
    [degreeTemplates.data]
  )

  if (!schools.length) {
    return <p className='text-caption text-ink-subtle'>No majors in the dataset yet.</p>
  }

  return (
    <div className='surface-card overflow-hidden'>
      <div className='px-[22px] pt-[18px] pb-1.5 flex items-baseline gap-2.5'>
        <p className='text-label'>Majors tracked per receiving campus</p>
        <span className='text-[12.5px] text-ink-subtle'>{schools.length} campus{schools.length === 1 ? '' : 'es'}</span>
        {onNavigate && (
          <Button variant='ghost' className='ml-auto' trailingIcon={ArrowRightIcon}
            onClick={() => onNavigate('institutions')}>Open UC Campuses</Button>
        )}
      </div>
      <div className={`${CAMPUS_TABLE_COLS} px-[22px] py-2.5 border-b border-border/60`}>
        <span className='text-label'>Campus</span>
        <span className='text-label'>Majors</span>
        <span className='text-label'>Agreements</span>
        <span className='text-label'>Graduation template</span>
        <span className='text-label'>Mean hand-curated coverage</span>
        <span className='text-label'>Mean ASSIST coverage</span>
      </div>
      {schools.map((s) => (
        <div key={s.school_id}
          className={`${CAMPUS_TABLE_COLS} items-center px-[22px] py-[13px] border-b border-border/40 last:border-0 hover:bg-surface-hover`}>
          <p className='text-[14px] font-semibold truncate min-w-0'>{s.school}</p>
          <p className='text-[13.5px] tabular text-ink-muted'>{s.majors.length}</p>
          <p className='text-[13.5px] tabular text-ink-muted'>{s.n_agreements}</p>
          <TemplateStatusCell row={templateBySchool.get(Number(s.school_id))}
            loading={degreeTemplates.isLoading} />
          <CampusCoverageCell pct={meanWebsite.get(s.school_id)} loading={websiteCoverage.isLoading} />
          <CampusCoverageCell pct={meanAssist.get(s.school_id)} loading={assistCoverage.isLoading} />
        </div>
      ))}
    </div>
  )
}

// The campus's four-year-template status. Verification notes are authored
// only while walking the official pages, so notes present ⇒ the campus has
// been verified: none stored → dash, imported but unreviewed → neutral,
// notes present → Verified.
function TemplateStatusCell({ row, loading }) {
  if (loading) return <span className='text-caption text-ink-subtle'>…</span>
  if (!row) return <span className='text-caption text-ink-subtle'>—</span>
  const verified = (row.verification_notes || []).length > 0
  return <span><Badge variant={verified ? 'success' : 'neutral'}>{verified ? 'Verified' : 'Imported'}</Badge></span>
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
