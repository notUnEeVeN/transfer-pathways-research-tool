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

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [], isLoading: false, isError: false }),
  usePrereqGraph: () => ({
    data: {
      concepts: [],
      rules: [],
      courses: [],
      edges: [],
      stats: { in_scope: 0, examined: 0, mapped: 0, edges: 0, phantom_course_ids: [] },
    },
    isLoading: false,
    isError: false,
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
  it('tells the five-act data-strength story in order, read only', () => {
    render(<ShowcasePage />)
    expect(screen.getByRole('heading', { name: 'Your figures, rebuilt on California data' })).toBeInTheDocument()

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    const order = [
      'Your analyses, run statewide in California',
      'An audit with a published bound, not a promise',
      'Confidence and caveats stay beside the findings.',
      'Beyond coverage: the prerequisite structure inside the pathway',
      'A living research instrument, not a one-off analysis',
    ]
    const indexes = order.map((t) => headings.findIndex((h) => h === t))
    expect(indexes.every((i) => i >= 0)).toBe(true)
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b))

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
  })

  it('leads with the ported figures and embeds the live figure inline for admins', () => {
    render(<ShowcasePage />)
    expect(screen.getByText('Live paper-district-heatmap visual')).toBeInTheDocument()
    expect(screen.getAllByText(/After the Massachusetts paper/).length).toBeGreaterThan(0)
  })

  it('falls back to frozen panels for accounts without the release', () => {
    visualAccess.role = 'partner'
    visualAccess.releasedIds = []
    render(<ShowcasePage />)
    expect(screen.queryByText('Live paper-district-heatmap visual')).not.toBeInTheDocument()
    expect(screen.getAllByText(/not released for this account/i).length).toBeGreaterThan(0)
  })

  it('walks the audit story and never shows a fabricated bound', () => {
    render(<ShowcasePage />)
    fireEvent.click(screen.getByRole('button', { name: /Statistical bound/ }))
    expect(screen.getByText(/frozen from the live audit/i)).toBeInTheDocument()
  })

  it('opens a full live visual from the stage and returns cleanly', async () => {
    render(<ShowcasePage />)
    fireEvent.click(screen.getByRole('button', {
      name: 'Open the full district heatmap: Which districts have a complete path to each UC campus',
    }))
    const dialog = screen.getByRole('dialog', {
      name: 'Which districts have a complete path to each UC campus full visual',
    })
    expect(within(dialog).getByText('Live paper-district-heatmap visual')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps presentation mode over the new structure', () => {
    render(<ShowcasePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Present showcase' }))
    const dialog = screen.getByRole('dialog', { name: 'California transfer pathways' })
    expect(within(dialog).getByText('Presentation mode')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Your figures, rebuilt on California data' })).toBeInTheDocument()
  })
})
