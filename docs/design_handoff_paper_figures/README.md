# Handoff: Modernized paper figures (UC transfer articulation study)

## Overview
This package contains **four data-visualization figures** redesigned for an academic
research-paper submission (a SIGCSE-style paper on California community-college →
UC course articulation). They are modernized, publication-formatted replacements for
four figures from an earlier version of the paper. The goal of implementation is to
**reproduce these figures in the paper's figure-generation environment** so they can
be dropped into the manuscript.

The four figures:
- **Figure A — Articulation gaps by course** (2×3 small-multiples bar chart)
- **Figure B — Coverage distribution** (single-series histogram)
- **Figure C — Credit loss by campus** (grouped bar chart, 5 series)
- **Figure D — Coverage matrix** (9×72 binary heatmap)

## About the design files
The files in this bundle (`*.dc.html`) are **design references created in HTML** —
prototypes that show the intended final look. They are **not production code to ship**.
They render through a small runtime (`support.js`) and a design-system stylesheet that
is **not** included here, so they are meant to be **read as the source of truth for
styling and data**, and/or viewed via the screenshots (if provided).

**The task:** recreate each figure in the paper's own figure toolchain — most likely
**Python + matplotlib**, **R + ggplot2**, or **D3/SVG** — using that toolchain's
idioms, and export as **vector PDF or SVG** for the manuscript. Every value you need
(data, hex colors, font sizes, spacing, conventions) is specified below; the README is
self-sufficient without rendering the HTML.

## Fidelity
**High-fidelity.** Colors, typography, spacing, gridlines, and value-label formatting
are final and exact. Reproduce them precisely. The one caveat is the Figure D data —
see its section (pixel-extracted; verify against source CSV).

---

## Shared design system (applies to ALL four figures)

Keep these identical across the four figures — cross-figure consistency is a hard
requirement of this redesign.

### Canvas & layout
- **Design width:** 1240 px per figure (they are meant to sit at the same printed
  width so text scales identically). Height varies per figure.
- **Background:** white `#FFFFFF`. No card, no outer border, no drop shadow.
- **Padding inside the figure:** 22 px top/bottom, 24 px left/right. Keep whitespace tight.
- **No in-figure title or subtitle.** The paper caption supplies context. Only axis
  titles, tick labels, data labels, legend, and footnotes appear inside the graphic.

### Typography
- **Family:** `Hanken Grotesk` (Google Fonts) with system-sans fallback. This is a
  substitute for the study's brand face (Haffer SQ); if the paper uses a house font,
  substitute it consistently across all four figures.
- **Axis titles** (e.g. "Number of courses"): 14 px, weight 500.
- **Tick labels, category labels, value labels:** 12 px.
- **Value (data) labels:** 12 px, weight 500. Numeric labels use **tabular / lining
  figures** (`font-variant-numeric: tabular-nums`).
- **All text color:** near-black forest green `#193018` (used as "ink" — deliberately
  not pure black, but essentially black in print). Do **not** use light-gray labels.

### Axes, gridlines, marks
- **Horizontal gridlines:** 1 px, color `rgba(25, 48, 24, 0.10)` (10%-alpha ink). Subtle.
- **Baseline / x-axis line:** 1.5 px, color `#9CA69B` (a single restrained mid-gray line).
- **No heavy plot border / no boxed frame** around the plot area.
- **Bars:** top corners rounded **3 px** (bottom square); each bar carries a 1 px inset
  hairline `rgba(25, 48, 24, 0.10)` for definition (matters for pale fills).
- **Value labels** sit just above each bar, centered. Horizontal in Figures B; in
  Figure C they are rotated to read vertically (bottom-to-top) because bars are dense.
- **Y-axis headroom:** leave ~12% empty above the tallest bar so its value label fits.

### Quarter- vs semester-system convention (Figures A, C, D)
UC campuses on the **quarter** system are marked with a trailing asterisk `*`
(e.g. `UC3*`, `Davis*`); unmarked campuses are on the **semester** system. Every figure
that shows campuses repeats this and states it in a footnote:
`* quarter-system campus · unmarked = semester`.

### Color palette (hex)
- **Academic blue (primary single-series):** `#2E5C8A`  · alts: Navy `#24466F`, Steel `#5B85B0`
- **Ink / text:** `#193018` · **muted line:** `#9CA69B`
- **Figure A per-course (Okabe–Ito, colorblind-safe categorical):**
  - Calculus `#0072B2` · Intro Programming `#E69F00` · Data Structures `#009E73`
  - Advanced Math `#CC79A7` · Computer Organization `#56B4E9` · Discrete Math `#D55E00`
- **Figure C requirement (gold):** solid `#FAE745`; quarter-system hatch = gold `#FAE745`
  diagonal stripes over cream `#FAF8E1`.
- **Figure C choice ramp (ordinal, dark→light):** 1st `#1E3A5F` · 2nd `#38618C`
  · 3rd `#6E93BF` · 4th `#A9C3DE`.
- **Figure D matrix:** complete `#2E5C8A`, incomplete `#FFFFFF`, cell gridline
  `rgba(25,48,24,0.10)`.
- **"Not required" hatch (Figure A):** diagonal lines in `#9CA69B` at ~55% opacity, full cell height.

### Grayscale / colorblind robustness (required)
- Figure A colors are Okabe–Ito (colorblind-safe) AND each course sits in its own
  titled panel, so color is a redundant cue.
- Figure C choices use a **lightness ramp** (encodes the 1st→4th ranking), and the
  requirement is separated by hue **and** the hatch pattern — readable in grayscale.
- Figures B and D are single-category (one blue / dark-vs-white binary).
- Patterns (hatching) carry the "not required" and "quarter requirement" meanings, not color alone.

---

## Figure A — Articulation gaps by course

**Purpose.** Percentage of CCC districts missing a course-articulation agreement, for
each math/CS course required for UC transfer, broken out per UC campus.

**Layout.** 2 rows × 3 columns of small-multiple panels (one per course). Each panel:
a centered course title (14 px, weight 600), a shared y-axis **0–60** with gridlines at
0/20/40/60 (y-axis title "% of CC districts" + numeric ticks on the **left column only**;
reserve the gutter on all panels so bar widths match), and 9 bars (one per campus).
Column gap 16 px, row gap 14 px, panel plot height ~172 px.

**Series & color.** Single series per panel; **bar color identifies the course** (see
per-course palette above). A *Single color* variant (all `#2E5C8A`) exists but the
default and intended version is per-course.

**X categories (all panels, in order):** `UC1*, UC2, UC3*, UC4*, UC5*, UC6, UC7*, UC8*, UC9*`.

**Value labels:** one decimal, above each bar, no “%” sign (the y-axis carries the unit).

**"Not required" cells:** where a campus does not require a course, draw **no bar** —
instead a faint full-height diagonal **hatch** in that slot (see hatch spec). These are
the `null`s below. A *Faint solid* and *Hidden* alternative exist but hatched is default.

**Data** (`null` = course not required by that campus; values are % of districts):
```
campuses            = [UC1*, UC2, UC3*, UC4*, UC5*, UC6, UC7*, UC8*, UC9*]   # * = quarter
Calculus              = [5.6, 2.8, 4.2, 1.4, 4.2, 2.8, 1.4, 1.4, 1.4]
Intro Programming     = [31.9, 6.9, 34.7, 19.4, 34.7, null, 23.6, 45.8, 20.8]
Data Structures       = [52.8, 9.7, 40.3, 27.8, null, null, null, null, null]
Advanced Math         = [null, 4.2, 5.6, 4.2, 6.9, 4.2, null, null, null]
Computer Organization = [25.0, null, null, null, null, null, 23.6, null, null]
Discrete Math         = [20.8, null, 31.9, 8.3, null, null, 19.4, null, null]
```
Panel order (grid, row-major): Calculus, Intro Programming, Data Structures,
Advanced Math, Computer Organization, Discrete Math.

**Footnote/legend row (below grid):** hatch swatch → "Course not required by this
campus"; then `*` → "quarter-system campus · unmarked = semester".

---

## Figure B — Coverage distribution

**Purpose.** Distribution of CCC districts by how many of the 9 UC campuses they fully
articulate to.

**Layout.** Single bar chart. Y-axis "Number of districts", **0–20**, ticks 0/5/10/15/20.
X-axis "Number of UC campuses with complete articulation", categories `0…9`. Plot height
~340 px. Single series, all bars **academic blue `#2E5C8A`**.

**Value labels:** integer, above each bar.

**Data** (index = number of campuses 0…9; value = number of districts; sums to 72):
```
counts = [3, 2, 1, 7, 6, 11, 8, 4, 10, 20]   # x = 0,1,2,…,9
```
Optional emphasis (off by default): the full-coverage bar (x = 9) may be highlighted in
a darker navy `#1E3A5F`.

---

## Figure C — Credit loss by campus

**Purpose.** Per UC campus: the CS/Math course requirement vs. the number of courses a
district articulates through each ranked ASSIST choice (1st–4th).

**Layout.** Grouped bar chart, 9 campus groups × 5 bars. Y-axis "Number of courses",
**0–8**, ticks 0/2/4/6/8 (scale bars to ~82% of plot height to leave label headroom).
X-axis title "University of California campus". Plot height ~340 px. A compact 5-item
legend sits above the plot; footnotes below.

**Bar order within each group (left→right):** CS/Math requirement, 1st, 2nd, 3rd, 4th choice.
Bar width ~16 px, ~4 px gaps within a group, groups evenly distributed.

**Series & color.**
- **CS/Math requirement** = gold. It has two parts: a **solid** portion up to the
  *semester-equivalent* requirement, and a **diagonal-hatched** extension up to the
  *quarter-system* requirement (quarter req = semester × 1.5). Semester campuses (Merced,
  Berkeley) have no hatch. Requirement value labels: the top (requirement) value sits
  above the bar; the solid (semester-equivalent) value sits inside the solid portion.
- **1st–4th choice** = the ordinal blue ramp (1st darkest `#1E3A5F` → 4th lightest `#A9C3DE`).

**Value labels:** two decimals, rotated vertical (they’re dense).

**X categories (order):** `Davis*, Merced, San Diego*, Santa Barbara*, Los Angeles*, Berkeley, Santa Cruz*, Irvine*, Riverside*`.

**Data** — `solid` = semester-equivalent requirement, `req` = quarter-system requirement
(equals `solid` for semester campuses → no hatch), `choices` = [1st,2nd,3rd,4th]:
```
Davis*          solid 5.33  req 8.00   choices [7.07, 3.57, 2.55, 1.92]
Merced          solid 6.00  req 6.00   choices [6.80, 2.78, 1.51, 0.81]
San Diego*      solid 4.67  req 7.00   choices [7.16, 3.16, 1.92, 1.27]
Santa Barbara*  solid 4.67  req 7.00   choices [7.04, 3.05, 1.81, 1.11]
Los Angeles*    solid 4.67  req 7.00   choices [5.89, 2.25, 1.21, 0.65]
Berkeley        solid 4.00  req 4.00   choices [4.83, 1.64, 0.83, 0.37]
Santa Cruz*     solid 3.33  req 5.00   choices [5.15, 2.22, 1.56, 1.14]
Irvine*         solid 4.00  req 6.00   choices [4.40, 2.31, 2.16, 1.61]
Riverside*      solid 3.33  req 5.00   choices [4.00, 1.25, 0.76, 0.51]
```

**Legend (above plot):** CS/Math requirement (gold), 1st choice, 2nd choice, 3rd choice,
4th choice (the four ramp blues).
**Footnotes (below):** hatch swatch → "Hatched = requirement under the quarter system
(semester-equivalent shown solid)"; then `*` → "quarter-system campus · unmarked = semester".

---

## Figure D — Coverage matrix

**Purpose.** Which (district, campus) pairs have complete articulation. Binary heatmap.

**Layout.** 9 rows (UC campuses) × 72 columns (community-college districts, indexed
0–71). Y-axis title "UC Campus" (rotated) + row labels. X-axis title "Community College
District" + column tick labels **every 5** (0,5,10,…,70). Cell row height ~20 px; cell
width fills the remaining width (~14 px). 1 px gaps between cells show a faint
`rgba(25,48,24,0.10)` gridline; a subtle 1 px inset hairline frames the matrix (no heavy border).

**Encoding.** Filled cell = **complete articulation** = `#2E5C8A`; empty cell =
**incomplete** = white. (This dark/light binary is inherently grayscale-safe.)

**Legend:** filled swatch → "Complete articulation"; white swatch (hairline border) →
"Incomplete"; then `*` → "quarter-system campus · unmarked = semester".

**Row order (top→bottom), with quarter asterisks:**
`Davis*, Merced, San Diego*, Santa Barbara*, Los Angeles*, Berkeley, Santa Cruz*, Irvine*, Riverside*`

**Data.** Each row is a 72-character bit-string (`1` = complete, `0` = incomplete),
columns 0→71 left→right. Also in `matrix-data.json`.

> ⚠️ **Data provenance:** these bits were **pixel-extracted from a screenshot** of the
> original figure (the exact CSV was not available in this session). The extraction
> totals **436** complete cells; the source UI reported **437** (paper baseline) /
> **440** (hand-curated). That is a ~1–4 cell discrepancy at anti-aliased edges.
> **Replace this array with the exact source CSV before publication.**
```
Davis*          010011100101000010100000001110010001011011100011010011100001010101100010
Merced          111111111111111011111111011111111111111011110111111111111011111111100011
San Diego*      011011100111001010110100001100010011011011110000110011111001000111100010
Santa Barbara*  100111110101111011111000011110010011011011110011111101111111001101110110
Los Angeles*    000011111101001010111010011110011111111011110111111101111001010111100010
Berkeley        111111111111111011111111011111111111111011111111111111111111111111111111
Santa Cruz*     110111100101011011011010001110011001011011100011011111111001011111100011
Irvine*         011011100111101010110000011110011001010011110011110101101000000111100010
Riverside*      101111101101111011110011011111111111011011110111111111111111101101010011
```

---

## Files in this bundle
- `Articulation Gaps Figure.dc.html` — Figure A source (HTML reference).
- `Coverage Distribution Figure.dc.html` — Figure B source.
- `Credit Loss Figure.dc.html` — Figure C source.
- `Coverage Matrix Figure.dc.html` — Figure D source.
- `matrix-data.json` — Figure D matrix as JSON (`rowNames`, `matrix` 9×72 of 0/1, `total`).
- `support.js` — the runtime the HTML references (included for completeness; not needed
  to re-implement in a plotting library).

Each `.dc.html` holds its data + exact inline styles in readable form: the markup is the
template, and a `<script type="text/x-dc">` block at the bottom contains a
`class Component` whose `renderVals()` returns the data and computed geometry. Read those
to confirm any detail. (The HTML will not render standalone without the study's
design-system stylesheet, which is intentionally not bundled — use this README + the
source + screenshots as the reference.)

## Implementation notes
- Output **vector** (PDF/SVG) at the intended column/page width; keep text ≥ ~7 pt at
  final size (all four are 1240 px wide by design so they scale together).
- Figures A, C, D span the full text width (they’re wide); B can be single-column.
- Reproduce the **exact hex colors and the Okabe–Ito course palette**; do not
  substitute a plotting library’s defaults.
- Preserve the asterisk (quarter/semester) convention and the hatch semantics.
