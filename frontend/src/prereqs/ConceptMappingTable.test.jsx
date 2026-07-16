import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ConceptMappingTable from './ConceptMappingTable'

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [{ id: 4, source_id: 4, name: 'College of Marin' }], isLoading: false }),
  usePrereqGraph: () => ({
    data: {
      concepts: [{ slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [] }],
      rules: [],
      stats: { in_scope: 3, examined: 2, mapped: 1, edges: 0, phantom_course_ids: [] },
      courses: [
        { key: 'cc:1', prefix: 'MATH', number: '3A', title: 'Calculus I', units: 5, concept: 'calc_1', concept_source: 'llm_session_v1', concept_confidence: 1, concept_note: 'obvious fit', in_scope: true },
        { key: 'cc:2', prefix: 'CS', number: '10', title: 'Intro CS', units: 4, concept: null, concept_source: null, concept_confidence: null, in_scope: true },
        { key: 'cc:3', prefix: 'ART', number: '1', title: 'Art History', units: 3, concept: null, concept_source: 'llm_session_v1', concept_confidence: null, in_scope: true },
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
    expect(screen.getByText('none (examined)')).toBeInTheDocument()
  })

  it('hides mapped rows under the Unmapped-only filter', () => {
    render(<ConceptMappingTable initialCollegeId={4} />)
    expect(screen.getByText(/MATH 3A/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('All courses'))          // open the filter Select
    fireEvent.click(screen.getByText('Unmapped only'))        // pick the option
    expect(screen.queryByText(/MATH 3A/)).not.toBeInTheDocument()
    expect(screen.getByText(/CS 10/)).toBeInTheDocument()
    expect(screen.getByText(/ART 1/)).toBeInTheDocument()
  })

  it('shows only note-carrying machine rows under the Flagged filter', () => {
    render(<ConceptMappingTable initialCollegeId={4} />)
    fireEvent.click(screen.getByText('All courses'))
    fireEvent.click(screen.getByText('Flagged only'))
    expect(screen.getByText(/MATH 3A/)).toBeInTheDocument()   // has concept_note
    expect(screen.queryByText(/CS 10/)).not.toBeInTheDocument()
    expect(screen.queryByText(/ART 1/)).not.toBeInTheDocument()
  })
})
