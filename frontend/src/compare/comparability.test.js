import { describe, expect, it } from 'vitest'
import { assessComparability, resolveComparisonContract } from './comparability'

const MAJORS = {
  cs: { slug: 'cs', label: 'Computer Science', capabilities: {} },
  bio: { slug: 'bio', label: 'Biology', capabilities: {} },
  'ma-cs': {
    slug: 'ma-cs', label: 'Computer Science (MA)', state: 'ma',
    capabilities: { unitCoverage: false, paperBaselines: true },
  },
  'va-cs': {
    slug: 'va-cs', label: 'Computer Science (VA)', state: 'va',
    capabilities: { unitCoverage: false, paperBaselines: false },
  },
}

const courseLens = (pane, major) => (
  major.capabilities?.unitCoverage === false || pane.knobs?.['ma-equivalent'] === true
)

const ANALYSES = {
  'coverage-heatmap': {
    comparisonContract: (pane, major) => ({
      measure: courseLens(pane, major) ? 'course-coverage' : 'unit-coverage',
      unit: 'percentage points',
      grain: 'college × campus',
      keys: { rows: pane.knobs?.rows || 'college', columns: 'campus' },
      semantics: {
        denominator: courseLens(pane, major) ? 'required courses' : 'graduation units',
        ge: Boolean(pane.knobs?.ge),
        weighting: 'cell equal',
      },
      context: { source: pane.knobs?.source || 'live' },
      distribution: pane.knobs?.grouped === false
        ? {}
        : { groupBy: 'column', label: 'course type', pooled: false },
    }),
  },
  'pathway-complexity': {
    comparisonContract: (pane) => ({
      measure: 'complexity delta', unit: 'score points', grain: 'college × campus',
      keys: { rows: 'college', columns: 'campus' },
      semantics: { denominator: 'resident curriculum', weighting: 'cell equal' },
      context: { source: pane.knobs?.source || 'published' },
    }),
  },
  plain: {},
}

const pane = (id, figure, major, knobs = {}) => ({ id, figure, major, knobs })
const assess = (panes, majors = MAJORS) => assessComparability(panes, majors, ANALYSES)

describe('comparison contracts', () => {
  it('resolves and normalizes a figure declaration', () => {
    const contract = resolveComparisonContract(
      pane('p1', 'coverage-heatmap', 'cs'), MAJORS.cs, ANALYSES,
    )
    expect(contract).toMatchObject({
      measure: 'unit-coverage', unit: 'percentage points',
      keys: { rows: 'college' }, semantics: { denominator: 'graduation units' },
      distribution: { groupBy: 'column', pooled: false },
    })
  })

  it('fails closed when the figure has not declared a contract', () => {
    const result = assess([
      pane('p1', 'plain', 'cs'), pane('p2', 'plain', 'bio'),
    ])
    expect(result.join).toBe('refused')
    expect(result.warnings.map((warning) => warning.code)).toContain('missing_contract')
  })
})

describe('assessComparability', () => {
  it('aligns two source readings and discloses the changed context', () => {
    const result = assess([
      pane('p1', 'pathway-complexity', 'ma-cs', { source: 'published' }),
      pane('p2', 'pathway-complexity', 'ma-cs', { source: 'ours' }),
    ])

    expect(result.level).toBe('same-cells')
    expect(result.join).toBe('aligned')
    expect(result.warnings.map((warning) => warning.code)).toContain('context_difference')
  })

  it('aligns different majors within one corpus when keys and measure match', () => {
    const result = assess([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'coverage-heatmap', 'bio'),
    ])
    expect(result.level).toBe('same-cells')
    expect(result.join).toBe('aligned')
  })

  it('uses a distribution, never a cell join, across matching corpora', () => {
    const result = assess([
      pane('p1', 'coverage-heatmap', 'cs', { 'ma-equivalent': true }),
      pane('p2', 'coverage-heatmap', 'ma-cs'),
    ])

    expect(result.level).toBe('same-measure')
    expect(result.join).toBe('disjoint')
    expect(result.warnings.map((warning) => warning.code)).toContain('disjoint_keys')
  })

  it('refuses a cross-state distribution whose denominator differs', () => {
    const result = assess([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'coverage-heatmap', 'ma-cs'),
    ])
    expect(result.join).toBe('refused')
    expect(result.warnings.map((warning) => warning.code))
      .toContain('measure_contract_mismatch')
  })

  it('refuses disjoint corpora that request different distribution summaries', () => {
    const result = assess([
      pane('p1', 'coverage-heatmap', 'cs', { 'ma-equivalent': true }),
      pane('p2', 'coverage-heatmap', 'ma-cs', { grouped: false }),
    ])
    expect(result.join).toBe('refused')
    expect(result.warnings.map((warning) => warning.code))
      .toContain('distribution_contract_mismatch')
  })

  it('refuses a cell join when the row grouping differs', () => {
    const result = assess([
      pane('p1', 'coverage-heatmap', 'cs', { rows: 'college' }),
      pane('p2', 'coverage-heatmap', 'bio', { rows: 'district' }),
    ])
    expect(result.join).toBe('refused')
    expect(result.warnings.map((warning) => warning.code)).toContain('key_space_mismatch')
  })

  it('allows an explicit within-corpus lens contrast but names it', () => {
    const result = assess([
      pane('p1', 'coverage-heatmap', 'cs', { 'ma-equivalent': true, ge: false }),
      pane('p2', 'coverage-heatmap', 'bio', { 'ma-equivalent': true, ge: true }),
    ])
    expect(result.join).toBe('aligned')
    expect(result.warnings.map((warning) => warning.code)).toContain('semantic_lens_difference')
  })

  it('refuses different figures, unknown majors and a single pane', () => {
    expect(assess([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'pathway-complexity', 'cs'),
    ]).join).toBe('refused')
    expect(assess([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'coverage-heatmap', 'not-a-major'),
    ]).join).toBe('refused')
    expect(assess([pane('p1', 'coverage-heatmap', 'cs')]).level).toBe('incomparable')
  })

  it('accepts maps as registries', () => {
    const result = assessComparability([
      pane('p1', 'pathway-complexity', 'ma-cs'),
      pane('p2', 'pathway-complexity', 'ma-cs', { source: 'ours' }),
    ], new Map(Object.entries(MAJORS)), new Map(Object.entries(ANALYSES)))
    expect(result.join).toBe('aligned')
  })
})
