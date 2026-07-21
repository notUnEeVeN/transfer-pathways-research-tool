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
 *     description: 'Shows how much required coursework is available at each community college.',
 *     source: 'Jiang et al. 2024, Fig. 1',        // paper provenance, optional
 *     Component: CoverageHeatmap,
 *   }
 */

import CoverageHeatmap from './CoverageHeatmap'
import TransferCreditRate from './TransferCreditRate'
import TransferExtraUnits from './TransferExtraUnits'
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
    title: 'Credit loss by campus',
    description: 'Compares required transfer coursework with the average number of community college courses students need for each campus choice.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-06T09:00:00',
    Component: PaperCreditLoss,
  },
  {
    id: 'paper-district-heatmap',
    title: 'Transfer coverage by district',
    description: 'Shows which community college districts offer a complete transfer path to each University of California campus.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:00:00',
    Component: PaperDistrictHeatmap,
  },
  {
    id: 'transfer-credit-rate',
    title: 'Degree credit toward graduation',
    description: 'Shows how much of a computer science associate degree counts toward graduation requirements at each university.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:00:00',
    Component: TransferCreditRate,
  },
  {
    id: 'transfer-extra-units',
    title: 'Additional coursework after transfer',
    description: 'Shows how many extra units transfer students may need compared with students who began at the university.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:05:00',
    Component: TransferExtraUnits,
  },
  {
    id: 'coverage-heatmap',
    title: 'Graduation requirement coverage',
    description: 'Shows how much of each university program’s graduation requirements can be completed at each community college.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:05:00',
    Component: CoverageHeatmap,
  },
  {
    id: 'credit-loss',
    title: 'Minimum transfer coursework',
    description: 'Shows the fewest courses or units needed to complete each campus transfer agreement.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:00:00',
    Component: CreditLoss,
  },
  {
    id: 'choice-cost',
    title: 'Cost of applying to more campuses',
    description: 'Shows how many additional community college courses are needed as students add more campus options.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:01:00',
    Component: ChoiceCost,
  },
  {
    id: 'category-gaps',
    title: 'Missing courses by subject',
    description: 'Shows where community colleges do not offer an equivalent course, organized by campus and subject.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:02:00',
    Component: CategoryGaps,
  },
  {
    id: 'complexity',
    title: 'Transfer pathway complexity',
    description: 'Shows how prerequisites can delay progress or block students along each transfer pathway.',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:03:00',
    Component: Complexity,
  },
  {
    id: 'time-to-degree',
    title: 'Associate degree transfer credit',
    description: 'Shows how much of an associate degree counts toward transfer requirements and estimates the cost of units that do not count.',
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
