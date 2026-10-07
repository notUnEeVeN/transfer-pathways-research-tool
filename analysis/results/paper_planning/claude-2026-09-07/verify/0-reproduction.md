# verify-0-reproduction — arithmetic reproduction of claim F1 (Fig 1 cross-state ordering)

Reviewer stance: adversarial, arithmetic only. Repository untouched (read-only). All scratch under this directory.
Date: 2026-09-07. Originating dossier: `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/dossier-fig1/` (the path named in the task, `dossier-coverage-heatmap (...)/report.md`, does not exist; `dossier-fig1` has no report.md either — only the scripts/outputs `pull.js`, `dist.py`/`dist_out.txt`, `ma.py`/`ma_out.txt`, `va.py`/`va_out.txt`, which I treated as the evidence).

## Claim under test
"On the paper's own lens (GE-excluded course counts, cells equal) the states order VA 42.3% (catalog, 16 colleges, estimated courses) > MA 38.3% > CA cs 31.9%, but the 10.4-pt state gap is smaller than the 27.5-pt CA cross-major gap (econ 23.7 → bio 51.2)."

## Verdict: NOT refuted. Every number reproduces to the stated precision; cell counts are correct; the subtraction is correct.

## Reproduction table (all = our computation unless stated; "cells equal" = unweighted mean of per-cell pct_named_requirement_courses)

| corpus | artefact / vintage | cells | my unweighted mean | claim | dossier evidence | pinned baseline | status |
|---|---|---|---|---|---|---|---|
| VA va-cs, catalog supply, 16 CS colleges, estimated course counts | frozen `frontend/src/analyses/vaCoverageRows.js` (built 2026-09-06T23:20Z), `catalog.rows` | 240 = 15 univ × 16 CC, 0 nulls | **42.2558** | 42.3 | va_out.txt 42.3 (n=240) | `va-cs|figure1` is null in figure-baseline.json (rows 384, unit-side); `docs/virginia-final-audit.md` table: 42.2551 | VERIFIED (0.0007 pt from the audit doc = per-cell 1-dp storage rounding; immaterial) |
| MA ma-cs, GE excluded, all named columns incl. upper division | **final repo** `server/data/ma/final/Four Year Heatmap.xlsx` booleans (recomputed from the True/False cells, excluding the Total/Source rows), and `raw/heatmap.json` | 165 = 11 × 15 | **38.2671** (xlsx and raw/heatmap.json agree on all 165 cells, 0 differing) | 38.3 | ma_out.txt 38.3 (n=165) | `ma-cs|figure1` = 38.205 (DB vintage) | VERIFIED |
| MA ma-cs, same, **live DB** (older vintage) | fresh `coverageData(ma-cs)` pull today | 165 | **38.2055** | caveat says "older DB vintage gives 38.2" | dist_out.txt 38.2 | 38.205 | VERIFIED. The whole 0.062-pt gap is ONE cell: Cape Cod × UMass Dartmouth = 14/31 = 45.16 in the final repo vs 35.5 (11/31) in the DB; (45.16−35.5)/165 = 0.059 ✓ |
| MA final PDF | `pdf-figures.json` printed cells (165 whole-percent cells) / PDF prose | 165 | printed-cell mean **38.3212**; prose says **38.2%** (p.3, "transfer 38.2% of the classes") | — | — | — | VERIFIED. The PDF prose 38.2 is the stale older-vintage number (docs/ma-paper-audit.md calls it a "strong stale-headline candidate"); the printed cells are final-repo vintage |
| CA cs, degree lens, GE excluded | fresh `coverageData(cs, requirements:'degree')` pull 2026-09-07 | 1035 = 9 UC × 115 CC, 0 nulls | **31.9149** | 31.9 | dist_out.txt 31.9 | `cs|figure1` 31.915 | VERIFIED |
| CA bio | same | 1035 | **51.1786** | 51.2 | 51.2 | 51.179 | VERIFIED |
| CA econ | same | 1035 | **23.7289** | 23.7 | 23.7 | 23.729 | VERIFIED |

Cohort note (CA): all 1035 rows in each major carry `degree_template_verified: true`, so the "verified cohort" equals the full grid. Template research status by major: cs verified_flag_true= 1035 status= ['hand_verified']
bio verified_flag_true= 1035 status= ['ai_researched_needs_human_verification']
econ verified_flag_true= 1035 status= ['ai_researched_needs_human_verification']. (bio/econ "verified" is verified-by-flag-or-notes, not `hand_verified`; this is a labelling point, not an arithmetic one.)

## Gap arithmetic
- State gap (VA − CA cs): 42.2558 − 31.9149 = **10.34** → claim's 10.4 is the difference of the rounded figures (42.3 − 31.9 = 10.4). Both round to 10.3/10.4; VERIFIED within rounding.
- CA cross-major gap (bio − econ): 51.1786 − 23.7289 = **27.45** → 27.5 (rounded figures 51.2 − 23.7 = 27.5). VERIFIED.
- 27.5 > 10.4 holds under either rounding (27.45 > 10.34). VERIFIED.
- Ordering VA 42.26 > MA 38.27 (or 38.21) > CA cs 31.91: VERIFIED for both MA vintages.

## Adversarial checks that did NOT overturn the claim
1. **Cell counts**: VA 240 (15×16), MA 165 (11×15), CA 1035 (9×115) — all exact, no nulls, no duplicate/Total rows leaking in (my first xlsx pass picked up 12 Total/Source rows → 177 cells / 35.67; excluding them restores 165 / 38.27 and matches raw/heatmap.json cell-for-cell).
2. **Weighting**: the claim says "cells equal". Course-weighted pooled ratios are: VA catalog 3672/8672 = 42.34; MA 1579/4050 = 38.99 (DB vintage; final-repo 1582/4050 = 39.06); CA cs 9231/29325 = 31.48; bio 16664/32441 = 51.37; econ 4322/18612 = 23.22. Ordering and both gaps (10.9 vs 28.2) survive pooling.
3. **Which VA variant the figure mounts**: `vaFigureData.js` defaults to `basis:'catalog'`, `allColleges:false` (16 CS colleges) — the claim's scoping matches the live default.

## Sensitivity the claim does NOT state (report as caveat, not refutation)
- **VA under scheduled supply** (same 240 cells, same course-estimate lens): unweighted **37.81** (pooled 37.87). That is BELOW MA 38.27 / 38.21. So the VA > MA ordering holds only on the catalog basis; on the scheduled basis it flips to MA > VA > CA cs (38.3 > 37.8 > 31.9), and the state gap shrinks to ~6.4 pts. The claim explicitly says "(catalog, …)", so it is correct as stated, but any prose using it should say the ordering is basis-dependent.
- **VA with all 23 colleges** (345 cells): catalog 40.96, scheduled 35.43. Ordering VA > MA still holds on catalog (40.96 > 38.27), fails on scheduled.
- VA `pct_named_requirement_courses` is `va_course_count_method: estimated_from_credits` for all 240 cells (`method_status: estimated`); `named_requirement_courses_articulated` is an estimated integer, not an observed course count — as the claim's caveat says.
- MA: "38.3" is the final-repo/printed-cell vintage; the PDF's own prose says 38.2. Whoever quotes 38.3 should cite the final repo workbook, not the PDF text.

## Files
- `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-0-reproduction/va_check.py` — VA recompute (all four variants).
- `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-0-reproduction/ma_check.py`, `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-0-reproduction/ma_xlsx.py`, `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-0-reproduction/ma_xlsx2.py` — MA raw/heatmap.json, final xlsx boolean recompute, PDF printed-cell mean, DB-vs-final cell diff.
- `/private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-0-reproduction/pull_ca.js` + `coverage_{cs,bio,econ,ma-cs}.json` — fresh DB pull (NODE_PATH=server/node_modules).
