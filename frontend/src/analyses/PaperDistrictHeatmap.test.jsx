import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaperDistrictHeatmap from './PaperDistrictHeatmap'
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
})
