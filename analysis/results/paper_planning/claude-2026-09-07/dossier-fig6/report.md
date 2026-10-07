# Dossier — Figure 6, curricular complexity delta (`pathway-complexity`)

Author: dossier-fig6 subagent, 2026-09-07. Read-only on the repository. All scratch
scripts and pulled rows live in this directory (`pull.js`, `summ.py`, `resident.js`,
`ge.js`, `gesec.js`, `census.js`, `fig6_<major>_<degree>_<v|all>.json`, `resident.json`).

Vintage / corpus vocabulary used throughout:
- **final PDF** = `2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf` p.5 Figure 6, transcribed in
  `server/data/ma/pdf-figures.json` (`fig6_complexity_delta`, gate: 49 cells sum 715).
- **archived tab** = `recovered/CurrComp Master.xlsx` typed scores (older repo), via
  `server/data/ma/their-math.json` `currcomp_archived`.
- **recomputed archive** = our scorer (`maPathwayComplexity.js` + `curricularComplexity.js`)
  run over the older-repo per-course sheets (`raw/pathways.json`), stored in
  `server/data/ma/complexity-validation.json`.
- **our computation (CA)** = live `pathwayComplexityData` (model v3) pulled 2026-09-07 with
  `visiblePairs=null`; files `fig6_*.json` here. Verified cohort = `verification.verified:true`
  AS documents. Baseline pins = `server/data/figure-baseline.json` (unverified cohort).
- **VA** = live `pathwayComplexityData` for `va-cs` (all rows excluded) plus the HTTP gate.

---

## 1. What the figure measures, corpus by corpus

### Shared equation (all corpora)
Heileman et al. (2018) structural complexity: for every vertex v in a curriculum DAG,
delay d(v) = vertices on the longest path THROUGH v, blocking b(v) = vertices reachable
from v; h(G) = Σ(d+b). Figure 6 cell = h(transfer pathway) − h(resident curriculum),
one cell per (community college × university). Sign convention and rounding (half away
from zero) are identical in the component for all corpora (`PathwayComplexity.jsx`,
`signedInt`). Units: dimensionless "score points". Course COUNTS enter only through the
vertex set; **credits/units play no role in the score** in any corpus.
`curricularComplexity.js` reproduces 59/60 archived MA component scores with corequisites
treated as edges (17/60 without), so the equation itself is validated (VERIFIED, from
`complexity-validation.json` `coreq_treatment`).

### Massachusetts (`ma-cs`) — `mode: 'paper'`, no live scoring
- Server: `Analysis.js` `pathwayComplexity` returns the committed snapshot
  `complexity-validation.json` because `prerequisites:false && paperBaselines:true`.
  Registry `source` knob: `published` (literal final PDF matrix) or `ours` (recomputed
  archive: our h(transfer) − our h(resident) from the authors' sheets); `diff` = ours − PDF.
- Graph provenance: the AUTHORS hand-built one sheet per pathway (older repo
  `All Pathways/*.xlsx`, tabs "4y" = resident, one transfer tab per CC). Each row is a
  named course (or an `ELEC xxx` / `SLOT` placeholder) with hand-entered `prereqs` and
  `coreqs` id lists; scores came from curricularanalytics.org (README, older repo).
  Transfer sheets contain the AS's ACTUAL courses including named GE courses with their
  own edges (e.g. Bristol→Dartmouth: ENG 101 → ENG 102, HST 111 → HST 112), plus the
  unmet university courses. Resident sheets carry GE as `ELEC xxx` placeholders.
- Graph size (VERIFIED from `raw/pathways.json`): resident 31–40 vertices, 17–31 edges,
  2–22 placeholder rows, 120–123 credits; the 49 transfer graphs average 40.1 vertices
  (36–48), 26.5 edges (14–35), 10.9 placeholder rows, 135.3 credits. Edge density
  ≈ 0.66 edges/vertex. Only 19 placeholder edges in total across all sheets.
- GE: IN on both sides (named on the transfer side, placeholder on the resident side).
- Cohort: 49 proximity-selected pathways (≤50 mi), 13 CCs × 11 universities, one local
  AS in CS per CC (MA has no AS-T concept). Massasoit and Roxbury (12 pathways) excluded
  by the authors because their sites list no prerequisites (final PDF footnote; older
  LaTeX §2A). The 61-pathway Fig 3/4/5/7 population ≠ the 49-pathway Fig 6 population.
- Denominator/ceiling: none — it is a signed difference, unbounded in both directions.
- Verified cohort: not applicable (the paper's own artefact); `verified` knob hidden.

### California (`cs`, `bio`, `econ`) — live model v3 (`pathwayComplexity.js`)
- Assembly per (UC degree template × AS document), mirroring the MA sheets in intent:
  AS named courses (deterministic minimum-unit stored-tree plan) → `cc:` vertices with
  edges from the CC prerequisite projection; UC lower-division requirements consumed
  (multiset) when the pair's ASSIST agreement articulates them, otherwise `uc:` vertices;
  upper-division named courses → `uc:` vertices via the campus catalogue (edges from
  `curated_prerequisites`), eligibility pools → `slot:pool` vertices; IGETC/Cal-GETC GE
  → SKIPPED on the transfer side (`geSkippedCourses`), but kept as `slot:ge` vertices on
  the resident side; elective capacity → `slot:elective`; named courses that miss the
  catalogue → `uc:req:` placeholders. Satisfied UC prerequisite edges are rewired to the
  articulating CC courses. Or-groups collapse to the cheapest section.
- Placeholder vertices have NO edges, so each contributes exactly 1 point (delay 1,
  blocking 0). `edge_info_pct` = share of vertices whose prerequisite status is known.
- GE: OUT on the transfer side, IN (as isolated slots) on the resident side. This is an
  asymmetry, not a policy lens (see §4, F4).
- Cohort: figure mounts with `verifiedOnly:true`, `degree` default `ast` (server forces
  A.S.-T when the major lists it, to stop Foothill's broad local pool replacing its
  10-course A.S.-T). Rows = every (degree × found AS doc with an ASSIST agreement); pairs
  whose AS doc has a named choose-by-unit pool are EXCLUDED (`ambiguous_named_unit_pool`,
  fail-closed) — the exclusion is per AS document, so it removes whole CC rows.
- Units vs counts: not unit-weighted; quarter-system UCs (7 of 9) and semester UCs
  (Berkeley, Merced) are mixed with no conversion — a vertex is a vertex.
- Ceiling: none (signed, unbounded).

### Virginia (`va-cs`) — renders blank
- HTTP gate: `majors.js` `pathwayComplexityPrerequisites:false` → controller answers 400
  `capability_required` with a `publication_blocker` report; the registry gate
  (`prerequisites|paperBaselines`) passes because `prerequisites:true`, so the client asks
  and receives the error ("Could not load pathway complexity."). VERIFIED by reading
  `Analysis.js:271` and `majors.js:583`.
- Service gate (what a forced call returns; VERIFIED by live pull): `va-cs`/`local_as`/
  verified = 272 rows (16 universities × 17 CCs), 0 scored, 272 excluded:
  232 `virginia_source_not_publication_ready` (all 272 rows have
  `degree_source_complete_degree_ready:false` — every VA bachelor document fails the
  Figure-6 constraint evaluator, e.g. `approved_transfer_associate_conditional_exemption`,
  `area_of_inquiry_discipline_limits`; 144 rows also fail on the associate side) and
  40 `virginia_figure6_prerequisite_model_unavailable` (both sources pass but no active
  publication receipt; `va_figure6_prerequisite_publications` has 0 documents).
  `ast` degree type returns 0 rows (VA has only `local_as` documents: 17 verified, 2 not).
- The catalogued second kill switch (`institution_id: uc:<id>` vs `va:uni:<id>`,
  `figure-defect-catalogue` item 4, 2026-08-23) is NO LONGER LIVE: commit `954c688`
  (2026-09-02) added the `va:uni:` owner branch. `AMBIGUOUS_UNIT_POOL` is bypassed for
  canonical-contract VA sources (`asDegreeCourseIds`: `strictUnitPools && !exactSource`).
  So today's two switches are the capability flag and the publication gate, not the ones
  in the catalogue.

---

## 2. The numbers

### 2a. Massachusetts, final PDF (VERIFIED from `pdf-figures.json`; gate sum 715)
49 cells; mean **+14.59 (+15)**, median +20, SD 30.0, min −52 (MassBay→Bridgewater),
max +72 (Northern Essex→Lowell); 35 positive / 14 negative / 0 zero.

Per university (final PDF):
| University | n | mean | min | median | max | SD | resident h (archive) |
|---|--:|--:|--:|--:|--:|--:|--:|
| MCLA | 2 | +54.0 | 50 | 54 | 58 | 4.0 | 160 |
| Framingham | 6 | +46.0 | 40 | 45 | 57 | 5.5 | 139 |
| UMass Lowell | 6 | +29.7 | 14 | 22.5 | 72 | 19.8 | 143 |
| Westfield | 4 | +27.0 | 4 | 28.5 | 47 | 15.3 | 150 |
| UMass Boston | 6 | +22.8 | 1 | 27.5 | 35 | 12.6 | 169 |
| Worcester | 5 | +11.2 | −9 | 13 | 30 | 14.5 | 105 |
| Salem | 5 | +10.6 | −29 | 7 | 54 | 31.6 | 157 |
| UMass Amherst | 3 | +1.0 | −28 | 6 | 25 | 21.9 | 185 |
| Fitchburg | 5 | −9.6 | −36 | −18 | 41 | 26.3 | 138 |
| Bridgewater | 5 | −21.0 | −52 | −31 | 20 | 28.6 | 160 |
| UMass Dartmouth | 2 | −25.5 | −32 | −25.5 | −19 | 6.5 | 202 |

Per community college (final PDF): Northern Essex +52.7 (n3), Berkshire +48.5 (2),
Bunker Hill +26.5 (6), Middlesex +26.2 (6), Holyoke +26.0 (2), Greenfield +22.7 (3),
Mount Wachusett +15.7 (3), Springfield Technical +10.7 (3), North Shore +8.2 (5),
Quinsigamond +7.2 (4), MassBay −4.7 (7), Bristol −8.7 (3), Cape Cod −33.0 (2).
7 of 13 CCs and 5 of 11 universities have cells of both signs. Variance split: university
means explain 56% of cell variance, CC means 41% (VERIFIED, our computation).
Absolute scores (recomputed archive, 48/49 = archived tab): resident 105–202 (mean 155.3);
transfer 96–219 (mean 166.7).

Vintages: archived tab 777/49 = +15.86; recomputed archive 781/49 = +15.94; recomputed
all-61 = +10.28 (the 12 Massasoit/Roxbury pathways average −12.8, min −91 Bridgewater×
Massasoit). 47/49 final cells equal the recomputed archive; the two differences are
STCC→Amherst (PDF −28 vs archive +34, a final-revision, not a typo) and Bristol→Dartmouth
(−32 vs −28, unrecoverable upload input). The older LaTeX draft (older repo `main.tex`
§2A, `curr_comp.png` box plot of ABSOLUTE h per university) reports "average of each
school's median difference 23" and Bridgewater median −24; neither matches the archived
tab (mean of medians 13.5, Bridgewater −31) nor the final PDF (11.7, −31) — a third, even
earlier vintage (CONTEXT; numbers VERIFIED for the two later vintages).

Figure 1 ↔ Figure 6 in MA (VERIFIED, our computation from `raw/heatmap.json` + PDF cells):
pair-level r(Δ, Fig 1 all-level coverage) = −0.50; r(Δ, lower-division coverage) = −0.58;
within-university r = −0.50; university-level r(mean Δ, lower coverage) = −0.74.
**A2B-mapped pairs (`mt` flag): n=11, mean Δ −24.4, median −28; non-A2B: n=38, mean +25.9,
median +28.5.** The three universities with negative means (Dartmouth, Bridgewater,
Fitchburg) are exactly the A2B universities in the 49-cell cohort (plus Amherst at +1.0).

### 2b. California, our computation (model v3), verified cohort unless stated
Baseline pins (unverified cohort) all reproduce from the pull (VERIFIED, row/computed/
excluded counts): cs|ast 621/558/63, cs|local_as 405/198/207, bio|ast 882/189/693,
bio|local_as 513/162/351, econ|ast 873/729/144, econ|local_other 207/135/72.
Note `docs/visualizations.md` §11 quotes 234/279 (cs), 126/477 (bio), 414/495 (econ)
for the verified A.S.-T default — stale; the corpus has grown to 261/306, 126/513, 441/531.

| corpus | rows | scored | excluded (AS docs excl./total) | mean | median | SD | min | max | +/−/0 | UC-mean var. share | CC var. share |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|--:|--:|
| cs AS-T verified | 306 | 261 | 45 (5/34) | **−0.8** | +1 | 11.1 | −36 | +27 | 135/114/12 | 0.49 | 0.15 |
| cs AS-T all | 621 | 558 | 63 (7/69) | −0.3 | +1 | 11.3 | −36 | +37 | 285/250/23 | 0.40 | 0.25 |
| cs local AS verified | 252 | 135 | 117 (13/28) | −1.3 | −1 | 9.6 | −25 | +19 | 63/68/4 | 0.31 | 0.14 |
| cs local AS all | 405 | 198 | 207 | −1.3 | 0 | 10.4 | −39 | +25 | 93/97/8 | 0.28 | 0.20 |
| bio AS-T verified | 513 | 126 | 387 (43/57) | **−31.0** | −28 | 33.0 | −112 | +44 | 21/104/1 | 0.86 | 0.04 |
| bio AS-T all | 882 | 189 | 693 (77/98) | −28.6 | −25 | 32.7 | −112 | +44 | 37/151/1 | 0.79 | 0.06 |
| bio local AS verified | 288 | 108 | 180 (20/32) | −26.7 | −21 | 32.4 | −116 | +24 | 17/91/0 | 0.86 | 0.02 |
| bio local AS all | 513 | 162 | 351 | −25.1 | −19.5 | 32.4 | −119 | +24 | 30/128/4 | — | — |
| econ AS-T verified | 531 | 441 | 90 (10/59) | **−1.7** | 0 | 3.9 | −14 | +9 | 71/193/177 | 0.58 | 0.11 |
| econ AS-T all | 873 | 729 | 144 | −1.5 | 0 | 3.8 | −14 | +9 | 130/302/297 | 0.52 | 0.14 |
| econ local other verified | 108 | 72 | 36 (4/12) | −1.0 | 0 | 3.8 | −14 | +7 | 17/27/28 | 0.57 | 0.15 |
| econ local other all | 207 | 135 | 72 | −0.9 | 0 | 4.1 | −14 | +7 | 36/47/52 | 0.49 | 0.26 |

Graph anatomy (verified AS-T means): cs 34.2 vertices of which 17.9 placeholders (52%),
13.6 edges, edge_info 48.5%, AS 8.0 courses / 30.7 units, 4.8 requirements consumed;
bio 31.0 vertices / 13.7 placeholders (44%) / 13.5 edges / edge_info 55.6% / 7.2 consumed;
econ 34.3 vertices / 22.7 placeholders (66%) / **4.0 edges** / edge_info 35.4% / 2.3 consumed.
Resident scores (VERIFIED by re-running the exported `assemblePathway`+`scorePathway`,
identical to the row values): cs 67–118 (mean 85.9), bio 48–247, econ 36–107.

Per university, cs AS-T verified (n=29 each, 5 excluded each):
| UC | resident h | mean Δ | min | median | max | SD | transfer V/E/placeholders | consumed | resident V/E/uc/ge-slots/pool/req-slots |
|---|--:|--:|--:|--:|--:|--:|---|--:|---|
| Berkeley | 67 | +8.5 | −2 | +9 | +21 | 4.5 | 25.2/11.3/10.0 | 3.8 | 25/8/11/4/5/5 |
| San Diego | 69 | +7.9 | −7 | +7 | +27 | 7.5 | 39.1/11.6/23.7 | 3.6 | 40/8/11/5/9/12 |
| UCLA | 118 | +2.6 | −36 | +3 | +16 | 11.5 | 43.2/20.8/22.0 | 3.8 | 45/18/17/6/20/1 |
| Santa Cruz | 85 | +2.6 | −13 | +3 | +13 | 6.3 | 32.3/15.9/12.0 | 3.8 | 37/13/16/9/5/3 |
| Irvine | 110 | +1.5 | −30 | +4 | +18 | 10.8 | 36.8/17.1/19.0 | 3.2 | 39/13/13/7/0/18 |
| Davis | 71 | −0.9 | −18 | +1 | +16 | 8.2 | 33.3/10.0/19.1 | 4.2 | 35/8/12/2/16/0 |
| Santa Barbara | 81 | −1.7 | −17 | −3 | +13 | 8.2 | 34.2/10.9/21.0 | 4.8 | 40/9/10/9/14/4 |
| Merced | 88 | −9.8 | −23 | −8 | +2 | 6.5 | 28.0/13.0/12.0 | **8.0** | 33/12/16/5/0/12 |
| Riverside | 84 | −17.3 | −26 | −19 | −7 | 4.2 | 35.5/12.0/22.0 | **7.6** | 42/9/10/7/8/17 |
Per CC (cs AS-T verified): 29 CCs, CC-means −12.0 (Diablo Valley) … +8.7 (Mendocino),
SD 4.3; 28 of 29 CCs have cells of both signs. Unverified adds Foothill (+21.2) and
Sierra (+13.7) as the top outliers (the registry's "notable omitted sources" note).
Cell-level r(Δ, requirements_consumed) = −0.79 (within-UC −0.67); r(Δ, n_edges) = +0.36.

Per university, bio AS-T verified (n=14 each, 43 excluded each):
SD +6.5 (res 74) · UCLA −3.1 (48) · Merced −8.7 (75) · Berkeley −10.4 (82) ·
Davis −26.4 (95) · Riverside −28.9 (122) · Santa Cruz −55.8 (161) · Santa Barbara −59.3
(119) · **Irvine −93.3 (247; min −112)**. Irvine's resident graph has 26 catalogue
courses and 28 edges (max delay 8); the transfer graph replaces its lower-division
chem/bio/math chain with 7.4 AS courses and lands at 153.7. CC means span only −37.6 …
−9.3 (SD 6.9): 86% of variance is the UC row.

Per university, econ AS-T verified (n=49 each): Merced +1.2, Berkeley +1.2, Davis +0.2,
Riverside +0.2, Santa Barbara −0.3, UCLA −2.9, Santa Cruz −3.1, Irvine −3.4, San Diego
−8.5. Resident econ graphs have 1–14 edges (Berkeley: 1 edge among 53 vertices,
edge_info 5.7%; Santa Barbara 1 edge/35); 177 of 441 cells (40%) are exactly 0.

GE-symmetric sensitivity (VERIFIED arithmetic; each dropped resident `slot:ge` vertex is
worth exactly +1 because slots carry no edges): adding the resident GE-slot count back to
each cs cell moves the cs AS-T verified mean from −0.8 to **+5.2** (Berkeley +12.5, SD
+12.9, Santa Cruz +11.6, Riverside −10.3); bio moves only −31.0 → −29.5 because bio/econ
templates encode GE as ONE block receiver (`GE`, `Cal-GETC`) while cs templates enumerate
GE courses (2–9 receivers; Riverside's "Engineering depth/breadth elective" menus are
stamped `general-education`).

### 2c. Virginia
No cells. Live service: 272 rows / 0 scored (`local_as`, verified); reasons above.
Per-institution distribution: undefined. Frozen VA figure modules (`vaCoverageRows.js`,
`vaCreditRateRows.js`) carry no complexity rows.

---

## 3. Comparability verdict — NOT like-for-like

A reader cannot put MA, CA and VA on one Figure 6 axis. VA is absent; MA and CA share the
equation and the visual form but differ in every input that determines the sign:

1. **Graph provenance.** MA: authors' hand-built per-pathway sheets, every course a
   named row with hand-entered prereqs/coreqs (26.5 edges / 40 vertices; 19 placeholder
   edges total). CA: machine assembly from templates + ASSIST + prerequisite projections;
   52% (cs), 44% (bio), 66% (econ) of vertices are edge-less placeholders; prerequisite
   status is known for only 48% / 56% / 35% of vertices.
2. **GE treatment is asymmetric in opposite directions.** MA transfer sheets contain the
   AS's real GE courses WITH edges (adds ≥1 point each, chains add more); MA resident
   sheets hold GE as `ELEC` rows (1 point each). CA transfer graphs drop IGETC GE entirely;
   CA resident graphs keep 1–9 isolated GE slots. Net: CA is biased down by 1–9 points per
   cell relative to a symmetric treatment (+6 on the cs mean); MA is biased up by the edge
   structure of named GE courses.
3. **Corequisites.** MA scores treat coreqs as edges (decisive for the 59/60 agreement).
   Whether the CA prerequisite projection (`projectPrereqEdges`) carries corequisites is
   not established here (open question).
4. **Cohort.** MA: 49 proximity-selected pathways (≤50 mi), one hand-chosen local AS per
   CC, 2 CCs excluded for missing prerequisite listings. CA: all-pairs statewide, verified
   AS-T (29 CCs × 9 UCs) or local AS (15 × 9); pairs excluded per AS document when it
   contains a choose-by-unit pool (cs 15% of verified AS-T rows, bio 75%, econ 17%).
5. **Degree type.** MA local AS; CA default A.S.-T (SB 1440 statewide template) — the
   MA-analogous local AS is a knob (cs −1.3 vs −0.8, bio −26.7 vs −31.0).
6. **Unit system.** MA 120-semester-credit degrees; 7 of 9 UCs are quarter-system
   (180 quarter units) — more, smaller courses; no conversion exists for a count-based
   metric.
7. **Resident anchor.** MA: authors' 4y tab (all named courses, 17–31 edges). CA: the same
   template assembly with no AS — includes pool/eligibility placeholders and `uc:req`
   placeholders for named courses missing from the campus catalogue (Riverside cs: 17 of
   42 resident vertices; Irvine cs: 18 of 39).
8. **Pathway optimisation.** MA "optimal" pathway chosen by hand; CA deterministic
   minimum-unit stored-tree plan with first-in-order prerequisite tie-break and cheapest
   Or-section (registry contract: "not a global minimum-complexity optimization").
9. **Vintage stability.** MA final PDF is frozen (2 archive disagreements labelled). CA is
   a live model whose cohort moves as documents are verified (docs quote 234/279; live
   261/306) — every CA number must carry a pull date and cache version (v3).
10. **Weighting.** Both pathway-weighted; MA campus-equal mean is +13.3 vs +14.6
    (ma-paper-audit), CA campus-equal cs = −0.7 (9 equal UC rows).
11. **Scale.** MA resident h 105–202; CA cs 67–118, econ 36–107 — CA graphs are thinner,
    so a CA point is not an MA point.
12. **VA**: absent; and when it exists it will be built on the exact-formula VA adapter
    (`paths_or__conditions_and`, coreqs as edges, fail-closed on ambiguous paths) — a
    third assembly semantics.

Footnote-level identical items: the equation, the sign convention, the rounding rule,
the CC×university matrix form and diverging colour ramp.

---

## 4. Cross-major reading (CA cs vs bio vs econ)

- cs ≈ 0 (−0.8, SD 11), bio strongly negative (−31, SD 33), econ ≈ 0 with 40% exact zeros
  (SD 3.9). The between-major spread (30 points) is larger than the MA−CA cs gap (15).
- The spread tracks measurement artefacts, not transfer difficulty: (a) how dense the
  UC's own lower-division prerequisite chain is (bio: Irvine 247 → −93; the AS replaces a
  chem/bio/math chain with CC courses whose projected prerequisites are sparser);
  (b) how much of the graph is placeholders (econ 66%, 4 edges per graph → nothing can
  move); (c) GE encoding (enumerated in cs templates, one block in bio/econ).
- Within cs, the UC ranking is a re-expression of articulation: the two UCs whose AS-T
  pathways consume the most requirements (Riverside 7.6, Merced 8.0 vs 3.2–4.8 elsewhere)
  are the two most negative (−17.3, −9.8); cell-level r(Δ, consumed) = −0.79.
- Verdict: the cross-major reading COMPLICATES the cross-state story. It shows the metric's
  sign is set by which side's prerequisite data is denser, which is exactly the
  confound between MA's hand-built graphs and CA's projected ones. The one thing it
  reinforces (see F2/F3) is that better articulation → lower measured complexity in every
  corpus, which is the opposite of the paper's hypothesis and is a data-density effect.

---

## 5. Findings

F1 (VERIFIED, final PDF; MA ma-cs, 49 pathways). The MA Figure 6 mean is +14.59 (printed
+15), median +20, SD 30.0, range −52…+72, with 14 of 49 cells negative; university means
explain 56% of cell variance and CC means 41%.

F2 (VERIFIED, our computation from raw/heatmap.json `mt` flag + final PDF; MA). The 11
A2B-mapped pairs in the Figure 6 cohort average −24.4 (median −28) while the 38 unmapped
pairs average +25.9 (median +28.5); pair-level r(Δ, lower-division Figure 1 coverage) =
−0.58, university-level −0.74. The three universities with negative means (Dartmouth,
Bridgewater, Fitchburg) are the A2B universities. Mechanism: the paper's own text —
CC courses have fewer prerequisites than the university courses they replace.

F3 (VERIFIED, our computation, CA cs AS-T verified, 261 cells). Cell-level r(Δ,
requirements_consumed) = −0.79 (within-UC −0.67); Riverside (7.6 consumed) and Merced
(8.0) are the only UCs with negative medians (−19, −8). Figure 6 in CA is largely
Figure 1 with the sign flipped.

F4 (VERIFIED mechanism by code reading + exact arithmetic; CA). The CA transfer graph
drops IGETC GE while the resident graph keeps 1–9 isolated GE slots worth exactly +1 each;
restoring symmetry moves cs AS-T verified from −0.8 to +5.2 and bio from −31.0 to −29.5.
MA does the opposite (named AS GE courses with edges on the transfer side), so the two
states' GE biases point in opposite directions.

F5 (VERIFIED, our computation; CA bio AS-T verified, 126 cells). Bio averages −31.0 with
86% of variance in the UC row; Irvine (resident 247, 26 courses, 28 edges) averages −93.3.
The cross-major spread (cs −0.8, bio −31.0, econ −1.7) exceeds the MA−CA cs gap.

F6 (VERIFIED, our computation; CA econ AS-T verified, 441 cells). 177 of 441 cells are
exactly 0 and graphs average 4.0 edges over 34 vertices (Berkeley: 1 edge, edge_info
5.7%); econ Figure 6 is a null instrument because the econ catalogues/templates carry
almost no prerequisite edges.

F7 (VERIFIED, live pull + code; VA va-cs). Virginia has zero Figure 6 cells: the HTTP
route 400s on `pathwayComplexityPrerequisites:false`, and a forced service call yields
272 rows / 0 scored — 232 `virginia_source_not_publication_ready` (0 of 16 bachelor
documents pass the Figure-6 constraint evaluator) and 40
`virginia_figure6_prerequisite_model_unavailable` (no human publication receipt; the
publications collection is empty). The catalogued `institution_id` mismatch was fixed on
2026-09-02 (954c688) and is not a live switch.

F8 (INFERRED from F2/F3 + VA structure facts). Because Figure 6's sign is driven by
articulation density, a working VA Figure 6 would most likely be NEGATIVE almost
everywhere (catalog-view articulation ≈ ceiling; 98.5% guide utilisation): "best"
articulation would print as "less complex than resident", i.e. the paper's hypothesis
inverts precisely in the state that standardised its courses. That is not evidence VA
pathways are easier; it is evidence the metric rewards replacing dense university chains
with sparser CC chains.

F9 (VERIFIED, our computation; CA cs). CA placeholder share is 52% of vertices and
prerequisite status is known for 48% of vertices; CA resident scores (67–118) sit well
below MA's (105–202). A CA point and an MA point are not the same unit.

F10 (VERIFIED, `complexity-validation.json`; MA vintages). Three MA headline means
coexist — final PDF +14.59, archived tab +15.86, recomputed archive +15.94 — and the
all-61 recomputation is +10.28 because the 12 excluded Massasoit/Roxbury pathways average
−12.8 (min −91). Choosing the 49-cohort raises the MA headline by ~4 points.

F11 (CONTEXT, older repo `main.tex` §2A + `curr_comp.png`). The pre-final draft used a
box plot of absolute h per university and quoted "average of each school's median
difference 23" (Bridgewater −24); neither the archived tab (13.5 / −31) nor the final PDF
(11.7 / −31) reproduces those numbers, so the draft is a third, unrecoverable vintage.

F12 (VERIFIED, pins; CA cohorts). Fail-closed exclusions remove 5/34 verified cs AS-T
documents but 43/57 verified bio AS-T documents (387/513 rows) — the bio matrix is 14 CC
rows, so any bio cross-state claim rests on a quarter of the corpus.

---

## 6. Contribution score: 2.5 / 10

- Novelty: applying Heileman complexity cross-state would be novel, but nothing about
  the current numbers is defensible as a state contrast.
- Defensibility: low. MA vs CA differ in graph provenance, GE direction, placeholder
  share, cohort selection, degree type and unit system; both states' signs are explained
  by articulation density (F2, F3), which Figure 1 already reports more directly.
- One-glance legibility: poor — a signed matrix whose sign means "which side's
  prerequisite data was denser".
- Cross-state comparability: VA absent; MA/CA not like-for-like (12 footnotes).
- Cross-major reinforcement: negative — bio −31 / econ 0 / cs 0 expose the artefacts.
- What would raise it: the F2 A2B split is a genuinely interesting MA-only result
  (articulated pathways print as LESS complex), and F8 is a testable prediction for VA.
  As a mechanism note inside the Figure 1 story it earns its place; as a sixth headline
  figure it does not.

---

## 7. Proposed visuals and open questions

Proposed visuals:
1. **Δ vs articulation scatter, one panel per corpus** (x = Figure 1 lower-division
   coverage or requirements_consumed, y = Figure 6 Δ; MA points coloured by A2B flag,
   CA by UC). Makes F2/F3 the figure: the slope is the finding, and it is negative in
   both states.
2. **Graph-anatomy stacked bars per corpus** (named-with-edges / named-without-edges /
   placeholder vertices; MA resident, MA transfer, CA cs/bio/econ resident and transfer).
   Shows in one glance why the scores are not on one scale.
3. **GE-symmetric sensitivity strip**: for each UC, raw Δ and Δ + resident GE slots as
   paired dots; and for MA, Δ with named GE rows removed from the transfer sheets
   (computable from `raw/pathways.json` by dropping ENG/HST/ELEC rows — not done here).
4. **Sign-only matrix with cohort overlay**: MA 49 cells (A2B pairs hatched) and CA cs
   (consumed ≥ 6 hatched), replacing magnitudes that are not comparable with a sign that
   is at least defined the same way.
5. If VA is ever scored: a three-state "Δ vs coverage" panel where VA should sit at the
   far-right (coverage ≈ ceiling) and, per F8, below zero.

Open questions:
- Does `projectPrereqEdges` carry corequisites for CA CC/UC courses? MA scores require
  coreqs-as-edges; if CA drops them, CA h is systematically lower on both sides.
- Riverside/Irvine cs resident graphs have 17–18 `uc:req` placeholders (named courses not
  found in `curated_prerequisites` for that campus): catalogue gap or code mismatch?
- Riverside cs "Engineering depth/breadth elective" (12- and 8-receiver menus) are stamped
  `general-education`; `pickReceivers` reduces them, but the stamp choice moves Δ by
  several points at one campus.
- Should CA's transfer graph carry named AS GE courses (as MA's sheets do) — the AS
  records preserve only the GE block, so this needs data the corpus does not have.
- What is the VA path to non-blank: (a) the 16-university `va:uni:<id>` prerequisite
  corpus in contract `va-figure6-prerequisites-v2` with official-host source evidence and
  hashes; (b) all 16 bachelor and 17 associate documents passing the Figure-6 constraint
  evaluators (today 0/16 and 8/17); (c) a signed human publication receipt; (d) flipping
  `pathwayComplexityPrerequisites`. Weeks of source work, and the result would inherit
  CA's placeholder/GE asymmetries unless the VA assembler is designed differently.
- Is it worth keeping? Recommendation: drop Figure 6 as a headline cross-state figure;
  keep the MA A2B split (F2) and the CA consumed-vs-Δ correlation (F3) as a one-paragraph
  mechanism note under Figure 1, explicitly framed as "articulation lowers measured
  structural complexity because CC prerequisite graphs are sparser".
