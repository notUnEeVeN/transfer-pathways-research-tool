# Massachusetts paper — errors we found, and why we're sure

Every number here can be regenerated from their own files. Technical detail:
[`ma-paper-audit.md`](ma-paper-audit.md). Per-cell records: `server/data/ma/*.json`.

**The one-line summary: we checked 385 of their published numbers; 69 are wrong;
every wrong one comes from a value someone typed by hand instead of calculating.**

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

## Figure 2 — course types · 37 checked, 14 wrong

- The published bars are typed into the plotting notebook by hand ("Sorry for hard
  coding these :(" — their own comment). Their own analysis matrix says different
  numbers for 14 of them.
- **The tell — a column swap.** UMass Lowell and UMass Dartmouth sit next to each
  other, and their values are exchanged in two rows at once:

  | | published | their own matrix |
  |---|---|---|
  | Lowell · Math | 52 | 86.7 |
  | Dartmouth · Math | 87 | 52.0 |
  | Lowell · Science | 78 | 96.7 |
  | Dartmouth · Science | 97 | 78.3 |

  Each school's published number is the *other school's* matrix value. One
  misaligned copy of two adjacent columns explains all four cells; no
  methodology could.
- **Worcester Math: published 100, their matrix says 64.** Worcester's discrete-math
  courses (CS 225/295) articulate poorly. 100 is only reachable if discrete math is
  left out of Math — violating the paper's own stated rule that discrete math
  always counts as math. So the bar contradicts both their data and their rule.
- **MCLA Humanities: published 67, matrix says 33.3** — likely typed from an
  earlier version of the matrix. The other nine misses drift 3–10 points the same
  way.
- Why we're sure: every comparison here is their chart against their own matrix —
  we are not the reference. Our engine independently reproduces their matrix on 36
  of 38 entries, so the matrix itself is sound; only the typed bars drifted.

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

## Figure 4 — credits to graduate · 61 checked, 7 wrong

- Same hand-typed pipeline, but mostly done carefully: 54 of 61 match the sum of
  their own sheet within one credit.
- **Boston × MassBay is published as 127 credit hours — their own file sums to
  148 in one revision and 151 in the other.** 127 matches neither; it's a third
  number from a version that no longer exists.
- Both **Roxbury** rows are typed *below* what their unworked stub sheets sum to —
  a subtraction was done somewhere and never saved.
- Small but telling: **Bridgewater's own resident sheet sums to 123 credits while
  the published Resident row says 120** — the same three-credit drift that shows
  up again in Figure 6 below.

## Figure 5 — cost of extra credits · 57 checked, 0 of its own

- The one summary tab that IS formula-linked: (credits − 120) × the campus's
  per-credit rate, consistent to the cent.
- It can't have its own errors — it just multiplies Figure 4's, including the
  7 bad cells above.

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
