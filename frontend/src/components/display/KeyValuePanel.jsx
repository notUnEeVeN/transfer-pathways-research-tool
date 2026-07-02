import React from 'react'

/**
 * KeyValuePanel — labelled key-value rows for use inside a card/Panel. Each row
 * is a left-aligned label and a right-aligned value on a baseline-shared line.
 * Values may be plain strings/numbers or nodes (e.g. a <Badge> for a stale item).
 *
 * Generic and reusable: also used by the User Lookup page. Purely presentational
 * — token classes only, no layout chrome of its own beyond the row rhythm.
 *
 * `rows`: [{ label, value }].
 */
export default function KeyValuePanel({ rows = [], className = '' }) {
  return (
    <dl className={`flex flex-col gap-3 ${className}`}>
      {rows.map((r, i) => (
        <div key={r.label ?? i} className='flex items-center justify-between gap-3'>
          <dt className='text-body text-ink'>{r.label}</dt>
          <dd className='text-caption text-ink-muted font-mono text-right'>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
