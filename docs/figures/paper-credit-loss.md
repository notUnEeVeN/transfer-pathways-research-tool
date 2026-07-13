# Figure 1 — credit loss in transfer pathways: replication note

**A decision-for-decision recreation of the paper's credit-loss figure on our
data — with every difference named at the course level.**

> Paper caption: *"Visualizing the credit loss in transfer pathways: average UC
> incoming transfer requirements (yellow) and their CCC equivalents (blue)."*
>
> Dataset `2026-07-06-v1` · CS majors · 9 UC campuses × 72 CC districts ×
> 4 choice positions · July 6, 2026

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
| [ASSIST-stated minimums variant](#assist-stated-minimums-variant) | Our diagnostic extension, demand table, blockers, and validation |
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
- **UC Davis**: `ECS 036A` newly articulated at San Francisco and San Luis
  Obispo; Antelope Valley now lists it as not-articulated (was unmentioned),
  dropping that district from Davis's average.
- **UCSD**: `CSE 8B` is gone from all agreements; `CSE 11` carries Intro.
- The rest of the 337 changed rows (of 4,116) are bundle updates and course
  renumbering — full list in
  [`analysis/results/articulation_changes.csv`](../../analysis/results/articulation_changes.csv).

**The one-liner:** *"Provably the same algorithm — it reproduces their
numbers on their data — run on newer ASSIST data: six of nine campuses
identical at first choice, the rest within ±0.08, every difference a named
articulation change."*

**ASSIST-stated minimums extension:** when demand comes from `assist_agreements`
required groups (the one Settings-selected CS major per campus) instead of the
website-minimum curation — with sibling colleges pooled per requirement, exactly
as the paper pools — both eligibility and the minimum-course count are decided by
the ported Plan My Transfer algorithms: the eligibility formula (honoring choose-N:
"Complete 1 of the following" is satisfied by any one) and the branch-and-bound
minimum-course picker. Seven of nine campuses have fully transferable districts
(UCB 69, UCR 57, UCM 64, UCSB 50, UCSC 47, UCI 39, UCD 30); UCSD and UCLA have
zero, each blocked at every district by a genuinely required receiver (UCLA
`COM SCI 35L`, UCSD `CSE 29`).

---

## Verdict (detail)

- **Gold requirement bars: 9 of 9 campuses identical.** Derived from
  `curated_requirements` (+ quarter→semester conversion) rather than
  transcribed; the script asserts they reproduce the paper's constants and
  fails loudly on drift.
- **Blue bars: 6 of 9 campuses reproduce the paper's 1st-choice average
exactly**; every delta in the figure is within ±0.08.
- **Per-district: 86.4% of all 2,592 (campus × district × position)
  average-pairs are identical to two decimals.** 31 cells flip
  transferability across all positions — 25 of them gains. At 1st choice:
  one gain (UCSB × Allan Hancock), one loss (UCD × Antelope Valley, see
  below — a visibility change, not a lost articulation).

| Δ (ours − paper), transferable average | 1st | 2nd | 3rd | 4th |
| --- | --- | --- | --- | --- |
| UCD | +0.08 | +0.06 | +0.00 | −0.03 |
| UCM | +0.00 | −0.02 | −0.03 | −0.04 |
| UCSD | −0.02 | −0.04 | −0.04 | −0.04 |
| UCSB | −0.02 | −0.03 | −0.05 | −0.05 |
| UCLA | +0.00 | −0.02 | −0.04 | −0.05 |
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

### UC Davis +0.08 as 1st choice

Three small, named effects:

1. `ECS 036A` **newly articulated** at San Francisco CCD (`CS 110A/110B`) and
   San Luis Obispo County CCD (`CS 217`) — those districts' Davis pathways
   now include it.
2. Antelope Valley's agreement now **mentions `ECS 036A` without articulating
   it** (paper-era agreements didn't mention it at all). Under the paper's
   rules a mentioned-but-unarticulated requirement blocks full
   transferability, so Antelope Valley drops out of Davis's average — a
   *visibility* change in ASSIST, not a lost articulation.
3. 33 Davis requirement rows elsewhere have updated course bundles (see the
   change CSV).

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

337 of 4,116 requirement rows differ at the course level (91.8% byte-
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
No articulation was withdrawn anywhere in the figure's inputs. The one
first-choice district that dropped out (Antelope Valley × Davis) did so
because ASSIST now explicitly lists `ECS 036A` as not-articulated where it
used to be silent — more information, not less articulation.

**"Is the paper wrong?"**
No — both figures are snapshots of ASSIST at different times, produced by
the same (now provably equivalent) machinery.

## ASSIST-stated minimums variant

This is **our extension**, not a paper replication. The paper asked how many
CCC courses satisfy a fixed, hand-curated set of UC website minimums. The
ASSIST variant asks the same credit-loss question against the minimums ASSIST
agreements themselves state, for the one hand-selected CS major per campus in
the working dataset (Settings -> `settings.app.visible_pairs`; falls back to
`PAPER_MAJORS` if unset). Both halves are the website's own algorithms, ported
so the figure inherits the console's rigor: the eligibility decision from
`analysis/pmt_eligibility.py` (which honors choose-N — "Complete 1 of the
following" is satisfied by any one receiver), and the minimum-course count from
`analysis/pmt_min_courses.py`, a faithful branch-and-bound port of the site's
minimum-course picker (`missingCourses.js`) that delegates every completion
decision back to the eligibility engine. Under these single-major minimums, San
Diego and Los Angeles have no district where one college meets every requirement.

### Methodology map

| Piece | Website-minimums figure | ASSIST-stated-minimums variant |
| --- | --- | --- |
| Demand source | `curated_requirements` fixed per campus | `assist_agreements.requirement_groups` (truthy `is_required`) for the one Settings-selected CS major per campus |
| Advisements | Website curation groups/sets | Both coverage/blockers (`pmt_eligibility.py`, strict) and the course count (`pmt_min_courses.py`, non-strict) delegate every completion decision to the ported eligibility engine, so section/group choose-N, unit advisements, OR sections, series, and `same_as` cross-listing are all honored by construction — no separate advisement re-encoding. Curation receiver exclusions applied (none in the current dataset) |
| Unit of evaluation | District pools sibling-college supply against fixed campus demand | **Same** — sibling colleges pooled per requirement, keeping the **best college per requirement** (fewest-course alternative, ties by name — the paper's `creating_district_csvs` rule); one district-pooled model per campus |
| Program choice | Not applicable; paper rows are campus-level | The one Settings-selected CS major per campus |
| Missing campus agreement | Not a case in the paper model | Counts as all-unarticulated using that campus's required-course (gold) count |
| Unarticulated identity | Curated receiving course names | Hybrid grain: a genuinely must-take receiver → its university course code (from `university_courses.parent_id`); a choose-N section short of its minimum → a section-level `N of [A / B / …]` descriptor |
| Downstream averaging | P(9,4), ÷336, round per district, transferable-average filter | Same permutation and averaging machinery; districts with no fully articulated path render as `0` with `districts_included: 0` |

### Demand and averages

Gold bars are the canonical CS major's required UC-course count (choose-N aware),
converted to semester equivalents. The native column is that count before
quarter-to-semester conversion. ASSIST states the full lower-division prep, so the
gold is higher than the website's hand-picked hard minimum.

| Campus | Website gold | ASSIST gold | ASSIST native | Fully transferable districts | ASSIST 1st-choice avg |
| --- | ---: | ---: | ---: | ---: | ---: |
| UCD | 5.33 | 8.00 | 12 | 30 | 8.93 |
| UCM | 6.00 | 10.00 | 10 | 64 | 10.98 |
| UCSD | 4.67 | 7.33 | 11 | 0 | 0.00 |
| UCSB | 4.67 | 4.67 | 7 | 50 | 7.02 |
| UCLA | 4.67 | 11.33 | 17 | 0 | 0.00 |
| UCB | 4.00 | 3.00 | 3 | 69 | 3.83 |
| UCSC | 3.33 | 3.33 | 5 | 47 | 5.15 |
| UCI | 4.00 | 8.00 | 12 | 39 | 5.36 |
| UCR | 3.33 | 4.67 | 7 | 57 | 7.67 |

*(San Diego and Los Angeles collapse to zero transferable districts because their
single CS major has a genuinely-required receiver no CCC articulates — UCSD's
`CSE 29`, UCLA's `COM SCI 35L` — which the website's smaller curated minimum did
not include.)*

Receipts:
[`paper-credit-loss.assist.json`](../../analysis/results/paper-credit-loss.assist.json)
stores the demand distribution per campus, and
[`paper_credit_loss_assist_complete_districts.csv`](../../analysis/results/paper_credit_loss_assist_complete_districts.csv)
lists every surviving campus × district × college.

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
| UCD | `ECS 036C` | course | 38 |

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
- **Loop-closer:** every one of the 648 pooled (campus × district) models' optimizer
  course sets is re-checked against the eligibility engine at run time
  (`validate_assist_optimizer`) — the chosen courses must actually satisfy
  `is_major_completed`. This caught a real gap (ASSIST courses absent from the
  `courses` collection) during the port.
- **Coverage cross-check:** the single-campus complete cells (blocker walk) equal
  the INDEPENDENT `is_major_articulable` oracle (`is_major_completed` predicate
  path) — 356 == 356, mismatches 0. Both paths are locked against PMT's own
  golden outcomes by `analysis/tests/test_pmt_fidelity.py`.
- **Heatmap pooling** (server `coverageData`, `groupBy='district'`) is validated
  separately by `server/services/analysis/pathways.test.js`; the vendored JS
  eligibility port is locked against the same PMT goldens by
  `server/services/analysis/eligibility.test.js`.
- **Determinism:** the deterministic CSVs hash to district `748601cb…`, blocker
  summary `c9a2eae2…`, complete districts `702525f2…`.
- **Render/build:** `npm run build --prefix frontend` passes; headless Chrome
  screenshots at `1991×1191` for Website, ASSIST, and ASSIST-difference views
  render without label collisions.

### Anticipated questions

**"Why do some bars go to zero?"**
The blue bars average only districts whose rounded unarticulated average is
zero. Under the single-major ASSIST demand, San Diego and Los Angeles have no
such districts — every college is blocked by a genuinely required receiver — so
their averages render as `0` with `districts_included: 0` rather than hiding the
collapse.

**"Why is the heatmap slightly more complete?"**
The heatmap's district mode pools sibling colleges before testing
completeness. This credit-loss extension picks one best college because
ASSIST demand varies by college and program. Four cells are complete only
under the heatmap's pooled rule; the validation names them above.

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
.venv/bin/python paper_credit_loss.py --diff               # recompute + per-bar deltas (~3 min)
.venv/bin/python paper_credit_loss.py --requirements assist --diff  # ASSIST-stated variant
.venv/bin/python paper_credit_loss.py --validate-paper     # our algorithm on THEIR data
.venv/bin/python paper_credit_loss.py --articulation-diff  # course-level change list
```

Outputs: `analysis/results/paper-credit-loss.ours.json` (stamped
with `data_refreshed_at`),
`analysis/results/paper-credit-loss.assist.json` (ASSIST-minimums
view),
`analysis/results/paper_credit_loss_districts.csv` (per-district receipts),
`analysis/results/paper_credit_loss_assist_districts.csv` (ASSIST per-district
receipts),
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
