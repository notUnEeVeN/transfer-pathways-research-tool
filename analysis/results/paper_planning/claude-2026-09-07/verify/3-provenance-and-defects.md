# verify-3-provenance-and-defects — claim F4 (Fig 1, "the same four courses fail in all three states")

Reviewer stance: adversarial, provenance-focused. Repository READ-ONLY (nothing under `internal_tool/` was edited). All scratch files under this directory. Date: 2026-09-07.

The originating path named in the task (`dossier-coverage-heatmap (...)/report.md`) does not exist; `dossier-fig1/` has no `report.md` either. I treated its scripts and outputs (`pull.js`, `ca_mech.py`/`ca_mech_out.txt`, `ma.py`/`ma_out.txt`, `va.py`/`va_out.txt`, the saved `coverage_*.json` pulls) as the evidence.

## Claim under test

"The same four courses fail in all three states: CS2/OOP, data structures, discrete structures and computer organisation are 69.1% of CA cs's lower-division shortfall, 70.6% of MA's, and the top missing rows in VA's scheduled view (CSC 223 in 75 cells, CSC 205 ≈60, CSC 222 45, CSC 208/MTH 288 41, MTH 264/265 39)."

## Verdict

**REFUTED as stated (materially misleading), confidence 0.9.** The three quoted percentages/counts reproduce from the dossier's own artefacts (numbers_reproduced = true), but the sentence that wraps them does not follow from them:

1. **69.1% and 70.6% are the `computing` COURSE-TYPE axis share of the lower-division shortfall, not the share of four named courses.** The site's classifier (`server/services/courseTypes.js`, `DISCRETE_MATH` rule, "the paper's single documented exception") routes discrete math/structures to the **math** axis. So one of the four named courses (discrete) is by construction *outside* the 69.1%/70.6%, while CS1, operating systems, networking, databases, seminars, ethics-in-computing, digital electronics etc. are *inside* it. The claim substitutes a four-course list for a type axis it does not match.
2. **Per-course censuses (VERIFIED, below) put the four families at roughly half of the lower-division shortfall, not 70%:** MA 445/935 = **47.6%** (final-repo `raw/heatmap.json`, my family regex; the sibling MA dive's concept table agrees), and CA cs — see section 4 (live DB, 1,035 college×campus evaluations).
3. **The VA counts are not "failures" of the same kind, and their ranking is an artefact of the cell grain.** In VA nothing fails to *articulate* (the guide is the pathway; catalog-supply view misses only 11 distinct requirements in 18 of 240 cells). The scheduled-view "missing" rows mean *a college lists the course but does not schedule it in a one-term snapshot* (captured 2026-08-31, no term recorded). And each cell count is (colleges lacking the course) × (universities naming it): "CSC 223 in 75 cells" = **5 colleges × 15 universities**; "CSC 222 45" = **3 colleges**; "MTH 264/265" = **3 colleges**. The largest VA supply gaps by *college count* are actually CSC 205 (**11 of 16** colleges) and CSC 208/MTH 288 (**11 of 16**), which the claim ranks 2nd and 4th. The claim also lists MTH 264/265 (calculus, math axis) among the "top missing rows", which contradicts its own "same four courses" framing.
4. The claim's own VA numbers are internally inconsistent with the artefact: "CSC 205 ≈60" is 82 cells at the family level (or 48 on two label spellings); "CSC 208/MTH 288 41" is 59 cells at the family level; "MTH 264/265 39" is 24+15 label counts that double-count the 11 cells missing both (28 distinct cells).

Provenance findings that do NOT sink the claim (but must be disclosed) are in section 2.

## 1. Where each number comes from (artefact vintage × corpus)

| number | artefact / vintage | corpus | how produced | reproduced? |
|---|---|---|---|---|
| CA cs 69.1% | **our computation**, live Atlas DB via working-tree `coverageData(cs, degree)` pulled 2026-09-07 08:37 (`dossier-fig1/pull.js`) | CA cs, 1,035 cells (115 CC × 9 UC), degree lens, GE excluded, course counts, lower-division rows of `degree_requirements_by_course_type`, all 9 templates `degree_template_verified: true` (Tybalt Mallet, 2026-07-24) | pooled Σ(lower_division_total − lower_division_covered) by type ÷ Σ over types | VERIFIED: computing short 2,917 / total LD short 4,222 → 69.1%. The pulled rows hash-match the committed `figure-baseline.json` (`cs|figure2` and `cs|figure1` `cell_values_sha256`, commit 954c688 2026-09-02) — `hash_check2.js`. |
| MA cs 70.6% | **our computation**, live DB `coverageData(ma-cs, degree)` — which is the **older heatmap vintage** (Cape Cod × Dartmouth = 11/31, mean 38.2055; the final repo has 14/31, 38.2671 — `server/data/ma/PROVENANCE.md` "Final audit corrections") | MA ma-cs, 165 cells, GE excluded, course counts, templates `verified: false`, `research_status: paper_source` | same pooling | VERIFIED 70.6 from the dossier rows; rows hash-match `ma-cs|figure2` in the committed baseline. My independent recount from the final-repo `raw/heatmap.json` with my own regex gives computing axis **73.8%** (discrete→math) — same order, so the vintage is immaterial to the share, but the claim should say "older DB vintage". |
| VA counts | **our computation** from the frozen `frontend/src/analyses/vaCoverageRows.js` **working-tree** copy (md5 b616fe55…, regenerated 2026-09-07 08:20 by the concurrent Codex audit; HEAD 131cf2b differs) | VA va-cs, `scheduled` variant, 240 cells (15 univ × 16 CS colleges), `method_status: estimated` on all 240 | `Counter` over `va_missing[].requirement` label strings | VERIFIED label counts (55+20, 33+12, 32+16, 21+12+8, 24+15). Identical in HEAD (131cf2b) and 7d7d11a — `va_vintages.py` — so vintage-stable; the only WT change is dropping the false "Any UCGS course or PED 101 and HLT 110" 15-cell miss and adding `method_status`. |

## 2. Provenance attacks, one by one

### 2.1 Uncommitted working tree
The dossier's `pull.js` `require`d the working-tree `pathways.js`/`degreeSlots.js`/`degreeCoverage.js`, all modified by the other Codex audit. Checked the diffs: `pathways.js` changes touch creditLoss/choiceCost/complexity/timeToDegree (units, placeholders, `method_status`), not `degreeRequirementCoverageData`; `degreeSlots.js` changes affect **unit** numerators (`exactReceiverUnits`) and the ledger stamp, not the by-type course counts; `degreeCoverage.js`/`degreeTransferBudget.js` are unit/cap plumbing. The audit doc (`docs/analysis-audit-2026-09-07.md`) states "Course-count numerators are unchanged" and "typed-course totals reconcile to the named-course population". **Proof:** the dossier's four coverage pulls hash-match the committed baseline for both `figure1` and `figure2` projections (8/8 MATCH). → The CA/MA percentages do not depend on the uncommitted change. VERIFIED.

The VA module in the working tree IS a regenerated artefact (2,067,208 bytes vs 1,278,473 at HEAD). The named-course missing counters are identical across 7d7d11a / HEAD / WT (`va_vintages_out.txt`). → Vintage-robust for the numbers quoted; but the claim should cite the WT regeneration (the "cells with missing" count is 133 in WT vs 139 at HEAD).

### 2.2 Older artefact vintage
- MA: the live DB is the older heatmap vintage (11/31 cell); the final repo differs in that one cell (3 column verdicts). Share of shortfall by axis unaffected beyond rounding. Must be labelled.
- CA: templates updated 2026-07-23, verified 2026-07-24; baseline pinned 2026-09-02. Current.
- VA: capture 2026-08-31 (scheduling snapshot, one term, no term recorded — sibling `dive-va-mechanism` §2.1). "Scheduled" is a lower bound on annual availability; a spring-only course reads as unscheduled. The claim's VA leg is therefore a one-term snapshot, not a structural failure.

### 2.3 Known live defects (`docs/figure-defect-catalogue.md`)
The file is **not in `main`** (`git cat-file -e HEAD:docs/figure-defect-catalogue.md` fails; it exists only in commit 3070277, which is not an ancestor of HEAD). Read from that commit:
- Defect 4 ("`degree_requirements_by_course_type` is two computations behind one name"): for cs/bio/econ/ma-cs the field is per-course, GE-excluded via `namedGeFlavored`; only va-cs differs. The claim uses cs and ma-cs only → consistent basis. Not a threat.
- Defect 5 (`namedGeTitled` trips on title annotations): GE-excludes Irvine's and Merced's *upper-division* blocks from the denominator. Lower-division shortfall (the claim's basis) unaffected. Not a threat to the share; would change the all-level coverage.
- Defect 1 (Compare passes unfiltered knobs, wrong MA value): frontend-only, the dossier used the server rows. Not a threat.
- Defects 2/3 (tier bypass, Or-collapse reach): 11 va-cs groups / 2 bio groups; VA counts here come from the frozen guide join, not `buildDegreeGroups`. Not a threat.

### 2.4 Unverified cohort
`coverageData` has **no `verifiedOnly` option** (signature at `pathways.js:1320`); Fig 1 has no verified cohort. CA cs rows are nonetheless 1,035/1,035 on verified templates. MA templates are `verified: false` (paper_source) — expected for that corpus. VA is `method_status: estimated` on all 240 cells (WT) — the claim's status "verified" is wrong for its VA leg; the audit says Fig 1 VA "should be described as modelled guide-preparation availability".

### 2.5 Estimated VA `method_status`
All 240 VA cells are `estimated` (WT). The *missing-course lists* themselves are not estimates (they are a set difference between guide codes and the college's catalog/scheduled sets), but the claim inherits the `estimated` status and the one-term caveat.

### 2.6 Would it survive the concurrent Codex audit?
The numbers, yes (hash-identical inputs; VA counters unchanged by the regeneration). The sentence, no: the audit relabels the VA course lens "Estimated courses… not a count of enumerated courses" and the VA figures as supply availability, and the classifier rule (discrete → math) is documented in the very file the audit leaves untouched. Any reviewer who opens `courseTypes.js` sees that "discrete structures" cannot be inside a "computing" share.

## 3. MA per-course census (VERIFIED, our computation, final-repo `raw/heatmap.json`, lower-division columns only, 15 CCs × columns = 935 uncovered cells; `ma_family2.py`)

| family | uncovered / cells | share of LD shortfall |
|---|---|---|
| CS1 | 141/240 | 15.1% |
| CS2 / OOP / Java II–IV / Computing II–IV | 139/255 | 14.9% |
| data structures / algorithms | 86/135 | 9.2% |
| discrete (→ **math** axis in the site) | 105/180 | 11.2% |
| computer organisation / systems / digital | 115/180 | 12.3% |
| other computing (OS, networks, DB, seminar, ethics, electives…) | 209/405 | 22.4% |
| math (calc, linear, stats) | 72/435 | 7.7% |
| science | 28/390 | 3.0% |
| non-STEM | 40/105 | 4.3% |

Four named families = **47.6%**; excluding discrete (as the site's axis does) = **36.4%** of the LD shortfall = **49.3% of the computing-axis shortfall**; CS1 is 20.4% and "other computing" 30.3% of the computing-axis shortfall. Site-axis shares from this recount: computing 73.8 / math 18.9 / science 3.0 / non-STEM 4.3 (dossier, older DB vintage with the site classifier: 70.6 / 18.9 / 3.3 / 7.2 — consistent). The sibling `dive-ma-failure-map` concept table (articulated/potential: CS1 64%, CS2 51%, DS 36%, discrete 38.5%, comp-org 40.7%, applied computing 14.8%, CS3+/methodology 15.2%) is the same picture.

## 4. CA per-course census (our computation, live DB, working-tree `evaluateDegreeAtCollege`, 1,035 evaluations)

Method (`ca_census.js`, `ca_census_analyze2.py`): for every (school_id, community_college_id) in the dossier's `coverage_cs.json`, called `evaluateDegreeAtCollege(db, {schoolId, communityCollegeId, majorSlug:'cs'})` (working-tree `degreeCoverage.js`; 1,035 calls, 241 s, 0 errors) and read the per-receiver ledger: non-GE groups (title not `GE:`), groups the coverage row lists in `degree_groups_not_modelable` dropped, course/series receivers only, `must_take_at_university` receivers treated as upper division, take-all sections counted per receiver, choose-N sections counted as ask − min(ask, articulated) and attributed to the first receiver's family. Families by university code/title regex with an explicit (campus, code) override table for cross-campus code collisions (UCSC CSE 20 = CS1, UCSC CSE 30 = CS2, Merced CSE 022 = CS1, UCSD CSE 11 = CS1, …). Discrete kept separate and mapped to the math axis as the site does.

**Caveat (important):** this is the *ledger* lens, not the *slot* lens the by-type figure uses (`buildDegreeGroups` with `categoryOf`). Totals differ — my computing-axis observations are 4,025 (2,153 uncovered) against the by-type figure's 5,175 (2,917 uncovered) — because of Or-collapse/choose-N handling, EE/EECS prefix routing, and the `not_modelable` drop. So the shares below are APPROXIMATE (INFERRED to be within a few points of the slot lens); the direction is robust.

| family | uncovered / obs | share of LD shortfall | share of computing-axis shortfall |
|---|---|---|---|
| CS1 | 453/1,035 | 12.5% | **21.0%** |
| CS2 / OOP | 338/805 | 9.4% | 15.7% |
| data structures | 287/690 | 7.9% | 13.3% |
| computer organisation / systems | 628/1,035 | 17.4% | 29.2% |
| other computing (UCLA CS 35L 115/115, Irvine ICS 53 114/115 and IN4MATX 43 112/115, UCLA CS M51A 106/115) | 447/460 | 12.4% | **20.8%** |
| discrete (math axis) | 563/1,265 | 15.6% | — |
| calculus/linear/stats | 431/4,945 | 11.9% | — |
| science | 297/2,415 | 8.2% | — |
| non-STEM | 168/345 | 4.7% | — |

Four named families incl. discrete = **1,816/3,612 = 50.3%** of the CA cs lower-division shortfall; excluding discrete = 34.7% of the LD shortfall = 58.2% of the computing axis. CS1 alone (Berkeley CS 61A 110/115, Davis ECS 36A 76/115, Irvine ICS 31 44/115) and campus-specific systems/lab courses (UCLA CS 35L, UCSC CSE 13S, UCSD CSE 29, Irvine ICS 53 — each dead at ≥114 of 115 colleges, exactly like MA's dead columns) are the other ~42% of the computing shortfall. So in CA too, "the four courses ≈ 69% of the shortfall" overstates by roughly 20 points and hides that the biggest single failures are campus-idiosyncratic courses no CC can match.

## 5. VA: what the counts actually are (VERIFIED, `va_vintages_out.txt`; identical in 7d7d11a / HEAD / WT)

| family (label variants merged, one per cell) | scheduled cells (of 240) | **distinct colleges (of 16)** | catalog cells |
|---|---|---|---|
| CSC 205 comp org (incl. "or/+ CSC 215") | 82 | **11** | 3 |
| CSC 223 data structures | 75 | 5 | 0 |
| CSC 208 / MTH 288 discrete | 59 | **11** | 8 (4 colleges) |
| CSC 222 OOP | 45 | 3 | 0 |
| MTH 264/265 calculus | 28 (claim's 39 double-counts 11 cells missing both) | 3 | 0 |
| CSC 215 | 10 | 10 | 3 |

The sibling `dive-va-mechanism` §2.2 table (from `.va-courses/catalog/*.json`) gives the same college-level picture: CSC 223 listed-not-scheduled at Blue Ridge, Central Virginia, Southwest, Virginia Highlands, Wytheville; CSC 222 at Camp, Central Virginia, Southwest; CSC 205 unscheduled at 8 and CSC 208 unscheduled/absent at 6 — the cell counts differ from college counts only because of how many universities name each course (CSC 205 12/15, CSC 208 14/15, CSC 223 15/15). Ranking VA's failures by cell count therefore ranks universities' demand, not colleges' supply.

## 6. Corrected claim (what survives)

"On the site's course-type axis (discrete → math), the **computing** type is 69.1% of CA cs's lower-division named-course shortfall (our computation, live DB rows hash-identical to the committed 2026-09-02 baseline, 1,035 cells, verified templates) and 70.6% of MA's (our computation, older DB heatmap vintage, 165 cells, unverified paper-source templates; 73.8% from the final-repo raw heatmap). Per-course censuses put CS2/OOP + data structures + computer organisation + discrete at roughly **half** of the lower-division shortfall in both states (MA 47.6%, CA ≈50% on the ledger lens), with CS1 and campus-specific systems/software courses making up the rest of the computing gap. In Virginia the same course families do not fail to *articulate*; on a one-term scheduling snapshot (captured 2026-08-31, `method_status: estimated`) they are listed-but-unscheduled at some of the 16 CS colleges — computer organisation (CSC 205) and discrete (CSC 208/MTH 288) at 11 colleges each, data structures (CSC 223) at 5, OOP (CSC 222) at 3, calculus II (MTH 264/265) at 3."

## 7. Files

- `report.md` (this), `ma_family2.py` / `ma_family2_out.txt` (MA per-family census), `va_vintages.py` / `va_vintages_out.txt` (VA three-vintage recount + per-college attribution), `hash_check2.js` (dossier rows vs committed baseline: 8/8 MATCH), `ca_census.js` / `ca_census.json` / `ca_census_analyze2.py` / `ca_census_out2.txt` (CA per-course ledger census), `probe.js`.
- Sibling artefacts relied on: `dossier-fig1/*`, `verify-0-provenance-and-defects/vaCoverageRows.{HEAD,7d7d11a}.js`, `dive-ma-failure-map/report.md` §1b–1c, `dive-va-mechanism/report.md` §2.
