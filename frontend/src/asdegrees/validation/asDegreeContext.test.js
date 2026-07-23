import { describe, it, expect } from 'vitest'
import { buildAsDegreeContext, courseCatalogLines } from './asDegreeContext'

const DOC = {
  _id: 'as_degree:4:local_cs_as',
  status: 'found',
  degree_title_seen: 'A.S. in Computer Science',
  requirement_groups: [{ group_id: 'core', sections: [] }],
}

const COURSES = [
  { course_id: 167678, prefix: 'MATH', number: '1A', title: 'Calculus I', units: 5 },
  { course_id: 167679, prefix: 'CSCI', number: '110', title: 'Programming', units: 4 },
]

describe('courseCatalogLines', () => {
  it('names every referenceable id with its code, title and units', () => {
    expect(courseCatalogLines(COURSES).split('\n')).toEqual([
      '167678 | MATH 1A | Calculus I | 5u',
      '167679 | CSCI 110 | Programming | 4u',
    ])
  })

  it('drops rows with no id — an id that cannot be referenced must not be offered', () => {
    expect(courseCatalogLines([{ prefix: 'X', number: '1' }, null])).toBe('')
  })
})

describe('buildAsDegreeContext', () => {
  const text = buildAsDegreeContext({ doc: DOC, courses: COURSES })

  it('carries the document itself, so a fresh chat needs nothing else', () => {
    expect(text).toContain('"_id": "as_degree:4:local_cs_as"')
    expect(text).toContain('167678 | MATH 1A | Calculus I | 5u')
  })

  it('states the rules the server actually enforces', () => {
    // Each of these mirrors a real validator check; a briefing that omits one
    // produces documents that fail only on save.
    expect(text).toContain("source 'curated'")
    expect(text).toContain('confidence null')
    expect(text).toContain("course_keys must mirror course_ids as 'cc:<numeric id>'")
    expect(text).toContain('^[a-z0-9_]+$')
    expect(text).toContain('Never invent, rewrite, or remove a verification note')
  })

  it('explains the nesting the UI otherwise hides', () => {
    expect(text).toContain('requirement_groups[]')
    expect(text).toContain('course_ids[]')
  })

  it('asks for a bare document back, since the answer is pasted straight in', () => {
    expect(text).toContain('no markdown fence')
  })

  it('says so plainly when the college has no courses on file', () => {
    expect(buildAsDegreeContext({ doc: DOC, courses: [] }))
      .toContain('(no courses on file for this college)')
  })
})
