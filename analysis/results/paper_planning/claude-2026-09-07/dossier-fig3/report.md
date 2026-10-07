# Dossier — Figure 3, transfer credit rate (`transfer-credit-rate`)

Author: dossier-fig3 subagent, 2026-09-07. Read-only on the repository. All "our computation" numbers were pulled live from Atlas on 2026-09-07 through `transferCreditRateData` (scripts and raw row dumps in this directory: `pull.js`, `rows/*.json`, `ca_ma_dist.py` -> `ca_ma_dist.out`, `va_ma.py` -> `va_ma.out`, `extra.py` -> `extra.out`, `a2b2.py` -> `a2b2.out`, `sdv.py` -> `sdv.out`). Baseline cross-check: every unverified-cohort mean reproduces `server/data/figure-baseline.json` to three decimals (cs|ast 65.414, cs|local_as 57.266, bio|ast 73.579, bio|local_as 62.419, econ|ast 60.688, econ|local_other 49.057, ma-cs 68.569) — VERIFIED.

Vocabulary: "AS-side" = associate credits applied / associate total (the paper's Fig 3). "Bachelor-side" = associate credits applied / bachelor requirement units (`full_degree_completion_pct`, `lower_division_completion_pct`); the paper never published this, it is ours.

## 1. What the figure measures, corpus by corpus

### 1a. Shared engine (CA cs/bio/econ; MA our-model rows)
`server/services/analysis/transferCreditRate.js` builds, per associate degree x bachelor template, a feasible transfer-oriented associate plan and applies each associate unit at most once, in order: (1) articulated named course/series in the template, (2) GE/breadth requirement in the template, (3) authored transferable elective block. Line 3346: `paperEquivalentApplied = Math.min(asTotal, directApplied + geCounted)`; `paper_equivalent_as_unit_utilization_pct = 100 * paperEquivalentApplied / asTotal`.

So the Figure 3 lens (`MA_AS_SIDE_SCOPE`, `rateForScope` in `TransferCreditRate.jsx`) is UNITS, GE INCLUDED, elective-only capacity EXCLUDED, capped at 100, denominator = the associate degree's own total in the college's native unit system (quarter colleges stay in quarter; ratio is calendar-invariant). Registry (`registry.js:294`) mounts CA on `degree:'ast'`, `ma-equivalent:true`, `verified:true`; `comparisonContract` declares numerator 'associate-degree credit replacing named or GE/breadth bachelor requirements', denominator 'associate-degree total credit', `unrestricted_elective_capacity:false`.

GE differs by degree type inside CA: AS-T GE is IGETC/Cal-GETC-verified (`ge_assumed_units` = 0 in every AS-T cell); local AS / local-other use an optimal dual-qualifying-student ASSUMPTION where the source only gives an aggregate GE block (`ge_assumed_units` mean 5.4 cs, 11.9 bio, 12.5 econ, verified cells). Local numbers are therefore optimistic and partly modelled.

Cohort: CA mounts `verifiedOnly:true`. Denominator 60–90 units (mean 60.9 cs AS-T). Structural ceiling: nominally 100, but the strict lens excludes elective-only units so a CA AS-T cell's ceiling is about 100 minus the elective share (pooled 7.6% cs, 9.3% bio, 39.3% econ). No CA AS-T cell reaches 100 in any major; econ's elective-inclusive `as_unit_utilization_pct` is 100.0 in every cell while the strict lens reads 60.8.

### 1b. MA (`ma-cs`, paper corpus)
Component locks the AS-side lens and opens on the FINAL PDF Figure 3 as printed (`published_pdf_as_transfer_pct`), with "Our recalculation" (`archive_gray_detail_as_transfer_pct`) as second source. Definition (older-repo README line 54): `% Credit Hours` = sum of credits of GREY transfer-tab rows / AS total (Column H of `All CC AS`). Grey = "a course that transferred from community college [and] was used to replace a course in the four-year curriculum"; blue = counts only as free elective toward 120, excluded. Resident 4y tabs contain the GE residue rows, so grey rows replacing them ARE in the numerator: MA Fig 3 is GE-inclusive and unit-weighted, unlike MA Fig 1. Denominator is the AS, not the BS, so the upper-division-in-denominator problem of Fig 1 does not exist.

Cohort: 61 proximity-selected pathways (CC <= 50 driving miles), of 165 pairs; 104 cells blank ("unstudied, never zero"). Typed fractions, no formulas; 11 of 61 cells changed between archived tally and final PDF; STCC denominator 63 vs 61. Our-model row (68.6) is a heatmap + recovered-resident join, all 61 cells `estimated`, `ge_counted_units` = 0 (heatmap columns are the only vocabulary) — NOT the recalculation; do not quote it as MA's number.

### 1c. VA (`va-cs`, frozen `vaCreditRateRows.js`, built 2026-09-06)
Live endpoint returns 304 rows all `excluded` (baseline `va-cs|local_as computed:0`); the figure short-circuits to frozen rows from `server/scripts/va/buildVaCoverageCells.js`. Utilization = (guide pre-transfer credits − wasted) / guide pre-transfer credits; wasted = `va_denied_units` (explicit no-credit outcomes, e.g. SDV 100/101) + `va_unavailable_units` (guide-named course the college does not list/schedule, assumed replaced by credit applying to nothing). Denominator is the university-authored guide's own pre-transfer plan (60–66 credits), NOT a solved associate degree; the guide is identical for every college, so only supply moves the number. Knobs: supply (catalog / scheduled) x colleges (16 with a CS AS / all 23). `lower_division_completion_pct` is identical to the AS-side value; `full_degree_completion_pct` = applied / stated degree total (120–134), ceiling about 50% by construction. All cells `method_status:'estimated'`.

## 2. The numbers

### 2a. Headline table (AS-side, paper-equivalent lens)

| corpus (vintage) | cells | mean | sd | min | med | max | =100 | <50 | colleges with a 100 partner |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CA cs AS-T verified (ours, live) | 306/306 | 67.0 | 13.0 | 33.3 | 66.7 | 96.7 | 0 | 25 | 0/34 |
| CA cs AS-T all sourced | 621 | 65.4 | 13.2 | 26.7 | 64.4 | 96.7 | 0 | 68 | 0/69 |
| CA cs local AS verified | 243/252 (9 excl) | 59.9 | 16.5 | 17.8 | 58.9 | 100 | 3 | 69 | 3/27 |
| CA cs local AS all | 378/405 (27 excl) | 57.3 | 16.9 | 12.8 | 57.8 | 100 | 3 | 126 | 3/42 |
| CA bio AS-T verified | 504/513 | 73.9 | 10.9 | 46.7 | 73.3 | 98.9 | 0 | 7 | 0/56 |
| CA bio AS-T all | 873/882 | 73.6 | 11.3 | 35.6 | 73.3 | 98.9 | 0 | 16 | 0/97 |
| CA bio local AS verified | 279/288 | 62.8 | 15.7 | 27.8 | 63.3 | 98.9 | 0 | 67 | 0/31 |
| CA bio local AS all | 495/513 | 62.4 | 15.0 | 27.8 | 61.7 | 100 | 1 | 105 | 1/55 |
| CA econ AS-T verified | 522/531 | 60.8 | 6.2 | 42.2 | 61.1 | 75.6 | 0 | 5 | 0/58 |
| CA econ AS-T all | 855/873 | 60.7 | 6.2 | 41.7 | 61.1 | 75.6 | 0 | 9 | 0/95 |
| CA econ local other verified | 108 | 49.1 | 7.5 | 36.7 | 48.9 | 68.9 | 0 | 63 | 0/12 |
| CA econ local other all | 207 | 49.1 | 8.2 | 36.7 | 48.9 | 73.3 | 0 | 115 | 0/23 |
| MA final PDF (transcription) | 61 | 67.7 (prints 68) | 23.6 | 27 | 69 | 100 | 10 | 16 | 6/15 |
| MA our recalculation (archive gray rows, older repo) | 61 | 64.7 | 22.2 | 26.6 | 63.3 | 101.5 | — | — | — |
| MA our model (heatmap + recovered resident join) | 61/165 | 68.6 | 24.4 | 10.9 | 69.2 | 100 | 4 | 16 | 4/15 |
| VA catalog, 16 CS colleges (frozen) | 240 | 98.5 | 2.2 | 89.4 | 100 | 100 | 148 | 0 | 16/16 |
| VA scheduled, 16 CS colleges | 240 | 89.5 | 11.7 | 53.0 | 93.7 | 100 | 70 | 0 (86 < 90) | 13/16 |
| VA catalog, all 23 | 345 | 95.9 | 7.2 | 53.2 | 100 | 100 | 178 | 0 | — |
| VA scheduled, all 23 | 345 | 84.8 | 13.7 | 39.4 | 88.7 | 100 | 70 | 2 | — |

MA PDF sum 4132/61 = 67.7377 — VERIFIED; all 11 printed university averages reproduce (Bridgewater 79, Fitchburg 86, Framingham 36, MCLA 38, Salem 65, Amherst 80, Boston 53, Dartmouth 92, Lowell 89, Westfield 58, Worcester 74). VA pooled utilization 0.9847 / 0.8949 — VERIFIED from the frozen module.

### 2b. Per-institution distributions (means of cells per institution)

Per university / campus:

| corpus | n | mean | min | med | max | sd | lowest -> highest |
|---|---:|---:|---:|---:|---:|---:|---|
| CA cs AS-T verified | 9 | 67.0 | 51.0 | 62.5 | 86.7 | 11.5 | UCLA 51.0, Berkeley 53.5, UCSD 61.6, Davis 62.1, UCSC 62.5, Irvine 68.4, Merced 76.6, Riverside 80.7, UCSB 86.7 |
| CA cs local AS verified | 9 | 59.9 | 44.3 | 61.8 | 74.0 | 8.1 | Berkeley 44.3, UCLA 53.5, UCSD 54.1, UCSC 57.9, Davis 61.8, Irvine 63.7, Riverside 64.3, Merced 65.4, UCSB 74.0 |
| CA bio AS-T verified | 9 | 73.9 | 62.5 | 73.8 | 85.3 | 7.2 | Berkeley 62.5, UCLA 67.2, Irvine 68.3, Riverside 70.7, Merced 73.8, UCSD 74.4, UCSC 80.8, UCSB 82.2, Davis 85.3 |
| CA bio local AS verified | 9 | 62.8 | 56.7 | 64.8 | 68.9 | 3.9 | Riverside 56.7 ... Davis 68.9 |
| CA econ AS-T verified | 9 | 60.8 | 51.4 | 60.4 | 68.0 | 4.4 | Merced 51.4, Berkeley 58.4, Davis 59.3, UCSB 59.8, UCSD 60.4, Riverside 61.0, UCSC 63.7, UCLA 64.9, Irvine 68.0 |
| CA econ local other verified | 9 | 49.1 | 44.9 | 48.6 | 52.7 | 2.7 | UCSD 44.9 ... UCLA/Irvine 52.7 |
| MA final PDF | 11 | 68.2 | 36.2 | 73.8 | 91.7 | 18.8 | Framingham 36.2 (8 cells), MCLA 37.5 (2), Boston 53.4 (8), Westfield 58.5 (4), Salem 65.0 (7), Worcester 73.8 (6), Bridgewater 79.3 (7), Amherst 80.0 (3), Fitchburg 85.5 (6), Lowell 89.3 (7), Dartmouth 91.7 (3) |
| VA catalog | 15 | 98.5 | 95.7 | 99.4 | 100 | 1.6 | UVA 95.7, UMW 96.2, RMC 96.7, Longwood 96.8, UL 96.8, VT 97.8, CNU 99.0, UVA-Wise 99.4, VCU 99.4, GMU 99.5, Bridgewater/NSU/ODU/Radford/W&M 100 |
| VA scheduled | 15 | 89.5 | 83.9 | 90.1 | 94.4 | 2.9 | UVA 83.9, Bridgewater 84.9, VT 85.2, CNU 88.1, GMU 88.6 ... W&M 93.6, Radford 94.4 |

Per community college:

| corpus | n | mean | min | med | max | sd | extremes |
|---|---:|---:|---:|---:|---:|---:|---|
| CA cs AS-T verified | 34 | 67.0 | 61.2 | 66.6 | 76.5 | 3.3 | Mendocino 61.2, De Anza 61.9 ... Diablo Valley 71.9, CCSF 76.5 |
| CA cs AS-T all | 69 | 65.4 | 51.5 | 66.0 | 76.5 | 4.7 | Norco 51.5, Copper Mountain 54.7 ... CCSF 76.5 |
| CA cs local AS verified | 27 | 59.9 | 24.4 | 58.3 | 82.0 | 12.4 | Fullerton 24.4, Siskiyous 39.4, LA Southwest 49.3 ... Las Positas 79.3, Foothill 82.0 |
| CA bio AS-T verified | 56 | 73.9 | 60.2 | 74.0 | 84.4 | 5.1 | Irvine Valley 60.2 ... College of the Desert 84.4 |
| CA bio local AS verified | 31 | 62.8 | 29.8 | 63.8 | 88.4 | 13.7 | El Camino 29.8, Long Beach 40.3 ... Las Positas 88.4 |
| CA econ AS-T verified | 58 | 60.8 | 55.2 | 62.0 | 64.7 | 2.5 | Foothill 55.2 ... LA City 64.7 |
| CA econ local other verified | 12 | 49.1 | 40.9 | 47.5 | 58.6 | 6.1 | Cerritos 40.9 ... LA Valley 58.6 |
| MA final PDF | 15 | 67.9 | 40.5 | 71.8 | 88.5 | 13.6 | Berkshire 40.5 (2), Roxbury 42.1 (7), Holyoke 51.5 (2), N. Essex 63.3, Bunker Hill 63.7 ... Bristol 79.3, Quinsigamond 84.5, Cape Cod 88.5 (2) |
| VA catalog | 16 | 98.5 | 97.0 | 98.9 | 98.9 | 0.7 | Southwest Virginia 97.0, Paul D. Camp 97.2, Va Peninsula 97.2, Va Western 98.0, Brightpoint 98.0, eleven colleges 98.9 |
| VA scheduled | 16 | 89.5 | 66.3 | 93.9 | 98.9 | 10.6 | Southwest Virginia 66.3, Paul D. Camp 74.8, Central Virginia 74.9, Va Highlands 76.9, Wytheville 80.6 ... JSR/New River/NOVA/Tidewater 98.9 |
| VA scheduled, all 23 | 23 | 84.8 | 62.4 | 88.7 | 98.9 | 12.5 | Eastern Shore 62.4, Southside 64.1, Southwest 66.3, Mountain Gateway 67.0 ... |

Where the variance lives (sd of university means vs sd of college means): CA cs AS-T 11.5 vs 3.3 — receiving side (UCLA/Berkeley templates); MA PDF 18.8 vs 13.6 — both; VA scheduled 2.9 vs 10.6 — sending side (which college runs the courses). This is the most useful structural contrast in the figure.

### 2c. Numerator composition (pooled share of associate units)

| corpus | named | actual GE/breadth | elective-only (excluded) | not applied | paper-equiv |
|---|---:|---:|---:|---:|---:|
| CA cs AS-T verified | 27.2 | 39.7 | 7.6 | 25.5 | 67.0 |
| CA cs local AS verified | 25.4 | 34.9 (5.4 u/cell assumed) | 7.5 | 32.2 | 60.3 |
| CA bio AS-T verified | 35.4 | 38.4 | 9.3 | 16.9 | 73.9 |
| CA econ AS-T verified | 17.2 | 43.4 | 39.3 | 0.1 | 60.6 |
| CA econ local other verified | 13.7 | 35.6 | 47.2 | 3.5 | 49.3 |
| MA our model (61) | 68.4 (heatmap columns) | 0 (not separable) | 0 | 31.6 | 68.4 |
| VA catalog | guide rows | — | 0 | 1.5 (denied 0.7 u + unavailable 0.3 u per cell) | 98.5 |
| VA scheduled | guide rows | — | 0 | 10.5 (unavailable 5.9 u per cell) | 89.5 |

In CA, GE is the LARGER half of what applies in every major; named articulation alone would put cs at 27%. In VA the GE block is 12.5 of ~60 guide credits and is not the driver.

### 2d. Bachelor-side lens (ours on every corpus)

| corpus | full_degree_completion_pct (ceiling) | lower_division_completion_pct | campus spread (full) |
|---|---:|---:|---|
| CA cs AS-T verified | 37.3 (<= 50) | 62.6 | Berkeley 26.8 -> UCSB 48.7 |
| CA cs local AS verified | 33.7 | 56.5 | Berkeley 22.2 -> UCSB 42.3 |
| CA bio AS-T verified | 41.6 | 65.5 | UCLA 33.6 -> UCSC 49.8 |
| CA econ AS-T verified | 50.0 (at ceiling everywhere) | 78.8 | 49.9–50.0 |
| CA econ local other verified | 48.2 | 75.8 | Irvine 44.8 -> 49.8 |
| MA our model, 61 | 36.1 (<= ~52) | 40.9 | Framingham 18.9 -> Fitchburg 46.0 |
| VA catalog | 50.2 (<= 50–52) | 98.5 (= AS-side) | UVA 48.6 -> ODU 52.1 |
| VA scheduled | 45.6 | 89.5 | Bridgewater 42.4 -> UL/W&M 47.9 |

The bachelor-side full-degree lens is the only measure with the same numerator concept in all three states over a denominator that is the same object (the whole bachelor degree), with a shared ~50% ceiling: CA cs 37, MA 36, VA 50/46. But it compresses into a 25–52 band, its MA value rests on our approximate join (all 61 cells estimated, 4-credit fallbacks), and its VA catalog value is trivially the ceiling. The lower-division lens is NOT comparable: in VA it equals the AS-side measure; in MA it uses a matrix-boundary split the component calls "too coarse".

## 3. Comparability verdict

No — the three states cannot be put on one AS-side axis without at least seven footnotes, and two of them (VA's denominator and MA's cohort) change the sign of the intuitive reading. Every difference:

1. Denominator object. CA: solved associate degree (60–90 native units). MA: CC's published AS (60–72, typed totals, STCC 61/63 conflict). VA: the university's own transfer guide pre-transfer plan (60–66) — receiver-authored, so ~100% by construction; a VCCS AS is never solved.
2. Numerator rule. CA: named (ASSIST) + actual GE (IGETC verified for AS-T; optimal-student ASSUMED for local degrees, 5–12 units/cell), elective-only excluded, capped. MA: grey rows (any replaced resident row, GE included), blue excluded, no cap (archive max 101.5), typed fractions, 11 cells revised between vintages. VA: guide credits minus denied (SDV) and unavailable (supply) — no articulation concept.
3. GE. In the numerator in all three (the one MA figure where GE is in). CA's GE is a policy block assumed satisfiable at every college; MA's is whatever grey rows replaced; VA's is 12.5 guide credits.
4. Cohort selection. CA: verified AS degrees x all 9 UC campuses (curation filter, +1.7 to +2.6 pp vs all-sourced). MA: 61 of 165 pairs by driving distance <= 50 mi (12 pairs later dropped from Figs 4–6 average 56.5, so the 49-cohort is 70.5). VA: full 16x15 cross, no filter, plus an all-23 variant.
5. Ceiling. Nominal 100 everywhere, but CA's strict lens caps AS-T at ~92 (cs), ~91 (bio), ~61 (econ) by excluding elective-only units; MA and VA have no such block. This explains CA 0 cells at 100 vs MA 10/61 vs VA 148/240.
6. Units. Semester everywhere except CA (quarter colleges: 9 of 306 cs cells fully quarter). AS-side ratio is calendar-invariant; harmless for Fig 3, not for Fig 4.
7. Evidence status. CA 87/306 `ok`; MA-model 61/61 `estimated`; VA 240/240 `estimated`.
8. Vintage. MA prints 67.7 (PDF) but recalculates at 64.7 (archive gray), 65.1 (typed tally), 68.6 (our model); cell MAE 2.9–11.7 pp.
9. Weighting. Cell-equal everywhere; MA campus-equal is 68.2.

A like-for-like reading would need: the same denominator object (a solved sending-side associate degree — for VA that means solving the VCCS CS AS against each guide, which the live endpoint refuses today: 304/304 excluded), the same numerator rule (named + actual GE, elective excluded, capped), the same cohort rule (full cross, or the same proximity filter everywhere), and MA on one vintage. Short of that, the honest cross-state objects are the paired policy contrast inside each state (F3/F4) and the bachelor-side full-degree lens.

## 4. What the CA cross-major reading adds

- Reinforces the mechanism story, complicates the level story. cs AS-T 67.0 < bio 73.9, and econ 60.8 sits below cs only because 39% of the econ AS-T is elective-only capacity the lens discards — its elective-inclusive utilization is 100.0 and its bachelor-side completion is exactly the 50% ceiling in every campus. Fig 3's level is a function of how much of the associate degree the receiving template even names: econ ~10 units, cs ~16, bio ~22.
- The AS-T effect is stable across majors (+10 to +11 pp). Paired on the same college x campus cells: cs +10.8 (108 verified cells; AS-T higher in 81, lower in 12), bio +10.1 (225; 155/40), econ +11.3 (108; 81/4). Decomposition differs: cs gains mostly named articulation (+4.1 named, +2.4 GE units), econ mostly GE (+1.9 named, +4.9 GE). The AS-T works through IGETC in low-named majors and through articulation in CS.
- Receiving-side variance is a CS phenomenon. Campus sd: cs 11.5, bio 7.2, econ 4.4. UCLA/Berkeley pull cs down (51.0/53.5) but are mid-pack in bio and econ. The CA "state fails" story is really "two flagship CS templates fail" — the MA pattern (Framingham 36, MCLA 38), not the VA pattern (UVA 95.7 is the worst VA university).
- Local-degree dispersion is CA-wide. College sd jumps from 3.3 (AS-T) to 12.4 (local AS) in cs, 5.1 -> 13.7 in bio: without a statewide designed degree the sending college matters ~4x more — that is the MA world (college sd 13.6).

## 5. Candidate findings

F1 (cross, VERIFIED). AS-side headline means: CA cs AS-T 67.0 (306 verified cells, ours), MA 67.7 (61 final-PDF cells), VA 98.5 (240 frozen catalog cells) — but VA's number is a receiver-authored guide measured against itself, so the 31-pp gap is a construction difference, not a policy outcome.

F2 (VA vs others, VERIFIED, challenges "VA is best"). Switching VA from catalog to currently-scheduled supply drops the mean from 98.5 to 89.5 and the worst college from 97.0 to 66.3 (Southwest Virginia); 1,415 of the 1,577 wasted units come from unavailable courses — CSC 223 Data Structures (75 cells), CSC 222 OOP (33), MTH 264 Calc II (24), CSC 205 Computer Organization (24), CSC 208/MTH 288 Discrete (21). The same CS2/discrete/computer-organisation courses that fail to ARTICULATE in CA and MA fail to be OFFERED in VA: the bottleneck moved from the articulation layer to the supply layer.

F3 (MA mechanism, VERIFIED — new; the MT flag was never rendered). In the final-PDF Figure 3 the 13 pathways carrying a MassTransfer A2B map average 94.8% vs 60.4% for the 48 without one (58.5% for the 6 non-mapped pairs at the same four universities). The +34-pp A2B effect is MA's version of the AS-T effect and three times the CA effect; the MA mean of 68 averages two regimes.

F4 (CA mechanism, VERIFIED). On identical college x campus cells the AS-T beats the local degree by +10.8 pp in cs (108 verified paired cells, higher in 81, lower in 12), +10.1 in bio (225), +11.3 in econ (108); largest at Riverside (+18.0 cs), smallest at UCLA (+6.0 cs). Cleanest within-state policy contrast; also shows the AS-T cannot fix the receiving-template problem at the flagships.

F5 (cross, VERIFIED). sd of university means / sd of college means is 11.5 / 3.3 in CA cs AS-T, 18.8 / 13.6 in MA (PDF), 2.9 / 10.6 in VA scheduled. CA fails at the receiving template (UCLA 51.0, Berkeley 53.5 vs UCSB 86.7), MA fails per pair (Framingham 36 vs Dartmouth 92; Roxbury 42 vs Cape Cod 88), VA fails at the sending college — three different policy targets.

F6 (CA, VERIFIED). GE, not named articulation, is the larger half of every CA rate: pooled AS-T shares named 27.2 / GE 39.7 / elective 7.6 (cs), 35.4 / 38.4 / 9.3 (bio), 17.2 / 43.4 / 39.3 (econ). Strip GE and CA cs reads 27, below MA's non-A2B 60.

F7 (MA, VERIFIED). MA is the most dispersed corpus (cell sd 23.6; 16 of 61 cells below 50, 10 at 100), only 6 of 15 CCs have any 100% partner, Roxbury averages 42.1 over 7 universities; CA AS-T has zero cells at 100 in any major but far fewer below 50 (25/306 cs). MA's mean equals CA's while its student experience is bimodal.

F8 (VA residual, VERIFIED, challenges "VA is best"). In catalog mode 160 of VA's 230 pooled wasted units are the 1–2-credit SDV 100/101 orientation course that five universities (UVA, UMW, RMC, Longwood, UL) refuse in all 16 of their cells; 74 of the 92 non-100 cells lose only SDV. UVA, the flagship, is the worst VA university on both bases (95.7 / 83.9).

F9 (cross, bachelor-side, VERIFIED). On the only shared-ceiling lens (associate credit applied / whole bachelor degree, ceiling ~50), CA cs AS-T reads 37.3, MA 36.1 (our model, 61 cells, all estimated), VA 50.2 catalog / 45.6 scheduled. VA's real advantage is +8 to +13 pp of a bachelor's degree, not +31; CA and MA are indistinguishable.

F10 (CA cross-major, VERIFIED). Campus sd is 11.5 in cs, 7.2 in bio, 4.4 in econ; UCLA/Berkeley are last in cs but mid-table in bio and econ. The CA "failure" is two flagship CS templates, mirroring MA's Framingham/MCLA, unlike VA.

F11 (feasibility, VERIFIED — answers Q2 for this figure). Figure 3 is already the "GE-included, unit-weighted" form in all three states: MA numerator = grey-row credits including GE replacements (older-repo README line 54), CA lens = named + geCounted units, VA = guide credits. No re-derivation from the old repos is needed for Fig 3.

F12 (INFERRED). Because MA's 61 cells are proximity-selected and only 13 of the 38 A2B pairs fall inside them, the published 68 is not a state estimate; a full-cross MA Fig 3 would sit nearer the non-A2B 60 — below CA cs AS-T 67, at CA local AS 60. The apparent CA = MA tie is a cohort artefact.

Context (URL-backed): MassTransfer Gen Ed Foundation = 34 credits transferring as a block, receiver may add <= 6 credits (https://www.mass.edu/masstransfer/gened/home.asp); A2B maps (https://www.mass.edu/masstransfer/a2b/home.asp). VA Passport 16 credits / UCGS 31 credits satisfy lower-division GE at any VA public institution (https://www.transfervirginia.org/content/general-education-transfer-credit-agreementpassport-and-ucgs). CA SB 1440: AS-T <= 60 transferable units incl. IGETC/CSU GE-Breadth (now Cal-GETC) + >= 18 major units; guaranteed CSU admission (https://www.calstate.edu/apply/transfer/pages/ccc-associate-degree-for-transfer.aspx; https://www.leginfo.ca.gov/pub/09-10/bill/sen/sb_1401-1450/sb_1440_cfa_20100622_091803_asm_comm.html). The AS-T guarantee is to CSU, not UC — our CA cells are all UC.

## 6. Preliminary contribution score: 6 / 10

Novelty (+): the A2B split (F3) and the supply-side VA reading (F2) are new; the "where the variance lives" contrast (F5) is a genuine cross-state structural finding. Defensibility (+/−): CA and VA reproduce from committed artefacts; MA has four vintages and a 61/165 cohort; VA is estimated in every cell; local-AS GE is assumed. One-glance legibility (−): the heat-map reading (VA 98 > MA 68 = CA 67) is the WRONG reading; the right one needs the scheduled knob plus a mechanism decomposition. Cross-state comparability (−): fails as a level comparison; works as a within-state contrast repeated three times. Cross-major reinforcement (+): AS-T effect stable +10–11 pp across three majors with an informative decomposition. Feasibility (+): already GE-included and unit-weighted everywhere. Net: strong as a mechanism figure, weak as a league table.

## 7. Proposed visuals and open questions

Visuals:
1. "Designed pathway vs default pathway" paired-dot panel: one 0–100 axis, three rows — CA AS-T vs local AS per campus (9 pairs, +6 to +18), MA A2B vs non-A2B per university (4 universities), VA scheduled vs catalog per college (16 pairs, 0 to −32). The arrow length IS the state's policy instrument.
2. Unit-ledger stacked bars per corpus: named / actual GE / elective-only (excluded) / not applied, VA drawn twice (catalog, scheduled), MA on the archive-gray recalculation.
3. Dispersion strips: university means and college means as two strip plots per state on a shared axis — CA spreads on the top strip, VA scheduled on the bottom, MA on both.
4. Bachelor-side twin panel with the 50% ceiling drawn: CA 37 / MA 36 / VA 50->46, beside the AS-side panel so the reader sees the two lenses disagree.
5. Course-loss ledger for CS (Data Structures, Discrete, Computer Organisation, Calc II, CS2): columns "not articulated (CA cells)", "not articulated (MA)", "not scheduled (VA cells)". Needs CA/MA per-course counts from the Fig 1/2 owners.
6. Shade A2B-mapped cells on the MA tab (`raw/heatmap.json` `universities[].mt`, never rendered).

Open questions:
- Can the VCCS CS AS be solved against each guide so VA gets a sending-side denominator? Live endpoint excludes 304/304 — data gap or rule (`AMBIGUOUS_UNIT_POOL`)?
- MA cohort: report 61 (67.7), 49 (70.5) or a modelled 165? Our model computes only the 61.
- Should the CA strict lens exclude elective-only units when the MA blue rule was applied inconsistently (5 of 9 archive conflicts "selectively count additional colored credit")? Econ reads 61 vs 100 on this choice.
- Local-AS assumed GE (5–12 units/cell): report a verified-GE-only variant to bound the AS-T effect from below.
- VA scheduled supply is one term's snapshot; is a two-term window fairer?
- Is refusing SDV 100/101 a published policy at the five universities or a guide-parsing artefact?
- The AS-T guarantee is a CSU instrument; our CA cells are UC-only. Is the right comparator for MA's A2B the CSU side?
- MA vintage: pick PDF (67.7) or archive-gray (64.7) once; F3's A2B split uses PDF cells.
