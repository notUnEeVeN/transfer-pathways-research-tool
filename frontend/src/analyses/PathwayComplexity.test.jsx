import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PathwayComplexity from './PathwayComplexity'
import { paperDivergingCellColor } from './maHeatmapColors'
import { usePathwayComplexity } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ usePathwayComplexity: vi.fn() }))

const loaded = (data) => ({ data, isLoading: false, isError: false })

describe('PathwayComplexity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders only scored live pathways, reports exclusions, and opens on A.S.-T', () => {
    usePathwayComplexity.mockReturnValue(loaded({
      degree_type: 'ast',
      model_version: 'v3',
      source_cohort: {
        degree_documents_total: 69,
        degree_documents_verified: 29,
        degree_documents_included: 29,
        unverified_degree_documents_omitted: 40,
        omitted_unverified_degree_documents: [{
          record_id: 'as_degree:51:cs:ast', community_college_id: 51,
          college_name: 'Foothill College',
        }],
      },
      exclusions: { degree_count: 1, pathway_count: 1 },
      rows: [
        {
          school_id: 1, school: 'UC Example', community_college_id: 10,
          college_name: 'Alpha College', complexity: 120,
          resident_complexity: 100, delta_vs_resident: 20, edge_info_pct: 80,
          record_id: 'as:alpha', source_verified: true,
          source_analysis_ready: true, source_catalog_year: '2025-26',
          n_courses: 30, n_edges: 18, n_placeholder: 2,
          as_courses: 10, as_selected_units: 60, requirements_consumed: 7,
        },
        {
          school_id: 1, school: 'UC Example', community_college_id: 11,
          college_name: 'Beta College', complexity: 90,
          resident_complexity: 100, delta_vs_resident: -10, edge_info_pct: 60,
        },
        {
          school_id: 1, school: 'UC Example', community_college_id: 12,
          college_name: 'Ambiguous College', record_id: 'as_degree:12:cs:ast',
          method_status: 'excluded', exclusion_reason: 'ambiguous_named_unit_pool',
          delta_vs_resident: null,
        },
      ],
    }))

    render(<PathwayComplexity majorSlug='cs' degreeAnalysisSlots={['local_as', 'ast']} />)
    expect(usePathwayComplexity).toHaveBeenLastCalledWith({
      majorSlug: 'cs', degreeType: 'ast', verifiedOnly: true,
    })
    // Matrix chrome: college rows, campus column, Average row.
    expect(screen.getByText('Community college')).toBeInTheDocument()
    expect(screen.getByText('Alpha College')).toBeInTheDocument()
    expect(screen.getByText('Beta College')).toBeInTheDocument()
    // Cell values also appear in the single-column Average cells, so assert
    // presence rather than uniqueness.
    expect(screen.getAllByText('+20').length).toBeGreaterThan(0)
    expect(screen.getAllByText('−10').length).toBeGreaterThan(0)
    // Overall mean (20 − 10) / 2 = +5 appears in the headline and the corner.
    expect(screen.getAllByText('+5').length).toBeGreaterThan(0)
    // Technical provenance remains in the method note instead of a wall of
    // badges above the matrix.
    expect(screen.queryByText('2 pathways')).not.toBeInTheDocument()
    expect(screen.queryByText('70% mean prerequisite-status coverage')).not.toBeInTheDocument()
    expect(screen.queryByText('1 degree templates excluded')).not.toBeInTheDocument()
    expect(screen.queryByText('29 of 69 source degrees verified · 29 included')).not.toBeInTheDocument()
    expect(screen.getByText(/Verified-only view\. Foothill College/))
      .toHaveTextContent(/use All sourced programs/i)
    expect(screen.getByRole('button', { name: 'Verified programs only' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/Alpha College → UC Example/))
      .toHaveAttribute('aria-label', expect.stringMatching(/30 vertices · 18 prerequisite edges · 2 placeholders/))
    expect(screen.getByLabelText(/Alpha College → UC Example/))
      .toHaveAttribute('aria-label', expect.stringMatching(/10 selected courses · 60 selected units/))
    expect(screen.getByLabelText(/Alpha College → UC Example/))
      .toHaveAttribute('aria-label', expect.stringMatching(/Associate-degree source: human-verified · catalog 2025-26/))
    expect(screen.queryByText('Ambiguous College')).not.toBeInTheDocument()
  })

  it('persists a reader-selected live degree cohort through the query and callback', () => {
    const onViewChange = vi.fn()
    usePathwayComplexity.mockReturnValue(loaded({
      rows: [{
        school: 'UC Example', college_name: 'Alpha College', complexity: 120,
        resident_complexity: 100, delta_vs_resident: 20, edge_info_pct: 80,
      }],
    }))

    render(<PathwayComplexity majorSlug='cs' majorLabel='Computer Science'
      degreeAnalysisSlots={['local_as', 'ast']} onViewChange={onViewChange} />)
    const local = screen.getByRole('button', { name: /Local.*A\.S\./i })
    fireEvent.click(local)

    expect(usePathwayComplexity).toHaveBeenLastCalledWith({
      majorSlug: 'cs', degreeType: 'local_as', verifiedOnly: true,
    })
    expect(onViewChange).toHaveBeenLastCalledWith({
      defaultPaperView: 'published', defaultDegreeType: 'local_as',
      defaultVerifiedOnly: true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'All sourced programs' }))
    expect(usePathwayComplexity).toHaveBeenLastCalledWith({
      majorSlug: 'cs', degreeType: 'local_as', verifiedOnly: false,
    })
    expect(onViewChange).toHaveBeenLastCalledWith({
      defaultPaperView: 'published', defaultDegreeType: 'local_as',
      defaultVerifiedOnly: false,
    })
  })

  it('warns explicitly when unverified live sources are included', () => {
    usePathwayComplexity.mockReturnValue(loaded({
      model_version: 'v3',
      source_cohort: {
        degree_documents_total: 69,
        degree_documents_verified: 29,
        degree_documents_included: 69,
        unverified_degree_documents_omitted: 0,
      },
      rows: [{
        school: 'UC Example', college_name: 'Alpha College', complexity: 120,
        resident_complexity: 100, delta_vs_resident: 20, edge_info_pct: 80,
        source_verified: false,
      }],
    }))

    render(<PathwayComplexity defaultVerifiedOnly={false} />)
    expect(screen.getByText(/Exploratory view\./).closest('p'))
      .toHaveTextContent('29 of 69 are human-verified')
    expect(screen.queryByText('29 of 69 source degrees verified · 69 included'))
      .not.toBeInTheDocument()
  })

  it('uses and exports one symmetric Comparison color domain without changing values', () => {
    usePathwayComplexity.mockReturnValue(loaded({
      rows: [{
        school: 'UC Example', college_name: 'Alpha College', complexity: 120,
        resident_complexity: 100, delta_vs_resident: 20, edge_info_pct: 80,
      }],
    }))
    const scale = {
      maxAbs: 40, min: -40, mid: 0, max: 40, comparisonShared: true,
    }
    const { container } = render(<PathwayComplexity comparisonColorScale={scale} />)
    const exportRoot = container.querySelector('[data-export-root]')

    expect(within(exportRoot).getByText(
      'Shared comparison color domain: −40–+40 score points'
    )).toBeInTheDocument()
    expect(screen.getByLabelText(/Alpha College → UC Example/))
      .toHaveStyle({ backgroundColor: paperDivergingCellColor(20, scale).backgroundColor })
    expect(screen.getAllByText('+20').length).toBeGreaterThan(0)
  })

  it('opens Massachusetts on the final paper and offers only our recalculation', () => {
    usePathwayComplexity.mockReturnValue(loaded({
      mode: 'paper',
      final_pdf: { cells: {
        'Cape Cod': { Bridgewater: -47 },
        Bristol: { 'UMass Dartmouth': -32 },
        'Springfield Technical': { 'UMass Amherst': -28 },
      } },
      artifact_differences: [
        {
          uni: 'UMass Dartmouth', cc: 'Bristol', final_pdf_delta: -32,
          archived_tab_delta: -32, recomputed_archive_delta: -28,
          classification: 'recomputed_archive_vs_archived_tab',
        },
        {
          uni: 'UMass Amherst', cc: 'Springfield Technical', final_pdf_delta: -28,
          archived_tab_delta: 34, recomputed_archive_delta: 34,
          classification: 'final_pdf_vs_archived_tab',
        },
      ],
      pathways: [
        { pathway: 'Bridgewater (resident)', uni: 'Bridgewater', cc: null, ours: 160, theirs: 160 },
        { pathway: 'Bridgewater x Cape Cod', uni: 'Bridgewater', cc: 'Cape Cod', ours: 113, theirs: 113 },
        { pathway: 'Bridgewater x Massasoit', uni: 'Bridgewater', cc: 'Massasoit', ours: 200, theirs: 200 },
        { pathway: 'UMass Dartmouth (resident)', uni: 'UMass Dartmouth', cc: null, ours: 202, theirs: 202 },
        { pathway: 'UMass Dartmouth x Bristol', uni: 'UMass Dartmouth', cc: 'Bristol', ours: 174, theirs: 170 },
        { pathway: 'UMass Amherst (resident)', uni: 'UMass Amherst', cc: null, ours: 185, theirs: 185 },
        { pathway: 'UMass Amherst x Springfield Technical', uni: 'UMass Amherst', cc: 'Springfield Technical', ours: 219, theirs: 219 },
      ],
    }))

    render(<PathwayComplexity majorSlug='ma-cs' degreeAnalysisSlots={['local_as']} />)
    expect(usePathwayComplexity).toHaveBeenLastCalledWith({
      majorSlug: 'ma-cs', degreeType: 'local_as', verifiedOnly: true,
    })
    expect(screen.queryByText('artifact reconciliation')).not.toBeInTheDocument()
    expect(screen.queryByText('Associate-degree evidence')).toBeNull()
    expect(screen.getByText('Cape Cod')).toBeInTheDocument()
    expect(screen.getByText('Bristol')).toBeInTheDocument()

    // Default view is a literal read of the final PDF matrix.
    expect(screen.getAllByText('−47').length).toBeGreaterThan(0)
    expect(screen.getByText('−32*')).toBeInTheDocument()
    expect(screen.getByText('−28*')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Our recalculation' }))
    expect(screen.getAllByText('−47').length).toBeGreaterThan(0)
    expect(screen.getByText('−28*')).toBeInTheDocument()
    expect(screen.getByText('+34*')).toBeInTheDocument()
    expect(screen.queryByText('Massasoit')).not.toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Recomputed − PDF' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Recomputed archive' })).toBeNull()
    expect(screen.getByLabelText(/Bristol → UMass Dartmouth/))
      .toHaveAttribute('aria-label', expect.stringMatching(/Final paper: −32.*Our recalculation: 174.*Difference: \+4 points/s))
  })

  it('fails closed when every live degree is excluded', () => {
    usePathwayComplexity.mockReturnValue(loaded({
      exclusions: { degree_count: 1, pathway_count: 9 },
      rows: Array.from({ length: 9 }, (_, school_id) => ({
        school_id, school: `UC ${school_id}`, college_name: 'Ambiguous College',
        record_id: 'as_degree:1:cs:ast', method_status: 'excluded',
        exclusion_reason: 'ambiguous_named_unit_pool', delta_vs_resident: null,
      })),
    }))

    render(<PathwayComplexity majorSlug='cs' />)
    expect(screen.getByText(/No pathways were scored\. 1 degree template was excluded/)).toBeInTheDocument()
  })

  it('reports an empty live corpus without borrowing paper chrome', () => {
    usePathwayComplexity.mockReturnValue(loaded({ rows: [] }))

    render(<PathwayComplexity majorSlug='va-cs' />)
    expect(screen.getByText('No pathways to score for this major yet.')).toBeInTheDocument()
    expect(screen.queryByText('artifact reconciliation')).not.toBeInTheDocument()
  })

  it('keeps the all-source sensitivity reachable when the verified cohort is empty', () => {
    usePathwayComplexity.mockReturnValue(loaded({
      source_cohort: {
        degree_documents_total: 3,
        degree_documents_verified: 0,
        degree_documents_included: 0,
        unverified_degree_documents_omitted: 3,
      },
      rows: [],
    }))

    render(<PathwayComplexity majorSlug='bio' />)
    expect(screen.getByText(/No human-verified source degrees produce a scored pathway/))
      .toHaveTextContent('3 unverified source documents are omitted')
    fireEvent.click(screen.getByRole('button', { name: 'All sourced programs' }))
    expect(usePathwayComplexity).toHaveBeenLastCalledWith({
      majorSlug: 'bio', degreeType: 'ast', verifiedOnly: false,
    })
  })
})
