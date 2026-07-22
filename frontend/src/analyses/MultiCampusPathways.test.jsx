import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MultiCampusPathways, {
  MultiCampusPathwaysPreview, calendarModel, termRangeFor, termText,
} from './MultiCampusPathways'

const mockPlanner = vi.fn()
const mockSnapshot = vi.fn()
const mockSnapshotRefetch = vi.fn()
const mockSchools = vi.fn()
const mockColleges = vi.fn()

vi.mock('../shared/query/hooks/useData', () => ({
  useMultiCampusPathways: (...args) => mockPlanner(...args),
  useMultiCampusPathwaysSnapshot: (...args) => mockSnapshot(...args),
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

const snapshotRowFields = [
  'status', 'plan_status', 'prerequisite_status', 'schedule_status',
  'warning_indices', 'strict_complete_mask', 'combined.distinct_courses',
  'combined.native_units', 'combined.semester_equiv_units',
  'combined.estimated_terms', 'combined.optionality_premium_courses',
]

const compactAverageRows = averageData.rows.map((row) => [
  row.status, 'optimal', 'complete', 'optimal', [], 3,
  row.combined.distinct_courses, row.combined.native_units,
  row.combined.semester_equiv_units, row.combined.estimated_terms,
  row.combined.optionality_premium_courses,
])

const combination = (meanDistinctCourses, schoolIds) => ({
  school_ids: schoolIds,
  summary: {
    ...averageData.summary,
    mean_distinct_courses: meanDistinctCourses,
  },
  calendar_groups: [],
  rows: compactAverageRows,
})

const snapshotData = {
  schema_version: 1,
  generated_at: '2026-07-21T12:00:00.000Z',
  default_load_profile: 's15-q15',
  row_fields: snapshotRowFields,
  campuses: [
    ...averageData.programs,
    { school_id: 120, school: 'UC Irvine', program: 'Computer Science' },
  ],
  colleges: averageData.rows.map((row) => ({
    community_college_id: row.community_college_id,
    community_college: row.community_college,
    unit_system: row.unit_system,
  })),
  warnings: [],
  load_profiles: {
    's15-q15': {
      semester_load: 15,
      quarter_load: 15,
      combinations: {
        3: combination(10.5, [79, 89]),
        6: combination(12, [89, 120]),
        7: combination(13, [79, 89, 120]),
      },
    },
  },
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
      { school_id: 79, school: 'UC Berkeley', requirements_required: 2, requirements_satisfied: 2, product_complete: true, strict_complete: true, fully_satisfiable: true },
      { school_id: 89, school: 'UC Davis', requirements_required: 2, requirements_satisfied: 1, product_complete: true, strict_complete: false, fully_satisfiable: false },
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
    mockSnapshot.mockReset()
    mockSnapshotRefetch.mockReset()
    mockSchools.mockReset()
    mockColleges.mockReset()
    mockSchools.mockReturnValue({ data: { uc: schools }, isLoading: false, isError: false })
    mockColleges.mockReturnValue({ data: [{ id: 10, name: 'Alpha College' }, { id: 51, name: 'Foothill College' }], isLoading: false, isError: false })
    mockSnapshot.mockReturnValue({
      data: snapshotData,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mockSnapshotRefetch,
    })
    mockPlanner.mockImplementation((params) => ({
      data: params.communityCollegeId != null ? collegeData : undefined,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    }))
  })

  it('renders a data-free gallery preview without running the planner', () => {
    render(<MultiCampusPathwaysPreview />)
    expect(screen.getByText('Build one plan for several campuses')).toBeInTheDocument()
    expect(mockPlanner).not.toHaveBeenCalled()
    expect(mockSnapshot).not.toHaveBeenCalled()
  })

  it('shows separate semester and quarter summaries, an average table, and the permanent caveat', () => {
    render(<MultiCampusPathways />)

    expect(mockSnapshot).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
    expect(mockPlanner).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'college', schoolIds: [79, 89] }),
      expect.objectContaining({ enabled: false }),
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
    expect(screen.getByRole('note')).toHaveTextContent('required lower division preparation that has a usable local path')
    expect(document.querySelector('[data-export-root]')).toHaveTextContent('2 selected programs · 15 units per semester · 15 units per quarter')
    expect(document.querySelector('[data-export-root]')).toHaveTextContent('snapshot generated Jul 21, 2026')
    expect(screen.queryByRole('spinbutton', { name: 'Units per semester' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update estimate' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved snapshot' }))
    expect(mockSnapshotRefetch).toHaveBeenCalledOnce()
  })

  it('switches unordered target combinations immediately without enabling the live planner', () => {
    render(<MultiCampusPathways />)

    fireEvent.click(screen.getByRole('button', { name: 'Irvine' }))
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update estimate' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Berkeley' }))
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText(/2 selected · choose one to nine/)).toBeInTheDocument()
    expect(mockPlanner.mock.calls.every(([, options]) => options.enabled === false)).toBe(true)
  })

  it('fails closed when a retained snapshot is rejected for the current program scope', () => {
    mockSnapshot.mockReturnValue({
      data: snapshotData,
      error: { response: { status: 409 } },
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mockSnapshotRefetch,
    })

    render(<MultiCampusPathways />)

    expect(screen.getByText(/no longer matches the current working program selection/i)).toBeInTheDocument()
    expect(screen.queryByText('Mean coursework')).not.toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'Alpha College' })).not.toBeInTheDocument()
    expect(screen.queryByText('43.5 units')).not.toBeInTheDocument()
  })

  it('keeps retained snapshot data visible through an ordinary transient refresh error', () => {
    mockSnapshot.mockReturnValue({
      data: snapshotData,
      error: { response: { status: 503 } },
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mockSnapshotRefetch,
    })

    render(<MultiCampusPathways />)

    expect(screen.getByText('Mean coursework')).toBeInTheDocument()
    expect(screen.getByText('43.5 units')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Alpha College' })).toBeInTheDocument()
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
    expect(screen.getByText('Minimum-term sequence for this course set')).toBeInTheDocument()
    expect(screen.getByText('Quarter 1')).toBeInTheDocument()
    expect(screen.getByText('Quarter 2')).toBeInTheDocument()
    expect(screen.getByText('2 courses · 9 units')).toBeInTheDocument()
    expect(screen.getByText('1 course · 4.5 units')).toBeInTheDocument()
    expect(screen.getAllByText('CS 1').length).toBeGreaterThan(1)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Data Structures')).toBeInTheDocument()
    expect(within(table).getAllByText('CS 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Full agreement covered')).toBeInTheDocument()
    expect(screen.getByText('Local coursework covered')).toBeInTheDocument()
    expect(document.querySelector('[data-export-root]')).toHaveTextContent('Foothill College · 2 selected programs · 15 quarter units per term')
  })

  it('carries the visible average targets into specific-college mode', () => {
    render(<MultiCampusPathways />)
    fireEvent.click(screen.getByRole('button', { name: 'Irvine' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Specific college' }))

    const collegeInput = screen.getByRole('combobox')
    fireEvent.focus(collegeInput)
    fireEvent.change(collegeInput, { target: { value: 'Foothill' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Foothill College' }))

    expect(mockPlanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ schoolIds: [79, 89, 120], communityCollegeId: 51 }),
      expect.objectContaining({ enabled: true }),
    )
    expect(screen.queryByText(/Changes are ready/)).not.toBeInTheDocument()
  })

  it('labels a bounded schedule as one feasible sequence instead of a proven minimum', () => {
    const boundedCollege = {
      ...collegeData,
      row: {
        ...collegeData.row,
        status: 'bounded',
        combined: {
          ...collegeData.row.combined,
          schedule: {
            ...collegeData.row.combined.schedule,
            status: 'bounded',
            min_terms: null,
            lower_bound_terms: 2,
            upper_bound_terms: 3,
          },
        },
      },
    }
    mockPlanner.mockImplementation((params) => ({
      data: params.mode === 'college' && params.communityCollegeId != null
        ? boundedCollege
        : averageData,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    }))

    render(<MultiCampusPathways />)
    fireEvent.click(screen.getByRole('tab', { name: 'Specific college' }))
    const collegeInput = screen.getByRole('combobox')
    fireEvent.focus(collegeInput)
    fireEvent.change(collegeInput, { target: { value: 'Foothill' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Foothill College' }))

    expect(screen.getByText('Feasible modeled sequence')).toBeInTheDocument()
    expect(screen.queryByText('Minimum-term sequence for this course set')).not.toBeInTheDocument()
    expect(screen.getByText(/minimum length is within the displayed lower and upper bounds/i)).toBeInTheDocument()
  })

  it('sends calendar-specific load changes to the planner', () => {
    render(<MultiCampusPathways />)
    fireEvent.click(screen.getByRole('tab', { name: 'Specific college' }))
    const collegeInput = screen.getByRole('combobox')
    fireEvent.focus(collegeInput)
    fireEvent.change(collegeInput, { target: { value: 'Foothill' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Foothill College' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Units per semester' }), { target: { value: '12' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Units per quarter' }), { target: { value: '18' } })
    expect(screen.getByRole('button', { name: 'Update estimate' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update estimate' }))
    expect(mockPlanner).toHaveBeenLastCalledWith(
      expect.objectContaining({ semesterLoad: 12, quarterLoad: 18 }),
      expect.any(Object),
    )
  })

  it('does not silently classify an unknown calendar as semester', () => {
    const unknownSnapshot = {
      ...snapshotData,
      colleges: [{
        community_college_id: 99,
        community_college: 'Calendar Pending College',
        unit_system: null,
      }],
      load_profiles: {
        's15-q15': {
          ...snapshotData.load_profiles['s15-q15'],
          combinations: {
            ...snapshotData.load_profiles['s15-q15'].combinations,
            3: {
              school_ids: [79, 89],
              summary: { colleges_analyzed: 1 },
              calendar_groups: [],
              rows: [{
                status: 'optimal',
                strict_complete_mask: 3,
                warning_indices: [],
                combined: { distinct_courses: 8, native_units: 36, estimated_terms: 3 },
              }],
            },
          },
        },
      },
    }
    mockSnapshot.mockReturnValue({
      data: unknownSnapshot,
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
