import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PathwayComplexity from './PathwayComplexity'
import { usePathwayComplexity } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ usePathwayComplexity: vi.fn() }))

const loaded = (data) => ({ data, isLoading: false, isError: false })

describe('PathwayComplexity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the live corpus as the paper-style delta matrix', () => {
    usePathwayComplexity.mockReturnValue(loaded({
      rows: [
        {
          school_id: 1, school: 'UC Example', community_college_id: 10,
          college_name: 'Alpha College', complexity: 120,
          resident_complexity: 100, delta_vs_resident: 20, edge_info_pct: 80,
        },
        {
          school_id: 1, school: 'UC Example', community_college_id: 11,
          college_name: 'Beta College', complexity: 90,
          resident_complexity: 100, delta_vs_resident: -10, edge_info_pct: 60,
        },
      ],
    }))

    render(<PathwayComplexity majorSlug='cs' />)
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
    expect(screen.getByText('2 pathways')).toBeInTheDocument()
    expect(screen.getByText('70% edge data')).toBeInTheDocument()
  })

  it('opens the Massachusetts corpus on the printed figure and toggles to the recomputation', () => {
    // Fixture: the Bridgewater resident score drifted (published 160, sheet
    // computes 164) and so did the Bristol pair (186 vs 190). Cape Cod's own
    // scores agree — but its PUBLISHED delta still disagrees with ours
    // because the resident anchor drifted: 180−160=+20 printed vs
    // 180−164=+16 recomputed. Bristol's deltas coincide (+26 both) because
    // its pair and resident drifts cancel.
    // Salem's scores agree everywhere (tab delta +12), but the FIGURE prints
    // −3 for its cell — the figure_cell_misses override: the published view
    // must show the figure as printed, flagged.
    usePathwayComplexity.mockReturnValue(loaded({
      mode: 'paper',
      headline_plus_15: { over_scored_pathways: 15.94, over_all_pathways: 10.34 },
      misses: [
        { pathway: 'Bridgewater (resident)', ours: 164, theirs: 160 },
        { pathway: 'Bridgewater x Bristol', ours: 190, theirs: 186 },
      ],
      figure_cell_misses: [
        { uni: 'Salem', cc: 'North Shore', printed_delta: -3, tab_delta: 12 },
      ],
      pathways: [
        { pathway: 'Bridgewater (resident)', uni: 'Bridgewater', cc: null, ours: 164, theirs: 160 },
        { pathway: 'Bridgewater x Cape Cod', uni: 'Bridgewater', cc: 'Cape Cod', ours: 180, theirs: 180 },
        { pathway: 'Bridgewater x Bristol', uni: 'Bridgewater', cc: 'Bristol', ours: 190, theirs: 186 },
        { pathway: 'Salem (resident)', uni: 'Salem', cc: null, ours: 140, theirs: 140 },
        { pathway: 'Salem x North Shore', uni: 'Salem', cc: 'North Shore', ours: 152, theirs: 152 },
      ],
    }))

    render(<PathwayComplexity majorSlug='ma-cs' />)
    expect(screen.getByText('paper reproduction')).toBeInTheDocument()
    expect(screen.getByText('Cape Cod')).toBeInTheDocument()
    expect(screen.getByText('Bristol')).toBeInTheDocument()

    // Default view: the paper as printed. +20 flagged (resident drift), +26
    // not; North Shore shows the FIGURE's own −3 rather than the tab's +12.
    expect(screen.getByText('+20*')).toBeInTheDocument()
    expect(screen.getAllByText('+26').length).toBeGreaterThan(0)
    expect(screen.getByText('−3*')).toBeInTheDocument()
    expect(screen.getByText(/published 160, their sheet computes 164/)).toBeInTheDocument()
    expect(screen.getByText(/North Shore × Salem prints −3 though their own complexity tab computes \+12/)).toBeInTheDocument()

    // Our recomputation of the same matrix.
    fireEvent.click(screen.getByRole('button', { name: 'Ours (recomputed)' }))
    expect(screen.getByText('+16*')).toBeInTheDocument()
    expect(screen.getAllByText('+26').length).toBeGreaterThan(0)
    expect(screen.getByText('+12*')).toBeInTheDocument()

    // The difference view isolates the disagreement: −4 where the printed
    // delta overstates, +15 against the figure-typed cell, +0 where figure
    // and files agree.
    fireEvent.click(screen.getByRole('button', { name: 'Difference' }))
    expect(screen.getByText('−4*')).toBeInTheDocument()
    expect(screen.getByText('+15*')).toBeInTheDocument()
    expect(screen.getAllByText('+0').length).toBeGreaterThan(0)
  })

  it('reports an empty live corpus without borrowing paper chrome', () => {
    usePathwayComplexity.mockReturnValue(loaded({ rows: [] }))

    render(<PathwayComplexity majorSlug='va-cs' />)
    expect(screen.getByText('No pathways to score for this major yet.')).toBeInTheDocument()
    expect(screen.queryByText('paper reproduction')).not.toBeInTheDocument()
  })
})
