# dive-ca-cross-major — CA cs / bio / econ as replication for the cross-state statements, and the AS-T policy contrast

Date 2026-09-07. All "our computation" numbers below were pulled live from Atlas with
`pull.js` (coverageData requirements=degree, college grouping; transferCreditRateData for
ast / local_as / local_other × verifiedOnly true/false) and analysed with `analyze1.py`,
`analyze2.py`, `analyze3.py` in this directory; raw pulls are under `data/`. MA numbers name
their vintage (final PDF = `server/data/ma/pdf-figures.json`; older repo = `raw/heatmap.json`,
`raw/baselines.json`; our computation = ma-cs rows from the same two service calls). VA
numbers come from the frozen 2026-09-06 modules (`vaCoverageRows.js`, `vaCreditRateRows.js`,
`vaTransferGuides.js`). Nothing in the repository was edited.

Vocabulary: "courses_noGE" = `pct_named_requirement_courses` (the paper's Fig 1 measure);
"courses_GE" = `..._with_ge`; "units_noGE" = (named units covered − GE units covered)/(named
units − GE units); "units_GE" = named units covered / named units; "cap-aware" =
`pct_degree_units` (carried credit capped at 70/105 units ÷ stated total). Cell = one CC × one
UC campus (1035 per major). Campus mean = mean over its 115 colleges; college mean = mean over
its 9 campuses.

---

## 1. Per-campus Figure 1 ordering across the three majors: it flips (major effect); the college ordering does not (college effect)

**VERIFIED (our computation, 3 × 1035 cells, verified templates, courses_noGE).**

| campus | cs | bio | econ | rank cs/bio/econ |
|---|---:|---:|---:|---|
| UC Berkeley | 41.0 | 50.9 | 21.3 | 2/5/6 |
| UC Davis | 33.5 | 38.8 | 15.9 | 4/9/9 |
| UC Irvine | 21.0 | 57.4 | 32.3 | 8/1/1 |
| UC Merced | 45.9 | 50.5 | 26.6 | 1/6/3 |
| UC Riverside | 35.5 | 55.6 | 24.9 | 3/3/5 |
| UC San Diego | 21.0 | 48.8 | 26.3 | 9/8/4 |
| UC Santa Barbara | 30.0 | 56.1 | 19.0 | 6/2/7 |
| UC Santa Cruz | 26.5 | 52.4 | 29.9 | 7/4/2 |
| UCLA | 32.9 | 50.2 | 17.3 | 5/7/8 |
| cell mean | 31.9 | 51.2 | 23.7 | (matches figure-baseline.json 31.915 / 51.179 / 23.729) |

- Spearman of the campus ordering: cs–bio **−0.15**, cs–econ **−0.32**, bio–econ 0.50. UC Irvine is
  last for CS (21.0) and first for both bio (57.4) and econ (32.3); Merced is first for CS and
  6th/3rd elsewhere. The only campus low in more than one major is Davis (9th in bio and econ,
  4th in CS). There is no "bad campus" that replicates across majors.
- The college ordering DOES replicate: Spearman cs–bio 0.57, cs–econ 0.43, bio–econ 0.29
  (Pearson 0.80 / 0.66 / 0.61). The same colleges sit at the bottom of all three majors —
  Palo Verde (cs 2, bio 10, econ 13), Lassen (9/33/20), Feather River (15/37/22), Coalinga,
  Lemoore, Taft, Woodland — and the same large suburban colleges at the top (Orange Coast,
  Pasadena, De Anza, Diablo Valley, LA Valley, Cosumnes River).
- Two-way variance decomposition of the 1035 cells (campus + college main effects, courses_noGE):
  cs campus 57% / college 30% / residual 13%; bio 29% / 41% / 30%; econ **76% / 6%** / 18%. Econ's
  college spread is tiny (college sd 1.5 pts vs 5.7 cs, 6.3 bio): econ cannot carry a
  college-axis story at all.
- Why the campus axis flips: the campus mean is mostly the template's structure (see §2 and
  §5). The lower-division share of named non-GE requirements is 47% for CS, 59% bio, 31% econ,
  and within a major it ranges 37–68% (cs), 45–67% (bio), 25–44% (econ) across campuses.

**What this says for the cross-state statement.** Within a state, Fig 1's between-university
spread is dominated by how much upper-division work the template names, not by articulation
quality. MA's 11.7 (Framingham, 9 of 20 columns lower-division) to 70.1 (Fitchburg, 12 of 23)
spread (final PDF bottom row; orchestrator scouting) is the same phenomenon. The CA majors
replicate the point three times: the axis that is stable across majors is the *college* axis
(what the sending college teaches and articulates), and that is the axis where a
between-state comparison of "the same college × many receivers" is meaningful.

## 2. The own-discipline bottleneck: CS-specific on lower-division scope; the whole-degree number is mostly the ceiling

**VERIFIED (our computation; `degree_requirements_by_course_type`, campus-equal means; MA rows
are our engine typing of the ma-cs docs, 165 cells, which reproduces the paper's Fig 2
computing 21.3 vs stated 22, math 60.6 vs 60, science 92.8 vs 93).**

| major (n campuses) | own whole | own lower-div | LD share within own | own share of named | quant whole/LD | support whole/LD |
|---|---:|---:|---:|---:|---|---|
| CA cs (9) | **11.5** | **45.7** | 27% (19–50) | 67% | 78.7 / 83.0 | 63.3 (n=7) / 77.9 |
| CA bio (9) | 42.7 | 85.0 | 51% (24–100) | 34% | 75.3 / 79.0 | 88.4 / 90.8 |
| CA econ (9) | 15.1 | 91.6 | 17% (11–25) | 66% | 64.5 / 67.7 | 100 (n=2) |
| MA cs (11, our typing) | 21.3 | **40.9** | 41% (27–57) | 66% | 60.6 / 67.4 | 92.8 / 92.8 |

- On lower-division scope the own-discipline problem is **computing-specific**: CS 45.7 (CA) and
  40.9 (MA) against bio 85.0 and econ 91.6. Bio and econ are the controls: at the same colleges,
  under the same ASSIST layer, the sending side supplies the lower-division major courses of a
  science and a social-science degree at 85–92%.
- The whole-degree own-discipline numbers are ordered by the lower-division share within the
  discipline, not by articulation: econ 17% LD → 15.1; cs 27% → 11.5; bio 51% → 42.7; MA cs
  41% → 21.3. **The "CA computing is half of MA" contrast in `ma-course-type-spread.md`
  (11.5 vs 22) is ~three-quarters structural**: on lower-division scope CA CS is 45.7 vs MA 40.9,
  i.e. CA is 5 points *higher*. The whole-degree Fig 2 should not be read across states without
  the LD control.
- Lower-division-only Fig 1 (GE excluded), cell means: CA cs 68.2, CA bio 86.7, CA econ 76.6, MA cs
  **57.3** (our typing; the orchestrator's LD-only means from `raw/heatmap.json` average 57.5).
  On this scope CA CS beats MA CS by 11 points, the reverse of the whole-degree ordering
  (31.9 vs 38.2). The cross-state Fig 1 ordering is not robust to the scope choice.
- Per-campus CS lower-division computing ranges from 18.4 (Berkeley) to 72.6 (Riverside); MA's
  ranges 12.2 (Framingham) to 85.3 (Fitchburg). Both states have a computing-LD floor near 15
  and a top near 75–85; the state means differ by 5 points and the spreads overlap almost
  entirely.

## 3. The AS-T vs local-AS gap: +10–11 points in every major, positive at all 27 campus×major cells; MA and VA have no like-for-like counterfactual

**VERIFIED (our computation, transferCreditRateData, `paper_equivalent_as_unit_utilization_pct`;
"paired" = same college × same campus has both degree types).**

| major, cohort | AS-T mean (n, colleges) | local mean (n, colleges) | unpaired gap | paired gap (n pairs, colleges) | share AS-T higher / equal |
|---|---|---|---:|---|---|
| cs, verified (mounted) | 67.0 (306, 34) | local_as 59.9 (243, 27) | +7.1 | **+10.8** (108, 12) | 75% / 14% |
| cs, all | 65.4 (621, 69) | 57.3 (378, 42) | +8.1 | +10.7 (180, 20) | 71% / 12% |
| bio, verified | 73.9 (504, 56) | local_as 62.8 (279, 31) | +11.1 | **+10.1** (225, 25) | 69% / 13% |
| bio, all | 73.6 (873, 97) | 62.4 (495, 55) | +11.2 | +10.3 (450, 50) | 71% / 13% |
| econ, verified | 60.8 (522, 58) | local_other 49.1 (108, 12) | +11.7 | **+11.3** (108, 12) | 75% / 21% |
| econ, all | 60.7 (855, 95) | 49.1 (207, 23) | +11.6 | +11.5 (207, 23) | 79% / 18% |

(cs|ast all = 65.414 and cs|local_as all = 57.266 reproduce figure-baseline.json; the verified
cs|local_as 59.9 here vs the memory's 60.2 is the same cohort with the current DB.)

- Per campus, paired, verified: cs Berkeley +13, Davis +6, Irvine +9, Merced +14, Riverside +18,
  SD +8, SB +16, SC +9, UCLA +6; bio Berkeley +2, Davis +18, Irvine +8, Merced +9, Riverside +12,
  SD +7, SB +15, SC +13, UCLA +7; econ Berkeley +11, Davis +11, Irvine +15, Merced +3,
  Riverside +10, SD +15, SB +8, SC +16, UCLA +12. All 27 cells positive. The gap is not a
  constant (range +2 to +18) but the sign never flips.
- Mechanism: AS totals are identical (cs 60.1 vs 60.0 semester units; bio 62.5 vs 62.4; econ
  62.5 vs 62.5) — the AS-T applies ~6–7 more units of the same 60 (cs 40.6 vs 34.1 transferred;
  bio 46.8 vs 40.8; econ 37.6 vs 30.8). Hours above 120 fall correspondingly: cs 14.9 → 21.3,
  bio 9.5 → 14.6, econ 0.0 → 2.1 (Fig 4 is the same finding).
- Cohort sensitivity is small: verified vs all moves AS-T means by ≤1.6 pts and local by ≤2.6.
- Shape: CA AS-T cells are unimodal (sd 6–13), **0% at 100%**, ≥90% in 0–8% of cells; local AS has
  a lower tail (<50% in 28% cs, 24% bio, 58% econ local_other cells).

**MA analogue (A2B vs non-A2B pairs; the "MT" flag lives only in `raw/heatmap.json`, never
imported — figure-defect catalogue / ma-state-port).** VERIFIED:
- Fig 1, older-repo raw: A2B 38 pairs **56.9** vs 127 non-mapped 32.7 (reproduces orchestrator);
  lower-division only 83.4 vs 49.7. Within-university: Bridgewater 53.6 vs 21.8, Fitchburg 74.3
  vs 58.7, Amherst 49.2 vs 30.7, Dartmouth 44.6 vs 31.9 (only these four have any A2B pairs).
- Fig 3, final PDF: A2B **13 pairs mean 94.8 (87–100)** vs 48 non-A2B 60.4 (+34); Fig 4 final PDF:
  A2B 11 pairs all **0** hours vs 16.7 for the 38 others. Our recomputation on the same 61 pairs:
  A2B 82.0 vs 64.9 (+17); hours 13.4 vs 23.2. The 61-cell distribution is trimodal (PDF: 19 cells
  ≥90, 26 mid, 16 <50).
- INFERRED: the A2B pathway workbook is built from the A2B map, and MassTransfer's A2B promise
  is exactly "all credits apply, 120 total". The PDF's 94.8 / 0 hours are therefore the map
  restated as an outcome (our recomputation of their own workbook gives 82, which is what the
  tally sheet actually supports). That is a different kind of number from CA's +10.8.

**VA analogue.** The frozen guide join gives utilisation 98.5 (catalog) / 89.5 (scheduled) on 240
cells (vaCreditRateRows pooled 0.98471 reproduces the audit table). The "canonical derivation"
(course-equivalency × degree-requirement join, 2026-08-15, memory va-state-port) read Fig 3
24.1% over 124 cells and Fig 1 35.5% over 384 cells — a different population, a different
vintage and a rejected data path (docs/virginia-final-audit.md says the canonical path does
not establish the figures). CONTEXT/INFERRED: in VA the guide *is* the pathway; there is no
unguided pathway in the data to pair against, so the within-VA "guide effect" is not
measurable — only supply loss is (catalog → scheduled, −9 pts).

**Verdict on "a state-guaranteed pathway raises the credit rate by X points".** Defensible
only in CA, and there it is well-supported: +10–11 points, paired, replicated in three majors,
positive at every campus, with the mechanism (same 60 units, 6–7 more applied) visible. It is
the only state where the guarantee (a statewide Transfer Model Curriculum) is measured against
degree templates the guaranteeing body did not write. In MA the guarantee is bilateral and the
pathway artefact was authored from it (+34 PDF / +17 our recomputation, n=13 vs 48); in VA it
is universal and the artefact is the guide itself (no comparator). The cross-state sentence
that survives is about the *form* of the guarantee: CA's is partial and never reaches 100% in
any of 1,332 AS-T cells; MA's is all-or-nothing and exists for 38 of 165 pairs; VA's is
everywhere and moves the loss from articulation to scheduling.

## 4. Which CA major is like-for-like with MA-CS and VA-CS

Structure of the named non-GE requirement population (our typing; VA from the guide rows):

| corpus | own-discipline share of named | lower-div share of named | LD share within own | quant share | GE share of named courses |
|---|---:|---:|---:|---:|---:|
| CA cs | 67% (53–84) | 47% (37–68) | 27% | ~20% | 25% |
| CA bio | 34% (9–55) | 59% (45–67) | 51% | ~11% | 22% |
| CA econ | 66% (41–88) | 31% (25–44) | 17% | ~28% | 35% |
| MA cs | 66% (45–84) | 57% (45–72) | 41% | 17% | — (GE never in the heatmap) |
| VA cs (15 guides) | 36% of all guide credits (8–55; GMU 8 is a typing artefact) | 50% by construction | 44% (27–100) | — | GE enumerated inside the guide (≈40% of pre-transfer credits are non-CS/math/sci) |

- **CS is the like-for-like major** for MA-CS: same own-discipline share (67 vs 66), same place
  of the bottleneck (lower-division computing 45.7 vs 40.9), same whole-degree ceiling logic.
  The one structural difference — CA templates name less lower-division work (47% vs 57%) — is
  exactly what depresses CA's whole-degree Fig 1/Fig 2 relative to MA and must be disclosed.
- **Bio is the positive control**: same colleges, same ASSIST, lower-division own discipline
  85% articulated, highest AS-T utilisation (73.9). It shows the CS gap is not "UC transfer".
  It would mislead as a like-for-like: its own-discipline share (34%) and chemistry-heavy
  support block make its Fig 2 columns mean different things.
- **Econ is the ceiling control**: whole-degree own-discipline 15.1 looks CS-like, but its
  lower-division own discipline is 91.6% articulated — the low number is 17% LD share. Econ
  would mislead in three ways: (i) it manufactures a fake "econ bottleneck" on whole-degree
  scope; (ii) its GE share of named courses is 35%, so GE inclusion doubles it (23.7 → 48.1) and
  it overtakes CS; (iii) its college axis is flat (sd 1.5; college explains 6% of variance), so
  it cannot replicate a college-level story. Its Fig 3 counterpart is also the thin
  `local_other` cohort (12 verified colleges).
- VA-CS resembles none of the three on the Fig 1 population: guides are GE-inclusive by design
  (`named_requirement_courses_with_ge_total` 124 = all credits; the paper-faithful field is an
  estimate), and the pre-transfer half is 50% by construction. VA is like-for-like with CA/MA
  only on the *lower-division computing* question (44% of computing credits are pre-transfer,
  close to MA's 41%), which is also where VA's scheduled-supply losses land (CSC 223/222/205/208).

## 5. GE inclusion and unit weighting: they reorder campuses, not colleges, and compress every difference the paper is about

**VERIFIED (our computation, 1035 cells per major).**

Major cell means under five lenses:

| lens | cs | bio | econ | cross-major range |
|---|---:|---:|---:|---:|
| courses_noGE (paper Fig 1) | 31.9 | 51.2 | 23.7 | 27.5 |
| courses_GE | 46.0 | 60.7 | 48.1 | 14.7 |
| units_noGE | 35.3 | 49.9 | 51.0 | 15.7 |
| units_GE | 48.9 | 58.7 | 60.5 | 11.6 |
| cap-aware (`pct_degree_units`) | 48.5 | 55.4 | 56.3 | 7.8 |

- The major ordering changes: bio > cs > econ on the paper lens; econ ≥ bio > cs on any unit lens.
  The econ jump is definitional: the bio/econ templates carry a derived "UC-transferable
  elective capacity" row that closes the model to 120/180 units (degree-coverage-sources-bio-econ.md);
  it is excluded from the course lens as padding but counted as named units that articulate
  anywhere in the unit lens (e.g. UCSD econ `degree_units_named_total` 180 vs 27 named
  courses). INFERRED: a unit-weighted Fig 1 on bio/econ is partly measuring elective padding.
- The 70-unit cap → 58% ceiling (memory) is confirmed in the rows: 105/180 = 70/120 = 58.3.
  Carried credit sits at the cap in 116/1035 cs cells, **606/1035 bio**, **568/1035 econ**
  (`degree_units_binding` = transfer_cap in 69 / 408 / 549 cells). Under the cap-aware lens econ
  reads 58.3 at four campuses and the campus range collapses to 52.7–58.3; bio to 51.7–58.1.
  The cap-aware lens is a policy constant with articulation noise on top.
- GE is 91–94% covered on the unit lens (cs 91, bio 94, econ 94) — near the engine's assumption
  that certification clears it — and is 22–35% of the named-course population, so including it
  adds a near-constant block and halves the cross-major spread (27.5 → 14.7 pts).
- Rank stability: the **college** ordering is invariant to lens (Spearman courses_noGE vs units_GE
  1.00 cs, 0.99 bio, 0.76 econ); the **campus** ordering is not (0.13 cs, 0.08 bio, 0.50 econ).
  The GE+units decision changes which campus looks worst; it does not change which colleges do.
- Cross-state, GE-excluded: CA cs 31.9 < MA 38.2 < VA 42.3 (course estimate); GE-included: CA 46.0 <
  VA 50.2 < MA 63.7 (baseline). MA gains 25 points because its GE block is resident-plan residue
  rows assumed 100% covered; VA's GE is capped by the 50% pre-transfer ceiling. The state
  ordering between MA and VA flips with GE. INFERRED: GE+units is anti-diagnostic for the
  between-state question; keep the paper's GE-excluded course lens for Fig 1 with the
  lower-division-only scope as the disclosed control, and keep units where they are already
  earned credit (Fig 3/4).

## Findings in one place (each: status, corpus, vintage)

1. Campus Fig 1 ordering flips across majors (Spearman cs–bio −0.15, cs–econ −0.32); college
   ordering replicates (0.43–0.57; Pearson 0.66–0.80). VERIFIED, our computation, 3 × 1035 cells.
2. Variance: campus effect explains 57/29/76% (cs/bio/econ), college 30/41/6%. VERIFIED.
3. Lower-division own-discipline coverage: CS 45.7 (CA) / 40.9 (MA) vs bio 85.0 / econ 91.6 —
   the bottleneck is computing-specific. VERIFIED (MA our typing reproduces paper Fig 2).
4. Whole-degree own-discipline ordering follows LD share within discipline (17/27/41/51% →
   15.1/11.5/21.3/42.7). CA-vs-MA "half" on whole degree becomes CA +5 on LD scope. VERIFIED.
5. LD-only Fig 1: CA cs 68.2 vs MA 57.3 — the state ordering reverses vs whole-degree. VERIFIED.
6. AS-T minus local AS, paired: +10.8 cs / +10.1 bio / +11.3 econ (verified cohort), positive at
   27/27 campus×major cells, same 60 units with 6–7 more applied. VERIFIED.
7. MA A2B: Fig 1 56.9 vs 32.7 (older repo); Fig 3 final PDF 94.8 vs 60.4, ours 82.0 vs 64.9; Fig 4
   PDF 0 vs 16.7. VERIFIED numbers; "map restated as outcome" INFERRED.
8. VA has no unguided comparator in the same vintage; 98.5 / 89.5 is construction plus supply.
   VERIFIED numbers; interpretation INFERRED, consistent with docs/virginia-final-audit.md.
9. CA AS-T never reaches 100% (0 of 1,332 verified AS-T cells across three majors ≥99.95); MA
   A2B is 87–100. VERIFIED.
10. Lens effects: cross-major range 27.5 → 7.8 pts from paper lens to cap-aware; cap binds in
    606/1035 bio and 568/1035 econ cells; college ranks invariant (≥0.99 cs/bio), campus ranks
    not (0.13/0.08). VERIFIED. Elective-capacity rows inflate bio/econ unit lens — INFERRED from
    the template docs, not isolated per row.

## Visual ideas (majors as replication, not a second story)

A. **"Where the bottleneck lives" dot-pair panel.** One row per campus (9 UC) and per MA
   university (11), two dots per row: own-discipline coverage on whole-degree scope and on
   lower-division scope, with a faint bar showing the LD share within the discipline. Three CA
   columns (cs, bio, econ) and one MA column, same axis. CS and MA-CS rows show the same
   shape (LD dot near 40–45, whole dot near 10–20); bio and econ rows show LD dots at 85–92.
   One glance: computing is the problem, the whole-degree number is the ceiling.

B. **Guarantee triptych on Fig 3.** Left: CA paired slope chart (local AS → AS-T) for the same
   college×campus pairs, faceted cs/bio/econ, all three sloping +10; centre: MA 61 cells as a
   strip split A2B / non-A2B with the PDF and our recomputation as two marks per cell;
   right: VA 240 cells catalog vs scheduled. Titled by *form of guarantee* (statewide template /
   bilateral map / university-authored guide), with the y-axis fixed 0–100 so CA's "never 100"
   and MA's "100 or nothing" are visible without annotation.

C. **College-axis replication.** 115 colleges sorted by CS Fig 1 (courses_noGE), bio and econ
   plotted as second/third series on the same x-order (or a cs-vs-bio scatter, r = 0.80).
   The shared lower tail (Palo Verde, Lassen, Feather River, Coalinga, Lemoore, Taft) is the
   figure; the flat econ line is the caption ("econ cannot see colleges").

(Optional D: lens ladder — five lenses × three majors, campus means as small multiples,
showing the 58.3 ceiling absorbing bio/econ and the campus ranks reshuffling; a methods figure.)

## Further investigations

- Pair the VA guide join with a same-vintage, same-240-cell canonical (equivalency-only)
  derivation so VA gets a paired guide-vs-no-guide contrast like CA's AS-T vs local AS.
- Import the MA "MT" (A2B) flag onto the ma-cs docs so the A2B split can be rendered
  in-figure rather than recomputed from `raw/heatmap.json` (documented completeness gap).
- Isolate the elective-capacity rows in the bio/econ unit lens (how many covered units are
  padding) before any GE+units headline; the cs templates carry less padding but are not free of it.
- Test whether the AS-T gap scales with lower-division own-discipline demand per campus
  (Riverside/SB/Merced +14–18 vs UCLA/Davis +5–7 in CS) — a mechanism, not just a mean.
- Replace the whole-degree CA-vs-MA Fig 2 computing contrast (11.5 vs 22) with the LD-scope pair
  (45.7 vs 40.9) plus the disclosed ceiling (27% vs 41%) in `ma-course-type-spread.md`.
- Econ's `local_other` cohort is 12 verified colleges; widen or caveat before it stands as a
  third replication of the AS-T gap.
- GMU's VA post-transfer computing typed as 0 in my quick prefix pass — the guide rows use a
  format the regex missed; the VA structure row should be redone with `vaCourseCodes.js`.
