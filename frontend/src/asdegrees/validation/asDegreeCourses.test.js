import { describe, it, expect } from 'vitest'
import {
  groupCourseIds, courseLabel, setGroupCourses, isComplexGroup,
} from './asDegreeCourses'

const flatGroup = {
  group_id: 'core',
  source: 'extracted',
  confidence: 0.8,
  sections: [{ receivers: [{ options: [{ course_ids: [1] }, { course_ids: [2] }] }] }],
}

describe('groupCourseIds', () => {
  it('flattens the nesting to one ordered, de-duplicated list', () => {
    expect(groupCourseIds(flatGroup)).toEqual([1, 2])
  })

  it('survives a group with no sections at all', () => {
    expect(groupCourseIds({ group_id: 'empty' })).toEqual([])
  })
})

describe('setGroupCourses', () => {
  it('writes the courses back and marks the group curated', () => {
    const next = setGroupCourses(flatGroup, [2, 3])
    expect(groupCourseIds(next)).toEqual([2, 3])
    expect(next.source).toBe('curated')
    expect(next.confidence).toBeNull()
  })

  it('drops duplicates and keeps the group id', () => {
    const next = setGroupCourses(flatGroup, [5, 5, 6])
    expect(groupCourseIds(next)).toEqual([5, 6])
    expect(next.group_id).toBe('core')
  })

  it('can empty a group', () => {
    expect(groupCourseIds(setGroupCourses(flatGroup, []))).toEqual([])
  })
})

describe('isComplexGroup', () => {
  it('is false for the ordinary flat case', () => {
    expect(isComplexGroup(flatGroup)).toBe(false)
  })

  it('is true when an option pairs two courses', () => {
    expect(isComplexGroup({
      sections: [{ receivers: [{ options: [{ course_ids: [1, 2] }] }] }],
    })).toBe(true)
  })

  it('is true for multiple receivers or sections', () => {
    expect(isComplexGroup({
      sections: [{ receivers: [{ options: [] }, { options: [] }] }],
    })).toBe(true)
    expect(isComplexGroup({ sections: [{ receivers: [] }, { receivers: [] }] })).toBe(true)
  })
})

describe('courseLabel', () => {
  it('reads like a catalog line', () => {
    expect(courseLabel({ prefix: 'MATH', number: '1A', title: 'Calculus I' }))
      .toBe('MATH 1A — Calculus I')
  })

  it('falls back to the id when the course is unknown', () => {
    expect(courseLabel({ course_id: 42 })).toBe('42')
    expect(courseLabel(null)).toBeNull()
  })
})
