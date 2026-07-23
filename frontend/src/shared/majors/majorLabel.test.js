import { describe, expect, it } from 'vitest'
import { majorLabelFor, majorShortLabelFor } from './majorLabel'

describe('major labels', () => {
  it('uses configured labels before deterministic slug fallbacks', () => {
    expect(majorLabelFor('cs')).toBe('Computer Science')
    expect(majorShortLabelFor('cs')).toBe('CS')
    expect(majorLabelFor('environmental_science')).toBe('Environmental Science')
    expect(majorLabelFor('mcb', 'Molecular & Cell Biology')).toBe('Molecular & Cell Biology')
  })

  it('fails generically rather than falling back to Computer Science', () => {
    expect(majorLabelFor('')).toBe('Selected Major')
    expect(majorLabelFor('public-health')).not.toBe('Computer Science')
  })
})
