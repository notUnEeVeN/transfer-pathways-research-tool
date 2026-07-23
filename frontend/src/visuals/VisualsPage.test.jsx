import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  FigureCard, InteractiveFigureCard, VisualThumbnailCard, filterBuiltInAnalyses,
} from './VisualsPage'
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

    // The figure opens on ASSIST; the paper baseline is the comparison root, so
    // step onto it before exercising the difference overlay.
    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(screen.getByRole('img').getAttribute('viewBox')).toBe('0 0 1990.3 1190.3')
    const differences = screen.getByRole('switch', { name: 'Show differences' })
    expect(differences).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Hand-curated minimums' }))
    expect(differences).not.toBeDisabled()
    fireEvent.click(differences)
    const increases = [...container.querySelectorAll(
      '[data-comparison-overlay][data-difference="increase"]'
    )]
    expect(increases.length).toBeGreaterThan(1)
    const exportRoot = container.querySelector('[data-export-root]')
    expect(exportRoot.querySelector('[data-modern-california-figure="credit-loss"]')).toBeTruthy()
    expect(exportRoot.querySelector('[data-export-width]').getAttribute('data-export-width')).toBe('1240')
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
      'paper-articulation-histogram',
      'paper-articulation-map',
      'paper-course-barriers',
      'course-type-coverage',
      'transfer-credit-rate',
      'transfer-extra-units',
      'coverage-heatmap',
      'income-access',
      'multi-campus-pathways',
      'credit-loss',
      'choice-cost',
      'category-gaps',
      'complexity',
      'time-to-degree',
    ])
  })

  it('pins every current figure to the canonical CS major', () => {
    expect(ANALYSES.every((analysis) => analysis.pinnedMajor === 'cs')).toBe(true)
  })

  it('uses clean, plain-language titles and descriptions in the gallery', () => {
    expect(ANALYSES.map((analysis) => analysis.title)).toEqual([
      'Credit loss by campus',
      'Transfer coverage by district',
      'Districts by complete campus coverage',
      'Articulation coverage across California',
      'Course gaps by campus',
      'Transferable requirements by course type',
      'Degree credit toward graduation',
      'Modeled replacement coursework',
      'Potential graduation-unit coverage',
      'Transfer access and local income',
      'Preparation as campus options expand',
      'Minimum transfer coursework',
      'Cost of applying to more campuses',
      'Missing courses by subject',
      'Transfer pathway complexity',
      'Associate degree transfer credit',
    ])
    for (const analysis of ANALYSES) {
      expect(`${analysis.title} ${analysis.description}`).not.toMatch(
        /\b(?:CCC|CC|UC|Fig|prereq)\b|\svs\s|\sx\s|[+/%]|paper-style/i
      )
    }
  })

  it('registers figure-only modern previews for every redesigned California handoff figure', () => {
    const redesigned = [
      'paper-credit-loss',
      'paper-district-heatmap',
      'paper-articulation-histogram',
      'paper-course-barriers',
    ]

    for (const id of redesigned) {
      expect(getAnalysisById(id)?.PreviewComponent).toBeTypeOf('function')
    }
    expect(getAnalysisById('paper-articulation-map')?.PreviewComponent).toBeUndefined()
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

describe('visual gallery thumbnails', () => {
  it('shows compact metadata and opens the full visual from one accessible target', () => {
    const onOpen = vi.fn()
    const Preview = () => <div data-testid='live-preview'>Preview contents</div>
    const item = {
      kind: 'analysis',
      key: 'analysis:sample',
      analysis: {
        id: 'sample',
        title: 'Sample transfer visual',
        description: 'A compact description for the visual library.',
        author_label: 'Researcher',
        published_at: '2026-07-18T09:00:00',
        Component: Preview,
      },
    }

    render(<VisualThumbnailCard item={item} isAdmin releasedSet={new Set(['sample'])}
      onOpen={onOpen} />)

    expect(screen.getByText('A compact description for the visual library.')).toBeTruthy()
    expect(screen.getByText('Published')).toBeTruthy()
    expect(screen.getByTestId('live-preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Sample transfer visual' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('uses a dedicated figure-only preview instead of the full interactive component', () => {
    const Full = () => <div data-testid='full-component'>Controls and figure</div>
    const Preview = () => <div data-testid='figure-preview'>Modern current figure</div>
    const item = {
      kind: 'analysis',
      key: 'analysis:sample-preview',
      analysis: {
        id: 'sample-preview',
        title: 'Sample preview visual',
        description: 'A visual with dedicated thumbnail artwork.',
        author_label: 'Researcher',
        published_at: '2026-07-18T09:00:00',
        Component: Full,
        PreviewComponent: Preview,
      },
    }

    render(<VisualThumbnailCard item={item} onOpen={vi.fn()} />)

    expect(screen.getByTestId('figure-preview')).toBeTruthy()
    expect(screen.queryByTestId('full-component')).not.toBeInTheDocument()
  })
})
