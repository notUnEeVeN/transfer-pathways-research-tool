import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransferExtraUnits, { extraUnitEntries, extraUnitValue } from './TransferExtraUnits'
import { paperRedCellColor } from './maHeatmapColors'

const mockRate = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useTransferCreditRate: (...a) => mockRate(...a),
}))

const row = (collegeId, name, schoolId, school, extra, over = {}) => ({
  community_college_id: collegeId, college_name: name,
  school_id: schoolId, school,
  rate: 80, transferred_units: 40,
  as_total_units: 60, as_unit_system: 'semester',
  extra_units: extra,
  extra_units_semester: extra,
  modeled_pathway_units_semester: Number.isFinite(extra) ? 120 + extra : null,
  modeled_hours_above_120: extra,
  degree_template_verified: true,
  degree_template_status_conflict: false,
  degree_catalog_year: '2025-26',
  method_status: 'ok',
  ...over,
})

const rows = [
  row(10, 'CC Alpha', 1, 'UC Berkeley', 30, {
    as_total_units: 90,
    as_unit_system: 'quarter',
    transferred_units: 60,
    extra_units_semester: 20,
    modeled_pathway_units_semester: 140,
    modeled_hours_above_120: 20,
  }),
  row(10, 'CC Alpha', 2, 'UC Merced', 0),
  row(20, 'CC Beta', 1, 'UC Berkeley', null, {
    extra_units_semester: null,
    method_status: 'unavailable',
    method_warning: 'No verified articulation agreement for this pair.',
  }),
]

describe('TransferExtraUnits', () => {
  it('uses semester-equivalent units for the heatmap and keeps native units in the tooltip', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits />)
    expect(mockRate).toHaveBeenCalledWith('ast', { majorSlug: 'cs', verifiedOnly: true })
    expect(screen.getAllByText('+20').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+0').length).toBeGreaterThan(0)
    expect(screen.queryByText('Mean replacement units')).not.toBeInTheDocument()
    expect(screen.queryByText('No replacement units')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Modeled pathway: \+20 semester hours above 120/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/30 quarter units do not apply/i))
    expect(screen.getByLabelText(/CC Alpha\s+UC Merced\s+Modeled pathway: \+0 semester hours above 120/i))
      .toHaveStyle({ backgroundColor: 'rgb(255 255 255)' })
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Modeled pathway: \+20 semester hours above 120/i))
      .toHaveStyle({ backgroundColor: 'rgb(103 0 13)' })
  })

  it('uses and exports the shared zero-to-combined-max domain in Comparison', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    const scale = { min: 0, mid: 20, max: 40, comparisonShared: true }
    const { container } = render(<TransferExtraUnits comparisonColorScale={scale} />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(within(exportRoot).getByText(
      'Shared comparison color domain: +0–+40 semester hours above 120'
    )).toBeInTheDocument()
    expect(screen.getByLabelText(/CC Alpha\s+UC Berkeley\s+Modeled pathway: \+20/i))
      .toHaveStyle({ backgroundColor: paperRedCellColor(20, scale).backgroundColor })
  })

  it('switches degree cohorts through the shared modes', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits />)
    fireEvent.click(screen.getByRole('button', { name: 'CS A.S.-T' }))
    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'cs', verifiedOnly: true })
  })

  it('opens on the verified high-fidelity cohort and can expand to all sourced records', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits />)

    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'cs', verifiedOnly: true })
    expect(screen.getByText(/Verified associate-degree programs only/i)).toBeInTheDocument()
    expect(screen.getByText(/Bachelor templates: 2\/2 carry explicit verification records/i))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'All sourced programs' }))
    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'cs', verifiedOnly: false })
  })

  it('defaults Economics to its transfer cohort and exposes the regular local A.A.', () => {
    mockRate.mockReturnValue({ data: { rows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits majorSlug='econ' majorLabel='Economics'
      degreeAnalysisSlots={['ast', 'local_other']}
      degreeSlotLabels={{ ast: 'A.A.-T / A.S.-T', local_other: 'Local A.A.' }} />)

    expect(mockRate).toHaveBeenLastCalledWith('ast', { majorSlug: 'econ', verifiedOnly: true })
    expect(screen.getByRole('button', { name: 'Economics A.A.-T / A.S.-T' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Local Economics A.A.' }))
    expect(mockRate).toHaveBeenLastCalledWith('local_other', { majorSlug: 'econ', verifiedOnly: true })
  })

  it('offers a paper corpus only as final Figure 4 or our recalculation', () => {
    const maRows = [row(10, 'Berkshire Community College', 1, 'MCLA', 20, {
      published_pdf_extra_hours: 26,
      archived_pathway_sheet_total_hours: 146,
      archived_pathway_sheet_extra_hours: 26,
      modeled_pathway_units_semester: 140,
      modeled_hours_above_120: 20,
    })]
    mockRate.mockReturnValue({ data: { rows: maRows }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
    render(<TransferExtraUnits majorSlug='ma-cs' degreeAnalysisSlots={['local_as']}
      major={{ state: 'ma', capabilities: { paperBaselines: true } }} />)

    expect(mockRate).toHaveBeenLastCalledWith('local_as', { majorSlug: 'ma-cs', verifiedOnly: false })
    expect(screen.queryByText('Associate degree')).toBeNull()
    expect(screen.getByRole('button', { name: 'Final paper' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/1 reported cell/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Final paper Figure 4: \+26 semester hours above 120/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Our recalculation' }))
    expect(screen.getByText(/1 recomputed cell/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Our recalculation: \+26 semester hours above 120/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/146 recalculated total semester hours; max\(0, total − 120\)/i))
    expect(screen.queryByRole('button', { name: 'Ours (recomputed)' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Deposited pathway sheets' })).toBeNull()
  })

  it('reads the deposited-detail source directly instead of falling through to the general model', () => {
    const data = { rows: [row(10, 'Bunker Hill Community College', 1, 'UMass Boston', 40, {
      modeled_hours_above_120: 38,
      archived_pathway_sheet_total_hours: 119,
      archived_pathway_sheet_extra_hours: 0,
      published_pdf_extra_hours: 6,
    })] }

    expect(extraUnitValue(data.rows[0], 'archive-detail')).toBe(0)
    expect(extraUnitValue(data.rows[0], 'ours')).toBe(38)
    expect(extraUnitEntries(data, 'archive-detail')).toEqual([expect.objectContaining({ value: 0 })])
    expect(extraUnitEntries({ rows: [{
      ...data.rows[0], published_pdf_extra_hours: null,
    }] }, 'archive-detail')).toEqual([])
  })
})
