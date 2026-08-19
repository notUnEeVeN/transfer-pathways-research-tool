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

import MaTransferCreditFigure3 from './MaTransferCreditFigure3'
import MaExtraUnitsFigure4 from './MaExtraUnitsFigure4'

const transferCreditSourceOf = (pane) => pane?.knobs?.source ?? 'pdf'
const extraUnitsSourceOf = (pane) => pane?.knobs?.source ?? 'pdf'
const degreeOf = (pane) => pane?.knobs?.degree ?? 'local_as'

export const BREAKDOWNS = [
  {
    id: 'ma-transfer-credit-figure-3',
    title: 'Figure 3 final paper vs our recalculation',
    description: 'Whole-percentage reproduction, mean comparison, and the four evidence patterns that remain questions rather than proven errors.',
    appliesTo: (panes) => {
      const list = Array.isArray(panes) ? panes : []
      return list.length === 2
        && list.every((pane) => pane?.figure === 'transfer-credit-rate' && pane?.major === 'ma-cs')
        && list.every((pane) => ['pdf', 'archive-gray-detail'].includes(transferCreditSourceOf(pane)))
        && new Set(list.map(transferCreditSourceOf)).size === 2
    },
    Component: MaTransferCreditFigure3,
  },
  {
    id: 'ma-extra-units-figure-4',
    title: 'Figure 4 final paper vs our recalculation',
    description: 'All 13 recalculation differences first; manual-summary and coordinated-zero patterns are secondary explanations.',
    appliesTo: (panes) => {
      const list = Array.isArray(panes) ? panes : []
      return list.length === 2
        && list.every((pane) => (
          pane?.figure === 'transfer-extra-units'
          && pane?.major === 'ma-cs'
          && degreeOf(pane) === 'local_as'
        ))
        && list.every((pane) => ['pdf', 'archive-detail'].includes(extraUnitsSourceOf(pane)))
        && new Set(list.map(extraUnitsSourceOf)).size === 2
    },
    Component: MaExtraUnitsFigure4,
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
