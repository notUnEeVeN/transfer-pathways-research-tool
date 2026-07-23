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
    watchFor: 'Averaged only over districts where the campus is fully articulable at that position, so the bars describe students who can already reach the campus. Courses are identified by name, so a course shared with an earlier choice is counted once — which is why later choices look cheap.',
  },
  'paper-district-heatmap': {
    expression: 'district is complete ⇔ every required course group has at least one fully articulated option somewhere in the district',
    grain: 'One yes or no per community college district × UC campus.',
    watchFor: 'Articulation pools across every college in the district, so a complete district is not a promise that any single college offers the whole path. Within a group the test is all-or-nothing: one satisfied option is enough, and a partly satisfied option counts for nothing.',
  },
  'paper-articulation-histogram': {
    expression: 'bar height at n = number of districts that are complete for exactly n of the nine UC campuses',
    grain: 'One district contributes to exactly one integer bin from zero through nine.',
    watchFor: 'This is a distribution of the district heatmap’s row totals, so it inherits district-wide pooling across colleges. It shows how common each number of campus options is, but not which campuses or districts produce a bar.',
  },
  'paper-articulation-map': {
    expression: 'district coverage = number of UC campuses for which the district is complete under the paper’s hard-minimum requirement model',
    grain: 'One count from zero to nine per community college district, displayed in the paper’s 0–3, 4–6, and 7–9 classes.',
    watchFor: 'The map is a geographic summary of the district heatmap, not a separate coverage calculation. District locations are approximate centroids inherited from the paper pipeline, and the three broad display classes can hide exact-count changes that stay inside the same class.',
  },
  'paper-course-barriers': {
    expression: 'bar height = districts with no articulated equivalent for that course ÷ all 72 districts',
    grain: 'One percentage per UC campus × course category; a campus that does not require the course has no percentage.',
    watchFor: 'The denominator is every district, including the ones that already articulate the course and the ones that require nothing else from that campus, so bars are comparable across panels but understate the burden on districts that use the campus. A district counts as missing whenever any one requirement group in the category fails, so a panel can be driven by a single course in a multi-course sequence.',
  },
  'course-type-coverage': {
    expression: 'point = required courses of one course type with a community college equivalent ÷ required courses of that type, averaged across community colleges',
    grain: 'One point per university campus per course type; a campus that requires nothing of a type contributes no point.',
    watchFor: 'Read the scope control first. The default counts the whole degree, including upper-division work no community college can offer — that suppresses the computing column for a structural reason true of any major in its own subject, not because of articulation. The lower-division scope compares the types on coursework a community college can actually teach. Each point weights every community college equally, and the diamond averages the campus points, not the underlying pairs.',
  },
  'transfer-credit-rate': {
    expression: 'completion = bachelor’s requirement units fulfilled by the associate degree ÷ bachelor’s requirement units in the selected scope',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'Read the scope control first. The full view includes upper-division and other university-only work; the lower-division view excludes the nontransferable tier. Associate-degree units apply at most once, while general education and elective room use an optimal-student assumption rather than observed transcripts.',
  },
  'transfer-extra-units': {
    expression: 'replacement units = total units in the associate degree − associate degree units that apply to the UC degree',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'This companion measure keeps the associate degree as its denominator, unlike the bachelor’s-requirement completion figure. Every optimistic application assumption pushes replacement units down, so read it as a lower bound rather than observed repeated coursework.',
  },
  'coverage-heatmap': {
    expression: 'coverage = modeled graduation units with a community college equivalent ÷ all modeled graduation units',
    grain: 'One value per community college × UC program.',
    watchFor: 'The denominator is the whole modeled graduation plan and includes university-only work at zero coverage, so a cell cannot reach 100% unless the program reserves nothing for after transfer. Each campus stays in its own quarter or semester units and is never normalized, so an average across campuses mixes the two systems.',
  },
  'income-access': {
    expression: 'point = (income of the district’s catchment, campuses whose full transfer requirement the district articulates); the panel is a standardized least-squares fit of campuses on log income, log population and log distance to the nearest campus',
    grain: 'One point per community college district; the panel is one coefficient per predictor over all districts.',
    watchFor: 'Ecological and associational: it describes areas, not students, and the fit identifies no cause. Income is a mean per tax return over the ZIP codes nearest the district’s centre — a catchment, not a statutory boundary — so a district near a boundary borrows some of its neighbour’s income. The three predictors are correlated with each other, so read the coefficients as “income still matters alongside these”, not as separate effects.',
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
  'choice-cost': {
    expression: 'cost of a campus = courses in its own minimum pathway that the campuses ahead of it in the order did not already require',
    grain: 'One value per UC campus at one position in the chosen application order, averaged over community colleges.',
    watchFor: 'Order dependent and not symmetric — reordering the same campuses moves cost between them. Each campus is solved on its own and the results are then differenced, so this overstates the true joint minimum whenever a different per-campus choice would have shared more courses.',
  },
  'category-gaps': {
    expression: 'gap rate = colleges where this subject blocks the campus ÷ colleges where the campus requires this subject',
    grain: 'One value per UC campus × course subject. The value counts colleges, not courses.',
    watchFor: 'An unarticulated course inside a requirement that is already satisfied another way is not counted as a gap, so this is lower than a raw count of unarticulated courses. The “Untagged” row is courses with no subject mapping — it measures data completeness, not a subject.',
  },
  complexity: {
    expression: 'complexity = sum over pathway courses of (longest prerequisite chain ending at the course + number of courses it unlocks)',
    grain: 'One value per agreement — a community college × UC campus × major — binned per campus.',
    watchFor: 'Prerequisite edges are inferred from course concept tags rather than read from catalogs, and only edges between courses inside the pathway count. Where no edges are known the score collapses to the course count, so read it next to its prerequisite data coverage or it will mostly measure how much we know.',
  },
  'time-to-degree': {
    expression: 'credit rate = units of associate degree courses that appear in the campus minimum pathway ÷ total units in the associate degree',
    grain: 'One row per curated associate degree × agreement, so a degree appears once per matching campus.',
    watchFor: 'Stricter than the degree credit figure: a course counts only if the cheapest single-campus pathway happens to select it, so units that would transfer as elective or general education credit are scored as lost. The two figures disagree on the same degree by design.',
  },
}

export function measureFor(analysisId) {
  return MEASURES[analysisId] || null
}
