import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import {
  Panel, StatStrip, Badge, Button, Spinner, Alert, EmptyState, Stack,
  PageContainer, Tabs,
} from '../components/ui'
import SubNav from '../components/SubNav'
import { InstitutionRail, CourseTable, courseSearch, TieredDegreeLedger } from '../DataPage'
// The same progress bar California's validation dashboard uses, so the two
// consoles report the same job the same way.
import { ProgressBar } from '../asdegrees/validation/ValidationDashboard'
import Textarea from '../components/ui/forms/Textarea'
import JsonDocumentPanel from '../shared/JsonDocumentPanel'
import VerifiedBanner from '../shared/components/VerifiedBanner'
import {
  useVaSummary, useVaInstitutions, useVaCourses, useVaCourse, useVaMatrix,
  useVaDegrees, useVaCoverage, useSaveVaDegree, useVaDegreeRevisions,
} from './useVirginia'
import VirginiaPrerequisitesTab, { VirginiaPrerequisiteView } from './VirginiaPrerequisites'

/**
 * Transfer Virginia explorer.
 *
 * Deliberately shaped like the California Data page so a reader familiar with
 * one console finds the same information in the same place in the other:
 *
 *   Overview            — corpus counts and reach (California's dataset summary)
 *   Community Colleges  — college rail → per-college courses and associate
 *                          degrees (California's college-first browser)
 *   Universities        — university rail → per-university courses and
 *                          graduation requirements (California's UC hub)
 *   Courses             — the shared VCCS catalog in one place
 *
 * **Districts** has no Virginia analogue — VCCS is a single system, not 72
 * independent districts. Prerequisites come from the separate VCCS master
 * course source, not from Transfer Virginia's equivalency records; the two
 * authorities remain visibly distinct in the prerequisite views.
 *
 * The last tab exists because of a fact peculiar to this state: the 23 VCCS
 * colleges share one course numbering system, so `CSC221` is the same course
 * everywhere and is worth browsing once, centrally. The per-college Courses tab
 * then answers the different question of which of those a given college
 * actually teaches. Universities do *not* share that numbering — only ~1% of
 * four-year equivalencies keep the VCCS code — which is why the per-university
 * course view leads with the identifier a course lands as.
 *
 * Each institution shows ONE degree. Two sources were captured — the college's
 * own catalog and Transfer Virginia's program map — and both were displayed for
 * a time so a verifier could see disagreement. They did not disagree: where both
 * stated units they matched in 11 of 11 cases, so the richer document now stands
 * alone and carries the other's URL as corroboration. Institutions that publish
 * no machine-readable course list are marked `URL only`: the verified link is
 * the deliverable there.
 */

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'colleges', label: 'Community Colleges' },
  { value: 'universities', label: 'Universities' },
  { value: 'courses', label: 'Courses' },
  { value: 'prerequisites', label: 'Prerequisites' },
]

const TAB_ROUTES = {
  overview: { path: '/api/va/summary' },
  colleges: { path: '/api/va/institutions?level=community_college' },
  universities: { path: '/api/va/institutions?level=four_year&cohort=schev_public_four_year' },
  courses: { path: '/api/va/courses' },
  prerequisites: { path: '/api/va/prerequisite-graph' },
}

const num = (v) => (v == null ? '—' : Number(v).toLocaleString())

const PRIMARY_VA_COHORT = 'schev_public_four_year'
const OTHER_VA_COHORT = 'other_four_year'

export default function VirginiaPage() {
  const [tab, setTab] = useState('overview')
  const [route, setRoute] = useState(TAB_ROUTES.overview)

  const changeTab = (next) => {
    setTab(next)
    setRoute(TAB_ROUTES[next])
  }

  const summary = useVaSummary()
  const imported = summary.data?.imported

  return (
    <div className='h-full flex flex-col'>
      <SubNav tabs={{ value: tab, onChange: changeTab, options: TABS }} route={route} />
      <div className='flex-1 min-h-0 overflow-auto'>
        <PageContainer>
          {/* Guard on the absence of data, not just on the error flag: a
              failed query that never sets `isError` would otherwise fall
              through and every pane below would dereference undefined. */}
          {summary.isLoading ? <div className='py-10 flex justify-center'><Spinner /></div>
            : (summary.isError || summary.error || !summary.data)
              ? <Alert type='error'>Could not load the Virginia corpus.</Alert>
            : imported === false ? <NotImported />
            : (
              <>
                {tab === 'overview' && <OverviewTab summary={summary.data} />}
                {tab === 'colleges' && <CollegesPane onRoute={setRoute} />}
                {tab === 'universities' && <UniversitiesPane onRoute={setRoute} />}
                {tab === 'courses' && <CoursesTab />}
                {tab === 'prerequisites' && <VirginiaPrerequisitesTab />}
              </>
            )}
        </PageContainer>
      </div>
    </div>
  )
}

function NotImported() {
  return (
    <Panel title='The Virginia corpus is not in this database'>
      <p className='text-caption ink-subtle'>
        The API reached a database with no <code>va_courses</code> collection. Either the import has
        not been run against it, or the server is pointed at a different database than the one you
        imported into — check which <code>MONGO_URI</code> the server booted with before re-running
        the import.
      </p>
      <pre className='mt-3 text-[12px] overflow-x-auto rounded bg-black/5 dark:bg-white/5 p-3'>
        node scripts/importVirginiaCourses.js --uri &lt;uri&gt; --db pmt_research
      </pre>
    </Panel>
  )
}

/* ── Overview ────────────────────────────────────────────────────────────── */

/**
 * The landing view leads with what is left to do.
 *
 * Everything here was scraped and none of it has been read by a person yet, so
 * the question a reader arrives with is not how large the corpus is — it is
 * which degrees still need verifying and which are worth distrusting first.
 * The corpus counts stay, below, because they are context rather than the task.
 */
function OverviewTab({ summary }) {
  return (
    <Stack gap='section'>
      <VerificationPanel />
      <StatStrip tiles={[
        { label: 'Courses', value: num(summary.courses) },
        { label: 'Equivalencies', value: num(summary.equivalencies) },
        { label: 'Community colleges', value: num(summary.community_colleges) },
        { label: 'Public universities', value: num(summary.public_four_year ?? summary.four_year) },
        { label: 'Departments', value: num(summary.departments) },
        { label: 'With notes', value: num(summary.with_notes) },
      ]} />
      <ReachPanel />
    </Stack>
  )
}

/**
 * Verification state for one institution, in California's status vocabulary.
 *
 * A document is verified or it is not. `URL only` and `No CS-specific degree`
 * are settled facts about what an institution publishes, not stages of review
 * — they will never carry a tick, and counting them as outstanding would leave
 * the job looking permanently unfinished. The latter wording is deliberate:
 * some colleges publish a broad Science A.S. but no source-prescribed CS path.
 *
 * There is deliberately no "flagged by the parser" state. Whether an extraction
 * tripped a validation rule is the machine's opinion of its own work, and
 * showing it as a category invited reading it as a verdict; a person checking
 * the document against its source page is the only verdict that counts.
 */
const VA_STATE = {
  verified: { label: 'Verified', variant: 'success' },
  in_review: { label: 'Unverified', variant: 'accent' },
  needs_collection: { label: 'Needs collecting', variant: 'conservative' },
  needs_composition: { label: 'Needs composing', variant: 'conservative' },
  url_only: { label: 'URL only', variant: 'conservative' },
  no_program: { label: 'No CS-specific degree', variant: 'neutral' },
}

const VERIFY_ELIGIBLE_COLLECTION_STATUSES = new Set(['catalog_accepted', 'analysis_ready'])

/** Coverage rows keyed by institution slug, so a rail can read its own state. */
const coverageSlugOf = (row) => row?.institution_slug
  || String(row?._id || '').replace(/^va:cov:(cc|uni):/, '')

function buildVerificationIndex(coverage = []) {
  const index = new Map()
  for (const row of coverage) {
    const slug = coverageSlugOf(row)
    const docs = [...(row.documents?.as_degree ?? []), ...(row.documents?.degree ?? [])]
    const readable = docs.filter((d) => d.status === 'extracted')
    const state = row.collection_status === 'no_program'
      ? 'no_program'
      : row.collection_status === 'catalog_url_only'
        ? 'url_only'
        : row.collection_status === 'captured_needs_review'
          ? 'needs_composition'
          : !docs.length || row.collection_status === 'not_collected'
            ? 'needs_collection'
            : !readable.length
              ? (docs.some((d) => d.status === 'no_program') ? 'no_program' : 'url_only')
              : readable.every((d) => d.verified) ? 'verified' : 'in_review'
    index.set(slug, {
      state,
      documents: docs.length,
      readable: readable.length,
      verified: readable.filter((d) => d.verified).length,
      groups: readable[0]?.groups ?? 0,
      receivers: readable[0]?.receivers ?? 0,
    })
  }
  return index
}

const slugOf = (institution) => String(institution?._id || '').replace(/^va:inst:/, '')
  || String(institution?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

function coverageForInstitution(coverage, institution) {
  if (!institution) return null
  const wanted = slugOf(institution)
  return (coverage?.coverage ?? []).find((row) => coverageSlugOf(row) === wanted) ?? null
}

/**
 * The overview states progress and stops there.
 *
 * An earlier version put the whole worklist here as a table, which buried the
 * one number a reader wants behind six columns they did not ask for. Working
 * through the degrees happens in the rails, where the degree itself is one
 * click away; this panel only answers "how much is left".
 */
function VerificationPanel() {
  const { data, isLoading, isError } = useVaCoverage()

  const levels = useMemo(() => {
    const rows = data?.coverage ?? []
    const index = buildVerificationIndex(rows)
    return ['community_college', 'four_year'].map((level) => {
      // The public four-year cohort is the Virginia analogue of the UC
      // receiving side. Private/professional partners remain available in the
      // Universities tab, but do not inflate the primary verification job.
      const scoped = rows.filter((r) => r.level === level
        && (level !== 'four_year' || r.cohort === PRIMARY_VA_COHORT))
      const states = scoped.map((r) => index.get(coverageSlugOf(r)))
      const readable = states.filter((s) => s && s.readable)
      return {
        level,
        label: level === 'community_college' ? 'A.S. degrees' : 'B.S. degrees',
        verified: readable.filter((s) => s.state === 'verified').length,
        readable: readable.length,
        needsRecord: states.filter((s) => s
          && (s.state === 'needs_collection' || s.state === 'needs_composition')).length,
      }
    })
  }, [data])

  if (isLoading) return <div className='flex justify-center py-8'><Spinner /></div>
  if (isError || !data?.coverage?.length) return null

  return (
    <Panel title='Verification progress'>
      <p className='text-caption ink-subtle mb-4'>
        A collected Virginia degree is not verified until a person has checked it against every
        cited source layer. Work through them in the Community Colleges and
        Universities tabs, where the status pills filter the list. B.S. progress uses SCHEV's
        15 public four-year institutions; additional Virginia partners stay in the secondary view.
      </p>
      <div className='grid gap-4 sm:grid-cols-2'>
        {levels.map((l) => (
          <div key={l.level}>
            <ProgressBar label={`${l.label} verified`} value={l.verified} total={l.readable} tone='success' />
            <p className='text-tag text-ink-subtle mt-1.5'>
              {l.needsRecord} still need a reviewable catalog record
            </p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/**
 * The status pills above a rail, as filters.
 *
 * They already stated the breakdown; making them clickable turns a caption into
 * the way through the work — pick "Unverified" and the rail below holds
 * exactly the institutions still to do, in order.
 */
function RailFilters({ counts, value, onChange, total }) {
  const options = [
    { key: 'all', label: 'All', count: total, variant: 'neutral' },
    { key: 'needs_collection', label: VA_STATE.needs_collection.label, count: counts.needs_collection, variant: VA_STATE.needs_collection.variant },
    { key: 'needs_composition', label: VA_STATE.needs_composition.label, count: counts.needs_composition, variant: VA_STATE.needs_composition.variant },
    { key: 'in_review', label: VA_STATE.in_review.label, count: counts.in_review, variant: VA_STATE.in_review.variant },
    { key: 'verified', label: VA_STATE.verified.label, count: counts.verified, variant: VA_STATE.verified.variant },
    { key: 'url_only', label: VA_STATE.url_only.label, count: counts.url_only, variant: VA_STATE.url_only.variant },
    { key: 'no_program', label: VA_STATE.no_program.label, count: counts.no_program, variant: VA_STATE.no_program.variant },
  ].filter((o) => o.key === 'all' || o.count > 0)

  return (
    <div role='group' aria-label='Filter by verification state'
      className='surface-card px-3 py-2.5 flex flex-wrap items-center gap-1.5'>
      {options.map((o) => {
        const active = value === o.key
        return (
          <button key={o.key} type='button' aria-pressed={active}
            onClick={() => onChange(active && o.key !== 'all' ? 'all' : o.key)}
            className={`rounded-pill transition-opacity ${active ? '' : 'opacity-55 hover:opacity-100'}`}>
            <Badge variant={active ? o.variant : 'neutral'}>{o.label} {o.count}</Badge>
          </button>
        )
      })}
    </div>
  )
}

function ReachPanel() {
  const { data, isLoading, isError } = useVaMatrix(PRIMARY_VA_COHORT)
  if (isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (isError) return <Alert type='error'>Could not load reach.</Alert>
  if (!data?.colleges?.length) return null

  const { colleges, receivers, cells } = data
  const max = Math.max(1, ...cells.flat())

  return (
    <Panel title='Reach — shared courses by college and public university'>
      <p className='text-caption ink-subtle mb-3'>
        Each cell counts courses the college teaches that the university publishes an equivalency
        for, out of {num(data.courses)}. It is a count of accepted courses, not a claim that any
        degree is satisfied. The receiving columns are SCHEV's 15 public four-year institutions;
        schools with no captured equivalencies remain visible as zero columns.
      </p>
      <div className='overflow-auto max-h-[68vh]'>
        <table className='text-[11px] border-collapse'>
          <thead>
            <tr>
              <th className='sticky left-0 top-0 z-20 bg-canvas p-1.5' />
              {receivers.map((r) => (
                <th key={r} className='sticky top-0 z-10 bg-canvas p-1 align-bottom'>
                  <div className='whitespace-nowrap [writing-mode:vertical-rl] rotate-180 h-[128px] ink-subtle'>{r}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colleges.map((c, ri) => (
              <tr key={c}>
                <th className='sticky left-0 z-10 bg-canvas text-left font-normal p-1.5 whitespace-nowrap'>{c}</th>
                {cells[ri].map((v, ci) => (
                  <td key={ci} title={`${c} → ${receivers[ci]}: ${v}`}
                    className='p-0 text-center tabular-nums'
                    style={{
                      background: v ? `rgba(103,178,73,${0.10 + 0.62 * (v / max)})` : 'transparent',
                      minWidth: 26, height: 22,
                    }}>
                    {v || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/**
 * Rail items carrying their verification state, plus the counts behind the
 * filter pills.
 *
 * The verification state lives in the coverage response rather than in the
 * institutions one, so it is joined here on the slug both sides derive from the
 * same name. An institution the coverage list does not know about still
 * appears — a missing row is not evidence that a college has no degree, and
 * dropping it from the rail would hide it from the person doing the work.
 */
function useRailItems(institutions, coverage, filter) {
  return useMemo(() => {
    const index = buildVerificationIndex(coverage?.coverage ?? [])
    const rows = institutions.map((i) => {
      const state = index.get(slugOf(i)) || null
      // Nothing is repeated under the name: not the equivalency reach, not the
      // degree's status, not its size. The filter pills above already say which
      // bucket the list is showing, and a rail of bare names is the point.
      return {
        id: i.name,
        name: i.name,
        subtitle: null,
        state: state?.state ?? null,
      }
    })

    const counts = {
      needs_collection: rows.filter((r) => r.state === 'needs_collection').length,
      needs_composition: rows.filter((r) => r.state === 'needs_composition').length,
      in_review: rows.filter((r) => r.state === 'in_review').length,
      verified: rows.filter((r) => r.state === 'verified').length,
      url_only: rows.filter((r) => r.state === 'url_only').length,
      no_program: rows.filter((r) => r.state === 'no_program').length,
    }

    const match = filter === 'all' ? () => true : (r) => r.state === filter

    return { items: rows.filter(match), counts, total: rows.length }
  }, [institutions, coverage, filter])
}

/* ── Community Colleges ──────────────────────────────────────────────────── */

function CollegesPane({ onRoute }) {
  const { data, isLoading, isError } = useVaInstitutions('community_college')
  const [selected, setSelected] = useState(null)
  const [subTab, setSubTab] = useState('courses')
  const [filter, setFilter] = useState('all')

  const coverage = useVaCoverage()
  const colleges = data?.institutions ?? []
  const { items, counts, total } = useRailItems(colleges, coverage.data, filter)
  const current = colleges.find((i) => i.name === selected) || null
  const currentCoverage = coverageForInstitution(coverage.data, current)

  useEffect(() => {
    if (!selected) return onRoute({ path: '/api/va/institutions?level=community_college' })
    onRoute({
      path: subTab === 'courses'
        ? `/api/va/courses?college=${encodeURIComponent(selected)}`
        : subTab === 'prerequisites'
          ? `/api/va/prerequisite-graph?college=${encodeURIComponent(selected)}`
          : `/api/va/degrees?institution=${encodeURIComponent(selected)}`,
    })
  }, [onRoute, selected, subTab])

  if (isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (isError) return <Alert type='error'>Failed to load the community colleges.</Alert>

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start'>
      <Stack gap='tight'>
        <RailFilters counts={counts} total={total} value={filter} onChange={setFilter} />
        <InstitutionRail items={items} selectedId={selected} title='Community colleges'
        onSelect={setSelected} itemSubtitle={(i) => i.subtitle} />
      </Stack>

      {!current ? (
        <EmptyState title='Choose a college'
          description='Pick one to see the courses it offers and its associate degrees.' />
      ) : (
        <Stack gap='cozy'>
          <Tabs value={subTab} onChange={setSubTab} options={[
            { value: 'courses', label: 'Courses' },
            { value: 'degrees', label: 'Associate Degrees' },
            { value: 'prerequisites', label: 'Prerequisites' },
          ]} />
          {subTab === 'courses' && <CollegeCourses college={current.name} />}
          {subTab === 'degrees' && <DegreesPane kind='associate' institution={current.name}
            coverageRow={currentCoverage} />}
          {subTab === 'prerequisites' && <VirginiaPrerequisiteView college={current.name} />}
        </Stack>
      )}
    </div>
  )
}

/**
 * Search bar + row count + hairline table, matching the Data page's CourseList
 * exactly — same pill input, same "N courses" counter, same shared CourseTable.
 * Kept here rather than reusing CourseList itself because that one takes a
 * `useCourses(institutionId)` hook shape, and these views key off a name plus a
 * side (offering college vs receiving university).
 */
function VaCourseList({ rows, isLoading, isError, columns, searchFields, placeholder, resetKey, note }) {
  const [q, setQ] = useState('')
  useEffect(() => { setQ('') }, [resetKey])

  const visible = useMemo(() => courseSearch(rows, q, searchFields), [rows, q, searchFields])

  return (
    <Stack gap='cozy'>
      {note && <p className='text-caption text-ink-subtle'>{note}</p>}
      <div className='flex flex-wrap items-center gap-3.5'>
        <label className='flex-none w-[340px] flex items-center gap-2 bg-surface border border-border rounded-pill px-[15px] py-[9px]'>
          <MagnifyingGlassIcon className='w-[14px] h-[14px] text-ink-subtle shrink-0' />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label='Search courses'
            placeholder={placeholder}
            className='flex-1 min-w-0 bg-transparent outline-none border-none text-caption ink-default placeholder:text-ink-subtle' />
        </label>
        {!isLoading && <span className='text-caption text-ink-subtle'>{visible.length} courses</span>}
      </div>
      {isLoading ? <div className='flex justify-center py-8'><Spinner /></div>
        : isError ? <Alert type='error'>Failed to load courses.</Alert>
        : visible.length ? <CourseTable rows={visible} columns={columns} />
        : <EmptyState title='No courses' description='No catalog rows here.' />}
    </Stack>
  )
}

// Column defs, in the Data page's shape: a bold tabular code, a muted
// truncating title, muted tabular numbers.
const VA_CC_COURSE_COLUMNS = [
  { key: 'code', label: 'Course', width: '120px', variant: 'code' },
  { key: 'title', label: 'Title', variant: 'title' },
  { key: 'credits', label: 'Credits', width: '80px', align: 'right', variant: 'num', render: (r) => r.credits ?? '—' },
  { key: 'department', label: 'Department', width: '170px', variant: 'title' },
  { key: 'four_year', label: 'Universities', width: '110px', align: 'right', variant: 'num', render: (r) => r.counts?.four_year ?? '—' },
]

// The receiving side leads with what the course lands as: universities do not
// share the VCCS numbering, so that identifier is the join key into their own
// catalog and is the reason to open this view at all.
const VA_UNI_COURSE_COLUMNS = [
  { key: 'code', label: 'VCCS course', width: '120px', variant: 'code' },
  { key: 'title', label: 'Title', variant: 'title' },
  { key: 'credits', label: 'Credits', width: '80px', align: 'right', variant: 'num', render: (r) => r.credits ?? '—' },
  { key: 'lands_as', label: 'Lands as', width: '120px', variant: 'code', render: (r) => r.lands_as?.identifier ?? '—' },
  { key: 'their_title', label: 'Their title', variant: 'title', render: (r) => r.lands_as?.name ?? '—' },
  { key: 'notes', label: 'Notes', width: '220px', variant: 'title', render: (r) => r.lands_as?.notes ?? '' },
]

function CollegeCourses({ college }) {
  const { data, isLoading, isError } = useVaCourses({ college, limit: 2000 })
  return (
    <VaCourseList
      rows={data?.courses ?? []} isLoading={isLoading} isError={isError}
      columns={VA_CC_COURSE_COLUMNS} searchFields={['code', 'title', 'department']}
      placeholder='Search code / title…' resetKey={college}
      note={`Courses from the corpus that this college's catalog carries. Every VCCS college numbers these identically, so the codes are shared — what differs is which ones are taught here.`}
    />
  )
}

/* ── Universities ────────────────────────────────────────────────────────── */

function UniversityCohortFilters({ value, onChange, publicCount, otherCount }) {
  const options = [
    {
      key: PRIMARY_VA_COHORT,
      label: 'Public universities',
      count: publicCount,
      variant: 'accent',
    },
    {
      key: OTHER_VA_COHORT,
      label: 'Other Virginia partners',
      count: otherCount,
      variant: 'neutral',
    },
  ]

  return (
    <div role='group' aria-label='Choose university cohort'
      className='surface-card px-3 py-2.5 flex flex-wrap items-center gap-1.5'>
      {options.map((option) => {
        const active = value === option.key
        return (
          <button key={option.key} type='button' aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={`rounded-pill transition-opacity ${active ? '' : 'opacity-55 hover:opacity-100'}`}>
            <Badge variant={active ? option.variant : 'neutral'}>
              {option.label} {option.count}
            </Badge>
          </button>
        )
      })}
    </div>
  )
}

function UniversitiesPane({ onRoute }) {
  const [cohort, setCohort] = useState(PRIMARY_VA_COHORT)
  const { data, isLoading, isError } = useVaInstitutions('four_year', cohort)
  const [selected, setSelected] = useState(null)
  const [subTab, setSubTab] = useState('courses')
  const [filter, setFilter] = useState('all')

  const coverage = useVaCoverage()
  const unis = data?.institutions ?? []
  const publicCount = data?.cohorts?.[PRIMARY_VA_COHORT]?.institution_count
    ?? (cohort === PRIMARY_VA_COHORT ? unis.length : 0)
  const otherCount = data?.cohorts?.[OTHER_VA_COHORT]?.institution_count
    ?? (cohort === OTHER_VA_COHORT ? unis.length : 0)
  const { items, counts, total } = useRailItems(unis, coverage.data, filter)
  const current = unis.find((i) => i.name === selected) || null
  const currentCoverage = coverageForInstitution(coverage.data, current)

  const changeCohort = (next) => {
    setCohort(next)
    setSelected(null)
    setFilter('all')
  }

  useEffect(() => {
    if (!selected) return onRoute({ path: `/api/va/institutions?level=four_year&cohort=${cohort}` })
    onRoute({
      path: subTab === 'courses'
        ? `/api/va/courses?receiver=${encodeURIComponent(selected)}`
        : subTab === 'prerequisites'
          ? `/api/va/prerequisite-graph?university=${encodeURIComponent(selected)}`
          : `/api/va/degrees?institution=${encodeURIComponent(selected)}`,
    })
  }, [cohort, onRoute, selected, subTab])

  if (isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (isError) return <Alert type='error'>Failed to load the universities.</Alert>

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start'>
      <Stack gap='tight'>
        <UniversityCohortFilters value={cohort} onChange={changeCohort}
          publicCount={publicCount} otherCount={otherCount} />
        <p className='px-1 text-tag text-ink-subtle'>
          {cohort === PRIMARY_VA_COHORT
            ? 'Primary comparison cohort: all 15 SCHEV public four-year institutions.'
            : 'Secondary research retained for private and other Virginia transfer partners.'}
        </p>
        <RailFilters counts={counts} total={total} value={filter} onChange={setFilter} />
        <InstitutionRail items={items} selectedId={selected}
          title={cohort === PRIMARY_VA_COHORT ? 'Public universities' : 'Other Virginia partners'}
        onSelect={setSelected} itemSubtitle={(i) => i.subtitle} />
      </Stack>

      {!current ? (
        <EmptyState title='Choose a university'
          description='Pick one to see the courses it accepts and its graduation requirements.' />
      ) : (
        <Stack gap='cozy'>
          <Tabs value={subTab} onChange={setSubTab} options={[
            { value: 'courses', label: 'Courses' },
            { value: 'requirements', label: 'Graduation Requirements' },
            // The tab says what the content IS; that it is VCCS preparation
            // rather than this university's own policy is a qualifier, and the
            // view carries it as a standing banner.
            { value: 'prerequisites', label: 'Prerequisites' },
          ]} />
          {subTab === 'courses' && <UniversityCourses university={current.name} />}
          {subTab === 'requirements' && <DegreesPane kind='bachelor' institution={current.name}
            coverageRow={currentCoverage} />}
          {subTab === 'prerequisites' && <VirginiaPrerequisiteView university={current.name} />}
        </Stack>
      )}
    </div>
  )
}

function UniversityCourses({ university }) {
  const { data, isLoading, isError } = useVaCourses({ receiver: university, limit: 2000 })
  // Searchable by either side's code, since the whole point of this view is
  // moving between the two numbering systems.
  const rows = useMemo(
    () => (data?.courses ?? []).map((c) => ({ ...c, _landsAs: c.lands_as?.identifier ?? '' })),
    [data]
  )
  return (
    <VaCourseList
      rows={rows} isLoading={isLoading} isError={isError}
      columns={VA_UNI_COURSE_COLUMNS} searchFields={['code', 'title', '_landsAs']}
      placeholder='Search either code / title…' resetKey={university}
      note={`What each VCCS course lands as here. Universities do not share the VCCS numbering — barely 1% of four-year equivalencies keep the original code — so the identifier below is the join key against this institution's own catalog.`}
    />
  )
}

/* ── Degrees (not yet imported) ──────────────────────────────────────────── */

/**
 * A CS degree for one institution.
 *
 * Two sources can exist for the same school and both are shown: the
 * institution's own catalog (the spine) and Transfer Virginia's program map
 * (corroboration). They are never merged, and corroboration or parser-only
 * records remain visibly incomplete until the catalog-acceptance gate passes.
 *
 * `url_only` is a real outcome, not a failure: some institutions publish no
 * machine-readable course list at the configured official source, so the
 * verified URL is the deliverable and the pane says so.
 */
function findingSourceUrl(source) {
  return source?.url || source?.final_url || source?.requested_url || source?.retrieval_url || null
}

function shortHash(value) {
  const hash = String(value || '')
  return hash.length > 16 ? `${hash.slice(0, 16)}…` : hash
}

function ProgramFindingPanel({ institution, coverageRow, kind }) {
  const finding = coverageRow.program_finding
  const sources = coverageRow.finding_sources ?? []
  const evidence = Array.isArray(finding.evidence) ? finding.evidence : []
  const alternate = finding.alternate_path ?? null
  const alternateTitle = alternate?.title || alternate?.program
  const alternateSource = sources.find((source) => alternate?.source_refs?.includes(source.id))
  const alternateUrl = alternate?.url || findingSourceUrl(alternateSource)
  const alternateDoesNotDefineCs = alternate?.supports_cs_transfer_pathway === false
    || alternate?.computer_science_alignment === 'not_defined_by_current_catalog'

  return (
    <Panel
      title={kind === 'associate' ? 'Associate-degree catalog finding' : 'Graduation-requirement catalog finding'}
      action={<Badge variant={coverageRow.finding_complete ? 'success' : 'neutral'}>
        {coverageRow.finding_complete ? 'Official evidence resolved' : 'Evidence review incomplete'}
      </Badge>}
    >
      <Stack gap='cozy'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='neutral'>No CS-specific degree</Badge>
          {coverageRow.catalog_year && <span className='text-tag text-ink-subtle'>Catalog {coverageRow.catalog_year}</span>}
        </div>

        <Alert type='info'>
          <div>
            <p className='font-semibold text-ink'>Source-backed current catalog finding</p>
            <p className='mt-1'>{finding.summary}</p>
            <p className='mt-2 text-caption'>
              This is a completed catalog outcome for {institution}, not a degree whose requirements
              still need to be collected.
            </p>
          </div>
        </Alert>

        {evidence.length > 0 && (
          <div>
            <h3 className='text-label mb-2'>What the official catalog shows</h3>
            <ul className='list-disc pl-5 space-y-1 text-body text-ink-muted'>
              {evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}

        {alternate && (
          <div className='surface-sunken rounded-[10px] p-4'>
            <p className='text-tag text-ink-subtle'>Broad alternate path</p>
            <div className='mt-1 flex flex-wrap items-center gap-x-3 gap-y-1'>
              {alternateUrl ? (
                <a href={alternateUrl} target='_blank' rel='noreferrer'
                  className='inline-flex items-center gap-1 text-body font-semibold text-primary hover:underline'>
                  {alternateTitle || 'Official alternate program'}
                  <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5' aria-hidden='true' />
                </a>
              ) : <span className='text-body font-semibold text-ink'>{alternateTitle || 'Official alternate program'}</span>}
              {alternate.award && <span className='text-caption text-ink-subtle'>Award: {alternate.award}</span>}
              {alternate.total_credits != null && (
                <span className='text-caption text-ink-subtle'>{alternate.total_credits} credits</span>
              )}
            </div>
            {alternateDoesNotDefineCs && (
              <p className='mt-2 text-caption text-ink-muted'>
                The current catalog does not define this broad degree as a Computer Science pathway.
              </p>
            )}
          </div>
        )}

        <div>
          <h3 className='text-label mb-2'>Official finding sources</h3>
          {sources.length ? (
            <ul className='divide-y divide-border border-y border-border'>
              {sources.map((source) => {
                const url = findingSourceUrl(source)
                return (
                  <li key={source.id || source.label} className='py-2.5 flex flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      {url ? (
                        <a href={url} target='_blank' rel='noreferrer'
                          className='inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline'>
                          {source.label || source.id || 'Official source'}
                          <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5 shrink-0' aria-hidden='true' />
                        </a>
                      ) : <span className='text-caption font-semibold text-ink'>{source.label || source.id || 'Official source'}</span>}
                      {source.kind && <p className='text-tag text-ink-subtle mt-0.5'>{String(source.kind).replaceAll('_', ' ')}</p>}
                    </div>
                    {source.sha256 && (
                      <span className='text-tag font-mono text-ink-subtle' title={`SHA-256 ${source.sha256}`}>
                        SHA-256 {shortHash(source.sha256)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className='text-caption text-ink-subtle'>The finding does not expose its source records yet.</p>
          )}
        </div>
      </Stack>
    </Panel>
  )
}

function DegreesPane({ institution, kind, coverageRow = null }) {
  const { data, isLoading, isError } = useVaDegrees(institution)
  const docs = data?.degrees ?? []

  if (isLoading) return <div className='flex justify-center py-8'><Spinner /></div>
  if (isError) return <Alert type='error'>Failed to load degrees for {institution}.</Alert>
  if (!docs.length && coverageRow?.program_finding) {
    return <ProgramFindingPanel institution={institution} coverageRow={coverageRow} kind={kind} />
  }
  if (!docs.length) {
    return (
      <Panel title={kind === 'associate' ? 'Associate degrees' : 'Graduation requirements'}>
        <EmptyState title='Nothing collected for this institution'
          description={`No Computer Science degree document exists for ${institution}. Either it does not offer the program, or its requirements have not been gathered yet.`} />
      </Panel>
    )
  }

  return (
    <Stack gap='cozy'>
      {docs.map((d) => (
        <DegreeCard key={d._id} doc={d} institution={institution}
          universityCoursesById={data?.university_courses_by_id || null}
          courses={data?.courses || []} />
      ))}
    </Stack>
  )
}

/**
 * One degree document, with the same hand-edit affordances as a California
 * requirement: edit the stored JSON, mark verified / reopen, and free-text notes.
 *
 * The JSON panel is the point of the page. Everything above it is a rendering of
 * the document, and until the document itself could be corrected there was no
 * way to act on a mistake found while reading — a verifier could record that a
 * degree was wrong but not make it right. The ledger redraws as the JSON is
 * typed, and nothing is written until Save.
 *
 * The verdict itself is stamped server-side from the signed-in user, so what is
 * sent here is only the intent. Notes are never pre-filled or auto-written —
 * they are the verifier's own words, exactly as typed.
 */
function DegreeCard({ doc, institution, universityCoursesById = null, courses = [] }) {
  const save = useSaveVaDegree(institution)
  const [notes, setNotes] = useState(doc.verification?.notes ?? '')
  const [showHistory, setShowHistory] = useState(false)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)
  const revisions = useVaDegreeRevisions(doc._id, showHistory)

  useEffect(() => { setNotes(doc.verification?.notes ?? '') }, [doc._id, doc.verification?.notes])
  // Drop a half-typed draft when a different document loads underneath.
  useEffect(() => { setDraft(null); setError(null); setSaved(null) }, [doc._id])

  // The edited document if one is in hand, otherwise the stored one. The ledger
  // and the JSON panel both read this, so the view above redraws as you type.
  const editDoc = draft && draft._id === doc._id ? draft : doc

  const codes = editDoc.codes_seen ?? []
  const groups = Array.isArray(editDoc.requirement_groups) ? editDoc.requirement_groups : []
  const url = doc.catalog_url || doc.source_url
  const fromCatalog = doc.source === 'institution_catalog'
  const verified = !!doc.verification?.verified
  const dirty = notes !== (doc.verification?.notes ?? '')
  // Read this from the stored record, never `editDoc`: typing a status into the
  // JSON editor must not unlock a signed verdict before the record is saved and
  // accepted. This machine gate stays deliberately separate from the only
  // researcher-facing verdict: verified or unverified.
  const canVerify = doc.acceptance?.accepted === true
    || VERIFY_ELIGIBLE_COLLECTION_STATUSES.has(doc.collection_status)

  const commit = (nextVerified) => save.mutate({
    ...editDoc,
    verification: { ...(editDoc.verification || {}), verified: nextVerified, notes: notes || null },
  })

  /** Save the edited document without touching the verdict. */
  const saveEdits = async () => {
    setError(null)
    setSaved(null)
    try {
      await save.mutateAsync({
        ...editDoc,
        verification: { ...(editDoc.verification || {}), notes: notes || null },
      })
      setDraft(null)
      setSaved('Changes saved.')
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save this degree.')
    }
  }

  return (
    <Panel title={doc.degree_title_seen || doc.program || 'Computer Science'}>
      <div className='flex flex-wrap items-center gap-2 mb-2'>
        <Badge variant={fromCatalog ? 'accent' : 'neutral'}>
          {fromCatalog ? 'institution catalog' : 'Transfer Virginia map'}
        </Badge>
        {doc.total_units != null && <Badge>{doc.total_units} credits</Badge>}
        {doc.status === 'url_only' && <Badge variant='conservative'>URL only</Badge>}
        <Badge variant={verified ? 'success' : 'conservative'}>
          {verified ? 'Verified' : 'Unverified'}
        </Badge>
      </div>

      {/* The same banner the California templates and the associate-degree
          review show, rather than a compact badge. A hand-verified Virginia
          degree is the same kind of claim and now carries the same weight. */}
      {verified && (
        <div className='mb-3'>
          <VerifiedBanner
            verifiers={doc.verification?.verified_by_label}
            verifiedAt={doc.verification?.verified_at}
            subject='This degree has'
            checkedAgainst='the source catalog page'
            reopenLabel='Reopen' />
        </div>
      )}

      {url && (
        <a href={url} target='_blank' rel='noreferrer'
          className='inline-flex items-center gap-1 text-tag underline ink-subtle'>
          Source page <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5' />
        </a>
      )}

      {doc.reconciliation && doc.reconciliation.delta != null && (
        <p className='text-caption ink-subtle mt-2'>
          Credit check: leaf total {doc.reconciliation.leaf_credits} against a stated{' '}
          {doc.reconciliation.stated_total} ({doc.reconciliation.delta > 0 ? '+' : ''}
          {doc.reconciliation.delta}).{' '}
          {doc.reconciliation.within_tolerance ? 'Reconciles.' : 'Worth a close look.'}
        </p>
      )}
      {doc.extraction?.notes && <p className='text-caption ink-subtle mt-1'>{doc.extraction.notes}</p>}

      {/* The same ledger the California degree view uses, driven by the same
          `requirement_groups` shape and the same parent_id course map, so a
          reader moving between the two states reads an identical rendering. */}
      {groups.length ? (
        <div className='mt-3'>
          <p className='text-caption ink-subtle mb-2'>
            {codes.length} courses named on the source page · {groups.length} requirement group(s)
          </p>
          {/* Both lookups: `universityCoursesById` names the requirement on the
              left, `courses` names what satisfies it on the right. Omitting
              either leaves that column rendering raw ids. */}
          <TieredDegreeLedger groups={groups}
            universityCoursesById={universityCoursesById} courses={courses} />
        </div>
      ) : (
        <p className='text-caption ink-subtle mt-3'>
          This institution publishes no machine-readable course list — the source URL above is the
          record, for hand entry.
        </p>
      )}

      <div className='mt-4'>
        <JsonDocumentPanel doc={editDoc} onChange={setDraft}
          ariaLabel='Degree requirements JSON'
          redrawNote='The requirements above redraw as you type.' />
      </div>
      {error && <Alert type='error'>{error}</Alert>}
      {saved && <Alert type='success'>{saved}</Alert>}

      <div className='mt-4 pt-3 border-t border-border'>
        <p className='text-label mb-1.5'>Verification notes</p>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder='Your own notes on this document…' />
        <div className='flex flex-wrap items-center gap-2 mt-2'>
          <Button onClick={saveEdits} disabled={save.isPending || (!draft && !dirty)}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button onClick={() => commit(true)} disabled={save.isPending || !canVerify}>
            {verified ? 'Re-verify' : 'Mark verified'}
          </Button>
          {verified && (
            <Button variant='secondary' onClick={() => commit(false)} disabled={save.isPending}>
              Reopen
            </Button>
          )}
          {dirty && !save.isPending && (
            <Button variant='ghost' onClick={() => commit(verified)}>Save notes</Button>
          )}
          <Button variant='ghost' onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? 'Hide history' : 'History'}
          </Button>
          {save.isPending && <Spinner />}
          {save.isError && <span className='text-caption text-danger'>Save failed.</span>}
        </div>
        {!canVerify && (
          <p className='text-caption ink-subtle mt-2'>
            Verification unavailable: this document has not passed catalog acceptance.
          </p>
        )}

        {showHistory && (
          <div className='mt-3'>
            {revisions.isLoading ? <Spinner />
              : revisions.isError ? <p className='text-caption ink-subtle'>History is admin-only.</p>
              : !revisions.data?.revisions?.length ? <p className='text-caption ink-subtle'>No hand edits yet.</p>
              : (
                <ul className='text-caption ink-subtle space-y-1'>
                  {revisions.data.revisions.map((r) => (
                    <li key={r.id}>
                      {new Date(r.at).toLocaleString()} · {r.by || 'unknown'} ·{' '}
                      {r.created ? 'created' : r.deleted ? 'deleted' : `${r.changes.length} field(s)`}
                      {r.verified ? ' · verified' : ''}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}
      </div>
    </Panel>
  )
}

/* ── Courses (shared VCCS catalog) ───────────────────────────────────────── */

function CoursesTab() {
  const [open, setOpen] = useState(null)
  // The whole shared catalog, unfiltered. It is a few hundred rows — short
  // enough to scroll and read, which is faster than working a filter bar. The
  // limit must clear the corpus outright: the previous default of 200 silently
  // hid the tail of the catalog behind a "200 of 304" counter with no way to
  // reach the rest.
  const courses = useVaCourses({ limit: 2000 })

  if (open) return <CourseDetail code={open} onBack={() => setOpen(null)} />

  const rows = courses.data?.courses ?? []

  return (
    <Stack gap='cozy'>
      <Panel title='The shared VCCS catalog'>
        <p className='text-caption ink-subtle'>
          All 23 community colleges use the same course numbers, so this is one list rather than 23.
          Open a course for the colleges that carry it and the universities that take it.
        </p>
      </Panel>

      {courses.isLoading ? <div className='flex justify-center py-8'><Spinner /></div>
        : courses.isError ? <Alert type='error'>Failed to load courses.</Alert>
        : !rows.length ? <EmptyState title='No courses' description='No catalog rows here.' />
        : <CourseTable rows={rows} columns={VA_CATALOG_COLUMNS} onRowClick={(r) => setOpen(r.code)} />}
    </Stack>
  )
}

// The shared catalog carries both reach counts, since its job is to show how
// widely a course is taught and how widely it is accepted.
const VA_CATALOG_COLUMNS = [
  { key: 'code', label: 'Course', width: '120px', variant: 'code' },
  { key: 'title', label: 'Title', variant: 'title' },
  { key: 'credits', label: 'Credits', width: '80px', align: 'right', variant: 'num', render: (r) => r.credits ?? '—' },
  { key: 'department', label: 'Department', width: '170px', variant: 'title' },
  { key: 'colleges', label: 'Colleges', width: '95px', align: 'right', variant: 'num', render: (r) => r.counts?.offered_by ?? '—' },
  { key: 'universities', label: 'Universities', width: '110px', align: 'right', variant: 'num', render: (r) => r.counts?.four_year ?? '—' },
]

function CourseDetail({ code, onBack }) {
  const { data, isLoading, isError } = useVaCourse(code)
  const c = data?.course

  return (
    <Stack gap='cozy'>
      <div>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={onBack}>Back</Button>
      </div>
      {isLoading ? <div className='py-10 flex justify-center'><Spinner /></div>
        : isError ? <Alert type='error'>Failed to load {code}.</Alert>
        : !c ? <Panel><EmptyState title={`No course ${code}`} /></Panel>
        : (
          <>
            <Panel>
              <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                <h2 className='text-[19px] font-semibold'>{c.code}</h2>
                <span className='text-[15px]'>{c.title}</span>
                {c.credits != null && <Badge variant='accent'>{c.credits} cr</Badge>}
                {c.department && <Badge>{c.department}</Badge>}
              </div>
              {c.description && <p className='mt-2 text-caption ink-subtle max-w-[76ch]'>{c.description}</p>}
              {c.source_url && (
                <a href={c.source_url} target='_blank' rel='noreferrer'
                  className='mt-2 inline-flex items-center gap-1 text-tag underline ink-subtle'>
                  Source page <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5' />
                </a>
              )}
            </Panel>

            <Stack gap='cozy'>
              <p className='text-caption text-ink-subtle'>
                Transfers to {num(c.articulates_to?.length)} universities. The identifier is what
                this course lands as there; notes are the institution's own caveats, verbatim.
              </p>
              <CourseTable rows={c.articulates_to ?? []} columns={VA_EQUIVALENCY_COLUMNS} />
            </Stack>

            <Panel title={`Offered by ${num(c.offered_by?.length)} institutions`}>
              <div className='flex flex-wrap gap-1.5'>
                {(c.offered_by ?? []).map((n) => <Badge key={n}>{n}</Badge>)}
              </div>
            </Panel>

            {!!c.unrecognised_levels?.length && (
              <Alert type='error'>
                {c.unrecognised_levels.length} equivalency row(s) carried a level tag the parser did
                not recognise, and were left out of both counts rather than guessed at.
              </Alert>
            )}
          </>
        )}
    </Stack>
  )
}

// One row per receiving institution, for a single course.
const VA_EQUIVALENCY_COLUMNS = [
  { key: 'institution', label: 'Institution', width: '260px', variant: 'title' },
  { key: 'identifier', label: 'Lands as', width: '120px', variant: 'code', render: (r) => r.identifier ?? '—' },
  { key: 'name', label: 'Their title', variant: 'title', render: (r) => r.name ?? '—' },
  { key: 'notes', label: 'Notes', width: '240px', variant: 'title', render: (r) => r.notes ?? '' },
]
