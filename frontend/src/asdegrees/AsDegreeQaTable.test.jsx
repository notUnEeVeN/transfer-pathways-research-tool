import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AsDegreeQaTable from './AsDegreeQaTable'

vi.mock('../shared/query/hooks/useData', () => ({
  useAsDegrees: (degreeType) => ({
    data: {
      template: { _id: 'as_degree_template:cs' },
      rows: [
        { _id: 'as_degree:110:cs', college_id: 'cc:110', college_name: 'Allan Hancock College',
          degree_type: 'ast',
          status: 'found', degree_title_seen: 'Computer Science, A.S.', unit_system: 'semester',
          total_units: 60, units_accounted: 58, coverage_pct: 92, group_count: 7,
          source_counts: { extracted: 6, template_default: 1, curated: 0 },
          confidence_min: 0.62, confidence_mean: 0.88, unresolved_count: 1,
          deviations: { missing_groups: [], extra_groups: ['ethics'] },
          flags: ['template_default_groups', 'low_confidence', 'unresolved_courses'],
          verified: false, catalog_url: 'https://catalog.example/cs' },
        { _id: 'as_degree:2:cs', college_id: 'cc:2', college_name: 'Evergreen Valley College',
          degree_type: 'ast',
          status: 'none_found', degree_title_seen: null, total_units: null, units_accounted: 0,
          group_count: 0, source_counts: { extracted: 0, template_default: 0, curated: 0 },
          confidence_min: null, confidence_mean: null, unresolved_count: 0,
          deviations: { missing_groups: [], extra_groups: [] }, flags: [], verified: false,
          catalog_url: 'https://catalog.example/programs' },
      ].filter((row) => !degreeType || row.degree_type === degreeType),
    },
    isLoading: false, isError: false,
  }),
  useAsDegreeDetail: () => ({ data: null, isLoading: false, isError: false }),
  useSaveAsDegree: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('AsDegreeQaTable', () => {
  it('lists colleges with status and confidence', () => {
    render(<AsDegreeQaTable />)
    expect(screen.getByText('Allan Hancock College')).toBeInTheDocument()
    expect(screen.getByText('Computer Science, A.S.')).toBeInTheDocument()
    expect(screen.getByText('none_found')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('hides clean rows under the Flagged-only filter', () => {
    render(<AsDegreeQaTable />)
    fireEvent.click(screen.getByText('All quality states'))
    fireEvent.click(screen.getByText('Flagged only'))
    expect(screen.getByText('Allan Hancock College')).toBeInTheDocument()
    expect(screen.queryByText('Evergreen Valley College')).not.toBeInTheDocument()
  })

  it('reports a requested degree type so the server query can change', () => {
    const onDegreeTypeChange = vi.fn()
    render(<AsDegreeQaTable degreeType='ast' onDegreeTypeChange={onDegreeTypeChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Local A.S.' }))
    expect(onDegreeTypeChange).toHaveBeenCalledWith('local_as')
  })
})
