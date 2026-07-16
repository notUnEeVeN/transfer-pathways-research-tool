# Prerequisite concept graph — design

**Date:** 2026-07-15
**Status:** approved (design review with Tybalt, 2026-07-15)

## Problem

Term-by-term sequencing and full-scale curricular-complexity metrics both need a
prerequisite graph over community-college courses. Today the only prerequisite
data is `curated_prerequisites`: 230 hand-gathered rows across 16 colleges,
inherited from the previous group. It covers 177 of the 4,749 distinct CC
courses that appear in agreement options (3.7%), which caps
`prereq_data_coverage_pct` in `complexityData` and blocks both consumers.

There is no algorithmic source for prerequisites: ASSIST course data carries no
descriptions and no prerequisite text — only `PREFIX NUMBER — Title (units)`
plus GE tags. Colleges also genuinely differ (some allow calc 2 → linear
algebra, some require calc 3), so per-college catalog truth is expensive,
inconsistent, and unnecessary for analysis-internal consumers.

## Decision summary

| Decision | Choice |
|---|---|
| Consumers | Term-by-term sequencing (future analysis) + complexity metrics at all 115 colleges |
| Semantic model | Normative **concept layer + mechanical projection**, not descriptive per-college edges |
| Mapping storage | Fields on `assist_courses` docs (part of the course's definition) |
| Rules storage | New `curated_requirements` kind `prereq_concept` |
| Projection | Computed at read time (no materialized copy) |
| LLM pipeline | In-session Claude Code agent runs producing a git-committed JSON artifact; **no LLM SDK/API key in the repo** |
| Old 230 rows | Reference signal only (previous group's work, not golden); demoted to legacy, used for a disagreement report |
| Verification | Tiered: rule set reviewed exhaustively; mapping reviewed via conflicts + flagged rows + random n=100 error-rate sample |
| Frontend | References editors (concepts, mapping) + prerequisite graph view. No dedicated review-queue UI, no dashboard |
| Scope | CC (sending) side only for v1; seed set = courses appearing in agreement options for ported majors |

## Grounded numbers (local `pmt_research` copy, 2026-07-15)

- 2,415 agreements; all 115 colleges represented.
- **4,749 distinct CC course ids** in agreement `options[].course_ids`; 4,730
  exist in the catalog (19 phantom references — reported, never mapped).
- 230 distinct UC `parent_id`s across all agreement receivers.
- Legacy `curated_prerequisites`: 230 rows, 177 overlapping the in-scope set.
- Expected concept vocabulary: ~40–70 concepts.

## 1 · Data model

### 1A. Concept vocabulary + rules — `curated_requirements`, kind `prereq_concept`

One doc per concept; the canonical rule set is the `requires` adjacency list on
each doc. Follows the polymorphic curated_requirements pattern
(`_id = '<kind>:<legacy_id>'`, `legacy_id`, `kind` on every row).

```js
{
  _id: 'prereq_concept:calc_2',
  kind: 'prereq_concept',
  legacy_id: 'calc_2',
  slug: 'calc_2',                  // ^[a-z0-9_]+$
  name: 'Calculus II',
  discipline: 'math',              // math|physics|chem|cs|bio|engr|stats|other
  requires: ['calc_1'],            // slugs of prerequisite concepts — THE rules
  note: '',                        // records normative calls, e.g. 'conservative:
                                   // some colleges allow calc_2 → linear_alg;
                                   // we require calc_3 statewide'
  source: 'llm_session_v1',        // or 'hand_curated' for console-authored rows
  updated_at, curated_by, curated_at,
}
```

Write validation (kind-specific, in `CanonicalData.putRequirement` /
`deleteRequirement`):
- `slug` matches `^[a-z0-9_]+$` and equals `legacy_id`.
- every entry in `requires` references an existing concept slug.
- the full concept set must remain **acyclic** after the write (cycle check
  server-side; 400 with the offending cycle path on violation).
- deleting a concept that other concepts `require`, or that any course maps to,
  is a 400 with a count of the referencing rows.

### 1B. Course→concept mapping — fields on `assist_courses` (side `sending`, v1)

Part of the course's definition, same pattern as `igetc_area` /
`uc_transferable`:

```js
{
  ...existing course fields,
  concept: 'calc_2' | null,        // null = examined, no pathway concept applies
  concept_source: 'llm_session_v1' | 'console_edit',  // ABSENT = never examined
  concept_confidence: 0.0–1.0,     // agent vote agreement (1.0 for human edits)
  concept_title_seen: 'Calculus II with Analytic Geometry',  // title at classification time
  concept_note: '',
  concept_curated_by: <uid> | null,  // HUMAN ONLY — machines never stamp this
  concept_curated_at: <date> | null,
}
```

Semantics:
- `concept_source` absent → the course was never examined (coverage gap).
- `concept: null` with `concept_source` present → examined, deliberately
  unmapped (not a pathway concept).
- `concept_curated_by` set → human judgment; imports must never overwrite
  (the `import_prerequisites.py` convention).

**Durability across ports** (two mechanisms, both required):
1. `scripts/data/course_concepts.json` — the git-committed generated artifact.
   Header `meta` block: session date, model id, vote protocol, measured
   error rate from the QA sample, vocabulary version. Rows:
   `{course_id, institution_id, concept, confidence, title_seen, flags[]}`.
   Applied by `scripts/import_course_concepts.py`, which skips rows whose
   live doc has `concept_curated_by` set and warns when the live title differs
   from `title_seen` (staleness signal).
2. `server/scripts/migrateCanonicalSchema.js` — the course build currently
   discards existing canonical docs whenever legacy source rows exist
   (`importedCourses.length ? importedCourses : existingCourses`, ~line 257).
   Extend it to merge `concept*` fields from `existingCourses` by `_id` into
   the rebuilt sending-course docs, so console edits survive ports without
   re-running the importer.

### 1C. Legacy `curated_prerequisites`

Kept as-is (previous group's reference data). No analysis consumes it after
this project. Used once to generate the disagreement report (§6 QA), and
available in the console References table as today. Retirable later.

## 2 · Projection semantics

Per-college edges are **derived at read time, never stored**:

- At college C, course X requires course Y iff `concept(X).requires` contains
  `concept(Y)` and C offers a course mapped to `concept(Y)`.
- **Transitive fallback:** if C offers no course for a required concept, fall
  through to that concept's own `requires` (recursively). A college without a
  linear-algebra course still yields diff_eq ← calc_3.
- Multiple courses at C map to the same required concept → edges to each
  (consumers treat them as alternatives; `same_as` handling already exists in
  the eligibility engine).
- Cross-listed courses (`same_as`) are classified independently; peers with
  differing concepts are flagged in QA (and at import time).
- Phantom agreement course ids (not in catalog) are reported in `stats`, never
  projected.

Implementation: new service `server/services/prereqGraph.js` exporting
`projectPrereqGraph(db, { collegeId })` → `{ concepts, rules, courses, edges,
stats }` and a lower-level `edgesForCollege(conceptDocs, courseDocs)` used by
`complexityData`.

**Consumer switch:** `complexityData` (`server/services/analysis/pathways.js`
~1233) stops reading `curated_prerequisites` and uses the projection.
`prereq_data_coverage_pct` becomes % of pathway courses with `concept_source`
present (examined), reported across all 115 colleges. Note the current read is
from the **audit** handle; the projection reads concepts from
`curated_requirements` and tags from `assist_courses`, both on the **main**
handle — this removes a cross-handle inconsistency rather than adding one.

## 3 · Endpoints

House conventions: `{rows}` for lists, bare object for computed views,
`{ok, id}` for writes, `{error: '<message>'}` failures, jsonBody per-route,
guarded stack (`authenticateToken, requireAuditAccess, userLimiter`).

| Endpoint | Handler | Notes |
|---|---|---|
| `GET /api/curated/requirements?kind=prereq_concept` | existing `listRequirements` | just extend `REQUIREMENT_PREFIX` |
| `PUT /api/curated/requirements/prereq_concept` | existing `putRequirement` + kind-specific validation (§1A) | `{ok: true, id: 'prereq_concept:<slug>'}` |
| `DELETE /api/curated/requirements/prereq_concept/:id` | existing `deleteRequirement` + referential check (§1A) | |
| `PUT /api/assist/courses/:id/concept` | new `CanonicalData.putCourseConcept` | body `{concept: <slug|null>, note?}`; 400 unknown slug; 404 unknown/receiving course; stamps `concept_source: 'console_edit'`, `concept_confidence: 1.0`, `concept_curated_by/at`; `{ok: true, id}`. Mirrors the `PUT /assist/institutions/:id` enrichment pattern |
| `GET /api/curated/prerequisite-graph?college_id=cc:4` | new `CanonicalData.prerequisiteGraph` (or its own thin controller) → `prereqGraph.js` | without `college_id`: concept-level DAG `{concepts, rules, stats}`; with: adds `{courses, edges}` for that college. `stats`: in-scope count, examined %, mapped %, edge count, legacy-agreement % (when the college has legacy rows), phantom ids |

The mapping References table reads the graph endpoint's per-college `courses`
array (which already carries concept fields and the in-scope determination) —
a plain `/assist/courses` list cannot know which courses are in scope. The
concept PUT itself accepts **any** sending course, so out-of-scope courses can
still be mapped manually when useful (e.g. extending a chain by hand).

## 4 · Frontend

### References editors (Data → References rail)

1. **Course concepts** — registry entry over the `prereq_concept` kind, reusing
   the generic requirement-kind plumbing (`REQUIREMENT_KIND` map in
   `useData.js`, `REFERENCE_TABLES` entry, `RefRowModal`). `requires` edits as
   a tags field; columns: slug, name, discipline, requires, source.
2. **Concept mapping** — table backed by `/assist/courses` + the concept PUT
   (the `community_college_geography` precedent for non-requirement-backed
   tables). Columns: college, code, title, concept, confidence, source.
   Filters: college (Combobox), concept (select), unmapped-only toggle, text
   search. Editing: searchable concept select in the row editor. Provenance
   shown read-only.

### Prerequisite graph view (new Data sub-tab "Prerequisites")

SubNav tab in `DataPage.jsx` with a `DATA_TAB_ROUTES` RouteHint →
`/api/curated/prerequisite-graph`.

- **Concept DAG**: hand-built layered SVG (no chart library, per repo
  convention). Topological depth = column; nodes colored by discipline via
  token classes (color in classes, geometry inline — the `chartBits`
  philosophy); every mark gets `title`/`aria-label`; a rules table renders
  alongside so nothing is hover-only.
- **Per-college view**: college picker (Combobox) → projected graph with real
  course codes on nodes; hollow nodes where a concept has no course at that
  college; `StatStrip` above (in-scope courses, examined %, edges,
  legacy-agreement % when applicable).

## 5 · Generation pipeline (in-session, no LLM in the repo)

Run in Claude Code with parallel agent workflows. Four phases:

1. **Vocabulary draft.** Agents cluster the 230 UC receiving courses and the
   4,749 in-scope CC courses (from the local DB copy) into a proposed concept
   vocabulary + rule set. Tybalt reviews **exhaustively** — the rule set is the
   model; normative calls (e.g. "linear_alg requires calc_3 statewide,
   conservative") are made here and recorded in concept `note`s.
2. **Classification.** Courses batched **by subject-prefix pattern across
   colleges** (consistency beats per-college batching). Each course classified
   independently by 2 agents from `PREFIX NUMBER — Title (units)` + college
   name. Agreement → confidence 1.0; disagreement → third tie-break vote
   (2-of-3 → 0.67) or flag for human review.
3. **QA.**
   - Disagreement report vs the legacy 177-course overlap: project our edges
     for those courses, diff against legacy `prerequisite_ids`; each conflict
     gets an ours-right / theirs-right verdict from Tybalt (legacy data is not
     golden — previous group's work).
   - Flagged-row queue (vote splits, ambiguous titles, `same_as` peers with
     differing concepts) reviewed by Tybalt.
   - Random n=100 sample independently judged by Tybalt; the measured error
     rate is recorded in the artifact `meta` so the dataset ships with an
     honest quality number.
4. **Artifacts + import.** Two committed data files, one importer:
   `scripts/data/prereq_concepts.json` (vocabulary + rules, seeded into
   `curated_requirements`) and `scripts/data/course_concepts.json` (the
   mapping, stamped onto `assist_courses`), both applied by
   `scripts/import_course_concepts.py` (`import_ge_reference.py`-style,
   concepts first so mapping validation can check slugs). Document the
   **re-run procedure** in `docs/` for when new majors introduce unmapped
   courses (enumerate courses with `concept_source` absent, classify only
   those, append to the artifact).

Provenance rules honored throughout: machines never write `concept_curated_by`;
error-rate/methodology metadata lives in the artifact `meta`, **never** in
`verification_notes` (user-authored only, hard rule).

## 6 · Testing

- `prereqGraph.js` unit tests: direct edges, transitive fallback, multi-course
  concepts, `same_as`, cycle guard, phantom ids, empty-college.
- Acyclicity + referential-integrity validation tests for the
  `prereq_concept` write path.
- Migration carry-forward test (concept fields survive a rebuild) against the
  `pmt_research_smoke` pattern used by existing migration tests.
- `complexityData` fixture updates: concept-tagged courses replace
  `curated_prerequisites` seeding; metric values re-golden-ed.
- Frontend: co-located Vitest for both References tables (registry render,
  edit round-trip) and a graph-view smoke test (renders nodes/edges from a
  fixture payload).
- Verification per repo convention: `/verify` drive of the console (References
  edit → graph view reflects it; complexity analysis renders with new
  coverage) before any commit.

## 7 · Out of scope (explicit)

- The term-by-term sequencing **analysis** itself — a follow-up consumer of
  this graph.
- UC-side (receiving) prerequisites — the same fields work on
  `side: 'receiving'` docs when wanted; nothing here precludes it.
- Anything student-facing; per-college catalog fidelity as a goal.
- Heatmap color-range rework and other deferred items (tracked elsewhere).

## Rejected alternatives

- **Descriptive per-college LLM edge inference** (~10k+ individually-wrong-able
  claims, colleges genuinely differ, unverifiable at scale) — rejected in
  design review; consumers need a consistent partial order, not catalog truth.
- **Repo-owned batch classification script calling the Anthropic API** —
  rejected to keep the repo LLM-free (no SDK, no key management, no prompt
  versioning); generation is an in-session task producing reviewable
  artifacts.
- **Materialized projection into `curated_prerequisites` shape** — rejected:
  second source of truth, needs re-projection hooks on every rule/mapping
  edit; computed projection is a trivial join over data consumers already
  load.
- **Treating legacy 230 rows as golden validation** — softened to "reference
  signal with per-conflict verdicts": the data is the previous group's and
  unverified by us.
