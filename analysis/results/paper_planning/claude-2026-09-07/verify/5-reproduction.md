# 5-reproduction — F6 (MA Fig 1 A2B split)

Verdict: **NOT REFUTED** (arithmetic reproduced exactly). Full working: `scratchpad/verify-5-reproduction/report.md`, script `repro.py`, outputs `repro_out.txt`, `pooled_out.txt`.

Source read directly: final-repo workbook `server/data/ma/final/Four Year Heatmap.xlsx` (11 university sheets; col B = lower-only ratio, col C = all-column ratio, col D = "MT" flag). Corpus: MA ma-cs, 165 pairs, GE excluded, course counts, upper division in denominator.

| item | claim | reproduced |
|---|---|---|
| A2B / unmapped pairs | 38 / 127 | 38 / 127 (Bridgewater 10, Fitchburg 11, Amherst 11, Dartmouth 6) |
| all-column means | 56.9 vs 32.7 | 56.91 vs 32.69 |
| lower-only means | 83.4 vs 49.7 | 83.40 vs 49.69 |
| within Bridgewater | 53.6 vs 21.8 | 53.64 (n=10) vs 21.82 (n=5) |
| dead columns | 101/270, 20 lower | 101/270, 20 lower (same headers) |
| Lowell | 61.7%, no A2B | 61.72%, 0 MT flags |

Cross-checks: heatmap.json = workbook in 165/165 cells (matrix, MT flag, lower boundary). PDF text confirms "38 of 165 (23%) ... four of the Four Years" and "four Community Colleges for which no pathway was included" (Bunker Hill, Holyoke, Mount Wachusett, Roxbury — reproduced). Column-pooled sensitivity: 56.4 vs 34.1 (lower 82.3 vs 53.7). CC-confound check: the 4 never-A2B CCs score only 3.5 pts lower than other CCs at the 7 non-A2B universities (29.8 vs 33.3), so the 32-pt within-Bridgewater gap is not a weak-CC artefact.

Surviving caveats (interpretive, not arithmetic): MT flag is the authors' annotation, not re-checked against the live A2B database; "mechanism" is an association reading; 81 of the 101 dead columns are upper-division placeholders kept in the denominator by design.
