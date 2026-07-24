import { describe, expect, it } from 'vitest'
import { AS_DEGREE_SLOTS, DEGREE_TYPE_LABEL, DEGREE_TYPE_ORDER, slotLabel } from './asDegreeSlots'

describe('asDegreeSlots', () => {
  it('lists the three slots in statewide-first order', () => {
    expect(AS_DEGREE_SLOTS).toEqual(['ast', 'local_as', 'local_other'])
  })

  it('maps every slot to its major-neutral label via slotLabel', () => {
    expect(slotLabel('ast')).toBe('A.S.-T')
    expect(slotLabel('local_as')).toBe('Local A.S.')
    expect(slotLabel('local_other')).toBe('Other')
  })

  it('falls back to the raw value for an unknown slot', () => {
    expect(slotLabel('mystery')).toBe('mystery')
  })

  it('accepts a major-owned award-label override without changing other slots', () => {
    const economics = { ast: 'A.A.-T' }
    expect(slotLabel('ast', economics)).toBe('A.A.-T')
    expect(slotLabel('local_as', economics)).toBe('Local A.S.')
    expect(slotLabel('ast')).toBe('A.S.-T')
  })

  it('sorts the slots statewide-first via DEGREE_TYPE_ORDER', () => {
    const sorted = [...AS_DEGREE_SLOTS].reverse().sort((a, b) => DEGREE_TYPE_ORDER[a] - DEGREE_TYPE_ORDER[b])
    expect(sorted).toEqual(['ast', 'local_as', 'local_other'])
  })

  it('keeps DEGREE_TYPE_LABEL major-neutral', () => {
    expect(DEGREE_TYPE_LABEL).toEqual({
      ast: 'A.S.-T',
      local_as: 'Local A.S.',
      local_other: 'Other',
    })
  })
})
