import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../analyses/registry', () => ({
  getAnalysisById: (id) => ({
    id,
    Component: ({ presentation }) => <div>{`Live ${id} embed presentation=${!!presentation}`}</div>,
  }),
}))

import FigureSlides from './FigureSlides'
import { FEATURED_FIGURES } from './showcaseContent'

describe('figure slides', () => {
  it('shows only the three genuine Massachusetts ports, in paper order', () => {
    expect(FEATURED_FIGURES.map((f) => f.analysisId)).toEqual([
      'coverage-heatmap', 'transfer-credit-rate', 'transfer-extra-units',
    ])
    // The district and credit-loss figures reproduce the California study,
    // so attributing them to the MA paper would be wrong.
    expect(FEATURED_FIGURES.map((f) => f.analysisId)).not.toContain('paper-district-heatmap')
    expect(FEATURED_FIGURES.map((f) => f.analysisId)).not.toContain('paper-credit-loss')
  })

  it('leads each slide with its claim and star number, and mounts the embed in presentation mode', () => {
    render(<FigureSlides onOpen={() => {}} canOpenAnalysis={() => true} />)

    for (const figure of FEATURED_FIGURES) {
      expect(screen.getByRole('heading', { name: figure.claim })).toBeInTheDocument()
      expect(screen.getAllByText(figure.star).length).toBeGreaterThan(0)
    }
    // presentation=true keeps the reproduced paper baselines and the
    // off-message lenses out of a walkthrough.
    expect(screen.getByText('Live coverage-heatmap embed presentation=true')).toBeInTheDocument()
  })

  it('shows a plain-language formula on every slide without opening anything', () => {
    render(<FigureSlides onOpen={() => {}} canOpenAnalysis={() => true} />)

    expect(screen.getAllByText('How this is measured')).toHaveLength(FEATURED_FIGURES.length)
    for (const figure of FEATURED_FIGURES) {
      expect(screen.getByText(figure.formula.expression)).toBeInTheDocument()
      expect(screen.getByText(figure.formula.watchFor)).toBeInTheDocument()
    }
  })

  it('drops the scope minutiae that cluttered the old stage', () => {
    render(<FigureSlides onOpen={() => {}} canOpenAnalysis={() => true} />)
    expect(screen.queryByText(/72 districts and 9 selected programs/)).not.toBeInTheDocument()
    expect(screen.queryByText(/1,035 college and campus pairs/)).not.toBeInTheDocument()
  })

  it('falls back to the star number when a figure is not released', () => {
    render(<FigureSlides onOpen={() => {}} canOpenAnalysis={() => false} />)
    expect(screen.queryByText(/Live coverage-heatmap embed/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/not released for this account/i).length).toBeGreaterThan(0)
  })

  it('opens a figure full screen', () => {
    const onOpen = vi.fn()
    render(<FigureSlides onOpen={onOpen} canOpenAnalysis={() => true} />)
    fireEvent.click(screen.getByRole('button', {
      name: `${FEATURED_FIGURES[0].actionLabel}: ${FEATURED_FIGURES[0].claim}`,
    }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: FEATURED_FIGURES[0].id }))
  })
})
