# Handoff: "The Paper Gate" — four moments

## Overview

Four data figures making one argument: **the income gate on Computer Science
transfer is a paperwork gate.** The generic half of every requirement list is
solved infrastructure; the campus's own CS courses carry the entire income
gradient; four-fifths of the blocking is a course a UC campus has already
formally accepted somewhere else; and writing only the agreements the
evidence supports nearly closes the gap.

This package **replaces the earlier Paper Gate designs entirely.** The census
bars, fates bar, glyph rows, repair ladder and range dumbbells of the first
version are retired — none of them appear here. What is inherited from the
sibling handoff (`design_handoff_price_of_place_figures`) is the design-system
layer: palette, type, canvas conventions, hollow = absence, hatch = resists
classification, static-figure behaviour, and the honesty constraints.

The four moments read as one continuous argument, and each ends with a single
line of ink. **A reader who takes only those four lines has the whole story:**

1. Two kinds of item. Only one of them ever fails — so if anything is creating
   the inequality, it has to be them.
2. The generic layer is flat. The income gradient lives in the Computer
   Science courses.
3. Four-fifths of the wall is already accepted somewhere. It just isn't signed
   here.
4. Sign the papers and the poorest districts nearly catch up. The largest
   share of this inequality is administrative.

**Framing constraint:** every figure measures *formal opportunity* — whether a
complete transfer path formally exists under the articulation rules. Never
student behaviour, never enrollment choice, never admission odds. This must
survive into implementation: axis titles, tooltips and alt text all say "a
complete transfer path formally exists."

## Files

| File | Register | Use |
| --- | --- | --- |
| `The Paper Gate.dc.html` | Detailed / paper-facing | Dense labelling, footnote register, an encoding-rationale note under each figure. Closest to the production research-figure system. |
| `The Paper Gate v2.dc.html` | Read-at-a-glance | Conclusions written as headlines, nothing below 15px, no footnote scaffolding — the required honesty ink moved inside the card. For briefings, slides, press. |
| `support.js` | Authoring runtime | Required to open the two files in a browser. **Not part of the design — do not port.** |

Both files carry the same four figures with identical geometry and identical
data. They differ only in typographic register, label density, and how much of
the caveat layer is exposed. Both open directly in a browser.

## About the design files

These are **design references authored in HTML**, not production code.
Recreate the figures in the target codebase's charting environment using its
established patterns. Read the markup as the spec — every coordinate, colour
and size named below is present there literally.

One implementation note that is specific to these files and **not** a design
decision: three of the four figures are laid out in HTML/CSS (absolutely
positioned tracks and flex bar rows) rather than SVG, because the authoring
runtime cannot interpolate data into SVG `<text>`. Figure 2 is SVG geometry
with an HTML label layer positioned over it in percentage coordinates. **In a
production charting layer, author all four as inline SVG** — that is the
sibling system's convention, it exports cleanly to PNG and PDF, and nothing in
these designs depends on the HTML implementation. The geometry tables below
are written in SVG-canvas units on the house **1240-unit-wide canvas** so they
port directly.

## Two requirement bases

Both figures read from a `basis` prop with two precomputed values:

| Basis | Meaning | Default |
| --- | --- | --- |
| `floor` | **Eligibility floor** — hand-verified curated minimums | ✓ |
| `stated` | **Stated preparation** — everything the ASSIST agreement lists | |

**One form per moment serves both bases; only the numbers swap.** No figure
changes shape, scale or encoding between them. Implementation should treat the
basis as a data-source switch in surrounding chrome, not as a figure variant.

Two consequences to carry over:

- The `stated` ledger (moment 3) has **two** rows rather than five, and its
  evidence panel has **two** cards rather than four — the brief supplies only
  the 81% accepted-elsewhere share on that basis, and the tier counts live in
  the data file. The figures degrade to what is known rather than padding.
- The `stated` repair table (moment 4) has **two** rows rather than three; the
  distance-stratum cut is floor-only today.

---

## Figure 1 — Split the checklist

**Required experience:** the reader *perceives* that a transfer path is a
checklist with two kinds of item, and that one kind never fails. The inference
— "if anything is creating the inequality, it has to be them" — is the
reader's, not the figure's.

**Form: a single sorted field.** One column per distinct required receiving
course across the nine asks, height = share of the 115 colleges articulating
it, sorted descending, coloured by kind. The sort is the whole argument: the
two populations are never grouped, boxed or faceted, so the separation is
something the reader watches happen. A generic plateau runs along the top of
the scale and the tail is entirely blue.

**Geometry** (1240-unit canvas):

- Plot box `x 96 → 1152`, `y 110` (100%) `→ 470` (0%). Scale 3.6 units/point.
- Column slot `(1152−96)/n`; bar width `slot × 0.66`, clamped 4–16.
  60 columns on the floor basis, 92 on stated.
- Gridlines at 0/25/50/75/100% — `rgba(25,48,24,0.10)`, baseline
  `rgba(25,48,24,0.28)`.
- **Kind rug**: a 13-unit strip at `y 490`, one cell per column at the same x
  positions, carrying only the column's kind. It makes the outcome of the sort
  legible as a single stripe.
- Two dashed median rules across the full width: generic in `#4A5849`, CS in
  `#0072B2`, both 1.4px `7 5` dash, each labelled at the right edge on a solid
  white chip.
- Colour: generic `#6F7B6E`, Computer Science `#0072B2`.

**Stat strip below the figure** (3 cells, hairline dividers): median generic
share · median CS share · `0 → 63%`, the range of how much of a single ask is
CS-core.

**Verified:** 31 generic and 29 CS-proper distinct required receiving courses
on the floor basis (54 and 38 stated). Median share of colleges articulating a
generic requirement 99% (97%), with calculus and composition at literally
100%. Median for a CS requirement 66% (65%). Berkeley's ask contains zero CS
courses; Irvine's is 63% CS-core.

**Derived — the one data cut in this package.** The individual column heights
are a monotone reconstruction anchored to the verified medians, counts and
endpoints (see `ser()` in the logic class: `n`, high, low, median). The real
per-requirement articulation rates exist in `course_repairs.v1.json` and
**implementation must read them** — do not port the generator. The claim the
figure makes (a plateau of generic requirements, a tail that is entirely CS)
is verified at the median and count level; the exact silhouette is not.

---

## Figure 2 — Take the staircase apart *(the centerpiece)*

**Required experience:** recognition, then revelation. Panel A is the Price of
Place staircase, unchanged, so the reader recognises the object. Panel B opens
it on the same vertical scale: the generic layer is nearly flat — it could
never have produced a staircase — and the CS layer climbs, tracking the
staircase's shape.

**Form: two panels, one shared vertical scale.**

- Shared y: `0% → y 452`, `100% → y 126`, scale 3.26 units/point.
- **Panel A** `x 96 → 480`, four 96-unit steps. A single step path,
  fill `rgba(25,48,24,0.055)`, stroke `#193018` 2.4px (2.8 in v2), round
  joins. Steps rather than a line because a quartile is a bin and its value
  holds across the bin. Values printed above each tread.
- **Panel B** `x 660 → 1080`, quartile means at `660 / 800 / 940 / 1080`
  joined by straight segments:
  - CS layer `#0072B2`, 4.2px (5 in v2), markers r 7.5 (9), labels below.
  - Generic layer `#6F7B6E`, 3px (3.4), markers r 6 (7), labels above.
  - District access **ghosted** from panel A: `rgba(25,48,24,0.32)`, 1.6px,
    `6 5` dash — the recognition device, not a third series.
  - Q1 and Q4 labels are nudged ±22–26 units horizontally to clear the axis
    tick and the swing brackets.
- **Swing brackets** at `x 1100`, spanning each layer's Q1→Q4 extent, with
  the swing printed at `x ≈ 1108`: `+7 pts` in grey-green at 19px, `+32 pts`
  in CS blue at 26px (22 / 32 in v2). The size difference is the finding.
- Legend below the SVG in flow, three items: CS / generic / ghosted access.

**Verified** (share of requirement × college cells articulated, by district
income quartile):

| | Q1 | Q2 | Q3 | Q4 | swing |
| --- | --- | --- | --- | --- | --- |
| Generic (floor) | 93 | 99 | 100 | 100 | +7 |
| CS (floor) | **40** | 57 | 66 | **72** | **+32** |
| Generic (stated) | 80 | 86 | 88 | 88 | +8 |
| CS (stated) | **33** | 50 | 58 | **64** | **+31** |

Staircase, carried in from the sibling snapshot: floor 40 → 62 → 77 → 90;
stated 35 → 52 → 59 → 72.

**Not a decomposition — non-negotiable.** Access is a *conjunction* (every
requirement met), not a sum. The layers must never be drawn as a stacked
decomposition implying generic + CS = access. The figure states this twice: in
the panel B caption ("two layers, not two parts of a sum") and in the note
below, which names the three swings and says they do not add. Any
reimplementation that stacks these has broken the figure.

---

## Figure 3 — The ledger of unwritten agreements

**Required experience:** the wall stops being a vague systemic failure and
becomes a specific, short stack of documents sitting unsigned — most of them
pre-approved.

**Form: a ledger.** One row per named agreement. Left column carries the
course title and campus; the right column carries **both counts on one shared
0–115 scale**, stacked:

- Blocks bar: `#0072B2`, 22 units tall (26 in v2), radius 3, value printed at
  the bar end in 19px/700 blue (24 in v2).
- Opens-alone bar: `#0D7964`, 12 units tall (14), radius 2, on the same axis
  origin, value printed at the end in 15px/700 (17).
- **Zero opens-alone renders as a hollow 12-unit square** at the origin
  (`#FFFFFF` fill, `#9CA69B` 1.6px stroke) — hollow = absence, the inherited
  convention. Never an invisible bar, never a dash.
- One 0-origin rule per row, `rgba(25,48,24,0.28)`. Tick row above at
  0 / 25 / 50 / 75 / 100 / 115 colleges.

**One scale for both counts is the point.** The stubby green bar next to the
long blue one is what makes "these are near-inverse" a perception rather than
a caveat. Blocks and opens-alone appear together on every row, always. A row
reading "stands in front of 65" must never be read as "sign it, open 65."

**Verified ledger (floor)** — blocks → opens-alone:

| Agreement | Campus | Blocks | Opens alone |
| --- | --- | --- | --- |
| Data Structures, Algorithms, & Programming | UC Davis | 65 | 15 |
| Basic Data Structures and Object-Oriented Design | UC San Diego | 49 | 12 |
| Intermediate Programming | UC Irvine | 46 | 2 |
| Introduction to Programming | UC Irvine | 44 | 0 |
| Computer Systems and Assembly Language and Lab | UC Santa Cruz | 41 | 13 |

**Stated basis:** UCLA's Software Construction Laboratory blocks all 115 and
opens 5; two same-titled UCLA Logic Design courses merge at 106 → 0.

**Evidence panel below the ledger** — four cards, **deliberately separated by
gaps rather than stacked into a single bar**, so they read as four facts about
809 blocking instances and not as parts of a whole:

| Card | Floor | Treatment |
| --- | --- | --- |
| Accepted elsewhere | 79% · 638 of 809 | solid, accent `#0D7964`; nested tier rows 424 demanding campus / 157 stricter / 57 laxer only |
| Not taught at all | 15% · 123 | **dashed border** — hollow = absence; no signature fixes these |
| Taught, never accepted | 1% · 8 | muted accent `#C6CEC5` |
| Unclassified | 5% · 40 | **hatched** ground, `repeating-linear-gradient(45deg, rgba(25,48,24,0.06) 0 4px, transparent 4px 9px)` — resists classification, shown rather than absorbed |

On the stated basis this collapses to two cards: 81% accepted elsewhere, 19%
remainder (dashed), with the split named as living in the data file.

**Evidence caveat, in ink in both registers:** the stamp is *subject-level
evidence, not course-level proof* — the college teaches the subject at a level
some campus formally accepted, not that this campus would accept this course.
The conservative standard in figure 4 exists for exactly this reason.

---

## Figure 4 — Sign the papers

**Required experience:** the payoff, minimal and unhedged except where honesty
requires the hedge. Only the agreements the evidence supports get written —
teach nothing new, hire no one — and the measures are taken again.

**Form: point-and-band on a shared 0–100 track.** One grammar, three rows,
direction-agnostic (two measures improve upward, the gap improves downward):

- Track: full width, 8 units tall (10 in v2), `#EDF1EA`, radius 4.
- **Today** = solid `#193018` dot, r 9 (11), value printed below the track.
- **Destination** = a band spanning the two evidence standards, fill
  `rgba(0,114,178,0.16)`, 38 units tall (42), with a **4px cap at the
  conservative bound** and a **1.6px cap at the full bound**. The thick cap
  leads every reading. The value is printed above the band as
  `75 – 79%` at 34px/700 (44 in v2), conservative first, always.
- **Connector**: 1.6px `5 4` dashed `#0072B2` from the today dot to the band
  edge, with a solid triangle at the tip. Reverses for the gap row.
- **Residual**: from the full bound to 100, a hatched rect
  (`rgba(156,166,155,0.8)` 2px lines every 8px at 45°, 1px `#C6CEC5` border)
  labelled *still closed* on a white chip. The not-taught remainder stays
  visibly unfixed.
- Tick row 0 / 25 / 50 / 75 / 100. Shares are percent, the gap is percentage
  points; both live on one 0–100 scale and the subtitle says so.
- **Collision guards, required.** A `conservative → full` note is drawn under
  each band only when the today dot and the band centre are more than 24
  scale-points apart; the dashed connector and its arrowhead are drawn only
  when their span exceeds 4 points. On the stated basis the gap row fails both
  tests (today 37 against a 27–30 band), so the note and connector are
  suppressed there. A **legend below the rows** carries the thick-cap /
  thin-cap / hatched-tail encoding unconditionally, so nothing is lost when a
  per-row label is suppressed. Any reimplementation needs equivalent guards —
  the floor basis is only safe by coincidence.

**Verified:**

| Floor basis | Today | After (conservative → full) |
| --- | --- | --- |
| Poorest-quartile access | 40% | **75 – 79%** |
| Richest − poorest gap | 49 pts | **23 – 19** |
| Worst distance stratum (far & poor) | 41% | **74 – 79%** |

| Stated basis | Today | After |
| --- | --- | --- |
| Poorest-quartile access | 35% | **68 – 72%** |
| Richest − poorest gap | 37 pts | **30 – 27** |

Honest lines, swapped with the basis: on the floor, *"the gap shrinks by more
than half"*; on stated, *"the repaired poorest quartile lands exactly on
today's richest quartile — 72%."* Never "the gap closes."

---

## Honesty constraints (carry these into implementation)

1. **No additive decomposition of access.** Access is a conjunction. Layers
   are flat vs steep, never parts summing to a whole.
2. **Evidence stamps are subject-level, not course-level proof** — and the
   figures say so in ink, not only in a caption.
3. **Every repaired number is a two-standard range, led conservative.**
   Neither bound is a forecast; both are re-measurements of the same census
   under a written-agreement assumption.
4. **Blocks and opens-alone are near-inverse and always appear together.**
   Wherever a blocking count appears, its opens-alone companion appears.
5. **Quartile means, never fitted curves.** No smoothing, no splines, no
   confidence ribbons on bounded shares — OLS overshoots 100%.
6. **Every mark carries a real value; no hover-only data.** Every number the
   argument depends on is printed as text. Native tooltips are an accessibility
   floor, never the only route to a value. Anything needing a paragraph of
   defence is caption, not ink.
7. **Attribute closures to campus scope choices, never to college failure** —
   which courses a campus requires, and how narrowly it defines an acceptable
   equivalent.
8. **Formal opportunity only.** A signed agreement changes what a path
   permits, not who walks it.
9. **Subject classification is a transparent, hand-corrected title
   classifier**, acknowledged in a note. Medians are robust to single-course
   reassignment; individual columns are not, and the figure says that.

## Interactions & behaviour

These are static paper figures. There is no application state.

- **Tooltips:** every mark carries its full value in prose ("UC Davis · Data
  Structures, Algorithms, & Programming: stands in front of 65 of the 115
  colleges"). In production SVG these become `<title>` children.
- **Alt text:** each figure carries a prose summary naming its values
  (`m1Alt`, `m2Alt`, `m3Alt`, `m4Alt` in the logic class). Port these.
- **The basis toggle lives in surrounding chrome**, not inside the exported
  figure. The pill in the page header is a status indicator, not a control.
- **Responsive:** figures are `width:100%` against a fixed 1240-unit canvas.
  Below roughly 1000px CSS width the label pairs in figures 2 and 4 begin to
  crowd; serve a reflowed variant or scroll horizontally rather than shrink.
- **Print:** no shadows, no decorative gradients, minimal gridlines —
  print-safe as authored.

## Tweakable props

| Prop | Default | Notes |
| --- | --- | --- |
| `basis` | `floor` | `floor` \| `stated`. Swaps every number in all four figures; geometry is untouched. |
| `showTierDetail` | `true` | The 424 / 157 / 57 evidence-tier rows nested in figure 3's first card. |
| `annotations` | `true` | *Detailed file only.* The encoding-rationale note under each figure. **Reviewer scaffolding, not house style** — strip for publication; do not port as a user-facing toggle. |

## Design tokens

Inherited unchanged from `design_handoff_price_of_place_figures`. The subset
this collection uses:

**Type** — `'Hanken Grotesk Variable', 'Hanken Grotesk', ui-sans-serif,
system-ui, sans-serif`, `font-variant-numeric: tabular-nums` throughout.

| | Detailed | At-a-glance |
| --- | --- | --- |
| Page H1 | 58px / 700 / −0.028em | 64px / 700 / −0.03em |
| Moment eyebrow | 12.5px / 700 / 0.1em caps, CS blue | 13px |
| Moment headline | 40px / 700 / −0.022em | 46px / 700 / −0.024em |
| Dek | 20px / 600 | 23px / 600 |
| Figure title / subtitle | 19px / 600 · 15.5px | 22px / 600 · 17px |
| Axis ticks | 13px | 15–16px |
| Row labels | 18–19px / 600 | 21–22px / 600 |
| Headline values | 34–36px / 700 | 44–46px / 700 |
| Closing line of ink | 19px / 600 | 23px / 600 |
| Footnotes | 12.5px | *none — moved into the card as ink* |

**Colour**

| Token | Value | Use here |
| --- | --- | --- |
| Ink | `#193018` | text, axes, the "today" dot, the staircase stroke |
| Ink 80 / 70 | `#334432` / `#4A5849` | deks, generic-layer labels |
| Muted text | `#6B776A` | captions, ticks |
| Muted line | `#9CA69B` | hollow-marker strokes |
| Gridline / axis rule | `rgba(25,48,24,0.10)` / `rgba(25,48,24,0.28)` | |
| CS blue | `#0072B2` | **reserved for Computer Science and for repaired values — nothing else** |
| Field grey-green | `#6F7B6E` | the generic requirement population |
| Gained | `#0D7964` | opens-alone bars, the accepted-elsewhere accent |
| Harmless / hatch | `#E7EBE4`, stroke `#C6CEC5` | the unfixed residual |
| Figure background | `#FFFFFF` | always |
| Page background | `#F5F8F3` | surrounding chrome only |

The pending-amber convention (`#8A5A00` / `#E69F00`) is **not used anywhere in
this collection** — every value on the page is real. If a cut regresses, amber
is the correct flag.

**Geometry** — figure card `1px solid rgba(25,48,24,0.11)`, radius 14px
(16 in v2), padding 38–42px. Never drop shadows, never decorative gradients,
never more than the two background colours above.

## Data inventory

Everything above is computed and lives in `course_repairs.v1.json`, both
bases: per-requirement articulation rates with titles, campuses, subject
buckets and CS flags; the quartile gradient lines; the fates counts with
evidence tiers; the ledger rows (blocks, opens-alone, per course); repaired
metrics at both standards; and the Place staircase values for reference.

**Verified vs derived ledger:**

| Figure | Verified | Derived / to read from the data file |
| --- | --- | --- |
| 1 | Counts (31/29, 54/38); medians (99/66, 97/65); calculus and composition at 100%; Berkeley 0 CS, Irvine 63% CS-core | **Every individual column height** — reconstructed from the verified anchors in these design files. Read the real per-requirement rates. |
| 2 | All 16 quartile values, both bases; both swings; the staircase values | — |
| 3 | 809 instances; 638 / 8 / 123 / 40 with tiers 424 / 157 / 57; the five floor ledger rows; the two stated rows; 79% and 81% | Tier counts and instance total on the **stated** basis |
| 4 | All floor and stated values in the tables above | The distance-stratum cut on the **stated** basis |

## Assets

No images, no icons, no external assets. One external dependency: **Hanken
Grotesk** from Google Fonts
(`https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,300..800;1,400&display=swap`).
If the target codebase self-hosts the family, use that instead.

## What is deliberately absent

Four moments only. No methods coda, no appendix figures, no per-program
breakdowns, no maps. The retired analyses — the census bars, the fates bar,
the glyph rows, the repair ladder, the range dumbbells — live in the data
file, not on the page.
