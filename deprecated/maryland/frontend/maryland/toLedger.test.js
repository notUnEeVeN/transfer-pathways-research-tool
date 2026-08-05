import { describe, it, expect } from 'vitest'
import { toLedgerMajor, courseLookups, COLLAPSE_ABOVE } from './toLedger'

const receiver = (over = {}) => ({
  receiving: { kind: 'course', course_id: 'md:crs:1', code: 'CS120', title: 'Intro', units: 3 },
  articulation_status: 'articulated',
  hash_id: 'h1',
  options_conjunction: 'or',
  options: [{ course_ids: ['md:crs:a'], course_keys: ['md:crs:a'], course_conjunction: 'or' }],
  ...over,
})

const agreement = (receivers) => ({
  _id: 'md:agr:1:2',
  major: 'Test',
  requirement_groups: [{
    group_id: 'g0', is_required: true, label: 'Group', group_conjunction: 'And',
    sections: [{ section_advisement: null, conjunction: 'and', receivers }],
  }],
})

const manyOptions = (n) => Array.from({ length: n }, (_, i) => ({
  course_ids: [`md:crs:x${i}`], course_keys: [`md:crs:x${i}`], course_conjunction: 'or',
}))

describe('courseLookups', () => {
  it('splits by side into the two lookups the ledger reads', () => {
    const { sending, universityCoursesById } = courseLookups([
      { _id: 'md:crs:a', side: 'sending', prefix: 'CMSC', number: '140', title: 'Intro', units: 4 },
      { _id: 'md:crs:1', side: 'receiving', prefix: 'CS', number: '120', title: 'Python', min_units: 3, max_units: 3 },
    ])
    // The ledger matches sending courses on `course_id`, not `_id`.
    expect(sending[0].course_id).toBe('md:crs:a')
    expect(sending[0].units).toBe(4)
    expect(universityCoursesById['md:crs:1']).toEqual({
      prefix: 'CS', number: '120', title: 'Python', min_units: 3, max_units: 3,
    })
  })

  it('falls back to units when min/max are absent', () => {
    const { universityCoursesById } = courseLookups([
      { _id: 'md:crs:1', side: 'receiving', prefix: 'CS', number: '1', units: 3 },
    ])
    expect(universityCoursesById['md:crs:1'].min_units).toBe(3)
  })
})

describe('toLedgerMajor', () => {
  it('bridges course_id to the parent_id the ledger resolves on', () => {
    const out = toLedgerMajor(agreement([receiver()]))
    const r = out.requirement_groups[0].sections[0].receivers[0]
    expect(r.receiving.parent_id).toBe('md:crs:1')
    expect(r.receiving.kind).toBe('course')
  })

  it('routes category slots to the generic Requirement row', () => {
    const out = toLedgerMajor(agreement([receiver({
      receiving: { kind: 'category', course_id: null, title: 'Science Elective' },
    })]))
    const r = out.requirement_groups[0].sections[0].receivers[0]
    // The ledger reads `name` for anything that is not course/series/ge_area.
    expect(r.receiving.kind).toBe('requirement')
    expect(r.receiving.name).toBe('Science Elective')
  })

  it('returns null for a malformed agreement', () => {
    expect(toLedgerMajor(null)).toBeNull()
    expect(toLedgerMajor({})).toBeNull()
  })
})

describe('collapsing broad requirements', () => {
  it('leaves a short option list expanded', () => {
    const out = toLedgerMajor(agreement([receiver({ options: manyOptions(COLLAPSE_ABOVE) })]))
    const r = out.requirement_groups[0].sections[0].receivers[0]
    expect(r.category_match).toBeUndefined()
    expect(r.collapsed_count).toBeNull()
  })

  it('collapses a long one into a qualifying count', () => {
    const out = toLedgerMajor(agreement([receiver({ options: manyOptions(45) })]))
    const r = out.requirement_groups[0].sections[0].receivers[0]
    expect(r.category_match.qualifying_count).toBe(45)
    // Not California copy: these courses are nothing to do with UC transfer.
    expect(r.category_match.caption).toBe('Qualifying courses at this college')
    expect(r.collapsed_count).toBe(45)
  })

  it('keeps the options so the engine and the count still read them', () => {
    const out = toLedgerMajor(agreement([receiver({ options: manyOptions(45) })]))
    expect(out.requirement_groups[0].sections[0].receivers[0].options).toHaveLength(45)
  })

  it('never collapses a gap row — that is the row the reader came for', () => {
    const out = toLedgerMajor(agreement([receiver({
      articulation_status: 'not_articulated', options: manyOptions(45),
    })]))
    expect(out.requirement_groups[0].sections[0].receivers[0].category_match).toBeUndefined()
  })

  it('prints everything at collapseAbove: Infinity', () => {
    const out = toLedgerMajor(agreement([receiver({ options: manyOptions(45) })]), {
      collapseAbove: Infinity,
    })
    expect(out.requirement_groups[0].sections[0].receivers[0].category_match).toBeUndefined()
  })
})

describe('onlyGaps', () => {
  it('keeps gap rows and drops satisfied ones', () => {
    const out = toLedgerMajor(agreement([
      receiver({ hash_id: 'ok' }),
      receiver({ hash_id: 'gap', articulation_status: 'not_articulated', options: [] }),
    ]), { onlyGaps: true })
    const rows = out.requirement_groups[0].sections[0].receivers
    expect(rows).toHaveLength(1)
    expect(rows[0].hash_id).toBe('gap')
  })

  it('drops sections and groups left empty rather than rendering blanks', () => {
    const out = toLedgerMajor(agreement([receiver()]), { onlyGaps: true })
    expect(out.requirement_groups).toHaveLength(0)
  })
})
