# Dossier — Figure 2 "Transferable requirements by course type" (`course-type-coverage`)

Prepared 2026-09-07 for the cross-state analysis. READ-ONLY on the repository. Scratch scripts and dumps
live beside this file:

- `pull_coverage.js` → `coverage_rows.json` — live `coverageData()` rows for cs / bio / econ / ma-cs / va-cs (DB recipe from the brief, `pin:'settings'`, `groupBy:'college'`, `requirements:'degree'`).
- `analyze_ca.py` → `ca_ma_results.json` — per-campus / per-college / per-cell distributions from the served `degree_requirements_by_course_type`.
- `ma_raw_fig2.py` → `ma_raw_results.json` — NAMED per-university Figure 2 from `server/data/ma/raw/heatmap.json` (the final-repo `Four Year Heatmap.xlsx` vintage per PROVENANCE.md) using the paper's course-code rule + the site's text rules for `SLOT` placeholders, plus the A2B ("MT") split.
- `va_fig2.js` → `va_cells.json`, `analyze_va.py` → `va_results.json` — a VA course-type column built from the 15 CS transfer guides × 16 CS-offering VCCS colleges using the exported `classify()` of `server/scripts/va/buildVaCoverageCells.js`, on catalog and scheduled supply.
- `nonstem.js` — what the CA CS "Non-STEM" requirements actually are.

Vintage vocabulary: **final PDF** = `2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf`; **final repo** = `CIC-CC-Paper` workbooks (`server/data/ma/final/`, converted into `raw/`); **older repo** = `transferpaper` (`recovered/`, and the `ma-figure2-archive-direct.json` artifact, commit f0be157); **our computation** = anything produced by this session or served by the site.

---

## 1. What the figure measures, per corpus

### 1a. The shared engine (CA cs / bio / econ, and the site's ma-cs reconstruction)

Read from `frontend/src/analyses/CourseTypeCoverage.jsx`, `registry.js` (id `course-type-coverage`), `server/services/analysis/pathways.js` (~L1085, L1255–1270), `server/services/degreeSlots.js` (L500–525, 690–730, 828), `server/config/majors.js`, `server/services/courseTypes*.js`.

| aspect | value |
|---|---|
| Unit of the numerator/denominator | **Course-count observations**, not units. `degree_requirements_by_course_type[category] = {total, covered, lower_division_total, lower_division_covered}`. Series are expanded course by course; choose-N groups priced at N. One PRIMARY category per observation, so columns partition the population. |
| GE | **Excluded** for every corpus that carries the figure: `courseTypes.excludeGeGroups: true` on cs, bio, econ, ma-cs. GE-titled groups (`namedGeTitled`) and padding groups (`namedPadding`, unrestricted electives) drop out of the typed population. The typed totals re-sum to Figure 1's GE-excluded named population (`docs/figures/ma-course-type-spread.md`). There is **no GE-inclusive lens for Figure 2** in the code — GE-inclusion exists only on Figure 1's `_with_ge` fields. |
| Scope knob | `whole-degree` (default; upper-division and residency work retained in the denominator, never coverable) vs `lower-division` (only `lower_division_*`). The MA pane is frozen to whole-degree. |
| Point | one per university campus per type = mean over community colleges of (covered ÷ total) for that campus's requirements of that type. Column mean = campus-equal mean over campuses that require ≥1 course of the type (a campus requiring nothing contributes no point — this is why n varies by column). |
| Typing rule | four-year course-code prefix of the FIRST receiver course; discrete math forced to math (the paper's single exception); free-text requirements go through an ordered regex list (`TEXT_RULES`); the bio and econ modules re-map prefixes to fine categories, then `courseTypes.axes.faithful` rolls them into four SEMANTIC ROLES (own discipline / quantitative / supporting discipline / non-STEM) — the comparison contract keys by role, not by label. |
| Cohort (CA) | 9 curated UC `kind:'degree'` templates × 115 CCs = 1035 cells per major. **All 1035 rows in cs, bio and econ carry `degree_template_verified: true`** (verified live), so the verified toggle is moot here (it is a Figure 3 knob; Figure 2 has none). Articulation = ASSIST evaluation, same as Figure 1. `pin:'settings'` selects the pinned requirement basis (curated minimums / eligibility floor by default; only UCLA/UCSD differ per memory). |
| Cohort (ma-cs site) | 11 universities × 15 CCs = 165 cells; template = heatmap columns ⊎ unmatched resident-plan rows (`buildMaDocuments.js`), GE rows in one GE-titled group (excluded). 165/165 rows `degree_template_verified: false` (paper import). |
| Structural ceiling | lower-division share of each type's denominator. Computed below (§2d). |
| Denominator | requirement observations of the type in the campus template; NOT units, NOT the degree total. |

### 1b. MA `ma-cs` — what the site actually shows

`courseTypeViewForPane` forces `scope: 'whole-degree'`, `variant: 'faithful'`, and a source knob `ma-source`:

- `pdf` (default): `frontend/src/analyses/data/ma-figure2-final-pdf.json` — nearest-whole-point raster transcription of final-PDF Figure 2, **anonymous** dots, n = 11/11/11/5, arrays Computing [5,9,11,11,18,20,22,25,29,30,58], Math [13,40,47,52,52,53,63,65,83,97,98], Science [53,78,93,97,100×7], Non-STEM [47,67,67,100,100]; implied means 21.6 / 60.3 / 92.8 / 76.2; paper prose 22 / 60 / 93 / 76. Two dots (Computing 22, Science 93) are inferred (hidden under the mean diamonds).
- `archive-direct`: `ma-figure2-archive-direct.json` — older-repo rerun (transferpaper f0be157, `Mass Heatmap.xlsx`), also anonymous: Computing [6,9,11,11,18,20,22,25,28,29,58] (21.5), Math [13,40,47,52,52,53,63,65,83,95,97] (60.0), Science identical (92.8), Non-STEM [33,47,67,100,100] (69.4).
- The paper's own definition (final PDF, `ma-paper-audit.md` §Figure 2): same population as Figure 1 (degree + college named courses, GE excluded, upper division retained, COUNTIF/COUNTA course counts), split by four-year course code, discrete math always math.

The live `coverageData` rows for ma-cs are NOT what the pane draws, but they exist and reproduce closely (§2b).

### 1c. VA `va-cs` — there is no Figure 2

- `frontend/src/virginia/VirginiaPage.jsx` L107–115: `course-type-coverage` is **deliberately absent** ("classifying a requirement by course type has not been done for the Transfer Guides"). `VA_FIGURE_IDS = ['coverage-heatmap','transfer-credit-rate','transfer-extra-units']`.
- The frozen `vaCoverageRows.js` rows carry only aggregates (`va_units_*`, `va_missing[]`), no type rollup.
- The LIVE `coverageData(db, db, {majorSlug:'va-cs'})` returns 256 rows of the derived-agreement pathway (8 universities × 16 colleges; 128 rows `method_status:'excluded'`), whose `by_type` is not the guide corpus (computing 14.7 %, science 15.6 %, math 67.5 % whole-degree). The brief says the live VA API "models a different pathway and cannot supply" the figure; I treat those numbers as a defect note only.
- **My VA column** (our computation, this session): 15 CS guides (one program per university, same selection rule as `buildVaCoverageCells.js`) × 16 CS-offering colleges = 240 cells. Pre-transfer rows typed by VCCS prefix (CSC→computing except `CSC 208` Discrete→math; MTH→math; BIO/CHM/PHY/GOL/EGR/ENGR/ENV/GEO→science; ENG/SDV/CST/HIS/ECO/SOC/ART/MUS/PHI/PLS/PSY/PED/HLT/HUM→non-STEM). GE rows (`kind:'gened_category'` and codeless rows; 81 + 19 filler + 3 unresolved) **excluded**, to match the MA/CA population. Covered = `classify()` ≠ `'missing'` (the college teaches at least one full alternative in its catalogue / current schedule). Measured both in **units** (upper bound of the stated credit range) and in **requirement rows** (one row = one named requirement, choose-groups count once, i.e. the MA heatmap-column convention). Whole-degree scope adds the post-transfer `named` rows (free electives and summary rows such as "Required Core Courses", "Other electives to reach 120" dropped) typed by university prefix (CS/CMSC/CSCI/CPSC/SWE/CPEN/DSA→computing; MATH/MTH/APMA/STAT→math; PHYS/CHEM/BIOL/ENGR/ENGE→science; else non-STEM), all uncovered. Catalog and scheduled supply. `method_status` would be `estimated` (credit ranges at upper bound, unresolved cardinalities, source conditions not evaluated) exactly as the VA Figure 1.

---

## 2. The numbers

All means are campus-equal (mean of campus points); n = campuses contributing a point; per-institution spreads follow.

### 2a. Whole-degree scope, GE excluded (the paper's Figure 2 population)

| corpus (vintage) | own discipline | quantitative | supporting | non-STEM | cells |
|---|---|---|---|---|---|
| CA cs (our computation, live, verified templates) | **11.5** (n=9) | 78.7 (9) | 63.3 (7) | 0.0 (4) | 1035 |
| CA bio (live) | **42.7** (9) | 75.3 (9) | 88.4 (9) | 0.0 (9) | 1035 |
| CA econ (live) | **15.1** (9) | 64.5 (9) | 100.0 (2) | 0.0 (5) | 1035 |
| MA final PDF (transcription) | **21.6** (11) | 60.3 (11) | 92.8 (11) | 76.2 (5) | 165 |
| MA older repo (archive-direct) | 21.5 (11) | 60.0 (11) | 92.8 (11) | 69.4 (5) | 165 |
| MA raw heatmap, NAMED (our computation, final-repo vintage) | **22.0** (11) | 60.6 (11) | 92.8 (11) | 69.3 (5) | 165 |
| MA site reconstruction (live ma-cs rows) | 21.3 (11) | 60.6 (11) | 92.8 (11) | 60.0 (6) | 165 |
| VA guides, catalog supply, rows (our computation) | **29.3** (15) | 83.7 (15) | 94.0 (15) | 68.2 (15) | 240 |
| VA guides, catalog supply, units | 29.2 (15) | 86.0 (15) | 95.1 (15) | 64.8 (15) | 240 |
| VA guides, scheduled supply, rows | **22.7** (15) | 74.3 (15) | 91.8 (15) | 68.1 (15) | 240 |
| VA guides, scheduled supply, units | 22.5 (15) | 77.2 (15) | 92.7 (15) | 64.8 (15) | 240 |

CA baseline pins reproduce exactly (`docs/figures/ma-course-type-spread.md`: 11.5 / 78.7 / 63.3 / 0; bio 42.7 / 75.3 / 88.4 / 0; econ 15.1 / 64.5 / 100 / 0) — **VERIFIED**.

**The MA raw-heatmap rollup reproduces the final PDF's dots and names them** (VERIFIED at ±4 pts on 4 of 33 STEM dots, exact on the rest):

| type | my sorted multiset (named) | final PDF | archive-direct |
|---|---|---|---|
| Computing | [6,9,11,11,18,20,23,25,28,34,58] | [5,9,11,11,18,20,22,25,29,30,58] | [6,9,11,11,18,20,22,25,28,29,58] |
| Math | [13,40,47,52,52,53,65,69,83,95,97] | [13,40,47,52,52,53,63,65,83,97,98] | [13,40,47,52,52,53,63,65,83,95,97] |
| Science | [53,78,93,96,100,100,100,100,100,100,100] | [53,78,93,97,100×7] | same as PDF |
| Non-STEM | [33,47,67,100,100] | [47,67,67,100,100] | [33,47,67,100,100] |

Named MA computing dots (whole degree): Framingham 5.8, UMass Boston 9.0, Westfield 10.7, MCLA 10.9, Worcester 18.1, Salem 20.0, UMass Dartmouth 22.5, UMass Amherst 24.6, Bridgewater 28.0, UMass Lowell 33.8, **Fitchburg 57.9** (denominators 16/14/18/22/14/15/21/16/15/14/16 columns). Math: Framingham 13.3, MCLA 40.0 (n=1 column), Boston 46.7, Dartmouth 52.0, Lowell 52.0, Westfield 53.3, Bridgewater 65.3, Worcester 68.9, Salem 82.7, Amherst 95.0, Fitchburg 97.3. Science: Boston 53.3, Dartmouth 78.3, MCLA 93.3, Lowell 96.0, all others 100. Non-STEM: Westfield 33.3, Worcester 46.7, MCLA 66.7, Dartmouth 100, Lowell 100 (paper's 47/67/67 differ from my 33/47/67 by one Westfield-vs-archive tally; `ma-paper-audit.md` records the Westfield 5/15 vs 15/15 tally error). This identification is INFERRED from multiset match, not printed by the paper; the paper's dots remain formally anonymous.

Why 9 of 11 MA "science" columns are placeholders: the heatmap's science requirements are mostly `SLOT|Natural Science Elective` (no course code); typed science by the text rule and marked covered at nearly every CC. Only MCLA (PHYS 131), UMass Boston (Physics I/II), UMass Dartmouth (EGR) and Lowell (EECE 2650 + electives) name courses. The 93 % science column is therefore mostly "any lab science counts".

### 2b. Lower-division scope, GE excluded

| corpus | own | quant | supporting | non-STEM |
|---|---|---|---|---|
| CA cs | **45.7** (9) | 83.0 (9) | 77.9 (6) | — (0) |
| CA bio | **85.0** (9) | 79.0 (9) | 90.8 (9) | — |
| CA econ | **91.6** (9) | 67.7 (9) | 100 (2) | — |
| MA raw named (our computation) | **41.8** (11) | 67.4 (11) | 92.8 (11) | 88.6 (10) |
| MA site reconstruction | 40.9 (11) | 67.4 (11) | 92.8 (11) | 65.3 (5) |
| VA catalog, rows | **99.4** (15) | 99.0 | 99.5 | 100 |
| VA catalog, units | 99.3 | 99.2 | 99.6 | 100 |
| VA scheduled, rows | **77.3** (15) | 87.5 | 96.7 | 99.9 |
| VA scheduled, units | 76.4 | 88.6 | 96.8 | 100 |

The paper never published a lower-division Figure 2; the MA lower-division numbers are ours (`upper:false` columns in the heatmap; the site's `lower_division_*` fields agree: 40.9 vs 41.8).

### 2c. Per-institution distributions (computing / own discipline)

`campus pts` = the plotted dots; `college means` = the same cells averaged the other way (one value per CC); `cells` = all pairs.

| corpus, scope | campus pts: n / min / med / max / sd | college means: n / min / med / max / sd | cells: n / min / med / max / sd |
|---|---|---|---|---|
| CA cs whole | 9 / 7.1 / 9.4 / 19.6 / 3.8 | 115 / 0.0 / 11.8 / 21.2 / 5.2 | 1035 / 0 / 11.5 / 40.0 / 8.0 |
| CA cs lower | 9 / 18.4 / 42.1 / 72.6 / 17.7 | 115 / 0.0 / 46.7 / 78.5 / 20.1 | 1035 / 0 / 50 / 100 / 32.5 |
| CA bio whole (biology) | 9 / 22.1 / 31.3 / 87.8 / 23.5 | 115 / 18.5 / 44.5 / 48.2 / 5.5 | 1035 / 0 / 33.3 / 100 / 26.8 |
| CA bio lower | 9 / 53.0 / 87.8 / 99.1 / 13.7 | 115 / 26.7 / 88.3 / 95.0 / 10.2 | 1035 / 0 / 100 / 100 / 25.2 |
| CA econ whole (economics) | 9 / 11.1 / 14.3 / 22.2 / 3.3 | 115 / 13.7 / 15.3 / 15.3 / 0.4 | 1035 / 0 / 14.3 / 22.2 / 3.6 |
| CA econ lower | 9 / 66.7 / 100 / 100 / 13.6 | 115 / 81.5 / 92.6 / 92.6 / 3.1 | 1035 / 0 / 100 / 100 / 16.4 |
| MA raw whole | 11 / 5.8 / 20.0 / 57.9 / 14.0 | 15 / 9.7 / 22.2 / 32.1 / 6.7 | 165 / 0 / 16.7 / 75.0 / 18.7 |
| MA raw lower | 11 / 12.2 / 30.8 / 85.3 / 24.8 | 15 / 14.4 / 43.5 / 60.2 / 12.7 | 165 / 0 / 37.5 / 100 / 34.3 |
| VA catalog whole (units) | 15 / 18.3 / 29.2 / 37.5 / 5.9 | 16 / 28.3 / 29.4 / 29.4 / 0.4 | 240 / 18.3 / 30.9 / 37.5 / 6.0 |
| VA catalog lower (units) | 15 / 93.4 / 100 / 100 / 1.9 | 16 / 96.2 / 100 / 100 / 1.5 | 240 / 64.7 / 100 / 100 / 4.6 |
| VA scheduled whole (units) | 15 / 15.0 / 23.8 / 31.3 / 4.8 | 16 / 7.0 / 25.1 / 29.4 / 7.6 | 240 / 4.1 / 21.6 / 37.5 / 9.4 |
| VA scheduled lower (units) | 15 / 64.0 / 75.0 / 89.0 / **6.0** | 16 / 23.5 / 85.5 / 100 / **25.7** | 240 / 11.5 / 82.0 / 100 / 27.6 |

Other columns, campus-point spread (whole degree): CA cs math 57.7–93.9 (sd 10.4); science 0–100 (sd 41.4: UCSB and UCSC have one science course each, unarticulated → 0); MA math 13.3–97.3 (sd 23.7), science 53.3–100 (sd 13.9), non-STEM 33–100; VA catalog math 53.6 (UVA)–100 (sd 13.1), science 74.6 (VT)–100, non-STEM 27.6 (VCU)–100 (sd 25.8).

VA scheduled lower-division computing by COLLEGE (units): Southwest Virginia 23.5, Central Virginia 28, Paul D. Camp 51, Virginia Highlands 51, Wytheville 55, Blue Ridge 73, Laurel Ridge 82, Piedmont 82, Virginia Western 89, Brightpoint/Germanna/Virginia Peninsula 96, J Sargeant Reynolds / New River / Northern Virginia / Tidewater 100. Math: Southwest 54, Paul D. Camp 61, Virginia Highlands 71, Central Virginia 76, Wytheville 78, rest ≥ 94.

MA A2B ("MT" flag) split, raw heatmap, our computation: lower-division computing **80.6 % for the 38 A2B-mapped pairs vs 30.2 % for the 127 non-mapped**; math 87.6 vs 61.4; science 96.1 vs 91.9; whole-degree computing 42.6 vs 15.8.

### 2d. Structural ceilings (lower-division share of the type's denominator, campus-equal)

| corpus | computing / own | quant | supporting | non-STEM |
|---|---|---|---|---|
| CA cs | **27.4** (Berkeley 50, Irvine 35, Merced 29, UCSC 27, UCSD 25, Davis 22, Riverside/UCSB 20, UCLA 19) | 95.4 | 82.1 | 0 |
| CA bio | 50.7 | 96.3 | 97.3 | 0 |
| CA econ | 17.0 | 95.0 | 100 | 0 |
| MA (site = raw after SLOT typing) | **40.6** (Bridgewater 27 … Worcester 57) | 84.5 | 100 | 83 |
| VA guides (units) | **29.4** (GMU 18 … VCU 38) | 86.7 | 95.4 | 64.8 |

Achieved ÷ ceiling for whole-degree computing: **CA 11.5/27.4 = 42 %; MA 22.0/40.6 = 54 %; VA catalog 29.2/29.4 = 99 %; VA scheduled 22.5/29.4 = 77 %.** (VERIFIED from the same rows.) The paper's headline 22 % vs CA 11.5 % is therefore roughly half a ceiling difference (MA degrees put more of the CS major below the upper division) and half an articulation difference.

### 2e. What "Non-STEM 0 % (n=4)" is in CA

`nonstem.js`: after GE-titled and padding groups are excluded, the non-STEM observations left in the CS templates are university-side requirements — Berkeley "Ethics / social implications of technology (at Berkeley)", UCLA "Engineering Writing + Ethics — one W/EW course", UC Santa Cruz "Disciplinary Communication (CSE 115A/185E)", Davis two upper-division writing/ethics items. All `cc_articulable:false` by level, so the column is 0 by construction (ceiling 0). MA's non-STEM dots are lower-division named courses (College Writing I/II, Public Speaking, Technical Writing, Business Writing) with equivalents at most CCs. **The Non-STEM column compares different objects in the two states** and must not be read as "CA cannot transfer writing".

### 2f. The "own discipline is the lowest column" test

| corpus | whole-degree | lower-division |
|---|---|---|
| CA cs | 4/9; the 5 "violations" are degenerate 0 % columns (non-STEM university-only at Berkeley/Davis/UCLA; single unarticulated science course at UCSB/UCSC). Excluding 0-ceiling columns: 9/9. | 8/9 (UCSC science 0, n=1) |
| MA raw named | **11/11** | 9/11 (Bridgewater math 65.3 < computing 71.7; Dartmouth science 13.3 < 68.9) |
| VA catalog (units) | 14/15 (VCU non-STEM 27.6 < computing 37.5) | 10/15, but every column is 93–100 %: differences ≤ 4 pts, no bottleneck exists |
| VA scheduled (units) | 14/15 | **13/15** (CNU science 79.2 vs 81.7; GMU math 78.0 vs 81.8) |
| CA bio | 0/9 literally (non-STEM 0 at all 9); excluding 0-ceiling: biology lowest 7/9 (Davis and UCSC: math lowest) | **3/9** — math lowest at Davis (56.5), Merced (59.1), UCSD (60.0), UCSC (52.2); chem/physics lowest at Berkeley, Riverside |
| CA econ | excluding 0-ceiling: economics lowest 9/9 | **1/9** — math lowest at 8/9 (economics 91.6 vs math 67.7) |

Verdict: at whole-degree scope "own discipline lowest" is mostly the ceiling talking (own-discipline majors are upper-division-heavy: ceilings 27 / 17 / 51 %). At lower-division scope, where articulation is the question, **the own-discipline bottleneck holds for computer science in all three states (CA 8/9, MA 9/11, VA-scheduled 13/15) and does NOT hold for biology or economics, where the quantitative column is the bottleneck.** VA-catalog has no bottleneck at all.

### 2g. Mechanism — which courses fail

- **MA (raw heatmap columns, our computation, share of 15 CCs with an equivalent):** Computer Science I / II 87 %; Introduction to Computer Organization 67 %; Data Structures 42 %; Data Structures and Algorithms 36 %; Computer Organization and Architecture 17 %; Computer Architecture and Organization 3 %; CS II using Java 0 % (Fitchburg's Java pair 13 % / 0 %). Upper-division: Operating Systems 20 %, Software Engineering 1 %, Analysis of Algorithms 0 %.
- **VA scheduled supply (our computation, `classify()` = missing, cell-rows):** CSC 223 Data Structures 75 (55 + 20 as "CSC 223 Data Structures"), CSC 222 OOP 45, CSC 205 Computer Organization 32 + 16 + 14 (or 215) + 11 (+215), MTH 264 24, MTH 265 15, discrete (CSC 208 / MTH 288) 21 + 12 + 8, CSC 215 10. In catalog supply only 20 cell-rows are missing statewide (CSC 208 ×6, CSC 215 ×3, CSC 205+215 ×3, MTH 288 ×2, EGR/ENGR 121/122/125, MTH 167).
- **CA (context, not recomputed here):** `docs/notes_computing_bottleneck.md` and the brief identify CS2 / data structures / discrete / computer organisation as the not-articulated receivers on the eligibility engine; the Figure 2 rows do not carry course-level fails for CA and I did not rebuild them.

Same four courses in every state; what differs is the layer at which they fail: articulation (CA, MA) vs course offering (VA).

---

## 3. Comparability verdict

A reader can put the three CS own-discipline columns on one axis **only at lower-division scope with VA drawn on scheduled supply**, and even then with footnotes. Whole-degree columns are not like-for-like. Differences that need a footnote:

1. **Denominator object.** CA: curated UC template observations (series expanded, choose-N priced; 9 templates). MA: heatmap columns (hand-assembled by the authors; include prerequisites and duplicates; "Upper Level Elective (3000)" placeholders typed computing). VA: guide rows (a row = one named requirement or one choose-group; whole-degree side is my typing of post-transfer rows with summary rows dropped).
2. **Units vs counts.** CA and MA: course counts. VA: I report both; units are the guide's native quantity (row counts 29.3 vs units 29.2 — immaterial here, but only because VCCS courses are uniformly 3–4 credits). No corpus has a unit-weighted Figure 2 in the code: `degree_requirements_by_course_type` is count-only; CA row-level `degree_units_*` fields exist but not by type; MA has no unit lens (`unitCoverage:false`, 79.3 % credit join).
3. **GE.** Excluded everywhere (CA/MA by `excludeGeGroups`, MA heatmap never had GE columns, VA by dropping `gened_category`/codeless rows). GE-inclusion would only add a ~100 %-by-assumption non-STEM block; it is not available for Figure 2 and would not help.
4. **Structural ceiling.** Lower-division share of computing: CA 27 %, MA 41 %, VA 29 %. Whole-degree computing is bounded by it; VA-catalog sits at 99 % of its ceiling, CA at 42 %.
5. **What "covered" means.** CA: ASSIST articulation exists. MA: authors' three-source equivalency (A2B, websites, MassTransfer DB). VA: the college TEACHES the guide's course (VCCS common numbering makes articulation automatic) — an offering measure, not an articulation measure; catalog vs scheduled is a 22-point swing on the computing column at lower division (99.4 → 77.3).
6. **Cohort sizes and smoothing.** 9 × 115 (CA), 11 × 15 (MA), 15 × 16 (VA). More colleges per campus point narrows CA's vertical spread by construction (`ma-course-type-spread.md`).
7. **Where the variance lives.** CA and MA: between universities (campus sd 17.7 / 24.8 at lower division). VA: between colleges (campus sd 6.0 vs college sd 25.7). A campus-dot figure hides VA's whole story.
8. **Non-STEM column** compares CA upper-division ethics/writing (0 %, n=4) with MA lower-division writing/speech (76 %, n=5) with VA ENG 111/112 + post-transfer COLL/CL rows (65–68 %). Not comparable; show as n and grey it.
9. **Vintage.** MA default pane = final-PDF transcription with two inferred dots and anonymous identities; my named rollup is the final-repo heatmap; the site's live ma-cs rows are a third reconstruction (non-STEM n=6 vs 5). Say which.
10. **VA typing is mine** (no site rule module was run over guides); discrete rule applied (`CSC 208` → math), engineering → science as in MA.
11. **Verified cohort.** Irrelevant to Figure 2 (all CA templates verified; MA unverified by design; VA guides `estimated`).

---

## 4. What the CA cross-major reading adds

- Whole-degree own-discipline: cs 11.5 / econ 15.1 / bio 42.7 — driven by ceilings 27 / 17 / 51. Economics has the LOWEST ceiling (upper-division theory/electives dominate) yet its lower-division economics coverage is 91.6 %. So the whole-degree column ranks majors by curriculum shape, not by articulation health.
- Lower-division own-discipline: **cs 45.7 vs bio 85.0 vs econ 91.6**, while the quantitative column is 83.0 / 79.0 / 67.7. Computing is the only major whose own lower-division courses are the bottleneck; for biology and economics the bottleneck is math/statistics (econ math 36.1 at Davis, 49.2–49.6 at Irvine/UCLA; bio math 52–60 at UCSC, Davis, Merced, UCSD — the `computing` fine category rolled into "Math" for bio/econ contributes to this and should be shown separately in the extended variant).
- This **reinforces** the cross-state story: the same lower-division computing courses (CS2, data structures, computer organisation, discrete) fail in CA, MA and — on scheduled supply — VA, whereas the lab-science and intro-biology sequences articulate almost everywhere in every state. "Computing bottleneck" is a computing phenomenon, not a generic own-discipline artefact.
- It **complicates** any headline of the form "state X transfers Y % of the major": the number moves 30 points with major within one state (11.5 → 42.7 whole; 45.7 → 91.6 lower) — larger than the between-state gap (CA 45.7 vs MA 41.8 vs VA 77–99).

---

## 5. Candidate findings

Status: V = verified by reproduction this session; I = inferred; C = context.

1. **[V, cross] Lower-division computing coverage is CA 45.7 % (9 UC campuses × 115 CCs, ASSIST, verified templates), MA 41.8 % (11 × 15, final-repo heatmap, our rollup) and VA 99.4 % on catalog supply / 77.3 % on scheduled supply (15 guides × 16 CS colleges, our rollup, rows).** The catalog-vs-scheduled gap (22 pts) is bigger than the CA–MA gap (4 pts).
2. **[V, cross] Whole-degree computing (the paper's Figure 2 statistic) is bounded by a state-specific ceiling: CA 27.4 %, MA 40.6 %, VA 29.4 %; achieved/ceiling = 42 % (CA), 54 % (MA), 99 % (VA catalog), 77 % (VA scheduled).** The published CA-vs-MA contrast (11.5 vs 22) is about half curriculum shape.
3. **[V, MA] The final PDF's anonymous Figure 2 dots can be named: a course-code rollup of the final-repo heatmap reproduces the Computing multiset within 4 pts on 4 of 11 dots and exactly on 7, Science exactly except one 96/97, Math within 2–4 pts on 2 dots; Fitchburg is the 58 % outlier, Framingham (5.8) and UMass Boston (9.0) the floor.** Non-STEM reproduces the archive-direct artifact [33,47,67,100,100], not the PDF's [47,67,67,100,100].
4. **[V, MA] Inside Massachusetts, the A2B-mapped pairs (38 of 165) reach 80.6 % lower-division computing coverage versus 30.2 % for the 127 unmapped pairs (math 87.6 vs 61.4; science 96.1 vs 91.9).** Where MA has a statewide agreement it looks like VA; VA is the A2B condition applied to every pair. (I: the policy interpretation.)
5. **[V, VA — challenges "VA is simply best"] On currently scheduled supply, VA's lower-division computing coverage is 77.3 %, and the variance is between colleges (sd 25.7) rather than universities (sd 6.0): Southwest Virginia 23.5 %, Central Virginia 28 %, Paul D. Camp 51 %, Virginia Highlands 51 %, Wytheville 55 %, against 100 % at J Sargeant Reynolds, New River, Northern Virginia, Tidewater.** VA solved articulation and moved the bottleneck to course offering at small rural colleges; a student at Southwest Virginia is worse off than the CA or MA mean.
6. **[V, cross] The same courses fail in every state: data structures, CS2/OOP, computer organisation and discrete structures. MA heatmap: Data Structures 36–42 % of CCs, Computer Organization 3–67 %, CS II (Java) 0–13 %; VA scheduled missing rows: CSC 223 (75), CSC 222 (45), CSC 205 (≥ 73), MTH 264/265 (39), CSC 208/MTH 288 (41).** CA course-level list is context (`notes_computing_bottleneck.md`).
7. **[V, CA cross-major] At lower division the own-discipline column is the lowest for computer science at 8/9 UC campuses, but for biology at only 3/9 and economics at 1/9; there the quantitative column is the bottleneck (econ math 67.7 vs economics 91.6; bio math 79.0 vs biology 85.0).** "Own-discipline bottleneck" is specific to computing.
8. **[V, MA] The MA Science column (93 %) rests on placeholders: 7 of 11 universities' science requirements are `Natural Science Elective` slots with no course code, typed science by text and satisfied almost everywhere; only MCLA, UMass Boston, Dartmouth and Lowell name a physics/engineering course, and Boston (53.3) and Dartmouth (78.3) are the two low dots.**
9. **[V, CA] CA's Non-STEM column (0 %, n=4) consists entirely of upper-division ethics/writing requirements (Berkeley, UCLA, UCSC, Davis) that no CC can satisfy; MA's (76 %, n=5) are lower-division writing/speech courses.** The column is non-comparable and should be greyed or dropped.
10. **[V, VA] On catalog supply, every VA column sits at 99–100 % at lower division and the whole-degree column equals the ceiling (29.2 vs 29.4): the guide IS the pathway, so a catalog Figure 2 for VA measures degree design, not transfer friction.** This is the reason the site deliberately omits the VA pane.
11. **[V, defect] The live `coverageData` for `va-cs` returns 256 derived-agreement rows (8 universities, 128 excluded) whose by-type values (computing 14.7 %, science 15.6 % whole-degree) are unrelated to the guide corpus and must not be drawn as a VA Figure 2.**
12. **[I, cross] Ranking states by the whole-degree computing column (VA 29 > MA 22 > CA 11.5) inverts once ceilings are removed and supply is scheduled: achieved/ceiling VA 77 %, MA 54 %, CA 42 % — the ordering survives, but the gaps shrink from 2.5× to 1.8×, and the VA advantage is contingent on colleges actually running CSC 222/223/205.**

---

## 6. Preliminary contribution score: **6 / 10**

- Novelty: moderate-high. Naming the MA dots, the A2B split by type, the ceiling decomposition and the VA offering-layer result are all new; the four-course failure list being identical across three states is a genuinely portable finding.
- Defensibility: moderate. CA and MA are reproduced to the pin; VA is my own construction (typing, post-transfer handling) with `estimated` provenance and a two-supply-basis ambiguity that swings the headline 22 pts. The whole-degree form the paper uses is confounded by ceilings; the figure is defensible only in lower-division form with ceilings annotated.
- Legibility in one glance: moderate. Four dot columns × three states is readable, but the honest version needs n per column, a greyed non-STEM column, a ceiling mark and, for VA, college-level dots — four annotations is a lot for one glance.
- Cross-state comparability: weak-to-moderate (see §3: 11 footnotes; three different notions of "covered").
- Cross-major reinforcement: strong — the computing-specific bottleneck at lower division (45.7 vs 85.0 vs 91.6) is the cleanest single sentence in this dossier.
- Net: Figure 2 is the best *explanatory* figure (it says WHY Figure 1 is low and WHERE the failure sits) but a poor *headline* figure; it should follow Figure 1, re-scoped to lower division.

---

## 7. Proposed visuals and open questions

Visuals:
1. **Lower-division four-type dot plot, three state panels** (CA cs / MA named / VA), VA drawn twice: catalog dots as hollow "ceiling" markers, scheduled dots filled; non-STEM column greyed with n. Campus-equal mean diamonds plus the structural-ceiling tick per column.
2. **VA college-axis version**: the same four columns with one dot per VCCS college (16) rather than per university — this is where VA's spread is (sd 25.7 vs 6.0); overlay the CA and MA college-mean distributions (115 and 15 dots) for the same reading.
3. **Achieved-vs-ceiling bars for computing**: per state (and per CA major), whole-degree coverage as a filled bar inside the ceiling outline; shows 42 / 54 / 99→77 % at a glance and retires the misleading 11.5-vs-22 headline.
4. **Course ladder across states**: CS1, CS2/OOP, data structures, computer organisation, discrete, calculus II — share of pairs where the course is covered, three state columns, colour by failure layer (not articulated vs not scheduled). Requires a CA course-level pull (open item).
5. **Within-MA policy contrast**: A2B-mapped vs unmapped pairs by type (80.6 vs 30.2 computing) placed next to VA's all-pairs column — a natural experiment for "statewide agreements move the computing column".
6. **CA cross-major strip**: own-discipline vs quantitative at lower division for cs / bio / econ (45.7 / 85.0 / 91.6 vs 83.0 / 79.0 / 67.7), with bio/econ "Math" split into calculus / statistics / computing (extended axes) so the computing fine category is visible inside the service-math column.

Open questions:
- VA whole-degree typing: post-transfer rows are typed by me; NSU/Radford summary rows and "Select three courses"/foreign-language items are dropped or non-STEM by default. Should the whole-degree VA column exist at all, given the guide's post-transfer half is unstructured?
- Should the site's VA Figure 2 be built from `buildVaCoverageCells.js` (a `by_type` field on the frozen rows) rather than the guide evaluator? My script is a 100-line proof that it can.
- CA course-level failure counts on the degree lens (not the eligibility engine) are missing; needed for visual 4.
- MA: should the default pane switch from anonymous PDF dots to the named final-repo rollup now that the multisets match? (The audit's caution about naming dots stands; the match is strong but not exact for Non-STEM.)
- Unit-weighted Figure 2 is not implemented for any corpus; CA needs by-type unit sums in `degreeSlots`, MA needs the 79 % credit join, VA has units natively. Given the bio/econ finding, is Figure 2 worth unit-weighting, or is course-count (the paper's form) fine with ceilings shown?
- The bio and econ "Math" role folds `computing` in (`categories: ['calculus','statistics','computing']`); for a paper about the computing bottleneck that fold hides the very category of interest in two of three majors.
- VA scheduled supply is a snapshot of one term's schedule (`server/.va-courses/`); its date and whether "not scheduled this term" means "not offered" need stating before finding 5 is printed.
