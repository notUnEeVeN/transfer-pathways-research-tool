# Tasks Addendum — Workflow & Creation Surfaces

Addendum to `REVAMP-HANDOFF.md` covering the Task surfaces added/changed on Jul 14: the **Data Verification task type**, its **workflow modal** (checkpoint progression), the **unified New task modal**, and the **7-stage porting sync**. The visual source of truth is `mockups/Transfer Pathways Console v2.dc.html` (open in a browser → Tasks tab). Same reading rules as the master spec: styles are inline on each element; map `var(--cw-*)` / raw hexes to `tokens.css` names per the table at the bottom.

Where to look in the mockup source:
- Template: elements marked `data-screen-label="Data verification modal"` and `data-screen-label="New task modal"`; board/list cards under `data-screen-label="Tasks"`.
- Logic class: `openWf` (routes by `task.type`), `vfPatch` / `vfSetTask` / `vfStamp` / `vfAddItem` / `addNewItem`, the `// ---- Data verification modal` block in `extraVals`, and the `vfOpen` keyboard branch in `componentDidMount`.

---

## 1. Data model

```js
// Porting (existing) — unchanged shape
{ title, status: 'todo'|'inprogress'|'done', pct, next, assignee, date }

// Data Verification (new)
{ title, status, type: 'verify', assignee, date, desc,
  items: [ { name,            // checkpoint label, free text
             done: bool,
             at:   'Jul 14, 9:41 AM',   // set when toggled done
             note: 'string'|null,       // one note per checkpoint
             noteAt: 'Jul 14, 9:53 AM' } ] }
```

- Percent = `round(done / items.length * 100)`. No PCT table — verification is not staged.
- "Up next" = first unverified item in list order (informational only; items can be verified in ANY order).
- Porting `STAGES` is now **7**: Read & understand · Research missing data · Data & endpoints · Develop visualization · Publish · **Self-verify** · Team approval. Porting percent table: `[0, 14, 29, 43, 57, 71, 86, 100]`.

## 2. Task cards (board + list)

- Type chip replaces the hardcoded "Porting" chip:
  - Porting → text `conservative` on `conservative-soft`.
  - Data Verification → text `success` on `primary-soft`.
- Stage-dot strip: porting cards draw 7 dots from STAGES; verification cards draw **one dot per checkpoint** (12px circle, 9px connector): filled `primary` when done, `accent` outline on the up-next item, `border-strong` outline otherwise. Counter reads `3 of 9`.
- "Next:" line: `Next: verify <checkpoint>` or `All checkpoints verified`.
- Done column is live: tasks with `status:'done'` render there; "Done this week" stat counts them.

## 3. New task modal — unified creation

One modal for both types. 640px, radius 22px.

- **Task type** is a segmented pill switch (`surface-sunken` track, active = white pill, weight 650) — Porting | Data Verification. Header subtitle mirrors the selection.
- Shared fields: Title, Description, Assignee, Status (unchanged styling).
- Below a hairline divider, the section swaps with the type:
  - **Porting** → read-only "Porting stages · 7 stages" two-column numbered preview + one line: "Porting tasks follow the same fixed pipeline, completed in order."
  - **Data Verification** → checkpoint builder (replaces the one-per-line textarea):
    - Explainer line: "Checkpoints are this task's flexible progression — verify them in any order, and add more as you find them."
    - **Quick fill** row: outline pill "+ One per UC campus" (seeds the 9 campuses); ghost "Clear all" (danger hover) once items exist.
    - Numbered rows: 22px `surface-sunken` number circle, 13.5px label, per-row remove ✕ (ghost → `danger-soft`/`danger` hover), hairline separators.
    - Add input: pill-shaped text field + outline "Add" button; **Enter adds**. Empty input is a no-op.
- Create task produces the correct shape (verification tasks carry `type`, `desc`, `items`; porting tasks get `pct: 0`, first stage next).

## 4. Data Verification workflow modal

1080px, radius 22px, grid `330px | 1fr`, both columns scroll together. Header identical to the porting workflow modal (title "Task workflow", subtitle `Data Verification · N% complete`, archive/delete/close icon buttons).

**Left rail** = same components as the porting modal (Title input, Description textarea, Task type (locked) / Assignee / Status selects, Save details, General notes, created stamp). Type chip: `success` on `primary-soft`.

**Right column — the progression (the redesign):**

- Header row: "Verification checkpoints" (15px/650) + `N of M checkpoints verified` subtitle; right-aligned percent, 22px/650 in `success`.
- **Segmented progress bar**: one 7px pill segment per checkpoint, 4px gaps — `success` fill when done, `accent` for the up-next item, `surface-sunken` for the rest. Animates via `transition: background .2s`.
- **Timeline list** (no row borders — whitespace only, 22px between rows):
  - Node column: 28px circle button + 2px connector line below it (connector `success` when the row is done, hairline otherwise; connects through to the add-row's dashed node).
    - Done: `success` fill, `accent` checkmark. Click = un-verify (tooltip "Click to un-verify").
    - Up next: white, 2px `accent` border, number, **pulsing lime ring** (`pmtPulse` keyframe, 2.4s).
    - Pending: white, 2px `border` border, number in ink-subtle.
  - Row content: name 14.5px (done rows recede: weight 550, `ink-muted`; up-next 650) + `UP NEXT` chip (`on-accent` on `accent`, uppercase 10.5px) + done meta `Tybalt Mallet · Jul 14, 9:41 AM` (12px, faint).
  - Actions, right-aligned per state — one primary action per screen:
    - Done → ghost "↩ Undo".
    - Up next → ghost "✎ Note" + **solid `primary` "✓ Verify" pill with a `V` kbd chip** (kbd: 10px, `accent` text, `on-primary`-tinted border).
    - Pending → ghost "✎ Note" + quiet outline "✓ Verify" pill (`border-strong`, mint hover).
    - All rows → ghost ✕ remove (danger hover).
  - Saved note: quoted block — 2px left rule, 13px text, TY avatar (18px, `primary` bg / `accent` text) + `name · time` meta.
  - Note editor (one open at a time): textarea, placeholder "What did you check, and what did you find?", ghost Cancel + outline "✎ Save note". Saving an empty note clears the note.
- **Add checkpoint row** at the timeline's end: 28px dashed circle (+), pill input "Add a checkpoint — a campus, dataset, or spot-check…", outline Add. **Enter adds.**
- **All-verified banner** (replaces nothing, appears above the list when `done === total`): `primary-soft` fill, 1px `accent` border, radius 12, forest check disc, "Every checkpoint is verified — this task is ready to close." + solid **Mark task done** → sets `status:'done'`, closes, card moves to the Done column.
- **Keyboard** while the modal is open: `V` verifies the up-next checkpoint (auto-advances), `Esc` closes. Ignore keys while focus is in an input/textarea.

## 5. Behavior summary (acceptance list)

1. Opening a `type:'verify'` task routes to the verification modal; porting tasks keep the staged modal.
2. Verify / Undo toggles per checkpoint, in any order; timestamps update; % , segments, count, connectors, and the board card all stay in sync.
3. Up-next indicator always points at the first unverified checkpoint; `V` targets it.
4. Add / remove checkpoints re-numbers rows and recomputes %.
5. One note per checkpoint, edited inline; note survives verify/undo.
6. All-verified banner ⇄ appears/disappears live; Mark task done moves the task to Done.
7. Creation: segmented type switch swaps the lower section; quick-fill seeds the 9 UC campuses; created tasks open correctly from the board.

## 6. Color mapping (mockup → tokens.css)

| In mockup | Token |
|---|---|
| `#193018` fills / ink | `--color-primary` / `--color-ink` |
| `#F0FFE7` text on forest | `--color-on-primary` |
| `#96F060` (check, up-next ring, segments) | `--color-accent` |
| `var(--cw-mint)` chip/hover fills | `--color-primary-soft` |
| `#17855A` (done nodes, %, chip text) | `--color-success` |
| `#DFF4E7` status chips | `--color-success-soft` |
| `var(--cw-sunken)` tracks/number circles | `--color-surface-sunken` |
| `var(--cw-border)` / `var(--cw-hairline*)` | `--color-border` (hairlines: border at reduced weight) |
| `var(--cw-strong)` outline buttons | `--color-border-strong` |
| `var(--cw-ink-muted/subtle/faint)` | `--color-ink-muted` / `--color-ink-subtle` (faint ≈ subtle at 80%) |
| `#6C4FD0` / `#F0EAFC` porting chip | `--color-conservative` / `--color-conservative-soft` |
| `#FFE9E3` / `#D22F14` destructive hover | `--color-danger-soft` / `--color-danger` |
