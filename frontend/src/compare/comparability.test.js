import { describe, expect, it } from 'vitest'
import { assessComparability } from './comparability'

// Mirrors the real capability shape: California majors leave unitCoverage
// unset, the two state corpora set it false and read the course lens instead.
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

const pane = (id, figure, major, knobs = {}) => ({ id, figure, major, knobs })

describe('assessComparability', () => {
  it('aligns two pinned readings of one figure for one major', () => {
    const result = assessComparability([
      pane('p1', 'pathway-complexity', 'ma-cs', { source: 'published' }),
      pane('p2', 'pathway-complexity', 'ma-cs', { source: 'ours' }),
    ], MAJORS)

    expect(result.level).toBe('same-cells')
    expect(result.join).toBe('aligned')
    expect(result.warnings).toEqual([])
  })

  // California majors share the district x campus key space, so a cell-by-cell
  // difference across majors is measured, not invented.
  it('aligns different majors within one corpus', () => {
    const result = assessComparability([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'coverage-heatmap', 'bio'),
    ], MAJORS)

    expect(result.level).toBe('same-cells')
    expect(result.join).toBe('aligned')
  })

  // Bristol Community College is not Ohlone. Refusing is the honest output.
  it('refuses a cell join across corpora and says why', () => {
    const result = assessComparability([
      pane('p1', 'coverage-heatmap', 'ma-cs'),
      pane('p2', 'coverage-heatmap', 'va-cs'),
    ], MAJORS)

    expect(result.level).toBe('same-measure')
    expect(result.join).toBe('disjoint')
    expect(result.line).toMatch(/no colleges or campuses in common/i)
    expect(result.warnings.map((w) => w.code)).toContain('disjoint_keys')
  })

  // Disjoint keys are the more fundamental fact, so a cross-corpus pair stays
  // 'disjoint' (which is what the distribution lens keys off) and carries the
  // measure problem as a warning rather than being reclassified by it.
  it('keeps a cross-corpus pair disjoint and reports the measure mismatch alongside', () => {
    const result = assessComparability([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'coverage-heatmap', 'ma-cs'),
    ], MAJORS)

    expect(result.join).toBe('disjoint')
    expect(result.level).toBe('same-measure')
    const warning = result.warnings.find((w) => w.code === 'measure_mismatch')
    expect(warning.fix).toMatch(/paper-equivalent|course/i)
    expect(result.warnings.map((w) => w.code)).toContain('disjoint_keys')
  })

  it('refuses a same-corpus pair whose panes read different measures', () => {
    const majors = {
      ...MAJORS,
      'cs-course-lens': {
        slug: 'cs-course-lens', label: 'CS (course lens)', capabilities: { unitCoverage: false },
      },
    }
    const result = assessComparability([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'coverage-heatmap', 'cs-course-lens'),
    ], majors)

    expect(result.join).toBe('refused')
    expect(result.level).toBe('same-figure')
    expect(result.warnings.map((w) => w.code)).toContain('measure_mismatch')
  })

  it('refuses two different figures outright', () => {
    const result = assessComparability([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'pathway-complexity', 'cs'),
    ], MAJORS)

    expect(result.level).toBe('incomparable')
    expect(result.join).toBe('refused')
  })

  it('fails closed on an unconfigured major and on a single pane', () => {
    expect(assessComparability([
      pane('p1', 'coverage-heatmap', 'cs'),
      pane('p2', 'coverage-heatmap', 'not-a-major'),
    ], MAJORS).join).toBe('refused')

    expect(assessComparability([pane('p1', 'coverage-heatmap', 'cs')], MAJORS).level)
      .toBe('incomparable')
    expect(assessComparability([], MAJORS).join).toBe('refused')
  })

  it('accepts a Map of majors as well as a plain object', () => {
    const asMap = new Map(Object.entries(MAJORS))
    const result = assessComparability([
      pane('p1', 'pathway-complexity', 'ma-cs', { source: 'published' }),
      pane('p2', 'pathway-complexity', 'ma-cs', { source: 'ours' }),
    ], asMap)

    expect(result.join).toBe('aligned')
  })
})
