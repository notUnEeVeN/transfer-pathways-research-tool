import { Stack } from '../../../../components/ui'
import { int } from './statsFormat'

// Tier → token colour. correct=success, conservative=amber, flagged=neutral
// grey, error=danger. The error channel is always visible (min-width) even at 0.
const TIERS = [
  { key: 'n_correct', label: 'Correct', cls: 'bg-success' },
  { key: 'n_conservative', label: 'Conservative', cls: 'bg-conservative' },
  { key: 'n_flagged', label: 'Flagged', cls: 'bg-ink-subtle' },
  { key: 'n_errors', label: 'Error', cls: 'bg-danger' },
]

/**
 * Verdict composition — a single proportional bar split into the four tiers,
 * with the error segment pulled out and never invisible (the error channel is
 * always shown), plus a dot/value/percent legend.
 */
export default function VerdictBar({ stats }) {
  const total = stats.n_audited ?? 0
  const rows = TIERS.map((t) => ({ ...t, n: stats[t.key] ?? 0 }))
  const pct = (n) => (total ? +((n / total) * 100).toFixed(1) : 0)

  return (
    <div className='surface-card p-5'>
      <Stack gap='comfortable'>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-label'>Verdict composition</p>
          <span className='text-caption'>
            <span className='text-ink font-mono'>{int(total)}</span> audited
          </span>
        </div>

        <div className='flex gap-[3px] h-3'>
          {rows.map((t) => (
            <div
              key={t.key}
              className={`h-full rounded-sm ${t.cls}`}
              style={{ flexGrow: t.n, flexBasis: 0, minWidth: t.key === 'n_errors' ? 6 : 2 }}
              title={`${t.label}: ${int(t.n)} (${pct(t.n)}%)`}
            />
          ))}
        </div>

        <div className='flex flex-wrap gap-x-5 gap-y-2'>
          {rows.map((t) => (
            <div key={t.key} className='flex items-center gap-2'>
              <span className={`w-2 h-2 rounded-sm ${t.cls}`} />
              <span className='text-caption text-ink-muted'>{t.label}</span>
              <span className='text-body-strong font-mono'>{int(t.n)}</span>
              <span className='text-label text-ink-subtle'>{pct(t.n)}%</span>
            </div>
          ))}
        </div>

      </Stack>
    </div>
  )
}
