import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransferCreditRate, { buildRateMatrix, degreeModesForMajor } from './TransferCreditRate'

const mockRate = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useTransferCreditRate: (...a) => mockRate(...a),
}))

const row = (collegeId, name, schoolId, school, fullRate, lowerRate, over = {}) => ({
  community_college_id: collegeId, college_name: name,
  school_id: schoolId, school,
  full_degree_completion_pct: fullRate,
  lower_division_completion_pct: lowerRate,
  full_degree_required_units: 120,
  lower_division_required_units: 60,
  full_degree_fulfilled_units: Number.isFinite(fullRate) ? fullRate * 1.2 : null,
  lower_division_fulfilled_units: Number.isFinite(lowerRate) ? lowerRate * 0.6 : null,
  degree_unit_system: 'semester',
  rate: 90.5,
  as_total_units: 60, as_unit_system: 'semester', transferred_units: 54.3,
  as_unit_utilization_pct: 90.5,
  named_transferred_units: 20, ge_counted_units: 30, elective_counted_units: 4.3,
  method_status: 'ok',
  ...over,
})

const rows = [
  row(10, 'CC Alpha', 1, 'UC Berkeley', 45.2, 90.5),
  row(10, 'CC Alpha', 2, 'UC Merced', 50, 100),
  row(20, 'CC Beta', 1, 'UC Berkeley', null, null, {
    transferred_units: null,
    method_status: 'unavailable',
    method_warning: 'No verified articulation agreement for this pair.',
  }),
  row(20, 'CC Beta', 2, 'UC Merced', 30, 60),
]

describe('buildRateMatrix', () => {
  it('averages only computable cells and leaves the rest blank', () => {
    const model = buildRateMatrix(rows)
    expect(model.columns.map((c) => c.school)).toEqual(['UC Berkeley', 'UC Merced'])
    expect(model.rows.map((r) => r.name)).toEqual(['CC Alpha', 'CC Beta'])
    expect(model.cells.has('20|1')).toBe(false) // null rate → blank cell
    expect(model.records.has('20|1')).toBe(true) // explanation remains available
    expect(model.rows[1].mean).toBe(30) // Beta averages its one computable cell
    expect(model.columnMeans[0]).toBe(45.2)
    expect(model.valueCount).toBe(3)
  })
})

describe('degreeModesForMajor', () => {
  it('builds ordered, major-specific analysis cohorts without inventing an empty local A.S.', () => {
    expect(degreeModesForMajor({
      majorSlug: 'econ',
      majorLabel: 'Economics',
      degreeAnalysisSlots: ['ast', 'local_other'],
      degreeSlotLabels: { ast: 'A.A.-T / A.S.-T', local_other: 'Local A.A.' },
    })).toEqual([
      { value: 'ast', label: 'Economics A.A.-T / A.S.-T' },
      { value: 'local_other', label: 'Local Economics A.A.' },
    ])
  })
})

describe('TransferCreditRate', () => {
  it('defaults to the CS A.S.-T cohort and lower-division requirements', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    expect(mockRate).toHaveBeenCalledWith('ast', { majorSlug: 'cs', verifiedOnly: false })
    expect(screen.getByText('CC Alpha')).toBeInTheDocument()
    // The cell value repeats in the column-average row (one computable cell).
    expect(screen.getAllByText('90.5%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Average')).toHaveLength(2)
    expect(screen.queryByText('Mean degree applied')).not.toBeInTheDocument()
    expect(screen.queryByText('Whole degree applies')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Lower-division requirements fulfilled: 90.5%/i)).toHaveAttribute(
      'aria-label', expect.stringMatching(/Associate-degree units applied once: named requirements 20 · GE and breadth 30 · free electives 4.3 semester units/i)
    )
    expect(screen.getByLabelText(/CC Beta\s+UC Merced\s+Lower-division requirements fulfilled: 60%/i))
      .toHaveStyle({ backgroundColor: 'rgb(255 255 255)' })
    expect(screen.getByLabelText(/CC Alpha\s+UC Merced\s+Lower-division requirements fulfilled: 100%/i))
      .toHaveStyle({ backgroundColor: 'rgb(103 0 13)' })
    expect(screen.getByText(/Transferable and breadth requirements; university-only work is excluded/i)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('The denominator is the receiving bachelor’s requirements')
    expect(screen.getByRole('note')).toHaveTextContent('1 cell includes a method warning')
  })

  it('offers the MA-paper equivalent: the associate degree’s own transfer credit rate', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    const onMeasureChange = vi.fn()
    render(<TransferCreditRate onMeasureChange={onMeasureChange} />)
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/bachelor/) })
    )

    const toggle = screen.getByRole('button', { name: 'MA-paper equivalent' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)

    // The AS-side rate replaces the bachelor-side measure: applied AS units
    // over the associate degree's own total, the paper's Fig 3.
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Associate-degree credit applied \(MA-paper equivalent\): 90.5%/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/54.3 of 60 semester units of the associate degree apply/i))
    // The bachelor-side scope control goes quiet while the AS-side rate shows.
    expect(screen.getByRole('button', { name: 'Lower-division only' })).toBeDisabled()
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: expect.stringMatching(/associate degree’s own/),
        watchFor: expect.stringMatching(/68%/),
      })
    )

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Lower-division only' })).not.toBeDisabled()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Lower-division requirements fulfilled: 90.5%/i)).toBeInTheDocument()
  })

  it('switches from lower-division to all bachelor’s requirements', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    fireEvent.click(screen.getByRole('button', { name: 'All bachelor’s requirements' }))
    expect(screen.getByText(/complete modeled graduation plan, including upper-division and university-only work/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Bachelor’s requirements fulfilled: 45.2%/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/54.2 of 120 semester units/i))
    expect(screen.getByLabelText(/CC Alpha\s+UC Merced\s+Bachelor’s requirements fulfilled: 50%/i))
      .toHaveStyle({ backgroundColor: 'rgb(103 0 13)' })
  })

  it('switches to the local A.S. cohort from the A.S.-T default', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    fireEvent.click(screen.getByRole('button', { name: 'Local CS A.S.' }))
    expect(mockRate).toHaveBeenLastCalledWith('local_as', { majorSlug: 'cs', verifiedOnly: false })
  })

  it('switches to the human-verified associate-degree cohort without changing requirement scope', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)

    fireEvent.click(screen.getByRole('button', { name: 'Verified programs only' }))

    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'cs', verifiedOnly: true })
    expect(screen.getByText(/Verified associate-degree programs only/i)).toBeInTheDocument()
    expect(screen.getByText(/bachelor’s graduation templates are treated as valid/i)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/high-fidelity state limits the associate-degree side/i)
    expect(screen.getByText(/Transferable and breadth requirements; university-only work is excluded/i)).toBeInTheDocument()
  })

  it('drops the curation-cohort control for a paper corpus, which has exactly one source', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='ma-cs' degreeAnalysisSlots={['local_as']}
      major={{ slug: 'ma-cs', state: 'ma', label: 'Computer Science (MA)',
        capabilities: { paperBaselines: true } }} />)

    expect(screen.queryByText('Associate-degree evidence')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Verified programs only' })).toBeNull()
    expect(screen.getByText(/Paper-source associate degrees/)).toBeInTheDocument()
    expect(mockRate).toHaveBeenLastCalledWith('local_as', { majorSlug: 'ma-cs', verifiedOnly: false })
  })

  it('keeps the curation-cohort control for a state corpus we gathered ourselves', () => {
    // Virginia is state-scoped like Massachusetts but the data is ours and the
    // associate degrees carry verification, so the verified/unverified cohort
    // applies and the paper-source selector must not appear. Being a state
    // corpus is not what makes a corpus a paper corpus.
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='va-cs' degreeAnalysisSlots={['local_as']}
      major={{ slug: 'va-cs', state: 'va', label: 'Computer Science (VA)',
        capabilities: { paperBaselines: false } }} />)

    expect(screen.getByRole('button', { name: 'Verified programs only' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Final paper' })).toBeNull()
    expect(screen.queryByText(/Paper-source associate degrees/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Verified programs only' }))
    expect(mockRate).toHaveBeenLastCalledWith('local_as', { majorSlug: 'va-cs', verifiedOnly: true })
  })

  it('gives a paper corpus three sources, with a GE toggle on Ours that starts on', () => {
    const paperRows = [{
      ...rows[0],
      school_id: 9004, school: 'MCLA', community_college_id: 9101,
      college_name: 'Berkshire Community College', degree_type: 'local_as',
      as_unit_utilization_pct: 66.2, published_as_transfer_pct: 38.5,
      published_pdf_as_transfer_pct: 38, as_cs_only_utilization_pct: 18.5,
    }]
    mockRate.mockReturnValue({ data: { rows: paperRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='ma-cs' degreeAnalysisSlots={['local_as']}
      major={{ slug: 'ma-cs', state: 'ma', label: 'Computer Science (MA)',
        capabilities: { paperBaselines: true } }} />)

    // Native state: the paper's own measure, locked — the toggle and the
    // bachelor-side scope switch are not rendered on a paper corpus.
    expect(screen.queryByRole('button', { name: 'MA-paper equivalent' })).toBeNull()
    expect(screen.queryByText('Requirements counted')).toBeNull()
    expect(screen.getByText(/MA-paper equivalent — associate-degree credit applied/)).toBeInTheDocument()

    // Default source: the final paper as printed; no GE toggle until Ours.
    expect(screen.getByRole('button', { name: 'Final paper' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByText('38%').length).toBeGreaterThan(0)
    expect(screen.queryByText('66.2%')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Include GE' })).toBeNull()
    // Every hover carries all four versions.
    const cell = screen.getByLabelText(/Final paper 38%/)
    expect(cell.getAttribute('aria-label')).toMatch(/repo workbook 38\.5%/)
    expect(cell.getAttribute('aria-label')).toMatch(/ours GE-included 66\.2%/)
    expect(cell.getAttribute('aria-label')).toMatch(/ours CS-only 18\.5%/)

    // Ours opens GE-included (their stated method); the toggle flips to CS-only.
    fireEvent.click(screen.getByRole('button', { name: 'Ours' }))
    const geToggle = screen.getByRole('button', { name: 'Include GE' })
    expect(geToggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByText('66.2%').length).toBeGreaterThan(0)
    fireEvent.click(geToggle)
    expect(screen.getAllByText('18.5%').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Repo workbook' }))
    expect(screen.queryByRole('button', { name: 'Include GE' })).toBeNull()
    expect(screen.getAllByText('38.5%').length).toBeGreaterThan(0)
  })

  it('uses the Economics transfer and local A.A. cohorts and exposes source-review status', () => {
    const reviewRows = rows.map((item) => ({
      ...item,
      source_analysis_ready: false,
      degree_research_status: 'ai_researched_needs_human_verification',
    }))
    mockRate.mockReturnValue({ data: { rows: reviewRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='econ' majorLabel='Economics'
      degreeAnalysisSlots={['ast', 'local_other']}
      degreeSlotLabels={{ ast: 'A.A.-T / A.S.-T', local_other: 'Local A.A.' }} />)

    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'econ', verifiedOnly: false })
    expect(screen.getByRole('button', { name: 'Economics A.A.-T / A.S.-T' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Local Economics A.A.' }))
    expect(mockRate).toHaveBeenLastCalledWith('local_other', { majorSlug: 'econ', verifiedOnly: false })
    expect(screen.getByRole('note')).toHaveTextContent(/all-record state is exploratory/i)
  })

  it('shows an empty state when the cohort has no records', () => {
    mockRate.mockReturnValue({ data: { rows: [] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    expect(screen.getByText('No degree records')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Verified programs only' }))
    expect(screen.getByText(/No human-verified associate-degree programs exist/i)).toBeInTheDocument()
  })
})
