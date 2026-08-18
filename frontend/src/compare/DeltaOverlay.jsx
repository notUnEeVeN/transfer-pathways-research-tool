import React, { useMemo } from 'react'
import { Alert, Spinner } from '../components/ui'
import { paperDivergingCellColor } from '../analyses/maHeatmapColors'

/**
 * The difference, ranked — the surface the workspace opens on.
 *
 * This is chrome, not a figure: `data-export-exclude` throughout, never
 * publishable, never MEASURES-bearing. It renders no reading of its own — each
 * value here comes from the figure's `comparable.cells`, which may only call
 * functions the figure module exports, so the number below a pane is the same
 * number inside it by construction.
 *
 * It refuses rather than fuses. Panes whose key spaces do not intersect get the
 * refusal in words; no correspondence is invented to fill the space.
 */

const fmt = (value) => (Number.isFinite(value)
  ? Number(value.toFixed(Math.abs(value) < 10 ? 2 : 1)).toString()
  : '—')

const signed = (value) => (Number.isFinite(value) ? `${value > 0 ? '+' : ''}${fmt(value)}` : '—')

function SummaryLine({ join }) {
  return (
    <p className='text-caption text-ink-muted'>
      <span className='text-ink font-[650] tabular'>{join.agreeing}</span> of{' '}
      <span className='text-ink font-[650] tabular'>{join.matched}</span> cells agree ·
      {' '}mean Δ <span className='text-ink tabular'>{signed(join.meanDelta)}</span> ·
      {' '}largest Δ <span className='text-ink tabular'>{signed(join.maxCell?.delta ?? 0)}</span>
      {join.maxCell ? <> at {join.maxCell.rowLabel} × {join.maxCell.colLabel}</> : null}
    </p>
  )
}

// Baseline dot, subject dot, connector — one shared axis for every row, so the
// eye reads magnitude down the column instead of per row.
function Dumbbell({ cell, domain, maxAbs }) {
  const span = Math.max(1e-9, domain.max - domain.min)
  const at = (value) => `${((value - domain.min) / span) * 100}%`
  // The same diverging ramp the delta chip and the figure's own matrix use.
  // Encoding the sign one way in the bar and the other way in the number
  // beside it would make a row argue with itself.
  const moved = paperDivergingCellColor(cell.delta, { maxAbs }).backgroundColor
  const lo = Math.min(cell.baseline, cell.subject)
  const hi = Math.max(cell.baseline, cell.subject)
  return (
    <div className='relative h-3 flex-1 min-w-[120px]'>
      <span className='absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border' />
      <span className='absolute top-1/2 h-[3px] -translate-y-1/2 rounded-pill'
        style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})`, background: moved }} />
      <span className='absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full
        border border-border-strong bg-surface' style={{ left: at(cell.baseline) }} />
      <span className='absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full'
        style={{ left: at(cell.subject), background: moved }} />
    </div>
  )
}

function DeltaRow({ cell, domain, maxAbs, selected, onSelect }) {
  const swatch = paperDivergingCellColor(cell.delta, { maxAbs })
  return (
    <button type='button' onClick={() => onSelect(cell)}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left
        hover:bg-surface-hover ${selected ? 'bg-primary-soft' : ''}`}>
      <span className='w-[38%] min-w-0 truncate text-caption text-ink'>
        {cell.rowLabel} <span className='text-ink-subtle'>×</span> {cell.colLabel}
      </span>
      <span className='w-12 shrink-0 text-right text-caption text-ink-muted tabular'>{fmt(cell.baseline)}</span>
      <Dumbbell cell={cell} domain={domain} maxAbs={maxAbs} />
      <span className='w-12 shrink-0 text-caption text-ink-muted tabular'>{fmt(cell.subject)}</span>
      <span className='w-16 shrink-0 rounded-md px-2 py-0.5 text-right text-tag font-[650] tabular'
        style={swatch}>
        {signed(cell.delta)}
      </span>
    </button>
  )
}

function SubjectBlock({ subject, baseline, showHeader, selectedCell, onSelectCell }) {
  const join = subject.join
  const domain = useMemo(() => {
    const values = (join?.cells || []).flatMap((cell) => [cell.baseline, cell.subject])
    return { min: Math.min(0, ...values), max: Math.max(1, ...values) }
  }, [join])
  const ranked = useMemo(
    () => [...(join?.cells || [])].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    [join]
  )

  if (subject.status === 'no_adapter' || baseline.status === 'no_adapter') {
    const figure = subject.status === 'no_adapter' ? subject.pane.figure : baseline.pane.figure
    return (
      <Alert type='info'>
        No delta lens for <span className='font-mono'>{figure}</span> yet. The panes still render,
        the comparison still saves, and notes still attach — there is simply no per-cell adapter
        declared for this figure.
      </Alert>
    )
  }
  if (subject.status === 'error' || baseline.status === 'error') {
    return <Alert type='error'>Could not load the data behind one of these panes.</Alert>
  }
  if (subject.status !== 'ready' || baseline.status !== 'ready') {
    return <div className='flex justify-center py-8'><Spinner /></div>
  }
  if (!join || !join.matched) {
    return (
      <Alert type='info'>
        These panes share no cells — every key in one is absent from the other, so there is
        nothing to difference. The join receipt below names what each side carried.
      </Alert>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {showHeader && (
        <p className='text-label'>{subject.label} <span className='ink-subtle'>vs {baseline.label}</span></p>
      )}
      <SummaryLine join={join} />
      <div className='flex flex-col'>
        {ranked.map((cell) => (
          <DeltaRow key={cell.key} cell={cell} domain={domain} maxAbs={join.maxAbsDelta}
            selected={selectedCell === cell.key} onSelect={onSelectCell} />
        ))}
      </div>
    </div>
  )
}

export default function DeltaOverlay({
  assessment, baseline, subjects, selectedCell = null, onSelectCell = () => {},
}) {
  if (!baseline || !subjects.length) {
    return (
      <section className='surface-card p-5' data-export-exclude>
        <p className='text-caption ink-subtle'>{assessment.line}</p>
      </section>
    )
  }

  return (
    <section className='surface-card flex flex-col gap-4 p-5' data-export-exclude>
      <div className='flex items-baseline justify-between gap-4'>
        <h2 className='text-heading'>The difference</h2>
        <p className='text-caption ink-subtle'>
          {baseline.label} is the baseline · every Δ is {subjects.length > 1 ? 'each pane' : subjects[0].label} minus it
        </p>
      </div>

      {assessment.join === 'refused' || assessment.join === 'disjoint' ? (
        <Alert type='info'>
          <p>{assessment.line}</p>
          {assessment.warnings.map((warning) => (
            <p key={warning.code} className='mt-1.5 text-caption'>
              {warning.text} <span className='text-ink'>{warning.fix}</span>
            </p>
          ))}
        </Alert>
      ) : (
        <div className='flex flex-col gap-5'>
          {subjects.map((subject) => (
            <SubjectBlock key={subject.pane.id} subject={subject} baseline={baseline}
              showHeader={subjects.length > 1}
              selectedCell={selectedCell} onSelectCell={onSelectCell} />
          ))}
        </div>
      )}
    </section>
  )
}
