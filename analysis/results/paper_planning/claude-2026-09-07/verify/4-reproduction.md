# verify-4-reproduction — claim F5 (Fig 1, MA/CA/VA per-university vs per-college SD)

Claim under test: "Massachusetts's dispersion is institutional, not geographic: per-university SD 17.1
(Framingham 11.7 → Fitchburg 70.1) against per-college SD 5.3 (27.7–47.2), whereas CA cs is 7.9/5.7 and
VA catalog 0.9–3.2/0.4."

Verdict: **NOT refuted on arithmetic grounds.** Every number reproduces to the stated precision from
independent recomputation, across all available artefact vintages, with the cell counts the brief pins
(MA 165, CA cs 1035, VA catalog 240). The only unstated conventions are (a) the SDs are POPULATION SDs of
the marginal means and (b) "VA catalog" per-university SD depends on measure (0.9 units_ge / 2.4 units /
3.2 paper) — the claim's caveat already says this.

Scripts and outputs (all under this directory):
- `repro.py` → `repro_out.txt` (MA raw JSON, MA final PDF display, CA cs cache, VA frozen rows)
- `repro_xlsx.py` → `repro_xlsx_out.txt` (MA final-repo workbook, recomputed from the boolean cells)
- `fresh_cs.js` → `fresh_cs_out.txt` (live DB `coverageData` pull for `cs` and `ma-cs`, 2026-09-07)

## 1. Massachusetts (VERIFIED, four vintages)

Measure: per CC×university cell = articulated named columns ÷ all named columns (GE excluded, course
counts, upper division in the denominator — the paper's Fig 1 definition). 11 universities × 15 CCs = 165
cells in every vintage.

| vintage | cells | cell mean | per-univ pSD (sSD) | per-univ min→max | per-college pSD (sSD) | per-college min→max |
|---|---|---|---|---|---|---|
| older repo `raw/heatmap.json` (dossier's source) | 165 | 38.27 | **17.12** (17.95) | Framingham 11.7 → Fitchburg 70.1 | **5.34** (5.53) | Mt Wachusett 27.7 → Quinsigamond 47.2 |
| final repo `Four Year Heatmap.xlsx`, recomputed from TRUE/FALSE cells | 165 (after dropping `Total`/`Source` footer rows) | 38.27 | 17.12 | 11.7 → 70.1 | 5.34 | 27.7 → 47.2 |
| final PDF printed whole-percent cells (`pdf-figures.json`) | 165 (sum 6323) | 38.32 | 17.14 | 11.7 → 70.3 | 5.34 | 27.8 → 47.3 |
| live DB `ma-cs` corpus (`coverageData`, degree lens) | 165 | 38.205 | 17.12 | 11.7 → 70.1 | 5.32 | 27.7 → 47.2 |

Notes:
- The raw JSON's stored `all_ratio` fields agree with my recomputation from the boolean matrix in 165/165
  cells; the final workbook's cells are byte-identical to the raw JSON in 165/165 cells (only the 1
  Cape Cod→Dartmouth cell differs in the PDF display, which moves Dartmouth from 37.0 to 36.9/36.4 and
  changes no SD at 1 dp).
- The final workbook's `Upper` column is actually the ALL-level ratio (e.g. Framingham/Berkshire 0.1 =
  2/20); its `Total` rows hold column counts (22, 23, 31 …), so a naive parse that keeps footer rows
  produces nonsense (my first pass hit this; corrected in `repro_xlsx.py`).
- Ratio per-univ pSD / per-college pSD for MA = 3.21.

## 2. California cs (VERIFIED, live DB and cache agree)

Measure: `pct_named_requirement_courses` from `coverageData(db, db, {majorSlug:'cs', requirements:'degree'})`
(GE excluded, course counts, degree lens). Verification cohort is NOT a filter on this figure (the row
carries `degree_template_verified` as a field only). 9 UCs × 115 CCs = 1035 rows, mean 31.915 (= baseline
`cs|figure1`).

| source | cells | mean | per-univ pSD (sSD) | min→max | per-college pSD (sSD) | min→max |
|---|---|---|---|---|---|---|
| dossier cache `coverage_cs.json` | 1035 | 31.915 | **7.92** (8.40) | UCI/UCSD 21.0 → Merced 45.9 | **5.70** (5.73) | Palo Verde 1.6 → Orange Coast 40.2 |
| fresh DB pull 2026-09-07 | 1035 | 31.915 | 7.92 | 21.0 → 45.9 | 5.70 | 1.6 → 40.2 |

Ratio univ/college = 1.39. (GE-included lens for reference: 5.15 / 4.31.)

## 3. Virginia catalog supply, 16 CS colleges (VERIFIED from the frozen module)

`frontend/src/analyses/vaCoverageRows.js`, variant `catalog`: 15 universities × 16 colleges = 240 rows.

| measure (field) | cell mean | per-univ pSD (sSD) | per-college pSD (sSD) | ratio |
|---|---|---|---|---|
| units_ge (`pct_named_requirement_courses_with_ge`) | 50.16 | **0.87** (0.90) | **0.36** (0.37) | 2.4 |
| units (`va_units_no_ge_pct`) | 44.40 | 2.44 (2.53) | 0.40 (0.41) | 6.1 |
| paper (`pct_named_requirement_courses`) | 42.26 | **3.22** (3.33) | **0.43** (0.44) | 7.5 |

So "0.9–3.2 / 0.4" reproduces (0.36–0.43 all round to 0.4).

Scheduled supply (same 240 cells), for context only — NOT part of the claim: units_ge per-univ 1.91 vs
per-college 5.33; paper 3.41 vs 5.13. The pattern inverts: in scheduled mode VA's dispersion is on the
college side (course-offering), which is why the claim's explicit "VA catalog" scoping matters.

## 4. Adversarial notes (none arithmetic-breaking)

1. **SD convention unstated.** All figures are population SDs (`statistics.pstdev`) of institution
   means. Sample SDs are 17.95/5.53 (MA), 8.40/5.73 (CA), 0.90–3.33/0.37–0.44 (VA). Same story either way.
2. **"Institutional, not geographic" is an interpretation of "university-side vs CC-side marginal SD".**
   The numbers support "MA's variance sits on the university margin" (ratio 3.2); whether the CC margin
   equals "geography" is a label, not something the arithmetic establishes. Also note VA catalog has an
   even larger univ/college ratio (2.4–7.5) — the "whereas" contrast holds on absolute magnitude (17.1 vs
   0.9–3.2), not on the ratio.
3. **Part of MA's university-side spread is denominator structure.** Lower-division share of named
   columns ranges 45% (Framingham) to 72% (Worcester), and Fitchburg's 70.1 includes 75/165 articulated
   upper-division cells (electives). The per-university SD therefore mixes articulation behaviour with
   template construction; the dossier's own ceiling-normalised numbers make this visible. Not a
   reproduction failure, but a reader should not read 17.1 as pure articulation dispersion.
4. **Averaging-cell asymmetry.** MA per-university means average 15 cells, per-college means 11; CA
   per-university means average 115 cells vs 9 per college (so CA's 5.7 is, if anything, inflated by
   less averaging); VA 16 vs 15. Does not change any conclusion.
5. Dossier directory naming: the brief points at "dossier-coverage-heatmap (…)/report.md", which does
   not exist; the working files are in `scratchpad/dossier-fig1/` (`ma_out.txt`, `dist_out.txt`,
   `va_out.txt`) and match my recomputation line for line.

Vintage/corpus labelling of the claim's numbers: MA = older-repo `raw/heatmap.json` (identical to final
repo workbook cells; final PDF display differs by ≤0.2 in the means), CA = our computation, live DB,
`cs` major, degree lens, GE excluded, course counts, all 9 UCs × 115 CCs (no verified filter applies);
VA = our frozen computation, `va-cs`, catalog supply, 16 CS colleges, `method_status: estimated`.
