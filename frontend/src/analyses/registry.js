/**
 * Statistical-analysis registry for the Data page's Analysis tab.
 *
 * Each analysis is a self-contained component that computes from the LIVE
 * scoped API (usually the /analysis endpoints via the hooks in
 * @frontend/query/hooks/useData or ad-hoc apiClient calls) — so a dataset
 * refresh or visibility change updates the figures with no code changes.
 *
 * To add one:
 *   1. Create frontend/src/analyses/MyAnalysis.jsx with a default-export
 *      component (fetch → compute → render).
 *   2. Register it below with metadata; it appears on the Analysis tab.
 *
 * Entry shape:
 *   {
 *     id: 'coverage-heatmap',                     // stable key
 *     title: 'Articulation coverage heatmap',
 *     description: 'CC × campus % of requirements articulated',
 *     source: 'Jiang et al. 2024, Fig. 1',        // paper provenance, optional
 *     Component: CoverageHeatmap,
 *   }
 */

import CoverageHeatmap from './CoverageHeatmap'
import PaperDistrictHeatmap from './PaperDistrictHeatmap'

// The built-in analyses render as first-class figures on the Analysis tab,
// credited to the console owner and dated, alongside partners' published
// figures — no endpoint is shown. `published_at` also sets their position in
// the single publish-ordered gallery (oldest first; new figures land below).
// TODO(owner): confirm the exact display name to attribute these to.
export const ANALYSIS_AUTHOR = 'Tybalt Mallet'

export const ANALYSES = [
  {
    id: 'paper-district-heatmap',
    title: 'Paper-style district transfer heatmap',
    description: 'District x UC campus complete-transfer matrix with paper baseline comparison',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:00:00',
    Component: PaperDistrictHeatmap,
  },
  {
    id: 'coverage-heatmap',
    title: 'Articulation coverage heatmap',
    description: 'Community college x campus-program percentage of required receivers articulated',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:05:00',
    Component: CoverageHeatmap,
  },
]
