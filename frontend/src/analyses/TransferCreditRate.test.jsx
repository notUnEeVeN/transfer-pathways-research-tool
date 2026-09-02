import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransferCreditRate, {
  MA_AS_SIDE_SCOPE, MA_BACHELOR_SIDE_SCOPE, buildRateMatrix, degreeModesForMajor,
  maSourceValue, rateForScope, transferCreditComparisonContract,
} from './TransferCreditRate'
import { paperRedCellColor } from './maHeatmapColors'

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
  paper_equivalent_transferred_units: 50,
  paper_equivalent_as_unit_utilization_pct: 83.3,
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
  it('defaults to the CS A.S.-T verified cohort and paper-equivalent AS denominator', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    expect(mockRate).toHaveBeenCalledWith('ast', { majorSlug: 'cs', verifiedOnly: true })
    expect(screen.getByText('CC Alpha')).toBeInTheDocument()
    // The cell value repeats in the column-average row (one computable cell).
    expect(screen.getAllByText('83.3%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Average')).toHaveLength(2)
    expect(screen.queryByText('Mean degree applied')).not.toBeInTheDocument()
    expect(screen.queryByText('Whole degree applies')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Associate-degree credit applied \(MA-paper equivalent\): 83.3%/i)).toHaveAttribute(
      'aria-label', expect.stringMatching(/Strict Figure 3 numerator: named requirements 20 · actual GE and breadth 30 · unrestricted-elective-only capacity excluded 4.3 semester units/i)
    )
    expect(screen.getByRole('button', { name: 'MA-paper equivalent' }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('uses and exports the fixed shared percentage domain in Comparison', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    const scale = { min: 0, mid: 50, max: 100, comparisonShared: true }
    const { container } = render(<TransferCreditRate comparisonColorScale={scale} />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(within(exportRoot).getByText('Shared comparison color domain: 0%–100%'))
      .toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Associate-degree credit applied .*83.3%/i))
      .toHaveStyle({ backgroundColor: paperRedCellColor(83.3, scale).backgroundColor })
  })

  it('offers the MA-paper equivalent: the associate degree’s own transfer credit rate', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    const onMeasureChange = vi.fn()
    render(<TransferCreditRate onMeasureChange={onMeasureChange} />)
    expect(onMeasureChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ expression: expect.stringMatching(/associate degree’s own/) })
    )

    const toggle = screen.getByRole('button', { name: 'MA-paper equivalent' })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    // The AS-side rate replaces the bachelor-side measure: applied AS units
    // over the associate degree's own total, the paper's Fig 3.
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Associate-degree credit applied \(MA-paper equivalent\): 83.3%/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/50 of 60 semester units of the associate degree replace named or GE\/breadth requirements/i))
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
    fireEvent.click(screen.getByRole('button', { name: 'MA-paper equivalent' }))
    fireEvent.click(screen.getByRole('button', { name: 'All bachelor’s requirements' }))
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Bachelor’s requirements fulfilled: 45.2%/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/54.2 of 120 semester units/i))
    expect(screen.getByLabelText(/CC Alpha\s+UC Merced\s+Bachelor’s requirements fulfilled: 50%/i))
      .toHaveStyle({ backgroundColor: 'rgb(103 0 13)' })
  })

  it('switches to the local A.S. cohort from the A.S.-T default', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    fireEvent.click(screen.getByRole('button', { name: 'Local CS A.S.' }))
    expect(mockRate).toHaveBeenLastCalledWith('local_as', { majorSlug: 'cs', verifiedOnly: true })
  })

  it('switches to the human-verified associate-degree cohort without changing requirement scope', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)

    fireEvent.click(screen.getByRole('button', { name: 'Verified programs only' }))

    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'cs', verifiedOnly: true })
  })

  it('drops the curation-cohort control for a paper corpus, which has exactly one source', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='ma-cs' degreeAnalysisSlots={['local_as']}
      major={{ slug: 'ma-cs', state: 'ma', label: 'Computer Science (MA)',
        capabilities: { paperBaselines: true } }} />)

    expect(screen.queryByText('Associate-degree evidence')).toBeNull()
    expect(screen.queryByText('Associate degree')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Verified programs only' })).toBeNull()
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
    // The request is still formed the same way, and still disabled: Virginia
    // renders a committed baseline built from its published transfer guides, so
    // the endpoint is not the source here. The cohort control stays because it
    // describes the corpus, not because it drives a fetch.
    expect(mockRate).toHaveBeenLastCalledWith('local_as', {
      majorSlug: 'va-cs', verifiedOnly: true, enabled: false,
    })
  })

  it('renders Virginia from the committed guide baseline, with its own supply controls', () => {
    // No rows from the endpoint at all: the figure must still draw, because the
    // Virginia measure comes from the transfer guides rather than the corpus
    // this endpoint evaluates.
    mockRate.mockReturnValue({ data: null, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='va-cs' degreeAnalysisSlots={['local_as']}
      major={{ slug: 'va-cs', state: 'va', label: 'Computer Science (VA)',
        capabilities: { paperBaselines: false } }} />)

    expect(screen.getByRole('button', { name: 'In the catalogue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Currently scheduled' })).toBeInTheDocument()
    // Every option visible, the selected one pressed.
    expect(screen.getByRole('button', { name: 'In the catalogue' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'With a CS degree' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All 23' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'All 23' }))
    expect(screen.getByRole('button', { name: 'All 23' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a paper corpus only as the final paper or our direct recalculation', () => {
    const paperRows = [{
      ...rows[0],
      school_id: 9004, school: 'MCLA', community_college_id: 9101,
      college_name: 'Berkshire Community College', degree_type: 'local_as',
      as_unit_utilization_pct: 66.2, published_as_transfer_pct: 38.5,
      published_pdf_as_transfer_pct: 38, as_cs_only_utilization_pct: 18.5,
      archive_gray_detail_as_transfer_pct: 35.7,
      archive_gray_detail_numerator_units: 25,
      archive_gray_detail_denominator_units: 70,
      archive_gray_detail_blue_units_excluded: 12,
      archive_gray_detail_source: 'Deposited 2024 All Pathways/MCLA.xlsx; gray replacement-row Column H credits; blue unrestricted-elective-only rows excluded; no 100% cap',
    }]
    mockRate.mockReturnValue({ data: { rows: paperRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='ma-cs' degreeAnalysisSlots={['local_as']}
      major={{ slug: 'ma-cs', state: 'ma', label: 'Computer Science (MA)',
        capabilities: { paperBaselines: true } }} />)

    // Native state: the paper's own measure, locked — the toggle and the
    // bachelor-side scope switch are not rendered on a paper corpus.
    expect(screen.queryByRole('button', { name: 'MA-paper equivalent' })).toBeNull()
    expect(screen.queryByText('Requirements counted')).toBeNull()
    expect(screen.queryByText('Associate degree')).toBeNull()

    // Default source: the final paper as printed.
    expect(screen.getByRole('button', { name: 'Final paper' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByText('38%').length).toBeGreaterThan(0)
    expect(screen.getByText(/1 reported cell/)).toBeInTheDocument()
    expect(screen.queryByText('66.2%')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Include GE' })).toBeNull()
    // Every hover carries only the requested comparison: final paper versus
    // our direct recalculation. The superseded typed tally is not presented.
    const cell = screen.getByLabelText(/Final paper 38%/)
    expect(cell.getAttribute('aria-label')).not.toMatch(/typed tally|38\.5%/i)
    expect(cell.getAttribute('aria-label')).toMatch(/our recalculation 35\.7% \(25 applicable of 70 associate-degree units; 12 unrestricted-elective-only units excluded; no cap\)/)

    fireEvent.click(screen.getByRole('button', { name: 'Our recalculation' }))
    expect(screen.getByText(/Our recalculation from the authors’ course-plan data/)).toBeInTheDocument()
    expect(screen.getByText(/1 recomputed cell/)).toBeInTheDocument()
    expect(screen.getAllByText('35.7%').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Include documented GE/i })).toBeNull()
    expect(screen.queryByText('66.2%')).toBeNull()
    expect(screen.queryByText('18.5%')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archived repo tally' })).toBeNull()
    expect(screen.queryByText('38.5%')).toBeNull()

    // Old saved panes called this source `ours`; they migrate to the direct
    // ledger instead of reopening the superseded generic model.
    expect(maSourceValue(paperRows[0], 'ours')).toBe(35.7)
    expect(maSourceValue(paperRows[0], 'repo')).toBe(35.7)
  })

  it('uses the Economics transfer and local A.A. cohorts and exposes source-review status', () => {
    const reviewRows = rows.map((item) => ({
      ...item,
      college_name: item.community_college_id === 20 ? 'Hartnell College' : item.college_name,
      source_analysis_ready: false,
      degree_research_status: 'ai_researched_needs_human_verification',
      degree_template_verified: true,
      degree_template_status_conflict: true,
      degree_catalog_year: item.school_id === 1 ? '2025-26' : '2026-27',
      ge_assumed_units: 0,
      elective_counted_units: 4.3,
      ...(item.community_college_id === 20 && item.school_id === 1
        ? { method_status: 'excluded', as_unit_utilization_pct: null }
        : {}),
    }))
    mockRate.mockReturnValue({ data: { rows: reviewRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='econ' majorLabel='Economics'
      degreeAnalysisSlots={['ast', 'local_other']}
      degreeSlotLabels={{ ast: 'A.A.-T / A.S.-T', local_other: 'Local A.A.' }} />)

    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'econ', verifiedOnly: true })
    expect(screen.getByRole('button', { name: 'Economics A.A.-T / A.S.-T' })).toBeInTheDocument()
    expect(screen.getByText(/Bachelor templates: 2\/2 carry explicit verification records/))
      .toHaveTextContent(/catalog years 2025-26 and 2026-27.*2 retain stale pre-verification/i)
    expect(screen.getByText(/1 college×campus cell is excluded/))
      .toHaveTextContent(/Hartnell College/)
    expect(screen.getByText(/3 of 3 modeled Economics cells apply assumed GE and\/or elective capacity/))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Local Economics A.A.' }))
    expect(mockRate).toHaveBeenLastCalledWith('local_other', { majorSlug: 'econ', verifiedOnly: true })
  })

  it('shows an empty state when the cohort has no records', () => {
    mockRate.mockReturnValue({ data: { rows: [] }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate />)
    expect(screen.getByText('No degree records')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Verified programs only' }))
    expect(screen.getByText(/No human-verified associate-degree programs exist/i)).toBeInTheDocument()
  })
})

// The paper measures how much of the ASSOCIATE degree gets used. California
// shows how much of the BACHELOR'S degree the associate degree completes.
// Those are opposite directions on the same pathways, and until this lens
// existed the two states had no statistic in common to compare on.
describe('the bachelor-side lens on a paper corpus', () => {
  const MA = { slug: 'ma-cs', state: 'ma', label: 'Computer Science (MA)', capabilities: { paperBaselines: true } }
  const maRows = [
    row(10, 'Berkshire', 1, 'MCLA', 35.8, 41.1, { published_pdf_as_transfer_pct: 38 }),
    row(20, 'Greenfield', 1, 'MCLA', 40, 50, { published_pdf_as_transfer_pct: 66 }),
  ]

  it('reads the bachelor-side field, not the associate-side one', () => {
    const cell = maRows[0]
    expect(rateForScope(cell, MA_AS_SIDE_SCOPE, 'pdf')).toBe(38)
    expect(rateForScope(cell, MA_BACHELOR_SIDE_SCOPE, 'pdf')).toBe(35.8)
  })

  it('switches the matrix and disables the source control', () => {
    mockRate.mockReturnValue({ data: { rows: maRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='ma-cs' degreeAnalysisSlots={['local_as']} major={MA} />)

    // Opens on the paper's own measure — reproducing the figure is native here.
    expect(screen.getByRole('button', { name: 'Associate credit used' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Final paper' })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Bachelor’s completed' }))

    expect(screen.getByRole('button', { name: 'Bachelor’s completed' })).toHaveAttribute('aria-pressed', 'true')
    // The paper never published this measure, so there is no published version
    // to choose between — offering the choice would imply one exists.
    expect(screen.getByRole('button', { name: 'Final paper' })).toBeDisabled()
  })

  it('reports the lens upward so a pinned comparison reopens on it', () => {
    const onViewChange = vi.fn()
    mockRate.mockReturnValue({ data: { rows: maRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='ma-cs' degreeAnalysisSlots={['local_as']} major={MA} onViewChange={onViewChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Bachelor’s completed' }))
    expect(onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ defaultMaLens: MA_BACHELOR_SIDE_SCOPE }))
  })

  it('seeds from a pinned view', () => {
    mockRate.mockReturnValue({ data: { rows: maRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferCreditRate majorSlug='ma-cs' degreeAnalysisSlots={['local_as']} major={MA}
      defaultMaLens={MA_BACHELOR_SIDE_SCOPE} />)
    expect(screen.getByRole('button', { name: 'Bachelor’s completed' })).toHaveAttribute('aria-pressed', 'true')
  })

  // The whole point: on this lens an MA pane declares the SAME measure a CA
  // pane does, so the comparison viewer will contrast them instead of refusing.
  it('declares the same measure contract California declares', () => {
    const ma = transferCreditComparisonContract(
      { major: 'ma-cs', figure: 'transfer-credit-rate', knobs: { lens: MA_BACHELOR_SIDE_SCOPE } }, MA,
    )
    const ca = transferCreditComparisonContract(
      { major: 'cs', figure: 'transfer-credit-rate', knobs: { 'ma-equivalent': false, scope: 'full-degree' } },
      { slug: 'cs', label: 'Computer Science', capabilities: {}, degreeAnalysisSlots: ['local_as', 'ast'] },
    )
    expect(ma.measure).toBe('bachelor-requirement-completion')
    expect(ma.measure).toBe(ca.measure)
    expect(ma.unit).toBe(ca.unit)
    expect(ma.grain).toBe(ca.grain)
    expect(ma.semantics.denominator).toBe(ca.semantics.denominator)
    // And it must not claim a published source, because there isn't one.
    expect(ma.context.source).not.toMatch(/PDF|final paper/i)
  })
})
