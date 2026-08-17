# Massachusetts State Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the MA paper's recovered data as a third state, run the CA figure engine over it unchanged, and diff our recomputation against their published values.

**Architecture:** Approach C from the spec — same document shapes, separate namespace (`state: 'ma'`, reserved ids, an `ma-cs` majors entry), a snapshot-first importer with loud round-trip validation, a Massachusetts tab mirroring Virginia's shell that hosts the existing CA figure components, and a baselines collection holding their published per-pair values as diff targets.

**Tech Stack:** Node (CommonJS services, vitest), Python via `pmt-env` (xlsx → JSON conversion only), React frontend, MongoDB Atlas.

**Spec:** `docs/superpowers/specs/2026-08-14-ma-state-port-design.md`

## Global Constraints

- **No commits at any step.** House policy holds commits until the feature is complete and Tybalt reviews (memory: commit-workflow-hold-until-complete). The final task ends with the working tree ready, not committed.
- Reserved ids: MA universities `school_id` 9001–9011 (alphabetical: Bridgewater=9001 … Worcester=9011), MA community colleges `source_id`/`community_college_id` 9101–9115 (alphabetical: Berkshire=9101 … Wachusett=9115), minted `parent_id`s = `schoolId * 1000 + columnIndex` (e.g. Bridgewater course col 4 → 9001004).
- Every MA document carries `state: 'ma'`; CA documents remain unstamped; CA-facing queries filter with `stateClause('ca')` = `{ state: { $exists: false } }`.
- All MA institutions are semester; no tuition data (cost figure renders published baselines only).
- Read-only toward the paper repo; the importer reads only vendored copies under `server/data/ma/`.
- Buster bump (`analysis-v6` → `analysis-v7`) ships with the frontend task.

---

### Task 1: Vendor recovered workbooks and convert to raw JSON

**Files:**
- Create: `server/data/ma/recovered/` (13 xlsx from commit `59c1b77` + `Mass Heatmap.xlsx` + `CurrComp Master.xlsx` from the working tree)
- Create: `server/data/ma/PROVENANCE.md`
- Create: `server/scripts/ma/convert_recovered.py`
- Create: `server/data/ma/raw/` (converter output, committed later with everything)

**Interfaces:**
- Produces: `server/data/ma/raw/heatmap.json` (`{ universities: [{ name, courses: [{ header, prefix, number, upper }], mt: { [cc]: bool }, matrix: { [cc]: bool[] }, lower_ratio: { [cc]: number }, all_ratio: { [cc]: number } }] }`), `raw/as_degrees.json` (`{ [cc]: { system, cip, courses: [{ id, name, prefix, number, prereqs: number[], coreqs: number[], credits }] } }`), `raw/pathways.json` (`{ [university]: { resident: Course[], pairs: { [cc]: Course[] } } }`), `raw/baselines.json` (`{ [measure]: { resident: { [univ]: number }, cells: { [cc]: { [univ]: number } } } }` for measures `pct_as`, `credit_hours`, `complexity`, `cost`).

- [ ] **Step 1:** Copy the two working-tree workbooks and re-extract the 13 history workbooks from `59c1b77` into `server/data/ma/recovered/`; write `PROVENANCE.md` naming the upstream repo, the commit hash, extraction date, and the final-PDF pinning.
- [ ] **Step 2:** Write `convert_recovered.py` (pmt-env pandas): parse the 11 university tabs (header row 0; CC rows 1–15; Total row; `Lower`/`Upper`/`MT` cols; course cols 4+; find the lower/upper boundary by solving for the split whose recomputed Lower ratio matches the tab's `Lower` column for every CC within 1e-6 — abort with the university name if no split fits), the 15 AS sheets (header row 6, Credit Hours col 7), the 11 pathway workbooks (first tab resident, remaining tabs per-CC pairs), and the 4 baseline sheets. Assert while converting: 11 universities, 15 CCs, Berkshire AS credits sum to 65, Bunker Hill×Bridgewater pathway sums to 149, 61 pair tabs total.
- [ ] **Step 3:** Run it: `pmt-env/bin/python server/scripts/ma/convert_recovered.py`. Expected: four JSON files written, all asserts pass, boundary solved for all 11 tabs.

### Task 2: Document builders (pure functions, TDD)

**Files:**
- Create: `server/scripts/ma/buildMaDocuments.js`
- Test: `server/scripts/ma/buildMaDocuments.test.js`

**Interfaces:**
- Consumes: the three raw JSON shapes from Task 1 (passed as parsed objects).
- Produces: `buildMaDocuments(raw)` → `{ institutions, degrees, asDegrees, agreements, baselines }` where every document matches the CA schemas: institutions are `assist_institutions` rows (`kind`, `source_id`, `name`, `state: 'ma'`, `academic_calendar: 'semester'`); degrees are `kind:'degree'` docs (`_id: 'degree:<schoolId>:ma-cs'`, `major_slug: 'ma-cs'`, `state: 'ma'`, `total_units` = resident credit sum, groups: `Lower-division major requirements` (tier transferable, one course receiver per heatmap lower column, `unit_advisement` from the resident row matched by prefix+number, 4-credit fallback flagged), `Upper-division major requirements` (tier nontransferable), `GE: general education and electives (excluded from the paper's articulation analysis)` (tier transferable, GE title so the MA course lens excludes it; one receiver per resident course absent from the heatmap matrix)); asDegrees are `kind:'as_degree'` docs (`degree_type: 'local_as'`, `major_slug: 'ma-cs'`, `state: 'ma'`, named sections with per-course credits, `total_units` = sheet credit sum); agreements are one per pair (`uc_school_id`, `community_college_id`, `major: '<university program label>'`, receivers per heatmap course with `articulation_status` from the boolean and options minted from the pair overlay: an AS course in `(AS ∪ resident) − pathway` that matches an articulated requirement by prefix+number becomes that receiver's option `{ course_ids: [ccCourseId] }`); baselines are `ma_paper_baselines` rows `{ measure, school_id, community_college_id | null (resident), value, source: 'CurrComp Master.xlsx' }`.

- [ ] **Step 1:** Write failing tests from handcrafted mini-raw fixtures: template group shapes (lower/upper split, GE title on the residual group, unit fallback flag), AS doc totals, agreement receiver booleans + overlay options, baseline rows incl. Resident.
- [ ] **Step 2:** Run: `npx vitest run scripts/ma/buildMaDocuments.test.js` — expect failures (module missing).
- [ ] **Step 3:** Implement the builders minimal-to-green.
- [ ] **Step 4:** Re-run to green.

### Task 3: Round-trip validators

**Files:**
- Modify: `server/scripts/ma/buildMaDocuments.js` (export `validateMaDocuments(raw, built)`)
- Test: extend `server/scripts/ma/buildMaDocuments.test.js`

**Interfaces:**
- Produces: `validateMaDocuments(raw, built)` → `{ failures: string[], warnings: string[] }`. Failures (abort import): per-pair recomputed lower and all-levels ratios (from built agreements + degree groups, binary per course, GE group excluded) differ from the tab's `Lower`/`Upper` columns; AS `total_units` differs from the published `% Credit Hours` denominator for any CC appearing there; pair-tab credit sum differs from the published `credit_hours` baseline cell. Warnings (report, continue): resident credit sum differs from published Resident (Bridgewater 123 vs 120 is the known first case); unit-fallback courses.

- [ ] **Step 1:** Failing tests: a fixture with one flipped boolean produces a ratio failure naming the pair and course; the known-good fixture validates clean; a resident drift lands in warnings not failures.
- [ ] **Step 2–4:** Red → implement → green.

### Task 4: Importer CLI (snapshot-first)

**Files:**
- Create: `server/scripts/ma/importMassachusetts.js`
- Test: `server/scripts/ma/importMassachusetts.test.js` (in-memory Mongo, house harness)

**Interfaces:**
- CLI: `node scripts/ma/importMassachusetts.js` (dry run: builds, validates, writes `server/data/ma/snapshot.json`, prints failure/warning report, exits non-zero on failures); `--apply` upserts into Atlas: `assist_institutions`, `curated_requirements` (degrees + as_degrees), `assist_agreements`, `ma_paper_baselines` — all by `_id`/deterministic keys so re-runs are idempotent; every write carries `state: 'ma'`.

- [ ] **Step 1:** Failing test: apply against in-memory Mongo inserts the expected counts (26 institutions, 11 degrees, 15 AS, 165 agreements, baselines) and is idempotent on second apply.
- [ ] **Step 2–4:** Red → implement → green.

### Task 5: State scoping and the `ma-cs` major

**Files:**
- Create: `server/config/stateScope.js` (+ test)
- Modify: `server/config/majors.js` (add `ma-cs` entry: label `Massachusetts CS`, `state: 'ma'`, programs pinning the 11 university program labels used on the agreements, `degreeAnalysisSlots: ['local_as']`)
- Modify: `server/controllers/Majors.js` (default listing excludes `state` majors so the CA picker never shows `ma-cs`; a `?state=ma` query returns it)
- Modify: `server/services/analysis/pathways.js` (`loadRefs` institution queries take the active major's state via `stateClause`), `server/services/analysis/transferCreditRate.js` (both institution queries likewise)
- Test: extend `server/config/majors.test.js`, `server/services/analysis/pathways.test.js`, `server/services/analysis/transferCreditRate.test.js`

**Interfaces:**
- Produces: `stateClause(state)` → `{ state: 'ma' }` for `'ma'`, `{ state: { $exists: false } }` otherwise; `getMajor(slug).state` drives it inside the services.

- [ ] **Step 1:** Failing bleed-regression tests: with one MA institution/degree/agreement seeded beside the CA fixtures, CA `coverageData` row count and values are unchanged, and `transferCreditRateData` for `cs` returns no MA rows; `coverageData` for `ma-cs` sees only MA institutions.
- [ ] **Step 2–4:** Red → implement → green. Run the FULL server suite after this task.

### Task 6: Apply the import and probe

- [ ] **Step 1:** Dry run; read `snapshot.json` failure report; resolve any real failures (encoding fixes belong in the builders, with tests).
- [ ] **Step 2:** `--apply` to Atlas; re-run dry to confirm idempotent-clean.
- [ ] **Step 3:** Probe: `coverageData(db, null, { requirements: 'degree', majorSlug: 'ma-cs' })` — 165 cells; overall `pct_named_requirement_courses` mean vs their published 38.2%; `transferCreditRateData` for `ma-cs` — 61 computable cells; mean `as_unit_utilization_pct` vs their 68%. Record both for Task 9.

### Task 7: Baselines endpoint

**Files:**
- Create: `server/controllers/Massachusetts.js` (`exports.baselines`: all `ma_paper_baselines` rows, grouped by measure)
- Modify: `server/routes/api.js` (`router.get('/ma/baselines', ...guarded, massachusettsController.baselines)`)
- Test: `server/controllers/Massachusetts.test.js`

- [ ] Red → implement → green.

### Task 8: Massachusetts tab

**Files:**
- Create: `frontend/src/massachusetts/MassachusettsPage.jsx` (+ test) — mirror `frontend/src/virginia/VirginiaPage.jsx`'s shell/routing registration in `App.jsx`/`main.jsx` exactly as Virginia does it; hosts, in order: `CoverageHeatmap`, `CourseTypeCoverage`, `TransferCreditRate`, `TransferExtraUnits`, `TransferExtraCost` — each with `majorSlug='ma-cs'` and `majorCapabilities={{ transferMinimums: false }}`; the coverage heatmap opens with the MA-equivalent course lens active (pass a new `defaultMaEquivalent` prop, default false so CA is untouched).
- Create: `frontend/src/massachusetts/MaComparisonPanel.jsx` (+ test) — fetches `/ma/baselines` + the same figure queries; renders per-measure cards: our recomputed aggregate, their published aggregate, delta; and a per-pair table (61 rows) for `pct_as`/`credit_hours` with cell deltas.
- Modify: `frontend/src/main.jsx` (buster `analysis-v6` → `analysis-v7`).

- [ ] **Step 1:** Failing tests: page renders the five figures with `ma-cs`; comparison panel shows a delta row from mocked baseline + figure data; heatmap honors `defaultMaEquivalent`.
- [ ] **Step 2–4:** Red → implement → green. Run the FULL frontend suite.

### Task 9: Reproduction analysis (the deliverable)

- [ ] **Step 1:** Script `server/scripts/ma/reproductionReport.js`: per-cell diffs — Fig 1 matrix (our `pct_named_requirement_courses` vs tab ratio), Fig 3 (our `as_unit_utilization_pct` vs `pct_as` baseline), Fig 4 (our `extra_units` + 120 vs `credit_hours` baseline) — written to `server/data/ma/reproduction-report.json` with every non-zero delta annotated by cause bucket (`choice-encoding`, `elective-slot`, `unit-fallback`, `resident-drift`, `unexplained`). `unexplained` must end empty or be individually justified.
- [ ] **Step 2:** Write the analysis into `docs/ma-reproduction.md` + update the crosswalk artifact (rev 3) with the reproduction results; update memory.
- [ ] **Step 3:** Full server + frontend suites green; CA/VA probes byte-identical to pre-import values; leave the tree uncommitted for Tybalt's review.
