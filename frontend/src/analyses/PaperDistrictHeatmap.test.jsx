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

    fireEvent.click(screen.getByRole('button', { name: 'ASSIST minimums' }))
    expect(container.querySelector('[data-modern-california-figure="coverage-matrix"]')).toBeTruthy()
  })

  it('provides a control-free modern current-data gallery preview', () => {
    const { container } = render(<PaperDistrictHeatmapPreview />)

    expect(container.querySelector('[data-modern-california-figure="coverage-matrix"]')).toBeTruthy()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('Our complete cells')).not.toBeInTheDocument()
  })
})
