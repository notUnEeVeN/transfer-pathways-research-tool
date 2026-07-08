import React, { useMemo, useState } from 'react'
import {
  MagnifyingGlassIcon, ArrowDownTrayIcon, ClipboardIcon, ArrowLeftIcon,
  ChartBarIcon, TrashIcon, PencilSquareIcon, CodeBracketIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Tabs, Input, LoadingLogo, Badge } from './components/ui'
import DatasetSummaryPanel from './components/DatasetSummaryPanel'
import RouteHint from './components/RouteHint'
import DataReferences from './DataReferences'
import { ANALYSES } from './analyses/registry'
import AnalysisCard from './analyses/AnalysisCard'
import FigureScriptModal, { liveBadge } from './analyses/FigureScriptModal'
import { fmtDate as fmtGalleryDate } from './shared/fmtDate'
import { useAccessMe, useAnalysisReleases } from '@frontend/query/hooks/useAccess'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import { openAssist } from './pages/Audit/lib/auditFormat'
import { useCourseList } from './pages/Audit/hooks/useCourseList'
import { useAuditDoc } from '@frontend/query/hooks/useAudit'
import {
  useColleges, useSchools, useCcCourses, useUniversityCourses, useAgreementsBatch,
  useRawAssist, useDataSummary, useCoverage, useRequirementComparison,
  useFigures, useDeleteFigure, useEditFigure, downloadFigure,
  useRefreshFigureScript,
} from '@frontend/query/hooks/useData'

/**
 * Data explorer — the partners' access point into the research database.
 * Everything shown is server-scoped to the caller's granted subset.
 *
 *   Overview            — dataset version, counts, majors per school
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
            { value: 'references', label: 'References' },
          ]} />
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className='mx-auto max-w-screen-2xl px-6 py-6'>
          {tab === 'overview' && <DatasetSummaryPanel />}
          {tab === 'agreements' && <AgreementsBrowser />}
          {tab === 'cc' && <CcCoursesBrowser />}
          {tab === 'university' && <UniversityCoursesBrowser />}
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
      <div className='flex justify-end'><RouteHint path='/schools' /></div>
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

  const rows = useMemo(() => {
    const all = (colleges.data || []).map((c) => {
      const assist = coverageByCc.get(Number(c.id)) || null
      const web = websiteByCc.get(Number(c.id)) || null
      return { ...c, assist, web }
    }).filter((c) => c.assist || c.web)
      .sort((a, b) => (b.assist?.pct_articulated ?? -1) - (a.assist?.pct_articulated ?? -1) || a.name.localeCompare(b.name))
    if (!q.trim()) return all
    const s = q.toLowerCase()
    return all.filter((c) => c.name.toLowerCase().includes(s))
  }, [colleges.data, coverageByCc, websiteByCc, q])

  const withAgreement = rows.filter((r) => r.assist).length

  return (
    <Stack gap='cozy'>
      <div>
        <p className='text-body-strong'>{program.major}</p>
        <p className='text-caption text-ink-muted'>
          {program.school} · {withAgreement} colleges with an agreement · Hand-curated = hand-gathered hard minimum, ASSIST = full stated minimum
        </p>
      </div>
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
                  <td className='px-3 py-1.5 text-body'>{c.name}</td>
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
          <RouteHint path={`/uc-agreements-batch/${collegeId}?school_id=${program.school_id}`} />
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

// ───────── analysis: live visualizers + published figure gallery ─────────
//
// Live visualizers compute from /analysis endpoints in the browser. Published
// figures are notebook snapshots from pmt.publish(); the site stores and shows
// rendered images only.

// Small Draft/Released status pill — admin-only, shown in each analysis card
// header so the admin can see at a glance what partners currently get.
function ReleaseBadge({ released }) {
  return <Badge variant={released ? 'success' : 'neutral'}>{released ? 'Released' : 'Draft'}</Badge>
}

// Exported for the top-level Visuals tab (App.jsx); lives here with its gallery.
export function AnalysisTab({ onNavigate = () => {} }) {
  const me = useAccessMe()
  const isAdmin = me.data?.role === 'admin'
  const releasesQ = useAnalysisReleases()
  const releasedSet = useMemo(() => new Set(releasesQ.data?.released_ids || []), [releasesQ.data])
  const disabledSet = useMemo(() => new Set(releasesQ.data?.disabled_ids || []), [releasesQ.data])
  // Disabled analyses are gone for every role — not mounted, so their
  // endpoints are never fetched (Admin → Analysis releases re-enables them).
  // Of the rest, admins preview everything (badged Draft/Released); partners
  // only see the released ones.
  const visibleAnalyses = ANALYSES.filter(
    (a) => !disabledSet.has(a.id) && (isAdmin || releasedSet.has(a.id))
  )
  const hasVisibleAnalyses = visibleAnalyses.length > 0
  const releasesPending = releasesQ.isLoading // don't flash "nothing" before releases load

  const myUid = me.data?.uid || null
  const figs = useFigures()
  const del = useDeleteFigure()
  const edit = useEditFigure()
  const figures = figs.data?.figures || []
  const currentVersion = figs.data?.dataset_version || null

  // Built-in analyses + published figures in one gallery, oldest-first.
  const gallery = useMemo(() => {
    const analysisItems = visibleAnalyses.map((a) => ({ kind: 'analysis', key: a.id, at: a.published_at, a }))
    const figureItems = figures.map((f) => ({ kind: 'figure', key: f.slug, at: f.updated_at, f }))
    return [...analysisItems, ...figureItems].sort((x, y) => new Date(x.at || 0) - new Date(y.at || 0))
  }, [visibleAnalyses, figures])

  return (
    <Stack gap='section'>
      {figs.isError && <Alert type='error'>Failed to load the figure gallery.</Alert>}
      {(figs.isLoading || releasesPending) && !hasVisibleAnalyses && <div className='flex justify-center py-10'><Spinner /></div>}
      {!figs.isLoading && !releasesPending && !figs.isError && !gallery.length && (
        <div className='mx-auto max-w-screen-md'>
          <div className='surface-card p-8 text-center'>
            <ChartBarIcon className='w-8 h-8 text-ink-subtle mx-auto mb-3' />
            <p className='text-body-strong'>{isAdmin ? 'No figures published yet' : 'No analyses available yet'}</p>
            <p className='text-body text-ink-muted mt-2 max-w-prose mx-auto'>
              {isAdmin ? (
                <>This gallery shows every figure the team publishes from Python —
                one <span className='font-mono text-ink'>pmt.publish(fig, …)</span> call
                in your notebook and it appears here for everyone, stamped with
                the dataset version it was computed from.</>
              ) : (
                <>Analyses are released here as the team finishes them — check back
                soon. Published notebook figures will also appear on this tab.</>
              )}
            </p>
            {isAdmin && (
              <div className='mt-4'>
                <Button onClick={() => onNavigate('api')}>Set up in 2 minutes → API tab</Button>
              </div>
            )}
          </div>
        </div>
      )}
      {gallery.map((item) => {
        if (item.kind === 'figure') {
          const f = item.f
          return (
            <FigureCard key={item.key} fig={f} currentVersion={currentVersion}
              canModify={isAdmin || (!!myUid && f.author_uid === myUid)}
              onDelete={() => del.mutate(f.slug)} deleting={del.isPending}
              onSave={(fields) => edit.mutateAsync({ slug: f.slug, fields })}
              saving={edit.isPending} />
          )
        }
        const { a } = item
        const Component = a.Component
        return (
          <AnalysisCard key={item.key} title={a.title}
            source={`${a.author_label} · ${fmtGalleryDate(a.published_at)}`}
            exportName={a.id}
            badge={isAdmin ? <ReleaseBadge released={releasedSet.has(a.id)} /> : null}>
            <Component />
          </AnalysisCard>
        )
      })}
    </Stack>
  )
}


// Published figure in the AnalysisCard shell. Downloads serve the stored
// svg/png/pdf. Owner/admin get edit (metadata) + delete; others read-only.
// Live figures (mode 'live') carry a script the server re-runs on data
// changes: everyone can view the code; owner/admin also get refresh & controls.
const shortAuthorUid = (uid) => (uid ? `UID ${String(uid).slice(0, 8)}` : 'unknown author')

function FigureCard({ fig, currentVersion, canModify, onDelete, deleting, onSave, saving }) {
  const [editing, setEditing] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [title, setTitle] = useState(fig.title)
  const [caption, setCaption] = useState(fig.caption || '')
  const [sourceUrl, setSourceUrl] = useState(fig.source_url || '')
  const refresh = useRefreshFigureScript()
  const isLive = fig.mode === 'live'
  const live = liveBadge(fig)
  const stale = fig.dataset_version && currentVersion && fig.dataset_version !== currentVersion

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

  const badge = (
    <>
      {live && <Badge variant={live.variant}>{live.text}</Badge>}
      {fig.dataset_version && (
        <span className={`inline-block px-2 py-0.5 rounded-pill border text-label font-mono ${
          stale ? 'border-warning text-warning' : 'border-border text-ink-muted'}`}>
          {stale ? `computed on ${fig.dataset_version}` : fig.dataset_version}
        </span>
      )}
    </>
  )

  const actions = (
    <>
      {isLive && (
        <Button variant='ghost' leadingIcon={CodeBracketIcon} onClick={() => setCodeOpen(true)}>
          View code
        </Button>
      )}
      {isLive && canModify && (
        <Button variant='ghost' leadingIcon={ArrowPathIcon} disabled={refresh.isPending}
          onClick={() => refresh.mutate(fig.slug)}>
          {refresh.isPending ? 'Running…' : 'Refresh'}
        </Button>
      )}
      {canModify && (
        <>
          <Button variant='ghost' leadingIcon={PencilSquareIcon}
            onClick={() => { if (editing) resetFields(); setEditing((v) => !v) }} />
          <Button variant='ghost' leadingIcon={TrashIcon} disabled={deleting}
            onClick={() => {
              const warning = isLive
                ? `Delete "${fig.title}"? Its script and run history go with it.`
                : `Delete "${fig.title}"? Republishing the slug brings it back.`
              if (window.confirm(warning)) onDelete()
            }} />
        </>
      )}
    </>
  )

  return (
    <AnalysisCard title={fig.title} source={source} badge={badge} actions={actions}
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
      {isLive && (
        <FigureScriptModal open={codeOpen} onClose={() => setCodeOpen(false)}
          slug={fig.slug} title={fig.title} cardCanModify={canModify} />
      )}
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
  const summary = useDataSummary()
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
            {doc._id}{summary.data?.dataset_version ? ` · dataset ${summary.data.dataset_version}` : ''} · source ASSIST
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
        ]} />
      {view === 'comparison' && compareFor && <ComparisonView compareFor={compareFor} />}
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
function CatalogBrowser({ items, useCourses, columns, searchFields, blurb, railTitle, pickText, listRoute, itemRoute, railSearch = true }) {
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
  return (
    <CatalogBrowser
      items={colleges.data || []}
      useCourses={useCcCourses}
      railTitle='Community colleges'
      pickText='Choose a college'
      blurb='Community-college catalog — only courses referenced by the ported agreements are in the research database.'
      listRoute='/community-colleges'
      itemRoute={(id) => `/courses/${id}`}
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
      blurb='UC-side catalog — the receiving courses the ported agreements articulate to.'
      listRoute='/schools'
      itemRoute={(id) => `/university-courses/${id}`}
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
