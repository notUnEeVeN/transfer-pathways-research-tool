import { describe, expect, it } from 'vitest'
import { majorsBySchool } from './AdminPage'

describe('majorsBySchool', () => {
  it('collects every selected major for each campus', () => {
    const selected = majorsBySchool([
      { school_id: 7, major: 'Computer Science B.S.' },
      { school_id: 7, major: 'Biology: General Biology B.S.' },
      { school_id: '79', major: 'Computer Science B.A.' },
    ])

    expect([...selected].map(([id, majors]) => [id, [...majors]])).toEqual([
      ['7', ['Computer Science B.S.', 'Biology: General Biology B.S.']],
      ['79', ['Computer Science B.A.']],
    ])
  })

  it('collapses exact duplicates', () => {
    const selected = majorsBySchool([
      { school_id: 7, major: 'Computer Science B.S.' },
      { school_id: 7, major: 'Computer Science B.S.' },
    ])

    expect([...selected.get('7')]).toEqual(['Computer Science B.S.'])
  })
})
