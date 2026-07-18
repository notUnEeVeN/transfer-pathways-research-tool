# Prompt for a design session — AS Degrees console (bulk QA table + per-college view)

Copy everything below the line into a fresh Claude session (claude.ai or
Claude Code with design skills). It is self-contained — no repo access needed.
Paste screenshots of the current console (References tables / Prerequisites
sub-tab) alongside it if you have them; that helps a lot.

> **Real data is attached:** `docs/handoff/as-degree-design-examples.json`
> holds the actual `/api/curated/as-degrees?college_id=cc:<n>` output for three
> real colleges — Cabrillo (one clean local CS A.S.), Santa Ana (a college with
> all three degree types — the multi-degree case), and De Anza (quarter-system,
> 90-unit, AS-T + local A.A.). Wire the components to those real documents. The
> data shapes below are the actual endpoint contract; the server computes the
> derived fields (flags, rollups, joined course details), so just render them.
> **One caveat:** the `units_mismatch` flag can be naive where a school's
> catalog folds GE units into the major total without a separately captured
> GE line (see the file's `_note`) — design its UI to the field's intent
> described below.

---

I need a visual design for two connected surfaces in an internal research
console, and working React code for them. Please act as an information
designer first (propose the design, explain the reasoning), then implement.

## The product

A research tool for California community-college → university transfer
pathways. We have extracted the **local Associate of Science degree in
Computer Science** from all 115 CA community colleges' catalogs into a
structured form. Researchers now need to (a) triage the whole set at a glance
to find what needs attention, and (b) open one college and read/verify its
degree in depth. Those are the two surfaces to design.

The extraction was done by AI against a statewide template, so every group of
requirements carries **provenance**, and trust calibration is the whole point:
a reader must never mistake a machine placeholder for catalog truth, and must
instantly see what is verified vs machine-extracted vs placeholder.

Provenance per group — `source` is one of:
- `extracted` — read from the college's catalog by the AI sweep (carries a `confidence` 0–1 from multi-vote agreement),
- `template_default` — extraction failed or was low-confidence; the statewide template's group stands in as a visible placeholder (NOT real data; `confidence` is null),
- `curated` — a human corrected/confirmed it (settled; `confidence` null).

## Surface A — the bulk QA table (Data → "AS Degrees" sub-tab)

One row per college (~115 rows). This is the triage surface: sort, filter, and
scan to find the degrees that need a human. It sits alongside the console's
other dense reference tables, so it should feel of a piece with them, but it
needs richer at-a-glance signal than a plain table (status, confidence, flags).

Each row is one object from the endpoint's `rows` array:

```js
{
  college_id: 'cc:113',                 // stable id; opens the detail view
  college_name: 'De Anza College',
  status: 'found' | 'none_found' | 'ambiguous',
  degree_title_seen: 'Computer Science, A.S.',  // null when not found
  catalog_url: 'https://…',             // the exact page the data was read from
  catalog_year: '2025-2026',
  unit_system: 'semester' | 'quarter',  // quarter schools total ~90, not 60
  total_units: 60,                      // the school's own stated total; null when not found
  units_accounted: 58,                  // sum of the group units we captured (display approximation)
  group_count: 7,
  source_counts: { extracted: 6, template_default: 1, curated: 0 },
  confidence_min: 0.62,                 // lowest extracted-group confidence; null if none extracted
  confidence_mean: 0.88,                // null if none extracted
  unresolved_count: 1,                  // catalog courses we couldn't match to the course DB
  coverage_pct: 62,                     // % of the template's required components (each a
                                         // course requirement, where a choose-one counts as
                                         // satisfied by any option) this degree's courses cover;
                                         // null when the degree_type has no template
                                         // (local_computing) or the template has no required
                                         // components
  missing_core_count: 2,                // how many required concepts this degree is missing
  flags: ['template_default_groups', 'low_confidence', 'unresolved_courses'],
  verified: false,
}
```

**Flags** (the triage vocabulary — design a compact, scannable treatment):
- `ambiguous` — several catalog programs could be "the CS AS"; needs a human to pick.
- `template_default_groups` — one or more groups are placeholders, not catalog data.
- `low_confidence` — some extracted group scored below 0.7.
- `unresolved_courses` — the catalog cited courses we couldn't match to the course database.
- `units_mismatch` — captured units don't add up to the school's stated total (a found row with no free-elective group and |accounted − total| > 1).

A `none_found` row (the college genuinely offers no local CS AS — a real
research finding, not an error) has empty `flags`, `group_count: 0`, and null
degree fields. An `ambiguous` row carries the `ambiguous` flag and its
`degree_title_seen` shows the raw candidate(s) seen.

What the table must support: text search; filters (at least: all / flagged /
has-template-default / not-found / unverified); a clear read of each row's
trustworthiness (status + confidence + flags + verified) without opening it;
a units read (`units_accounted / total_units` with the unit system, handling
quarter schools without implying ~90 is "incomplete"); a source-mix read
(the extracted/template-default/curated split); a link out to the catalog;
and a click-to-open into Surface B.

### REPRESENTATIVE DATA — table rows (real, from the current dataset)
The real dataset is **199 degrees across 114 colleges** (a college contributes
one row per degree it offers). Real rows to design against — types are
`local_cs_as` / `ast` / `local_computing`, and a `degree_type` column is
needed since a college appears on multiple rows:
- **Cabrillo College** · `local_cs_as` · found · "Computer Science, A.S." · semester 60u · units_accounted 60 · confidence_min 0.95 · no flags · unverified.
- **Santa Ana College** · `local_cs_as` · found · semester 60u · units_accounted 25 · 5 unresolved courses · flags `unresolved_courses` + `units_mismatch` · unverified. *(Santa Ana also appears as `ast` and `local_computing` rows — same college, three rows.)*
- **De Anza College** · `ast` · found · **quarter 90u** · units_accounted 45.5 · confidence_min 0.97 · unverified. *(Also an `Systems Programming` `local_computing` row.)*
- **Bakersfield College** · `ast` · found · semester 60u · confidence_min 0.95 · flag `units_mismatch` (GE units not captured) · unverified.
- **Woodland Community College** · `none_found` — a real research finding (offers no CS-related associate degree); null degree fields, no flags. (One such row statewide.)

Real distributions for the table: statuses are almost all `found` (one
`none_found`); confidence clusters high (96% of degrees ≥ 0.85); the common
flags are `units_mismatch` and `unresolved_courses`; `ambiguous` is rare.
`template_default` groups do **not** occur in the current data (extraction
succeeded everywhere) — but design for them anyway (the field exists for future
low-confidence sweeps). `coverage_pct` (`local_cs_as` + `ast` rows only —
114 of 199 degrees; `local_computing` is always null) ranges 13–100%, mean
~75%; most degrees land in the 60–90% band, and a coverage_pct in the teens
is a real triage signal (a degree whose catalog courses barely overlap the
statewide core, worth a closer look).

## Surface B — the per-college detail view (opened from a table row)

Reached by clicking a row. Two jobs: **understand** a school's degree at a
glance (what's required, choose-from, how units build to the total, where it
deviates from the statewide norm), and **verify** it (open the catalog
side-by-side, correct groups — which flips them to `curated` — write a
verification note, mark verified). A subset of schools will be verified this
way for a research paper; mistakes found here are fixed here.

The detail endpoint returns one college's document plus server-joined extras:

```js
{
  doc: {
    college_id: 'cc:113', major_slug: 'cs',
    degree_title_seen: 'Computer Science, A.S.',   // exactly as the catalog prints it
    status: 'found',
    catalog_url: 'https://…', catalog_year: '2025-2026',
    unit_system: 'semester' | 'quarter',
    total_units: 60,
    verification: { verified: false, verified_by: null, verified_at: null, notes: null },
    // The requirement body reuses our transfer-agreement skeleton
    // (groups → sections → receivers → options), because the same analysis
    // engines evaluate both. For display you mostly flatten it: each RECEIVER
    // is one requirement slot; its OPTIONS are alternative ways to fill it
    // (each option = one or more courses taken together).
    requirement_groups: [
      {
        // structural (shared with agreement data)
        is_required: true,
        sections: [
          {
            section_advisement: 3,      // complete N receivers; equal to the
                                        // receiver count → all required; null
                                        // means "any one satisfies" (ASSIST)
            unit_advisement: null,      // N → "choose N units from these"
            receivers: [
              { receiving: null,        // always null for a local degree
                options: [{ course_ids: [12345], course_conjunction: 'and',
                            course_keys: ['cc:12345'] }],
                options_conjunction: 'and' },
            ],
          },
        ],
        // display/provenance
        group_id: 'core_programming',
        template_group: 'core_programming',  // === group_id when aligned to the
                                             // statewide template; null → a
                                             // school-specific EXTRA group
        label_seen: 'Required Core',         // the catalog's own heading
        source: 'extracted' | 'template_default' | 'curated',
        confidence: 0.93,                    // null unless source is 'extracted'
        ge_area: null,                       // set (e.g. 'natural_sciences') for an
                                             // open-ended GE-area group; its unit ask
                                             // is in unit_advisement, receivers may be
                                             // a sample or empty
        units_fill: false,                   // true → free-electives-to-total; no receivers
        unresolved_courses_seen: [],         // catalog citations we couldn't match:
                                             // {course_code_seen, title_seen, units_seen}
                                             // — render as visibly unlinked courses
      },
      // A `template_default` group arrives as a STUB (group_id + template_group +
      // source only, no sections). Render it as the template's group standing in,
      // clearly marked placeholder.
    ],
  },
  college_name: 'De Anza College',
  // Resolved course details for every course_key referenced above. A course id
  // may be ABSENT here (unresolved) — render the raw course_key/citation in that case.
  courses_by_id: {
    'cc:12345': { code: 'CIS 22A', title: 'Beginning Programming', units: 4.5,
                  concept: 'cs_1' },        // concept may be null (unmapped course)
  },
  // Computed server-side: which of the statewide template's required CS
  // concepts (programming, calculus, discrete, architecture, physics,
  // science) this degree's courses cover, and what's missing.
  covered_concepts: ['cs_1', 'cs_3_data_structures', 'comp_arch_assembly', 'calc_1'],
  missing_core_concepts: ['discrete_math', 'calc_2'],
  coverage_pct: 67,                    // null when degree_type has no template (local_computing)
                                        // or the template has no required concepts
}
```

Reading the structure into display flavors: no advisement = every receiver
required · `section_advisement: N` = pick N of the receivers ·
`unit_advisement: N` = pick N units' worth · `ge_area` set = N units from a
general-education area (receiver list may be a sample or empty) ·
`units_fill: true` = degree-applicable elective units up to the degree total
(degree-applicability is a regulatory constraint, not "any units").

What Surface B must do:
- **Group rendering** that makes "all of these" vs "choose 2 of these" vs
  "9 units from this area" instantly distinguishable without a legend.
- **Unit accounting**: show how the groups' units build toward the school's
  total, and make a shortfall/overage (Row 3's 54, Row 2's 61) visible.
  Handle quarter schools without implying ~90 ≠ complete.
- **Provenance treatment**: `template_default` must read as "placeholder, not
  fact" at a glance (ghosted/hatched/bordered) while staying legible;
  `curated`/verified reads as settled; `confidence` as a compact per-group
  signal, not a wall of numbers. Provenance must not be color-only (text /
  icon / pattern too).
- **Concept-coverage**: which standard CS components (programming, calculus,
  discrete, architecture, physics, science) the degree covers vs lacks, and a
  coverage %.
- **Verification workflow**: the catalog link + year prominent for
  side-by-side checking; a per-group "mark reviewed" affordance (flips
  `source` to `curated` on save); a free-text verification-notes field
  (writable only by the human — the tool never generates its text); a "mark
  verified" action.
- **Degraded states**: `none_found` (school examined, offers no CS AS — a real
  finding), `ambiguous` (multiple candidate programs — show the raw title(s)),
  and the three-placeholder-groups look of a low-confidence school.

### REPRESENTATIVE DATA — detail documents (real, in `docs/handoff/as-degree-design-examples.json`)
Use the three real documents in that file — they cover the design's hard cases:
- **Cabrillo (cc:41), `local_cs_as` — the clean case.** One local CS A.S., 6
  groups with real headings ("Recommended Major Requirements", choose-N credit
  groups, a "Computer Engineering Pathway" alternative track), 19 resolved
  courses with concepts, semester 60u, all `extracted` at high confidence,
  unverified. Good for the default reading experience.
- **Santa Ana (cc:14) — the multi-degree case.** THREE degrees on one college
  (`local_cs_as`, `ast`, `local_computing`), with `Take ALL` / `Select ONE` /
  `Select an additional SIX units` groups, 5 unresolved courses on the
  `local_cs_as` (render as unlinked citations), and `units_mismatch`. Shows how
  the detail view handles a college with several degrees and imperfect data.
- **De Anza (cc:113), `ast` + `local_computing` — the quarter case.**
  `unit_system: 'quarter'`, 90-unit totals, "Complete one option" programming
  groups, Cal-GETC GE blocks. Must not imply 90u ≠ complete.

None of the real docs currently has `template_default` groups (extraction
succeeded everywhere) or a populated `verification.notes` — design those states
from the field descriptions above (they matter for future sweeps and the
verification workflow).

## What exists around these views (context, not redesign)

The console already has: dense sortable reference tables with inline edit, a
bespoke concept-mapping QA table (badge chips, confidence display, flagged-row
filter), and a Prerequisites sub-tab with a swim-lane concept DAG. Surface A is
a new sub-tab peer to those; Surface B opens from a Surface-A row (a modal or a
routed panel — your call, argue it). Bulk triage lives in A; deep reading and
verification live in B.

## Hard constraints

- React 19 functional components, plain HTML/CSS (small SVG accents fine) —
  **no component/chart libraries**.
- Theme-aware: color ONLY via CSS custom properties with fallbacks, e.g.
  `background: var(--color-surface, #fff)`. Available semantic vars:
  `--color-surface`, `--color-canvas`, `--color-border`,
  `--color-border-strong`, `--color-ink`, `--color-ink-subtle`,
  `--color-primary` (dark forest green), `--color-accent` (lime),
  `--color-success`, `--color-danger`. (A `--color-warning`-style amber may
  not exist — if you need a caution color, derive it or reuse `--color-accent`;
  don't assume a var not listed here.) Geometry/spacing may be inline.
- Accessibility: provenance and flags must not be color-only (badge
  text/icons/patterns too); everything keyboard reachable; no hover-only
  information.
- Container ~1350px wide; pages may scroll vertically.
- Editing affordances can be visually designed as stubs (the console already
  has the save wiring): per-group "mark reviewed" that flips `source` to
  `curated` on save; the free-text verification-notes field (human-authored
  only); a "mark verified" action. Do NOT design a UI that generates note text.

## Deliverable

1. A short design rationale: the layout model for each surface, how
   provenance/trust is encoded, how the unit accounting reads, and whether B
   is a modal or a routed panel (with reasoning).
2. Complete, drop-in React component code (single file per surface, no external
   deps), wired to the representative data (or the real data pasted in) so it
   runs standalone; I'll adapt the data plumbing.
3. Trade-offs and what to tweak if a school has many groups (10+) or very long
   course lists, and how Surface A behaves at 115 rows.
```
