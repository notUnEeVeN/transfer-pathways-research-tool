import React, { useMemo, useState } from 'react'
import {
  MagnifyingGlassIcon, ArrowDownTrayIcon, ClipboardIcon, ArrowLeftIcon,
  ChartBarIcon, TrashIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Tabs, Input, LoadingLogo } from './components/ui'
import DatasetSummaryPanel from './components/DatasetSummaryPanel'
import RouteHint from './components/RouteHint'
import CollegeGeoFilters, { EMPTY_GEO } from './components/CollegeGeoFilters'
import { matchesGeo } from './shared/lib/collegeGeo'
import DistrictsTab, { CampusMinimums } from './DataReferences'
import DegreeTemplateEditor from './degrees/DegreeTemplateEditor'
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
} from '@frontend/query/hooks/useData'

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
 * the API route that fetches what's on screen (RouteHint).
 */
export default function DataPage({ onNavigate = () => {} }) {
  const [tab, setTab] = useState('overview')
  return (
    <div className='h-full flex flex-col'>
      <div className='shrink-0 flex items-center px-4 h-11 border-b border-border'>
        <Tabs value={tab} onChange={setTab}
          options={[
            { value: 'overview',   label: 'Overview' },
            { value: 'agreements', label: 'Agreements' },
            { value: 'courses',    label: 'Courses' },
            { value: 'districts',  label: 'Districts' },
          ]} />
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className='mx-auto max-w-screen-2xl px-6 py-6'>
          {tab === 'overview' && <DatasetSummaryPanel />}
          {tab === 'agreements' && <AgreementsBrowser />}
          {tab === 'courses' && <CoursesBrowser />}
          {tab === 'districts' && <DistrictsTab />}
        </div>
      </div>
    </div>
  )
}

// ───────── agreements (campus-first) ─────────
//
// Campus selection uses the same rail as the UC course catalog. Colleges and
// coverage follow the working major selected for that campus in Admin; opening
// a college goes straight to its agreement with no program-selection step.

function AgreementsBrowser() {
  const summary = useDataSummary()
  const coverage = useCoverage()
  const websiteCoverage = useCoverage({ requirements: 'paper' })
  const [campus, setCampus] = useState(null) // { school_id, school }
  const [collegeId, setCollegeId] = useState(null)
  const [campusView, setCampusView] = useState(null) // null | 'template' | 'minimums'

  const schools = summary.data?.schools || []
  const campuses = useMemo(
    () => schools
      .filter((g) => g.majors.length)
      .map((g) => ({ id: g.school_id, name: g.school })),
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

  if (summary.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (summary.isError) return <Alert type='error'>Failed to load your dataset summary.</Alert>
  if (!campuses.length) {
    return <EmptyState title='No campuses yet'
      description='The dataset has no UC campuses at the moment.' />
  }

  if (!campus && campuses.length === 1) {
    selectCampus(campuses[0].id)
    return null
  }

  // The route fetching whatever the right-hand pane currently shows. Inside an
  // agreement, AgreementDetail renders its own per-tab hint instead.
  const paneRoute = !campus ? '/api/data/summary'
    : campusView === 'template' ? '/api/curated/degrees'
    : campusView === 'minimums' ? '/api/curated/requirements?kind=transfer_minimum'
    : collegeId == null ? '/api/assist/coverage'
    : null

  return (
    <Stack gap='cozy'>
      {paneRoute && (
        <div className='flex justify-end'>
          <RouteHint path={paneRoute} />
        </div>
      )}
      <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start'>
      <InstitutionRail items={campuses} selectedId={campus?.school_id}
        onSelect={selectCampus} title='UC campuses' searchable={false} />

      {/* College coverage list → agreement detail (or a campus-level view:
          degree template / hand-curated minimum) */}
      <Stack gap='cozy'>
        {!campus ? (
          <EmptyState title='Choose a campus'
            description='Pick a UC campus on the left to browse all of its agreements.' />
        ) : campusView === 'template' ? (
          <CampusDegreeTemplate schoolId={campus.school_id} school={campus.school}
            onBack={() => setCampusView(null)} />
        ) : campusView === 'minimums' ? (
          <Stack gap='cozy'>
            <div className='flex items-center'>
              <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={() => setCampusView(null)}>All colleges</Button>
            </div>
            <CampusMinimums schoolId={campus.school_id} />
          </Stack>
        ) : collegeId == null ? (
          <CampusColleges campus={campus} coverageByCc={coverageByCc} websiteByCc={websiteByCc}
            coverageLoading={coverage.isLoading || websiteCoverage.isLoading} onPick={setCollegeId}
            onCampusView={setCampusView} />
        ) : (
          <CampusAgreements campus={campus} collegeId={collegeId}
            coverageRows={coverageByCc.get(Number(collegeId)) || []}
            onBack={() => setCollegeId(null)} />
        )}
      </Stack>
      </div>
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

// Each college's campus-wide coverage, with all visible ASSIST agreements
// summarized into one row alongside the hand-curated hard minimum.
function CampusColleges({ campus, coverageByCc, websiteByCc, coverageLoading, onPick, onCampusView }) {
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
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-start gap-3'>
        <div>
          <p className='text-body-strong'>{campus.school}</p>
          <p className='text-caption text-ink-muted'>{withAgreement} colleges with agreements</p>
        </div>
        <span className='ml-auto flex items-center gap-2'>
          <Button variant='secondary' onClick={() => onCampusView('minimums')}>Min requirements</Button>
          <Button variant='secondary' onClick={() => onCampusView('template')}>Degree template</Button>
        </span>
      </div>
      <CollegeGeoFilters colleges={colleges.data || []} value={geo} onChange={setGeo} />
      <div className='flex flex-wrap items-center gap-3'>
        <Input className='w-72' value={q} onChange={(e) => setQ(e.target.value)}
          placeholder='Find a college…' leadingIcon={MagnifyingGlassIcon} />
          <span className='inline-flex items-center gap-3 text-caption text-ink-subtle'>
          <span className='inline-flex items-center gap-1.5'>
            <span className='inline-block w-2.5 h-2.5 rounded-full' style={{ backgroundColor: 'var(--color-success, #16a34a)' }} /> complete
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <span className='inline-block w-2.5 h-2.5 rounded-full' style={{ backgroundColor: 'var(--color-primary, #3366ef)' }} /> partial coverage
          </span>
          <span className='inline-flex items-center gap-1.5'>
            <span className='inline-block w-2.5 h-2.5 rounded-full bg-surface-muted border border-border' /> no agreement
          </span>
        </span>
      </div>
      {colleges.isLoading || coverageLoading ? (
        <div className='flex justify-center py-8'><Spinner /></div>
      ) : (
        <div className='surface-card overflow-auto max-h-[65vh]'>
          <table className='w-full text-left'>
            <thead className='sticky top-0 bg-surface border-b border-border'>
              <tr>
                <th className='px-3 py-2 text-label'>Community college</th>
                <th className='px-3 py-2 text-label whitespace-nowrap'>Hand curated</th>
                <th className='px-3 py-2 text-label whitespace-nowrap'>ASSIST agreement</th>
                <th className='px-3 py-2 text-label' />
              </tr>
            </thead>
            <tbody className='divide-y divide-border/60'>
              {rows.map((c) => (
                <tr key={c.id}
                  className={c.assistRows.length ? 'hover:bg-surface-hover cursor-pointer' : 'opacity-60'}
                  onClick={() => c.assistRows.length && onPick(Number(c.id))}>
                  <td className='px-3 py-1.5 text-body'>
                    {c.name}
                    {c.district && <span className='block text-caption text-ink-subtle'>{c.district}</span>}
                  </td>
                  <td className='px-3 py-1.5'>
                    {c.web ? <CoverageBar pct={c.web.pct_articulated} full={c.web.fully_articulated} width='w-20' /> :
                      <span className='text-caption text-ink-subtle'>—</span>}
                  </td>
                  <td className='px-3 py-1.5'>
                    {c.assistRows.length ? (
                      <span className='inline-flex flex-col gap-0.5'>
                        <CoverageBar pct={c.assist.average} full={c.assist.fullyArticulated} width='w-20' />
                        {c.assist.count > 1 && (
                          <span className='text-caption text-ink-subtle'>average across {c.assist.count} legacy agreements</span>
                        )}
                      </span>
                    ) :
                      <span className='text-caption text-ink-subtle'>no agreement</span>}
                  </td>
                  <td className='px-3 py-1.5 text-caption text-ink-subtle text-right'>{c.assistRows.length ? 'view →' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Stack>
  )
}

// Fill colors are inline: utility classes like bg-primary/60 resolve to the
// UUI theme's WHITE surface token here, which made the bars invisible.
function CoverageBar({ pct, full, width = 'w-24' }) {
  const v = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <span className='inline-flex items-center gap-2'>
      <span className={`inline-block ${width} h-2 rounded-pill bg-surface-muted border border-border overflow-hidden`}>
        <span className='block h-full rounded-pill'
          style={{ width: `${v}%`, backgroundColor: full ? 'var(--color-success, #16a34a)' : 'var(--color-primary, #3366ef)' }} />
      </span>
      <span className='text-caption font-mono tabular-nums text-ink'>{pct != null ? `${pct}%` : '—'}</span>
    </span>
  )
}

const normalizeMajor = (major) => String(major || '').trim().toLocaleLowerCase()

// One campus × college batch can contain several majors. Show every visible
// agreement in a stable order, with its own ledger and supporting data views.
function CampusAgreements({ campus, collegeId, coverageRows, onBack }) {
  const batch = useAgreementsBatch(collegeId, campus.school_id)
  const agreements = useMemo(() => {
    const group = (batch.data || []).find((g) => Number(g.school_id) === Number(campus.school_id))
    return (group?.agreements || []).slice().sort((a, b) => String(a.major).localeCompare(String(b.major)))
  }, [batch.data, campus.school_id])
  const coverageByMajor = useMemo(
    () => new Map(coverageRows.map((row) => [normalizeMajor(row.major), row])),
    [coverageRows]
  )

  return (
    <Stack gap='cozy'>
      <div className='flex items-center'>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={onBack}>All colleges</Button>
      </div>
      {batch.isLoading ? (
        <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
      ) : !agreements.length ? (
        <EmptyState title='No agreements' description='This college has no agreements for the selected campus.' />
      ) : (
        <Stack gap='section'>
          {agreements.map((agreement) => (
            <AgreementDetail key={agreement._id} agreementId={agreement._id}
              cov={coverageByMajor.get(normalizeMajor(agreement.major)) || null}
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
  const [editing, setEditing] = useState(false)
  const doc = useMemo(
    () => (q.data?.rows || []).find((r) => Number(r.school_id) === Number(schoolId)) || null,
    [q.data, schoolId]
  )
  const rawDoc = useMemo(
    () => (raw.data?.rows || []).find((r) => Number(r.school_id) === Number(schoolId)) || null,
    [raw.data, schoolId]
  )

  return (
    <Stack gap='cozy'>
      <div className='flex items-center'>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={onBack}>All colleges</Button>
      </div>
      {q.isLoading || raw.isLoading ? (
        <div className='flex justify-center py-10'><Spinner /></div>
      ) : q.isError || raw.isError ? (
        <Alert type='error'>Failed to load the degree template.</Alert>
      ) : !doc ? (
        <EmptyState title='No degree template'
          description='No hand-curated degree requirements have been added for this campus.'
          action={<Button leadingIcon={PencilSquareIcon} onClick={() => setEditing(true)}>Create template</Button>} />
      ) : (
        <DegreeRequirementsDetail doc={doc} onEdit={() => setEditing(true)} />
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

function AgreementDetail({ agreementId, cov = null, compareFor = null }) {
  const [view, setView] = useState('ledger') // ledger | stored | raw | comparison | degree
  const docQ = useAuditDoc(agreementId, 'uc')
  const raw = useRawAssist(agreementId, { enabled: view === 'raw' })
  const courses = useCourseList(docQ.data?.course_names)

  if (docQ.isLoading) return <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
  if (docQ.isError) return <Alert type='error'>Failed to load the agreement.</Alert>
  const doc = docQ.data?.doc
  if (!doc) return null

  const slug = `${doc.uc_school}-${doc.community_college}-${doc.major}`.replace(/[^a-z0-9]+/gi, '_')

  // The route fetching the active view's data — swaps with the tab.
  const viewRoute =
    view === 'raw' ? `/api/data/raw-assist/${agreementId}`
    : view === 'comparison' && compareFor
      ? `/api/curated/requirement-comparison?school_id=${compareFor.schoolId}&major=${encodeURIComponent(compareFor.major)}&community_college_id=${compareFor.communityCollegeId}`
    : view === 'degree' && compareFor
      ? `/api/curated/degree-evaluation?school_id=${compareFor.schoolId}&community_college_id=${compareFor.communityCollegeId}`
    : `/api/audit/doc/${agreementId}?system=uc`

  return (
    <Stack gap='cozy'>
      {/* Header: route title on the left, Open ASSIST on the right */}
      <div className='surface-card p-4 flex flex-wrap items-start gap-4'>
        <div className='min-w-0'>
          <p className='text-body-strong break-words'>
            {doc.community_college} <span className='text-ink-subtle'>→</span> {doc.uc_school}
            <span className='text-ink-subtle'> · </span>{doc.major}
          </p>
        </div>
        <div className='ml-auto flex items-center gap-4 shrink-0'>
          {docQ.data?.assist_url && (
            <Button variant='secondary' onClick={() => openAssist(docQ.data.assist_url)}>Open ASSIST</Button>
          )}
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        <Tabs value={view} onChange={setView}
          options={[
            { value: 'ledger', label: 'Agreement' },
            { value: 'stored', label: 'DB document' },
            { value: 'raw',    label: 'Raw ASSIST API' },
            ...(compareFor ? [{ value: 'comparison', label: 'Min comparison' }] : []),
            ...(compareFor ? [{ value: 'degree', label: 'Degree coverage' }] : []),
          ]} />
        <span className='ml-auto'><RouteHint path={viewRoute} /></span>
      </div>
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
// specific school's courses.
function CoursesBrowser() {
  const [kind, setKind] = useState('cc')
  return (
    <Stack gap='cozy'>
      <Tabs value={kind} onChange={setKind}
        options={[
          { value: 'cc', label: 'Community colleges' },
          { value: 'uc', label: 'UC campuses' },
        ]} />
      {kind === 'cc' ? <CcCoursesBrowser /> : <UniversityCoursesBrowser />}
    </Stack>
  )
}

function CourseTable({ rows, columns }) {
  return (
    <div className='surface-card overflow-auto max-h-[70vh]'>
      <table className='w-full text-left'>
        <thead className='sticky top-0 bg-surface border-b border-border'>
          <tr>{columns.map((c) => <th key={c.key} className='px-3 py-2 text-label whitespace-nowrap'>{c.label}</th>)}</tr>
        </thead>
        <tbody className='divide-y divide-border/60'>
          {rows.map((r, i) => (
            <tr key={r._id || i} className='hover:bg-surface-hover'>
              {columns.map((c) => (
                <td key={c.key} className='px-3 py-1.5 text-caption text-ink-muted align-top'>
                  {c.render ? c.render(r) : (r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className='surface-card p-3 lg:max-h-[75vh] overflow-auto'>
      <p className='text-label mb-2'>{title} · {sortedItems.length}</p>
      {searchable && (
        <div className='mb-3'>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Find…'
            leadingIcon={MagnifyingGlassIcon} />
        </div>
      )}
      <div className='space-y-1'>
        {visibleItems.map((item) => {
          const active = String(item.id) === String(selectedId)
          const subtitle = itemSubtitle?.(item)
          return (
            <button key={item.id} type='button' onClick={() => onSelect(item.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors ${
                active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'}`}>
              <span className='text-body leading-snug break-words'>{item.name}</span>
              {subtitle && (
                <span className='block text-caption text-ink-subtle leading-snug mt-0.5'>{subtitle}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Rail of institutions (buttons) → the picked one's course catalog. Shared by
// the CC and University course browsers. The route label updates as you drill
// in: the list route while browsing, the item route once one is picked.
function CatalogBrowser({ items, useCourses, columns, searchFields, railTitle, pickText, listRoute, itemRoute, railSearch = true, toolbar = null, itemSubtitle = null }) {
  const [selectedId, setSelectedId] = useState(null)
  const [courseQ, setCourseQ] = useState('')
  const coursesQ = useCourses(selectedId)

  const rows = useMemo(
    () => courseSearch(coursesQ.data || [], courseQ, searchFields)
      .slice().sort((a, b) => `${a.prefix} ${a.number}`.localeCompare(`${b.prefix} ${b.number}`)),
    [coursesQ.data, courseQ, searchFields]
  )

  return (
    <Stack gap='cozy'>
      <div className='flex justify-end'>
        <RouteHint path={selectedId != null ? itemRoute(selectedId) : listRoute} />
      </div>
      {toolbar}
      <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start'>
        <InstitutionRail items={items || []} selectedId={selectedId} title={railTitle}
          searchable={railSearch} itemSubtitle={itemSubtitle}
          onSelect={(id) => { setSelectedId(id); setCourseQ('') }} />

        {selectedId == null ? (
          <EmptyState title={pickText} description='Pick one from the list to browse its catalog.' />
        ) : (
          <Stack gap='cozy'>
            <div className='flex flex-wrap items-center gap-3'>
              <Input className='w-64' value={courseQ} onChange={(e) => setCourseQ(e.target.value)}
                placeholder='Search prefix / number / title…' leadingIcon={MagnifyingGlassIcon} />
              {!coursesQ.isLoading && <span className='text-caption text-ink-subtle'>{rows.length} courses</span>}
            </div>
            {coursesQ.isLoading ? <div className='flex justify-center py-8'><Spinner /></div>
              : rows.length ? <CourseTable rows={rows} columns={columns} />
              : <EmptyState title='No courses' description='No catalog rows here.' />}
          </Stack>
        )}
      </div>
    </Stack>
  )
}

function CcCoursesBrowser() {
  const colleges = useColleges()
  const [geo, setGeo] = useState(EMPTY_GEO)
  const all = colleges.data || []
  const filtered = useMemo(() => all.filter((c) => matchesGeo(c, geo)), [all, geo])
  return (
    <CatalogBrowser
      items={filtered}
      useCourses={useCcCourses}
      railTitle='Community colleges'
      toolbar={<CollegeGeoFilters colleges={all} value={geo} onChange={setGeo} />}
      itemSubtitle={(it) => it.district || null}
      pickText='Choose a college'
      listRoute='/api/assist/institutions?kind=community_college'
      itemRoute={(id) => `/api/assist/courses?institution_id=cc:${id}`}
      searchFields={['prefix', 'number', 'title']}
      columns={[
        { key: 'course', label: 'Course', render: (r) => <span className='font-mono text-ink'>{r.prefix} {r.number}</span> },
        { key: 'title', label: 'Title' },
        { key: 'units', label: 'Units', render: (r) => <span className='font-mono tabular-nums'>{r.units ?? '—'}</span> },
        { key: 'course_id', label: 'course_id', render: (r) => <span className='font-mono'>{r.course_id}</span> },
      ]}
    />
  )
}

function UniversityCoursesBrowser() {
  const schools = useSchools()
  return (
    <CatalogBrowser
      items={schools.data?.uc || []}
      useCourses={useUniversityCourses}
      railTitle='UC campuses'
      railSearch={false}
      pickText='Choose a campus'
      listRoute='/api/assist/institutions?kind=university'
      itemRoute={(id) => `/api/assist/courses?institution_id=uc:${id}`}
      searchFields={['prefix', 'number', 'title', 'department']}
      columns={[
        { key: 'course', label: 'Course', render: (r) => <span className='font-mono text-ink'>{r.prefix} {r.number}</span> },
        { key: 'title', label: 'Title' },
        { key: 'units', label: 'Units', render: (r) => <span className='font-mono tabular-nums'>{r.min_units ?? '—'}{r.max_units != null && r.max_units !== r.min_units ? `–${r.max_units}` : ''}</span> },
        { key: 'department', label: 'Department' },
        { key: 'parent_id', label: 'parent_id', render: (r) => <span className='font-mono'>{r.parent_id}</span> },
      ]}
    />
  )
}

// ───────── degree requirements (hand-gathered full four-year degree) ─────────
//
// The hand-gathered whole degree per campus (not the transfer minimum), in the
// same ASSIST requirement shape as agreements — so both views below are plain
// RequirementsLedger renders. See docs/figures/degree-coverage-sources.md.

// The stored template: what the campus requires to graduate, no college context.
export function DegreeRequirementsDetail({ doc, onEdit = null }) {
  // Defensive: a persisted (IndexedDB) response from an earlier endpoint shape
  // may lack `requirement_groups` — never crash the tab; the refetch replaces it.
  const groups = Array.isArray(doc.requirement_groups) ? doc.requirement_groups : []
  return (
    <Stack gap='cozy'>
      <div className='surface-card p-4 flex flex-wrap items-start gap-3'>
        <div className='min-w-0'>
          <p className='text-body-strong break-words'>{doc.school} <span className='text-ink-subtle'>·</span> {doc.program}</p>
          <p className='text-caption text-ink-muted mt-0.5'>
            {doc.total_units != null ? `${doc.total_units} units · ` : ''}{doc.total} requirements
            {doc.source_url && <> · <a className='text-primary hover:underline' href={doc.source_url} target='_blank' rel='noreferrer'>source</a></>}
          </p>
        </div>
        {onEdit && (
          <Button className='ml-auto' variant='secondary' leadingIcon={PencilSquareIcon} onClick={onEdit}>
            Edit template
          </Button>
        )}
      </div>
      <div className='uui-scope'>
        <RequirementsLedger major={{ requirement_groups: groups }}
          universityCoursesById={doc.university_courses_by_id || null} preserveOrder showCompletion={false} />
      </div>
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
  return (
    <Stack gap='cozy'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <StatTile label='4-year degree transferable' value={c.pct != null ? `${c.pct}%` : '—'}
          sub={`${c.covered} / ${c.total} requirements`} />
        <StatTile label='Major prep' value={`${tt.covered}/${tt.total}`} full={tt.covered === tt.total} />
        <StatTile label='Breadth' value={`${tb.covered}/${tb.total}`} full={tb.covered === tb.total} />
        <StatTile label='At the university' value={`${tier('nontransferable').total}`} />
      </div>
      <div className='uui-scope'>
        <RequirementsLedger major={{ requirement_groups: d.requirement_groups }} courses={d.courses}
          universityCoursesById={d.university_courses_by_id} preserveOrder showCompletion={false} />
      </div>
    </Stack>
  )
}
