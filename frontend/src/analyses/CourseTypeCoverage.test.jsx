import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CourseTypeCoverage, { buildCourseTypeModel } from './CourseTypeCoverage'
import { useCoverage } from '../shared/query/hooks/useData'

vi.mock('../shared/query/hooks/useData', () => ({ useCoverage: vi.fn() }))

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
    useCoverage.mockReset()
    useCoverage.mockReturnValue({
      data: { rows: rows() },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    })
  })

  it('averages each campus over its colleges and drops types it does not require', () => {
    const model = buildCourseTypeModel(rows())
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
    const lower = buildCourseTypeModel(rows(), 'lower-division')
    const whole = buildCourseTypeModel(rows())
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
    const model = buildCourseTypeModel(rows())
    const davis = model.columns[0].points.find((point) => point.campus === 'Davis')

    expect(davis.colleges).toBe(4)
  })

  it('renders one dot per campus per required type, plus a mean diamond', () => {
    const { container } = render(<CourseTypeCoverage />)

    expect(container.querySelectorAll('[data-column]')).toHaveLength(4)
    // 3 campuses in three types, 2 in science.
    expect(container.querySelectorAll('[data-point]')).toHaveLength(11)
    expect(container.querySelectorAll('[data-mean]')).toHaveLength(4)
    expect(screen.getByRole('img', { name: /Computing at Davis: 40 percent of required courses/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Science average across campuses: 100 percent/i })).toBeTruthy()
    expect(screen.getByText('Course Type')).toBeTruthy()
    expect(screen.getByText('Mean')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Lower-division only' }))
    expect(screen.getByRole('img', { name: /Computing at Davis: 100 percent of required courses/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Whole degree' }))
    expect(screen.getByRole('img', { name: /Computing at Davis: 40 percent of required courses/i })).toBeTruthy()

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
