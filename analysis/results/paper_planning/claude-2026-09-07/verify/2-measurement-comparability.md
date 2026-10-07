# verify-2-measurement-comparability — claim F3 (Fig 1, VA vs MA on scheduled supply)

Reviewer stance: adversarial, measurement grounds only. Read-only on the repo. Scratch: `recompute.py`,
`ma_compare.out` beside this file. Originating report: `scratchpad/dive-va-mechanism/report.md` (the
named "dossier-coverage-heatmap" directory does not exist; `dossier-fig1/` holds the `va_out.txt` /
`ma_out.txt` / `ma_cells.json` evidence the claim cites, but has no report.md).

## The claim

"Virginia is 'best' only while supply is read from catalogues: on scheduled supply its paper-lens mean
(37.8%, 240 cells) falls below Massachusetts's 38.3%, 133 of 240 cells miss at least one named course
(vs 18 in catalog), and the per-college floor drops from 49.4 to 34.0 (Southwest Virginia)."

## 1. Do the numbers reproduce? Yes (VERIFIED, our computation)

All from the frozen `frontend/src/analyses/vaCoverageRows.js` (built 2026-09-06 from
`.va-guides/guides.json` + `.va-courses/catalog/*.json` captured 2026-08-31 from courses.vccs.edu),
corpus va-cs, 15 university guides x 16 CS-offering VCCS colleges = 240 cells, degree type local_as,
no verified-cohort toggle:

| quantity | catalog | scheduled |
|---|---|---|
| `pct_named_requirement_courses` ("paper" lens, GE-excluded course ESTIMATE) mean | 42.26 (sd 3.35) | **37.81** (sd 6.50) |
| its ceiling (`va_ceiling_courses_pct`) mean | 42.53 | 42.53 |
| `pct_named_requirement_courses_with_ge` (units, GE incl.) mean | 50.16 | 45.64 |
| cells with >= 1 `va_missing` row | **18** | **133** |
| per-college floor, units GE-incl lens | **49.4** Southwest Virginia | **34.0** Southwest Virginia |
| per-college floor, paper lens | 41.4 Paul D. Camp | 26.8 Southwest Virginia |

MA: our recompute of `server/data/ma/raw/heatmap.json` (deterministic conversion of the older repo's
`Mass Heatmap.xlsx`, 164/165 cells match the final PDF) gives 165 cells mean **38.27** (sd 19.60). The
final PDF states 38.2 and the engine-served ma-cs value pinned in `server/data/figure-baseline.json` is
38.205. So the claim's "38.3" is the OLDER-REPO-derived recompute rounded, not the final-PDF number;
the vintage should be named (the 0.1 discrepancy is a fifth of the claimed VA-MA gap).

## 2. Are the compared quantities defined the same way? No — on six axes

### 2.1 Supply basis (the decisive one)
MA Fig 1's numerator is articulation existence — a named BS requirement column gets a 1 when the CC has
an equivalent course per the MassTransfer equivalency database / university sites (final PDF, orchestrator
scouting). That is a CATALOG-basis measure; MA has no scheduling dimension at all. The claim compares VA's
SCHEDULED figure to MA's CATALOG figure. The like-for-like VA figure is the catalog one (42.3 vs 38.2,
VA ahead). The headline therefore rests exactly on the asymmetry its own caveat disclaims.

What "scheduled" means (VERIFIED in `server/scripts/captureVccsCourseCatalogs.js` line 23/182): a course
is `scheduled:false` when courses.vccs.edu marks it `class="notScheduled"` ("in the catalogue but not
currently offered") at capture time 2026-08-31. It is a single point-in-time "currently offered" flag,
not "offered within a two-year enrolment window". Sequence courses that run once a year or alternate
years (CSC 222 / 223 / 205 are exactly those) are undercounted by construction. The five collapsing
colleges schedule 14-28% of their whole catalog vs 65-80% at the metro three (dive-va-mechanism, VERIFIED
there), consistent with a snapshot effect on small colleges rather than a permanent absence.

### 2.2 Numerator mechanism
MA: "does an EQUIVALENT course exist at the CC" (articulation). VA: "does the college's course-code set
contain the guide's code(s)" (supply); articulation is assumed via VCCS common course numbering and the
university-authored guide. The claim treats a VA course that is listed-but-not-scheduled as equivalent to
an MA course that does not articulate. Those are different failure layers (the originating report itself
says the bottleneck "moved" layers) — a fact the flat mean comparison erases.

### 2.3 Ceiling / upper division
Both keep upper division in the denominator, but MA's upper-division columns CAN be covered (Fitchburg
"Upper Level Elective (3000)" articulated at 15 CCs; 25 of 165 MA cells sit at or above their
lower-division ceiling, max 82.6%) while VA's post-transfer half is never covered by construction.
Structural ceilings (VERIFIED): VA paper lens mean 42.53; MA (lower-division columns / all columns) mean
56.89 (45.0-72.0). Ceiling-normalised: VA scheduled 88.9% of ceiling (catalog 99.4%) vs MA 66.4%.
Forcing MA's upper-division articulation to zero (VA-like structure: lower x nl/n) drops MA to 33.3 —
BELOW VA scheduled 37.8. The direction of the "flip" is therefore a choice of ceiling treatment, not a
finding.

### 2.4 Units vs counts
VA's "paper" lens is not a course count. `course_count_method: 'estimated_from_credits'`: credits divided
by the guide's own mean single-course size (3.02-3.31), held to the stated halves, rounded
(`buildVaCoverageCells.js` ~lines 152-160, 395-425). The script's own comment on `coverage_paper`: "This
is not literal Massachusetts paper equivalence." MA is a binary COUNTIF over requirement columns that
include prerequisites and duplicates (MCLA lists Programming in Java II twice; Bridgewater's named columns
sum to 151 credits against a 123-credit degree). One MA "course" and one VA "course" are different objects.

### 2.5 GE handling
MA excludes GE by design. VA's paper lens subtracts only the `assumed` open-category bucket; enumerated GE
rows stay in the named population (build script comment; VERIFIED: in scheduled mode 19 of the 372 missing
rows are ENG/SDV/PHY rows, and GMU carries ge=0 with all GE enumerated). Close, not identical.

### 2.6 Lens mixing inside the claim itself
The mean comparison uses the GE-EXCLUDED course-estimate lens (37.8), but "the per-college floor drops
from 49.4 to 34.0" is the GE-INCLUDED unit lens. On the lens used for the mean the floor goes 41.4 -> 26.8
(Paul D. Camp -> Southwest Virginia). And MA's per-college floor on that same lens is 27.7 (Mount
Wachusett), i.e. VA-scheduled floor (26.8) ~ MA floor (27.7). The 34.0 has no MA counterpart at all: MA has
no per-CC GE-inclusive figure (the site's 63.7% GE-included MA value is a 100%-by-assumption GE block).

## 3. Cohort, vintage, and significance

- Cohort: VA = 16 of 23 colleges (those with a CS associate) x 15 universities (one guide each; BA guides
  at VCU/W&M by tie-break). MA = all 15 CCs x 11 universities. VA scheduled on all 23 colleges is 35.4 —
  the cohort choice moves VA by 2.4 points, five times the claimed VA-MA gap (0.45).
- Significance (our computation, iid cells): diff = -0.45 pp, SE = 1.58, z = -0.29. On university means
  (VA n=15 sd 3.4; MA n=11 sd 17.1): t = -0.08. Dispersions differ threefold (VA sd 6.5 vs MA 19.6). "Falls
  below" is not an ordering any reviewer would accept.
- "133 of 240 cells miss at least one named course": true, but presented without the MA counterpart —
  165 of 165 MA pairs miss named courses (no MA cell reaches 100%; max 82.6). On this statistic VA
  remains far ahead even in scheduled mode.
- Lower-division like-for-like (closest thing to apples-to-apples): MA lower-division articulation 57.5%
  (our recompute) vs VA scheduled lower-division supply 88.1% (named rows only) / 90.6% (incl. assumed).
  VA ahead by ~30 points on scheduled supply.

## 4. What survives

Scheduled supply does dissolve VA's catalog-mode near-perfection (18 -> 133 cells with a gap, 11 -> 39
distinct missing requirements, mean missing 0.3 -> 5.9 credits per cell, paper-lens floor 41.4 -> 26.8,
unit floor 49.4 -> 34.0, all Southwest Virginia) and concentrates it in five small colleges — that is a
genuine within-VA finding. But "falls below Massachusetts" does not survive: it compares a one-term
scheduled snapshot to a catalog-basis articulation measure, a credit-derived course estimate to a binary
column count, a 42.5 ceiling to a 56.9 ceiling, and reads a 0.45-point, z ~ 0.3 difference as an ordering.
Ceiling-normalised (88.9 vs 66.4), lower-division (88-91 vs 57.5), and per-cell-gap (133/240 vs 165/165)
readings all keep VA ahead.

## Verdict

REFUTED as stated (measurement grounds). Numbers reproduced: yes. Confidence 0.9.
