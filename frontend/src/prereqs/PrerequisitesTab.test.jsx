import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PrerequisitesTab from './PrerequisitesTab'

const mocks = vi.hoisted(() => ({
  majorPicker: vi.fn(),
  useMajorChoice: vi.fn(),
  usePrereqGraph: vi.fn(),
}))

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [], isLoading: false }),
  usePrereqGraph: (...args) => mocks.usePrereqGraph(...args),
  useSaveCourseConcept: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRefTable: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
  useDeleteRefRow: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveRefRow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
}))

vi.mock('../shared/majors/MajorContext', () => ({
  useMajorChoice: (...args) => mocks.useMajorChoice(...args),
}))

vi.mock('../shared/majors/MajorPicker', () => ({
  default: (props) => {
    mocks.majorPicker(props)
    return null
  },
}))

describe('PrerequisitesTab', () => {
  beforeEach(() => {
    mocks.majorPicker.mockClear()
    mocks.useMajorChoice.mockReset()
    mocks.useMajorChoice.mockReturnValue({ slug: 'bio', setSlug: vi.fn() })
    mocks.usePrereqGraph.mockReset()
    mocks.usePrereqGraph.mockReturnValue({
      data: {
        concepts: [
          { slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [], note: '' },
          { slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'], note: '' },
        ],
        rules: [{ from: 'calc_1', to: 'calc_2' }],
        stats: { in_scope: 0, examined: 0 },
      },
      isLoading: false, isError: false,
    })
  })

  it('uses the prerequisite major scope for the picker and graph', () => {
    const onRoute = vi.fn()
    render(<PrerequisitesTab onRoute={onRoute} />)

    expect(mocks.useMajorChoice).toHaveBeenCalledWith('prerequisites')
    expect(mocks.majorPicker).toHaveBeenCalledWith(expect.objectContaining({
      value: 'bio', capability: 'prerequisites',
    }))
    expect(mocks.usePrereqGraph).toHaveBeenCalledWith(null, 'bio')
    expect(onRoute).toHaveBeenCalledWith({
      path: '/api/curated/prerequisite-graph?majorSlug=bio',
    })
    expect(screen.getAllByText('Calculus II').length).toBeGreaterThan(0)
    // 'Rules' appears twice in the canonical (no-college) view: the StatStrip
    // tile label (rule count) and the rules table's own section heading.
    expect(screen.getAllByText('Rules').length).toBeGreaterThan(0)
  })

  it('updates the reported route when the selected major changes', () => {
    const onRoute = vi.fn()
    const { rerender } = render(<PrerequisitesTab onRoute={onRoute} />)
    mocks.useMajorChoice.mockReturnValue({ slug: 'econ', setSlug: vi.fn() })

    rerender(<PrerequisitesTab onRoute={onRoute} />)

    expect(onRoute).toHaveBeenLastCalledWith({
      path: '/api/curated/prerequisite-graph?majorSlug=econ',
    })
  })

  it('passes the same selected major to the mapping view', () => {
    render(<PrerequisitesTab />)
    mocks.usePrereqGraph.mockClear()

    fireEvent.click(screen.getByRole('tab', { name: 'Mapping' }))

    expect(mocks.usePrereqGraph).toHaveBeenCalledWith(null, 'bio')
    expect(screen.getByText('Pick a college to review its in-scope courses.')).toBeInTheDocument()
  })
})
