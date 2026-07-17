# Prompt for a design session — per-college AS Degree view

Copy everything below the line into a fresh Claude session (claude.ai or
Claude Code with design skills). It is self-contained — no repo access needed.
Paste screenshots of the current References tables / Prerequisites sub-tab
alongside it if you have them; that helps a lot.

> **Before using:** replace the "REPLACE AT HANDOFF TIME" section with 2–3
> real extracted documents from `scripts/data/as_degrees_cs.json` — ideally
> one clean template match, one deviation-heavy school, and one
> low-confidence school with `template_default` groups. Real docs match the
> data shape below (they may carry extra bookkeeping fields — `_id`, `kind`,
> `extraction` — which the design can ignore). Until then, that section holds
> prose descriptions of three representative schools, not actual documents.

---

I need a visual design for a "degree requirements" panel in an internal
research console, and working React code for it. Please act as an information
designer first (propose the design, explain the reasoning), then implement it.

## What the view is

A research tool for California community-college → university transfer
pathways. We have extracted the **local Associate of Science degree in
Computer Science** from all 115 CA community-college catalogs into a
structured form: a list of requirement groups (required core courses, choose-N
groups, general-education areas with unit minimums, electives) that add up to
the degree's total units (60 semester or ~90 quarter).

Extraction was done by AI against a statewide template, so every group carries
**provenance**: `source` is one of

- `extracted` — read from the college's catalog by the AI sweep,
- `template_default` — extraction failed or was low-confidence; the statewide
  template's group was copied in as a visible placeholder (NOT real data),
- `curated` — a human corrected/confirmed it,

plus a `confidence` score (0–1, from multi-vote agreement). A researcher uses
this view for two jobs:

1. **Understand a school's degree at a glance** — what's required, what's
   choose-from, how the units add up to the total, and where this school
   deviates from the statewide template.
2. **Hand-verify a school** — open the catalog URL side-by-side, correct
   groups (which flips them to `curated`), write a verification note, and mark
   the school verified. A subset of schools will be verified this way for a
   research paper; mistakes found here are fixed here.

Trust calibration is the whole game: a reader must never mistake a
`template_default` placeholder for catalog truth, and must immediately see
which parts of a page are verified vs machine-extracted vs placeholder.

## The data shape

The component receives one college's document plus two server-provided
extras: a display `college_name` (joined from the institutions table) and a
computed `deviations` summary.

```js
{
  college_name: 'De Anza College',        // display name, joined server-side
  major_slug: 'cs',
  degree_title_seen: 'Computer Science, A.S.',  // exactly as the catalog prints it
  status: 'found' | 'none_found' | 'ambiguous',
  catalog_url: 'https://…',               // the page the data was read from
  catalog_year: '2025–2026',
  unit_system: 'semester' | 'quarter',    // quarter schools total ~90, not 60
  total_units: 60,
  verification: { verified: false, verified_by: null, verified_at: null,
                  notes: null },
  groups: [
    {
      group_id: 'core_programming',
      template_group: 'core_programming', // === group_id when aligned to the
                                          // statewide template; null → this is
                                          // a school-specific EXTRA group
      label_seen: 'Required Core',        // the catalog's own heading
      source: 'extracted' | 'template_default' | 'curated',
      confidence: 0.93,                   // null unless source is 'extracted'
      type: 'all' | 'choose_courses' | 'choose_units' | 'ge_area' | 'units_fill',
      choose_n: 1,                        // only for choose_courses
      units_min: 3,                       // only for choose_units / ge_area
      ge_area: 'natural_sciences',        // only for ge_area groups
      courses: [
        { course_code_seen: 'CIS 22A',    // as the catalog prints it
          title_seen: 'Beginning Programming', units: 4.5,
          assist_course_id: 'cc:12345',   // link to the statewide course db; may be null
          concept: 'cs_1' },              // concept may be null (unmapped course)
      ],
    },
  ],
  // Computed server-side and passed in: which template groups are missing at
  // this school, and which groups are school-specific extras.
  deviations: { missing_groups: ['core_systems'], extra_groups: ['ethics'] },
}
```

Group semantics: `all` = every course required · `choose_courses` = pick
`choose_n` from the list · `choose_units` = pick `units_min` units from the
list · `ge_area` = `units_min` units from a general-education area (courses
list may be a sample or empty) · `units_fill` = degree-applicable elective
units up to the degree total (not just any units — degree-applicability is a
regulatory constraint).

## REPLACE AT HANDOFF TIME — representative documents

*(Mock data with the right shape; swap in 2–3 real schools before running
this prompt.)*

**School A — clean, high-confidence semester school:** 7 groups, all
`extracted` with confidence ≥ 0.9, groups align 1:1 with the template, units
sum exactly to 60, not yet verified.

**School B — deviation-heavy school:** required core has an extra
school-specific group (`template_group: null`) "Computer Ethics (3 units)",
the template's `core_systems` choose-1 group is missing entirely, one course
carries `concept: null`, total units 61. Two groups already `curated`,
verification note present, marked verified.

**School C — low-confidence quarter school:** `unit_system: 'quarter'`,
`total_units: 90`, three of seven groups are `template_default` placeholders
(confidence null), the rest `extracted` at 0.55–0.7. Not verified. This page
should look visibly less trustworthy than A and B.

Also design the two non-`found` states: `none_found` (school examined, offers
no CS AS — a real research finding, not an error) and `ambiguous` (multiple
candidate programs; show the raw title(s) seen).

## What exists around this view (for context, not redesign)

The console already has: dense sortable References tables with inline edit, a
bespoke concept-mapping QA table (badge chips, confidence display, flagged-row
filter), and a Prerequisites sub-tab with a swim-lane concept DAG. This new view is a
**per-college sub-tab** reached from a college's page — one school at a time.
Bulk triage stays in the References table; this page is for reading one degree
deeply and verifying it.

## Hard constraints

- React 19 functional components, plain HTML/CSS (SVG fine for small
  accents) — **no component/chart libraries**.
- Theme-aware: color ONLY via CSS custom properties with fallbacks, e.g.
  `background: var(--color-surface, #fff)`. Available semantic vars:
  `--color-surface`, `--color-canvas`, `--color-border`,
  `--color-border-strong`, `--color-ink`, `--color-ink-subtle`,
  `--color-primary` (dark forest green), `--color-accent` (lime),
  `--color-success`, `--color-danger`. Geometry/spacing may be inline.
- Accessibility: provenance must not be color-only (badge text/icons/patterns
  too); everything keyboard reachable; no hover-only information.
- Container ~1350px wide; the page may scroll vertically as needed.
- Editing affordances can be visually designed as stubs (the wiring exists in
  the console): per-group "edit" that flips source to `curated` on save, a
  free-text verification-notes field (writable only by the human — the tool
  never generates its text), and a "mark verified" action.

## What I'd like you to explore (designer's judgment welcome)

- **Group rendering:** cards vs. a structured outline vs. a table per group —
  what makes "all of these" vs "choose 2 of these" vs "9 units from this
  area" instantly distinguishable without reading legends?
- **Unit accounting:** a way to see how the groups' units build toward the
  school's total (and spot when they don't — School B's 61). Possibly a
  slim stacked bar or running tally; must handle quarter schools without
  implying 90 ≠ complete.
- **Provenance treatment:** `template_default` needs to read as
  "placeholder, not fact" at a glance (ghosted? hatched? bordered
  differently?) while staying legible; `curated`/verified should read as
  settled. Confidence as a compact per-group signal, not a wall of numbers.
- **Deviation highlighting:** missing-template-group and extra-local-group
  callouts that make "how does this school differ from the norm?" answerable
  in seconds.
- **Verification workflow:** the catalog link, per-group corrections, note
  field, and verified toggle arranged so side-by-side checking against the
  live catalog is comfortable.
- **The degraded states:** `none_found`, `ambiguous`, and the
  three-placeholder-groups look of School C.

## Deliverable

1. A short design rationale (layout model, how provenance/trust is encoded,
   how the unit accounting works).
2. Complete, drop-in React component code (single file, no external deps)
   implementing it, wired to standalone documents — either the real ones
   pasted into the REPLACE section, or mock documents you construct to match
   the School A/B/C descriptions there; I'll adapt the data plumbing.
3. Note any trade-offs and what to tweak if a school has many groups (10+)
   or very long course lists.
