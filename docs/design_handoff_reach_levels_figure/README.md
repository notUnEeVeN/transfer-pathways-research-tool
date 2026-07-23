# Handoff: UC Reach-Levels Small-Multiples Figure

## Overview
A self-contained static research figure for a peer-reviewed computing-education paper (and the project's Visuals page). It answers one question: **for each of 72 California community-college districts, how many of nine pinned UC CS/EECS programs can the district's colleges collectively prepare a student for, and what course + time burden does keeping every reachable option open imply?**

Districts are grouped into ten mutually-exclusive reach levels (0–9). The figure is a horizontal small-multiples table: one row per reach level, three aligned quantitative columns (district count, combined course burden, average terms), followed by a "why the ceiling is seven" explainer, a methods note, and a source caption.

**The central task is effortless comparison across reach levels 0–9.** No single hero statistic; no dashboard/KPI cards; no interaction required.

## About the Design Files
The file in this bundle — `Reach Levels Figure.dc.html` — is a **design reference created in HTML**, a prototype showing the intended look and structure. It is authored as a "Design Component" (a streaming HTML format with a small `renderVals()` logic class), which is **not** production code to copy directly.

The task is to **recreate this figure in the target codebase's existing environment** (the research site appears to be React — the original production component was `frontend/src/analyses/MultiCampusPathways.jsx`) using its established patterns, and to feed it from the frozen result artifact (`frontend/src/analyses/data/district-multi-campus-pathways.v1.json`) rather than the hard-coded numbers below. If no environment exists yet, pick the most appropriate framework and implement there. The hard-coded values in the prototype are transcribed from the research results and are listed in full under **Data** so you can verify your wiring.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, layout, and encodings are specified exactly. Recreate pixel-faithfully using the codebase's existing primitives, then bind the data. The design follows the **Plan My Transfer** design system (forest-green ink `#193018`, lime accent `#96F060`, mint/sage neutrals, Hanken Grotesk type, 24px card radius, single diffuse shadow, 1px forest hairline borders).

## Canvas & export constraints
- **Export width: 1120px** fixed (the `<figure>` is `width:1120px`, centered, `margin:24px auto`). May be reduced for a two-column paper layout, so it must stay legible when scaled down.
- Must communicate correctly **without interaction**, export cleanly as a static figure, **work in grayscale/print**, and use **color-accessible** distinctions (color is never the sole channel — position + direct labels + shape always carry the meaning).
- No gradients, glass, 3D, decorative icons, or ornamental illustration. No horizontal overflow. No essential info behind hover/tabs/toggles.
- Restrained, consistent numeric precision: **means to one decimal** (e.g. `20.2`), **average terms to one decimal** (e.g. `5.8`), **counts as integers**.

---

## Layout

Top-level `<figure>`: white card (`background: #FFFFFF` via `--surface-card`), `border-radius: 24px`, shadow `0 4px 40px rgba(25,48,24,.03)` plus a `inset 0 0 0 1px rgba(25,48,24,.10)` hairline, `padding: 40px 44px 30px`. Sits on the mint app canvas (`--color-bg`, `#F9FFF6`).

Vertical order inside the figure:
1. **Header block** (eyebrow → H1 title → subtitle paragraph), `max-width: 880px`.
2. **Lead / takeaway paragraph** (17px), `max-width: 900px`, `margin: 18px 0 26px`.
3. **The chart** (panel-title row → axis-tick row → 10 data rows).
4. **Ceiling explainer** panel (two columns) — toggleable via `showCeiling`.
5. **Methods note** — the design system's `InfoNote` (neutral tone).
6. **Source caption** — top-hairline divider + 11px muted text.

### The chart — a 4-column aligned grid
Every chart row is a horizontal flexbox: `display:flex; gap:24px; align-items:center; padding:5px 10px`. The panel-title row and the axis-tick row use the **same column widths and same gap** so everything aligns vertically. Column widths (flex:none):

| Col | Width | Content |
|-----|-------|---------|
| 1 — Programs reached | **96px** | Big reach number (24px/700) + optional lime "Max" pill |
| 2 — Districts | **216px** | 160px bar track + 44px count label |
| 3 — Combined course burden | **526px** | 432px plot track + 80px mean label |
| 4 — Avg. terms | **110px** | Semester-equivalent number |

- Data rows are separated by a 1px hairline (`rgba(25,48,24,.06)` bottom border); the block has a slightly stronger top border (`rgba(25,48,24,.10)`, i.e. `--pmt-forest-a10`). Row `min-height: 50px`.
- **Panel-title row**: each column has a 13px/700 title + 11px muted sub-caption. Column 2 sub = "of 72"; col 1 sub = "of 9"; col 3 sub = "distinct courses in the modeled joint plan · mean labeled, bar shows the group's range"; col 4 title "Avg. terms", sub "semester-equiv.".
- **Axis-tick row**: sits between titles and data. Column 2 track shows ticks 0/5/10/15/20 across 160px. Column 3 track shows 10/15/20/25 across 432px. Columns 1 and 4 have no ticks.

### Column 1 — Programs reached
Reach digit `font-size:24px; font-weight:700; letter-spacing:-0.03em`. On the highlighted max row (reach 7), append a pill: text "Max", 8.5px/700, uppercase, `letter-spacing:.05em`, `color:#193018`, `background: #96F060` (lime), `padding:2px 6px`, `border-radius:100px`.

### Column 2 — Districts (horizontal bar)
- Track: `width:160px; height:22px`, faint vertical gridlines every 40px via `repeating-linear-gradient(90deg, rgba(25,48,24,.08) 0 1px, transparent 1px 40px)`.
- Bar: forest `#193018`, `height:13px`, `border-radius:3px`, vertically centered, left-aligned. **Scale: 20 districts = 160px** → `width = districts / 20 * 160` px.
- Count label: 16px/700, `letter-spacing:-0.02em`, 44px wide, immediately right of the track.

### Column 3 — Combined course burden (range bar + mean dot)
Plot track `width:432px; height:26px`, gridlines every 120px (`repeating-linear-gradient` at `.08` alpha). **X scale is courses 10→28 mapped 0→432px, drawn as (v−10)/18×432** (so tick 10→0px, 15→120px, 20→240px, 25→360px; the 27-course max on reach 5 lands near the right edge). Three marks per row (only when the group has a plan):
- **Range whisker** (min→max): `height:4px`, `background:rgba(25,48,24,.26)`, `border-radius:2px`, vertically centered. `left = x(min)`, `width = x(max) − x(min)`.
- **IQR box** (Q1→Q3): `height:15px`, `background:rgba(25,48,24,.15)`, `border:1px solid rgba(25,48,24,.38)`, `border-radius:3px`. `left = x(Q1)`, `width = x(Q3) − x(Q1)`.
- **Mean dot**: 11×11px circle, `background:#193018`, `box-shadow:0 0 0 2px #FFFFFF` (a white ring so it reads on top of the box). `left = x(mean)`, centered.
- Range/IQR are hidden when the group is a single district (min==max, reach 1) or when `showSpread` is off — then only the mean dot shows.
- **Mean label**: 18px/700, `letter-spacing:-0.02em`, 80px wide, right of the track — the group mean to one decimal.
- Empty groups show italic muted text in the track instead of marks: reach 0 → "No joint plan modeled"; reach 8 & 9 → "No districts". (12px, italic, `color:var(--text-muted)`.)

### Column 4 — Avg. terms
Single number, 16px/700, `letter-spacing:-0.02em`, the group's mean semester-equivalents to one decimal. Empty groups render an em dash `—` in muted color.

### Ceiling explainer (toggle `showCeiling`, default on)
Sage subtle panel: `background: var(--surface-subtle)`, `border-radius: 18px` (`--radius-xl`), `padding:24px 26px`, hairline shadow. Two columns in a wrapping flex, `gap:40px`:
- **Left** (`flex:1 1 340px; max-width:440px`): eyebrow "Why the ceiling is seven", H3 (20px/700) "Two campuses have no district-wide path", a 13.5px body paragraph, then a 12.5px muted line listing the seven reachable campuses.
- **Right** (`flex:1 1 400px`): eyebrow "Districts with a complete pinned path, by program · of 72", then **9 program rows**. Each row: 46px program code (13px/700) + flexible progress track + right-aligned count. Track: `height:14px`, `background: var(--surface-track)`, `border-radius:7px`, inset hairline; fill forest `#193018`, `width = n/72 × 100%`. **UCLA and UCSD rows have n=0 (no bar) and their count label is coral `#FE4F32`** (`--pmt-coral-500`). Below the rows: a 11.5px coral line "UCLA and UCSD are reachable by no district — the reason reach stops at seven."

### Methods note
Mount the design system's `InfoNote` (neutral tone) containing a single 12.5px paragraph beginning with a bold "How to read this." — see exact copy in the design file. It covers: groups are separate cohorts (not one cohort adding programs; no causal/marginal reading); course counts are modeled feasible joint plans with shared courses counted once and prerequisites included, minimum proven for 49 of 68 plans; average terms are semester-equivalents (1 quarter = 2⁄3 semester) excluding two bounded schedules; the model is structural/optimistic and omits GE, Cal-GETC/UC-7, associate-degree & post-transfer requirements, GPA/selective admission, term offerings, seat availability, and summer terms; district paths assume cross-enrollment among member colleges.

### Source caption
Top hairline divider, 11px muted, bold "Source." lead-in: pinned ASSIST CS/EECS templates for nine UC campuses across 72 districts (115 colleges), July 2026; 335 of 648 district–campus pathways reachable; statewide mean 4.7 of 9; course-plan optimality and schedule optimality reported as separate concepts.

---

## Data
The prototype hard-codes these values; in production, read them from `district-multi-campus-pathways.v1.json`.

### Core per-reach-level rows
`course` = combined-plan course counts; `meanEq` = mean semester-equivalents. Reach 0/8/9 have no plan.

| Reach | Districts | Course mean | Q1 | Q3 | Min | Max | Avg terms | Notes |
|------:|----------:|------------:|---:|---:|----:|----:|----------:|-------|
| 0 | 4 | — | — | — | — | — | — | no joint plan modeled |
| 1 | 1 | 14.0 | 14 | 14 | 14 | 14 | 5.0 | single district (no spread) |
| 2 | 5 | 12.2 | 12 | 13 | 11 | 13 | 4.8 | |
| 3 | 8 | 14.5 | 14 | 15 | 13 | 15 | 4.9 | |
| 4 | 9 | 16.7 | 15 | 18 | 13 | 20 | 5.1 | |
| 5 | 19 | 16.5 | 15 | 17 | 13 | 27 | 4.9 | long right tail (one 27-course plan) |
| 6 | 13 | 19.6 | 16 | 23 | 14 | 24 | 5.6 | |
| **7** | **13** | **20.2** | **18** | **22** | **15** | **25** | **5.8** | **statewide maximum — highlighted row** |
| 8 | 0 | — | — | — | — | — | — | no districts (structural zero) |
| 9 | 0 | — | — | — | — | — | — | no districts (structural zero) |

- Bar scale: districts / 20 × 160px. Course x-scale: (v−10)/18 × 432px. Average-terms values are printed directly (no bar).
- **Reach 0 vs reach 8/9 are different kinds of empty.** Reach 0 = 4 real districts that can't complete even one program → "No joint plan modeled" (missing/N-A workload, *not* zero courses). Reach 8/9 = zero districts → "No districts" (a substantive zero count). Keep these labels distinct; never render a bare dash without explanation.

### Program reachability (ceiling explainer, right column) — districts of 72
UCB 64 · UCM 64 · UCR 57 · UCSB 50 · UCSC 47 · UCI 39 · UCD 14 · **UCLA 0** · **UCSD 0**. Bar = n/72. UCLA & UCSD render with coral count labels and no bar. Order shown descending by n.

### Key framing facts (used in title/lead/notes; do not invent beyond these)
- 7 of 9 is the current statewide maximum; 13 districts reach it; ~20.2 distinct courses; 5.8 semester-equivalents ≈ "roughly six semesters"; the remaining 7-program schedule is bounded at 8 semesters.
- Every 7-program district reaches the **same seven**: UCB, UCD, UCI, UCM, UCR, UCSB, UCSC.
- 8/9 groups empty because no district completes UCLA or UCSD.
- Statewide: 335/648 district–program combos reachable; mean 4.65 → shown as **4.7**; 68 nonempty joint plans; direct-course minimum proven for 49, best-feasible for 19; 66 exact fixed schedules + 2 bounded.

### Interpretive constraints (must not be violated by the visual)
1. Reach groups are **different district cohorts**, not one cohort adding programs.
2. **No causal / marginal reading.** (E.g. reach 1 = 14.0 courses while reach 2 = 12.2 reflects composition, not that adding a program lowers workload.) Do not connect the means with a trend line that implies progression.
3. Zero reachable ≠ zero preparation courses.
4. Empty 8/9 groups are substantive zeros, not missing data.
5. Course counts = required major prep + known prerequisite-only additions; shared physical courses counted once.
6. Semester-equivalents compare **academic time only**; they don't equate semester and quarter *units*. Summer excluded.
7. Exact-schedule averages exclude bounded schedules (differing denominators).
8. Course counts are modeled feasible-plan burdens, not guaranteed universal minima.
9. Course-plan optimality and schedule optimality are **separate** concepts — don't visually conflate.

---

## Interactions & Behavior
**None required — this is a static figure.** It must be fully correct as a still image and in print. The prototype exposes a few build-time/props switches (below) for layout adaptation, not user-facing controls. Do not add filters, toggles, tooltips, dropdowns, refresh, or disclosure controls.

## State Management
None. The prototype's `renderVals()` derives display values (bar widths, x-positions, labels) purely from the static data + props. In production, compute the same derived positions from the JSON artifact. Props (all optional, with defaults):

| Prop | Type | Default | Effect |
|------|------|---------|--------|
| `order` | `'0-to-9' \| '9-to-0'` | `'0-to-9'` | Row order (reverse to lead with the ceiling). |
| `showSpread` | boolean | `true` | Show range whisker + IQR box in course column (off = mean dot only). |
| `showCeiling` | boolean | `true` | Show/hide the ceiling explainer panel. |
| `highlightMax` | boolean | `true` | Mint highlight + lime "Max" pill on the reach-7 row. |

---

## Design Tokens
All from the Plan My Transfer design system (`_ds/.../tokens/*.css`). Key values used here:

**Color**
- Forest ink `#193018` (`--pmt-forest-900`, `--text-strong`) — bars, mean dots, text.
- Lime `#96F060` (`--pmt-lime-400`) — "Max" pill, max-row accent stripe.
- Coral `#FE4F32` (`--pmt-coral-500`) — UCLA/UCSD zero emphasis.
- Mint canvas `#F9FFF6` (`--color-bg`); card white (`--surface-card`); sage subtle panel (`--surface-subtle`); track fill (`--surface-track`).
- Forest alphas: `--pmt-forest-a06` `rgba(25,48,24,.06)` (row hairline), `--pmt-forest-a10` `rgba(25,48,24,.10)` (block borders). Inline `.08 / .13 / .15 / .26 / .38` forest alphas used for gridlines and box fills/strokes as noted above.
- Mint highlight fill for the max row: `--pmt-mint-100`.

**Typography** — single family, Hanken Grotesk (`--font-sans`; brand target is Haffer SQ if licensed webfonts are added).
- Eyebrows/labels: 10–11px, 700, `letter-spacing:.07–.09em`, uppercase, muted.
- H1 title: 33px, 700, `letter-spacing:-0.03em`, `line-height:1.08`, `text-wrap:balance`.
- Lead paragraph: 17px, `line-height:1.5`.
- Body/subtitle: 15px / 13.5px / 12.5px, `line-height:1.5`, `text-wrap:pretty`.
- Reach digit 24px/700; district count 16px/700; course mean 18px/700; avg terms 16px/700 — all `letter-spacing:-0.02em to -0.03em`.

**Radius** — card 24px (`--radius-2xl`), interior panel 18px (`--radius-xl`), small marks 2–3px, pills 100px.
**Shadow** — one token: `0 4px 40px rgba(25,48,24,.03)` (`--shadow-card`) + hairline `inset 0 0 0 1px rgba(25,48,24,.10)`.
**Spacing** — card padding `40px 44px 30px`; chart column gap 24px; row padding `5px 10px`; generous 24–44px section rhythm.

## Assets
None. No images or icons are used in this figure — all marks are CSS boxes/borders. (The design system's icon set and school logos are **not** used here.)

## Files
- `Reach Levels Figure.dc.html` — the high-fidelity design reference (Design Component format: `<helmet>` loads the PMT design-system tokens/bundle; the template is the markup; a `Component extends DCLogic` class computes `renderVals()`). Read the template for exact inline styles and the logic class for the scale math and data.
- Production references (in the research repo, not bundled here): current component `frontend/src/analyses/MultiCampusPathways.jsx`; data artifact `frontend/src/analyses/data/district-multi-campus-pathways.v1.json`; methodology `docs/figures/multi-campus-pathways.md`; visual-family reference `frontend/src/analyses/ArticulationCoverageMap.jsx`.
