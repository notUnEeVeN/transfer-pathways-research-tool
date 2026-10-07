# verify-1-reproduction — arithmetic check of claim F2 (ceiling-normalised Fig 1 reorders the states)

Reviewer stance: adversarial, arithmetic only. Every number below was recomputed by me from
the named artefact (scripts in this directory: `pull.js`, `ca_repro.py`, `ma_va_repro.py`;
outputs `ca_out.txt`, `ma_va_out.txt`). "VERIFIED" = I reproduced it; "INFERRED" = reasoning.

Note: the originating report path named in the task
(`dossier-coverage-heatmap (MA Fig 1, ...)/report.md`) does not exist; the Fig 1 dossier lives in
`scratchpad/dossier-fig1/` and has NO report.md, only scripts + outputs (`dist.py/dist_out.txt`,
`ma.py/ma_out.txt`, `va.py/va_out.txt`). I audited those.

## Claim under test
"Ceiling-normalisation reorders the states: VA 99.5% of its structural ceiling (catalog), CA cs
68.2%, MA 66.4% (57.5% on lower-division columns alone), so MA, not CA, articulates the smallest
share of what its CCs could teach."

## 1. California (our computation, DB `coverageData(... requirements:'degree')`, degree lens, GE excluded, course counts, verified cohort)

Independent re-pull from Atlas (not the dossier's JSON). Cell counts: cs 1035 (9 UC × 115 CC),
bio 1035, econ 1035; `degree_template_verified` = 1035/1035 for all three (so verifiedOnly is moot).

| major | GE-excl coverage | ceiling = Σld_total/Σtotal | mean-of-ratios (cov/ld_total) | lower-only (ld_cov/ld_total) | pooled Σcov/Σld | ratio-of-means | cells >100 |
|---|---|---|---|---|---|---|---|
| cs | 31.92 | 47.17 | **68.19** | 68.19 | 68.61 | 67.68 | 0 |
| bio | 51.18 | 59.15 | **86.75** | 86.75 | 87.24 | 86.54 | 0 |
| econ | 23.73 | 31.08 | **76.62** | 76.62 | 75.40 | 76.36 | 0 |

- VERIFIED: 68.2 / 86.7 / 76.6 and the 47.2 ceiling reproduce (86.75 prints as 86.7 or 86.8 depending on rounding — within rounding).
- VERIFIED: `degree_requirements_by_course_type` totals equal `named_requirement_courses_total` in 1035/1035 rows for each major; served `pct_named_requirement_courses` matches my recomputation in every cell.
- VERIFIED: upper-division covered observations = 0 in all 3 CA majors (0 of 9231 / 16664 / 4322 covered), so ceiling-normalised ≡ lower-division-only coverage in CA, exactly as the claim's caveat says.
- Per-university cs ratio: Irvine 46.5 … Riverside 87.5 (n=9, sd 12.9).

## 2. Massachusetts (final-repo vintage `final/Four Year Heatmap.xlsx`, ma-cs, 165 cells = 11 univ × 15 CC, GE excluded, course counts, unverified templates)

I reproduced directly from the final workbook (not from `raw/heatmap.json`), solving each tab's
lower/upper boundary against the tab's own `Lower` column the same way `convert_recovered.py` does.
Boundaries: Bridgewater 11/22, Fitchburg 12/23, Framingham 9/20, MCLA 13/25, Salem 17/24, Amherst
14/22, Boston 10/21, Dartmouth 16/31, Lowell 22/31, Westfield 13/26, Worcester 18/25.

| quantity | final workbook (mine) | raw/heatmap.json (mine) | dossier ma_out | served DB rows (mine) |
|---|---|---|---|---|
| all-level coverage (Fig 1) | 38.27 | 38.27 | 38.3 | 38.21 |
| ceiling mean (lower/all cols) | 56.89 | 56.89 | 56.9 | 56.89 |
| mean-of-ratios cov/lower-cols | **66.35** | 66.35 | 66.4 | 66.24 |
| same, capped at 100/cell | 62.68 | — | — | 62.56 |
| lower-only coverage (paper's own `Lower` column) | **57.46** | 57.46 | 57.5 | 57.34 |
| pooled Σcov/Σlower-cols | 68.04 | — | — | 67.91 |
| ratio-of-means | 67.26 | — | — | 67.16 |
| median ratio / median lower-only | 60.0 / 56.2 | — | 60.0 | 60.0 |
| cells with ratio >100 | 21 | 21 | 21 | 21 |

- VERIFIED: 66.4 and 57.5 reproduce from the final workbook (66.35 → 66.4 on half-up rounding; the dossier's Python printed 66.4). Ceiling 56.9 reproduces. 165 cells.
- VERIFIED: `raw/heatmap.json` is byte-equivalent to the final workbook on all 165 cells (0 differing cells on cov/n/nl/covl).
- VERIFIED: the "57.5 lower-only" figure is exactly the mean of the paper's OWN `Lower` column in the workbook (57.46) — i.e. it is the authors' number, not a reclassification.
- The served DB rows differ in one cell (UMass Dartmouth × Cape Cod: served 35.5, workbook/PDF 45.2/45), which moves the DB-side ratio to 66.24 — immaterial to the claim.
- VERIFIED: 192 of 1579 covered observations (12.2%) are UPPER-division columns (Fitchburg "Upper Level Elective (3000)" articulated at 15 CCs etc.). Those sit in the numerator of 66.4 with no counterpart in the denominator, which is why 21 cells and the whole of Fitchburg (134.4) exceed the "ceiling". CA has 0 such observations. So the 66.4-vs-68.2 comparison is NOT like-for-like; the like-for-like comparison is lower-only 57.5 vs 68.2.

## 3. Virginia (frozen `vaCoverageRows.js`, built 2026-09-06, va-cs, 240 cells = 15 univ × 16 CS colleges, catalog supply, `method_status: estimated`)

| variant | lens | mean-of-ratios | ratio-of-means | min |
|---|---|---|---|---|
| catalog | units, GE incl (`pct_named_requirement_courses_with_ge`/`va_ceiling_pct`) | **99.54** | 99.54 | 90.7 |
| catalog | units, no GE | 99.43 | 99.43 | 88.7 |
| catalog | course estimate | 99.36 | 99.36 | 87.4 |
| scheduled | units, GE incl | 90.56 | 90.58 | 55.0 |

- VERIFIED: 99.5 reproduces (240 cells), and it is lens-insensitive (99.4–99.5) so the choice of GE-included units for VA vs GE-excluded counts for CA/MA does not drive the VA number.
- VERIFIED from `buildVaCoverageCells.js` lines 396–413, 492: `covered = ceilingPre − missing`, `ceiling = ceilingPre/denominator`, so the VA ratio is BY CONSTRUCTION 1 − missing/ceilingPre; recomputing from the raw `va_supplied/assumed/missing_units` fields gives the same 99.54 (pooled 99.53). The VA "ceiling" is the guide's stated pre-transfer maximum, not a lower-division share of named requirements; the ratio measures catalog supply of guide courses, not articulation. That is a construct difference, not an arithmetic error, and the claim does say "(catalog)".

## 4. Does the ordering survive?

Raw GE-excluded Fig 1 order: MA 38.2 > CA cs 31.9 (CA lowest). After normalisation, MA is below
CA cs under EVERY aggregation I tried:

| aggregation | CA cs | MA | gap |
|---|---|---|---|
| mean-of-ratios (claim's headline) | 68.2 | 66.4 | 1.8 |
| ratio-of-means | 67.7 | 67.3 | 0.4 |
| pooled | 68.6 | 68.0 | 0.6 |
| capped at 100/cell | 68.2 | 62.7 | 5.5 |
| median | 68.8 | 60.0 | 8.8 |
| lower-division-only (like-for-like) | 68.2 | 57.5 | 10.7 |
| pooled lower-only | 68.6 | 59.8 | 8.8 |

INFERRED: the headline soft-ceiling gap (1.8 pts) is fragile — it collapses to 0.4–0.6 under pooled
or ratio-of-means aggregation, and the MA per-university sd is 28.3 (n=11, SE ≈ 8.5) vs CA 12.9
(n=9). The reordering is decisive ONLY in the like-for-like lower-division form (57.5 vs 68.2), which
the claim carries in parentheses. VA sits at 99.5 under all lenses. Cross-major (CA bio 86.7, econ
76.6) numbers also reproduce; both exceed MA under every aggregation.

## Verdict
NOT refuted on arithmetic grounds. All seven quoted numbers (99.5, 68.2, 66.4, 57.5, 47.2, 56.9,
50.4 and the bio/econ 86.7/76.6) reproduce within rounding from the named artefacts; cell counts
(1035 / 165 / 240) are correct; the stated ordering holds under every aggregation. The claim should
be tightened: lead with the like-for-like lower-division figure (MA 57.5 vs CA cs 68.2), present
66.4 only as the soft-ceiling variant that counts 192 upper-division articulations against a
lower-division denominator (21 cells >100%, Fitchburg 134%), and say that VA's 99.5 is a supply
ratio of a guide-defined pre-transfer block, not an articulation ratio.
