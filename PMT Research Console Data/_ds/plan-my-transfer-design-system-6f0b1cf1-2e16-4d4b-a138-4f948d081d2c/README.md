# Plan My Transfer — design system

A calm, light UI that guides a California community-college student toward a UC
transfer. Royal-blue brand; teal = done/eligible; rose = danger; amber =
"conservative" (an internal caution/over-prepared tier). Content cards are flat;
only true overlays (modals, popovers, toasts) lift. Light is default; dark swaps
CSS variables only. Components are on `window.PMT.*`.

## Setup — no wrapper needed

Components read their theme from CSS custom properties on `:root` (shipped in
`styles.css`), not a React context. Render any `window.PMT.*` component with
`styles.css` loaded — there is no ThemeProvider/Provider to wrap the app in.
Dark mode: set `data-theme="dark"` on `<html>`. (Toast notifications are the one
exception — they need `ToastProvider` — but the toast surface isn't in these cards.)

## Styling idiom — Tailwind v4 utility classes + token utilities

Style with utility classes. NEVER set raw `font-size` / `font-weight` /
`text-[Npx]` or raw hex — always use the tokens below.

**Type — six treatments (+ variants); never raw font sizing:**
`text-display` · `text-display-lg` · `text-heading` · `text-heading-lg` ·
`text-body` · `text-body-lg` · `text-body-strong` · `text-caption` ·
`text-label` · `text-button` · `text-stat` / `text-stat-lg` (numeric) ·
`text-tag`. Use `font-mono` for tabular/aligned figures — it's the SAME family
with tabular-nums, not a separate monospace font.

**Ink (text color):** `text-ink` · `text-ink-muted` · `text-ink-subtle` ·
`text-on-primary` (text on a brand fill).

**Surfaces (card-chrome utilities):** `surface-raised` (the default content
card) · `surface-card` (flat, dense lists) · `surface-sunken` (recessed well) ·
`surface-elevated` (floating overlay). Also `bg-surface`, `bg-surface-hover`,
`bg-surface-muted`, `bg-canvas` (app background).

**Color:** brand → `bg-primary` / `text-primary` / `bg-primary-soft` /
`hover:bg-primary-hover`; success (teal) → `text-success` / `bg-success-soft`;
danger (rose) → `text-danger` / `bg-danger-soft`; conservative (amber) →
`text-conservative` / `bg-conservative-soft`.

**Borders / dividers:** `border border-border` (or `border-border-strong`);
`hairline-t` / `hairline-b` / `hairline-r` for single 1px hairlines.

**Radius:** `rounded-md` (controls) · `rounded-lg` (cards) · `rounded-xl` ·
`rounded-pill`.

## Spacing — use the layout components, not hand-placed margins

- Page body → `<PageContainer width="wide" | "form" | "narrow">` (owns the
  gutter + max width).
- Vertical rhythm → `<Stack gap="tight" | "cozy" | "comfortable" | "section">`
  (8 / 12 / 16 / 24px) — don't hand-place `mt-*`/`mb-*` between siblings.
- Cards → `<Panel>`; metric rows → `<StatStrip>`. Inline gaps `gap-2` default
  (`gap-1.5` for icon ↔ label).

## Where the truth lives

`styles.css` (and its `@import`s: `_ds_bundle.css`, `fonts/fonts.css`) is the
full stylesheet. Per component, read `<Name>.prompt.md` (usage) and
`<Name>.d.ts` (props) before composing.

## Idiomatic example

```jsx
const { PageContainer, Stack, Panel, StatStrip, Button } = window.PMT
// + icons from @heroicons/react/24/outline

<PageContainer width="wide">
  <Stack gap="section">
    <Panel
      icon={ChartBarIcon}
      title="Audit coverage"
      action={<Button size="sm" variant="secondary">View all</Button>}
    >
      <p className="text-body text-ink-muted">
        1,284 of 3,002 agreements audited across 9 campuses.
      </p>
    </Panel>
    <StatStrip
      tiles={[
        { label: 'Audited', value: '1,284', sub: 'of 3,002' },
        { label: 'Errors', value: '14', accent: true },
      ]}
    />
  </Stack>
</PageContainer>
```

# PMT (frontend@1.1.1)

This design system is the published frontend React library, bundled as a single
browser global. All 45 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.PMT`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.PMT.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Alert } = window.PMT;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Alert />);
```

## Tokens

121 CSS custom properties from frontend. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (28): `--tw-border-style`, `--tw-shadow-color`, `--tw-inset-shadow-color`, …
- **spacing** (4): `--tw-inset-shadow`, `--tw-inset-shadow-alpha`, `--tw-inset-ring-shadow`, …
- **typography** (10): `--tw-font-weight`, `--tw-tracking`, `--font-sans`, …
- **radius** (6): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (11): `--tw-shadow`, `--tw-shadow-alpha`, `--tw-ring-shadow`, …
- **other** (62): `--tw-translate-x`, `--tw-translate-y`, `--tw-translate-z`, …

## Components

### feedback
- `Alert`
- `BulkActionBar`
- `EmptyState`
- `LoadingLogo`
- `LoadingPage`
- `ProgressRing`
- `Skeleton`
- `Spinner`
- `UndoToast`

### display
- `Badge`
- `CompletionCheck`
- `Divider`
- `Frame`
- `IconBadge`
- `Logo`
- `NavList`
- `OptionCard`
- `Reveal`
- `StatStrip`
- `Tabs`

### buttons
- `Button`
- `IconButton`

### general
- `CatalogLoading`
- `HBarList`
- `KeyValuePanel`
- `MiniBarChart`
- `ProgressLoader`
- `ProportionBar`
- `Tooltip`
- `UserInitialsAvatar`

### forms
- `Checkbox`
- `Combobox`
- `Input`
- `MonthPicker`
- `Select`
- `Switch`
- `Textarea`

### layout
- `CommandBar`
- `MarketingSection`
- `PageContainer`
- `Panel`
- `Stack`

### overlays
- `FullScreenPanel`
- `Modal`
- `MoveToPopover`
