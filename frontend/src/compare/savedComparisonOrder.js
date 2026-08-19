import { getAnalysisById } from '../analyses/registry'

/**
 * The Saved tab is a presentation shelf, not an activity feed.
 *
 * A comparison's `kind` cannot identify the six state exhibits: their majors
 * differ and their corpus-specific controls necessarily differ too, so the
 * server honestly calls them `mixed`. Resolve the states from the pane majors
 * instead, and resolve the figure number from the registry rather than parsing
 * a title a reader may freely rename.
 */

export const SAVED_COMPARISON_GROUPS = [
  {
    key: 'ca-ma',
    title: 'California–Massachusetts state exhibits',
    description: 'Figures 1–6, ordered by the Massachusetts paper.',
  },
  {
    key: 'ma-audit',
    title: 'Massachusetts recalculation exhibits',
    description: 'Figures 3 and 4 only: final paper beside our direct recalculation from the authors’ source files.',
  },
  {
    key: 'other',
    title: 'Other saved comparisons',
    description: null,
  },
]

const lookupMajor = (source, slug) => {
  if (source instanceof Map) return source.get(slug) || null
  return source?.[slug] || null
}

/**
 * Config metadata is authoritative. The prefix fallback only keeps the saved
 * shelf useful while the cross-state majors request is unavailable; state
 * corpus slugs already use that convention (`ma-cs`, `va-cs`). California is
 * the unprefixed default corpus throughout the application.
 */
function stateOfMajor(slug, majorsBySlug) {
  const major = lookupMajor(majorsBySlug, slug)
  if (major) return major.state || 'ca'
  const match = String(slug || '').match(/^([a-z]{2})-/)
  return match?.[1] || 'ca'
}

function figureNumberOf(comparison) {
  const figureIds = [...new Set((comparison?.panes || []).map((pane) => pane?.figure).filter(Boolean))]
  if (figureIds.length !== 1) return null
  const figureNo = getAnalysisById(figureIds[0])?.figureNo
  return Number.isFinite(figureNo) ? figureNo : null
}

function groupKeyOf(comparison, majorsBySlug) {
  const panes = Array.isArray(comparison?.panes) ? comparison.panes : []
  const figureNo = figureNumberOf(comparison)
  if (panes.length < 2 || figureNo == null) return 'other'

  const states = new Set(panes.map((pane) => stateOfMajor(pane.major, majorsBySlug)))
  if (states.size === 2 && states.has('ca') && states.has('ma')) return 'ca-ma'
  if (states.size === 1 && states.has('ma')) return 'ma-audit'
  return 'other'
}

const stableRowOrder = (left, right) => {
  const figureDelta = (figureNumberOf(left) ?? Number.POSITIVE_INFINITY)
    - (figureNumberOf(right) ?? Number.POSITIVE_INFINITY)
  if (figureDelta) return figureDelta
  return String(left?._id || '').localeCompare(String(right?._id || ''))
}

/** Return only non-empty groups, in the fixed meeting sequence. */
export function groupSavedComparisons(comparisons, majorsBySlug) {
  const buckets = new Map(SAVED_COMPARISON_GROUPS.map((group) => [group.key, []]))
  for (const comparison of comparisons || []) {
    buckets.get(groupKeyOf(comparison, majorsBySlug)).push(comparison)
  }
  return SAVED_COMPARISON_GROUPS
    .map((group) => ({ ...group, comparisons: buckets.get(group.key).sort(stableRowOrder) }))
    .filter((group) => group.comparisons.length > 0)
}
