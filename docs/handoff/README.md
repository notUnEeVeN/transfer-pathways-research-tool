# Transfer Pathways Console — Implementation Handoff Package

Everything a Claude Code instance needs to re-skin the working website. Read in this order:

1. **`REVAMP-HANDOFF.md`** — the design decisions: identity (no "Plan My Transfer" naming), palette rationale, per-surface deltas, definition of done. The master spec.
2. **`tokens.css`** — drop-in replacement for `frontend/src/styles/tokens.css` (Tailwind v4 `@theme` / `@utility` syntax, light + dark, crisp colorway default). Adjust only the `@font-face` src paths.
3. **`Logo.jsx`** — drop-in replacement for `frontend/src/components/ui/display/Logo.jsx` (new mark, `currentColor`, collision-safe ids). `logo.svg` is the same mark as a standalone asset.
4. **`mockups/`** — the two approved interactive prototypes. **These are the visual source of truth**; `…v2` wins any conflict with prose.
   - `Transfer Pathways Console.dc.html` — faithful port of every existing page in the new brand.
   - `Transfer Pathways Console v2.dc.html` — **approved direction**: adds the Judge redesign (row-click error marking, sticky verdict dock, C/V/E/F/N shortcuts), Agreements redesign (campus chips + command-bar search + detail stat tiles), and Tasks stage-dot cards.
   - `support.js` — runtime; open the HTML files in a browser to click through every screen, modal, and state.

## How to read the mockups as spec

- The files are plain HTML: a template inside `<x-dc>…</x-dc>` and a logic class in the `<script data-dc-script>` tag.
- **Every style is inline** — exact px values, radii, weights, and colors are right on each element. Colors appear as `var(--cw-*, #fallback)`; the `#fallback` is the *meadow* colorway, while the shipped default (**crisp**) values live in the logic class `CWMAP` and in `tokens.css`. When implementing, use the token names from `tokens.css`, not raw hexes.
- Interaction behavior (verdict dock, error marking, ticks, filters, modals, keyboard handling) is in the logic class — small, readable React-style methods (`setVerdict`, `nextDoc`, `openWf`, `extraVals`).
- The Tweaks metadata (`data-props`) documents the deliberate variants: `colorway` (meadow / paper / crisp — **crisp is the chosen default**), `topbar` (forest / ivory — **forest chosen**), `conservative` (lavender / amber — **lavender chosen**), `routeHints`.

## Implementation order (matches the brief's "change the system, not the pages")

1. `tokens.css` — palette, type utilities, surfaces, radii (both themes).
2. `Logo.jsx` + purge all "Plan My Transfer" strings; wordmark becomes `transfer` / `pathways`.
3. Global chrome (`App.jsx` Console): forest top bar, nav tabs, sub-nav + RouteHint chip.
4. Shared primitives (`components/ui/*`): Button (pill, variants incl. lime iconCircle CTA), Tabs, Badge, StatStrip, Alert, EmptyState, rail items, tables, CoverageBar, forms.
5. The v2 surface deltas: Sign-in hero, Agreements, Judge, Tasks cards.
6. Verify per the checklist in `REVAMP-HANDOFF.md` §6 (+ `npm test -- --run`, `npm run build`).

## Out of scope (unchanged, per the original brief)

Chart/figure internals (Visuals + `analyses/*`), `RequirementsLedger` internals (`.uui-scope`), `console-terminal` dark pane, `.exporting` export logic, all API behavior.
