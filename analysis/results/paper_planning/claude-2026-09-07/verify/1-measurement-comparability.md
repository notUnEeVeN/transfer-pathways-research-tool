# verify-1-measurement-comparability — F2 (Fig 1 ceiling-normalisation reorders the states)

Reviewer stance: adversarial, measurement grounds. Working: `repro.py` / `repro_out.txt` in this directory.
Originating dossier: `scratchpad/dossier-fig1/` (no `report.md` exists there; the claim's numbers come from
`dist_out.txt`, `ma_out.txt`, `va_out.txt` and the scripts `dist.py`, `ma.py`, `va.py`, which I re-ran independently).

## Verdict: REFUTED as stated (materially misleading). Numbers reproduce; the comparison does not.

## 1. Reproduction (VERIFIED)

| state / corpus | claimed | reproduced | artefact vintage | cohort / basis |
|---|---|---|---|---|
| CA cs | 68.2 | 68.2 (n=1035 cells; per-university mean 68.2, n=9) | our computation, live DB pull 2026-09-07 08:37, degree lens | 9 UC × 115 CCC, hand-verified cs templates, GE excluded, course counts |
| CA bio / econ | 86.7 / 76.6 | 86.7 / 76.6 | same, templates `ai_researched_needs_human_verification` | same |
| MA cs | 66.4 (lower-only 57.5) | 66.4 / 57.5 (n=165) | our computation from `server/data/ma/raw/heatmap.json` = final-repo `Four Year Heatmap.xlsx` (commit d679f0f); DB-served copy differs in 1 cell (Dartmouth×Cape Cod) giving 66.2 | 11 univ × 15 CC, GE excluded, course counts, 0 verified templates |
| VA cs | 99.5 | 99.5 (n=240) | frozen `vaCoverageRows.js` catalog variant, all 240 cells `method_status: estimated` | 15 guides × 16 CS-offering colleges (of 23), catalog supply, UNITS, GE INCLUDED |

## 2. The three "ceilings" are three different quantities (VERIFIED from code)

**CA** — ceiling = Σ`lower_division_total` / Σ`total` over `degree_requirements_by_course_type`, i.e. the lower-division share of
named non-GE requirement COURSES as classified in the UC template (`degreeSlots.resolveSectionTier`: upper-division / `cc_articulable:false`
/ `tier:nontransferable` sections are never evaluated). Hard ceiling: 0 of 1035 cells have any upper-division course covered; the
ratio is IDENTICAL to lower-division-only coverage (68.2 = 68.2). Numerator = ASSIST articulation exists. **It measures articulation.**

**MA** — ceiling = lower columns / all columns, where lower/upper is the paper authors' own split (`convert_recovered.py` solves the
boundary from the workbook's "Lower" column). Soft ceiling: the authors' matrix marks UPPER columns as articulated in 94 of 165 cells
(192 upper articulations: Fitchburg "Upper Level Elective (3000)" 15/15, "Algorithms and Data Structures CSC 3700" 15/15, Worcester
"MA 150 OR MA 302" 14/15, Salem "Math Elective (post calc II)" 13/15). 21 cells exceed 100% (max 158.3; Fitchburg university mean
134.4). Numerator = MassTransfer equivalency / website lookup. **It measures articulation, against a ceiling its own numerator ignores.**
Like-for-like with CA is lower-division-only = 57.5 (capped-at-ceiling = 62.7), not 66.4.

**VA** — ceiling = `statedPreMax / statedTotal`: the university-authored guide's stated pre-transfer credit maximum over the stated
degree total (`buildVaCoverageCells.js` l.398-492) — a POLICY cap, ~50.4% by construction (60-65 of 120-134 credits), in UNITS,
GE INCLUDED (the `assumed` bucket = GE categories/elective slots, 20.2% of ceiling credits, credited 100% at every college).
Numerator = `ceilingPre − missing_units`. Hence ratio ≡ 1 − missing-supply / ceilingPre — reproduced to within 0.14 pts on all 240
cells. Every VCCS course the guide names articulates BY CONSTRUCTION (the guide is the articulation); the only failure mode is the
college's catalog not listing the course. **It measures catalog supply, not articulation.** The claim's label "structural ceiling
(catalog)" is wrong on both words: the ceiling is a policy statement, not a lower-division structure, and "catalog" names the supply basis.

So the claim divides an articulation rate (CA), an articulation rate over a leaky ceiling (MA), and a supply rate over a policy cap
with GE assumed (VA), and ranks the quotients. A methods reviewer would call this apples-to-oranges.

## 3. Sensitivity: the CA number moves 15 points with the ceiling choice alone (VERIFIED)

| construction | CA cs | CA bio | CA econ | MA | VA catalog | VA scheduled |
|---|---|---|---|---|---|---|
| claimed (each state's own ceiling) | 68.2 | 86.7 | 76.6 | 66.4 | 99.5 | 90.6 |
| lower-division-only articulation, GE excl, counts (hard ceiling) | 68.2 | 86.7 | 76.6 | **57.5** | n/a (no articulation layer in VA data) | n/a |
| VA construction: policy cap (70/120 = 58.3%), GE incl assumed 100%, units, cap-aware `pct_degree_units` | **83.1** | 94.9 | 96.6 | n/a (`pct_degree_units` null for ma-cs; heatmap has no credits, no stated cap) | 99.5 | 90.6 |

Under VA's own construction CA cs is 83.1 (UCSB 96.7, Davis 92.6), and even that still has an articulation numerator where VA has a
supply numerator. No construction exists in the data that puts all three states on one scale.

## 4. Other definitional mismatches (VERIFIED)

- **GE**: CA/MA excluded; VA included with GE assumed fully covered. (VA no-GE variants give 99.4, so GE does not drive VA's value,
  but the compared quantity is still defined differently.)
- **Units vs counts**: CA/MA counts; VA units. VA course-estimate variant 99.4; MA unit-weighted lower-only 59.1 vs 57.5 counts. Immaterial to order, still not like-for-like.
- **Cohort / supply basis**: VA uses the most favourable of four frozen variants: 99.5 (catalog, 16 CS colleges) → 97.0 (catalog, all 23)
  → 90.6 (scheduled, 16) → 85.9 (scheduled, 23). CA includes every CCC (Palo Verde 1.6%); MA every CC; VA drops 7 non-CS colleges. Catalog is the right basis for comparison with CA/MA (neither checks scheduling), but the college selection is not.
- **Verification / method status**: CA cs hand-verified; CA bio/econ and MA templates unverified; VA all cells `estimated` with source warnings.
- **Vintage**: MA raw (final repo) vs DB-served differ (66.4 vs 66.2); the final PDF prints 38.3 mean, no ceiling figure exists in any MA artefact — the ceiling is entirely our construction.

## 5. Does the CA-vs-MA reordering survive on the like-for-like measure? (VERIFIED, weakly)

Lower-division-only articulation, GE excluded, counts: CA cs 68.2 vs MA 57.5. Raw Fig 1 order (MA 38.2 > CA 31.9) does reverse.
But: per-university Welch t = 1.34 (df 17) — not significant; MA universities span 23.0–92.8, enclosing CA's 46.5–87.5; 3 UCs sit
below the MA median and 2 MA universities above the CA median. Per-college t = 4.61, but colleges are not independent of their 9/11
universities. With the claimed 66.4 the gap is 1.8 points — noise. The MA A2B split (lower-only 83.4 A2B vs 49.7 non-A2B) shows the
MA mean is a mixture, not a state-level constant.

## 6. Corrected claim

"On the one measure that is like-for-like for CA and MA — share of lower-division named, non-GE requirement courses with an articulated
CC equivalent (GE excluded, course counts) — Massachusetts CS (57.5%, 165 cells, our computation from the final-repo heatmap) sits below
California CS (68.2%, 1035 cells, verified templates), reversing the raw Figure 1 order (38.2 vs 31.9); the reversal is directional but
not statistically robust at the university level (t = 1.34). Virginia cannot be placed on this scale: its 99.5% (catalog supply, 16 CS
colleges, units, GE assumed) equals 1 − missing-supply ÷ guide pre-transfer cap, a supply measure against a university-authored policy
ceiling with no articulation content; it drops to 85.9% on scheduled supply across all 23 colleges."

## 7. What would make the comparison legitimate (INFERRED)

- Report the lower-division-only articulation rate for CA and MA only, with per-university distributions and n.
- For VA, either (a) obtain an articulation layer independent of the guides (VCCS↔university course equivalency tables) so a
  "lower-division named courses with an equivalent" measure can be built, or (b) present VA's number explicitly as supply-of-guide-credits
  and never in the same column as CA/MA.
- If a policy-cap normalisation is wanted, apply it to every state (CA: 70/120; MA: MassTransfer's stated block, absent from the data), not one.
