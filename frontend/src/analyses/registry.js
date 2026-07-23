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
 *     figureNo: 1,                                // source paper's figure number (ports only) -> "MA Fig. 1" pill
 *     source: 'Jiang et al. 2024, Fig. 1',        // paper provenance, optional
 *     majorScope: {                               // declarative major/data support
 *       mode: 'selected',
 *       requiredCapabilities: ['degreeTemplates'],
 *       datasets: ['articulation agreements', 'four-year degree templates'],
 *     },
 *     Component: CoverageHeatmap,
 *   }
 *
 * `figureNo` is set only on figures that reproduce a specific numbered figure
 * from the CA/MA paper; the gallery card shows it as a "<lane> Fig. <n>" pill.
 * Derived analyses and originals leave it unset (no pill).
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
import PaperCreditLoss, { PaperCreditLossPreview } from './PaperCreditLoss'
import PaperDistrictHeatmap, { PaperDistrictHeatmapPreview } from './PaperDistrictHeatmap'
import PaperArticulationHistogram, { PaperArticulationHistogramPreview } from './PaperArticulationHistogram'
import ArticulationCoverageMap from './ArticulationCoverageMap'
import PaperCourseBarriers, { PaperCourseBarriersPreview } from './PaperCourseBarriers'
import CourseTypeCoverage from './CourseTypeCoverage'
import IncomeAccess from './IncomeAccess'
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

const selectedMajor = ({ requiredCapabilities = [], datasets = [], pendingReason } = {}) => ({
  majorScope: {
    mode: 'selected',
    requiredCapabilities,
    datasets,
    ...(pendingReason ? { pendingReason } : {}),
  },
})

// For the California-paper ports, "selected" also carries a state policy:
// Computer Science keeps its audited paper/hand-curated/ASSIST comparisons,
// while every newer major renders one unpinned live ASSIST state. Each port
// enforces that boundary at its query call and in focused regression tests.

// `pinnedMajor` remains on fixed figures for compatibility with published
// interactive manifests. New gallery rendering should resolve `majorScope`
// instead, so a selected-major figure can never silently fall back to CS.
const fixedComputerScience = ({ reason, datasets = [] }) => ({
  pinnedMajor: 'cs',
  majorScope: {
    mode: 'fixed',
    slug: 'cs',
    label: 'Computer Science',
    reason,
    datasets,
  },
})

export const ANALYSES = [
  {
    id: 'paper-credit-loss',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'caCreditLossArtifact'],
      datasets: ['ASSIST articulation agreements', 'generated California Figure 1 artifact'],
      pendingReason: 'The major-specific California Figure 1 artifact must be generated from ASSIST agreements before this visual can run.',
    }),
    title: 'Credit loss by campus',
    description: 'Compares required transfer coursework with the average number of community college courses students need for each campus choice.',
    provenance: 'ca',
    figureNo: 1,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-06T09:00:00',
    Component: PaperCreditLoss,
    PreviewComponent: PaperCreditLossPreview,
  },
  {
    id: 'paper-district-heatmap',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements'],
      datasets: ['ASSIST articulation agreements', 'community college districts'],
    }),
    title: 'Transfer coverage by district',
    description: 'Shows which community college districts offer a complete transfer path to each University of California campus.',
    provenance: 'ca',
    figureNo: 2,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:00:00',
    Component: PaperDistrictHeatmap,
    PreviewComponent: PaperDistrictHeatmapPreview,
  },
  {
    id: 'paper-articulation-histogram',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements'],
      datasets: ['ASSIST articulation agreements', 'community college districts'],
    }),
    title: 'Districts by complete campus coverage',
    description: 'Shows how many community college districts offer a complete transfer path to zero through nine University of California campuses.',
    provenance: 'ca',
    figureNo: 3,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-21T10:55:00',
    Component: PaperArticulationHistogram,
    PreviewComponent: PaperArticulationHistogramPreview,
  },
  {
    id: 'paper-articulation-map',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements'],
      datasets: ['ASSIST articulation agreements', 'California community college district geography'],
    }),
    title: 'Articulation coverage across California',
    description: 'Maps each community college district by how many University of California campuses offer a complete transfer path.',
    provenance: 'ca',
    figureNo: 4,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-21T11:00:00',
    Component: ArticulationCoverageMap,
  },
  {
    id: 'paper-course-barriers',
    ...fixedComputerScience({
      reason: 'This course-level figure needs a redesigned major-specific course organization before it can move beyond Computer Science.',
      datasets: ['committed California-paper baseline', 'Computer Science course-group mapping'],
    }),
    title: 'Course gaps by campus',
    description: 'Shows the share of community college districts with no articulated equivalent for each math and computer science course a University of California campus requires for transfer admission.',
    provenance: 'ca',
    figureNo: 5,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-22T09:00:00',
    Component: PaperCourseBarriers,
    PreviewComponent: PaperCourseBarriersPreview,
  },
  {
    id: 'course-type-coverage',
    ...fixedComputerScience({
      reason: 'Course-type rules have only been validated for Computer Science.',
      datasets: ['articulation agreements', 'Computer Science course-type rules'],
    }),
    title: 'Transferable requirements by course type',
    description: 'Shows what share of each university computer science degree’s requirements has a community college equivalent, separated into computing, math, science, and other coursework.',
    provenance: 'ma',
    figureNo: 2,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-22T09:30:00',
    Component: CourseTypeCoverage,
  },
  {
    id: 'transfer-credit-rate',
    ...fixedComputerScience({
      reason: 'Associate-degree inputs are currently available only for Computer Science.',
      datasets: ['associate degrees', 'four-year degree templates'],
    }),
    title: 'Degree credit toward graduation',
    description: 'Shows what share of complete or lower-division bachelor’s requirements is fulfilled by a computer science associate degree.',
    provenance: 'ma',
    figureNo: 3,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:00:00',
    Component: TransferCreditRate,
  },
  {
    id: 'transfer-extra-units',
    ...fixedComputerScience({
      reason: 'Associate-degree inputs are currently available only for Computer Science.',
      datasets: ['associate degrees', 'four-year degree templates'],
    }),
    title: 'Modeled replacement coursework',
    description: 'Estimates how many associate-degree units may need to be replaced because they do not apply to university graduation requirements.',
    provenance: 'ma',
    figureNo: 4,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:05:00',
    Component: TransferExtraUnits,
  },
  {
    id: 'coverage-heatmap',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'degreeTemplates'],
      datasets: ['articulation agreements', 'four-year degree templates'],
      pendingReason: 'Four-year degree requirements must be gathered before graduation-unit coverage can be modeled.',
    }),
    title: 'Potential graduation-unit coverage',
    description: 'Shows what share of each university program’s modeled graduation units has a community-college equivalent.',
    provenance: 'ma',
    figureNo: 1,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-03T09:05:00',
    Component: CoverageHeatmap,
  },
  {
    id: 'income-access',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements'],
      datasets: ['ASSIST articulation agreements', 'district income and geography'],
    }),
    title: 'Transfer access and local income',
    description: 'Compares how many university programs each community college district can fully reach with the income of the area it serves, alongside the district’s population and its distance to the nearest campus.',
    provenance: 'new',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-22T11:00:00',
    Component: IncomeAccess,
  },
  {
    id: 'multi-campus-pathways',
    ...fixedComputerScience({
      reason: 'This figure is backed by a committed Computer Science pathway snapshot.',
      datasets: ['committed multi-campus pathway snapshot'],
    }),
    title: 'Preparation as campus options expand',
    description: 'Shows how modeled courses and regular terms change when students keep one through seven reachable university computer science options open.',
    provenance: 'new',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-21T09:00:00',
    Component: MultiCampusPathways,
    PreviewComponent: MultiCampusPathwaysPreview,
  },
  {
    id: 'credit-loss',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'agreementPathways'],
      datasets: ['articulation agreements', 'proof-aware per-agreement pathway solutions'],
      pendingReason: 'Per-agreement pathways must exclude blocked agreements and record solver optimality before this visual can run for the selected major.',
    }),
    title: 'Minimum transfer coursework',
    description: 'Shows the fewest courses or units needed to complete each campus transfer agreement.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:00:00',
    Component: CreditLoss,
  },
  {
    id: 'choice-cost',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'agreementPathways'],
      datasets: ['articulation agreements', 'proof-aware per-agreement pathway solutions'],
      pendingReason: 'Per-agreement pathways must exclude blocked agreements and record solver optimality before this visual can run for the selected major.',
    }),
    title: 'Cost of applying to more campuses',
    description: 'Shows how many additional community college courses are needed as students add more campus options.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:01:00',
    Component: ChoiceCost,
  },
  {
    id: 'category-gaps',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'courseCategories'],
      datasets: ['articulation agreements', 'validated course categories'],
      pendingReason: 'Course categories must be validated for this major before subject gaps can be compared.',
    }),
    title: 'Missing courses by subject',
    description: 'Shows where community colleges do not offer an equivalent course, organized by campus and subject.',
    provenance: 'ca',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:02:00',
    Component: CategoryGaps,
  },
  {
    id: 'complexity',
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'prerequisites'],
      datasets: ['articulation agreements', 'validated prerequisite concepts'],
      pendingReason: 'Prerequisite concepts and chains must be validated for this major before pathway complexity can be modeled.',
    }),
    title: 'Transfer pathway complexity',
    description: 'Shows how prerequisites can delay progress or block students along each transfer pathway.',
    provenance: 'ma',
    figureNo: 6,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-04T09:03:00',
    Component: Complexity,
  },
  {
    id: 'time-to-degree',
    ...fixedComputerScience({
      reason: 'Associate-degree inputs are currently available only for Computer Science.',
      datasets: ['associate degrees', 'articulation agreements'],
    }),
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
