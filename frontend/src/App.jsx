import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { signOut } from 'firebase/auth'
import { FlagIcon, ArrowsRightLeftIcon, CheckBadgeIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { Button, Spinner, Alert, EmptyState, StatStrip, Stack, LoadingLogo, Tabs, Input, Textarea } from './components/ui'
import { auth } from '@frontend/lib/firebase'
import { useAuth } from '@frontend/hooks/useAuth'
import { useAccessMe, useRequestAccess } from '@frontend/query/hooks/useAccess'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import ReviewTab from './DesktopReview'
import AdminPage from './AdminPage'
import DataPage from './DataPage'
import ApiPage from './DataApiDocs'
import DatasetSummaryPanel from './components/DatasetSummaryPanel'
import SignInScreen from './SignInScreen'
import DocHead from './pages/Audit/components/DocHead'
// Stats components reused individually for a spacious full-width dashboard.
import MismatchGauge from './pages/Audit/components/stats/MismatchGauge'
import VerdictBar from './pages/Audit/components/stats/VerdictBar'
import CoverageMeter from './pages/Audit/components/stats/CoverageMeter'
import CampusCoverage from './pages/Audit/components/stats/CampusCoverage'
import { int, compactNum } from './pages/Audit/components/stats/statsFormat'
import { useCourseList } from './pages/Audit/hooks/useCourseList'
import { DEFAULT_FILTER, openAssist } from './pages/Audit/lib/auditFormat'
import {
  useAuditNext, useVerifyDoc, useAuditTemplateVariants, useAuditDoc, useAuditBootstrap, filterToParams
} from '@frontend/query/hooks/useAudit'
import { qk } from '@frontend/query/keys'
import apiClient from '@frontend/api/apiClient'

/**
 * PMT Research Console — web port of the internal desktop audit tool.
 *
 * Differences from the desktop shell it was ported from:
 *   - Interactive Google sign-in (no silent local-server token mint).
 *   - Role comes from GET /access/me (admin | partner) instead of a client
 *     allowlist mirror; the server enforces everything.
 *   - ASSIST.org opens in a managed popup window (openAssist) — there is no
 *     native split webview in a browser, and ASSIST blocks iframes.
 *   - Views: Data (landing — overview, browse, analyses), Audit (Judge ·
 *     Review · Stats), API for everyone; Admin (dataset + partner access +
 *     sign-in requests) for admins.
 */
export default function App() {
  const { user, loading } = useAuth()
  if (loading) {
    return <Centered><Spinner /> <span className='text-caption'>Checking session…</span></Centered>
  }
  if (!user) return <SignInScreen />
  return <Shell />
}

function Centered({ children }) {
  return (
    <div className='h-screen bg-surface text-ink flex items-center justify-center'>
      <div className='flex items-center gap-3'>{children}</div>
    </div>
  )
}

/**
 * Signed in but not granted. Files a sign-in request so the account shows up
 * under Admin → Sign-in requests, then waits: useAccessMe polls while denied,
 * so an admin's grant flips this screen into the console live. If the account
 * has been rejected (deny-listed), /access/request answers { blocked: true }
 * and this shows a terminal "declined" state instead of the waiting spinner.
 */
function AccessRequestedScreen({ email }) {
  const requestAccess = useRequestAccess()
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return // StrictMode double-mount guard
    fired.current = true
    requestAccess.mutate()
  }, [requestAccess])

  const blocked = requestAccess.data?.blocked

  return (
    <div className='h-screen bg-surface text-ink flex items-center justify-center px-6'>
      <Stack gap='comfortable' className='items-center'>
        {blocked ? (
          <EmptyState icon={LockClosedIcon} title='Access declined'
            description={`${email || 'This account'} isn't approved for the research console. If you think this is a mistake, contact the project admin.`} />
        ) : (
          <>
            <EmptyState icon={LockClosedIcon} title='Access requested'
              description={`${email || 'This account'} isn't approved for the research console yet. Your sign-in has been recorded for the project admin — this page unlocks by itself once you're approved.`} />
            <span className='inline-flex items-center gap-2 text-caption text-ink-subtle'>
              <Spinner /> Waiting for approval — checking automatically
            </span>
          </>
        )}
        <Button variant='secondary' onClick={() => signOut(auth)}>Sign out</Button>
      </Stack>
    </div>
  )
}

/**
 * Access gate. The console renders ONLY on a positive allow from /access/me —
 * so a signed-in-but-unapproved account never sees console chrome or data, not
 * even briefly. While the check is in flight: a neutral "checking" screen.
 * On denial (403 — not granted, or deny-listed): the request/declined screen,
 * which re-polls so an admin's grant unlocks it live. The server enforces the
 * same gate on every route; this is the UI half of it.
 */
function Shell() {
  const { user } = useAuth()
  const me = useAccessMe()

  if (me.isPending) {
    return <Centered><Spinner /> <span className='text-caption'>Checking access…</span></Centered>
  }
  if (me.isError) return <AccessRequestedScreen email={user.email} />
  return <Console role={me.data?.role ?? 'partner'} user={user} />
}

// The authenticated, approved console. Reached only through the gate above, so
// access is guaranteed here — every view can fetch without a per-view guard.
function Console({ role, user }) {
  const [view, setView] = useState('data')
  const [auditTab, setAuditTab] = useState('judge') // judge | review | stats
  const [filter, setFilter] = useState(DEFAULT_FILTER)

  // Eagerly run /audit/bootstrap so the first visit to Review and Stats is
  // warm — react-query dedupes with the Stats view's own call.
  useAuditBootstrap(filter)

  const [statsSeen, setStatsSeen] = useState(false)
  const [reviewSeen, setReviewSeen] = useState(false)
  useEffect(() => {
    if (view === 'audit' && auditTab === 'stats') setStatsSeen(true)
    if (view === 'audit' && auditTab === 'review') setReviewSeen(true)
  }, [view, auditTab])

  return (
      <div className='h-screen flex flex-col bg-surface text-ink'>
        <div className='shrink-0 flex items-center gap-3 px-4 h-12 border-b border-border'>
          <span className='text-label'>PMT Research</span>
          <div className='ml-auto flex items-center gap-3'>
            <Tabs value={view} onChange={setView}
              options={[
                { value: 'data',  label: 'Data' },
                { value: 'audit', label: 'Audit' },
                { value: 'api',   label: 'API' },
                ...(role === 'admin' ? [{ value: 'admin', label: 'Admin' }] : []),
              ]} />
            <span className='text-caption text-ink-subtle hidden sm:block'>{user.email}</span>
            <Button variant='ghost' onClick={() => signOut(auth)}>Sign out</Button>
          </div>
        </div>
        <div className='flex-1 min-h-0 relative'>
          {view === 'audit' && (
            <AuditWorkspace
              auditTab={auditTab} setAuditTab={setAuditTab}
              filter={filter} setFilter={setFilter}
              statsSeen={statsSeen} reviewSeen={reviewSeen} />
          )}
          {view === 'data' && <DataPage onNavigate={setView} />}
          {view === 'api' && <ApiPage />}
          {view === 'admin' && role === 'admin' && <div className='h-full overflow-auto'><AdminPage /></div>}
        </div>
      </div>
  )
}

/**
 * AuditWorkspace — Judge (cockpit) · Review (queue re-judge) · Stats (full
 * dashboard) under one sub-tab bar. Sub-views stay mounted (hidden) so warm
 * state survives a sub-tab switch.
 */
function AuditWorkspace({ auditTab, setAuditTab, filter, setFilter, statsSeen, reviewSeen }) {
  return (
    <div className='h-full flex flex-col'>
      <div className='shrink-0 flex items-center px-4 h-11 border-b border-border'>
        <Tabs value={auditTab} onChange={setAuditTab}
          options={[
            { value: 'judge',  label: 'Judge' },
            { value: 'review', label: 'Review' },
            { value: 'stats',  label: 'Stats' },
          ]} />
      </div>
      <div className='flex-1 min-h-0 relative'>
        <div className={`h-full ${auditTab === 'judge' ? '' : 'hidden'}`}>
          <JudgeTab filter={filter} setFilter={setFilter} />
        </div>
        {reviewSeen && (
          <div className={`h-full ${auditTab === 'review' ? '' : 'hidden'}`}>
            <ReviewTab filter={filter} setFilter={setFilter} />
          </div>
        )}
        {statsSeen && (
          <div className={`h-full ${auditTab === 'stats' ? '' : 'hidden'}`}>
            <StatsTab filter={filter} setFilter={setFilter} />
          </div>
        )}
      </div>
    </div>
  )
}

// Full-window stats dashboard. Lazy — bootstrap + matrix fetch only when this
// view first mounts.
function StatsTab({ filter = DEFAULT_FILTER, setFilter }) {
  const bootstrap = useAuditBootstrap(filter)
  const stats = filter.groupingId ? bootstrap.data?.grouping?.stats : bootstrap.data?.all?.stats

  if (bootstrap.isLoading || !stats) {
    return <div className='h-full flex items-center justify-center'><LoadingLogo size={48} /></div>
  }
  if ((stats.n_audited ?? 0) === 0) {
    return (
      <div className='h-full overflow-auto'>
        <div className='mx-auto max-w-screen-2xl px-8 py-8'>
          <Stack gap='section'>
            <div className='flex justify-center pt-8'>
              <EmptyState icon={CheckBadgeIcon} title='No verdicts yet'
                description='Audit a uniform-random batch to establish the first 95% strict-mismatch ceiling — coverage and per-campus verification populate as verdicts are logged.' />
            </div>
          </Stack>
        </div>
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto'>
      <div className='mx-auto max-w-screen-2xl px-8 py-8'>
        <Stack gap='section'>
          {/* What's IN the dataset (scoped to this account) — audit progress
              below covers what's been verified of it. */}
          <DatasetSummaryPanel compact />
          <ScopeLine stats={stats} />
          <StatStrip tiles={buildStrip(stats)} />
          <InterpretationBanner stats={stats} />
          <MismatchGauge stats={stats} />
          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch'>
            <VerdictBar stats={stats} />
            <CoverageMeter stats={stats} fill />
            <CellsCard stats={stats} />
          </div>
          <CampusCoverage filter={filter} />
        </Stack>
      </div>
    </div>
  )
}

// Plain-English headline — what the gathered stats actually mean, in dataset-
// accuracy terms (this is a parser-accuracy audit, not a student-facing tool).
function InterpretationBanner({ stats: s }) {
  const n = s.n_random_clusters ?? 0
  const ceiling = s.ci_upper_strict_pct
  const estMax = s.estimated_max_strict
  const total = s.total_docs ?? 0
  const tplTot = s.n_templates ?? 0
  const tplPct = tplTot ? +(((s.n_templates_audited ?? 0) / tplTot) * 100).toFixed(1) : 0
  const mismatches = (s.n_errors ?? 0) + (s.n_conservative ?? 0) + (s.n_flagged ?? 0)
  const hasSample = ceiling != null && n > 0
  const Em = ({ children }) => <span className='text-body-strong font-mono text-ink'>{children}</span>
  return (
    <div className='surface-card p-5 border-l-2 border-primary'>
      <p className='text-body text-ink-muted leading-relaxed'>
        {hasSample ? (
          <>
            You’ve audited <Em>{int(s.n_audited ?? 0)}</Em> agreements
            {' '}(<Em>{int(s.n_audited_direct ?? 0)}</Em> as a uniform-random sample across <Em>{int(n)}</Em> templates),
            finding <Em>{int(mismatches)}</Em> strict mismatches
            {' '}(<Em>{int(s.n_errors ?? 0)}</Em> errors · <Em>{int(s.n_conservative ?? 0)}</Em> over-asks · <Em>{int(s.n_flagged ?? 0)}</Em> flagged).
            With 95% confidence, at most <Em>{ceiling.toFixed(1)}%</Em> of agreements
            {estMax != null ? <> (~<Em>{int(estMax)}</Em> of {int(total)} docs)</> : null} deviate from ASSIST.
            Template auditing has cleared <Em>{tplPct}%</Em> of all templates.
          </>
        ) : (
          <>No uniform-random sample in scope yet — audit a random batch to establish the first 95% strict-mismatch ceiling.</>
        )}
      </p>
    </div>
  )
}

// The population is whatever major subset the server grants this account
// (admins: everything ported; partners: the admin-selected majors).
function ScopeLine({ stats }) {
  return (
    <p className='text-caption'>
      Dataset ·{' '}
      <span className='text-ink-muted font-mono'>{int(stats.total_docs)}</span> docs ·{' '}
      <span className='text-ink-muted font-mono'>{int(stats.n_templates)}</span> templates ·{' '}
      <span className='text-ink-muted font-mono'>{int(stats.n_majors)}</span> majors
    </p>
  )
}

function buildStrip(s) {
  const tplAud = s.n_templates_audited ?? 0
  const tplTot = s.n_templates ?? 0
  const tplPct = tplTot ? +((tplAud / tplTot) * 100).toFixed(1) : 0
  const nAudited = s.n_audited ?? 0
  const nRandomDoc = s.n_audited_random_doc ?? s.n_audited_direct ?? 0
  const nRandomTemplate = s.n_audited_random_template ?? 0
  const nTargeted = s.n_audited_targeted ?? Math.max(nAudited - nRandomDoc - nRandomTemplate, 0)
  const sourceSub = `${int(nRandomDoc)} random doc · ${int(nRandomTemplate)} template${
    nTargeted ? ` · ${int(nTargeted)} targeted` : ''
  }`
  return [
    { label: 'Audited', value: int(nAudited), sub: sourceSub, accent: true },
    { label: 'Templates audited', value: int(tplAud), sub: `of ${compactNum(tplTot)} · ${tplPct}%` },
    { label: 'Errors', value: int(s.n_errors ?? 0), sub: `of ${int(nAudited)} audited` },
    { label: 'Flagged', value: int(s.n_flagged ?? 0) }
  ]
}

const pct = (v) => (v == null ? null : `${v}%`)

// Cells card — coverage-bar visual plus the cell-level figures.
function CellsCard({ stats: s }) {
  const cov = s.cell_coverage_pct ?? 0
  const rows = [
    { k: 'Total cells', v: s.n_cells_total != null ? compactNum(s.n_cells_total) : null },
    { k: 'In error', v: s.n_cells_in_error != null ? int(s.n_cells_in_error) : null },
    { k: 'Observed error', v: pct(s.cell_observed_pct) },
    { k: 'Per-cell ceiling (95%)', v: pct(s.ci_upper_cell_pct) },
    { k: 'Max cell errors', v: s.estimated_max_cell_errors != null ? `≤ ${int(s.estimated_max_cell_errors)}` : null }
  ].filter((r) => r.v != null)
  return (
    <div className='surface-card p-5 h-full flex flex-col'>
      <p className='text-label mb-3'>Cells</p>
      <div className='flex items-baseline gap-2 flex-wrap'>
        <span className='text-stat font-mono text-success'>{cov}%</span>
        <span className='text-caption'>audited — <span className='text-ink font-mono'>{compactNum(s.n_cells_audited)} / {compactNum(s.n_cells_total)}</span></span>
      </div>
      <div className='h-2.5 rounded-md bg-surface-muted border border-border overflow-hidden mt-3'>
        <div className='h-full bg-success/60' style={{ width: `${Math.min(100, cov)}%` }} />
      </div>
      <div className='flex-1 flex flex-col justify-between mt-3'>
        {rows.map((r) => (
          <div key={r.k} className='flex items-baseline justify-between gap-3 py-1.5 border-b border-border/60 last:border-0'>
            <span className='text-caption text-ink-muted'>{r.k}</span>
            <span className='text-body-strong font-mono tabular-nums text-ink'>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// The Judge cockpit. Same sampling mechanics as the desktop tool; ASSIST opens
// in a managed popup (DocHead's button) instead of a docked native webview.
export function JudgeTab({ filter = DEFAULT_FILTER, setFilter }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const verify = useVerifyDoc()

  const [mode, setMode] = useState('template') // 'template' | 'random'
  const [notes, setNotes] = useState('')
  const [cellsInError, setCellsInError] = useState(0)
  const [skipIds, setSkipIds] = useState([])
  const [rerolling, setRerolling] = useState(false)
  // Eligibility simulation: CC course_ids the auditor has checked off to mimic
  // a student plan. Feeds RequirementsLedger as `userCourses`.
  const [taken, setTaken] = useState([])
  const userCourses = useMemo(() => taken.map((id) => ({ course_id: id })), [taken])
  const onToggleCourse = useCallback(
    (id) => setTaken((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id])), [])

  // Random-doc mode.
  const next = useAuditNext(filter, { enabled: mode === 'random' })
  const randomCourses = useCourseList(next.data?.course_names)

  // Random-template mode. Pin the sample doc at pick time so a background
  // refetch can't swap the agreement out from under the auditor.
  const variants = useAuditTemplateVariants(filter, { enabled: mode === 'template' })
  const [tplKey, setTplKey] = useState(null)
  const [pinnedDoc, setPinnedDoc] = useState(null) // { docId, system } | null
  const auditedKeys = useRef(new Set())
  const keyOf = (t) => `${t.system}|${t.school_id}|${t.major}|${t.fp_hash}`
  const tplDoc = useAuditDoc(pinnedDoc?.docId, pinnedDoc?.system)
  const tplCourses = useCourseList(tplDoc.data?.course_names)

  // Weighted pick of an unaudited template (∝ cluster size) — uniform over
  // docs, so the verdict is a valid CI sample.
  const pickRandomTemplate = useCallback(() => {
    const pool = (variants.data || []).filter(
      (t) => !t.result && (t.n_docs || 0) > 0 && !auditedKeys.current.has(keyOf(t)))
    if (!pool.length) { setTplKey('__none__'); setPinnedDoc(null); return }
    const total = pool.reduce((s, t) => s + (t.n_docs || 0), 0)
    let r = Math.random() * total
    for (const t of pool) {
      r -= t.n_docs || 0
      if (r <= 0) { setTplKey(keyOf(t)); setPinnedDoc({ docId: t.sample_doc_id, system: t.system }); return }
    }
  }, [variants.data])

  useEffect(() => {
    if (mode === 'template' && !variants.isLoading && (variants.data || []).length && !tplKey) {
      pickRandomTemplate()
    }
  }, [mode, variants.isLoading, variants.data, tplKey, pickRandomTemplate])

  const isTemplate = mode === 'template'
  const doc = isTemplate ? tplDoc.data?.doc : next.data?.doc
  const courses = isTemplate ? tplCourses : randomCourses
  const universityCoursesById = (isTemplate ? tplDoc.data?.university_courses : next.data?.university_courses) || null
  const assistUrl = isTemplate ? tplDoc.data?.assist_url : next.data?.assist_url
  const system = isTemplate ? pinnedDoc?.system : next.data?.system
  const docId = isTemplate ? pinnedDoc?.docId : doc?._id
  const erroredDoc = isTemplate ? (variants.isError || tplDoc.isError) : next.isError
  const done = isTemplate ? tplKey === '__none__' : next.data?.done
  const loadingDoc = isTemplate ? (variants.isLoading || (pinnedDoc && tplDoc.isLoading)) : next.isLoading
  const templatesLeft = (variants.data || []).filter((t) => !t.result).length

  // Follow the active doc in the ASSIST popup if the auditor has one open.
  useEffect(() => { if (assistUrl) openAssist(assistUrl, { onlyIfOpen: true }) }, [assistUrl])

  // Reset the simulated plan when the doc changes.
  useEffect(() => { setTaken([]) }, [docId])

  const reroll = async () => {
    if (!doc?._id || rerolling) return
    const updated = [...new Set([...skipIds, doc._id])]
    setSkipIds(updated)
    setRerolling(true)
    try {
      const { data } = await apiClient.get('/audit/next', { params: { ...filterToParams(filter), skip: updated.join(',') } })
      qc.setQueryData(qk.auditNext(user?.uid, filter), data)
    } catch (e) {
      console.error('reroll failed:', e)
    } finally {
      setRerolling(false)
    }
  }

  const onNext = isTemplate ? pickRandomTemplate : reroll

  const submit = async (result) => {
    if (!docId) return
    if (result === 'flagged' && !notes.trim()) { document.querySelector('[data-flag-notes]')?.focus(); return }
    await verify.mutateAsync({
      doc_id: docId,
      result,
      notes: notes.trim(),
      source: isTemplate ? 'random_template_weighted' : 'verify',
      system,
      cells_in_error: Number(cellsInError) || 0,
      scope: { groupingId: filter.groupingId, schoolIds: filter.schoolIds, majorContains: filter.majorContains }
    })
    setNotes('')
    setCellsInError(0)
    if (isTemplate) { auditedKeys.current.add(tplKey); pickRandomTemplate() }
    else setSkipIds([])
  }

  return (
    <div className='h-full flex flex-col'>
      <header className='shrink-0 border-b border-border'>
        <div className='px-4 pt-3 flex items-center gap-3'>
          <Tabs value={mode} onChange={setMode}
            options={[{ value: 'template', label: 'Random template' }, { value: 'random', label: 'Random doc' }]} />
          {isTemplate && <span className='text-caption text-ink-subtle'>{templatesLeft} templates left</span>}
        </div>
        {doc && (
          <div className='px-4 pt-2'>
            <DocHead doc={doc} assistUrl={assistUrl} />
          </div>
        )}
        <div className='px-4 py-2.5 flex flex-wrap items-center gap-2'>
          <Button onClick={() => submit('correct')} disabled={verify.isPending || !doc}>Correct</Button>
          <Button variant='warning' onClick={() => submit('conservative')} disabled={verify.isPending || !doc}
            title='pmt asks for MORE than ASSIST — an over-ask, never an under-ask.'>Conservative</Button>
          <Button variant='danger' onClick={() => submit('error')} disabled={verify.isPending || !doc}>Error</Button>
          <Button variant='secondary' leadingIcon={FlagIcon} onClick={() => submit('flagged')} disabled={verify.isPending || !doc}
            title='Visually wrong / worth reviewing later. Notes required.'>Flag</Button>
          <Button variant='ghost' leadingIcon={ArrowsRightLeftIcon} onClick={onNext} disabled={rerolling || verify.isPending}>
            {rerolling ? 'Next…' : 'Next'}
          </Button>
          <label className='ml-auto flex items-center gap-1.5 text-caption text-ink-subtle'>
            Cells in error
            <Input type='number' min={0} step={1} value={cellsInError}
              onChange={(e) => setCellsInError(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
              className='w-14 font-mono tabular-nums text-right' />
          </label>
        </div>
        <div className='px-4 pb-2.5'>
          <Textarea data-flag-notes value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder='Notes (optional; required when flagging)…' rows={2} />
        </div>
      </header>
      <div className='flex-1 overflow-auto px-4 py-4'>
        {erroredDoc
          ? <Alert type='error'>Failed to load.</Alert>
          : done
            ? <EmptyState icon={CheckBadgeIcon} title={isTemplate ? 'All templates audited' : 'All docs audited'} description='Nothing left in the current scope.' />
            : (loadingDoc || !doc)
              ? <div className='flex items-center justify-center py-8'><LoadingLogo size={48} /></div>
              : (
                <>
                  <div className='flex items-center justify-between mb-3'>
                    <span className='text-caption text-ink-subtle'>
                      {taken.length
                        ? `Simulating ${taken.length} CC course${taken.length === 1 ? '' : 's'} taken`
                        : 'Tick CC courses to simulate a student plan'}
                    </span>
                    {taken.length > 0 && (
                      <button type='button' onClick={() => setTaken([])} className='text-caption text-primary hover:underline'>Clear</button>
                    )}
                  </div>
                  <div className='uui-scope'>
                  <RequirementsLedger
                    major={doc}
                    courses={courses}
                    universityCoursesById={universityCoursesById}
                    userCourses={userCourses}
                    interactive
                    onToggleCourse={onToggleCourse}
                    preserveOrder
                  />
                  </div>
                </>
              )}
      </div>
    </div>
  )
}
