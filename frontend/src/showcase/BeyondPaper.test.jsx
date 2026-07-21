import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../shared/query/hooks/useData', () => ({
  useColleges: () => ({ data: [], isLoading: false, isError: false }),
  usePrereqGraph: () => ({
    data: {
      concepts: [{ slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [], note: '' }],
      rules: [],
      courses: [],
      edges: [],
      stats: { in_scope: 0, examined: 0, mapped: 0, edges: 0, phantom_course_ids: [] },
    },
    isLoading: false,
    isError: false,
  }),
}))

import BeyondPaper from './BeyondPaper'

describe('beyond the paper', () => {
  it('frames the prereq exhibit and embeds the live concept graph', () => {
    render(<BeyondPaper />)
    expect(screen.getByRole('heading', { name: /prerequisite structure inside the pathway/i })).toBeInTheDocument()
    expect(screen.getByText('Prerequisite concept graph')).toBeInTheDocument()
    expect(screen.getByText('199 of 199')).toBeInTheDocument()
    expect(screen.getByText('95.3%')).toBeInTheDocument()
  })
})
