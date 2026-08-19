import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DistributionReceipt from './DistributionReceipt'
import { compareDistributions } from './delta'

const cell = (row, col, label, value) => ({
  rowKey: row, rowLabel: row, colKey: col, colLabel: label, value,
})

describe('DistributionReceipt', () => {
  it('shows per-category populations without a pooled headline when the contract forbids pooling', () => {
    const distribution = compareDistributions(
      [
        cell('ma-1', 'computing', 'Computing', 10),
        cell('ma-2', 'computing', 'Computing', 30),
        cell('ma-1', 'non-stem', 'Non-STEM', 80),
      ],
      [
        cell('ca-1', 'computing', 'Computing', 30),
        cell('ca-1', 'non-stem', 'Non-STEM', 40),
        cell('ca-2', 'non-stem', 'Non-STEM', 60),
      ],
      { groupBy: 'column', label: 'course type', pooled: false },
    )

    render(<DistributionReceipt distribution={distribution}
      baselineLabel='Massachusetts' subjectLabel='California'
      contract={{ unit: 'percentage points', grain: 'campus × course type' }} />)

    expect(screen.getByText(/reported separately by course type/i)).toBeInTheDocument()
    expect(screen.getByText(/no pooled delta is calculated/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Computing' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Non-STEM' })).toBeInTheDocument()
    expect(screen.queryByText('Pooled equal-cell summary')).toBeNull()
    expect(screen.getAllByText('Massachusetts')).toHaveLength(2)
    expect(screen.getAllByText('California')).toHaveLength(2)
  })
})
