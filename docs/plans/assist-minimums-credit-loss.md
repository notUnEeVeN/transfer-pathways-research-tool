# Handoff: ASSIST-minimums variant of the paper credit-loss figure

You are working in `~/Desktop/transfer_pathways/internal_tool` (a Vite/React +
Express research console with a MongoDB research cluster; Python analysis code
in `analysis/`). The paper's Figure 1 ("credit loss in transfer pathways") has
already been ported and validated — read these first, in order:

1. `docs/figures/paper-credit-loss.md` — what exists, how it was validated.
2. `analysis/paper_credit_loss.py` — the whole computation. Its module
   docstring documents every rule of the paper pipeline it replicates.
3. `frontend/src/analyses/PaperCreditLoss.jsx` + `paperCreditLossBaseline.js`
   — the three-view SVG component (Paper baseline / Our data / Difference).
4. `frontend/src/analyses/PaperDistrictHeatmap.jsx` — the precedent for the
   feature you are adding: its `REQ_MODES` toggle ("Website minimums" vs
   "ASSIST minimums").
5. `server/services/analysis/optionSolver.js` and
   `server/services/analysis/pathways.js` (`coverageData`, the
   `requirements='assist'` branch, `loadCuration`/`makeIsExcluded`) — the
   console's existing ASSIST-demand semantics you must mirror.

## The task

Add an **ASSIST-stated-minimums mode** to the credit-loss figure, exactly as
the heatmap has: today the figure measures demand against the hand-curated UC
website minimums (`ref_uc_transfer_requirements`); the new mode measures
demand against **what the ASSIST agreements themselves mark as required**
(`uc_agreements` → `requirement_groups` with `is_required`), so the team can
see how the two demand models differ. The paper never computed this, so there
is no paper baseline for it — the comparison is *our data under ASSIST
minimums* vs *our data under website minimums*.

Deliverables:

1. `analysis/paper_credit_loss.py --requirements assist` → writes
   `frontend/src/analyses/data/paper-credit-loss.assist.json` (same shape as
   the existing `paper-credit-loss.ours.json`, plus demand-distribution
   metadata described below). The default (website) mode and all its outputs
   must remain **byte-identical** — regression-check this.
2. A "Minimums" toggle in `PaperCreditLoss.jsx` (mirror the heatmap's
   `REQ_MODES` styling/labels): in *Website minimums* mode the views stay
   exactly as now; in *ASSIST minimums* mode the views are **Our data
   (ASSIST)** and **Difference vs website minimums** (reuse the existing
   shaded-delta-region diff rendering with the website-minimums bars as the
   ghost; Paper baseline is website-only — switching to it flips the toggle
   back, or disable it, matching whatever reads cleanest with the current
   control layout).
3. A new section in `docs/figures/paper-credit-loss.md` ("ASSIST-stated
   minimums variant") following the house style: a short plain-language
   summary first, then methodology mapping table, findings with named
   receipts, anticipated questions. Update the doc's "The short version" with
   one sentence. Update `analysis/README.md` and `docs/README.md` rows.
4. Verification evidence (see "Acceptance checks" below) — run everything,
   don't just implement.

## Design decisions — already made, do not re-litigate

**Demand model.** For each agreement (one `uc_agreements` doc = one college ×
campus × program): required groups are those with `is_required !== false`.
Honor the same semantics as `optionSolver.agreementMinSet`:
`group_advisement` = satisfy N receivers across the group;
`group_conjunction === 'Or'` with multiple sections = one section suffices
(each section per its `section_advisement`, default all receivers); otherwise
every section per its advisement. Apply the console's curation exclusions
exactly as `pathways.js` does (`loadCuration` → `makeIsExcluded` — receivers
judged "recommended, not required" are skipped). Receiver → CC-course
alternatives: reuse the existing `receiver_alternatives()` port in
`paper_credit_loss.py` (it already mirrors `optionSolver.receiverAlternatives`
including the 64-combo cap).

**Unit of evaluation = one college.** Under ASSIST minimums the demand varies
per college, so the paper's district pooling (merge supply across colleges
against a fixed demand) is ill-defined. Instead: evaluate each **college**
jointly across a campus subset (one MILP: minimize distinct CC course names
at that college satisfying every subset campus's required receivers, with
**program choice inside the MILP** — a binary per program, exactly one
program selected per campus that has agreements at that college; only the
selected program's groups constrain). A campus with **no agreement at the
college** contributes its receivers as all-unarticulated (mirrors the paper's
"Not Articulated": free in the objective, counted as unarticulated — use the
modal receiver count for that campus as the unarticulated count, and document
this). Then **district value = the best college**: per subset, take the
college minimizing (unarticulated count, then articulated count, then college
name) — prefer completable, then cheapest, then deterministic. Note the min
of monotone-in-subset functions stays monotone, so the paper's
`max(0, marginal)` position accounting still behaves.

**Everything downstream is unchanged** and must reuse the existing functions
rather than duplicating them: P(9,4) permutations with campus-subset
memoization, marginal course names per slot, ÷336, per-district rounding to
2dp, transferable average over districts with rounded unarticulated == 0,
round-then-average. Same `--workers` multiprocessing over districts (worker
payloads become per-district lists of per-college structures).

**Unarticulated identity.** The paper counted university-course *names*. For
ASSIST mode, dedupe unarticulated receivers by their receiving university
course code: resolve `receiver.receiving.parent_id(s)` via the
`university_courses` collection (verify its exact field names first — likely
`parent_id`/`course_code`; it was not fully inspected). Fall back to
`hash_id` for unresolvable receivers rather than crashing, and log how many
fell back. Articulated course identity: same "PREFIX NUMBER (units)" display
names already used (within a single college there is no cross-college
dedup question).

**Gold bars.** Under ASSIST the requirement count varies by college. The
figure shows one gold bar per campus: use the **modal** required-receiver
count across that campus's (college, program) agreements (count receivers the
MILP would consider for the cheapest program — i.e. the per-agreement
`receiversConsidered` analog, curation-excluded receivers omitted,
advisements respected: a group_advisement of N counts as N, an 'Or' group
counts as its cheapest section's demand). Quarter campuses convert to
semester equivalents by ÷1.5 rounded to 2dp exactly like the website gold
bars (`CAMPUSES[*].quarter` already encodes the split). Store in the JSON,
per campus: the modal count, the min/max across colleges, and the number of
distinct values — the doc should mention how uniform or not the demand is.

**JSON.** Same schema as `paper-credit-loss.ours.json` (`generated_by`,
`generated_at`, `dataset_version`, `campuses[]` with `requirement` and
`choices[] {order, transferable_average, districts_included}`), plus a
`demand` object per campus with the distribution stats above, and
`"requirements": "assist"` at top level. Also write per-district receipts to
`analysis/results/paper_credit_loss_assist_districts.csv` (same columns as
the existing districts CSV).

## Acceptance checks — all must pass and be reported

1. **Website-mode regression**: after your changes, `--diff` (default mode)
   reproduces the current `paper-credit-loss.ours.json` byte-for-byte
   (ignoring `generated_at`) and the current delta table (7 of 9 campuses
   +0.00 at 1st choice, UCD +0.08, UCSD/UCSB −0.02). `--validate-paper`
   still reports 2,592/2,592 course counts and 32/36 figure numbers.
2. **Optimal ≤ greedy, everywhere**: for every (college, campus, program)
   agreement, your single-campus MILP course count must be ≤ the greedy
   `agreementMinSet` count. Implement the comparison (port the greedy or
   query `/analysis/credit-loss`… simpler: port `satisfyN`+`improvePicks` is
   NOT needed — just assert MILP ≤ the greedy count computed by a
   straightforward reimplementation, or skip greedy and instead assert MILP
   feasibility + report the count distribution). At minimum: hand-verify
   three agreements end-to-end (print chosen bundles, check them against the
   raw agreement doc) and include one worked example in the doc.
3. **Heatmap cross-validation (the strong anchor)**: for each (campus,
   district), "some college has zero unarticulated required receivers for
   that campus alone" must agree with the console's ASSIST-minimums coverage
   (`fully_articulated` for some CS program of some college in the district —
   the `coverageData` assist branch in `pathways.js`; replicate its exact
   rule offline against the same DB rather than calling the API).
   Investigate every disagreement to root cause before shipping — this is
   the equivalent of the `--validate-paper` check and it is what makes the
   numbers trustworthy. Expect ASSIST-minimums completeness to be rare
   (the heatmap code comments say ASSIST lists receivers that articulate
   almost nowhere) — inclusion counts for the transferable average may be
   tiny or zero for some campuses; if a campus has zero included districts,
   the figure must render its bars as 0 with `districts_included: 0` and the
   doc must call this out rather than hiding it.
4. **Determinism**: run the assist computation twice; outputs identical.
5. **Build + renders**: `npm run build --prefix frontend` passes; re-render
   the component views (see `docs/figures/paper-credit-loss.md` "render
   parity" section for the headless-Chrome recipe the repo used; scripts live
   in the session scratchpad, easy to recreate: esbuild-bundle FigureSVG via
   `react-dom/server`, screenshot `--window-size=1991,1191`) and eyeball the
   ASSIST views for label collisions — ASSIST gold bars will be much taller
   (Y_MAX is computed dynamically from the bars, so the axis adapts; check
   the tick generation still looks right for values > 8).

## Known pitfalls from the earlier sessions

- Run Python via the venv **with `cd` in the same command**: background
  shells reset the cwd, and a bare `.venv/bin/python` then fails while
  `| tail` masks the exit code. Always
  `cd ~/Desktop/transfer_pathways/internal_tool/analysis && .venv/bin/python …`
  and check the output file actually grew.
- The venv is `analysis/.venv` (pymongo, python-dotenv, pulp installed);
  Mongo creds auto-load from `scripts/.env` (`MONGO_URI`/`TARGET_MONGO_URI`,
  `DB_NAME` default `pmt_research`).
- PuLP: name MILP variables deterministically (never `hash()` — that
  randomness is exactly what made 4 of the paper's numbers irreproducible;
  it's documented in the figure doc).
- `ref_campus_calendars` does **not** exist in this DB; the quarter/semester
  split is hardcoded in `CAMPUSES` — reuse it.
- Runtime budget: website mode does 72 districts × 255 subset-MILPs in
  ~3 min at `--workers 8`. ASSIST mode is per-college (~115 colleges ×
  255 subsets) with bigger models — expect ~10–20 min; memoize per
  (college, frozenset(campuses)) and drop campuses with no agreement at the
  college from the model early (they only add a constant unarticulated
  count; add it outside the MILP).
- Do NOT commit; leave everything staged. Do not modify
  `paperCreditLossBaseline.js`, the website-minimums JSON, or the paper
  baseline rendering path.

## Doc content expectations

The new doc section should answer, with receipts: how much bigger is ASSIST's
stated demand than the website minimums per campus (gold-bar comparison +
demand distribution); how many districts are fully transferable under ASSIST
minimums (expect: dramatic collapse — name the surviving districts); which
specific required receivers most often block completeness (top-5 by count,
with university course codes — this is the "what to check by hand" surface);
and a one-paragraph plain-language "short version" bullet for the top of the
doc. Frame carefully: this is *our extension*, not a paper replication — the
paper's methodology section of the doc must stay untouched.
