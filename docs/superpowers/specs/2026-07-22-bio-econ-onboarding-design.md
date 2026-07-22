# Biology + Economics onboarding (W1) — design / runbook

**Date:** 2026-07-22 · **Status:** approved direction
**Roadmap:** `2026-07-22-expansion-roadmap.md` — sub-project W1.
**Depends on F** (major-dimension foundation) for everything UI-facing; the
data-gathering steps can start immediately and should be tracked as W4
preset tasks.

W1 is mostly **data and curation work**, not code. This doc is the runbook a
weaker model (or a research mate) follows per major; the only code artifacts
are config entries and regenerated snapshots. Scope decision (locked):
**articulation core only** — no AS-degree layer, no paper baselines, and
**no hand-gathered transfer minimums** for new majors (ASSIST-driven end to
end).

## Per-major onboarding runbook

Repeat for `bio`, then `econ` (later `ai`). Every step lands in existing
collections — no new storage.

### Step 1 — Choose canonical program pins (curation, Tybalt)

For each of the 9 UCs, decide which ASSIST program(s) count as this major
(e.g. Berkeley biology: MCB vs Integrative Biology — pick, alternates
allowed). Record the EXACT ASSIST program strings. This mirrors what
`PAPER_MAJORS` did for CS and goes into the config in Step 3.

Deliverable: a 9-campus pin table (program strings verbatim, including any
odd whitespace ASSIST stores).

### Step 2 — Port the data

On the admin machine: `python scripts/port.py add "<program name>"` per
pinned program per campus (the existing incremental pipeline; preserves
`_id`/`hash_id` for verdict merge-back). Verify in Admin → Dataset that the
new (school, major) rows appear with sane agreement counts.

### Step 3 — Add the majors config entry (code, post-F)

Add the entry to `server/config/majors.js` (shape defined in the F spec):
slug, label, `match` string, `programs` pins from Step 1, `categories` +
`coursePatterns` from Step 4, `conceptDisciplines`, and capabilities
`{ asDegrees: false, paperBaselines: false, transferMinimums: false,
snapshots: [] }`. This single entry is what makes the major appear in every
picker.

Suggested starting vocabularies (validate against the actual ported degree
templates before locking):

- **bio** categories: `calculus`, `statistics`, `gen_chem`, `organic_chem`,
  `bio_series`, `physics`, `other_science`, `non_stem`; axes
  `bio/chem/math/physics/non_stem` mapped onto the broad axes the figures
  expect. `conceptDisciplines`: math, chem, bio, physics, stats.
- **econ** categories: `micro_principles`, `macro_principles`, `calculus`,
  `statistics`, `other_math`, `other_social`, `non_stem`.
  `conceptDisciplines`: math, stats, other.

### Step 4 — Category mapping curation

The category-gap figure needs `curated_mappings` `course_category` rows for
the new major's UC receiving courses (keyed by university course id, now
carrying `major_slug`). Work through the ported agreements' receivers in the
existing Data-tab mapping UI. Concept tags for CC courses
(`assist_courses.concept`) extend the same way where the concept graph needs
new nodes (`bio`/`stats` disciplines already exist in
`prereq_concept` — add concepts like `gen_chem_1`, `bio_1` following the
locked acyclic-rules conventions).

### Step 5 — Degree templates (9 per major, hand-gathered)

For each campus, author a `curated_requirements` `kind:'degree'` doc for the
pinned program, following the established verification conventions from the
CS pass (source URL, IGETC lens, unit closure, ordering, keep-unresolved).
This is the slowest step — create one W4 "Degree template gathering" preset
task per campus × major so progress is visible on the board.

Note: degree templates power the whole-degree coverage views. The
articulation-core analyses (coverage/credit-loss/choice-cost/complexity/
planners) work from agreements alone, so they light up after Step 3 —
templates can trail without blocking launch.

### Step 6 — Admin enablement + QA

- Admin → visible majors: check the new major's campuses (multi-major grid
  from F).
- QA sweep: pick 3 CCs (large/small/quarter-system) and spot-check the CC
  page agreements view, coverage heatmap, credit-loss, and choice-cost under
  the new major against ASSIST.org by hand. Record findings as task notes.

### Step 7 — Snapshots (optional, later)

When district/portfolio analyses are wanted for the major:
`npm run snapshot:district-pathways -- --major bio` etc. (slug-aware
generators from F Task 8), producing `<name>.bio.v1.json`. Add the snapshot
names to the major's `capabilities.snapshots`.

## Definition of done (per major)

- Config entry present; major selectable everywhere the capability allows.
- All 9 campuses' pinned agreements ported and visible.
- Category vocab + mappings sufficient for category-gap and course-type
  figures to render without "uncategorized" dominating.
- 9 degree templates authored (may trail launch).
- QA sweep recorded; discrepancies filed as tasks.
