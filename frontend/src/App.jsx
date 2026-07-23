import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { signOut } from 'firebase/auth'
import { FlagIcon, CheckBadgeIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { Button, Spinner, Alert, EmptyState, StatStrip, Stack, LoadingLogo, PageContainer, Tabs, Logo } from './components/ui'
import { auth } from '@frontend/lib/firebase'
import { useAuth } from '@frontend/hooks/useAuth'
import { useAccessMe, useRequestAccess } from '@frontend/query/hooks/useAccess'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import SubNav from './components/SubNav'
import ReviewTab from './DesktopReview'
import AdminPage from './AdminPage'
import DataPage from './DataPage'
import ShowcasePage from './showcase/ShowcasePage'
import { SHOWCASE_ENABLED } from './showcase/showcaseVisibility'
import VisualsPage from './visuals/VisualsPage'
import ApiPage from './DataApiDocs'
import TasksPage from './tasks/TasksPage'
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
import { readUrlParam, writeUrlParam } from './shared/urlState'

/**
 * Transfer Pathways Research Console — web port of the internal desktop audit tool.
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
    <div className='h-screen bg-canvas text-ink flex items-center justify-center'>
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
    <div className='h-screen bg-canvas text-ink flex items-center justify-center px-6'>
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

function AccessCheckFailedScreen({ error, onRetry }) {
  const status = error?.response?.status
  const detail = status
    ? `The access check returned HTTP ${status}.`
    : 'The access check could not reach the API.'

  return (
    <div className='h-screen bg-canvas text-ink flex items-center justify-center px-6'>
      <div className='w-full max-w-md'>
        <Stack gap='comfortable'>
          <EmptyState icon={LockClosedIcon} title='Could not check access'
            description='Your account was not marked unapproved. The console could not verify access with the server.' />
          <Alert type='error'>{detail}</Alert>
          <div className='flex items-center justify-center gap-2'>
            <Button variant='primary' onClick={onRetry}>Try again</Button>
            <Button variant='secondary' onClick={() => signOut(auth)}>Sign out</Button>
          </div>
        </Stack>
      </div>
    </div>
  )
}

/**
 * Access gate. The console renders ONLY on a positive allow from /access/me —
 * so a signed-in-but-unapproved account never sees console chrome or data, not
 * even briefly. While the check is in flight: a neutral "checking" screen.
 * On actual denial (403 — not granted, or deny-listed): the request/declined
 * screen, which re-polls so an admin's grant unlocks it live. Other failures
 * stay retryable; a down API or transient auth error must not masquerade as a
 * revoked account.
 */
function Shell() {
  const { user } = useAuth()
  const me = useAccessMe()

  if (me.isPending) {
    return <Centered><Spinner /> <span className='text-caption'>Checking access…</span></Centered>
  }
  if (me.isError) {
    const status = me.error?.response?.status
    if (status === 403) return <AccessRequestedScreen email={user.email} />
    return <AccessCheckFailedScreen error={me.error} onRetry={() => me.refetch()} />
  }
  return <Console role={me.data?.role ?? 'partner'} user={user} />
}

// The authenticated, approved console. Reached only through the gate above, so
// access is guaranteed here — every view can fetch without a per-view guard.
function availableConsoleViews(role) {
  return new Set([
    'data',
    ...(SHOWCASE_ENABLED ? ['showcase'] : []),
    'visuals',
    'audit',
    'tasks',
    'api',
    ...(role === 'admin' ? ['admin'] : []),
  ])
}

function safeConsoleView(candidate, role) {
  return availableConsoleViews(role).has(candidate) ? candidate : 'data'
}

function Console({ role, user }) {
  const [view, setViewState] = useState(() => safeConsoleView(readUrlParam('view'), role))
  const [auditTab, setAuditTab] = useState('judge') // judge | review | stats
  const [filter, setFilter] = useState(DEFAULT_FILTER)

  const setView = useCallback((candidate) => {
    const nextView = safeConsoleView(candidate, role)
    setViewState(nextView)
    // Data is the landing view, so keep its URL canonical and compact.
    writeUrlParam('view', nextView === 'data' ? null : nextView)
  }, [role])

  useEffect(() => {
    const syncViewFromUrl = () => {
      const requestedView = readUrlParam('view')
      const nextView = safeConsoleView(requestedView, role)
      setViewState(nextView)

      // Remove explicit `data`, invalid values, and views the current role
      // cannot access. replaceState preserves Back/Forward semantics.
      const canonicalParam = nextView === 'data' ? null : nextView
      if (requestedView !== canonicalParam) {
        writeUrlParam('view', canonicalParam, { replace: true })
      }
    }

    syncViewFromUrl()
    window.addEventListener('popstate', syncViewFromUrl)
    return () => window.removeEventListener('popstate', syncViewFromUrl)
  }, [role])

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
      <div className='h-screen flex flex-col bg-canvas text-ink min-w-[1180px]'>
        <TopBar view={view} setView={setView} role={role} user={user} />
        <div className='flex-1 min-h-0 relative'>
          {view === 'audit' && (
            <AuditWorkspace
              auditTab={auditTab} setAuditTab={setAuditTab}
              filter={filter} setFilter={setFilter}
              statsSeen={statsSeen} reviewSeen={reviewSeen} />
          )}
          {view === 'data' && <DataPage onNavigate={setView} />}
          {SHOWCASE_ENABLED && view === 'showcase' && (
            <div className='h-full overflow-auto'><ShowcasePage /></div>
          )}
          {view === 'visuals' && (
            <div className='h-full overflow-auto'>
              <PageContainer><VisualsPage onNavigate={setView} /></PageContainer>
            </div>
          )}
          {view === 'tasks' && (
            <div className='h-full overflow-auto'>
              <PageContainer><TasksPage /></PageContainer>
            </div>
          )}
          {view === 'api' && <ApiPage />}
          {view === 'admin' && role === 'admin' && <div className='h-full overflow-auto'><AdminPage /></div>}
        </div>
      </div>
  )
}

// Forest top bar — theme-independent brand chrome (v2:30-53). Hardcodes the
// forest/lime/mint values (rather than riding --color-primary/--color-accent)
// because this bar must look identical in light and dark theme; every other
// surface in the console uses the token system. The nav is a bespoke
// translucent pill track (NOT the Tabs primitive) so it can carry those
// fixed colors without fighting Tabs' token-based active/inactive styling.
function TopBar({ view, setView, role, user }) {
  const tabs = [
    { value: 'data', label: 'Data' },
    ...(SHOWCASE_ENABLED ? [{ value: 'showcase', label: 'Showcase' }] : []),
    { value: 'visuals', label: 'Visuals' },
    { value: 'audit', label: 'Audit' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'api', label: 'API' },
    ...(role === 'admin' ? [{ value: 'admin', label: 'Admin' }] : []),
  ]
  // Gutter matches PageContainer's content edge: the panel inset (p-3/md:p-4)
  // plus the panel's own gutter (px-6/md:px-12) = 36px / 64px.
  return (
    <div className='shrink-0 flex items-center gap-5 h-[62px] px-9 md:px-16' style={{ background: '#193018' }}>
      <button type='button' onClick={() => setView('data')}
        className='flex items-center gap-[11px] bg-transparent border-0 p-0 cursor-pointer'>
        <span style={{ color: '#96F060' }}><Logo size={21} /></span>
        <span style={{ color: '#F0FFE7' }} className='flex flex-col text-[12px] leading-[1.06] tracking-[.01em]'>
          <span className='font-normal'>transfer</span>
          <span className='font-bold'>pathways</span>
        </span>
      </button>

      <div className='w-px h-[22px] bg-[rgba(240,255,231,.22)]' />

      <div className='uppercase text-[10.5px] font-[650] tracking-[.12em] text-[rgba(240,255,231,.62)]'>
        Research console
      </div>

      <nav className='ml-auto flex items-center gap-0.5 rounded-pill p-[3px]' style={{ background: 'rgba(240,255,231,.09)' }} role='tablist'>
        {tabs.map((t) => {
          const active = t.value === view
          return (
            <button key={t.value} type='button' onClick={() => setView(t.value)}
              className='px-[15px] py-[7px] rounded-pill text-[13px] tracking-[.005em]' role='tab' aria-selected={active}
              style={active
                ? { background: '#96F060', color: '#193018', fontWeight: 650 }
                : { color: 'rgba(240,255,231,.78)', fontWeight: 500 }}>
              {t.label}
            </button>
          )
        })}
      </nav>

      <div className='flex items-center gap-3'>
        <span className='text-[12.5px] whitespace-nowrap text-[rgba(240,255,231,.6)]'>{user.email}</span>
        <button type='button' onClick={() => signOut(auth)}
          className='border border-[rgba(240,255,231,.3)] text-[#F0FFE7] text-[12.5px] font-[550] rounded-pill px-3.5 py-1.5 hover:bg-[rgba(240,255,231,.12)] whitespace-nowrap'>
          Sign out
        </button>
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
  // Judge's random-template/random-doc mode is lifted up here (rather than
  // living inside JudgeTab) purely so AuditWorkspace can read it to compute
  // the Judge route hint below — JudgeTab's own behavior is unchanged.
  // Defaults to random-doc: every template cluster has been audited
  // (2026-07-14), so fresh sessions go straight to corpus sampling.
  const [judgeMode, setJudgeMode] = useState('random')
  const auditRoute =
    auditTab === 'judge' ? { path: '/api/audit/next' }
    : auditTab === 'review' ? { path: '/api/audit/errors' }
    : { path: '/api/audit/bootstrap' }

  return (
    <div className='h-full flex flex-col'>
      <SubNav tabs={{
        value: auditTab, onChange: setAuditTab,
        options: [
          { value: 'judge', label: 'Judge' },
          { value: 'review', label: 'Review' },
          { value: 'stats', label: 'Stats' },
        ],
      }} route={auditRoute} />
      <div className='flex-1 min-h-0 relative'>
        <div className={`h-full ${auditTab === 'judge' ? '' : 'hidden'}`}>
          <JudgeTab filter={filter} setFilter={setFilter} mode={judgeMode} setMode={setJudgeMode} active={auditTab === 'judge'} />
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
        <PageContainer>
          <Stack gap='section'>
            <div className='flex justify-center pt-8'>
              <EmptyState icon={CheckBadgeIcon} title='No verdicts yet'
                description='Audit a uniform-random batch to establish the first 95% strict-mismatch ceiling — coverage and per-campus verification populate as verdicts are logged.' />
            </div>
          </Stack>
        </PageContainer>
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto'>
      <PageContainer>
        <Stack gap='section'>
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
      </PageContainer>
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
  const Em = ({ children }) => <span className='text-ink font-semibold'>{children}</span>
  return (
    <div className='surface-card px-[22px] py-4 border-l-[3px] border-l-accent'>
      <p className='text-body text-ink-muted leading-[1.55]'>
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
    <p className='text-caption ink-subtle'>
      Dataset · {int(stats.total_docs)} docs · {int(stats.n_templates)} templates · {int(stats.n_majors)} majors
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
    { label: 'Errors', value: int(s.n_errors ?? 0), sub: `of ${int(nAudited)} audited`, tone: 'danger' },
    { label: 'Flagged', value: int(s.n_flagged ?? 0) }
  ]
}

const pct = (v) => (v == null ? null : `${v}%`)

// Cells card — coverage-bar visual plus the cell-level figures.
function CellsCard({ stats: s }) {
  const cov = s.cell_coverage_pct ?? 0
  const rows = [
    { k: 'Total cells', v: s.n_cells_total != null ? compactNum(s.n_cells_total) : null },
    // The only row guaranteed digit-only (a raw int() count, never % / · ≤) —
    // the rest carry a unit or punctuation, so they stay proportional.
    { k: 'In error', v: s.n_cells_in_error != null ? int(s.n_cells_in_error) : null, tabular: true },
    { k: 'Observed error', v: pct(s.cell_observed_pct) },
    { k: 'Per-cell ceiling (95%)', v: pct(s.ci_upper_cell_pct) },
    { k: 'Max cell errors', v: s.estimated_max_cell_errors != null ? `≤ ${int(s.estimated_max_cell_errors)}` : null }
  ].filter((r) => r.v != null)
  return (
    <div className='surface-card p-5 h-full flex flex-col'>
      <p className='text-label mb-3'>Cells</p>
      <div className='flex items-baseline gap-2 flex-wrap'>
        <span className='text-stat text-success'>{cov}%</span>
        <span className='text-caption'>audited — <span className='text-ink'>{compactNum(s.n_cells_audited)} / {compactNum(s.n_cells_total)}</span></span>
      </div>
      <div className='h-2 rounded-pill bg-surface-sunken overflow-hidden mt-3'>
        <div className='h-full rounded-pill bg-success' style={{ width: `${Math.min(100, cov)}%` }} />
      </div>
      <div className='flex-1 flex flex-col justify-between mt-3'>
        {rows.map((r) => (
          <div key={r.k} className='flex items-baseline justify-between gap-3 py-1.5 border-b border-border last:border-0'>
            <span className='text-caption text-ink-muted'>{r.k}</span>
            <span className={`text-body-strong text-ink ${r.tabular ? 'tabular' : ''}`}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const VERDICT_TONES = {
  correct: {
    button: 'border-primary bg-primary text-on-primary hover:bg-primary-hover hover:border-primary-hover',
    shortcut: 'bg-on-primary/20 text-on-primary group-hover/verdict:bg-on-primary/30',
  },
  conservative: {
    button: 'border-conservative-fill bg-conservative-fill text-on-accent hover:bg-conservative-hover hover:border-conservative',
    shortcut: 'bg-on-accent/10 text-on-accent group-hover/verdict:bg-on-accent/20',
  },
  error: {
    button: 'border-danger bg-danger text-white hover:bg-danger-hover hover:border-danger-hover',
    shortcut: 'bg-white/25 text-white group-hover/verdict:bg-white/35',
  },
  flagged: {
    button: 'border-border-strong bg-surface text-ink hover:bg-primary-soft hover:border-primary hover:text-primary',
    shortcut: 'bg-surface-sunken text-ink-muted group-hover/verdict:bg-primary group-hover/verdict:text-on-primary',
  },
}

function VerdictButton({ verdict, shortcut, icon: Icon = null, children, className = '', ...props }) {
  const tone = VERDICT_TONES[verdict] || VERDICT_TONES.flagged
  return (
    <button
      type='button'
      data-verdict={verdict}
      aria-keyshortcuts={shortcut.toLowerCase()}
      className={`group/verdict inline-flex h-10 items-center justify-center gap-2 rounded-pill border px-4 text-[13.5px] font-[650] whitespace-nowrap cursor-pointer transition-[background-color,border-color,color,filter,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:active:translate-y-0 ${tone.button} ${className}`}
      {...props}
    >
      {Icon && <Icon className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />}
      {children}
      <span
        aria-hidden='true'
        className={`inline-grid h-5 min-w-5 place-items-center rounded-md px-1 text-[10px] font-bold transition-colors duration-150 ${tone.shortcut}`}
      >
        {shortcut}
      </span>
    </button>
  )
}

// The Judge cockpit. Same sampling mechanics as the desktop tool; ASSIST opens
// in a managed popup (DocHead's button) instead of a docked native webview.
export function JudgeTab({ filter = DEFAULT_FILTER, setFilter, mode = 'random', setMode = () => {}, active = true }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const verify = useVerifyDoc()

  const [notes, setNotes] = useState('')
  // Cells the auditor has clicked to mark in error — a Set of ledger row keys.
  // Its size is the `cells_in_error` the verdict reports (replaces the old
  // manual number field).
  const [errRows, setErrRows] = useState(() => new Set())
  const markRow = useCallback((k) => setErrRows((prev) => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    return next
  }), [])
  const [skipIds, setSkipIds] = useState([])
  const [rerolling, setRerolling] = useState(false)
  // The verdict currently being submitted — the pill that owns the pending
  // selection ring. Set at submit start, cleared when the mutation settles.
  const [pendingVerdict, setPendingVerdict] = useState(null)
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
  // Count only templates that actually cover docs so this shares sessionTotal's
  // population below — otherwise sessionDone (= total − left) can go negative.
  const templatesLeft = (variants.data || []).filter((t) => (t.n_docs || 0) > 0 && !t.result).length

  // Session strip (template mode only): audited-of-total, driving the progress
  // fill. Total counts only templates that actually cover docs; guard the divide.
  const sessionTotal = (variants.data || []).filter((t) => (t.n_docs || 0) > 0).length
  const sessionLeft = templatesLeft
  const sessionDone = sessionTotal - sessionLeft
  const sessionPct = sessionTotal > 0 ? (sessionDone / sessionTotal) * 100 : 0

  // Follow the active doc in the ASSIST popup if the auditor has one open.
  useEffect(() => { if (assistUrl) openAssist(assistUrl, { onlyIfOpen: true }) }, [assistUrl])

  // Reset the simulated plan + error marks when the doc changes.
  useEffect(() => { setTaken([]); setErrRows(new Set()) }, [docId])

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
    setPendingVerdict(result)
    try {
      await verify.mutateAsync({
        doc_id: docId,
        result,
        notes: notes.trim(),
        source: isTemplate ? 'random_template_weighted' : 'verify',
        system,
        cells_in_error: errRows.size,
        scope: { groupingId: filter.groupingId, schoolIds: filter.schoolIds, majorContains: filter.majorContains }
      })
      setNotes('')
      setErrRows(new Set())
      if (isTemplate) { auditedKeys.current.add(tplKey); pickRandomTemplate() }
      else setSkipIds([])
    } finally {
      setPendingVerdict(null)
    }
  }

  const submitDisabled = verify.isPending || !doc
  const nextDisabled = rerolling || verify.isPending

  // Keyboard shortcuts: c/v/e verdicts, f flag, n next. A ref carries the latest
  // handlers + guards so the one stable document listener never fires against a
  // stale doc id / notes value, never double-submits while a verdict is already
  // in flight (mirrors the dock's disabled state), and never fires at all while
  // this sub-tab is hidden. Ignored while typing in a field or with a modifier held.
  const kbRef = useRef({})
  kbRef.current = { submit, onNext, active, submitDisabled, nextDisabled }
  useEffect(() => {
    const handler = (e) => {
      if (!kbRef.current.active) return
      const t = e.target && e.target.tagName
      if (t === 'INPUT' || t === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'n') { if (!kbRef.current.nextDisabled) kbRef.current.onNext(); return }
      if (kbRef.current.submitDisabled) return
      if (k === 'c') kbRef.current.submit('correct')
      else if (k === 'v') kbRef.current.submit('conservative')
      else if (k === 'e') kbRef.current.submit('error')
      else if (k === 'f') kbRef.current.submit('flagged')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Pending selection ring — the verdict mid-flight gets a lime ring (mockup v2).
  const ringStyle = (result) =>
    verify.isPending && pendingVerdict === result
      ? { boxShadow: '0 0 0 2px var(--color-surface), 0 0 0 4.5px var(--color-primary-ring)' }
      : undefined

  return (
    <div className='h-full overflow-auto'>
      <PageContainer className='flex flex-col gap-4'>
        {/* Header: mode tabs + (template mode) the session progress strip. */}
        <div className='flex items-center gap-3.5'>
          <Tabs value={mode} onChange={setMode}
            options={[{ value: 'template', label: 'Random template' }, { value: 'random', label: 'Random doc' }]} />
          {isTemplate && (
            <div className='ml-auto flex items-center gap-2.5'>
              <span className='text-caption ink-subtle whitespace-nowrap'>
                Doc {sessionDone} of {sessionTotal} · {sessionLeft} left
              </span>
              <div className='w-[150px] h-1.5 rounded-pill bg-surface-sunken overflow-hidden'>
                <div className='h-full rounded-pill bg-accent' style={{ width: `${sessionPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {erroredDoc
          ? <Alert type='error'>Failed to load.</Alert>
          : done
            ? <EmptyState icon={CheckBadgeIcon} title={isTemplate ? 'All templates audited' : 'All docs audited'} description='Nothing left in the current scope.' />
            : (loadingDoc || !doc)
              ? <div className='flex items-center justify-center py-8'><LoadingLogo size={48} /></div>
              : (
                <>
                  <DocHead doc={doc} assistUrl={assistUrl} />
                  {/* No heading here — the ledger's own group header already
                      titles the requirements; a second "Required" read as
                      clutter. Just the interaction hint (and the live
                      simulate counter, which is functional). */}
                  <div className='text-caption ink-subtle'>
                    Click a row to mark it in error · tick a box on the right to simulate a student plan.
                    {taken.length > 0 && (
                      <>
                        {' · '}Simulating {taken.length} CC course{taken.length === 1 ? '' : 's'}{' '}
                        <button type='button' onClick={() => setTaken([])} className='text-primary hover:underline'>Clear</button>
                      </>
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
                      markedRows={errRows}
                      onMarkRow={markRow}
                      preserveOrder
                    />
                  </div>
                </>
              )}
      </PageContainer>

      {/* Sticky verdict dock — one click submits the verdict (payload/scope
          unchanged); kbd chips mirror the c/v/e/f/n shortcuts. */}
      <div className='fixed left-1/2 bottom-5 -translate-x-1/2 z-40 flex items-center gap-2 bg-surface border border-border-strong rounded-pill px-3 py-2.5'
        style={{ boxShadow: 'var(--shadow-md)', maxWidth: 'min(1120px, calc(100vw - 48px))' }}>
        <VerdictButton verdict='correct' shortcut='C' onClick={() => submit('correct')}
          disabled={submitDisabled} style={ringStyle('correct')}>
          Correct
        </VerdictButton>
        <VerdictButton verdict='conservative' shortcut='V' onClick={() => submit('conservative')}
          disabled={submitDisabled} style={ringStyle('conservative')}
          title='pmt asks for MORE than ASSIST — an over-ask, never an under-ask.'>
          Conservative
        </VerdictButton>
        <VerdictButton verdict='error' shortcut='E' onClick={() => submit('error')}
          disabled={submitDisabled} style={ringStyle('error')}>
          Error
        </VerdictButton>
        <VerdictButton verdict='flagged' shortcut='F' icon={FlagIcon} onClick={() => submit('flagged')}
          disabled={submitDisabled} style={ringStyle('flagged')}
          title='Visually wrong / worth reviewing later. Notes required.'>
          Flag
        </VerdictButton>
        <div className='w-px h-[26px] bg-border shrink-0' />
        <span className={`flex items-center gap-1.5 text-[13px] font-semibold rounded-pill px-3.5 py-2 whitespace-nowrap ${errRows.size > 0 ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-ink-muted'}`}>
          {errRows.size} cells in error
        </span>
        <input data-flag-notes value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder='Notes (required when flagging)…'
          className='flex-1 min-w-[150px] bg-transparent outline-none border-none text-caption ink-default px-1 placeholder:text-ink-subtle' />
        <button type='button' onClick={onNext} disabled={nextDisabled}
          className='flex items-center gap-2 rounded-pill px-3.5 py-[9px] text-[13.5px] font-[550] text-ink hover:bg-primary-soft whitespace-nowrap cursor-pointer disabled:opacity-50'>
          {rerolling ? 'Next…' : 'Next'}<span className='text-[10px] font-bold rounded-[5px] px-1.5 py-0.5 bg-surface-sunken text-ink-muted'>N</span>
          <svg width='13' height='13' viewBox='0 0 14 14' fill='none' stroke='currentColor' strokeWidth='1.7'><path d='M2 7 L11.5 7 M7.5 3 L11.5 7 L7.5 11' /></svg>
        </button>
      </div>
    </div>
  )
}
