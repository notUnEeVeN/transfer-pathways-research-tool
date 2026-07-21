import { Stack } from '../../../../components/ui'

/**
 * Dense label → value table for the audit panel. Built for an admin reading a
 * lot of numbers at a glance, not for a stakeholder dashboard — values are
 * monospace at body size (no big `text-stat`), rows are tight, and a metric's
 * supporting figure rides in a muted second column on the same line.
 *
 *   groups: [{ title, rows: [{ label, value, sub?, tone? }] }]
 *
 * `tone` colours the value: 'accent' (primary), 'danger', 'success'. A row
 * with a null/empty `value` is skipped, so callers can inline conditionals
 * without leaving blank lines.
 */

const TONE = {
  accent: 'text-primary',
  danger: 'text-danger',
  success: 'text-success',
  conservative: 'text-conservative'
}

function MetricRow({ label, value, sub, tone }) {
  return (
    <div className='flex items-baseline justify-between gap-4 py-1'>
      <span className='text-body text-ink-muted'>{label}</span>
      <span className='flex items-baseline gap-2 shrink-0 text-right'>
        {sub && <span className='text-caption text-ink-subtle'>{sub}</span>}
        <span className={`text-body-strong tabular ${TONE[tone] || 'text-ink'}`}>{value}</span>
      </span>
    </div>
  )
}

function MetricGroup({ title, rows }) {
  const visible = rows.filter((r) => r.value != null && r.value !== '')
  if (!visible.length) return null
  return (
    <Stack gap='tight'>
      <p className='text-label'>{title}</p>
      <div className='divide-y divide-border'>
        {visible.map((r) => (
          <MetricRow key={r.label} {...r} />
        ))}
      </div>
    </Stack>
  )
}

export default function MetricTable({ groups, className = '' }) {
  return (
    <Stack gap='comfortable' className={className}>
      {groups.map((g) => (
        <MetricGroup key={g.title} {...g} />
      ))}
    </Stack>
  )
}
