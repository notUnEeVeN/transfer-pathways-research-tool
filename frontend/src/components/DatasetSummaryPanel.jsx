import React from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, Button, Spinner, Stack, StatStrip } from './ui'
import {
  useAsDegreeAvailability, useCoverage, useDataSummary, useDegreeRequirements,
} from '@frontend/query/hooks/useData'

/**
 * Dataset overview — the landing map over both halves of the dataset:
 *
 *   ported layer   — refresh chip strip (agreements / majors / campuses /
 *                    colleges / CC + UC courses)
 *   curated layer  — degree templates (with verification-note counts),
 *                    transfer minimums, AS-degree records, prereq concepts
 *   AS degrees     — the statewide availability headline (surveyed / A.S.-T
 *                    analyzable / data gaps / duplicate candidates)
 *   campus table   — majors · agreements · mean coverage under BOTH minimum
 *                    sources, plus each campus's graduation-template status
 *
 * Server-scoped: ported numbers reflect the caller's granted subset; the
 * curated layer is college/campus-side reference data every console user
 * already sees through its own tab. `compact` renders only the chip strip
 * (used atop the audit Stats page). `onNavigate(tab)` — DataPage's changeTab —
 * makes the section headers jump to their hub; absent, the buttons hide.
 */
export default function DatasetSummaryPanel({ compact = false, onNavigate = null }) {
  const q = useDataSummary()
  if (q.isLoading) return <div className='flex justify-center py-6'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the dataset summary.</Alert>
  const { last_data_refresh_at, schools = [], counts = {}, curated = null } = q.data || {}

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
      {curated && <CuratedLayerStrip curated={curated} />}
      <AsDegreeAvailabilityPanel onNavigate={onNavigate} />
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

// The hand-gathered datasets beside the ASSIST port — the counts come back on
// /data/summary (`curated`), one aggregation server-side.
function CuratedLayerStrip({ curated }) {
  const noteCount = curated.degree_templates_with_notes ?? 0
  return (
    <section aria-label='Hand-curated layer'>
      <SectionHeader title='Hand-curated layer' />
      <StatStrip tiles={[
        {
          label: 'Graduation templates',
          value: <span className='tabular'>{curated.degree_templates ?? 0}</span>,
          sub: `${noteCount} with verification notes`,
          accent: noteCount > 0,
        },
        {
          label: 'Transfer minimums',
          value: <span className='tabular'>{curated.transfer_minimum_campuses ?? 0}</span>,
          sub: 'campuses covered',
        },
        {
          label: 'AS-degree records',
          value: <span className='tabular'>{curated.as_degree_records ?? 0}</span>,
          sub: `across ${curated.as_degree_colleges ?? 0} colleges`,
        },
        {
          label: 'Prerequisite concepts',
          value: <span className='tabular'>{curated.prereq_concepts ?? 0}</span>,
          sub: 'concept graph nodes',
        },
      ]} />
    </section>
  )
}

// The statewide AS-degree availability headline — the same counts the
// Associate Degrees hub leads with, so the overview doubles as the "what still
// needs attention" signal (gaps + duplicate candidates).
function AsDegreeAvailabilityPanel({ onNavigate }) {
  const availability = useAsDegreeAvailability()
  if (availability.isError) return null // the hub itself reports the failure
  const c = availability.data?.counts
  const ast = c?.ast
  const dup = c?.local_computing?.duplicate_candidate ?? 0
  return (
    <section aria-label='Associate-degree availability'>
      <SectionHeader title='Associate-degree availability'
        hub='associate_degrees' hubLabel='Open Associate Degrees' onNavigate={onNavigate} />
      <StatStrip tiles={[
        { label: 'Colleges surveyed', value: <span className='tabular'>{c?.total_colleges ?? '—'}</span> },
        {
          label: 'CS A.S.-T analyzable',
          value: <span className='tabular'>{ast?.available ?? '—'}</span>,
          accent: true,
        },
        {
          label: 'CS A.S.-T data gaps',
          value: <span className='tabular'>{ast?.data_gap ?? '—'}</span>,
          sub: 'offered, requirements missing',
          tone: ast?.data_gap ? 'danger' : undefined,
        },
        {
          label: 'Duplicate candidates',
          value: <span className='tabular'>{c ? dup : '—'}</span>,
          sub: 'stored twice under two types',
          tone: dup ? 'danger' : undefined,
        },
      ]} />
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
const CAMPUS_TABLE_COLS = 'grid grid-cols-[2.2fr_1fr_1fr_1.5fr_2.4fr_2.4fr] gap-3.5'

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
            onClick={() => onNavigate('articulation')}>Open Articulation</Button>
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

// The campus's four-year-template status. There is no stored "verified" flag —
// verification notes are the workflow's artifact (they're user-authored during
// a verification pass), so the note count is the honest signal: none stored →
// dash, imported but unreviewed → neutral, notes present → success + count.
function TemplateStatusCell({ row, loading }) {
  if (loading) return <span className='text-caption text-ink-subtle'>…</span>
  if (!row) return <span className='text-caption text-ink-subtle'>—</span>
  const notes = (row.verification_notes || []).length
  if (!notes) return <span><Badge>Imported</Badge></span>
  return <span><Badge variant='success'>{notes} verification {notes === 1 ? 'note' : 'notes'}</Badge></span>
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
