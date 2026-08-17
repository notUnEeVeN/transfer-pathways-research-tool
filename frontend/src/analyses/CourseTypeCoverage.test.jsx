import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CourseTypeCoverage, { buildCourseTypeModel, columnsFor } from './CourseTypeCoverage'
import { useCoverage } from '../shared/query/hooks/useData'
import { useMajors } from '../shared/majors/useMajors'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))
vi.mock('../shared/majors/useMajors', () => ({ useMajors: vi.fn() }))

// The rollups the server config declares. Computer Science's is the identity —
// its four typed categories are already the paper's four columns — so it has no
// extended variant and the grouping toggle must not appear for it.
const CS_MAJOR = {
  slug: 'cs',
  label: 'Computer Science',
  courseTypes: {
    module: 'cs',
    axes: {
      faithful: [
        { key: 'computing', label: 'Computing', categories: ['computing'] },
        { key: 'math', label: 'Math', categories: ['math'] },
        { key: 'science', label: 'Science', categories: ['science'] },
        { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
      ],
    },
  },
}

const BIO_MAJOR = {
  slug: 'bio',
  label: 'Biology',
  courseTypes: {
    module: 'bio',
    axes: {
      faithful: [
        { key: 'biology', label: 'Biology', categories: ['bio_series'] },
        { key: 'math', label: 'Math', categories: ['calculus', 'statistics', 'computing'] },
        { key: 'chem_physics', label: 'Chemistry & Physics', categories: ['gen_chem', 'organic_chem', 'physics'] },
        { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
      ],
      extended: [
        { key: 'biology', label: 'Biology', categories: ['bio_series'] },
        { key: 'chemistry', label: 'Chemistry', categories: ['gen_chem', 'organic_chem'] },
        { key: 'physics', label: 'Physics', categories: ['physics'] },
        { key: 'math', label: 'Math', categories: ['calculus', 'statistics'] },
        { key: 'computing', label: 'Computing', categories: ['computing'] },
        { key: 'non_stem', label: 'Non-STEM', categories: ['non_stem'] },
      ],
    },
  },
}

const CS_COLUMNS = columnsFor(CS_MAJOR)

const CAMPUSES = [
  { school_id: 7, school: 'UC San Diego' },
  { school_id: 89, school: 'University of California, Davis' },
  { school_id: 120, school: 'UC Irvine' },
]
const COLLEGES = [10, 20, 30, 40]

// Davis covers half its computing slots at every college; San Diego none;
// Irvine requires no science at all, so it contributes no science point.
// Six of the ten computing slots are upper-division and never covered, so the
// two scopes disagree exactly where the real figure does.
function slotsFor(schoolId, collegeId) {
  const computingCovered = schoolId === 89 ? 4 : schoolId === 120 ? 4 : 0
  return {
    computing: {
      total: 10,
      covered: computingCovered,
      lower_division_total: 4,
      lower_division_covered: computingCovered,
    },
    math: {
      total: 4,
      covered: collegeId === 40 ? 2 : 4,
      lower_division_total: 4,
      lower_division_covered: collegeId === 40 ? 2 : 4,
    },
    science: schoolId === 120
      ? { total: 0, covered: 0, lower_division_total: 0, lower_division_covered: 0 }
      : { total: 2, covered: 2, lower_division_total: 2, lower_division_covered: 2 },
    non_stem: {
      total: 5, covered: 4, lower_division_total: 4, lower_division_covered: 4,
    },
  }
}

function rows() {
  return CAMPUSES.flatMap((campus) => COLLEGES.map((collegeId) => ({
    school_id: campus.school_id,
    school: campus.school,
    community_college_id: collegeId,
    community_college: `College ${collegeId}`,
    degree_requirements_by_course_type: slotsFor(campus.school_id, collegeId),
  })))
}

describe('course type coverage', () => {
  const refetch = vi.fn()

  beforeEach(() => {
    refetch.mockReset()
    useMajors.mockReset()
    useMajors.mockReturnValue({
      bySlug: new Map([['cs', CS_MAJOR], ['bio', BIO_MAJOR]]),
    })
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: rows() },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    })
  })

  it('prefers a passed major object over the registry, so state corpora render columns', () => {
    // ma-cs is not in the California registry (bySlug misses), which used to
    // leave columnsFor(null) empty and the whole figure blank on the MA tab.
    render(<CourseTypeCoverage majorSlug='ma-cs' major={CS_MAJOR} />)
    expect(screen.getByText('Requirements counted')).toBeInTheDocument()
    expect(screen.queryAllByText(/Computing|Math/).length).toBeGreaterThan(0)
  })

  it('averages each campus over its colleges and drops types it does not require', () => {
    const model = buildCourseTypeModel(rows(), 'whole-degree', CS_COLUMNS)
    const byKey = Object.fromEntries(model.columns.map((column) => [column.key, column]))

    expect(model.campusCount).toBe(3)
    expect(model.collegeCount).toBe(4)
    expect(byKey.computing.points.map((point) => [point.campus, point.value]))
      .toEqual([['San Diego', 0], ['Davis', 40], ['Irvine', 40]])
    expect(byKey.computing.mean).toBeCloseTo(26.7, 1)
    // 4 of 4 slots at three colleges, 2 of 4 at the fourth.
    expect(byKey.math.points[0].value).toBe(87.5)
    expect(byKey.science.points.map((point) => point.campus)).toEqual(['Davis', 'San Diego'])
    expect(byKey.science.mean).toBe(100)
    expect(byKey.non_stem.points).toHaveLength(3)
  })

  it('counts only lower-division slots when the scope asks for them', () => {
    const lower = buildCourseTypeModel(rows(), 'lower-division', CS_COLUMNS)
    const whole = buildCourseTypeModel(rows(), 'whole-degree', CS_COLUMNS)
    const computing = (model) => model.columns.find((column) => column.key === 'computing')

    expect(whole.scope).toBe('whole-degree')
    expect(lower.scope).toBe('lower-division')
    // Same four covered slots, but out of four rather than ten.
    expect(computing(lower).points.map((point) => point.value)).toEqual([0, 100, 100])
    expect(computing(whole).points.map((point) => point.value)).toEqual([0, 40, 40])
    // Non-STEM's one uncovered slot is upper-division, so it clears to 100%.
    expect(lower.columns.find((column) => column.key === 'non_stem').mean).toBe(100)
  })

  it('normalizes campus names and counts colleges behind each point', () => {
    const model = buildCourseTypeModel(rows(), 'whole-degree', CS_COLUMNS)
    const davis = model.columns[0].points.find((point) => point.campus === 'Davis')

    expect(davis.colleges).toBe(4)
  })

  it('defaults to lower-division requirements and renders one dot per campus per type', () => {
    const { container } = render(<CourseTypeCoverage />)

    expect(container.querySelectorAll('[data-column]')).toHaveLength(4)
    // 3 campuses in three types, 2 in science.
    expect(container.querySelectorAll('[data-point]')).toHaveLength(11)
    expect(container.querySelectorAll('[data-mean]')).toHaveLength(4)
    expect(screen.getByRole('img', { name: /Computing at Davis: 100 percent of required courses/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Science average across campuses: 100 percent/i })).toBeTruthy()
    expect(screen.getByText('Course Type')).toBeTruthy()
    expect(screen.getByText('Mean')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Whole degree' }))
    expect(screen.getByRole('img', { name: /Computing at Davis: 40 percent of required courses/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Lower-division only' }))
    expect(screen.getByRole('img', { name: /Computing at Davis: 100 percent of required courses/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }))
    expect(refetch).toHaveBeenCalledOnce()
    expect(useCoverage).toHaveBeenCalledWith(
      {
        majorSlug: 'cs',
        groupBy: 'college',
        requirements: 'degree',
        pin: 'settings',
      },
      expect.objectContaining({ refetchOnWindowFocus: false, refetchInterval: false })
    )
  })

  it('separates overlapping points instead of drawing them on top of each other', () => {
    const { container } = render(<CourseTypeCoverage />)
    const nonStem = container.querySelector('[data-column="non_stem"]')
    const circles = [...nonStem.querySelectorAll('circle')]
    const xs = circles.map((circle) => Number(circle.getAttribute('cx')))

    // All three campuses sit at 80%, so the swarm must spread them.
    expect(new Set(circles.map((circle) => circle.getAttribute('cy'))).size).toBe(1)
    expect(new Set(xs).size).toBe(3)
  })
})

// Biology's fine categories, as the server sends them. Chemistry is the
// largest block, which is the thing the four-column rollup necessarily hides.
function bioSlots(schoolId) {
  const full = (total, covered) => ({
    total, covered, lower_division_total: total, lower_division_covered: covered,
  })
  const none = full(0, 0)
  return {
    bio_series: full(4, 4),
    gen_chem: full(6, 6),
    organic_chem: full(4, 2),
    physics: full(4, 4),
    calculus: full(2, 2),
    statistics: schoolId === 7 ? none : full(1, 1),
    computing: schoolId === 144 ? full(2, 1) : none,
    non_stem: full(5, 4),
  }
}

function bioRows() {
  return [7, 89, 144].flatMap((schoolId) => [10, 20].map((collegeId) => ({
    school_id: schoolId,
    school: `UC ${schoolId}`,
    community_college_id: collegeId,
    degree_requirements_by_course_type: bioSlots(schoolId),
  })))
}

describe('biology rollups', () => {
  beforeEach(() => {
    useMajors.mockReset()
    useMajors.mockReturnValue({
      bySlug: new Map([['cs', CS_MAJOR], ['bio', BIO_MAJOR]]),
    })
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: bioRows() },
      isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    })
  })

  it('sums the fine categories a faithful column rolls up', () => {
    const model = buildCourseTypeModel(bioRows(), 'whole-degree', columnsFor(BIO_MAJOR))
    const byKey = Object.fromEntries(model.columns.map((column) => [column.key, column]))

    expect(model.columns.map((column) => column.label))
      .toEqual(['Biology', 'Math', 'Chemistry & Physics', 'Non-STEM'])
    // gen_chem 6/6 + organic 2/4 + physics 4/4 = 12 of 14.
    expect(byKey.chem_physics.points[0].value).toBeCloseTo(85.7, 1)
    expect(byKey.biology.points[0].value).toBe(100)
  })

  it('separates chemistry from physics only in the extended variant', () => {
    const extended = buildCourseTypeModel(
      bioRows(), 'whole-degree', columnsFor(BIO_MAJOR, 'extended')
    )
    const byKey = Object.fromEntries(extended.columns.map((column) => [column.key, column]))

    expect(extended.columns).toHaveLength(6)
    // Chemistry alone is 8 of 10 — the organic gap, which the faithful column
    // dilutes with a fully covered physics series.
    expect(byKey.chemistry.points[0].value).toBe(80)
    expect(byKey.physics.points[0].value).toBe(100)
  })

  it('drops a column at campuses that require nothing in it', () => {
    const extended = buildCourseTypeModel(
      bioRows(), 'whole-degree', columnsFor(BIO_MAJOR, 'extended')
    )
    const computing = extended.columns.find((column) => column.key === 'computing')

    // Only one of the three campuses requires any computing, exactly as the
    // source figure carries fewer points in its Non-STEM column.
    expect(computing.points).toHaveLength(1)
    expect(computing.points[0].value).toBe(50)
  })

  it('offers the grouping toggle for biology and switches the columns', () => {
    const { container } = render(<CourseTypeCoverage majorSlug='bio' majorLabel='Biology' />)

    expect(container.querySelectorAll('[data-column]')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'By discipline' }))
    expect(container.querySelectorAll('[data-column]')).toHaveLength(6)
    expect(screen.getByText('Chemistry')).toBeTruthy()
    expect(screen.getByText('Physics')).toBeTruthy()
  })

  it('requests coverage for the selected major, not Computer Science', () => {
    render(<CourseTypeCoverage majorSlug='bio' majorLabel='Biology' />)

    expect(useCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ majorSlug: 'bio' }),
      expect.anything()
    )
  })

  it('hides the grouping toggle for a major with no extended axis set', () => {
    useCoverage.mockReturnValue({
      data: { rows: rows() }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    })
    render(<CourseTypeCoverage majorSlug='cs' majorLabel='Computer Science' />)

    expect(screen.queryByRole('button', { name: 'By discipline' })).toBeNull()
  })
})
