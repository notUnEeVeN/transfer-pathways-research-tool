# Verify 6 — measurement comparability of claim F7 (MA Fig 1, "MA's ceiling is soft, CA's is hard")

Reviewer: verify-6-measurement-comparability (adversarial). Repository read-only; scratch under this directory.
Scripts and raw outputs: `recompute.py` / `recompute_out.txt`, `probe.js` / `probe_out.txt`,
`assist_upper.js` / `assist_upper_out.txt`, `stats.py` / `stats_out.txt`.

## Verdict: REFUTED AS STATED (materially misleading on measurement grounds). Numbers reproduce. Confidence 0.85.

Every number in the claim reproduces (section 1). What does not survive is the comparison the numbers are
arranged to make. The MA half is an OBSERVATION (the workbook scored every upper column per CC and found
ticks); the CA half is a CONSTRUCTION (the nine cs templates encode upper-division work as placeholder
receivers with no course ids, and ASSIST's CS agreements contain no upper-division receivers at all, so the
engine cannot return anything but 0). "MA soft, CA hard" therefore compares a measured quantity to an
unmeasured one. The closing "CA cs 68.2 beats MA 57.5" is arithmetically right but (a) discards exactly the
upper ticks the first half of the claim celebrates — with them, the like-for-like gap is 68.2 vs 66.4 — and
(b) holds only at the cell level (z about 5), not at the institution level (t 1.3; Fitchburg 92.8 exceeds every UC).

## 1. Numbers reproduced (VERIFIED, our computation)

| claim quantity | artefact vintage | corpus | reproduced |
|---|---|---|---|
| 34 upper columns articulate somewhere | `server/data/ma/raw/heatmap.json` = final-repo `Four Year Heatmap.xlsx` | ma-cs, 11 universities, 270 columns (115 flagged upper) | **34 of 115** |
| Fitchburg CSC 3700 at 15/15 | same | same | **15** |
| five Fitchburg "Upper Level Elective (3000)" at 6–15 | same | same | **6, 8, 8, 13, 15** |
| Bridgewater COMP 340/350 at 10/15 | same | same | **10, 10** |
| 21 of 165 cells exceed lower-division share | same | 165 cells | **21** (Bridgewater 8, Fitchburg 13) |
| Fitchburg 134% of ceiling | same | 15 Fitchburg cells | **134.4** (= 70.1 / 52.2) |
| CA nontransferable tier 0% in 1035/1035 | served `coverageData` rows 2026-09-07 (`dossier-fig1/coverage_cs.json`) | CA cs, degree lens, 9 UC x 115 CC, all 1035 rows `hand_verified` | **1035/1035**; also 1035/1035 in bio and econ |
| lower-division-only CA cs 68.2 | same served rows | same | **68.2** (cell mean) |
| lower-division-only MA 57.5 | raw heatmap.json | 165 cells | **57.46**; served ma-cs archive gives **57.3** (one cell, Cape Cod -> Dartmouth, 45.2 raw vs 35.5 served) |

Vintage mixing inside the claim: the MA numbers are raw-heatmap (final repo), the CA numbers are served
engine output; the MA "57.5" is not the served value (57.3). Small, but the claim never says so.

## 2. What "upper" means on each side (the ceiling is not the same object)

**MA.** `convert_recovered.py` lines 109–132: the `upper` flag is POSITIONAL — the converter searches for the
column boundary L that reproduces the workbook's own "Lower" ratio column for all 15 CCs and flags every
column at index >= L. So "upper" = "right of the boundary the paper's authors drew", not "upper-numbered".
Of the 34 ticked upper columns (recompute_out.txt):

- 18 are named upper-division courses (75 ticks),
- 15 are unnumbered "Upper Level Elective"/"Math Elective (post calc II)" SLOT columns (103 ticks — the majority of all upper ticks),
- 1 is an OR column, Worcester "Statistics I (MA 150) OR Probability and Statistics (MA 302)" (14 ticks) whose lower-numbered alternative is almost certainly what articulates.

So "34 upper-numbered columns" mislabels 16 of the 34. Total upper cells ticked: 192 / 1725 = 11.1%.

The 21 above-ceiling cells are all at Bridgewater (8) and Fitchburg (13), and 19 of 21 are A2B-mapped
("MT" flag). Algebraically a cell exceeds its ceiling when upper ticks > lower misses; it is a property of two
universities' A2B maps, not of the state.

**CA.** `resolveSectionTier` (degreeSlots.js 1262–1293) stamps a group `nontransferable` from the template's
own `tier` / `course_level: upper_division` / `cc_articulable: false` fields, and pathways.js line 1118
comments that this tier "is 0% everywhere by construction — a community college cannot teach it".
`probe_out.txt` shows what is actually inside the tier for the nine cs templates: **153 receivers, every one
of kind `requirement` with `parent_id: null`** (e.g. UCLA "Upper-division major coursework — 20 courses (at
UCLA)", UCSB "17 courses (67 units)"), zero named courses. `receiverArticulated` (pathways.js 127/222,
degreeSlots.js) returns false whenever a receiver has no parent ids, so these slots cannot be covered no
matter what any agreement says. The legacy CA/MA `transferEligible` rule (degreeSlots.js 409–417, 865–873:
`!exactSource || ...`) would in principle let a nontransferable receiver count if articulated — but there is
nothing to articulate against.

Second, ASSIST itself never poses the question. `assist_upper_out.txt`: across all 1035 UC CS agreements,
receivers are 172 distinct lower-division UC courses and **exactly one** upper-division receiver (UCSB,
never articulated). ASSIST major-preparation agreements are a lower-division instrument by design, so "0%
upper-division articulation in CA" is not an observation the data could have failed to make.

Third, CA's `nontransferable` tier is not "upper division": it also holds cap residue ("Further units earned
at Berkeley — transfer cap reached", "Unrestricted electives — to reach 120 units") and lower-division courses
relabelled BECAUSE no college articulates them (cs: UCLA COM SCI 1, Merced CSE 001; econ: UCI ECON 15B,
UCLA MATH 31AL; bio: UCR STAT 010). MA leaves its 20 never-articulated lower-division columns (Framingham
CSCI 215, Amherst COMPSCI 220/230/240/250, ...) in the lower denominator. The CA ceiling is therefore
partly outcome-defined; the MA ceiling is not. For cs the correction is small (68.2 -> 67.2 if COM SCI 1 and
CSE 001 are put back as dead lower columns) but the asymmetry is real and larger in econ/bio.

## 3. The "beats" comparison

Both sides are course counts, GE excluded, lower-division covered / lower-division named, per-cell means —
the definitions match better than anywhere else in this figure. But:

- Cohort and supply: CA = 9 UC x 115 CC, ASSIST official agreements, templates hand-verified (1035/1035);
  MA = 11 universities x 15 CC, authors' binary judgement from MassTransfer equivalency DB + university
  websites, 0 verified (paper source). Cell counts 1035 vs 165.
- Cell-level z = 5.3 (SE 2.04). Institution-level t = 1.34 (CA n=9 sd 13.7; MA n=11 sd 21.9): not an ordering.
  Per-university: Fitchburg 92.8 > CA max (Riverside 87.5); Lowell 86.7 ~ Riverside; Framingham 23.0, MCLA
  29.7, Westfield 44.6 < CA min (Irvine 46.5). MA is wider on both ends, not simply lower.
- Internal tension: the first half of the claim says MA's upper ticks are real articulation; the last clause
  then drops them to declare CA the winner. If the ticks are real, the like-for-like statistic is MA
  all-level ticks / lower denominator = 66.4 (cell mean; Fitchburg 134, Lowell 87, Bridgewater 86) vs CA 68.2,
  a 1.8-point gap. If they are not real (workbook convention), the "soft ceiling" half collapses. The claim
  cannot have both.

## 4. What survives

- MA-internal: 34/115 upper columns have ticks, dominated by elective-slot columns (103/192 ticks) and by
  two A2B-heavy universities; 21 above-ceiling cells, 19 A2B-flagged. VERIFIED, final-repo vintage.
- CA: the templates and ASSIST encode upper-division work as unarticulable; nothing in the CA data measures
  whether a UC would award upper-division credit for CC work. Any statement about CA's "hard ceiling" is
  policy CONTEXT (UC awards lower-division credit for CC coursework), not a figure finding.
- Lower-division-only: CA cs cell mean 68.2 > MA 57.5, with the caveats in section 3.

## 5. Corrected claim

"In the MA workbook (final-repo vintage), 34 of the 115 columns right of the paper's own lower/upper boundary
carry at least one tick — 18 named upper-division courses, 15 unnumbered 'Upper Level Elective' slots, and
one OR column with a lower-division alternative; 192/1725 upper cells (11.1%) are ticked, and 21 cells (19
A2B-mapped, all Bridgewater/Fitchburg) have more upper ticks than lower misses. The CA figures cannot speak
to a 'hard ceiling': the nine cs templates encode upper-division work as 153 placeholder receivers with no
course ids and ASSIST's CS agreements list no upper-division UC receivers, so CA's 0% is by construction.
Lower-division-only, CA cs (68.2, 1035 cells, verified templates) exceeds MA (57.5 raw / 57.3 served) at the
cell level but not at the institution level (t 1.3; Fitchburg 92.8 exceeds every UC); counting MA's upper
ticks as credit narrows the gap to 68.2 vs 66.4."
