# California Figure 4 — articulation coverage map

> Current paper-matched data · 9 UC campuses × 72 community college districts · July 21, 2026

## Result

The current-data map has **the same marker class as the paper for all 72
districts**. A paper/current switch would therefore draw the same map twice.

The underlying exact counts are not perfectly identical: 69 of 72 match.
Three districts gained one fully articulated campus in the newer ASSIST data,
but each stayed in its original 0–3, 4–6, or 7–9 class.

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
vector California outline instead of a network map tile.

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
and a keyed legend inside the map's open upper-right area. Marker focus and
hover reveal the district's exact count and its real covered-campus list; that
HTML tooltip sits outside the export root and is omitted from PNG/PDF output.
The visual design originated in `docs/export 2`, while all counts, names, and
centroids continue to come from the audited model and recovered paper data.

## Reproduce locally

From `analysis/`:

```bash
.venv/bin/python -m visuals.paper_articulation_map \
  --output-dir results/previews
```

The shared geometry lives in
`analysis/data/paper_articulation_map.json`. The state outline is a simplified
2025 U.S. Census Bureau cartographic boundary; it is presentation context only
and does not participate in any coverage calculation.
