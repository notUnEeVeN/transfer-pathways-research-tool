import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BREAKDOWNS, breakdownFor, getBreakdown } from './registry'
import MaTransferCreditFigure3 from './MaTransferCreditFigure3'
import MaExtraUnitsFigure4 from './MaExtraUnitsFigure4'
import { joinCells } from '../delta'

const FIG3_PANES = [
  {
    id: 'p1', figure: 'transfer-credit-rate', major: 'ma-cs',
    knobs: { source: 'pdf' }, label: 'Final paper',
  },
  {
    id: 'p2', figure: 'transfer-credit-rate', major: 'ma-cs',
    knobs: { source: 'archive-gray-detail' }, label: 'Our recalculation',
  },
]

const FIG4_PANES = [
  {
    id: 'p1', figure: 'transfer-extra-units', major: 'ma-cs',
    knobs: { degree: 'local_as', source: 'pdf' }, label: 'Final paper',
  },
  {
    id: 'p2', figure: 'transfer-extra-units', major: 'ma-cs',
    knobs: { degree: 'local_as', source: 'archive-detail' }, label: 'Our recalculation',
  },
]

const cell = (row, col, value) => ({
  rowKey: row, rowLabel: row, colKey: col, colLabel: col, value,
})

describe('breakdown registry', () => {
  it('registers only the two material Massachusetts audit breakdowns', () => {
    expect(BREAKDOWNS.map((entry) => entry.id)).toEqual([
      'ma-transfer-credit-figure-3',
      'ma-extra-units-figure-4',
    ])
    expect(getBreakdown('ma-transfer-credit-figure-3')?.Component)
      .toBe(MaTransferCreditFigure3)
    expect(getBreakdown('ma-extra-units-figure-4')?.Component)
      .toBe(MaExtraUnitsFigure4)
    expect(getBreakdown('ma-coverage-figure-1')).toBeNull()
    expect(getBreakdown('ma-course-type-figure-2')).toBeNull()
    expect(getBreakdown('ma-complexity-figure-6')).toBeNull()
    expect(getBreakdown('not-a-breakdown')).toBeNull()
  })

  it('matches only the exact Figure 3 final-paper/direct-recalculation pair', () => {
    expect(breakdownFor(FIG3_PANES)?.id).toBe('ma-transfer-credit-figure-3')
    expect(breakdownFor([...FIG3_PANES].reverse())?.id).toBe('ma-transfer-credit-figure-3')

    expect(breakdownFor([
      FIG3_PANES[0],
      { ...FIG3_PANES[1], major: 'cs' },
    ])).toBeNull()
    expect(breakdownFor([
      FIG3_PANES[0],
      { ...FIG3_PANES[1], knobs: { source: 'pdf' } },
    ])).toBeNull()
    expect(breakdownFor([
      FIG3_PANES[0],
      { ...FIG3_PANES[1], knobs: { source: 'ours' } },
    ])).toBeNull()
  })

  it('matches only local-AS Figure 4 final-paper/direct-recalculation panes', () => {
    expect(breakdownFor(FIG4_PANES)?.id).toBe('ma-extra-units-figure-4')
    expect(breakdownFor([...FIG4_PANES].reverse())?.id).toBe('ma-extra-units-figure-4')

    expect(breakdownFor([
      FIG4_PANES[0],
      { ...FIG4_PANES[1], knobs: { degree: 'local_as', source: 'ours' } },
    ])).toBeNull()
    expect(breakdownFor([
      FIG4_PANES[0],
      { ...FIG4_PANES[1], knobs: { degree: 'ast', source: 'archive-detail' } },
    ])).toBeNull()
  })
})

describe('MaTransferCreditFigure3 reconciliation', () => {
  // The constructed pane payload has the audited totals: final-paper integer
  // cells sum to 4,132; the recalculation sums to a 64.682% mean. Forty-two
  // recalculated values round to their paper cells and nineteen do not.
  const pdf = [
    ...Array.from({ length: 60 }, (_, index) => cell(`College ${index}`, 'Campus', 68)),
    cell('College 60', 'Campus', 52),
  ]
  const unmatchedValue = ((64.682 * 61) - (42 * 68)) / 19
  const recalculated = pdf.map((entry, index) => ({
    ...entry,
    value: index < 42 ? 68 : unmatchedValue,
  }))
  const joined = joinCells(pdf, recalculated, { tolerance: 0.05 })

  it('derives the printed-precision count and both means from pane cells', () => {
    render(<MaTransferCreditFigure3 panes={FIG3_PANES}
      comparison={{ baseline_pane: 'p1' }} delta={joined} />)

    expect(screen.getByText(/42 of 61 reproduce at paper whole-% precision/))
      .toBeInTheDocument()
    expect(screen.getByText(/19 recalculation differences/)).toBeInTheDocument()
    expect(screen.getByText('67.738%')).toBeInTheDocument()
    expect(screen.getByText('64.682%')).toBeInTheDocument()
    expect(screen.getByText(/potential paper errors or unprovided/)).toBeInTheDocument()
  })

  it('states the four explanation patterns as overlapping questions', () => {
    render(<MaTransferCreditFigure3 panes={FIG3_PANES}
      comparison={{ baseline_pane: 'p1' }} delta={joined} />)

    expect(screen.getByText(/Nine coordinated Figure 3\/Figure 4 changes/))
      .toBeInTheDocument()
    expect(screen.getByText(/Selective blue-credit and cap patterns/)).toBeInTheDocument()
    expect(screen.getByText(/Two possible stale 63-credit denominators/)).toBeInTheDocument()
    expect(screen.getByText(/Four unresolved cells/)).toBeInTheDocument()
    expect(screen.getByText(/These clues overlap/)).toBeInTheDocument()
    expect(screen.getByText(/do not turn any value into a proven error/)).toBeInTheDocument()
  })
})

describe('MaExtraUnitsFigure4 reconciliation', () => {
  const pathCell = (college, university, value) => cell(college, university, value)
  const pdf = [
    pathCell('Quinsigamond', 'Fitchburg', 0),
    ...Array.from({ length: 4 }, (_, index) => pathCell(`Fitchburg row ${index}`, 'Fitchburg', 0)),
    pathCell('Bunker Hill', 'UMass Boston', 6),
    pathCell('MassBay', 'UMass Boston', 7),
    ...Array.from({ length: 3 }, (_, index) => pathCell(`Boston row ${index}`, 'UMass Boston', 0)),
    ...[35, 35, 35, 35, 35, 34].map((value, index) => pathCell(`Framingham row ${index}`, 'Framingham', value)),
    ...[6, 0, 0, 0, 0].map((value, index) => pathCell(`Small row ${index}`, 'Small university', value)),
    ...Array.from({ length: 28 }, (_, index) => (
      pathCell(`Other row ${index}`, 'Other university', index < 10 ? 0 : 10)
    )),
  ]
  const recalculated = pdf.map((entry) => ({ ...entry }))
  recalculated.find((entry) => entry.rowKey === 'Quinsigamond').value = 1
  recalculated.find((entry) => entry.rowKey === 'Bunker Hill').value = 0
  recalculated.find((entry) => entry.rowKey === 'MassBay').value = 31
  for (let index = 0; index < 10; index += 1) {
    recalculated.find((entry) => entry.rowKey === `Other row ${index}`).value = 2
  }
  const joined = joinCells(pdf, recalculated, { tolerance: 0.1 })

  it('keeps all 13 recalculation differences primary and classifications secondary', () => {
    render(<MaExtraUnitsFigure4 panes={FIG4_PANES}
      comparison={{ baseline_pane: 'p1' }} delta={joined} />)

    expect(screen.getByText(/36 of 49 cells reproduce/)).toBeInTheDocument()
    expect(screen.getByText(/13 recalculation differences/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /UMass Boston × Bunker Hill.*Final paper \+6.*our recalculation \+0/i }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: /UMass Boston × MassBay.*Final paper \+7.*our recalculation \+31/i }))
      .toBeInTheDocument()
    expect(screen.getByText(/All 13 values above remain recalculation differences/i))
      .toBeInTheDocument()
    expect(screen.getByText(/potential error or an unexplained final-input revision/i))
      .toBeInTheDocument()
  })
})
