# Transfer Pathways Research Console — Redesign Handoff

**For:** the coding model executing the re-skin on the real codebase.
**Read first:** `docs/brand-redesign/REDESIGN-BRIEF.md` — its Golden Rules apply verbatim (change the system, not the pages; both themes AA; charts frozen; `console-terminal`, `.uui-scope`, `.exporting` untouched).
**Visual source of truth:** two approved interactive mockups in this project — `Transfer Pathways Console.dc.html` (faithful port) and `Transfer Pathways Console v2.dc.html` (**approved direction** — includes Judge + Agreements + Tasks-card revisions). When this doc and the mockups disagree, the v2 mockup wins.

---

## 0. Identity decision (important)

The research console is **not** branded "Plan My Transfer". It uses the PMT brand deck's *visual system* (palette, type, geometry, logomark) but zero PMT naming:

- Product name everywhere: **Transfer Pathways Research** (console title: "Transfer Pathways Research Console").
- Wordmark lockup: fan logomark + two-line lowercase wordmark `transfer` (regular) / `pathways` (bold).
- Remove every "Plan My Transfer" string from UI copy. Keep functional identifiers (`PMT_TOKEN`, `pmtr_` token prefix, `pmt.get`) unless the team decides to rename the API.

---

## 1. `frontend/src/styles/tokens.css` — drop-in values

Chosen default palette = the **"crisp"** colorway (white canvas, green-tinted hairlines, darker muted inks — picked explicitly for readability). Brand hues: forest `#193018`, lime `#96F060`, coral, lavender, teal-green.

```css
/* ============ LIGHT (default) ============ */
@theme {
  /* Brand */
  --color-primary: #193018;          /* forest — fills, selected states, links-on-chips */
  --color-primary-hover: #234424;
  --color-primary-soft: #EFF8E5;     /* selected-row / icon-chip tint */
  --color-primary-ring: #96F060;     /* selection rings (verdict buttons) */
  --color-on-primary: #F0FFE7;

  /* Accent (NEW token pair — the lime CTA color) */
  --color-accent: #96F060;           /* hero CTAs, iconCircle affordance, active nav on dark bar, live-dot */
  --color-accent-hover: #89E453;
  --color-on-accent: #193018;

  /* Surfaces */
  --color-canvas: #FFFFFF;
  --color-surface: #FFFFFF;          /* cards separate via borders, not tone */
  --color-surface-muted: #F6F8F1;    /* row hover */
  --color-surface-sunken: #F1F3EB;   /* segmented tracks, unit chips, code blocks */
  --color-surface-hover: #F6F8F1;

  /* Borders */
  --color-border: #DFE3D8;
  --color-border-strong: #B9C0AC;    /* secondary-button borders, checkboxes, dashed zones */

  /* Ink */
  --color-ink: #193018;              /* forest doubles as ink */
  --color-ink-muted: #3F4840;
  --color-ink-subtle: #5F6A60;

  /* Semantic — three roles stay visually distinct (brief Rule 4) */
  --color-success: #17855A;          /* complete / eligible / done */
  --color-success-soft: #DFF4E7;
  --color-danger: #D22F14;           /* AA text/fill; brand coral #FE4F32 only for large fills/washes */
  --color-danger-bright: #FE4F32;
  --color-danger-soft: #FFE9E3;
  --color-conservative: #6C4FD0;     /* text/border form of soft lavender */
  --color-conservative-fill: #C7B5F1;/* button fill, with forest text */
  --color-conservative-soft: #F0EAFC;

  /* Geometry — softer, pill-forward */
  --radius-xs: 6px; --radius-sm: 8px; --radius-md: 10px;
  --radius-lg: 14px; --radius-xl: 18px; --radius-2xl: 22px;
  --radius-pill: 999px;

  /* Elevation — content stays flat; only overlays lift */
  --shadow-lg: 0 24px 64px rgba(25, 48, 24, .30);   /* modals */
  --shadow-md: 0 16px 48px rgba(25, 48, 24, .24);   /* floating dock */
}

/* ============ DARK ============ */
html[data-theme='dark'] {
  --color-primary: #96F060;          /* lime becomes the fill; forest text on it */
  --color-primary-hover: #A8F47C;
  --color-primary-soft: rgba(150, 240, 96, .12);
  --color-primary-ring: #96F060;
  --color-on-primary: #142811;

  --color-accent: #96F060;
  --color-accent-hover: #A8F47C;
  --color-on-accent: #142811;

  --color-canvas: #0D170C;
  --color-surface: #142312;
  --color-surface-muted: #1A2B18;
  --color-surface-sunken: #101D0F;
  --color-surface-hover: #1C2E1A;

  --color-border: #2A3D27;
  --color-border-strong: #3A5136;

  --color-ink: #EAF5E1;
  --color-ink-muted: #B7C7AD;
  --color-ink-subtle: #8CA083;

  --color-success: #4FC98F;
  --color-success-soft: rgba(79, 201, 143, .16);
  --color-danger: #FF8266;
  --color-danger-bright: #FE4F32;
  --color-danger-soft: rgba(254, 79, 50, .16);
  --color-conservative: #C7B5F1;
  --color-conservative-fill: #C7B5F1;
  --color-conservative-soft: rgba(199, 181, 241, .15);
}
```

**Alternate light colorways** (built + demoed via the mockups' "Colorway" tweak; keep as a comment block or theme variants if wanted):
- *meadow* (green-tinted): canvas `#F8FAEC`, sunken `#EFF5DE`, soft `#F0FFE7`, border `#E3E9D2`/`#C9D3B4`, ink-muted `#52664F`, ink-subtle `#7E8F76`.
- *paper* (warm neutral): canvas `#F6F5EF`, sunken `#ECEBE0`, soft `#EDEFE1`, border `#E1E0D3`/`#C2C0AC`, ink-muted `#4E554B`, ink-subtle `#747B70`.

### Typography (`@font-face` + `@utility text-*`)

- Primary face: **Haffer SQ** if the team holds a license (weights 400/500/600/700, self-hosted woff2). Otherwise **Schibsted Grotesk** (Google Fonts, closest free match — this is what the mockups use). Update `--font-sans`; keep `--font-mono` aliased to the sans.
- **Tabular figures caveat:** in Schibsted Grotesk, `font-feature-settings: "tnum"` gives commas/periods full digit width ("1 , 035"). Apply tabular-nums **only** to pure-digit table columns (units, IDs, counts) — never to stats containing `, . % /`.
- Utility values (screen sizes; deck's 80px display is marketing-only):
  - `text-display` 30px / 1.15 / 650 / −0.02em; `text-display-lg` (sign-in hero) 44px / 1.08 / 650 / −0.022em
  - `text-heading` 20px / 1.3 / 650 / −0.01em
  - `text-body` 14px / 1.5 / 400; `text-body-strong` 600
  - `text-caption` 13px / 1.45, `--color-ink-subtle`
  - `text-label` 11px / 650 / uppercase / letter-spacing .07em, `--color-ink-subtle`
  - `text-stat` 25px / 600 / −0.01em; `text-stat-lg` 29px / 650 / −0.015em
  - `text-button` 13px / 600; `text-tag` 11.5px / 600
- `::selection`: lime bg, forest text. Focus ring: 2px `--color-primary` (light) — follows the token automatically.

### Surface utilities

Stay **flat**: `surface-card` / `surface-raised` = border only (`--color-border`, radius `--radius-xl`); `surface-sunken` = `--color-surface-sunken`, radius pill for tracks; `surface-elevated` (modals/popovers/dock only) adds `--shadow-lg`/`--shadow-md`. Keep `console-terminal` dark as-is.

---

## 2. `components/ui/Logo.jsx` — the mark

Five identical petals rotated about a common center (matches the deck's construction page). Keep `currentColor` so it themes; default color = `--color-accent` on the forest bar, `--color-primary` on light.

```jsx
<svg viewBox="-176 -176 352 215" fill="currentColor" aria-label="Transfer Pathways Research">
  <path id="petal" d="M -36 -106 L -36 -171 Q -36 -173 -32 -173 A 43.6 43.6 0 0 0 32 -173 Q 36 -173 36 -171 L 36 -106 A 36 36 0 0 1 -36 -106 Z"/>
  <use href="#petal" transform="rotate(45)"/>
  <use href="#petal" transform="rotate(-45)"/>
  <use href="#petal" transform="rotate(90)"/>
  <use href="#petal" transform="rotate(-90)"/>
</svg>
```

Lockup beside it: two stacked lowercase lines, 12px/1.06 — `transfer` (400) over `pathways` (700), then a 1px divider and `RESEARCH CONSOLE` in `text-label`.

---

## 3. Global chrome (`App.jsx` → `Console`)

- Top bar: **forest `--color-primary` (light theme), 62px**, no border. Logo lime + wordmark `--color-on-primary`. Nav `Tabs` pushed right in a translucent track `rgba(240,255,231,.09)`; active tab = **lime pill with forest text**; inactive = mint at 78%. Email 12.5px mint/60 (`white-space:nowrap`), Sign out = ghost-inverse pill, border `rgba(240,255,231,.3)`.
- Sub-nav bar: 54px on canvas, hairline bottom; `Tabs` in sunken track, active = forest pill + mint text. Right slot: the **RouteHint chip** ("API route" caption + `GET /api/…` in a white bordered chip) — present on Data/Audit/API surfaces.
- App min-width 1180px; let narrow viewports scroll horizontally rather than crush.

## 4. Shared primitives

- **Button:** pill radius everywhere. `primary` forest/mint · `secondary` white + `--color-border-strong` border, hover `--color-primary-soft` · `ghost` transparent, hover soft · `danger` `--color-danger` + white · `conservative` `--color-conservative-fill` + forest text · `inverse`/`ghostInverse` for the forest bar. Keep press-nudge. **iconCircle** (hero CTA): lime pill, leading 40px forest circle containing a lime ↗.
- **Tabs:** as above; same treatment at every size (top nav, sub-nav, in-card segments, detail representation tabs).
- **Badge:** soft fills — neutral sunken/`ink-muted`, accent `primary-soft`/forest, success/danger/conservative use their `-soft` + role text. Task-type "Porting" = conservative-soft/`#6C4FD0`.
- **StatStrip:** white card, hairline `divide-x`, `text-label` over `text-stat`. Accent tiles: success or danger text only when semantic (e.g. Errors count in danger).
- **Alert / InterpretationBanner:** white card with **3px lime left accent bar** — this is the brand accent hook.
- **EmptyState:** 44px icon chip in `primary-soft` radius 14 + title + caption.
- **Rail item (InstitutionRail):** active = `primary-soft` bg + 3px **lime notch** + weight 650; hover `surface-hover`.
- **Hairline tables:** header `text-label`, rows divide `--color-border` @60%, hover `surface-hover`, `column-gap` ≥ 14px.
- **CoverageBar:** track sunken, fill `--color-success` (complete/≥90) or `--color-primary` (partial). Confirm the inline `var(--color-primary…)` styles in `DataPage.jsx` still resolve after recoloring (brief §2b).
- **Inputs:** `input-field` = white, `--color-border`, radius 10; search fields are pill-shaped with a leading icon. Switches: on = forest track, white knob.
- **Modals:** radius 22, `--shadow-lg`, backdrop `rgba(25,48,24,.45)`.

## 5. Per-surface deltas (v2 mockup = spec)

- **Sign-in:** centered hero — 88px mark, `PLAN-free` eyebrow "TRANSFER PATHWAYS · RESEARCH", `text-display-lg` title, caption, **lime iconCircle CTA** ("Sign in with Google" + account line), allowlist caption, giant 16%-opacity mark anchored bottom-left. Google button behavior unchanged.
- **Data → Agreements:** replace the 280px campus rail with **campus chips** ("Receiving campus" label + 9 pills, active = forest). Search becomes a full-width **command bar** (15px text, 1.5px strong border) with the three filter selects inline; legend right-aligned on the caption row.
- **Agreement detail:** no rail; back link + campus caption; header card = eyebrow "AGREEMENT", college → campus path, program line, Open ASSIST button, and a 4-tile hairline row: Hand-curated % · ASSIST % · Requirements count · Last verified.
- **Audit → Judge:** *the big one.*
  - Row click = **mark cell in error**: `danger-soft` wash + 3px inset coral bar + "MARKED IN ERROR" chip; error count derives from marked rows (no manual stepper).
  - Tick checkbox (simulate plan) stays on the right; `stopPropagation` from the row click; tooltip "Tick to simulate a student plan".
  - **Sticky verdict dock** (fixed, bottom-center, pill, `--shadow-md`): Correct/Conservative/Error pills with kbd chips **C/V/E**, Flag (F), divider, live "*n* cells in error" chip (danger when >0), inline notes input, Next (N). Selected verdict gets a lime ring.
  - Keyboard shortcuts active only on Judge, suppressed while typing.
  - Header: mode tabs + session strip "Doc *n* of 30 · *m* left" with a lime progress bar.
- **Tasks:** keep the 4-column board and card anatomy, but each card's progress bar becomes the **6 stage-dots strip** (done = forest fill, current = lime ring, upcoming = hollow; dot `title` = stage name) + "*n* of 6". List views/modals unchanged from the port mockup.
- **Audit → Stats, Visuals, Overview, Courses, Districts, API, Admin, Review:** structure unchanged from the current app — they re-skin from tokens/primitives alone. Charts and figures frozen (chrome only). Admin keeps the pulsing lime live-dot on the production banner (`pmt-pulse`).

## 6. Definition of done (delta on the brief's checklist)

- [ ] Crisp palette + accent tokens in `tokens.css`, both themes, all AA.
- [ ] No "Plan My Transfer" strings anywhere in UI copy; new Logo paths in `Logo.jsx` with `currentColor`.
- [ ] Primary/success/danger/conservative remain distinguishable side-by-side (coverage bars, verdict row, badges).
- [ ] Judge: row-click error marking + auto count + dock + shortcuts; verdict logic and payloads unchanged.
- [ ] Agreements: chips + command bar; all filtering/drill behavior preserved.
- [ ] Tabular figures only on pure-digit columns.
- [ ] `npm test -- --run` and `npm run build` pass; snapshots updated only where intentional.
