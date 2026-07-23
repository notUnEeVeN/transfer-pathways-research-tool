import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

// One college per landscape segment: both, A.S.-T only, local only, other
// computing only, and no degree record.
const offered = (ast, local, computing = false) => ({
  types: {
    ast: { inventory_offered: ast, status: ast ? 'available' : 'confirmed_none' },
    local_as: { inventory_offered: local, status: local ? 'available' : 'confirmed_none' },
    local_other: { inventory_offered: computing, status: computing ? 'available' : 'confirmed_none' },
  },
})
const availability = {
  rows: [
    offered(true, true),
    offered(true, false),
    offered(false, true),
    offered(false, false, true),
    offered(false, false),
    // Inventory alone must not count as an analyzable A.S.-T record. This
    // college instead belongs in "other computing only".
    {
      types: {
        ast: { inventory_offered: true, status: 'data_gap' },
        local_as: { inventory_offered: false, status: 'confirmed_none' },
        local_other: { inventory_offered: true, status: 'available' },
      },
    },
    // Duplicate candidates are not distinct degrees, so this college belongs
    // in "no degree record".
    {
      types: {
        ast: { inventory_offered: false, status: 'confirmed_none' },
        local_as: { inventory_offered: false, status: 'confirmed_none' },
        local_other: { inventory_offered: true, status: 'duplicate_candidate' },
      },
    },
  ],
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
  it('leads with inclusive degree totals and separately explains their overlap', () => {
    wire()
    render(<DatasetSummaryPanel />)
    expect(screen.getByText('CS associate-degree landscape')).toBeInTheDocument()
    expect(screen.getByText('7 colleges · totals may overlap')).toBeInTheDocument()
    const valueFor = (label) => within(screen.getByText(label).parentElement).getByText(/^\d+$/)
    expect(valueFor('Schools with CS A.S.-T')).toHaveTextContent('2')
    expect(valueFor('Schools with local CS A.S.')).toHaveTextContent('2')
    expect(valueFor('Schools with another computing degree')).toHaveTextContent('2')

    const breakdown = screen.getByText('One-school-per-group breakdown').parentElement
    expect(within(breakdown).getByText('A.S.-T only').parentElement).toHaveTextContent('1 A.S.-T only')
    expect(within(breakdown).getByText('local A.S. only').parentElement).toHaveTextContent('1 local A.S. only')
    expect(within(breakdown).getByText('both CS degrees').parentElement).toHaveTextContent('1 both CS degrees')
    expect(within(breakdown).getByText('other computing only').parentElement).toHaveTextContent('2 other computing only')
    expect(within(breakdown).getByText('no degree record').parentElement).toHaveTextContent('2 no degree record')
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
    fireEvent.click(screen.getByRole('button', { name: /Open Community Colleges/ }))
    expect(onNavigate).toHaveBeenCalledWith('articulation')
    fireEvent.click(screen.getByRole('button', { name: /Open UC Campuses/ }))
    expect(onNavigate).toHaveBeenCalledWith('institutions')
    unmount()

    render(<DatasetSummaryPanel />)
    expect(screen.queryByRole('button', { name: /Open Community Colleges/ })).not.toBeInTheDocument()
  })

  it('compact mode stays the plain chip strip with no landscape section', () => {
    wire()
    render(<DatasetSummaryPanel compact />)
    expect(screen.getAllByText('Agreements').length).toBeGreaterThan(0)
    expect(screen.queryByText('CS associate-degree landscape')).not.toBeInTheDocument()
  })
})
