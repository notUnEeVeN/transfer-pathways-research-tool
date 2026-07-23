import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AsDegreeReview from './AsDegreeReview'

// Same convention as ValidationDashboard.test.jsx: hoist a mutable bag so each
// test can point the mocked hooks at whatever detail payload it needs, without
// re-declaring the whole mock module per test.
const mocks = vi.hoisted(() => ({
  detail: { college_name: 'Test College', degrees: [] },
  save: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../shared/query/hooks/useData', () => ({
  useAsDegreeDetail: () => ({
    data: mocks.detail, isLoading: false, isError: false, error: null,
  }),
  useCcCourses: () => ({ data: { rows: [] }, isLoading: false }),
  useSaveAsDegree: () => ({ mutateAsync: mocks.save, isPending: false }),
}))

const astDoc = {
  _id: 'as_degree:110:cs:ast',
  legacy_id: '110:cs:ast',
  kind: 'as_degree',
  degree_type: 'ast',
  status: 'found',
  degree_title_seen: 'AST TITLE MARKER',
  catalog_url: 'https://catalog.example.edu/ast',
  catalog_year: '2024-25',
  unit_system: 'semester',
  total_units: 60,
  requirement_groups: [],
  verification: { verified: false },
}

const localDoc = {
  _id: 'as_degree:110:cs:local_as',
  legacy_id: '110:cs:local_as',
  kind: 'as_degree',
  degree_type: 'local_as',
  status: 'found',
  degree_title_seen: 'LOCAL AS TITLE MARKER',
  catalog_url: 'https://catalog.example.edu/local-as',
  catalog_year: '2023-24',
  unit_system: 'semester',
  total_units: 45,
  requirement_groups: [],
  verification: { verified: false },
}

describe('AsDegreeReview', () => {
  beforeEach(() => {
    mocks.save.mockClear()
    mocks.detail = { college_name: 'Test College', degrees: [] }
  })

  // Behavior A: the section owns the type tabs, so the record shown must be
  // the one whose degree_type matches the selected slot — not records[0].
  it('shows the record matching the selected slot, not records[0]', () => {
    mocks.detail = {
      college_name: 'Test College',
      degrees: [
        { degree_type: 'ast', doc: astDoc },
        { degree_type: 'local_as', doc: localDoc },
      ],
    }

    render(<AsDegreeReview collegeId={110} major='cs' slot='local_as' />)

    const jsonBox = screen.getByLabelText('Degree document JSON')
    expect(jsonBox.value).toContain('LOCAL AS TITLE MARKER')
    expect(jsonBox.value).not.toContain('AST TITLE MARKER')
  })

  // Behavior B: switching slots (or majors) must clear any half-typed draft,
  // even between two slots that are both still empty (stored?._id is
  // undefined on both sides, so the reset cannot rely on that alone).
  it('does not bleed a half-typed draft from one empty slot into another', () => {
    mocks.detail = { college_name: 'Test College', degrees: [] }

    const { rerender } = render(<AsDegreeReview collegeId={110} major='cs' slot='ast' />)

    fireEvent.change(screen.getByLabelText('Catalog year'), { target: { value: '1999-ZZ' } })
    expect(screen.getByLabelText('Catalog year').value).toBe('1999-ZZ')

    rerender(<AsDegreeReview collegeId={110} major='cs' slot='local_as' />)

    expect(screen.getByLabelText('Catalog year').value).toBe('')
  })

  it('hides the verdict buttons in creator mode, leaving only the create action', () => {
    mocks.detail = { college_name: 'Test College', degrees: [] }

    render(<AsDegreeReview collegeId={110} major='cs' slot='ast' />)

    expect(screen.getByRole('button', { name: 'Create record' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark verified' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Needs work' })).not.toBeInTheDocument()
  })

  it('keeps the verdict buttons for an already-stored record', () => {
    mocks.detail = {
      college_name: 'Test College',
      degrees: [{ degree_type: 'ast', doc: astDoc }],
    }

    render(<AsDegreeReview collegeId={110} major='cs' slot='ast' />)

    expect(screen.getByRole('button', { name: 'Mark verified' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Needs work' })).toBeInTheDocument()
  })
})
