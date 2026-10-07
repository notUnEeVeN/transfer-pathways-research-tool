# Paper planning: credit use, replacement work, price, and complexity

Research planning receipt, 7 September 2026. This evaluates Massachusetts-method
Figures 3–6 using the recovered **final** workbooks and the corrected California
audit outputs. It is not a publication clearance for every modeled cell.
The current [data audit](analysis-audit-2026-09-07.md) supersedes older notes that
treated final workbook values as unavailable or called archive/final revisions
paper errors.

The strongest contribution from this family is **distinguishing several kinds
of transfer burden**, then investigating which requirement and policy choices
cause them. Four separate heatmaps would spend substantial space on correlated
or mathematically dependent outcomes. Figure 3 plus a credit-allocation
decomposition is the best main-paper candidate. Figure 4 can add a compact
paired distribution. Dollar translations and cross-state complexity magnitudes
belong in an appendix until their evidence is better aligned.

## Data and populations used here

- Massachusetts: `server/data/ma/raw/baselines.json`, regenerated from
  `final/Pathways Master.xlsx`; literal published cells in `pdf-figures.json`.
  Figure 3 studies **61 selected nearby pathways**, involving 15 colleges and
  11 universities. Figures 4–6 display **49** of those pathways, excluding the
  12 associated with Massasoit and Roxbury. Final hours and cost are available
  for all 61 in the workbook; final complexity is available for only 49.
- California: the corrected read-only audit snapshots from 7 September,
  projected into the accompanying CSV. **All 405 CS and 513 Biology rows are
  `local_as`. They are not the gallery's A.S.-T default.** This aligns award type
  more closely with MA, but does not align institution selectivity, geographic
  selection, program identity, source year, or modeling completeness.
- The primary CA sensitivity uses source-verified local A.S. records:
  **252 CS rows, 243 finite** (27 computable colleges × nine UCs), and
  **288 Biology rows, 279 finite** (31 × nine). Cabrillo CS and Gavilan Biology
  contribute nine excluded cells each. Blank cells are omitted, never zero.
- Source verification is not model verification. Of verified CS's 243 finite
  results, **196 are estimated and 47 carry `ok`**. All 279 finite verified
  Biology results are estimated, and all 288 selected Biology rows carry
  `source_analysis_ready=false`. Biology is therefore a useful within-CA
  hypothesis generator, not a validated MA-CS comparator.
- These are curriculum/equivalency models and selected published pathways,
  not enrollment-weighted observations of actual transfer students.

The accompanying [script](../analysis/results/paper_planning/figure3_6_analysis.py)
checks every final workbook Figure 3/4/5/6 value against its published rounded
counterpart. It uses **unrounded workbook Figure 3 ratios**, not printed whole
percentages, and **unrounded CA pathway hours** for means and price checks.
The stored CA utilization percentages already have one-decimal precision.

## Provisional quantitative reading

Each mean gives every finite college–university cell equal weight.

| Population | Finite / selected | Strict requirement credit use | Use including elective capacity | Hours above 120 | Priced excess |
| --- | ---: | ---: | ---: | ---: | ---: |
| MA CS, final workbook, all studied pathways | 61 / 61 | 67.7589% | unavailable as a final-source decomposition | 15.0164 | $8,329.71 |
| MA CS, same cohort shown in Figures 4–6 | 49 / 49 | 70.5402% | unavailable | 12.9184 | $7,129.41 |
| CA CS, verified local A.S., audit snapshot | 243 / 252 | 59.8885% | 67.4049% | 19.5569 | $13,535.24 |
| CA Biology, verified local A.S., estimated | 279 / 288 | 62.8219% | 73.7075% | 15.7754 | $10,869.73 |

“Strict” means credits replacing named or GE/breadth bachelor requirements,
excluding unrestricted-elective-only capacity, over the associate degree's own
credits. CA Figure 4 uses credit application including its modeled elective
capacity. Consequently **Figure 4 is not the simple complement of strict
Figure 3**, even when the resident degree is exactly 120 semester hours.

The MA Figure 3 printed-cell mean is **67.7377%**, versus the unrounded final
workbook mean **67.7589%**. This ordinary display-rounding difference is not an
error. The corresponding printed-cell mean on the 49-pair cohort is 70.4898%,
versus its workbook-ratio mean 70.5402%.

The provisional MA–CA CS strict-use difference is **7.87 percentage points**
using MA's 61 pathways and verified CA local A.S. cells. It is a descriptive
difference between these corpora, not an estimated state-policy effect.
Including unverified CA sources gives 378 finite of 405 CS cells, a strict-use
mean of 57.2656% and 21.0798 excess hours. The source-cohort sensitivity alone
changes the CS utilization mean by 2.62 points. Within MA, weighting
universities equally gives 68.2402% instead of the pair-weighted 67.7589%.
Record the chosen weighting in any cross-state figure.

## Candidate 1: where credit goes, rather than a single “transfer rate”

**Main-paper priority: high, once the selected CA source issues are resolved.**

The same verified CA CS pathways move from **59.89% strict use to 67.40% use
with free-elective capacity**, a 7.52-point change. Biology moves from 62.82%
to 73.71%, a **10.89-point** change. This is large enough to alter a casual
reading of the MA–CA comparison: adding elective space almost eliminates the
observed MA–CA CS gap, but answers a different question.

The CA model applies elective capacity in **159/243 CS** and **186/279 Biology**
cells. Assumed GE credit appears in 72/243 and 180/279 respectively. These are
counts of modeling assumptions, not observed student success rates. The
free-elective difference is known from the model; it is not evidence that
actual students select those courses or receive that credit.

**Suggested visual:** paired dots or stacked credit-allocation bars for named
requirements, GE/breadth, free-elective capacity, and unused credit. Show strict
and broad use on the same selected cohort, with direct versus assumed capacity
distinguished. The draft [SVG](../analysis/results/paper_planning/figure3_6_candidates.svg)
and [PNG](../analysis/results/paper_planning/figure3_6_candidates.png) illustrate
the scope sensitivity; the two CA majors should not be presented as two
independent state replications. MA's broad-use point remains absent because
the recovered final summary does not provide its detailed credit allocation.

**Hypothesis:** an important share of apparent transferability comes from
absorbing courses into general or elective space, while major-requirement
alignment remains weaker. Test this by reconstructing an exact feasible
associate plan for selected colleges and auditing where each actual course's
credit lands. Do not equate “credits accepted” with “named requirements met.”

**Useful cases:** verified CA CS campus strict means range from **44.34% at
Berkeley to 74.02% at Santa Barbara** on the same 27-college cohort. This is a
strong lead for degree-demand and course-mapping investigation, not a ranking
of institutional effectiveness: Berkeley uses the canonical EECS program,
and programs ask for different work. For Biology, nine modeled cells have
zero excess hours while strict use is below 80%; examples include Diablo
Valley→Santa Barbara at 73.3% and Cañada→Santa Cruz at 75.6%. These make useful
credit-allocation case studies after their GE/elective assumptions are audited.

## Candidate 2: distinguish lost credit from excess degree length

**Main-paper priority: medium, best paired with Candidate 1.**

Use the common identity:

`excess semester hours = max(0, resident degree hours + unused AS hours − 120)`.

All final MA workbook resident totals are recorded as 120. CA converts both
calendars to semester equivalents before evaluating the identity. Source
credit may legitimately be fractional after conversion; this does not mean
fractional classes are taken.

The displayed MA 49-pathway mean is 12.92 hours; the omitted 12 average
**23.58 hours** and **56.40% strict credit use**. Including them raises mean
excess to 15.02 hours. Compared with verified CA CS's 19.56 hours, the apparent
gap is **6.64 hours using MA's displayed 49** or **4.54 using all 61**. Show both
MA populations as a sensitivity; never combine a 61-cell rate with a 49-cell
hours average without saying so. Their medians also differ: MA 49 median seven
hours; MA 61 median 11; verified CA CS median 19.

**Suggested visual:** excess-hour distributions with finite sample counts and
a small matched-cohort inset. If a future resident curriculum exceeds 120,
stack its additional resident requirements separately from unused associate
credit. This separates curriculum length from loss caused by transfer.

**VA boundary:** Virginia's current Figure 4 shows unused **guide-plan** credit,
not this excess-hours identity. The current catalog model reports roughly
0.96 unused credits; mechanically adding the guide's average 3.60 credits
above 120 gives 4.56, but the guide sum is not a verified resident curriculum.
Neither reading is a direct substitute for the CA/MA calculation. The
[VA planning investigation](paper-planning-virginia.md) should control any
policy interpretation of that difference. It also finds source-year credit
conflicts—CSC 221 is three credits in most selected guides and four in current
local catalogs—and uneven schedule coverage across colleges. Resolve those
before interpreting Virginia's small modeled loss as exact statewide advantage.

**Cases requiring verification before quotation:** Fullerton→Riverside is the
largest verified CA CS estimate at 49.33 excess semester hours. Its own source
warning says a “choose one course pair” is represented as a unit pool, and
Riverside's CS template has an unresolved modeled-budget inconsistency. This
is a source-audit target, not a publishable worst-student-outcome example.
El Camino and Long Beach City→Irvine Biology each show 43.33 hours, with zero
named-course credit in these modeled plans; their analysis-readiness and
course-pairing issues need review before a curricular claim.

## Candidate 3: price the burden, without making price a second discovery

**Main-paper priority: low; appendix or compact policy context.**

Figure 5 is Figure 4 multiplied by a university price; it adds no independent
curriculum outcome. MA and CA both use the paper's annual-charge/24-semester-
credit basis, but MA is tuition-only while CA is 2025–26 tuition plus student
services and campus fees. Price years and institutional mixes also differ.
The approximate $13,535 versus $7,129 means are therefore not evidence that
California transfer failure costs nearly twice as much.

Use within-state prices as labeled exposure translations, and show a common
illustrative per-credit multiplier when comparing the burden distributions.
The reproducible JSON includes a $600-per-credit sensitivity explicitly marked
as hypothetical. The 30-credit/year load sensitivity changes every modeled
price by 20%; it should not be narrated as a change in coursework.

Avoid claims about actual tuition paid, extra enrolled terms, debt, or
time-to-degree without student enrollment, aid, and pricing-rule information.
Flat full-time pricing and student aid can make marginal payments depart
substantially from this per-credit translation.

## Candidate 4: investigate complexity that credit totals miss

**Main-paper priority: an illustrative exact case, if reconstructed; otherwise
appendix. Cross-state magnitude comparisons are deferred.**

The 49 final MA deltas average **+14.5918**, median **+20**, range **−52 to +72**;
**14/49 are negative**. A positive hours/complexity association exists in this
selected population (descriptive Pearson `r=0.7155`), but the measures diverge
in consequential cases:

| Final MA pathway | Strict use | Excess hours | Complexity delta |
| --- | ---: | ---: | ---: |
| Holyoke→UMass Amherst | 48.4375% | 0 | +25 |
| Bristol→Bridgewater | 89.8551% | 0 | +5 |
| Greenfield→UMass Amherst | 96.7742% | 0 | +6 |
| North Shore→Salem | 82.8125% | 6 | −29 |
| MassBay→Salem | 70.5882% | 5 | −17 |
| MassBay→Worcester | 75.0000% | 8 | −1 |

Three of the 14 zero-excess pathways have positive complexity deltas; three
positive-excess pathways have negative deltas. **Zero excess credit is not
equivalent to no curricular disruption.** Holyoke→Amherst is the strongest
case to pursue, but the final summary alone cannot establish whether elective
allocation, course substitution, source revision, or prerequisite structure
explains its combination. It is not sufficient evidence of a paper error.

**Suggested visual:** joint hours/complexity scatter colored by strict credit
use, followed by two small prerequisite diagrams for an audited discordant
pair. The draft SVG includes the first part. Correlations are descriptive:
college and university observations repeat, and this is not a random sample.

Final course-level graph revisions remain unrecovered. The older archived
graphs reproduce 59/60 stored scores, but their 49-cell aggregate is +15.8571,
versus +14.5918 in the final workbook; that is version drift, not a license to
substitute archived graphs for final ones. No corrected CA complexity snapshot
was available for this planning pass. A shared equation alone cannot establish
common graph completeness, course selection, prerequisite treatment, or edge
identity across states.

## Next investigations in order

1. **Resolve a small, explicit CA publication cohort.** Fix selected named
   course-pair choices and the four CS template inconsistencies; require source
   and model readiness, and report excluded colleges. Recompute local A.S.
   alongside A.S.-T on the same sending colleges where both exist. A within-
   college, within-campus comparison can test transfer-designed curricula
   without conflating them with different college populations.
2. **Produce an audited credit-allocation receipt.** For a high, middle, and
   low strict-use campus, show actual selected courses and units entering
   named, GE, elective, and unused buckets. Separate documented acceptance
   from optimal-student assumptions. A policy-cap sensitivity is useful only
   when its scenario is feasible and clearly hypothetical.
3. **Align the paper populations.** Use MA's full 61 for available credit/hour
   summaries and the matched 49 for joint complexity plots. Add university-
   equal and source-cohort sensitivities. For a state-policy claim, restrict
   institution/program types and match local degree pathways rather than
   assuming all nine UCs are exchangeable with MA's mixed university sample.
4. **Recover the final discordant pathway details.** Start with Holyoke→UMass
   Amherst and North Shore→Salem. If unavailable, label the final matrix facts
   as case-selection leads and reconstruct comparable current pathways as a
   new analysis rather than pretending the historical graph is known.
5. **Test actionable articulation changes.** Once exact course receipts exist,
   simulate one documented equivalency correction or requirement substitution
   at a time; measure named credit gained, excess credits removed, and graph
   delay/blocking changes separately. This could yield a more useful new
   visual than a second set of aggregate heatmaps.

## Reproduction

```bash
python3 analysis/results/paper_planning/figure3_6_analysis.py
analysis/.venv/bin/python analysis/results/paper_planning/figure3_6_analysis.py --plot
```

The first command needs only Python's standard library; the optional plot uses
the repository's matplotlib environment. It reads the committed CA projection
and current final MA artifacts, writes the summary JSON and MA cell CSV, and
checks the final-source values against all available printed cells. The capture
receipt records SHA-256 hashes of the original audit JSONs. No database access,
web requests, production changes, or remote mutations are involved.

Supporting files: [summary and campus tables](../analysis/results/paper_planning/figure3_6_summary.json),
[MA matched cells](../analysis/results/paper_planning/figure3_6_ma_final_cells.csv),
[CA audit projection](../analysis/results/paper_planning/figure3_6_ca_audit_cells.csv),
[capture provenance](../analysis/results/paper_planning/figure3_6_ca_capture.json).
