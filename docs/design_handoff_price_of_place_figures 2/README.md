# Handoff: "The Price of Place" — five-figure sequence

## Overview

A sequence of five data figures making one argument: **Computer Science transfer preparation in California is income-gated in a way the rest of the university curriculum is not — and the gate operates precisely where access is contestable.**

The underlying data is a census (not a sample) of California's formal transfer rules: 120,293 ASSIST articulation agreements between all 115 community colleges (in 72 districts) and every UC campus-program (~940 majors after exclusions), parsed as structured requirement trees. A validated eligibility engine determines, for any college × program pair, whether a complete transfer path formally exists and which requirement groups block it. District wealth is California Franchise Tax Board data (mean AGI per return over district service areas, ~$50k–$434k).

**Critical framing constraint:** every figure measures *formal opportunity* — what the articulation rules permit. No figure may imply student behaviour, enrollment choice, or admission odds. This must survive into the implementation: axis titles, tooltips, and alt text all say "a complete transfer path formally exists," never "students transfer."

Two variants are delivered:

| File | Register | Use |
| --- | --- | --- |
| `The Price of Place.dc.html` | Detailed / paper-facing | Dense labelling, footnote register, annotation layer explaining encoding choices. Closest to the production research-figure system. |
| `The Price of Place v2.dc.html` | Read-at-a-glance | Same five chart types, conclusions written as headlines above each figure, minimum 15px type, no annotation scaffolding. For briefings, slides, press. |

Figures 1–4 differ between the two only in typographic register and label density. **Figure 5 panel B is identical in approach across both files** (a conditional scatter) — it was reworked from an earlier percentile-strip design and both files now carry the new version.

## About the design files

The two `.dc.html` files in this bundle are **design references created in HTML** — prototypes showing intended encoding, geometry, colour, and labelling. They are not production code to copy directly.

The task is to **recreate these figures in the target codebase's existing charting environment** using its established patterns. If the codebase already renders figures with D3, Vega-Lite, Observable Plot, Recharts, or a house SVG chart layer, use that. If no charting environment exists yet, D3 with server-or-build-time SVG generation is the closest fit — every figure here is static inline SVG with no runtime interaction beyond native `<title>` tooltips, and inline SVG exports cleanly to PNG and PDF where canvas and tile-based renderers do not.

Each file opens directly in a browser. They depend on `support.js` (bundled) which is a small runtime that renders the template and its logic class. **Do not port `support.js`** — it is authoring infrastructure, not part of the design. Read the files' SVG markup as the spec.

## Fidelity

**High-fidelity for form; illustrative for several data values.**

Geometry, colour, typography, and labelling are final and should be recreated exactly. The California outline geometry is real (a simplified state boundary polygon, projected in the logic class). District centroids are real city coordinates.

**However, some plotted values are placeholders.** These are marked in amber in the designs and listed under "Data cuts still required" below. Implementation should read every series from a data source, never hardcode the illustrative numbers — several of them will change.

---

## Figures

All figures are authored on a **1240-unit-wide SVG canvas** on pure white (`#FFFFFF`). Titles and captions live outside the SVG in surrounding cards; the SVG is self-contained enough to export as a standalone paper figure.

### Figure 1 — Nine programs, three fates

**Purpose:** the hook. A reader grasps in seconds that of nine UC Computer Science programs, two are closed to every district in California, one is open to nearly all of them, and six are decided by the wealth of the district you start in.

**Form:** horizontal slope rows (dumbbells), one per program, grouped into three labelled regime bands.

- X axis: share of a quartile's 18 districts from which a complete transfer path exists, 0–100%.
- Two markers per row: light `#A9C3DE` = poorest income quartile (Q1), dark `#1E3A5F` = richest (Q4). Connector `#6E93BF`.
- Closed programs render as a single hollow marker (`#FFFFFF` fill, `#9CA69B` 2px stroke) on the zero line — a closed program has no shape, which is the point.
- Regime bands, top to bottom: **CLOSED** (UC Los Angeles, UC San Diego), **OPEN** (UC Berkeley EECS), **DECIDED BY MONEY** (Merced, Riverside, Santa Cruz, Santa Barbara, Irvine, Davis). The third band carries a tint `rgba(46,92,138,0.045)` in the detailed version.
- Each band carries a large summary figure at the right edge: `0%`, `~90%`, `44 → 92%`.

**Verified values:** the three regime aggregates. Closed pair 0% in every quartile. Berkeley ≈89–96%. The remaining six, 44% → 92% poorest-to-richest.

**Illustrative values:** the per-program endpoints. Currently Merced 72→100, Riverside 56→100, Santa Cruz 44→94, Santa Barbara 39→94, Irvine 33→89, Davis 22→78, Berkeley 89→94. These were chosen as whole counts out of 18 districts that average to the verified regime means. **Replace with real per-program shares.**

**Ordering:** rows within the wealth band are sorted by Q1 share, descending. Preserve this — it makes the six sweeps fan out from a common right edge.

### Figure 2 — Two maps, nearly the same map

**Purpose:** the headliner. The geography of Computer Science opportunity is the geography of wealth.

**Form:** twin point maps of California, side by side, **using the same four-step ordinal ramp on both panels.**

- Panel A: 72 district centroids coloured by income quartile.
- Panel B: the same 72 centroids coloured by how many of the nine CS programs are formally reachable (bands 0–2, 3–4, 5–6, 7–9).
- Ramp (both panels): `#A9C3DE` → `#6E93BF` → `#38618C` → `#1E3A5F`.
- California outline: fill `#FBFCFA`, stroke `#9CA69B` at 1.1–1.2px, `stroke-linejoin: round`.
- Markers: r 5.4 (detailed) / 6.6 (v2), `#FFFFFF` stroke 1–1.2px so adjacent dots in the Bay Area and LA basin stay separable.

**Why points and not filled district polygons:** service areas in the rural north span whole counties and are thinly populated. A filled choropleth would give those districts visual weight proportional to land area rather than to their place in the argument, and would over-claim boundary precision. If the implementation has real district boundary geometry available, this decision should be revisited deliberately, not by default.

**Why one ramp twice:** the claim is that the two maps *coincide*. Two different palettes would force a colour-matching task the eye cannot perform. Same ramp, different variable, shape match.

**Projection:** simple equirectangular with a cosine-of-latitude correction at 37°N (`x = (lon + 130) · cos(37°)`, `y = 44 − lat`), then fit to the panel box. This is adequate at this scale and keeps outline and centroids in one coordinate system. If the codebase already has d3-geo, `d3.geoMercator().fitSize()` on real TopoJSON is a straight upgrade — but do not freehand or re-trace the coastline.

**Accompanying stat strip** (outside the SVG): 4 districts can reach none of the nine (all in Q1); 11 districts reach two or fewer; 59 of 72 districts land within one band on both maps. Plus one pending slot for the human denominator — see data cuts.

### Figure 3 — Same start, triple the response

**Purpose:** the evidence, for a skeptical reader. Model-free, quartile-level, field versus subject.

**Form:** two four-point paths over district income quartiles, with the divergence between them shaded `rgba(0,114,178,0.09–0.10)`.

- Nine UC CS programs: **35% → 52% → 59% → 72%**, in `#0072B2` at 3.4–4.5px.
- 897 other UC majors: **32% → 36% → 39% → 43%**, in `#6F7B6E` at 2.5–3px.
- Endpoints labelled large and directly (72% / 43%), with the responses called out: **+37 points** vs **+11 points**.
- X-axis quartile labels carry median district incomes: $57,507 / $70,398 / $101,822 / $159,737.

**Straight segments between quartile means, never a fitted curve.** OLS on bounded shares overshot 100% in earlier iterations. Four means joined by line segments cannot overshoot and cannot be mistaken for a model. Do not add smoothing, splines, or a trend line in implementation.

**Verified:** all four CS values; the field endpoints (32%, 43%). **Illustrative:** the field's Q2 and Q3 interior points (36%, 39%).

### Figure 4 — The gate has a course catalogue

**Purpose:** the actionable figure — what a chancellor's office or a journalist quotes. Each named course is a specific, fixable absence.

**Form:** named-course slope rows on a shared 0–100% axis. Same dumbbell vocabulary as figure 1, so the reader re-uses a learned encoding.

- X axis: share of the quartile's districts where that course is **binding-missing** — missing from a requirement group the engine reports as *unsatisfied*. Spare alternatives inside already-satisfied choice lists are not counted.
- **The axis runs "backwards" relative to intuition** (further left = fewer districts blocked), so both variants carry an explicit direction cue.
- Six Computer Science courses, currently: discrete mathematics 78→22, calculus-based physics E&M 61→17, programming II / data structures 50→11, computer organization 44→17, linear algebra 33→6, differential equations 28→6. Deltas rendered in `#0D7964` (gained semantics).
- A second panel shows the field's biggest blockers, which barely move: second-year organic chemistry 68→64, upper-division statistics 57→55, fourth-semester language 49→45, music theory IV 44→42. These render as near-coincident dot pairs, not bars, with connectors in a muted `#C6CEC5`.

**The two-panel contrast is the mechanism:** CS's blockers are ordinary lower-division courses that richer districts' colleges teach — long bars that collapse. Much of the field's residual gap is wealth-proof — courses the community college sector teaches nowhere, so money cannot buy them. "Fixable / not fixable" is the actionable half of the finding, and it only exists when both panels sit together.

**Illustrative:** all course names and shares. The exact ranked list is computable from the engine — see data cuts.

### Figure 5 — Two objections, answered before they're raised

Careful readers raise exactly two objections. This figure answers both, and should read as the authors auditing themselves.

#### Panel A — "Don't big majors just have more courses?"

**Detailed version:** two small multiples on a shared vertical scale — raw missing-course counts (flat, high, no story) and binding counts (CS collapses) — joined by a **zoom frustum** `rgba(25,48,24,0.05)` that maps the raw panel's 0–4 band exactly onto the binding panel's full 0–4 range. The frustum is the honesty device: it shows the reader precisely which slice is magnified, so the rescale cannot read as a cherry-pick. If implemented, the frustum's vertices **must** map 0–4 to 0–4 — an overshoot silently claims the magnified window is larger than it is.

**v2 version:** four stacked horizontal bars on one 0–10 axis. Each bar is every course a district is missing, split into two segments anchored at zero: `#0072B2` (CS) / `#6F7B6E` (field) = blocks the path; `#E7EBE4` with `#C6CEC5` stroke = missing but harmless, the requirement is satisfied another way.

The stacked form is the stronger of the two and should be preferred if only one is implemented: the total bar length *is* the "more courses" objection, and it visibly barely moves (8.9→7.4 for CS; 9.6→8.6 for the field). Only the blue shrinks. The objection answers itself.

- **Verified:** binding endpoints. CS 3.15 → 0.96 (−70%). Field 3.46 → 2.39 (−31%).
- **Illustrative:** the raw totals, the harmless/blocking split, and the Q2/Q3 interiors.

#### Panel B — "Isn't a strong income response normal for a large major?"

**Form: a conditional scatter over the whole comparison population.** This replaced an earlier percentile-strip design; the strip asked the reader to trust a summary statistic without ever showing the population it summarised.

- X: baseline gap — binding courses missing in the poorest quartile, 0–8.
- Y: share of that same gap recovered in the richest quartile, 0–100%.
- One grey dot (`rgba(25,48,24,0.22)`, r 2.5–2.8) per non-computing major.
- Two reference lines, **both binned, neither fitted**: binned median in `#193018` at 2.2–2.5px ("the typical major at that gap size") and binned 95th percentile in `#CB1D51` dashed ("above this line a major would be an outlier"). Six bins across the gap range.
- The six CS programs with a measurable response plotted in `#0072B2` at r 6.5–9 with white stroke, each labelled with its campus.

The claim becomes visible rather than asserted: all six sit **above** the median line and **below** the 95th. Above par everywhere, extreme nowhere.

- **Structural zeros get their own labelled band below the plot**, not a silent drop and not a false zero: Berkeley EECS has almost no baseline gap to recover, and UCLA and San Diego never recover theirs. 118 of the 897 majors share that structure. Per-program effect distributions spike at zero for exactly this reason — which is why this is a scatter with an explicit band and not a histogram. Histograms died on this in earlier iterations.
- **Verified:** conditioned on gap size, CS's recovery is above the field median at 8 of 9 programs, 65th–93rd percentile — never an extreme outlier.
- **Illustrative:** the entire cloud and all six CS positions. The cloud is currently generated by a seeded LCG in the logic class, shaped to sit consistently with the verified endpoints. **This must be replaced with real per-major values; do not port the generator.**

---

## Honesty constraints (carry these into implementation)

These were learned the hard way across many discarded iterations. They are constraints on truthfulness, not on form — a reimplementation is free to change the encoding but not to violate these.

1. **Levels swamp slopes.** Programs differ enormously in baseline gap size; raw-level encodings bury the income response. The claim lives in *responses*, so every figure encodes a change, not a level.
2. **Zero-inflation is structure, not noise.** Closed-everywhere and open-everywhere programs have no income response that *could* exist. Never bin them with programs that do, never plot them at a false zero, never let them inflate a distribution. Give them a labelled band.
3. **Aggregation flatters; conditioning deflates.** CS's aggregate recovery (79% vs 50%) overstates the case. Conditioned on gap size it is "consistently above, never extreme." Figure 5B shows the conditioned truth, and that restraint is the figure's credibility.
4. **Fitted lines lie at boundaries.** OLS on bounded shares overshot 100%. Binned and quartile statistics are the honest replacements. No trend lines, no smoothing, no confidence ribbons on bounded shares.
5. **72 districts is the true sample size.** 940 programs share the same 72 income observations. Nothing may visually imply 940 independent tests — this is why figure 5B's cloud carries an explicit note, and why no figure draws per-program error bars.
6. **Scope definitions are exact.** Field = 897 non-computing majors. Subject = exactly the nine registry Computer Science programs. ~34 computing-adjacent programs (computer engineering, informatics and similar) are excluded from *both*. A figure that quietly changes a denominator breaks the argument.

---

## Interactions & behaviour

These are static paper figures. There is no application state.

- **Tooltips:** every mark carries a native SVG `<title>` with its full value in prose ("UC Merced: 72% of poorest-quartile districts"). Preserve this — it is the accessibility floor.
- **No value may be reachable only by hover.** Every number the argument depends on is printed as text in the figure. Figures with important per-cell values additionally get a table view in the production system.
- **Interactive controls live outside the exported figure.** Version togglers, data-source pickers, and refresh controls belong in surrounding chrome; the exported artifact must read as a self-contained paper figure.
- **Context statistics live in strips outside the SVG** (see figure 2's stat strip).
- **Responsive:** each SVG is `width="100%"` with a fixed `viewBox`, so it scales without reflow. Below roughly 900px CSS width the 1240-unit figures become hard to read; the production system should either scroll horizontally or serve a reflowed variant rather than shrink further.
- **Print:** no drop shadows, no gradients as decoration, minimal gridlines — everything here is print-safe as-is.

## Two tweakable props (detailed version only)

The detailed file exposes two booleans:

- `annotations` (default `true`) — the grey dashed encoding-rationale layer. **This is proposal scaffolding, not house style.** It exists to explain design decisions to reviewers and should be stripped for publication. Do not port it as a user-facing toggle.
- `denominator` (default `true`) — shows figure 2's human-denominator stat strip.

## Design tokens

**Type**

- Family: `'Hanken Grotesk Variable', 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif`
- Tabular numerals everywhere numbers appear: `font-variant-numeric: tabular-nums`
- In 1240-unit figure space, **detailed register**: axis ticks 12–15, axis titles 14–18 at weight 500, in-figure annotations 11–12, legend 12–14
- In 1240-unit figure space, **v2 register**: nothing below 15; row labels 19–21, headline values 26–52, legend 16
- Page-level: figure headlines 31–34px weight 600 at `-0.018em`; body 15–16px at 1.5–1.6; footnotes 12.5–13px

**Colour**

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#193018` | all text, axes |
| Ink 80 / 70 | `#334432` / `#4A5849` | body copy, secondary series |
| Muted text | `#6B776A` | captions, tick labels |
| Muted line | `#9CA69B` | hollow-marker strokes, annotation leaders |
| Gridline | `rgba(25,48,24,0.10)` | minor gridlines |
| Axis rule | `rgba(25,48,24,0.28)` | baseline |
| Figure blue | `#2E5C8A` | links |
| Navy | `#24466F` | link hover |
| CS blue | `#0072B2` | **the subject's established colour — reserved for Computer Science, nothing else** |
| Field grey-green | `#6F7B6E` | the 897-major comparison series |
| Gained | `#0D7964` | improvement deltas |
| Lost / outlier | `#CB1D51` | the 95th-percentile reference, outlier zones |
| Ordinal ramp | `#1E3A5F` `#38618C` `#6E93BF` `#A9C3DE` | **quartiles are ordinal — this single-hue ramp carries almost every figure** |
| Harmless fill | `#E7EBE4` stroke `#C6CEC5` | non-blocking segment, figure 5A |
| Pending amber | text `#8A5A00`, border `#E69F00`, fill `rgba(230,159,0,0.07)` | data-cut flags — remove once the cut lands |
| Figure background | `#FFFFFF` | always pure white |
| Page background | `#F5F8F3` | surrounding chrome only |

The Wong colourblind-safe categorical palette (`#0072B2` `#E69F00` `#009E73` `#CC79A7` `#56B4E9` `#D55E00`) is the house categorical set but is **barely used here** — because quartiles are ordinal, so the navy ramp is correct, with the CS blue reserved for the subject series. This is a deliberate departure from sibling figures in the same system.

**Geometry**

- Figure card: `1px solid rgba(25,48,24,0.11)`, radius 14px, padding 36–44px
- Inner figure frame: `1px solid rgba(25,48,24,0.10)`, radius 10px
- Legend swatches: rects 14–22px, `rx 2–3`; drawn on a translucent white panel when over data
- Dumbbell markers: r 7 (detailed) / 9–10 (v2); connectors 5px (detailed) / 8–9px (v2), round caps
- Never: drop shadows, decorative gradients, more than 1–2 background colours

**Conventions**

- Footnote register for caveats, prefixed `*`. House string for quarter-system campuses: `* quarter-system campus · unmarked = semester`
- A small `Major · <subject>` or scope label in the figure's top-right corner marks data scope
- Captions do narrative work; figures stay restrained

## Data cuts still required

Implementation should treat these as required inputs, not optional:

| Figure | Cut needed |
| --- | --- |
| 1 | Per-program complete-path share by income quartile, all nine programs. Only the three regime aggregates are verified today. |
| 2 | Public enrollment headcount joined to district, for the human denominator ("N students live in districts where no CS path exists"). Also the real district centroid file, to replace city-coordinate stand-ins. |
| 3 | Q2 and Q3 means for the 897-major field series. Endpoints are verified; the interior is not. |
| 4 | The ranked binding-course list split Q1 vs Q4, computed separately for CS and for the field — plus a flag for which courses no college in the sector teaches at all. This is the load-bearing cut; figure 4 is only illustrative until it lands. |
| 5A | Raw and binding missing-course means by quartile, for CS and field. |
| 5B | A baseline-gap and recovery pair for every major. This is what the scatter is actually built from; the current cloud is synthetic. |

## Assets

No images, icons, or external assets. Everything is inline SVG.

Two external dependencies:

- **Hanken Grotesk** from Google Fonts (`https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,300..800;1,400&display=swap`). If the target codebase already self-hosts this family, use that instead.
- **California outline geometry** — a simplified 33-point state boundary polygon, coordinates inline in each file's logic class. Real geometry, not traced. Public-domain boundary data.

## Files

| File | Contents |
| --- | --- |
| `The Price of Place.dc.html` | Detailed / paper-facing variant, all five figures |
| `The Price of Place v2.dc.html` | Read-at-a-glance variant, all five figures |
| `support.js` | Authoring runtime. Required to open the two files in a browser. **Not part of the design — do not port.** |

Read the SVG markup inside each file as the specification. Every coordinate, colour, and font size in this README is present there literally.
