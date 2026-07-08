# ASSIST Optimizer Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ASSIST credit-loss course counter with a faithful Python port of PMT's branch-and-bound minimum-course optimizer (delegating completion to `pmt_eligibility.py`), drive the major set from the settings selection, and add a 1st-choice picks guide.

**Architecture:** Port `missingCourses.js::selectMissingAcrossMajorsOptimal` to `analysis/pmt_min_courses.py`, golden-locked against a vendored JS copy. Swap it in for the `n/or/all` MILP inside `assist_college_cover` (strict blockers + the P(9,4) sweep unchanged). Source majors from `dataset_config.partner_access` (research DB), fall back to `PAPER_MAJORS`.

**Tech Stack:** Python 3.12 (pymongo, pulp — website path only, python-dotenv), Node 22 (golden oracle), React/Recharts (frontend), MongoDB (`pmt_research`).

## Global Constraints

- **No intermediate git commits.** Per user preference, keep everything uncommitted; ONE commit at the very end (Task 8), after full verification. Confirm before pushing to `main`. Every task below ends with a green test, NOT a commit.
- **Fidelity:** the Python port must reproduce the vendored JS optimizer's course-id sets exactly on every golden case.
- **Determinism:** no wall-clock budget in the port; run B&B to completion; a hard node cap `raise`s (never returns a silent partial).
- **Non-strict engine for course counting:** the optimizer calls `pmt_eligibility` predicates with `strict=False` (product default-accept). Strict (`strict=True`) is used ONLY for the transferability blockers, unchanged.
- **Required-group filter = truthy `is_required`** (engine semantics), which the port adopts and the old MILP did not.
- **Scope:** ASSIST variant only. Do not touch the website path's `optimal_set_cover` (it keeps PuLP), `load_district_rows`, `district_totals`, or `PAPER_MAJORS`.
- **Course identity in the ASSIST path = `course_id`** (with `same_as` peers), not the display-name grain used by the website path.

---

### Task 1: Vendor the JS optimizer as the golden oracle

**Files:**
- Create: `server/services/analysis/minCourses.js`
- Test: `server/services/analysis/minCourses.test.js`

**Interfaces:**
- Produces: `selectMissingAcrossMajorsOptimal(majors, ctx)` and `selectMissingAcrossMajors(majors, ctx)` (CommonJS exports). `ctx = { userCourses, coursesById: Map, includeRecommended, crossCc }`. Returns `string[]` of course_ids.

- [ ] **Step 1: Copy the optimizer, adapt imports.** Copy `/Users/tybaltmallet/Desktop/pmt/plan_my_transfer/frontend/src/lib/missingCourses.js` into `server/services/analysis/minCourses.js`. Change ESM `import { isReceiverCompleted, isSectionCompleted, isGroupCompleted } from './eligibility'` to `const { isReceiverCompleted, isSectionCompleted, isGroupCompleted } = require('./eligibility')`. Replace `import { toSyntheticUserCourse } from './courseModel'` with a local:

```js
// Minimal port of courseModel.toSyntheticUserCourse: a graded-A transcript row.
function toSyntheticUserCourse(course) {
  return {
    course_id: String(course.course_id),
    course_grade: 'A',
    course_units: Number(course.units) || 0,
    same_as: (course.same_as || []).map((p) => ({ course_id: String(p.course_id) })),
  };
}
```

Convert `export function selectMissingAcrossMajorsOptimal` → plain `function` + add `module.exports = { selectMissingAcrossMajorsOptimal, selectMissingAcrossMajors }`. Confirm the vendored `./eligibility` exports `isReceiverCompleted/isSectionCompleted/isGroupCompleted` with signature `(x, userCourses, crossCc)` (it does — see `eligibility.js`). NOTE: call these WITHOUT a strict flag (product default-accept).

- [ ] **Step 2: Write oracle sanity tests.** In `minCourses.test.js` (vitest, matching `eligibility.test.js` style), assert three hand-checked cases: (a) a plain "complete all" group of two articulated single-course receivers → both course_ids; (b) a "choose 1 of 3" section → exactly one (cheapest) id; (c) two majors sharing a course via `same_as` → the shared id counted once.

- [ ] **Step 3: Run tests, verify pass.**
Run: `npm test --prefix server -- minCourses`
Expected: 3 passing.

---

### Task 2: Golden fixtures + generator

**Files:**
- Create: `analysis/tests/fixtures/min_courses_cases.json`
- Create: `analysis/tests/gen_min_courses_goldens.js`
- Create: `analysis/tests/fixtures/min_courses_goldens.json` (generated)

**Interfaces:**
- Consumes: `server/services/analysis/minCourses.js` (Task 1).
- Produces: `min_courses_goldens.json` = `[{ case_id, greedy: string[], optimal: string[] }]` keyed to `min_courses_cases.json` entries.

- [ ] **Step 1: Author synthetic cases.** `min_courses_cases.json` = `[{ case_id, majors, coursesById, includeRecommended }]` covering every branch the old MILP dropped: `section_advisement` choose-N; `group_advisement`; `group_conjunction:"Or"`; `unit_advisement`; `group_unit_advisement`; `group_min_distinct_sections` (D-bucket); `group_max_distinct_sections`; a no-advisement multi-receiver section; `same_as` cross-listing; `options_conjunction:"and"` sequence; `course_conjunction:"or"` option; an `is_required:null` group (must be treated as NOT required). ~15 cases. `coursesById` entries: `{ course_id, units, same_as }`.

- [ ] **Step 2: Extract real agreement cases.** Add a script mode that pulls a sample of real ASSIST CS agreements from `pmt_research` (using the 9 `visible_pairs` majors) — pick ~20 (single-agreement) and ~10 multi-campus subsets — and appends them as cases (majors = requirement_groups arrays, coursesById = the referenced courses). Store the resolved inputs in the fixture so the golden test needs no DB.

- [ ] **Step 3: Generate goldens.**

```bash
node analysis/tests/gen_min_courses_goldens.js > analysis/tests/fixtures/min_courses_goldens.json
```

The generator loads `min_courses_cases.json`, rebuilds each `coursesById` as a `Map`, runs both `selectMissingAcrossMajors` (greedy) and `selectMissingAcrossMajorsOptimal`, and emits sorted id arrays per `case_id`.

- [ ] **Step 4: Eyeball 3 goldens** against hand computation (the same 3 shapes as Task 1 Step 2) to confirm the generator is wired correctly. No test run yet (Python port doesn't exist).

---

### Task 3a: Port — helpers, moves, greedy seed

**Files:**
- Create: `analysis/pmt_min_courses.py`
- Test: `analysis/tests/test_pmt_min_courses.py`

**Interfaces:**
- Consumes: `pmt_eligibility` predicates (`is_receiver_completed`, `is_section_completed`, `is_group_completed`) called with `strict=False`; `min_courses_goldens.json`.
- Produces: `select_missing_across_majors(majors, ctx) -> list[str]`; internal `moves_for_receiver`, `find_open_receivers_with_moves`, `count_open_receivers_across_majors`, `synthetic_course_for`, `_units_of`. `ctx` = dict `{ "user_courses": [...], "courses_by_id": {id: {"units", "same_as"}}, "include_recommended": bool, "cross_cc": [...] }`.

- [ ] **Step 1: Write the failing greedy golden test.**

```python
import json, pathlib, pytest
import pmt_min_courses as mc
FX = pathlib.Path(__file__).parent / "fixtures"
CASES = {c["case_id"]: c for c in json.loads((FX/"min_courses_cases.json").read_text())}
GOLDENS = {g["case_id"]: g for g in json.loads((FX/"min_courses_goldens.json").read_text())}

def _ctx(case):
    return {"user_courses": [], "courses_by_id": {str(k): v for k, v in case["coursesById"].items()},
            "include_recommended": case.get("includeRecommended", False), "cross_cc": []}

@pytest.mark.parametrize("cid", list(GOLDENS))
def test_greedy_matches_oracle(cid):
    got = sorted(mc.select_missing_across_majors(CASES[cid]["majors"], _ctx(CASES[cid])))
    assert got == sorted(GOLDENS[cid]["greedy"])
```

- [ ] **Step 2: Run, verify import failure.**
Run: `cd analysis && .venv/bin/python -m pytest tests/test_pmt_min_courses.py -k greedy -x`
Expected: FAIL (module not found / function missing).

- [ ] **Step 3: Port the helpers + greedy.** Translate faithfully from `minCourses.js` (lines 15–338): `articulated_receivers`, `section_closes_its_receivers`, `is_section_all_receivers_mandatory`, `is_group_all_receivers_mandatory`, `collect_mandatory_course_ids_for_majors` (with `same_as` accumulation), `_units_of`/`total_units`/`pick_cheapest_id`, `synthetic_course_for`, `count_open_receivers_across_majors`, `enumerate_candidate_options`, `select_missing_across_majors`. Preserve: the `safety_cap = 256` loop (raise on exhaustion, not warn); truthy-`is_required` gate; `strict=False` on every predicate call. Build the synthetic transcript rows as `{"course_id","course_grade":"A","course_units","same_as":[{"course_id":...}]}` so `pmt_eligibility.is_course_completed`'s same-as path fires.

- [ ] **Step 4: Run greedy test, verify pass.**
Run: `cd analysis && .venv/bin/python -m pytest tests/test_pmt_min_courses.py -k greedy`
Expected: all PASS. Fix translation until green.

---

### Task 3b: Port — branch-and-bound optimal

**Files:**
- Modify: `analysis/pmt_min_courses.py`
- Modify: `analysis/tests/test_pmt_min_courses.py`

**Interfaces:**
- Produces: `select_missing_across_majors_optimal(majors, ctx, hard_cap=2_000_000) -> list[str]`.

- [ ] **Step 1: Add the failing optimal golden test.**

```python
@pytest.mark.parametrize("cid", list(GOLDENS))
def test_optimal_matches_oracle(cid):
    got = sorted(mc.select_missing_across_majors_optimal(CASES[cid]["majors"], _ctx(CASES[cid])))
    assert got == sorted(GOLDENS[cid]["optimal"])
```

- [ ] **Step 2: Run, verify fail.**
Run: `cd analysis && .venv/bin/python -m pytest tests/test_pmt_min_courses.py -k optimal -x`
Expected: FAIL (function missing).

- [ ] **Step 3: Port B&B.** Translate `minCourses.js` lines 340–667: `cartesian`, `moves_for_receiver` (cartesian cap 4096 → **raise** instead of greedy fallback), `find_open_receivers_with_moves`, `reduce_by_dominance`, `dfs` with count→units bound and MRV ordering. Replace the JS `Date.now()` deadline with a node counter that raises `RuntimeError` at `hard_cap`. Seed `best` from the greedy result (Task 3a). Return greedy result if B&B finds nothing strictly better.

- [ ] **Step 4: Run optimal test, verify pass.**
Run: `cd analysis && .venv/bin/python -m pytest tests/test_pmt_min_courses.py`
Expected: all greedy + optimal PASS.

---

### Task 4: Settings-driven major loader

**Files:**
- Modify: `analysis/paper_credit_loss.py` (add near `PAPER_MAJORS`)
- Test: `analysis/tests/test_canonical_majors.py`

**Interfaces:**
- Produces: `load_canonical_majors(db) -> dict[int, list[str]]`. Reads `db.dataset_config.find_one({"_id":"partner_access"})`; returns `{school_id: [major,...]}` from `visible_pairs` restricted to the 9 CAMPUS school_ids; falls back to `PAPER_MAJORS` (with a printed warning) when the doc is absent. `canonical_major_query(canonical)` returns the `$or` mongo clause (same shape as `paper_major_query`).

- [ ] **Step 1: Write failing test** (monkeypatched fake db returning a `visible_pairs` doc → expect the 9-pair mapping; empty db → expect `PAPER_MAJORS`). Full test code with a `FakeCollection`/`FakeDB` stub.

- [ ] **Step 2: Run, verify fail.** `cd analysis && .venv/bin/python -m pytest tests/test_canonical_majors.py -x` → FAIL.

- [ ] **Step 3: Implement `load_canonical_majors` + `canonical_major_query`.**

- [ ] **Step 4: Run, verify pass.**

---

### Task 5: Rewrite `assist_college_cover` to use the optimizer

**Files:**
- Modify: `analysis/paper_credit_loss.py` (`build_assist_agreement_model`, `assist_college_cover`; delete `validate_assist_greedy`/`greedy_*`)
- Test: `analysis/tests/test_assist_cover.py`

**Interfaces:**
- Consumes: `pmt_min_courses.select_missing_across_majors_optimal`; `pmt_eligibility.articulation_blockers(strict=True)`, `is_major_completed(strict=False)`.
- Produces: `assist_college_cover(college, school_ids, demand_stats, courses_by_id, return_details=False)` → `(frozenset articulated_course_ids, frozenset unarticulated_identities, details)`. Course count = `len(articulated)`. `details.selected_programs`/`chosen_bundles` retained for the picks guide.

- [ ] **Step 1: Write failing test.** Build one fixture college with two campuses' agreements + a `courses_by_id`; assert (a) `len(articulated)` equals the optimizer's direct result on the chosen majors; (b) `unarticulated` equals `blocker_identities(articulation_blockers(strict=True))`; (c) the loop-closer holds: a synthetic transcript from `articulated` satisfies `is_major_completed(strict=False)` for each non-blocked campus.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Rewrite.** In `build_assist_agreement_model`, keep exclusion filtering + `demand_count` (still honoring choose-N for the gold bar) and the strict `coverage_missing`/`articulable`, but drop the `groups` `n/or/all` structure. In `assist_college_cover`: for each campus in `school_ids`, list its canonical-major agreements at this college; take the cartesian product (one per campus); for each combo run `select_missing_across_majors_optimal(combo_majors, ctx)` and sum strict blockers; pick min by `(total_blockers, len(courses), total_units, lexical)`. `articulated = frozenset(course_ids)`, `unarticulated = union of strict blocker identities + no_agreement_unarticulated`. Delete `validate_assist_greedy`, `greedy_agreement_courses`, `greedy_satisfy_n`, `cheapest_alt`, and the PuLP block in this function. Add the loop-closer assertion (guarded by a `--skip-assist-validations` escape).

- [ ] **Step 4: Run, verify pass.**

---

### Task 6: Wire canonical majors + pathways block + `--diff`

**Files:**
- Modify: `analysis/paper_credit_loss.py` (`load_assist_inputs`, ASSIST `main` branch)

**Interfaces:**
- Consumes: `load_canonical_majors`, `assist_college_cover` (Task 5).
- Produces: `paper-credit-loss.assist.json` gains a `pathways` array (`{campus, district, best_college, major, courses:[…], blockers:[…]}` for the 1st-choice single-campus cover). ASSIST `--diff` compares against the committed json.

- [ ] **Step 1: Swap the major source.** In `load_assist_inputs`, replace `paper_major_query()` with `canonical_major_query(load_canonical_majors(db))`; build `courses_by_id` from `db.courses` (`{course_id: {units, same_as:[{course_id}]}}`); thread it into `assist_district_totals`/`assist_college_cover`. Gold/demand (`demand_stats`) now derived from the canonical single major per campus.

- [ ] **Step 2: Emit `pathways`.** In `assist_district_totals`, for each single-campus subset capture the `return_details=True` cover (best college, major, courses, blockers) → collect into the output.

- [ ] **Step 3: Implement `--diff`.** Compare new campus×position `transferable_average` + `pathways` vs the committed `paper-credit-loss.assist.json`; print every moved bar with campus/position/delta and, where available, the district/college whose pathway changed.

- [ ] **Step 4: Run end-to-end + verify.**
Run: `cd analysis && .venv/bin/python paper_credit_loss.py --requirements assist --diff`
Expected: completes; prints the coverage cross-check `OK`; prints the diff vs the old union-based numbers; writes the json + CSVs. Inspect the diff for sanity (moves concentrated in multi-program/complex-advisement campuses).

---

### Task 7: Picks-guide drill-down (frontend)

**Files:**
- Modify: `frontend/src/analyses/PaperCreditLoss.jsx`
- (Website `pathways`: add a minimal pooled-1st-choice block to the website `main` branch in `paper_credit_loss.py` and regenerate `paper-credit-loss.ours.json`.)

**Interfaces:**
- Consumes: `pathways` arrays in both JSONs.

- [ ] **Step 1: Add website `pathways`.** In the website `main` branch, for each campus emit the 1st-choice pooled course set + contributing college(s) per row. Regenerate `paper-credit-loss.ours.json`.

- [ ] **Step 2: Render the drill-down.** Clicking a campus label/bar opens a panel showing, side by side, the ASSIST pathway (best college, major, courses, blockers) and the website pathway (pooled courses + colleges). Follow existing `PaperCreditLoss.jsx` component/style patterns. Label positions 2–4 as marginal averages (no per-position college).

- [ ] **Step 3: Verify build + render.**
Run: `npm run build --prefix frontend`
Expected: build passes. Screenshot the ASSIST + website views with a campus expanded; confirm no label collisions.

---

### Task 8: Docs, determinism hashes, final verification, single commit

**Files:**
- Modify: `docs/figures/paper-credit-loss.md`
- Modify: `analysis/paper_credit_loss.py` (docstring/method strings)

- [ ] **Step 1: Update the figure doc.** Rewrite the ASSIST-variant section: course counts now from the ported B&B optimizer (engine-consistent), majors from settings `visible_pairs`, program selection, the picks guide. Refresh the determinism hashes (district/blocker/complete-district CSVs) from the new run.

- [ ] **Step 2: Full green run.**
Run: `cd analysis && .venv/bin/python -m pytest tests/ && .venv/bin/python paper_credit_loss.py --requirements assist && npm run build --prefix frontend && npm test --prefix server -- minCourses eligibility`
Expected: all pass.

- [ ] **Step 3: Single commit (ask before pushing to main).** Stage everything; one commit summarizing the ASSIST optimizer port + settings-driven majors + picks guide. Do NOT push to `main` without explicit confirmation.

---

## Self-Review

**Spec coverage:** §2 goals → Tasks 3/5 (port+swap), 4/6 (settings), 5/6 (`--diff`), 7 (guide), 1–3 (goldens). §3.1 port → 3a/3b. §3.2 integration → 5. §3.3 majors → 4/6. §3.4 harness → 1/2/3 + loop-closer in 5. §3.5 guide → 7. §5 re-baseline → 6. §6 testing → 8. All covered.

**Placeholder scan:** Port steps intentionally reference exact JS source line ranges to translate rather than transcribing 600 lines — the golden tests (Tasks 2–3) are the executable spec of correctness, so "faithful translation of named functions + green goldens" is concrete, not a placeholder. Novel glue (oracle helper, `_ctx`, tests, loaders) is shown in full.

**Type consistency:** `ctx` keys (`user_courses`, `courses_by_id`, `include_recommended`, `cross_cc`) consistent across 3a/3b/5/6. `select_missing_across_majors[_optimal]` signatures stable. `assist_college_cover` gains `courses_by_id` param, threaded from Task 6. `courses_by_id` value shape `{units, same_as:[{course_id}]}` consistent across 3a/5/6.
