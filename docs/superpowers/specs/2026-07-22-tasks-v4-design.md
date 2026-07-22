# Tasks tab v4 (W4) — design

**Date:** 2026-07-22 · **Status:** approved
**Roadmap:** `2026-07-22-expansion-roadmap.md` — sub-project W4.
**Runs in parallel with F and W3** — file surface is fully disjoint
(`frontend/src/tasks/*`, `server/services/tasks.js`,
`server/controllers/Tasks.js` only).

## Goal

Move the task system from "porting/validation pipeline tracker" to a general
research-team board: preset task types aligned with the expansion goals,
free-form tasks research mates can create themselves, and board organization
that stays usable with a large verification backlog and many in-progress
items.

## Non-goals

- No permissions changes (everyone-equal stays).
- No schema migration of existing tasks; every current doc renders unchanged.
- No pagination/virtualization (team-scale data; revisit only if it hurts).
- The porting stage machine, data_verification checklists, and audit_fix
  inbox keep working exactly as today.

## Architecture

### 1. New task type: `general`

- Server (`server/services/tasks.js`): add `'general'` to `TASK_TYPES` and to
  `CHECKLIST_TASK_TYPES` — but unlike `data_verification`, its
  `checklist_items` are **optional** (a bare general task is just
  title/description/status). Progress: derived from checklist items when
  present; otherwise stays 0 and Done is set by moving the card.
- Client mirror (`frontend/src/tasks/taskWorkflow.js`): add to
  `TASK_TYPE_OPTIONS` (label "General") and `CREATABLE_TASK_TYPES`;
  `isChecklistTask` includes it; card rendering falls back gracefully when a
  general task has no checklist (no stage dots, no "N of M").

### 2. Preset library

- New `frontend/src/tasks/taskPresets.js` — code-defined presets (same
  pattern as the majors config: code is the source of truth, no collection).
  Each preset: `{ key, label, description, task_type, prefill }` where
  `prefill` produces title/description/checklist_items, optionally
  parameterized by campus / college / major pickers.
- Initial preset set (aligned to the roadmap):
  - **Degree template gathering** (per campus × major) — checklist:
    locate catalog page, extract requirement groups, unit closure check,
    source URL recorded, ready-for-review. (W1 feeds on this.)
  - **Major onboarding step** — port agreements, choose program pins,
    author category vocab, spot-check articulations.
  - **AS-degree deep validation** (per college) — mirrors W3's flow: confirm
    inventory, correct groups, mark verified. One task per college.
  - **Figure / analysis work** — general checklist for new visuals
    (question, data, implementation, publish, review) without the rigid
    7-stage porting machine.
  - **Custom (blank)** — plain general task.
- `TaskModal` gains a preset picker step when creating: preset cards first,
  then the existing form pre-filled. The existing "One per UC campus"
  quick-fill generalizes to per-campus / per-college prefills driven by
  `useSchools`/`useColleges`.
- `seedTasks.js` stays untouched (historical seed).

### 3. Board filtering & organization

- New `frontend/src/tasks/TaskFilters.jsx`: text search (title/description),
  task-type multi-select, assignee select, "mine only" toggle. State
  persisted via the existing `usePersistedState` hook so the board reopens
  the way you left it. Filters apply to board, list views, and the stats
  strip (strip shows filtered counts with an "of N" hint).
- Board organization (`TaskBoard.jsx`):
  - Columns unchanged (To do / In progress / Verification / Done) — the
    derived Verification column stays, since the porting flow still uses it.
  - **Group-by-type sections inside each column** (collapsible, with counts),
    so 30 verification-backlog cards don't drown 3 active figure tasks.
    Section collapse state persists (sessionStorage, per column+type).
  - Done column shows the most recent 10 with a "show all" expander (cheap
    render relief without pagination).
  - Drag-drop and fractional ordering unchanged; dropping while filtered
    appends within the true column order (existing `orderBetween` semantics).

### 4. Weekly export re-wire

- The dormant `taskHistory.js` engine (`buildTaskHistoryMarkdown`,
  `buildTaskHistoryAiBriefing` — tested, currently unreferenced by UI) gets
  its button back: an "Export" menu on the All-tasks view with "Copy weekly
  history (markdown)" and "Copy timesheet briefing". Clipboard-based, no new
  endpoints.

## Error handling

Server validation errors keep the existing `ValidationError` → 400 path; new
type/checklist rules produce readable messages. Filter state that references
a deleted assignee simply matches nothing (no crash).

## Testing

- Server: `general` creation with and without checklist; patch/type
  validation; existing task tests pass unmodified.
- Frontend: preset picker produces the expected create payload; filters
  narrow board and list consistently; type sections render counts; export
  buttons produce the same markdown the existing `taskHistory.test.js`
  fixtures assert.
