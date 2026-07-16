import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConceptMappingTable from './ConceptMappingTable'

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [{ id: 4, source_id: 4, name: 'College of Marin' }], isLoading: false }),
  usePrereqGraph: () => ({
    data: {
      concepts: [{ slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [] }],
      rules: [],
      stats: { in_scope: 2, examined: 1, mapped: 1, edges: 0, phantom_course_ids: [] },
      courses: [
        { key: 'cc:1', prefix: 'MATH', number: '3A', title: 'Calculus I', units: 5, concept: 'calc_1', concept_source: 'llm_session_v1', concept_confidence: 1, in_scope: true },
        { key: 'cc:2', prefix: 'CS', number: '10', title: 'Intro CS', units: 4, concept: null, concept_source: null, concept_confidence: null, in_scope: true },
      ],
      edges: [],
      legacy: null,
    },
    isLoading: false, isError: false,
  }),
  useSaveCourseConcept: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('ConceptMappingTable', () => {
  it('lists in-scope courses with their concepts and flags unexamined rows', () => {
    render(<ConceptMappingTable initialCollegeId={4} />)
    expect(screen.getByText(/MATH 3A/)).toBeInTheDocument()
    expect(screen.getByText('calc_1')).toBeInTheDocument()
    expect(screen.getByText('Not examined')).toBeInTheDocument()
  })
})
