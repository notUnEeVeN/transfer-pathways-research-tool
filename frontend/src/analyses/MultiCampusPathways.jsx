import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import {
  Alert, Badge, Button, Combobox, EmptyState, Input, Panel, Stack, StatStrip, Tabs,
} from '../components/ui'
import {
  useColleges, useMultiCampusPathways, useMultiCampusPathwaysSnapshot, useSchools,
} from '../shared/query/hooks/useData'
import { fmtDate } from '../shared/fmtDate'
import { AnalysisLoading, shortenSchool } from './chartBits'
import { materializeAverageSnapshot } from './multiCampusSnapshot'

const MODE_OPTIONS = [
  { value: 'average', label: 'Average across colleges' },
  { value: 'college', label: 'Specific college' },
]

const intFmt = new Intl.NumberFormat()
const numFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

const finite = (...values) => values.find((value) => Number.isFinite(Number(value)))
const asNumber = (...values) => {
  const value = finite(...values)
  return value == null ? null : Number(value)
}
const displayNumber = (value, suffix = '') => (
  Number.isFinite(Number(value)) ? `${numFmt.format(Number(value))}${suffix}` : '—'
)
const signedNumber = (value, suffix = '') => {
  if (!Number.isFinite(Number(value))) return '—'
  const number = Number(value)
  return `${number > 0 ? '+' : ''}${numFmt.format(number)}${suffix}`
}
const plural = (value, singular, pluralForm = `${singular}s`) => (
  Number(value) === 1 ? singular : pluralForm
)
const termNoun = (system, value = 2) => plural(value, system === 'quarter' ? 'quarter' : 'semester')

function calendarLabel(system) {
  if (system === 'quarter') return 'Quarter'
  if (system === 'semester') return 'Semester'
  return 'Calendar unavailable'
}

const STATUS_LABELS = {
  optimal: 'Exact local plan',
  bounded: 'Not fully proven',
  estimated: 'Uses an assumption',
  unavailable: 'Data needs review',
}

const statusLabel = (status) => STATUS_LABELS[status] || 'Modeled result'

const failClosedSnapshotStatus = (error) => {
  const status = Number(error?.response?.status)
  return [401, 403, 409].includes(status) ? status : null
}

function combinedFor(row) {
  return row?.combined || row?.plan || row?.summary || {}
}

function scheduleFor(row) {
  const combined = combinedFor(row)
  return combined.schedule && !Array.isArray(combined.schedule) ? combined.schedule : {}
}

function exactTermsFor(row) {
  const combined = combinedFor(row)
  const schedule = scheduleFor(row)
  return asNumber(combined.estimated_terms, combined.min_terms, schedule.min_terms)
}

function termRangeFor(row) {
  const combined = combinedFor(row)
  const schedule = scheduleFor(row)
  const exact = exactTermsFor(row)
  if (exact != null) return { low: exact, high: exact, exact: true }
  const low = asNumber(combined.lower_bound_terms, schedule.lower_bound_terms)
  const high = asNumber(combined.upper_bound_terms, schedule.upper_bound_terms)
  if (low == null && high == null) return null
  return { low: low ?? high, high: high ?? low, exact: false }
}

function termText(row, system) {
  if (system === 'unknown') return '—'
  const range = termRangeFor(row)
  if (!range) return '—'
  const noun = termNoun(system, range.high)
  return range.low === range.high
    ? `${intFmt.format(range.high)} ${noun}`
    : `${intFmt.format(range.low)}–${intFmt.format(range.high)} ${noun}`
}

function coursesFor(row) {
  const combined = combinedFor(row)
  return asNumber(combined.distinct_courses, combined.course_count, row?.distinct_courses)
}

function unitsFor(row) {
  const combined = combinedFor(row)
  return asNumber(combined.native_units, combined.total_units, row?.native_units)
}

function premiumFor(row) {
  const combined = combinedFor(row)
  return asNumber(
    combined.optionality_premium_courses,
    combined.additional_courses,
    row?.optionality_premium_courses,
  )
}

function rowSystem(row) {
  const value = String(row?.unit_system || row?.calendar || row?.academic_calendar || '').toLowerCase()
  if (value === 'quarter') return 'quarter'
  if (value === 'semester') return 'semester'
  return 'unknown'
}

function mean(values) {
  const usable = values.filter(Number.isFinite)
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null
}

function median(values) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!usable.length) return null
  const middle = Math.floor(usable.length / 2)
  return usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2
}

function calendarModel(data, rows, system) {
  const supplied = (data?.calendar_groups || data?.calendarGroups || [])
    .find((group) => String(group.unit_system || group.system) === system) || {}
  const systemRows = rows.filter((row) => rowSystem(row) === system)
  const observed = systemRows
    .map((row) => ({ row, range: termRangeFor(row) }))
    .filter(({ row, range }) => (!row.status || row.status === 'optimal')
      && range?.exact && range.high != null)
  const bounded = systemRows.filter((row) => {
    const range = termRangeFor(row)
    return range && !range.exact
  })
  const bins = new Map()
  const suppliedDistribution = Array.isArray(supplied.distribution) ? supplied.distribution : []
  if (suppliedDistribution.length) {
    for (const item of suppliedDistribution) {
      const terms = asNumber(item.terms, item.value, item.term)
      const count = asNumber(item.count, item.n)
      if (terms != null && count != null) bins.set(terms, count)
    }
  } else {
    for (const { range } of observed) bins.set(range.high, (bins.get(range.high) || 0) + 1)
  }
  const values = observed.map(({ range }) => range.high)
  return {
    system,
    n: asNumber(supplied.n, supplied.count) ?? systemRows.length,
    exactN: asNumber(supplied.exact_n, supplied.exact_count) ?? observed.length,
    boundedN: asNumber(supplied.bounded_n, supplied.bounded_count) ?? bounded.length,
    estimatedN: asNumber(supplied.estimated_n) ?? systemRows.filter((row) => row.status === 'estimated').length,
    unavailableN: asNumber(supplied.unavailable_n) ?? systemRows.filter((row) => row.status === 'unavailable').length,
    excludedN: asNumber(supplied.excluded_n) ?? Math.max(0, systemRows.length - observed.length),
    meanPremium: asNumber(supplied.mean_optionality_premium_terms),
    meanPremiumN: asNumber(supplied.mean_optionality_premium_terms_n),
    mean: asNumber(supplied.mean_terms, supplied.mean) ?? mean(values),
    median: asNumber(supplied.median_terms, supplied.median) ?? median(values),
    bins: [...bins.entries()].map(([terms, count]) => ({ terms, count })).sort((a, b) => a.terms - b.terms),
  }
}

function TermDistribution({ model }) {
  const label = model.system === 'quarter' ? 'Quarter colleges' : 'Semester colleges'
  const max = Math.max(1, ...model.bins.map((bin) => bin.count))
  return (
    <section className='min-w-0 rounded-xl border border-border bg-surface p-4'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h4 className='text-body-strong text-ink'>{label}</h4>
          <p className='text-caption text-ink-subtle'>
            {intFmt.format(model.n)} colleges · {intFmt.format(model.exactN)} exact local plans
            {model.boundedN ? ` · ${intFmt.format(model.boundedN)} not fully proven` : ''}
            {model.estimatedN ? ` · ${intFmt.format(model.estimatedN)} assumption-based` : ''}
            {model.unavailableN ? ` · ${intFmt.format(model.unavailableN)} unavailable` : ''}
          </p>
        </div>
        <p className='text-caption text-ink-muted text-right'>
          Mean: {model.mean == null ? '—' : `${numFmt.format(model.mean)} ${termNoun(model.system, model.mean)}`}<br />
          Median: {model.median == null ? '—' : `${numFmt.format(model.median)} ${termNoun(model.system, model.median)}`}
        </p>
      </div>
      {model.bins.length ? (
        <div className='mt-4 flex h-32 items-end gap-2' aria-label={`${label} by estimated terms`}>
          {model.bins.map((bin) => {
            const title = `${bin.terms} ${termNoun(model.system, bin.terms)}: ${bin.count} ${plural(bin.count, 'college')}`
            return (
              <div key={bin.terms} className='flex h-full min-w-0 flex-1 flex-col justify-end gap-1'>
                <span className='text-center text-tag font-mono text-ink-subtle'>{intFmt.format(bin.count)}</span>
                <div
                  className='mx-auto w-full max-w-14 rounded-t-sm bg-primary transition-opacity hover:opacity-75'
                  style={{ height: `${Math.max(8, (bin.count / max) * 100)}%` }}
                  title={title}
                  aria-label={title}
                />
                <span className='text-center text-label font-mono text-ink-muted'>{intFmt.format(bin.terms)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className='mt-6 text-caption text-ink-subtle'>No usable term estimates in this calendar.</p>
      )}
      {model.meanPremium != null && (
        <p className='mt-3 border-t border-border pt-3 text-caption text-ink-muted'>
          More campus options add {signedNumber(model.meanPremium)} {termNoun(model.system, model.meanPremium)} on average
          {model.meanPremiumN ? ` across ${intFmt.format(model.meanPremiumN)} comparable colleges` : ''}.
        </p>
      )}
    </section>
  )
}

function SelectedPrograms({ programs, selectedIds, nameById }) {
  const byId = new Map((programs || []).map((program) => [Number(program.school_id), program]))
  return (
    <Panel title='Selected major preparation pathways' surface='flat'>
      <div className='divide-y divide-border'>
        {selectedIds.map((schoolId) => {
          const program = byId.get(Number(schoolId)) || {}
          return (
            <div key={schoolId} className='py-3 first:pt-0 last:pb-0'>
              <p className='text-body-strong text-ink'>{shortenSchool(program.school || nameById.get(Number(schoolId)) || `Campus ${schoolId}`)}</p>
              <p className='mt-0.5 text-caption text-ink-subtle'>{program.program || program.major || 'Configured computer science program'}</p>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function AverageTable({ rows, targetCount }) {
  const sorted = rows.slice().sort((a, b) => String(a.community_college).localeCompare(String(b.community_college)))
  return (
    <div className='surface-card overflow-auto' data-export-exclude>
      <table className='min-w-full border-separate border-spacing-0'>
        <thead>
          <tr>
            {['Community college', 'Calendar', 'Full agreements covered', 'Distinct courses', 'Native units', 'Estimated terms', 'Courses added for more campus options', 'Status'].map((heading, index) => (
              <th key={heading} className={`border-b border-border px-3 py-2 text-label ${index === 0 ? 'text-left' : 'text-right'}`}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const system = rowSystem(row)
            const campusRows = row.campuses || row.targets || []
            const fullyCovered = campusRows.filter((campus) =>
              campus.strict_complete === true || campus.fully_satisfiable === true).length
            const warnings = row.warnings || []
            const status = row.status || scheduleFor(row).status || 'modeled'
            return (
              <tr key={row.community_college_id ?? row.community_college} className='hover:bg-surface-hover'>
                <td className='border-b border-border px-3 py-2 text-caption text-ink'>{row.community_college || row.college_name || 'Unknown college'}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption text-ink-muted'>{calendarLabel(system)}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption font-mono tabular-nums'>{intFmt.format(fullyCovered)} of {intFmt.format(targetCount)}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption font-mono tabular-nums'>{displayNumber(coursesFor(row))}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption font-mono tabular-nums'>{displayNumber(unitsFor(row))}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption font-mono tabular-nums'>{termText(row, system)}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption font-mono tabular-nums'>{signedNumber(premiumFor(row))}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption text-ink-muted' title={warnings.join('\n')}>
                  {warnings.length
                    ? `${statusLabel(status)} · ${warnings.length} ${plural(warnings.length, 'warning')}`
                    : statusLabel(status)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function courseCode(course) {
  return course?.code || [course?.prefix, course?.number].filter(Boolean).join(' ') || `Course ${course?.course_id ?? ''}`.trim()
}

const ROLE_LABELS = {
  major: 'Major preparation',
  major_preparation: 'Major preparation',
  prerequisite: 'Prerequisite only',
  prerequisite_only: 'Prerequisite only',
  flexible: 'Flexible requirement',
}

function CourseSchedule({ row, terms, courses }) {
  const system = rowSystem(row)
  const combined = combinedFor(row)
  const byId = new Map(courses.map((course) => [String(course.course_id), course]))
  const schedule = scheduleFor(row)
  const scheduleStatus = schedule.status || combined.schedule_status || row.schedule_status
  const unitFloor = asNumber(combined.unit_lower_bound_terms, schedule.unit_lower_bound_terms)
  const sequenceFloor = asNumber(combined.sequence_lower_bound_terms, schedule.sequence_lower_bound_terms)

  if (system === 'unknown') {
    return <EmptyState title='Calendar unavailable' description='A term sequence cannot be calculated until this college is identified as a semester or quarter college.' className='py-10' />
  }

  if (!terms.length) {
    return <EmptyState title='No course sequence available' description='The model could not build a term-by-term sequence for this college.' className='py-10' />
  }

  return (
    <div>
      {scheduleStatus && scheduleStatus !== 'optimal' && (
        <Alert type='warning'>The sequence below is feasible. Its minimum length is within the displayed lower and upper bounds, but has not been proven exactly.</Alert>
      )}
      {unitFloor != null && sequenceFloor != null && (
        <p className='mt-3 text-caption text-ink-muted'>
          Units alone require at least {numFmt.format(unitFloor)} {termNoun(system, unitFloor)}.
          {' '}Prerequisite order requires at least {numFmt.format(sequenceFloor)} {termNoun(system, sequenceFloor)}.
        </p>
      )}
      <div className='mt-4 overflow-x-auto pb-2'>
        <div className='flex min-w-max gap-3'>
          {terms.map((term, index) => {
            const listed = Array.isArray(term.courses)
              ? term.courses
              : (term.course_ids || []).map((id) => byId.get(String(id))).filter(Boolean)
            const placeholders = term.placeholders || []
            const unitTotal = asNumber(term.units, term.total_units)
              ?? listed.reduce((sum, course) => sum + (Number(course.units) || 0), 0)
            const label = term.label || `${system === 'unknown' ? 'Term' : calendarLabel(system)} ${term.index || index + 1}`
            return (
              <section key={term.index || index} className='w-60 shrink-0 rounded-xl border border-border bg-surface-muted p-3'>
                <div className='flex items-start justify-between gap-2 border-b border-border pb-2'>
                  <h4 className='text-body-strong text-ink'>{label}</h4>
                  <span className='text-caption font-mono tabular-nums text-ink-muted'>
                    {intFmt.format(listed.length)} {plural(listed.length, 'course')} · {displayNumber(unitTotal, ' units')}
                  </span>
                </div>
                <div className='mt-3 flex flex-col gap-2'>
                  {listed.map((course) => (
                    <div key={course.course_id || courseCode(course)} className='rounded-lg border border-border bg-surface px-3 py-2'>
                      <p className='text-caption font-[650] text-ink'>{courseCode(course)}</p>
                      <p className='mt-0.5 line-clamp-2 text-tag text-ink-subtle'>{course.title || ROLE_LABELS[course.role] || 'Required course'}</p>
                    </div>
                  ))}
                  {placeholders.map((placeholder, placeholderIndex) => {
                    const labelText = typeof placeholder === 'string' ? placeholder : placeholder.label || 'Flexible requirement'
                    return (
                      <div key={`${labelText}-${placeholderIndex}`} className='rounded-lg border border-dashed border-border-strong px-3 py-2'>
                        <p className='text-caption text-ink-muted'>{labelText}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CampusPreparation({ row, selectedIds, programs, nameById }) {
  const supplied = row.campuses || row.targets || []
  const byId = new Map(supplied.map((campus) => [Number(campus.school_id), campus]))
  const programById = new Map((programs || []).map((program) => [Number(program.school_id), program]))
  return (
    <Panel title='What this plan prepares for' surface='flat'>
      <div className='divide-y divide-border'>
        {selectedIds.map((schoolId) => {
          const campus = byId.get(Number(schoolId)) || {}
          const program = programById.get(Number(schoolId)) || {}
          const required = asNumber(campus.requirements_required, campus.receivers_required)
          const satisfied = asNumber(campus.requirements_satisfied, campus.receivers_satisfied)
          const pct = asNumber(campus.completion_pct, campus.coverage_pct)
            ?? (required ? (100 * satisfied) / required : null)
          const complete = campus.strict_complete === true || campus.complete === true
            || campus.fully_satisfiable === true || (required != null && satisfied >= required)
          const localComplete = campus.product_complete === true
          const baselineTerms = asNumber(campus.estimated_terms)
          const baselineCourses = asNumber(campus.distinct_courses, campus.course_count)
          return (
            <div key={schoolId} className='py-3 first:pt-0 last:pb-0'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-body-strong text-ink'>{shortenSchool(campus.school || program.school || nameById.get(Number(schoolId)) || `Campus ${schoolId}`)}</p>
                <Badge variant={complete ? 'success' : 'neutral'}>
                  {complete ? 'Full agreement covered' : localComplete ? 'Local coursework covered' : 'Data needs review'}
                </Badge>
              </div>
              <p className='mt-0.5 text-caption text-ink-subtle'>{campus.major || program.program || program.major || 'Configured computer science program'}</p>
              {(baselineCourses != null || baselineTerms != null) && (
                <p className='mt-1 text-tag text-ink-muted'>
                  {baselineCourses == null ? null : `${numFmt.format(baselineCourses)} ${plural(baselineCourses, 'course')}`}
                  {baselineCourses != null && baselineTerms != null ? ' · ' : null}
                  {baselineTerms == null ? null : `${numFmt.format(baselineTerms)} ${termNoun(rowSystem(row), baselineTerms)} on its own`}
                </p>
              )}
              {pct != null && (
                <div className='mt-2'>
                  <div className='h-1.5 overflow-hidden rounded-pill bg-surface-sunken'>
                    <div className='h-full rounded-pill bg-primary' style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                  </div>
                  <p className='mt-1 text-tag text-ink-muted'>
                    {required != null && satisfied != null
                      ? `${intFmt.format(satisfied)} of ${intFmt.format(required)} required blocks modeled`
                      : `${numFmt.format(pct)}% of required preparation modeled`}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function CourseTable({ courses, nameById }) {
  const byId = new Map(courses.map((course) => [String(course.course_id), course]))
  return (
    <div className='surface-card overflow-auto' data-export-exclude>
      <table className='min-w-full border-separate border-spacing-0'>
        <thead>
          <tr>
            {['Course', 'Title', 'Units', 'Modeled term', 'Role', 'Needed for', 'Prerequisites', 'Evidence'].map((heading, index) => (
              <th key={heading} className={`border-b border-border px-3 py-2 text-label ${index < 2 ? 'text-left' : 'text-right'}`}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const schoolIds = course.school_ids || course.campus_ids || []
            const prereqIds = course.prerequisite_ids || []
            const prerequisites = prereqIds.map((id) => courseCode(byId.get(String(id)) || { course_id: id })).join(', ')
            return (
              <tr key={course.course_id || courseCode(course)} className='hover:bg-surface-hover'>
                <td className='border-b border-border px-3 py-2 text-caption font-[650] text-ink whitespace-nowrap'>{courseCode(course)}</td>
                <td className='max-w-xs border-b border-border px-3 py-2 text-caption text-ink-muted'>{course.title || '—'}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption font-mono tabular-nums'>{displayNumber(course.units)}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption font-mono tabular-nums'>{displayNumber(course.modeled_term || course.term)}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption text-ink-muted'>{ROLE_LABELS[course.role] || course.role || 'Major preparation'}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption text-ink-muted'>{schoolIds.length ? schoolIds.map((id) => shortenSchool(nameById.get(Number(id)) || id)).join(', ') : 'Shared plan'}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption text-ink-muted'>{prerequisites || 'None modeled'}</td>
                <td className='border-b border-border px-3 py-2 text-right text-caption text-ink-muted'>{course.evidence || course.source_status || 'Documented'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MethodCaveat() {
  return (
    <div role='note' className='rounded-xl border border-border bg-surface-muted px-4 py-3 text-caption text-ink-muted'>
      <span className='font-[650] text-ink'>This is an optimistic preparation model, not a prediction of time to degree.</span>{' '}
      It schedules the required lower division preparation that has a usable local path in the selected ASSIST agreements and flags preparation the college cannot articulate. It assumes every selected course is offered every term without conflicts. It does not model general education, associate degree completion, admission, seats, repeated courses, or university coursework after transfer.
    </div>
  )
}

export function MultiCampusPathwaysPreview() {
  return (
    <div className='surface-card p-6'>
      <p className='text-heading text-ink'>Build one plan for several campuses</p>
      <p className='mt-1 text-body text-ink-muted'>Choose goals, a community college, and a unit load.</p>
      <div className='mt-5 flex flex-wrap gap-2'>
        {['Berkeley', 'Davis', 'Los Angeles'].map((campus) => (
          <span key={campus} className='rounded-pill bg-primary-soft px-3 py-1.5 text-caption text-primary'>{campus}</span>
        ))}
      </div>
      <div className='mt-6 grid grid-cols-2 gap-4'>
        <div className='rounded-xl border border-border bg-surface-muted p-4'>
          <p className='text-label text-ink-subtle'>Across colleges</p>
          <p className='mt-2 text-title text-ink'>Compare typical terms</p>
          <div className='mt-5 flex h-16 items-end gap-2'>
            {[35, 65, 100, 72, 42].map((height, index) => (
              <span key={index} className='flex-1 rounded-t-sm bg-primary' style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className='rounded-xl border border-border bg-surface-muted p-4'>
          <p className='text-label text-ink-subtle'>At one college</p>
          <p className='mt-2 text-title text-ink'>See the course sequence</p>
          <div className='mt-5 flex gap-2'>
            {['Term 1', 'Term 2', 'Term 3'].map((term) => (
              <span key={term} className='flex-1 rounded-lg border border-border bg-surface px-2 py-4 text-center text-caption text-ink-muted'>{term}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MultiCampusPathways() {
  const [mode, setMode] = useState('average')
  const [selectedIds, setSelectedIds] = useState(null)
  const [appliedIds, setAppliedIds] = useState(null)
  const [collegeId, setCollegeId] = useState(null)
  const [semesterLoad, setSemesterLoad] = useState(15)
  const [quarterLoad, setQuarterLoad] = useState(15)
  const [appliedLoads, setAppliedLoads] = useState({ semester: 15, quarter: 15 })

  const schoolsQ = useSchools()
  const collegesQ = useColleges()
  const schools = useMemo(
    () => (schoolsQ.data?.uc || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [schoolsQ.data],
  )
  const defaultIds = schools.slice(0, 2).map((school) => Number(school.id))
  const effectiveIds = (selectedIds ?? defaultIds).slice().sort((a, b) => a - b)
  const appliedEffectiveIds = (appliedIds ?? defaultIds).slice().sort((a, b) => a - b)
  const colleges = Array.isArray(collegesQ.data) ? collegesQ.data : (collegesQ.data?.rows || [])
  const selectedCollege = colleges.find((college) => Number(college.id ?? college.source_id) === Number(collegeId)) || null
  const collegeReady = appliedEffectiveIds.length > 0 && collegeId != null
  const parsedSemesterLoad = Number(semesterLoad)
  const parsedQuarterLoad = Number(quarterLoad)
  const loadsValid = Number.isFinite(parsedSemesterLoad)
    && parsedSemesterLoad >= 6 && parsedSemesterLoad <= 24
    && Number.isFinite(parsedQuarterLoad)
    && parsedQuarterLoad >= 6 && parsedQuarterLoad <= 30
  const loadsChanged = parsedSemesterLoad !== appliedLoads.semester
    || parsedQuarterLoad !== appliedLoads.quarter
  const targetsChanged = effectiveIds.join(',') !== appliedEffectiveIds.join(',')
  const pendingChanges = loadsChanged || targetsChanged

  const snapshotQuery = useMultiCampusPathwaysSnapshot({
    enabled: mode === 'average',
  })
  const rejectedSnapshotStatus = mode === 'average'
    ? failClosedSnapshotStatus(snapshotQuery.error)
    : null
  const collegeQuery = useMultiCampusPathways({
    mode: 'college',
    schoolIds: appliedEffectiveIds,
    communityCollegeId: collegeId,
    semesterLoad: appliedLoads.semester,
    quarterLoad: appliedLoads.quarter,
  }, {
    enabled: mode === 'college' && collegeReady,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const averageData = useMemo(
    () => rejectedSnapshotStatus
      ? null
      : materializeAverageSnapshot(snapshotQuery.data, effectiveIds),
    [snapshotQuery.data, rejectedSnapshotStatus, effectiveIds.join(',')],
  )
  const averageSnapshot = averageData?.snapshot || {}
  const averageGeneratedDate = fmtDate(averageSnapshot.generated_at)
  const query = mode === 'average' ? snapshotQuery : collegeQuery

  const nameById = useMemo(
    () => new Map(schools.map((school) => [Number(school.id), school.name])),
    [schools],
  )

  const toggleSchool = (rawId) => {
    const id = Number(rawId)
    const current = [...effectiveIds]
    const at = current.indexOf(id)
    if (at >= 0) {
      if (current.length === 1) return
      current.splice(at, 1)
    } else {
      current.push(id)
    }
    setSelectedIds(current.sort((a, b) => a - b))
  }

  const changeMode = (nextMode) => {
    if (nextMode === 'college') setAppliedIds([...effectiveIds])
    setMode(nextMode)
  }

  const controls = (
    <div className='surface-card p-4' data-export-exclude>
      <div className='flex flex-wrap items-end gap-x-6 gap-y-4'>
        <div className='flex flex-col gap-1.5'>
          <span className='field-label'>View</span>
          <Tabs value={mode} onChange={changeMode} options={MODE_OPTIONS} />
        </div>
        {mode === 'college' && (
          <div className='flex w-80 max-w-full flex-col gap-1.5'>
            <span className='field-label'>Community college</span>
            <Combobox
              value={collegeId}
              onChange={(value) => setCollegeId(Number(value))}
              options={colleges.map((college) => ({
                value: Number(college.id ?? college.source_id),
                label: college.name || college.community_college,
              }))}
              placeholder='Choose a college'
            />
          </div>
        )}
        {mode === 'average' ? (
          <>
            <div className='flex flex-col gap-1.5'>
              <span className='field-label'>Precomputed term load</span>
              <p className='text-caption text-ink'>
                {averageSnapshot.semester_load == null
                  ? 'Loading assumptions'
                  : `${numFmt.format(averageSnapshot.semester_load)} units per semester · ${numFmt.format(averageSnapshot.quarter_load)} units per quarter`}
              </p>
              {averageGeneratedDate && <p className='text-tag text-ink-subtle'>Generated {averageGeneratedDate}</p>}
            </div>
            <Button
              variant='secondary'
              leadingIcon={ArrowPathIcon}
              loading={snapshotQuery.isFetching && !snapshotQuery.isLoading}
              onClick={() => snapshotQuery.refetch()}
            >
              Reload saved snapshot
            </Button>
          </>
        ) : (
          <>
            <Input
              label='Units per semester'
              type='number'
              min='6'
              max='24'
              step='0.5'
              value={semesterLoad}
              onChange={(event) => setSemesterLoad(event.target.value)}
              className='w-28'
            />
            <Input
              label='Units per quarter'
              type='number'
              min='6'
              max='30'
              step='0.5'
              value={quarterLoad}
              onChange={(event) => setQuarterLoad(event.target.value)}
              className='w-28'
            />
            <Button
              variant='secondary'
              leadingIcon={ArrowPathIcon}
              loading={collegeQuery.isFetching && !collegeQuery.isLoading}
              disabled={!effectiveIds.length || collegeId == null || !loadsValid}
              onClick={() => {
                if (pendingChanges) {
                  setAppliedIds([...effectiveIds])
                  setAppliedLoads({ semester: parsedSemesterLoad, quarter: parsedQuarterLoad })
                } else {
                  collegeQuery.refetch()
                }
              }}
            >
              {pendingChanges ? 'Update estimate' : 'Refresh'}
            </Button>
          </>
        )}
      </div>

      <div className='mt-4 flex flex-col gap-1.5 border-t border-border pt-4'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <span className='field-label'>Target University of California programs</span>
          <span className='text-caption text-ink-subtle'>{effectiveIds.length} selected · choose one to nine</span>
        </div>
        <Tabs
          multiple
          value={effectiveIds}
          onChange={toggleSchool}
          options={schools.map((school) => ({ value: Number(school.id), label: shortenSchool(school.name) }))}
          className='max-w-full flex-wrap'
        />
        <p className='text-caption text-ink-subtle'>Targets are unordered. A course shared by several programs is counted once.</p>
        {mode === 'college' && pendingChanges && <p className='text-caption text-primary'>Changes are ready. Select Update estimate to recalculate.</p>}
      </div>
    </div>
  )

  if (schoolsQ.isLoading || collegesQ.isLoading) return <AnalysisLoading />
  if (schoolsQ.isError || collegesQ.isError) return <Alert type='error'>Could not load the college and campus choices.</Alert>

  if (mode === 'college' && collegeId == null) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='Choose a community college' description='Select a college to build its combined preparation plan and modeled course sequence.' className='p-8' />
        <MethodCaveat />
      </Stack>
    )
  }

  if (rejectedSnapshotStatus) {
    return (
      <Stack gap='section'>
        {controls}
        <Alert type='error'>
          {rejectedSnapshotStatus === 409
            ? 'The saved snapshot no longer matches the current working program selection. Regenerate it before using the average view.'
            : 'You no longer have access to the saved multi-campus snapshot.'}
        </Alert>
        <MethodCaveat />
      </Stack>
    )
  }

  if (query.isLoading && !query.data) {
    return (
      <Stack gap='section'>
        {controls}
        <AnalysisLoading />
        <MethodCaveat />
      </Stack>
    )
  }
  if (query.isError && !query.data) {
    return (
      <Stack gap='section'>
        {controls}
        <Alert type='error'>
          {mode === 'average'
            ? 'Could not load the precomputed multi-campus snapshot.'
            : 'Could not calculate the multi-campus preparation plan.'}
        </Alert>
        <MethodCaveat />
      </Stack>
    )
  }

  const data = mode === 'average' ? (averageData || {}) : (collegeQuery.data || {})
  const rows = data.rows || []
  const programs = data.programs || []
  const specificRow = data.row || data.college || rows[0] || null

  if (mode === 'average' && snapshotQuery.data && !averageData) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='Snapshot needs regeneration' description='This campus combination is not present in the saved statewide snapshot.' className='p-8' />
        <MethodCaveat />
      </Stack>
    )
  }
  if (mode === 'average' && !rows.length) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='No colleges can be modeled' description='Try another combination of target programs.' className='p-8' />
        <MethodCaveat />
      </Stack>
    )
  }
  if (mode === 'college' && !specificRow) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='No plan is available' description='This college does not have usable agreements for the selected targets.' className='p-8' />
        <MethodCaveat />
      </Stack>
    )
  }

  if (mode === 'average') {
    const summary = data.summary || {}
    const semester = calendarModel(data, rows, 'semester')
    const quarter = calendarModel(data, rows, 'quarter')
    const meanUnits = asNumber(summary.mean_semester_equiv_units)
      ?? mean(rows.map((row) => asNumber(combinedFor(row).semester_equiv_units)).filter(Number.isFinite))
    const meanCourses = asNumber(summary.mean_distinct_courses)
      ?? mean(rows.map(coursesFor).filter(Number.isFinite))
    const meanMajorCourses = asNumber(summary.mean_major_courses)
    const meanPrerequisiteCourses = asNumber(summary.mean_prerequisite_courses)
    const meanPremium = asNumber(summary.mean_optionality_premium_courses)
      ?? mean(rows.map(premiumFor).filter(Number.isFinite))
    const typicalParts = [
      semester.n && semester.median != null ? `${numFmt.format(semester.median)} semesters` : null,
      quarter.n && quarter.median != null ? `${numFmt.format(quarter.median)} quarters` : null,
    ].filter(Boolean)
    return (
      <Stack gap='section'>
        {controls}
        <div data-export-root className='flex flex-col gap-6'>
          <StatStrip tiles={[
            { label: 'Colleges analyzed', value: intFmt.format(asNumber(summary.colleges_analyzed) ?? rows.length), sub: [summary.colleges_exact != null ? `${intFmt.format(summary.colleges_exact)} exact local plans` : null, summary.colleges_excluded ? `${intFmt.format(summary.colleges_excluded)} unavailable` : null].filter(Boolean).join(' · ') || null },
            { label: 'Mean coursework', value: meanUnits == null ? '—' : `${numFmt.format(meanUnits)} units`, sub: summary.mean_semester_equiv_units_n ? `semester equivalent · n=${intFmt.format(summary.mean_semester_equiv_units_n)}` : 'semester equivalent', accent: true },
            { label: 'Mean distinct courses', value: displayNumber(meanCourses), sub: meanMajorCourses != null && meanPrerequisiteCourses != null ? `${numFmt.format(meanMajorCourses)} preparation + ${numFmt.format(meanPrerequisiteCourses)} prerequisite${summary.mean_distinct_courses_n ? ` · n=${intFmt.format(summary.mean_distinct_courses_n)}` : ''}` : `${effectiveIds.length} selected ${plural(effectiveIds.length, 'program')}${summary.mean_distinct_courses_n ? ` · n=${intFmt.format(summary.mean_distinct_courses_n)}` : ''}` },
            { label: 'Courses added for more campus options', value: meanPremium == null ? 'Not available' : signedNumber(meanPremium, ' courses'), sub: meanPremium == null ? 'requires comparable complete baselines' : `beyond the largest one-campus plan${summary.mean_optionality_premium_courses_n ? ` · n=${intFmt.format(summary.mean_optionality_premium_courses_n)}` : ''}` },
          ]} />
          <p className='text-caption text-ink-muted'>
            Model inputs: {effectiveIds.length} selected {plural(effectiveIds.length, 'program')} · {numFmt.format(averageSnapshot.semester_load)} units per semester · {numFmt.format(averageSnapshot.quarter_load)} units per quarter · unweighted college averages
            {averageGeneratedDate ? ` · snapshot generated ${averageGeneratedDate}` : ''}
          </p>
          <div className='grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]'>
            <section className='surface-card p-4'>
              <div className='flex flex-wrap items-baseline justify-between gap-2'>
                <div>
                  <h3 className='text-heading text-ink'>Estimated regular terms across colleges</h3>
                  <p className='mt-1 text-caption text-ink-subtle'>Separate calendars keep semester and quarter counts comparable on their own terms.</p>
                </div>
                <p className='text-caption text-ink-muted'>{typicalParts.join(' · ') || 'No exact term estimates'}</p>
              </div>
              <div className='mt-4 grid gap-4 lg:grid-cols-2'>
                <TermDistribution model={semester} />
                <TermDistribution model={quarter} />
              </div>
            </section>
            <SelectedPrograms programs={programs} selectedIds={effectiveIds} nameById={nameById} />
          </div>
          <MethodCaveat />
        </div>

        <AverageTable rows={rows} targetCount={effectiveIds.length} />
      </Stack>
    )
  }

  const combined = combinedFor(specificRow)
  const system = rowSystem(specificRow)
  const terms = data.terms
    || specificRow.terms
    || (Array.isArray(combined.schedule) ? combined.schedule : combined.schedule?.schedule)
    || []
  const courses = data.courses || specificRow.courses || combined.courses || []
  const premium = premiumFor(specificRow)
  const premiumTerms = asNumber(combined.optionality_premium_terms)
  const majorCourses = asNumber(combined.major_course_count)
  const prerequisiteCourses = asNumber(combined.prerequisite_course_count)
  const specificWarnings = specificRow.warnings || []
  const collegeName = selectedCollege?.name || specificRow.community_college
    || specificRow.college_name || 'Selected college'
  const activeUnitCap = system === 'quarter' ? appliedLoads.quarter : appliedLoads.semester
  const specificScheduleStatus = scheduleFor(specificRow).status
    || combined.schedule_status
    || specificRow.schedule_status
  return (
    <Stack gap='section'>
      {controls}
      <div data-export-root className='flex flex-col gap-6'>
        <StatStrip tiles={[
          { label: 'Community college', value: collegeName, sub: system === 'unknown' ? 'Calendar unavailable' : `${system} calendar` },
          { label: 'Distinct courses', value: displayNumber(coursesFor(specificRow) ?? courses.length), sub: majorCourses == null ? 'shared courses counted once' : `${numFmt.format(majorCourses)} preparation${prerequisiteCourses ? ` + ${numFmt.format(prerequisiteCourses)} prerequisite` : ''}`, accent: true },
          { label: 'Community college units', value: displayNumber(unitsFor(specificRow), ' units'), sub: system === 'unknown' ? 'native units; calendar unavailable' : `native ${system} units` },
          { label: 'Terms for this course set', value: termText(specificRow, system), sub: premium == null ? null : `${signedNumber(premium, ' courses')}${premiumTerms == null ? '' : ` · ${signedNumber(premiumTerms, ` ${termNoun(system, premiumTerms)}`)}`} for multiple targets` },
        ]} />
        <p className='text-caption text-ink-muted'>
          Model inputs: {collegeName} · {appliedEffectiveIds.length} selected {plural(appliedEffectiveIds.length, 'program')} · {numFmt.format(activeUnitCap)} {system === 'unknown' ? 'native' : system} units per term
        </p>
        {!!specificWarnings.length && (
          <Alert type={specificRow.status === 'unavailable' ? 'error' : 'warning'}>
            <ul className='list-disc space-y-1 pl-4'>
              {specificWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </Alert>
        )}
        <div className='grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]'>
          <section className='surface-card p-4'>
            <div>
              <h3 className='text-heading text-ink'>{specificScheduleStatus === 'bounded' ? 'Feasible modeled sequence' : 'Minimum-term sequence for this course set'}</h3>
              <p className='mt-1 text-caption text-ink-subtle'>Prerequisites come first; each term stays within the selected unit load.</p>
            </div>
            <CourseSchedule row={specificRow} terms={terms} courses={courses} />
          </section>
          <CampusPreparation row={specificRow} selectedIds={appliedEffectiveIds} programs={programs} nameById={nameById} />
        </div>
        <MethodCaveat />
      </div>

      {courses.length ? <CourseTable courses={courses} nameById={nameById} /> : null}
    </Stack>
  )
}

export {
  calendarModel, exactTermsFor, premiumFor, termRangeFor, termText,
}
