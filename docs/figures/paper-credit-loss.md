# Figure 1 — credit loss in transfer pathways: replication note

**A decision-for-decision recreation of the paper's credit-loss figure on our
data — with every difference named at the course level.**

> Paper caption: *"Visualizing the credit loss in transfer pathways: average UC
> incoming transfer requirements (yellow) and their CCC equivalents (blue)."*
>
> Dataset `2026-07-22-canonical-cs-v1` · CS majors · 9 UC campuses × 72 CC
> districts × 4 choice positions · July 22, 2026

> **Canonical-scope migration complete (2026-07-22):** the calculation and
> frontend artifacts now read only the nine exact CS campus/program pins. Both
> current-data variants were regenerated, carry the same scope fingerprint,
> and pass their artifact fingerprints. The paper baseline and the
> algorithm-equivalence validation use the paper's own inputs and are unchanged.

## How to read this note

For the reminder version, start with
[`../visualization-quick-reference.md`](../visualization-quick-reference.md).

This page is the full receipt trail:

| Section | Use it for |
| --- | --- |
| [The short version](#the-short-version) | Headline result and one-liner |
| [What each bar means](#what-each-bar-means-and-how-both-versions-compute-it) | Paper-vs-ours computation rules |
| [Algorithm-equivalence check](#algorithm-equivalence-check-our-code-on-the-papers-own-data) | Proof that our implementation matches the paper on the paper's inputs |
| [The differences on our data](#the-differences-on-our-data-with-receipts) | Course-level explanation of current-data movers |
| [ASSIST receiver-slot variant](#assist-stated-receiver-slot-variant) | Major-scoped v2 extension, demand table, blockers, and validation |
| [Reproduce it yourself](#reproduce-it-yourself) | Commands and generated outputs |

## The short version

**Did we recreate their analysis correctly?** Yes — decision for decision,
and proven the strong way: our from-scratch rebuild of their pipeline, run on
**their own data files**, reproduces their published figure (every
per-district course count, and 32 of 36 figure numbers to the penny; the
remaining four sit in cells where their own script isn't run-to-run
reproducible — see the equivalence check below).

**What's different on our data?** Almost nothing: **six of nine campuses
match the paper exactly at first choice**, and nothing anywhere differs by
more than 0.08 of a course. No methodology differences remain — only the
ASSIST articulation data changed (2025–26 snapshot vs theirs):

- **UCSB × Allan Hancock** newly articulated `CS 111 → CMPSC 16`,
  `CS 112 → CMPSC 24` (the same cell the heatmap found).
- **UC Davis**: the canonical `Computer Science B.S.` now stands alone instead
  of borrowing receivers from `Computer Science & Engineering B.S.`. Its
  first-choice average is 7.00 versus the paper's 7.07; the former union-based
  7.15 result is retired.
- **UCSD**: `CSE 8B` is gone from all agreements; `CSE 11` carries Intro.
- The rest of the 334 changed rows (of 4,116) are bundle updates and course
  renumbering — full list in
  [`analysis/results/articulation_changes.csv`](../../analysis/results/articulation_changes.csv).

**The one-liner:** *"Provably the same algorithm — it reproduces their
numbers on their data — run on newer ASSIST data: six of nine campuses
identical at first choice, the rest within ±0.08, every difference a named
articulation change."*

**ASSIST receiver-slot extension:** demand comes from one systemwide canonical
required-only ASSIST template for each exact campus/major pair. Choose-N and OR
semantics determine the receiver-slot denominator; sibling colleges can change
articulation supply but not that denominator. The ported Plan My Transfer
eligibility and branch-and-bound minimum-course engines then evaluate the paths.
For CS, seven campuses have fully transferable districts (UCB 65, UCM 64, UCR
57, UCSB 50, UCSC 47, UCI 39, UCD 14); UCSD and UCLA have zero. Biology and
Economics use their own nine exact program pins and v2 artifacts rather than a
CS fallback.

---

## Verdict (detail)

- **Gold requirement bars: 9 of 9 campuses identical.** Derived from
  `curated_requirements` (+ quarter→semester conversion) rather than
  transcribed; the script asserts they reproduce the paper's constants and
  fails loudly on drift.
- **Blue bars: 6 of 9 campuses reproduce the paper's 1st-choice average
exactly**; every delta in the figure is within ±0.08.
- **Per-district: 87.9% of all 2,592 (campus × district × position) full
  average-pairs are identical to two decimals; articulated course counts alone
  match in 88.9%.** Twenty-one cells flip transferability across all positions
  (19 gains, 2 losses). At first choice there is one gain—UCSB × Allan
  Hancock—and no losses.

| Δ (ours − paper), transferable average | 1st | 2nd | 3rd | 4th |
| --- | --- | --- | --- | --- |
| UCD | −0.07 | −0.04 | −0.08 | −0.08 |
| UCM | +0.00 | −0.01 | −0.04 | −0.04 |
| UCSD | −0.02 | −0.04 | −0.04 | −0.04 |
| UCSB | −0.02 | −0.03 | −0.04 | −0.05 |
| UCLA | +0.00 | −0.01 | −0.04 | −0.05 |
| UCB | +0.00 | +0.01 | +0.00 | +0.01 |
| UCSC | +0.00 | +0.03 | +0.02 | +0.02 |
| UCI | +0.00 | −0.03 | −0.01 | −0.03 |
| UCR | +0.00 | +0.01 | −0.02 | −0.03 |

## What each bar means, and how both versions compute it

Per campus: the **gold bar** is the hand-curated CS/Math hard minimum in
semester-course equivalents (hatched cap = quarter-system excess up to the raw
quarter count); the **four blue bars** are the average number of CCC courses
an optimal pathway needs when the campus is the student's 1st/2nd/3rd/4th
choice. The gap between gold and dark blue is the credit-loss story.

| Ingredient | Paper | Ours |
| --- | --- | --- |
| **Requirement rows** | Hand-curated per-campus minimums (`course_reqs.json`), group → alternative sets → rows | **The same curation**, imported verbatim (`curated_requirements`); gold bars derived from it and asserted equal to the paper's constants |
| **Articulations** | ASSIST agreements, circa the paper's scrape (college CSVs) | ASSIST agreements, 2025–26 (`assist_agreements`) |
| **Receiver → requirement mapping** | A scraped row survives only if its Receiving matches a curated key EXACTLY: one required course, or one whole set's combined list (their CSVs carry exactly two such combined rows in all 72 districts: UCR Calc `MATH 9A;9B;9C`, UCI Intro `I&C SCI 31;32;33`); partial-series and cross-group receivers are dropped | Replicated exactly, via catalog `parent_ids`: one-course receivers map to their row, whole-set series to a combined row, everything else dropped |
| **Visibility** | A requirement never mentioned by the agreement is absent from the CSVs — costs nothing, blocks nothing; mentioned-but-not-articulated rows block transferability | Replicated: unmentioned row identities are invisible per district |
| **Method** | Identical, reimplemented from `optimal_total_combinations.py`: single best college per row (fewest-course option), one optimal MILP set cover (CBC) per campus subset, exactly one set per group, all P(9,4) = 3,024 permutations, marginal courses per slot, ÷ 336, transferable average over districts with rounded unarticulated = 0, round-then-average | (same — `analysis/paper_credit_loss.py` documents every rule) |

Remaining nondeterminism, for the record: the paper's own pipeline is
irreproducible in two narrow places — its merge broke pooling ties by
file-system order, and its solver variables are named with Python's
randomized `hash()`, so ties between equally-optimal solutions settle
differently on every run of *their* code. We fix deterministic choices in
both places. After the exact receiver mapping, **no number in our figure
depends on either tie-break**.

## Algorithm-equivalence check: our code on the paper's own data

The strongest validation available, and it passed. We ran **our
implementation on the paper's own inputs** (its 72 committed
`district_csvs/`) and compared every number against the paper's published
`optimal_order_{1..4}_averages.csv`:

- **2,592 of 2,592 articulated (course-count) averages identical — 100%.**
- 2,568 of 2,592 full (articulated, unarticulated) pairs identical
  (**99.07%**); **32 of the 36 published figure numbers reproduce exactly**.
- The 24 residual mismatches are all in the *unarticulated* column, confined
  to two districts (Cabrillo, Marin) at higher orders, and small
  (±0.01–0.17). Cause, precisely: in those cells several requirement-set
  choices are equally optimal — the course count (the MILP's objective) is
  unique, but *which* set gets marked chosen is not — and the paper's script
  names its solver variables with Python's randomized `hash()`
  (`optimal_total_combinations.py` L124), so its own output in exactly these
  cells varies between runs. The published values there are one draw from
  that randomness; they cannot be matched deterministically, by us or by a
  re-run of their own code. Four of the paper's order-4 figure numbers shift
  by 0.01 through the transferable filter because of this.

What this establishes: the paper's code does what it intends (an independent
reimplementation reproduces its artifacts — and confirms the published CSVs
came from the optimal MILP, not its greedy fallback), and our port is
algorithm-equivalent, so the figure's Our-data view differs only where the
*data* differs.

Reproduce: `.venv/bin/python paper_credit_loss.py --validate-paper` (expects
the paper repo checked out as a sibling `transfer-agreements-analysis/`).

## The differences on our data, with receipts

### UC Davis −0.07 as 1st choice

This is the visible effect of correcting the analysis boundary. The earlier
7.15 result combined Davis's canonical `Computer Science B.S.` receivers with
the sibling `Computer Science & Engineering B.S.` agreement. The corrected
single-program result is 7.00, compared with the paper's 7.07. No articulation
was deleted to produce this change; the sibling degree simply no longer
contributes evidence to the CS figure. Thirty-three Davis requirement rows also
carry current-data bundle updates, listed in the change CSV.

### UC Santa Barbara −0.02 / UC San Diego −0.02

- Allan Hancock newly articulates `CMPSC 16 ← CS 111` and `CMPSC 24 ←
  CS 112`, making that district fully transferable for UCSB at 6.00 courses —
  slightly below UCSB's previous average, hence the small decrease. Same cell
  the heatmap found, same direction.
- UCSD's `CSE 8B` is extinct in 2025–26 agreements; `CSE 11` carries the
  Intro group everywhere (inclusion count unchanged at 37 districts).

### Where this figure and the heatmap read new data differently

The heatmap says UC Davis also gained Santa Barbara CCD and West Valley–
Mission CCD; this figure's averages don't include those districts. Both are
right — **the paper's two methodologies differ on series articulations**:

- The heatmap's completeness rule counts a university course as articulated
  if *any* agreement receiver covers it — including series receivers (Santa
  Barbara City articulates `ECS 036A+036B+036C` as one three-course series).
- The credit-loss pipeline's key filter (their `creating_district_csvs.py`)
  drops receivers whose receiving matches no curated key — and a cross-group
  series like SBCC's matches none, so its articulation is invisible to this
  figure, exactly as the paper's own code would compute on today's data.

On the paper's snapshot the two methodologies agreed everywhere; today's
ASSIST expresses a few articulations as series, and the divergence shows only
there. We replicate each figure's own methodology exactly rather than
"fixing" either.

### The change inventory

334 of 4,116 requirement rows differ at the course level (91.9% byte-
identical). Nearly all are `courses-changed` — bundle updates, honors
variants, unit changes, and course renumbering (e.g. Chabot–Las Positas
`MATH 1 → MTH 1`). The handful that move the figure are the rows above.
Full list: [`analysis/results/articulation_changes.csv`](../../analysis/results/articulation_changes.csv)
(district, campus, requirement, paper-era courses, current courses,
classification) — built precisely so any line can be verified by hand.

## Why we're confident

- **Algorithm equivalence is proven, not assumed**: our implementation run on
  the paper's own inputs reproduces 100% of its course-count averages and 32
  of its 36 published figure numbers exactly.
- **Seven exact campuses**: where ASSIST didn't change, the figure doesn't
  either — down to the second decimal.
- **An internal consistency check passed on its own**: an earlier draft of
  the port that mapped receivers more loosely (by overlap rather than exact
  key match) showed two large artificial movers (+0.66, +0.60). Replicating
  the paper's exact key filter made both vanish — UCI returned to +0.00
  because Irvine Valley's partial `31+32` series is dropped by their rules,
  restoring the shared 5-course pathway at South Orange County.
- **The requirement side cannot drift**: gold bars derive from the paper's
  own curation and are asserted equal at run time.
- **The direction is the smoking gun** (again): 25 of the 31 transferability
  flips are gains — articulations accumulate, exactly as the heatmap found.
- **Every difference is named**: `articulation_changes.csv` lists the exact
  courses, verifiable on ASSIST.org today.

## Anticipated questions

**"Couldn't your pipeline just count differently than theirs?"**
No — we tested exactly that. Run on the paper's own district CSVs, our
pipeline reproduces their published per-district course counts 2,592/2,592
and their headline figure numbers 32/36 exactly.

**"Why does the heatmap show Davis gaining two districts that this figure
ignores?"**
Series articulations (see above): the heatmap's completeness rule counts
them; the credit-loss pipeline's curated-key filter — the paper's own code —
does not. Each figure replicates its own paper methodology exactly.

**"Did anything actually get harder?"**
The first-choice transferability set has no losses. Davis's lower average is a
scope correction—the sibling CSE agreement stopped contributing—not evidence
that a canonical CS articulation was withdrawn.

**"Is the paper wrong?"**
No — both figures are snapshots of ASSIST at different times, produced by
the same (now provably equivalent) machinery.

## ASSIST-stated receiver-slot variant

This is **our extension**, not a paper replication. The paper asked how many
CCC courses satisfy a fixed, hand-curated set of UC website minimums. The live
ASSIST view applies the same choice-cost machinery to the required
lower-division structure on ASSIST for one exact, configured program at each UC
campus. It is available for Computer Science, Biology, and Economics. There is
no title-substring, historical-union, or fallback-to-CS path.

The v2 artifacts fix the university-side denominator across districts. ASSIST
pages for the same UC program can contain more than one receiver-side template.
For each campus and major, generation computes the true required receiver-slot
demand of every agreement, selects the modal demand, and then selects the most
frequent normalized required-only structure at that demand (stable fingerprint
breaks a tie). That one canonical template is reused for every district;
district data can alter articulation options but never the gold bar. Every
present campus × district model is checked against the canonical fingerprint
and slot count before optimization.

Artifacts carry `schema_version: 2` and
`method_version: paper-choice-cost-assist-canonical-template-v2`.

### Methodology map

| Piece | Website-minimums figure | ASSIST receiver-slot variant |
| --- | --- | --- |
| Demand source | `curated_requirements` fixed per campus | Truthy-`is_required` groups from the exact major-scoped `assist_agreements` corpus |
| Denominator | Fixed website-course list | One systemwide canonical required-only UC template per campus: modal receiver-slot demand → most frequent normalized structure → fingerprint tie-break |
| Receiver-slot measure | One curated UC course row | A course, series, or named requirement is one receiver slot unless ASSIST splits it into separate receivers; section/group choose-N and OR semantics determine how many slots are required |
| Advisements | Website curation groups/sets | `agreement_demand_count` mirrors the ported eligibility engine's course semantics; coverage/blockers use `pmt_eligibility.py`, and CC-course minimization uses `pmt_min_courses.py`, which delegates completion back to that engine |
| Unit of evaluation | District pools sibling-college supply against fixed campus demand | **Same** — sibling colleges pooled per requirement, keeping the **best college per requirement** (fewest-course alternative, ties by name — the paper's `creating_district_csvs` rule); one district-pooled model per campus |
| Program choice | Nine exact canonical CS campus/program pairs supply articulations | Nine exact campus/program pins per selected major supply canonical-template candidates and articulation options |
| Missing/unknown structure | Not a case in the paper model | A missing campus agreement counts as all-unarticulated at the fixed gold count; unknown hashes cannot enter the template, while a canonical hash absent from a district remains unarticulated |
| Unarticulated identity | Curated receiving course names | Hybrid grain: a genuinely must-take receiver → its university course code (from `university_courses.parent_id`); a choose-N section short of its minimum → a section-level `N of [A / B / …]` descriptor |
| Downstream averaging | P(9,4), ÷336, round per district, transferable-average filter | Same permutation and averaging machinery; districts with no fully articulated path render as `0` with `districts_included: 0` |
| Unsupported denominator shapes | Not applicable | Unit-based and distinct-section constraints cannot honestly be labeled as course counts, so generation fails instead of guessing. The exact CS/Biology/Economics scopes currently contain none |

### Demand and averages

Gold bars are required receiver slots in the selected canonical template,
converted to semester equivalents. The native column is the slot count before
quarter-to-semester conversion. Candidate receivers can outnumber required
slots in a choose-N section, so the artifact records both the slot count and the
candidate receiver-kind inventory.

| Campus | Website gold | ASSIST gold | ASSIST native | Fully transferable districts | ASSIST 1st-choice avg |
| --- | ---: | ---: | ---: | ---: | ---: |
| UCD | 5.33 | 6.00 | 9 | 14 | 9.07 |
| UCM | 6.00 | 10.00 | 10 | 64 | 10.98 |
| UCSD | 4.67 | 7.33 | 11 | 0 | 0.00 |
| UCSB | 4.67 | 4.67 | 7 | 50 | 7.02 |
| UCLA | 4.67 | 10.67 | 16 | 0 | 0.00 |
| UCB | 4.00 | 9.00 | 9 | 65 | 10.12 |
| UCSC | 3.33 | 3.33 | 5 | 47 | 5.15 |
| UCI | 4.00 | 2.67 | 4 | 39 | 4.92 |
| UCR | 3.33 | 4.67 | 7 | 57 | 7.68 |

*(San Diego and Los Angeles collapse to zero transferable districts because their
single CS major has a genuinely-required receiver no CCC articulates — UCSD's
`CSE 29`, UCLA's `COM SCI 35L` — which the website's smaller curated minimum did
not include.)*

Canonical native slot counts for all three live scopes:

| Campus | Computer Science | Biology | Economics |
| --- | ---: | ---: | ---: |
| UCD | 9 | 5 | 4 |
| UCM | 10 | 8 | 4 |
| UCSD | 11 | 18 | 5 |
| UCSB | 7 | 6 | 4 |
| UCLA | 16 | 9 | 6 |
| UCB | 9 | 8 | 2 |
| UCSC | 5 | 7 | 3 |
| UCI | 4 | 4 | 4 |
| UCR | 7 | 3 | 1 |

The JSON receipts store each campus's template fingerprint,
selected-template frequency, full demand distribution, receiver-kind
inventory, slot count, choice averages, and eligible-district counts:

- [Computer Science](../../analysis/results/paper-credit-loss.assist.json)
- [Biology](../../analysis/results/paper-credit-loss.bio.assist.json)
- [Economics](../../analysis/results/paper-credit-loss.econ.assist.json)

Matching `paper_credit_loss[_bio|_econ]_assist_*.csv` files provide district
averages, detailed blockers, blocker summaries, and complete cells.

### Blocking receivers

Blockers are reported at hybrid grain: a genuinely must-take receiver is named
by its university course code; a choose-N section that cannot meet its stated
minimum is reported as `N of [A / B / …]`. The old advisement-blind rule
produced phantom blockers — every unarticulated alternative inside a "Complete 1
of the following" section (e.g. `UCB MATH 56`, 71 districts; `UCI I&C SCI 53`,
71; `UCD MAT 027A`, 72) — which are now gone.

| Campus | ASSIST-stated blocker | Grain | Districts blocked |
| --- | --- | --- | ---: |
| UCLA | `COM SCI 35L` | course | 72 |
| UCSD | `CSE 29` | course | 71 |
| UCSD | `CSE 21` | course | 70 |
| UCLA | `1 of [COM SCI M51A / EC ENGR M16]` | section | 63 |
| UCD | `ECS 036C` | course | 41 |

Series requirements count as one receiver (e.g. `UCI I&C SCI 31 + 32 + 33`, 29
districts). Full receipt:
[`paper_credit_loss_assist_blocker_summary.csv`](../../analysis/results/paper_credit_loss_assist_blocker_summary.csv).
The choose-N grain still means an unarticulated alternative inside a satisfiable
"Complete 1 of the following" section is never a phantom blocker — only sections
that genuinely cannot reach their minimum surface.

### Validation

- **Optimizer fidelity:** `pmt_min_courses.py` is locked against the vendored JS
  picker (`server/services/analysis/minCourses.js`) by
  `analysis/tests/test_pmt_min_courses.py` — every synthetic advisement branch
  (choose-N, unit advisements, D-buckets, `same_as`, OR sections) plus 27 real
  ASSIST agreements reproduce the JS course-id set exactly. Regenerate the
  goldens with `node server/services/analysis/genMinCoursesGoldens.js`.
- **Canonical-template loop-closer:** every present campus × district model must
  reproduce its selected template fingerprint and exact native receiver-slot
  demand. Unknown district hashes cannot enter the denominator.
- **Optimizer loop-closer:** for each major, all 648 campus × district optimizer
  course sets are re-checked against `is_major_completed`; 648/648 pass for CS,
  Biology, and Economics.
- **Coverage cross-check:** the blocker walk and independent
  `is_major_articulable` oracle identify the same complete cells: CS 336 == 336,
  Biology 363 == 363, Economics 552 == 552; mismatches 0 for every scope.
- **Cross-figure completion parity:** Figures 2–4 and Income reuse Figure 1's
  major-scoped canonical UC templates and complete-cell set. Receiver-OR
  pooling and best-articulated-college pooling are equivalent for the boolean
  completion decision; Figure 1 alone retains full alternatives for the blue
  minimum-course optimization. Server coverage and eligibility tests enforce
  that shared completion contract.
- **Denominator regression tests:** focused scope/cover tests exercise
  no-advisement any-one sections, group caps, structured OR, non-required
  groups, unsupported units, modal-template selection, and district pooling;
  12/12 pass.
- **Determinism:** CS district/blocker/complete CSV hashes begin
  `a4e52a93…` / `0e0ff1ef…` / `26723b60…`; Biology
  `db565a16…` / `59b76a5b…` / `34200fda…`; Economics
  `6301874c…` / `d6e76cfd…` / `ef8b4852…`.
- **Render/build:** the focused Figure 1 suite passes 10/10, and
  `npm run build --prefix frontend` passes. Live previews and non-CS views
  resolve only audited embedded major scopes and fail closed when an artifact
  is absent or predates schema v2.

### Anticipated questions

**"Why do some bars go to zero?"**
The blue bars average only districts whose rounded unarticulated average is
zero. Some major/campus scopes have no fully articulated district (CS: UCSD and
UCLA; Biology: UCSD; Economics: UCLA). Their averages render as `0` with
`districts_included: 0` rather than hiding the collapse.

**"Do the other figures use a different completion definition?"**
No. Figures 2–4 and Income reuse the same major-scoped canonical UC template
and complete-cell set as Figure 1. Receiver-OR pooling and choosing the best
articulated college are equivalent for the boolean completion result. Only
Figure 1's blue course counts differ because they retain the full articulation
alternatives and run the minimum-course optimizer.

**"Why select a canonical template instead of using each college's page?"**
Because the gold bar represents university-side demand. If a district selected
its own page structure, changing the sending college would silently change both
the supply and the denominator. The modal-demand/most-frequent-template rule
keeps demand systemwide and deterministic while retaining district-specific
articulation evidence.

**"Is ASSIST saying these courses are admissions minimums?"**
No. This mode deliberately measures what ASSIST agreement pages mark required,
after our curation exclusions. It is a diagnostic demand model for comparing
surfaces, not a claim that the paper used or endorsed this definition.

## Figure verification

The local matplotlib render reproduces the paper's axes, grouped bars,
hatching, labels, and Blues palette (`#08306b`, `#1764ab`, `#4a98c9`,
`#94c4df`). Value and geometry checks are recorded in
[`assets/paper-credit-loss/`](assets/paper-credit-loss/). After verification,
the finished Figure is published to the gallery with `pmt.publish(fig, ...)`.

## Reproduce it yourself

```bash
cd analysis
.venv/bin/python paper_credit_loss.py --workers 8 --diff   # canonical website-minimums rebaseline (~3 min)
.venv/bin/python paper_credit_loss.py --requirements assist --major cs --workers 8 --diff
.venv/bin/python paper_credit_loss.py --requirements assist --major bio --workers 8
.venv/bin/python paper_credit_loss.py --requirements assist --major econ --workers 8
.venv/bin/python paper_credit_loss.py --validate-paper     # our algorithm on THEIR data
.venv/bin/python paper_credit_loss.py --articulation-diff  # course-level change list
```

Outputs: `analysis/results/paper-credit-loss.ours.json` (stamped
with `data_refreshed_at` and the nine exact `major_scope.program_pins`),
`analysis/results/paper-credit-loss.assist.json` (CS ASSIST view),
`analysis/results/paper-credit-loss.bio.assist.json`,
`analysis/results/paper-credit-loss.econ.assist.json`,
`analysis/results/paper_credit_loss_districts.csv` (per-district receipts),
`analysis/results/paper_credit_loss[_bio|_econ]_assist_*.csv` (ASSIST per-major
district, blocker, and completion receipts),
`analysis/results/articulation_changes.csv` (the by-hand verification
surface). Re-run after dataset ports.

---

*Sources: `curated_requirements` (imported from the paper repo's
`course_reqs.json`) · `assist_agreements` (ASSIST 2025–26) · `assist_institutions` ·
`assist_courses`. Paper artifacts: `question_1/csvs/2026/order_4/
optimal_order_{1..4}_averages.csv` + `grouped_bar_graph.py` +
`optimal_total_combinations.py` + `creating_districts/` in
transfer-agreements-analysis. Independent implementation:
`analysis/paper_credit_loss.py`.*
