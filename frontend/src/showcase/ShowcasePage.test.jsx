import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const visualAccess = vi.hoisted(() => ({
  role: 'admin',
  releasedIds: [],
  disabledIds: [],
}))

vi.mock('../shared/query/hooks/useAccess', () => ({
  useAccessMe: () => ({ data: { role: visualAccess.role } }),
  useVisualSettings: () => ({
    data: { released_ids: visualAccess.releasedIds, disabled_ids: visualAccess.disabledIds },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('../analyses/registry', () => ({
  getAnalysisById: (id) => ({
    id,
    Component: () => <div>{`Live ${id} visual`}</div>,
  }),
}))

import ShowcasePage from './ShowcasePage'

const originalScrollTo = window.scrollTo

beforeAll(() => {
  window.scrollTo = vi.fn()
})

beforeEach(() => {
  visualAccess.role = 'admin'
  visualAccess.releasedIds = []
  visualAccess.disabledIds = []
})

afterAll(() => {
  window.scrollTo = originalScrollTo
})

describe('research showcase', () => {
  it('presents a dated, plain-language research story without contributor controls', () => {
    render(<ShowcasePage />)

    expect(screen.getByRole('heading', {
      name: 'How much of a community college pathway carries into a UC degree?',
    })).toBeInTheDocument()
    expect(screen.getAllByText('July 20, 2026').length).toBeGreaterThan(0)
    expect(screen.getByText('2,415')).toBeInTheDocument()
    expect(screen.getByText('114')).toBeInTheDocument()
    expect(screen.getAllByText('Working finding').length).toBeGreaterThan(0)
    expect(screen.getByText('47 of 47')).toBeInTheDocument()
    expect(screen.getByText('0', { selector: '.text-display-lg' })).toBeInTheDocument()
    expect(screen.getByText(/Read only means this page contains no editing/)).toBeInTheDocument()
    expect(screen.queryByText('99.5%')).not.toBeInTheDocument()
    expect(screen.queryByText('0 of 177')).not.toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
  })

  it('keeps related live visuals behind the existing release controls', () => {
    visualAccess.role = 'partner'
    visualAccess.releasedIds = ['coverage-heatmap']
    render(<ShowcasePage />)

    expect(screen.getByRole('button', {
      name: /Related visual not released: A typical district/i,
    })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', {
      name: /Community colleges cover three quarters/i,
    }))
    expect(screen.getByRole('button', {
      name: /Explore graduation coverage by college: Community colleges cover/i,
    })).not.toBeDisabled()
  })

  it('switches the guided finding and opens its full live visual', async () => {
    render(<ShowcasePage />)

    fireEvent.click(screen.getByRole('button', {
      name: /Community colleges cover three quarters/i,
    }))
    expect(screen.getByRole('heading', {
      name: 'Community colleges cover three quarters of UC course requirements meant for transfer',
    })).toBeInTheDocument()
    expect(screen.getAllByText('74.6%').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', {
      name: 'Explore graduation coverage by college: Community colleges cover three quarters of UC course requirements meant for transfer',
    }))

    const dialog = screen.getByRole('dialog', {
      name: 'Community colleges cover three quarters of UC course requirements meant for transfer full visual',
    })
    expect(within(dialog).getByText('Live coverage-heatmap visual')).toBeInTheDocument()
    expect(within(dialog).getByText(/related live, read only visual/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/isolates course requirements meant for transfer/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens a distraction-free presentation of the same showcase', () => {
    render(<ShowcasePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Present showcase' }))
    const dialog = screen.getByRole('dialog', { name: 'California transfer pathways' })

    expect(within(dialog).getByText('Presentation mode')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', {
      name: 'How much of a community college pathway carries into a UC degree?',
    })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Present showcase' })).not.toBeInTheDocument()
  })

  it('returns a presenter to the finding they opened', async () => {
    render(<ShowcasePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Present showcase' }))
    const presentation = screen.getByRole('dialog', { name: 'California transfer pathways' })

    fireEvent.click(within(presentation).getByRole('button', {
      name: /Community colleges cover three quarters/i,
    }))
    fireEvent.click(within(presentation).getByRole('button', {
      name: /Explore graduation coverage by college:/i,
    }))

    const detail = await screen.findByRole('dialog', {
      name: 'Community colleges cover three quarters of UC course requirements meant for transfer full visual',
    })
    fireEvent.click(within(detail).getByRole('button', { name: 'Close' }))

    const restored = await screen.findByRole('dialog', { name: 'California transfer pathways' })
    expect(within(restored).getByRole('heading', {
      name: 'Community colleges cover three quarters of UC course requirements meant for transfer',
    })).toBeInTheDocument()
  })
})
