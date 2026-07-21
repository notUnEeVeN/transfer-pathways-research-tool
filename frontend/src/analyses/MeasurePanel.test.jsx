import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MeasurePanel from './MeasurePanel'
import { measureFor } from './measures'

describe('measure panel', () => {
  it('states the arithmetic, the grain, and the caveat for a figure', () => {
    render(<MeasurePanel measure={measureFor('coverage-heatmap')} />)

    expect(screen.getByText('How this is measured')).toBeInTheDocument()
    expect(screen.getByText(/modeled graduation units with a community college equivalent/)).toBeInTheDocument()
    expect(screen.getByText(/One value per community college × UC program/)).toBeInTheDocument()
    expect(screen.getByText(/cannot reach 100%/)).toBeInTheDocument()
  })

  it('renders nothing when a figure has no definition', () => {
    const { container } = render(<MeasurePanel measure={measureFor('no-such-figure')} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('forwards the export-exclude marker so downloads stay figure-only', () => {
    const { container } = render(
      <MeasurePanel measure={measureFor('credit-loss')} data-export-exclude />
    )
    expect(container.querySelector('[data-export-exclude]')).not.toBeNull()
  })
})
