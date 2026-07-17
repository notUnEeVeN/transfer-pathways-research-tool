import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AsDegreeSchoolView from './AsDegreeSchoolView'

const mockDetail = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useAsDegreeDetail: (...args) => mockDetail(...args),
}))

const degree = (over = {}) => ({
  degree_type: 'local_cs_as',
  coverage_pct: 83,
  missing_core_concepts: ['phys_mech'],
  courses_by_id: {
    'cc:1': { code: 'CS 21', title: 'Programming Concepts', units: 4, concept: 'cs_1' },
    'cc:2': { code: 'MATH 5A', title: 'Calculus I', units: 5, concept: 'calc_1' },
  },
  doc: {
    degree_title_seen: 'Computer Science - Associate in Science (A.S.)',
    unit_system: 'semester', total_units: 60,
    catalog_url: 'https://cabrillo.example/cs', catalog_year: '2025-2026',
    requirement_groups: [
      { group_id: 'core', label_seen: 'Required Major (Complete the following credits: 14)',
        ge_area: null, units_fill: false,
        sections: [{ section_advisement: null, unit_advisement: null,
          receivers: [
            { options: [{ course_keys: ['cc:1'] }] },
            { options: [{ course_keys: ['cc:2'] }] },
          ] }],
        unresolved_courses_seen: [] },
      { group_id: 'ge', label_seen: 'General Education', ge_area: 'local_pattern', units_fill: false,
        sections: [{ section_advisement: null, unit_advisement: 18, receivers: [] }],
        unresolved_courses_seen: [] },
      { group_id: 'electives', label_seen: 'Electives', units_fill: true },
    ],
  },
  ...over,
})

describe('AsDegreeSchoolView', () => {
  it('renders coverage, units, courses, and the catalog source', () => {
    mockDetail.mockReturnValue({ data: { college_name: 'Cabrillo', degrees: [degree()] }, isLoading: false, isError: false })
    render(<AsDegreeSchoolView collegeId={41} />)
    expect(screen.getByText('83%')).toBeInTheDocument()
    expect(screen.getByText(/Missing physics/i)).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText('CS 21')).toBeInTheDocument()
    expect(screen.getByText('Programming Concepts')).toBeInTheDocument()
    expect(screen.getByText(/2025-2026 catalog/)).toBeInTheDocument()
    // a units_fill electives group renders no course block
    expect(screen.queryByText('Electives')).not.toBeInTheDocument()
  })

  it('calls the detail hook with the cc: prefixed id', () => {
    mockDetail.mockReturnValue({ data: { degrees: [degree()] }, isLoading: false, isError: false })
    render(<AsDegreeSchoolView collegeId={41} />)
    expect(mockDetail).toHaveBeenCalledWith('cc:41')
  })

  it('shows a degree selector and switches when a college has several degrees', () => {
    mockDetail.mockReturnValue({
      data: { degrees: [
        degree({ degree_type: 'local_cs_as', doc: { ...degree().doc, degree_title_seen: 'Local CS A.S.' } }),
        degree({ degree_type: 'ast', coverage_pct: 100, missing_core_concepts: [],
          doc: { ...degree().doc, degree_title_seen: 'CS for Transfer' } }),
      ] }, isLoading: false, isError: false,
    })
    render(<AsDegreeSchoolView collegeId={14} />)
    expect(screen.getAllByText('Local A.S.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transfer (ADT)').length).toBeGreaterThan(0)
    expect(screen.getByText('Local CS A.S.')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Transfer (ADT)')[0])
    expect(screen.getByText('CS for Transfer')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('omits the coverage tile for local_computing (no template)', () => {
    mockDetail.mockReturnValue({
      data: { degrees: [degree({ degree_type: 'local_computing', coverage_pct: null, missing_core_concepts: [] })] },
      isLoading: false, isError: false,
    })
    render(<AsDegreeSchoolView collegeId={5} />)
    expect(screen.getByText('Total units')).toBeInTheDocument()
    expect(screen.queryByText('Template coverage')).not.toBeInTheDocument()
  })

  it('shows an empty state when the college has no data', () => {
    mockDetail.mockReturnValue({ data: null, isLoading: false, isError: true })
    render(<AsDegreeSchoolView collegeId={999} />)
    expect(screen.getByText(/No associate-degree data/i)).toBeInTheDocument()
  })
})
