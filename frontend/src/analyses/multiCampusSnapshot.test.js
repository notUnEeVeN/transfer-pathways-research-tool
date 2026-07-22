import { describe, expect, it } from 'vitest'
import {
  canonicalSchoolIds, combinationMask, materializeAverageSnapshot,
} from './multiCampusSnapshot'

const campuses = Array.from({ length: 9 }, (_, index) => ({
  school_id: (index + 1) * 10,
  school: `Campus ${index + 1}`,
  major: 'Computer Science',
}))

const rowFields = [
  'status', 'plan_status', 'prerequisite_status', 'schedule_status',
  'warning_indices', 'strict_complete_mask', 'combined.distinct_courses',
  'combined.native_units', 'combined.estimated_terms',
]

const row = (strictCompleteMask, warningIndices = []) => [
  'optimal', 'optimal', 'complete', 'optimal', warningIndices,
  strictCompleteMask, 10, 45, 3,
]

const snapshot = {
  schema_version: 1,
  generated_at: '2026-07-21T12:00:00.000Z',
  default_load_profile: 's15-q15',
  row_fields: rowFields,
  campuses,
  colleges: [
    { community_college_id: 1, community_college: 'Alpha College', unit_system: 'semester' },
    { community_college_id: 2, community_college: 'Beta College', unit_system: 'quarter' },
  ],
  warnings: ['One agreement needs review.', 'Major preparation only.'],
  global_warning_indices: [1],
  load_profiles: {
    's15-q15': {
      semester_load: 15,
      quarter_load: 15,
      combinations: {
        1: {
          school_ids: [10],
          summary: { colleges_analyzed: 2, mean_distinct_courses: 9 },
          calendar_groups: [],
          rows: [row(1), row(0, [0])],
        },
        257: {
          school_ids: [10, 90],
          summary: { colleges_analyzed: 2, mean_distinct_courses: 12 },
          calendar_groups: [],
          rows: [row(257), row(1)],
        },
        511: {
          school_ids: campuses.map((campus) => campus.school_id),
          summary: { colleges_analyzed: 2, mean_distinct_courses: 18 },
          calendar_groups: [],
          rows: [row(511), row(255)],
        },
      },
    },
  },
}

describe('multi-campus average snapshots', () => {
  it('canonicalizes unordered selections and maps singleton/all-nine combinations', () => {
    expect(canonicalSchoolIds([90, 10, 90])).toEqual([10, 90])
    expect(combinationMask(snapshot, [10])).toBe(1)
    expect(combinationMask(snapshot, [90, 10])).toBe(257)
    expect(combinationMask(snapshot, campuses.map((campus) => campus.school_id).reverse())).toBe(511)
    expect(combinationMask(snapshot, [999])).toBeNull()
  })

  it('materializes aligned colleges, warning references, coverage, and metadata', () => {
    const result = materializeAverageSnapshot(snapshot, [90, 10])

    expect(result.summary.mean_distinct_courses).toBe(12)
    expect(result.programs.map((program) => program.school_id)).toEqual([10, 90])
    expect(result.rows[0]).toMatchObject({
      community_college_id: 1,
      community_college: 'Alpha College',
      unit_system: 'semester',
      warnings: [],
    })
    expect(result.rows[0].campuses.every((campus) => campus.strict_complete)).toBe(true)
    expect(result.rows[1].campuses.map((campus) => campus.strict_complete)).toEqual([true, false])
    expect(result.warnings).toEqual(['Major preparation only.'])
    expect(result.snapshot).toEqual({
      schema_version: 1,
      generated_at: '2026-07-21T12:00:00.000Z',
      profile_id: 's15-q15',
      semester_load: 15,
      quarter_load: 15,
      combination_mask: 257,
    })
  })

  it('materializes the all-nine mask and expands warning dictionary entries', () => {
    const allNine = materializeAverageSnapshot(snapshot, campuses.map((campus) => campus.school_id))
    const singleton = materializeAverageSnapshot(snapshot, [10])

    expect(allNine.snapshot.combination_mask).toBe(511)
    expect(allNine.programs).toHaveLength(9)
    expect(singleton.rows[1].warnings).toEqual(['One agreement needs review.'])
    expect(singleton.rows[1].campuses[0].strict_complete).toBe(false)
  })
})
