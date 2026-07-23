import { describe, expect, it } from 'vitest'
import { capabilityReady, resolveAnalysisAvailability } from './analysisAvailability'
import { ANALYSES } from '../analyses/registry'

const major = (overrides = {}) => ({
  slug: 'bio',
  label: 'Biology',
  capabilities: {
    assistAgreements: true,
    caCreditLossArtifact: true,
    degreeTemplates: true,
    prerequisites: false,
    snapshots: [],
  },
  ...overrides,
})

describe('capabilityReady', () => {
  it('accepts explicit true flags and non-empty collections only', () => {
    expect(capabilityReady(true)).toBe(true)
    expect(capabilityReady(['baseline'])).toBe(true)
    expect(capabilityReady(false)).toBe(false)
    expect(capabilityReady([])).toBe(false)
    expect(capabilityReady('yes')).toBe(false)
    expect(capabilityReady({ ready: true })).toBe(false)
  })
})

describe('resolveAnalysisAvailability', () => {
  it('runs a selected-major visual under the selected slug when every capability is ready', () => {
    const result = resolveAnalysisAvailability({
      majorScope: {
        mode: 'selected',
        requiredCapabilities: ['degreeTemplates'],
        datasets: ['degree templates'],
      },
    }, major())

    expect(result).toEqual({
      available: true,
      status: 'available',
      effectiveMajorSlug: 'bio',
      fixed: false,
      label: 'Biology available',
      reason: '',
      datasets: ['degree templates'],
      missingCapabilities: [],
    })
  })

  it('reports data pending and does not provide a fallback slug when a capability is absent', () => {
    const result = resolveAnalysisAvailability({
      majorScope: {
        mode: 'selected',
        requiredCapabilities: ['prerequisites', 'snapshots'],
        pendingReason: 'Prerequisite concepts have not been mapped yet.',
      },
    }, major())

    expect(result.available).toBe(false)
    expect(result.status).toBe('data_pending')
    expect(result.effectiveMajorSlug).toBeNull()
    expect(result.missingCapabilities).toEqual(['prerequisites', 'snapshots'])
    expect(result.reason).toBe('Prerequisite concepts have not been mapped yet.')
  })

  it('allows a fixed-major visual only when that major is selected', () => {
    const analysis = {
      majorScope: {
        mode: 'fixed',
        slug: 'cs',
        label: 'Computer Science',
        reason: 'This audited baseline is CS-only.',
      },
    }

    expect(resolveAnalysisAvailability(analysis, major()).available).toBe(false)
    expect(resolveAnalysisAvailability(analysis, major()).label).toBe('Computer Science only')
    expect(resolveAnalysisAvailability(analysis, major()).effectiveMajorSlug).toBeNull()

    const forCs = resolveAnalysisAvailability(analysis, major({
      slug: 'cs', label: 'Computer Science',
    }))
    expect(forCs.available).toBe(true)
    expect(forCs.status).toBe('fixed')
    expect(forCs.effectiveMajorSlug).toBe('cs')
    expect(forCs.label).toBe('Computer Science reference')
  })

  it('fails closed for absent or malformed scope and major metadata', () => {
    expect(resolveAnalysisAvailability({}, major())).toMatchObject({
      available: false,
      status: 'configuration_error',
      effectiveMajorSlug: null,
    })
    expect(resolveAnalysisAvailability({ majorScope: { mode: 'selected' } }, null)).toMatchObject({
      available: false,
      status: 'configuration_error',
      effectiveMajorSlug: null,
    })
    expect(resolveAnalysisAvailability({
      majorScope: { mode: 'unexpected' },
    }, major())).toMatchObject({
      available: false,
      status: 'configuration_error',
      effectiveMajorSlug: null,
    })
  })

  it('does not mutate registry-owned dataset metadata', () => {
    const datasets = ['agreements']
    const result = resolveAnalysisAvailability({
      majorScope: { mode: 'selected', datasets },
    }, major())
    result.datasets.push('changed')
    expect(datasets).toEqual(['agreements'])
  })
})

describe('analysis registry major scopes', () => {
  it('declares a major scope for every built-in and pins only fixed figures', () => {
    expect(ANALYSES.every((analysis) => analysis.majorScope)).toBe(true)

    for (const analysis of ANALYSES) {
      if (analysis.majorScope.mode === 'fixed') {
        expect(analysis.pinnedMajor).toBe(analysis.majorScope.slug)
      } else {
        expect(analysis.pinnedMajor).toBeUndefined()
      }
    }
  })

  it('marks ASSIST-backed figures as selected-major analyses', () => {
    const selected = Object.fromEntries(ANALYSES
      .filter((analysis) => analysis.majorScope.mode === 'selected')
      .map((analysis) => [analysis.id, analysis.majorScope.requiredCapabilities]))

    expect(selected).toEqual({
      'paper-credit-loss': ['assistAgreements', 'caCreditLossArtifact'],
      'paper-district-heatmap': ['assistAgreements'],
      'paper-articulation-histogram': ['assistAgreements'],
      'paper-articulation-map': ['assistAgreements'],
      'coverage-heatmap': ['assistAgreements', 'degreeTemplates'],
      'income-access': ['assistAgreements'],
      'credit-loss': ['assistAgreements', 'agreementPathways'],
      'choice-cost': ['assistAgreements', 'agreementPathways'],
      'category-gaps': ['assistAgreements', 'courseCategories'],
      complexity: ['assistAgreements', 'prerequisites'],
    })
  })

  it('makes every currently reproducible ASSIST visual available for Biology', () => {
    const available = ANALYSES
      .filter((analysis) => resolveAnalysisAvailability(analysis, major()).available)
      .map((analysis) => analysis.id)

    expect(available).toEqual([
      'paper-credit-loss',
      'paper-district-heatmap',
      'paper-articulation-histogram',
      'paper-articulation-map',
      'coverage-heatmap',
      'income-access',
    ])
  })
})
