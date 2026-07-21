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
  'transfer-credit-rate': {
    expression: 'credit rate = associate degree units that apply to the UC degree ÷ total units in the associate degree',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'The denominator is the whole associate degree, not only its prescribed coursework. Units apply at most once even when a course satisfies two requirements, and general education and elective room are credited on the assumption the student picked courses that qualify on both sides — so this is an optimal student, not an observed one.',
  },
  'transfer-extra-units': {
    expression: 'replacement units = total units in the associate degree − associate degree units that apply to the UC degree',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'This is the residual of the credit rate figure, so the two always agree. Every optimistic assumption in the credit model pushes this number down, which makes it a lower bound on repeated coursework rather than an estimate of it.',
  },
  'coverage-heatmap': {
    expression: 'coverage = modeled graduation units with a community college equivalent ÷ all modeled graduation units',
    grain: 'One value per community college × UC program.',
    watchFor: 'The denominator is the whole modeled graduation plan and includes university-only work at zero coverage, so a cell cannot reach 100% unless the program reserves nothing for after transfer. Each campus stays in its own quarter or semester units and is never normalized, so an average across campuses mixes the two systems.',
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
