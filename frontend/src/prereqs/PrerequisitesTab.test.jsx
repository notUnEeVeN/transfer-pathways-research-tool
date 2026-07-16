import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrerequisitesTab from './PrerequisitesTab'

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [], isLoading: false }),
  usePrereqGraph: () => ({
    data: {
      concepts: [
        { slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [], note: '' },
        { slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'], note: '' },
      ],
      rules: [{ from: 'calc_1', to: 'calc_2' }],
      stats: { in_scope: 0, examined: 0 },
    },
    isLoading: false, isError: false,
  }),
  useSaveCourseConcept: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRefTable: () => ({ data: { rows: [] }, isLoading: false, isError: false }),
  useDeleteRefRow: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveRefRow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
}))

describe('PrerequisitesTab', () => {
  it('renders the concept DAG with nodes and the rules table', () => {
    render(<PrerequisitesTab />)
    expect(screen.getAllByText('Calculus II').length).toBeGreaterThan(0)
    // 'Rules' appears twice in the canonical (no-college) view: the StatStrip
    // tile label (rule count) and the rules table's own section heading.
    expect(screen.getAllByText('Rules').length).toBeGreaterThan(0)
  })
})
