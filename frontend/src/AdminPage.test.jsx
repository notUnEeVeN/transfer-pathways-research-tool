import { describe, expect, it } from 'vitest'
import { majorsBySchool } from './AdminPage'

describe('majorsBySchool', () => {
  it('stores at most one selected major for each campus', () => {
    const selected = majorsBySchool([
      { school_id: 7, major: 'Computer Science B.S.' },
      { school_id: 7, major: 'Mathematics/Computer Science B.S.' },
      { school_id: '79', major: 'Computer Science B.A.' },
    ])

    expect([...selected]).toEqual([
      ['7', 'Computer Science B.S.'],
      ['79', 'Computer Science B.A.'],
    ])
  })
})
