import React from 'react'

const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const signed = (value) => (
  Number.isFinite(value) ? `${value > 0 ? '+' : ''}${fmt.format(value)}` : '—'
)
const value = (number) => (Number.isFinite(number) ? fmt.format(number) : '—')

function Summary({ label, summary }) {
  return (
    <div className='rounded-lg border border-border bg-surface px-3 py-2'>
      <p className='text-body-strong text-ink'>{label}</p>
      <p className='mt-1 text-caption text-ink-muted'>
        n <span className='font-mono tabular-nums text-ink'>{summary.n}</span>
        {' · '}rows <span className='font-mono tabular-nums text-ink'>{summary.rows}</span>
        {' · '}columns <span className='font-mono tabular-nums text-ink'>{summary.columns}</span>
        {summary.omitted > 0 && <>{' · '}omitted <span className='font-mono tabular-nums text-ink'>{summary.omitted}</span></>}
      </p>
      <p className='mt-1 text-caption text-ink-muted'>
        mean <span className='font-mono tabular-nums text-ink'>{value(summary.mean)}</span>
        {' · '}median <span className='font-mono tabular-nums text-ink'>{value(summary.median)}</span>
        {' · '}IQR <span className='font-mono tabular-nums text-ink'>{value(summary.q1)}–{value(summary.q3)}</span>
        {' · '}range <span className='font-mono tabular-nums text-ink'>{value(summary.min)}–{value(summary.max)}</span>
      </p>
    </div>
  )
}

function DeltaLine({ distribution, prefix = 'Subject minus baseline' }) {
  return (
    <p className='mt-1 text-caption text-ink-muted'>
      {prefix}: mean{' '}
      <span className='font-mono tabular-nums text-ink'>{signed(distribution.meanDelta)}</span>
      {' · '}median <span className='font-mono tabular-nums text-ink'>{signed(distribution.medianDelta)}</span>.
    </p>
  )
}

function SummaryPair({ distribution, baselineLabel, subjectLabel }) {
  return (
    <div className='mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2'>
      <Summary label={baselineLabel} summary={distribution.baseline} />
      <Summary label={subjectLabel} summary={distribution.subject} />
    </div>
  )
}

/** A distribution is the only valid numeric receipt for disjoint corpora. */
export default function DistributionReceipt({ distribution, baselineLabel, subjectLabel, contract }) {
  if (!distribution) return null
  const grouped = distribution.mode === 'grouped'
  return (
    <section className='surface-card p-4'>
      <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
        <h3 className='text-heading text-ink'>Cross-corpus distribution receipt</h3>
        <span className='text-caption text-ink-muted'>
          {contract?.unit || 'value'} · {contract?.grain || 'declared figure cells'} ·{' '}
          {contract?.semantics?.weighting || 'each numeric cell weighted equally'}
        </span>
      </div>
      {grouped ? (
        <>
          <p className='mt-1 text-caption text-ink-muted'>
            No institutions are paired. Results are reported separately by{' '}
            {distribution.groupLabel}; no pooled delta is calculated because category
            populations can differ.
          </p>
          <div className='mt-3 flex flex-col gap-3'>
            {distribution.groups.map((group) => (
              <section key={group.key} className='rounded-lg border border-border p-3'>
                <h4 className='text-body-strong text-ink'>{group.label}</h4>
                <DeltaLine distribution={group} />
                <SummaryPair distribution={group}
                  baselineLabel={baselineLabel} subjectLabel={subjectLabel} />
              </section>
            ))}
          </div>
          {distribution.overall && (
            <section className='mt-3 rounded-lg border border-border p-3'>
              <h4 className='text-body-strong text-ink'>Pooled equal-cell summary</h4>
              <DeltaLine distribution={distribution.overall} />
              <SummaryPair distribution={distribution.overall}
                baselineLabel={baselineLabel} subjectLabel={subjectLabel} />
            </section>
          )}
        </>
      ) : (
        <>
          <p className='mt-1 text-caption text-ink-muted'>No institutions are paired.</p>
          <DeltaLine distribution={distribution} />
          <SummaryPair distribution={distribution}
            baselineLabel={baselineLabel} subjectLabel={subjectLabel} />
        </>
      )}
    </section>
  )
}
