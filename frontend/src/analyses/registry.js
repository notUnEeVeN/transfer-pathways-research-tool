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
 *     provenance: 'ma',                           // Visual-library lane: 'ca' | 'ma' | 'new'
 *     source: 'Jiang et al. 2024, Fig. 1',        // paper provenance, optional
 *     Component: CoverageHeatmap,
 *   }
 *
 * `provenance` sorts the figure into one of the Visual library's three source
 * lanes (see visuals/provenance.js): 'ca' ports the older transfer-articulation
 * research, 'ma' recreates the MA paper's figures on California data, and 'new'
 * is original to this paper. A published figure inherits the same lane from the
 * built-in it renders; anything without a lane falls back to 'new'.
 */

import CoverageHeatmap from './CoverageHeatmap'
import MultiCampusPathways, { MultiCampusPathwaysPreview } from './MultiCampusPathways'
import TransferCreditRate from './TransferCreditRate'
import TransferExtraUnits from './TransferExtraUnits'
import PaperCreditLoss from './PaperCreditLoss'
import PaperDistrictHeatmap from './PaperDistrictHeatmap'
import PaperArticulationHistogram from './PaperArticulationHistogram'
import ArticulationCoverageMap from './ArticulationCoverageMap'
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
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-06T09:00:00',
    Component: PaperCreditLoss,
  },
  {
    id: 'paper-district-heatmap',
    title: 'Transfer coverage by district',
    description: 'Shows which community college districts offer a complete transfer path to each University of California campus.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:00:00',
    Component: PaperDistrictHeatmap,
  },
  {
    id: 'paper-articulation-histogram',
    title: 'Districts by complete campus coverage',
    description: 'Shows how many community college districts offer complete computer science transfer paths to zero through nine University of California campuses.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-21T10:55:00',
    Component: PaperArticulationHistogram,
  },
  {
    id: 'paper-articulation-map',
    title: 'Articulation coverage across California',
    description: 'Maps each community college district by how many University of California campuses offer a complete computer science transfer path.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-21T11:00:00',
    Component: ArticulationCoverageMap,
  },
  {
    id: 'transfer-credit-rate',
    title: 'Degree credit toward graduation',
    description: 'Shows how much of a computer science associate degree counts toward graduation requirements at each university.',
    provenance: 'ma',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:00:00',
    Component: TransferCreditRate,
  },
  {
    id: 'transfer-extra-units',
    title: 'Modeled replacement coursework',
    description: 'Estimates how many associate-degree units may need to be replaced because they do not apply to university graduation requirements.',
    provenance: 'ma',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:05:00',
    Component: TransferExtraUnits,
  },
  {
    id: 'coverage-heatmap',
    title: 'Potential graduation-unit coverage',
    description: 'Shows what share of each university program’s modeled graduation units has a community-college equivalent.',
    provenance: 'ma',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:05:00',
    Component: CoverageHeatmap,
  },
  {
    id: 'multi-campus-pathways',
    title: 'Preparation planner for multiple campuses',
    description: 'See how keeping several University of California computer science pathways open changes the community college coursework and modeled regular terms.',
    provenance: 'new',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-21T09:00:00',
    Component: MultiCampusPathways,
    PreviewComponent: MultiCampusPathwaysPreview,
  },
  {
    id: 'credit-loss',
    title: 'Minimum transfer coursework',
    description: 'Shows the fewest courses or units needed to complete each campus transfer agreement.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:00:00',
    Component: CreditLoss,
  },
  {
    id: 'choice-cost',
    title: 'Cost of applying to more campuses',
    description: 'Shows how many additional community college courses are needed as students add more campus options.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:01:00',
    Component: ChoiceCost,
  },
  {
    id: 'category-gaps',
    title: 'Missing courses by subject',
    description: 'Shows where community colleges do not offer an equivalent course, organized by campus and subject.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:02:00',
    Component: CategoryGaps,
  },
  {
    id: 'complexity',
    title: 'Transfer pathway complexity',
    description: 'Shows how prerequisites can delay progress or block students along each transfer pathway.',
    provenance: 'ma',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:03:00',
    Component: Complexity,
  },
  {
    id: 'time-to-degree',
    title: 'Associate degree transfer credit',
    description: 'Shows how much of an associate degree counts toward transfer requirements and estimates the cost of units that do not count.',
    provenance: 'ma',
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
