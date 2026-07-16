# Prereq Graph Addendum — Swim-lane Prerequisite Visualization

Addendum to `REVAMP-HANDOFF.md`. Replaces the hand-positioned prerequisite mockup with a **deterministic swim-lane graph**: disciplines as rows, prerequisite depth as columns. Visual + behavioral source of truth: `mockups/Prereq Graph.dc.html` (demo page) and **`PrereqGraph.jsx`** (the component itself — ship this file's logic; it has no dependencies beyond React).

## 1. What it is

One React component, two modes:

- **`mode="canonical"`** — the concept model. Nodes = canonical concepts (`{slug, discipline, name, requires[], satisfies[]}`). Edges derived from `requires`; `satisfies` renders as equivalence links.
- **`mode="college"`** — one college's courses (`{key, prefix, number, title, concept}`) with explicit edges `{from, to}` (course keys). Discipline is looked up from the mapped concept via `conceptIndex`.

Props: `concepts`/`rules` (canonical), `courses`/`edges`/`conceptIndex` (college). All data-driven — no hand-tuned coordinates anywhere.

## 2. Layout algorithm (`computePrereqLayout`)

1. **Depth** = longest prerequisite path to the node (memoized DFS, cycle-guarded). Column x = `RAIL + depth * COL_W` (rail 92px, col 206px, node 168px).
2. **Lanes** = disciplines in fixed order (math, stats, physics, engr, cs, chem, bio, other); a lane renders only if populated.
3. **Chains**: within a lane, each node attaches to its deepest same-lane parent (first-come); chains claim a full row spanning their depth range, longest chain first. This is what makes the calc spine / physics sequences / CS1→3 read as straight lines.
4. **Unlinked concepts** (no edges) fill empty cells in their lane, dashed border, before growing the lane by a row.
5. Row pitch 44px / node 36px; auto-compacts (38/31) past 44 nodes.

## 3. Edge routing (`routeEdges`)

- Same-row unobstructed → straight horizontal line.
- Everything else: orthogonal elbows (7px rounded corners) routed in the **source column's gutter**. All edges leaving one node bundle into a single trunk that branches per target row.
- Parallel trunks in one gutter get separate tracks via interval coloring (≤6.5px apart).
- Blocked corridors (target row occupied mid-path) detour along the row seam above the target.
- Multi-parent targets stagger their entry points ±7px so arrowheads don't stack.
- Edge color = source discipline; `satisfies` = dashed, dot terminator (no arrow), '≡' badge on the source node.

## 4. Interaction

- **Click / Enter / Space** on a node → focus: ancestor + descendant closure stays at full opacity, rest fades to 0.16 (edges 0.06). Caption reports `N upstream · M downstream` (aria-live). Click again, click canvas, Esc, or the Clear pill exits.
- Hover highlights that node's edges. Keyboard focus ring = dashed accent; focus = solid accent ring.
- Every node/edge has a `<title>` tooltip; nodes are `role="button"` with full aria-labels.
- The existing rules table below the graph is unchanged and remains the no-interaction fallback.

## 5. Visual tokens

Node fill `surface`, border `border` (dashed `border-strong` when unlinked), text `ink`/`ink-muted`. Lane band = discipline color at 3.8% opacity + 1px `border` separator. Focus ring `accent`; focused node border `primary`. Discipline colors are CSS vars with fallbacks — override via `--dg-math`, `--dg-stats`, `--dg-physics`, `--dg-engr`, `--dg-cs`, `--dg-chem`, `--dg-bio`, `--dg-other` (defaults are mid-tone hues that survive light/dark; physics falls back to `--color-conservative`).

## 6. Integration notes

- Legend, depth header (`DEPTH →  0 1 2 …`), and focus caption are part of the component.
- Container: horizontal scroll inside a `border`/14px-radius `surface` card; height is intrinsic.
- Dark mode: tokens.css applies via `html[data-theme="dark"]` — set the attr on `<html>`, not a wrapper (the demo DC mirrors its theme prop there).
- `CANONICAL_CONCEPTS` in PrereqGraph.jsx is the current 41-concept model (incl. the combined `linear_alg_diff_eq` example); `SAMPLE_COLLEGE_COURSES`/`SAMPLE_COLLEGE_EDGES` show the college-mode shape. Replace with live data.
