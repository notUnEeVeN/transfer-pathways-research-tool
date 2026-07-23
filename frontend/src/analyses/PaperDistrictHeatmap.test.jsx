import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaperDistrictHeatmap, { PaperDistrictHeatmapPreview } from './PaperDistrictHeatmap'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

describe('paper district export figure', () => {
  beforeEach(() => {
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: [], dataset_version: 'test-version' },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
  })

  it('keeps both axis titles and the active difference legend inside the export root', () => {
    const { container } = render(<PaperDistrictHeatmap />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(exportRoot).toBeTruthy()
    expect(within(exportRoot).getByText('UC Campus')).toBeTruthy()
    expect(within(exportRoot).getByText('Community College District')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: 'Show differences' }))
    expect(within(exportRoot).getByText('gained')).toBeTruthy()
    expect(within(exportRoot).getByText('lost')).toBeTruthy()
  })

  it('modernizes only current-data states and leaves the paper matrix renderer intact', () => {
    const { container } = render(<PaperDistrictHeatmap />)

    expect(useCoverage).toHaveBeenCalledWith(
      { majorSlug: 'cs', groupBy: 'district', requirements: 'paper', pin: 'paper' },
      { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
    )
    expect(useCoverage).toHaveBeenCalledWith(
      { majorSlug: 'cs', groupBy: 'district', requirements: 'assist', pin: 'settings' },
      expect.objectContaining({ enabled: true })
    )

    expect(container.querySelector('[data-modern-california-figure="coverage-matrix"]')).toBeTruthy()
    expect(container.querySelector('.paper-export-cells')).toBeNull()
    const cells = [...container.querySelectorAll('[data-matrix-cell]')]
    expect(container.querySelector('[data-matrix-grid]')).toBeTruthy()
    expect(cells[0].getAttribute('width')).toBe('14')
    expect(Number(cells[1].getAttribute('x')) - Number(cells[0].getAttribute('x'))).toBe(15)
    expect(cells.every((cell) => !cell.hasAttribute('stroke'))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(container.querySelector('[data-modern-california-figure]')).toBeNull()
    expect(container.querySelector('.paper-export-cells')).toBeTruthy()
    expect(container.querySelector('[data-major-label]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'ASSIST minimums' }))
    expect(container.querySelector('[data-modern-california-figure="coverage-matrix"]')).toBeTruthy()
    expect(container.querySelector('[data-major-label]')).toHaveTextContent('Major: Computer Science')
  })

  it('provides a control-free modern current-data gallery preview', () => {
    const { container } = render(<PaperDistrictHeatmapPreview />)

    expect(container.querySelector('[data-modern-california-figure="coverage-matrix"]')).toBeTruthy()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('Our complete cells')).not.toBeInTheDocument()
  })

  it('uses only Biology ASSIST data and removes every paper comparison surface', () => {
    useCoverage.mockReturnValue({
      data: {
        rows: [{
          school_id: 89,
          school: 'UC Davis',
          row_group_label: 'Allan Hancock Joint Community College District',
          fully_articulated: true,
          pct_articulated: 100,
          major: 'Biological Sciences B.S.',
        }],
        dataset_version: 'bio-version',
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    const { container } = render(<PaperDistrictHeatmap majorSlug='bio' />)
    const exportRoot = container.querySelector('[data-export-root]')
    const modern = exportRoot.querySelector('[data-modern-california-figure="coverage-matrix"]')

    expect(modern).toBeTruthy()
    expect(within(exportRoot).getByText('Major: Biology')).toBeTruthy()
    expect(modern.querySelector('title')).toHaveTextContent('Biology: community college district transfer coverage')
    expect(modern.querySelector('desc')).toHaveTextContent('for Biology')
    expect(container.querySelector('.paper-export-cells')).toBeNull()
    expect(screen.queryByText('Version')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Paper baseline' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hand-curated minimums' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Show differences' })).not.toBeInTheDocument()
    expect(screen.getByText('Complete cells')).toBeTruthy()
    expect(screen.queryByText('Paper complete cells')).not.toBeInTheDocument()
    expect(screen.queryByText('Net vs paper')).not.toBeInTheDocument()

    const liveCell = container.querySelector('[data-matrix-cell="UC1*|0"]')
    expect(liveCell.getAttribute('aria-label')).toContain('1 live program for the selected major')
    expect(liveCell.getAttribute('aria-label')).not.toContain('live CS program')
    expect(liveCell.getAttribute('aria-label')).not.toContain('Paper baseline')

    expect(useCoverage).toHaveBeenCalledTimes(2)
    for (const [params] of useCoverage.mock.calls) {
      expect(params).toEqual({
        majorSlug: 'bio', groupBy: 'district', requirements: 'assist',
      })
      expect(params.pin).toBeUndefined()
    }
    expect(useCoverage.mock.calls.some(([, options]) => options.enabled === false)).toBe(true)
    expect(useCoverage.mock.calls.some(([, options]) => options.enabled === true)).toBe(true)
  })

  it('does not carry a selected CS paper state into Economics', () => {
    const view = render(<PaperDistrictHeatmap majorSlug='cs' />)
    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(view.container.querySelector('.paper-export-cells')).toBeTruthy()

    useCoverage.mockClear()
    view.rerender(<PaperDistrictHeatmap majorSlug='econ' />)

    expect(view.container.querySelector('.paper-export-cells')).toBeNull()
    expect(view.container.querySelector('[data-modern-california-figure="coverage-matrix"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Paper baseline' })).not.toBeInTheDocument()
    expect(useCoverage.mock.calls).toHaveLength(2)
    expect(useCoverage.mock.calls.every(([params]) => (
      params.majorSlug === 'econ'
      && params.requirements === 'assist'
      && params.pin == null
    ))).toBe(true)
  })

  it('forwards the selected major through the gallery preview', () => {
    const { container } = render(<PaperDistrictHeatmapPreview majorSlug='econ' />)

    expect(useCoverage.mock.calls).toHaveLength(2)
    expect(useCoverage.mock.calls.every(([params]) => (
      params.majorSlug === 'econ'
      && params.requirements === 'assist'
      && params.pin == null
    ))).toBe(true)
    expect(container.querySelector('[data-export-root] [data-major-label]'))
      .toHaveTextContent('Major: Economics')
  })

  it('turns an arbitrary future slug into a truthful export label', () => {
    const { container } = render(
      <PaperDistrictHeatmapPreview majorSlug='environmental-science' />
    )

    expect(container.querySelector('[data-export-root] [data-major-label]'))
      .toHaveTextContent('Major: Environmental Science')
    expect(container.querySelector('[data-export-root] [data-major-label]'))
      .not.toHaveTextContent('Computer Science')
  })
})
