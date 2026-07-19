import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FigureCard, InteractiveFigureCard, filterBuiltInAnalyses } from './VisualsPage'
import { ANALYSES, getAnalysisById } from '../analyses/registry'
import apiClient from '../shared/api/apiClient'

const svg = (id) => Buffer.from(`<svg id="${id}"/>`).toString('base64')

const figure = {
  slug: 'paper-figure',
  title: 'Paper figure',
  author_uid: 'u1',
  author_label: 'Researcher',
  default_variant: 'current',
  controls: [
    {
      key: 'version', label: 'Version', type: 'select', default: 'current',
      options: [
        { value: 'paper', label: 'Paper baseline' },
        { value: 'current', label: 'Current data' },
      ],
    },
    { key: 'differences', label: 'Show differences', type: 'toggle', default: false },
  ],
  variants: [
    { key: 'paper', label: 'Paper baseline', state: { version: 'paper', differences: false }, svg: svg('paper') },
    { key: 'current', label: 'Current data', state: { version: 'current', differences: false }, svg: svg('current') },
    { key: 'current-diff', label: 'Current differences', state: { version: 'current', differences: true }, svg: svg('diff') },
  ],
}

function renderCard() {
  render(<FigureCard fig={figure} canModify={false} onDelete={vi.fn()}
    deleting={false} onSave={vi.fn()} saving={false} />)
}

describe('published visual variants', () => {
  it('switches among locally rendered states without running analysis code', () => {
    renderCard()
    expect(screen.getByRole('img').getAttribute('src')).toContain(svg('current'))

    fireEvent.click(screen.getByRole('switch', { name: 'Show differences' }))
    expect(screen.getByRole('img').getAttribute('src')).toContain(svg('diff'))

    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(screen.getByRole('img').getAttribute('src')).toContain(svg('paper'))
    expect(screen.getByRole('switch', { name: 'Show differences' })).toBeDisabled()
  })

  it('loads only the selected authenticated SVG when list metadata has no files', async () => {
    const request = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: new Blob(['<svg id="current"/>'], { type: 'image/svg+xml' }),
    })
    const metadataOnly = {
      ...figure,
      variants: figure.variants.map(({ svg: _svg, ...variant }) => variant),
    }
    render(<FigureCard fig={metadataOnly} canModify={false} onDelete={vi.fn()}
      deleting={false} onSave={vi.fn()} saving={false} />)

    await waitFor(() => expect(screen.getByRole('img')).toBeTruthy())
    expect(request).toHaveBeenCalledWith(
      '/gallery/paper-figure/variants/current/svg',
      { responseType: 'blob' }
    )
    request.mockRestore()
  })
})

describe('published interactive visual', () => {
  const interactive = {
    slug: 'paper-credit-loss-copy',
    title: 'Paper-style credit loss (published copy)',
    publication_type: 'interactive',
    visual: { id: 'paper-credit-loss', options: {} },
    author_uid: 'u1',
    author_label: 'Researcher',
  }

  it('uses the exact built-in component and preserves its interactions', () => {
    expect(getAnalysisById('paper-credit-loss')?.Component).toBe(ANALYSES[0].Component)

    const { container } = render(<InteractiveFigureCard fig={interactive} canModify={false}
      onDelete={vi.fn()} deleting={false} onSave={vi.fn()} saving={false} />)

    expect(screen.getByRole('img').getAttribute('viewBox')).toBe('0 0 1990.3 1190.3')
    const differences = screen.getByRole('switch', { name: 'Show differences' })
    expect(differences).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Hand-curated minimums' }))
    expect(differences).not.toBeDisabled()
    fireEvent.click(differences)
    const increases = [...container.querySelectorAll('[data-difference="increase"]')]
    expect(increases.length).toBeGreaterThan(1)
    expect(increases.every((region) => region.getAttribute('stroke') === '#ffffff')).toBe(true)
    expect(increases.every((region) => region.getAttribute('vector-effect') === 'non-scaling-stroke')).toBe(true)
    const exportRoot = container.querySelector('[data-export-root]')
    expect(exportRoot.querySelector('[data-export-width]').getAttribute('data-export-width')).toBe('1990.3')
    expect(exportRoot.textContent).toContain('Difference marks vs paper')
    expect(screen.getByText(/More details.*every difference as a matrix/)).toBeTruthy()
  })

  it('fails closed when an old manifest names an unavailable renderer', () => {
    render(<InteractiveFigureCard fig={{ ...interactive, visual: { id: 'missing' } }} canModify={false}
      onDelete={vi.fn()} deleting={false} onSave={vi.fn()} saving={false} />)
    expect(screen.getByText(/renderer is not available/)).toBeTruthy()
  })
})

describe('built-in visual registry', () => {
  it('keeps the complete recovered visual set', () => {
    expect(ANALYSES.map((analysis) => analysis.id)).toEqual([
      'paper-credit-loss',
      'paper-district-heatmap',
      'transfer-credit-rate',
      'coverage-heatmap',
      'credit-loss',
      'choice-cost',
      'category-gaps',
      'complexity',
      'time-to-degree',
    ])
  })

  it('shows admins every available visual regardless of publication', () => {
    const visible = filterBuiltInAnalyses(ANALYSES, {
      isAdmin: true,
      releasedIds: ['coverage-heatmap'],
      disabledIds: ['complexity'],
    })
    expect(visible.map((analysis) => analysis.id)).toContain('credit-loss')
    expect(visible.map((analysis) => analysis.id)).not.toContain('complexity')
  })

  it('shows partners only published visuals that remain available', () => {
    const visible = filterBuiltInAnalyses(ANALYSES, {
      isAdmin: false,
      releasedIds: ['coverage-heatmap', 'complexity'],
      disabledIds: ['complexity'],
    })
    expect(visible.map((analysis) => analysis.id)).toEqual(['coverage-heatmap'])
  })
})
