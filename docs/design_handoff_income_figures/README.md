# Handoff: Income → CS-program-reach figures

## Overview
Two **congruent** figures for the research paper, both showing the same finding —
**districts in higher-income areas reach more UC computer-science programs** — from two
angles:
- **Figure 1 — Income gradient** (horizontal quartile bars): the clean summary.
- **Figure 2 — Income scatter** (district-by-district, log income): the raw distribution
  with an income-quartile-mean trend on top.

They are designed as a pair: same typeface, palette, gridlines, and 960 px width, so they
sit together in the manuscript.

## About the design files
The `*.dc.html` files are **design references created in HTML** — prototypes of the
intended look, not production code. They render via a small runtime (`support.js`) plus a
design-system stylesheet that is **not** bundled here, so treat them as the **source of
truth for styling + geometry** (read the markup and the `renderVals()` logic block), or
view the screenshots. **The task:** rebuild both in the paper's figure toolchain (most
likely **Python/matplotlib**, **R/ggplot2**, or **D3/SVG**) and export **vector PDF/SVG**.

## Fidelity
**High-fidelity** for colors, type, spacing, axes, legend, and the trend overlay.
**One data caveat:** the scatter's 72 district points were **reconstructed by pixel-
extraction from the earlier published figure** (67 of 72 recovered). The **trend line and
all quartile numbers are exact** (from the study's reported values); only the individual
dots are approximate. **Replace the dots with the source CSV before publication.**

---

## Shared design system (use for BOTH figures)
- **Canvas:** 960 px wide, white `#FFFFFF` background, padding 26 px v / 28 px h. No card
  border/shadow.
- **Typeface:** `Hanken Grotesk` (Google Fonts) + system-sans fallback; substitute the
  paper's house font if it has one, consistently.
- **Type:** figure title 20 px / 600; subtitle + axis titles 14 px; ticks, labels,
  legend, footnote 12 px. Numeric labels use **tabular figures**.
- **Ink (all text):** near-black forest `#193018`.
- **Gridlines:** 1 px `rgba(25,48,24,0.10)`. **Baseline / zero line:** 1.5 px `#9CA69B`.
- **Hairline** (bar/track outline): 1 px `rgba(25,48,24,0.10)`.
- **Blue ramp (income, light→dark = poorer→richer):** `#A9C3DE` · `#6E93BF` · `#38618C` · `#1E3A5F`.
- **Reach-tier colors (Okabe-Ito, colorblind-safe; academic stand-ins for red/amber/green):**
  0–3 campuses `#D55E00` · 4–6 `#E69F00` · 7–9 `#009E73`.
- **Supporting stats (used in footnotes):** standardized effects on campuses reached —
  income **+0.37**, population **+0.40**, distance-to-nearest-campus **−0.26**;
  multivariate **R² 0.69** (income holds its size with population and distance held constant).

---

## Figure 1 — Income gradient (quartile bars)
**Purpose.** Mean number of UC campuses (of 9) a district's students meet CS minimum
eligibility for, by catchment-income quartile.

**Layout.** Four horizontal rows (Q1→Q4, top to bottom). Each row:
- **Left label column** (~168 px, right-aligned): quartile name (14 px/600) over median
  income (12 px, muted).
- **Bar track** (flex): a full-width track (0→9) in a light neutral fill
  (`#F6F7F6`-ish, "surface-track"), with a **filled bar** from 0 to the mean, in the blue
  ramp (Q1 lightest → Q4 darkest), 4 px corner radius, 1 px inset hairline. Faint vertical
  gridlines at x = 3, 6, 9.
- **Value column** (~46 px): the mean (14 px/600).
- X-axis 0–9, ticks 0/3/6/9, title "Campuses reachable, of nine".

**Data** (n = 18 districts per quartile, 72 total):
```
Q1 (poorest)  median $56,000   mean campuses 3.7   fill #A9C3DE
Q2            median $71,000   mean campuses 5.6   fill #6E93BF
Q3            median $100,000  mean campuses 6.9   fill #38618C
Q4 (richest)  median $182,000  mean campuses 8.2   fill #1E3A5F
```
**Footnote copy:** "top-quartile districts reach 8.2 of 9 programs on average, bottom-
quartile only 3.7. Income keeps a +0.37 SD effect with population and distance held
constant (R² 0.69) — so the gap is not only remoteness."

---

## Figure 2 — Income scatter (district-by-district)
**Purpose.** Every district plotted, with the income-quartile-mean trend, to show the raw
distribution and the upward relationship.

**Plot geometry.** Plot area 820 × 360 px.
- **X — mean income per tax return, LOG scale.** Domain ≈ \$44,000–\$440,000.
  `xPx = (log10(income) − log10(44000)) / (log10(440000) − log10(44000)) × 820`.
  Ticks at \$50k, \$75k, \$100k, \$150k, \$250k, \$400k. Title: "Mean income per tax
  return in the district's catchment (log scale)".
- **Y — campuses reachable, 0–9.** `yPx(c) = 14 + (1 − c/9) × (360 − 24)` (top-origin).
  Ticks/gridlines at 0, 3, 6, 9 (0 = the `#9CA69B` baseline). Y-title "Campuses reachable,
  of nine".
- **Points:** 11 px circles, **jittered vertically ±~0.28** to separate the discrete
  integer counts (jitter the 0-row upward only and the 9-row downward only so they don't
  clamp into hard lines). Fill = reach-tier color at ~0.72 alpha, 1 px inset stroke in a
  darker shade of the same color. **No size encoding** (the original's "returns filed" size
  was dropped for clarity).
- **Trend (exact, not reconstructed):** a navy `#1E3A5F` polyline through the four income-
  quartile means, plotted at each quartile's mean income:
  `(56000, 3.7) → (71000, 5.6) → (100000, 6.9) → (182000, 8.2)`, with white-stroked
  markers (r 6) and value labels above each (3.7 / 5.6 / 6.9 / 8.2).
- **Legend:** three tier dots (0–3 `#D55E00`, 4–6 `#E69F00`, 7–9 `#009E73`) + a navy line
  swatch "Income-quartile mean".

**Points data.** Provided in `scatter-points.json` as an array of
`{ "income": <int>, "camp": <0–9>, "color": "r|y|g" }` (67 rows; `r`=0–3, `y`=4–6,
`g`=7–9). ⚠️ reconstructed from the original figure — **swap in the exact 72-row CSV
(district, mean income, campuses reached) for publication.** Tier from campuses:
`camp ≤ 3 → #D55E00`, `4–6 → #E69F00`, `7–9 → #009E73`.

**Footnote copy:** "Each dot is a district (jittered vertically to separate the discrete
0–9 counts); colour marks how many campuses it reaches; the navy line is the mean within
each income quartile (3.7 → 5.6 → 6.9 → 8.2). Income keeps a +0.37 SD effect with
population and distance held constant (R² 0.69)."

---

## Files in this bundle
- `Income Gradient Figure.dc.html` — Figure 1 source (data + inline styles in the
  `<script type="text/x-dc">` logic block).
- `Income Scatter Figure.dc.html` — Figure 2 source (embedded points, geometry, trend).
- `scatter-points.json` — the 67 reconstructed scatter points.
- `support.js` — runtime the HTML references (not needed to re-implement in a plotting lib).

## Implementation notes
- Export **vector** at the intended column/page width; keep label text ≥ ~7 pt at final size.
- Reproduce the **exact hex values**, the log-x scaling, the jitter, and the quartile-mean
  trend. Do not fall back to plotting-library default colors.
- Keep the two figures visually matched (shared type, palette, gridlines) — they are a pair.
- For the scatter, prefer plotting the trend from the study's real quartile means (given
  above) rather than a fit to the reconstructed dots.
