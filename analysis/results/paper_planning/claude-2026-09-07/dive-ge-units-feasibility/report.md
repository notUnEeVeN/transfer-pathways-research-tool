# Is a "GE included + unit weighted" MA Figure 1 feasible and defensible?

Label: dive-ge-units-feasibility. Date: 2026-09-07. Read-only on the repository; scratch scripts and outputs live next to this file:
`proto.py` / `proto_out.json` (unit-weighted variants, join breakdown), `proto2.py` (residue classification, duplicate census, variant iv),
`ge_empirical.js` / `ge_empirical.json` (GE removal on the 61 pathway pairs via the repo's own `buildMaDocuments`),
`ca_units2.js` (CA/MA unit lenses pulled live from Atlas).

Vintage vocabulary (per the brief): **final PDF** = `2027_SIGCSE_Virtual_MA_Transfer_Pathways.pdf`; **final repo** = `CIC-CC-Paper` (`server/data/ma/final/`);
**older repo** = `ma_paper/transferpaper`, whose commit `59c1b77` ("leaning git rn", 2024-12-12) is the only home of the per-course workbooks
(`server/data/ma/recovered/`); **our computation** = my scripts over `raw/heatmap.json` (final-repo heatmap) + `raw/pathways.json` (older-repo 4y and transfer tabs).
Corpus for every MA number: state MA, major ma-cs, 11 universities x 15 community colleges = 165 cells, no verified cohort (ma-cs is unverified by design).

## Short answer

1. **Unit weighting is feasible and nearly free of consequence.** Credit hours per BS requirement exist only in the older repo's resident "4y" tabs
   (`All Pathways/<university>.xlsx`, column H "Credit Hours", commit 59c1b77). They join 214 of the 270 final-heatmap requirement columns (79.3%,
   VERIFIED: 187 by code, 27 by name). The 56 unmatched columns are **not** prerequisite rows or genuine duplicates: 52 are elective-slot placeholder
   columns ("Upper Level Elective (400)", "Natural Science Elective", "CSC Elective", ...), 2 are OR-alternative headers, and 2 are renumbered codes.
   Unit-weighting the named population (variant i) moves the 165-cell mean from **38.27% to 39.57%** (+1.3 pts) with Spearman rho = **0.996** against the
   course count and rho = 1.000 on the eleven university means. The fallback credit for unmatched columns (3 / 4 / campus-modal) moves the mean by at most
   0.5 pts (39.83 / 39.57 / 40.07). The choice between counts and units is therefore cosmetic for MA.

2. **GE inclusion is not a measurement in MA; it is an assumption, and the assumption is the whole figure.** No artefact in either repo assesses
   general-education articulation per CC x university for the 165 pairs (VERIFIED: the final and older heatmap workbooks have no GE columns; the
   `Community College Heatmap.xlsx` is a transposed view of the same columns; the final repo has no per-course sheets at all). GE exists only as (a) the
   residue of the older resident plans (8-25 rows, 24-76 credits per university) and (b) gray rows in the 61 older-vintage transfer tabs. The site's 63.7%
   "GE included" MA value (reproduced exactly: 63.73%) credits every residue row at 100% at every college. That residue is **not GE**: of its 610 credits,
   303 are true GE (placeholders + writing/seminar/communication), 111 are free electives, and **196 are STEM fillings** (upper-division CS electives such as
   UMass Amherst COMPSCI 320/348/420/453/446 and UMass Dartmouth CIS 402/440/454/467/446/452/432/469, plus physics, biology, Calculus III), i.e. the concrete
   courses the resident plan put into the elective slots the heatmap left unmatched. The paper's own 61 transfer tabs remove only **40.9%** of residue
   units pooled (mean 39.8%; range 19.6% at UMass Lowell to 56.5% at Westfield), 44.9% of the non-STEM residue and 30.9% of the STEM fillings. A
   defensible GE assumption bounded by the MassTransfer GenEd Foundation (34 credits, 11 courses; STEM variant 28 credits) covers at most about
   half of the residue.

3. **Verdicts.** Variant (i) named-only units, 4-credit fallback: **feasible with stated caveats** (but gains nothing over the count).
   Variant (ii) drop unmatched columns: **feasible but not defensible as Figure 1**: it removes the 52 elective-slot requirements the paper kept in its
   denominator (36 of them upper-division) and re-ranks universities (university-mean rho 0.864; Salem 46 -> 35, Bridgewater 43 -> 52).
   Variant (iii) GE residue at 100%: **not defensible as-is** (mean 63.6%, but the block is mislabeled and contradicted by the paper's own pathway sheets);
   defensible only in the reduced form (iv), true GE + free electives at 100% over the resident total with STEM fillings at 0, which gives **53.5%**; the
   MA GE-inclusive value ranges 53.5-74.4% purely on how "GE" is defined. **Recommended form for the paper:** keep Figure 1 as the paper's published
   course-count, GE-excluded measure (the only form all three states share and the only one that reproduces the submitted artefact), optionally with a
   unit-weighted GE-excluded companion (CA 35.3 / MA 39.6 / VA 44.4), and treat GE inclusion as a stated-assumption sensitivity, never the headline.

## (a) Where the credit hours live, and how the 270 columns join

**Artefact (older repo).** `ma_paper/transferpaper` at commit `59c1b77` holds `Sheets/All Pathways/*.xlsx` (11 workbooks). Each has a resident "4y tab"
(Curricular Analytics format: Course ID, Course Name, Prefix, Number, Prerequisites, Corequisites, Strict-Corequisites, **Credit Hours**, Institution) and
one transfer tab per studied CC. Vendored unchanged as `server/data/ma/recovered/All Pathways/` and converted to `raw/pathways.json` (`resident` rows carry
`credits`). The working tree of that repo (`Code + Sheets/`) and the final repo carry **no per-course sheets**; the four notebooks never read credits
(`heatmap.ipynb` reads the `Lower`/`Upper` ratio columns only; `ch_currcomp.ipynb` reads the typed `Pathways Master` tabs). VERIFIED by `git ls-tree`,
`git show --stat 59c1b77`, sheet inspection, and a grep of all notebook code cells.

**Definition of the published measure (final PDF, p.2-3).** "Our analysis included degree and college requirements but excluded general education
requirements"; the heatmap cell is COUNTIF(TRUE)/COUNTA over the row (workbook formula, VERIFIED in `final/Four Year Heatmap.xlsx`). Footnote 5 of the
final PDF is decisive about intent: the transfer-credit rate (Fig 3) "is notably different from our metric in Section 3 in three ways ... Second, we look
at credits rather than number of courses. Third, we include general education requirements." The authors chose course counts and GE exclusion for
Figure 1 knowingly; Figures 3-5 are already the "credits + GE" form. The older `main.tex` had a lower-division-only version (mean 61.4%); the final PDF
kept all levels (mean 38.2%).

**Join reproduction (our computation, multiset consumption exactly as `buildMaDocuments.js consumeResident`: code first, then normalized name).**

| university | columns | matched | by code | by name | unmatched | reasons |
|---|---|---|---|---|---|---|
| Bridgewater | 22 | 15 | 15 | 0 | 7 | 2 Natural Science Elective, 5 Upper Level Elective (3000) |
| Fitchburg | 23 | 22 | 16 | 6 | 1 | 1 Upper Level Elective (3000) |
| Framingham | 20 | 19 | 15 | 4 | 1 | Data Structures listed as CSCI 217, plan has CSCI 271 (renumbered) |
| MCLA | 25 | 22 | 21 | 1 | 3 | 3 Upper Level Elective (300) |
| Salem | 24 | 17 | 15 | 2 | 7 | 2 CSC Elective, 4 Natural Science Elective, 1 Math Elective (post calc II) |
| UMass Amherst | 22 | 12 | 12 | 0 | 10 | 2 Natural Science Elective, 7 Upper Level Elective (300/400), 1 OR-header (MATH 233 OR STAT 515; plan has MATH 223) |
| UMass Boston | 21 | 18 | 18 | 0 | 3 | 2 Upper Level Elective (400), CS 341 vs plan CS 341L (lab suffix) |
| UMass Dartmouth | 31 | 18 | 18 | 0 | 13 | 1 Any Elective, 1 Math Elective, 3 Natural Science, 8 Upper Level Elective (400) |
| UMass Lowell | 31 | 29 | 19 | 10 | 2 | 2 Upper Level Elective (3000) |
| Westfield | 26 | 22 | 22 | 0 | 4 | 2 Natural Science, 2 Upper Level Elective (300) |
| Worcester | 25 | 20 | 16 | 4 | 5 | 4 Upper Level Elective (300), 1 OR-header (UR 230 OR PH 134; plan has PH 134) |
| **total** | **270** | **214** | 187 | 27 | **56** | 52 elective placeholders (36 upper, 16 lower) + 2 OR-headers + 2 renumbered codes |

Reproduces the orchestrator's 214/270 = 79.3% and its weakest joins (Amherst 12/22, Bridgewater 15/22, Dartmouth 18/31, Salem 17/24). Two corrections
to the brief's working assumptions: (1) **no unmatched column is a prerequisite row**; the README's "courses which are prerequisites to requirements are
also featured" columns (e.g. Computer Science I) all join to resident rows; (2) **no unmatched column is a genuine course duplicate**; every repeated
header in the final heatmap is an elective placeholder (Bridgewater 5x "Upper Level Elective (3000)", Dartmouth 8x "Upper Level Elective (400)", Salem 4x
"Natural Science Elective", Lowell 4x "General Elective (any course)"). MCLA's final heatmap lists Programming in Java I, II, III and IV as distinct
columns; the "Java II twice" observation does not hold on the final vintage.

**Denominator inflation, quantified (our computation).** Named-column unit sum with the 4-credit fallback = 943 credits across the 11 templates;
GE residue = 610; site template total 1,553 vs resident total 1,329 (sum of the older 4y tabs: 120-123 each). The excess is **224 = 56 x 4 exactly**: the
fallback credits of the unmatched elective-slot columns, whose concrete fillings are *also* counted inside the residue. Per university (named+residue vs
resident): Bridgewater 151 vs 123, Fitchburg 124 vs 120, Framingham 126 vs 122, MCLA 132 vs 120, Salem 149 vs 121, Amherst 161 vs 121, Boston 132 vs 120,
Dartmouth 172 vs 120, Lowell 129 vs 121, Westfield 137 vs 121, Worcester 140 vs 120. This double count is invisible in the GE-excluded course lens (the
residue is not in it) and only bites when GE is added.

## (b) Does any artefact assess GE per CC x university for all 165 pairs? No.

VERIFIED by inspection: `final/Four Year Heatmap.xlsx` and `recovered/Mass Heatmap.xlsx` share the same sheet set (Tallys, 11 university tabs, OG Work)
and their row-1 headers are the 270 named columns only; no GE column anywhere. `recovered/Community College Heatmap.xlsx` (15 CC tabs) is a transposed
per-CC listing of the same headers with the Lower / Lower+Upper ratios. GE appears in exactly two places, both older vintage: the 4y tabs' residue rows
(largely `elec xxx` placeholders named "Arts", "Humanities", "Social Science", plus writing/seminar courses) and the gray (FFCCCCCC) rows of the 61 transfer
tabs; e.g. Bristol -> Bridgewater shows Composition I/II, two "West and the World" history courses, Technical Writing, Micro-economics and one Arts slot in
gray, while other Arts/Humanities/Social Science slots stay unfilled. Those 61 tabs are the *only* per-pair GE evidence, and they measure what the
proximity-selected AS pathway happened to carry, not what could articulate.

**Empirical check of the "100% articulable" assumption (our computation via the repo's `buildMaDocuments` overlay, 61 `order-approximate` pairs):**
residue units removed by the overlay = 1,358 / 3,321 = **40.9%** pooled (mean 39.8%). Non-STEM residue (true GE + free electives): 1,064 / 2,371 = 44.9%.
STEM fillings: 294 / 950 = 30.9%. Per university: Lowell 19.6%, Boston 26.5%, Dartmouth 30.4%, Bridgewater 36.5%, Framingham 42.7%, Worcester 46.3%,
Salem 47.5%, Fitchburg 49.7%, Amherst 50.9%, MCLA 52.7%, Westfield 56.5%. This is an AS-driven transfer rate, so it is a lower bound on articulability,
but it is the only pair-level GE evidence the paper produced, and it sits far below 100%.

**What the MassTransfer GenEd Foundation would justify (CONTEXT).** mass.edu (`https://www.mass.edu/masstransfer/gened/home.asp`, fetched 2026-09-07)
states the GenEd Foundation is "11 courses (34 credits)", or "9 courses (28 credits)" for STEM associate degrees, and "is accepted at any community college,
state university, or UMass campus in the System" (MassArt and Mass Maritime excepted; STEM GenEd benefits apply only inside a completed associate degree).
The policy as I recall it also allows the receiving campus to require up to 6 additional GE credits; I could not fetch that clause (the detail pages 404),
so treat it as unverified. What this justifies: an assumption that a CC student can bring **a 28-34 credit GE block** that is honored statewide. It does
**not** justify treating the 610-credit residue as articulable: 196 credits of it are major/science courses and 111 are free electives (which transfer as
elective credit, not GE), and the true-GE part alone (303 credits, mean 27.5 per university) already exceeds the 28-credit STEM block at several campuses
(Bridgewater 48, Worcester 42, Fitchburg 33, Framingham 32).

## (c) Does the final repo add anything for this purpose? No.

The final repo (`CIC-CC-Paper`, 6 commits 2026-05-02 to 2026-08-25) holds `Four Year Heatmap.xlsx`, `Pathways Master.xlsx` and four notebooks. Its
differences from the older vintage are the normalisation of resident totals to 120, ten pathways revised to 120 hours, the Tallys revision, and the
heatmap update that moves Cape Cod x Dartmouth to 14/31 (all already recorded in PROVENANCE.md). It carries no credit hours per requirement, no GE columns,
no per-course sheets. For a unit-weighted or GE-inclusive Figure 1 it contributes nothing beyond the 165 booleans; every credit must come from the older
vintage, whose resident plans (121-123 at four campuses) the final repo itself abandoned.

## (d) How the site's 63.7% arises, and whether CA and VA use the same rule

**MA (VERIFIED, reproduced to 63.73% vs pinned 63.69%).** `buildMaDocuments.js` builds three groups per template: lower-division named (heatmap columns,
`transferable`), upper-division named (`nontransferable`), and "GE: general education and electives" = every resident row no heatmap column consumed
(the multiset residue), tier `transferable`. In `degreeSlots.js`, `namedGeFlavored` classifies that group as GE by its title, and `geSectionCourses`
returns `total = section_advisement` (the residue row count) and `covered = total` whenever the tier is not `nontransferable`, **independent of the college**.
So `pct_named_requirement_courses_with_ge` = (articulated named + n_residue) / (named + n_residue). Per university that adds 8 (Lowell) to 25 (Bridgewater)
rows credited at 100%; the 165-cell mean rises 38.2 -> 63.7 and the between-university sd falls from 19.6 to 12.0 pts. The per-pair GE overlay from the
transfer tabs is used by Figure 3 (as sending-course options) but never by Figure 1.

**CA (VERIFIED from live rows, 1,035 cells, all verified templates).** Same function, same rule: authored GE sections (IGETC/Cal-GETC-shaped, ~25% of
degree units) are counted covered wherever their tier is transferable; upper-division GE counts against, so the GE block is 89.6% covered for cs
(94% bio/econ), not 100%. cs course count 31.9 -> 46.0 with GE; units (rollup `units.covered/units.total`) 35.3 GE-excluded -> 48.9 GE-included.
**VA (frozen rows, 240 cells, 16 CS colleges).** Different code path (`buildVaCoverageCells.js classify`): rows with no course codes or kind
`gened_category` are `assumed` and credited at full units; the GE block is only 12.5 credits of a ~124-credit stated total (10%), because most VA GE is
named (ENG 111, etc.) and checked against supply. Catalog: 44.4% no-GE units -> 50.2% with GE; scheduled 39.4 -> 45.6. Ceiling 50.4% by construction.
**So the rule is conceptually the same in all three (policy-assumed 100% for the transferable GE block) but the block's size and content are not:**
CA 25% authored GE; MA 39% of rollup units, one-third of it STEM fillings and free electives; VA 10%. GE-inclusive numbers are therefore not like-for-like.

**Side observation (do not fix; catalogue-style).** The brief says unit fields are server-nulled for `unitCoverage:false` corpora. Only the budget fields
are (`pct_degree_units`, `degree_units_satisfied`, `degree_transfer_cap`, `degree_units_binding`). `degree_units_named_total/covered` and
`degree_units_ge_*` are still populated for ma-cs and are wrong (mean GE-excluded unit coverage 7.3%, Bridgewater 1.0%; the `ge_covered` clamp equals the
whole rollup). Any consumer that reads those fields for MA gets garbage; my prototype below does not use them.

## Prototype: unit-weighted MA Figure 1 (our computation, 165 cells, final-repo booleans x older-repo credits)

Definitions. count = paper's measure. (i) v1 = articulated named units / all named units, unmatched columns at 4 credits. (ii) v2 = same over matched
columns only. (iii) v3 = (articulated named units + residue units) / (named units + residue units), residue 100%. (iv) v4 = (articulated matched named units
+ true-GE + free-elective units) / resident total, STEM fillings and unmatched slots at 0. Also shown: count_ge (the site's rule) and "residue over resident
total" (whole residue at 100% over the 4y-tab total).

| measure | 165-cell mean | sd | Spearman vs count | university-mean Spearman | mean abs diff vs count |
|---|---|---|---|---|---|
| count (paper) | 38.27 | 19.6 | 1 | 1 | 0 |
| (i) v1 units, 4u fallback | **39.57** | 19.5 | **0.996** | **1.000** | 1.6 pts (max 5.3) |
| (ii) v2 drop unmatched | 40.69 | 21.9 | 0.947 | 0.864 | 6.1 pts (max 18.4) |
| (iii) v3 + residue at 100% | 63.59 | 11.6 | 0.937 | 0.882 | 25.3 pts |
| (iii-b) v2 + residue | 68.3 | 12.7 | 0.874 | n/a | 30.0 pts |
| site count_ge | 63.73 | 12.0 | 0.925 | n/a | 25.5 pts |
| (iv) v4 true-GE only, resident denominator | 53.5 | n/a | n/a | n/a | n/a |
| whole residue over resident total | 74.4 | 15.6 | 0.817 | n/a | 36.1 pts |
| lower-division only: count / v1 | 57.5 / 58.9 | 25.0 / 24.5 | n/a | n/a | n/a |

Per-university means (count / v1 / v2 / v3 / v4):
Bridgewater 43.0 / 43.0 / 51.6 / 71.7 / 58.8; Fitchburg 70.1 / 70.5 / 72.3 / 82.4 / 83.8; Framingham 11.7 / 12.0 / 12.3 / 45.5 / 40.2;
MCLA 17.6 / 18.4 / 21.7 / 52.4 / 44.3; Salem 46.4 / 49.3 / 34.6 / 70.1 / 44.4; UMass Amherst 44.2 / 45.3 / 45.9 / 71.1 / 49.3;
UMass Boston 22.2 / 24.6 / 29.6 / 58.9 / 53.9; UMass Dartmouth 37.0 / 38.4 / 35.9 / 58.5 / 31.7; UMass Lowell 61.7 / 62.8 / 67.7 / 69.7 / 69.1;
Westfield 26.7 / 29.7 / 23.7 / 55.4 / 42.0; Worcester 40.3 / 41.1 / 52.3 / 63.8 / 71.3.
Within-university Spearman(count, v1) is >= 0.985 at every campus. The A2B split survives every variant (count 56.9 vs 32.7; v1 57.6 vs 34.2; v3 76.3 vs 59.8).

Reading: units change nothing (v1); dropping unmatched columns changes the *population* and re-ranks Salem, Bridgewater and Worcester (v2); adding GE
changes the *question* and the answer depends 20+ points on what is called GE (53.5 for policy-bounded true GE, 63.6 for the site's residue, 74.4 for the
residue over the resident total). None of that spread is data about articulation.

## Are the CA and VA "unit" figures comparable to what MA could produce?

| lens | CA cs (1,035, verified) | MA ma-cs (165) | VA va-cs catalog (240) |
|---|---|---|---|
| course count, GE excluded (paper form) | 31.9 | 38.2 | 42.3 (estimated from credits) |
| named units, GE excluded | 35.3 (rollup minus GE) | 39.6 (v1, prototype) | 44.4 (`va_units_no_ge_pct`) |
| course count, GE included | 46.0 | 63.7 | n/a |
| units, GE included | 48.9 | 63.6 (v3) / 53.5 (v4) | 50.2 |
| unit source | stated `unit_advisement` per section, quarter/semester | older 4y-tab credits, 21% of columns at 4u fallback | guide credits at range maxima |
| denominator | full rollup (~167 units, whole degree incl. upper division) | heatmap columns (+ residue when GE on) | guide's stated total (~124, incl. 57.5 university-only units) |
| GE block | authored GE sections, 25% of units, 89.6% covered | resident residue, 39% of units, incl. 196u STEM + 111u free electives | 12.5u `assumed`, 10% of total |
| cap | none in the named-unit lens; the separate `pct_degree_units` (48.5) applies the 70/105-unit budget | none | pre-transfer ceiling ~60u -> 50.4% max |

The named-unit, GE-excluded row is the only unit lens where all three are "named requirements weighted by credit" with no assumed block and no cap; it
preserves each state's own population. CA's `pct_degree_units` (70-unit-cap budget) is a different quantity (carried credit, not discharged requirements)
and must not be compared with MA v1 or VA. The GE-included row compresses the states toward each other (CA 48.9, VA 50.2, MA 53.5-63.6) because it adds a
block that is 100% by construction in every state, and MA's block is the largest and least GE-like of the three.

## Verdicts and the recommended form

- **(i) named units, 4-credit fallback: feasible with stated caveats.** Defensible because 79.3% of columns carry real older-vintage credits, the fallback
  touches only elective-slot / alternative columns, the result is indistinguishable from the published count (rho 0.996, +1.3 pts), and Figures 3-5 already
  use the same older-vintage credits. It buys no precision; use it only if the cross-state figure is unit-based everywhere.
- **(ii) drop unmatched: feasible, not defensible as Figure 1.** It silently deletes 52 requirements the paper kept (disproportionately Dartmouth 13/31,
  Amherst 10/22, Salem 7/24) and re-ranks universities.
- **(iii) GE residue at 100%: not defensible as-is.** The block is mislabeled (32% STEM fillings, 18% free electives), it double-counts the unmatched
  elective slots (224 credits), the paper's own 61 pathway tabs remove only ~41% of it, and no artefact assesses GE per pair. Defensible only as
  variant (iv) with an explicit policy assumption (GenEd Foundation 34/28 credits), and then only as a sensitivity band, because 31% of the denominator
  is assumed rather than observed.
- **By extension:** Figure 2 under GE-on would add a non-STEM block that is 100% at all 11 universities by assumption, swamping the n=5 non-STEM
  observation the paper actually made. Figures 3 and 4 are already "credits + GE" in the final PDF (footnote 5) and rest on the 61 transfer tabs where GE
  transfer is observed row by row; the feasibility question does not arise for them.

**Recommended Figure 1 for the paper:** the published course-count, GE-excluded, all-levels measure as the headline (CA 31.9 / MA 38.2 / VA 42.3),
with a unit-weighted GE-excluded companion (CA 35.3 / MA 39.6 / VA 44.4) if a unit reading is wanted, and GE-inclusive values shown only as a labeled
assumption band. One-sentence disclosure for the MA unit form: *"Massachusetts credit weights are taken from the paper's December 2024 resident degree
plans (the only vintage that lists credits per requirement) and join 214 of the 270 heatmap requirement columns; the remaining 56, all elective-slot or
alternative-course columns, are weighted at 4 credits, and general education is excluded exactly as in the published figure."* If a GE-inclusive value is
shown at all, it needs a second sentence: *"General-education articulation was never assessed per college pair in any state; GE-inclusive values assume the
statewide GE block (MassTransfer GenEd Foundation, IGETC/Cal-GETC, Passport/UCGS) transfers in full and are upper bounds, not observations."*

## Further investigations

- Re-derive MA GE evidence from the 61 transfer tabs directly (gray-row credits by category) to publish an observed GE-transfer rate alongside Figure 3,
  rather than assuming one for Figure 1.
- Build MA templates whose elective-slot columns consume their concrete resident fillings, so the residue is true GE only; then the with-GE lens would be
  the policy-bounded 53.5%, not 63.7%. This is a modelling change and should be recorded, not silently applied.
- Bound GE per state with the policy block sizes (MA 34/28, CA IGETC ~37 semester units, VA Passport 16 / UCGS 31) and report GE-inclusive coverage as
  "named coverage + policy block", which is at least the same construction in all three states.
- Catalogue the ma-cs `degree_units_named_*` leak (fields populated but meaningless) in the defect catalogue.
