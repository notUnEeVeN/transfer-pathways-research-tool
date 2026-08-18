/**
 * Per-pair breakdowns: the panel that appears BELOW a specific comparison
 * because that specific comparison has an argument to make.
 *
 * Deliberately the same two-step contract the figure registry states — create
 * the component, add one metadata entry. Nothing in the workspace, the notes,
 * the store or the server learns about a new breakdown.
 *
 * `appliesTo` is a pure predicate over the canonical pane array. Never over
 * pane ORDER, layout, or which comparison assembled them, so a breakdown fires
 * identically whether the pair was built by hand, restored from a URL, or
 * opened from a note.
 *
 * A breakdown is on-screen chrome, never a figure: it renders evidence that
 * already exists in the panes' own payload. Anything that would fuse the panes
 * into a new reading belongs in ANALYSES with its own MEASURES entry.
 */

import MaComplexityFigure6 from './MaComplexityFigure6'

const sourceOf = (pane) => pane?.knobs?.source ?? 'published'

export const BREAKDOWNS = [
  {
    id: 'ma-complexity-figure-6',
    title: 'Where Figure 6 disagrees with their own workbook',
    description: 'Every printed cell against their own Curricular Complexity tab, plus the typed scores that drifted and the headline the drift produced.',
    appliesTo: (panes) => {
      const list = Array.isArray(panes) ? panes : []
      return list.length === 2
        && list.every((pane) => pane?.figure === 'pathway-complexity' && pane?.major === 'ma-cs')
        && list.every((pane) => ['published', 'ours'].includes(sourceOf(pane)))
        && new Set(list.map(sourceOf)).size === 2
    },
    Component: MaComplexityFigure6,
  },
]

const BREAKDOWN_BY_ID = new Map(BREAKDOWNS.map((breakdown) => [breakdown.id, breakdown]))

/** An unknown id resolves to null — a stored doc never names an execution surface. */
export function getBreakdown(id) {
  return BREAKDOWN_BY_ID.get(String(id || '')) || null
}

/** The first breakdown whose predicate holds. A throwing predicate is a no-match. */
export function breakdownFor(panes, analysis) {
  return BREAKDOWNS.find((breakdown) => {
    try { return Boolean(breakdown.appliesTo(panes, analysis)) } catch { return false }
  }) || null
}

/** An explicit `breakdown_id` on the stored comparison wins; otherwise the match. */
export function resolveBreakdown(comparison, analysis) {
  return getBreakdown(comparison?.breakdown_id)
    || breakdownFor(comparison?.panes, analysis)
}
