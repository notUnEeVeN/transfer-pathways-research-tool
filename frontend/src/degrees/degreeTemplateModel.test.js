import { describe, expect, it } from 'vitest'
import {
  createDegreeDocument,
  degreeSectionType,
  moveItem,
  sectionFromDraft,
  sectionToDraft,
  setDegreeGroupTier,
  validateDegreeDocument,
} from './degreeTemplateModel'

const courseSection = {
  section_advisement: 1,
  tier: 'breadth',
  ge_areas: ['1A'],
  receivers: [{
    receiving: { kind: 'course', parent_id: 10, units: 4 },
    articulation_status: null,
    options: [],
    hash_id: 'keep-me',
    tier: 'breadth',
    ge_areas: ['1A'],
  }],
}

describe('degree template section model', () => {
  it('round-trips explicit course choices while preserving stable receiver data', () => {
    const form = sectionToDraft(courseSection, 'breadth')
    expect(form).toMatchObject({ type: 'courses', required: 1, courseIds: [10], geAreas: '1A' })

    const saved = sectionFromDraft({ ...form, courseIds: [10, 11], required: 1 }, {
      original: courseSection,
      tier: 'breadth',
      coursesById: new Map([['11', { parent_id: 11, min_units: 3, max_units: 5 }]]),
    })
    expect(saved.receivers).toHaveLength(2)
    expect(saved.receivers[0].hash_id).toBe('keep-me')
    expect(saved.receivers[1].receiving).toMatchObject({ parent_id: 11, units: 5 })
    expect(saved.ge_areas).toEqual(['1A'])
  })

  it('models GE categories, assumed requirements, and university-only slots', () => {
    const category = sectionFromDraft({
      type: 'ge_area', required: 4, code: 'H/SS',
      description: 'Humanities and social sciences', geAreas: '3A, 3B, 4',
    }, { tier: 'breadth' })
    expect(degreeSectionType(category)).toBe('ge_area')
    expect(category.section_advisement).toBe(4)
    expect(category.receivers[0].ge_areas).toEqual(['3A', '3B', '4'])

    const assumed = sectionFromDraft({
      type: 'assumed', required: 1, code: 'AH&I', description: 'American History', geAreas: '',
    }, { tier: 'transferable' })
    expect(degreeSectionType(assumed)).toBe('assumed')
    expect(assumed.assume_satisfiable).toBe(true)

    const university = sectionFromDraft({
      type: 'university', required: 3, description: 'Upper-division electives',
    }, { tier: 'nontransferable' })
    expect(degreeSectionType(university)).toBe('university')
    expect(university.receivers).toHaveLength(3)
  })

  it('updates tier recursively and reorders without mutating the input', () => {
    const group = { tier: 'breadth', sections: [courseSection] }
    const updated = setDegreeGroupTier(group, 'transferable')
    expect(updated.sections[0].tier).toBe('transferable')
    expect(updated.sections[0].receivers[0].tier).toBe('transferable')
    expect(group.sections[0].tier).toBe('breadth')

    const original = ['a', 'b', 'c']
    expect(moveItem(original, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(original).toEqual(['a', 'b', 'c'])
  })
})

describe('degree template document validation', () => {
  it('requires a named program and complete structured groups', () => {
    const doc = createDegreeDocument({ schoolId: 79, school: 'UC Berkeley' })
    expect(validateDegreeDocument(doc)).toBe('Program name is required.')
    doc.program = 'EECS, B.S.'
    expect(validateDegreeDocument(doc)).toBe('Add at least one requirement group.')
    doc.requirement_groups = [{ title: 'Math', tier: 'transferable', sections: [courseSection] }]
    expect(validateDegreeDocument(doc)).toBe(null)
  })

  it('gives each major its own stable document id and explicit identity', () => {
    const doc = createDegreeDocument({
      schoolId: 79,
      school: 'UC Berkeley',
      majorSlug: 'bio',
      defaultProgram: 'Molecular and Cell Biology, B.A.',
    })
    expect(doc).toMatchObject({
      _id: 'degree:79:bio',
      legacy_id: '79:bio',
      major_slug: 'bio',
      program: 'Molecular and Cell Biology, B.A.',
    })
  })
})
