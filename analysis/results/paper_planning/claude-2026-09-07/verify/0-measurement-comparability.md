# Verify 0 — measurement comparability of the Figure 1 cross-state / cross-major claim

Reviewer: verify-0-measurement-comparability (adversarial, read-only). Date: 2026-09-07.
Scratch: /private/tmp/claude-501/-Users-tybaltmallet-Desktop-transfer-pathways-internal-tool/2e480323-56f4-4beb-8db4-48c5c7bc3527/scratchpad/verify-0-measurement-comparability/ (repro.py, ma_slots.py, va_ge.py)

## Claim under review (F1, coverage-heatmap / MA Fig 1)

"On the paper's own lens (GE-excluded course counts, cells equal) the states order VA 42.3% (catalog, 16 colleges,
estimated courses) > MA 38.3% > CA cs 31.9%, but the 10.4-pt state gap is smaller than the 27.5-pt CA cross-major gap
(econ 23.7 -> bio 51.2)."

## Verdict

**REFUTED as stated (materially misleading), confidence 0.8.** Every number reproduces (see §1), but (a) the premise
that the three states sit "on the paper's own lens" is false for VA and only partly true for CA — the three quantities
have different denominators, different GE rules, different upper-division articulability, and different elective-slot
handling (§2); and (b) the headline comparison "state gap 10.4 < cross-major gap 27.5" compares two differences that are
both dominated by denominator composition. The econ->bio gap (27.5 pts) is almost exactly the gap in the two majors'
lower-division share of the denominator (31.1 vs 59.1 = 28.0 pts). Under the one control that removes that artefact
(lower-division-only scope, which is the MA paper's own numerator population expressed over the coverable denominator),
the state ordering changes (VA 99 > CA cs 68 > MA 57) and the CA cross-major range shrinks to 18.5 pts with econ in the
middle, not at the bottom (§3). A methods reviewer would call the between-state comparison apples-to-oranges and the
gap-size comparison an artefact.

## 1. Numbers reproduced (VERIFIED, our computation; cell-equal means)

| quantity in claim | artefact vintage | corpus | reproduced value |
|---|---|---|---|
| VA 42.3 | frozen `frontend/src/analyses/vaCoverageRows.js` (built 2026-09-07 from 2026-08-30 guide capture + 2026-08-31 catalogues) | va-cs, catalog supply, 16 CS colleges x 15 guides = 240 cells, `pct_named_requirement_courses` | **42.256** |
| MA 38.3 | `server/data/ma/raw/heatmap.json` = final-repo `Four Year Heatmap.xlsx` | ma-cs, 15 CCs x 11 universities = 165 cells, COUNT ratio | **38.267** (served DB 38.206: one cell, Cape Cod->Dartmouth 45.2 vs 35.5; final-PDF prose says 38.2, printed integers average 38.3) |
| CA cs 31.9 | live `coverageData` 2026-09-07 (dossier JSON) | cs, 115 CCs x 9 UCs = 1035 cells, degree lens, `pct_named_requirement_courses` | **31.915** (pooled 31.5) |
| CA bio 51.2 | same | bio, 1035 | **51.179** |
| CA econ 23.7 | same | econ, 1035 | **23.729** |
| state gap 10.4 / cross-major 27.5 | — | — | 10.34 / 27.45 |

Template verification: all 1035 cs/bio/econ rows carry `degree_template_verified: true`; bio and econ rows also carry
`degree_template_status_conflict: true` (stale `research_status` = "ai_researched_needs_human_verification" beside an
authoritative verification record — pathways.js comment). Not a defect, but must be disclosed if "verified cohort" is
claimed for bio/econ. VA: all 240 cells `method_status: estimated`. MA: no template verification concept.

## 2. Are the compared quantities defined the same way? No.

| dimension | MA (paper Fig 1, final repo) | CA (engine, `namedRequirementCourses`) | VA (frozen `buildVaCoverageCells`) |
|---|---|---|---|
| **What the denominator is** | Author-enumerated heatmap columns per university (270 cols; major + math + science + a few writing/stat cols). **70 of 270 (26%) are elective placeholders** ("Upper Level Elective (3000)", "Natural Science Elective", "General Elective (any course)"). GE never enumerated. | Named slots of a hand-built UC degree template; GE and "free/unrestricted elective" padding removed by title regex / `ge_area` shape; series expanded per course; choose-N priced at N cheapest; unenumerated blocks priced at units/4. Upper-division named slots and typed elective blocks kept. | **The guide's stated whole-degree credit total (120-134) minus the `assumed` bucket, converted to a course estimate at the guide's own mean course size (3.0-3.3)**. Includes every university-side credit (post_items scaled to the stated post-transfer half, plus any unitemised remainder). Not a named-requirement population at all. |
| **Numerator rule** | Column has ANY CC equivalent (MassTransfer DB / websites). Upper-division columns CAN be covered (Fitchburg 45.5% upper rate; 21 of 165 cells exceed their own lower-division ceiling). Placeholder columns covered by any transferable course (Lowell +32 pp from slots, Salem +22.5). | Slot covered only via ASSIST articulation / named block / IGETC area; **upper-division slots are `nontransferable` and can never be covered** (max ceiling-normalised value 100.1). | Stated pre-transfer maximum minus credits of itemised rows the college's catalogue cannot supply; `assumed` rows stripped. Unitemised pre-transfer padding (`sparePre`) counted as covered. Articulation is never tested — common numbering makes it true by construction; only supply can fail. |
| **Unit of count** | binary per column | binary per expanded course observation | credits / mean course size, rounded, held to stated halves ("estimated_from_credits") |
| **GE exclusion** | never in population (author choice) | evaluator's GE role classification | `assumed` bucket only (rows naming no course). **Enumerated GE stays in**: GMU names all 20 GE rows (assumed 0) and reads 49.7; RMC/UMW leave 20-21 credits open and read 37.5-40.6. r(guide ceiling, assumed units) = -0.83 (dive-va-mechanism). Non-STEM named rows are 15.5% of stated pre-transfer credits, assumed rows 20.5% (va_ge.py). |
| **Lower-division share of denominator (the structural ceiling)** | 56.9 (45.0 Framingham - 72.0 Worcester) | cs 47.2 (36.7 UCSD - 68.4 Berkeley); bio 59.1; **econ 31.1** | 42.5 course-basis (37.5 RMC - 50.0 GMU); 50.4 unit-basis, r = 1.000 with statedPre/statedTotal |
| **College cohort** | all 15 MA CCs | all 115 CCCs (incl. colleges with no CS programme: Palo Verde 1.6%, Lassen 9.5%) | **16 of 23 VCCS colleges** (those with a CS associate). All-23 catalog = 41.0 (345 cells). |
| **University universe** | 11 publics (4 state universities + 5 UMass... all public) | **9 UCs only; the CSU system (where the AS-T guarantee lands) is absent** — "CA" here means UC | 15 institutions incl. privates (Bridgewater College, Randolph-Macon, Lynchburg) and one BA/BS-merged guide |
| **Supply basis** | equivalency exists in DB/website (~catalog) | ASSIST agreement exists (~catalog) | catalog (scheduled variant: 37.8 / 35.4) |
| **Vintage** | final repo 2026-08 import (38.267); older served vintage 38.206; PDF prose 38.2 | live DB 2026-09-07 | frozen 2026-09-07 from 2026-08-30/31 captures |

The VA builder's own comments say it: "These rounded estimates are not literal course counts or a reproduction of the
Massachusetts paper's binary named-course measure"; `coverage_paper` "is not literal Massachusetts paper equivalence";
docs/virginia-final-audit.md: "It should not be called a literal reproduction of the Massachusetts paper's named-course
measure" and Figure 1 "should be described as modeled guide preparation availability". The claim's caveat ("estimated
course count from credits") covers only the unit-of-count row of the table above.

## 3. Does the conclusion survive a like-for-like control? No.

All VERIFIED (repro.py over the same rows/cells as the claim).

**3a. Ceiling control.** The paper keeps upper division in the denominator, so a cell's maximum is its lower-division
share L/N. Observed / ceiling / lower-division-only coverage:

| corpus | paper lens | ceiling L/N | ceiling-normalised | lower-division-only |
|---|---:|---:|---:|---:|
| CA econ | 23.7 | 31.1 | 76.6 | 76.6 |
| CA cs | 31.9 | 47.2 | 68.2 | 68.2 |
| MA cs (final repo) | 38.3 | 56.9 | 66.4 | 57.5 (served 57.3) |
| VA cs (catalog 16) | 42.3 | 42.5 | 99.4 | 99.4 |
| CA bio | 51.2 | 59.1 | 86.7 | 86.7 |

- Cross-major: econ->bio gap 27.5 pts vs ceiling gap 28.0 pts. On lower-division scope the range is cs 68.2 -> bio 86.7
  = 18.5 pts and econ (76.6) is in the middle. The claim's "econ 23.7 -> bio 51.2" is the templates' upper-division share,
  not articulation.
- Cross-state: raw VA > MA > CA becomes VA 99 > CA 68 > MA 57. MA vs CA flips (dive-ca-cross-major found the same,
  "the cross-state Fig 1 ordering is not robust to the scope choice"). The VA-CA gap grows from 10 to 31 pts. So the
  sentence "the state gap is smaller than the cross-major gap" reverses under the control: 31 > 18.5.
- VA sits at 99.4% of its ceiling in catalog mode; its 42.3 is 42.5 x (1 - 0.006). It is a constant of the guide format
  (60-credit half of a 120-134 credit degree, minus open GE rows), not an articulation outcome.

**3b. Cohort and supply (VA only has these knobs).** VA paper lens: catalog/16 = 42.3, catalog/23 = 41.0,
scheduled/16 = 37.8, scheduled/23 = 35.4. The like-for-like cohort with CA's all-115 and MA's all-15 is all-23:
state gap 9.1 not 10.4; on scheduled supply VA drops below MA (35.4 < 38.3). CA/MA have no scheduled analogue, so
catalog is the fair basis — but the claim should say all-23.

**3c. Elective-placeholder columns (MA).** Removing the 70 placeholder columns from numerator and denominator moves the
MA state mean only 38.27 -> 37.72 (slot cells are 46% covered: lower slots ~100%, upper slots mostly 0), so the MA
*mean* is robust to this — but universities re-rank (Salem 46.4 -> 31.1, Lowell 61.7 -> 47.7, Bridgewater 43.0 -> 49.8).
VA's paper lens strips the analogous `assumed` rows; CA keeps typed elective blocks but strips free electives. Three
different rules, one label.

**3d. GE taxonomy (VA).** INFERRED, rough regex classification of guide rows (va_ge.py): stripping enumerated non-STEM
named rows from both halves moves the VA credit-basis figure from 44.5 to ~48.3 with per-guide swings of -4 to +31
(GMU 49 -> 80 because its post-transfer half is mostly named GE). Direction depends entirely on how the university half
is classified, which no artefact does. The point is not the number but that VA's "GE-excluded" is not a GE exclusion.

**3e. Unit lens (for the record).** Units-GE-excluded: cs 35.3, bio 49.9, econ 51.0 — econ jumps 27 pts because the
bio/econ templates carry a derived "UC-transferable elective capacity" row that the course lens strips as padding and
the unit lens keeps (dive-ca-cross-major). Cross-major range 27.5 -> 15.7; ordering changes to econ >= bio > cs. The
cross-major gap is lens-dependent even within one state and one engine.

## 4. What is right in the claim

- All five headline values and both differences reproduce from the named artefacts.
- MA 38.3 is correctly attributed to the final-repo vintage (38.267), with 38.2 as the served/PDF-prose alternative.
- Within CA, the three majors ARE on one construction (same engine, same rules, same 1035 cells), so the cross-major
  numbers are internally consistent — they just measure template structure more than articulation.

## 5. Corrected claim

"On the MA paper's GE-excluded, all-levels, cell-equal Figure 1 lens the raw values are VA 42.3 (catalog supply, 16
CS colleges; 41.0 on all 23; 37.8 / 35.4 on scheduled supply) > MA 38.3 (final-repo heatmap; 38.2 served / PDF prose)
> CA-UC cs 31.9, and within CA econ 23.7 < cs 31.9 < bio 51.2. These are not one measure: VA's value is a credit-derived
course estimate of guide-preparation availability over the guide's stated whole-degree total with open-category rows
stripped (not a named-course count, not a GE exclusion), CA's cannot credit upper-division slots while MA's can, and the
three strip elective placeholders by three different rules. Both quoted gaps are dominated by the lower-division share of
each denominator (econ 31 / cs 47 / bio 59 / MA 57 / VA 42.5): the 27.5-pt econ->bio gap equals the 28-pt ceiling gap.
On lower-division-only scope the states order VA 99 > CA cs 68 > MA 57 and the CA cross-major range is 18.5 pts
(cs 68 -> bio 87, econ 77), so the state difference is the larger one, not the smaller."

## 6. Sources

- server/services/degreeSlots.js lines 298-480 (namedRequirementCourses; upper-division `nontransferable`), lines
  255-298 (GE/padding regexes); server/services/analysis/pathways.js lines 1183-1245 (row fields, comments).
- server/scripts/va/buildVaCoverageCells.js lines 130-160, 300-500 (courseSize, statedTotal denominator, sparePre,
  coverage_paper comments); frontend/src/analyses/vaCoverageRows.js header; docs/virginia-final-audit.md.
- server/data/ma/raw/heatmap.json; docs/ma-paper-audit.md lines 97-135; server/data/ma/PROVENANCE.md lines 79-120.
- Dossier outputs: dossier-fig1/{dist_out,ma_out,ma_units_out,va_out,ca_mech_out}.txt (2026-09-07).
- Sibling reports consulted (their findings re-verified here where cited): dive-ca-cross-major §2 and lens table,
  dive-va-mechanism §0-1, §4, §7, dive-ge-units-feasibility comparability table, dive-ma-failure-map §4.
