import { Stack } from '../../../../components/ui'
import { int } from './statsFormat'

/**
 * Hero strict-mismatch gauge — the page's headline number. The 95% Wilson
 * upper bound on the rate of ANY deviation from ASSIST (error, over-ask, or
 * flagged), computed over the uniform-random sample ONLY (never the
 * all-sources count, never coverage) and finite-population corrected.
 *
 * Neutral measurement framing on purpose: this is a research accuracy bound,
 * so it reports the ceiling, the observed rate marker, and the absolute
 * "≤ N of total docs" translation — no target line, no pass/fail colour.
 */
export default function MismatchGauge({ stats }) {
  // The bound's unit is the randomly-drawn TEMPLATE (one deterministic
  // observation), restricted to the active scope.
  const n = stats.n_random_clusters ?? 0
  const k = stats.n_random_clusters_strict ?? 0
  const ceiling = stats.ci_upper_strict_pct // null when n === 0
  const observed = n ? +((k / n) * 100).toFixed(2) : 0
  const estMax = stats.estimated_max_strict
  const total = stats.total_docs

  const hasSample = ceiling != null && n > 0

  // Keep the gauge on the true rate scale: 0% at the left, 100% at the right.
  // Dynamic scaling made small Wilson bounds look visually comparable to much
  // larger bounds, which defeats the purpose of the bar.
  const pos = (v) => `${Math.min(100, Math.max(0, v ?? 0))}%`
  const ticks = [0, 25, 50, 75, 100]

  return (
    <div className='surface-card p-5'>
      <Stack gap='comfortable'>
        <div className='flex items-baseline justify-between gap-3 flex-wrap'>
          <p className='text-label'>Strict mismatch · 95% Wilson upper bound</p>
          <span className='text-caption text-ink-subtle'>any deviation from ASSIST — error, over-ask, or flagged</span>
        </div>

        <div className='flex items-start justify-between gap-6 flex-wrap'>
          <div className='min-w-0'>
            <div className='text-stat-lg font-mono text-ink'>
              <span className='text-ink-subtle' style={{ fontSize: '0.6em' }}>≤ </span>
              {hasSample ? `${ceiling.toFixed(1)}%` : '—'}
            </div>
            <p className='text-caption mt-2'>
              {hasSample ? (
                <>observed <span className='text-ink font-mono'>{observed}%</span> · {int(k)}/{int(n)} templates</>
              ) : (
                <>No random sample yet.</>
              )}
            </p>
          </div>
          {hasSample && estMax != null && (
            <div className='text-right'>
              <div className='text-stat font-mono text-ink'>≤ {int(estMax)}</div>
              <p className='text-caption mt-1'>docs may deviate of {int(total)}</p>
            </div>
          )}
        </div>

        {hasSample && (
          <div>
            <div className='relative h-2.5 rounded-md bg-surface-muted border border-border'>
              <div
                className='absolute top-0 bottom-0 left-0 rounded-md bg-primary-soft'
                style={{ width: pos(ceiling), transition: 'width .5s var(--ease-out)' }}
              />
              <div className='absolute -top-1.5 -bottom-1.5 w-0.5 bg-primary' style={{ left: pos(ceiling) }} />
              <div
                className='absolute top-1/2 w-3 h-3 rounded-full border-2 border-surface bg-primary -translate-x-1/2 -translate-y-1/2'
                style={{ left: pos(observed) }}
              />
            </div>
            <div className='flex justify-between text-label text-ink-subtle mt-1.5'>
              {ticks.map((t, i) => (
                <span key={i}>{+t.toFixed(1)}%</span>
              ))}
            </div>
          </div>
        )}
      </Stack>
    </div>
  )
}
