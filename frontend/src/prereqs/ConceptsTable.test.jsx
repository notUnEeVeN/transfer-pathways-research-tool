import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConceptsTable from './ConceptsTable'
import { refTableByKey } from '../references/refTablesRegistry'

vi.mock('../shared/query/hooks/useData', () => ({
  useRefTable: () => ({
    data: { rows: [
      { _id: 'prereq_concept:calc_2', slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'], note: '' },
    ] },
    isLoading: false, isError: false,
  }),
  useDeleteRefRow: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveRefRow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
}))

describe('ConceptsTable', () => {
  it('renders concept rows with their rules', () => {
    render(<ConceptsTable />)
    expect(screen.getByText('Calculus II')).toBeInTheDocument()
    expect(screen.getByText('calc_1')).toBeInTheDocument()
  })
})

describe('prereq_concepts registry entry', () => {
  it('derives the id from the slug', () => {
    const config = refTableByKey('prereq_concepts')
    expect(config.makeId({ slug: 'calc_2' })).toBe('calc_2')
    expect(config.newRow().requires).toEqual([])
  })
})
