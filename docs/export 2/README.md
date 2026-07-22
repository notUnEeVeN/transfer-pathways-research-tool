# California articulation coverage map — 1b

Statewide, vector-only figure. Warm off-white land, fine gray-green outline,
traffic-light glyphs, legend keyed inside the map's empty upper-right corner.

## Files

- **`ArticulationCoverageMap.jsx`** — the component. Self-contained React
  (hooks only, inline styles). Drop it into `frontend/src/analyses/` (or
  wherever your original lives) and import it.
- **`mapData.js`** — California outline ring, the 9 UC campuses, and the 72
  districts. Sits next to the component (`import … from './mapData'`).

## Use

```jsx
import ArticulationCoverageMap from './ArticulationCoverageMap';

<ArticulationCoverageMap />
```

Props (all optional): `title`, `caption`, `bandLabels`, `showCoveredCampuses`,
`exportFileName`.

## What's preserved

- Encoding: **red square 0–3 · yellow circle 4–6 · green diamond 7–9**.
- All 72 district markers; accessible names, keyboard focus (`tabIndex`),
  `role="img"`.
- Native / export-safe inline SVG with `data-export-root`, `data-export-width`,
  and `data-district-marker` / `data-bucket` on every marker.
- Hover / keyboard-focus tooltip (district, exact N of 9, band label, covered
  campuses) rendered as an HTML overlay **outside** the export root, so it
  never lands in PNG/PDF output.
- `exportPng()` (toolbar button) serializes the SVG to a 2× PNG. For PDF, print
  the same self-contained `<svg>`.

## What you must wire up

1. **Coverage counts are illustrative sample data.** Replace each district's
   `count` in `mapData.js` with the real value from your coverage calculation.
   Keep the bucket thresholds (≤3 / ≤6 / else) — they live only in `bucketOf`.
2. **Covered-campus list** in the tooltip is derived as the `count` nearest UC
   campuses (a stand-in). If you have the real per-district covered set, pass or
   store it and use that instead.
3. **Styling** uses literal hex values at the top of the component; swap them
   for your internal-tool design tokens if you have equivalents.
4. **Coordinates/names** are real; the calculation, API query, and thresholds
   are intentionally not included here — reuse your existing ones.

## Tests

Keep your existing tests. Suggested additions for the new behavior:

- renders exactly 72 `[data-district-marker]` nodes;
- each marker's `data-bucket` matches its count band (0–3 → `low`, 4–6 → `mid`,
  7–9 → `high`);
- every marker has an `aria-label` and is focusable (`tabIndex="0"`);
- the `<svg data-export-root>` exists with `data-export-width`;
- the tooltip is **not** inside `[data-export-root]`.
