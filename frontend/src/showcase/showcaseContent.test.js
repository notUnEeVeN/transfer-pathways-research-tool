import { describe, expect, it } from 'vitest'
import {
  AUDIT_STORY,
  DEGREE_READINESS,
  FEATURED_FIGURES,
  PLATFORM_SURFACES,
  PREREQ_EXHIBIT,
  SHOWCASE_FINDINGS,
  SHOWCASE_HERO,
} from './showcaseContent'

describe('showcase content module', () => {
  it('features the four ported figures ahead of the three findings', () => {
    expect(FEATURED_FIGURES.map((f) => f.analysisId)).toEqual([
      'paper-district-heatmap',
      'transfer-credit-rate',
      'transfer-extra-units',
      'coverage-heatmap',
    ])
    expect(SHOWCASE_FINDINGS).toHaveLength(3)
    for (const figure of FEATURED_FIGURES) {
      expect(figure.provenance).toMatch(/Massachusetts/)
      expect(figure.metric).toBeTruthy()
      expect(figure.liveNote).toBeTruthy()
    }
  })

  it('tells the audit story in four steps and never fabricates the bound', () => {
    expect(AUDIT_STORY.steps.map((s) => s.id)).toEqual([
      'corpus', 'templates', 'review', 'bound',
    ])
    // The gauge ships empty until values are read off the live Audit stats
    // page at snapshot time. Frozen numbers must be entered by hand, so a
    // filled-in gauge must carry every field together.
    const g = AUDIT_STORY.bound
    const filled = [g.ceilingPct, g.observedPct, g.k, g.n, g.estMax, g.totalDocs]
    const allNull = filled.every((v) => v === null)
    const allSet = filled.every((v) => typeof v === 'number')
    expect(allNull || allSet).toBe(true)
    expect(g.pendingNote).toBeTruthy()
  })

  it('keeps hero, readiness, prereq exhibit, and platform cards present', () => {
    expect(SHOWCASE_HERO.title).toBeTruthy()
    expect(DEGREE_READINESS).toHaveLength(4)
    expect(PREREQ_EXHIBIT.heading).toBeTruthy()
    expect(PLATFORM_SURFACES).toHaveLength(4)
  })
})
