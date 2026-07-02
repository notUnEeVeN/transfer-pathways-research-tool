import { EmptyState, Spinner, StatStrip, Stack } from '../../../../components/ui'
import { CheckBadgeIcon } from '@heroicons/react/24/outline'
import { usePersistedState } from '@frontend/hooks/usePersistedState'
import RiskGauge from './RiskGauge'
import VerdictBar from './VerdictBar'
import CoverageMeter from './CoverageMeter'
import CoverageMatrix from './CoverageMatrix'
import Lifecycle from './Lifecycle'
import MetricTable from './MetricTable'
import { bound, compactNum, int } from './statsFormat'

/**
 * The internal audit statistics surface. A control instrument that also reads
 * cleanly for outside auditors: a headline student-risk gauge (the random-sample
 * 95% Wilson bound — never coverage), a verdict-composition bar, template
 * coverage (exposure, kept distinct from confidence), a campus×area coverage
 * matrix, the risk trend + error burndown, the lifecycle ledger, and a dense
 * all-metrics table for the precise read-out. Every figure flows through tokens
 * so light/dark work for free.
 */
export default function StatsBlock({ stats, loading, filter }) {
  const [showAll, setShowAll] = usePersistedState('audit.stats.showAll', false)

  if (loading || !stats) {
    return (
      <div className='surface-card p-5'>
        <div className='flex items-center gap-3 text-caption'>
          <Spinner /> Loading stats…
        </div>
      </div>
    )
  }

  if ((stats.n_audited ?? 0) === 0) {
    return (
      <div className='surface-card'>
        <EmptyState
          icon={CheckBadgeIcon}
          title='No verdicts yet'
          description='Student risk is unknown until agreements are sampled. Audit a uniform-random batch in the Verify tab to establish the first 95% ceiling — coverage, the campus×major matrix, and the trend populate as verdicts are logged.'
        />
      </div>
    )
  }

  return (
    <Stack gap='section'>
      <ScopeLine stats={stats} filter={filter} />
      <StatStrip tiles={buildStrip(stats)} />
      <RiskGauge stats={stats} />
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <VerdictBar stats={stats} />
        <CoverageMeter stats={stats} />
      </div>
      <CoverageMatrix filter={filter} />
      <Lifecycle stats={stats} />
      <AllMetrics stats={stats} open={showAll} onToggle={() => setShowAll((v) => !v)} />
    </Stack>
  )
}

function ScopeLine({ stats, filter }) {
  const filtered = !!(filter?.groupingId || filter?.schoolIds?.length || filter?.majorContains)
  return (
    <p className='text-caption'>
      {filtered ? 'Filtered scope' : 'All UC agreements'} ·{' '}
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
  const nDirect = s.n_audited_direct ?? 0
  const nAudited = s.n_audited ?? 0
  const nTargeted = Math.max(nAudited - nDirect, 0)
  return [
    { label: 'Random sample', value: int(nDirect), accent: true },
    { label: 'Audited', value: int(nAudited), sub: `${int(nDirect)} random · ${int(nTargeted)} targeted` },
    { label: 'Templates audited', value: int(tplAud), sub: `of ${compactNum(tplTot)} · ${tplPct}%` },
    { label: 'Errors', value: int(s.n_errors ?? 0), sub: `of ${int(nAudited)} audited` },
  ]
}

function AllMetrics({ stats: s, open, onToggle }) {
  const directObs = s.n_random_clusters ? `${+((s.n_random_clusters_error / s.n_random_clusters) * 100).toFixed(1)}%` : '—'
  const tplPct = s.n_templates ? `${+((s.n_templates_audited / s.n_templates) * 100).toFixed(1)}%` : null
  const groups = [
    {
      title: 'Scope & sampling',
      rows: [
        { label: 'Total agreements', value: int(s.total_docs) },
        { label: 'Templates · majors', value: `${int(s.n_templates)} · ${int(s.n_majors)}` },
        { label: 'Audited — all sources', value: int(s.n_audited) },
        { label: 'Audited — uniform-random', value: int(s.n_audited_direct) },
      ],
    },
    {
      title: 'Verdicts',
      rows: [
        { label: 'Correct', value: int(s.n_correct) },
        { label: 'Conservative', value: int(s.n_conservative), tone: 'conservative' },
        { label: 'Flagged', value: int(s.n_flagged) },
        { label: 'Error', value: int(s.n_errors), tone: s.n_errors > 0 ? 'danger' : undefined },
      ],
    },
    {
      title: 'Student risk — random templates, scope-restricted',
      rows: [
        { label: 'Observed', value: directObs, sub: `${int(s.n_random_clusters_error)} / ${int(s.n_random_clusters)} templates` },
        { label: '95% Wilson ceiling (FPC)', value: bound(s.ci_upper_safety_pct), sub: s.estimated_max_unsafe != null ? `≤ ${int(s.estimated_max_unsafe)} docs` : null },
        { label: 'Strict mismatch', value: bound(s.ci_upper_strict_pct), sub: s.estimated_max_strict != null ? `≤ ${int(s.estimated_max_strict)} docs` : null },
        { label: 'All audited templates (incl. targeted)', value: bound(s.cluster_student_risk_upper_pct), sub: s.n_audited_clusters ? `${int(s.n_audited_clusters)} templates` : null },
      ],
    },
    {
      title: 'Coverage & cells',
      rows: [
        { label: 'Templates audited', value: s.n_templates ? `${int(s.n_templates_audited)} / ${compactNum(s.n_templates)}` : null, sub: tplPct },
        { label: 'Docs in audited templates', value: s.raw_template_coverage_pct != null ? `${compactNum(s.n_propagated_all_audited)} · ${s.raw_template_coverage_pct}%` : null },
        { label: 'Effective (cell haircut)', value: s.effective_template_coverage_pct != null ? `${s.effective_template_coverage_pct}%` : null },
        { label: 'Per-cell error ceiling', value: bound(s.ci_upper_cell_pct), sub: s.estimated_max_cell_errors != null ? `≤ ${int(s.estimated_max_cell_errors)}` : null },
      ],
    },
    {
      title: 'Lifecycle',
      rows: [{ label: 'Resolved · stale · flagged', value: `${int(s.n_resolved)} · ${int(s.n_stale)} · ${int(s.n_flagged)}` }],
    },
  ]
  return (
    <div className='surface-card p-5'>
      <Stack gap='cozy'>
        <button type='button' onClick={onToggle} className='text-body-strong text-ink-muted hover:text-ink self-start'>
          {open ? '▾' : '▸'} {open ? 'Hide all metrics' : 'Show all metrics'}
        </button>
        {open && <MetricTable groups={groups} />}
      </Stack>
    </div>
  )
}
