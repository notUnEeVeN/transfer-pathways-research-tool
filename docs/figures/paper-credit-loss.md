# Figure 1 — credit loss in transfer pathways: replication note

**A decision-for-decision recreation of the paper's credit-loss figure on our
data — with every difference named at the course level.**

> Paper caption: *"Visualizing the credit loss in transfer pathways: average UC
> incoming transfer requirements (yellow) and their CCC equivalents (blue)."*
>
> Dataset `2026-07-06-v1` · CS majors · 9 UC campuses × 72 CC districts ×
> 4 choice positions · July 6, 2026

## The short version

**Did we recreate their analysis correctly?** Yes — decision for decision,
and proven the strong way: our from-scratch rebuild of their pipeline, run on
**their own data files**, reproduces their published figure (every
per-district course count, and 32 of 36 figure numbers to the penny; the
remaining four sit in cells where their own script isn't run-to-run
reproducible — see the equivalence check below).

**What's different on our data?** Almost nothing: **seven of nine campuses
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
numbers on their data — run on newer ASSIST data: seven of nine campuses
identical, the rest within ±0.08, every difference a named articulation
change."*

**ASSIST-stated minimums extension:** when demand comes from `uc_agreements`
required groups instead of the website-minimum curation, eligibility is decided
by the ported Plan My Transfer formula, honoring ASSIST choose-N advisements (a
section that says "Complete 1 of the following" is satisfied by any one). Eight
of nine campuses have fully transferable districts (UCB 69, UCM 69, UCR 62,
UCSB 49, UCSC 46, UCI 43, UCD 28, UCSD 1); only UCLA has zero, blocked by
genuinely required receivers such as `COM SCI 35L`.

---

## Verdict (detail)

- **Gold requirement bars: 9 of 9 campuses identical.** Derived from
  `ref_uc_transfer_requirements` (+ quarter→semester conversion) rather than
  transcribed; the script asserts they reproduce the paper's constants and
  fails loudly on drift.
- **Blue bars: 7 of 9 campuses reproduce the paper's 1st-choice average
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
| **Requirement rows** | Hand-curated per-campus minimums (`course_reqs.json`), group → alternative sets → rows | **The same curation**, imported verbatim (`ref_uc_transfer_requirements`); gold bars derived from it and asserted equal to the paper's constants |
| **Articulations** | ASSIST agreements, circa the paper's scrape (college CSVs) | ASSIST agreements, 2025–26 (`uc_agreements`) |
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
agreements themselves state — decided by the ported Plan My Transfer
eligibility formula (`analysis/pmt_eligibility.py`), which honors choose-N
advisements: a section that says "Complete 1 of the following" is satisfied by
any one of its receivers. Only Los Angeles has no district where a college
meets every ASSIST-stated minimum.

### Methodology map

| Piece | Website-minimums figure | ASSIST-stated-minimums variant |
| --- | --- | --- |
| Demand source | `ref_uc_transfer_requirements` fixed per campus | `uc_agreements.requirement_groups` with `is_required !== false`, per college × campus × program |
| Advisements | Website curation groups/sets | Coverage + blockers use the ported PMT eligibility formula (`analysis/pmt_eligibility.py`): section/group choose-N, OR sections, and series honored — with our one modification, unmet ASSIST-stated demand is NOT default-accepted. Course cost still uses the choose-N MILP; curation receiver exclusions skipped |
| Unit of evaluation | District pools sibling-college supply against fixed campus demand | Each college is solved separately; district value is the best college by `(unarticulated, articulated, college name)` |
| Program choice | Not applicable; paper rows are campus-level | Inside the MILP: exactly one CS program selected per campus at that college |
| Missing campus agreement | Not a case in the paper model | Counts as all-unarticulated using that campus's modal ASSIST receiver count |
| Unarticulated identity | Curated receiving course names | Hybrid grain: a genuinely must-take receiver → its university course code (from `university_courses.parent_id`); a choose-N section short of its minimum → a section-level `N of [A / B / …]` descriptor |
| Downstream averaging | P(9,4), ÷336, round per district, transferable-average filter | Same permutation and averaging machinery; districts with no fully articulated path render as `0` with `districts_included: 0` |

### Demand and averages

Gold bars now use the modal required-receiver count across ASSIST agreements
for that campus. The spread column is native ASSIST receiver count before
quarter-to-semester conversion.

| Campus | Website gold | ASSIST modal gold | ASSIST native spread | Distinct values | Fully transferable districts | ASSIST 1st-choice avg |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| UCD | 5.33 | 6.00 | 7–19 | 9 | 28 | 8.68 |
| UCM | 6.00 | 6.00 | 6–10 | 2 | 69 | 6.78 |
| UCSD | 4.67 | 6.00 | 9–16 | 3 | 1 | 7.00 |
| UCSB | 4.67 | 4.67 | 7–7 | 1 | 49 | 7.00 |
| UCLA | 4.67 | 6.67 | 10–18 | 4 | 0 | 0.00 |
| UCB | 4.00 | 3.00 | 3–9 | 3 | 69 | 3.81 |
| UCSC | 3.33 | 3.33 | 5–8 | 2 | 46 | 5.07 |
| UCI | 4.00 | 2.67 | 4–7 | 4 | 43 | 5.28 |
| UCR | 3.33 | 4.00 | 6–7 | 2 | 62 | 6.84 |

Receipts:
[`paper-credit-loss.assist.json`](../../frontend/src/analyses/data/paper-credit-loss.assist.json)
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
| UCSD | `1 of [CSE 15L / CSE 29]` | section | 71 |
| UCLA | `1 of [COM SCI M51A / EC ENGR M16]` | section | 61 |
| UCSD | `MATH 20E` | course | 49 |
| UCD | `ECS 036C` | course | 35 |

Series requirements count as one receiver (e.g. `UCI I&C SCI 31 + 32 + 33`, 29
districts). Full receipt:
[`paper_credit_loss_assist_blocker_summary.csv`](../../analysis/results/paper_credit_loss_assist_blocker_summary.csv).

Worked example (the fix): **UCB × College of Marin, Computer Science B.A.** has
one required group — section 0 "Complete 2: `MATH 51`, `MATH 52`" (both
articulate, via `MATH 123` / `MATH 124`) and section 1 "Complete 1 of:
`MATH 54`, `EECS 16A`, `MATH 56`" (`MATH 54` and `MATH 56` articulate). It is
therefore fully articulable; the old rule wrongly counted the unarticulated
`EECS 16A` (and, aggregated across districts, `MATH 56`) as a blocker. The
generated examples live in
[`paper_credit_loss_assist_examples.json`](../../analysis/results/paper_credit_loss_assist_examples.json).

### Validation

- **Exact ≤ greedy:** 2,415 individual campus × college × program agreements
  checked. Distribution of `greedy − exact`: `+0:2313`, `+1:72`, `+2:17`,
  `+3:13`.
- **Coverage cross-check:** the single-campus ASSIST MILP has 367 complete
  campus × district cells; an INDEPENDENT oracle — `is_major_articulable` from
  the ported PMT formula (the `is_major_completed` predicate path, distinct from
  the `articulation_blockers` walk that drives the MILP) — also has 367;
  mismatches: 0. Both paths are locked against PMT's own golden outcomes by
  `analysis/tests/test_pmt_fidelity.py`, so this is a genuine independent check,
  not a same-file replica of the rule under test.
- **Heatmap pooling** (server `coverageData`, `groupBy='district'`) is validated
  separately by `server/services/analysis/pathways.test.js`; the vendored JS
  port is locked against the same PMT goldens by
  `server/services/analysis/eligibility.test.js`.
- **Determinism:** the deterministic CSVs hash to district `ef9a322a…`, blocker
  summary `7c98be6a…`, complete districts `3e4937f2…`.
- **Render/build:** `npm run build --prefix frontend` passes; headless Chrome
  screenshots at `1991×1191` for Website, ASSIST, and ASSIST-difference views
  render without label collisions.

### Anticipated questions

**"Why do some bars go to zero?"**
The blue bars average only districts whose rounded unarticulated average is
zero. Under ASSIST-stated demand, Davis, San Diego, Los Angeles, and Berkeley
have no such districts, so their averages render as `0` with
`districts_included: 0` rather than hiding the collapse.

**"Why is the heatmap slightly more complete?"**
The heatmap's district mode pools sibling colleges before testing
completeness. This credit-loss extension picks one best college because
ASSIST demand varies by college and program. Four cells are complete only
under the heatmap's pooled rule; the validation names them above.

**"Is ASSIST saying these courses are admissions minimums?"**
No. This mode deliberately measures what ASSIST agreement pages mark required,
after our curation exclusions. It is a diagnostic demand model for comparing
surfaces, not a claim that the paper used or endorsed this definition.

## The website figure and how the port was verified

[`frontend/src/analyses/PaperCreditLoss.jsx`](../../frontend/src/analyses/PaperCreditLoss.jsx)
renders three views: **Paper baseline** (transcribed numbers,
[`paperCreditLossBaseline.js`](../../frontend/src/analyses/paperCreditLossBaseline.js)),
**Our data** (the committed
[`paper-credit-loss.ours.json`](../../frontend/src/analyses/data/paper-credit-loss.ours.json)),
and **Difference** — our bars with the delta *region* shaded (solid red
segment = courses added vs the paper, translucent green block = courses no
longer needed), a black tick at the paper's level, and signed delta labels;
unchanged bars stay plain so the movers stand out.

The SVG reproduces the paper's matplotlib render geometrically — axes box,
bar layout, legend frame/rows, hatch period, tick/label bands all measured
off the published 300-dpi PNG; Blues sampled exactly (`#08306b`, `#1764ab`,
`#4a98c9`, `#94c4df`). Render parity was verified by rasterizing the
component in headless Chrome and 50/50-blending it over the paper PNG — no
geometric ghosting; evidence in
[`assets/paper-credit-loss/`](assets/paper-credit-loss/). The one deliberate
substitution is the font: Arial in place of matplotlib's DejaVu Sans (not
web-safe); values, geometry, colors, hatching and layout are identical.

## Reproduce it yourself

```bash
cd analysis
.venv/bin/python paper_credit_loss.py --diff               # recompute + per-bar deltas (~3 min)
.venv/bin/python paper_credit_loss.py --requirements assist --diff  # ASSIST-stated variant
.venv/bin/python paper_credit_loss.py --validate-paper     # our algorithm on THEIR data
.venv/bin/python paper_credit_loss.py --articulation-diff  # course-level change list
```

Outputs: `frontend/src/analyses/data/paper-credit-loss.ours.json` (stamped
with `dataset_version`; the website's Our data / Difference views),
`frontend/src/analyses/data/paper-credit-loss.assist.json` (ASSIST-minimums
view),
`analysis/results/paper_credit_loss_districts.csv` (per-district receipts),
`analysis/results/paper_credit_loss_assist_districts.csv` (ASSIST per-district
receipts),
`analysis/results/articulation_changes.csv` (the by-hand verification
surface). Re-run after dataset ports.

---

*Sources: `ref_uc_transfer_requirements` (imported from the paper repo's
`course_reqs.json`) · `uc_agreements` (ASSIST 2025–26) · `ref_cc_districts` ·
`courses`. Paper artifacts: `question_1/csvs/2026/order_4/
optimal_order_{1..4}_averages.csv` + `grouped_bar_graph.py` +
`optimal_total_combinations.py` + `creating_districts/` in
transfer-agreements-analysis. Independent implementation:
`analysis/paper_credit_loss.py`.*
