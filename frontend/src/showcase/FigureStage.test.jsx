import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../analyses/registry', () => ({
  getAnalysisById: (id) => ({ id, Component: () => <div>{`Live ${id} embed`}</div> }),
}))

import FigureStage, { STAGE_ENTRIES } from './FigureStage'

const noop = () => {}

describe('figure stage', () => {
  it('orders the four ported figures ahead of the three findings', () => {
    expect(STAGE_ENTRIES.map((e) => e.entryKind)).toEqual([
      'figure', 'figure', 'figure', 'figure', 'finding', 'finding', 'finding',
    ])
  })

  it('embeds the live figure inline when the analysis is released', () => {
    render(<FigureStage activeId={STAGE_ENTRIES[0].id} onSelect={noop}
      onOpen={noop} canOpenAnalysis={() => true} />)
    expect(screen.getByText('Live paper-district-heatmap embed')).toBeInTheDocument()
    expect(screen.getAllByText(/After the Massachusetts paper/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('356 of 648').length).toBeGreaterThan(0)
  })

  it('falls back to the frozen panel when the analysis is not released', () => {
    render(<FigureStage activeId={STAGE_ENTRIES[0].id} onSelect={noop}
      onOpen={noop} canOpenAnalysis={() => false} />)
    expect(screen.queryByText('Live paper-district-heatmap embed')).not.toBeInTheDocument()
    expect(screen.getAllByText(/not released for this account/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('356 of 648').length).toBeGreaterThan(0)
  })

  it('switches entries from the rail and keeps finding previews clickable', () => {
    const onSelect = vi.fn()
    const onOpen = vi.fn()
    const findingEntry = STAGE_ENTRIES.find((e) => e.entryKind === 'finding')
    const { rerender } = render(<FigureStage activeId={STAGE_ENTRIES[0].id}
      onSelect={onSelect} onOpen={onOpen} canOpenAnalysis={() => true} />)

    fireEvent.click(screen.getByRole('button', { name: new RegExp(findingEntry.title.slice(0, 30)) }))
    expect(onSelect).toHaveBeenCalledWith(findingEntry.id)

    rerender(<FigureStage activeId={findingEntry.id} onSelect={onSelect}
      onOpen={onOpen} canOpenAnalysis={() => true} />)
    fireEvent.click(screen.getByRole('button', {
      name: `${findingEntry.actionLabel}: ${findingEntry.title}`,
    }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: findingEntry.id }))
  })
})
