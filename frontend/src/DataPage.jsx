import React, { useMemo, useState } from 'react'
import {
  MagnifyingGlassIcon, ArrowDownTrayIcon, ClipboardIcon, ArrowLeftIcon,
  ChartBarIcon, TrashIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Tabs, Input, LoadingLogo, Badge } from './components/ui'
import DatasetSummaryPanel from './components/DatasetSummaryPanel'
import RouteHint from './components/RouteHint'
import CollegeGeoFilters, { EMPTY_GEO } from './components/CollegeGeoFilters'
import { matchesGeo } from './shared/lib/collegeGeo'
import DataReferences from './DataReferences'
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
  useDegreeRequirements, useDegreeEvaluation,
} from '@frontend/query/hooks/useData'

/**
 * Data explorer — the partners' access point into the research database.
 * Everything shown is server-scoped to the caller's granted subset.
 *
 *   Overview            — counts, refresh time, and majors per school
 *   Agreements          — college × school × major browser; each agreement
 *                         viewable three ways: the PMT requirements ledger
 *                         (the website's own rendering), the JSON document
 *                         exactly as our database stores it, and the raw
 *                         ASSIST.org API payload the parser consumed.
 *   CC courses          — the community-college course catalog (referenced
 *                         by the ported agreements), searchable per college
 *   University courses  — the UC-side catalog, searchable per campus
 *   References          — imported lookup tables: UC hard minimums and
 *                         community-college district geography
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
            { value: 'cc',         label: 'CC courses' },
            { value: 'university', label: 'University courses' },
            { value: 'degree',     label: 'Degree reqs' },
            { value: 'references', label: 'References' },
          ]} />
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className='mx-auto max-w-screen-2xl px-6 py-6'>
          {tab === 'overview' && <DatasetSummaryPanel />}
          {tab === 'agreements' && <AgreementsBrowser />}
          {tab === 'cc' && <CcCoursesBrowser />}
          {tab === 'university' && <UniversityCoursesBrowser />}
          {tab === 'degree' && <DegreeRequirementsBrowser />}
          {tab === 'references' && <DataReferences />}
        </div>
      </div>
    </div>
  )
}

// ───────── agreements (program-first) ─────────
//
// Navigation follows the working set: pick one of the granted campus PROGRAMS
// (school + major — the exact things the admin selected), then a college list
// with live articulation coverage (the papers' heatmap column), then the
// agreement itself. No blind dropdown pairing.

const pKey = (schoolId, major) => `${schoolId}|${major}`

function AgreementsBrowser() {
  const summary = useDataSummary()
  const coverage = useCoverage()
  const websiteCoverage = useCoverage({ requirements: 'paper' })
  const [program, setProgram] = useState(null) // { school_id, school, major }
  const [collegeId, setCollegeId] = useState(null)

  const programsBySchool = summary.data?.schools || []
  const nPrograms = programsBySchool.reduce((s, g) => s + g.majors.length, 0)

  // ASSIST coverage rows for the active program (per major), keyed by college.
  const coverageByCc = useMemo(() => {
    const m = new Map()
    if (!program) return m
    for (const r of coverage.data?.rows || []) {
      if (Number(r.school_id) === Number(program.school_id) && r.major === program.major) {
        m.set(Number(r.community_college_id), r)
      }
    }
    return m
  }, [coverage.data, program])

  // Website (curated hard-minimum) coverage is campus-level — one row per
  // (school, college), identical across majors — so join by college only.
  const websiteByCc = useMemo(() => {
    const m = new Map()
    if (!program) return m
    for (const r of websiteCoverage.data?.rows || []) {
      if (Number(r.school_id) === Number(program.school_id)) m.set(Number(r.community_college_id), r)
    }
    return m
  }, [websiteCoverage.data, program])

  // Mean coverage per program — shown beside each program in the rail.
  const meanByProgram = useMemo(() => {
    const acc = new Map()
    for (const r of coverage.data?.rows || []) {
      if (r.pct_articulated == null) continue
      const k = pKey(r.school_id, r.major)
      const cur = acc.get(k) || { sum: 0, n: 0 }
      cur.sum += r.pct_articulated
      cur.n += 1
      acc.set(k, cur)
    }
    const out = new Map()
    for (const [k, { sum, n }] of acc) out.set(k, Math.round(sum / n))
    return out
  }, [coverage.data])

  if (summary.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (summary.isError) return <Alert type='error'>Failed to load your dataset summary.</Alert>
  if (!nPrograms) {
    return <EmptyState title='No programs yet'
      description='The dataset has no programs at the moment — check back after the next data update.' />
  }

  // Auto-select when there's exactly one program.
  if (!program && nPrograms === 1) {
    const g = programsBySchool.find((s) => s.majors.length)
    setProgram({ school_id: g.school_id, school: g.school, major: g.majors[0] })
    return null
  }

  return (
    <Stack gap='cozy'>
      <div className='flex justify-end'>
        <RouteHint path='/api/assist/institutions?kind=university' />
      </div>
      <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start'>
      {/* Program rail — the granted school+major pairs, grouped by campus */}
      <div className='surface-card p-3 lg:max-h-[75vh] overflow-auto'>
        <p className='text-label mb-2'>Programs · {nPrograms}</p>
        <Stack gap='cozy'>
          {programsBySchool.map((g) => (
            <div key={g.school_id}>
              <p className='text-caption text-ink-subtle mb-1'>{g.school}</p>
              {g.majors.map((m) => {
                const active = program && pKey(program.school_id, program.major) === pKey(g.school_id, m)
                const mean = meanByProgram.get(pKey(g.school_id, m))
                return (
                  <button key={m} type='button'
                    onClick={() => { setProgram({ school_id: g.school_id, school: g.school, major: m }); setCollegeId(null) }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors mb-0.5 flex items-baseline gap-2 ${
                      active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'}`}>
                    <span className='text-body break-words leading-snug min-w-0'>{m}</span>
                    {mean != null && (
                      <span className='ml-auto shrink-0 text-caption font-mono tabular-nums text-ink-muted'>{mean}%</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </Stack>
      </div>

      {/* College coverage list → agreement detail */}
      {!program ? (
        <EmptyState title='Pick a program'
          description='Choose a campus program on the left to see how every community college articulates to it.' />
      ) : collegeId == null ? (
        <ProgramColleges program={program} coverageByCc={coverageByCc} websiteByCc={websiteByCc}
          coverageLoading={coverage.isLoading || websiteCoverage.isLoading} onPick={setCollegeId} />
      ) : (
        <ProgramAgreement program={program} collegeId={collegeId}
          cov={coverageByCc.get(Number(collegeId)) || null}
          website={websiteByCc.get(Number(collegeId)) || null}
          onBack={() => setCollegeId(null)} />
      )}
      </div>
    </Stack>
  )
}

// Every college's minimums coverage for one program, ASSIST vs the hand-curated
// hard-minimum side by side — doubling as navigation into the course-level
// comparison (Level 2).
function ProgramColleges({ program, coverageByCc, websiteByCc, coverageLoading, onPick }) {
  const colleges = useColleges()
  const [q, setQ] = useState('')
  const [geo, setGeo] = useState(EMPTY_GEO)

  const rows = useMemo(() => {
    const all = (colleges.data || []).map((c) => {
      const assist = coverageByCc.get(Number(c.id)) || null
      const web = websiteByCc.get(Number(c.id)) || null
      return { ...c, assist, web }
    }).filter((c) => c.assist || c.web)
      .filter((c) => matchesGeo(c, geo))
      .sort((a, b) => (b.assist?.pct_articulated ?? -1) - (a.assist?.pct_articulated ?? -1) || a.name.localeCompare(b.name))
    if (!q.trim()) return all
    const s = q.toLowerCase()
    return all.filter((c) => c.name.toLowerCase().includes(s))
  }, [colleges.data, coverageByCc, websiteByCc, q, geo])

  const withAgreement = rows.filter((r) => r.assist).length

  return (
    <Stack gap='cozy'>
      <div>
        <p className='text-body-strong'>{program.major}</p>
        <p className='text-caption text-ink-muted'>
          {program.school} · {withAgreement} colleges with an agreement · Hand-curated = hand-gathered hard minimum, ASSIST = full stated minimum
        </p>
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
            <span className='inline-block w-2.5 h-2.5 rounded-full' style={{ backgroundColor: 'var(--color-primary, #3366ef)' }} /> partial
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
                <th className='px-3 py-2 text-label whitespace-nowrap'>ASSIST min.</th>
                <th className='px-3 py-2 text-label' />
              </tr>
            </thead>
            <tbody className='divide-y divide-border/60'>
              {rows.map((c) => (
                <tr key={c.id}
                  className={c.assist ? 'hover:bg-surface-hover cursor-pointer' : 'opacity-60'}
                  onClick={() => c.assist && onPick(Number(c.id))}>
                  <td className='px-3 py-1.5 text-body'>
                    {c.name}
                    {c.district && <span className='block text-caption text-ink-subtle'>{c.district}</span>}
                  </td>
                  <td className='px-3 py-1.5'>
                    {c.web ? <CoverageBar pct={c.web.pct_articulated} full={c.web.fully_articulated} width='w-20' /> :
                      <span className='text-caption text-ink-subtle'>—</span>}
                  </td>
                  <td className='px-3 py-1.5'>
                    {c.assist ? <CoverageBar pct={c.assist.pct_articulated} full={c.assist.fully_articulated} width='w-20' /> :
                      <span className='text-caption text-ink-subtle'>no agreement</span>}
                  </td>
                  <td className='px-3 py-1.5 text-caption text-ink-subtle text-right'>{c.assist ? 'view →' : ''}</td>
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

// The agreement for (program × college): resolve its _id from the batch
// endpoint, then reuse the three-representation detail view.
function ProgramAgreement({ program, collegeId, cov, onBack }) {
  const batch = useAgreementsBatch(collegeId, program.school_id)
  const agreement = useMemo(() => {
    const group = (batch.data || []).find((g) => Number(g.school_id) === Number(program.school_id))
    return (group?.agreements || []).find((a) => a.major === program.major) || null
  }, [batch.data, program])

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={onBack}>All colleges</Button>
        <span className='ml-auto'>
          <RouteHint path={`/api/assist/agreements?college_id=cc:${collegeId}&university_id=uc:${program.school_id}`} />
        </span>
      </div>
      {batch.isLoading ? (
        <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
      ) : !agreement ? (
        <EmptyState title='No agreement' description='This college has no agreement for the selected program.' />
      ) : (
        <AgreementDetail agreementId={agreement._id} cov={cov}
          compareFor={{ schoolId: program.school_id, major: program.major, communityCollegeId: collegeId }} />
      )}
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
  const [view, setView] = useState('ledger') // ledger | stored | raw | comparison
  const docQ = useAuditDoc(agreementId, 'uc')
  const raw = useRawAssist(agreementId, { enabled: view === 'raw' })
  const courses = useCourseList(docQ.data?.course_names)

  if (docQ.isLoading) return <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
  if (docQ.isError) return <Alert type='error'>Failed to load the agreement.</Alert>
  const doc = docQ.data?.doc
  if (!doc) return null

  const slug = `${doc.uc_school}-${doc.community_college}-${doc.major}`.replace(/[^a-z0-9]+/gi, '_')
  const missing = cov ? cov.receivers_required - cov.receivers_articulated : null

  return (
    <Stack gap='cozy'>
      {/* Header: route title + provenance on the left, coverage stat + ASSIST on the right */}
      <div className='surface-card p-4 flex flex-wrap items-start gap-4'>
        <div className='min-w-0'>
          <p className='text-body-strong break-words'>
            {doc.community_college} <span className='text-ink-subtle'>→</span> {doc.uc_school}
            <span className='text-ink-subtle'> · </span>{doc.major}
          </p>
          <p className='text-caption text-ink-subtle mt-0.5 font-mono break-all'>
            {doc._id} · source ASSIST
          </p>
        </div>
        <div className='ml-auto flex items-center gap-4 shrink-0'>
          {cov && (
            <div className='text-right'>
              <p className={`text-stat font-mono leading-none ${cov.fully_articulated ? 'text-success' : 'text-ink'}`}>
                {cov.pct_articulated}%
              </p>
              <p className='text-caption text-ink-muted mt-0.5'>
                {cov.receivers_articulated} / {cov.receivers_required} articulated
              </p>
            </div>
          )}
          {docQ.data?.assist_url && (
            <Button variant='secondary' onClick={() => openAssist(docQ.data.assist_url)}>Open ASSIST</Button>
          )}
        </div>
      </div>
      <Tabs value={view} onChange={setView}
        options={[
          { value: 'ledger', label: 'Rendered' },
          { value: 'stored', label: 'Stored JSON' },
          { value: 'raw',    label: 'Raw ASSIST API' },
          ...(compareFor ? [{ value: 'comparison', label: 'Comparison' }] : []),
          ...(compareFor ? [{ value: 'degree', label: '4-year degree' }] : []),
        ]} />
      {view === 'comparison' && compareFor && <ComparisonView compareFor={compareFor} />}
      {view === 'degree' && compareFor && (
        <DegreeCompletionView schoolId={compareFor.schoolId} collegeId={compareFor.communityCollegeId} />
      )}
      {view === 'ledger' && (
        <>
          <div className='uui-scope'>
            <RequirementsLedger major={doc} courses={courses}
              universityCoursesById={docQ.data?.university_courses || null} preserveOrder />
          </div>
          {cov && (
            <p className='text-caption text-ink-muted border-t border-border pt-2'>
              {cov.receivers_articulated} of {cov.receivers_required} required receivers articulated
              {missing > 0 ? <> · <span className='text-ink'>{missing}</span> have no comparable community-college path</> : ' · fully articulated'}
            </p>
          )}
        </>
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

// Level 2 — ASSIST vs the hand-curated hard-minimum for one college. Three
// summary tiles, then the hand-curated minimum as a ledger-like UC → CC list
// (the CC course that articulates each requirement here), then a separately-
// labeled list of the courses ASSIST asks for BEYOND the hand-curated minimum
// (choose-N honored — an unchosen alternative of a satisfied section is not counted).
function ComparisonView({ compareFor }) {
  const cmp = useRequirementComparison(compareFor)
  if (cmp.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (cmp.isError) return <Alert type='error'>Failed to load the minimums comparison.</Alert>
  const d = cmp.data
  if (!d || !d.website_requirements) return <EmptyState title='No comparison' description='No curated or ASSIST minimums to compare for this college.' />

  const web = d.website || {}
  const assist = d.assist || {}
  const net = d.net_courses ?? 0
  const extraGroups = d.assist_extra_groups || []
  const netSub = net === 0
    ? 'ASSIST and the hand-curated minimum require the same number of courses'
    : `ASSIST requires ${Math.abs(net)} ${net > 0 ? 'more' : 'fewer'} course${Math.abs(net) === 1 ? '' : 's'} than the hand-curated minimum`

  return (
    <Stack gap='cozy'>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <StatTile label='Hand-curated minimum' value={web.pct != null ? `${web.pct}%` : '—'}
          sub={`${web.articulated ?? 0} / ${web.required ?? 0} required · ${web.fully ? 'fully prepared' : 'not fully'}`}
          full={web.fully} />
        <StatTile label='ASSIST minimum' value={assist.pct != null ? `${assist.pct}%` : '—'}
          sub={`${assist.articulated ?? 0} / ${assist.required ?? 0} required · ${assist.fully ? 'fully prepared' : 'not fully'}`}
          full={assist.fully} />
        <StatTile label='Minimum difference' value={net === 0 ? 'same' : `${net > 0 ? '+' : '−'}${Math.abs(net)}`}
          sub={netSub} />
      </div>

      <div className='surface-card overflow-hidden'>
        <div className='px-4 py-2.5 border-b border-border'>
          <p className='text-body-strong'>Hand-curated minimum</p>
          <p className='text-caption text-ink-muted mt-0.5'>
            The hand-curated per-campus hard minimum, and how {d.community_college || 'this college'} articulates each course.
          </p>
        </div>
        <div className='divide-y divide-border/60'>
          {d.website_requirements.map((r, i) => (
            <MinRow key={r.parent_id ?? `${r.uc_code}-${i}`}
              code={r.uc_code} parentId={r.parent_id} articulated={r.articulated} ccOptions={r.cc_options}
              college={d.community_college}
              note={r.in_assist ? null : 'not in ASSIST minimum'} />
          ))}
        </div>
      </div>

      <div className='surface-card overflow-hidden'>
        <div className='px-4 py-2.5 border-b border-border bg-primary-soft/40'>
          <p className='text-body-strong'>ASSIST requires beyond the hand-curated minimum</p>
          <p className='text-caption text-ink-muted mt-0.5'>
            {extraGroups.length
              ? `${d.assist_extra} additional required course${d.assist_extra === 1 ? '' : 's'} in the full ASSIST minimum for this major — ${d.assist_extra_articulated} articulate here.`
              : 'ASSIST asks for nothing beyond the hand-curated minimum for this major.'}
          </p>
        </div>
        {extraGroups.length > 0 && (
          <div className='divide-y divide-border/60'>
            {extraGroups.map((g, gi) => <ExtraGroup key={gi} group={g} college={d.community_college} />)}
          </div>
        )}
      </div>
    </Stack>
  )
}

// One ASSIST-extra section. When every option is required (choose === count) the
// options render as plain rows; a genuine choose-k section renders a "Choose k of"
// header and gets the gap wash only if the whole choice is unsatisfiable here.
function ExtraGroup({ group, college }) {
  const isChoice = group.choose < group.options.length
  if (!isChoice) {
    return (
      <>
        {group.options.map((o, i) => (
          <MinRow key={o.parent_id ?? `${o.uc_code}-${i}`}
            code={o.uc_code} parentId={o.parent_id} articulated={o.articulated} ccOptions={o.cc_options}
            college={college} gap={!o.articulated} />
        ))}
      </>
    )
  }
  return (
    <div className={group.gap ? 'bg-danger-soft/30' : ''}>
      <p className='px-4 pt-2.5 pb-1 text-label text-ink-muted'>Choose {group.choose} of</p>
      {group.options.map((o, i) => (
        <MinRow key={o.parent_id ?? `${o.uc_code}-${i}`}
          code={o.uc_code} parentId={o.parent_id} articulated={o.articulated} ccOptions={o.cc_options}
          college={college} indent />
      ))}
    </div>
  )
}

// One requirement: UC course on the left, the articulating CC course(s) on the
// right (chips, "+" within an option and "or" between options), or a clear
// not-articulated note. Unsatisfiable required rows (gaps) get a soft danger wash.
function MinRow({ code, parentId, articulated, ccOptions, college, gap = false, note = null, indent = false }) {
  return (
    <div className={`flex items-baseline gap-3 px-4 py-2.5 ${indent ? 'pl-8' : ''} ${gap ? 'bg-danger-soft/30' : ''}`}>
      <span className='font-mono text-body-strong text-ink w-24 shrink-0'>{code || `#${parentId}`}</span>
      <span className='text-ink-subtle shrink-0'>→</span>
      <span className='min-w-0 flex-1'>
        {articulated && ccOptions?.length ? (
          <CcOptions options={ccOptions} />
        ) : (
          <span className='text-caption' style={{ color: 'var(--color-danger)' }}>
            not articulated{college ? ` at ${college}` : ''}
          </span>
        )}
      </span>
      {note && <span className='text-caption text-ink-subtle shrink-0 italic'>{note}</span>}
    </div>
  )
}

// CC course options as chips: codes within one option joined by "+", options by "or".
function CcOptions({ options }) {
  return (
    <span className='inline-flex flex-wrap items-center gap-x-1.5 gap-y-1'>
      {options.map((opt, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className='text-caption text-ink-subtle italic px-0.5'>or</span>}
          <span className='inline-flex flex-wrap items-center gap-1'>
            {opt.map((code, j) => (
              <React.Fragment key={j}>
                {j > 0 && <span className='text-caption text-ink-subtle'>+</span>}
                <span className='px-2 py-0.5 rounded-md bg-surface-muted border border-border font-mono text-caption text-ink'>{code}</span>
              </React.Fragment>
            ))}
          </span>
        </React.Fragment>
      ))}
    </span>
  )
}

function StatTile({ label, value, sub, full }) {
  return (
    <div className='surface-card p-3'>
      <p className='text-label text-ink-muted'>{label}</p>
      <p className={`text-stat font-mono leading-none mt-1 ${full ? 'text-success' : 'text-ink'}`}>{value}</p>
      <p className='text-caption text-ink-subtle mt-1'>{sub}</p>
    </div>
  )
}

// ───────── course catalogs ─────────

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

// Rail of institutions (buttons) → the picked one's course catalog. Shared by
// the CC and University course browsers. The route label updates as you drill
// in: the list route while browsing, the item route once one is picked.
function CatalogBrowser({ items, useCourses, columns, searchFields, blurb, railTitle, pickText, listRoute, itemRoute, railSearch = true, toolbar = null, itemSubtitle = null }) {
  const [selectedId, setSelectedId] = useState(null)
  const [railQ, setRailQ] = useState('')
  const [courseQ, setCourseQ] = useState('')
  const coursesQ = useCourses(selectedId)

  const sortedItems = useMemo(() => (items || []).slice().sort((a, b) => a.name.localeCompare(b.name)), [items])
  const railItems = useMemo(() => {
    const s = railQ.trim().toLowerCase()
    return s ? sortedItems.filter((i) => i.name.toLowerCase().includes(s)) : sortedItems
  }, [sortedItems, railQ])
  const rows = useMemo(
    () => courseSearch(coursesQ.data || [], courseQ, searchFields)
      .slice().sort((a, b) => `${a.prefix} ${a.number}`.localeCompare(`${b.prefix} ${b.number}`)),
    [coursesQ.data, courseQ, searchFields]
  )

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <p className='text-caption text-ink-muted max-w-prose'>{blurb}</p>
        <span className='ml-auto'><RouteHint path={selectedId != null ? itemRoute(selectedId) : listRoute} /></span>
      </div>
      {toolbar}
      <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start'>
        <div className='surface-card p-3 lg:max-h-[75vh] overflow-auto'>
          <p className='text-label mb-2'>{railTitle} · {sortedItems.length}</p>
          {railSearch && (
            <div className='mb-3'>
              <Input value={railQ} onChange={(e) => setRailQ(e.target.value)} placeholder='Find…'
                leadingIcon={MagnifyingGlassIcon} />
            </div>
          )}
          <div className='space-y-1'>
            {railItems.map((it) => {
              const active = String(it.id) === String(selectedId)
              return (
                <button key={it.id} type='button'
                  onClick={() => { setSelectedId(it.id); setCourseQ('') }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors ${
                    active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'}`}>
                  <span className='text-body leading-snug break-words'>{it.name}</span>
                  {itemSubtitle && itemSubtitle(it) && (
                    <span className='block text-caption text-ink-subtle leading-snug mt-0.5'>{itemSubtitle(it)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

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
      blurb='Full community-college catalog for every school in the research dataset.'
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
      blurb='Full UC catalog for every campus in the research dataset.'
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
// Read-only inspector over curated degree requirements — the hand-gathered whole
// degree per campus (not the transfer minimum). Total = every requirement slot;
// only transferable + breadth slots can be satisfied by a CC. See
// docs/figures/degree-coverage-sources.md.

function DegreeRequirementsBrowser() {
  const q = useDegreeRequirements()
  const [selectedId, setSelectedId] = useState(null)

  const rows = q.data?.rows || []
  const selected = rows.find((r) => String(r._id) === String(selectedId)) || rows[0] || null

  if (q.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the degree requirements.</Alert>
  if (!rows.length) {
    return <EmptyState title='No degree requirements yet'
      description='Run scripts/import_uc_degree_requirements.py to load the hand-gathered four-year degree requirements.' />
  }

  return (
    <Stack gap='cozy'>
      <p className='text-caption text-ink-muted max-w-prose'>
        Hand-gathered full four-year degree requirements per campus, modeled in the ASSIST requirement shape.
        The <span className='text-ink'>denominator</span> for the degree-coverage figure is the total requirement
        slots; only <span className='text-ink'>transferable</span> and <span className='text-ink'>breadth</span> slots
        can be satisfied at a community college.
      </p>
      <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start'>
        <div className='surface-card p-3 lg:max-h-[75vh] overflow-auto'>
          <p className='text-label mb-2'>UC campuses · {rows.length}</p>
          <div className='space-y-1'>
            {rows.map((r) => {
              const active = selected && String(r._id) === String(selected._id)
              return (
                <button key={r._id} type='button' onClick={() => setSelectedId(r._id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors ${
                    active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'}`}>
                  <span className='text-body leading-snug break-words'>{r.school}</span>
                  <span className='block text-caption text-ink-subtle leading-snug mt-0.5'>{r.program}</span>
                </button>
              )
            })}
          </div>
        </div>
        {selected && <DegreeRequirementsDetail doc={selected} />}
      </div>
    </Stack>
  )
}

// ── shared readable renderer: groups → course rows, no "Required" tags ──

// One requirement line: course code + title on the left; when evaluated against a
// college, a right-side status (green + the CC course, "at the university", a
// partial count, or a muted dash for no equivalent here).
function DegreeLine({ line, evaluated }) {
  return (
    <div className='flex items-baseline gap-3 py-0.5'>
      {line.code
        ? <span className='font-mono text-body text-ink shrink-0 w-24'>{line.code}</span>
        : <span className='shrink-0 w-24' />}
      <span className='text-body text-ink-muted min-w-0 flex-1'>
        {line.title}
        {line.detail && <span className='text-caption text-ink-subtle'> · {line.detail}</span>}
      </span>
      {evaluated && (
        <span className='shrink-0 text-caption text-right max-w-[45%]'>
          {line.status === 'covered' && (
            <span className='text-success'>✓ {
              line.qualifying != null ? `${line.qualifying} courses qualify`
                : line.cc?.length ? line.cc.slice(0, 3).join(', ')
                : 'articulated'
            }</span>
          )}
          {line.status === 'partial' && (
            <span className='text-ink'>{line.qualifying != null ? `${line.qualifying} qualify · ` : ''}{line.covered} of {line.need}</span>
          )}
          {line.status === 'university' && <span className='text-ink-subtle italic'>at the university</span>}
          {line.status === 'missing' && <span className='text-ink-subtle'>—</span>}
        </span>
      )}
    </div>
  )
}

function DegreeGroupBlock({ group, evaluated }) {
  const nonTransferable = group.tier === 'nontransferable'
  return (
    <div className='px-4 py-3'>
      <div className='flex items-baseline gap-2 mb-1'>
        <p className='text-body-strong'>{group.label}</p>
        <span className={`ml-auto text-caption font-mono tabular-nums ${
          evaluated ? (group.covered === group.total ? 'text-success' : 'text-ink-muted') : 'text-ink-subtle'}`}>
          {evaluated ? `${group.covered}/${group.total}` : `${group.total} course${group.total === 1 ? '' : 's'}`}
        </span>
      </div>
      {nonTransferable ? (
        <p className='text-caption text-ink-subtle italic'>
          {group.total} course{group.total === 1 ? '' : 's'} — completed at the university
        </p>
      ) : (
        group.lines.map((l, j) => <DegreeLine key={j} line={l} evaluated={evaluated} />)
      )}
    </div>
  )
}

function DegreeGroups({ groups, evaluated }) {
  return (
    <div className='surface-card divide-y divide-border/60'>
      {groups.map((g, i) => <DegreeGroupBlock key={i} group={g} evaluated={evaluated} />)}
    </div>
  )
}

export function DegreeRequirementsDetail({ doc }) {
  // Defensive: a persisted (IndexedDB) response from an earlier endpoint shape
  // may lack `groups` — never crash the tab; the refetch replaces it.
  const groups = Array.isArray(doc.groups) ? doc.groups : []
  return (
    <Stack gap='cozy'>
      <div className='surface-card p-4 flex flex-wrap items-start gap-4'>
        <div className='min-w-0'>
          <p className='text-body-strong break-words'>{doc.school} <span className='text-ink-subtle'>·</span> {doc.program}</p>
          <p className='text-caption text-ink-muted mt-0.5'>
            {doc.total_units != null ? `${doc.total_units}-unit degree · ` : ''}{doc.total} requirements to graduate
            {doc.source_url && <> · <a className='text-primary hover:underline' href={doc.source_url} target='_blank' rel='noreferrer'>source</a></>}
          </p>
        </div>
        <div className='ml-auto text-right shrink-0'>
          <p className='text-stat font-mono leading-none text-ink'>{doc.total}</p>
          <p className='text-caption text-ink-muted mt-0.5'>total requirements</p>
        </div>
      </div>
      <DegreeGroups groups={groups} evaluated={false} />
    </Stack>
  )
}

// One campus's whole four-year degree evaluated against the selected college:
// how many of the degree's requirements the college can satisfy, grouped and
// readable. Shown as a tab inside an agreement pair view.
function DegreeCompletionView({ schoolId, collegeId }) {
  const q = useDegreeEvaluation(schoolId, collegeId)
  if (q.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (q.isError) {
    return <EmptyState title='No degree template yet'
      description='This campus has no hand-gathered four-year degree requirements yet — add it in the Degree reqs tab.' />
  }
  const d = q.data
  const c = d.completion
  const groups = Array.isArray(d.groups) ? d.groups : []
  const tier = (k) => c.by_tier?.[k] || { total: 0, covered: 0 }
  return (
    <Stack gap='cozy'>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <StatTile label='4-year degree transferable' value={c.pct != null ? `${c.pct}%` : '—'}
          sub={`${c.covered} of ${c.total} requirements`} />
        <StatTile label='Major prep' value={`${tier('transferable').covered}/${tier('transferable').total}`}
          sub='math, CS, science' />
        <StatTile label='Breadth (H/SS)' value={`${tier('breadth').covered}/${tier('breadth').total}`}
          sub='R&C + humanities/social science' />
        <StatTile label='At the university' value={`${tier('nontransferable').total}`}
          sub='upper-division — cannot transfer' />
      </div>
      <p className='text-caption text-ink-muted'>
        {d.school} · {d.program}, evaluated against this college — every lower-division course this college
        articulates counts toward the whole degree. Upper-division and residency requirements can't transfer by construction.
      </p>
      <DegreeGroups groups={groups} evaluated />
    </Stack>
  )
}
