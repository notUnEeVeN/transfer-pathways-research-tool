# Transfer access and local income

> Original figure · 72 community college districts · income taxable year 2022 ·
> July 22, 2026

## The short version

Districts serving richer areas can reach more UC computer science programs. The
poorest quarter of districts fully articulates **3.7 of 9** campuses on average;
the richest quarter reaches **8.2**. Every district with zero access sits in the
bottom half.

| Income quartile | Mean income per return | Mean campuses reached | Districts with zero |
| --- | ---: | ---: | ---: |
| Q1 | $56,385 | 3.7 | 2 |
| Q2 | $70,840 | 5.6 | 1 |
| Q3 | $99,783 | 6.9 | 0 |
| Q4 | $181,811 | 8.2 | 0 |

The map already suggests this, so the figure's job is the part the map cannot
do: **rule out the obvious explanations.** Small districts have fewer staff to
maintain agreements, and remote districts are far from any UC. Both are real —
population correlates +0.70 with access, distance −0.70 — and both correlate
with income. Measured together:

| Predictor | Standardized effect |
| --- | ---: |
| Income of the service area | **+0.37** |
| Population | +0.40 |
| Distance to the nearest campus | −0.26 |

R² = 0.69. Income is not a stand-in for rurality: hold size and distance
constant and it still carries about as much weight as population does. That is
the finding worth reporting — two districts of the same size, the same distance
from a UC, differ in transfer access by the income of the people they serve.

## The same result under ASSIST

The figure has a **Transfer requirements** control, matching the coverage map's:
*Hand-curated* is the paper's per-campus minimums, *ASSIST* is what ASSIST
itself marks as required for the working major selection. ASSIST states a
broader requirement set, so fewer district–campus pairs come out complete — 356
against 440, and no district reaches more than seven of nine.

The gradient is unchanged by the switch:

| Income quartile | Hand-curated | ASSIST |
| --- | ---: | ---: |
| Q1 | 3.7 | 3.2 |
| Q2 | 5.6 | 4.7 |
| Q3 | 6.9 | 5.3 |
| Q4 | 8.2 | 6.5 |

| Predictor | Hand-curated | ASSIST |
| --- | ---: | ---: |
| Income | +0.37 | +0.34 |
| Population | +0.40 | +0.39 |
| Distance | −0.26 | −0.25 |
| R² | 0.69 | 0.62 |

That is worth stating in any write-up: the income gradient is a property of the
articulation landscape, not of one team's reading of what a campus requires.
Both views keep the 0–9 axis, so switching moves the cloud down rather than
rescaling it.

## What the figure shows

Two stacked panels, built to the design in
`docs/design_handoff_income_figures/` — a 960 px canvas, shared type ramp,
gridlines and palette, so they read as one exhibit in a manuscript column.

**Top — the distribution.** One point per district: income of the area it
serves (log scale) against the number of UC computer science programs it can
fully reach. Uniform 11 px circles in the colourblind-safe Okabe-Ito tier
colours — orange for 0–3 campuses, amber for 4–6, green for 7–9. Counts are
integers, so points are
jittered vertically by a deterministic ±0.28 to separate the rows; the zero row
only moves up and the nine row only down, so neither clamps against an axis.
The navy line joins the mean of each income quartile, plotted at that
quartile's median income.

**Bottom — the summary.** The same four quartile means as horizontal bars on a
0–9 track, filled light-to-dark as income rises, each row labelled with its
quartile and that quartile's median income. This is the version to cite
when one number per quartile is all a reader needs.

Neither panel carries a subtitle: the sample size, the requirement set and the
effect statement all live in the footnote, where they do not compete with the
title. Both recompute from whichever requirement set the control selects.

## Measures

**Access** is the Figure 4 measure — the count of UC campuses for which the
district articulates every required course, pooled across the district's
colleges — under whichever requirement set the control selects: the paper's
hand-curated minimums (pinned to the scraped programs) or ASSIST's own required
receivers.

**Income** is the Franchise Tax Board catchment mean:
`analysis/data/district_income.v1.json`, built by
`analysis/build_district_income.py`. Every ZIP code in FTB's ZIP table is
assigned to the district whose centroid is nearest, and a district's income is
the returns-weighted mean adjusted gross income over its ZIPs. That is a
Voronoi catchment — parameter-free, exhaustive, and at district scale.

**Population** is the number of returns filed in that catchment.

**Distance** is from the district centroid to the nearest of the nine UC
campuses, great-circle, in kilometres.

## Reproduce the statistics

From `analysis/`:

```bash
python build_district_income.py                        # rebuild the income extract
.venv/bin/python income_access_stats.py                # hand-curated minimums
.venv/bin/python income_access_stats.py --requirements assist
```

The figure recomputes the same quantities in the browser from the same
committed extract, so the two must agree; that script is the check.

## Robustness

Swapping the catchment measure for the already-committed **county roll-up**
(`--county-income`) keeps the direction and the ordering but changes the
weights: income +0.27, population +0.16, distance −0.51, R² 0.56. A county is
too coarse to separate a district from its neighbours, so distance absorbs more
of the signal. The two income measures rank districts similarly (Spearman
0.76). Report the catchment result, and say which one it is.

Ten ZIP rows in the FTB file are data faults — one filer's enormous loss or
gain swamping a small ZIP — and are excluded by a documented rule, listed in
the extract. Left in, 2023 Coalinga alone would have dragged West Hills' mean
to $20,740.

## What this is not

- **Not causal.** Nothing here says poverty causes missing articulations. The
  plausible mechanisms run both ways and through third factors: staff capacity,
  political attention, historical UC siting, the tax base itself.
- **Not about students.** This is an ecological association across 72
  districts. It describes areas, never an individual, and inferring anything
  about a particular student from it is the ecological fallacy.
- **Not median household income.** Mean adjusted gross income per tax return is
  pulled up by high earners and counts filers only. The direction of the bias —
  overstating income where few file — works against the finding rather than for
  it.
- **Not statutory geography.** The catchment is drawn around district centroids,
  so districts near each other trade some income at their boundary.
