import { describe, expect, it } from 'vitest'
import { ANALYSES } from './registry'
import { MEASURES, measureFor } from './measures'

describe('figure measurement definitions', () => {
  it('defines a measure for every registered analysis', () => {
    const missing = ANALYSES.filter((a) => !MEASURES[a.id]).map((a) => a.id)
    expect(missing).toEqual([])
  })

  it('does not carry definitions for analyses that no longer exist', () => {
    const ids = new Set(ANALYSES.map((a) => a.id))
    expect(Object.keys(MEASURES).filter((id) => !ids.has(id))).toEqual([])
  })

  it('gives each measure an expression, a grain, and a caveat', () => {
    for (const [id, measure] of Object.entries(MEASURES)) {
      expect(measure.expression, id).toBeTruthy()
      expect(measure.grain, id).toBeTruthy()
      // watchFor names the modelling choice most likely to differ between
      // two teams. Without it the formula invites a false match.
      expect(measure.watchFor, id).toBeTruthy()
    }
  })

  it('returns null for an unknown analysis rather than throwing', () => {
    expect(measureFor('no-such-figure')).toBeNull()
  })
})
