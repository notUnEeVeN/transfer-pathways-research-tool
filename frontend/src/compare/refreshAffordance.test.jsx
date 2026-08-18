import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Compare's refresh affordance.
 *
 * The point of the whole layer is that a reader can ask for fresh numbers
 * WITHOUT losing the view they arrived at, so the load-bearing assertion here
 * is the negative one: a refresh refetches under a mounted figure and never
 * remounts it. The figure stub therefore records every mount and holds a
 * control of its own, exactly as the six adopted MA figures do.
 */

const fx = vi.hoisted(() => ({
  refresh: vi.fn(() => Promise.resolve()),
  mounts: [],
}))

vi.mock('../shared/query/refresh', () => ({
  useRefreshAnalyses: () => ({ refresh: fx.refresh, isRefreshing: false }),
}))

vi.mock('../analyses/registry', () => {
  const analysis = {
    id: 'demo-figure',
    title: 'Demo figure',
    description: 'A fixture figure.',
    provenance: 'ma',
    figureNo: 6,
    majorScope: { mode: 'selected', requiredCapabilities: [], datasets: [] },
    viewKnobs: [{
      key: 'source',
      label: 'Source',
      type: 'select',
      prop: 'defaultSource',
      default: 'published',
      options: [
        { value: 'published', label: 'Paper (published)' },
        { value: 'ours', label: 'Ours (recomputed)' },
      ],
    }],
    Component: () => null,
  }
  const ANALYSES = [analysis]
  return { ANALYSES, getAnalysisById: (id) => ANALYSES.find((entry) => entry.id === id) || null }
})

vi.mock('../visuals/VisualsPage', async () => {
  const React_ = (await import('react')).default
  return {
    // Seeded once from componentProps, then it owns the value and reports
    // changes upward — the contract every adopted figure implements. Each mount
    // is recorded, so "did that click remount the figure?" is answerable.
    BuiltInAnalysisCard: ({ analysis, componentProps }) => {
      const report = componentProps?.onViewChange
      const [value, setValue] = React_.useState(componentProps?.defaultSource)
      React_.useEffect(() => { fx.mounts.push(analysis.id) }, [])
      React_.useEffect(() => { report?.({ defaultSource: value }) }, [value, report])
      return React_.createElement('div', { 'data-testid': 'figure-card' },
        React_.createElement('span', { 'data-testid': 'showing' }, String(value)),
        React_.createElement('button', {
          type: 'button', onClick: () => setValue('ours'),
        }, 'pick ours'))
    },
    itemDetails: (item) => ({ title: item.analysis.title }),
  }
})

vi.mock('../visuals/analysisAvailability', () => ({
  resolveAnalysisAvailability: () => ({ available: true, effectiveMajorSlug: 'ma-cs' }),
}))

vi.mock('../visuals/analysisVisibility', () => ({
  filterBuiltInAnalyses: (analyses) => analyses,
}))

vi.mock('../shared/query/hooks/useAccess', () => ({
  useAccessMe: () => ({ data: { uid: 'u1', role: 'admin' }, isError: false }),
  useVisualSettings: () => ({ data: { released_ids: ['demo-figure'], disabled_ids: [] } }),
}))

vi.mock('../shared/majors/useMajors', () => {
  const byState = {
    ca: [],
    ma: [{ slug: 'ma-cs', label: 'Computer Science (MA)', state: 'ma', capabilities: {} }],
    va: [{ slug: 'va-cs', label: 'Computer Science (VA)', state: 'va', capabilities: {} }],
  }
  return { useMajors: ({ state } = {}) => ({ majors: byState[state || 'ca'], isLoading: false }) }
})

vi.mock('../shared/query/hooks/useComparisons', () => {
  const idle = () => ({ mutateAsync: vi.fn(() => Promise.resolve()), isPending: false })
  return { useAddNote: idle, useEditNote: idle, useDeleteNote: idle }
})

vi.mock('./breakdowns/registry', () => ({
  BREAKDOWNS: [], getBreakdown: () => null, breakdownFor: () => null,
}))

const { default: ComparisonWorkspace } = await import('./ComparisonWorkspace')

// Two panes in two corpora, so "which major did this pane ask for?" has a
// wrong answer available for the assertion to rule out.
const PANES = [
  { id: 'p1', figure: 'demo-figure', major: 'ma-cs', knobs: { source: 'published' }, label: null },
  { id: 'p2', figure: 'demo-figure', major: 'va-cs', knobs: { source: 'published' }, label: null },
]

// The workspace is controlled: the figure reports its control changes up, the
// page writes them back onto the pane. Refreshing has to survive that round
// trip, so the test drives the real one rather than a frozen prop.
function Harness({ panes = PANES }) {
  const [comparison, setComparison] = React.useState({
    _id: 'cmp-1', title: 'Fixture', panes, baseline_pane: 'p1', notes: [],
  })
  return (
    <ComparisonWorkspace comparison={comparison} onChange={setComparison}
      ensureSaved={() => Promise.resolve('cmp-1')} mode='build' />
  )
}

beforeEach(() => {
  fx.refresh.mockClear()
  fx.mounts.length = 0
})

describe('the refresh affordance', () => {
  it('refreshes every pane from the workspace header in one call', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh all panes in this comparison' }))

    await waitFor(() => expect(fx.refresh).toHaveBeenCalledTimes(1))
    // No major: one call covering every pane, including panes in other corpora.
    expect(fx.refresh.mock.calls[0][0]?.majorSlug).toBeUndefined()
  })

  it('refreshes only that pane major from a pane header', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Computer Science (VA)' }))

    await waitFor(() => expect(fx.refresh).toHaveBeenCalledTimes(1))
    expect(fx.refresh).toHaveBeenCalledWith({ majorSlug: 'va-cs' })
  })

  it('keeps both controls out of an exported figure', () => {
    render(<Harness />)

    const all = screen.getByRole('button', { name: 'Refresh all panes in this comparison' })
    const pane = screen.getByRole('button', { name: 'Refresh Computer Science (MA)' })
    // exportCard.js drops every [data-export-exclude] subtree from the clone it
    // renders, so sitting inside one is what "never exported" means.
    expect(all.closest('[data-export-exclude]')).not.toBeNull()
    expect(pane.closest('[data-export-exclude]')).not.toBeNull()
  })

  // The bug this tool just fixed: re-seeding a figure to deliver fresh numbers
  // discards the state the reader is looking at. A refresh must refetch, not
  // remount.
  it('does not remount the figure it refreshes', async () => {
    render(<Harness />)
    expect(fx.mounts).toHaveLength(2)

    // A control the reader moved, mirrored back onto the pane by the workspace.
    const [firstPane] = screen.getAllByTestId('figure-card')
    fireEvent.click(within(firstPane).getByText('pick ours'))
    await waitFor(() => expect(screen.getAllByTestId('showing')[0]).toHaveTextContent('ours'))
    expect(fx.mounts).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Computer Science (MA)' }))
    await waitFor(() => expect(fx.refresh).toHaveBeenCalledTimes(1))

    // Same two mounts, and the reader's view is still the one they chose.
    expect(fx.mounts).toHaveLength(2)
    expect(screen.getAllByTestId('showing')[0]).toHaveTextContent('ours')
  })

  it('says how long ago the data came back, once it has', async () => {
    render(<Harness />)
    // Nothing is claimed before a refresh lands: the surface does not know when
    // the session cache it is reading was filled.
    expect(screen.queryByText(/Updated/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh all panes in this comparison' }))

    // The workspace and both panes — refreshing everything made every pane
    // current, so every pane is entitled to say so.
    await waitFor(() => expect(screen.getAllByText('Updated just now')).toHaveLength(3))
  })

  it('stamps only the pane that was refreshed', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Computer Science (VA)' }))

    await waitFor(() => expect(screen.getAllByText('Updated just now')).toHaveLength(1))
  })
})
