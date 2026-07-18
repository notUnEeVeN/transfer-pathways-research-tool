import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DatasetSummaryPanel from './DatasetSummaryPanel'

const mocks = {
  useDataSummary: vi.fn(),
  useCoverage: vi.fn(),
  useDegreeRequirements: vi.fn(),
  useAsDegreeAvailability: vi.fn(),
}
vi.mock('@frontend/query/hooks/useData', () => ({
  useDataSummary: (...a) => mocks.useDataSummary(...a),
  useCoverage: (...a) => mocks.useCoverage(...a),
  useDegreeRequirements: (...a) => mocks.useDegreeRequirements(...a),
  useAsDegreeAvailability: (...a) => mocks.useAsDegreeAvailability(...a),
}))

const summary = {
  last_data_refresh_at: '2026-07-01T00:00:00Z',
  schools: [
    { school_id: 1, school: 'UC Berkeley', majors: ['CS'], n_agreements: 90 },
    { school_id: 2, school: 'UC Merced', majors: ['CSE'], n_agreements: 80 },
  ],
  counts: { agreements: 170, majors: 2, courses: 500, university_courses: 60, community_colleges: 115 },
}

// One college per landscape segment: both, A.S.-T only, local only, neither
// (the neither college offers another computing degree).
const offered = (ast, local, computing = false) => ({
  types: {
    ast: { inventory_offered: ast, status: ast ? 'available' : 'confirmed_none' },
    local_cs_as: { inventory_offered: local, status: local ? 'available' : 'confirmed_none' },
    local_computing: { inventory_offered: computing, status: computing ? 'available' : 'confirmed_none' },
  },
})
const availability = {
  rows: [offered(true, true), offered(true, false), offered(false, true), offered(false, false, true)],
}

const wire = () => {
  mocks.useDataSummary.mockReturnValue({ data: summary, isLoading: false, isError: false })
  mocks.useCoverage.mockReturnValue({ data: { rows: [] }, isLoading: false })
  mocks.useDegreeRequirements.mockReturnValue({
    data: { rows: [
      { school_id: 1, verification_notes: [{ text: 'walked the official pages' }] },
      { school_id: 2, verification_notes: [] },
    ] },
    isLoading: false,
  })
  mocks.useAsDegreeAvailability.mockReturnValue({ data: availability, isLoading: false, isError: false })
}

describe('DatasetSummaryPanel', () => {
  it('breaks the CS-degree landscape into the four offering segments', () => {
    wire()
    render(<DatasetSummaryPanel />)
    expect(screen.getByText('CS associate-degree landscape')).toBeInTheDocument()
    expect(screen.getByText('across 4 colleges')).toBeInTheDocument()
    expect(screen.getByText('CS A.S.-T only')).toBeInTheDocument()
    expect(screen.getByText('Local CS A.S. only')).toBeInTheDocument()
    expect(screen.getByText('Both CS degrees')).toBeInTheDocument()
    expect(screen.getByText('Neither CS degree')).toBeInTheDocument()
    expect(screen.getByText('1 offer another computing degree')).toBeInTheDocument()
  })

  it('marks a campus template Verified when it carries notes, Imported otherwise', () => {
    wire()
    render(<DatasetSummaryPanel />)
    expect(screen.getByText('Graduation template')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Imported')).toBeInTheDocument()
  })

  it('carries no fixed-population counts: no curated strip, no colleges-surveyed tile', () => {
    wire()
    render(<DatasetSummaryPanel />)
    expect(screen.queryByText('Hand-curated layer')).not.toBeInTheDocument()
    expect(screen.queryByText('Graduation templates')).not.toBeInTheDocument()
    expect(screen.queryByText('Transfer minimums')).not.toBeInTheDocument()
    expect(screen.queryByText('Colleges surveyed')).not.toBeInTheDocument()
  })

  it('jumps to the hubs through onNavigate; buttons hide without it', () => {
    wire()
    const onNavigate = vi.fn()
    const { unmount } = render(<DatasetSummaryPanel onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /Open Pathways/ }))
    expect(onNavigate).toHaveBeenCalledWith('articulation')
    fireEvent.click(screen.getByRole('button', { name: /Open Institutions/ }))
    expect(onNavigate).toHaveBeenCalledWith('institutions')
    unmount()

    render(<DatasetSummaryPanel />)
    expect(screen.queryByRole('button', { name: /Open Pathways/ })).not.toBeInTheDocument()
  })

  it('compact mode stays the plain chip strip with no landscape section', () => {
    wire()
    render(<DatasetSummaryPanel compact />)
    expect(screen.getAllByText('Agreements').length).toBeGreaterThan(0)
    expect(screen.queryByText('CS associate-degree landscape')).not.toBeInTheDocument()
  })
})
