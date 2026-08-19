// Color is a visual comparison aid, not part of a saved pane's statistical
// definition. The workspace derives one ephemeral domain from the cell values
// its figure adapters already reported, then hands that same object to every
// mounted pane. This keeps equal values equal colors without adding another
// persisted knob or changing any figure's arithmetic.
const PERCENT_FIGURES = new Set(['coverage-heatmap', 'transfer-credit-rate'])
const ZERO_TO_MAX_FIGURES = new Set(['transfer-extra-units', 'transfer-extra-cost'])
const SYMMETRIC_FIGURES = new Set(['pathway-complexity'])

export const FIXED_PERCENT_COMPARISON_SCALE = Object.freeze({
  min: 0,
  mid: 50,
  max: 100,
  comparisonShared: true,
})

export function comparisonColorScaleFor(panes = [], cellsByPane = {}) {
  const figures = [...new Set(panes.map((pane) => pane?.figure).filter(Boolean))]
  if (figures.length !== 1) return null

  const figure = figures[0]
  if (PERCENT_FIGURES.has(figure)) return FIXED_PERCENT_COMPARISON_SCALE
  if (!ZERO_TO_MAX_FIGURES.has(figure) && !SYMMETRIC_FIGURES.has(figure)) return null

  const values = panes.flatMap((pane) => {
    const report = cellsByPane[pane.id]
    if (report?.status !== 'ready') return []
    return (report.cells || []).map((cell) => cell?.value).filter(Number.isFinite)
  })
  if (!values.length) return null

  if (SYMMETRIC_FIGURES.has(figure)) {
    const maxAbs = Math.max(0, ...values.map((value) => Math.abs(value)))
    return {
      maxAbs,
      min: -maxAbs,
      mid: 0,
      max: maxAbs,
      comparisonShared: true,
    }
  }

  // Keep the receipt literal: if every ready cell is zero, the comparison
  // domain really is 0–0. The palette already protects a zero-width span.
  const max = Math.max(0, ...values)
  return { min: 0, mid: max / 2, max, comparisonShared: true }
}
