import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AsDegreeSchoolView from './AsDegreeSchoolView'

const mockDetail = vi.fn()
vi.mock('../shared/query/hooks/useData', () => ({
  useAsDegreeDetail: (...args) => mockDetail(...args),
}))

const receiver = (id) => ({
  receiving: null, articulation_status: 'articulated', not_articulated_reason: null,
  options: [{ course_ids: [id], course_conjunction: 'and', course_keys: [`cc:${id}`] }],
  options_conjunction: 'and', hash_id: null,
})

const LOCAL_GE_BREAKDOWN = {
  pattern: 'local_pattern', assumed: true,
  areas: [
    { code: 'NS', name: 'Natural Sciences', qualifying_count: null },
    { code: 'SB', name: 'Social & Behavioral Sciences', qualifying_count: null },
    { code: 'H', name: 'Humanities', qualifying_count: null },
    { code: 'LR', name: 'Language & Rationality', qualifying_count: null },
    { code: 'M', name: 'Mathematics Competency', qualifying_count: null },
  ],
}

const degree = (over = {}) => ({
  degree_type: 'local_cs_as',
  ge_breakdowns: { local_pattern: LOCAL_GE_BREAKDOWN },
  courses_by_id: {
    'cc:1': { course_id: 1, prefix: 'CS', number: '21', code: 'CS 21',
      title: 'Programming Concepts', units: 4, concept: 'cs_1' },
    'cc:2': { course_id: 2, prefix: 'MATH', number: '5A', code: 'MATH 5A',
      title: 'Calculus I', units: 5, concept: 'calc_1' },
  },
  doc: {
    degree_title_seen: 'Computer Science - Associate in Science (A.S.)',
    unit_system: 'semester', total_units: 60,
    catalog_url: 'https://cabrillo.example/cs', catalog_year: '2025-2026',
    requirement_groups: [
      { group_id: 'core', label_seen: 'Required Major (Complete the following credits: 14)',
        is_required: true, ge_area: null, units_fill: false,
        sections: [{ section_advisement: 2, unit_advisement: null,
          receivers: [receiver(1), receiver(2)] }],
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
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.queryByText('Template coverage')).not.toBeInTheDocument()
    // Courses render through the shared RequirementsLedger: cleaned group
    // title, course code + title, and the ledger's unit chip.
    expect(screen.getByRole('heading', { name: 'Required Major' })).toBeInTheDocument()
    expect(screen.getByText('CS 21')).toBeInTheDocument()
    expect(screen.getByText('Programming Concepts')).toBeInTheDocument()
    expect(screen.getByText('4u')).toBeInTheDocument()
    expect(screen.getByText('Complete all of:')).toBeInTheDocument()
    expect(screen.getByText(/2025-2026 catalog/)).toBeInTheDocument()
    expect(screen.queryByText(/not hand-verified/)).not.toBeInTheDocument()
    // GE renders through the ledger with one row per pattern AREA — the same
    // "qualifying courses" treatment as Graduation Requirements Coverage.
    expect(screen.getByRole('heading', { name: 'General education' })).toBeInTheDocument()
    expect(screen.getByText('Complete 18 units of:')).toBeInTheDocument()
    expect(screen.getByText('Approved courses from the college GE pattern')).toBeInTheDocument()
    expect(screen.getByText('Natural Sciences')).toBeInTheDocument()
    expect(screen.getByText('Language & Rationality')).toBeInTheDocument()
    // Local patterns have no course tags -> the assumed category variant.
    expect(screen.getAllByText('Qualifying community-college course')).toHaveLength(5)
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
    expect(screen.queryByText('Template coverage')).not.toBeInTheDocument()
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
