// Shared monochrome palette for the Massachusetts-paper heatmaps. Every
// quantitative ramp follows numeric order: low values are white and high
// values are dark red. Keeping one direction prevents cells and legends from
// silently disagreeing as the figures evolve.
export const PAPER_RED_STOPS = [
  [255, 255, 255], [254, 224, 210], [252, 187, 161], [252, 146, 114],
  [251, 106, 74], [239, 59, 44], [203, 24, 29], [165, 15, 21], [103, 0, 13],
]

export const PAPER_RED_LOW_TO_HIGH_GRADIENT = `linear-gradient(90deg, ${PAPER_RED_STOPS.map((rgb, index, stops) => (
  `rgb(${rgb.join(' ')}) ${(100 * index) / (stops.length - 1)}%`
)).join(', ')})`

export function paperRedCellColor(value, scale) {
  if (!Number.isFinite(value)) {
    return { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-subtle)' }
  }
  const span = Math.max(1, scale.max - scale.min)
  const normalized = Math.max(0, Math.min(1, (value - scale.min) / span))
  const position = normalized * (PAPER_RED_STOPS.length - 1)
  const index = Math.min(PAPER_RED_STOPS.length - 2, Math.floor(position))
  const t = position - index
  const lo = PAPER_RED_STOPS[index]
  const hi = PAPER_RED_STOPS[index + 1]
  const rgb = lo.map((channel, i) => Math.round(channel + (hi[i] - channel) * t))
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  return {
    backgroundColor: `rgb(${rgb.join(' ')})`,
    color: luminance > 0.55 ? '#1a1a1a' : 'white',
  }
}
