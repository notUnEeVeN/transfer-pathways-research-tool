import { useEffect } from 'react'

/**
 * Renders nothing. Calls the figure's OWN hook (`comparable.useData`) so the
 * pane and the delta overlay share one react-query cache entry — one request,
 * one result, and no second place where a request shape can drift.
 *
 * One instance per pane, so the conditional hook inside stays consistent for
 * the life of that instance; the caller keys each instance by figure id, so
 * changing a pane's figure remounts rather than reorders the hooks. This is
 * the same report-upward idiom `onMeasureChange` already uses.
 */
export default function CellSource({ pane, analysis, onCells }) {
  const comparable = analysis?.comparable || null
  const query = comparable
    ? comparable.useData(pane)
    : { data: null, isLoading: false, isError: false }

  // Knobs are read by `comparable.cells`, so a pinned control changing has to
  // re-report; the pane object's identity is not depended on, because a parent
  // re-render must not restart the report cycle.
  const knobKey = JSON.stringify(pane?.knobs || {})

  useEffect(() => {
    if (!comparable) return onCells(pane.id, { status: 'no_adapter', cells: [] })
    if (query.isLoading) return onCells(pane.id, { status: 'loading', cells: [] })
    if (query.isError) return onCells(pane.id, { status: 'error', cells: [] })
    return onCells(pane.id, { status: 'ready', cells: comparable.cells(query.data, pane) || [] })
  }, [comparable, query.data, query.isLoading, query.isError, pane.id, knobKey, onCells])

  return null
}
