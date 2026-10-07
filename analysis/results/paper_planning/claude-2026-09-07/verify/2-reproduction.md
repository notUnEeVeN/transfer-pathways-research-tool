# verify-2-reproduction — arithmetic check of claim F3 (VA scheduled vs catalog vs MA, Fig 1)

Reviewer stance: adversarial, arithmetic grounds only. Repository read-only; all scratch under
`scratchpad/verify-2-reproduction/` (`repro.py` is the reproduction script).

## Claim under test
"Virginia is 'best' only while supply is read from catalogues: on scheduled supply its paper-lens
mean (37.8%, 240 cells) falls below Massachusetts's 38.3%, 133 of 240 cells miss at least one
named course (vs 18 in catalog), and the per-college floor drops from 49.4 to 34.0 (Southwest
Virginia)."

Note: the originating report path given to me does not exist; `scratchpad/dossier-fig1/` holds
`va.py`, `va_out.txt`, `ma.py`, `ma_out.txt`, `ma_units_out.txt`, `dist_out.txt` and the pulled
`coverage_*.json` but NO `report.md`. The numbers were traced to those outputs instead.

## Sources and vintages used
- VA: `internal_tool/frontend/src/analyses/vaCoverageRows.js` (frozen, `built_at` 2026-09-06T23:20Z),
  variants `catalog` / `scheduled` (16 CS colleges × 15 guides), OUR COMPUTATION. `scheduled`
  = courses NOT carrying the `notScheduled` class on courses.vccs.edu at capture
  (`server/scripts/captureVccsCourseCatalogs.js` line 182; `.va-courses/index.json` `updated_at`
  2026-08-31). The academic term of that flag is not recorded anywhere I could find.
- MA: (a) served DB ma-cs coverage rows pulled by the dossier (`dossier-fig1/coverage_ma-cs.json`,
  165 rows, OUR COMPUTATION); (b) `server/data/ma/raw/heatmap.json` (deterministic conversion of
  the workbooks, OUR COMPUTATION); (c) final PDF text 38.2% (brief, orchestrator scouting);
  (d) dossier `dist_out.txt` line 180 "PDF printed cells mean 38.3".

## Reproduction (VERIFIED — all from repro.py)

| quantity in claim | claim | my value | corpus / lens | verdict |
|---|---|---|---|---|
| VA scheduled "paper-lens" mean | 37.8% (240 cells) | 37.813 (n=240, sd_pop 6.500) | VA cs, 16 CS colleges, scheduled, `pct_named_requirement_courses` = credit-derived course estimate, GE excluded | reproduces |
| VA catalog same lens | (implied) | 42.256 (n=240, sd 3.35) | catalog | reproduces brief's 42.3 |
| cells missing ≥1 named requirement, scheduled | 133 | 133 (cells with non-empty `va_missing`; identical to cells with `va_missing_units>0`) | scheduled | reproduces |
| same, catalog | 18 | 18 | catalog | reproduces |
| distinct missing requirements | (39 / 11 in evidence) | 39 / 11; all entries are course codes or code slots (e.g. "CSC 223", "CSC 208 or MTH 288", "CSC 205 + CSC 215"); no category placeholders | | reproduces; "named course" wording is fair |
| per-college floor catalog | 49.4 | 49.43 Southwest Virginia (next: Paul D. Camp 49.49) | **GE-inclusive UNIT lens** `pct_named_requirement_courses_with_ge` | reproduces, wrong lens (see below) |
| per-college floor scheduled | 34.0 (SWVA) | 33.95 Southwest Virginia | same GE-inclusive unit lens | reproduces, wrong lens |
| cells at ceiling | 107 sched / 222 cat | 107 / 222 | paper lens | reproduces |
| missing units per cell | mean 5.9 max 29 | 5.904 / 29 (catalog 0.29 / 6) | scheduled | reproduces |
| GE-incl unit mean scheduled | 45.6 sd 6.0 | 45.639 sd 6.011 | | reproduces |
| cell counts | 240 | 15 schools × 16 colleges = 240; cell set identical between catalog and scheduled | | checks |

MA reference:
| vintage | mean (165 pairs, GE excluded, course counts) |
|---|---|
| served DB ma-cs (`coverage_ma-cs.json`) | 38.2055 → 38.2 |
| raw `heatmap.json` | 38.2671 → 38.3 |
| final PDF text | 38.2 |
| PDF-printed integer cells (dossier) | 38.3 |
Raw and served differ in exactly one cell (UMass Dartmouth × Cape Cod: raw 45.2, served 35.5,
PDF prints 45 — dossier `ma_units_out.txt`). So "38.3" is the raw-heatmap / PDF-printed vintage;
the served figure and the PDF's own stated mean are 38.2. Rounding-level, but the claim does not
label the vintage.

## Where the claim fails as stated

### 1. The sentence mixes two scales (material)
"37.8%" and "38.3%" are GE-excluded course-count coverage. "49.4 → 34.0" is the GE-inclusive
unit-coverage lens (`pct_named_requirement_courses_with_ge`), whose VA mean is 50.2 / 45.6 and
whose MA counterpart is 63.7. On the sentence's own paper lens the Southwest Virginia floor is
**41.4 → 26.8** (catalog per-college min 41.42, scheduled 26.79). A reader will inevitably set
"34.0" beside "38.3" and conclude SWVA sits just under the MA mean; on a common scale it is 11.4
points under it (26.8 vs 38.2) — or, on the GE-inclusive scale, 34.0 vs 63.7. Either way the
number as juxtaposed is on the wrong axis.

### 2. "Falls below Massachusetts" is inside the measurement's own slop (material)
- Margin: 0.39 pp (vs served/PDF 38.2) to 0.45 pp (vs raw 38.3).
- The VA "paper lens" is not a count. `course_count_method: 'estimated_from_credits'` and
  `method_status: 'estimated'` on all 240 cells; `buildVaCoverageCells.js` lines 127–140 and
  384–392 round each row's credits to whole course slots (min 1), converts un-itemised remainders
  at the guide's own credits-per-course, and rescales overstated post-transfer halves. The audit
  (`docs/virginia-final-audit.md` "Whole numbers are still estimates") says the same.
- That estimate sits systematically BELOW VA's own unit lens: catalog 42.26 vs 44.40 (−2.15 pp,
  194 of 240 cells lower), scheduled 37.81 vs 39.38 (−1.57 pp, 175 of 240 lower). The claimed
  VA–MA gap (0.4 pp) is a quarter of that offset.
- Lens table (VERIFIED): VA units-no-GE 39.38 is ABOVE MA count 38.2 by 1.2; VA course-estimate
  37.81 is BELOW by 0.4; VA units 39.38 is BELOW the dossier's unit-weighted MA (40.0, 82%
  credit join with 4-credit fallback) by 0.6. The sign of "VA vs MA" flips with the lens choice,
  so the ordering is not a finding; it is a rounding coincidence of one particular estimator.

### 3. Vintage labelling (minor)
"38.3%" is the raw-heatmap / PDF-printed-cell vintage; served DB and the final PDF's stated mean
are 38.2%. Should be labelled.

### 4. Snapshot term (caveat confirmed)
`scheduled` derives from a single courses.vccs.edu capture on 2026-08-31 (`notScheduled` CSS
class). No term is recorded. CA/MA carry no scheduling dimension, so the scheduled/catalog
contrast is VA-internal only — the claim's caveat is right and should be kept.

## What survives
- "On scheduled supply VA's coverage drops: 133 of 240 cells (16 CS colleges × 15 guides) miss at
  least one named course versus 18 on catalog supply; the per-college floor on the GE-inclusive
  unit lens falls from 49.4 to 34.0 (Southwest Virginia) and on the GE-excluded course-estimate
  lens from 41.4 to 26.8; the pooled course-estimate mean falls from 42.3 to 37.8 (units 44.4 →
  39.4)." — VERIFIED, our computation, VA cs, scheduled snapshot 2026-08-31.
- "The scheduled VA mean lands within ~0.5 pp of the MA Fig 1 mean (38.2 served / 38.3 raw), i.e.
  VA loses its whole margin over MA, but which state is 'higher' depends on lens (course estimate
  below, units above)." — VERIFIED.
- The "VA falls below MA" ordering, as a headline, is NOT supported.

## Verdict
refuted = true (materially misleading as stated). numbers_reproduced = true. Confidence 0.8.
Every figure in the claim reproduces to the decimal, but (i) the floor pair is quoted on a
different lens from the means it is set beside, and (ii) the headline ordering rests on a
0.4-pp margin between a literal MA count and a VA credit-derived estimate whose own lens offset
is 1.6 pp and whose sign flips under the unit lens.
