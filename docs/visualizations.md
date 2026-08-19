# The visualizations, explained

Every figure on the console in plain English: what it asks, how it's computed,
where it came from, what it shows, and what it must not be read as. Use this
for meetings and for anyone new to the project. Full receipts live in the
per-figure docs under [`figures/`](figures/).

> The credit-loss and district-coverage artifacts were rebaselined on
> 2026-07-22 against the same nine canonical CS campus/program pairs. The
> district heatmap retains its 645/648 result.

## Three definitions to say first

- **Articulated** — ASSIST says a community-college course is accepted as
  equivalent to a university course.
- **Complete** — every required course group has at least one usable
  articulated path. For district figures, the courses may come from different
  colleges in the same district.
- **Paper baseline** vs **current data** — the value printed in the older
  paper, vs the same calculation repeated with our newer ASSIST data.

## One-line cheat sheet

| Visual | Simplest explanation |
| --- | --- |
| CA 1 — Credit loss | How many community-college courses are needed as a student adds UC choices? |
| CA 2 — District coverage | Can each district supply every course required by each UC? |
| CA 3 — Coverage distribution | How many UC choices does each district have? |
| CA 4 — California map | Where are low- and high-access districts located? |
| CA 5 — Course gaps | Which required course types are missing most often? |
| Degree coverage | How much of the full UC degree could be completed before transfer? |
| Course types | Is coverage better for math and science than for computing? |
| Transfer credit rate | With an associate degree, what share of the bachelor's requirements is already fulfilled? |
| Replacement work | How many associate-degree units may need to be replaced? |
| Income and access | Do richer areas have access to more complete UC pathways? |
| Multi-campus preparation | How much more work is needed to keep more UC choices open? |

## The five things to remember

1. **The paper figure ports replicate the paper's methods.** Remaining
   differences come from a newer ASSIST snapshot, not a different algorithm.
2. **The district heatmap is almost unchanged.** 645 of 648 district-campus
   cells match; the only differences are three new complete cells, all caused
   by added articulations.
3. **The credit-loss figure is algorithm-equivalent.** Run on the paper's own
   inputs, our rebuild matches 100% of course-count averages; on current data,
   six of nine first-choice bars are identical and none moves by more than 0.08
   of a course.
4. **The California map is visually unchanged.** Three districts gained a
   campus but stayed inside their original 0–3 / 4–6 / 7–9 display band, so all
   72 map symbols match.
5. **The distribution moves only where those gains land.** Current 0–9 bar
   heights are 3, 2, 1, 7, 6, 11, 8, 4, 10, 20.

---

# California-paper ports

These five come from *Unraveling Transfer Pathways in Computer Science*. We
recovered the authors' code in the sibling `transfer-agreements-analysis`
repository and reused their hand-curated UC minimum requirements.

### 1. Credit loss by campus — CA Figure 1

- **Asks:** How many community-college courses meet each UC's transfer
  minimums, and how many more are added when that UC is a student's second,
  third, or fourth choice?
- **How:** Find the smallest set of community-college courses covering the
  required UC courses. Shared courses count once. Repeat for every ordering of
  four choices and average the added courses at each position.
- **Came from:** Their set-cover optimization in
  `question_1/scripts/scripts_for_data/optimal_total_combinations.py`. We
  rebuilt the algorithm and checked it against their old data.
- **Result:** On the paper's data our counts match **2,592 of 2,592** cases. On
  current data six of nine first-choice bars are unchanged; none moves by more
  than 0.08 course. Movers: UC Davis −0.07 (corrected scope — `Computer
  Science B.S.` no longer borrows receivers from the sibling CSE degree),
  UCSB −0.02 (Allan Hancock now completes UCSB), UCSD −0.02 (`CSE 8B`
  disappeared; `CSE 11` carries the intro group).
- **Caution:** Their pipeline has special filtering for course series, which is
  why it can disagree with the district heatmap even when both are correct.

### 2. Transfer coverage by district — CA Figure 2

- **Asks:** For each district and UC campus, can the district provide every
  required CS and math course?
- **How:** A cell is complete only if every required group has a fully
  articulated option, pooling all colleges in the district.
- **Came from:** `question_2-3/district-level/district_least_options.py`. The
  requirement list is their hand-curated one; our articulation data is newer.
- **Result:** **645 of 648 cells match** — three gains, zero losses:

  | Gained cell | Decisive current articulation |
  | --- | --- |
  | UC Davis × Santa Barbara CCD | Santa Barbara City covers the ECS 036 series via `CS 105 / CS 106 / CS 137 / CS 140` |
  | UC Davis × West Valley-Mission CCD | Mission added `CIS 043 → ECS 036B` and `CIS 039 → ECS 050` |
  | UC Santa Barbara × Allan Hancock JCCD | Hancock added `CS 111 → CMPSC 16` and `CS 112 → CMPSC 24` |

  Memory hook: **same requirements, same rule, newer ASSIST data.**
- **Caution:** "Complete district" doesn't mean one college offers the whole
  pathway — a student may need more than one college in the district.

### 3. Districts by complete campus coverage — CA Figure 3

- **Asks:** How many districts can fully prepare a student for exactly zero
  UCs, one, two, … nine?
- **How:** Sum the nine yes/no cells in each district's Figure 2 row, then
  count districts per total. It's a summary of Figure 2, not a new calculation.
- **Result:** Only three districts change bins — Allan Hancock 4→5; Santa
  Barbara and West Valley–Mission 8→9.
- **Caution:** A bar says how many options a district has, not which campuses.

### 4. Articulation coverage across California — CA Figure 4

- **Asks:** Where are the low-, middle-, and high-coverage districts?
- **How:** Each district's Figure 2 total, placed in the paper's three bands
  (0–3, 4–6, 7–9).
- **Came from:** `question_2-3/geomap/map_to_district.py` averaged college
  locations into one district point. Their repo has no final styled map, so
  ours uses the recovered points and a new California outline.
- **Result:** All 72 districts stay in their published band; three exact counts
  rose by one without crossing a band.
- **Caution:** Broad bands hide small count changes, and the point is an
  approximate district center, not a boundary.

### 5. Course gaps by campus — CA Figure 5

- **Asks:** Which required subjects most often lack an articulated equivalent?
- **How:** Per campus and category, count districts where any required group in
  that category is unsatisfied, over all 72 districts. Gray = the campus
  doesn't require that category.
- **Came from:** `question_2-3/district-level/course_analysis.py`.
- **Result:** **28 of 32** required campus-course bars match exactly; four
  improve by one district; none gets worse.
- **Caution:** The denominator is always all 72 districts, and one missing
  course in a sequence marks the whole category missing.

## The ASSIST-stated-minimums variant

Our own extension: swap the demand side from website-minimum curation to the
required groups the ASSIST agreements actually state, for the one
partner-facing CS major per campus (nine code-configured campus/program pins).

| Campus | ASSIST gold | Fully transferable districts | First-choice avg | Reminder |
| --- | ---: | ---: | ---: | --- |
| UCD | 8.00 | 30 | 8.93 | `ECS 036C` is the biggest named blocker |
| UCM | 10.00 | 64 | 10.98 | Broadly transferable, higher demand than website curation |
| UCSD | 7.33 | 0 | 0.00 | `CSE 29` blocks essentially every district |
| UCSB | 4.67 | 50 | 7.02 | Website and ASSIST gold agree |
| UCLA | 11.33 | 0 | 0.00 | `COM SCI 35L` blocks every district |
| UCB | 10.00 | 69 | 10.09 | Canonical EECS carries broader demand than the old CS B.A. input |
| UCSC | 3.33 | 47 | 5.15 | Moderate demand, many complete districts |
| UCI | 8.00 | 39 | 5.36 | Broader ASSIST demand than website curation |
| UCR | 4.67 | 57 | 7.67 | Strong district coverage |

Zeros mean **no district has a fully articulated single-college path under
ASSIST-stated demand** — not missing data.

---

# Massachusetts-method figures

Two different things share this heading; keep them apart when speaking.

**(a) The MA method applied to California data.** Degree coverage, course
types, transfer credit rate, and replacement work, computed from our curated UC
degree templates. These recreate the *questions and stated method* of *Lost in
Transfer* on our own corpus.

**(b) The Massachusetts state tab.** The paper's own data, imported and run
through the same engine. We recovered their workbooks from their repository's
git history, so this is a genuine reproduction, not a recreation — see
[`ma-paper-audit.md`](ma-paper-audit.md) and the plain-English
[`ma-meeting-notes.md`](ma-meeting-notes.md).

### 6. Degree coverage — their Figure 1

- **Asks:** What share of a bachelor's named degree and college course
  requirements has a community-college equivalent?
- **How:** Per college-campus pair, divide covered named-course observations by
  all named-course observations. General education and free-elective padding
  are excluded; upper-division and other university-only named work remains in
  the denominator as uncovered. Series expand course by course and choose-N
  blocks contribute the number of courses requested.
- **Result:** The deposited Massachusetts workbook reruns exactly to 38.2085%.
  The later final PDF agrees after rounding in 164/165 cells; Cape Cod→UMass
  Dartmouth is printed 45% versus archived `11/31=35%`, and the unchanged
  38.2% prose mean is a strong stale-headline candidate. California: CS 31.9%,
  biology 51.2%, economics 23.7% across 1,035 college×campus cells per major,
  with no missing or duplicate pair rows.
- **Caution:** This deliberately counts upper-division work a community college
  cannot teach. It is a required-course observation rate, not a share of degree
  units or a guarantee that the covered courses form one feasible pathway.

### 7. Transferable requirements by course type — their Figure 2

- **Asks:** Does coverage differ across computing, math, science, and non-STEM?
- **How:** Categorize every requirement by the four-year's own course code,
  with discrete math always counted as math (their rule, which we copied).
  Figure 2 exactly partitions Figure 1's named, GE-excluded population, then
  averages community colleges within campus and campuses within course type.
- **Result:** California shows their pattern — computing far below the rest.
  For CS, whole-degree means are computing 11.5%, math 78.7%, science 63.3%
  (n=7 campuses), and non-STEM 0% (n=4). Lower-division computing rises to
  45.7% and still trails math (83.0%).
- **Caution:** A campus with no requirement of a type contributes no dot, so
  each category can have a different n. In particular, the two 0% supporting-
  science campuses materially lower that seven-campus mean. Do not pool the
  four categories into one state-wide rate.

### 8. Associate-degree credit utilization — their Figure 3

- **Asks:** What share of the associate degree's own units can be applied to
  the bachelor's degree?
- **How:** Build a feasible transfer-oriented version of the associate degree
  and apply its units once — to named course requirements, then GE/breadth,
  then documented elective space — and divide applied units by total associate
  units. Quarter-college units are converted to semester equivalents only in
  the downstream pathway-hour calculation, so this within-degree percentage
  is invariant to calendar.
- **Result:** The final Massachusetts PDF's 61 reported cells average 67.7%
  (quoted as 68%). In the verified California A.S.-T cohort the cell means are
  CS 74.5% (279/279 computable), biology 83.2% (468/477), and economics 100.0%
  after rounding (486/495).
- **Caution:** This is an optimistic best-case student choosing the most
  transferable options — modeled credit use, not observed transcripts. All
  486 computable verified Economics cells use modeled GE and/or elective
  capacity and 478 reach exactly 100%; that does not mean every named course
  has a direct articulation. Nine Allan Hancock Biology cells and nine Hartnell
  Economics cells are blank because the stored degree choice cannot be solved
  with distinct resolved courses.

### 9. Pathway hours above 120 — their Figure 4

- **Asks:** How many semester-equivalent hours does the modeled transfer
  pathway require beyond a 120-hour benchmark?
- **How:** `max(0, resident bachelor requirement hours + unused associate-degree
  hours − 120)`. Campus and college quarter units are converted consistently to
  semester equivalents before the identity is evaluated.
- **Result:** Verified A.S.-T cell means are 15.3 hours for CS, 10.1 for Biology,
  and 0.01 for Economics. The maxima are 41.3 (Copper Mountain×UCLA), 31.3
  (Irvine Valley×UC Irvine), and 2.0 (Antelope Valley×UC Irvine).
- **Caution:** Not observed repeated coursework or time-to-degree. Because the
  model gives students the best reasonable use of GE and electives, read it as
  a lower bound. It equals unused associate units only when the resident
  curriculum is exactly 120 semester hours.

### 10. Cost of pathway hours above 120 — their Figure 5

- **Asks:** What would the Figure 4 hours cost at each university's derived
  per-unit resident price?
- **How:** Multiply the unrounded Figure 4 value by the campus's annual resident
  charge divided by 24 semester units (the paper's 12-unit-per-term basis). A
  labeled sensitivity divides by 30 instead.
- **Result:** Verified A.S.-T cell means on the 12-unit basis are about $10,593
  for CS, $6,934 for Biology, and $9 for Economics; maxima are $28,663,
  $21,196, and $1,353 respectively.
- **Caution:** California uses official UCOP 2025–26 resident tuition, student-
  services fees, and campus fees. Massachusetts's published basis excludes
  fees, so the cross-state dollar levels are not strictly comparable. The
  heatmap rounds Figure 4 hours to one decimal for display, but Figure 5 retains
  full internal precision and exposes the exact pricing receipt in the hover.

### 11. Curricular-complexity difference — their Figure 6

- **Asks:** How much does the transfer pathway change curricular complexity
  relative to completing the bachelor's as a resident student?
- **How:** For each course graph, sum every course's delay factor plus blocking
  factor, then compute `h(transfer graph) − h(resident graph)`. The final MA
  matrix is a literal PDF transcription; the CA v3 model preserves OR
  prerequisites, consumes receiving series atomically, and fails closed on
  ambiguous degree pools.
- **Result:** Massachusetts's 49 printed cells average
  `715/49=14.5918→+15`. In the verified CA A.S.-T default, 234/279 CS,
  126/477 Biology, and 414/495 Economics paths are finite; the distributions
  differ substantially by major.
- **Caution:** The equation is shared, but final-version Massachusetts graphs
  are unavailable and California graph coverage is incomplete. Treat this as
  a directional/exploratory distribution, not a strict cross-state magnitude
  estimate. The source/edge-completeness receipt and exclusions are part of the
  figure.

---

# Our own new figures

### 12. Transfer access and local income

- **Asks:** Do districts serving richer areas reach more complete UC pathways?
- **How:** Each district gets an income estimate for its ZIP-code catchment and
  a count of complete UC campuses, plus a model controlling for population and
  distance to the nearest UC.
- **Result:** The poorest quarter of districts reaches about 3.7 campuses; the
  richest quarter about 8.2. The relationship survives the controls.
- **Caution:** An area-level association — not proof income causes articulation
  access, and not a statement about individual students.
- Receipts: [`figures/income-access.md`](figures/income-access.md),
  methods notes [`notes_income_gate.md`](notes_income_gate.md).

### 13. Multi-campus preparation (portfolio analysis)

- **Asks:** How much preparation keeps one UC option open, then two, three…?
- **How:** For each district, find every subset of UC CS programs it can fully
  articulate; for each subset jointly choose the smallest prerequisite-complete
  set of real courses, counting shared courses once; then schedule under a
  15-native-unit term limit.
- **Result:** Roughly 8.8 courses for one UC, 12.1 for two, 14.0 for three, and
  17.7 for all seven currently reachable — about four to 5.4 semester-equivalent
  terms. The added burden shrinks after the first few choices because
  requirements overlap.
- **Caution:** Only 1,970 of 3,266 plans are proven minimal; another 1,286 are
  valid but timed out before proving minimality. The pattern is usable now; the
  exact curve needs a higher-budget solve before it becomes a paper claim.
- Receipts: [`figures/district-portfolio-subsets.md`](figures/district-portfolio-subsets.md).
  The earlier one-plan-per-district version is archived in
  [`figures/multi-campus-pathways.md`](figures/multi-campus-pathways.md).

---

## Common confusions

- **Why does the heatmap count Davis gains that credit loss doesn't?** The
  heatmap counts series articulations; the paper's credit-loss pipeline keeps
  only receivers matching curated keys, so cross-group series receivers can be
  invisible there.
- **Why is the ASSIST-stated variant separate?** The paper used
  website-minimum curation. The ASSIST view is our extension for comparing the
  two surfaces.
- **Did anything get worse?** No losses in the first-choice transferability
  set. Davis's lower average comes from removing the sibling CSE degree from
  its evidence pool, not from a deleted articulation.
- **Are the UCLA and UCSD zeros a rendering bug?** No — their ASSIST-stated
  required groups have genuine blockers in every district.

## Ten-second summary

> The California figures are close replications: same requirements and methods,
> newer ASSIST data, with explicit source and cohort receipts. The Massachusetts
> tab separates the later final PDF from the older public replication package:
> most displayed headline arithmetic checks, while the repo contains confirmed
> manual summary conflicts and a smaller set of paper-level or conditional
> candidates. Our new work adds socioeconomic access and a realistic
> multi-campus workload analysis. Everything models course and articulation
> structure — never observed student behavior.

## Deep links

| Need | Go to |
| --- | --- |
| Heatmap receipts | [`figures/paper-district-heatmap.md`](figures/paper-district-heatmap.md) |
| Distribution replication | [`figures/paper-articulation-histogram.md`](figures/paper-articulation-histogram.md) |
| Map replication | [`figures/paper-articulation-map.md`](figures/paper-articulation-map.md) |
| Course-gap receipts | [`figures/paper-course-barriers.md`](figures/paper-course-barriers.md) |
| Credit-loss methodology, deltas, ASSIST variant, validation | [`figures/paper-credit-loss.md`](figures/paper-credit-loss.md) |
| Degree-requirement provenance | [`figures/degree-coverage-sources.md`](figures/degree-coverage-sources.md) |
| Course-type rules | [`figures/ma-course-type-spread.md`](figures/ma-course-type-spread.md), [`figures/bio-course-types.md`](figures/bio-course-types.md) |
| Massachusetts audit | [`ma-paper-audit.md`](ma-paper-audit.md) · [`ma-meeting-notes.md`](ma-meeting-notes.md) |
| How to rerun the Python checks | [`../analysis/README.md`](../analysis/README.md) |

## Source papers

- California: `SIGCSE_TS_2027_California_Transfer_Pathways.pdf`
- Massachusetts: `2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf` (final PDF —
  the repo's LaTeX draft is superseded)
- California legacy code: `../../transfer-agreements-analysis/`
