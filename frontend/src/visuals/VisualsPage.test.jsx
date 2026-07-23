import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  BuiltInAnalysisCard, FigureCard, InteractiveFigureCard, VisualThumbnailCard,
  filterBuiltInAnalyses,
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

  it('declares reusable and fixed-major figures without an implicit CS fallback', () => {
    expect(ANALYSES.every((analysis) => analysis.majorScope)).toBe(true)

    const selected = ANALYSES
      .filter((analysis) => analysis.majorScope.mode === 'selected')
      .map((analysis) => analysis.id)
    expect(selected).toEqual([
      'paper-credit-loss',
      'paper-district-heatmap',
      'paper-articulation-histogram',
      'paper-articulation-map',
      'coverage-heatmap',
      'income-access',
      'credit-loss',
      'choice-cost',
      'category-gaps',
      'complexity',
    ])

    const fixed = ANALYSES.filter((analysis) => analysis.majorScope.mode === 'fixed')
    expect(fixed.every((analysis) => (
      analysis.majorScope.slug === 'cs' && analysis.pinnedMajor === 'cs'
    ))).toBe(true)
    expect(ANALYSES
      .filter((analysis) => analysis.majorScope.mode === 'selected')
      .every((analysis) => analysis.pinnedMajor == null)).toBe(true)
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
  const biology = {
    slug: 'bio',
    label: 'Biology',
    capabilities: { degreeTemplates: true, courseCategories: false, prerequisites: false },
  }

  it('shows compact metadata and opens the full visual from one accessible target', () => {
    const onOpen = vi.fn()
    const Preview = ({ majorSlug }) => (
      <div data-testid='live-preview' data-major={majorSlug}>Preview contents</div>
    )
    const item = {
      kind: 'analysis',
      key: 'analysis:sample',
      analysis: {
        id: 'sample',
        title: 'Sample transfer visual',
        description: 'A compact description for the visual library.',
        author_label: 'Researcher',
        published_at: '2026-07-18T09:00:00',
        majorScope: { mode: 'selected', requiredCapabilities: [], datasets: [] },
        Component: Preview,
      },
    }

    render(<VisualThumbnailCard item={item} isAdmin releasedSet={new Set(['sample'])}
      selectedMajor={biology} onOpen={onOpen} />)

    expect(screen.getByText('A compact description for the visual library.')).toBeTruthy()
    expect(screen.getByText('Published')).toBeTruthy()
    expect(screen.getByTestId('live-preview')).toHaveAttribute('data-major', 'bio')
    expect(screen.getByText('Biology available')).toBeTruthy()
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
        majorScope: { mode: 'selected', requiredCapabilities: [], datasets: [] },
        Component: Full,
        PreviewComponent: Preview,
      },
    }

    render(<VisualThumbnailCard item={item} selectedMajor={biology} onOpen={vi.fn()} />)

    expect(screen.getByTestId('figure-preview')).toBeTruthy()
    expect(screen.queryByTestId('full-component')).not.toBeInTheDocument()
  })

  it('keeps an unsupported reference visible without mounting its CS renderer', () => {
    const FixedRenderer = vi.fn(() => <div data-testid='fixed-renderer'>CS data</div>)
    const item = {
      kind: 'analysis',
      key: 'analysis:fixed-sample',
      analysis: {
        id: 'fixed-sample',
        title: 'Fixed sample',
        description: 'A fixed Computer Science reference.',
        author_label: 'Researcher',
        published_at: '2026-07-18T09:00:00',
        pinnedMajor: 'cs',
        majorScope: {
          mode: 'fixed', slug: 'cs', label: 'Computer Science',
          reason: 'Only the audited Computer Science baseline exists.',
          datasets: ['audited baseline'],
        },
        Component: FixedRenderer,
      },
    }

    render(<VisualThumbnailCard item={item} selectedMajor={biology} onOpen={vi.fn()} />)

    expect(screen.getByText('Computer Science only')).toBeTruthy()
    expect(screen.getByText('Only the audited Computer Science baseline exists.')).toBeTruthy()
    expect(screen.queryByTestId('fixed-renderer')).not.toBeInTheDocument()
    expect(FixedRenderer).not.toHaveBeenCalled()
  })

  it('passes the selected major through the full detail renderer', () => {
    const Renderer = vi.fn(({ majorSlug, majorCapabilities }) => (
      <div data-testid='major-detail' data-major={majorSlug}
        data-templates={String(majorCapabilities.degreeTemplates)} />
    ))
    const analysis = {
      id: 'dynamic-detail',
      title: 'Dynamic detail',
      description: 'A reusable major-aware visual.',
      author_label: 'Researcher',
      published_at: '2026-07-18T09:00:00',
      majorScope: { mode: 'selected', requiredCapabilities: ['degreeTemplates'] },
      Component: Renderer,
    }

    render(<BuiltInAnalysisCard analysis={analysis} selectedMajor={biology} />)

    expect(screen.getByTestId('major-detail')).toHaveAttribute('data-major', 'bio')
    expect(screen.getByTestId('major-detail')).toHaveAttribute('data-templates', 'true')
    expect(screen.getByText('Showing Biology data.')).toBeTruthy()
  })

  it('explains pending detail data without mounting a renderer', () => {
    const Renderer = vi.fn(() => <div data-testid='pending-detail'>Wrong data</div>)
    const analysis = {
      id: 'pending-detail',
      title: 'Pending detail',
      description: 'A visual waiting for categories.',
      author_label: 'Researcher',
      published_at: '2026-07-18T09:00:00',
      majorScope: {
        mode: 'selected',
        requiredCapabilities: ['courseCategories'],
        pendingReason: 'Biology categories require validation.',
        datasets: ['validated course categories'],
      },
      Component: Renderer,
    }

    render(<BuiltInAnalysisCard analysis={analysis} selectedMajor={biology} />)

    expect(screen.getByText(/Biology categories require validation/)).toBeTruthy()
    expect(screen.getByText(/Required data: validated course categories/)).toBeTruthy()
    expect(screen.queryByTestId('pending-detail')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument()
    expect(Renderer).not.toHaveBeenCalled()
  })

  it('describes fixed detail as an audited reference rather than future pending work', () => {
    const Renderer = vi.fn(() => <div data-testid='fixed-detail'>Wrong data</div>)
    const analysis = {
      id: 'fixed-detail',
      title: 'Fixed detail',
      description: 'An audited reference.',
      author_label: 'Researcher',
      published_at: '2026-07-18T09:00:00',
      majorScope: {
        mode: 'fixed', slug: 'cs', label: 'Computer Science',
        reason: 'The published baseline remains fixed.',
      },
      Component: Renderer,
    }

    render(<BuiltInAnalysisCard analysis={analysis} selectedMajor={biology} />)

    expect(screen.getByText(/audited visual is available only for Computer Science/)).toBeTruthy()
    expect(screen.queryByTestId('fixed-detail')).not.toBeInTheDocument()
    expect(Renderer).not.toHaveBeenCalled()
  })
})
