# Transfer Pathways Research Console — Crisp Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved brand redesign in `docs/handoff/` — crisp colorway tokens, new 5-petal logo, forest chrome, pill primitives, and the v2 surface deltas (Sign-in hero, Agreements chips + command bar, Judge row-marking + verdict dock, Tasks stage-dot cards) — exactly per the v2 mockup.

**Architecture:** Change the system, not the pages. Layer 1: tokens.css + fonts + Logo (everything re-colors from here). Layer 2: shared primitives (Button/Tabs/Badge/StatStrip/Alert/EmptyState/RouteHint/Modal/inputs) adopt the pill/flat vocabulary. Layer 3: chrome (forest top bar, 54px sub-nav). Layer 4: per-surface deltas, mockup-exact. Charts/figures (`analyses/*` internals), `console-terminal`, `.uui-scope` styling, `.exporting` logic, `ledgerText.js` (golden-locked), and all API behavior are FROZEN.

**Tech Stack:** React 19, Tailwind v4 (`@theme`/`@utility`), Vite 6, vitest + testing-library. Fonts self-hosted woff2.

## Global Constraints

- **Visual source of truth:** `docs/handoff/mockups/Transfer Pathways Console v2.dc.html` (cite: `v2:<line>`). When prose and mockup disagree, **v2 wins**.
- **Palette:** crisp colorway. Brand: forest `#193018`, lime `#96F060`. Use **token names**, never raw hexes, except the theme-independent forest-bar chrome and the lime/forest brand constants inside it (mockup hardcodes those deliberately).
- **Token mapping (mockup `--cw-*` → tokens):** `cw-canvas`→`canvas` · `cw-mint`→`primary-soft` · `cw-sunken`→`surface-sunken` · `cw-sunken2`→`surface-muted` · `cw-hover`/`cw-hover2`→`surface-hover` · `cw-border`→`border` · `cw-strong`→`border-strong` · `cw-hairline`→`border/60` · `cw-hairline2`→`border/40` · `cw-mid`→`border-strong/60` · `cw-ink-muted`→`ink-muted` · `cw-ink-subtle`→`ink-subtle` · `cw-ink-faint`→`ink-subtle/80` · `cw-ink-soft`→`ink-muted`. Greens: `#17855A`→`success`, `#0F6B45`→`success` hover (color-mix), `#DFF4E7`→`success-soft`. Reds: `#D22F14`→`danger`, `#FFE9E3`→`danger-soft`, `#FE4F32`→`danger-bright`. Lavender: `#6C4FD0`→`conservative`, `#F0EAFC`→`conservative-soft`, `#C7B5F1`→`conservative-fill`.
- **Type utilities are closed** (Task 2 list). Never set raw font sizes on markup except where the mockup's value has no utility (13.5px table cells etc. — use Tailwind arbitrary values `text-[13.5px]`, which the mockup treats as table vocabulary).
- **Tabular figures** (`tabular` utility / `tabular-nums`) ONLY on pure-digit columns (units, IDs, counts) — never on values containing `, . % /`.
- **No "Plan My Transfer"** strings anywhere (UI copy or comments). Keep functional identifiers `PMT_TOKEN`, `pmtr_`, `pmt.get`, `pmt-pulse`.
- **App min-width 1180px** — narrow viewports scroll horizontally.
- **Both themes AA.** Dark theme ships per handoff `tokens.css`.
- **Preserve accessibility contracts tests rely on:** Tabs `role="tab"` + labels; SwitchField `role="switch"` + label; SelectControl option-button names; InstitutionRail active `bg-primary-soft` + `{title} · {count}`; `Copy for AI` button name; content.js untouched.
- **Copy:** page copy comes from the current app unless the v2 mockup deliberately re-words a surface it redesigns (Sign-in, Agreements legend, Judge helper line, Admin banner). `content.js` and `ledgerText.js` are content-locked by tests.
- **Commits:** per user's standing workflow, DO NOT commit per-task. Leave the working tree uncommitted; one review at the end. (Deviation from skill default, per user memory.)
- Existing working-tree modifications (analyses, figures, server files) are prior in-flight work — do not revert or touch server files.

---

### Task 1: Brand assets — Schibsted Grotesk woff2 + logo.svg + favicon

**Files:**
- Create: `frontend/src/assets/fonts/schibsted-grotesk-latin-wght-normal.woff2` (+ `-latin-ext-`, `-latin-italic-`, `-latin-ext-italic-` = 4 files, downloaded)
- Create: `frontend/public/logo.svg` (copy of `docs/handoff/logo.svg`)
- Modify: `frontend/index.html` (favicon link)

**Interfaces:** Produces font files referenced by Task 2's `@font-face`; `public/logo.svg` is the mask source `LoadingLogo` already points at (`/logo.svg`, currently 404).

- [ ] **Step 1: Download the four variable woff2 files** from the Google Fonts CSS (fetch `https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900&display=swap` with a Chrome UA; download each `fonts.gstatic.com/...woff2` URL for normal/italic × latin/latin-ext into `frontend/src/assets/fonts/` with the names above). Verify each file is >10 KB and `file` reports `Web Open Font Format (Version 2)`.
- [ ] **Step 2: Copy the mark:** `cp docs/handoff/logo.svg frontend/public/logo.svg` (create `frontend/public/`).
- [ ] **Step 3: Favicon:** in `frontend/index.html` add `<link rel="icon" type="image/svg+xml" href="/logo.svg" />` after the viewport meta. Title already reads `Transfer Pathways Research Console` — leave it.
- [ ] **Step 4: Verify:** `cd frontend && npm run build` passes (fonts not yet referenced; this is a smoke check).

### Task 2: `frontend/src/styles/tokens.css` — merged drop-in

**Files:** Rewrite `frontend/src/styles/tokens.css` (690 lines → ~420).

**Interfaces:** Produces every token/utility the rest of the plan consumes. MERGE = handoff `docs/handoff/tokens.css` (authoritative for @font-face, @theme light+dark, base rules, type utilities, surface utilities, field/pill vocab, new `pmt-pulse`) **plus** infrastructure kept verbatim from the current file: `@layer base` html/body plumbing (box-sizing, `color-scheme`, `overflow-y: scroll`, `scrollbar-gutter: stable`, margin 0, h1–h4/button/hr resets), scrollbar styles, keyframes `overlayIn/modalIn/toastIn/riseIn/sheenDrift/moveBox-1…9`, `console-terminal` + `console-*` utilities verbatim, `hairline-b/t/r`, `font-mono` **as Tailwind default only** (delete the custom tnum-baking `@utility font-mono`), and an `input-field-focus` utility.

Key deltas locked here:
- 4 `@font-face 'Schibsted Grotesk'` blocks pointing at Task 1's files (normal+italic × latin+latin-ext, `font-weight: 400 900`, woff2-variations, keep the existing Hanken unicode-range values per face). Delete Hanken blocks.
- `@theme` light + `html[data-theme='dark']` exactly per `docs/handoff/tokens.css:33-129` (adds `--color-accent/-hover/on-accent`, `--color-danger-bright`, `--color-conservative-fill`, radius scale 6/8/10/14/18/22/999, `--shadow-xs/sm: none`, `--shadow-md/lg` per handoff, handoff easings). Plus one addition: `--color-scrim: rgba(25,48,24,.45)` (light) / `rgba(0,0,0,.6)` (dark) for overlay backdrops (mockup backdrop `v2:1160`; dark needs a dark scrim for AA).
- Base: `::selection` lime/forest, `:focus-visible` 2px primary, `a { color: var(--color-success) }` + hover darken (`color-mix(in oklab, var(--color-success), black 18%)`), body font/canvas/ink.
- Replace old `pmt-pulse` (opacity) with handoff box-shadow ring version (`docs/handoff/tokens.css:145-148`). Also update the duplicate in `frontend/src/shared/styles/globals.css:~350` to match.
- Type utilities EXACTLY per `docs/handoff/tokens.css:153-165` (display 30/650, display-lg 44/650, heading 20/650, body 14, body-strong 600, caption 13 subtle, label 11/650/.07em, stat 25/600, stat-lg 29/650, button 13/600, tag 11.5/600, `tabular`). **Do not keep** `text-heading-lg`/`text-body-lg`/`text-display-lg(clamp)`/`text-stat` tnum — the two `text-heading-lg` call sites migrate in Tasks 4/9.
- Surfaces per handoff: `surface-card` (radius-xl 18), `surface-raised` (radius-lg 14), `surface-sunken` (bg only + pill), `surface-elevated` (radius-2xl + shadow-lg). `input-field`, `field-label`, `chip` per handoff. `input-field-focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); outline: none; }`.
- Keep `console.css` untouched except nothing needed — verify `.bg-primary:not(:hover)`/`.text-primary` overrides still correct (they are token-driven).

- [ ] **Step 1:** Write the merged file (content assembled per above; handoff file is the skeleton, current file is the source for the keep-list).
- [ ] **Step 2:** `npm run build` — Tailwind compiles; fix any `@utility` syntax errors.
- [ ] **Step 3:** `npm test -- --run` — expect failures only in files not yet migrated (note them; they're claimed by later tasks). No test may fail on CSS parse.

### Task 3: Logo + lockup

**Files:** Rewrite `frontend/src/components/ui/display/Logo.jsx` with `docs/handoff/Logo.jsx` verbatim, exporting **default Logo** and **named LogoLockup** (barrel `components/ui/index.js:55` imports default — unchanged).

**Interfaces:** Produces `Logo({ size=22, title, className })` (width auto = size·352/215) and `LogoLockup({ markSize=21 })` (mark + `transfer`/`pathways` two-line wordmark, 12px/1.06, weights 400/700). Consumed by Task 5 (top bar) and Task 6 (sign-in). No current caller passes old props except via barrel (grep `<Logo` to confirm; fix any stragglers to `size`).

- [ ] **Step 1:** Copy `docs/handoff/Logo.jsx` over the file; keep the `useId` petal id.
- [ ] **Step 2:** grep `-rn "<Logo" frontend/src` — update any call sites using width/height classes to `size`.
- [ ] **Step 3:** `npm test -- --run` unchanged-failures-only; `npm run build` passes.

### Task 4: Shared primitives — pill/flat vocabulary

**Files:** Modify `components/ui/buttons/Button.jsx`, `buttons/IconButton.jsx`, `display/Tabs.jsx`, `display/Badge.jsx`, `display/StatStrip.jsx`, `feedback/Alert.jsx`, `feedback/EmptyState.jsx`, `forms/Switch.jsx`, `forms/Checkbox.jsx`, `overlays/Modal.jsx`, `overlays/FullScreenPanel.jsx` (its `text-heading-lg`→`text-heading`), `components/RouteHint.jsx`; Create `components/SubNav.jsx`.

**Interfaces (produced, consumed by every page task):**
- `Button`: pill radius at every size (`rounded-pill` default). Variants (mockup refs): `primary` forest bg `text-on-primary` hover `primary-hover` (v2:398) · `secondary` `bg-surface` + `border-border-strong` text-ink hover `bg-primary-soft` (v2:169) · `ghost` transparent → hover `primary-soft` (v2:677) · `danger` `bg-danger` white · `conservative` `bg-conservative-fill` + forest text (NEW fill look) · `inverse`/`ghostInverse` for forest bar (ghostInverse: `border border-on-primary/30 text-on-primary` hover `bg-on-primary/10`, v2:57) · keep `subtle`, alias `warning`→conservative. Drop `shadow-sm/xs` classes (tokens null them anyway); keep press-nudge + loading + `iconCircle` (circle = `bg-primary text-accent` on accent buttons — the hero CTA is `variant='accent'`: NEW variant `bg-accent text-on-accent hover:bg-accent-hover`, circle `bg-primary text-accent`, v2:1369-1377).
- `Tabs`: track `p-[3px] gap-0.5 rounded-pill surface-sunken`; buttons `px-[15px] h-auto py-[6.5px] rounded-pill text-[13px]`; active `bg-primary text-on-primary font-[650]`, inactive `text-ink-muted font-medium hover:bg-surface-hover` (v2:97-100). KEEP `role='tab'`/`aria-selected`/`aria-pressed` and the `multiple` API.
- `Badge`: same API; tones map to soft fills per handoff §4 (neutral `bg-surface-sunken text-ink-muted`, accent `bg-primary-soft text-primary`, success/danger/conservative `-soft` + role text); `px-2.5 py-[3px] h-auto text-tag rounded-pill`; drop `tabular-nums` from the base (add per call site only on digits).
- `StatStrip`: card = `surface-card` (18px radius), tiles `px-[22px] py-4`, divide hairline `divide-border/60`; label = `text-label`, value = `text-stat mt-1.5` **no font-mono** (v2:115-121). `accent` tile → `text-success`; add `tone: 'danger'` passthrough (Errors tile, v2:2025). Keep `bare`.
- `Alert`: white `surface-card` + **3px accent left bar** — `border-l-[3px] border-l-accent` for `info`; success/danger keep role-colored bar; body `text-body text-ink-muted` (v2:601-603, handoff §4).
- `EmptyState`: icon chip `w-11 h-11 rounded-[14px] bg-primary-soft text-primary` (no ring), title `text-[15.5px] font-[650]`, caption `text-caption max-w-[46ch]` (v2:313-317).
- `Switch`: on = `bg-primary border-primary` (already) — knob stays white in dark: change knob to explicit `bg-white` (mockup v2:694-696; in dark, `bg-surface` would be near-black on a lime track — fails). Track `w-10 h-[22px]`, knob 18px.
- `Checkbox`: `w-5 h-5 rounded-[6px]`; checked fill `var(--color-primary)` border primary, check icon `var(--color-accent)` in light... **exact per v2:1134**: box `#193018` bg, lime check. Use `style={{ color: 'var(--color-accent)' }}` on the check when checked and keep inline background pattern (comment in file explains why inline).
- `Modal`: panel `surface-elevated` (22px radius from token) — remove `rounded-xl` override; backdrop `style={{ background: 'var(--color-scrim)' }}` (drop `bg-ink/40`), keep blur optional (mockup has none — remove `backdrop-blur-sm`).
- `IconButton`: 28px round ghost (`rounded-pill`, hover `bg-primary-soft`; danger-hover variant `hover:bg-danger-soft hover:text-danger`) per v2:448-449.
- `RouteHint`: `caption "API route"` + chip `text-[12px] font-semibold text-ink bg-surface border border-border rounded-[8px] px-2.5 py-[4.5px]` (v2:103-106). Same props.
- **NEW `SubNav.jsx`**: `({ tabs: {value,onChange,options}, route, children })` → full-bleed bar `flex items-center gap-4 h-[54px] px-[22px] border-b border-border/60` with `<Tabs {...tabs} />` left and `{route && <RouteHint path={route.path} method={route.method} />}` (or `children`) pushed right via `ml-auto` (v2:95-109). Consumed by DataPage, AuditWorkspace, ApiPage.

- [ ] **Step 1:** Apply all component edits above (each is mechanical; keep every prop contract + a11y role).
- [ ] **Step 2:** `npm test -- --run`: `DataApiDocs.test.jsx` (role=tab), `VisualsPage.test.jsx` (switch role), `InstitutionRail.test.jsx` must still pass their role/name assertions. Fix regressions here, not in tests.
- [ ] **Step 3:** `npm run build` passes.

### Task 5: Global chrome — forest top bar + gate screens

**Files:** Modify `frontend/src/App.jsx` (Console, Centered, AccessRequestedScreen, AccessCheckFailedScreen, AuditWorkspace shell only — JudgeTab/StatsTab are Tasks 9/10).

**Spec (v2:30-109):** Root `div`: `min-h-screen min-w-[1180px] bg-canvas text-ink` (replace `h-screen … bg-surface`; KEEP the `h-screen flex flex-col` scroll architecture — apply `min-w-[1180px]` and `bg-canvas`). Top bar replaces the current 48px header: `h-[62px] px-[22px] flex items-center gap-5` inline `style={{ background: '#193018' }}` (theme-independent brand chrome), no border. Contents in order: clickable `LogoLockup` (mark lime via `style={{ color: '#96F060' }}` on the mark wrapper, wordmark `#F0FFE7`; onClick → `setView('data')`) · 1px divider `h-[22px] bg-[rgba(240,255,231,.22)]` · eyebrow `RESEARCH CONSOLE` (`text-[10.5px] font-[650] tracking-[.12em] uppercase text-[rgba(240,255,231,.62)]`) · nav pushed right: custom pill track `bg-[rgba(240,255,231,.09)] rounded-pill p-[3px]` with per-tab buttons — active `bg-[#96F060] text-[#193018] font-[650]`, inactive `text-[rgba(240,255,231,.78)] font-medium` (do NOT use the Tabs primitive here; the forest bar needs the translucent track) · email `text-[12.5px] whitespace-nowrap text-[rgba(240,255,231,.6)]` · Sign out = pill `border border-[rgba(240,255,231,.3)] text-[#F0FFE7] text-[12.5px] hover:bg-[rgba(240,255,231,.12)]`.
AuditWorkspace: replace its `h-11` bar with `<SubNav tabs={{value: auditTab, onChange: setAuditTab, options: […]}} route={auditRoute} />` where `auditRoute` = `{ path: '/api/audit/next?mode=' + judgeMode }` for judge / `/api/audit/queue` review / `/api/audit/stats` stats — lift `mode` state from JudgeTab into AuditWorkspace and pass down (`mode`, `setMode`), matching v2:1871-1874. Gate screens: swap `bg-surface`→`bg-canvas`; copy unchanged.

- [ ] **Step 1:** Implement; extract `TopBar` component inside App.jsx.
- [ ] **Step 2:** Manually verify with `npm run dev` + a quick screenshot if driving the app is feasible; otherwise assert via test: add `frontend/src/App.chrome.test.jsx` rendering `Console` (mock hooks/auth like existing tests do) asserting the nav buttons Data/Visuals/Audit/Tasks/API render and `Sign out` button exists.
- [ ] **Step 3:** `npm test -- --run` + build.

### Task 6: Sign-in hero

**Files:** `frontend/src/SignInScreen.jsx`.

**Spec (v2:1347-1384):** Full-viewport `min-h-screen relative overflow-hidden grid place-items-center bg-canvas` (mockup `#FEFFF5` ivory ≈ canvas; use canvas). Giant watermark mark: `<Logo size={470} className='absolute -left-[190px] -bottom-[150px] opacity-16 pointer-events-none' style={{ color: 'var(--color-accent)' }}` (mockup 760×470). Centered column `max-w-[620px] text-center px-6 py-10`: `<Logo size={54} style={{ color: 'var(--color-accent)' }} />` · eyebrow `TRANSFER PATHWAYS · RESEARCH` (`mt-[26px] text-[12px] font-[650] tracking-[.14em] uppercase text-ink-muted`) · `<h1 className='text-display-lg mt-3.5'>Transfer Pathways<br/>Research Console</h1>` · caption (`mt-[18px] max-w-[44ch] text-[15px] leading-relaxed text-ink-muted`, copy = current sign-in copy verbatim: "Transfer-pathway auditing and analysis. Access is limited to project members — sign in with the Google account your admin granted.") · **GIS button** `mt-[30px]` — GIS only renders its own button (no custom-trigger API), and the handoff mandates "Google button behavior unchanged": render `<GoogleIdentityButton onCredential={onCredential} text='signin_with' shape='pill' fullWidth={false} />` centered where the lime CTA sits · allowlist caption `mt-3.5 text-[12.5px] text-ink-subtle`: "Access is allowlisted per project. Wrong account? Ask your admin." · error `<Alert type='error'>` above the button when set · footer absolute bottom-[22px] centered `text-[12px] text-ink-subtle`: `© 2026 Transfer Pathways Research`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Add `SignInScreen.test.jsx`: mocks `GoogleIdentityButton` (jest.mock → renders `<div data-testid='gis' />`), asserts heading text, eyebrow, allowlist caption, © line.
- [ ] **Step 3:** Test + build pass.

### Task 7: Data → Agreements redesign (chips + command bar + detail)

**Files:** `frontend/src/DataPage.jsx` (AgreementsBrowser L73-182, CampusColleges L201-296, CoverageBar L300-311, AgreementDetail L544-611, StatTile L692-700), `components/CollegeGeoFilters.jsx` (pill re-skin).

**Spec:**
- `AgreementsBrowser` (v2:156-220): kill the `lg:grid-cols-[300px…]` grid + `InstitutionRail`. New column flow `flex flex-col gap-4 max-w-[1240px] mx-auto`: **campus chips row** — label `Receiving campus` (`text-label`) over a wrap of 9 pill buttons (`px-[15px] py-[7px] rounded-pill text-[13px] border`, active `bg-primary text-on-primary border-primary font-[650]`, idle `bg-surface text-ink-muted border-border-strong hover:border-primary`), right-aligned secondary buttons `Min requirements` / `Degree template` (existing handlers). **Command bar row**: search grows `flex-1` — pill label wrapper `border-[1.5px] border-border-strong rounded-pill px-[22px] py-[13px]` containing icon + bare input `text-[15px]` placeholder `Search {n} colleges — name, district, or county…`; the three geo selects inline right as pill selects (restyle `CollegeGeoFilters` to pill `rounded-pill px-4 py-[11px] text-[13px] border-border` white). **Caption row**: `{campus} · {n} colleges with agreements` left; legend right (`ml-auto`): dots 9px — complete `bg-success`, partial `bg-primary`, no agreement `border-[1.5px] border-border-strong bg-surface` with those exact labels (v2:184-191). **Table** (v2:193-217): `surface-card overflow-hidden`, grid `[1fr_220px_220px_76px]`, header `text-label px-[22px] py-3 border-b border-border/60`, rows `py-[13px] border-b border-border/40 hover:bg-surface-hover cursor-pointer`, college cell = name `text-[14.5px] font-semibold` + district `text-[12.5px] text-ink-subtle truncate`, two `CoverageBar`s (`w-[110px] h-1.5` track `bg-surface-sunken`, fill success when full else primary — keep component, restyle), trailing `view →` in `text-success font-[550]`.
- `AgreementDetail` (v2:222-321): back row (ghost pill `← All colleges` + `·` + campus caption); **header card** `surface-card overflow-hidden`: top block `px-6 py-5` with eyebrow `AGREEMENT` (`text-[12px] text-label style`), path line `text-[19px] font-[650]` `{college} → {campus}` with arrow svg, program line `text-body text-ink-muted mt-1`, `Open ASSIST` secondary pill w/ external icon `ml-auto`; **4-tile hairline row** `grid grid-cols-4 border-t border-border/60`, tiles `px-6 py-3.5 border-l border-border/60 first:border-l-0`: Hand-curated % (`text-[18px] font-[650] text-success` + 44px mini bar `bg-success-soft`/`bg-success`), ASSIST % same, Requirements count, Last verified date — derive from data already loaded (coverage row + `updated_at`; requirements = ledger group count; if a value is unavailable render `—`). Representation `Tabs` stay (Agreement/DB document/Raw ASSIST API/Min comparison/Degree coverage) in sunken pill track, `RouteHint` moves beside them right.
- Purge the now-unused rail import from AgreementsBrowser only (rail itself survives for Task 8).

- [ ] **Step 1:** Write failing RTL test `frontend/src/DataPage.agreements.test.jsx`: mock `useData` hooks like `InstitutionRail.test.jsx` does; assert campus chip buttons render for provided campuses, clicking one calls select, legend labels `complete`/`partial coverage`/`no agreement` render, search placeholder matches.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Tests (`DataPage.agreements`, `InstitutionRail`, `DataReferences.minimums`) + build pass.

### Task 8: Data → Overview, Courses, Districts + rails

**Files:** `frontend/src/components/DatasetSummaryPanel.jsx`, `frontend/src/DataPage.jsx` (DataPage shell L42-65 → SubNav; CoursesBrowser/CatalogBrowser/InstitutionRail L706-887), `frontend/src/DataReferences.jsx` (ReferenceRail L249-273, DistrictLookup L299-379, DataTable L212-247, CampusMinimums header), `components/Tooltip.jsx` if touched.

**Spec:**
- DataPage shell: replace the `h-11` tab bar with `<SubNav tabs={…4 options} route={currentRoute} />`; route per tab (v2:1866-1870): overview `GET /api/data/summary`, agreements (lifted from AgreementsBrowser via `onRoute` callback — list `GET /api/assist/coverage`, detail = existing paneRoute), courses `GET /api/assist/courses?institution_id=…` (existing), districts `GET /api/assist/institutions?kind=community_college`. Remove per-pane `RouteHint` renders (they move into SubNav). Body containers per mockup: overview/courses/districts `max-w-[1400px] mx-auto px-[22px] pt-[26px] pb-12`, agreements `max-w-[1240px]`.
- Overview (v2:112-152): DatasetSummaryPanel → `StatStrip` with 7 tiles (Refreshed date NOT tabular; counts `tabular`), then `surface-card` table "Majors tracked per receiving campus" `text-label` header + `9 campuses` caption; grid `[2.2fr_1fr_1fr_2.6fr_2.6fr]`; two bar columns (`w-[110px] h-1.5`, fill `success` when ≥90 else `primary`, value `text-[13.5px] font-[550]`). Keep all current data wiring.
- Courses (v2:323-390): system Tabs (cc/uc) left; geo filter pills right (CollegeGeoFilters from Task 7). Grid `[300px_1fr]`; rail per new vocabulary (below); right: pill search `flex-0 w-[340px]` + `{n} courses` caption; table grid `[140px_1fr_80px_110px]` — code `text-[13.5px] font-bold tabular`, title `text-[13.5px] text-ink-muted truncate`, Units/Course_ID right-aligned `tabular text-ink-muted`.
- `InstitutionRail` restyle (v2:341-360): card `surface-card p-2.5`; header `text-label` + count caption (KEEP `{title} · {count}` text format — test contract); optional pill search `bg-canvas border-border rounded-pill px-3 py-[7px]`; items = full-width buttons `rounded-[10px] px-3 py-[9px] flex gap-2.5` with **3px notch** span (`w-[3px] h-3.5 rounded-pill mt-0.5`, active `bg-accent` else transparent); active item **keeps `bg-primary-soft`** + `font-[650]`; hover `bg-surface-hover`; name `text-[13.5px]`, subtitle `text-[11.5px] text-ink-subtle`. Mirror in `ReferenceRail`.
- Districts (v2:393-456): caption `115 colleges mapped to 72 districts`-style line + primary pill `＋ Add college` right; grid `[320px_1fr]`; district header card (name `text-[16px] font-[650]`, meta caption, county chips `chip` utility); colleges DataTable per hairline vocabulary; row edit/delete → `IconButton` ghost circles (danger hover on delete). `CampusMinimums` header card + Tabs re-skin only.

- [ ] **Step 1:** Implement (mechanical re-skin; no behavior change; keep every hook/handler).
- [ ] **Step 2:** `npm test -- --run` — `InstitutionRail.test.jsx` + minimums tests green; build passes.

### Task 9: Judge — row marking, session strip, verdict dock, shortcuts

**Files:** `frontend/src/App.jsx` (JudgeTab L393-567), `frontend/src/shared/components/requirements/RequirementsLedger.jsx` (additive props only), `frontend/src/pages/Audit/components/DocHead.jsx`.

**Behavioral spec (v2:459-573 + logic v2:1959-2013, 1582-1609):**
- **Ledger (additive, no restyle of existing output):** add optional props `markedRows` (Set of row keys) + `onMarkRow(rowKey)`. Thread via new `MarkRowCtx` exactly like `ToggleCourseCtx` (L46, 510-512). In `ReceiverRow` (L297-354): compute `rowKey` = the index path (pass `groupIdx`/`sectionIdx`/`rowIdx` down — Group and RequirementSection already map with indexes); when ctx present: wrapper div gets `onClick={() => onMarkRow(rowKey)} cursor-pointer` and when marked: `style={{ background: 'var(--color-danger-soft)', boxShadow: 'inset 3px 0 0 var(--color-danger-bright)' }}` + a chip under the left cell `MARKED IN ERROR` (`text-[10.5px] font-bold tracking-[.05em] uppercase text-danger bg-danger-soft rounded-pill px-2.5 py-[2.5px] mt-1.5 inline-block`). In `CcCourse` (L160-189): `onClick={(e) => e.stopPropagation()}` on the label so ticking never marks. **Nothing else in the ledger changes** — `ledgerText.js` untouched, fidelity tests must stay green. When ctx absent, rendering is byte-identical to today.
- **JudgeTab:** page container `max-w-[1400px] mx-auto px-[22px] pt-[26px] pb-12 flex flex-col gap-4`. Header row: mode Tabs (lifted state from Task 5: `mode`/`setMode` props) + right session strip `{Doc n of N} · {left} left` caption + 150×6px progress track (`bg-surface-sunken` / fill `bg-accent`) — n/N from `variants.data` (audited = total − left; N = total templates) in template mode; hide strip in random mode. **Doc head card** (v2:475-488): re-skin DocHead: `surface-card px-[22px] py-5 flex items-start gap-3.5` — major `text-[22px] font-[650] tracking-[-.012em]` (replaces `text-heading-lg`), school `font-semibold text-ink` + `·` + college italic muted caption row, `ASSIST.org` secondary pill `ml-auto` (keep `showAssist` prop).
- Helper line under head (v2:490-493): `Required` heading `text-[21px] font-[650]` + caption `Click a row to mark it in error — the count updates itself. Tick the box on the right to simulate a student plan.` (replaces the old tick strip copy; keep the `Clear` button when `taken.length > 0`).
- **State:** `const [errRows, setErrRows] = useState(() => new Set())`; `markRow = (k) => setErrRows(prev => …toggle…)`; reset with doc change (same effect as `setTaken([])`, L460). `cellsInError` derived: `errRows.size`. DELETE the manual number Input (L520-525). Submit payload unchanged: `cells_in_error: errRows.size` (L488).
- **Verdict dock** (v2:556-571): fixed `left-1/2 bottom-5 -translate-x-1/2 z-40 flex items-center gap-2 bg-surface border border-border-strong rounded-pill px-3 py-2.5 max-w-[min(1120px,calc(100vw-48px))]` `style={{ boxShadow: 'var(--shadow-md)' }}`. Verdict state: `verdict` (null|'correct'|'conservative'|'error'|'flagged') — **selection then submit stays the current one-click-submits flow** (verdict logic/payloads unchanged): each pill calls `submit(<result>)` directly as today; the "selected ring" (`0 0 0 2px var(--color-surface), 0 0 0 4.5px var(--color-accent)`) shows on the in-flight/last submitted verdict while `verify.isPending`. Pills: Correct `bg-primary text-on-primary` kbd chip `C` · Conservative `bg-conservative-fill text-[#193018]` kbd `V` · Error `bg-danger text-white` kbd `E` · Flag = secondary pill w/ flag icon kbd `F` · divider · live count chip `“{n} cells in error”` (`bg-danger-soft text-danger` when >0 else sunken/muted) · inline borderless notes input `flex-1 min-w-[150px]` placeholder `Notes (required when flagging)…` (same `data-flag-notes` focus contract) · `Next` ghost + kbd `N`. Add `pb-24` spacer under content so the dock never covers the last rows.
- **Keyboard** (v2:1582-1596): one `keydown` listener active only while JudgeTab is mounted AND `auditTab==='judge'` (mount-scoped is enough — it only renders then): ignore when `e.target.tagName` INPUT/TEXTAREA; keys c/v/e→`submit('correct'|'conservative'|'error')`, f→`submit('flagged')`, n→`onNext()`.
- Ledger call site adds `markedRows={errRows} onMarkRow={markRow}`.

- [ ] **Step 1: Failing tests first** — `frontend/src/shared/components/requirements/RequirementsLedger.marking.test.jsx`: render ledger with a minimal major fixture + `markedRows`/`onMarkRow`; assert (a) clicking a row calls `onMarkRow` with its key, (b) a marked row shows text `MARKED IN ERROR`, (c) clicking the tick checkbox with `onToggleCourse` set does NOT call `onMarkRow`, (d) with neither prop, no chip renders. And `App.judge.test.jsx` (mock query hooks): pressing `e` calls verify mutate with `result:'error'`; marked-row count appears in the dock ("1 cells in error" after one row click); typing in notes suppresses shortcuts.
- [ ] **Step 2:** Run tests — fail for the right reasons.
- [ ] **Step 3:** Implement ledger props + JudgeTab rebuild + DocHead re-skin.
- [ ] **Step 4:** All tests incl. `src/test/fidelity/` green; build passes.

### Task 10: Review + Stats re-skin

**Files:** `frontend/src/DesktopReview.jsx`, `frontend/src/App.jsx` (StatsTab/InterpretationBanner/ScopeLine/CellsCard/buildStrip L250-389), `frontend/src/pages/Audit/components/stats/*.jsx`.

**Spec:** Structure unchanged (both stubs in mockups — "inherits the system"). Mechanical vocabulary pass: page containers `max-w-[1400px] mx-auto px-[22px] pt-[26px] pb-12`; `InterpretationBanner`: `surface-card` + `border-l-[3px] border-l-accent` (v2:601), body `text-body text-ink-muted`, strong `text-ink font-semibold` — drop `font-mono` from `Em`. StatsTab strip via updated StatStrip (Errors tile `tone:'danger'`). Stats cards: keep internals, swap `text-stat font-mono`→`text-stat` (+`tabular` only on pure-digit), verify `CampusCoverage` inline `var(--color-primary…)` renders forest, `VerdictBar` tiers now forest/lavender/subtle/danger read distinctly (definition-of-done check). DesktopReview: verdict buttons inherit Task 4 Button; keep its manual `cells_in_error` Input (Review is not redesigned); rails/list rows adopt hairline+notch vocabulary; `text-heading-lg` if present → `text-heading`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Tests + build pass.

### Task 11: Tasks — stage-dot cards + board/list/modal re-skin

**Files:** `frontend/src/tasks/TaskCard.jsx`, `TaskBoard.jsx`, `TaskList.jsx`, `TasksPage.jsx`, `TaskModal.jsx`, `PortingWorkflow.jsx`.

**Spec:**
- **TaskCard (v2:836-864 + mkCard v2:1636-1658):** REPLACE the progress-bar block (L35-45) with the stage-dot strip; keep card shell/a11y, badge row (accent badge → task-type; keep `Approved` success badge when done), title (done strike-through stays), assignee row, comments count. Dot strip: `import { stagesForTask, isStageComplete, currentStageIndex, nextStage } from './taskWorkflow'`; `const stages = stagesForTask(task); const cur = currentStageIndex(task); const doneN = cur === -1 ? stages.length : cur;` Render `flex items-center` of per-stage nodes: dot `w-3 h-3 rounded-pill box-border` — done: `bg-primary border-2 border-primary`; current: `bg-surface border-2 border-accent`; upcoming: `bg-surface border-2 border-border-strong`; `title={stage.label}`; connector `w-[9px] h-[1.5px] bg-border-strong/60` after every dot but the last; right-aligned label `“{doneN} of {stages.length}”` `text-tag text-ink-subtle tabular`. Below: `Next: {nextStage.label}` line stays (hide when done). Render the strip for done cards too (all-forest, "6 of 6"). Drop the `{progress}%` text on the card.
- **TaskBoard:** column container → `bg-surface-muted rounded-2xl p-3` (sunken pill no longer fits rectangles; mockup v2:825 uses sunken2 radius 16); header `text-label` + count chip `bg-surface rounded-pill`; empty slot dashed `border-[1.5px] border-dashed border-border-strong rounded-xl text-[12.5px] text-ink-subtle` "Drop a task here" (v2:833); keep all drag/drop + persisted collapse.
- **TasksPage:** header = Tabs (Board/My tasks/All tasks) + ghost `Copy all for AI`/`Export all` + primary pill `＋ New task` (v2:791-811); StatStrip (Open / In progress success-toned / Done this week) (v2:813-820); container `max-w-[1400px] mx-auto px-[22px] pt-[26px] pb-12`. Keep seed/archive/move logic.
- **TaskList:** rows per v2:883-899: status pill (In progress `bg-success-soft text-success` / To do sunken) + type badge + title + mini bar (keep bar in list: 80×5px track sunken, fill `bg-primary`) + pct + assignee/unassigned + date. Show-archived switch row stays.
- **TaskModal/PortingWorkflow (v2:1158-1341):** re-skin only — Modal chrome comes from Task 4 (radius 22, scrim); stage nodes: done dot `bg-success border-success` + white check, active `bg-surface border-border-strong` number, locked `bg-surface-muted border-border` lock icon (v2:1286-1292); progress bar fill `bg-primary` (success at 100); buttons per Task 4; porting-stages preview grid in new-task modal per v2:1196-1209. All handlers/copy/roles unchanged.

- [ ] **Step 1: Failing test** `frontend/src/tasks/TaskCard.dots.test.jsx`: fixture task with 2 of 6 stages complete → renders 6 elements with `title` = stage labels, "2 of 6" text, no `%` text; done task → "6 of 6".
- [ ] **Step 2:** Implement all files.
- [ ] **Step 3:** Tests + build pass.

### Task 12: API page re-skin

**Files:** `frontend/src/DataApiDocs.jsx` only (content.js LOCKED).

**Spec (v2:906-1060):** Tab bar → `<SubNav>` (Tokens/Starter/Endpoints/Data guide; no route chip). Body `max-w-[880px] mx-auto px-[22px] pt-[30px] pb-14`. Sections: heading `text-[16px] font-[650]` + intro prose `text-[13.5px] leading-relaxed text-ink-muted max-w-[68ch]`. TokenManager: card `surface-card p-5`; input `flex-0 w-[300px] input-field`; Generate = primary pill; token rows hairline-divided with ghost Revoke (danger hover). Starter: numbered circles `w-[26px] h-[26px] rounded-pill border border-border-strong text-[12.5px] font-[650] text-ink-muted` (drop font-mono on the number); starter.py card: header row (name `text-[13.5px] font-[650]` + `preconfigured for this API` caption + ghost Copy/Download) + `<pre>` `bg-surface-muted px-5 py-[18px] font-mono text-[12px] leading-[1.65] text-ink-muted` (v2:955-981 — NOT console-terminal). CodeBlock likewise. Endpoints: GettingStarted card lines with `<strong class='text-ink font-semibold'>`; groups: `surface-card divide-y divide-border/60` entries — `GET` label `text-[11px] font-bold tracking-[.05em] text-ink-subtle` + mono path `text-[13px] font-semibold text-ink` + name `text-body-strong` + desc caption + green `▸ Details` disclosure (`text-success font-[550]`) keeping `<details>` semantics. Guide: Copy-for-AI card (`surface-card p-5`, primary pill w/ sparkles — label stays exactly `Copy for AI`), prose/table/code per vocab (DocTable first col mono `text-ink`).

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `DataApiDocs.test.jsx` + `content.test.js` green; build passes.

### Task 13: Admin re-skin + production banner

**Files:** `frontend/src/AdminPage.jsx`.

**Spec:** Container `max-w-[1000px] mx-auto px-[22px] pt-[30px] pb-14`, `Stack gap='section'`. **ADD production banner first** (v2:1065-1072 — new element; keyframe `pmt-pulse` exists): forest card `rounded-[18px] px-[22px] py-4 flex items-center gap-3.5` `style={{ background: '#193018' }}` · dot `w-[9px] h-[9px] rounded-pill bg-[#96F060]` `style={{ animation: 'pmt-pulse 2.2s ease-out infinite' }}` · title `Production target` `text-[13.5px] font-[650] text-[#F0FFE7]` + sub `transfer-pathways-tool.up.railway.app · live research database — changes apply immediately` `text-[12.5px] text-[rgba(240,255,231,.62)]` · `live` chip `ml-auto bg-[#96F060] text-[#193018] text-[11.5px] font-semibold rounded-pill px-[11px] py-1`. Then existing sections in current order, re-skinned: section headings `text-[16px] font-[650]`; panels `surface-card`; team-name rows grid `[1fr_240px_70px]` with `input-field` + ghost Save (v2:1097-1108); requests/blocked rows per v2:1074-1092 (ghost Un-block w/ icon); MajorAccessPanel/VisualSettingsPanel/DatasetPanel/AccessPanel keep structure, inherit primitives; All/None text buttons `text-success font-[550]` where present. UID/mono strings: keep `font-mono` class (renders sans now) + `tabular` only if pure digits.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `AdminPage.test.jsx` green (pure helper test); build passes.

### Task 14: Visuals chrome re-skin

**Files:** `frontend/src/visuals/VisualsPage.jsx`, `frontend/src/analyses/AnalysisCard.jsx` (chrome only).

**Spec (v2:666-785):** Container `max-w-[1180px] mx-auto px-[22px] pt-[26px] pb-12 flex flex-col gap-5`. Card = `surface-card px-6 py-[22px] flex flex-col gap-[18px]` (AnalysisCard keeps `analysis-card` class + `data-export-exclude` markers + `.exporting` behavior UNTOUCHED). Header: title `text-[17px] font-[650]`, source caption `text-[12.5px] text-ink-subtle`; download buttons → ghost pills w/ download icon; `PublicationBadge` → neutral Badge (`Admin only` sunken pill / `Published` success-soft). `VariantControls`: label caption over control; `SelectControl` → sunken pill segmented track (active `bg-primary text-on-primary font-[650]`) — KEEP `aria-pressed` + accessible names; SwitchField unchanged semantics. Frozen: every `analyses/*` internal, the `<img>` + `bg-white` matte, registry ids/order, control labels (`Paper baseline`, `Hand-curated minimums`, `Show differences` — tests).

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `VisualsPage.test.jsx` green; build passes.

### Task 15: Identity sweep + tabular audit

**Files:** grep-driven small edits.

- [ ] **Step 1:** `grep -rn "Plan My Transfer" frontend/` → 0 hits (Logo comment goes in Task 3; catch stragglers incl. `shared/` comments).
- [ ] **Step 2:** `grep -rn "text-heading-lg\|text-body-lg" frontend/src` → 0 hits.
- [ ] **Step 3:** `grep -rn "#3366ef\|#16a34a" frontend/src` → only acceptable fallbacks updated: change CoverageBar/legend/CampusCoverage inline fallbacks to the new token values (`var(--color-primary, #193018)`, `var(--color-success, #17855A)`).
- [ ] **Step 4:** Audit `font-mono`+stat combos: stats with `, . % /` must not carry `tabular`; pure-digit table columns (units/IDs/counts) get `tabular`.
- [ ] **Step 5:** Confirm `hero-panel`, Hanken font files: remove the two Hanken woff2 files and the `@fontsource-variable/inter` import if unreferenced (`grep -rn "hanken\|fontsource" frontend/src`).

### Task 16: Final verification

- [ ] **Step 1:** `cd frontend && npm test -- --run` — full suite green (intentional expectation updates only, each justified against a task above).
- [ ] **Step 2:** `npm run build` — clean.
- [ ] **Step 3:** Definition-of-done sweep (REVAMP-HANDOFF §6): crisp tokens both themes; no PMT strings; primary/success/danger/conservative distinguishable side-by-side (VerdictBar, coverage bars, badges); Judge row-marking + auto-count + dock + shortcuts with unchanged payloads; Agreements chips + command bar with preserved filtering; tabular only on digit columns.
- [ ] **Step 4:** Launch `npm run dev`, click through every screen per mockup states; fix visual misses.
- [ ] **Step 5:** Report; NO commit (user reviews first).

## Self-review notes

- Spec coverage: tokens (T2), logo/wordmark (T3), chrome (T5), primitives (T4), sign-in (T6), Agreements (T7), overview/courses/districts (T8), Judge (T9), Review/Stats (T10), Tasks (T11), API (T12), Admin+banner (T13), Visuals (T14), purge/verify (T15/16). RouteHint chip: T4+T5+T8. Min-width: T5. Fonts: T1/T2.
- Ledger freeze reconciled: additive props only; `.uui-scope` CSS and ledgerText untouched; absent-props rendering identical (T9 test d).
- InstitutionRail contract (`bg-primary-soft`, `{title} · {count}`) preserved (T8).
- Mockup stubs (Review, detail representation tabs) = re-skin only (T10, T7).
