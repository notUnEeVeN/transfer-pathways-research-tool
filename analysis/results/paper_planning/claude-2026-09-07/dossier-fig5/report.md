# Dossier: Figure 5 — Cost of pathway hours above 120 (`transfer-extra-cost`)

Prepared 2026-09-07 by the `dossier-fig5` subagent. Read-only on the repository. Scratch
artefacts sit next to this file: `pull.js`, `rows.json` (15 corpus×degree×cohort live pulls),
`universities.json` (41 campus tuition records), `ma_baselines.json` (98 `extra_hours_pdf` /
`extra_cost_pdf` rows), `stats.py`, `stats.json`, `schev.txt` (SCHEV RD418 text).

Vintage vocabulary follows the brief: **final PDF** (2027 SIGCSE draft), **final repo**
(`server/data/ma/final/Pathways Master.xlsx` = `their-math.json#currcomp`), **older repo**
(`server/data/ma/recovered/CurrComp Master.xlsx` = `currcomp_archived`), **our computation**
(live `transferCreditRateData` on 2026-09-07, or the frozen VA rows).

---

## 0. Executive summary

* Figure 5 is, in every corpus, **Figure 4 multiplied by one campus-constant per-credit rate**:
  the service computes `modeled_cost_above_120_usd = round(hoursAbove120 × annual/24)` and the
  paper's workbook is `(credit hours − 120) × Cost/Credit`. It has no denominator, no GE
  decision and no cohort of its own; all are inherited from Figure 4.
* The "MA is tuition-only, CA is tuition + fees, dollars not harmonised" boundary that the
  registry, `docs/ma-paper-audit.md` and the brief repeat is **wrong in substance**. The MA
  workbook's `Cost / Year` row is the campuses' published 2024-25 *tuition plus mandatory fees*
  (Bridgewater $11,734 = ~$910 tuition + ~$10.8k fees; UMass Amherst $17,772 is the campus's
  2024-25 "tuition and fees"), the final-repo notebook titles the tab "Tuition & Fees over 120
  Credits", and PDF footnote 7 ("we did not include student fees") contradicts the authors'
  own artefact. MA and CA are on the *same* basis (tuition + mandatory fees ÷ 24); only the
  price year differs (2024-25 vs 2025-26).
* VA has no Figure 5 today (`VA_FIGURE_IDS` omits it; the live service returns 304 rows, all
  `excluded`; no VA campus carries a tuition field). SCHEV's 2025-26 report (Appendix B)
  publishes exactly the input the paper's convention needs for 12 of the 15 corpus
  universities; the 3 private colleges need their own sticker prices. A VA pricing is a
  half-day of data entry, not a research problem.
* Pricing changes the story only where per-credit rates differ across campuses: CA UC rates
  span $655–$723 per semester unit (ratio 1.10; campus rank order unchanged, Spearman
  0.98–1.00); MA $473–$741 (1.57; reorders three campus pairs); VA at SCHEV rates $434–$1,102
  (2.54; would reorder the most). The figure "adds beyond Fig 4 × constant" *least* where our
  data are best (CA) and *most* where there is no figure yet (VA).
* Headline means on the cohorts each state renders: CA cs AS-T verified **$10,532** (306
  cells; $8,425 at 15-unit load); CA bio AS-T verified $6,902 (504); CA econ AS-T verified $9
  (522); MA final PDF **$7,129** (49 cells, 35 nonzero); MA our model $12,000 (61); VA **not
  rendered** — at SCHEV rates ~$613 catalog / ~$4,326 scheduled (192 priced cells; inferred).
* Preliminary contribution score **3/10** as a stand-alone cross-state figure. Recommended
  form: fold cost into Figure 4 as a secondary annotation and spend the slot on a mechanism
  figure.

---

## 1. What the figure measures, corpus by corpus

### 1.1 Shared machinery (read from code)

* Registry entry `transfer-extra-cost` (`frontend/src/analyses/registry.js` 473–580): knobs
  `degree` (ast | local_as | local_other), `verified` toggle, `source` (pdf | archive-detail;
  paper corpora only), `load` (minimum 12u | standard 15u; non-paper corpora only).
  `comparisonContract`: unit `USD`; formula "unrounded Figure 4 hours above 120 × campus
  annual charge ÷ annual load denominator; one final whole-dollar round"; `price_basis`
  "paper-reported Massachusetts tuition charge; fees excluded" vs "UCOP Total Charges by
  Campus 2025-26 resident tuition + student services fee + campus-based fees". The registry
  `description` says cross-state dollars "remain blocked because Massachusetts is tuition-only
  while California combines tuition and fees." There is **no VA branch** (Fig 4's entry has
  one).
* Component `TransferExtraCost.jsx`: `extraCostValue(row, source, load)` returns
  `published_pdf_extra_cost_usd` (source `pdf`); `round(archived_pathway_sheet_extra_hours ×
  annual/24)` restricted to the 49 PDF-finite pairs (source `archive-detail`); otherwise
  `modeled_cost_above_120_usd` / `..._standard_load_usd`. The 15-unit view of the PDF is
  `round(pdf × 0.8)`. Colour ramp anchored at $0. Matrix means are plain averages of finite
  cells (`buildRateMatrix`) — pathway-weighted, not campus-equal.
* Service `server/services/analysis/transferCreditRate.js` 2659–2690 and 3430–3470:
  `tuitionBySchool` reads `assist_institutions` university rows; `perSemesterUnit = annual/24`,
  `perSemesterUnitStandardLoad = annual/30`; the calendar cancels for quarter campuses because
  hours are already semester-equivalent. `modeled_cost_above_120_usd = round(hoursAbove120 ×
  perSemesterUnit)` on the *unrounded* Fig 4 numerator. Campuses without a tuition record get
  null cost. For a paper corpus the PDF matrices are joined from `ma_paper_baselines`
  (`extra_hours_pdf`, `extra_cost_pdf`: 49 pairs each = 98 rows, VERIFIED).
* Baseline pull (`server/scripts/figureBaseline.js` 300–330): per `slug|degreeType`,
  `verifiedOnly:false`; Figure 5 is only fingerprinted as `figure5_cell_values_sha256` for CA
  and MA; **no mean cost is pinned anywhere in `figure-baseline.json`**. Every dollar figure
  below is therefore our live computation unless labelled otherwise.

Properties that hold for all three states:

| property | value |
|---|---|
| unit | USD (whole dollars, one final round) |
| numerator | Figure 4 hours above 120 (units, semester-equivalent) — never course counts |
| GE | inherited from Fig 4: AS GE units count toward the pathway total, receiving GE capacity per Fig 3 rules; no GE toggle exists on Fig 4/5 |
| denominator | none (absolute $ per pathway); the load denominator (24 or 30 annual units) is a rate convention |
| structural ceiling | ≈ (AS total − applied + degree minimum − 120) × rate ≈ 60 u × rate ≈ $42k in CA; largest observed cells: CA $34,396 (Berkeley local-AS, 48 h), MA our model $41,001 (Roxbury→Lowell, 58 h), MA PDF $24,345 (Northern Essex→UMass Boston) |
| weighting | pathway-weighted mean of finite cells |

### 1.2 California (cs, bio, econ) — our computation

* Cohort: default AS-T, verified only (figures mount `verifiedOnly:true`); local AS /
  local-other available. Supply: ASSIST articulation + curated UC templates (curated-minimum
  base by default).
* Rates: `tuition_basis` on all 9 UC rows — UCOP Total Charges by Campus 2025-26, "systemwide
  tuition + student services fee + campus-based fees", excludes health insurance/room/board,
  divisor 12 × 2 (URL recorded). Annual $15,729 (UCLA) – $17,346 (Davis); per semester unit
  $655.38 – $722.75 (ratio 1.103). VERIFIED from `universities.json`.
* Cells: cs AS-T 306 verified / 621 all; cs local AS 243/252 verified (9 excluded); bio AS-T
  504/513; bio local AS 279/288; econ AS-T 522/531; econ local-other 108/108.

### 1.3 Massachusetts (ma-cs) — three vintages plus our model

* Cohort: `local_as` only; paper corpus, verified toggle hidden, query runs
  `verifiedOnly:false`. Sources: `pdf` (default) = final PDF Figure 5 (49 pairs, 35 nonzero);
  `archive-detail` = older-repo pathway-sheet hours × rate on the same 49 pairs. The modelled
  value (`modeled_cost_above_120_usd`, 61 cells) rides the row but is not a selectable source
  for MA in the component.
* Rates: `buildMaDocuments.js#deriveTuitionRates` back-derives cost ÷ (hours − 120) from the
  workbook's own cells and stores `annual = rate × 24`. Live DB rows carry `tuition_source:
  'CurrComp Master.xlsx Cost tab …'` (older-repo label) and price **all 11 campuses**,
  including UMass Amherst ($740.50) and Dartmouth ($650.50), because the older repo has
  nonzero cells there. The committed importer reads `final/` and documents that
  Amherst/Dartmouth "remain unpriced". Live DB and committed code disagree on 9 vs 11 priced
  campuses — vintage drift, not a numeric error: both workbooks' `Cost / Year` rows are
  identical (VERIFIED by dumping both tabs).
* What the rate is (CONTEXT, web): `Cost / Year` = Bridgewater $11,734, Fitchburg $11,346,
  Framingham $11,920, MCLA $12,186, Salem $12,338.40, UMass Amherst $17,772, UMass Boston
  $16,694, UMass Dartmouth $15,612, UMass Lowell $16,966, Westfield $12,364, Worcester $11,786.
  MA state universities charge ~$910/yr *tuition* and ~$10–11k/yr *mandatory fees*
  (Bridgewater handbook: $910 tuition, $11,284 required fees —
  https://handbook.bridgew.edu/PoliciesProcedures/TuitionandFees; the current fee schedule
  shows $455 tuition + $5,940 fees per 12-credit semester —
  https://www.bridgew.edu/office/studentaccounts/2024-2025-fee-schedule). $11,734 is reported
  as Bridgewater's 2024-25 in-state *tuition and fees*
  (https://www.collegetuitioncompare.com/edu/165024/bridgewater-state-university/tuition/);
  $17,772 as UMass Amherst's 2024-25 in-state tuition and mandatory fees
  (https://www.umass.edu/financialaid/undergraduate-costs). Final-repo `ch_currcomp.ipynb`
  labels the tab "Tuition & Fees over 120 Credits". PDF footnote 7: "This calculation is just
  for the credits above 120. Note that we did not include student fees, which can be
  substantial." **Conclusion (INFERRED from those facts): MA prices tuition + mandatory fees
  on a 24-credit year, exactly the CA convention; the paper's footnote misdescribes its own
  workbook.** `Cost / Credit = Cost / Year ÷ 24` (VERIFIED: $11,734/24 = $488.92).

### 1.4 Virginia (va-cs) — no figure

* `VirginiaPage.jsx`: `VA_FIGURE_IDS = ['coverage-heatmap','transfer-credit-rate',
  'transfer-extra-units']`, comment: "Figure 5 (transfer-extra-cost) prices Figure 4's hours,
  which needs a per-credit tuition figure Virginia's guides do not carry."
* Mounted for va-cs it would query the live service: 272 (verified) / 304 (all) rows, **all
  `method_status: 'excluded'`**, and no VA university row has any tuition field → an all-blank
  matrix. VERIFIED (`rows.json`, `universities.json`).
* The frozen VA Fig 4 rows carry `modeled_hours_above_120`, but the measure is
  `va_wasted_units = va_denied_units + va_unavailable_units` ("unused transfer-guide
  credit"), **not** pathway total − 120. Two construction differences matter for pricing:
  (a) VA 124-credit degree minimums (`va_degree_units_over_benchmark` mean 3.6, max 14) are
  *not* charged, whereas the MA construct charges every hour above 120 (the final repo
  normalised residents to exactly 120; the older repo had Framingham 122 / Salem, Amherst,
  Lowell 121 and priced the *resident* at $993 / $514 / $741 / $707); (b) VA "unused" credit
  is credit the student already earned at VCCS rates ($5,049/yr, ~$210/credit) that buys
  nothing — university-rate pricing applies only to replacement coursework.

---

## 2. The numbers

CA/MA figures are **our computation on the live DB, 2026-09-07** unless labelled final PDF /
final repo / older repo. Costs at the 12-unit (paper) load unless stated. n = finite cells.

### 2.1 Headline means

| corpus | cohort | n | Fig 4 hours mean | Fig 5 mean (12u) | Fig 5 mean (15u) | median | SD | max | zero share | campus-equal mean |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CA cs | AS-T, verified | 306 | 15.24 | **$10,532** | $8,425 | $9,637 | $5,776 | $28,663 | 5.9% | $10,532 |
| CA cs | AS-T, all | 621 | 16.16 | $11,173 | $8,938 | $10,595 | $6,026 | $28,663 | 5.0% | $11,173 |
| CA cs | local AS, verified | 243 (9 excl.) | 19.55 | $13,535 | $10,828 | $13,360 | $7,416 | $34,396 | 4.5% | $13,535 |
| CA cs | local AS, all | 378 (27 excl.) | 21.08 | $14,589 | $11,671 | $14,448 | $7,638 | $34,396 | 3.4% | $14,589 |
| CA bio | AS-T, verified | 504 (9 excl.) | 10.05 | **$6,902** | $5,522 | $6,262 | $5,787 | $21,196 | 18.8% | $6,902 |
| CA bio | local AS, verified | 279 (9 excl.) | 15.77 | $10,870 | $8,696 | $11,049 | $7,433 | $29,313 | 9.3% | $10,870 |
| CA econ | AS-T, verified | 522 (9 excl.) | 0.01 | **$9** | $7 | $0 | $78 | $1,353 | 98.5% | $9 |
| CA econ | local other, verified | 108 | 2.15 | $1,485 | $1,188 | $0 | $2,273 | $9,019 | 62.0% | $1,485 |
| MA cs | final PDF Fig 5 | 49 | 12.92 | **$7,129** | ($5,704 ×0.8) | $4,242 | $7,111 | $24,345 | 28.6% | $6,625 |
| MA cs | final repo Cost tab (all 61 = Fig 7) | 61 | 15.02 | $8,330 | — | $5,655 | — | $27,128 | — | $7,572 |
| MA cs | older repo Cost tab (all 61) | 61 | 16.66 | $9,625 | — | $7,212 | — | $27,128 | — | $9,499 |
| MA cs | our archive-detail recalc, 49 PDF pairs | 49 | — | $8,572 | — | — | — | — | — | — |
| MA cs | our model (61 pairs, 11 campuses priced) | 61 | 21.13 | $12,000 | $9,600 | $10,819 | $9,393 | $41,001 | 4.9% | $11,653 |
| MA cs | our model restricted to the 49 PDF pairs | 49 | — | $9,896 | — | — | — | — | — | — |
| VA cs | frozen, catalog supply, 16 CS colleges | 240 (hours only) | 0.96 | not built | — | — | — | — | 61.7% | — |
| VA cs | frozen, scheduled supply | 240 (hours only) | 6.57 | not built | — | — | — | — | 29.2% | — |
| VA cs | sensitivity, SCHEV 2025-26 T+fees/24, catalog | 192 (12 public) | — | ~$613 | — | $0 | — | $5,844 | 68.8% | — |
| VA cs | sensitivity, SCHEV 2025-26 T+fees/24, scheduled | 192 (12 public) | — | ~$4,326 | — | $2,190 | — | $25,882 | 32.3% | — |

VERIFIED: every CA/MA row reproduced from `rows.json`; PDF mean $7,129.43 = $349,342/49
matches `docs/ma-paper-audit.md`; campus-equal PDF mean $6,624.64 matches the audit;
final-repo all-61 $8,329.71 matches the audit's Figure 7 reconstruction. The 13 cells where
our archive-detail recalculation differs from the PDF are the ten pathways the final repo
revised to 120 h (Bristol/Cape Cod/MassBay/North Shore→Bridgewater, Bristol/Cape
Cod→Dartmouth, Greenfield/Holyoke/Springfield→Amherst, Mount Wachusett→Fitchburg) plus
Quinsigamond→Fitchburg ($473 vs $0), Bunker Hill→UMass Boston ($0 vs $4,174) and
MassBay→UMass Boston ($21,563 vs $4,869) — the three the audit already flags. VA sensitivity
rows are INFERRED (frozen hours × a rate the site does not hold).

### 2.2 Per-university distributions

**CA cs, AS-T, verified (n = 34 colleges per campus).** Rate = per semester unit.

| campus | rate | hours mean | hours min–max | cost mean | cost median | cost min–max | SD |
|---|---:|---:|---:|---:|---:|---:|---:|
| UC Berkeley | $717 | 27.9 | 20–40 | $19,994 | $20,064 | $14,332–$28,663 | $3,098 |
| UCLA | $655 | 26.7 | 15.7–33.3 | $17,522 | $17,368 | $10,268–$21,846 | $3,000 |
| UC Irvine | $676 | 16.3 | 7.3–22 | $11,029 | $11,275 | $4,961–$14,882 | $2,238 |
| UC San Diego | $722 | 15.0 | 9.3–20 | $10,871 | $10,595 | $6,742–$14,448 | $2,487 |
| UC Davis | $723 | 13.4 | 2.7–21.3 | $9,700 | $9,637 | $1,927–$15,419 | $2,531 |
| UC Merced | $678 | 14.0 | 8–20 | $9,505 | $9,491 | $5,424–$13,559 | $2,178 |
| UC Riverside | $671 | 11.6 | 4.7–25 | $7,772 | $7,604 | $3,131–$16,774 | $2,343 |
| UC Santa Cruz | $691 | 10.6 | 5.7–16.7 | $7,280 | $7,371 | $3,916–$11,517 | $2,009 |
| UC Santa Barbara | $708 | 1.6 | 0–7 | $1,114 | $0 | $0–$4,955 | $1,545 |

Rank by hours vs rank by cost: Spearman 0.983 (only Davis/Merced swap). Local AS (verified,
n = 27 per campus): Berkeley $23,930 (33.4 h), UCLA $16,530, Riverside $14,380, UCSD $14,135,
Merced $14,078, Irvine $12,919, Davis $10,101, UCSC $9,180, UCSB $6,563; Spearman 0.983.

**CA bio, AS-T, verified (n = 56 per campus):** UCLA $12,909 (19.7 h), Irvine $12,889,
Berkeley $12,541, Merced $10,654, UCSD $4,988, Davis $3,945, Riverside $3,335, UCSB $636,
UCSC $222 (0.33 h). Spearman 1.0.

**CA econ, AS-T, verified (n = 58 per campus):** Irvine $54 (0.08 h), UCLA $23, the other
seven $0. Local other (n = 12): Irvine $4,228, Davis $3,192, Berkeley $2,568, UCLA $2,512,
the other five $168–$181.

**MA cs, final PDF Figure 5 (printed average row; n = pairs in Fig 4):** Framingham $17,301
(n 6, 35 h), UMass Boston $13,912 (6, 20 h), MCLA $13,455 (2, 26 h), Westfield $10,690 (4,
21 h), Salem $5,449 (5, 11 h), UMass Lowell $4,831 (6, 7 h), Worcester $3,830 (5, 8 h),
Bridgewater $2,836 (5, 6 h), Fitchburg $567 (5, 1 h), UMass Amherst $0 (3), UMass Dartmouth
$0 (2). Printed rates: MCLA $508, Westfield $515, UMass Boston $696, Bridgewater $489,
Fitchburg $473, Framingham $497, Salem $514, UMass Lowell $707, Worcester $491. Pricing
reorders: Boston (20 h) above MCLA (26 h); Lowell (7 h) above Worcester (8 h).

**MA cs, our model (61 pairs, 11 campuses priced):** Framingham $20,922 (n 8, 42.1 h), UMass
Boston $20,607 (8, 29.6 h), UMass Dartmouth $20,166 (3, 31 h), MCLA $12,694 (2), UMass Lowell
$10,604 (7, 15 h; max $41,001 Roxbury), Salem $9,547 (7), Bridgewater $9,499 (7), Westfield
$9,273 (4), UMass Amherst $6,665 (3, 9 h), Worcester $4,665 (6), Fitchburg $3,546 (6).
Spearman 0.918: Lowell moves from 8th by hours to 5th by cost.

**VA cs, frozen Fig 4 hours (n = 16 per university), scheduled supply:** UVA 10.62 (max 31),
VT 9.62, Bridgewater College 9.38, GMU 7.19, CNU 7.12, UMW 6.88, RMC 6.31, UVA-Wise 6.12,
Longwood 6.06, NSU 5.56, UL 5.56, ODU 5.50, VCU 5.19, W&M 4.06, Radford 3.38. Catalog: UVA
2.88, UMW 2.38, Longwood/RMC/UL 2.00 (a constant 2-credit mismatch), VT 1.44, CNU 0.62,
GMU/UVA-Wise/VCU 0.31–0.38, Bridgewater/NSU/ODU/Radford/W&M 0.00.

**VA sensitivity at SCHEV 2025-26 tuition + total mandatory fees ÷ 24 (CONTEXT: SCHEV RD418
Appendix B, https://rga.lis.virginia.gov/Published/2025/RD418):** rates W&M $1,102, UVA
$835, VCU $718, CNU $717, VT $689, LU $677, UMW $640, GMU $596, ODU $555, RU $540, UVA-Wise
$491, NSU $436 (ratio 2.54). Scheduled-supply cost means: UVA $8,871 (max $25,882), VT
$6,628, CNU $5,112, W&M $4,478, UMW $4,401, GMU $4,287, LU $4,105, VCU $3,726, ODU $3,052,
UVA-Wise $3,006, NSU $2,423, Radford $1,821. W&M (4.06 h) prices above GMU (7.19 h) and
Longwood (6.06 h). INFERRED.

### 2.3 Per-college distributions

**CA:** the college axis is comparatively flat because every college faces the same nine
rates; college-level spread comes from AS-T unit totals and articulation gaps (per-college
tables in `stats.json#by_college`).

**MA (final PDF):** Roxbury $17,112–$27,128 across its 7 pairs (every pair nonzero), Bunker
Hill $2,828–$17,383, Northern Essex $5,655–$24,345; Cape Cod $0/$0, Bristol $0/$18,085/$0,
Quinsigamond $0/$12,913/$1,414/$0. Six of 15 colleges have at least one $0 pair.

**VA (frozen hours, scheduled):** Southwest Virginia 21.07 (min 14, max 31), Paul D. Camp
15.73, Central Virginia 15.67, Virginia Highlands 14.47, Wytheville 12.13 — versus 0.67 at J
Sargeant Reynolds, New River, Northern Virginia and Tidewater (sd 0.94). In the all-23 view
Eastern Shore is 23.47 and Southside 22.40 (scheduled); Eastern Shore is 18.27 even in
*catalog* supply. In VA the college, not the university, is the axis of variation — the
reverse of CA.

---

## 3. Comparability verdict

Not without four footnotes, and the one footnote currently in the codebase is the wrong one.

| # | difference | CA | MA | VA | footnote needed |
|---|---|---|---|---|---|
| 1 | Numerator construct | pathway total − 120 | same; final-repo residents normalised to 120; older repo priced resident excess | unused guide credit (denied + unavailable); 124-credit minimum not charged | Yes — a like-for-like VA numerator would be `va_wasted_units + va_degree_units_over_benchmark` (≈ 10.2 scheduled / 4.6 catalog, INFERRED) |
| 2 | Price basis | UCOP 2025-26 tuition + SSF + campus fees | 2024-25 tuition + mandatory fees (workbook "Tuition & Fees"; PDF footnote says fees excluded) | none; SCHEV 2025-26 T + total mandatory fees for 12/15 | Yes — "price year differs; MA paper mislabels its basis", **not** "MA is tuition-only" |
| 3 | Load denominator | 24 (15-u sensitivity) | 24 | would be 24 | No |
| 4 | Cohort | AS-T verified, 9 × 115 universe (306–621 cells) | 49 proximity pairs of 165 (+12 in Fig 7's 61) | 240 guide cells, 16 CS colleges × 15 universities | Yes |
| 5 | Supply basis | ASSIST (catalog) | A2B + websites + equivalency DB | catalog vs scheduled (7× apart) | Yes |
| 6 | Rate dispersion | 1.10 | 1.57 | 2.54 | Yes — dollars amplify campus differences unequally by state |
| 7 | Campuses priced | 9/9 | 9 (code) or 11 (live DB) of 11 | 0 (12 from SCHEV, 3 private) | Yes |
| 8 | Verification | verified default | none (paper values) | frozen `estimated` | Yes |
| 9 | Who pays | UC rate | MA state-university fee structure | VCCS $210/credit for credit already earned | Yes for VA |

Verdict: Fig 5 is comparable across states exactly to the extent Fig 4 is, and no more; it
inherits every Fig 4 caveat and adds price basis, price year and rate dispersion. The one
boundary the site asserts (tuition-only vs tuition + fees) is the one that does not exist.

---

## 4. What the CA cross-major reading adds

* Within CA the rate is effectively constant (~$690 ± 5%), so Fig 5 across majors is Fig 4
  in dollars: CS $10,532 vs bio $6,902 vs econ $9 (AS-T verified). Econ at 98.5% $0 says the
  surcharge is a property of unit-heavy STEM degree structures under the 70-unit cap and
  quarter conversion, not of the articulation system — this **reinforces** a cross-state
  reading in which hours above 120 are driven by degree structure and CS-specific
  articulation (CS2 / data structures / discrete), the same mechanism the brief identifies
  in MA and VA.
* The degree-type contrast (local AS $13,535 vs AS-T $10,532 for CS; $10,870 vs $6,902 for
  bio) is a CA-only lever (SB 1440) with no MA/VA analogue; it **complicates** a single
  cross-state axis.
* Campus story is invariant to pricing in CA (Spearman ≥ 0.98): Berkeley and UCLA are the
  expensive CS destinations because of hours, not rates; UCSB and UCSC are near-free. Fig 5
  adds no campus-level information in CA beyond Fig 4.

---

## 5. Findings

F1 (VERIFIED, cross). Figure 5 is deterministic in Figure 4 in every corpus: CA cells are
`round(unrounded hours × annual/24)` with 9 campus rates in a 1.10 band; MA's 35 nonzero PDF
cells reproduce as hours × 9 printed rates to the cent; no cell in any state has a cost that
is not its hours times its campus constant.

F2 (VERIFIED by artefact + CONTEXT, MA). The MA Cost/Year row ($11,734 Bridgewater … $17,772
UMass Amherst) is the campuses' 2024-25 tuition **plus mandatory fees** (state universities
charge ~$910 tuition), the notebook titles the tab "Tuition & Fees over 120 Credits", and PDF
footnote 7 says fees were excluded; the site's "MA tuition-only" boundary rests on the
footnote, not the workbook.

F3 (VERIFIED, CA vs MA). On the paper's own convention, CA CS AS-T verified pathways cost
$10,532 (306 cells, 2025-26 rates) against MA's $7,129 (49 cells, 2024-25 rates) — 48% higher,
of which 18% is hours (15.2 vs 12.9) and the rest rate ($655–$723 vs $473–$707).

F4 (VERIFIED, MA). The MA headline moves by vintage far more than by rate: $7,129 (final PDF,
49), $8,330 (final repo, 61 = Fig 7), $8,572 (our recalc of the 49 from older-repo sheets),
$9,625 (older repo, 61), $12,000 (our model, 61) — a 1.7× range driven by ten pathways
revised to exactly 120 h and by 4-credit fallbacks in our template join, not by prices.

F5 (VERIFIED, CA cross-major). CA econ AS-T pathways cost $9 on average with 98.5% of 522
verified cells at $0, versus $6,902 (bio) and $10,532 (CS); a CS-only cross-state figure
measures degree structure as much as transfer policy.

F6 (VERIFIED, VA). Virginia has no Figure 5: the page omits it, the live service returns
304 rows all `excluded`, no VA campus has a tuition field; the VA Fig 4 it would price is a
different construct (unused guide credit, mean 0.96 catalog / 6.57 scheduled, 240 cells)
that does not charge 124-credit degree minimums (mean 3.6 over 120).

F7 (INFERRED, VA — challenges "VA is best"). At SCHEV 2025-26 tuition + mandatory fees ÷ 24,
VA's scheduled-supply surcharge averages ~$4,326 over 192 public cells, but UVA averages
$8,871 (max $25,882) and VT $6,628 — UVA's mean exceeds MA's $7,129 headline and its maximum
exceeds every MA PDF cell; VA's rate spread ($434 NSU – $1,102 W&M, 2.54×) is the widest of
the three states, so VA is where pricing would reorder Fig 4 most (W&M at 4.1 h above GMU at
7.2 h).

F8 (VERIFIED, VA mechanism). In VA the surcharge lives on the college axis: scheduled hours
are 21.1 at Southwest Virginia, 15.7 at Paul D. Camp and Central Virginia, 14.5 at Virginia
Highlands versus 0.67 at NOVA, Tidewater, JSR and New River; in CA the college axis is flat
and the campus axis spans $1,114 (UCSB) to $19,994 (Berkeley). Whoever pays in VA pays for
courses a small college lists but does not run.

F9 (VERIFIED, MA mechanism). In the MA final PDF, 14 of 49 priced pairs are $0, concentrated
at the A2B-mapped universities (Bridgewater 4 of 5, Fitchburg 4 of 5, Amherst 3 of 3,
Dartmouth 2 of 2), while non-A2B Framingham ($17,301) and UMass Boston ($13,912) carry the
cost — the same A2B split the brief reports for Fig 1 (56.9% vs 32.7%).

F10 (VERIFIED, site). The live DB prices 11 MA campuses (Amherst $740.50, Dartmouth $650.50
from older-repo cells) while the committed importer documents 9; both workbooks' Cost/Year
rows are identical so no number changes, but live `tuition_source` still reads "CurrComp
Master.xlsx", and the 15-unit `load` knob is one of the Compare-tab knob leaks catalogued
2026-08-23.

F11 (CONTEXT). SCHEV 2025-26 (RD418) publishes full-time in-state tuition + total mandatory
fees per institution (Appendix B) but no per-credit-hour rates; on the annual/24 convention
that suffices for 12 of 15 VA corpus universities (Bridgewater College, Randolph-Macon and
University of Lynchburg are private). VCCS in-state is $5,049/yr (~$210/credit).

F12 (INFERRED, cross). With rate bands of 10% (CA), 57% (MA) and 154% (VA), a cross-state
Fig 5 shows the least rate-driven variation where hours are best verified and the most where
hours are `estimated`; dollars mostly re-express tuition policy (W&M, UVA, UMass vs state
universities) unrelated to transfer.

---

## 6. Contribution score: 3 / 10

* Novelty: low — Fig 4 × a constant; the paper presents it as a translation.
* Defensibility: medium-low — every dollar carries a price year, a basis, a load convention
  and a rate-derivation method (MA rates are back-derived from the authors' own cells), and
  the MA basis is mislabelled in the paper.
* Legibility in one glance: high — "$10,500 extra for a CS transfer" lands where "15 units"
  does not. Its only real asset.
* Cross-state comparability: low today (VA absent; price years differ; VA numerator
  differs). Fixable to medium in ~1 day, without raising novelty.
* Cross-major reinforcement: nothing beyond Fig 4 (Spearman ≥ 0.98; econ ≈ $0 is a Fig 4
  result).

Where it earns its slot: as an annotation on Fig 4 ("at the state's median in-state rate
≈ $X, about one semester of tuition"), or as a rate-free threshold count — share of
pathways ≥ 12 semester units above 120 (one extra semester): CA cs AS-T verified ≈ 60% of
cells, MA PDF 20 of 49, VA scheduled 44 of 240 (INFERRED from the hours distributions).

Effort and disclosure for a real cross-state dollar figure: (1) enter 12 SCHEV Appendix B
rows + 3 private stickers with URLs and year onto VA university records (~2 h); (2) decide
the VA numerator (wasted vs wasted + degree-over-120) — a research decision; (3) re-price MA
on a *sourced* tuition + fees table with price year instead of back-derived rates (~2 h;
also removes the 9-vs-11 ambiguity); (4) correct the "tuition-only" labels in registry,
audit doc and comparison contract; add a price-year footnote; (5) decide pathway- vs
campus-equal weighting (MA $7,129 vs $6,625). Disclosure per figure: price basis, price
year, load denominator, rate derivation, numerator construct per state, n per state.

---

## 7. Proposed visuals and open questions

Visuals:
1. **Fig 4 with a dollar secondary axis** — one panel per state; right-hand axis at the
   state's median in-state rate (CA $691, MA $508, VA $618) with the rate band as a shaded
   ribbon (CA thin, MA medium, VA wide). Retires Fig 5 as a separate matrix.
2. **"Where the surcharge lives" strip** — variance of hours-above-120 decomposed into
   university-axis vs college-axis components per state (CA campus-dominated, VA
   college-dominated, MA mixed with the A2B split). The mechanism finding; no prices.
3. **Threshold count** — share of pathways ≥ 12 and ≥ 24 semester units above 120, per
   state and per CA major; immune to price-basis disputes.
4. **VA supply-vs-price scatter** — per university, x = SCHEV rate, y = scheduled-supply
   hours; shows the expensive destinations (W&M, UVA) are not the ones with the most
   unscheduled coursework.
5. **MA vintage ladder** — the five MA means from F4 as a dot ladder.

Open questions:
* Retract the "MA is tuition-only" boundary in favour of "MA = 2024-25 tuition + mandatory
  fees, mislabelled by the paper"? Touches registry description, contract `price_basis`,
  `docs/ma-paper-audit.md` §Figure 5, and the Compare refusal. Tybalt's call.
* Which VA numerator is like-for-like: unused guide credit, or unused + degree minimum over
  120?
* Weighting: pathway-weighted (paper) or campus-equal? MA moves $7,129 → $6,625; CA and VA
  do not move (balanced designs).
* Price-year harmonisation: restate MA at sourced 2025-26 prices, or keep the paper's rates
  and footnote?
* Should VA "unused" credit be priced at university rates at all, given it was earned at
  VCCS rates?
* The live-DB vs committed-code 9-vs-11 priced MA campuses and the stale `tuition_source`
  label: catalogue with the 2026-08-23 defects, or reseed?
