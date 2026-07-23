import { describe, it, expect } from 'vitest'
import { buildScaffold, saveBlockers } from './asDegreeScaffold'

describe('buildScaffold', () => {
  it('wires the identity the validator cross-checks', () => {
    expect(buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }))
      .toMatchObject({
        _id: 'as_degree:110:cs:ast',
        legacy_id: '110:cs:ast',
        college_id: 'cc:110',
        community_college_id: 110,
        major_slug: 'cs',
        degree_type: 'ast',
        status: 'found',
        requirement_groups: [],
      })
  })
})

describe('saveBlockers', () => {
  const complete = {
    ...buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }),
    degree_title_seen: 'Computer Science A.S.-T',
    catalog_url: 'https://catalog.example.edu/cs',
    catalog_year: '2025-26',
    unit_system: 'semester',
    total_units: 60,
    requirement_groups: [{ group_id: 'core', source: 'curated', confidence: null }],
  }

  it('is empty for a complete found row', () => {
    expect(saveBlockers(complete)).toEqual([])
  })

  it('names every missing field on a bare scaffold', () => {
    const blockers = saveBlockers(buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }))
    expect(blockers).toEqual([
      'a degree title as printed in the catalog',
      'a catalog URL starting with http',
      'a catalog year',
      'a positive total unit count',
      'at least one requirement group',
    ])
  })

  it('rejects a non-http catalog URL', () => {
    expect(saveBlockers({ ...complete, catalog_url: 'catalog.example.edu' }))
      .toEqual(['a catalog URL starting with http'])
  })

  it('rejects an invalid unit system', () => {
    expect(saveBlockers({ ...complete, unit_system: 'trimester' }))
      .toEqual(['a unit system of semester or quarter'])
  })

  it('rejects a missing unit system', () => {
    expect(saveBlockers({ ...complete, unit_system: undefined }))
      .toEqual(['a unit system of semester or quarter'])
  })

  it('drops the found-row fields when the status is not found', () => {
    expect(saveBlockers({ ...buildScaffold({ collegeId: 110, major: 'cs', slot: 'ast' }),
      status: 'none_found', requirement_groups: [] })).toEqual([])
  })

  it('rejects requirement groups on a non-found row', () => {
    expect(saveBlockers({ ...complete, status: 'none_found' }))
      .toEqual(['no requirement groups (a none_found row must not carry any)'])
  })
})
