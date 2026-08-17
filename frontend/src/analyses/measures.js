/**
 * Plain-language definition of each figure's statistic.
 *
 * The audience is a collaborating research team checking whether we measure
 * a quantity the same way they do. So each entry gives the arithmetic in
 * words, the grain of a single value, and — the part that actually matters —
 * the modelling choice most likely to differ between two teams. That is
 * almost always the denominator, the treatment of choose-one requirements,
 * or whether the model assumes an optimal student.
 *
 * These are written against what the code computes, not against what a
 * figure is nicknamed. When a definition changes, change it here too: a
 * stale formula is worse than none, because it will be believed.
 *
 * Keyed by the analysis id in registry.js. A missing key renders nothing.
 */
export const MEASURES = {
  'paper-credit-loss': {
    expression: 'courses added by a campus = community college courses in the pooled optimal pathway that the earlier choices did not already cover',
    grain: 'One bar per UC campus at one position in a four-campus application order, averaged over community college districts.',
    watchFor: 'Averaged only over districts where the campus is fully articulable at that position, so the blue bars describe students who can already reach the campus. The gold ASSIST bar is the required receiver-slot count from one systemwide canonical UC-side template per campus; district composition can change articulation paths but not that denominator. A series or named requirement is one slot unless ASSIST represents it as separate receivers.',
  },
  'paper-district-heatmap': {
    expression: 'district is complete ⇔ every required group or section meets its stated completion rule, including any choose-N minimum, using articulated options pooled across the district',
    grain: 'One yes or no per community college district × UC campus × selected major.',
    watchFor: 'The ASSIST state uses the same strict PMT eligibility predicates for Computer Science, Biology, and Economics. Each college’s exact stored required-group tree is evaluated without campus course allowlists, curation exclusions, a modal template, or evidence from another major; sibling colleges contribute only PMT’s exact receiving-side hash match. Computer Science also exposes its historical paper and hand-curated comparison states.',
  },
  'paper-articulation-histogram': {
    expression: 'bar height at n = number of districts that are complete for exactly n of the nine UC campuses',
    grain: 'One district contributes to exactly one integer bin from zero through nine.',
    watchFor: 'This is a distribution of the selected major’s district heatmap row totals, so it inherits its requirement source and district-wide pooling. It shows how common each number of campus options is, but not which campuses or districts produce a bar.',
  },
  'paper-articulation-map': {
    expression: 'district coverage = number of UC campuses for which the district is complete under the selected major’s active requirement model',
    grain: 'One count from zero to nine per community college district, displayed in the paper’s 0–3, 4–6, and 7–9 classes.',
    watchFor: 'The map is a geographic summary of the district heatmap, not a separate coverage calculation. Biology and Economics use ASSIST only; Computer Science retains its historical comparison states. The three broad display classes can hide exact-count changes that stay inside the same class.',
  },
  'paper-course-barriers': {
    expression: 'bar height = districts with no articulated equivalent for that course ÷ all 72 districts',
    grain: 'One percentage per UC campus × course category; a campus that does not require the course has no percentage.',
    watchFor: 'The denominator is every district. “Required” means unavoidable in the exact stored ASSIST groups whose is_required flag is true; no campus-specific course selection or waiver is applied. Alternative routes are honored by the shared PMT group logic. A district counts as missing when it cannot complete every unavoidable group in the category, so a panel can still be driven by one course in a mandatory sequence.',
  },
  'course-type-coverage': {
    expression: 'point = required courses of one course type with a community college equivalent ÷ required courses of that type, averaged across community colleges',
    grain: 'One point per university campus per course type; a campus that requires nothing of a type contributes no point.',
    watchFor: 'Read the scope control first. The default lower-division scope compares the types on coursework a community college can actually teach. The whole-degree scope also counts upper-division work no community college can offer, which suppresses a major’s own-discipline column for a structural reason, not because of articulation. Each point weights every community college equally, and the diamond averages the campus points, not the underlying pairs.',
  },
  'transfer-credit-rate': {
    expression: 'completion = bachelor’s requirement units fulfilled by the associate degree ÷ bachelor’s requirement units in the selected scope',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'Read the scope control first. The default lower-division view excludes the nontransferable tier; the full view includes upper-division and other university-only work. Associate-degree units apply at most once, while general education and elective room use an optimal-student assumption rather than observed transcripts.',
  },
  'transfer-extra-units': {
    expression: 'replacement units = total units in the associate degree − associate degree units that apply to the UC degree',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'This companion measure keeps the associate degree as its denominator, unlike the bachelor’s-requirement completion figure. Every optimistic application assumption pushes replacement units down, so read it as a lower bound rather than observed repeated coursework.',
  },
  'pathway-complexity': {
    expression: 'h(G) = Σ over pathway courses of (delay factor + blocking factor), on the prerequisite graph of the associate degree’s courses plus every university requirement the transfer does not satisfy; Δ = pathway h(G) − the campus’s own curriculum h(G).',
    grain: 'One score per community college × UC campus × associate-degree type, with the campus resident curriculum as its baseline.',
    watchFor: 'A negative Δ can be genuine where articulation is strong (a well-aligned associate degree replaces enough of the degree that the pathway is lighter than the resident map) — the opposite of Massachusetts, where weak alignment made every pathway heavier. Edge data is still partial and missing edges understate complexity, so treat small deltas as directional.',
  },
  'transfer-extra-cost': {
    expression: 'cost = replacement units (semester-equivalent) × campus annual resident tuition and fees ÷ (full-time load × 2 semesters)',
    grain: 'One dollar value per community college × UC campus, for one associate degree type and one full-time load basis.',
    watchFor: 'A campus bills a flat rate per term, so the per-unit price is derived, not published — the minimum-load basis divides by 12 units to follow the source paper, and the standard-load basis divides by 15, which is 20% cheaper per unit. Tuition and fees exclude waivable health insurance, room, board and books, and use the cohort that first enrolled in 2025-26; earlier cohorts pay less under UC’s tuition stability plan. It inherits every optimistic assumption in the replacement-units measure, so it is a lower bound on cost, and it prices coursework rather than the extra terms a student may actually enroll for.',
  },
  'coverage-heatmap': {
    expression: 'coverage = modeled graduation units with a community college equivalent ÷ all modeled graduation units',
    grain: 'One value per community college × UC program.',
    watchFor: 'The denominator is the whole modeled graduation plan and includes university-only work at zero coverage, so a cell cannot reach 100% unless the program reserves nothing for after transfer. Each campus stays in its own quarter or semester units and is never normalized, so an average across campuses mixes the two systems.',
  },
  'income-access': {
    expression: 'point = (income of the district’s catchment, UC campuses whose full selected-major transfer requirement the district articulates); each quartile bar is the mean campus count for one quarter of districts ordered by income',
    grain: 'One point per community college district; one summary bar per local-income quartile.',
    watchFor: 'Ecological and associational: it describes areas, not students, and identifies no cause. Income is a mean per tax return over the ZIP codes nearest the district’s centre — a catchment, not a statutory boundary — so a district near a boundary borrows some of its neighbour’s income. Compare the plotted values rather than assuming that every major has a strong or monotonic income gradient.',
  },
  'multi-campus-pathways': {
    expression: 'row mean at k = first average the jointly optimized, prerequisite-closed course plan for every real k-program portfolio within each eligible district, then average those district means equally',
    grain: 'One modeled plan per community college district × nonempty subset of district-reachable UC computer science programs; the figure summarizes portfolio sizes one through seven.',
    watchFor: 'This is modeled articulation feasibility, not observed student behavior. Courses may be pooled across member colleges, and time assumes regular-term availability under a 15-unit cap. The main curve includes feasible solver upper bounds so almost every real portfolio remains represented; the declining proven-minimum share is printed on every row and must remain visible.',
  },
  'credit-loss': {
    expression: 'transfer coursework = the fewest community college courses the solver finds that satisfy every required receiver in one agreement',
    grain: 'One value per agreement — a community college × UC campus × major — binned per campus.',
    watchFor: 'Overlap-aware and single-campus: a course satisfying two requirements counts once, and “complete one of three” costs one course rather than three. It is a best case for a student targeting exactly one campus, not a course load. Units are summed in the college’s own system with no quarter or semester conversion.',
  },
}

// The coverage heatmap changes its statistic with its controls, so its panel
// must change too — a definition of a lens the reader is not looking at is
// worse than none. One entry per figure state; the figure reports the active
// one upward through `onMeasureChange` and the gallery shows it in place of
// the static default.
export const COVERAGE_HEATMAP_MEASURES = {
  degree: MEASURES['coverage-heatmap'],
  'ma-courses': {
    expression: 'coverage = required courses with an articulated equivalent ÷ all required courses, at every level',
    grain: 'One value per community college × UC program.',
    watchFor: 'The Massachusetts paper’s published Figure 1 measure, for direct comparison — their statewide average was 38.2%. Every required course counts once, articulated or not, whether departmental, college, or campus and at any division: a complete-series requirement counts each of its courses (an articulated series covers all of them), a choose-N pool counts its N cheapest alternatives, and the two unit-only blocks in the corpus use the four-unit assumption. General education and free-elective padding are excluded. Upper-division requirements rarely articulate, which is what pulls this measure far below lower-division-only coverage.',
  },
  'ma-courses-ge': {
    expression: 'coverage = required courses with an articulated equivalent ÷ all required courses, general education included',
    grain: 'One value per community college × UC program.',
    watchFor: 'Our extension of the paper’s measure, not a figure they published — for general-education-heavy majors such as Economics, whose GE-excluded reading is dominated by the unarticulable upper division. Lower-division GE counts as articulable at every college (IGETC or Cal-GETC certification clears it, so the reading does not depend on how each template encodes its GE blocks); upper-division GE still counts against. Free-elective padding remains excluded, and the paper’s 38.2% benchmark applies only to the GE-excluded state.',
  },
  assist: {
    expression: 'coverage = listed ASSIST receivers satisfied ÷ receivers listed as required, following each requirement’s choose-N rule',
    grain: 'One value per community college × UC program.',
    watchFor: 'The raw agreement lens: the denominator is whatever this pair’s ASSIST agreement lists as required, so it differs between pairs and is not a graduation plan. A series counts as one receiver satisfied only when every course in it articulates.',
  },
  paper: {
    expression: 'coverage = hand-curated minimum requirements satisfied ÷ minimums required',
    grain: 'One value per community college × UC program.',
    watchFor: 'Computer Science only: the historical website-minimums basis kept for comparison with the papers. Requirement groups must all be satisfied; alternative sets within a group count when any one set is complete.',
  },
}

// The transfer-credit-rate figure's MA state flips the denominator to the
// associate degree's own units — the final paper's Figure 3 — while the
// default state keeps the bachelor-side completion measure.
export const TRANSFER_CREDIT_RATE_MEASURES = {
  default: MEASURES['transfer-credit-rate'],
  'ma-as-side': {
    expression: 'transfer credit rate = associate-degree units that apply ÷ the associate degree’s own units',
    grain: 'One value per community college × university, for one associate degree type.',
    watchFor: 'On the Massachusetts tab the Source control switches between THREE versions of this one measure: the final paper’s Figure 3 as printed (the newer revision of their hand tally — its per-university averages mean 68%), the repo workbook’s older tally (mean 65.2%), and our recomputation from the paper’s own pathway workbooks (which matches the tally almost exactly wherever the paper’s two artifacts agree; r = 0.99 on those pairs). Every cell’s hover lists all three, so a difference between them is one glance away. Blank cells are pairs the paper did not study (outside 50 driving miles), not zeroes. On California data this state shows our recomputation of the same measure, statewide.',
  },
}

export function measureFor(analysisId) {
  return MEASURES[analysisId] || null
}
