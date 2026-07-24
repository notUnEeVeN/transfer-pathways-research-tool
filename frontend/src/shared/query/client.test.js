import { describe, expect, it } from 'vitest'
import { shouldPersistQuery } from './client'

const query = (rootKey, status = 'success') => ({
  queryKey: [rootKey, 'detail'],
  state: { status },
})

describe('shouldPersistQuery', () => {
  it('persists successful source and catalog data', () => {
    expect(shouldPersistQuery(query('institutions'))).toBe(true)
  })

  it('does not persist computed analysis responses', () => {
    expect(shouldPersistQuery(query('analysis-coverage'))).toBe(false)
    expect(shouldPersistQuery(query('analysis-transfer-credit-rate'))).toBe(false)
  })

  it('does not persist access, major config, or unfinished queries', () => {
    expect(shouldPersistQuery(query('access-me'))).toBe(false)
    expect(shouldPersistQuery(query('majors'))).toBe(false)
    expect(shouldPersistQuery(query('institutions', 'pending'))).toBe(false)
  })
})
