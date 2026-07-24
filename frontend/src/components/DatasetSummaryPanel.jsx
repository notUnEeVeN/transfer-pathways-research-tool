import React from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack, StatStrip } from './ui'
import {
  useAsDegreeVerification, useDataSummary, useDegreeRequirements,
} from '@frontend/query/hooks/useData'
import { useMajors } from '@frontend/majors/useMajors'
import MajorVerificationDots, {
  MajorVerificationLegend, VERIFICATION_STATE_META,
} from '@frontend/majors/MajorVerificationDots'

/**
 * Dataset overview — the landing map:
 *
 *   ported layer   — refresh chip strip (agreements / majors / campuses /
 *                    colleges / CC + UC courses)
 *   AS landscape   — per-major associate-degree verification: how many colleges
 *                    are verified / present-but-unverified / not offering, for
 *                    each onboarded major
 *   campus table   — one row per campus with its per-major graduation-template
 *                    verification dots (one dot per template-capable major)
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
      <DegreeLandscapePanel onNavigate={onNavigate} />
      <CampusTable schools={schools} onNavigate={onNavigate} />
    </Stack>
  )
}
// Reused section chrome: label-weight heading + optional hub jump on the right.
function SectionHeader({ title, sub = null, hub = null, hubLabel = null, onNavigate = null }) {
  return (
    <div className='flex flex-wrap items-baseline gap-2.5 mb-2.5'>
      <p className='text-label'>{title}</p>
      {sub && <span className='text-tag text-ink-subtle'>{sub}</span>}
      {onNavigate && hub && (
        <Button variant='ghost' className='ml-auto' trailingIcon={ArrowRightIcon}
          onClick={() => onNavigate(hub)}>{hubLabel}</Button>
      )}
    </div>
  )
}

// Per-major associate-degree verification landscape. For every onboarded
// major, how many of the surveyed colleges carry a verified record, a present-
// but-unverified record, or none at all — derived from the stored docs alone,
// so a new major appears here the moment it has records (no CS-only survey).
function LandscapeCount({ state, value, label }) {
  return (
    <span className='inline-flex items-center gap-2 text-caption text-ink-muted whitespace-nowrap'>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${VERIFICATION_STATE_META[state].dot}`} />
      <span className='tabular text-ink font-[550]'>{value}</span> {label}
    </span>
  )
}

function DegreeLandscapePanel({ onNavigate }) {
  const verification = useAsDegreeVerification()
  if (verification.isError) return null // the Community Colleges hub reports the failure
  const loading = verification.isLoading
  const majors = verification.data?.majors || []
  const counts = verification.data?.counts || {}
  const total = verification.data?.rows?.length ?? null
  return (
    <section aria-label='Associate-degree landscape'>
      <SectionHeader title='Associate-degree landscape'
        sub={loading || total == null ? null : `${total} colleges · verification by major`}
        hub='articulation' hubLabel='Open Community Colleges' onNavigate={onNavigate} />
      <div className='surface-card overflow-hidden'>
        {loading ? (
          <div className='px-[22px] py-6 flex justify-center'><Spinner /></div>
        ) : !majors.length ? (
          <p className='px-[22px] py-5 text-caption text-ink-subtle'>No associate-degree records yet.</p>
        ) : majors.map((m, i) => {
          const c = counts[m.slug] || { verified: 0, present: 0, absent: 0 }
          return (
            <div key={m.slug}
              className={`grid grid-cols-[minmax(0,1.3fr)_1fr_1.15fr_1.15fr] gap-3.5 items-center px-[22px] py-3 ${i ? 'border-t border-border' : ''}`}>
              <p className='text-body-strong truncate min-w-0'>{m.label}</p>
              <LandscapeCount state='verified' value={c.verified} label='verified' />
              <LandscapeCount state='present' value={c.present} label='unverified' />
              <LandscapeCount state='absent' value={c.absent} label='not offered' />
            </div>
          )
        })}
      </div>
    </section>
  )
}

// Campus | Graduation templates. There is one four-year template per major, so
// the status is three dots (one per template-capable major, in registry order)
// rather than a per-major-scoped coverage table — a plain at-a-glance read of
// which campus × major templates are still unverified. Header and rows share
// the column template so they can't drift apart.
const CAMPUS_TABLE_COLS = 'grid grid-cols-[minmax(0,1fr)_220px] gap-3.5'

function CampusTable({ schools, onNavigate = null }) {
  const { majors, defaultSlug } = useMajors()
  const degreeTemplates = useDegreeRequirements()
  const templateMajors = React.useMemo(
    () => majors.filter((m) => m.capabilities?.degreeTemplates),
    [majors]
  )
  // (school_id:major_slug) -> template row. Legacy rows without a slug are CS.
  const templateBySchoolMajor = React.useMemo(
    () => new Map((degreeTemplates.data?.rows || [])
      .map((row) => [`${Number(row.school_id)}:${row.major_slug || defaultSlug}`, row])),
    [degreeTemplates.data, defaultSlug]
  )

  const templateStates = React.useCallback((schoolId) => templateMajors.map((m) => {
    const row = templateBySchoolMajor.get(`${Number(schoolId)}:${m.slug}`)
    // Verified via an explicit verdict flag or recorded verification notes.
    const isVerified = !!row && (row.verification?.verified || (row.verification_notes || []).length > 0)
    const state = !row ? 'absent' : (isVerified ? 'verified' : 'present')
    return { slug: m.slug, label: m.label, state }
  }), [templateBySchoolMajor, templateMajors])

  if (!schools.length) {
    return <p className='text-caption text-ink-subtle'>No majors in the dataset yet.</p>
  }

  return (
    <div className='surface-card overflow-hidden'>
      <div className='px-[22px] pt-[18px] pb-1.5 flex flex-wrap items-baseline gap-2.5'>
        <p className='text-label'>Graduation-template verification per campus</p>
        <span className='text-tag text-ink-subtle'>{schools.length} campus{schools.length === 1 ? '' : 'es'}</span>
        {onNavigate && (
          <Button variant='ghost' className='ml-auto' trailingIcon={ArrowRightIcon}
            onClick={() => onNavigate('institutions')}>Open UC Campuses</Button>
        )}
      </div>
      <div className={`${CAMPUS_TABLE_COLS} px-[22px] py-2.5 border-b border-border`}>
        <span className='text-label'>Campus</span>
        <span className='text-label'>Graduation templates</span>
      </div>
      {schools.map((s) => (
        <div key={s.school_id}
          className={`${CAMPUS_TABLE_COLS} items-center px-[22px] py-[13px] border-b border-border last:border-0 hover:bg-surface-hover`}>
          <p className='text-body-strong truncate min-w-0'>{s.school}</p>
          {degreeTemplates.isLoading
            ? <span className='text-caption text-ink-subtle'>…</span>
            : <MajorVerificationDots states={templateStates(s.school_id)} />}
        </div>
      ))}
      <div className='px-[22px] py-3 border-t border-border'>
        <MajorVerificationLegend majors={templateMajors} />
      </div>
    </div>
  )
}
