import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

const MAJORS = {
  ca: { majors: [{ slug: 'cs', label: 'Computer Science', capabilities: { assistAgreements: true, degreeTemplates: true, asDegrees: true, prerequisites: true, transferMinimums: true, articulationVerdicts: true, courseTypeFigures: true, agreementPathways: true, caCreditLossArtifact: true, snapshots: [] }, degreeAnalysisSlots: ['local_as', 'ast'], courseTypes: { module: 'cs', axes: { faithful: [] } } }], default: 'cs' },
  ma: { majors: [{ slug: 'ma-cs', label: 'Computer Science (MA)', state: 'ma', capabilities: { assistAgreements: true, degreeTemplates: true, asDegrees: true, paperBaselines: true, unitCoverage: false, courseTypeFigures: true, prerequisites: false, snapshots: [] }, degreeAnalysisSlots: ['local_as'], courseTypes: { module: 'cs', axes: { faithful: [] } } }], default: 'ma-cs' },
  va: { majors: [], default: 'cs' },
}

const store = new Map()
const patches = []

vi.mock('../shared/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' }, loading: false }) }))
vi.mock('../shared/api/apiClient', () => ({
  default: {
    get: (path, config) => {
      if (path === '/access/me') return Promise.resolve({ data: { uid: 'u1', role: 'admin' } })
      if (path === '/analysis/releases') return Promise.resolve({ data: { released_ids: [], disabled_ids: [] } })
      if (path === '/majors') return Promise.resolve({ data: MAJORS[config?.params?.state || 'ca'] })
      if (path === '/comparisons') return Promise.resolve({ data: { comparisons: [...store.values()] } })
      if (path.startsWith('/comparisons/')) {
        const d = store.get(path.split('/')[2])
        return d ? Promise.resolve({ data: { comparison: d } }) : Promise.reject(new Error('404'))
      }
      // Realistic coverage rows so the heatmap actually builds a matrix.
      const rows = []
      for (const school of [{ id: 1, name: 'UC Davis' }, { id: 2, name: 'UC Irvine' }]) {
        for (const cc of [{ id: 10, name: 'Ohlone College' }, { id: 11, name: 'De Anza College' }]) {
          rows.push({
            system: 'uc', school_id: school.id, school: school.name,
            community_college_id: cc.id, community_college: cc.name, college_name: cc.name,
            community_college_district: `${cc.name} District`, county: 'Alameda',
            row_group_kind: 'college', row_group_key: `cc:${cc.id}`, row_group_label: cc.name,
            major: 'Computer Science, B.S.',
            receivers_required: 10, receivers_articulated: 6, pct_articulated: 60, fully_articulated: false,
            degree_units_modeled_total: 120, degree_units_with_equivalent: 60, degree_units_satisfied: 60,
            degree_units_stated_minimum: 120, degree_unit_system: 'semester', pct_degree_units: 50,
            named_requirement_courses_total: 20, named_requirement_courses_articulated: 8,
            named_requirement_courses_with_ge_total: 25, named_requirement_courses_with_ge_articulated: 12,
            pct_named_requirement_courses: 40, pct_named_requirement_courses_with_ge: 48,
            degree_requirements_total: 30, degree_requirements_with_equivalent: 15, pct_degree_requirements: 50,
            degree_template_id: `degree:${school.id}:cs`, degree_total_units: 120,
          })
        }
      }
      return Promise.resolve({ data: { rows, n: rows.length, params: {} } })
    },
    post: (path, body) => {
      const id = `cmp-${store.size + 1}`
      const created = { _id: id, title: body.title || 'x', notes: [], ...body }
      store.set(id, created)
      return Promise.resolve({ data: { comparison: created } })
    },
    patch: (path, body) => {
      patches.push({ path, body })
      const id = path.split('/')[2]
      const next = { ...store.get(id), ...body }
      // Real latency, deliberately. Resolving in a microtask hides the bug this
      // guards: while a PATCH is in flight the component keeps re-rendering
      // with the pre-write document.
      return new Promise((resolve) => setTimeout(() => {
        store.set(id, next)
        resolve({ data: { comparison: next } })
      }, 80))
    },
    delete: () => Promise.resolve({ data: null }),
  },
}))

const { default: ComparePage } = await import('./ComparePage')

const open = (params) => {
  const url = new URL('http://localhost/console')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ComparePage /></QueryClientProvider>)
}

/**
 * The whole page with the REAL registry and the REAL figure components — only
 * the network and auth are faked. The mocked-registry suite next door proves
 * the workspace's own logic; this one exists because the failures that reach a
 * reader come from a real figure meeting real props, which a fixture component
 * can never reproduce.
 */
describe('real figures end to end', () => {
  it('survives editing a pane and pressing Save view', async () => {
    open({ panes: 'coverage-heatmap@cs?rows=district|coverage-heatmap@cs' })

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Edit this view' }).length).toBe(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this view' })[0])

    const save = await screen.findByRole('button', { name: 'Save view' })
    fireEvent.click(save)

    // If the tree crashed, the page is empty.
    await waitFor(() => {
      expect(screen.queryByText('Community college')).not.toBeUndefined()
      expect(document.body.textContent.length).toBeGreaterThan(200)
    })
  })

  it('survives Save view on a SAVED cross-state comparison', async () => {
    store.set('cmp-x', {
      _id: 'cmp-x', title: 'CA vs MA', notes: [], baseline_pane: 'p1', verdict_at_pin: null,
      panes: [
        { id: 'p1', figure: 'coverage-heatmap', major: 'cs', knobs: { 'ma-equivalent': true }, label: null },
        { id: 'p2', figure: 'coverage-heatmap', major: 'ma-cs', knobs: {}, label: null },
      ],
    })
    open({ cmp: 'cmp-x', tab: 'saved' })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit views' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit views' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Edit this view' }).length).toBe(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit this view' })[0])

    const save = await screen.findByRole('button', { name: 'Save view' })
    fireEvent.click(save)

    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(200))
    expect(screen.queryByText(/could not be displayed/)).toBeNull()
  })

  // The crash Tybalt reported: "Maximum update depth exceeded" on Figure 3.
  // Two panes each mirror their figure's reported controls onto the saved
  // document; while the PATCH is in flight the pre-write document keeps
  // arriving, and without the pending overlay the panes re-report forever and
  // take turns overwriting each other.
  it('does not write forever when a saved comparison mirrors its figures', async () => {
    patches.length = 0
    store.set('cmp-loop', {
      _id: 'cmp-loop', title: 'Fig 3 printed vs ours', notes: [], baseline_pane: 'p1',
      verdict_at_pin: null,
      panes: [
        { id: 'p1', figure: 'transfer-credit-rate', major: 'ma-cs', knobs: { source: 'pdf' }, label: 'Paper' },
        { id: 'p2', figure: 'transfer-credit-rate', major: 'ma-cs', knobs: { source: 'ours' }, label: 'Ours' },
      ],
    })
    open({ cmp: 'cmp-loop', tab: 'saved' })

    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(200))
    await new Promise((r) => setTimeout(r, 1200))

    // Each pane may settle its own knobs once; anything beyond that is the loop.
    expect(patches.length).toBeLessThanOrEqual(4)
    expect(screen.queryByText(/Maximum update depth/)).toBeNull()
    expect(screen.queryByText(/could not be displayed/)).toBeNull()
  })
})
