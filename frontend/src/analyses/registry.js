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
import CreditLoss from './CreditLoss'
import ChoiceCost from './ChoiceCost'
import CategoryGaps from './CategoryGaps'
import Complexity from './Complexity'
import TimeToDegree from './TimeToDegree'

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
  {
    id: 'credit-loss',
    title: 'Cheapest-path credit load',
    description: 'Distribution of minimal CC courses/units per agreement, by campus',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:00:00',
    Component: CreditLoss,
  },
  {
    id: 'choice-cost',
    title: 'Cost of keeping choices open',
    description: 'Incremental CC courses each additional campus demands, in application order',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:01:00',
    Component: ChoiceCost,
  },
  {
    id: 'category-gaps',
    title: 'Course-category gaps',
    description: 'Share of colleges missing an articulated equivalent, per campus x category',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:02:00',
    Component: CategoryGaps,
  },
  {
    id: 'complexity',
    title: 'Pathway complexity',
    description: 'Curricular Analytics delay + blocking scores over the curated prereq graph',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:03:00',
    Component: Complexity,
  },
  {
    id: 'time-to-degree',
    title: 'Transfer credit rate',
    description: 'Associate-degree units counting toward each agreement, with lost-unit cost',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:04:00',
    Component: TimeToDegree,
  },
]
