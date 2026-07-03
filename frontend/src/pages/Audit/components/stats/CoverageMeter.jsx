import { Stack } from '../../../../components/ui'
import { compactNum, int } from './statsFormat'

function Row({ k, v }) {
  return (
    <div className='flex items-baseline justify-between gap-3 text-caption'>
      <span className='text-ink-muted'>{k}</span>
      <span className='text-body-strong font-mono'>{v}</span>
    </div>
  )
}

/**
 * Template coverage — the leverage story. Auditing one doc clears its whole
 * byte-identical template (up to ~116 CC agreements), so coverage is exposure
 * cleared, NOT a tighter confidence bound. The direct random-sample coverage is
 * shown separately and much smaller so the two never blur together.
 */
export default function CoverageMeter({ stats, fill = false }) {
  const tplAud = stats.n_templates_audited ?? 0
  const tplTot = stats.n_templates ?? 0
  const tplPct = tplTot ? +((tplAud / tplTot) * 100).toFixed(1) : 0
  const docCount = stats.n_propagated_all_audited ?? 0
  const docCov = stats.raw_template_coverage_pct ?? 0
  const effCov = stats.effective_template_coverage_pct ?? 0
  const total = stats.total_docs ?? 0
  const directN = stats.n_audited_direct ?? 0
  const directPct = total ? +((directN / total) * 100).toFixed(2) : 0

  return (
    <div className={`surface-card p-5 ${fill ? 'h-full' : ''}`}>
      <Stack gap='comfortable' className={fill ? 'h-full justify-between' : ''}>
        <p className='text-label'>Template coverage</p>

        <div className='flex items-baseline gap-2 flex-wrap'>
          <span className='text-stat font-mono text-success'>{tplPct}%</span>
          <span className='text-caption'>
            of templates audited — <span className='text-ink font-mono'>{int(tplAud)} / {compactNum(tplTot)}</span>
          </span>
        </div>
        <div className='h-2.5 rounded-md bg-surface-muted border border-border overflow-hidden'>
          <div className='h-full bg-success/60' style={{ width: `${Math.min(100, tplPct)}%` }} />
        </div>

        <Stack gap='tight'>
          <Row k='Docs covered' v={`${compactNum(docCount)} / ${compactNum(total)} · ${docCov}%`} />
          <Row k='Effective' v={`${effCov}%`} />
          {stats.propagation_multiplier != null && (
            <Row k='Propagation' v={`${stats.propagation_multiplier}×`} />
          )}
        </Stack>

        <div className='hairline-t pt-3'>
          <Row k='Random coverage' v={`${int(directN)} / ${compactNum(total)} · ${directPct}%`} />
          <div className='h-1.5 rounded-pill bg-surface-muted border border-border overflow-hidden mt-1.5'>
            <div className='h-full bg-ink-subtle' style={{ width: `${Math.min(100, Math.max(directPct, 0.4))}%` }} />
          </div>
        </div>
      </Stack>
    </div>
  )
}
