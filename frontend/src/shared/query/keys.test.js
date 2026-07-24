import { describe, expect, it } from 'vitest'
import { COVERAGE_QUERY_VERSION, qk } from './keys'

describe('coverage query keys', () => {
  it('separates method versions, users, majors, and coverage modes', () => {
    const econ = qk.coverage('user-1', 'econ', '', 'district', 'assist', 'paper')
    const biology = qk.coverage('user-1', 'bio', '', 'district', 'assist', 'paper')

    expect(econ).toEqual([
      'analysis-coverage',
      COVERAGE_QUERY_VERSION,
      'user-1',
      'econ',
      '',
      'district',
      'assist',
      'paper',
    ])
    expect(econ).not.toEqual(biology)
  })
})
