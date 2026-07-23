import { describe, expect, it } from 'vitest'
import {
  PAPER_RED_LOW_TO_HIGH_GRADIENT,
  paperRedCellColor,
} from './maHeatmapColors'

describe('Massachusetts heatmap color direction', () => {
  const scale = { min: 0, max: 100 }

  it('maps the low endpoint to white and the high endpoint to dark red', () => {
    expect(paperRedCellColor(0, scale)).toEqual({
      backgroundColor: 'rgb(255 255 255)',
      color: '#1a1a1a',
    })
    expect(paperRedCellColor(100, scale)).toEqual({
      backgroundColor: 'rgb(103 0 13)',
      color: 'white',
    })
  })

  it('uses the same low-to-high direction in the legend gradient', () => {
    expect(PAPER_RED_LOW_TO_HIGH_GRADIENT).toMatch(
      /^linear-gradient\(90deg, rgb\(255 255 255\) 0%/,
    )
    expect(PAPER_RED_LOW_TO_HIGH_GRADIENT).toMatch(
      /rgb\(103 0 13\) 100%\)$/,
    )
  })

  it('clamps values outside the scale without reversing the endpoints', () => {
    expect(paperRedCellColor(-1, scale).backgroundColor).toBe('rgb(255 255 255)')
    expect(paperRedCellColor(101, scale).backgroundColor).toBe('rgb(103 0 13)')
  })
})
