import { describe, it, expect } from 'vitest'
import { computePopupPlacement } from './popupPlacement'

const rect = ({ top, height = 28 }) => ({ top, bottom: top + height, height })

describe('computePopupPlacement', () => {
  it('opens downward with full preferred height when there is room below', () => {
    const r = computePopupPlacement({ rect: rect({ top: 80 }), viewportHeight: 800 })
    expect(r.placeAbove).toBe(false)
    expect(r.maxHeight).toBe(256)
  })

  it('flips up when the trigger is near the bottom and there is more room above', () => {
    const r = computePopupPlacement({ rect: rect({ top: 752 }), viewportHeight: 800 })
    expect(r.placeAbove).toBe(true)
    expect(r.maxHeight).toBe(256) // plenty of room above for the preferred height
  })

  it('clamps maxHeight to the available space when neither side fits the preferred height', () => {
    // viewport 200, trigger at 150..178 → below ≈ 10, above ≈ 138
    const r = computePopupPlacement({ rect: rect({ top: 150 }), viewportHeight: 200 })
    expect(r.placeAbove).toBe(true)
    expect(r.maxHeight).toBe(138) // above - gap(4) - margin(8)
  })

  it('never returns a negative maxHeight', () => {
    const r = computePopupPlacement({ rect: rect({ top: 0, height: 0 }), viewportHeight: 0 })
    expect(r.maxHeight).toBeGreaterThanOrEqual(0)
  })
})
