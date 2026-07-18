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
    // No summary tiles: coverage % and total units (a statutory constant —
    // 60 semester / 90 quarter) are deliberately not shown.
    expect(screen.queryByText('Template coverage')).not.toBeInTheDocument()
    expect(screen.queryByText('Total units')).not.toBeInTheDocument()
    // Courses render through the shared RequirementsLedger: cleaned group
    // title, course code + title, and the ledger's unit chip.
    expect(screen.getByRole('heading', { name: 'Required Major' })).toBeInTheDocument()
    expect(screen.getByText('CS 21')).toBeInTheDocument()
    expect(screen.getByText('Programming Concepts')).toBeInTheDocument()
    expect(screen.getByText('4u')).toBeInTheDocument()
    expect(screen.getByText('Complete all of:')).toBeInTheDocument()
    expect(screen.getByText('Degree type')).toBeInTheDocument()
    expect(screen.getByText('College-defined CS degree')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Local CS A.S.' })).toHaveAttribute('aria-selected', 'true')
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

  it('clusters statewide GE areas into one card per parent area', () => {
    const CALGETC_BREAKDOWN = {
      pattern: 'calgetc', assumed: false,
      areas: [
        { code: '1A', name: 'English Composition', qualifying_count: 12 },
        { code: '1B', name: 'Critical Thinking & Composition', qualifying_count: 8 },
        { code: '1C', name: 'Oral Communication', qualifying_count: 5 },
        { code: '2', name: 'Mathematical Concepts & Quantitative Reasoning', qualifying_count: 14 },
        { code: '3A', name: 'Arts', qualifying_count: 20 },
        { code: '3B', name: 'Humanities', qualifying_count: 22 },
        { code: '4', name: 'Social & Behavioral Sciences', qualifying_count: 30 },
        { code: '5A', name: 'Physical Science', qualifying_count: 9 },
        { code: '5B', name: 'Biological Science', qualifying_count: 7 },
        { code: '5C', name: 'Laboratory Activity', qualifying_count: 6 },
        { code: '6', name: 'Ethnic Studies', qualifying_count: 3 },
      ],
    }
    mockDetail.mockReturnValue({
      data: { degrees: [degree({
        ge_breakdowns: { calgetc: CALGETC_BREAKDOWN },
        doc: { ...degree().doc, requirement_groups: [
          { group_id: 'ge', label_seen: 'General Education', ge_area: 'calgetc', units_fill: false,
            sections: [{ section_advisement: null, unit_advisement: 34, receivers: [] }],
            unresolved_courses_seen: [] },
        ] },
      })] }, isLoading: false, isError: false,
    })
    render(<AsDegreeSchoolView collegeId={41} />)
    expect(screen.getByRole('heading', { name: 'General education — Cal-GETC' })).toBeInTheDocument()
    // Sibling sub-areas share one card; standalone areas get their own.
    expect(screen.getByText('Area 1 · English Communication')).toBeInTheDocument()
    expect(screen.getByText('Area 2 · Mathematical Concepts & Quantitative Reasoning')).toBeInTheDocument()
    expect(screen.getByText('Area 5 · Physical & Biological Sciences')).toBeInTheDocument()
    expect(screen.getByText('GE 1A')).toBeInTheDocument()
    expect(screen.getByText('GE 1B')).toBeInTheDocument()
    expect(screen.getByText('GE 5C')).toBeInTheDocument()
    // The pattern-level unit ask reads once, as the group rule.
    expect(screen.getByText('Complete 34 units across the sections below.')).toBeInTheDocument()
    // Qualifying counts still ride each area row.
    expect(screen.getByText('12 qualifying courses')).toBeInTheDocument()
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
    expect(screen.getByRole('tab', { name: 'Local CS A.S.' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'CS A.S.-T' })).toBeInTheDocument()
    expect(screen.getByText('Local CS A.S.', { selector: 'p' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'CS A.S.-T' }))
    expect(screen.getByText('CS for Transfer')).toBeInTheDocument()
    expect(screen.queryByText('Template coverage')).not.toBeInTheDocument()
  })

  it('opens the requested degree type when reached from a statewide record', () => {
    mockDetail.mockReturnValue({
      data: { degrees: [
        degree({ degree_type: 'local_cs_as', doc: { ...degree().doc, degree_title_seen: 'Local CS A.S.' } }),
        degree({ degree_type: 'ast', doc: { ...degree().doc, degree_title_seen: 'CS A.S.-T detail' } }),
      ] },
      isLoading: false,
      isError: false,
    })
    render(<AsDegreeSchoolView collegeId={14} initialDegreeType='ast' />)
    expect(screen.getByText('CS A.S.-T detail')).toBeInTheDocument()
    expect(screen.queryByText('Local CS A.S.', { selector: 'p' })).not.toBeInTheDocument()
  })

  it('can isolate one degree type and suppress its repeated title', () => {
    mockDetail.mockReturnValue({
      data: { degrees: [
        degree({ degree_type: 'local_cs_as', doc: { ...degree().doc, degree_title_seen: 'Local CS A.S.' } }),
        degree({ degree_type: 'ast', doc: { ...degree().doc, degree_title_seen: 'CS A.S.-T detail' } }),
      ] },
      isLoading: false,
      isError: false,
    })
    render(<AsDegreeSchoolView collegeId={14} onlyDegreeType='ast' showDegreeTitle={false} />)
    expect(screen.queryByRole('tab', { name: 'Local CS A.S.' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'CS A.S.-T' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Statewide transfer degree')).toBeInTheDocument()
    expect(screen.queryByText('Local CS A.S.')).not.toBeInTheDocument()
    expect(screen.queryByText('CS A.S.-T detail')).not.toBeInTheDocument()
    expect(screen.getByText('CS 21')).toBeInTheDocument()
  })

  it('shows every allowed overlapping degree type and clearly identifies the active kind', () => {
    mockDetail.mockReturnValue({
      data: { degrees: [
        degree({ degree_type: 'ast', doc: { ...degree().doc, degree_title_seen: 'CS A.S.-T' } }),
        degree({ degree_type: 'local_cs_as', doc: { ...degree().doc, degree_title_seen: 'Local CS A.S.' } }),
        degree({ degree_type: 'local_computing', doc: { ...degree().doc, degree_title_seen: 'Distinct computing degree' } }),
      ] },
      isLoading: false,
      isError: false,
    })
    render(<AsDegreeSchoolView collegeId={14} initialDegreeType='ast'
      degreeTypes={['ast', 'local_cs_as', 'local_computing']} />)
    expect(screen.getByRole('tab', { name: 'CS A.S.-T' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Local CS A.S.' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Other computing' })).toBeInTheDocument()
    expect(screen.getByText('Statewide transfer degree')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Other computing' }))
    expect(screen.getByText('Other college-defined computing degree')).toBeInTheDocument()
    expect(screen.getByText('Distinct computing degree')).toBeInTheDocument()
  })

  it('renders a local_computing degree with no summary tiles', () => {
    mockDetail.mockReturnValue({
      data: { degrees: [degree({ degree_type: 'local_computing', coverage_pct: null, missing_core_concepts: [] })] },
      isLoading: false, isError: false,
    })
    render(<AsDegreeSchoolView collegeId={5} />)
    expect(screen.getByText('Computer Science - Associate in Science (A.S.)')).toBeInTheDocument()
    expect(screen.queryByText('Total units')).not.toBeInTheDocument()
    expect(screen.queryByText('Template coverage')).not.toBeInTheDocument()
  })

  it('shows an empty state when the college has no data', () => {
    mockDetail.mockReturnValue({ data: null, isLoading: false, isError: true })
    render(<AsDegreeSchoolView collegeId={999} />)
    expect(screen.getByText(/No associate-degree data/i)).toBeInTheDocument()
  })
})
