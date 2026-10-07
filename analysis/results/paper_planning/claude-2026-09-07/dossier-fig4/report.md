# Dossier: Figure 4 — Pathway hours above 120 (`transfer-extra-units`)

Prepared 2026-09-07 for the cross-state analysis workflow. Read-only on the repository.
Scratch artefacts in this directory: `pull.js` (live DB pull), `rows.json` (every live row, CA x slot x cohort + ma-cs),
`ca_ma_summary.json`, `va_summary.json`.

Vintage vocabulary: **final PDF** = `server/data/ma/pdf-figures.json#fig4_extra_hours` (49 cells, transcribed
2026-08-17, gate: reproduces the printed Average row on 10/11 columns); **archive** = `figure-ledgers.json#fig4`
recalculation from the older repo's per-course pathway sheets restricted to the same 49 pairs
(`archived_pathway_sheet_extra_hours`); **ours** = the live `transferCreditRateData` model (`modeled_hours_above_120`);
**frozen VA** = `frontend/src/analyses/vaCreditRateRows.js` built 2026-09-06T23:20Z.

---

## 1. What the figure measures, per corpus

### 1a. The shared construct (component + registry)

`TransferExtraUnits.jsx` renders one CC x university matrix and reads one field per source:

| source | field read | corpora |
|---|---|---|
| `pdf` (MA default) | `published_pdf_extra_hours` | ma-cs |
| `archive-detail` | `archived_pathway_sheet_extra_hours`, only where a PDF value exists (49) | ma-cs |
| `ours` (everything else) | `modeled_hours_above_120` | cs, bio, econ, **and va-cs** |

Registry (`registry.js` 376-460): `comparisonContract` declares `measure: 'pathway-hours-above-120'`, formula
`max(0, semester-equivalent pathway total - 120)`, benchmark 120, cells weighted equally — **except** `va-cs`, which
declares `measure: 'unused-transfer-guide-credit'`, formula `pre-transfer guide credits - credits applying to bachelor
requirements`. The registry already admits the VA pane is a different quantity (gallery title overridden to "Unused
transfer-guide credit"). Knobs: CA = degree slot (ast / local_as / local_other) + verified toggle (default ON); MA =
source (pdf / archive-detail), no cohort toggle; VA = supply basis (catalog / scheduled) + colleges (16 CS / all 23).
Colour ramp anchored at 0, dark end at the observed max.

### 1b. California (cs, bio, econ) — `server/services/analysis/transferCreditRate.js`

Per associate degree (slot) x UC graduation template, the service applies each AS unit at most once in the order
**named articulated course -> GE/breadth capacity -> explicitly authored UC-transferable elective block**. Then
(lines 3345-3366):

    extra           = max(0, asTotal - applied)          // applied INCLUDES elective-counted units
    semesterExtra   = extra x (2/3 if college is quarter)
    pathwaySemester = campus.fullRequiredUnits -> semester + semesterExtra - sourceBoundBonus
    hoursAbove120   = max(0, pathwaySemester - 120)

- **Units, not course counts.** Semester hours; quarter converted at 2/3 (`toSemesterUnits`).
- **GE is IN** "applied" (a GE-capacity match is a home for an AS unit) under the optimal-student assumption.
- **Free electives are IN.** `applied` is the broad allocation (`as_unit_utilization_pct`), not the paper-equivalent
  one (`paper_equivalent_as_unit_utilization_pct` = direct + GE only). Code comment: "Figures 4 and 5 still need every
  credit that can land toward the 120-hour graduation floor." This is the most important construction difference.
- **Cohort.** Figure mounts `verifiedOnly: true`; the pinned baseline is `verifiedOnly:false`. Both pulled live.
- **Denominator.** None — absolute hours. Ceiling = AS total in semester units (60 on every CA cell: AS-T is 60 by
  statute; De Anza / Foothill hold 90 quarter -> 60). Observed max 49.3 (cs local_as).
- **Benchmark check (VERIFIED).** `modeled_hours_above_120 - extra_units_semester` = 0 on all 4,155 CA cells pulled.
  Every UC template converts to exactly 120 semester hours (180 quarter x 2/3 at the seven quarter campuses; 120 at
  Berkeley/Merced). In CA **Figure 4 is identically 60 x (1 - broad utilisation)**.

### 1c. Massachusetts (ma-cs) — three sources

- **final PDF** (49 cells): the authors' `max(0, pathway credit hours - 120)`, pathway = AS credits + resident credits
  not satisfied by the AS. Semester credits, GE in. The 12 Massasoit/Roxbury pathways were removed from Figs 4-6
  (footnote 6) but kept in Fig 7 (`docs/ma-paper-audit.md`).
- **archive**: same 49 pairs, sum of the older repo's per-course pathway sheet Column H minus 120. Ten PDF cells
  changed to 0 relative to the archive typed tally.
- **ours**: the service run on the MA import (final heatmap articulation + recovered resident/pathway courses;
  `method_status: estimated` on order-approximate pairings). Computed on the 61 proximity pairs; 104 of 165 cells null.
  MA has **no elective bucket** — `elective_counted_units` = 0 on all 61 cells (VERIFIED) — so Figure 4 is the exact
  complement of Figure 3 (r = -0.996) plus a resident-length term: declared resident totals are 120/121/122/123
  (VERIFIED) and `modeled_hours_above_120 - extra_units_semester` is 1-3 on 36 of 61 cells.
- AS totals 60-72 credits (mean 63.9) versus a fixed 60 in CA.

### 1d. Virginia (va-cs) — frozen rows, a different measure

`emitVaFigureRows.js` line 154: `modeled_hours_above_120: cell.as_wasted_units`; `buildVaCoverageCells.js` line 419:
`wasted = min(transferable, denied + unavailableApplied)`, where `transferable` is the guide's stated pre-transfer half
(60-66 credits, mean 62.3), `denied` is credit the guide explicitly refuses, `unavailableApplied` is credit for guide
rows the college does not supply, assumed replaced by a substitute doing no requirement work.

- Units (credits). GE: the `assumed` bucket is supplied everywhere by construction, contributing 0 loss.
- **The degree-length term is dropped.** Rows carry `degree_units_stated_minimum` (120-134, mean 123.6) and
  `va_degree_units_over_benchmark` (mean 3.6, max 14 at UVA) but the figure does not add them; the on-page Alert says so.
- Exact complement of VA Figure 3 by construction: utilisation = 1 - wasted / transferable.
- `method_status: estimated` on cells with source warnings (credit ranges at upper bounds).

---

## 2. The numbers

### 2a. Headline and distribution shape (n = finite cells)

| corpus / slot / cohort | vintage | n | mean | median | SD | max | share zero |
|---|---|---:|---:|---:|---:|---:|---:|
| CA cs AS-T, verified | ours (live) | 306 | **15.24** | 14.0 | 8.37 | 40.0 | 5.9% |
| CA cs AS-T, all | ours (live) | 621 | 16.16 | 15.0 | 8.73 | 41.3 | 5.0% |
| CA cs local AS, verified | ours (live) | 243 (9 excl.) | 19.55 | 19.0 | 10.66 | 49.3 | 4.5% |
| CA cs local AS, all | ours (live) | 378 (27 excl.) | 21.08 | 20.7 | 10.99 | 49.3 | 3.4% |
| CA bio AS-T, verified | ours (live) | 504 (9 excl.) | **10.05** | 9.3 | 8.53 | 31.3 | 18.8% |
| CA bio AS-T, all | ours (live) | 873 | 10.22 | 9.3 | 8.75 | 38.7 | 19.6% |
| CA bio local AS, verified | ours (live) | 279 | 15.77 | 16.0 | 10.87 | 43.3 | 9.3% |
| CA econ AS-T, verified | ours (live) | 522 (9 excl.) | **0.01** | 0.0 | 0.12 | 2.0 | 98.5% |
| CA econ AS-T, all | ours (live) | 855 | 0.02 | 0 | 0.12 | 2.0 | 98.0% |
| CA econ local other, verified | ours (live) | 108 | 2.15 | 0.0 | 3.29 | 13.3 | 62.0% |
| MA cs | **final PDF** | 49 | **12.92** | 7 | 12.96 | 42 | **28.6% (14/49)** |
| MA cs | archive (same 49) | 49 | 15.33 | 12 | 11.91 | 42 | 8.2% |
| MA cs | ours on the 49 | 49 | 17.49 | 13 | 14.02 | 52 | 6.1% |
| MA cs | ours, all 61 | 61 | 21.13 | 21 | 15.90 | 58 | 4.9% |
| VA cs, 16 colleges, catalog | frozen VA | 240 | **0.96** | 0 | 1.41 | 7 | 61.7% |
| VA cs, 16 colleges, scheduled | frozen VA | 240 | **6.57** | 4 | 7.36 | 31 | 29.2% |
| VA cs, all 23, catalog | frozen VA | 345 | 2.54 | 0 | 4.52 | 29 | 51.6% |
| VA cs, all 23, scheduled | frozen VA | 345 | 9.47 | 7 | 8.62 | 40 | 20.3% |
| VA MA-style (wasted + stated_min - 120), 16, catalog | our computation | 240 | 4.56 | 4 | 4.35 | 21 | 12.1% |
| VA MA-style, 16, scheduled | our computation | 240 | **10.17** | 8 | 8.92 | 45 | 7.1% |

All CA and MA "ours" rows VERIFIED by live pull (`pull.js`, 2026-09-07); the pinned baseline (`cs|ast` 16.164,
`cs|local_as` 21.077, `bio|ast` 10.225, `econ|ast` 0.015, `ma-cs|local_as` 21.131) reproduces exactly on the unverified
cohort. `docs/visualizations.md` s9 "15.3 / 10.1 / 0.01" are verified-cohort values and reproduce (15.24 / 10.05 / 0.01).
The brief's "MA ours 15.3" is the **archive** vintage on 49 pairs, not the live model (21.1 on 61, 17.5 on the same 49).
MA PDF VERIFIED against the transcription (sum 633, mean 12.918); **the transcription holds 14 zero cells, not 11**.

### 2b. Per-institution spread (means of cell values per institution)

Universities

| corpus | n | min | median | max | SD | detail |
|---|---:|---:|---:|---:|---:|---|
| CA cs AS-T verified | 9 | 1.6 | 14.0 | 27.9 | ~8.0 | UCSB 1.6, UCSC 10.6, UCR 11.6, UCD 13.4, UCM 14.0, UCSD 15.0, UCI 16.3, UCLA 26.7, Berkeley 27.9 |
| CA cs local AS verified | 9 | 9.3 | 19.6 | 33.4 | — | UCSB 9.3 ... UCLA 25.2, Berkeley 33.4 |
| CA bio AS-T verified | 9 | 0.3 | 6.9 | 19.7 | — | UCSC 0.3, UCSB 0.9, UCR 4.9, UCD 5.5, UCSD 6.9, UCM 15.7, Berkeley 17.5, UCI 19.0, UCLA 19.7 |
| CA econ AS-T verified | 9 | 0 | 0 | 0.1 | 0 | all ~0 |
| MA final PDF | 11 | 0 | 7.8 | 34.8 | 11.1 | Dartmouth 0, Amherst 0, Fitchburg 1.2, Bridgewater 5.8, Lowell 6.8, Worcester 7.8, Salem 10.6, Boston 20, Westfield 20.8, MCLA 26.5, Framingham 34.8 |
| MA archive (49) | 11 | 2.4 | 15.0 | 34.8 | 9.5 | Fitchburg 2.4 ... Framingham 34.8 |
| MA ours (61) | 11 | 7.5 | 18.6 | 42.1 | 10.2 | Fitchburg 7.5 ... Framingham 42.1 |
| VA catalog (16) | 15 | 0 | 0.4 | 2.9 | 1.0 | Bridgewater/NSU/ODU/Radford/W&M 0 ... UVA 2.9 |
| VA scheduled (16) | 15 | 3.4 | 6.1 | 10.6 | **1.9** | Radford 3.4, W&M 4.1 ... VT 9.6, UVA 10.6 |

Community colleges

| corpus | n | min | median | max | SD |
|---|---:|---:|---:|---:|---:|
| CA cs AS-T verified | 34 | 10.0 | 15.4 | 18.5 | **1.8** |
| CA cs local AS verified | 27 | 7.8 | 20.3 | 40.6 (Fullerton) | 7.1 |
| CA bio AS-T verified | 56 | 4.9 | 10.1 | 17.0 (Irvine Valley) | 2.5 |
| CA econ AS-T verified | 58 | 0 | 0 | 0.2 | 0 |
| MA final PDF | 13 | 0 (Cape Cod) | 13.7 | 28.5 (Berkshire) | 6.8 |
| MA archive (49) | 13 | 7.2 | 14.7 | 28.5 | 4.9 |
| MA ours (61) | 15 | 9.3 | 17.4 | 44.1 (Roxbury) | 8.6 |
| VA catalog (16) | 16 | 0.7 | 0.7 | 1.9 | 0.45 |
| VA scheduled (16) | 16 | 0.7 | 3.8 | 21.1 (Southwest Virginia) | **6.6** |
| VA scheduled (23) | 23 | 0.7 | 7.1 | 23.5 (Eastern Shore) | 7.8 |

VA scheduled tail: Southwest Virginia 21.1, Central Virginia 15.7, Paul D. Camp 15.7, Virginia Highlands 14.5,
Wytheville 12.1; four colleges (J Sargeant Reynolds, New River, NOVA, Tidewater) at 0.7.

### 2c. Companion quantities

| corpus | AS total (sem) | pathway total (sem) | Fig 3 paper-equiv | broad utilisation | elective-counted units | r(Fig3,Fig4) | r(broad util,Fig4) |
|---|---|---|---|---|---|---:|---:|
| CA cs AS-T verified | 60.0 | 135.2 (120-160) | 67.0% | 74.6% | 4.6 (0-18) | -0.86 | **-1.00** |
| CA cs local AS verified | 60.0 | 139.6 | 59.9% | 67.4% | 4.6 | -0.91 | -1.00 |
| CA bio AS-T verified | 60.0 | 130.1 | 73.9% | 83.2% | 5.7 (0-25) | -0.79 | -1.00 |
| CA econ AS-T verified | 60.0 | 120.0 (120-122) | 60.8% | **99.98%** | **24.0 (14.7-45)** | -0.05 | -1.00 |
| CA econ local other verified | 60.0 | 122.2 | 49.1% | 96.4% | 29.5 | -0.38 | -1.00 |
| MA ours (61) | 63.9 (60-72) | 141.1 (120-178) | 68.6% | 68.6% | 0 | -0.996 | -0.996 |
| MA final PDF (49) | — | — | PDF Fig 3 | — | — | **-0.864** | — |
| VA scheduled (16) | 62.3 (60-66) | n/a | 89.5% | same | n/a | -1 (identity) | -1 |

---

## 3. Comparability verdict

**A reader cannot put the three states on one axis as the figure now stands.** Footnotes required:

1. **VA is a different measure.** It omits the degree-length term. VA guides state 120-134 credits (mean 123.6; UVA
   134, VT 129, GMU 128, NSU 125, Bridgewater 124). Adding `max(0, stated_min - 120)` moves VA from 0.96 -> 4.56
   (catalog) and 6.57 -> **10.17** (scheduled): from "a fifth of MA" to within 3 hours of MA's PDF and equal to CA bio.
2. **CA counts free electives as a home; MA and VA do not.** CA Figure 4 = 60 x (1 - broad utilisation), where broad
   utilisation includes authored UC-transferable elective blocks (mean 4.6 units cs, 5.7 bio, **24.0 econ**). MA's
   model has no elective bucket (0 on all 61 cells); VA's construction has none. Under the MA/VA construction CA would
   read higher by roughly the elective-counted units: cs ~ +4.6, bio ~ +5.7, econ ~ +24.
3. **Benchmark vs resident length.** CA: every UC template is exactly 120 semester-equivalent (VERIFIED). MA: 120-123
   (36/61 cells carry 1-3 hours of resident length). VA: 120-134. The 120 benchmark is only "right" in CA.
4. **AS length.** CA 60 fixed (SB 1440 AS-T); MA 60-72 (mean 63.9); VA 60-66 (mean 62.3). Ceiling 60 / 72 / 66.
5. **Unit systems.** CA converts quarter <-> semester at 2/3 consistently (only De Anza and Foothill are quarter
   colleges; seven UCs are quarter campuses at 180 -> 120). MA and VA are semester-only.
6. **Cohort / population.** CA: 9 UCs x every college holding the slot degree, verified-only by default (cs AS-T 306 of
   621). MA PDF: 49 proximity-selected pairs (<= 50 mi) after removing 12 Massasoit/Roxbury pairs whose omission lowers
   the mean (Fig 7 implies 916/61 = 15.0; our model puts Roxbury at 44.1). VA: 15 guides x 16 (or 23) colleges.
7. **Loss mechanism.** CA: articulation gaps net of receiving-curriculum slack. MA: articulation gaps (+ revision
   artefacts: 10 PDF cells changed to 0 vs the archive). VA: course supply only — the guide IS the pathway, so catalog
   is ~0 by construction and loss appears only when a college does not teach/schedule a named course or a guide denies
   SDV 100/101.
8. **GE treatment.** CA optimal-student GE; MA GE as the authors' pathway sheets recorded it; VA `assumed` bucket at
   100%. All three put GE inside "applied", by different assumptions.
9. **Method status.** VA and MA-ours cells are `estimated`; the MA PDF is a transcription (MCLA 26.5 printed 26).
10. **Weighting.** All panes cell-equal; the MA paper's own campus-equal value is 12.2, not 12.9.

Like-for-like is achievable with two moves: (a) report **unused AS credit** (pathway - resident) instead of pathway -
120 — what CA and VA already compute; MA differs by <= 3 hours; (b) either add an elective bucket to MA/VA or switch CA
to `paper_equivalent` (60 x (1 - Fig 3)). After (a)+(b) the figure collapses into Figure 3 expressed in hours (F6).

---

## 4. What the CA cross-major reading adds

cs 15.2 -> bio 10.1 -> econ 0.01 (AS-T, verified). This is **not** an articulation ordering (Fig 3 paper-equivalent:
bio 73.9% > cs 67.0% > econ 60.8%). Econ has the lowest share of AS credit meeting a requirement yet ~0 hours above
120, because UC economics templates carry ~24 semester units of free-elective room that absorb the unmatched AS credit
(broad utilisation 99.98%). Bio is intermediate (5.7 elective units); cs has the least slack (4.6) plus the heaviest
lower-division load.

So the cross-major reading *complicates* the cross-state story: Figure 4 is largely a property of the **receiving
degree's elective slack**, not of the state's articulation system. In CA the variance sits at the university (cs AS-T:
UC means 1.6-27.9, SD ~8; college means 10.0-18.5, SD 1.8). A UCSB CS transfer loses 1.6 hours and a Berkeley CS
transfer 27.9 hours from the same colleges with the same AS-T. Cross-state, "MA 12.9 vs CA 15.2" is dominated by which
universities are in each sample and how unit-dense their majors are, not by policy.

Where it reinforces: bio's 18.8% zero share and UCSC/UCSB near-zero means show that a statewide AS-T + IGETC system can
produce MA-like zero pathways at some campuses — the same pattern as MA's Amherst/Dartmouth zeros — while leaving
Berkeley/UCLA at MA-Framingham levels. The between-university spread inside CA (26 hours) is as large as the
between-state spread of the headlines.

---

## 5. Candidate findings

Status: VERIFIED = reproduced from the artefact this session; INFERRED = reasoning over verified numbers; CONTEXT =
policy fact not checked this session.

**F1 (VERIFIED, cross).** Headline hours above 120 as built: CA cs AS-T 15.2 (306 verified cells), CA bio AS-T 10.1
(504), CA econ AS-T 0.01 (522), MA final PDF 12.9 (49), VA 0.96 catalog / 6.6 scheduled (240) — but VA's pane is a
different measure (unused guide credit without the degree-length term), so the ranking VA < MA < CA-cs is not
like-for-like.

**F2 (VERIFIED, challenges "VA is best").** Putting VA on the MA construction (wasted credit + max(0, stated degree
minimum - 120)) raises VA to 4.6 catalog / **10.2 scheduled** (240 cells), because 12 of 15 guides state degrees above
120 (mean 123.6; UVA 134 alone contributes +14 to every UVA cell). On that construction VA-scheduled equals CA bio
(10.1) and sits within 3 hours of MA's PDF (12.9); VA's lead over CA cs shrinks from 8.6 to 5.1 hours.

**F3 (VERIFIED, mechanism).** The axis of variation differs by state: CA cs AS-T university means span 1.6 (UCSB) -
27.9 (Berkeley) with college means compressed to 10.0-18.5 (SD 1.8); VA scheduled college means span 0.7 - 21.1
(Southwest Virginia, SD 6.6) with university means compressed to 3.4-10.6 (SD 1.9); MA PDF varies on both (university
0-34.8, SD 11.1; college 0-28.5, SD 6.8). CA fails at the receiving curriculum, VA at the sending college's course
supply, MA at university-level articulation policy.

**F4 (VERIFIED, challenges "VA is best").** Five of Virginia's 15 CS guides (Longwood, RMC, UL, UMW, UVA) explicitly
deny the VCCS-required SDV 100/101 orientation credit ("No transfer credit"), so a third of VA cells carry 2 wasted
credits even in catalog view (denied mean 0.67); under scheduled supply three colleges (Southwest Virginia 21.1, Central
Virginia 15.7, Paul D. Camp 15.7) lose more credit per pathway than any CA college does under the cs AS-T (max 18.5)
and more than the MA PDF's median college (13.7).

**F5 (VERIFIED, zero inflation).** Zero shares: 5.9% CA cs, 18.8% CA bio, 98.5% CA econ, 28.6% MA PDF (14 of 49, not
the 11 in the brief), 8.2% MA archive, 61.7% VA catalog, 29.2% VA scheduled. Means mislead in MA and VA (PDF median 7 vs
mean 12.9; VA scheduled median 4 vs mean 6.6); an ECDF or distribution, not a mean, is the honest cross-state display.

**F6 (VERIFIED, redundancy with Fig 3).** Figure 4 is (near-)determined by Figure 3 wherever the receiving degree has
no elective slack: r = -0.996 MA-ours (61), -0.864 MA PDF (49, PDF Fig 3 vs PDF Fig 4), -1 by construction in VA; in
CA it is exactly -1.00 against broad utilisation and -0.86 / -0.79 against paper-equivalent Figure 3 for cs / bio,
falling to -0.05 for econ. Figure 4 adds information beyond Figure 3 only in CA, and what it adds is the receiving
template's free-elective room (econ: Fig 3 60.8% but Fig 4 0.01, elective-counted 24 units).

**F7 (VERIFIED, MA internal inconsistency).** In the final PDF, 10 of the 14 zero-hour cells report Figure 3 below
100% on the same page (Holyoke x Amherst: 48% applies yet 0 hours; Cape Cod x Bridgewater 87%), and all 5 cells at
Figure 3 = 100% that show positive hours are UMass Lowell (+2 to +6). The paper's Figures 3 and 4 are not complements;
ten PDF cells were revised to zero relative to the archive (archive mean 15.3 vs PDF 12.9 on the same pairs).

**F8 (VERIFIED, MA cohort sensitivity).** The MA headline moves by more than 8 hours with vintage and cohort alone:
PDF 12.9 (49) -> archive 15.3 (49) -> ours 17.5 (49) -> ours 21.1 (61); Figure 7's all-61 arithmetic implies 15.0, and
the 12 omitted Massasoit/Roxbury pathways are the worst (our Roxbury mean 44.1).

**F9 (VERIFIED, benchmark).** The 120 benchmark is exact only in CA: all 9 UC templates convert to 120 semester hours
(seven quarter campuses at 180 x 2/3), so `modeled_hours_above_120` equals unused AS semester units on every one of
4,155 CA cells; MA resident plans run 120-123 (36/61 cells differ by 1-3 hours); VA 120-134. A "pathway minus resident
length" measure equals unused AS credit in all three states and removes the degree-length confound.

**F10 (VERIFIED, cohort/slot).** Verified-only cohorts read slightly better (cs AS-T 15.2 vs 16.2; local AS 19.6 vs
21.1), and the local AS costs 4-6 more hours than the AS-T (cs +4.3, bio +5.7) with a much wider college spread (cs
local AS colleges 7.8-40.6, Fullerton 40.6).

**F11 (INFERRED, the bottleneck moves).** The VA scheduled tail is driven by the same computing courses that fail to
articulate in CA and MA — CSC 223 Data Structures, CSC 222 OOP, CSC 205/215 Computer Organisation, CSC 208 / MTH 288
Discrete (orchestrator scouting; sample cell Central Virginia x Bridgewater loses 26 credits on exactly those rows).
Common course numbering and university-authored guides move the failure from the articulation layer to the offering
layer; Figure 4 shows the magnitude of that residual loss but not the mechanism without a decomposition.

**F12 (CONTEXT, unchecked this session).** Policy anchors: CA SB 1440 fixes the AS-T at 60 semester units and UC's
70-unit transfer cap (assist.org; cccco.edu); MassTransfer A2B and the 34-credit General Education Foundation
(mass.edu/masstransfer); Transfer Virginia portal and VCCS common course numbering (transfervirginia.org).

---

## 6. Preliminary contribution score: 4 / 10

- Novelty: low as built — in MA and VA the figure is Figure 3 in hours (F6); the only new content is CA's elective-slack
  effect, a finding about UC curricula rather than about states.
- Defensibility: weak cross-state — the VA pane is a different measure (F1/F2), the 120 benchmark is exact only in CA
  (F9), and the MA figure is internally inconsistent and cohort-sensitive (F7/F8).
- One-glance legibility: high — "extra semesters" is the most intuitive unit in the paper and the zero-inflated shape is
  striking; this is the figure's strongest asset.
- Cross-state comparability: poor without reconstruction; good after a resident-relative measure and a common elective
  rule, at which point it is a re-scaled Figure 3.
- Cross-major reinforcement: complicates rather than reinforces (s4) — but that complication (F3: the axis of variation)
  is the most interesting thing the figure says.

Recommendation: keep Figure 4 as the legible companion to Figure 3, but make its decomposition (degree length /
articulation loss / supply loss / denied credit) the visual, not the total.

---

## 7. Proposed visuals and open questions

### Visuals
1. Decomposed bar per state (MA-style construction, common axis): hours above 120 = (resident length - 120) +
   articulation-gap credit + supply-gap credit + denied credit + revision residue. VA reads "degree length + supply", MA
   "articulation", CA "articulation net of elective slack". The one chart that shows why each state fails.
2. Axis-of-variation plot: per state, two horizontal dot-strips — university means and college means — on one 0-45
   axis. CA spreads on the university strip, VA on the college strip, MA on both (F3).
3. ECDF / stacked histogram of cell values per state with the zero mass drawn as its own bar (F5), replacing the mean row.
4. Fig 3 x Fig 4 scatter per state with the complement line y = AS_total x (1 - x): CA points fall below the line by
   the elective wedge, MA-PDF points scatter (F7), VA points sit on it.
5. VA catalog -> scheduled slope chart per college (16 lines) annotated with missing course codes, plus a "same course,
   different failure layer" table (CS2 / data structures / discrete / computer organisation: articulation failure in CA
   and MA vs scheduling failure in VA).
6. CA cross-major triptych (cs / bio / econ) of university means, showing econ collapsing to 0 by elective room rather
   than by articulation.

### Open questions
- Should the cross-state figure switch to unused AS credit (pathway - resident) with a common elective rule? That makes
  it a re-scaling of Figure 3 — is a separate figure then warranted?
- Does CA's authored elective bucket (mean 24 units in econ) reflect real UC free-elective policy or template authoring?
  If the former, MA's and VA's models understate what applies.
- Why do 10 MA PDF zero cells coexist with Figure 3 < 100%? Do Amherst/Dartmouth/Bridgewater accept unlimited free
  electives (the CA-econ mechanism), or is it revision?
- The brief's "11 zeros" vs the transcription's 14 — which count did the orchestrator use?
- Which term does the VA scheduled snapshot represent, and how stable is the tail (Southwest Virginia 21.1) across terms?
- The VA SDV denial: guide statement or university catalogue rule, and is there a CA/MA analogue (orientation credit
  is not in the CA AS-T)?
- MA: reinstating the 12 Massasoit/Roxbury pathways changes the headline from 12.9 to ~15.0 — which cohort should the
  cross-state paper use?
- Only two CA colleges are quarter-based; conversion is verified exact but De Anza lacks a local-AS slot (only Foothill).
