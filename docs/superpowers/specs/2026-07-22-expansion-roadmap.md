# Expansion roadmap — majors, states, validation tooling, tasks v4

**Date:** 2026-07-22 · **Status:** approved direction
**Owner:** Tybalt · **Execution model:** Fable writes specs + implementation
plans; weaker models execute the plans task-by-task.

This is the master map for the next phase of the research console. Five
sub-projects, each with its own spec → plan → implementation cycle. This doc
records what each one is, the decisions already made, and the dependency
order — so any session can orient without re-deriving context.

## Why now

The porting/validation phase is complete: all 9 UC CS degree templates are
verified, the CA paper figures are replicated, the MA figures recreated, and
the new district-portfolio and income-access analyses exist. The next phase
broadens the *dimensions* of the dataset: more majors (Biology, Economics,
later AI), eventually more states (Massachusetts), deep hand-validation of
AS degrees for selected colleges, and a task system that supports this work.

## The five sub-projects

### F — Major-dimension foundation (first; spec approved)

Make "major" a first-class, selectable dimension everywhere it is currently a
hardcoded CS constant. After F, the app is pixel-identical for CS, but
onboarding a new major is a data + config exercise with no code hunt.

- Spec: `2026-07-22-major-dimension-foundation-design.md` (same folder).
- Key decisions: per-major metadata lives in a **code config module**
  (`server/config/majors.js`) served via `GET /api/majors` — no new Mongo
  collection, no mirrored client constants. Major selection is **contextual
  per page** (CC agreements view, UC degree view, prereqs, audit scope, each
  analysis), not a global mode switch.

### W1 — Biology + Economics onboarding

Port and configure the two new majors. Mostly data work, executed through
task presets (see W4):

- `scripts/port.py add "<major>"` per campus program (agreements + catalogs
  into `assist_agreements` etc. — existing pipeline, no new collections).
- Choose the canonical program pin per campus per major (e.g. which Berkeley
  biology program counts as "Biology") — a curation decision recorded in the
  majors config.
- Hand-gather ~18 degree templates (9 campuses × 2 majors) into
  `curated_requirements` `kind:'degree'` docs, using the established
  verification conventions (sources, unit closure, ordering).
- Author per-major course-category vocab + course-code patterns (bio: gen
  chem, organic chem, bio series, physics, calculus; econ: micro/macro
  principles, calc, stats) in the majors config.
- Extend prereq concepts where needed (the concept graph already has `bio`
  and `stats` disciplines).
- Generate per-major snapshots where wanted (district portfolio etc.).

**Scope decision (made):** Bio/Econ launch with the **articulation core**
only — coverage, credit loss, choice cost, complexity, category gaps,
heatmaps, multi-campus/district planners. The AS-degree layer and the
paper-baseline comparison figures stay CS-only until that per-major data
exists. **Transfer minimums are NOT hand-gathered for new majors** — new
majors are ASSIST-driven end to end; the existing minimum-based CS views
stay untouched.

### W2 — Comparison layer + state dimension

Two halves:

1. **Cross-major comparison visuals** (after W1): same measure, majors
   side-by-side — e.g. coverage heatmap deltas CS vs Bio, credit-loss curves
   per major, category-gap fingerprints. Design question for its spec:
   which comparisons are *interesting* (majors differ in prereq-chain depth,
   articulation density, GE overlap) vs merely possible.
2. **State dimension** (design early, build later): today CA is implicit
   (GE patterns, Title 5 areas, assist.org URLs, hardcoded CC calendar sets,
   no `state` field on institutions). W2's spec defines the state/system
   abstraction so MA data (MassTransfer A2B) can be converted into the SAME
   collections and run through the SAME algorithms, enabling CA↔MA
   comparisons. Long-term goal, not an immediate build.

### W3 — AS-degree hand-validation tool

A frontend tool for the research partner to deeply validate AS degrees for
selected subsets of CCs, writing corrections into the common structure so all
algorithms run on them unchanged.

- **Interaction model (decided): structured editor + AI assist.** A
  form-based editor (requirement groups/sections, course pickers bound to the
  college's real catalog courses) as the reliable core, plus an AI panel
  where the partner describes the problem in English and reviews the proposed
  structural diff before it saves. Both paths write through the existing
  validated endpoint (`PUT /api/curated/requirements/as_degree`).
- Provenance already exists and must be used: per-group
  `source: extracted|template_default|curated`, `confidence`, `curated_by`,
  doc-level `verification.verified`, availability states.
- Subset selection: define which colleges are "in the deep-validation set"
  and surface progress (ties into W4 task presets).

### W4 — Tasks tab v4

Reorganize the task system for the post-porting era:

- **Generalize task types:** today 3 hardcoded types (porting,
  data_verification, audit_fix) mirrored in `server/services/tasks.js` and
  `frontend/src/tasks/taskWorkflow.js`. Add a general/custom task type
  (title, description, optional lightweight checklist, no rigid stage
  machine) plus presets aligned to the new goals: degree-template gathering
  (W1), major onboarding steps (W1), AS-degree deep validation per college
  (W3), figure/analysis work.
- **Board organization:** real statuses instead of the derived Verification
  column; filtering by type/assignee/text (none exists today); grouping or
  swimlanes (e.g. by task type or major) so a large verification backlog
  doesn't drown the board; keep columns usable when packed (collapse groups,
  counts).
- **Re-wire the dormant weekly export** (`taskHistory.js` engine + tests
  survived; the UI button was removed) — restore an export/copy action.

## Dependency order

```
F  ──────────►  W1  ──────────►  W2 (cross-major visuals)
                                  W2 (state dimension: spec early, build later)
W3  (independent — starts on CS AS degrees; gains major_slug from F for later majors)
W4  (independent — presets reference W1/W3 work but don't block on them)
```

Recommended sequencing: **F spec+plan now** (this session) → W3 and W4 specs
next (parallel execution by weaker models while F is built) → W1 as data
tasks once F lands → W2 last.

## Parallel execution guide (multiple LLM instances)

Three plans exist and can be executed simultaneously by separate instances.
Each instance works on its OWN branch and stays inside its declared file
surface (each plan's Global Constraints section is binding):

| Workstream | Branch | Plan | File surface |
| --- | --- | --- | --- |
| F — major foundation | `major-foundation` | `plans/2026-07-22-major-dimension-foundation.md` | `server/config/majors*`, analysis services/controllers, `routes/api.js`, `frontend/src/shared/majors/*`, analyses, `AdminPage.jsx`, `DataPage.jsx`, `useData.js` |
| W3 — validation tool | `w3-validation-tool` | `plans/2026-07-22-as-degree-validation-tool.md` | `frontend/src/asdegrees/validation/*` (new), `server/services/asDegreeValidation|asDegreeAssist*` (new), `Curation.js`, `CanonicalData.js` (export only), `routes/api.js` (end of curated block), ONE mount line in `DataPage.jsx` |
| W4 — tasks v4 | `w4-tasks` | `plans/2026-07-22-tasks-v4.md` | `frontend/src/tasks/*`, `server/services/tasks.js`, `server/controllers/Tasks.js` only |

Known overlap points (small, intentional):

- `server/routes/api.js` — F and W3 both add routes in different regions;
  trivial merge.
- `frontend/src/DataPage.jsx` — F Task 13 edits panes; W3 adds one mount
  line in the AS-degrees region. Merge second branch with care.
- W4 presets carry a free-text major field with an `// F: swap for
  MajorPicker` comment — a small follow-up after both merge.

Suggested merge order: **W4 → W3 → F** (smallest surface first; F's broad
frontend diff rebases last). Each branch merges only when its plan's final
verification task passes and Tybalt approves. W2's detailed spec is written
after W1.

**W1 is phase-gated, not blocked:** `plans/2026-07-22-bio-econ-onboarding.md`
Phase 0 (discover programs → Tybalt pins → `port.py add --exact` → record in
`docs/major-pins.md`) runs immediately, in parallel with everything — ported
data stays invisible until F merges. Phases 2+ gate on F being on `main`.

## Conventions that apply to all sub-projects

- All data lands in the existing canonical collections
  (`assist_agreements`, `assist_courses`, `curated_requirements`,
  `curated_mappings`) so every algorithm runs on every major/state unchanged.
- Curated writes stamp `curated_by`/`curated_at`; verification state uses
  the existing per-group `source`/`confidence` and doc-level `verification`.
- Verification notes are user-authored only (Tybalt writes them).
- No commits until a feature is fully implemented; no Claude commit trailers.
- Frozen CS artifacts (snapshots, baselines, transfer-minimum views) are
  never deleted or regenerated as part of generalization — they are scoped
  to the `cs` slug and left bit-identical.
