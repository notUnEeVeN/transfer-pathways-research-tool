import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MultiCampusPathways, { calendarModel, termRangeFor, termText } from './MultiCampusPathways'

const mockPlanner = vi.fn()
const mockSchools = vi.fn()
const mockColleges = vi.fn()

vi.mock('../shared/query/hooks/useData', () => ({
  useMultiCampusPathways: (...args) => mockPlanner(...args),
  useSchools: () => mockSchools(),
  useColleges: () => mockColleges(),
}))

const schools = [
  { id: 120, name: 'UC Irvine' },
  { id: 89, name: 'UC Davis' },
  { id: 79, name: 'UC Berkeley' },
]

const averageData = {
  programs: [
    { school_id: 79, school: 'UC Berkeley', program: 'Electrical Engineering and Computer Sciences' },
    { school_id: 89, school: 'UC Davis', program: 'Computer Science' },
  ],
  summary: {
    colleges_analyzed: 2,
    mean_semester_equiv_units: 43.5,
    mean_distinct_courses: 10.5,
    mean_optionality_premium_courses: 2.5,
  },
  rows: [
    {
      community_college_id: 10,
      community_college: 'Alpha College',
      unit_system: 'semester',
      status: 'optimal',
      combined: {
        distinct_courses: 10,
        native_units: 45,
        semester_equiv_units: 45,
        estimated_terms: 3,
        optionality_premium_courses: 2,
        schedule: { status: 'optimal' },
      },
    },
    {
      community_college_id: 51,
      community_college: 'Foothill College',
      unit_system: 'quarter',
      status: 'optimal',
      combined: {
        distinct_courses: 11,
        native_units: 63,
        semester_equiv_units: 42,
        estimated_terms: 6,
        optionality_premium_courses: 3,
        schedule: { status: 'optimal' },
      },
    },
  ],
}

const collegeData = {
  programs: averageData.programs,
  row: {
    community_college_id: 51,
    community_college: 'Foothill College',
    unit_system: 'quarter',
    status: 'optimal',
    combined: {
      distinct_courses: 3,
      native_units: 13.5,
      optionality_premium_courses: 1,
      schedule: {
        status: 'optimal',
        min_terms: 2,
        schedule: [
          { index: 1, course_ids: ['1', '3'] },
          { index: 2, course_ids: ['2'] },
        ],
      },
    },
    campuses: [
      { school_id: 79, school: 'UC Berkeley', requirements_required: 2, requirements_satisfied: 2, fully_satisfiable: true },
      { school_id: 89, school: 'UC Davis', requirements_required: 2, requirements_satisfied: 1, fully_satisfiable: false },
    ],
    courses: [
      { course_id: '1', code: 'CS 1', title: 'Introduction to Programming', units: 4.5, modeled_term: 1, role: 'major_preparation', school_ids: [79, 89] },
      { course_id: '2', code: 'CS 2', title: 'Data Structures', units: 4.5, modeled_term: 2, role: 'major_preparation', school_ids: [79], prerequisite_ids: ['1'] },
      { course_id: '3', code: 'MATH 1', title: 'Calculus', units: 4.5, modeled_term: 1, role: 'major_preparation', school_ids: [89] },
    ],
  },
}

describe('MultiCampusPathways', () => {
  beforeEach(() => {
    mockPlanner.mockReset()
    mockSchools.mockReset()
    mockColleges.mockReset()
    mockSchools.mockReturnValue({ data: { uc: schools }, isLoading: false, isError: false })
    mockColleges.mockReturnValue({ data: [{ id: 10, name: 'Alpha College' }, { id: 51, name: 'Foothill College' }], isLoading: false, isError: false })
    mockPlanner.mockImplementation((params) => ({
      data: params.mode === 'college' && params.communityCollegeId != null ? collegeData : averageData,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    }))
  })

  it('shows separate semester and quarter summaries, an average table, and the permanent caveat', () => {
    render(<MultiCampusPathways />)

    expect(mockPlanner).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'average', schoolIds: [79, 89], semesterLoad: 15, quarterLoad: 15 }),
      expect.any(Object),
    )
    expect(screen.getByText('Mean coursework')).toBeInTheDocument()
    expect(screen.getByText('43.5 units')).toBeInTheDocument()
    expect(screen.getByLabelText('Semester colleges by estimated terms')).toBeInTheDocument()
    expect(screen.getByLabelText('Quarter colleges by estimated terms')).toBeInTheDocument()
    expect(screen.getByLabelText('3 semesters: 1 college')).toBeInTheDocument()
    expect(screen.getByLabelText('6 quarters: 1 college')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Alpha College' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Foothill College' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('not a prediction of time to degree')
    expect(screen.getByRole('note')).toHaveTextContent('required lower division major preparation')
  })

  it('treats target campuses as an unordered set and supports all available targets', () => {
    render(<MultiCampusPathways />)

    fireEvent.click(screen.getByRole('button', { name: 'Irvine' }))
    expect(mockPlanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ schoolIds: [79, 89, 120] }),
      expect.any(Object),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Berkeley' }))
    expect(mockPlanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ schoolIds: [89, 120] }),
      expect.any(Object),
    )
    expect(screen.getByText(/2 selected · choose one to nine/)).toBeInTheDocument()
  })

  it('builds a specific-college sequence and course table after a college is selected', () => {
    render(<MultiCampusPathways />)

    fireEvent.click(screen.getByRole('tab', { name: 'Specific college' }))
    expect(screen.getByText('Choose a community college')).toBeInTheDocument()

    const collegeInput = screen.getByRole('combobox')
    fireEvent.focus(collegeInput)
    fireEvent.change(collegeInput, { target: { value: 'Foothill' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Foothill College' }))

    expect(mockPlanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'college', communityCollegeId: 51, schoolIds: [79, 89] }),
      expect.any(Object),
    )
    expect(screen.getByText('Earliest modeled course sequence')).toBeInTheDocument()
    expect(screen.getByText('Quarter 1')).toBeInTheDocument()
    expect(screen.getByText('Quarter 2')).toBeInTheDocument()
    expect(screen.getAllByText('CS 1').length).toBeGreaterThan(1)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Data Structures')).toBeInTheDocument()
    expect(within(table).getAllByText('CS 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Complete path')).toBeInTheDocument()
    expect(screen.getByText('Available preparation')).toBeInTheDocument()
  })

  it('sends calendar-specific load changes to the planner', () => {
    render(<MultiCampusPathways />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Units per semester' }), { target: { value: '12' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Units per quarter' }), { target: { value: '18' } })
    expect(mockPlanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ semesterLoad: 12, quarterLoad: 18 }),
      expect.any(Object),
    )
  })

  it('does not silently classify an unknown calendar as semester', () => {
    mockPlanner.mockReturnValue({
      data: {
        ...averageData,
        summary: { colleges_analyzed: 1 },
        rows: [{
          community_college_id: 99,
          community_college: 'Calendar Pending College',
          unit_system: null,
          combined: { distinct_courses: 8, native_units: 36, estimated_terms: 3 },
        }],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    render(<MultiCampusPathways />)

    expect(screen.getByRole('cell', { name: 'Calendar unavailable' })).toBeInTheDocument()
    expect(screen.getAllByText('No usable term estimates in this calendar.')).toHaveLength(2)
    expect(screen.queryByLabelText('3 semesters: 1 college')).not.toBeInTheDocument()
    expect(screen.queryByText('3 semesters')).not.toBeInTheDocument()
  })
})

describe('multi-campus term labels', () => {
  it('shows a certified exact result only when min_terms is present and a range for bounded schedules', () => {
    expect(termRangeFor({ combined: { schedule: { status: 'optimal', min_terms: 4 } } })).toEqual({ low: 4, high: 4, exact: true })
    const bounded = { combined: { schedule: { status: 'bounded', lower_bound_terms: 4, upper_bound_terms: 6 } } }
    expect(termRangeFor(bounded)).toEqual({ low: 4, high: 6, exact: false })
    expect(termText(bounded, 'semester')).toBe('4–6 semesters')
  })

  it('does not turn a bounded upper estimate into an exact histogram point', () => {
    const rows = [{
      unit_system: 'semester',
      combined: { schedule: { status: 'bounded', lower_bound_terms: 4, upper_bound_terms: 6 } },
    }]
    expect(calendarModel({}, rows, 'semester')).toMatchObject({
      n: 1,
      exactN: 0,
      boundedN: 1,
      mean: null,
      median: null,
      bins: [],
    })
  })
})
