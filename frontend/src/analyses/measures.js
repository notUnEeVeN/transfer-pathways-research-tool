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
    watchFor: 'This is a distribution of the selected major’s district heatmap row totals, so it inherits its requirement source and district-wide pooling. ASSIST is the default shared with the heatmap and map; Computer Science retains the hand-curated minimums and frozen paper matrix as explicitly labeled historical sources. It shows how common each number of campus options is, but not which campuses or districts produce a bar.',
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
    expression: 'point = covered required-course observations of one course type ÷ all required-course observations of that type, averaged across community colleges',
    grain: 'One point per university campus per course type; a campus that requires nothing of a type contributes no point.',
    watchFor: 'The default whole-degree scope matches the Massachusetts paper: degree and college requirements are counted, general education is excluded, and upper-division requirements remain even though a community college generally cannot offer them. In computed views, series expand course by course and choose-N blocks contribute their stated ask; the four typed buckets exactly partition Figure 1’s named-course population. The Massachusetts final-paper view is a frozen transcription of the printed dots (11 computing, 11 math, 11 science and 5 non-STEM observations). Each computed campus point weights its community colleges equally, and each diamond averages the plotted campus points.',
  },
  'transfer-credit-rate': {
    expression: 'completion = bachelor’s requirement units fulfilled by the associate degree ÷ bachelor’s requirement units in the selected scope',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'This bachelor-side completion lens is available only when the Massachusetts-equivalent lens is off. Lower-division scope excludes university-only work; full-degree scope includes it. Associate-degree units apply at most once, while general education and elective room use an optimal-student assumption rather than observed transcripts.',
  },
  'transfer-extra-units': {
    expression: 'hours above 120 = max(0, resident bachelor requirement hours + unused associate-degree hours − 120)',
    grain: 'One value per community college × UC campus, for one associate degree type.',
    watchFor: 'This is the Massachusetts Figure 4 construct, not simply unused associate-degree credit. The two are equal only when the resident curriculum is exactly 120 semester hours. Massachusetts defaults to the transcribed final-PDF matrix; computed views build the pathway from the resident graduation requirement plus associate credit that cannot be applied. Every optimal-credit assumption pushes the modeled value down, so it is not an observed student outcome.',
  },
  'pathway-complexity': {
    expression: 'h(G) = Σ over pathway courses of (delay factor + blocking factor), on the prerequisite graph of the associate degree’s courses plus every university requirement the transfer does not satisfy; Δ = pathway h(G) − the campus’s own curriculum h(G).',
    grain: 'One score per community college × UC campus × associate-degree type, with the campus resident curriculum as its baseline.',
    watchFor: 'A negative Δ can be genuine where articulation is strong: the final Massachusetts figure itself includes negative cells. The calculation must select one valid associate-degree route rather than treating every alternative course as required. Edge data is still partial. Missing edges lower an individual graph’s score, but the transfer and resident graphs need not be missing the same edges, so the difference between them can move in either direction — treat small deltas as directional and compare only explicitly matched degree types and graph rules.',
  },
  'transfer-extra-cost': {
    expression: 'cost = Figure 4 pathway hours above 120 × campus annual resident charge ÷ (full-time load × 2 semesters)',
    grain: 'One dollar value per community college × UC campus, for one associate degree type and one full-time load basis.',
    watchFor: 'The minimum-load basis divides the annual charge by 24 semester units, following the paper; the 15-unit sensitivity divides by 30 and is therefore 20% lower. The Massachusetts final-PDF values use tuition only and explicitly exclude fees. California uses the official UCOP Total Charges by Campus 2025–26 resident tuition, student-services fee and campus-fee record, excluding health insurance and living costs, so cross-state dollar levels are not strictly equivalent. Cost retains Figure 4’s unrounded internal hours even though the hours heatmap displays one decimal; the hover exposes the exact multiplication receipt. This prices coursework, not extra enrolled terms.',
  },
  'coverage-heatmap': {
    expression: 'coverage = named required-course observations with a community college equivalent ÷ all named required-course observations, general education excluded',
    grain: 'One value per community college × UC program.',
    watchFor: 'This is the gallery’s Massachusetts-equivalent default: degree and college requirements at every level, with upper-division work retained as uncovered; series expand course by course and choose-N blocks contribute their stated ask. General education and free-elective padding are excluded. The graduation-unit, ASSIST-agreement and curated-minimum lenses are separate controls and must not be described with this denominator.',
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

export const VA_UNUSED_CREDIT_MEASURE = {
  expression: 'unused credit = credits in the guide’s pre-transfer plan − credits applying to bachelor requirements',
  grain: 'One value per VCCS college × Virginia university transfer guide.',
  watchFor: 'The denominator comes from the guide’s pre-transfer plan, rather than a separately solved associate-degree curriculum. Course supply and guide outcomes determine which credits apply. This is the complement of the Virginia credit-utilization figure; it does not add the bachelor curriculum’s credits above 120.',
}

// The coverage heatmap changes its statistic with its controls, so its panel
// must change too — a definition of a lens the reader is not looking at is
// worse than none. One entry per figure state; the figure reports the active
// one upward through `onMeasureChange` and the gallery shows it in place of
// the static default.
export const COVERAGE_HEATMAP_MEASURES = {
  degree: {
    expression: 'coverage = modeled bachelor graduation units covered ÷ total modeled graduation units',
    grain: 'One value per community college × UC program.',
    watchFor: 'This lens measures accepted credit within the modeled graduation budget. Named requirements use documented course credits where available; unpriced requirement blocks retain estimated credit allocations. It is distinct from the named-course count and the GE-excluded named-requirement unit lens.',
  },
  'degree-no-ge': {
    expression: 'coverage = units of named requirements articulated ÷ units of all named requirements, general education removed from both sides',
    grain: 'One value per community college × UC program.',
    watchFor: 'The Massachusetts paper’s exclusion applied to credit rather than to a course count, over EXACTLY the population its course lens counts — so the only difference between this and the paper lens is credit-weighting versus binary counting, and the two run about three points apart (35.2% against 31.9%). It is deliberately not the graduation-unit lens, whose numerator is the unit BUDGET: credit the student carries, capped at what the campus accepts. Carried credit and discharged requirements are different questions, and differencing one against a course count measures that difference rather than the effect of the lens. General education here is the evaluator’s own role classification, the same one the course lens excludes, not a title match. This is the reading that compares most directly with Virginia, whose guides are written in credit.',
  },
  'ma-courses': {
    expression: 'coverage = required courses with an articulated equivalent ÷ all required courses, at every level',
    grain: 'One value per community college × UC program.',
    watchFor: 'The Massachusetts paper’s published Figure 1 measure, for direct comparison — their statewide average was 38.2%. Every required course counts once, articulated or not, whether departmental, college, or campus and at any division: a complete-series requirement counts each of its courses (an articulated series covers all of them), a choose-N pool contributes its stated course ask. Unit-only blocks require an explicit course-size assumption and remain estimates; documented fractional credit values are preserved as credit, not interpreted as fractional class attendance. General education and free-elective padding are excluded. Upper-division requirements rarely articulate, which is what pulls this measure far below lower-division-only coverage.',
  },
  'ma-courses-ge': {
    expression: 'coverage = required courses with an articulated equivalent ÷ all required courses, general education included',
    grain: 'One value per community college × UC program.',
    watchFor: 'Our extension of the paper’s measure, not a figure they published — for general-education-heavy majors such as Economics, whose GE-excluded reading is dominated by the unarticulable upper division. Lower-division GE counts as articulable at every college (IGETC or Cal-GETC certification clears it, so the reading does not depend on how each template encodes its GE blocks); upper-division GE still counts against. Free-elective padding remains excluded, and the paper’s 38.2% benchmark applies only to the GE-excluded state.',
  },
  'ma-units': {
    expression: 'coverage = credits of required courses with an articulated equivalent ÷ credits of all required courses, at every level',
    grain: 'One value per community college × UC program.',
    watchFor: 'The published Figure 1 population weighted by credit instead of counted binary — the same required courses, the same general-education exclusion, the same every-level scope. Only the weighting differs, which is what makes it comparable with Virginia’s guides and with California’s GE-excluded unit lens; the published 38.2% benchmark belongs to the course count, and this reading of the Massachusetts corpus runs about a point above it. Each requirement is priced from the receiving university’s own catalogue where it states a credit value; where it does not, the requirement takes its section’s stated credits divided evenly, which is an estimate rather than a documented course size. In the Massachusetts corpus 263 of 270 required-course columns are priced from the campus’s own resident plan and 7 carry the estimate; the reading moves less than a point across every plausible value for those seven, so it does not rest on them.',
  },
  'ma-units-ge': {
    expression: 'coverage = credits of required courses with an articulated equivalent ÷ credits of all required courses, general education included',
    grain: 'One value per community college × UC program.',
    watchFor: 'The credit weighting of our GE-included extension, not a figure any paper published. Lower-division general education counts as articulable at every college by the same modelling standard the course variant uses — certification clears it — and upper-division GE still counts against, so this reading is a policy scenario rather than observed articulation. Available only where general education is classified by a curated template or a published guide. It is withdrawn on corpora imported from a study that classifies none — Massachusetts, where the “GE” block is only the residue Figure 1’s columns did not consume, and granting it produced more transferable credit than the authors’ own Figure 3 records for any pair.',
  },
  // Virginia is measured against published Transfer Guides rather than a
  // curated requirement corpus, so it needs its own three descriptions; the
  // Massachusetts entries above speak of UC programs and IGETC certification
  // and would be simply false here.
  'va-units-ge': {
    expression: 'coverage = credits of the guide this college can supply ÷ the guide’s stated total credits',
    grain: 'One value per VCCS college × Virginia university program.',
    watchFor: 'The reading a Virginia Transfer Guide is written in. A guide states both halves of the degree — roughly 60 transferable credits in VCCS common course numbers and the 60 upper-division credits that follow — so coverage is structurally capped near 50%, and the distance below that cap is supply: whether this college teaches the courses the guide names. General education counts where the guide puts it. Elective and general-education slots count as satisfiable; the guide has already done the capacity accounting by writing “n of m”.',
  },
  'va-units': {
    expression: 'coverage = credits supplied ÷ stated total credits, general education removed from both sides',
    grain: 'One value per VCCS college × Virginia university program.',
    watchFor: 'The middle step between the credit reading and the paper’s. General education comes off the numerator and the denominator alike — the same number of credits from each — so the ratio moves only where GE was a different share of what this college could supply. About four points below the GE-counted reading.',
  },
  'va-paper': {
    expression: 'estimated course coverage = estimated courses supplied ÷ estimated whole-degree courses, general education excluded',
    grain: 'One value per VCCS college × Virginia university program.',
    watchFor: 'Virginia’s guides contain credit blocks rather than a complete enumerated course list. Course counts are estimated from each guide’s average course size, rounded to integers, adjusted to the stated totals, and supplemented for unitemized credit. Integer outputs do not make these exact class counts. Treat this as a modeled sensitivity; California and Massachusetts count named course observations and cannot be compared as an identical measure.',
  },
  // The lower-division lens is one measure in all three states, so each entry
  // states every state's source rather than leaving the reader to infer it.
  'ld-units': {
    expression: 'coverage = lower-division credit a college can satisfy ÷ all of the bachelor’s lower-division credit, general education excluded',
    grain: 'One value per community college × university program.',
    watchFor: 'Upper division comes off both sides; lower-division requirements a college cannot reach stay in the denominator uncovered. Elective credit is part of the bachelor’s degree and counts as satisfied, since any transferable course fills it. Lower division is the template’s own tier in California, with its community-college elective units held to the UC transfer cap (70 semester / 105 quarter units); the paper’s own lower-division flag plus its free-elective and minor slots in Massachusetts; and in Virginia the guide’s stated pre-transfer credit, less courses the university grants no credit for, plus the 100- and 200-level courses the guide schedules after transfer. Virginia is measured on catalogue supply, like the other two states. Credits are each state’s own unit, so the ratio is comparable while the totals are not.',
  },
  'ld-units-ge': {
    expression: 'coverage = lower-division credit a college can satisfy ÷ all of the bachelor’s lower-division credit, general education included',
    grain: 'One value per community college × university program.',
    watchFor: 'The same lower-division credit with general education added to both sides. GE is granted where policy grants it — IGETC or Cal-GETC in California, MassTransfer in Massachusetts — and earned in Virginia, where a college must teach the courses the guide names (open categories are taught everywhere). Massachusetts classifies no general education: its GE is the residue of the resident plan that the paper’s Figure 1 columns did not use, less free-elective and minor slots and courses numbered at the 300 level or above, so it is the paper’s own major/non-major split rather than a published GE list. Upper-division GE counts on neither side.',
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
  'ma-bachelor-side': {
    expression: 'completion = modeled associate-degree credits applied ÷ the resident bachelor’s degree total',
    grain: 'One value per community college × university campus.',
    watchFor: 'Approximate model combining the final articulation table with older resident and pathway courses. Unmatched courses use assumed credits, and associate-degree matches may be inferred. This is not a direct reproduction of the final paper or a fully source-resolved bachelor-completion measure; inspect each cell’s method warning before interpretation.',
  },
  'ma-as-side': {
    expression: 'transfer credit rate = associate-degree units replacing named or GE/breadth bachelor requirements ÷ the associate degree’s own units',
    grain: 'One value per community college × university, for one associate degree type.',
    watchFor: 'Massachusetts defaults to the final paper’s 61 printed Figure 3 cells (equal-cell mean 67.74%, reported as 68%). Our recalculation sums gray replacement-row credits over the cleaned AS total, excluding blue unrestricted-elective-only credit and applying no 100% cap. Blank Massachusetts cells are unstudied pairs, never zeroes. California uses the same associate-degree denominator and counts named articulation plus actual GE/breadth credit once, while excluding unrestricted elective-only capacity; verified sources are on by default.',
  },
}

export function measureFor(analysisId) {
  return MEASURES[analysisId] || null
}
