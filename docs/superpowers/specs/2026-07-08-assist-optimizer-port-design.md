# ASSIST credit-loss: port PMT's minimum-course optimizer + settings-driven majors + picks guide

**Status:** design approved (decisions locked), pending spec review
**Date:** 2026-07-08
**Scope:** the ASSIST-stated-minimums variant of the paper credit-loss figure only. The
website/paper-replication path is untouched.

## 1. Motivation

The ASSIST variant computes two things per agreement:

1. **Transferability / blockers** — already delegated to the ported PMT eligibility
   engine (`analysis/pmt_eligibility.py`, `articulation_blockers`/`is_major_articulable`,
   `strict=True`). Cross-validated (`validate_assist_coverage`, 367==367). This is correct.
2. **Course count (the blue bars)** — currently a hand-rolled MILP in
   `assist_college_cover` that re-encodes each agreement's requirement structure into a
   coarse `n`/`or`/`all` model with integer `section_need`s. That encoding only reads
   `section_advisement`, `group_advisement`, and `group_conjunction=="Or"`. It **silently
   drops** `unit_advisement`, `group_unit_advisement`, `group_min_distinct_sections`
   (D-bucket), `group_max_distinct_sections`, the bare-buckets OR case, and treats a
   no-advisement multi-receiver section as "take all" where the engine says "any one." It
   also keeps `is_required == null` groups as required, while the engine counts only
   truthy `is_required`.

So the course counter is a parallel, thinner interpretation of the requirement structure
than the eligibility engine — the exact divergence risk we want gone.

PMT already ships a production optimizer that solves this problem *by delegating every
completion decision to the eligibility engine*:
`/Desktop/pmt/plan_my_transfer/frontend/src/lib/missingCourses.js` →
`selectMissingAcrossMajorsOptimal(majors, ctx)`. It is branch-and-bound exhaustive
(greedy seed → MRV DFS → dominance reduction → count→units→lexical objective) and finds
the globally minimum set of `course_id`s that makes a student eligible for **all** the
selected majors at once, sharing courses. That maps directly onto the figure's
`cover(subset)`.

**Decision (locked):** port that optimizer to Python (not a JS bridge), golden-locked
against the JS, delegating to `pmt_eligibility.py` — consistent with how `pmt_eligibility.py`
already mirrors the engine.

## 2. Goals / non-goals

**Goals**
- Replace only the ASSIST course-count core with a faithful Python port of the PMT B&B optimizer.
- Source the major set from the settings selection (`dataset_config.partner_access`), not a frozen constant.
- Add a picks guide: the 1st-choice pathway per campus × district, ASSIST and website side by side.
- Prove equivalence to the JS optimizer (goldens) and attribute every moved figure number (`--diff`).

**Non-goals**
- No change to the website/paper path (still `PAPER_MAJORS`, still validated as paper-equivalent).
- No change to the strict-blocker transferability model, the P(9,4) permutation sweep, ÷336,
  round-then-average, or the transferable-average filter.
- No change to the eligibility engine itself.

## 3. Components (each a testable unit)

### 3.1 `analysis/pmt_min_courses.py` (new) — the ported optimizer
Line-faithful port of `missingCourses.js`. Public surface:

```
select_missing_across_majors_optimal(majors, ctx) -> list[str]   # course_ids, minimal set
```

- `majors`: list of major docs in `requirement_groups[].sections[].receivers[].options[]` shape.
- `ctx`: `{ user_courses: [], courses_by_id, include_recommended=False, cross_cc=[], hard_cap }`.
- `courses_by_id`: `course_id -> { units, same_as: [{course_id}] }` from `db.courses`.
- **Delegation:** all `is_receiver_completed / is_section_completed / is_group_completed`
  calls go to `pmt_eligibility.py`, run **non-strict** (default-accept) to match the JS
  product engine. Required-group filter uses truthy `is_required` (engine semantics), which
  aligns the demand with the blocker engine — a reconciliation the current MILP lacks.
- Ports the helpers faithfully: `moves_for_receiver` (cartesian over OR members, 4096 cap →
  **raise** rather than silent greedy fallback), `find_open_receivers_with_moves`, greedy seed
  (`select_missing_across_majors`), `reduce_by_dominance`, DFS with count→units bound + MRV
  branch ordering, `same_as`-aware synthetic transcript accumulation.
- **Determinism (locked):** no wall-clock budget. B&B runs to completion. A hard
  node/iteration cap `raise`s loudly if ever exceeded (never returns a silent partial).
- Depends only on `pmt_eligibility` + a plain catalog dict → unit-testable in isolation.

### 3.2 `analysis/paper_credit_loss.py` — ASSIST integration
`assist_college_cover` keeps its structure (best college per subset, program selection,
blockers) but **drops PuLP** and swaps two responsibilities:

- **Course count** ← `select_missing_across_majors_optimal(chosen_majors, ctx)` → `len(courses)`
  and the course-id set (was: the MILP `x` minimization).
- **Unarticulated / blockers** ← unchanged: `pmt_eligibility.articulation_blockers(strict=True)`
  per campus, flattened via the existing `blocker_identities` hybrid grain.
- **Program selection:** for each campus in the subset, gather its settings-selected majors
  that have an agreement at this college; take the cartesian product across campuses; run the
  optimizer per combo; pick the min by `(total strict blockers, course count, total units, lexical)`.
  Bounded — a campus usually has one selected major at a given college.
- No-agreement campuses → `no_agreement_unarticulated` (unchanged).
- `cover(subset)` = best college by `(unart, art, name)`, the marginal sweep, ÷336, and the
  transferable-average filter are **unchanged**.

The lexicographic-weight MILP objective (`UNART_WEIGHT`/`COURSE_WEIGHT`) and the whole
`x`/`u`/`p`/receiver/alt variable construction are deleted. PuLP stays a dependency: the
**website** path's `optimal_set_cover` still uses it. Only the ASSIST cover stops importing it.

### 3.3 `load_canonical_majors(db_audit)` (new) — settings-driven major set
Reads `dataset_config` doc `_id="partner_access"`, field `visible_pairs: [{school_id, major}]`
(the admin's working dataset; multiple majors per campus allowed) from the **research DB**
(verified: `dataset_config.partner_access` lives in `pmt_research`, so the existing `connect()`
handle reads it — no separate audit connection needed). Produces `{school_id: [major, …]}`.
Current live value = exactly one CS major per campus (9 pairs), which differs from the frozen
`PAPER_MAJORS` union — so adopting it re-baselines the ASSIST demand (captured by `--diff`). Fallback to `PAPER_MAJORS` when no config doc exists
(mirrors `majorScope`'s admin-unrestricted default). Used by the ASSIST path only, for
agreement loading, demand, blockers, and optimizer input. The website path keeps `PAPER_MAJORS`.

Consequence: this re-couples the ASSIST figure to the settings selection, reversing the
deliberate freeze noted in the `PAPER_MAJORS` comment — intended, since the settings selection
is the partner-facing definition.

### 3.4 Golden oracle (JS) + Python golden test
- Vendor the optimizer into `server/services/analysis/minCourses.js` (a copy of
  `missingCourses.js` adapted to `require('./eligibility')` — already vendored — plus a tiny
  `toSyntheticUserCourse` helper). Runs the **non-strict** engine, matching the product.
- Node CLI `analysis/tests/gen_min_courses_goldens.js`: over the real ASSIST CS agreements
  (per college, per relevant subset) **plus** synthetic edge cases (choose-N, `unit_advisement`,
  `group_min_distinct_sections`, `same_as` cross-listing, `is_required==null`), emit
  `{input_hash -> sorted course_ids}`.
- `analysis/tests/test_pmt_min_courses.py`: assert the Python port reproduces each course-id
  set exactly. Same pattern that locks `pmt_eligibility` via `test_pmt_fidelity.py`.
- **Runtime loop-closer** in the pipeline: after each solve, assert the chosen course set
  actually satisfies `pmt_eligibility.is_major_completed` for each satisfiable campus — makes
  any port bug loud in a real run, not just in tests.
- Keep `validate_assist_coverage` (strict blockers vs `is_major_articulable`). Retire
  `validate_assist_greedy` (its `optimal ≤ greedy` bound is subsumed by the golden).

### 3.5 Picks guide
- Python emits a `pathways` block in each figure JSON. Per **campus × district**, the
  **1st-choice pathway** (the single-campus cover — the only position that maps to one college):
  - **ASSIST:** best college, winning settings-selected major, exact chosen courses (from the
    optimizer), strict blockers if any.
  - **Website:** the pooled 1st-choice course set, tagged with the contributing college(s) per
    row (honest about `load_district_rows` cross-college pooling).
- `frontend/src/analyses/PaperCreditLoss.jsx`: a drill-down (click a campus → its 1st-choice
  pathway panel), ASSIST and website shown together so the college/course difference is visible.
  Positions 2–4 remain the averaged bars, explicitly labeled as marginal averages (not pinned
  to a college).

## 4. Data flow

```
dataset_config.partner_access (audit db) ──► load_canonical_majors ──► {school_id: [major]}
db.uc_agreements (scoped to those pairs) ──► build agreement models (requirement_groups shape)
db.courses (units, same_as) ─────────────► courses_by_id

per (district, college, subset):
   for each program-combo (one selected major per campus present at college):
       courses = select_missing_across_majors_optimal(combo_majors, ctx)   # pmt_min_courses
       blockers = articulation_blockers(strict=True) per campus             # pmt_eligibility
   pick best combo by (blockers, |courses|, units, lex)
   ↓
best college per subset ─► P(9,4) marginal sweep ─► ÷336, round ─► transferable-average filter
   ↓                                                                         ↓
pathways block (1st-choice picks)                          paper-credit-loss.assist.json
   └──────────────────────────────► PaperCreditLoss.jsx drill-down ◄─────────┘
```

## 5. Re-baseline management

The major *selection* is unchanged, but course counts shift wherever the old MILP encoding
diverged from the engine (dropped advisements, no-advisement sections, `is_required==null`,
program-sharing). That is the fix, not a regression. `paper_credit_loss.py --requirements assist
--diff` compares the new output against the committed `paper-credit-loss.assist.json` and prints
every campus/position that moved, with the district/college and course-level reason. Review,
then commit. Update the determinism hashes in `docs/figures/paper-credit-loss.md`.

## 6. Testing strategy

- `test_pmt_min_courses.py` — port vs JS goldens (real agreements + synthetic edge cases). Primary lock.
- Runtime loop-closer assertion (solution satisfies `is_major_completed`).
- `validate_assist_coverage` retained.
- Existing `pathways.test.js` / `eligibility.test.js` unaffected.
- Frontend: build passes; screenshot the drill-down for ASSIST + website without label collisions.

## 7. Risks / open items to confirm during implementation

- **Settings DB.** RESOLVED: `dataset_config.partner_access` lives in `pmt_research` and is
  read via the existing `connect()` handle. Keep a `PAPER_MAJORS` fallback (loud log) only for
  the case where the doc is absent.
- **`is_required==null` groups.** Confirm whether any ASSIST CS agreements carry them; the port
  aligns to truthy-`is_required` (engine semantics), which may move numbers — capture in `--diff`.
- **Catalog completeness.** `same_as` and `units` must be present for the CS course universe;
  missing ids are dropped by `moves_for_receiver` (mirrors JS) — the loop-closer will surface gaps.
- **B&B blow-up.** The hard cap raises rather than approximating; if a real cell hits it, revisit
  dominance/branch ordering rather than reintroducing a timeout.
- **Program-combo cost.** Cartesian over selected majors per campus is bounded but could be large
  if settings later select many majors per campus; memoize per (college, subset) as today.

## 8. Deliverables checklist

- [ ] `analysis/pmt_min_courses.py` (port)
- [ ] `analysis/tests/test_pmt_min_courses.py` + `gen_min_courses_goldens.js` + goldens
- [ ] `server/services/analysis/minCourses.js` (vendored oracle)
- [ ] `assist_college_cover` rewritten (optimizer + strict blockers, PuLP removed)
- [ ] `load_canonical_majors` + audit-DB wiring
- [ ] `pathways` block in JSON + `--diff` re-baseline
- [ ] `PaperCreditLoss.jsx` picks-guide drill-down
- [ ] Update `docs/figures/paper-credit-loss.md` (method + hashes)
