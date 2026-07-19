/**
 * Statistical-analysis registry for the Visuals page.
 *
 * Each analysis is a self-contained component with an explicit data contract.
 * Operational analyses read the scoped API, while audited paper reproductions
 * may use committed snapshots so their baseline remains reproducible.
 *
 * To add one:
 *   1. Create frontend/src/analyses/MyAnalysis.jsx with a default-export
 *      component (fetch -> compute -> render).
 *   2. Register it below with metadata; it appears in the Visuals gallery.
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
import TransferCreditRate from './TransferCreditRate'
import PaperCreditLoss from './PaperCreditLoss'
import PaperDistrictHeatmap from './PaperDistrictHeatmap'
import CreditLoss from './CreditLoss'
import ChoiceCost from './ChoiceCost'
import CategoryGaps from './CategoryGaps'
import Complexity from './Complexity'
import TimeToDegree from './TimeToDegree'

// The built-in analyses render as first-class figures in the Visuals gallery,
// credited to the console owner and dated alongside locally published
// figures. `published_at` also sets their position in
// the single publish-ordered gallery (oldest first; new figures land below).
// TODO(owner): confirm the exact display name to attribute these to.
export const ANALYSIS_AUTHOR = 'Tybalt Mallet'

export const ANALYSES = [
  {
    id: 'paper-credit-loss',
    title: 'Paper-style credit loss (Figure 1)',
    description: 'Per UC campus: CS/Math transfer requirement vs average CCC courses at 1st-4th choice, paper baseline',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-06T09:00:00',
    Component: PaperCreditLoss,
  },
  {
    id: 'paper-district-heatmap',
    title: 'Paper-style district transfer heatmap',
    description: 'District x UC campus complete-transfer matrix with paper baseline comparison',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:00:00',
    Component: PaperDistrictHeatmap,
  },
  {
    id: 'transfer-credit-rate',
    title: 'Transfer credit rate (MA paper Fig. 3)',
    description: 'College x campus % of the CS associate degree’s prescribed units that transfer toward the four-year graduation requirements',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:00:00',
    Component: TransferCreditRate,
  },
  {
    id: 'coverage-heatmap',
    title: 'Graduation requirement coverage heatmap',
    description: 'Community college x UC program share of four-year graduation requirements with an equivalent',
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

const ANALYSIS_BY_ID = new Map(ANALYSES.map((analysis) => [analysis.id, analysis]))

// Published interactive manifests resolve through the same registry as the
// built-ins. Returning the registry entry itself (rather than a wrapper or a
// copied implementation) is what makes renderer parity exact by construction.
export function getAnalysisById(id) {
  return ANALYSIS_BY_ID.get(String(id || '')) || null
}
