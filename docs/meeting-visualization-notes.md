# Visualization meeting notes

## Three definitions to say first

- **Articulated** means ASSIST says a community-college course is accepted as an equivalent to a UC course.
- **Complete** means every required course group has at least one usable articulated path. For district figures, courses may come from different colleges in the same district.
- **Paper baseline** means the value shown in the older paper. **Current data** means we repeat the same calculation with our newer ASSIST data.

## One-line cheat sheet

| Visual | Simplest explanation |
| --- | --- |
| CA 1 — Credit loss | How many community-college courses are needed as a student adds UC choices? |
| CA 2 — District coverage | Can each district supply every course required by each UC? |
| CA 3 — Coverage distribution | How many UC choices does each district have? |
| CA 4 — California map | Where are low- and high-access districts located? |
| CA 5 — Course gaps | Which required course types are missing most often? |
| MA 1 — Degree coverage | How much of the full UC degree could be completed before transfer? |
| MA 2 — Course types | Is coverage better for math and science than for computing? |
| MA 3 — Credit rate | What share of an associate degree actually applies to the UC degree? |
| MA 4 — Replacement work | How many associate-degree units may need to be replaced? |
| New — Income and access | Do richer areas have access to more complete UC pathways? |
| New — Multi-campus preparation | How much more work is needed to keep more UC choices open? |

## California-paper ports

These five figures come from *Unraveling Transfer Pathways in Computer Science* (the California paper). We recovered the authors' code in the sibling `transfer-agreements-analysis` repository and reused their hand-curated UC minimum requirements.

### 1. Credit loss by campus — CA Figure 1

- **What it asks:** How many community-college courses are needed to meet each UC's transfer minimums? How many new courses are added when that UC is a student's second, third, or fourth choice?
- **How we calculate it:** We find the smallest set of community-college courses that covers the required UC courses. Shared courses count once. We repeat this for every ordering of four UC choices and average the added courses at each position.
- **Where it came from:** The old group used a set-cover optimization in `question_1/scripts/scripts_for_data/optimal_total_combinations.py`, then drew the bars with `grouped_bar_graph.py`. We rebuilt the same algorithm and checked it on their old data.
- **Quick result:** On the paper's data, our course counts match 2,592 out of 2,592 cases. On current data, the changes are tiny: six of nine first-choice bars are unchanged, and none moves by more than 0.08 course.
- **Important caution:** The paper's calculation has some special filtering rules for course series. This is why it can occasionally disagree with the district heatmap even though both are working correctly.

### 2. Transfer coverage by district — CA Figure 2

- **What it asks:** For each community-college district and UC campus, can the district provide every required CS and math course?
- **How we calculate it:** A cell is complete only if every required group has a fully articulated option. We pool all colleges inside the district.
- **Where it came from:** This follows the old district heatmap logic in `question_2-3/district-level/district_least_options.py`. The requirement list is the old group's hand-curated list; our articulation data are newer.
- **Quick result:** 645 of 648 cells match the paper. The three differences are new complete paths for Davis or Santa Barbara; there are no losses.
- **Important caution:** “Complete district” does not mean one college offers the whole pathway. A student may need to attend more than one college in the district.

### 3. Districts by complete campus coverage — CA Figure 3

- **What it asks:** How many districts can fully prepare a student for exactly zero UCs, one UC, two UCs, and so on through nine?
- **How we calculate it:** Add the nine yes/no cells in each district's Figure 2 row. Then count how many districts have each total.
- **Where it came from:** This is the old `create_simple_bar_plot` calculation in `district_least_options.py`. It is only a summary of Figure 2, not a new articulation calculation.
- **Quick result:** Only three districts change bins in current data: Allan Hancock moves from 4 to 5; Santa Barbara and West Valley–Mission move from 8 to 9.
- **Important caution:** A bar tells us how many UC options districts have, but not which UCs those options are.

### 4. Articulation coverage across California — CA Figure 4

- **What it asks:** Where are the districts with low, middle, and high UC transfer coverage located?
- **How we calculate it:** Use each district's Figure 2 total, then place it into the paper's three bands: 0–3, 4–6, or 7–9 complete campuses.
- **Where it came from:** The old code in `question_2-3/geomap/map_to_district.py` averaged the locations of the colleges in each district to make one district point. The old repository does not contain the final styled map, so our map uses those recovered points and a new California outline. The original published map is also available as a static reference.
- **Quick result:** All 72 districts remain in the same display band as the paper. Three exact counts increased by one, but none crossed into a new band.
- **Important caution:** The broad bands hide small exact-count changes. The point is an approximate district center, not the district's true boundary.

### 5. Course gaps by campus — CA Figure 5

- **What it asks:** Which required subjects most often lack an articulated equivalent across California districts?
- **How we calculate it:** For each campus and course category, count districts where any required group in that category is not satisfied. Divide by all 72 districts. Gray means the campus does not require that category.
- **Where it came from:** The old group used `question_2-3/district-level/course_analysis.py`, especially `create_all_course_graphs`, and a fixed set of category-name matching rules.
- **Quick result:** 28 of 32 required campus-course bars exactly match the paper. Four bars improve by one district; none gets worse.
- **Important caution:** The denominator is always all 72 districts. Also, one missing course in a sequence is enough for the whole category to count as missing.

## Massachusetts-paper recreations

These four figures come from *Lost in Transfer: Examining CS Transfer Pathways from Community College in Massachusetts*. The MA group did not provide code, so these are recreations of the paper's stated method, not verified code-for-code ports. Their team manually assembled equivalencies from the MassTransfer A2B database, four-year websites, and the MassTransfer equivalency database. We use curated UC degree requirements, ASSIST, and community-college catalog data.

### 6. Potential graduation-unit coverage — MA Figure 1

- **What it asks:** How much of a full UC computer-science bachelor's degree could each community college potentially satisfy before transfer?
- **How we calculate it:** For every college-campus pair, divide modeled graduation units with a community-college equivalent by all modeled graduation units. Lower-division articulations come from ASSIST; GE coverage comes from the college's catalog tags. Upper-division UC work stays in the denominator with zero coverage.
- **Where it came from:** The MA group manually listed each BSCS requirement, checked whether every community college had an equivalent, and divided equivalent courses by all required courses. Our current version uses units instead of treating every course as equal size.
- **Important caution:** This intentionally counts upper-division work that a community college cannot teach. It measures how much of the whole degree can be completed before transfer, not just whether lower-division articulation is good. Semester and quarter campuses should not be casually averaged together.

### 7. Transferable requirements by course type — MA Figure 2

- **What it asks:** Is transfer coverage different for computing, math, science, and non-STEM requirements?
- **How we calculate it:** Put every UC degree requirement into one of those four categories. For each campus and category, find the percentage with a community-college equivalent, averaged across colleges. Each dot is one UC campus; the diamond is the mean of the campus dots.
- **Where it came from:** The MA paper categorized courses from the four-year course code, with discrete math always treated as math. We copied that rule. They reported 22% computing coverage versus much higher coverage outside computing.
- **Quick result:** California shows the same pattern. In the whole-degree view, computing is about 11%, versus about 80% math, 87% science, and 78% non-STEM. In the lower-division-only view, computing rises to about 47% but still trails the other categories.
- **Important caution:** Our whole-degree denominator includes GE; theirs excluded GE. The broad pattern is comparable, but the exact percentages are not a direct state-to-state comparison.

### 8. Degree credit toward graduation — MA Figure 3

- **What it asks:** What share of a completed associate degree would actually apply to the UC bachelor's degree?
- **How we calculate it:** Build a transfer-oriented version of the associate degree. Apply each associate-degree unit at most once: first to named UC course requirements, then to GE or breadth, then to documented elective space. Divide applied units by total associate-degree units.
- **Where it came from:** The MA group manually overlaid an ASCS and BSCS for 61 nearby college pairs, chose the most efficient pathway, and divided ASCS credits that applied by total ASCS credits.
- **Quick result:** Our frozen comparison found about 62.6% for local CS associate degrees and 74.6% for the transfer-oriented degree cohort.
- **Important caution:** This is an optimistic, best-case student who chooses the most transferable options. It is modeled credit use, not observed student transcripts.

### 9. Modeled replacement coursework — MA Figure 4

- **What it asks:** How many associate-degree units do not apply to the UC degree and may therefore need to be replaced?
- **How we calculate it:** Total associate-degree units minus the units counted in MA Figure 3. Quarter results are converted to semester-equivalent units so colleges can be compared.
- **Where it came from:** The MA group added the ASCS and remaining BSCS work, then measured how many credits the transfer pathway exceeded the normal 120-credit bachelor's total. Algebraically, that is the same basic lost-credit remainder.
- **Quick result:** Our frozen comparison found about 22.4 replacement units for local degrees and 15.3 for the transfer-oriented degree cohort.
- **Important caution:** This is not observed repeated coursework or observed time to degree. Because the model gives students the best reasonable use of GE and electives, it is better read as a lower bound on the problem.

## New figures for our paper

### 10. Transfer access and local income

- **What it asks:** Do districts serving richer areas have access to more complete UC CS transfer pathways?
- **How we calculate it:** Each district gets an income estimate for its surrounding ZIP-code catchment and a count of complete UC campuses. We also fit a simple model that compares income while accounting for population and distance to the nearest UC.
- **Where it came from:** This is our own analysis. Coverage comes from the California district calculation. Income comes from California Franchise Tax Board data; population is the number of returns; distance is calculated from district and UC locations.
- **Quick result:** The poorest quarter of districts reaches about 3.7 campuses under the hand-curated requirements; the richest quarter reaches about 8.2. The income relationship remains after population and distance are included.
- **Important caution:** This is an area-level association, not proof that income causes articulation access and not a statement about individual students.

### 11. Multi-campus preparation / portfolio analysis

- **What it asks:** How much preparation is needed to keep one UC option open, then two, three, and so on? Which campuses add the most unique work?
- **How we calculate the new version:** For each district, find every subset of UC CS programs the district can completely articulate. For each subset, jointly choose the smallest prerequisite-complete set of real community-college courses. Shared courses count once. Then schedule the set under a 15-native-unit term limit. We keep total workload, paired “add one more campus” changes, and campus-attributed contributions.
- **Where it came from:** This is our own extension of the California paper's “additional choices” question. The old paper stopped at averages over ordered choices; our version keeps every real district portfolio and compares nested portfolios inside the same district.
- **Quick result:** The nearly complete feasible-plan curve is roughly 8.8 courses for one UC, 12.1 for two, 14.0 for three, and 17.7 for all seven currently reachable UCs. This is about four to 5.4 regular semester-equivalent terms. The added burden gets much smaller after the first few choices because requirements overlap.
- **Important caution:** The new data collection is complete, but only 1,970 of 3,266 plans are proven minimal. Another 1,286 are valid plans that timed out before proving they were the smallest. The pattern is useful now; the exact final curve needs a higher-budget solve before it becomes a paper claim.
- **Current UI note:** The gallery now displays this district-subset result as a static 1–7 figure. It uses district-equal averages, shows the fixed 13-district cohort as a sensitivity marker, and prints the proven-minimum share on every row.

## Ten-second summary for the meeting

> The California figures are close replications: same requirements and methods, but newer ASSIST data. They show only a few new articulations. The Massachusetts figures reuse the questions and stated calculations on California data, but they are recreations because we do not have the MA code. Our new work adds socioeconomic access and a much more realistic multi-campus workload analysis. Everything is a model of course and articulation structure, not observed student behavior.

## Main source files

- California paper: `/Users/tybaltmallet/Downloads/SIGCSE_TS_2027_California_Transfer_Pathways.pdf`
- Massachusetts paper: `/Users/tybaltmallet/Downloads/2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf`
- California legacy code: `/Users/tybaltmallet/Desktop/transfer_pathways/transfer-agreements-analysis/`
- Full California replication receipts: `docs/figures/paper-credit-loss.md`, `paper-district-heatmap.md`, `paper-articulation-histogram.md`, `paper-articulation-map.md`, and `paper-course-barriers.md`
- Full Massachusetts Figure 1/2 notes: `docs/figures/degree-coverage-sources.md` and `docs/figures/ma-course-type-spread.md`
- New-analysis notes: `docs/figures/income-access.md`, `docs/figures/multi-campus-pathways.md`, and `docs/figures/district-portfolio-subsets.md`
