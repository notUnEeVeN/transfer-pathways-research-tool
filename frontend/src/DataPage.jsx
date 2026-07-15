import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MagnifyingGlassIcon, ArrowDownTrayIcon, ClipboardIcon, ArrowLeftIcon, ArrowRightIcon,
  ArrowTopRightOnSquareIcon, ChartBarIcon, TrashIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, StatStrip, Tabs, Input, Textarea, LoadingLogo } from './components/ui'
import DatasetSummaryPanel from './components/DatasetSummaryPanel'
import SubNav from './components/SubNav'
import CollegeGeoFilters, { EMPTY_GEO } from './components/CollegeGeoFilters'
import { matchesGeo } from './shared/lib/collegeGeo'
import DistrictsTab, { CampusMinimums } from './DataReferences'
import DegreeTemplateEditor from './degrees/DegreeTemplateEditor'
import { degreeSourcesFor } from './degrees/degreeSources'
import AnalysisCard from './analyses/AnalysisCard'
import { fmtDate as fmtGalleryDate } from './shared/fmtDate'
import { useAccessMe } from '@frontend/query/hooks/useAccess'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import { openAssist } from './pages/Audit/lib/auditFormat'
import { useCourseList } from './pages/Audit/hooks/useCourseList'
import { useAuditDoc } from '@frontend/query/hooks/useAudit'
import {
  useColleges, useSchools, useCcCourses, useUniversityCourses, useAgreementsBatch,
  useRawAssist, useDataSummary, useCoverage, useRequirementComparison,
  useFigures, useDeleteFigure, useEditFigure, downloadFigure,
  useDegreeRequirements, useDegreeRequirementDocuments, useDegreeEvaluation,
  useSaveDegreeRequirement,
} from '@frontend/query/hooks/useData'
import { useAuth } from '@frontend/hooks/useAuth'

/**
 * Data explorer — the partners' access point into the research database.
 * Everything shown is server-scoped to the caller's granted subset.
 *
 *   Overview    — counts, refresh time, and majors per school
 *   Agreements  — campus → college → agreements (agreement / DB document / raw
 *                 ASSIST / min comparison / degree coverage), plus each
 *                 campus's degree template and hand-curated hard minimum
 *   Courses     — the CC and UC course catalogs, searchable per institution
 *   Districts   — community-college district geography (editable)
 *
 * Every requirement view renders through the shared RequirementsLedger
 * (completion checks off — there's no student here), and every view surfaces
 * the API route that fetches what's on screen (RouteHint) — now shown once,
 * up in the SubNav bar, rather than repeated inside each pane.
 */
// Per-tab *base* route shown in the SubNav bar — what's shown before (or
// absent) any drill-in. Overview/districts have no finer-grained view, so
// this is also their only value. Agreements/courses report a more specific
// route once their pane actually changes (`onRoute`, below).
const DATA_TAB_ROUTES = {
  overview: { path: '/api/data/summary' },
  agreements: { path: '/api/assist/coverage' },
  courses: { path: '/api/assist/courses' },
  districts: { path: '/api/assist/institutions?kind=community_college' },
}

export default function DataPage({ onNavigate = () => {} }) {
  const [tab, setTab] = useState('overview')
  const [route, setRoute] = useState(DATA_TAB_ROUTES.overview)
  const [agreementsHomeRequest, setAgreementsHomeRequest] = useState(0)

  // Switching top-level tabs always snaps the chip back to that tab's base
  // route first — otherwise a drilled-in agreements/courses route would
  // survive into a tab that never reports its own (overview, districts), or
  // flash stale until the newly-mounted pane's own effect catches up.
  const changeTab = (next) => {
    // Re-selecting Agreements is its "home" action. The browser stays mounted
    // when its active tab is clicked, so explicitly ask it to leave any college
    // or requirement drill-in while preserving the selected campus.
    if (next === 'agreements' && tab === 'agreements') {
      setAgreementsHomeRequest((current) => current + 1)
    }
    setTab(next)
    setRoute(DATA_TAB_ROUTES[next])
  }

  // Passed to AgreementsBrowser/CoursesBrowser as `onRoute`: they report
  // `{ path }` whenever their own drilled-in pane changes. Only commits when
  // the path actually differs, so a child effect re-reporting the same value
  // (e.g. its own prop identity churning) never triggers another render.
  const reportRoute = useCallback((next) => {
    setRoute((prev) => (next?.path && next.path !== prev?.path ? next : prev))
  }, [])

  return (
    <div className='h-full flex flex-col'>
      <SubNav tabs={{
        value: tab, onChange: changeTab,
        options: [
          { value: 'overview',   label: 'Overview' },
          { value: 'agreements', label: 'Agreements' },
          { value: 'courses',    label: 'Courses' },
          { value: 'districts',  label: 'Districts' },
        ],
      }} route={route} />
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className={tab === 'agreements'
          ? 'max-w-[1240px] mx-auto px-[22px] pt-[26px] pb-12 w-full'
          : 'max-w-[1400px] mx-auto px-[22px] pt-[26px] pb-12 w-full'}>
          {tab === 'overview' && <DatasetSummaryPanel />}
          {tab === 'agreements' && (
            <AgreementsBrowser onRoute={reportRoute} homeRequest={agreementsHomeRequest} />
          )}
          {tab === 'courses' && <CoursesBrowser onRoute={reportRoute} />}
          {tab === 'districts' && <DistrictsTab />}
        </div>
      </div>
    </div>
  )
}

// ───────── agreements (campus-first) ─────────
//
// Campus selection is a chip row (its own picker — the UC course catalog
// still uses the shared InstitutionRail). Colleges and coverage follow the
// working major selected for that campus in Admin; opening a college goes
// straight to its agreement with no program-selection step.

export function AgreementsBrowser({ onRoute = () => {}, homeRequest = 0 }) {
  const summary = useDataSummary()
  const coverage = useCoverage()
  const websiteCoverage = useCoverage({ requirements: 'paper' })
  const [campus, setCampus] = useState(null) // { school_id, school }
  const [collegeId, setCollegeId] = useState(null)
  const [campusView, setCampusView] = useState(null) // null | 'template' | 'minimums'

  useEffect(() => {
    setCollegeId(null)
    setCampusView(null)
  }, [homeRequest])

  const schools = summary.data?.schools || []
  // Alphabetical: this is now the chip row's own display + default-pick
  // order (InstitutionRail used to sort for display; nothing else did).
  const campuses = useMemo(
    () => schools
      .filter((g) => g.majors.length)
      .map((g) => ({ id: g.school_id, name: g.school }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [schools]
  )

  const selectCampus = (campusId) => {
    const selected = campuses.find((item) => Number(item.id) === Number(campusId))
    if (!selected) return
    setCampus({ school_id: selected.id, school: selected.name })
    setCollegeId(null)
    setCampusView(null)
  }

  // ASSIST remains major-specific in storage. Group by college here so legacy
  // settings cannot break the campus-first presentation.
  const coverageByCc = useMemo(() => {
    const m = new Map()
    if (!campus) return m
    for (const r of coverage.data?.rows || []) {
      if (Number(r.school_id) !== Number(campus.school_id)) continue
      const id = Number(r.community_college_id)
      if (!m.has(id)) m.set(id, [])
      m.get(id).push(r)
    }
    return m
  }, [coverage.data, campus])

  // Website (curated hard-minimum) coverage is campus-level — one row per
  // (school, college), identical across majors — so join by college only.
  const websiteByCc = useMemo(() => {
    const m = new Map()
    if (!campus) return m
    for (const r of websiteCoverage.data?.rows || []) {
      if (Number(r.school_id) === Number(campus.school_id)) m.set(Number(r.community_college_id), r)
    }
    return m
  }, [websiteCoverage.data, campus])

  // The route fetching whatever the right-hand pane currently shows — the
  // pre-SubNav `paneRoute` local, now reported up so the shared chip can show
  // it. A college detail reports its active agreement view directly to the
  // shared top-right route chip; until its batch loads, this list route remains
  // the safe fallback (this hook must stay above every early return below).
  const paneRoute = !campus ? '/api/data/summary'
    : campusView === 'template' ? '/api/curated/degrees'
    : campusView === 'minimums' ? '/api/curated/requirements?kind=transfer_minimum'
    : '/api/assist/coverage'

  useEffect(() => {
    onRoute({ path: paneRoute })
  }, [paneRoute, onRoute])

  if (summary.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (summary.isError) return <Alert type='error'>Failed to load your dataset summary.</Alert>
  if (!campuses.length) {
    return <EmptyState title='No campuses yet'
      description='The dataset has no UC campuses at the moment.' />
  }

  // The campus chips are always-on segmented navigation (like the mockup's
  // "one active pill" chip row), so a campus is always selected — the first
  // alphabetically picks itself the first time through, same as the old
  // single-campus auto-pick but generalized to every campus count.
  if (!campus) {
    selectCampus(campuses[0].id)
    return null
  }

  return (
    <Stack gap='cozy'>
      {campusView === 'template' ? (
        <CampusDegreeTemplate schoolId={campus.school_id} school={campus.school}
          onBack={() => setCampusView(null)} />
      ) : campusView === 'minimums' ? (
        <Stack gap='cozy'>
          <div className='flex items-center'>
            <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={() => setCampusView(null)}>All colleges</Button>
          </div>
          <CampusMinimums schoolId={campus.school_id} />
        </Stack>
      ) : collegeId != null ? (
        <CampusAgreements campus={campus} collegeId={collegeId}
          onRoute={onRoute} onBack={() => setCollegeId(null)} />
      ) : (
        <Stack gap='comfortable'>
          <div className='min-w-0'>
            <span className='text-label'>Receiving campus</span>
            <div className='mt-2 flex items-center gap-1.5 flex-wrap'>
              {campuses.map((c) => {
                const active = Number(c.id) === Number(campus.school_id)
                return (
                  <button key={c.id} type='button' onClick={() => selectCampus(c.id)}
                    className={`px-[15px] py-[7px] rounded-pill text-[13px] whitespace-nowrap border transition-colors ${
                      active
                        ? 'bg-primary hover:bg-primary-hover text-on-primary border-primary font-[650]'
                        : 'bg-surface text-ink-muted border-border-strong font-medium hover:border-primary'
                    }`}>
                    {c.name.replace('UC ', '')}
                  </button>
                )
              })}
              <div className='ml-auto pl-3 border-l border-border flex shrink-0 items-center gap-2.5'>
                <span className='text-label'>Requirements</span>
                <div className='inline-flex overflow-hidden rounded-pill border border-border-strong bg-surface'>
                  <button type='button' aria-label='Transfer requirements'
                    onClick={() => setCampusView('minimums')}
                    className='h-8 px-3 text-button text-ink-muted hover:bg-primary-soft hover:text-ink transition-colors'>
                    Transfer
                  </button>
                  <button type='button' aria-label='Graduation requirements'
                    onClick={() => setCampusView('template')}
                    className='h-8 px-3 text-button text-ink-muted border-l border-border-strong hover:bg-primary-soft hover:text-ink transition-colors'>
                    Graduation
                  </button>
                </div>
              </div>
            </div>
          </div>
          <CampusColleges campus={campus} coverageByCc={coverageByCc} websiteByCc={websiteByCc}
            coverageLoading={coverage.isLoading || websiteCoverage.isLoading} onPick={setCollegeId} />
        </Stack>
      )}
    </Stack>
  )
}

export function summarizeCoverageRows(rows = []) {
  const percentages = rows
    .filter((row) => row.pct_articulated != null && row.pct_articulated !== '')
    .map((row) => Number(row.pct_articulated))
    .filter((value) => Number.isFinite(value))

  return {
    count: rows.length,
    average: percentages.length
      ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
      : null,
    fullyArticulated: percentages.length > 0 && rows.every((row) => row.fully_articulated),
  }
}

// The college table's grid columns — shared by the header row and every
// data row so the two can never drift out of alignment.
const COLLEGE_TABLE_COLS = 'grid grid-cols-[minmax(0,1fr)_220px_220px_76px] gap-3.5'

// Each college's campus-wide coverage, with all visible ASSIST agreements
// summarized into one row alongside the hand-curated hard minimum.
function CampusColleges({ campus, coverageByCc, websiteByCc, coverageLoading, onPick }) {
  const colleges = useColleges()
  const [q, setQ] = useState('')
  const [geo, setGeo] = useState(EMPTY_GEO)

  const rows = useMemo(() => {
    const all = (colleges.data || []).map((c) => {
      const assistRows = coverageByCc.get(Number(c.id)) || []
      const assist = summarizeCoverageRows(assistRows)
      const web = websiteByCc.get(Number(c.id)) || null
      return { ...c, assistRows, assist, web }
    }).filter((c) => c.assistRows.length || c.web)
      .filter((c) => matchesGeo(c, geo))
      .sort((a, b) => (b.assist.average ?? -1) - (a.assist.average ?? -1) || a.name.localeCompare(b.name))
    if (!q.trim()) return all
    const s = q.toLowerCase()
    return all.filter((c) => c.name.toLowerCase().includes(s))
  }, [colleges.data, coverageByCc, websiteByCc, q, geo])

  const withAgreement = rows.filter((r) => r.assistRows.length).length

  return (
    <Stack gap='comfortable'>
      <div className='flex items-center gap-2.5'>
        <label className='flex-1 flex items-center gap-3 bg-surface border-[1.5px] border-border-strong rounded-pill px-[22px] py-[13px]'>
          <MagnifyingGlassIcon className='w-[17px] h-[17px] text-ink-muted shrink-0' />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label='Search colleges'
            placeholder={`Search ${rows.length} colleges — name, district, or county…`}
            className='flex-1 bg-transparent outline-none border-none text-[15px] text-ink placeholder:text-ink-subtle' />
        </label>
        <CollegeGeoFilters colleges={colleges.data || []} value={geo} onChange={setGeo} />
      </div>
      <div className='flex items-center gap-4'>
        <span className='text-[13px] text-ink-subtle'>
          <strong className='text-ink font-semibold'>{campus.school}</strong> · {withAgreement} colleges with agreements
        </span>
        <div className='ml-auto flex items-center gap-4 text-[13px] text-ink-muted'>
          <span className='flex items-center gap-1.5 whitespace-nowrap'>
            <span className='inline-block w-[9px] h-[9px] rounded-pill bg-success' /> complete
          </span>
          <span className='flex items-center gap-1.5 whitespace-nowrap'>
            <span className='inline-block w-[9px] h-[9px] rounded-pill bg-primary' /> partial coverage
          </span>
          <span className='flex items-center gap-1.5 whitespace-nowrap'>
            <span className='inline-block w-[9px] h-[9px] rounded-pill border-[1.5px] border-border-strong bg-surface' /> no agreement
          </span>
        </div>
      </div>
      {colleges.isLoading || coverageLoading ? (
        <div className='flex justify-center py-8'><Spinner /></div>
      ) : (
        <div className='surface-card overflow-auto max-h-[65vh]'>
          <div className={`${COLLEGE_TABLE_COLS} px-[22px] py-3 border-b border-border/60 sticky top-0 bg-surface`}>
            <span className='text-label'>Community college</span>
            <span className='text-label whitespace-nowrap'>Hand curated</span>
            <span className='text-label whitespace-nowrap'>ASSIST agreement</span>
            <span className='text-label' />
          </div>
          {rows.map((c) => {
            const hasAgreement = c.assistRows.length > 0
            return (
              <div key={c.id}
                className={`${COLLEGE_TABLE_COLS} items-center px-[22px] py-[13px] border-b border-border/40 last:border-0 ${
                  hasAgreement ? 'hover:bg-surface-hover cursor-pointer' : 'opacity-60'}`}
                onClick={() => hasAgreement && onPick(Number(c.id))}>
                <div className='min-w-0'>
                  <p className='text-[14.5px] font-semibold truncate'>{c.name}</p>
                  {c.district && <p className='text-[12.5px] text-ink-subtle truncate'>{c.district}</p>}
                </div>
                <div>
                  {c.web ? <CoverageBar pct={c.web.pct_articulated} full={c.web.fully_articulated} /> :
                    <span className='text-caption text-ink-subtle'>—</span>}
                </div>
                <div>
                  {hasAgreement ? (
                    <span className='inline-flex flex-col gap-0.5'>
                      <CoverageBar pct={c.assist.average} full={c.assist.fullyArticulated} />
                      {c.assist.count > 1 && (
                        <span className='text-caption text-ink-subtle'>average across {c.assist.count} legacy agreements</span>
                      )}
                    </span>
                  ) :
                    <span className='text-caption text-ink-subtle'>no agreement</span>}
                </div>
                <div>
                  {hasAgreement && (
                    <span className='flex items-center gap-1 text-[13px] font-[550] text-success'>
                      view <ArrowRightIcon className='w-[13px] h-[13px]' />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Stack>
  )
}

// Fill colors are inline: utility classes like bg-primary/60 resolve to the
// UUI theme's WHITE surface token here, which made the bars invisible.
function CoverageBar({ pct, full, width = 'w-[110px]' }) {
  const v = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <span className='inline-flex items-center gap-2.5'>
      <span className={`inline-block ${width} h-1.5 rounded-pill bg-surface-sunken overflow-hidden`}>
        <span className='block h-full rounded-pill'
          style={{ width: `${v}%`, backgroundColor: full ? 'var(--color-success, #17855A)' : 'var(--color-primary, #193018)' }} />
      </span>
      <span className='text-[13px] font-[550] text-ink'>{pct != null ? `${pct}%` : '—'}</span>
    </span>
  )
}

// One campus × college batch can contain several majors. Show every visible
// agreement in a stable order, with its own ledger and supporting data views.
function CampusAgreements({ campus, collegeId, onRoute, onBack }) {
  const batch = useAgreementsBatch(collegeId, campus.school_id)
  const agreements = useMemo(() => {
    const group = (batch.data || []).find((g) => Number(g.school_id) === Number(campus.school_id))
    return (group?.agreements || []).slice().sort((a, b) => String(a.major).localeCompare(String(b.major)))
  }, [batch.data, campus.school_id])
  const defaultAgreementId = agreements[0]?._id

  // A college can contain multiple major agreements. The first agreement owns
  // the initial global route; after that, whichever card's tab the user clicks
  // becomes the active route. This avoids mount-order races between cards.
  useEffect(() => {
    if (!defaultAgreementId) return
    onRoute({ path: `/api/audit/doc/${defaultAgreementId}?system=uc` })
  }, [defaultAgreementId, onRoute])

  const backToColleges = () => {
    onRoute({ path: '/api/assist/coverage' })
    onBack()
  }

  return (
    <Stack gap='cozy'>
      <div className='flex items-center gap-2'>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={backToColleges}>All colleges</Button>
        <span className='text-border-strong'>·</span>
        <span className='text-[13px] text-ink-subtle'>{campus.school}</span>
      </div>
      {batch.isLoading ? (
        <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
      ) : !agreements.length ? (
        <EmptyState title='No agreements' description='This college has no agreements for the selected campus.' />
      ) : (
        <Stack gap='section'>
          {agreements.map((agreement) => (
            <AgreementDetail key={agreement._id} agreementId={agreement._id}
              onRoute={onRoute}
              compareFor={{ schoolId: campus.school_id, major: agreement.major, communityCollegeId: collegeId }} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

// The campus's hand-gathered four-year degree template (no college context),
// rendered through the same ledger as every other requirements view.
function CampusDegreeTemplate({ schoolId, school, onBack }) {
  const q = useDegreeRequirements()
  const raw = useDegreeRequirementDocuments()
  const save = useSaveDegreeRequirement()
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const doc = useMemo(
    () => (q.data?.rows || []).find((r) => Number(r.school_id) === Number(schoolId)) || null,
    [q.data, schoolId]
  )
  const rawDoc = useMemo(
    () => (raw.data?.rows || []).find((r) => Number(r.school_id) === Number(schoolId)) || null,
    [raw.data, schoolId]
  )
  // Notes ride on the stored degree doc (PUT replaces the whole row, so the
  // raw doc is spread back in full); the importer $sets its own fields only,
  // so notes survive re-imports.
  const saveNotes = useCallback(
    (nextNotes) => save.mutateAsync({ ...rawDoc, verification_notes: nextNotes }),
    [rawDoc, save]
  )

  return (
    <Stack gap='cozy'>
      <div className='flex items-center'>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={onBack}>All colleges</Button>
      </div>
      {q.isLoading || raw.isLoading ? (
        <div className='flex justify-center py-10'><Spinner /></div>
      ) : q.isError || raw.isError ? (
        <Alert type='error'>Failed to load the graduation requirements.</Alert>
      ) : !doc ? (
        <EmptyState title='No graduation requirements'
          description='No hand-curated four-year graduation requirements have been added for this campus.'
          action={<Button leadingIcon={PencilSquareIcon} onClick={() => setEditing(true)}>Create requirements</Button>} />
      ) : (
        <DegreeRequirementsDetail doc={doc} onEdit={() => setEditing(true)}
          onSaveNotes={rawDoc ? saveNotes : null} savingNotes={save.isPending}
          noteAuthor={{ uid: user?.uid || null, label: user?.displayName || user?.email || null }} />
      )}
      <DegreeTemplateEditor open={editing} onClose={() => setEditing(false)}
        initialDocument={rawDoc} schoolId={schoolId} school={school || doc?.school}
        campusKey={rawDoc?.campus_key || null} onSaved={() => setEditing(false)} />
    </Stack>
  )
}

// ───────── locally produced figure gallery ─────────

// Exported for the top-level Visuals tab (App.jsx); lives here with its gallery.
export function AnalysisTab({ onNavigate = () => {} }) {
  const me = useAccessMe()
  const isAdmin = me.data?.role === 'admin'

  const myUid = me.data?.uid || null
  const figs = useFigures()
  const del = useDeleteFigure()
  const edit = useEditFigure()
  const figures = figs.data?.figures || []

  const gallery = useMemo(
    () => figures.slice().sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0)),
    [figures]
  )

  return (
    <Stack gap='section'>
      {figs.isError && <Alert type='error'>Failed to load the figure gallery.</Alert>}
      {figs.isLoading && <div className='flex justify-center py-10'><Spinner /></div>}
      {!figs.isLoading && !figs.isError && !gallery.length && (
        <div className='mx-auto max-w-screen-md'>
          <div className='surface-card p-8 text-center'>
            <ChartBarIcon className='w-8 h-8 text-ink-subtle mx-auto mb-3' />
            <p className='text-body-strong'>No figures published yet</p>
            <p className='text-body text-ink-muted mt-2 max-w-prose mx-auto'>
              Build the visual locally, then call <span className='font-mono text-ink'>pmt.publish(fig, …)</span>.
              The finished SVG, PNG, and PDF appear here for the team.
            </p>
            {isAdmin && (
              <div className='mt-4'>
                <Button onClick={() => onNavigate('api')}>Set up in 2 minutes → API tab</Button>
              </div>
            )}
          </div>
        </div>
      )}
      {gallery.map((figure) => (
        <FigureCard key={figure.slug} fig={figure}
          canModify={isAdmin || (!!myUid && figure.author_uid === myUid)}
          onDelete={() => del.mutate(figure.slug)} deleting={del.isPending}
          onSave={(fields) => edit.mutateAsync({ slug: figure.slug, fields })}
          saving={edit.isPending} />
      ))}
    </Stack>
  )
}


// Published figure in the AnalysisCard shell. Teammates render these locally;
// the gallery stores finished SVG/PNG/PDF files only.
const shortAuthorUid = (uid) => (uid ? `UID ${String(uid).slice(0, 8)}` : 'unknown author')

function FigureCard({ fig, canModify, onDelete, deleting, onSave, saving }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(fig.title)
  const [caption, setCaption] = useState(fig.caption || '')
  const [sourceUrl, setSourceUrl] = useState(fig.source_url || '')

  const resetFields = () => {
    setTitle(fig.title)
    setCaption(fig.caption || '')
    setSourceUrl(fig.source_url || '')
  }

  const save = async () => {
    await onSave({
      title: title.trim(),
      caption: caption.trim() || null,
      source_url: sourceUrl.trim() || null,
    })
    setEditing(false)
  }

  const source = (
    <>
      {fig.author_label || shortAuthorUid(fig.author_uid)}
      {fig.updated_at ? ` · ${fmtGalleryDate(fig.updated_at)}` : ''}
      {fig.source_url && (
        <> · <a className='text-primary hover:underline' href={fig.source_url}
          target='_blank' rel='noreferrer'>source</a></>
      )}
    </>
  )

  const actions = (
    <>
      {canModify && (
        <>
          <Button variant='ghost' leadingIcon={PencilSquareIcon}
            onClick={() => { if (editing) resetFields(); setEditing((v) => !v) }} />
          <Button variant='ghost' leadingIcon={TrashIcon} disabled={deleting}
            onClick={() => {
              if (window.confirm(`Delete "${fig.title}"? Republishing the slug brings it back.`)) onDelete()
            }} />
        </>
      )}
    </>
  )

  return (
    <AnalysisCard title={fig.title} source={source} actions={actions}
      downloadFormats={['svg', 'png', 'pdf']} onDownload={(fmt) => downloadFigure(fig.slug, fmt)}>
      {editing && (
        <div className='mb-4 flex flex-col gap-2' data-export-exclude>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Title' />
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder='Caption (optional)' />
          <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder='Source URL (optional)' />
          <div className='flex gap-2'>
            <Button onClick={save} disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant='ghost' onClick={() => { resetFields(); setEditing(false) }}>Cancel</Button>
          </div>
        </div>
      )}
      {fig.svg && (
        <div className='bg-white rounded-md overflow-hidden'>
          {/* img (not inline SVG) so published markup can't run scripts */}
          <img src={`data:image/svg+xml;base64,${fig.svg}`} alt={fig.title} className='w-full h-auto' />
        </div>
      )}
      <p className='text-caption text-ink-subtle font-mono mt-2' data-export-exclude>{fig.slug}</p>
    </AnalysisCard>
  )
}

const downloadJson = (obj, filename) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function JsonPanel({ data, filename }) {
  return (
    <div className='surface-card'>
      <div className='flex items-center gap-2 px-3 py-2 border-b border-border'>
        <span className='text-caption text-ink-subtle font-mono'>{filename}</span>
        <div className='ml-auto flex gap-1'>
          <Button variant='ghost' leadingIcon={ClipboardIcon}
            onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}>Copy</Button>
          <Button variant='ghost' leadingIcon={ArrowDownTrayIcon}
            onClick={() => downloadJson(data, filename)}>Download</Button>
        </div>
      </div>
      <pre className='p-3 text-[11px] leading-relaxed font-mono overflow-auto max-h-[65vh] whitespace-pre'>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

const routeForAgreementView = (view, agreementId, compareFor) => (
  view === 'raw' ? `/api/data/raw-assist/${agreementId}`
  : view === 'comparison' && compareFor
    ? `/api/curated/requirement-comparison?school_id=${compareFor.schoolId}&major=${encodeURIComponent(compareFor.major)}&community_college_id=${compareFor.communityCollegeId}`
  : view === 'degree' && compareFor
    ? `/api/curated/degree-evaluation?school_id=${compareFor.schoolId}&community_college_id=${compareFor.communityCollegeId}`
  : `/api/audit/doc/${agreementId}?system=uc`
)

function AgreementDetail({ agreementId, onRoute = () => {}, compareFor = null }) {
  const [view, setView] = useState('ledger') // ledger | stored | raw | comparison | degree
  const docQ = useAuditDoc(agreementId, 'uc')
  const raw = useRawAssist(agreementId, { enabled: view === 'raw' })
  const courses = useCourseList(docQ.data?.course_names)

  if (docQ.isLoading) return <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
  if (docQ.isError) return <Alert type='error'>Failed to load the agreement.</Alert>
  const doc = docQ.data?.doc
  if (!doc) return null

  const slug = `${doc.uc_school}-${doc.community_college}-${doc.major}`.replace(/[^a-z0-9]+/gi, '_')
  const changeView = (next) => {
    setView(next)
    onRoute({ path: routeForAgreementView(next, agreementId, compareFor) })
  }

  return (
    <Stack gap='cozy'>
      <div className='surface-card overflow-hidden'>
        <div className='px-6 py-5 flex flex-wrap items-start gap-3.5'>
          <div className='min-w-0'>
            <p className='text-label text-[12px]'>School pair</p>
            <p className='mt-1.5 flex items-center gap-2.5 flex-wrap text-[19px] tracking-[-.01em]'>
              <span className='font-[650] break-words'>{doc.community_college}</span>
              <ArrowRightIcon className='w-[17px] h-[17px] text-ink-subtle shrink-0' />
              <span className='font-[650] break-words'>{doc.uc_school}</span>
            </p>
            <p className='mt-1 text-body text-ink-muted'>{doc.major}</p>
          </div>
          {docQ.data?.assist_url && (
            <Button className='ml-auto shrink-0' variant='secondary' trailingIcon={ArrowTopRightOnSquareIcon}
              onClick={() => openAssist(docQ.data.assist_url)}>Open ASSIST</Button>
          )}
        </div>
      </div>
      <Tabs value={view} onChange={changeView}
        options={[
          { value: 'ledger', label: 'Agreement' },
          { value: 'stored', label: 'DB document' },
          { value: 'raw',    label: 'Raw ASSIST API' },
          ...(compareFor ? [{ value: 'comparison', label: 'Min comparison' }] : []),
          ...(compareFor ? [{ value: 'degree', label: 'Degree coverage' }] : []),
        ]} />
      {view === 'comparison' && compareFor && <ComparisonView compareFor={compareFor} />}
      {view === 'degree' && compareFor && (
        <DegreeCompletionView schoolId={compareFor.schoolId} collegeId={compareFor.communityCollegeId} />
      )}
      {view === 'ledger' && (
        <div className='uui-scope'>
          <RequirementsLedger major={doc} courses={courses}
            universityCoursesById={docQ.data?.university_courses || null} preserveOrder showCompletion={false} />
        </div>
      )}
      {view === 'stored' && <JsonPanel data={doc} filename={`${slug}.stored.json`} />}
      {view === 'raw' && (
        raw.isLoading ? <div className='flex justify-center py-10'><Spinner /></div>
        : raw.isError ? <Alert type='error'>{raw.error?.response?.data?.error || 'assist.org fetch failed.'}</Alert>
        : raw.data ? <JsonPanel data={raw.data} filename={`${slug}.assist-raw.json`} /> : null
      )}
    </Stack>
  )
}

// Split a course code string ("MATH 071", "COM SCI 31") into prefix + number so
// the shared ledger can render it — the comparison data arrives pre-resolved as
// codes rather than course_ids.
function splitCode(code) {
  const m = String(code || '').match(/^(.*?)\s+(\S+)$/)
  return m ? { prefix: m[1], number: m[2] } : { prefix: String(code || ''), number: '' }
}

// Convert the minimums-comparison payload into the agreement `requirement_groups`
// shape (+ course lookups) so it renders in the shared RequirementsLedger, matching
// the Rendered and 4-year-degree tabs.
function comparisonToLedger(d) {
  const courses = new Map()          // code -> { course_id: code, prefix, number }
  const universityCoursesById = {}   // parent_id -> { prefix, number }
  const toReceiver = (r) => {
    if (r.parent_id != null) { const p = splitCode(r.uc_code); universityCoursesById[r.parent_id] = { prefix: p.prefix, number: p.number } }
    const options = (r.cc_options || []).map((opt) => ({
      course_ids: (opt || []).map((code) => {
        if (!courses.has(code)) { const p = splitCode(code); courses.set(code, { course_id: code, prefix: p.prefix, number: p.number }) }
        return code
      }),
      course_conjunction: 'and',
    }))
    return {
      receiving: r.parent_id != null
        ? { kind: 'course', parent_id: r.parent_id, units: null }
        : { kind: 'requirement', parent_id: null, name: r.uc_code, units: null },
      articulation_status: r.articulated ? 'articulated' : 'not_articulated',
      not_articulated_reason: r.articulated ? null : 'no_course_articulated',
      options: r.articulated ? options : [],
      options_conjunction: 'or',
    }
  }
  const groups = [{
    title: 'Hand-curated minimum', is_required: true,
    sections: [{ section_advisement: (d.website_requirements || []).length, receivers: (d.website_requirements || []).map(toReceiver) }],
  }]
  const extra = d.assist_extra_groups || []
  if (extra.length) {
    groups.push({
      title: 'ASSIST requires beyond the hand-curated minimum', is_required: true,
      sections: extra.map((g) => ({ section_advisement: g.choose ?? (g.options || []).length, receivers: (g.options || []).map(toReceiver) })),
    })
  }
  return { requirement_groups: groups, courses: [...courses.values()], universityCoursesById }
}

// Level 2 — ASSIST vs the hand-curated hard-minimum for one college: three
// summary tiles, then the two minimums in the shared ledger.
function ComparisonView({ compareFor }) {
  const cmp = useRequirementComparison(compareFor)
  if (cmp.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (cmp.isError) return <Alert type='error'>Failed to load the minimums comparison.</Alert>
  const d = cmp.data
  if (!d || !d.website_requirements) return <EmptyState title='No comparison' description='No curated or ASSIST minimums to compare for this college.' />

  const web = d.website || {}
  const assist = d.assist || {}
  const net = d.net_courses ?? 0
  const l = comparisonToLedger(d)

  return (
    <Stack gap='cozy'>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <StatTile label='Hand-curated minimum' value={web.pct != null ? `${web.pct}%` : '—'}
          sub={`${web.articulated ?? 0} / ${web.required ?? 0} articulated`} full={web.fully} />
        <StatTile label='ASSIST minimum' value={assist.pct != null ? `${assist.pct}%` : '—'}
          sub={`${assist.articulated ?? 0} / ${assist.required ?? 0} articulated`} full={assist.fully} />
        <StatTile label='Difference' value={net === 0 ? 'same' : `${net > 0 ? '+' : '−'}${Math.abs(net)}`}
          sub={net === 0 ? 'same course count' : `ASSIST asks ${Math.abs(net)} ${net > 0 ? 'more' : 'fewer'}`} />
      </div>
      <div className='uui-scope'>
        <RequirementsLedger major={{ requirement_groups: l.requirement_groups }}
          courses={l.courses} universityCoursesById={l.universityCoursesById} preserveOrder showCompletion={false} />
      </div>
    </Stack>
  )
}

function StatTile({ label, value, sub = null, full }) {
  return (
    <div className='surface-card p-3'>
      <p className='text-label text-ink-muted'>{label}</p>
      <p className={`text-stat font-mono leading-none mt-1 ${full ? 'text-success' : 'text-ink'}`}>{value}</p>
      {sub && <p className='text-caption text-ink-subtle mt-1'>{sub}</p>}
    </div>
  )
}

// ───────── course catalogs ─────────

// One tab for both catalogs: pick the institution side, then drill into a
// specific school's courses. `colleges`/`geo` are lifted up here (rather than
// living inside CcCoursesBrowser) so the geo filter pills can sit in the same
// header row as the system Tabs, to the right (mockup v2:327-338).
export function CoursesBrowser({ onRoute = () => {} }) {
  const [kind, setKind] = useState('cc')
  const colleges = useColleges()
  const [geo, setGeo] = useState(EMPTY_GEO)
  const allColleges = colleges.data || []

  // `geo` used to live inside CcCoursesBrowser, so flipping to UC campuses
  // and back unmounted/remounted it and the filter reset for free. Now that
  // it's lifted up here (so the pills can share the header row with the
  // system Tabs), the tab switch has to reset it explicitly.
  const changeKind = (next) => {
    setKind(next)
    setGeo(EMPTY_GEO)
  }

  return (
    <Stack gap='cozy'>
      <div className='flex items-center gap-4'>
        <Tabs value={kind} onChange={changeKind}
          options={[
            { value: 'cc', label: 'Community colleges' },
            { value: 'uc', label: 'UC campuses' },
          ]} />
        {kind === 'cc' && (
          <CollegeGeoFilters className='ml-auto' colleges={allColleges} value={geo} onChange={setGeo} />
        )}
      </div>
      {kind === 'cc'
        ? <CcCoursesBrowser colleges={allColleges} geo={geo} onRoute={onRoute} />
        : <UniversityCoursesBrowser onRoute={onRoute} />}
    </Stack>
  )
}

// Column variants — the three cell treatments the hairline course table uses
// (mockup v2:373-386): a bold tabular code, a muted truncating title, and a
// muted tabular number (units / ids), independent of each column's width.
const COURSE_CELL_CLASS = {
  code: 'text-[13.5px] font-bold tabular tracking-[.01em] text-ink',
  title: 'text-[13.5px] text-ink-muted truncate min-w-0',
  num: 'text-[13px] tabular text-ink-muted',
}

function CourseTable({ rows, columns }) {
  const gridStyle = { gridTemplateColumns: columns.map((c) => c.width || 'minmax(0,1fr)').join(' ') }
  return (
    <div className='surface-card overflow-hidden'>
      <div className='overflow-auto max-h-[70vh]'>
        <div className='grid gap-3.5 px-[22px] py-3 border-b border-border/60 sticky top-0 bg-surface' style={gridStyle}>
          {columns.map((c) => (
            <span key={c.key} className={`text-label whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</span>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={r._id || i} style={gridStyle}
            className='grid gap-3.5 items-center px-[22px] py-[10.5px] border-b border-border/40 last:border-0 hover:bg-surface-hover'>
            {columns.map((c) => (
              <span key={c.key} className={`${COURSE_CELL_CLASS[c.variant] || COURSE_CELL_CLASS.title} ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.render ? c.render(r) : (r[c.key] ?? '—')}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const courseSearch = (rows, q, fields) => {
  if (!q.trim()) return rows
  const s = q.toLowerCase()
  return rows.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(s)))
}

// One institution picker for every catalog-like view. Agreements and UC
// courses intentionally pass the same title and search setting, so campus
// selection cannot drift into two subtly different interfaces again.
export function InstitutionRail({
  items = [], selectedId, onSelect, title, searchable = true, itemSubtitle = null,
}) {
  const [query, setQuery] = useState('')
  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [items]
  )
  const visibleItems = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value
      ? sortedItems.filter((item) => String(item.name).toLowerCase().includes(value))
      : sortedItems
  }, [query, sortedItems])

  return (
    <div className='surface-card p-2.5 lg:max-h-[75vh] overflow-auto'>
      <p className='px-3 pt-2.5 pb-2 flex items-baseline gap-2 text-label'>{title} · {sortedItems.length}</p>
      {searchable && (
        <div className='flex items-center gap-2 bg-canvas border border-border rounded-pill px-3 py-[7px] mx-1 mb-2'>
          <MagnifyingGlassIcon className='w-3.5 h-3.5 text-ink-subtle shrink-0' />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Find…'
            className='flex-1 min-w-0 bg-transparent outline-none border-none text-[13px] text-ink placeholder:text-ink-subtle' />
        </div>
      )}
      <div className='flex flex-col gap-0.5'>
        {visibleItems.map((item) => {
          const active = String(item.id) === String(selectedId)
          const subtitle = itemSubtitle?.(item)
          return (
            <button key={item.id} type='button' onClick={() => onSelect(item.id)}
              className={`w-full flex items-start gap-2.5 rounded-[10px] px-3 py-[9px] text-left transition-colors ${
                active ? 'bg-primary-soft font-[650]' : 'hover:bg-surface-hover'}`}>
              <span className={`w-[3px] h-3.5 rounded-pill mt-0.5 shrink-0 ${active ? 'bg-accent' : 'bg-transparent'}`} />
              <span className='min-w-0'>
                <span className='block text-[13.5px] text-ink truncate'>{item.name}</span>
                {subtitle && (
                  <span className='block text-[11.5px] text-ink-subtle truncate mt-px'>{subtitle}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Rail of institutions (buttons) → the picked one's course catalog. Shared by
// the CC and University course browsers. The route now surfaces one level up
// (DataPage's SubNav), so this only owns the rail + course list layout.
function CatalogBrowser({
  items, useCourses, columns, searchFields, railTitle, pickText, railSearch = true, itemSubtitle = null,
  listRoute, itemRoute, onRoute = () => {},
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [courseQ, setCourseQ] = useState('')
  const coursesQ = useCourses(selectedId)

  // The route fetching the picked institution's catalog once one is chosen,
  // else the bare list route — reported up so DataPage's SubNav chip can show
  // it (this pane no longer renders its own RouteHint).
  const route = selectedId != null ? itemRoute(selectedId) : listRoute
  useEffect(() => {
    onRoute({ path: route })
  }, [route, onRoute])

  const rows = useMemo(
    () => courseSearch(coursesQ.data || [], courseQ, searchFields)
      .slice().sort((a, b) => `${a.prefix} ${a.number}`.localeCompare(`${b.prefix} ${b.number}`)),
    [coursesQ.data, courseQ, searchFields]
  )

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start'>
      <InstitutionRail items={items || []} selectedId={selectedId} title={railTitle}
        searchable={railSearch} itemSubtitle={itemSubtitle}
        onSelect={(id) => { setSelectedId(id); setCourseQ('') }} />

      {selectedId == null ? (
        <EmptyState title={pickText} description='Pick one from the list to browse its catalog.' />
      ) : (
        <Stack gap='cozy'>
          <div className='flex flex-wrap items-center gap-3.5'>
            <label className='flex-none w-[340px] flex items-center gap-2 bg-surface border border-border rounded-pill px-[15px] py-[9px]'>
              <MagnifyingGlassIcon className='w-[14px] h-[14px] text-ink-subtle shrink-0' />
              <input value={courseQ} onChange={(e) => setCourseQ(e.target.value)} aria-label='Search courses'
                placeholder='Search prefix / number / title…'
                className='flex-1 min-w-0 bg-transparent outline-none border-none text-[13.5px] text-ink placeholder:text-ink-subtle' />
            </label>
            {!coursesQ.isLoading && <span className='text-caption text-ink-subtle'>{rows.length} courses</span>}
          </div>
          {coursesQ.isLoading ? <div className='flex justify-center py-8'><Spinner /></div>
            : rows.length ? <CourseTable rows={rows} columns={columns} />
            : <EmptyState title='No courses' description='No catalog rows here.' />}
        </Stack>
      )}
    </div>
  )
}

function CcCoursesBrowser({ colleges, geo, onRoute }) {
  const filtered = useMemo(() => colleges.filter((c) => matchesGeo(c, geo)), [colleges, geo])
  return (
    <CatalogBrowser
      items={filtered}
      useCourses={useCcCourses}
      railTitle='Community colleges'
      itemSubtitle={(it) => it.district || null}
      pickText='Choose a college'
      listRoute='/api/assist/courses'
      itemRoute={(id) => `/api/assist/courses?institution_id=cc:${id}`}
      onRoute={onRoute}
      searchFields={['prefix', 'number', 'title']}
      columns={[
        { key: 'course', label: 'Course', width: '140px', variant: 'code', render: (r) => `${r.prefix} ${r.number}` },
        { key: 'title', label: 'Title', variant: 'title' },
        { key: 'units', label: 'Units', width: '80px', align: 'right', variant: 'num', render: (r) => r.units ?? '—' },
        { key: 'course_id', label: 'Course_ID', width: '110px', align: 'right', variant: 'num', render: (r) => r.course_id },
      ]}
    />
  )
}

function UniversityCoursesBrowser({ onRoute }) {
  const schools = useSchools()
  return (
    <CatalogBrowser
      items={schools.data?.uc || []}
      useCourses={useUniversityCourses}
      railTitle='UC campuses'
      railSearch={false}
      pickText='Choose a campus'
      listRoute='/api/assist/courses'
      itemRoute={(id) => `/api/assist/courses?institution_id=uc:${id}`}
      onRoute={onRoute}
      searchFields={['prefix', 'number', 'title', 'department']}
      columns={[
        { key: 'course', label: 'Course', width: '140px', variant: 'code', render: (r) => `${r.prefix} ${r.number}` },
        { key: 'title', label: 'Title', variant: 'title' },
        { key: 'units', label: 'Units', width: '90px', align: 'right', variant: 'num', render: (r) => `${r.min_units ?? '—'}${r.max_units != null && r.max_units !== r.min_units ? `–${r.max_units}` : ''}` },
        { key: 'department', label: 'Department', width: '160px', variant: 'title' },
        { key: 'parent_id', label: 'parent_id', width: '110px', align: 'right', variant: 'num', render: (r) => r.parent_id },
      ]}
    />
  )
}

// ───────── degree requirements (hand-gathered full four-year degree) ─────────
//
// The hand-gathered whole degree per campus (not the transfer minimum), in the
// same ASSIST requirement shape as agreements — so both views below are plain
// RequirementsLedger renders. See docs/figures/degree-coverage-sources.md.

// Jotted decisions/findings about a campus's degree data — stored on the
// degree doc itself (`verification_notes`) so the whole team sees them next
// to the sources they annotate.
function DegreeVerificationNotes({ notes, onSave, saving, author }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const canEdit = typeof onSave === 'function'
  if (!canEdit && notes.length === 0) return null

  const run = async (nextNotes) => {
    setError(null)
    try { await onSave(nextNotes) } catch { setError('Could not save the note.') }
  }
  const add = async () => {
    const t = text.trim()
    if (!t) return
    await run([...notes, {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      text: t,
      author_uid: author?.uid || null,
      author_label: author?.label || null,
      created_at: new Date().toISOString(),
    }])
    setText('')
  }
  const remove = async (idx) => {
    if (!window.confirm('Delete this note?')) return
    await run(notes.filter((_, i) => i !== idx))
  }

  return (
    <div className='mt-3 pt-3 border-t border-border'>
      <p className='text-label text-[12px]'>Notes — decisions & findings</p>
      {notes.length > 0 && (
        <ul className='mt-2 flex flex-col gap-2'>
          {notes.map((n, idx) => (
            <li key={n.id || idx} className='flex items-start gap-2 min-w-0'>
              <div className='min-w-0 flex-1'>
                <p className='text-[13px] whitespace-pre-wrap break-words'>{n.text}</p>
                <p className='text-caption text-ink-subtle mt-0.5'>
                  {n.author_label || shortAuthorUid(n.author_uid)}
                  {n.created_at ? ` · ${fmtGalleryDate(n.created_at)}` : ''}
                </p>
              </div>
              {canEdit && (
                <Button variant='ghost' leadingIcon={TrashIcon} disabled={saving}
                  onClick={() => remove(idx)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className='mt-2.5 flex flex-col gap-2'>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
            placeholder='e.g. Berkeley CoE requires ≥2 of the 6 H/SS upper-division, so only 2 breadth slots count as CC-satisfiable' />
          <div className='flex items-center gap-2'>
            <Button variant='secondary' onClick={add} disabled={saving || !text.trim()}>
              {saving ? 'Saving…' : 'Add note'}
            </Button>
            {error && <span className='text-caption text-danger'>{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// Degree requirement groups rendered in three labeled sections — what a
// community college can supply (major prep, then GE/breadth) before what must
// happen at the university — instead of one undifferentiated list. Groups
// keep their authored order within each section.
const DEGREE_TIER_SECTIONS = [
  { tier: 'transferable', label: 'Lower division · major preparation', sub: 'Transferable from a community college' },
  { tier: 'breadth', label: 'General education & breadth', sub: 'Satisfiable through community-college coursework' },
  { tier: 'nontransferable', label: 'Upper division · at the university', sub: 'Completed after transfer' },
]

function TieredDegreeLedger({ groups, ...ledgerProps }) {
  const buckets = DEGREE_TIER_SECTIONS.map((section) => ({
    ...section,
    groups: groups.filter((g) => (g.tier || 'transferable') === section.tier),
  })).filter((section) => section.groups.length > 0)
  return (
    <Stack gap='cozy'>
      {buckets.map((section) => (
        <section key={section.tier} aria-label={section.label}>
          <div className='flex items-baseline gap-2.5 mb-2.5 mt-1'>
            <h4 className='text-label text-[11.5px]'>{section.label}</h4>
            <span className='text-tag text-ink-subtle'>{section.sub}</span>
          </div>
          <div className='uui-scope'>
            <RequirementsLedger major={{ requirement_groups: section.groups }}
              preserveOrder showCompletion={false} {...ledgerProps} />
          </div>
        </section>
      ))}
    </Stack>
  )
}

// The stored template: what the campus requires to graduate, no college context.
export function DegreeRequirementsDetail({ doc, onEdit = null, onSaveNotes = null, savingNotes = false, noteAuthor = null }) {
  // Defensive: a persisted (IndexedDB) response from an earlier endpoint shape
  // may lack `requirement_groups` — never crash the tab; the refetch replaces it.
  const groups = Array.isArray(doc.requirement_groups) ? doc.requirement_groups : []
  const sources = degreeSourcesFor(doc)
  return (
    <Stack gap='cozy'>
      <div className='surface-card px-[22px] py-[18px]'>
        <p className='text-label text-[12px]'>Hand-curated four-year graduation requirements</p>
        <div className='mt-1.5 flex items-center gap-4'>
          <p className='min-w-0 flex-1 text-[19px] font-[650] tracking-[-.01em] break-words'>
            {doc.school} <span className='text-ink-subtle'>·</span> {doc.program}
          </p>
          {onEdit && (
            <Button className='shrink-0' variant='secondary' leadingIcon={PencilSquareIcon} onClick={onEdit}>
              Edit template
            </Button>
          )}
        </div>
        <p className='text-caption text-ink-muted mt-1'>
          The full bachelor’s degree requirement set—including major preparation, breadth, and university-only work—behind the graduation-coverage numbers
          {doc.total_units != null ? ` · ${doc.total_units} units` : ''} · {doc.total} requirements
        </p>
      </div>
      <TieredDegreeLedger groups={groups}
        universityCoursesById={doc.university_courses_by_id || null} />
      {sources.length > 0 && (
        <div className='surface-card px-[22px] py-[18px]'>
          <p className='text-label text-[12px]'>Verify these requirements</p>
          <p className='text-caption text-ink-muted mt-1'>
            Walk the official pages in order — each covers a distinct slice of the template.
          </p>
          <ol className='mt-2.5 flex flex-col gap-2.5'>
            {sources.map((s, i) => (
              <li key={s.url} className='flex items-start gap-2 min-w-0'>
                <span className='text-[12px] font-[650] text-ink-subtle tabular-nums mt-[2px] shrink-0'>{i + 1}.</span>
                <div className='min-w-0'>
                  <a className='text-[13px] text-primary hover:underline break-words inline-flex items-center gap-1'
                    href={s.url} target='_blank' rel='noreferrer'>
                    {s.label}
                    <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5 shrink-0' />
                  </a>
                  {s.note && <p className='text-caption text-ink-muted mt-0.5'>{s.note}</p>}
                </div>
              </li>
            ))}
          </ol>
          <DegreeVerificationNotes notes={Array.isArray(doc.verification_notes) ? doc.verification_notes : []}
            onSave={onSaveNotes} saving={savingNotes} author={noteAuthor} />
        </div>
      )}
    </Stack>
  )
}

// One campus's whole four-year degree evaluated against the selected college.
// Shown as a tab inside an agreement pair view.
function DegreeCompletionView({ schoolId, collegeId }) {
  const q = useDegreeEvaluation(schoolId, collegeId)
  if (q.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (q.isError) {
    return <EmptyState title='No degree template yet'
      description='No hand-gathered degree requirements for this campus yet.' />
  }
  const d = q.data
  const c = d.completion
  const tier = (k) => c.by_tier?.[k] || { total: 0, covered: 0 }
  const tt = tier('transferable'); const tb = tier('breadth')
  const tu = tier('nontransferable')
  const remaining = (bucket) => Math.max(0, bucket.total - bucket.covered)
  const coverageSub = (bucket) => bucket.total === 0
    ? 'No requirements'
    : remaining(bucket) === 0 ? 'Fully transferable' : `${remaining(bucket)} remaining`
  return (
    <Stack gap='cozy'>
      <section aria-label='Degree coverage summary'>
        <StatStrip tiles={[
          // Units are the headline — graduation is units completed / units
          // required. The slot count rides in the sub-line; templates without
          // verified unit data fall back to the slot percent.
          c.units?.pct != null ? {
            label: 'Degree transferable', value: `${c.units.pct}%`,
            sub: `${c.units.covered} of ${c.units.total} units · ${c.covered} of ${c.total} requirements`,
            accent: c.units.covered === c.units.total,
          } : {
            label: 'Degree transferable', value: c.pct != null ? `${c.pct}%` : '—',
            sub: `${c.covered} of ${c.total} graduation requirements`,
            accent: c.total > 0 && c.covered === c.total,
          },
          {
            label: 'Major preparation', value: `${tt.covered} / ${tt.total}`,
            sub: coverageSub(tt), accent: tt.total > 0 && remaining(tt) === 0,
          },
          {
            label: 'Breadth', value: `${tb.covered} / ${tb.total}`,
            sub: coverageSub(tb), accent: tb.total > 0 && remaining(tb) === 0,
          },
          {
            label: 'At the university', value: `${tu.total}`,
            sub: 'University-only requirements',
          },
        ]} />
      </section>
      <TieredDegreeLedger groups={d.requirement_groups} courses={d.courses}
        universityCoursesById={d.university_courses_by_id} />
    </Stack>
  )
}
