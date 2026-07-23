import { describe, it, expect } from 'vitest'
import { buildDegreeContext, universityCatalogLines } from './degreeContext'
import { createDegreeDocument } from './degreeTemplateModel'

const doc = createDegreeDocument({
  schoolId: 89, school: 'UC Irvine', majorSlug: 'cs', defaultProgram: 'Computer Science, B.S.',
})

describe('universityCatalogLines', () => {
  it('lists id | code | title | units and skips rows without an id', () => {
    const lines = universityCatalogLines([
      { course_id: 5, prefix: 'MATH', number: '2A', title: 'Calculus', units: 4 },
      { prefix: 'BAD', number: 'X' },
    ])
    expect(lines).toBe('5 | MATH 2A | Calculus | 4u')
  })
})

describe('buildDegreeContext', () => {
  it('carries the identity rules the server enforces on save', () => {
    const text = buildDegreeContext({ doc, courses: [] })
    expect(text).toContain('degree:<school_id>:<major_slug>')
    expect(text).toContain('institution_id "uc:<school_id>"')
    expect(text).toContain('program must stay the exact configured')
    // Only these three fields are editable.
    for (const field of ['total_units', 'source_url', 'requirement_groups']) {
      expect(text).toContain(field)
    }
  })

  it('protects user-authored verification notes', () => {
    expect(buildDegreeContext({ doc, courses: [] }))
      .toMatch(/Never invent, rewrite, or remove a verification note/)
  })

  it('includes the campus catalog and only its numeric ids', () => {
    const text = buildDegreeContext({
      doc, courses: [{ course_id: 7, prefix: 'I&C SCI', number: '31', title: 'Intro Programming', units: 4 }],
    })
    expect(text).toContain('7 | I&C SCI 31 | Intro Programming | 4u')
  })

  it('switches framing between edit and create', () => {
    expect(buildDegreeContext({ doc, courses: [], mode: 'create', campusName: 'UC Irvine' }))
      .toContain('# Creating a four-year graduation-requirement template')
    expect(buildDegreeContext({ doc, courses: [], mode: 'create', campusName: 'UC Irvine' }))
      .toContain('UC Irvine')
    expect(buildDegreeContext({ doc, courses: [] }))
      .toContain('# Correcting a four-year graduation-requirement template')
  })
})
