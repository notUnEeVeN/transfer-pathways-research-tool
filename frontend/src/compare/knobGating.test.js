import { describe, expect, it } from 'vitest'
import { ANALYSES } from '../analyses/registry'
import { knobsFor } from './viewKnobs'

const byId = (id) => ANALYSES.find((a) => a.id === id)
const CA = { slug: 'cs', capabilities: {}, courseTypes: { axes: { faithful: [] } } }
const MA = { slug: 'ma-cs', state: 'ma', capabilities: { unitCoverage: false, paperBaselines: true } }

describe('knob gating', () => {
  it('hides unit-lens controls on a course-lens corpus', () => {
    const ca = knobsFor(byId('coverage-heatmap'), CA).map((k) => k.key)
    const ma = knobsFor(byId('coverage-heatmap'), MA).map((k) => k.key)
    expect(ca).toEqual(expect.arrayContaining(['rows', 'basis', 'ma-equivalent']))
    // Massachusetts keeps the paper's college-row population. What it cannot
    // offer is the California unit BUDGET — the basis dropdown and the toggle
    // that would switch the paper lens off.
    expect(ma).not.toEqual(expect.arrayContaining(['rows', 'basis', 'ma-equivalent']))
    // What it can offer is how that population is read: counted or weighted by
    // credit, general education in or out. Those describe the same required
    // courses, so a pinned Massachusetts exhibit must carry them.
    // The whole-degree GE reading is withdrawn on this corpus — nothing in the
    // Massachusetts study classifies GE — so that knob must not be offered or
    // storable here. The lower-division lens is a separate measure that reads
    // the residue row by row under a stated rule, and it is offered in every
    // state.
    expect(ma).toEqual(['ma-weight', 'division', 'ld-include-ge', 'ma-source'])
    expect(ma).not.toContain('ma-include-ge')
  })

  it('offers the lower-division lens on all three states', () => {
    const VA = { slug: 'va-cs', state: 'va', capabilities: { unitCoverage: false } }
    for (const major of [CA, MA, VA]) {
      const knobs = knobsFor(byId('coverage-heatmap'), major)
      expect(knobs.find((k) => k.key === 'division')?.default).toBe('whole')
      expect(knobs.find((k) => k.key === 'ld-include-ge')?.default).toBe(false)
    }
  })

  it('offers the same weighting control on every corpus that draws the lens', () => {
    const ca = knobsFor(byId('coverage-heatmap'), CA).map((k) => k.key)
    // The point of the weighting is cross-state comparison, so it cannot be a
    // Massachusetts-only control.
    expect(ca).toContain('ma-weight')
    const weight = knobsFor(byId('coverage-heatmap'), CA).find((k) => k.key === 'ma-weight')
    expect(weight.default).toBe('courses')
    expect(weight.options.map((o) => o.value)).toEqual(['courses', 'units'])
  })

  it('swaps the credit-rate controls between a paper corpus and our own data', () => {
    const ca = knobsFor(byId('transfer-credit-rate'), CA).map((k) => k.key)
    const ma = knobsFor(byId('transfer-credit-rate'), MA).map((k) => k.key)
    expect(ca).toEqual(expect.arrayContaining(['scope', 'ma-equivalent', 'verified']))
    expect(ca).not.toEqual(expect.arrayContaining(['source', 'ge']))
    // Only a published corpus has other versions to choose between.
    expect(ma).toContain('source')
    expect(ma).not.toContain('ge')
    expect(ma).not.toEqual(expect.arrayContaining(['scope', 'ma-equivalent', 'verified']))
  })
})
