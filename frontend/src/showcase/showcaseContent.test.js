import { describe, expect, it } from 'vitest'
import {
  AUDIT_STORY,
  CALIFORNIA_WORK,
  DEGREE_READINESS,
  FEATURED_FIGURES,
  PLATFORM_SURFACES,
  PREREQ_EXHIBIT,
  SHOWCASE_HERO,
} from './showcaseContent'

describe('showcase content module', () => {
  it('attributes only the genuine Massachusetts ports to the Massachusetts paper', () => {
    expect(FEATURED_FIGURES.map((f) => f.analysisId)).toEqual([
      'coverage-heatmap',
      'transfer-credit-rate',
      'transfer-extra-units',
    ])
    for (const figure of FEATURED_FIGURES) {
      expect(figure.figureLabel).toMatch(/^Figure \d+$/)
      expect(figure.star).toBeTruthy()
      expect(figure.claim).toBeTruthy()
      expect(figure.liveNote).toBeTruthy()
    }
    // The district heatmap reproduces the California study, so it is
    // presented as our own work rather than as one of the MA figures.
    expect(CALIFORNIA_WORK.analysisId).toBe('paper-district-heatmap')
    expect(CALIFORNIA_WORK.star).toBeTruthy()
  })

  it('carries no scope minutiae on the presented figures', () => {
    for (const figure of [...FEATURED_FIGURES, CALIFORNIA_WORK]) {
      expect(figure.scope).toBeUndefined()
    }
  })

  it('gives every presented figure a checkable formula', () => {
    for (const figure of [...FEATURED_FIGURES, CALIFORNIA_WORK]) {
      expect(figure.formula.expression).toBeTruthy()
      expect(figure.formula.grain).toBeTruthy()
      // watchFor names the modelling choice most likely to differ between
      // two teams, which is the whole point of showing the formula.
      expect(figure.formula.watchFor).toBeTruthy()
    }
  })

  it('presents degree coverage as a live unit-weighted measure, not the retired slot percentage', () => {
    const coverage = FEATURED_FIGURES.find((f) => f.analysisId === 'coverage-heatmap')

    expect(coverage.star).toBe('Live measure')
    expect(coverage.claim).toMatch(/graduation-unit coverage/i)
    expect(coverage.blurb).toMatch(/native units/i)
    expect(coverage.method).toMatch(/modeled graduation units/i)
    expect(coverage.liveNote).toMatch(/prior.*counted slots/i)
    expect(JSON.stringify(coverage)).not.toContain('74.6')
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
