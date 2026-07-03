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

export const ANALYSES = [
  {
    id: 'paper-district-heatmap',
    title: 'Paper-style district transfer heatmap',
    description: 'District x UC campus complete-transfer matrix with paper baseline comparison',
    source: 'Live /analysis/coverage + paper baseline',
    Component: PaperDistrictHeatmap,
  },
  {
    id: 'coverage-heatmap',
    title: 'Articulation coverage heatmap',
    description: 'Community college x campus-program percentage of required receivers articulated',
    source: 'Live /analysis/coverage',
    Component: CoverageHeatmap,
  },
]
