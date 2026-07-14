import React, { useDeferredValue, useMemo, useState } from 'react'
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Input, Stack, StatStrip } from '../components/ui'
import { useChoiceCost, useSchools } from '../shared/query/hooks/useData'
import { AnalysisLoading, shortenSchool } from './chartBits'

const DEFAULT_MAJOR_FILTER = 'computer science'
const MAX_SCHOOLS = 4

// Ordinal brand-blue ramp, dark→light in ADDITION ORDER (first choice darkest).
// 4 steps of one hue; validated for monotone lightness, step separation, and
// surface contrast on both light and dark surfaces — hence the cap of 4.
const STEP_COLORS = ['#2746ab', '#3366ef', '#6189fb', '#94b2ff']
const ORDINALS = ['1st', '2nd', '3rd', '4th']

const intFmt = new Intl.NumberFormat()
const numFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

function stepMeans(rows, orderedIds) {
  return orderedIds.map((schoolId, i) => {
    const additions = rows
      .map((r) => r.steps?.[i])
      .filter((s) => s && s.school_id === schoolId && s.has_agreement)
      .map((s) => Number(s.additional_courses))
      .filter(Number.isFinite)
    const missing = rows.filter((r) => r.steps?.[i] && !r.steps[i].has_agreement).length
    return {
      schoolId,
      mean: additions.length ? additions.reduce((s, v) => s + v, 0) / additions.length : null,
      n: additions.length,
      missing,
    }
  })
}

/**
 * Choice cost — the CA paper's inter-institution misalignment: for an ORDERED
 * list of campuses, the incremental CC courses each additional campus demands
 * beyond the union already taken. Segment color = addition order (ordinal
 * ramp), consistent between the two views.
 */
export default function ChoiceCost() {
  const [majorFilter, setMajorFilter] = useState(DEFAULT_MAJOR_FILTER)
  const [orderedIds, setOrderedIds] = useState(null) // null until schools load
  const deferredMajorFilter = useDeferredValue(majorFilter)

  const schoolsQ = useSchools()
  // /schools returns { uc: [{id, name}] } — same unwrap as DataPage's browser.
  const schools = useMemo(
    () => (schoolsQ.data?.uc || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [schoolsQ.data]
  )
  // Default: the first two campuses alphabetically — the paper's "keep a 2nd
  // choice open" question — deterministic across reloads.
  const effectiveIds = orderedIds ?? schools.slice(0, 2).map((s) => Number(s.id))

  const query = useChoiceCost(
    { majorContains: deferredMajorFilter, schoolIds: effectiveIds },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const rows = query.data?.rows || []
  const datasetVersion = query.data?.dataset_version || 'unversioned'

  const nameById = useMemo(() => new Map(schools.map((s) => [Number(s.id), s.name])), [schools])
  const steps = useMemo(() => stepMeans(rows, effectiveIds), [rows, effectiveIds])
  const maxStepMean = Math.max(1, ...steps.map((s) => s.mean || 0))
  const sortedRows = useMemo(
    () => rows.slice().sort((a, b) => b.total_courses - a.total_courses || String(a.community_college).localeCompare(String(b.community_college))),
    [rows]
  )
  const maxTotal = Math.max(1, ...rows.map((r) => Number(r.total_courses) || 0))
  const meanTotal = rows.length ? rows.reduce((s, r) => s + (Number(r.total_courses) || 0), 0) / rows.length : null

  const toggleSchool = (id) => {
    const current = [...effectiveIds]
    const at = current.indexOf(id)
    if (at >= 0) current.splice(at, 1)
    else if (current.length < MAX_SCHOOLS) current.push(id)
    else return
    setOrderedIds(current)
  }

  if (schoolsQ.isLoading || (query.isLoading && effectiveIds.length)) return <AnalysisLoading />
  if (schoolsQ.isError || query.isError) return <Alert type='error'>Could not load the choice-cost data.</Alert>

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-center gap-3' data-export-exclude>
      <Input
        label='Major filter'
        value={majorFilter}
        onChange={(e) => setMajorFilter(e.target.value)}
        placeholder='computer science'
        leadingIcon={MagnifyingGlassIcon}
        className='w-72 max-w-full'
      />
      <div className='flex flex-col min-w-0'>
        <span className='field-label'>Campuses, in application order (up to {MAX_SCHOOLS})</span>
        <div className='flex flex-wrap gap-1.5'>
          {schools.map((s) => {
            const id = Number(s.id)
            const at = effectiveIds.indexOf(id)
            const selected = at >= 0
            return (
              <button
                key={id}
                type='button'
                onClick={() => toggleSchool(id)}
                className={`h-9 px-2.5 rounded-lg border text-button ${
                  selected
                    ? 'border-border-strong bg-primary-soft text-primary'
                    : 'border-border text-ink-muted hover:bg-surface-hover'
                }`}
              >
                {selected && <span className='font-mono mr-1'>{at + 1}.</span>}
                {shortenSchool(s.name)}
              </button>
            )
          })}
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

  if (!effectiveIds.length) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='Pick at least one campus' description='Choice cost is computed against an ordered campus list.' className='p-8' />
      </Stack>
    )
  }
  if (!rows.length) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='No colleges in scope' description='Try a broader major filter.' className='p-8' />
      </Stack>
    )
  }

  const legend = (
    <div className='flex flex-wrap items-center gap-3 text-caption text-ink-subtle'>
      {effectiveIds.map((id, i) => (
        <span key={id} className='inline-flex items-center gap-1.5'>
          <i className='inline-block w-3 h-3 rounded-sm' style={{ backgroundColor: STEP_COLORS[i] }} />
          {ORDINALS[i]}: {shortenSchool(nameById.get(id) || `School ${id}`)}
        </span>
      ))}
    </div>
  )

  return (
    <Stack gap='section'>
      {controls}

      <div data-export-exclude>
        <StatStrip
          tiles={[
            { label: 'Community colleges', value: intFmt.format(rows.length), sub: 'from /analysis/choice-cost' },
            { label: 'Mean total courses', value: numFmt.format(meanTotal), accent: true, sub: `keeping all ${effectiveIds.length} open` },
            ...(steps[1]
              ? [{ label: `Added by ${ORDINALS[1]} choice`, value: numFmt.format(steps[1].mean), sub: 'mean extra CC courses' }]
              : []),
            {
              label: 'Missing agreements',
              value: intFmt.format(steps.reduce((s, st) => s + st.missing, 0)),
              sub: 'college × campus gaps',
            },
          ]}
        />
      </div>

      <div className='surface-card p-4'>
        <p className='text-caption text-ink-subtle mb-3'>Mean additional CC courses per added campus</p>
        <div className='flex items-end gap-6 h-40 max-w-xl'>
          {steps.map((step, i) => {
            const label = shortenSchool(nameById.get(step.schoolId) || `School ${step.schoolId}`)
            const title = `${ORDINALS[i]} choice — ${label}\nMean additional courses: ${step.mean == null ? '-' : numFmt.format(step.mean)}\n${intFmt.format(step.n)} colleges with an agreement${step.missing ? `, ${intFmt.format(step.missing)} without` : ''}`
            return (
              <div key={step.schoolId} className='flex-1 h-full flex flex-col items-center justify-end gap-1'>
                <span className='text-caption font-mono text-ink'>{step.mean == null ? '-' : numFmt.format(step.mean)}</span>
                <div
                  title={title}
                  aria-label={title}
                  className='w-full max-w-16 rounded-t-sm transition-opacity hover:opacity-75'
                  style={{ height: `${step.mean == null ? 2 : Math.max((step.mean / maxStepMean) * 100, 2)}%`, backgroundColor: STEP_COLORS[i] }}
                />
                <span className='text-label text-ink-subtle text-center leading-tight'>{ORDINALS[i]}<br />{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className='surface-card p-4'>
        <div className='flex flex-wrap items-center justify-between gap-2 mb-3'>
          <p className='text-caption text-ink-subtle'>Per college: cheapest-path courses, stacked by addition order</p>
          {legend}
        </div>
        <div className='max-h-[26rem] overflow-y-auto pr-1'>
          {sortedRows.map((r) => {
            let cumulative = 0
            return (
              <div key={r.community_college_id} className='flex items-center gap-3 py-0.5'>
                <span className='w-44 shrink-0 truncate text-caption text-ink' title={r.community_college}>
                  {r.community_college}
                </span>
                <div className='flex-1 flex items-center h-4'>
                  {(r.steps || []).map((step, i) => {
                    if (!step.has_agreement || !step.additional_courses) return null
                    cumulative += step.additional_courses
                    const label = shortenSchool(nameById.get(step.school_id) || `School ${step.school_id}`)
                    const title = `${r.community_college}\n${ORDINALS[i]} choice — ${label}: +${intFmt.format(step.additional_courses)} courses (running total ${intFmt.format(cumulative)})`
                    return (
                      <div
                        key={step.school_id}
                        title={title}
                        aria-label={title}
                        className='h-full first:rounded-l-sm last:rounded-r-sm mr-0.5 last:mr-0 transition-opacity hover:opacity-75'
                        style={{ width: `${(step.additional_courses / maxTotal) * 100}%`, backgroundColor: STEP_COLORS[i] }}
                      />
                    )
                  })}
                </div>
                <span className='w-10 shrink-0 text-right text-caption font-mono tabular-nums text-ink'>
                  {intFmt.format(r.total_courses)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Stack>
  )
}
