import { describe, expect, it } from 'vitest'
import { COMPARABLE_SCOPE } from './ComparisonWorkspace'
import { ANALYSES } from '../analyses/registry'

// The Compare tab is deliberately scoped to the Massachusetts paper's figures
// for now. This asserts against the REAL registry, so adding a figure to
// another lane cannot quietly widen the picker, and renumbering or relaning an
// MA figure cannot quietly drop it.
describe('comparable scope', () => {
  const inScope = ANALYSES.filter(COMPARABLE_SCOPE)

  it('is exactly the six Massachusetts paper figures, one per number', () => {
    expect(inScope.map((entry) => entry.id).sort()).toEqual([
      'course-type-coverage',
      'coverage-heatmap',
      'pathway-complexity',
      'transfer-credit-rate',
      'transfer-extra-cost',
      'transfer-extra-units',
    ])
    expect(inScope.map((entry) => entry.figureNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('excludes every other lane, including numbered California figures', () => {
    const excluded = ANALYSES.filter((entry) => !COMPARABLE_SCOPE(entry))
    expect(excluded.length).toBeGreaterThan(0)
    expect(excluded.some((entry) => entry.provenance === 'ma' && Number.isFinite(entry.figureNo)))
      .toBe(false)
    // California ports carry figure numbers too — the lane is what separates them.
    expect(excluded.some((entry) => entry.provenance === 'ca' && Number.isFinite(entry.figureNo)))
      .toBe(true)
  })
})
