# verify-0-provenance-and-defects — claim F1 (Fig 1, CA/MA/VA state ordering)

Claim under review: "On the paper's own lens (GE-excluded course counts, cells equal) the states order
VA 42.3% (catalog, 16 colleges, estimated courses) > MA 38.3% > CA cs 31.9%, but the 10.4-pt state gap is
smaller than the 27.5-pt CA cross-major gap (econ 23.7 -> bio 51.2)."

Reviewer stance: adversarial, provenance only. Repository untouched. Scratch: this directory
(`hash.js`, `vaCoverageRows.{7d7d11a,HEAD,WT}.js`).

## Verdict in one line

Every number reproduces (VERIFIED), but the claim as stated is materially misleading on three provenance
points: (1) the ordering VA > MA holds only on the catalog supply basis and flips under the same module's
scheduled basis; (2) the VA value is an `estimated` credit-to-course conversion that the repo's own audit says
must not be called the MA measure; (3) the evidence line "all match figure-baseline.json" is false for VA
(baseline pins `null`) and the MA 38.3 is neither the paper's printed 38.2 nor the served/pinned 38.205.

## 1. Where the originating evidence actually is

- The task names `scratchpad/dossier-coverage-heatmap (...)/report.md`. It does not exist. The evidence lives
  in `scratchpad/dossier-fig1/` (pull.js, dist.py, ma.py, va.py, ma_units.py and their *_out.txt) and there is
  NO report.md there either. The claim's narrative is therefore unwritten; only raw outputs exist.
- Timeline (file mtimes, local): dossier pull of live coverageData 08:36–08:37 on 2026-09-07; dist/ma/va
  outputs 08:39–08:40. Uncommitted server edits on the Fig 1 path predate the pull: degreeCoverage.js 08:14,
  degreeTransferBudget.js 08:16, vaCoverageRows.js 08:20, pathways.js 08:25, degreeSlots.js 08:26,
  buildVaCoverageCells.js 08:27. So EVERY dossier number was produced by the other Codex audit's uncommitted
  working tree, not by HEAD.

## 2. Vintage / corpus of each number, and whether I reproduced it

| number | artefact vintage | corpus | status |
|---|---|---|---|
| CA cs 31.9 | our computation, live DB, working-tree code (08:36) | cs, degree lens, 1035 cells, templates `hand_verified` | VERIFIED: exact 31.915; Fig 1 cell projection sha256 of the dossier pull == pinned `cs|figure1.cell_values_sha256` in `server/data/figure-baseline.json` (committed 954c688, 2026-09-03). Uncommitted code moved nothing. |
| CA bio 51.2 | same | bio, 1035 cells, templates `ai_researched_needs_human_verification` (verified flag true by the notes convention only) | VERIFIED: 51.179; sha MATCH |
| CA econ 23.7 | same | econ, 1035 cells, same AI-researched status | VERIFIED: 23.729; sha MATCH |
| MA 38.3 | final REPO workbook (`server/data/ma/raw/heatmap.json`, commit d679f0f) | ma-cs, 165 cells, all levels, GE excluded | VERIFIED: exact 38.2671 (Cape Cod->Dartmouth 14/31). But: final PDF PROSE prints 38.2; the live DB / served figure / pinned baseline (`ma-cs|figure1` = 38.205, archive vintage, 11/31) prints 38.2; the PDF displayed-integer mean is 38.32. Only the final-repo vintage yields 38.3. |
| VA 42.3 | frozen module `frontend/src/analyses/vaCoverageRows.js`, `catalog` variant | va-cs, 15 univ x 16 CS colleges = 240 cells, catalog supply, estimated course counts | VERIFIED at two vintages: HEAD (131cf2b, built 2026-09-04) 42.3199, no `method_status`; WORKING TREE (uncommitted regenerate built 2026-09-07 08:20, i.e. the Codex audit) 42.2551, every row `method_status: estimated`. The dossier read the working-tree file (its va_out shows `estimated`). Both round to 42.3. Earlier vintage 7d7d11a: 41.75. |
| 10.4 / 27.5 | arithmetic | — | VERIFIED: 42.3-31.9 = 10.4; 51.2-23.7 = 27.5 |

Evidence statement check: "all match figure-baseline.json and the VA audit table". CA and MA match the
baseline (sha level). VA does NOT: `va-cs|figure1` in figure-baseline.json is `{rows: 384, pct: null}` — the
baseline pins nothing for VA. The VA audit table (`docs/virginia-final-audit.md`, itself UNTRACKED `??`) does
carry 42.3199 -> 42.2551. The live DB path for va-cs (`coverageData(majorSlug:'va-cs')`) returns a different
corpus entirely: 256 rows, GE-excluded 23.9%, 208/256 templates verified — that is what the served API would
give, and it would put VA BELOW CA. The claim implicitly, and correctly, relies on the frozen guide join, but
never says that the served path disagrees.

## 3. Does the ordering survive the supply basis? No.

Same frozen module, `pct_named_requirement_courses` cell mean (VERIFIED, HEAD / WT):
- catalog, 16 CS colleges: 42.32 / 42.26  -> VA > MA > CA
- scheduled, 16 CS colleges: 37.82 / 37.81 -> MA (38.2 or 38.3) > VA > CA; state gap shrinks 10.4 -> 5.9
- catalog, all 23 colleges: 41.03 / 40.96  -> VA > MA > CA
- scheduled, all 23 colleges: 35.47 / 35.43 -> MA > VA > CA

The claim's parenthetical "(catalog ...)" is accurate scoping, but "the states order VA > MA > CA" is presented
as a property of the states when it is a property of the supply toggle. The brief's own scouting says the VA
catalog view sits at 99.4% of its structural ceiling (per-college sd 0.4 points; only 18 of 240 cells miss
anything), so the 42.3 is essentially the guide-structure ceiling (42.5), not an articulation outcome the way
CA's 31.9 and MA's 38.x are.

## 4. Is VA "on the paper's own lens"? Only as an estimate.

- All 240 WT rows carry `method_status: estimated`. `pct_named_requirement_courses` for VA is credits divided
  by each guide's average small-row credit quantity (`va_course_size` 2.89–3.31), with rounding and rescaling
  (docs/virginia-final-audit.md, "Whole numbers are still estimates").
- The same doc (untracked, written by the concurrent audit) instructs that VA Figure 1 be described as
  modelled guide-preparation availability, not a literal reproduction of the MA named-course measure.
- Today's `docs/analysis-audit-2026-09-07.md` (untracked, the other Codex audit): "Rounded credit-to-course
  conversions are estimates, not enumerated class counts." The claim's "estimated courses" tag is present but
  buried in a parenthetical while the headline says "paper's own lens".

## 5. Known live defects — which ones touch this claim

- `docs/figure-defect-catalogue.md` DOES NOT EXIST ON MAIN. It was added in commit 3070277 on branch
  `refactor`, which diverged from main at bd0889d (refactor is 9 ahead, main 6 ahead; not merged). The brief
  and the memory notes cite a file that main does not carry. Cite it as `refactor:docs/figure-defect-catalogue.md`.
- Catalogue #5 (`namedGeTitled` loose `\bGE\b` on title annotations; Irvine cs denominator 14, Merced 17):
  NOT live on main. `server/services/degreeSlots.js:268-269` at HEAD and WT scopes the match to
  `titleHead(g.title)`; the dossier pull shows Irvine named total 31 and Merced 26 at all 115 colleges, and
  Irvine's mean 21.0 / Merced 45.9 equal the catalogue's "after fix" values (~21%, ~45.8%). VERIFIED.
- Catalogue #3 (Or-collapse ignores articulation_reach, 2 bio groups): affects unit pricing of the bio ledger
  (19 vs 23, 10 vs 12 units), not course counts. Fig 1 GE-excluded course counts are unaffected; the sha match
  confirms no change. Not a threat to 51.2.
- Catalogue #1 (Compare passes unfiltered knobs, wrong MA value): affects the Compare tab display only; the
  claim's numbers are not taken from Compare.
- Catalogue #2 (buildDegreeGroups tier vocabulary, 11 va-cs groups) and #10 (VA Fig 6 kill switches): affect the
  DB va-cs path and Fig 6, not the frozen VA Fig 1 module.
- Codex-audit corrections landing in the working tree: degreeSlots exact-credit summing ("Course-count
  numerators are unchanged"; 81 CS + 239 bio UNIT numerators change); pathways.js same_as alias repair and
  missing-catalog handling (legacy pathway solver, not Fig 1 counts). Consistent with the sha match.

## 6. Cohort caveats on the 27.5-pt cross-major gap

- cs templates are `hand_verified`; bio and econ are `ai_researched_needs_human_verification`. The verified
  flag is true on all 3105 rows only because "verified = verdict-flag OR notes". The cross-major gap therefore
  compares a human-verified template set against two AI-researched ones.
- Today's audit records catalog-year skew: Davis Economics and San Diego Biology/Economics templates are
  2026–27 against a 2025–26 articulation cohort. It also lists four CS template unit-closure failures
  (Merced/Riverside/UCLA/Santa Cruz) — these affect unit lenses and Fig 4-type measures, not named-course counts.
- Per-university spreads (dossier dist_out, VERIFIED): econ 15.9–32.3, cs 21.0–45.9, bio 38.8–57.4; the
  cross-major ordering econ < cs < bio holds at every one of the 9 campuses except none overlap on means, so the
  gap is not a single-campus artefact.

## 7. Would it survive the concurrent Codex audit?

Numerically yes: the audit's own validation receipts state Fig 1 course-count numerators are unchanged, MA
Fig 1 reproduces 165/165 at 38.2671312%, and VA regenerated to 42.2551 (rounds identically). Framing no: the
audit labels every VA cell and every MA modelled pair `estimated` and insists VA course counts are not
enumerated classes; a reviewer applying that standard will reject "paper's own lens" for VA and will ask why
MA is quoted at 38.3 when the paper prints 38.2 and the site serves 38.2.

## 8. Surviving form of the claim

"On the GE-excluded named-course lens, equal-weighted cells: CA cs 31.9% (1035 cells, hand-verified templates),
MA 38.2% as printed / 38.3% from the final workbooks (165 cells), and VA 42.3% ONLY on catalog supply (240
cells, 16 CS colleges, credits converted to estimated course counts, every cell flagged `estimated`, sitting at
99% of its structural ceiling); on scheduled supply VA falls to 37.8% and drops below MA. The CA cross-major
spread econ 23.7 -> bio 51.2 (27.5 pts, bio/econ templates AI-researched) exceeds any state gap under either
supply basis (10.4 catalog, 5.9 scheduled)."
