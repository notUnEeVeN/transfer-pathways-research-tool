/**
 * Act 1 — the Massachusetts ports, one figure per full-width slide.
 *
 * An earlier version packed every figure into one shared stage with a
 * selector rail. Figures differ too much in shape for that to hold together,
 * and the rail buried the conclusions. Each figure now gets its own band: the
 * claim and its headline number read first, the figure sits below at a
 * consistent height, and the surrounding chrome stays minimal.
 *
 * Embedded analyses mount with `presentation` so a walkthrough cannot land on
 * a reproduced paper baseline or a lens that answers a different question.
 */

import React from 'react'
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import { Badge, MarketingSection } from '../components/ui'
import { getAnalysisById } from '../analyses/registry'
import { FEATURED_FIGURES } from './showcaseContent'

// One height for every embed so the slides read as a set rather than a
// ransom note. Tall enough for a heatmap to show its shape, short enough that
// the claim above it stays on screen while presenting.
const EMBED_HEIGHT = 'h-[540px]'

export function FigureSlide({ figure, canOpen, onOpen, eyebrow }) {
  const Live = canOpen ? getAnalysisById(figure.analysisId)?.Component : null
  return (
    <article className='overflow-hidden rounded-3xl border border-border bg-surface'>
      <div className='grid grid-cols-[minmax(0,1fr)_360px] items-start gap-12 px-10 pt-10'>
        <div>
          <div className='flex items-center gap-2'>
            <Badge variant='accent'>{eyebrow}</Badge>
            {figure.figureLabel && <span className='text-caption text-ink-subtle'>{figure.figureLabel}</span>}
          </div>
          <h3 className='mt-4 max-w-2xl text-display text-balance'>{figure.claim}</h3>
          <p className='mt-4 max-w-2xl text-[16px] leading-7 text-ink-muted text-pretty'>{figure.blurb}</p>
        </div>
        <div className='rounded-2xl bg-primary-soft px-7 py-6'>
          <p className='text-display-lg text-primary'>{figure.star}</p>
          <p className='mt-3 text-body text-ink-muted'>{figure.starLabel}</p>
        </div>
      </div>

      <div className='px-10 pb-10 pt-8'>
        {Live ? (
          <div className={`${EMBED_HEIGHT} overflow-auto rounded-2xl border border-border bg-canvas p-4`}>
            <Live presentation />
          </div>
        ) : (
          <div className={`${EMBED_HEIGHT} flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-muted text-center`}>
            <p className='text-display-lg text-ink-subtle'>{figure.star}</p>
            <p className='mt-3 max-w-sm text-caption text-ink-subtle'>
              The live figure is not released for this account.
            </p>
          </div>
        )}
        <button type='button' disabled={!canOpen} onClick={() => canOpen && onOpen(figure)}
          className='mt-5 flex items-center gap-2 text-button text-primary disabled:cursor-not-allowed disabled:text-ink-subtle'
          aria-label={canOpen ? `${figure.actionLabel}: ${figure.claim}` : `Figure not released: ${figure.claim}`}>
          <ArrowsPointingOutIcon className='h-4 w-4' aria-hidden='true' />
          {canOpen ? figure.actionLabel : 'Figure not released for this account'}
        </button>
      </div>
    </article>
  )
}

export default function FigureSlides({ onOpen, canOpenAnalysis }) {
  return (
    <MarketingSection band={false} containerClassName='py-24'>
      <div className='mb-10 max-w-3xl'>
        <p className='text-label'>The ported figures</p>
        <h2 className='mt-3 text-display'>Your analyses, run statewide in California</h2>
        <p className='mt-3 text-[17px] leading-7 text-ink-muted'>
          Three figures from your paper, rebuilt on California data with the same modelling choices.
          Each one is live — the numbers come from the current dataset, not a screenshot.
        </p>
      </div>
      <div className='flex flex-col gap-8'>
        {FEATURED_FIGURES.map((figure) => (
          <FigureSlide key={figure.id} figure={figure} eyebrow='Massachusetts paper'
            canOpen={canOpenAnalysis(figure.analysisId)} onOpen={onOpen} />
        ))}
      </div>
    </MarketingSection>
  )
}
