/**
 * Act 1 — the ported figures, then the California findings they support.
 *
 * The four figure entries mount the real analysis components inline so a
 * viewer can interact with them during a walkthrough. The three finding
 * entries keep their frozen hand-drawn previews. Both kinds respect the same
 * per-account release gate: without a release, an entry shows its frozen
 * headline instead of mounting anything live.
 */

import React from 'react'
import { ArrowRightIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { Badge, MarketingSection } from '../components/ui'
import { getAnalysisById } from '../analyses/registry'
import { FEATURED_FIGURES, SHOWCASE_FINDINGS } from './showcaseContent'
import { EvidenceBadge, VisualPreview } from './previews'

export const STAGE_ENTRIES = [
  ...FEATURED_FIGURES.map((f) => ({ ...f, entryKind: 'figure' })),
  ...SHOWCASE_FINDINGS.map((f) => ({ ...f, entryKind: 'finding' })),
]

function FigureBody({ entry, canOpen, onOpen }) {
  const Live = canOpen ? getAnalysisById(entry.analysisId)?.Component : null
  return (
    <div className='flex min-h-0 flex-1 flex-col px-7 py-6'>
      {Live ? (
        <div className='min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-surface p-4'>
          <Live />
        </div>
      ) : (
        <div className='flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-surface-muted text-center'>
          <p className='text-display-lg'>{entry.metric}</p>
          <p className='mt-2 max-w-sm text-body-strong'>{entry.metricLabel}</p>
          <p className='mt-4 text-caption text-ink-subtle'>Related visual is not released for this account</p>
        </div>
      )}
      <button type='button' disabled={!canOpen} onClick={() => canOpen && onOpen(entry)}
        className='mt-5 flex items-center gap-2 text-button text-primary disabled:cursor-not-allowed disabled:text-ink-subtle'
        aria-label={canOpen ? `${entry.actionLabel}: ${entry.title}` : `Related visual not released: ${entry.title}`}>
        <ArrowsPointingOutIcon className='h-4 w-4' aria-hidden='true' />
        {canOpen ? entry.actionLabel : 'Related visual is not released for this account'}
        {canOpen && <ArrowRightIcon className='h-4 w-4' aria-hidden='true' />}
      </button>
    </div>
  )
}

function FindingBody({ entry, canOpen, onOpen }) {
  return (
    <button type='button' disabled={!canOpen} onClick={() => canOpen && onOpen(entry)}
      className='group flex min-h-0 flex-1 flex-col px-7 py-6 text-left transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:hover:bg-transparent'
      aria-label={canOpen ? `${entry.actionLabel}: ${entry.title}` : `Related visual not released: ${entry.title}`}>
      <div className='min-h-0 flex-1'><VisualPreview kind={entry.preview} /></div>
      <div className={`mt-5 flex items-center gap-2 text-button ${canOpen ? 'text-primary' : 'text-ink-subtle'}`}>
        <ArrowsPointingOutIcon className='h-4 w-4' aria-hidden='true' />
        {canOpen ? entry.actionLabel : 'Related visual is not released for this account'}
        {canOpen && <ArrowRightIcon className='h-4 w-4 transition-transform group-hover:translate-x-1' aria-hidden='true' />}
      </div>
    </button>
  )
}

export default function FigureStage({ activeId, onSelect, onOpen, canOpenAnalysis }) {
  const active = STAGE_ENTRIES.find((entry) => entry.id === activeId) || STAGE_ENTRIES[0]
  const canOpen = canOpenAnalysis(active.analysisId)
  const isFigure = active.entryKind === 'figure'

  return (
    <MarketingSection band={false} containerClassName='py-24'>
      <div className='mb-9 max-w-3xl'>
        <p className='text-label'>The ported figures</p>
        <h2 className='mt-3 text-display'>Your analyses, run statewide in California</h2>
        <p className='mt-3 text-[17px] leading-7 text-ink-muted'>
          The first four entries reproduce the Massachusetts figures on California data. The three
          that follow are the California findings those figures make visible.
        </p>
      </div>

      <div className='rounded-3xl bg-primary p-5'>
        <div className='grid grid-cols-[minmax(0,1fr)_300px] items-stretch gap-5'>
          <section className='flex min-h-[540px] min-w-0 flex-col overflow-hidden rounded-2xl bg-surface'
            aria-labelledby={`showcase-entry-${active.id}`}>
            <div className='flex items-start gap-5 border-b border-border px-7 py-6'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  {isFigure
                    ? <Badge variant='accent'>Live visual</Badge>
                    : <EvidenceBadge status={active.status} />}
                  <span className='text-caption'>{active.scope}</span>
                </div>
                {isFigure && <p className='mt-3 text-caption text-ink-subtle'>{active.provenance}</p>}
                <h3 id={`showcase-entry-${active.id}`} className='mt-2 text-heading'>{active.title}</h3>
                <p className='mt-2 max-w-3xl text-body text-ink-muted'>
                  {isFigure ? active.question : active.description}
                </p>
              </div>
              <div className='shrink-0 text-right'>
                <p className='text-display-lg'>{active.metric}</p>
                {isFigure && <p className='mt-1 max-w-[220px] text-caption text-ink-subtle'>{active.metricLabel}</p>}
              </div>
            </div>
            {isFigure
              ? <FigureBody entry={active} canOpen={canOpen} onOpen={onOpen} />
              : <FindingBody entry={active} canOpen={canOpen} onOpen={onOpen} />}
          </section>

          <ol className='flex flex-col gap-2'>
            {STAGE_ENTRIES.map((entry, index) => {
              const selected = entry.id === active.id
              return (
                <li key={entry.id} className='flex-1'>
                  <button type='button' onClick={() => onSelect(entry.id)} aria-pressed={selected}
                    className={`flex h-full w-full flex-col rounded-2xl p-4 text-left transition-[background-color,opacity,transform] ${
                      selected ? 'bg-accent text-on-accent' : 'text-on-primary opacity-60 hover:opacity-100'
                    }`}>
                    <div className='flex items-center gap-3'>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-body-strong ${
                        selected ? 'bg-white text-primary' : 'bg-white/10 text-on-primary'
                      }`}>{index + 1}</span>
                      <span className={`text-tag ${selected ? 'text-on-accent' : 'text-on-primary/70'}`}>
                        {entry.entryKind === 'figure' ? 'Ported figure' : entry.status}
                      </span>
                    </div>
                    <p className='mt-3 text-body-strong'>{entry.title}</p>
                    <p className='mt-auto pt-3 text-stat'>{entry.metric}</p>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </MarketingSection>
  )
}
