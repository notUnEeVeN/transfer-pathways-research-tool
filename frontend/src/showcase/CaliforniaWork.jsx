/**
 * Act 2 — our own California figure, kept clearly separate from the ports.
 *
 * The district heatmap reproduces the California study we started from, not
 * the Massachusetts paper, so presenting it among "your figures" would
 * misattribute it. Same slide layout, different attribution.
 */

import React from 'react'
import { MarketingSection } from '../components/ui'
import { CALIFORNIA_WORK } from './showcaseContent'
import { FigureSlide } from './FigureSlides'

export default function CaliforniaWork({ onOpen, canOpenAnalysis }) {
  return (
    <MarketingSection band={false} className='border-y border-border bg-surface-muted' containerClassName='py-24'>
      <div className='mb-10 max-w-3xl'>
        <p className='text-label'>{CALIFORNIA_WORK.eyebrow}</p>
        <h2 className='mt-3 text-display'>{CALIFORNIA_WORK.heading}</h2>
      </div>
      <FigureSlide figure={CALIFORNIA_WORK} eyebrow='California study'
        canOpen={canOpenAnalysis(CALIFORNIA_WORK.analysisId)} onOpen={onOpen} />
    </MarketingSection>
  )
}
