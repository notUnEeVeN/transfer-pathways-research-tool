import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Compare workspace, exercised end to end against a fake API.
 *
 * The registry is replaced with two fixture figures — one that declares knobs
 * and a delta adapter, one that declares neither — because the property under
 * test is that a figure declaring nothing still panes, still saves and still
 * takes notes. The real figure components are never mounted: BuiltInAnalysisCard
 * is stubbed so the assertions are about which props reach it, which is the
 * whole contract between this surface and the figures.
 */

const fx = vi.hoisted(() => {
  const cells = {
    published: [
      { rowKey: 'bristol', rowLabel: 'Bristol', colKey: 'umass', colLabel: 'UMass Amherst', value: 100 },
      { rowKey: 'springfield', rowLabel: 'Springfield Technical', colKey: 'umass', colLabel: 'UMass Amherst', value: 219 },
    ],
    ours: [
      { rowKey: 'bristol', rowLabel: 'Bristol', colKey: 'umass', colLabel: 'UMass Amherst', value: 104 },
      { rowKey: 'springfield', rowLabel: 'Springfield Technical', colKey: 'umass', colLabel: 'UMass Amherst', value: 281 },
    ],
  }
  return {
    cells,
    majors: {
      ca: { majors: [{ slug: 'cs', label: 'Computer Science (CA)', capabilities: {} }], default: 'cs' },
      ma: {
        majors: [{
          slug: 'ma-cs',
          label: 'Computer Science (MA)',
          state: 'ma',
          capabilities: { paperBaselines: true, unitCoverage: false },
        }],
        default: 'ma-cs',
      },
      va: {
        majors: [{
          slug: 'va-cs',
          label: 'Computer Science (VA)',
          state: 'va',
          capabilities: { unitCoverage: false },
        }],
        default: 'va-cs',
      },
    },
    store: { docs: new Map(), seq: 0, posts: [], patches: [], failNote: false },
  }
})

vi.mock('../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'tybalt@example.edu' }, loading: false }),
}))

vi.mock('../analyses/registry', () => {
  // Both fixtures carry the MA lane + a figure number, because the workspace
  // is scoped to the Massachusetts paper's Figures 1-6 (COMPARABLE_SCOPE).
  const knobbed = {
    id: 'demo-figure',
    title: 'Demo figure',
    description: 'A fixture figure.',
    provenance: 'ma',
    figureNo: 6,
    author_label: 'Fixture',
    published_at: '2026-01-01T00:00:00',
    majorScope: { mode: 'selected', requiredCapabilities: [], datasets: [] },
    viewKnobs: [{
      key: 'source',
      label: 'Source',
      type: 'select',
      prop: 'defaultSource',
      options: [
        { value: 'published', label: 'Paper (published)' },
        { value: 'ours', label: 'Ours (recomputed)' },
      ],
      default: 'published',
    }],
    comparable: {
      grain: 'college × university',
      unit: 'score-delta',
      tolerance: 0,
      useData: (view) => ({
        data: fx.cells[view.knobs?.source ?? 'published'],
        isLoading: false,
        isError: false,
      }),
      cells: (data) => data,
    },
    Component: () => null,
  }
  const bare = {
    id: 'plain-figure',
    title: 'Plain figure',
    description: 'A fixture figure that declares nothing.',
    provenance: 'ma',
    figureNo: 2,
    author_label: 'Fixture',
    published_at: '2026-01-01T00:00:00',
    majorScope: { mode: 'selected', requiredCapabilities: [], datasets: [] },
    Component: () => null,
  }
  // A California-lane figure: in the registry, never in the Compare picker.
  const outOfScope = {
    id: 'ca-only-figure',
    title: 'California only',
    description: 'Not one of the paper figures.',
    provenance: 'ca',
    figureNo: 1,
    majorScope: { mode: 'selected', requiredCapabilities: [], datasets: [] },
    Component: () => null,
  }
  const ANALYSES = [knobbed, bare, outOfScope]
  return {
    ANALYSES,
    getAnalysisById: (id) => ANALYSES.find((entry) => entry.id === id) || null,
  }
})

vi.mock('../visuals/VisualsPage', async () => {
  const React_ = (await import('react')).default
  return {
    // Stands in for a real figure: prints the props it was seeded with, and
    // offers a control that reports a change back the way an adopted figure's
    // useEffect does.
    BuiltInAnalysisCard: ({ analysis, componentProps }) => {
      // Faithful to an adopted figure: it echoes its seeded state once on
      // mount, and reports again only when a control actually changes.
      // Seeded once from the prop, then it owns the value — exactly how the
      // six adopted figures behave, and why reporting the STATE (not the prop)
      // is what makes the round-trip settle.
      const report = componentProps?.onViewChange
      const [value, setValue] = React_.useState(componentProps?.defaultSource)
      React_.useEffect(() => { report?.({ defaultSource: value }) }, [value, report])
      return React_.createElement(
        'div', { 'data-testid': 'figure-card' },
        `${analysis.id} ${JSON.stringify({ ...componentProps, onViewChange: undefined })}`,
        React_.createElement('button', {
          type: 'button',
          onClick: () => setValue('diff'),
        }, 'report diff')
      )
    },
    itemDetails: (item) => ({ title: item.analysis.title }),
  }
})

vi.mock('./breakdowns/registry', async () => {
  const React_ = (await import('react')).default
  return {
    BREAKDOWNS: [],
    getBreakdown: () => null,
    breakdownFor: (panes) => (panes.length === 2
      ? {
        id: 'demo-breakdown',
        title: 'Demo breakdown',
        Component: ({ delta }) => React_.createElement('div', null, `breakdown matched ${delta?.matched ?? 0}`),
      }
      : null),
  }
})

vi.mock('../shared/api/apiClient', () => {
  const notFound = () => Promise.reject(Object.assign(new Error('not found'), { response: { status: 404 } }))
  const doc = (id) => fx.store.docs.get(id)
  return {
    default: {
      get: (path, config = {}) => {
        if (path === '/access/me') return Promise.resolve({ data: { uid: 'u1', role: 'admin' } })
        if (path === '/analysis/releases') {
          return Promise.resolve({ data: { released_ids: ['demo-figure', 'plain-figure'], disabled_ids: [] } })
        }
        if (path === '/majors') {
          return Promise.resolve({ data: fx.majors[config.params?.state || 'ca'] })
        }
        if (path === '/comparisons') {
          return Promise.resolve({ data: { comparisons: [...fx.store.docs.values()] } })
        }
        const id = path.replace('/comparisons/', '')
        return doc(id) ? Promise.resolve({ data: { comparison: doc(id) } }) : notFound()
      },
      post: (path, body) => {
        fx.store.posts.push({ path, body })
        if (path === '/comparisons') {
          fx.store.seq += 1
          const created = {
            _id: `cmp-${fx.store.seq}`,
            title: body.title || 'Demo figure · MA',
            notes: [],
            ...body,
          }
          fx.store.docs.set(created._id, created)
          return Promise.resolve({ data: { comparison: created } })
        }
        if (fx.store.failNote) return Promise.reject(new Error('note write failed'))
        const id = path.split('/')[2]
        const current = doc(id)
        const next = {
          ...current,
          notes: [...current.notes, {
            id: `n${current.notes.length + 1}`,
            text: body.text,
            anchor: body.anchor || null,
            author_uid: 'u1',
            author_label: 'Tybalt Mallet',
            created_at: '2026-08-17T00:00:00.000Z',
          }],
        }
        fx.store.docs.set(id, next)
        return Promise.resolve({ data: { comparison: next } })
      },
      patch: (path, body) => {
        fx.store.patches.push({ path, body })
        const id = path.split('/')[2]
        const next = { ...doc(id), ...body }
        fx.store.docs.set(id, next)
        return Promise.resolve({ data: { comparison: next } })
      },
      delete: (path) => {
        fx.store.docs.delete(path.split('/')[2])
        return Promise.resolve({ data: null })
      },
    },
  }
})

import ComparePage from './ComparePage'

function openWith(params) {
  const url = new URL('http://localhost/console')
  url.searchParams.set('view', 'compare')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } } })
  return render(
    <QueryClientProvider client={client}><ComparePage /></QueryClientProvider>
  )
}

const MA_PAIR = 'demo-figure@ma-cs?source=published|demo-figure@ma-cs?source=ours'

// The same pair as a stored document's pane list, for the saved-comparison paths.
const MA_PANES = [
  { id: 'p1', figure: 'demo-figure', major: 'ma-cs', knobs: { source: 'published' }, label: null },
  { id: 'p2', figure: 'demo-figure', major: 'ma-cs', knobs: { source: 'ours' }, label: null },
]

beforeEach(() => {
  fx.store.docs.clear()
  fx.store.posts.length = 0
  fx.store.patches.length = 0
  fx.store.seq = 0
  fx.store.failNote = false
})

describe('the difference is the hero', () => {
  // The figures carry their own difference view, so the workspace states the
  // result in words rather than drawing the deltas a second time.
  it('states what the join found in words', async () => {
    openWith({ panes: MA_PAIR })

    expect(await screen.findByText(/every cell is directly comparable/)).toBeInTheDocument()
    // Tolerance 0, so neither cell agrees — said plainly rather than rounded away.
    expect(screen.getByText(/cells agree/).textContent.replace(/\s+/g, ' '))
      .toContain('0 of 2 cells agree')
  })

  // Reading the two matrices against each other IS the work, so both figures
  // mount on open rather than hiding behind a disclosure.
  it('renders every source figure side by side on open', async () => {
    openWith({ panes: MA_PAIR })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    const cards = await screen.findAllByTestId('figure-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('demo-figure {"defaultSource":"published"}')
    expect(cards[1]).toHaveTextContent('demo-figure {"defaultSource":"ours"}')
  })

  // A saved comparison is an exhibit: the assembly controls fold away, leaving
  // the figures and their own control rows, which is what a reader reaches for.
  it('hides the assembly controls on a saved comparison and can bring them back', async () => {
    fx.store.docs.set('cmp-5', {
      _id: 'cmp-5', title: 'Saved exhibit', notes: [], panes: MA_PANES,
      baseline_pane: 'p1', verdict_at_pin: null,
    })
    openWith({ cmp: 'cmp-5', tab: 'saved' })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    expect(screen.queryByRole('button', { name: 'Add a view' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove this view' })).toBeNull()
    // The figures themselves are still there — that is the point of the page.
    expect(await screen.findAllByTestId('figure-card')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Edit views' }))
    expect(screen.getByRole('button', { name: 'Add a view' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Remove this view' }).length).toBeGreaterThan(0)
  })

  // The selection a reader makes inside a figure is the one the comparison
  // reopens with, so it has to travel back onto the pane and be persisted.
  it('persists a control changed inside the figure', async () => {
    fx.store.docs.set('cmp-6', {
      _id: 'cmp-6', title: 'Saved exhibit', notes: [], panes: MA_PANES,
      baseline_pane: 'p1', verdict_at_pin: null,
    })
    openWith({ cmp: 'cmp-6', tab: 'saved' })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    fireEvent.click(screen.getAllByRole('button', { name: 'report diff' })[0])

    await waitFor(() => expect(fx.store.patches.length).toBeGreaterThan(0))
    const saved = fx.store.patches.at(-1).body.panes.find((pane) => pane.id === 'p1')
    expect(saved.knobs.source).toBe('diff')
    // And the address it is indexed under follows the new value.
    expect(saved.fingerprint).toContain('source=diff')
  })

  // Reported by Tybalt: opening a saved comparison took over the Workspace tab,
  // and because a saved comparison hides its assembly controls there was then
  // nowhere to build the next pairing.
  it('keeps the workspace free while a saved comparison is open', async () => {
    fx.store.docs.set('cmp-7', {
      _id: 'cmp-7', title: 'Saved exhibit', notes: [], panes: MA_PANES,
      baseline_pane: 'p1', verdict_at_pin: null,
    })
    // A draft on the bench, and a saved comparison opened beside it.
    openWith({ panes: MA_PAIR, cmp: 'cmp-7', tab: 'saved' })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)
    expect(screen.queryByRole('button', { name: 'Add a view' })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Workspace' }))
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    // The bench still has its own pair AND its assembly controls.
    expect(screen.getByRole('button', { name: 'Add a view' })).toBeInTheDocument()
    expect(screen.getAllByTestId('figure-card').length).toBe(2)
  })

  it('states what the join did, permanently', async () => {
    openWith({ panes: MA_PAIR })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    expect(screen.getByText('college × university')).toBeInTheDocument()
    expect(screen.getByText(/matched/)).toBeInTheDocument()
    expect(screen.getByText('aligned')).toBeInTheDocument()
  })

  it('mounts the registry component through BuiltInAnalysisCard with the pinned knob as a prop', async () => {
    openWith({ panes: MA_PAIR })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    // Each pane seeds the figure with ITS OWN pinned control, which is the
    // whole mechanism: componentProps, not a controlled component.
    const cards = await screen.findAllByTestId('figure-card')
    expect(cards[0]).toHaveTextContent('demo-figure {"defaultSource":"published"}')
    expect(cards[1]).toHaveTextContent('demo-figure {"defaultSource":"ours"}')

    // And a pane can still be folded away when it is in the way.
    fireEvent.click(screen.getAllByRole('button', { name: /Ours \(recomputed\)/ })[0])
    expect(await screen.findAllByTestId('figure-card')).toHaveLength(1)
  })

  it('refuses a cell diff across corpora instead of inventing a correspondence', async () => {
    openWith({ panes: 'demo-figure@ma-cs?source=ours|demo-figure@va-cs?source=ours' })

    // The refusal is not dismissible, and nothing stands in for the difference
    // it will not show.
    expect(await screen.findByText(/no cell-by-cell difference exists/)).toBeInTheDocument()
    expect(screen.getByText(/No cell-by-cell difference is shown/)).toBeInTheDocument()
    expect(screen.queryByText(/cells agree/)).not.toBeInTheDocument()
  })
})

describe('graceful degradation', () => {
  it('panes a figure that declares no adapter and says so rather than breaking', async () => {
    // Same figure, same major, nothing pinned — the degenerate pair a reader
    // assembles before deciding what to change. It must still work.
    openWith({ panes: 'plain-figure@ma-cs|plain-figure@ma-cs' })

    expect(await screen.findByText(/No delta lens for plain-figure yet/)).toBeInTheDocument()
    expect(screen.getAllByText('not pinned — showing figure defaults').length).toBe(2)
    // Still a document: the notes rail is live on a figure with no delta lens.
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()
  })

  it('names a pinned control the figure no longer declares', async () => {
    openWith({ panes: 'demo-figure@ma-cs?ma_ge=1|demo-figure@ma-cs?source=ours' })

    expect(await screen.findByText(/Pinned control .*ma_ge.* no longer exists/))
      .toBeInTheDocument()
  })
})

describe('notes', () => {
  it('ships empty and writes with no save ceremony', async () => {
    openWith({ panes: MA_PAIR })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()
    expect(fx.store.docs.size).toBe(0)

    const text = 'Their printed cell contradicts their own workbook by 62 points.'
    fireEvent.change(screen.getByLabelText('Add a note'), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))

    // The comparison is POSTed first, then the note — one gesture, no ceremony.
    await waitFor(() => expect(fx.store.posts.length).toBe(2))
    expect(fx.store.posts[0].path).toBe('/comparisons')
    expect(fx.store.posts[1].path).toBe('/comparisons/cmp-1/notes')
    // Byte-exact: nothing trims, templates or rewrites the text on its way up.
    expect(fx.store.posts[1].body.text).toBe(text)

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(new URL(window.location.href).searchParams.get('cmp')).toBe('cmp-1')
    expect(new URL(window.location.href).searchParams.get('panes')).toBe(null)
  })

  it('keeps the typed text in the box when the write fails', async () => {
    fx.store.failNote = true
    openWith({ panes: MA_PAIR })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    const box = screen.getByLabelText('Add a note')
    fireEvent.change(box, { target: { value: 'Half a thought, not yet finished' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))

    expect(await screen.findByText('Could not save the note.')).toBeInTheDocument()
    expect(box).toHaveValue('Half a thought, not yet finished')
  })

  it('pins the verdict observed at save time', async () => {
    openWith({ panes: MA_PAIR })
    await screen.findByText(/directly comparable|no colleges or campuses in common|different measures|no delta lens/)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(fx.store.docs.size).toBe(1))

    const pinned = fx.store.docs.get('cmp-1').verdict_at_pin
    expect(pinned).toMatchObject({ matched: 2, agreeing: 0, dropped: 0, max_abs_delta: 62 })
    expect(pinned.max_cell).toBe('Springfield Technical × UMass Amherst')
  })
})

describe('verdict drift', () => {
  it('warns when a saved comparison no longer renders the numbers it was pinned at', async () => {
    fx.store.docs.set('cmp-9', {
      _id: 'cmp-9',
      title: 'MA Figure 6 — printed vs their own workbook',
      panes: [
        { id: 'p1', figure: 'demo-figure', major: 'ma-cs', knobs: { source: 'published' }, label: null },
        { id: 'p2', figure: 'demo-figure', major: 'ma-cs', knobs: { source: 'ours' }, label: null },
      ],
      baseline_pane: 'p1',
      breakdown_id: null,
      verdict_at_pin: {
        computed_at: '2026-08-17T00:00:00.000Z',
        matched: 2, agreeing: 2, dropped: 0, mean_delta: 33, max_abs_delta: 62,
        max_cell: 'Springfield Technical × UMass Amherst',
      },
      notes: [],
    })

    openWith({ cmp: 'cmp-9', tab: 'saved' })

    const banner = await screen.findByText('This comparison has moved since it was pinned.')
    const block = banner.closest('div[data-export-exclude]')
    // Pinned at 2 agreeing, renders 0 now — the field, both values, on screen.
    expect(within(block).getByText(/agreeing/).textContent.replace(/\s+/g, ' '))
      .toBe('agreeing: 2 → 0')
    expect(within(block).getByRole('button', { name: 'Re-pin' })).toBeInTheDocument()
  })
})
