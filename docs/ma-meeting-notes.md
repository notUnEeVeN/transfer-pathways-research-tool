# Massachusetts paper — errors we found, and why we're sure

Every number here can be regenerated from their own files. Technical detail:
[`ma-paper-audit.md`](ma-paper-audit.md). Per-cell records: `server/data/ma/*.json`.

**The one-line summary: we have now checked every figure in the paper against
its own files. Figures 1, 2, 4 and 5 are correct. The errors are in Figure 3
(45 of 61 cells), Figure 6 (two drifted scores plus one cell typed into the
chart), and Figure 7, whose credit-hours and cost rows contradict the paper's
own Figures 4 and 5 on 7 of 11 columns.**

**Correction (2026-08-17).** There are three artifacts, not two: the **paper**
(newest), their **GitHub repo** workbook, and **our** computation. An earlier
version of this note treated repo numbers as the paper's. Figure 2 is not an
error at all — we had been auditing the repo notebook's hard-coded bars. Figure
4 is still unverified against the paper for the same reason. Every claim below
now names which artifact it is about.

Their spreadsheet has detail sheets (one per college-university pair, listing every
course) and summary tabs (the numbers that became the figures). The summary tabs
are typed, not linked — so when a detail sheet got corrected, the summary silently
kept the old number. The two figures their spreadsheet computes with formulas have
zero errors. Every figure a person typed has errors. That's the whole story.

---

## Figure 1 — requirements heatmap · 165 checked, 0 wrong

- Calculated with live formulas. We match all 165 cells exactly, average 38.2% on
  both sides.
- Why we're sure: same raw data, same formula, three ways (their formulas re-run,
  their stored values, our engine). This also proves our engine isn't the source
  of any disagreement elsewhere.

## Figure 2 — course types · reproduces correctly

- **The paper's Figure 2 is right, and we should stop saying otherwise.** Its
  numbers reproduce from their own data almost exactly: computing 21.2% against
  the 22% they state, math 60.6% against 60%, science 92.9% against 93%. The
  spread of the plotted dots matches too — computing runs 6% to 58% in the data,
  and their highest computing dot is Fitchburg at 58%.
- **What we had actually been auditing was their GitHub notebook, not the
  paper.** The notebook hard-codes its bars (their own comment: "Sorry for hard
  coding these :("), and those hard-coded values are a *different measure* —
  they average 42.2% for computing where the paper says 22%.
- **The difference is the denominator, and it is not an error.** The notebook's
  bars count only lower-division requirements; the paper counts the whole
  degree. Upper-division computing courses can never be taught at a community
  college, so including them roughly halves the computing figure. Both numbers
  are defensible; they answer different questions. The paper picked the harder
  one.
- **Why our site can look different:** our own course-type figure opens on the
  lower-division view, which is the articulation question. Set it to whole
  degree and it lines up with the paper.
- The one loose end is non-STEM: only 6 of their 11 universities carry a
  non-STEM column at all, the whole-degree average over those six is 63%, and
  the paper reports 76%. Small, uneven sample — worth a question, not a claim.

## Figure 3 — % of AS credits that transfer · 61 checked, 45 wrong

Every published cell is a typed fraction like `=31/61` with **no cell references**
— the top is a hand count of transferred credits read off the detail sheet, the
bottom a hand-typed degree total. Nothing recalculates when a sheet is edited, so
each cell is frozen at whatever was true the day someone typed it. The four error
patterns, with the exact cells:

- **Frozen counts (25 cells too low).** The clearest: **UMass Boston × Bunker
  Hill**. The typed fraction is `31/61` → printed 51%. Open their own Bunker Hill
  detail sheet: 18 requirement rows are marked transferred, worth **62 units
  against a 61-unit associate degree** — their own sheet says *the entire degree
  transfers* (we print 100%). Nothing on the sheet produces 31; it's a count from
  an earlier version of the sheet that was never retyped. Same shape at
  **UMass Amherst × Holyoke**: typed `31/64` → 48%, but the sheet's 16 transferred
  rows carry 58 units → 91%. And at **MCLA × Berkshire** (typed `25/65` → 38% vs
  the sheet's 43 units → 66%) the missing credits are exactly the gen-ed rows —
  counted out, even though the paper's own footnote says gen-ed is included.
- **Impossible highs (20 cells).** **UMass Dartmouth × Massasoit**: printed 95%,
  typed `35/65`. Their own sheet removes only 9 rows worth 31 units — the maximum
  any reading of that sheet can produce is **44.6%**. No definition of gen-ed, no
  counting choice, reaches 95. **Dartmouth × Cape Cod** prints 90% against a sheet
  ceiling of about 74%.
- **One person's habit, one column.** The typed counts minus the sheet's actual
  totals cluster by university: the **UMass Lowell column runs +3 to +4 in every
  cell**, with five cells snapped to exactly 100%; the Westfield column runs about
  −9 everywhere. Different hands filled different columns, each with a consistent
  bias — that's data entry, not method.
- **Wrong denominators (2 rows).** **Bridgewater × Bristol** is typed `51/69`,
  but Bristol's own AS sheet totals **72** units — every cell in that row inherits
  the wrong bottom. **Worcester × Springfield Technical** divides by 63; the
  Springfield sheet says **61**.
- **Numbers with no work behind them.** Roxbury's detail sheets are empty stubs —
  nothing marked transferred — yet its summary cells carry real percentages
  (Lowell × Roxbury prints 52%; the sheet supports ~11%). Those numbers came from
  something never saved. Notably, Roxbury and Massasoit are the two colleges the
  paper's own footnote elsewhere excludes for missing data.
- **The revision that proves the direction.** Between their repo workbook and the
  final PDF, they corrected some cells — and where they did, they landed on us:
  Bristol × Bridgewater went repo 73.9 → PDF 90, beside our 90.3. When they
  fixed cells, they fixed them *toward* their own detail sheets, which is what we
  compute from directly.
- **The averages still agree** — ours 68.6%, theirs printed 67.7%, quoted 68% —
  because 25 low and 20 high errors cancel. That's why nobody caught it.
- Why we're sure: on the 22 pairs where their typed number matches their own
  sheet, we match them too (correlation 0.994, mean gap 2.2 points). Every
  disagreement sits where their own two files contradict each other, and for each
  such cell we can point to the specific rows on their sheet that the typed count
  missed or exceeded.

## Figure 4 — credits to graduate · 49 cells checked, 0 wrong

- **Figure 4 is right.** We transcribed all 49 printed cells from the PDF and
  they reproduce the figure's own Average row on 10 of 11 columns exactly (MCLA
  computes 26.5 and prints 26 — the figure rounds half down). Its overall mean
  is 12.9 extra hours, which is the "13" the paper states in its own text.
- Our earlier "7 wrong" was the **repo workbook's** Credit Hours tab, not this
  figure. The repo is the older tally.

## Figure 5 — cost of extra credits · 0 wrong

- **Figure 5 is right, and it is Figure 4 priced.** Cost = (hours above 120) ×
  the campus's per-credit rate, and that holds **to the cent on all 35 priced
  cells**. The implied rates are stable per campus — Fitchburg $473, Bridgewater
  $489, Worcester $491, Framingham $497, MCLA $508, Salem $514, Westfield $515,
  UMass Boston $696, UMass Lowell $707.
- Its overall mean is **$7,129 — exactly the figure the paper states**.

## Figure 6 — curricular complexity · 60 scores checked, 2 wrong · plus 1 wrong cell in the printed figure

- Computed by uploading their sheets to curricularanalytics.org (their README
  says so — no calculator exists in their repo). We implemented the same
  published math ourselves, ran it on their own sheets, and match **58 of 60
  scores exactly, to the integer**. Their +15 headline reproduces as +15.9.
- The two score misses are both +4, and both trace to their files, not the math:
  - **Bridgewater (resident)**: we compute 164 from the sheet in their repo;
    they published 160. That sheet is the same one whose credits drifted 123 vs
    120 (Figure 4 above) — the saved sheet changed after the upload.
  - **Dartmouth × Bristol**: we compute 174 from their saved sheet; they
    published 170. Here the credits agree, so the file they uploaded to the
    website simply wasn't the file they saved.
- **A third error sits in the printed figure itself: Springfield Technical ×
  UMass Amherst is printed as −28, but their own Curricular Complexity tab
  computes +34** (score 219 against Amherst's 185 resident — we reproduce 219
  from their sheet exactly). The tell is their own Average row: Amherst's
  printed average is **+1.0**, and (6 + 25 − 28) / 3 = +1.0 to the decimal —
  only the −28 cell produces it. Averaging their own tab instead gives +21.7.
  Figure 7 repeats the +1.0. Every other university's printed average matches
  its tab to rounding, so this is the figure's only such cell — a value typed
  into the chart, not computed from their data.
- Why we're sure: matching an independent published tool's output on 58 real
  curricula to the integer rules out implementation differences. We also settled
  a detail their README doesn't state: corequisites count as graph edges —
  scoring with them matches 58 of 60; without them, only 17 of 60.

## Figure 7 — the summary table · THIS is the one that's wrong

- **The paper contradicts itself.** Figure 7's *Avg Extra Credit Hours* and
  *Avg Extra Cost* rows disagree with Figures 4 and 5 on **7 of 11 columns**:

  | | Fig 4 | Fig 7 | repo workbook |
  |---|---|---|---|
  | Bridgewater | 5.8 | 9.1 | 16.4 |
  | Fitchburg | 1.2 | 6.0 | 6.8 |
  | Framingham | 34.8 | 33.9 | 33.9 |
  | Salem | 10.6 | 13.1 | 13.1 |
  | UMass Boston | 20.0 | 22.5 | 22.5 |
  | UMass Lowell | 6.8 | 10.4 | 10.4 |
  | Worcester | 7.8 | 10.7 | 10.7 |

- **The direction is knowable.** On six of those seven, Figure 7 equals the repo
  workbook to the decimal. Figure 7 is the older tally; Figures 4 and 5 were
  regenerated and the summary table was never updated to match.
- **It is only those two rows.** Figure 7's *Avg % AS Transfer* row matches
  Figure 3, and its *Avg Extra Curr. Complexity* row matches Figure 6. So this
  is a stale-row problem, not a broken table.
- Why we're sure: Figures 4 and 5 agree with each other to the cent, and both
  agree with the paper's own prose totals (13 hours, $7,129). Figure 7 agrees
  with neither, and instead matches a file the paper superseded.

## MassTransfer map — not checked

- Raw data, no computation on either side. We never imported that column, so we
  make no claim about it. Our gap, not their error.

---

## If asked

- **"So the paper is wrong?"** Its headline averages are right — we reproduce
  them. The per-cell values on the hand-typed figures are unreliable. It's a
  data-entry problem, not a research-design problem. Their own limitations
  section says the work was manual and error-prone.
- **"Could it be your pipeline?"** Zero of the 61 Figure-3 pairs resolved against
  us, and the two formula-computed figures match us exactly.
- **"What's different about your approach?"** One program computes every number
  from the raw course records, the same engine for Massachusetts, California,
  and Virginia. Their corrections couldn't propagate; ours can't fail to.
