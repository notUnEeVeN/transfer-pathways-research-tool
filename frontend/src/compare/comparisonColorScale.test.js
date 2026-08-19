import { describe, expect, it } from 'vitest'
import {
  FIXED_PERCENT_COMPARISON_SCALE,
  comparisonColorScaleFor,
} from './comparisonColorScale'

const panesFor = (figure) => [
  { id: 'ma', figure },
  { id: 'ca', figure },
]

const ready = (...values) => ({
  status: 'ready',
  cells: values.map((value, index) => ({ key: String(index), value })),
})

describe('comparisonColorScaleFor', () => {
  it.each(['coverage-heatmap', 'transfer-credit-rate'])(
    'uses the fixed 0–100 percentage domain for %s',
    (figure) => {
      expect(comparisonColorScaleFor(panesFor(figure), {
        ma: ready(12, 30),
        ca: ready(72, 94),
      })).toBe(FIXED_PERCENT_COMPARISON_SCALE)
    }
  )

  it.each([
    ['transfer-extra-units', [4, 18], [2, 61], 61],
    ['transfer-extra-cost', [1_200, 8_400], [500, 21_300], 21_300],
  ])('combines every ready pane for %s', (figure, maValues, caValues, expectedMax) => {
    expect(comparisonColorScaleFor(panesFor(figure), {
      ma: ready(...maValues),
      ca: ready(...caValues),
    })).toEqual({
      min: 0,
      mid: expectedMax / 2,
      max: expectedMax,
      comparisonShared: true,
    })
  })

  it('uses one symmetric domain across all ready Figure 6 panes', () => {
    expect(comparisonColorScaleFor(panesFor('pathway-complexity'), {
      ma: ready(-47, 20),
      ca: ready(-12, 62),
    })).toEqual({
      maxAbs: 62,
      min: -62,
      mid: 0,
      max: 62,
      comparisonShared: true,
    })
  })

  it('ignores cells that are not ready and waits for at least one ready value', () => {
    const panes = panesFor('transfer-extra-units')
    expect(comparisonColorScaleFor(panes, {
      ma: { status: 'loading', cells: [{ value: 999 }] },
      ca: { status: 'error', cells: [{ value: 888 }] },
    })).toBeNull()
    expect(comparisonColorScaleFor(panes, {
      ma: ready(7),
      ca: { status: 'loading', cells: [{ value: 999 }] },
    })).toEqual({ min: 0, mid: 3.5, max: 7, comparisonShared: true })
    expect(comparisonColorScaleFor(panes, {
      ma: ready(0),
      ca: ready(0),
    })).toEqual({ min: 0, mid: 0, max: 0, comparisonShared: true })
  })

  it('does not invent a common domain for mixed or unsupported figures', () => {
    expect(comparisonColorScaleFor([
      { id: 'a', figure: 'transfer-extra-units' },
      { id: 'b', figure: 'transfer-extra-cost' },
    ], { a: ready(10), b: ready(1000) })).toBeNull()
    expect(comparisonColorScaleFor(panesFor('course-type-spread'), {
      ma: ready(10), ca: ready(20),
    })).toBeNull()
  })
})
