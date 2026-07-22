# AS-degree hand-validation tool (W3) — design

**Date:** 2026-07-22 · **Status:** approved
**Roadmap:** `2026-07-22-expansion-roadmap.md` — sub-project W3.
**Runs in parallel with F** — see the roadmap's parallel-execution section for
branch and conflict-surface rules.

## Goal

Let the research partner deeply validate AS degrees for a selected subset of
community colleges, correcting the AI-extracted structure until it is
verified — **inside the common data structure**, so every algorithm
(transfer-credit rate, coverage, planners) runs on corrected docs unchanged.

Two editing paths, both writing through the existing validated endpoint
`PUT /api/curated/requirements/as_degree` (whole-doc replace with server-side
`validateAsDegree` and `curated_by`/`curated_at` stamping):

1. **Structured editor** (the reliable core): form-based editing of the doc's
   requirement groups, sections, and courses, with course pickers bound to the
   college's real catalog (`assist_courses`).
2. **AI assist**: the partner describes the problem in English; the server
   asks Claude to produce a corrected doc; the partner reviews a group-level
   diff and approves; the approved doc goes through the same PUT.

## Non-goals

- No new data collections and no schema changes beyond one new settings doc
  (the validation cohort). The `as_degree` shape is untouched.
- No changes to templates (`as_degree_template`) or the extraction pipeline.
- CS-only for now; the tool reads `major_slug` from the doc so it works for
  future majors without change (F provides the major dimension).
- Verification *notes* remain user-authored (Tybalt's convention) — the tool
  never generates prose notes; AI output is structural only.

## Architecture

### 1. Validation cohort (which colleges are "in the deep-validation set")

- Storage: one doc in the audit-handle `settings` collection:
  `{ _id: 'as_degree_validation', college_ids: [Number], updated_by, updated_at }`.
- Server service `server/services/asDegreeValidation.js` +
  `GET/PUT /api/curated/as-degree-validation-cohort` (guarded like other
  curated routes; any console user can edit — team state, like tasks).
- The GET joins cohort membership with the existing availability/overview data
  (`asDegreeView.js`) to return per-college progress: docs total, groups
  reviewed (`source === 'curated'` or group-level reviewed marks), docs
  verified (`verification.verified`).

### 2. Validation dashboard (frontend)

New files under `frontend/src/asdegrees/validation/` (isolated directory —
minimal merge surface with F):

- `ValidationDashboard.jsx` — cohort list with per-college progress bars
  (degrees found / groups curated / verified), cohort editing (add/remove
  colleges via the existing colleges list), and entry into the editor.
  Mounted from the existing AS-degrees pane with a one-line addition.
- Progress semantics come from existing provenance: a doc is "done" when
  `verification.verified` is true; group progress counts groups whose
  `source` is `curated` or that carry the existing reviewed marks.

### 3. Structured editor

`frontend/src/asdegrees/validation/AsDegreeEditor.jsx` (+ small child
components). Loads the college's docs via the existing
`useAsDegreeDetail(collegeId)`; mirrors the save contract used by
`AsDegreeDetailModal` (`useSaveAsDegree` → whole-doc PUT).

Editing capabilities, constrained by the server validator's rules:

- Doc-level: `status` (found / none_found / ambiguous), `degree_title_seen`,
  `catalog_url`, `catalog_year`, `unit_system`, `total_units`.
- Groups: add / remove / reorder / rename (slug-safe `group_id`), per-group
  `ge_area`, notes on `unresolved_courses_seen`.
- Courses within groups: pickers bound to that college's `assist_courses`
  rows (`useCcCourses`), honoring the agreement-skeleton shape the golden
  engines evaluate.
- **Provenance rule (hard):** any human edit sets that group's
  `source: 'curated'` and clears `confidence` (the validator requires
  confidence null unless source is extracted) and stamps per-group curated
  fields; the server already stamps doc-level `curated_by`/`curated_at`.
- Verification: mark-group-reviewed, and a doc-level "Verified" toggle
  writing `verification.verified` (plus who/when inside the object).

### 4. AI assist

- Server: `POST /api/curated/as-degrees/:id/assist` with body
  `{ instruction: string }`. The service (`server/services/asDegreeAssist.js`):
  1. Loads the current doc + the college's course catalog (codes/titles/units)
     + the doc's template.
  2. Calls Claude (official `@anthropic-ai/sdk`, model `claude-opus-4-8`,
     structured output via `output_config.format` json_schema) with a system
     prompt defining the exact `as_degree` schema rules (mirroring
     `validateAsDegree`) and the instruction; response schema:
     `{ proposed_doc, changes: [{group_id, kind, summary}] }`.
  3. Runs the proposed doc through the **same server-side `validateAsDegree`**;
     invalid proposals are retried once with the validation error appended,
     then rejected with a clear message.
  4. Returns `{ proposed_doc, changes }` — **nothing is saved**.
- Frontend: `AiAssistPanel.jsx` inside the editor — instruction box, proposed
  changes rendered as a group-level before/after diff, Approve / Discard.
  Approve submits the proposed doc through the normal `useSaveAsDegree`
  path (with the same source→curated stamping), so AI edits are
  indistinguishable from hand edits in provenance except a
  `curated_via: 'ai_assist'` marker on affected groups.
- Config: `ANTHROPIC_API_KEY` on the server env; endpoint returns 503 with a
  friendly message when unset. Requests are logged (uid, doc id, instruction)
  to the console log only — no new collection.

## Error handling

- PUT failures surface the validator's message verbatim in the editor (they
  are written to be human-readable).
- AI assist: model refusal / invalid JSON / validation failure after retry →
  400 with the reason; the editor shows it and keeps the instruction text.
- Concurrent edits: whole-doc replace, last-write-wins (same as the existing
  QA modal); the editor warns if `updated_at` changed since load.

## Testing

- Server: cohort service CRUD; assist service with a mocked Anthropic client
  (valid proposal path, invalid-then-retry path, no-API-key path).
- Frontend: editor renders a real fixture doc (reuse
  `_degree_*.fixture.json` patterns), edit→save payload carries
  `source: 'curated'` + null confidence; AI panel renders a diff from a
  mocked assist response and PUTs the proposed doc on approve.
- Golden invariant: no existing test changes; `RequirementsLedger` and QA
  views are untouched.
