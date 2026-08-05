import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DatasetSummaryPanel from './DatasetSummaryPanel'
import { MajorProvider } from '@frontend/majors/MajorContext'

const mocks = {
  useDataSummary: vi.fn(),
  useCoverage: vi.fn(),
  useDegreeRequirements: vi.fn(),
  useAsDegreeVerification: vi.fn(),
  useMajors: vi.fn(),
}
vi.mock('@frontend/query/hooks/useData', () => ({
  useDataSummary: (...a) => mocks.useDataSummary(...a),
  useCoverage: (...a) => mocks.useCoverage(...a),
  useDegreeRequirements: (...a) => mocks.useDegreeRequirements(...a),
  useAsDegreeVerification: (...a) => mocks.useAsDegreeVerification(...a),
}))
vi.mock('@frontend/majors/useMajors', async (importOriginal) => ({
  ...(await importOriginal()),
  useMajors: (...a) => mocks.useMajors(...a),
}))

const MAJORS = [
  { slug: 'cs', label: 'Computer Science',
    capabilities: { asDegrees: true, degreeTemplates: true, paperBaselines: true } },
  { slug: 'bio', label: 'Biology',
    capabilities: { asDegrees: true, degreeTemplates: true, paperBaselines: false } },
  { slug: 'econ', label: 'Economics',
    capabilities: { asDegrees: true, degreeTemplates: true, paperBaselines: false } },
]

const summary = {
  last_data_refresh_at: '2026-07-01T00:00:00Z',
  schools: [
    { school_id: 1, school: 'UC Berkeley', majors: ['CS', 'Biology'], n_agreements: 90 },
    { school_id: 2, school: 'UC Merced', majors: ['CSE'], n_agreements: 80 },
  ],
  counts: { agreements: 170, majors: 3, courses: 500, university_courses: 60, community_colleges: 115 },
}

const verification = {
  majors: MAJORS.map((m) => ({ slug: m.slug, label: m.label })),
  counts: {
    cs: { verified: 112, present: 3, absent: 0,
      verified_slots: { ast: 74, local_as: 40, local_other: 2 } },
    bio: { verified: 0, present: 40, absent: 75 },
    econ: { verified: 0, present: 30, absent: 85 },
  },
  rows: new Array(115).fill(null).map((_, i) => ({ community_college_id: i })),
}

const wire = () => {
  mocks.useDataSummary.mockReturnValue({ data: summary, isLoading: false, isError: false })
  mocks.useCoverage.mockReturnValue({ data: { rows: [] }, isLoading: false })
  mocks.useDegreeRequirements.mockReturnValue({
    data: { rows: [
      // Berkeley: CS verified (has notes), Bio present (imported, no notes).
      { school_id: 1, major_slug: 'cs', verification_notes: [{ text: 'walked the official pages' }] },
      { school_id: 1, major_slug: 'bio', verification_notes: [] },
      // Merced: only a CS template, unverified. Bio/Econ absent (no row).
      { school_id: 2, major_slug: 'cs', verification_notes: [] },
    ] },
    isLoading: false,
  })
  mocks.useAsDegreeVerification.mockReturnValue({ data: verification, isLoading: false, isError: false })
  mocks.useMajors.mockReturnValue({
    majors: MAJORS,
    defaultSlug: 'cs',
    bySlug: new Map(MAJORS.map((m) => [m.slug, m])),
    isLoading: false,
    isError: false,
    error: null,
  })
}

const renderPanel = (props) =>
  render(<MajorProvider><DatasetSummaryPanel {...props} /></MajorProvider>)

describe('DatasetSummaryPanel', () => {
  it('shows a per-major associate-degree verification landscape', () => {
    wire()
    renderPanel()
    expect(screen.getByText('Associate-degree landscape')).toBeInTheDocument()
    expect(screen.getByText('115 colleges · verification by major')).toBeInTheDocument()
    const landscape = screen.getByLabelText('Associate-degree landscape')
    // Computer Science: 112 verified · 3 unverified · 0 not offered.
    const csRow = within(landscape).getByText('Computer Science').parentElement
    expect(csRow).toHaveTextContent('112 verified')
    // The verified count breaks down by award so A.S.-T vs local A.S. is
    // visible at a glance; zero-count slots stay silent (bio has no line).
    expect(csRow).toHaveTextContent('74 A.S.-T · 40 Local A.S. · 2 Other')
    expect(csRow).toHaveTextContent('3 unverified')
    expect(csRow).toHaveTextContent('0 not offered')
    const bioRow = within(landscape).getByText('Biology').parentElement
    expect(bioRow).toHaveTextContent('40 unverified')
    expect(bioRow).toHaveTextContent('75 not offered')
  })

  it('renders per-major graduation-template dots, verified vs imported vs absent', () => {
    wire()
    renderPanel()
    expect(screen.getByText('Graduation templates')).toBeInTheDocument()
    // Berkeley's row carries CS verified, Bio present, Econ absent.
    expect(screen.getByLabelText('Computer Science: verified')).toBeInTheDocument()
    expect(screen.getByLabelText('Biology: present, unverified')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Economics: not offered').length).toBeGreaterThan(0)
  })

  it('drops the per-campus coverage columns, count columns, and major picker', () => {
    wire()
    renderPanel()
    // One row per campus is just campus + template dots now — no repeated
    // major/agreement counts, no per-major coverage, no scoping picker.
    expect(screen.queryByText('Mean hand-curated coverage')).not.toBeInTheDocument()
    expect(screen.queryByText('Mean ASSIST coverage')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Major')).not.toBeInTheDocument()
    // The campus table's column headers are exactly Campus + Graduation templates.
    const campusLabel = screen.getByText('Campus')
    const headerRow = campusLabel.parentElement
    const headers = within(headerRow).getAllByText(/.+/).map((n) => n.textContent)
    expect(headers).toEqual(['Campus', 'Graduation templates'])
  })

  it('carries no fixed-population counts: no curated strip, no colleges-surveyed tile', () => {
    wire()
    renderPanel()
    expect(screen.queryByText('Hand-curated layer')).not.toBeInTheDocument()
    expect(screen.queryByText('Transfer minimums')).not.toBeInTheDocument()
    expect(screen.queryByText('Colleges surveyed')).not.toBeInTheDocument()
  })

  it('jumps to the hubs through onNavigate; buttons hide without it', () => {
    wire()
    const onNavigate = vi.fn()
    const { unmount } = renderPanel({ onNavigate })
    fireEvent.click(screen.getByRole('button', { name: /Open Community Colleges/ }))
    expect(onNavigate).toHaveBeenCalledWith('articulation')
    fireEvent.click(screen.getByRole('button', { name: /Open UC Campuses/ }))
    expect(onNavigate).toHaveBeenCalledWith('institutions')
    unmount()

    renderPanel()
    expect(screen.queryByRole('button', { name: /Open Community Colleges/ })).not.toBeInTheDocument()
  })

  it('compact mode stays the plain chip strip with no landscape section', () => {
    wire()
    renderPanel({ compact: true })
    expect(screen.getAllByText('Agreements').length).toBeGreaterThan(0)
    expect(screen.queryByText('Associate-degree landscape')).not.toBeInTheDocument()
  })
})
