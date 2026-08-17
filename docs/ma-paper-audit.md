# Massachusetts paper — full audit and reproduction record

The technical record behind the Massachusetts tab: we imported the "Lost in
Transfer" paper's own data, re-ran the paper's own computations from its own
artifacts, checked that its published figures follow from them, and reconciled
our engine against both — per figure, quantitatively.

Plain-English summary for meetings: [`ma-meeting-notes.md`](ma-meeting-notes.md).

**Regenerate everything:**

```
pmt-env/bin/python server/scripts/ma/theirMath.py   # their math, rerun
node server/scripts/ma/methodsAudit.js              # the three-way audit
node server/scripts/ma/reproductionReport.js        # per-cell import record
node server/scripts/ma/pdfReconciliation.js         # the 61-pair Figure-3 ledger
node server/scripts/ma/figureLedgers.js             # Figs 1/2/4/5 + MassTransfer
```

Machine-readable results: `server/data/ma/{their-math,methods-audit,reproduction-report,pdf-reconciliation,figure-ledgers}.json`.
Import provenance: `server/data/ma/PROVENANCE.md`.

## What we imported

11 universities, 15 community colleges, 165 pairs, 61 studied pathways (part
recovered from the repo's git history), loaded into our schemas and run through
the unmodified California engine.

Two import gates enforce fidelity on every run: a rebuilt Figure-1 ratio that
disagrees with the workbook's own Lower/Upper columns **aborts the import**,
and the PDF transcription must reproduce its own printed Average row (±0.6)
and cover exactly the repo tally's pair universe.

Getting there required work that is itself a methodology note: the lower/upper
boundary of each requirement list is *solved* against the tab's own ratio
columns rather than assumed; three community-college name variants and five
revision-noise sheets ("(REAL)", "(FAKE)", one scratch tab) had to be
canonicalized; and Roxbury's AS sheet leaves its Course ID column blank.

## What their pipeline actually is

The repository's notebooks do almost no computation. The analysis lives in two
hand-built workbooks, and the notebooks read and plot them:

| Figure | Where the math lives |
|---|---|
| Fig 1 (heatmap) | Excel formulas in `Mass Heatmap.xlsx`: `Lower =COUNTIF(<lower cols>,TRUE)/COUNTA(<lower cols>)`; the `Upper` column spans **every** course column — it is the all-levels ratio, despite its name. `heatmap.ipynb` reads the stored columns and plots them. |
| Fig 2 (course types) | **Hard-coded arrays** in `course_distribution.ipynb` ("Sorry for hard coding these :("). No typing code exists anywhere in the repo. |
| Figs 3–6 | Hand tabs in `CurrComp Master.xlsx` (`% Credit Hours`, `Credit Hours`, `Curricular Complexity`, `Cost`); `ch_currcomp.ipynb` plots them as boxplots. |
| MassTransfer map | The `MT` column of the heatmap workbook. |

Two structural consequences. First, the figures rest on **two independent hand
artifacts** — the heatmap workbook (per-course booleans) and the CurrComp tabs
(per-pair tallies) — and nothing in the pipeline forces them to agree. Second,
wherever the notebook hard-codes values, the paper's figure can drift from the
paper's own data with no error to catch it.

**The scoreboard across all figures: 324 published values carry a verdict, 66
disagree — and every disagreement is on a figure whose values were typed by
hand. The two formula-computed figures (1 and 5) are clean.**

## Figure 1 — perfect three-way agreement

- Their spreadsheet math is internally sound: re-running the COUNTIF/COUNTA
  formulas from the raw boolean cells reproduces **165/165** stored values.
- Our engine matches their stored values on **165/165** cells (worst delta
  0.00pp) — enforced as an import gate, re-verified on every run.
- All three means: **38.2% = 38.2% = 38.2%** (published).

The measures are identical by construction: per-course binary articulation over
each university's requirement list, GE excluded, blanks out of the denominator
(their COUNTA skips empty cells; our importer mirrors it). **We are measuring
exactly the same thing, and we get exactly their numbers.** This is the control
experiment for every other disagreement.

## Figure 2 — their notebook deviates from their own matrix; we don't

Their published Fig 2 inputs are hand-typed arrays. The matrix behind them
supports a precise reading: per university, per course type, the share of
**lower-division** cells that articulate (the same columns their Lower formula
spans).

- Under one stated typing rule (the engine's — prefix sets plus the paper's own
  "discrete math by any name is math" exception), our engine reproduces the
  matrix on **36/38** university×type entries within 2pp. The residual is a
  single cross-listed column (Worcester's "UR 230 OR Computing Ethics PH 134"),
  which the engine deliberately types non-STEM under its ethics rule and the
  audit script's keyword fallback calls computing.
- Their hard-coded arrays deviate from **their own matrix** in **14 of 37**
  entries. Three are systematic:
  - **UMass Lowell and UMass Dartmouth are transposed** — Math (52↔87) and
    Science (78↔97) are mirror-swapped between the two universities. The
    notebook's values for each school are the other school's.
  - **Worcester Math is 100 in the notebook vs 64 in the matrix** — their
    discrete-structures courses (CS 225/295) articulate poorly, and the
    notebook's value is only reachable by leaving discrete math out of Math,
    against the paper's own documented rule.
  - **MCLA Humanities is 67 published vs 33.3 in the matrix.**
  The remaining eleven (3–10pp) look like hand entry against an earlier matrix
  revision.

**Verdict:** same measure, and where the published figure and the source matrix
disagree, the deviation is in the paper's hand step — our recomputation sides
with their own data.

## Figure 3 — the central dispute

### Their algorithm, recovered

Their Python computes nothing for this figure — `make_df('% Credit Hours')`
reads a tab and plots it. The algorithm is in the tab: **every cell is a typed
fraction with no cell references** (`=25/65`, `=51/69`; extracted in
`data/ma/pct-as-fractions.json`). Numerator = a hand count of transferred
credits read off the pathway tab; denominator = a hand-typed AS total. Nothing
recomputes when the pathway tabs change. Measured failure modes:

- Counts disagree with their own final workbook in BOTH directions
  (Boston×Bunker Hill typed 31 vs 62u removed; Dartmouth×Cape Cod typed 47 vs
  29u removed) — snapshots of different editing moments.
- The MCLA-family counts ≈ the non-GE removals only — GE rows blend into the
  pathway tabs and went uncounted, against their own footnote.
- Two denominators are wrong against their own AS sheets (Bristol /69 vs 72;
  Springfield Technical /63 vs 61) — whole rows inherit it.
- Roxbury's pathway tab is a stub, yet its row carries counts — sourced from
  something never committed.

### The complete per-pair ledger

Every studied pair carries ONE computed verdict in
`data/ma/pdf-reconciliation.json`: the workbook's own removals are re-derived
with the importer's matcher, our credited units and recovery rate are measured
against them, and each material difference resolves to a mechanism and
magnitude.

| Verdict | Pairs | Meaning |
|---|---|---|
| agrees | 16 | within rounding of the printed value |
| tally too low | 25 | our recovery of their workbook is complete, yet the printed value is LOWER — the hand tally under-credits its own record |
| tally too high | 20 | the printed value exceeds what the workbook can yield under ANY definition (ceiling computed per pair) |
| our pipeline | 0 | no pair's difference is explained by our matcher's losses (residual unplaced rows are 1-row, ~3-unit items that change no verdict) |

The two error directions nearly balance (25 low, 20 high) — the signature of
hand-tally scatter rather than a systematic definitional difference, and the
reason the aggregate means coincide while individual cells diverge.

### The GE-definition objection, tested and rejected

Their data labels GE nowhere; our "GE" is structural — the resident rows
outside their own analyzed course list (their Fig-1 matrix). Test: if their
typed numerators counted only the analyzed list, they would equal our
matrix-only credits. Across 61 pairs (±2.5u): matrix-only fits **0**, **15**
equal our GE-inclusive totals exactly, **42** equal no structural decomposition
at all (Amherst×Holyoke typed 31 vs matrix 8 / residue 50 / total 58). Where
their counting is clean their number IS our GE-inclusive number — their intent
included GE, agreeing with their footnote and our boundary. The typed-minus-total
offsets cluster per university column (Lowell ≈ +4 everywhere, Westfield ≈ −9
everywhere) — different hands, different habits.

Partial-GE test: allowing ANY subset of GE matches (typed value between the
CS/math-only floor and the GE-inclusive total), **41 of 61** cells are inside
the band — including every cell printed LOWER than ours, and none below the
CS/math floor. **20** cells sit ABOVE the GE-inclusive total, where no GE
choice can reach (the whole Lowell column, the stale-revision cells, and
Roxbury's counts against unfinished sheets). By discrepancy mass: **67%
GE-choice-explainable, 33% requires stale snapshots / unfinished sheets.**

### Agreement is gated by their sources' internal consistency

| Subgroup | Pairs | r | Our mean | Their mean | Mean abs delta |
|---|---|---|---|---|---|
| Their tally and workbook agree | 22 | **0.994** | 71.6 | 72.6 | **2.2pp** |
| Their artifacts disagree | 39 | 0.695 | 66.9 | 60.9 | 15.7pp |

Overall r = 0.80. **Our mean 68.6%** against the repo tab's 65.2% and the final
PDF's printed **67.7%** (quoted headline 68%). When the paper's data is
internally consistent, our engine reproduces its numbers almost exactly; the
residual disagreement is inside their sources, and our recomputation follows the
course-level record.

Classification of the 61 printed cells: **43** carry the older repo-tally value
forward unchanged, **9** land on our recomputation (the revision moved them
*toward* the workbook), **1** matches a BS-credit-valued variant, **8** match
nothing derivable from their own records.

### The four difference families, with receipts

**1. The tally contradicts its own workbook (largest family).** UMass Boston ×
Bunker Hill: their pathway workbook removes 18 resident requirements worth 62
units against a 61-unit associate degree — their own course-level record says
the *entire* degree transfers. We print 100%. Their tally says 51% in both
revisions, and nothing in their workbook produces 51. UMass Amherst × Holyoke
is the same shape (workbook implies ~94%; they print 48%). MCLA × Berkshire:
the workbook overlay removes the GE requirements (66% by their own record); the
tally credits 38% — their own heatmap notebook remarks on MCLA's GE pattern,
and their footnote says GE is included.

**2. The printed value exceeds what their own workbook can support.** UMass
Dartmouth × Massasoit prints 95%, but the pathway workbook removes only ~37
units against a 65-unit degree — no definition reaches 95. UMass Dartmouth ×
Cape Cod prints 90% against a workbook ceiling around 74. These cells are not
derivable from their own data at all.

**3. Stub pathways: the workbook records no transfer.** UMass Lowell ×
Roxbury's pathway is literally the resident plan plus the associate degree
stacked (185 = 121 + 64 units) — nothing removed, no transfer recorded. We read
~11%; they print 52%. Notably, Massasoit and Roxbury — the two colleges behind
our worst residuals — are the same two the paper's own footnote excludes
elsewhere for missing data.

**4. Where the final revision recomputed, it moved onto us.** Bristol ×
Bridgewater: repo tally 73.9 → final PDF 90 → ours 90.3. Nine cells the
revision touched landed within two points of our number. When they corrected
cells, they corrected toward the workbook — which is what we compute from
directly.

## Figures 4 and 5 — one phenomenon, not new disagreement

The measures differ by definition: theirs is pathway hours beyond 120; ours is
AS units that find no home in the bachelor's. The two coincide whenever the
resident plan is 120 and matched courses swap unit-for-unit, and they diverge
exactly where Fig 3 diverges: the per-pair Fig-3 and Fig-4 deltas correlate at
**r = −0.79** — crediting more AS units necessarily leaves fewer extra ones.
There is one disagreement between the pipelines, not three (Fig 4: r = 0.80,
our mean +26.4h vs their +17.2h — the strict overlay reading keeps more
requirements, hence more extra units).

Against their own pathway sheets, their typed Fig-4 hours are largely faithful:
**54 of 61 within one credit**, 2 drift small, and **5 contradict the sheet
outright** — both Roxbury rows are typed BELOW their unworked sheets (implying
subtraction done somewhere never saved), and Boston × MassBay's published 127
matches neither revision of its own tab (148 and 151).

Cost is that same story in dollars: their Cost tab is exactly
`(hours − 120) × a flat per-credit rate`, consistent per university **to the
cent** across all 57 checkable cells (worst rate spread $0.00 — Bridgewater
$488.92 … UMass Amherst $740.50). We derive those rates from their own cells
and price our extra units with the identical rate, so **Fig 5 can carry no
independent errors**: every one is a Fig-4 error times the rate.

## Figure 6 and the MassTransfer map

**Fig 6 (complexity): reproduced, 58 of 60 exact.** Their README states the
method — "Curricular Complexity: Automatically calculated by
curricularanalytics.org", the web front end for CurricularAnalytics.jl, which
implements Heileman et al. (2018). Their repo carries no calculator, but their
recovered pathway workbooks carry the **prerequisite graph** those scores were
computed from (`prereqs` and `coreqs` per course), so the figure is
reproducible from their own data. `services/analysis/curricularComplexity.js`
implements the published equations directly.

Scoring all 72 pathways (60 carry a published value): **58 exact, mean delta
0.13**. Corequisites must count as edges — 58/60 with them against 17/60
without, which settles the reference tool's reading rather than assuming it.
The two misses are both +4 and both their-side: Bridgewater's resident tab sums
to 123 credits against its own published 120 (the drift PROVENANCE.md already
records), and UMass Dartmouth × Bristol agrees on credits, so its uploaded CSV
differed from the saved tab.

Their published **+15** headline reproduces at **+15.94** over the 49 pathways
they scored (+10.34 over all 61 — the difference is the unworked
Roxbury/Massasoit stubs). Regenerate: `node scripts/ma/complexityCheck.js` →
`data/ma/complexity-validation.json`.

This makes Figure 6 the second figure, after Figure 1, where their pipeline is
sound.

**MassTransfer map: our gap, not their error.** The MT column is raw data with
no computation on either side; we never imported it and nothing displays it.
Their workbook marks 38 of 165 pairs as having an A2B agreement.

## The published headline numbers, identified

| Headline | Source statistic | Status |
|---|---|---|
| 38.2% (Fig 1) | mean of all 165 cells | exact, three ways |
| 68% (Fig 3) | **identified**: the mean of Figure 7's per-university averages on the *final-PDF revision* of the tally (68.2%). The recovered repo workbook is an **earlier revision** — the same statistic on it gives 64.1% | resolved by reading the PDF's printed matrices |
| +13 (Fig 4) | **median** delta vs the same university's resident plan = 13.0 | exact |
| $7,129 (Fig 5) | nearest: median of cost cells = $7,212 ($83 off; the cost tab rides the credit-hours tab, which drifted between revisions) | explained |
| +15 (Fig 6) | **mean** complexity delta vs resident = 15.86 | exact after rounding |

Note the aggregation switches between figures (median for hours, mean for
complexity); nothing in the repo states this — it is recovered here.

## Revision drift: their repo is not their PDF

The final PDF prints per-cell matrices for Figures 3–5 and a Figure 7 summary
table, generated from a **newer tally revision** than the workbook in the
paper's repository. **The repo workbook is the older revision; the PDF is
newer.** The Bristol row, three ways:

| Bristol × | Final PDF | Repo workbook | Our recomputation |
|---|---|---|---|
| Bridgewater | 90% | 73.9% | 90.3% |
| UMass Boston | 58% | 58% | 51.4% |
| UMass Dartmouth | 90% | 78.3% | 75.0% |

Figure 3 as printed is transcribed in `server/data/ma/pdf-figures.json` (gated
on reproducing its own printed Average row) and displayed by the console's
Source selector.

Also note: the repo's `ma_paper/transferpaper` LaTeX is a **superseded draft** —
pin all comparisons to the final SIGCSE PDF. The draft's 61.4% Figure-1 claim
reproduces from neither sheet (the workbook gives 57.3% lower-division / 38.2%
all-levels).

## Reconstruction choices a reader should know

- **AS↔BS course pairing is order-of-similarity approximate.** The pathway keeps
  every AS course and removes satisfied BS requirements; which AS course
  satisfied which requirement is recorded nowhere, so the importer pairs them by
  name-token similarity with an order fallback, and each agreement declares
  `pairing: 'order-approximate'`.
- **Removed requirements are recovered by multiset matching** (exact code+name,
  then code, then name, then fuzzy tokens) because the two catalogs share names
  ("Calculus I") and placeholder codes ("ELEC xxx") with multiplicity. Removal
  credits are **consumed** one template row at a time; a placeholder code
  (`ELEC xxx`, `XXXX`, `SLOT`) never satisfies a claim on the bare code, because
  the category lives in the name. The earlier set-membership check collapsed
  this: Bridgewater lists eleven `ELEC xxx` GE slots, six removed against
  Bristol lit up all eleven, and the pair read 100%. Case is normalized on both
  sides (`elec xxx` = `ELEC XXX`).
- **Unstudied pairs stay blank.** 104 of 165 pairs carry requirement-level
  verdicts but no pathway; their agreements are `pairing: 'booleans-only'` and
  the credit-rate figures leave them null, matching the paper's blanks.
- **The offerings-vs-AS gap is measurable now:** 415 requirement×pair cases
  articulate at the college (heatmap true) while the AS degree does not carry
  the course, so the pathway keeps the requirement. This is the paper's designed
  Q1/Q2 difference, quantified for the first time.

## Are we measuring the same things?

- **Fig 1: identical measure, identical values.** The anchor.
- **Fig 2: identical measure** (lower-division shares by type under a typing
  rule). Our figure computes it from data; theirs was hand-typed, and the hand
  step introduced the only real deviations.
- **Fig 3: identical intent** (how much of the AS applies), different artifact
  fidelity: they trust a hand tally, we trust the course-level overlay — and
  where the two artifacts agree, so do we (r = 0.99).
- **Figs 4/5: definitionally different but algebraically linked** measures of
  the same quantity (excess coursework), priced identically. Divergence is
  Fig 3's, restated.
- **Fig 6: identical measure, reproduced 58/60** from their own prerequisite graph.

Justified differences we keep deliberately: our engine evaluates through
documents (degrees, agreements, courses) rather than tabs, which is what makes
the CA/MA/VA corpora comparable; our credit-rate follows the course-level record
where their artifacts disagree; and our GE handling is explicit per corpus (the
MA course-type tallies exclude the GE-titled group because the paper's matrix
has no GE columns — config `courseTypes.excludeGeGroups`; California's verified
figure semantics are untouched and byte-verified).

## Cross-state reads (the same measure, both states)

| Measure | Massachusetts | California |
|---|---|---|
| Required courses articulating (their Fig 1 measure) | 38.2% | CS 37.4% · bio 51.2% · econ 22.9% |
| AS-side transfer credit rate (their Fig 3 measure) | 68.6% (our recomputation) · 67.7% (their printed mean) | CS A.S.-T 73.1% all records (74.6% verified cohort) · bio 84.0% · econ 100% |

California's transfer-designed A.S.-T beats the Massachusetts AS on the paper's
own credit-rate measure, while raw course articulation is nearly identical for
CS — the AS-T law shows up in the credit rate, not in the articulation matrix.

**Three caveats when reading a California figure against its Massachusetts
twin:** CA Figure-1 denominators include upper-division requirement units (the
final PDF's all-levels population); CA Non-STEM tallies keep named GE blocks
that the MA partition excludes; and our Figure 3 models the *optimal*
application of recorded articulations where theirs records hand tallies — ours
is a ceiling by construction.

## Honest limits (say these before someone else does)

- Their workbooks record *which requirements left the pathway*, not which AS
  course satisfied which requirement — our AS↔BS pairing is name-similarity with
  an order fallback, declared on every agreement.
- On a few typo-heavy sheets our matcher recovers less than the workbook implies
  (Dartmouth × Massasoit: we credit 29 of an implied 37 removed units), which
  errs conservative, not optimistic.
- "More accurate" here means: faithful to the paper's own course-level records,
  reproducible, and gated — not that we possess ground truth the paper lacked.
  Where their artifacts agree, we agree with them.
