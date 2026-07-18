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
  curated: {
    degree_templates: 9,
    degree_templates_with_notes: 2,
    transfer_minimum_campuses: 9,
    prereq_concepts: 24,
    as_degree_records: 177,
    as_degree_colleges: 114,
  },
}

const availability = {
  counts: {
    total_colleges: 115,
    ast: { available: 72, data_gap: 3, confirmed_none: 40, duplicate_candidate: 0 },
    local_cs_as: { available: 45, data_gap: 0, confirmed_none: 70, duplicate_candidate: 0 },
    local_computing: { available: 100, data_gap: 2, confirmed_none: 8, duplicate_candidate: 5 },
  },
}

const wire = ({ curated = true } = {}) => {
  mocks.useDataSummary.mockReturnValue({
    data: curated ? summary : { ...summary, curated: undefined },
    isLoading: false, isError: false,
  })
  mocks.useCoverage.mockReturnValue({ data: { rows: [] }, isLoading: false })
  mocks.useDegreeRequirements.mockReturnValue({
    data: { rows: [
      { school_id: 1, verification_notes: [{ text: 'a' }, { text: 'b' }] },
      { school_id: 2, verification_notes: [] },
    ] },
    isLoading: false,
  })
  mocks.useAsDegreeAvailability.mockReturnValue({ data: availability, isLoading: false, isError: false })
}

describe('DatasetSummaryPanel', () => {
  it('renders the curated layer strip from the summary payload', () => {
    wire()
    render(<DatasetSummaryPanel />)
    expect(screen.getByText('Hand-curated layer')).toBeInTheDocument()
    expect(screen.getByText('Graduation templates')).toBeInTheDocument()
    expect(screen.getByText('2 with verification notes')).toBeInTheDocument()
    expect(screen.getByText('Transfer minimums')).toBeInTheDocument()
    expect(screen.getByText('across 114 colleges')).toBeInTheDocument()
    expect(screen.getByText('Prerequisite concepts')).toBeInTheDocument()
  })

  it('tolerates a cached summary payload without the curated block', () => {
    wire({ curated: false })
    render(<DatasetSummaryPanel />)
    expect(screen.queryByText('Hand-curated layer')).not.toBeInTheDocument()
    expect(screen.getAllByText('Agreements').length).toBeGreaterThan(0)
  })

  it('shows the AS-degree availability headline with QA tones', () => {
    wire()
    render(<DatasetSummaryPanel />)
    expect(screen.getByText('Associate-degree availability')).toBeInTheDocument()
    expect(screen.getByText('Colleges surveyed')).toBeInTheDocument()
    expect(screen.getByText('CS A.S.-T analyzable')).toBeInTheDocument()
    expect(screen.getByText('offered, requirements missing')).toBeInTheDocument()
    expect(screen.getByText('stored twice under two types')).toBeInTheDocument()
  })

  it('shows each campus template status: note count when reviewed, Imported otherwise', () => {
    wire()
    render(<DatasetSummaryPanel />)
    expect(screen.getByText('Graduation template')).toBeInTheDocument()
    expect(screen.getByText('2 verification notes')).toBeInTheDocument()
    expect(screen.getByText('Imported')).toBeInTheDocument()
  })

  it('jumps to the hubs through onNavigate; buttons hide without it', () => {
    wire()
    const onNavigate = vi.fn()
    const { unmount } = render(<DatasetSummaryPanel onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /Open Associate Degrees/ }))
    expect(onNavigate).toHaveBeenCalledWith('associate_degrees')
    fireEvent.click(screen.getByRole('button', { name: /Open Articulation/ }))
    expect(onNavigate).toHaveBeenCalledWith('articulation')
    unmount()

    render(<DatasetSummaryPanel />)
    expect(screen.queryByRole('button', { name: /Open Associate Degrees/ })).not.toBeInTheDocument()
  })

  it('compact mode stays the plain chip strip with no curated sections', () => {
    wire()
    render(<DatasetSummaryPanel compact />)
    expect(screen.getByText('Agreements')).toBeInTheDocument()
    expect(screen.queryByText('Hand-curated layer')).not.toBeInTheDocument()
    expect(screen.queryByText('Associate-degree availability')).not.toBeInTheDocument()
  })
})
