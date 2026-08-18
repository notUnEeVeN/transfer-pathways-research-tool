import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BREAKDOWNS, breakdownFor, getBreakdown } from './registry'
import MaComplexityFigure6 from './MaComplexityFigure6'
import { joinCells } from '../delta'

vi.mock('../../shared/query/hooks/useData', () => ({
  usePathwayComplexity: () => ({ data: PAPER_DATA, isLoading: false, isError: false }),
}))

// A miniature of the real Massachusetts payload: one drifted resident score
// (Bridgewater, published 160 vs the 164 their sheet computes) and one cell
// the printed figure contradicts its own tab on.
const PAPER_DATA = {
  mode: 'paper',
  headline_plus_15: { over_scored_pathways: 15.94, over_all_pathways: 10.34 },
  misses: [{ pathway: 'Bridgewater (resident)', ours: 164, theirs: 160 }],
  figure_cell_misses: [{ cc: 'North Shore', uni: 'Salem', printed_delta: -3, tab_delta: 12 }],
  pathways: [
    { pathway: 'Bridgewater (resident)', uni: 'Bridgewater', cc: null, ours: 164, theirs: 160 },
    { pathway: 'Bridgewater x Cape Cod', uni: 'Bridgewater', cc: 'Cape Cod', ours: 180, theirs: 180 },
    { pathway: 'Salem (resident)', uni: 'Salem', cc: null, ours: 140, theirs: 140 },
    { pathway: 'Salem x North Shore', uni: 'Salem', cc: 'North Shore', ours: 152, theirs: 152 },
  ],
}

const PANES = [
  { id: 'p1', figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'published' }, label: 'Paper (published)' },
  { id: 'p2', figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'ours' }, label: 'Ours (recomputed)' },
]

const cell = (row, col, value) => ({
  rowKey: row, rowLabel: row, colKey: col, colLabel: col, value,
})

// Published minus resident vs recomputed minus resident, for the two pairs
// above: Cape Cod +20 printed against +16 recomputed, North Shore the
// figure-typed -3 against +12.
const JOIN = joinCells(
  [cell('Cape Cod', 'Bridgewater', 20), cell('North Shore', 'Salem', -3)],
  [cell('Cape Cod', 'Bridgewater', 16), cell('North Shore', 'Salem', 12)],
)

describe('breakdown registry', () => {
  it('matches the Massachusetts Figure 6 pairing and nothing else', () => {
    const analysis = { id: 'pathway-complexity' }
    expect(breakdownFor(PANES, analysis)?.id).toBe('ma-complexity-figure-6')

    expect(breakdownFor([
      { ...PANES[0], major: 'cs' }, { ...PANES[1], major: 'cs' },
    ], analysis)).toBeNull()
    expect(breakdownFor([
      { id: 'p1', figure: 'coverage-heatmap', major: 'ma-cs' },
      { id: 'p2', figure: 'coverage-heatmap', major: 'ma-cs' },
    ], { id: 'coverage-heatmap' })).toBeNull()
  })

  it('resolves an explicit id and returns null for an unknown one', () => {
    expect(getBreakdown('ma-complexity-figure-6')?.id).toBe('ma-complexity-figure-6')
    expect(getBreakdown('not-a-breakdown')).toBeNull()
    expect(BREAKDOWNS.every((entry) => entry.id && entry.title && entry.Component)).toBe(true)
  })
})

// The workspace anchors a note to the cell object the breakdown hands back.
// ComparePage.test.jsx stubs the breakdown registry wholesale, so this is the
// only place the real contract between the two is exercised.
describe('MaComplexityFigure6 cell selection', () => {
  function Harness() {
    const [selected, setSelected] = useState(null)
    return (
      <>
        <div data-testid='anchor'>
          {selected && typeof selected === 'object'
            ? `${selected.rowLabel} × ${selected.colLabel}`
            : 'none'}
        </div>
        <MaComplexityFigure6 panes={PANES} comparison={{ baseline_pane: 'p1' }}
          join={JOIN} selectedCell={selected?.key ?? null} onSelectCell={setSelected} />
      </>
    )
  }

  it('hands the workspace a whole cell on expand and null on collapse', () => {
    render(<Harness />)
    expect(screen.getByTestId('anchor')).toHaveTextContent('none')

    // Ranked by |Δ|: North Shore × Salem (15) leads Cape Cod × Bridgewater (4).
    const row = screen.getAllByRole('button').find((b) => /North Shore/.test(b.textContent))
    fireEvent.click(row)
    expect(screen.getByTestId('anchor')).toHaveTextContent('North Shore × Salem')

    fireEvent.click(row)
    expect(screen.getByTestId('anchor')).toHaveTextContent('none')
  })

  it('leads with the largest disagreement and counts them', () => {
    render(<Harness />)
    expect(screen.getByText(/2 of 2 cells disagree/)).toBeInTheDocument()
  })
})
