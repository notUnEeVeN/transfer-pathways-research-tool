# California Figure 4 — articulation coverage map

> Current paper-matched data · 9 UC campuses × 72 community college districts · July 21, 2026

## Result

The hand-curated current-data map has **the same marker class as the paper for
all 72 districts**. Its 13 low-, 25 middle-, and 34 high-coverage markers are
therefore the same colors and shapes as the published map.

The underlying exact counts are not perfectly identical: 69 of 72 match.
Three districts gained one fully articulated campus in the refreshed agreement
data when judged against the paper's hand-curated minimums, but each stayed in
its original 0–3, 4–6, or 7–9 class.

| District | Paper | Current | Display class |
| --- | ---: | ---: | --- |
| Allan Hancock Joint CCD | 4 | 5 | 4–6 |
| Santa Barbara CCD | 8 | 9 | 7–9 |
| West Valley-Mission CCD | 8 | 9 | 7–9 |

The current class totals are therefore also unchanged: **13** districts in
0–3, **25** in 4–6, and **34** in 7–9.

## What was recovered from the old codebase

The paper describes each point as the approximate district location, computed
by averaging the locations of the colleges in that district. The legacy
repository retains that pipeline:

- `question_2-3/geomap/map_to_district.py` parses the college coordinate
  shapes, finds each college center, and averages those centers by district.
- `question_2-3/geomap/District_map.geojson` is the resulting 72-point output.
- `question_2-3/geomap/CC_to_Coordinates_Mapping.csv` is its coordinate input.

The repository does not contain the final styled map renderer. The paper image
appears to have been assembled in a separate mapping tool. This port keeps the
recovered district centroids and marker classes, then uses an export-safe
vector California outline instead of a network map tile. All 72 ported
centroids match `District_map.geojson`; the only coordinate difference is JSON
rounding (less than 5e-8 degrees).

The frontend also includes the actual published Figure 4 raster extracted from
page 5 of `SIGCSE_TS_2027_California_Transfer_Pathways.pdf`, rather than an
approximation. The **Original figure**, **Hand-curated**, and **ASSIST** version
control keeps that reference next to both interactive recomputations.

## Current-data calculation

For each district, the tool queries the same paper-matched coverage model used
by the district heatmap. It counts the distinct UC campuses whose cell is fully
articulated, then assigns the paper's three display classes:

- 0–3 campuses: red square
- 4–6 campuses: yellow circle
- 7–9 campuses: green diamond

The map is thus a geographic summary of the 9 × 72 heatmap, not a second
coverage algorithm. The three exact-count gains and their course-level
receipts are documented in
[`paper-district-heatmap.md`](paper-district-heatmap.md).

The website renderer applies a compact, one-column vector treatment: a warm
off-white California silhouette, the paper's redundant color-and-shape bands,
and a keyed legend inside the map's open upper-right area. Marker focus, hover,
or tap reveals the district's exact count and covered campus codes; a 9/9
district omits the redundant list. That HTML tooltip sits outside the export
root and is omitted from PNG/PDF output. The map can be zoomed and dragged, and
an optional difference layer outlines exact-count gains and losses against the
paper even when the marker remains in the same display class.

The **ASSIST** mode uses the exact canonical CS program configured for each
campus and judges completion against the required receiver surface stated in
ASSIST. This is the same major-isolated contract used by the ASSIST version of
the district heatmap: `majorSlug=cs&requirements=assist`. The visual design originated in
`docs/export 2`, while all counts, names, and centroids continue to come from
the audited model and recovered paper data.

## District income on hover

Every marker's tooltip carries a **mean income per tax return** for the
district, alongside the counties it is computed from. It is context for the
coverage pattern — the rural, low-coverage districts are also the low-income
ones — and the base layer for later income-vs-access analysis.

**Source.** California Franchise Tax Board, table *B-7, Adjusted Gross Income
by County*, from the state open data portal (CC-BY), taxable year 2022:
<https://data.ca.gov/dataset/b-7-adjusted-gross-income-by-county>. The
committed extract is `analysis/data/ftb_county_income.v1.json`, rebuilt by
`analysis/fetch_ftb_income.py`.

**The join.** FTB publishes by county; there is no California-government
income series for community college districts. Each district's value is the
returns-weighted mean across its service-area counties, as reported by the
coverage endpoint (`community_college_counties`): total AGI over those counties
divided by total returns. Weighting by returns means a district spanning a
large county and a small one reads mostly as the large one. All 72 districts
match at least one county; 49 map to a single county, and the widest span is
six.

**What the number is not.** It is a mean, not a median, so high earners pull it
up; it counts tax filers rather than residents, which biases the poorest areas
upward; and a joint return covers two people while a single return covers one.
Most importantly a county is not a district — Allan Hancock's $100,897 is
San Luis Obispo, Santa Barbara and Ventura counties together, not the Santa
Maria valley the district actually serves.

**Where else it appears.** Data → Districts shows the same roll-up for the
selected district: the weighted figure, the per-county rows behind it when the
service area spans more than one county, and links to the FTB dataset page and
the exact file, so a reader can check the number against the published source.
Both views read one committed extract through
`frontend/src/shared/countyIncome.js`, so they cannot drift apart or sit on
different taxable years.

**Cross-check.** FTB's ZIP-code table covers the same universe one year later.
The build script compares the two and records any county differing by more than
15% in the committed JSON. Four are flagged, and one is a genuine data fault:
2023 Calaveras sums to a *negative* mean AGI in the ZIP table (two ZIPs carry
about −$2.5B between them) against +$77,240 in B-7. That is why B-7 is the
source of record here rather than an aggregation of the ZIP file.

## Reproduce locally

From `analysis/`:

```bash
python fetch_ftb_income.py          # refresh the county income extract
.venv/bin/python -m visuals.paper_articulation_map \
  --output-dir results/previews
```

The shared geometry lives in
`analysis/data/paper_articulation_map.json`. The state outline is a simplified
2025 U.S. Census Bureau cartographic boundary; it is presentation context only
and does not participate in any coverage calculation.
