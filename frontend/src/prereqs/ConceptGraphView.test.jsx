import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConceptGraphView from './ConceptGraphView'

const mocks = vi.hoisted(() => ({ usePrereqGraph: vi.fn() }))

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [{ id: 4, source_id: 4, name: 'College of Marin' }], isLoading: false }),
  usePrereqGraph: (...args) => mocks.usePrereqGraph(...args),
}))

describe('ConceptGraphView (college mode)', () => {
  beforeEach(() => {
    mocks.usePrereqGraph.mockReset()
    mocks.usePrereqGraph.mockReturnValue({
      data: {
        concepts: [
          { slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [], note: '' },
          { slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'], note: '' },
          { slug: 'phys_mech', name: 'Physics: Mechanics', discipline: 'physics', requires: ['calc_1'], note: '' },
        ],
        rules: [
          { from: 'calc_1', to: 'calc_2' },
          { from: 'calc_1', to: 'phys_mech' },
        ],
        courses: [
          { key: 'cc:1', prefix: 'PHYS', number: '4A', title: 'Physics for Scientists', units: 5, concept: 'phys_mech', concept_source: 'llm_session_v1', concept_confidence: 1, in_scope: true, role: 'major_preparation' },
          { key: 'cc:2', prefix: 'MATH', number: '3A', title: 'Calculus I', units: 5, concept: 'calc_1', concept_source: 'llm_session_v1', concept_confidence: 1, in_scope: false, role: 'prerequisite_only' },
        ],
        edges: [{ from: 'cc:2', to: 'cc:1' }],
        stats: { in_scope: 1, examined: 1, mapped: 1, edges: 1, phantom_course_ids: [] },
        legacy: { courses_compared: 1, legacy_edges: 2, projected_edges: 1, shared_edges: 1 },
      },
      isLoading: false, isError: false,
    })
  })

  it('scopes the query by major and draws direct plus prerequisite-only courses', () => {
    render(<ConceptGraphView initialCollegeId={4} majorSlug='bio' />)

    expect(mocks.usePrereqGraph).toHaveBeenCalledWith(4, 'bio')

    // Both the direct major course and the prerequisite-only closure render.
    expect(screen.getByText('PHYS 4A')).toBeInTheDocument()
    expect(screen.getByText('MATH 3A')).toBeInTheDocument()

    // calc_2 has no course at this college → "No course here" chip.
    // ('Calculus II' also appears in the rules table below.)
    expect(screen.getAllByText('Calculus II').length).toBeGreaterThan(0)
    expect(screen.getByText('No course here')).toBeInTheDocument()

    // College-mode StatStrip: examined 1 of 1 → 100%.
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()

    // Legacy tile: 1 of 2 legacy edges reproduced → 50%.
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 legacy edges reproduced')).toBeInTheDocument()
  })
})
