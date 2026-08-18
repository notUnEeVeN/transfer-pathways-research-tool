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
 *
 * Two further fields are optional and read only by the Compare tab. Both
 * degrade gracefully: a figure declaring neither still panes, still saves and
 * still takes notes.
 *
 *   viewKnobs: [{ key, label, type: 'select'|'toggle', options, default, prop,
 *                 appliesWhen(major) }]
 *     The controls a comparison may PIN. `prop` names the `default*` prop the
 *     figure already reads as a useState seed, so pinning a control never
 *     turns the figure into a controlled component. Every `prop` must appear
 *     in `Component.viewProps` — compare/viewKnobs.test.js fails otherwise,
 *     because a knob the figure does not read would silently render the wrong
 *     state under a caption claiming it was pinned.
 *
 *   comparable: { grain, unit, tolerance, useData(view), cells(data, view) }
 *     How two panes of this figure are differenced. `useData` is the figure's
 *     OWN hook (react-query dedupes, so the panes and the delta overlay share
 *     one request), and `cells` may only call functions the figure's module
 *     exports. That constraint is the whole point: the difference shown is the
 *     figure's own number by construction, not a second reading of the data.
 */

import CoverageHeatmap from './CoverageHeatmap'
import MultiCampusPathways, { MultiCampusPathwaysPreview } from './MultiCampusPathways'
import TransferCreditRate from './TransferCreditRate'
import TransferExtraUnits from './TransferExtraUnits'
import TransferExtraCost from './TransferExtraCost'
import PathwayComplexity, { paperEntries } from './PathwayComplexity'
import PaperCreditLoss, { PaperCreditLossPreview } from './PaperCreditLoss'
import PaperDistrictHeatmap, { PaperDistrictHeatmapPreview } from './PaperDistrictHeatmap'
import PaperArticulationHistogram, { PaperArticulationHistogramPreview } from './PaperArticulationHistogram'
import ArticulationCoverageMap from './ArticulationCoverageMap'
import PaperCourseBarriers, { PaperCourseBarriersPreview } from './PaperCourseBarriers'
import CourseTypeCoverage from './CourseTypeCoverage'
import IncomeAccess from './IncomeAccess'
import PriceOfPlace, { PriceOfPlacePreview } from './PriceOfPlace'
import PaperGate, { PaperGatePreview } from './PaperGate'
import CreditLoss from './CreditLoss'
import { usePathwayComplexity } from '../shared/query/hooks/useData'

// The built-in analyses render as first-class figures in the Visuals gallery,
// credited to the console owner and dated alongside locally published
// figures. `published_at` also sets their position in
// the single publish-ordered gallery (oldest first; new figures land below).
// TODO(owner): confirm the exact display name to attribute these to.
export const ANALYSIS_AUTHOR = 'Tybalt Mallet'

const selectedMajor = ({ requiredCapabilities = [], datasets = [], pendingReason, excludedMajors } = {}) => ({
  majorScope: {
    mode: 'selected',
    requiredCapabilities,
    datasets,
    ...(pendingReason ? { pendingReason } : {}),
    // Editorial exclusions: majors whose data technically supports the figure
    // but for which it is deliberately not offered, with the reason shown on
    // the card. Not a capability gate — nothing is pending.
    ...(excludedMajors ? { excludedMajors } : {}),
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
      excludedMajors: {
        econ: 'Economics asks for at most a handful of stated courses per campus (Riverside: under one on average), so the permutation-averaged credit-loss machinery has nearly nothing to measure. The figure is built for majors with CS-sized asks.',
      },
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
      // State-agnostic: any major whose corpus renders strict-engine coverage
      // verdicts (California through ASSIST, Maryland through ARTSYS).
      requiredCapabilities: ['articulationVerdicts'],
      datasets: ['articulation agreements', 'sending-institution grouping'],
    }),
    title: 'Transfer coverage by district',
    description: 'Shows which community college districts offer a complete transfer path to each University of California campus.',
    // Maryland has no district construction — the college is the row unit.
    stateTitles: { md: 'Transfer coverage by college' },
    stateDescriptions: { md: 'Shows which community colleges offer a complete transfer path into each program with a published guide.' },
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
      requiredCapabilities: ['articulationVerdicts'],
      datasets: ['articulation agreements', 'sending-institution grouping'],
    }),
    title: 'Districts by complete campus coverage',
    description: 'Shows how many community college districts offer a complete transfer path to zero through nine University of California campuses.',
    stateTitles: { md: 'Colleges by complete program coverage' },
    stateDescriptions: { md: 'Shows how many colleges hold a complete transfer path into zero through all of the programs with published guides.' },
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
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'courseTypeFigures'],
      excludedMajors: {
        econ: 'Economics states a median of five receiver slots per campus and no course category is unsatisfiable anywhere, so the per-category gap panels render as an empty grid. The figure is built for majors with CS-sized asks.',
      },
      datasets: ['ASSIST articulation agreements', 'course-type rules'],
      pendingReason: 'Course-type rules must be written and validated against this major’s ASSIST requirements before its course gaps can be compared.',
    }),
    title: 'Course gaps by campus',
    description: 'Shows the share of community college districts with no articulated equivalent for each subject a University of California campus requires for transfer admission.',
    provenance: 'ca',
    figureNo: 5,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-22T09:00:00',
    Component: PaperCourseBarriers,
    PreviewComponent: PaperCourseBarriersPreview,
  },
  {
    id: 'course-type-coverage',
    // The controls a saved comparison pins, so it reopens on the reading it
    // was saved with. Each `prop` seeds the figure's own useState.
    viewKnobs: [
      {
        key: 'scope', label: 'Scope', type: 'select',
        prop: 'defaultScope', default: 'lower-division',
        options: [{ value: 'lower-division', label: 'Lower division' }, { value: 'whole-degree', label: 'Whole degree' }],
      },
      {
        key: 'variant', label: 'Category grouping', type: 'select',
        prop: 'defaultVariant', default: 'faithful',
        options: [{ value: 'faithful', label: 'Paper categories' }, { value: 'extended', label: 'Extended categories' }],
        appliesWhen: (major) => Boolean(major?.courseTypes?.axes?.extended),
      },
    ],
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'degreeTemplates', 'courseTypeFigures'],
      datasets: ['articulation agreements', 'four-year degree templates', 'course-type rules'],
      pendingReason: 'Course-type rules must be written and validated against this major’s degree templates before its requirements can be separated by type.',
    }),
    title: 'Transferable requirements by course type',
    description: 'Shows what share of each university degree’s requirements has a community college equivalent, separated by the kind of course it is — the major’s own discipline, math, supporting science, and everything else.',
    provenance: 'ma',
    figureNo: 2,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-22T09:30:00',
    Component: CourseTypeCoverage,
  },
  {
    id: 'transfer-credit-rate',
    // The controls a saved comparison pins, so it reopens on the reading it
    // was saved with. Each `prop` seeds the figure's own useState.
    viewKnobs: [
      {
        key: 'degree', label: 'Associate degree', type: 'select',
        prop: 'defaultDegreeType', default: 'ast',
        options: [{ value: 'ast', label: 'A.S.-T' }, { value: 'local_as', label: 'Local A.S.' }, { value: 'local_other', label: 'Other local' }],
      },
      {
        key: 'scope', label: 'Scope', type: 'select',
        prop: 'defaultScope', default: 'lower-division',
        options: [{ value: 'lower-division', label: 'Lower division' }, { value: 'full-degree', label: 'Full degree' }],
        appliesWhen: (major) => !(major?.state && major?.capabilities?.paperBaselines),
      },
      {
        key: 'ma-equivalent', label: 'MA-paper-equivalent lens', type: 'toggle',
        prop: 'defaultMaEquivalent', default: false,
        appliesWhen: (major) => !(major?.state && major?.capabilities?.paperBaselines),
      },
      {
        key: 'verified', label: 'Verified sources only', type: 'toggle',
        prop: 'defaultVerifiedOnly', default: false,
        appliesWhen: (major) => !(major?.state && major?.capabilities?.paperBaselines),
      },
      {
        key: 'source', label: 'Source', type: 'select',
        prop: 'defaultMaSource', default: 'pdf',
        options: [{ value: 'pdf', label: 'Final paper' }, { value: 'repo', label: 'Repo workbook' }, { value: 'ours', label: 'Ours' }],
        appliesWhen: (major) => Boolean(major?.state && major?.capabilities?.paperBaselines),
      },
      {
        key: 'ge', label: 'Include general education', type: 'toggle',
        prop: 'defaultMaGeOn', default: true,
        appliesWhen: (major) => Boolean(major?.state && major?.capabilities?.paperBaselines),
      },
    ],
    ...selectedMajor({
      requiredCapabilities: ['asDegrees', 'assistAgreements', 'degreeTemplates'],
      datasets: ['associate degrees', 'ASSIST articulation agreements', 'four-year degree templates'],
      pendingReason: 'Associate-degree requirements and four-year graduation templates must be present before degree credit can be modeled.',
    }),
    title: 'Degree credit toward graduation',
    description: 'Shows what share of complete or lower-division bachelor’s requirements is fulfilled by the selected associate degree.',
    // On the Massachusetts corpus the card opens on the paper's own Figure 3
    // and shows the published per-pair values as printed.
    stateTitles: { ma: 'Transfer credit rate', va: 'Transfer credit rate' },
    stateDescriptions: {
      ma: 'The paper’s Figure 3 as published: the share of each associate degree’s credits that apply on transfer, per studied pair — unstudied pairs stay blank. Our recomputation sits in the Overview’s comparison panel.',
      va: 'The share of each VCCS associate degree’s credits that apply toward the bachelor’s on transfer. Computed from Transfer Virginia’s published course equivalencies; the verified cohort filters to associate degrees a reviewer has confirmed.',
    },
    provenance: 'ma',
    figureNo: 3,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-18T09:00:00',
    Component: TransferCreditRate,
  },
  {
    id: 'transfer-extra-units',
    // The controls a saved comparison pins, so it reopens on the reading it
    // was saved with. Each `prop` seeds the figure's own useState.
    viewKnobs: [
      {
        key: 'degree', label: 'Associate degree', type: 'select',
        prop: 'defaultDegreeType', default: 'ast',
        options: [{ value: 'ast', label: 'A.S.-T' }, { value: 'local_as', label: 'Local A.S.' }, { value: 'local_other', label: 'Other local' }],
      },
      {
        key: 'verified', label: 'Verified sources only', type: 'toggle',
        prop: 'defaultVerifiedOnly', default: false,
        appliesWhen: (major) => !(major?.state && major?.capabilities?.paperBaselines),
      },
    ],
    ...selectedMajor({
      requiredCapabilities: ['asDegrees', 'assistAgreements', 'degreeTemplates'],
      datasets: ['associate degrees', 'ASSIST articulation agreements', 'four-year degree templates'],
      pendingReason: 'Associate-degree requirements and four-year graduation templates must be present before replacement coursework can be modeled.',
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
    id: 'transfer-extra-cost',
    // The controls a saved comparison pins, so it reopens on the reading it
    // was saved with. Each `prop` seeds the figure's own useState.
    viewKnobs: [
      {
        key: 'degree', label: 'Associate degree', type: 'select',
        prop: 'defaultDegreeType', default: 'ast',
        options: [{ value: 'ast', label: 'A.S.-T' }, { value: 'local_as', label: 'Local A.S.' }, { value: 'local_other', label: 'Other local' }],
      },
      {
        key: 'verified', label: 'Verified sources only', type: 'toggle',
        prop: 'defaultVerifiedOnly', default: false,
        appliesWhen: (major) => !(major?.state && major?.capabilities?.paperBaselines),
      },
    ],
    ...selectedMajor({
      requiredCapabilities: ['asDegrees', 'assistAgreements', 'degreeTemplates'],
      datasets: ['associate degrees', 'ASSIST articulation agreements', 'four-year degree templates', 'campus tuition and fees'],
      pendingReason: 'Associate-degree requirements, four-year graduation templates and published campus tuition must all be present before replacement coursework can be priced.',
    }),
    title: 'Cost of replacement coursework',
    description: 'Prices the associate-degree units that do not apply, using each campus’s published resident tuition and fees.',
    provenance: 'ma',
    figureNo: 5,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-08-04T09:00:00',
    Component: TransferExtraCost,
  },
  {
    id: 'pathway-complexity',
    ...selectedMajor({
      // Live scoring needs prerequisite graphs; the Massachusetts corpus
      // instead renders the committed reproduction of the paper's own
      // figure (its recovered workbooks carry the prerequisite edges), so
      // either capability satisfies the gate.
      requiredCapabilities: ['asDegrees', 'assistAgreements', 'degreeTemplates', 'prerequisites|paperBaselines'],
      datasets: ['associate degrees', 'articulation agreements', 'four-year degree templates', 'prerequisite graphs'],
      pendingReason: 'Associate degrees, degree templates and prerequisite graphs must all be present before pathway complexity can be scored.',
    }),
    title: 'Curricular complexity of transfer pathways',
    description: 'Scores each transfer pathway’s prerequisite graph with the paper’s Figure 6 measure — delay and blocking factors summed per course — against the campus’s own curriculum. The metric reproduced the paper’s published scores on 58 of 60 of their own pathways.',
    provenance: 'ma',
    figureNo: 6,
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-08-15T09:00:00',
    Component: PathwayComplexity,
    viewKnobs: [
      {
        key: 'source',
        label: 'Source',
        type: 'select',
        prop: 'defaultPaperView',
        options: [
          { value: 'published', label: 'Paper (published)' },
          { value: 'ours', label: 'Ours (recomputed)' },
          { value: 'diff', label: 'Difference' },
        ],
        default: 'published',
        // The control exists only where the server answers `mode: 'paper'`,
        // which is the paper-baseline corpora that cannot be scored live
        // (Analysis.js). California carries paperBaselines too but has its own
        // prerequisite graphs, so its matrix is computed, not reproduced, and
        // has no published/recomputed distinction to pin.
        appliesWhen: (major) => Boolean(
          major?.capabilities?.paperBaselines && !major?.capabilities?.prerequisites,
        ),
      },
    ],
    comparable: {
      grain: 'college×campus',
      unit: 'score-delta',
      tolerance: 0,
      useData: (view) => usePathwayComplexity({ majorSlug: view.major }),
      // paperEntries is the figure's own reading, including the printed-cell
      // overrides and the resident-score anchoring. Re-deriving the delta here
      // would let the overlay disagree with the matrix beside it.
      cells: (data, view) => {
        if (!data) return []
        if (data.mode === 'paper') {
          return paperEntries(data, view?.knobs?.source ?? 'published').map((entry) => ({
            rowKey: entry.row,
            rowLabel: entry.row,
            colKey: entry.column,
            colLabel: entry.column,
            value: entry.delta,
          }))
        }
        return (data.rows || []).map((row) => ({
          rowKey: row.college_name,
          rowLabel: row.college_name,
          colKey: row.school,
          colLabel: row.school,
          value: row.delta_vs_resident,
        }))
      },
    },
  },
  {
    id: 'coverage-heatmap',
    // The controls a saved comparison pins, so it reopens on the reading it
    // was saved with. Each `prop` seeds the figure's own useState.
    viewKnobs: [
      {
        key: 'rows', label: 'Row grouping', type: 'select',
        prop: 'defaultRowMode', default: 'college',
        options: [{ value: 'college', label: 'Colleges' }, { value: 'district', label: 'Districts' }, { value: 'county', label: 'Counties' }],
      },
      {
        key: 'basis', label: 'Requirement basis', type: 'select',
        prop: 'defaultReqMode', default: 'degree',
        options: [{ value: 'degree', label: 'Graduation model' }, { value: 'assist', label: 'ASSIST agreements' }, { value: 'paper', label: 'Curated minimums' }],
        // The whole basis control lives inside the unit-lens block; a corpus
        // without it is forced onto the paper's course lens.
        appliesWhen: (major) => major?.capabilities?.unitCoverage !== false,
      },
      {
        key: 'ma-equivalent', label: 'MA-paper-equivalent lens', type: 'toggle',
        prop: 'defaultMaEquivalent', default: false,
        appliesWhen: (major) => major?.capabilities?.unitCoverage !== false,
      },
      {
        key: 'ma-include-ge', label: 'Include general education', type: 'toggle',
        prop: 'defaultMaIncludeGe', default: false,
        appliesWhen: (major) => major?.capabilities?.unitCoverage !== false,
      },
    ],
    ...selectedMajor({
      requiredCapabilities: ['assistAgreements', 'degreeTemplates'],
      datasets: ['articulation agreements', 'four-year degree templates'],
      pendingReason: 'Four-year degree requirements must be gathered before graduation-unit coverage can be modeled.',
    }),
    title: 'Potential graduation-unit coverage',
    description: 'Shows what share of each university program’s modeled graduation units has a community-college equivalent.',
    // On the Massachusetts corpus the unit model is gated off and the figure
    // IS the paper's course measure, so the card carries that name.
    stateTitles: { ma: 'Requirement articulation', va: 'Requirement articulation' },
    stateDescriptions: {
      ma: 'Shows the share of each university’s required courses — every level, GE excluded — with an articulating community-college course: the paper’s Figure 1 measure, published mean 38.2%.',
      va: 'Shows the share of each four-year’s required courses — GE excluded — with an equivalent published by a community college. Requirements Virginia itself marks as work no community college can satisfy (senior residency, capstones) are outside the population, so the measure is comparable with California and Massachusetts.',
    },
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
    id: 'price-of-place',
    ...fixedComputerScience({
      reason: 'This sequence is backed by a committed snapshot computed for the nine Computer Science programs against every other major in the full agreement corpus.',
      datasets: ['committed full-corpus articulation snapshot', 'district income and geography'],
    }),
    title: 'The Income Gate',
    description: 'Income, distance, and transfer access: five connected figures from a committed snapshot of the complete agreement corpus, showing how district income relates to whether a complete Computer Science transfer path formally exists — measured against a field of about nine hundred other majors.',
    provenance: 'new',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-24T18:00:00',
    Component: PriceOfPlace,
    PreviewComponent: PriceOfPlacePreview,
  },
  {
    id: 'paper-gate',
    ...fixedComputerScience({
      reason: 'This sequence is backed by a committed course-repair simulation over the nine Computer Science programs, with the full agreement corpus as evidence.',
      datasets: ['committed course-repair simulation artifact'],
    }),
    title: 'The Computing Bottleneck',
    description: 'Missing articulation, evidence, and the income gap: five connected figures from a committed course-repair simulation of the nine Computer Science programs — which required courses bind the remaining transfer paths, the same-class evidence behind each missing entry, and how far the income-quartile access gap closes under simulated repairs.',
    provenance: 'new',
    author_label: ANALYSIS_AUTHOR,
    published_at: '2026-07-25T15:00:00',
    Component: PaperGate,
    PreviewComponent: PaperGatePreview,
  },
]

const ANALYSIS_BY_ID = new Map(ANALYSES.map((analysis) => [analysis.id, analysis]))

// Published interactive manifests resolve through the same registry as the
// built-ins. Returning the registry entry itself (rather than a wrapper or a
// copied implementation) is what makes renderer parity exact by construction.
export function getAnalysisById(id) {
  return ANALYSIS_BY_ID.get(String(id || '')) || null
}
