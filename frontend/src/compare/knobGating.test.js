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
    // Massachusetts has no unit lens, so only the row grouping is the reader's.
    expect(ma).toEqual(['rows'])
  })

  it('swaps the credit-rate controls between a paper corpus and our own data', () => {
    const ca = knobsFor(byId('transfer-credit-rate'), CA).map((k) => k.key)
    const ma = knobsFor(byId('transfer-credit-rate'), MA).map((k) => k.key)
    expect(ca).toEqual(expect.arrayContaining(['scope', 'ma-equivalent', 'verified']))
    expect(ca).not.toEqual(expect.arrayContaining(['source', 'ge']))
    // Only a published corpus has other versions to choose between.
    expect(ma).toEqual(expect.arrayContaining(['source', 'ge']))
    expect(ma).not.toEqual(expect.arrayContaining(['scope', 'ma-equivalent', 'verified']))
  })
})
