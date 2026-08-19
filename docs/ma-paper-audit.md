# Massachusetts paper — final-PDF audit and archive reconciliation

This is the technical record behind the Massachusetts tab. It treats the final
2026 PDF of “Lost in Transfer” as the latest authoritative revision, audits that
PDF internally, and then compares it with the older repository tally and our
reconstruction from archived course-level pathway sheets.

Presentation summary: [`ma-meeting-notes.md`](ma-meeting-notes.md).
Source provenance: `server/data/ma/PROVENANCE.md`.

## Evidence rule

The project contains three distinct evidence layers:

| Layer | Role | What a mismatch proves |
|---|---|---|
| Final PDF (2026, as printed) | Authoritative presentation baseline | An internal arithmetic or scope contradiction can be a final-paper issue |
| Archived GitHub workbooks/tallies (2024) | Earlier deposited replication artifact | Difference from the PDF establishes revision drift |
| Our reconstruction from archived pathway sheets | Independent reading of the archived detail | Difference from the PDF establishes an archive-to-final reproducibility gap |

The final paper says that conversations with institutions produced updates to
the data. Therefore an archived workbook/PDF disagreement is not, by itself, a
paper error. A finding is called a final-paper error here only when it follows
from the final PDF's own values, stated population, or a stable fact that does
not depend on an older input remaining unchanged.

This rule supersedes earlier versions of this audit that called 45 Figure 3
cells wrong, treated the final Figure 6 `−28` as a typo, called Bridgewater's
resident score stale, substituted +15.94 for the paper's +15, or called Figure
7 stale. Those conclusions are retracted below.

## Reproduction artifacts and cautions

The following commands reconstruct the archived repository and its course-level
records:

```text
pmt-env/bin/python server/scripts/ma/theirMath.py
node server/scripts/ma/methodsAudit.js
node server/scripts/ma/reproductionReport.js
node server/scripts/ma/pdfReconciliation.js
node server/scripts/ma/figureLedgers.js
node server/scripts/ma/complexityCheck.js
```

Their JSON outputs are useful diagnostics, but several existing verdict labels
were written under the now-retracted assumption that the archived workbooks and
final PDF were the same version. In particular, `tally-drift`, `above-ceiling`,
“paper error,” `figure_cell_misses`, and `headline_plus_15` must not be quoted as
final-paper findings without applying the evidence rule above.

The imported corpus contains 11 universities, 15 community colleges, 165
possible pairs, and 61 proximity-selected pathways. Figures 4–6 display only 49
of those pathways because Massasoit and Roxbury are omitted.

Two fidelity gates remain useful:

- the Figure 1 import must reproduce all stored formula outputs; and
- the final Figure 3 transcription must reproduce every printed university
  average and have the same 61-cell key set as the paper.

## Final-PDF arithmetic ledger

| Figure | Population | Recovered identity | Final-PDF result |
|---|---:|---:|---|
| 1 | 165 cells | archive exact mean `6304.3992307 / 165 = 38.2085%`; final differs in one printed cell | prose 38.2%; strong stale-headline candidate |
| 2, computing | 11 anonymous dots | corrected final-raster rounded mean `238 / 11 = 21.636%` | printed 22% |
| 2, math | 11 anonymous dots | corrected final-raster rounded mean `663 / 11 = 60.273%` | printed 60% |
| 2, science | 11 anonymous dots | corrected final-raster rounded mean `1021 / 11 = 92.818%` | printed 93% |
| 2, non-STEM | 5 anonymous dots | `381 / 5 = 76.2%` | printed 76% |
| 3 | 61 pathways | `4132 / 61 = 67.7377%` | 68% |
| 4 | 49 pathways | `633 / 49 = 12.9184` | 13 hours |
| 5 | 49 displayed cells | `$349342 / 49 = $7129.43` | $7,129 |
| 6 | 49 pathways | `715 / 49 = 14.5918` | +15 |

All Figure 3, 4, and 6 printed university averages reproduce from their visible
cells. Every Figure 5 displayed whole-dollar cell reproduces from its Figure 4
hours multiplied by the relevant campus rate; using the underlying rates gives
an exact aggregate of approximately $349,341.13, or $7,129.41 per pathway.
Figure 1 requires a separate final-PDF override and Figure 2 requires a
raster-transcription uncertainty note; neither may be represented as an exact
raw-data regeneration of the later PDF.

## Figure 1 — archive reproducible; one final cell changed

### Intended statistic

For each community-college × university pair, divide the number of named BSCS
degree/college course requirements with an equivalent by all named required
course slots. Include every division, exclude general education, expand course
series, and equal-weight the 165 pair percentages. The pooled course ratio
`1,579 / 4,050 = 38.988%` is not the paper's headline statistic.

### Archive rerun

All 165 workbook formulas reproduce exactly from their underlying booleans.
The archived unrounded pair percentages sum to `6304.3992307`; their mean is
38.2085%, which prints 38.2%. The archived highest/lowest university means and
the Berkshire→Bridgewater example also check.

### Final PDF divergence and candidate mechanism

The final PDF agrees with the archive after whole-number rounding in 164 of 165
cells. The exception is:

```text
Cape Cod → UMass Dartmouth
archive: 11 / 31 = 35.4839% → 35%
final PDF: 45%
```

The final also prints Dartmouth's bottom average as 37 rather than the archived
36.344%→36. The 45 exactly equals the separately archived Massasoit→Dartmouth
cell `14/31=45.1613%`, and substituting that value yields a Dartmouth mean of
36.989%→37. A manual copy/substitution is therefore a concrete plausible
mechanism.

If that were the final matrix's only hidden-ratio change, its statewide mean
would be about 38.267%→38.3 even though the prose remains 38.2%. Under the
paper renderer's half-even rounding, the 165 printed integers total 6,323 and
average 38.3212%. This is a **strong
manual-cell plus stale-headline candidate**, but not an unconditional proof:
the final hidden ratios were not deposited and other same-rounded revisions
could offset the change. The website therefore defaults to the final printed
45/37 while keeping the archived 35/36 reconstruction separate.

## Figure 2 — final raster coherent; archive contains real errors

### Corrected final-PDF transcription

The native 733×583 embedded raster supports nearest-whole-point readings, not
campus identities. Its corrected sorted point sets are:

```text
Computing [5, 9, 11, 11, 18, 20, 22, 25, 29, 30, 58]
Math      [13, 40, 47, 52, 52, 53, 63, 65, 83, 97, 98]
Science   [53, 78, 93, 97, 100, 100, 100, 100, 100, 100, 100]
Non-STEM  [47, 67, 67, 100, 100]
```

The Computing 22 and Science 93 points are obscured by their black mean
diamonds and inferred using the archived observation plus the published mean;
the Math point near 63 is partly occluded. The category means are 21.636%,
60.273%, 92.818%, and 76.2%, consistent with the paper's 22%, 60%, 93%, and
76%. The final calculation is therefore coherent at the precision available.
The material disclosure limitation is `n=11/11/11/5`.

The final Computing and Math multisets differ from the deposited whole-degree
arrays; Science agrees and final non-STEM agrees with neither archived reading.
The dots are anonymous, so final revisions cannot be assigned to universities.

### Confirmed repository errors

- The plotting notebook's `UNI_LIST` orders Lowell then Dartmouth, while its
  hard-coded arrays/Tallys order Dartmouth then Lowell. It swaps those two
  campus identities in all three STEM categories. The plotted distributions
  and means are unaffected, but any campus-level attribution is wrong.
- Tallys records Westfield non-STEM as `15/15=100%`; the raw Westfield matrix
  contains `5/15=33.3%`. This is a same-repository tally error.
- The stale tally/notebook non-STEM set averages 82.8%; a faithful
  course-code-first reading of the raw sheets averages 69.4%; the later final
  raster averages 76.2%. The final raw inputs were not deposited, so none of
  the archived alternatives can be promoted to a correction of the PDF.

A mechanical keyword classifier also invents or misclassifies observations
because of malformed headers and titles. Faithful reconstruction must use the
four-year course code first, preserve manual category conventions, show
category `n`, and never attach campus names to the final anonymous dots. The
website now defaults to the corrected final-raster transcription and exposes
the archive separately.

## Figure 3 — final PDF, archived tally, and archived reconstruction

### Final PDF

The final Figure 3 contains 61 values whose sum is 4,132. Its pathway-weighted
mean is 67.7377%, which rounds to the stated 68%. All 11 university averages
reproduce, and exactly six of the 15 community colleges have at least one 100%
partner. There is no internally provable final-PDF cell error.

### Final PDF versus archived typed tally

The archived `% Credit Hours` tab contains typed fractions with no cell
references. It is valuable evidence about the repository version, but it is
not the final PDF's hidden calculation sheet.

| Metric | Value |
|---|---:|
| Final-PDF mean | 67.7377% |
| Archived-tally mean | 65.1479% |
| Mean archive − final | −2.5898pp |
| MAE | 2.9148pp |
| RMSE | 8.4910pp |
| Correlation | 0.9397 |
| Within ±0.5pp final print precision | 50 of 61 |
| Clear version changes | 11 of 61 |
| Maximum change | 41.2pp |

The 11 clear changes, expressed as `final PDF − archived tally`, are:

| Pathway | Change |
|---|---:|
| Massasoit → UMass Dartmouth | +41.2pp |
| Springfield Technical → UMass Amherst | +39.4pp |
| Cape Cod → UMass Dartmouth | +21.9pp |
| Bristol → Bridgewater | +16.1pp |
| Bristol → UMass Dartmouth | +11.7pp |
| Cape Cod → Bridgewater | +11.6pp |
| North Shore → Bridgewater | +7.9pp |
| MassBay → Bridgewater | +5.7pp |
| Middlesex → Fitchburg | +5.0pp |
| Roxbury → Bridgewater | −3.2pp |
| Greenfield → UMass Amherst | +1.8pp |

Eight of these pairs also changed coherently in final Figure 4. Springfield
Technical → Amherst also changed coherently in Figure 6. Massasoit and Roxbury
are absent from Figures 4–6, so those cross-checks cannot exist for them. The
pattern supports a newer coordinated revision; it does not prove 11 errors.

### Final PDF versus reconstruction from archived pathway sheets

| Metric | Value |
|---|---:|
| Final-PDF mean | 67.7377% |
| Archived reconstruction mean | 68.5689% |
| Mean reconstruction − final | +0.8311pp |
| MAE | 11.6836pp |
| RMSE | 16.9813pp |
| Correlation | 0.7516 |
| Within ±0.5pp | 9 of 61 |
| Within ±2.5pp | 16 of 61 |
| Maximum absolute gap | 50.4pp |

The close aggregate means are cancellation, not cell-level reproduction. The
proper conclusion is:

> The final 2026 Figure 3 is not fully reproducible from the deposited 2024
> course-level artifacts.

The older artifacts can explain mechanisms in their own version—typed
fractions, incomplete stubs, different denominators, and pathway-sheet edits.
They cannot establish that the later PDF retained the same hidden inputs. The
previous “25 too low + 20 too high = 45 wrong” classification therefore remains
an archive-reconciliation diagnostic only and is retracted as a paper-error
count.

### Confirmed repository conflicts

The archived `% Credit Hours` values are manually typed numerator/denominator
strings rather than formulas linked to the degree/pathway sheets.

- All three STCC typed cells use denominator 63, while the archived STCC AS
  degree sheet totals 61.
- Bristol's typed denominator 69 is defensible. A naive total of 72 double
  counts an obvious trailing, no-ID duplicate `Human Expression` course.
- The README-described gray-cell numerator agrees in 52 of 61 paths. The nine
  conflicts are:

| Pathway | Typed numerator | Archived gray/detail reading | Mechanism or status |
|---|---:|---:|---|
| Framingham–Massasoit | 36 | 33 | selectively counts additional colored credit |
| Framingham–Middlesex | 20 | 17 | selectively counts additional colored credit |
| Fitchburg–MassBay | 68 | 69 | capped at archived AS total |
| Fitchburg–Quinsigamond | 60 | 59 plus available colored credit | capped at archived AS total |
| Worcester–Roxbury | 36 | 27 | selectively counts additional colored credit |
| Lowell–Roxbury | 33 | 66 | duplicated Roxbury rows affect the naive sum |
| Bridgewater–Cape Cod | 52 | 49 | selectively counts additional colored credit |
| Bridgewater–Massasoit | 65 | 61 plus colored credit | capped at archived AS total |
| Bridgewater–Roxbury | 27 | 54 | duplicated Roxbury rows affect the naive sum |

These are confirmed inconsistencies or undocumented transformations within the
public replication package. They explain why our direct detail-sheet reading
is not the same artifact as the archived typed tally; they do not by themselves
prove the later PDF is wrong.

### Conditional STCC–Worcester candidate

The final PDF prints Springfield Technical → Worcester as 60%. If the final AS
degree still contained 61 hours, no integer numerator rounds to 60%:

```text
36 / 61 = 59.016%  → 59%
37 / 61 = 60.656%  → 61%
```

The archived typed formula is `38/63 = 60.317%`, which does print 60%. This is
strong evidence of a denominator carryover **conditional on the final total
remaining 61**. Because the PDF does not publish its final numerator or
denominator and institutional updates occurred, classify it as a
high-confidence candidate requiring same-version confirmation, not a proven
error.

## Figure 4 — correct cells, inconsistent prose range

The final Figure 4 has 49 cells totaling 633 extra hours. Its mean is 12.9184,
correctly stated as 13, and all university averages reproduce. Relative to the
archived tally, ten final cells changed and all ten changed to zero; eight of
those pairs also changed in Figure 3. This is coherent revision evidence.

The final-paper error is in the sentence claiming university-average extra
hours range “from six to 35.”

- On the visible 49-path Figure 4 cohort, university means range 0–34.833;
  positive means range 1.2–34.833.
- On the all-61 cohort recoverable from Figure 7, university means range
  0–33.875; positive means range 6–33.875.

No single cohort yields both endpoints. “Six” comes from the all-61 population,
while “35” is the rounded 49-path Framingham mean.

### Archived typed totals versus archived detailed sheets

The repository README describes the master `Credit Hours` cells as sums of the
detailed pathway sheet's total-credit column, but eight of 61 cells disagree:

| Pathway | Detailed total | Typed master | Final Figure 4 |
|---|---:|---:|---:|
| Bridgewater×Massasoit | 120 | 125 | excluded |
| Bridgewater×Roxbury | 182 | 155 | excluded |
| Fitchburg×Quinsigamond | 121 | 120 | 0 |
| UMass Boston×Bunker Hill | 119 | 126 | +6 |
| UMass Boston×MassBay | 151 | 127 | +7 |
| UMass Dartmouth×Cape Cod | 138 | 136 | 0 |
| UMass Dartmouth×Massasoit | 148 | 151 | excluded |
| UMass Lowell×Roxbury | 185 | 152 | excluded |

Resident sheets also disagree with the master at Bridgewater (123 versus 120)
and Westfield (121 versus 120). The master cells are typed constants, not
formulas linked to detail sheets. UMass Boston×MassBay is particularly clear:
the selected `(REAL) MassBay` sheet totals 151, the older plain sheet totals
148, and the master says 127, matching neither. Manual or stale copying is the
most plausible repository-level mechanism.

Applying the final paper's formula directly to the deposited detail gives
three conditional final candidates:

| Pathway | Deposited-detail result | Final PDF |
|---|---:|---:|
| Fitchburg×Quinsigamond | +1 hour | 0 |
| UMass Boston×Bunker Hill | 0 hours | +6 |
| UMass Boston×MassBay | +31 hours | +7 |

The two Boston cells are strong candidates because the later PDF retains the
older typed-master values instead of the deposited detail. They remain
conditional because the authors did not deposit the final-version pathway
sheets.

## Figure 5 — Figure 4 priced correctly

Figure 5 contains the same 49 pathway cells, 35 of them nonzero. Every displayed
whole-dollar value matches:

```text
Figure 4 extra hours × paper campus tuition-per-credit rate
```

The displayed-cell sum is $349,342 and mean $7,129.43. Using the underlying
rates before whole-dollar display rounding gives approximately $349,341.13 and
$7,129.41. Both support the printed $7,129 headline. The paper explicitly
excludes fees; the website must not label this measure “tuition and fees.”

Figure 5 supplies no independent error count. It is a deterministic pricing of
Figure 4. The conditional Figure 4 candidates would imply approximately:

| Pathway | Deposited-detail price | Final PDF |
|---|---:|---:|
| Fitchburg×Quinsigamond | $473 | $0 |
| UMass Boston×Bunker Hill | $0 | $4,174 |
| UMass Boston×MassBay | $21,563 | $4,869 |

The repository hard-codes annual tuition but does not preserve the historical
price year or source URLs. We verified the paper's arithmetic and price
transformation, not the independent historical provenance of those rates.

## Figure 6 — final matrix correct; archive and scorer must be separated

### Final PDF

The final Figure 6 contains 49 deltas summing to 715. Its mean is 14.5918,
correctly printed as +15. Its university means are:

```text
Bridgewater −21       Fitchburg −9.6       Framingham +46
MCLA +54              Salem +10.6          UMass Amherst +1.0
UMass Boston +22.8    UMass Dartmouth −25.5
UMass Lowell +29.7    Westfield +27        Worcester +11.2
```

All reproduce Figure 7. The final matrix is internally coherent.

### Final PDF versus archived complexity tab

The archived tab-derived deltas match 48 of 49 final cells. The exception is
Springfield Technical → UMass Amherst:

```text
archived transfer score 219 − archived resident score 185 = +34
final PDF delta = −28
```

The final `−28` is not a provable typo. It is required by the final Amherst
average `(6 + 25 − 28) / 3 = 1.0`, is repeated in Figure 7, and accompanies
same-pair revisions in Figure 3 (55.6% → 95%) and Figure 4 (11 → 0 hours). The
paper reports that institutional conversations produced data updates. Label
this `final-PDF revision versus archived tab`, not `figure_cell_miss`.

### Independent scorer versus archived graphs

Our old 58/60 result contained a local scorer bug. The Bridgewater resident
graph has two distinct rows with raw ID 13:

- COMP 340 with prerequisites 5 and 7; and
- an isolated physics-lab row.

The scorer used `rows.find()` by raw ID, so both vertices inherited the COMP
340 edges and produced 164. Preserving distinct vertices produces 160, exactly
the archived score. Bridgewater is not a paper error, and the five false
column-wide delta disagreements disappear.

After that correction, the scorer reproduces 59 of 60 archived component
scores. The remaining mismatch is Bristol → UMass Dartmouth:

```text
independent score 174
archived score    170
archived resident 202
independent delta −28 versus archived/final delta −32
```

Several possible single-edge omissions in the saved graph produce 170, so the
exact CSV uploaded to the external scoring tool cannot be recovered. This is an
unresolved archived input/upload-version gap, not a final-PDF error.

### Why +15.94 is not a correction

The final PDF's mean is exactly `715/49 = 14.5918`. The earlier +15.94 combines
independently rescored archived transfer graphs with archived resident scores.
Its two differences from the final matrix sum to 66 points:

```text
Springfield Technical → Amherst: +62 (archive/final revision)
Bristol → UMass Dartmouth:         +4 (unresolved archived scoring input)
(715 + 66) / 49 = 15.9388
```

The earlier +10.34 further averages in 12 Massasoit/Roxbury graphs that the
paper explicitly excluded from complexity. Neither number replaces the final
+15.

## Figure 7 — exact arithmetic with mixed cohorts

Figure 7 is not a stale copy of Figures 4 and 5. Its hours and costs become
exact when the 12 Massasoit/Roxbury pathways omitted from Figures 4–6 are
restored.

| University | Visible Fig. 4 `n` | Visible-hour sum | Fig. 7 implied `n` | Implied omitted-hour sum |
|---|---:|---:|---:|---:|
| Bridgewater | 5 | 29 | 7 | 35 |
| Fitchburg | 5 | 6 | 6 | 30 |
| Framingham | 6 | 209 | 8 | 62 |
| MCLA | 2 | 53 | 2 | 0 |
| Salem | 5 | 53 | 7 | 39 |
| UMass Amherst | 3 | 0 | 3 | 0 |
| UMass Boston | 6 | 120 | 8 | 60 |
| UMass Dartmouth | 2 | 0 | 3 | 0 |
| UMass Lowell | 6 | 41 | 7 | 32 |
| Westfield | 4 | 83 | 4 | 0 |
| Worcester | 5 | 39 | 6 | 25 |

The restored cohort totals 916 extra hours over 61 pathways, for 15.0164 hours
per pathway. Applying the exact campus rates gives approximately $508,112.37,
or $8,329.71 per pathway. Every Figure 7 campus cost is consistent with its
all-61 hours and rate.

Thus Figure 7 uses different populations by row:

| Figure 7 row | `n` |
|---|---:|
| Average percent AS transfer | 61 |
| Average extra credit hours | 61 |
| Average extra curricular complexity | 49 |
| Average extra cost | 61 |

That is the confirmed problem. Footnote 6 says Massasoit and Roxbury were
excluded from the time-to-degree methodology and Section 4.4, yet Figure 7
includes them for hours and cost while excluding them for complexity. The
arithmetic is reproducible; the cohort choice is undisclosed and contradicts
the stated exclusion.

## Weighting and common-cohort identities

The paper's visible headline values are pathway-weighted. Campus-equal results
are different:

| Measure | Paper/pathway-weighted | Campus-equal |
|---|---:|---:|
| Figure 3 transfer rate, 61 paths | 67.7377% | 68.200% |
| Figure 4 extra hours, 49 paths | 12.9184 | 12.211 |
| Figure 5 extra cost, 49 paths | $7,129.41 | $6,624.64 |
| Figure 6 complexity, 49 paths | +14.5918 | +13.291 |

For a common 49-path cohort across Figures 3–6, the correct MA values are:

| Measure | Common-cohort value |
|---|---:|
| Figure 3 transfer rate | 70.4898% |
| Figure 4 extra hours | 12.9184 |
| Figure 5 extra cost | $7,129.41 |
| Figure 6 complexity | +14.5918 |

The 12 paths excluded from Figures 4–6 average 56.5% in Figure 3, lowering the
all-61 transfer mean by 2.75 points. A cross-measure or cross-state comparison
must not silently mix the 61- and 49-path populations.

## Website source labels and transformations

Use these labels exactly:

- `Final PDF (2026, as printed)`
- `Archived repository typed tally (2024)`
- `Recomputed from archived pathway sheets`
- `archive reconstruction − final PDF`

Do not label the archived `CurrComp Master.xlsx` values simply “Published.” Do
not label the reconstruction “Ours (corrected).” For Figure 6, distinguish:

- the fully transcribed final PDF delta matrix;
- archived tab delta = archived transfer score − archived resident score; and
- independent scorer delta on archived prerequisite graphs.

Every comparison must display source vintage, numerator, denominator,
population/cohort, `n`, weighting, and delta direction. “Error” should be
reserved for a failed invariant. Other cells should be classified as
`final-PDF revision`, `archive conflict`, `archive reproducible`, or
`unresolved final input`.

The Figure 3 reconstruction's current “Include GE” control also needs careful
language. Across the 61 MA rows, `ge_counted_units` and
`elective_counted_units` are zero. The control switches between all directly
overlaid archived receiver rows and a post-hoc subset outside GE-titled
receiving groups; it is not evidence that the final paper mixed two counting
rules.

## Cross-state interpretation

Massachusetts Figure 3 is a selected set of 61 local-AS pathways within the
paper's distance rule, not the full 165-pair state matrix. Figures 4–6 narrow
that further to 49. California comparisons must name their own degree type,
statewide pair universe, verification cohort, and unit convention. Similar
visual form does not make unlike cohorts directly comparable.

For faithful individual-paper headlines, use each figure's own documented
population. For a joint MA transfer/time/cost/complexity statement, use the
common 49-path values above.

The implemented cross-state status is:

| Figure | Method alignment | Remaining interpretation boundary |
|---|---|---|
| 1 | Same course-count numerator, denominator, all-degree scope, GE exclusion, series expansion, and pair weighting | Different state source systems and 15×11 versus 115×9 pair universes |
| 2 | Exact partition of Figure 1 and campus-equal distribution within four semantic course-type roles | MA final dots are anonymous and `n=11/11/11/5`; CA category `n` also varies, so compare roles separately |
| 3 | Same applied-AS-credit / total-AS-credit formula with GE/elective capacity made explicit | MA selected local-AS paths use reported final cells; CA uses verified statewide modeled degree choices |
| 4 | Same `max(0, pathway semester hours−120)` identity after unit conversion | Different pathway cohorts and modeled inputs; always show finite `n` |
| 5 | Same hours×rate/load arithmetic | MA excludes fees; CA price basis includes UC tuition, student-services, and campus fees, so raw dollar levels are not harmonized |
| 6 | Same `Σ(delay+blocking)` equation and transfer-minus-resident direction | Final MA graphs are unavailable and CA graph construction/completeness differs; comparison is exploratory, not a strict magnitude estimate |

Fresh California identity checks establish:

- Figures 1/2: 1,035 campus-college cells per major for CS, Biology, and
  Economics; all 27 bachelor templates explicitly verified; every one of 3,105
  rows resolves to exactly one ASSIST agreement; zero Figure-1/Figure-2
  partition failures.
- Figures 3–5: zero formula-identity or percentage-bound failures across every
  finite verified A.S.-T row. Nine Allan Hancock Biology and nine Hartnell
  Economics rows fail closed for unresolved degree-choice logic rather than
  receiving invented values.
- Figure 6: verified-only is the default; OR prerequisites and receiving series
  are preserved; ambiguous unit pools fail closed. Finite verified A.S.-T rows
  are 234/279 CS, 126/477 Biology, and 414/495 Economics. Incomplete edge
  information and placeholder counts remain visible, so this figure carries a
  stronger model warning than Figures 1–5.

The comparison UI therefore permits distribution-level readings where the
statistic is shared, displays source/cohort/`n`/weighting receipts, and refuses
strict Figure 5 and Figure 6 numeric claims where the measures are not fully
harmonized.

The saved CS comparison exhibits pin CA Figures 3–5 to verified local A.S.
(234 finite of 243 candidate pairs), matching Massachusetts's degree type as
closely as California permits. The saved Figure 6 exhibit pins verified A.S.-T
(234 finite of 279) because that graph cohort is substantially more complete.
The UI displays this degree change; it must not be described as one common CA
cohort across Figures 3–6.

## Honest limits

- The final PDF does not publish the hidden ratios behind its revised Figure 1
  cell, so the copied-cell/stale-headline classification remains strong but
  conditional.
- Figure 2 is a raster: two points are obscured by mean diamonds and the final
  dots have no campus identities. The corrected point sets are precise to the
  plotted whole-percentage scale, not final raw ratios.
- The final PDF does not publish the course-level inputs behind its revised
  Figures 3–7. Archive-to-final differences cannot be resolved without those
  same-version inputs.
- Archived pathway sheets record which bachelor requirements were removed, but
  not always which AS course satisfied each requirement. Our reconstruction
  uses declared approximate pairing and multiset matching.
- The Bristol → UMass Dartmouth complexity upload remains unrecoverable from the
  saved graph to the exact score.
- The STCC–Worcester denominator issue remains conditional on the final AS total
  being 61.
- Figure 2's non-STEM `n=5` is visible in the plot but not clearly explained.
- The MassTransfer map is raw data we did not import or independently audit.

“More reproducible” here means that our calculations expose inputs, formulas,
cohorts, and versions. It does not mean an older archived workbook is ground
truth over the later final paper.
