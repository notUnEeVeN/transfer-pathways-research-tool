# verify-6-reproduction — arithmetic reproduction of claim F7 (MA Fig 1 "soft ceiling")

Claim under test (dossier-fig1, MA Fig 1 coverage heatmap, MA/CA):
"MA's ceiling is soft: 34 upper-numbered columns articulate somewhere (Fitchburg CSC 3700 at 15/15, five 'Upper Level Elective (3000)' columns at 6–15, Bridgewater COMP 340/350 at 10/15) and 21 of 165 cells exceed their lower-division share (Fitchburg 134% of ceiling), whereas CA's nontransferable tier is 0% in 1035/1035 cells; on lower-division-only counting CA cs (68.2) beats MA (57.5)."

Verdict: NOT refuted on arithmetic. Every number reproduces exactly from primary artefacts. Three wording caveats below (none changes a number).

## What I reproduced and from which artefact

Scripts and outputs in this directory: `xlsx_repro.py` (workbook), `tiers.py` (coverage rows), `pull.js` (fresh DB pull), `xlsx_cells.json`, `coverage_cs.json`, `coverage_ma-cs.json`.

### A. MA side — FINAL REPO workbook `server/data/ma/final/Four Year Heatmap.xlsx` (VERIFIED, independent of the dossier's `raw/heatmap.json`)
I re-read the 11 university tabs with openpyxl, took the Lower/Upper boundary from each tab's own `=COUNTIF(E2:<col>2, TRUE)/COUNTA(...)` formula in column B (Lower) vs column C (Upper/all), read the TRUE/FALSE matrix, and recomputed per cell.
- 11 universities × 15 CCs = **165 cells**; 270 columns; 115 in the workbook's Upper segment. Matches raw/heatmap.json in all 165 cells (0 differences).
- Mean all-level coverage 38.27; **mean lower-division-only 57.46 → "57.5" reproduced**.
- **Cells whose articulated count exceeds their lower-division column count: 21** (Bridgewater 8, Fitchburg 13, every other university 0). 4 further cells sit exactly at the ceiling. **"21 of 165" reproduced.**
- Fitchburg: mean all 70.1, ceiling 12/23 = 52.2%, ratio **134.4% → "134%" reproduced**. (Per-cell max within Fitchburg is 158.3%.)
- **Upper-segment columns with ≥1 TRUE: 34 → reproduced**, list identical to ma_out.txt. Specific values: Fitchburg "Algorithms and Data Structures (CSC 3700)" 15/15 ✓; five Fitchburg "Upper Level Elective (3000)" columns at 15, 13, 8, 8, 6 (range 6–15) ✓; Bridgewater COMP 340 = 10/15 and COMP 350 = 10/15 ✓.

### B. CA side — OUR COMPUTATION, live DB `coverageData(db, db, {majorSlug:'cs', requirements:'degree'})` (VERIFIED by fresh pull 2026-09-07; identical in every cell to the dossier's `coverage_cs.json`)
- 1035 rows (9 UC × 115 CC), all templates `hand_verified` (so verifiedOnly makes no difference for cs Fig 1).
- `degree_requirements_by_tier.nontransferable.covered == 0` in **1035/1035** cells (tier key present in all 1035; `nontransferable.total > 0` in all 1035) → reproduced. Cross-check via `degree_requirements_by_course_type`: cells with (covered − lower_division_covered) > 0 = **0**; cells with covered > lower_division_total = **0**.
- Lower-division-only named coverage = mean(ld_covered/ld_total) = **68.19 → "68.2" reproduced**. (Bio 86.75, econ 76.62 also 0/1035 upper coverage — the dossier's dist_out.txt is correct.)
- The dossier's offered evidence ("ceiling-normalised == lower-division-only in every major") is only an indirect, rounded check (max 100.1 vs 100.0 is rounding of `pct_named_requirement_courses`); the direct tier/course-type counts above are the proper evidence and they hold.

### C. MA side in the DB — OUR COMPUTATION, `coverageData(... 'ma-cs')` (VERIFIED, fresh pull identical to dossier JSON)
- 165 rows; cells above ceiling = **21** (same); cells with upper-division coverage > 0 = **94**; `nontransferable.covered > 0` in 94/165 (identical set).
- Lower-division-only mean = **57.34**, not 57.46. Exactly ONE cell differs from the final workbook: UMass Dartmouth × Cape Cod (DB 11/31 = 35.5 all, 11/16 = 68.8 lower; workbook 45.2 / 87.5; PDF prints 45). This is the known Cape Cod × Dartmouth disagreement recorded in `server/data/ma/PROVENANCE.md` ("disagrees the other way"), not a new defect. It shifts the Dartmouth university mean 37.0 → 36.4 and the MA lower-only mean 57.5 → 57.3. Immaterial to the comparison (68.2 vs 57.3–57.5).

### D. Is CA's 0% forced by the engine? (INFERRED from code reading, `server/services/degreeSlots.js`)
`recvCovered = transferEligible && …`, with `transferEligible = exactTier ? … : !exactSource || resolveSectionTier(...) !== 'nontransferable'`. `exactSource = usesCanonicalSourceContract(doc)` requires an `analysis_contract` block that only canonical VA documents carry, so for CA and MA `transferEligible` is always true and upper-division receivers CAN be covered if the articulation set contains them — MA's 94 cells with upper coverage go through exactly this path. So CA's 0/1035 is a property of the ASSIST-derived articulation data (ASSIST agreements articulate only lower-division UC courses), not a hard-coded zero. The `pathways.js:1118` comment "0% everywhere by construction" applies only to the separate `groupCoverage` diagnostic, not to `by_tier`/`by_course_type`.

## Caveats on wording (do not affect numbers)
1. "34 upper-**numbered** columns" — the `upper` flag is the workbook's own Lower/Upper column segment (position-based, from the COUNTIF range), not course numbering. 31 of the 34 carry 3xx/4xx/3xxx/03xx numbers; the other three do not: Worcester "Statistics I (MA 150) OR Probability and Statistics (MA 302)" (14/15 — almost certainly articulating via the lower-numbered MA 150), Salem "Math Elective (post calc II)" (13/15, no number), Framingham "Upper Level Elective" (1/15, no number). Say "workbook Upper-segment columns". None of these three sits in Bridgewater/Fitchburg, so the 21-cell count is unaffected.
2. "MA (57.5)" is the final-workbook value; the site/DB value is 57.3 (one cell, see C). Either way CA cs 68.2 > MA.
3. "CA's nontransferable tier is 0%" is empirical in the data (see D), but it is structurally guaranteed by UC/ASSIST practice; it is not evidence that CA measured upper-division articulation and found none — ASSIST simply never lists it. The MA upper coverage, by contrast, is a workbook TRUE mark whose meaning (genuine upper-division elective credit vs. convention, e.g. Bridgewater's note "Credit for two of the following based on transcript review" beside COMP 340/350) is the open question the dossier already flags.

## Corpora / vintages, for the record
- MA numbers: final repo workbook `Four Year Heatmap.xlsx`, ma-cs, 11 universities × 15 CCs, course counts, GE excluded, unverified cohort (only cohort that exists). DB (ours) differs in 1 cell.
- CA numbers: our computation, live DB, major cs, degree lens, course counts, GE excluded, 9 UC × 115 CC = 1035, all hand_verified.
