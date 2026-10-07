# Massachusetts: can the paper figures use GE and credit units?

Audit date: September 7, 2026. This investigation reads both requested sibling
repositories, including their git histories and actual XLSX cells. It makes no
database, importer, or application changes.

## Conclusion for the paper

**Use the measurement appropriate to each question. The archives support a
GE-inclusive, credit-based Figure 3, but they do not yet support an exact,
GE-inclusive, credit-weighted Figure 1 across all 165 Massachusetts pairs.**

Figure 1 asks whether a college *offers an equivalent* for a destination's
required-course observations. Figure 3 asks what fraction of a particular
associate degree's credits *applies to specific bachelor requirements*, including
applicable GE/breadth. These are different questions, populations, and
denominators. A single “include GE, use units” setting cannot make them the same.

For a paper that needs to move into analysis now:

1. Keep the final Massachusetts Figure 1 course-observation baseline, with its
   original scope disclosed, alongside a lower-division sensitivity analysis.
2. Use credits for Figure 3 and Figure 4. Applicable GE/breadth is already in
   Figure 3's intended numerator; unrestricted-elective-only credit is excluded.
3. Treat a new GE-inclusive Figure 1 as additional data collection and definition
   work, not a display toggle that improves precision automatically.
4. Reproduce the original Figure 2 distribution if needed, but reconcile its
   course population before making the stronger claim that its categories
   partition the exact Figure 1 observations.

“Course observations” is deliberate: the heatmap has both elective slots and
lecture/laboratory bundles. A column is not necessarily one actual class.

## Sources inspected

| Source | Actual available content | Evidentiary role |
|---|---|---|
| [`ma_paper/transferpaper/Code + Sheets/Mass Heatmap.xlsx`](../../ma_paper/transferpaper/Code%20%2B%20Sheets/Mass%20Heatmap.xlsx) | 11 university sheets, Tallys and OG Work | Older course-equivalency matrix |
| [`ma_paper/transferpaper/Code + Sheets/CurrComp Master.xlsx`](../../ma_paper/transferpaper/Code%20%2B%20Sheets/CurrComp%20Master.xlsx) | Typed pathway aggregate measures | Older pathway baselines |
| Old repository commit `59c1b77f970b273ea5ab2f4fced7111a3ecbbc98`, `Sheets/All CC AS.xlsx` | 15 associate curricula with numeric credit hours | Course-level AS requirements; 2024 vintage |
| Same commit, `Sheets/All Pathways/*.xlsx` | 11 resident curricula plus 61 selected transfer pathways | Course-level resident and transfer requirements, color-coded applicability |
| Same commit, `Sheets/Community College Heatmap.xlsx` | 15 college sheets with university requirement headers and Boolean/color equivalents | Transposed older equivalency information; does not add a GE-credit matrix |
| [`final_ma_paper/CIC-CC-Paper/Four Year Heatmap.xlsx`](../../final_ma_paper/CIC-CC-Paper/Four%20Year%20Heatmap.xlsx) | 11 university sheets, Tallys and OG Work | Exact final Figure 1 booleans; final Figure 2 category tallies |
| [`final_ma_paper/CIC-CC-Paper/Pathways Master.xlsx`](../../final_ma_paper/CIC-CC-Paper/Pathways%20Master.xlsx) | Curricular Complexity, Cost, Credit Hours, % Credit Hours | Exact final aggregate credits and pathway outcomes |
| [`final_ma_paper/CIC-CC-Paper/heatmap.ipynb`](../../final_ma_paper/CIC-CC-Paper/heatmap.ipynb) | Reads university sheets' `Upper` ratios; plots pair heatmap | Confirms Figure 1 uses all-division column ratios, not course-credit weights |
| [`final_ma_paper/CIC-CC-Paper/course_distribution.ipynb`](../../final_ma_paper/CIC-CC-Paper/course_distribution.ipynb) | Exact hard-coded plotted point arrays and stored means | Resolves previously uncertain final Figure 2 point positions |

The final repository's checked-out commit is
`96102ba` (“final submission”, August 25, 2026). Its complete locally available
history lists only heatmap/master workbook variants, four notebooks and images:
**no final AS workbook or per-university pathway workbooks exist in that history.**
The old detailed files are recovered directly with `git show`, rather than
assuming the vendored copies are authoritative. All 11 pathway workbooks match
the existing vendored copies byte for byte. The final heatmap also matches its
vendored copy byte for byte; hashes and the full history-path inventory are in
the output JSON.

The old README explains the pathway color semantics: gray replaces a bachelor
requirement, blue is unrestricted-elective-only credit, red indicates refused
credit but is inconsistently used. Colors identify applicability, not an
exhaustive GE policy or an explicit source-to-target equivalency graph.

## What is available numerically?

| Item | Available | Limitation |
|---|---:|---|
| Final Figure 1 college–university pairs | 165/165 | No numeric course credit field or added GE-equivalency matrix |
| Final required-course columns | 270 | 4,050 Boolean observations across 15 colleges; 1,582 true |
| Old resident rows with numeric credits | 403/403 | Representative curricula from an older revision |
| Old AS rows with numeric credits | 274/274 | After excluding the known Bristol duplicate |
| Old selected pathway rows with numeric credits | 2,520/2,520 | Before the separate known pathway duplicate cleanup |
| College–university pairs with old pathway detail | 61/165 (37.0%) | 104 pairs lack these detailed overlays |
| Final Figure 3 explicit credit fractions | 61/61 | Aggregate literals, without final row-level traceability |
| Final resident credit totals | 120 at all 11 universities | Old resident curricula total 120–123 instead |

These results distinguish **having many credit values** from **having the right
credit weights and coverage evidence for every Figure 1 observation**. The
missing evidence is largely a crosswalk and coverage problem, not a blank
credit-hours column.

### Figure 1 course-credit crosswalk

The current engine matches each heatmap column to one unused archived resident
row by exact code, then exact normalized name. Repeating that method directly
against the old git-history spreadsheets yields:

| University | Figure 1 columns | Matched to old resident row | Four-credit defaults | Old resident credits | Current modeled template credits | Detailed pairs |
|---|---:|---:|---:|---:|---:|---:|
| Bridgewater | 22 | 15 | 7 | 123 | 151 | 7 |
| Fitchburg | 23 | 22 | 1 | 120 | 124 | 6 |
| Framingham | 20 | 19 | 1 | 122 | 126 | 8 |
| MCLA | 25 | 22 | 3 | 120 | 132 | 2 |
| Salem | 24 | 17 | 7 | 121 | 149 | 7 |
| UMass Amherst | 22 | 12 | 10 | 121 | 161 | 3 |
| UMass Boston | 21 | 18 | 3 | 120 | 132 | 8 |
| UMass Dartmouth | 31 | 18 | 13 | 120 | 172 | 3 |
| UMass Lowell | 31 | 29 | 2 | 121 | 129 | 7 |
| Westfield | 26 | 22 | 4 | 121 | 137 | 4 |
| Worcester | 25 | 20 | 5 | 120 | 140 | 6 |
| **Total** | **270** | **214** | **56** | | | **61** |

Thus 79.3% of columns have a mechanical archived-row match; 20.7% currently use
an assumption. **308 of the 1,582 true articulation observations (19.5%) occur
in columns without a matched archived credit value.** A match is only an
identity join, not certification that a final course/choice/bundle has the same
credits as its older representative.

The modeled template totals exceed the resident totals because each unmatched
heatmap column is added at four credits while its likely representative remains
in the resident residue. This is already an explicitly estimated application
mode. It is not an exact credit ledger suitable for promoting to the paper's
precise GE-inclusive Figure 1.

Several crosswalk repairs look feasible, but require deliberate review:

- Framingham's heatmap says Data Structures `CSCI 217`; the old resident plan
  says `CSCI 271`, four credits.
- UMass Boston's heatmap says Computer Architecture `CS 341`; the resident plan
  says `CS 341L`, three credits.
- Amherst's heatmap says Multivariate Calculus `MATH 233` **or** Statistics I
  `STATISTIC 515`; its representative resident calculus is `MATH 223`, four
  credits. The alternative has no corresponding credit record there.
- Worcester's heatmap allows `UR 230` **or** `PH 134`; its resident record gives
  the second alternative, Computing Ethics, three credits.
- UMass Boston has two “Physics ... and Lab” columns. Each mechanically matches
  only the four-credit lecture, while the resident sheet also has a separate
  two-credit laboratory. Treating these bundled observations as four credits
  would underweight them; their recorded lecture-plus-lab sum is six.
- Repeated unnamed upper-level electives frequently have identifiable example
  courses in the resident plan, but those examples need not have the same credit
  value as the actual articulating course. Amherst includes both three- and
  four-credit examples in these elective positions.

Even with these repairs, the all-pairs heatmap only tells us *that an equivalent
exists*. It does not identify the sending course or its credit value in every
case. A receiving-requirement credit metric might need only reliable target
weights; a metric of actual incoming credits also needs sending-course evidence
and capacity rules. These two “units” definitions must be distinguished.

### The “GE” residue is not an audited GE curriculum

The generic imported template labels any resident row not consumed by a
heatmap-column match as GE/elective residue. That set includes genuine breadth,
but also courses such as Framingham Data Structures, UMass Boston physics labs,
and Dartmouth upper-level computing electives. It therefore cannot establish
GE totals or GE portability without an explicit requirement classification.

Moreover, “GE-excluded” describes the published scope, not a perfectly clean
uniform taxonomy in the source heatmap: **Lowell's Figure 1 contains four
`General Elective (any course)` columns, all marked true at every college**;
Dartmouth contains `Any Elective`. Named writing and non-STEM requirements also
appear. Keep the original baseline clearly identified, and state exactly which
slots a new common cross-state population includes.

Adding a universal assumed GE block would produce a *policy scenario*. It would
require documented eligibility, destination exceptions, double-counting and
credit-cap rules; it would not recover the missing 104 pair-level overlays.

## Credit-based analyses that are already possible

Every nonblank final `% Credit Hours` cell is an explicit fraction of integer
credit totals, for example Bristol→Bridgewater at `B4 = 62/69`. No inference
from a rounded printed percentage is necessary. Across all 61 pathways:

- mean applicable AS credits: **43.2951**;
- mean applicable proportion, using exact fractions: **67.7589%**;
- individual applicable totals range **17–68** credits; AS totals range **60–69**;
- final Figure 3's rounded displayed cells average **67.7377%**, explaining the
  small difference from the exact-fraction mean.

A new descriptive companion could show **applicable AS credits as a fraction
of the nominal 120-credit bachelor degree**. Its exact final-workbook mean
would be **36.0792%** over these 61 pathways. This is arithmetically supported by
the aggregate final source, but it measures contribution from the selected AS,
not college-wide course availability, and not necessarily the sum of target
course credits waived. It must not be relabeled as the original Figure 1.

For interpreting Figure 1, the existing final Boolean matrix also supports a
clean lower-division alternative with no new credit assumptions. The equal-pair
mean is **57.4570% for lower division**, compared with **38.2671% for the
all-division columns**. This is a useful sensitivity analysis because the
all-division denominator includes upper-level requirements a college is often
not expected to supply. It does not establish comparative state performance
until the other states use a comparable lower-division definition.

## Figure 2: stronger recovery, plus a population qualification

The final plotting notebook's first code cell has the complete arrays that
generated the dots. All **38 nonmissing points** match the application's final
PDF transcription, including the previously obscured Computing 22 and Science
93 points. The recovered plotted values and means are:

| Type | n | Sorted plotted percentages | Mean |
|---|---:|---|---:|
| Computing | 11 | 5, 9, 11, 11, 18, 20, 22, 25, 29, 30, 58 | 21.6364% |
| Math | 11 | 13, 40, 47, 52, 52, 53, 63, 65, 83, 97, 98 | 60.2727% |
| Science | 11 | 53, 78, 93, 97, 100, 100, 100, 100, 100, 100, 100 | 92.8182% |
| Non-STEM | 5 | 47, 67, 67, 100, 100 | 76.2000% |

**The plotted values no longer need a raster-inference disclaimer.** They are
exactly known plotting inputs that were themselves rounded to percentage points;
they are not exact unrounded per-course percentages.

Campus names remain unsafe without reconciliation: the notebook orders Lowell
before Dartmouth while the arrays follow the opposite Tallys order. Science
ratio formulas in the workbook also reference preceding campus rows from H44
onward; for example Boston `H46 = D45/D44` uses Amherst's counts. This shift
preserves the science multiset because displaced endpoints are 100%, but breaks
campus attribution.

The notebook computing array is consistent with the *whole-degree* Tallys block
(`F34 = 63/210 = 30%` at Bridgewater). Older documentation comparing that 30%
with the **lower-division** `43/60 = 71.7%` is comparing different populations;
that comparison does not prove a notebook error.

However, the whole-degree category counts do not consistently partition the
final Figure 1 Boolean matrix:

| University | Figure 2 tally potential / actual | Figure 1 observations / true |
|---|---:|---:|
| Bridgewater | 315 / 142 | 330 / 142 |
| Fitchburg | 360 / 256 | 345 / 242 |
| Framingham | 315 / 35 | 300 / 35 |
| UMass Amherst | 330 / 148 | 330 / 146 |
| UMass Dartmouth | 465 / 169 | 465 / 172 |
| UMass Lowell | 405 / 227 | 465 / 287 |
| Westfield | 405 / 119 | 390 / 104 |

Only MCLA, Salem, Boston and Worcester have matching totals. Lowell's difference
is exactly its four universally true general-elective slots (4 × 15 = 60), which
Figure 2 omits. Some other discrepancies may reflect counting or revision drift;
they require course-level reconciliation before interpretation as identical
universes. This does not invalidate reproducing the final plotted distribution,
but it limits a claim that Figure 2 directly decomposes the exact Figure 1 data.

## Work needed for a precise new GE-plus-credits Figure 1

1. Define whether the numerator is target requirements satisfied, incoming
   credits accepted, or degree-applicable credits from a selected AS. Decide how
   free electives and named writing/breadth requirements enter each definition.
2. Create one reviewed requirement-slot-to-credit crosswalk, including every
   alternative, lecture/lab bundle, and repeated elective. Reconcile its total
   to the degree total instead of appending unresolved duplicate representations.
3. Recover the **final** 11 resident and 61 selected transfer curricula from the
   paper authors if available, along with their GE/requirement assignments.
4. For a full 165-pair availability visual, collect GE applicability evidence and
   any necessary source-course credit/equivalency details for the 104 pairs
   lacking pathway detail. A conditional statewide GE guarantee can be modeled
   separately if that is the chosen research question.
5. Freeze common cross-state rules and run matched-population and GE sensitivity
   comparisons before making state rankings or attributing them to policy.

Until then, the existing original MA figures offer useful, reproducible
questions. The strongest credit-based contribution is the contrast between
applicable AS credits and additional degree credits: courses can fail to meet
named major/GE requirements yet still fit into unrestricted elective space.
That distinction is more informative than forcing all outcomes into one ratio.

## Reproducible outputs

Run:

```sh
pmt-env/bin/python analysis/results/paper_planning/ma_feasibility_audit.py
```

The audit reads only source files and git objects and writes these planning
artifacts:

- [`ma_feasibility_summary.json`](../analysis/results/paper_planning/ma_feasibility_summary.json): inventories, hashes, pair identities, exact final credit fractions and aggregates.
- [`ma_feasibility_slots.csv`](../analysis/results/paper_planning/ma_feasibility_slots.csv): all 270 columns, exact credit joins and affected true observations.
- [`ma_feasibility_resident_residue.csv`](../analysis/results/paper_planning/ma_feasibility_resident_residue.csv): every row currently treated as the GE/elective residue.
- [`ma_feasibility_universities.csv`](../analysis/results/paper_planning/ma_feasibility_universities.csv): university-level coverage inventory.
- [`ma_feasibility_final_fig3_fractions.csv`](../analysis/results/paper_planning/ma_feasibility_final_fig3_fractions.csv): all 61 final literal credit fractions with cell coordinates.
- [`ma_feasibility_figure2.json`](../analysis/results/paper_planning/ma_feasibility_figure2.json): exact notebook arrays, comparison to all existing final dots, and category-to-Figure-1 reconciliation.

Validation: the script asserts that every final heatmap course header and all
4,050 Boolean observations equal the imported raw data; it also asserts exact
agreement of the 38 recovered Figure 2 points with the displayed final-PDF
artifact. Credit availability and slot joins are independently counted from the
old repository's XLSX data, not inferred from previously written audit totals.
