import { Stack } from '../../../../components/ui'
import { int } from './statsFormat'

// Ceiling at/under which student risk reads "within target" (calm vs alarm).
const CALM_THRESHOLD = 5

/**
 * Hero student-risk gauge — the page's headline number. The 95% Wilson upper
 * bound on the under-prepare (error) rate, computed over the uniform-random
 * sample ONLY (never the all-sources count, never coverage). Shows the observed
 * rate as a marker, the band out to the ceiling as the uncertainty we can't yet
 * rule out, a dashed target line, and an absolute "≤ N of total" translation.
 * Colour flips calm (teal) → alarm (rose) at the threshold.
 */
export default function RiskGauge({ stats }) {
  // The bound's unit is the randomly-drawn TEMPLATE (one deterministic
  // observation), restricted to the active scope and finite-population corrected.
  const n = stats.n_random_clusters ?? 0
  const k = stats.n_random_clusters_error ?? 0
  const ceiling = stats.ci_upper_safety_pct // null when n === 0
  const observed = n ? +((k / n) * 100).toFixed(2) : 0
  const estMax = stats.estimated_max_unsafe
  const total = stats.total_docs

  const hasSample = ceiling != null && n > 0
  const calm = hasSample && ceiling <= CALM_THRESHOLD
  const toneText = !hasSample ? 'text-ink-subtle' : calm ? 'text-success' : 'text-danger'

  // Axis 0 → axisMax with headroom past the ceiling and a floor, so a small
  // bound isn't a sliver and the target tick stays on-scale. Clamp to 100%: an
  // error RATE can't exceed 100%, and a tiny sample (e.g. n=1, ceiling ~79%)
  // must not push the axis labels past 100.
  const axisMax = Math.min(100, Math.max(8, (ceiling ?? 0) * 1.4, CALM_THRESHOLD * 1.2))
  const pos = (v) => `${Math.min(100, (v / axisMax) * 100)}%`
  const ticks = [0, axisMax / 4, axisMax / 2, (axisMax * 3) / 4, axisMax]

  return (
    <div className='surface-card p-5'>
      <Stack gap='comfortable'>
        <div className='flex items-start justify-between gap-3'>
          <p className='text-label'>Student risk · 95% Wilson upper bound</p>
          {hasSample && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-label ${
                calm ? 'text-success bg-success-soft' : 'text-danger bg-danger-soft'
              }`}
            >
              {calm ? '✓ Within target' : '▲ Above target'}
            </span>
          )}
        </div>

        <div className='flex items-start justify-between gap-6 flex-wrap'>
          <div className='min-w-0'>
            <div className={`text-stat-lg font-mono ${toneText}`}>
              <span className='text-ink-subtle' style={{ fontSize: '0.6em' }}>≤ </span>
              {hasSample ? `${ceiling.toFixed(1)}%` : '—'}
            </div>
            <p className='text-caption mt-2'>
              {hasSample ? (
                <>observed <span className='text-ink font-mono'>{observed}%</span> · {int(k)}/{int(n)} templates</>
              ) : (
                <>No random sample in scope yet.</>
              )}
            </p>
          </div>
          {hasSample && estMax != null && (
            <div className='text-right'>
              <div className='text-stat font-mono text-ink'>≤ {int(estMax)}</div>
              <p className='text-caption mt-1'>docs at risk of {int(total)}</p>
            </div>
          )}
        </div>

        {hasSample && (
          <div>
            <div className='relative h-2.5 rounded-md bg-surface-muted border border-border'>
              <div
                className={`absolute top-0 bottom-0 left-0 rounded-md ${calm ? 'bg-success-soft' : 'bg-danger-soft'}`}
                style={{ width: pos(ceiling), transition: 'width .5s var(--ease-out)' }}
              />
              <div
                className='absolute -top-1 -bottom-1 border-l border-dashed border-ink-subtle'
                style={{ left: pos(CALM_THRESHOLD) }}
              />
              <div
                className={`absolute -top-1.5 -bottom-1.5 w-0.5 ${calm ? 'bg-success' : 'bg-danger'}`}
                style={{ left: pos(ceiling) }}
              />
              <div
                className={`absolute top-1/2 w-3 h-3 rounded-full border-2 border-surface -translate-x-1/2 -translate-y-1/2 ${
                  calm ? 'bg-success' : 'bg-danger'
                }`}
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
