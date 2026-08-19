import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransferExtraCost, { extraCostEntries, extraCostValue } from './TransferExtraCost'
import { paperRedCellColor } from './maHeatmapColors'
import maFigureLedgers from '../../../server/data/ma/figure-ledgers.json'
import maPdfFigures from '../../../server/data/ma/pdf-figures.json'

const mockRate = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useTransferCreditRate: (...args) => mockRate(...args),
}))

const row = {
  community_college_id: 10,
  college_name: 'Berkshire Community College',
  school_id: 1,
  school: 'MCLA',
  as_total_units: 60,
  as_unit_system: 'semester',
  extra_units: 20,
  extra_units_semester: 20,
  modeled_pathway_units_semester: 140,
  modeled_hours_above_120: 20,
  modeled_hours_above_120_unrounded: 20,
  modeled_cost_above_120_usd: 10000,
  modeled_cost_above_120_standard_load_usd: 8000,
  archived_pathway_sheet_total_hours: 144,
  archived_pathway_sheet_extra_hours: 24,
  archived_pathway_sheet_source: 'Deposited 2024 pathway sheet',
  published_pdf_extra_hours: 26,
  published_pdf_extra_cost_usd: 13202,
  tuition_annual_resident_usd: 12000,
  tuition_source: 'Test tuition schedule',
  tuition_source_url: 'https://example.edu/tuition.pdf',
  degree_template_verified: true,
  degree_template_status_conflict: false,
  degree_catalog_year: '2025-26',
  method_status: 'ok',
}

const query = () => ({
  data: { rows: [row] },
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
})

describe('TransferExtraCost', () => {
  it('prices the corrected modeled Figure 4 field and persists the load control', async () => {
    const onViewChange = vi.fn()
    mockRate.mockReturnValue(query())
    render(<TransferExtraCost onViewChange={onViewChange} />)

    expect(mockRate).toHaveBeenCalledWith('ast', { majorSlug: 'cs', verifiedOnly: true })
    expect(screen.getByLabelText(/Cost of modeled pathway hours above 120: \$10,000/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/Pricing receipt: 20 unrounded hours/i))
    expect(screen.getByLabelText(/Cost of modeled pathway hours above 120: \$10,000/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/example\.edu\/tuition\.pdf/i))
    fireEvent.click(screen.getByRole('button', { name: 'Standard load (15u)' }))
    expect(screen.getByLabelText(/Cost of modeled pathway hours above 120: \$8,000/i))
      .toBeInTheDocument()
    await waitFor(() => expect(onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({
      defaultLoadView: 'standard',
    })))
  })

  it('uses and exports the shared zero-to-combined-max domain in Comparison', () => {
    mockRate.mockReturnValue(query())
    const scale = { min: 0, mid: 10_000, max: 20_000, comparisonShared: true }
    const { container } = render(<TransferExtraCost comparisonColorScale={scale} />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(within(exportRoot).getByText('Shared comparison color domain: $0–$20,000'))
      .toBeInTheDocument()
    expect(screen.getByLabelText(/Cost of modeled pathway hours above 120: \$10,000/i))
      .toHaveStyle({ backgroundColor: paperRedCellColor(10_000, scale).backgroundColor })
  })

  it('offers Massachusetts only as final Figure 5 or our paper-rule recalculation', () => {
    mockRate.mockReturnValue(query())
    render(<TransferExtraCost majorSlug='ma-cs' degreeAnalysisSlots={['local_as']}
      major={{ state: 'ma', capabilities: { paperBaselines: true } }} />)

    expect(mockRate).toHaveBeenLastCalledWith('local_as', { majorSlug: 'ma-cs', verifiedOnly: false })
    expect(screen.queryByText('Associate degree')).toBeNull()
    expect(screen.getByRole('button', { name: 'Final paper' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/1 reported cell/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Final paper Figure 5: \$13,202/i)).toBeInTheDocument()

    expect(screen.queryByText('Full-time load')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Standard load (15u)' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Our recalculation' }))
    expect(screen.getByText(/1 raw-rerun cell/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Our Figure 5 recalculation: \$12,000/i))
      .toHaveAttribute('aria-label', expect.stringMatching(/24 recalculated Figure 4 hours above 120.*annual charge.*24/i))
    expect(screen.queryByRole('button', { name: 'Ours (recomputed)' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Deposited pathway sheets' })).toBeNull()
  })

  it('exports the exact same source/load reading used by the heatmap', () => {
    expect(extraCostValue(row, 'pdf', 'minimum')).toBe(13202)
    expect(extraCostValue(row, 'pdf', 'standard')).toBe(10562)
    expect(extraCostValue(row, 'archive-detail', 'minimum')).toBe(12000)
    expect(extraCostValue(row, 'archive-detail', 'standard')).toBe(9600)
    expect(extraCostValue(row, 'ours', 'minimum')).toBe(10000)
    expect(extraCostEntries({ rows: [row] }, 'archive-detail', 'minimum')).toEqual([{
      rowKey: 'Berkshire Community College',
      rowLabel: 'Berkshire Community College',
      colKey: 'MCLA',
      colLabel: 'MCLA',
      value: 12000,
    }])
    expect(extraCostEntries({ rows: [{
      ...row, published_pdf_extra_cost_usd: null,
    }] }, 'archive-detail', 'minimum')).toEqual([])
    expect(extraCostEntries({ rows: [row] }, 'ours', 'standard')).toEqual([{
      rowKey: 'Berkshire Community College',
      rowLabel: 'Berkshire Community College',
      colKey: 'MCLA',
      colLabel: 'MCLA',
      value: 8000,
    }])
  })

  it('prices the 49 deposited Figure 4 cells with the recovered paper rates', () => {
    // Exact rates recovered from the deposited cost tab. The final PDF rounds
    // heatmap dollars to whole numbers, so a $1 tolerance absorbs two harmless
    // half-dollar display differences while retaining the 13 Figure 4 changes.
    const annualCharge = {
      Bridgewater: 11734.08,
      Fitchburg: 11346,
      Framingham: 11920.08,
      MCLA: 12186,
      Salem: 12338.4,
      'UMass Amherst': 17772,
      'UMass Boston': 16693.92,
      'UMass Dartmouth': 15612,
      'UMass Lowell': 16966.08,
      Westfield: 12364.08,
      Worcester: 11785.92,
    }
    const ledger = new Map(maFigureLedgers.fig4.cells.map((cell) => [cell.pair, cell]))
    const rows = Object.entries(maPdfFigures.fig5_extra_cost.cells).flatMap(([college, campuses]) => (
      Object.entries(campuses).map(([school, publishedCost]) => {
        const archive = ledger.get(`${school} × ${college}`)
        return {
          college_name: college,
          school,
          archived_pathway_sheet_extra_hours:
            Math.max(0, archive.archive_pathway_sheet_sum - 120),
          tuition_annual_resident_usd: annualCharge[school],
          published_pdf_extra_cost_usd: publishedCost,
        }
      })
    ))
    const rerun = rows.map((entry) => extraCostValue(entry, 'archive-detail', 'minimum'))
    const disagreements = rows.filter((entry) => (
      Math.abs(extraCostValue(entry, 'archive-detail', 'minimum')
        - entry.published_pdf_extra_cost_usd) > 1
    ))

    expect(rows).toHaveLength(49)
    expect(disagreements).toHaveLength(13)
    expect(rerun.reduce((sum, value) => sum + value, 0) / rerun.length)
      .toBeCloseTo(8572.16, 2)
  })

  it('does not overclaim provenance when a campus rate has no source metadata', () => {
    mockRate.mockReturnValue({ ...query(), data: { rows: [{ ...row, tuition_source: null }] } })
    render(<TransferExtraCost />)
    expect(screen.getByText(/Rate source and price-year metadata are not recorded for 1 campus/i))
      .toBeInTheDocument()
    expect(screen.getByLabelText(/Rate source metadata is not recorded on the campus row/i))
      .toBeInTheDocument()
  })
})
