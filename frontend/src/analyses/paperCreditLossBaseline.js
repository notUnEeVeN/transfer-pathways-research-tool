/**
 * Paper baseline for Figure 1 — "Visualizing the credit loss in transfer
 * pathways: average UC incoming transfer requirements (yellow) and their CCC
 * equivalents (blue)" (Jiang et al., §4.1).
 *
 * Numbers are transcribed from the paper repository
 * (transfer-agreements-analysis), NOT recomputed:
 *
 *   requirementSemester / requirementQuarter —
 *     question_1/scripts/scripts_for_graphs/grouped_bar_graph.py L64–84
 *     (`semester_values` / `quarter_values`). Semester values are the
 *     campus's hand-curated CS/Math hard minimums converted to
 *     semester-course equivalents (quarter count ÷ 1.5); quarter campuses
 *     additionally carry the raw quarter count, drawn as the hatched cap.
 *
 *   choices[0..3] — question_1/csvs/2026/order_4/
 *     optimal_order_{1..4}_averages.csv, row `TRANSFERABLE AVERAGE`,
 *     column `{UC} Articulated`: the average number of CCC courses an
 *     optimal (MILP set-cover) pathway needs at that campus when it is the
 *     student's 1st/2nd/3rd/4th choice, averaged over all 4-UC permutations
 *     and over the CC districts where the campus is fully articulable.
 *
 * Every value below was cross-checked against the rendered paper figure
 * (question_1/graphs/graphs_for_paper/2026/
 * transferable_averages_by_uc_all_orders.png) annotation-for-annotation.
 *
 * `id` uses the paper's anonymized campus labels; `*` marks quarter-system
 * campuses (same ids as paperDistrictBaseline.js). Array order is the
 * paper's x-axis order (grouped_bar_graph.py L89).
 */

export const PAPER_UC_BARS = [
  { code: 'UCD', id: 'UC1*', campus: 'UC Davis', requirementSemester: 5.33, requirementQuarter: 8, choices: [7.07, 3.57, 2.55, 1.92] },
  { code: 'UCM', id: 'UC2', campus: 'UC Merced', requirementSemester: 6, requirementQuarter: null, choices: [6.8, 2.78, 1.51, 0.81] },
  { code: 'UCSD', id: 'UC3*', campus: 'UC San Diego', requirementSemester: 4.67, requirementQuarter: 7, choices: [7.16, 3.16, 1.92, 1.27] },
  { code: 'UCSB', id: 'UC4*', campus: 'UC Santa Barbara', requirementSemester: 4.67, requirementQuarter: 7, choices: [7.04, 3.05, 1.81, 1.11] },
  { code: 'UCLA', id: 'UC5*', campus: 'UC Los Angeles', requirementSemester: 4.67, requirementQuarter: 7, choices: [5.89, 2.25, 1.21, 0.65] },
  { code: 'UCB', id: 'UC6', campus: 'UC Berkeley', requirementSemester: 4, requirementQuarter: null, choices: [4.83, 1.64, 0.83, 0.37] },
  { code: 'UCSC', id: 'UC7*', campus: 'UC Santa Cruz', requirementSemester: 3.33, requirementQuarter: 5, choices: [5.15, 2.22, 1.56, 1.14] },
  { code: 'UCI', id: 'UC8*', campus: 'UC Irvine', requirementSemester: 4, requirementQuarter: 6, choices: [4.4, 2.31, 2.16, 1.61] },
  { code: 'UCR', id: 'UC9*', campus: 'UC Riverside', requirementSemester: 3.33, requirementQuarter: 5, choices: [4.0, 1.25, 0.76, 0.51] },
]

// Exact colors of the paper figure. Blues are matplotlib's
// `cm.get_cmap('Blues', 6)` sampled at indices 5,4,3,2 (grouped_bar_graph.py
// L137–138): darkest = 1st choice.
export const PAPER_COLORS = {
  requirement: '#FFD700', // gold — CS/Math requirement (semester equivalents)
  quarterCap: '#FFF8DC', //  cornsilk + `//` hatch — quarter-system excess
  choices: ['#08306b', '#1764ab', '#4a98c9', '#94c4df'],
}

export const CHOICE_LABELS = ['1st Choice', '2nd Choice', '3rd Choice', '4th Choice']
