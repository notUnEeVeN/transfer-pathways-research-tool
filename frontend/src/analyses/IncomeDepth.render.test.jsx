import React from 'react'
import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const mocks = { useArticulationDepth: vi.fn() }
vi.mock('../shared/query/hooks/useData', () => ({
  useArticulationDepth: (...a) => mocks.useArticulationDepth(...a),
}))

const { default: IncomeDepth } = await import('./IncomeDepth')

// Realistic endpoint rows, matching the live smoke output shape.
const rows = [
  { district: 'Allan Hancock Joint Community College District', n_colleges: 1, colleges: ['Allan Hancock College'], coverage_all: 0.73, coverage_required: 0.78, coverage_recommended: 0.62 },
  { district: 'Foothill-De Anza Community College District', n_colleges: 2, colleges: ['De Anza College', 'Foothill College'], coverage_all: 0.83, coverage_required: 0.85, coverage_recommended: 0.8 },
  { district: 'Palo Verde Community College District', n_colleges: 1, colleges: ['Palo Verde College'], coverage_all: 0.05, coverage_required: 0.06, coverage_recommended: 0.02 },
  { district: 'Kern Community College District', n_colleges: 3, colleges: ['Bakersfield College', 'Cerro Coso College', 'Porterville College'], coverage_all: 0.6, coverage_required: 0.66, coverage_recommended: 0.5 },
]

describe('IncomeDepth render regression', () => {
  it('renders with live-shaped data without throwing', () => {
    mocks.useArticulationDepth.mockReturnValue({ data: { rows }, isLoading: false, isError: false })
    render(<IncomeDepth majorSlug='cs' majorLabel='Computer Science' />)
  })

  it('renders the loading and error states without throwing', () => {
    mocks.useArticulationDepth.mockReturnValue({ data: null, isLoading: true, isError: false })
    render(<IncomeDepth />)
    mocks.useArticulationDepth.mockReturnValue({ data: null, isLoading: false, isError: true })
    render(<IncomeDepth />)
  })
})
