# Biology + Economics Onboarding (W1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. This plan is phase-gated: Phase 0 runs NOW; Phases 2+ are BLOCKED until the F branch (`major-foundation`) is merged. Check the gate at the top of each phase before starting it. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring Biology and Economics online as fully selectable majors with the articulation-core analyses working, per the locked scope (no AS-degree layer, no paper baselines, no hand-gathered transfer minimums).

**Architecture:** Data flows through the existing `scripts/port.py` pipeline into the existing collections; the only code artifacts are two entries in `server/config/majors.js` (created by F) and curated category mappings. Everything else is curation tracked as W4 preset tasks.

**Spec:** `docs/superpowers/specs/2026-07-22-bio-econ-onboarding-design.md`
**Roadmap:** `docs/superpowers/specs/2026-07-22-expansion-roadmap.md`

## Global Constraints

- **Phase 0 runs on Tybalt's machine** — `port.py` needs `scripts/.env` with `SOURCE_MONGO_URI` (main PMT db) and `TARGET_MONGO_URI` (research cluster). The hosted server never sees source credentials. If the env isn't present, stop and ask Tybalt to run the commands — do not hunt for credentials.
- **Program pin choices are Tybalt's call** (curation). The instance prepares the candidate list and the recommendation; Tybalt confirms before any `add` runs.
- `port.py add` preserves agreement `_id`s/`hash_id`s — re-running is safe/idempotent; `remove --exact` cleanly undoes a bad pick.
- Use `--exact` for every add. Never port by broad contains-match ("biology" would drag in every program containing the word across campuses).
- Record everything in `docs/major-pins.md` (created in Phase 0) — it is the single handoff artifact between phases and the source for the Phase 2 config entries. Program strings are copied **verbatim, including any odd whitespace**.
- Commit per phase on branch `w1-onboarding` (docs + config only; no server/frontend code beyond `server/config/majors.js`). Never push without asking; no Claude commit trailers.
- Phase gates: Phase 1 = F merged (check `server/config/majors.js` exists on `main`). Do not "helpfully" implement F pieces from this plan.

---

## Phase 0 — Discover, pin, and port (RUN NOW; no F dependency)

### Task 0.1: Discover candidate programs per major

- [ ] **Step 1:** From `scripts/`, preview what the source cluster holds:

```bash
python port.py list "biology"
python port.py list "biological"
python port.py list "molecular"      # catches MCB-style names without 'biology'
python port.py list "ecology"        # catches EEB-style names
python port.py list "econom"         # economics + economics/math variants
python port.py status                # snapshot of what's already ported
```

- [ ] **Step 2:** Create `docs/major-pins.md` with one table per major — every candidate program string exactly as printed, grouped by campus (the `list` output shows the stored `major` strings; campus attribution comes from cross-checking ASSIST.org or the source db when ambiguous):

```markdown
# Major program pins

## Biology (slug: bio)
| UC campus | school_id | Candidate programs (verbatim) | Pinned? | Rationale |
| --- | --- | --- | --- | --- |
| UC Berkeley | 79 | "Molecular & Cell Biology, B.A." / "Integrative Biology, B.A." | | |
...all 9 campuses...

## Economics (slug: econ)
| ... |
```

The 9 campus school_ids are the keys of `PAPER_MAJORS` (`server/services/analysis/pathways.js:289-306`): 7, 46, 79, 89, 117, 120, 128, 132, 144.

- [ ] **Step 3:** For each campus, write a one-line recommendation (the program a transfer student aiming at "Biology"/"Economics" would most plausibly target; note L&S vs engineering-college variants, B.A. vs B.S.). Multiple pins per campus are allowed — CS pins several at some campuses.

### Task 0.2: Tybalt confirms pins (HARD GATE)

- [ ] Present the tables; Tybalt marks `Pinned?` per row. **No `add` runs before this.** Record his decisions in `docs/major-pins.md` and commit: `git commit -m "docs(w1): program pin decisions for bio + econ"`.

### Task 0.3: Port the pinned programs

- [ ] **Step 1:** For every pinned row, from `scripts/`:

```bash
python port.py add --exact "<verbatim program string>" --yes
```

- [ ] **Step 2:** Verify: `python port.py status` shows the new majors in the ported list; record results in the `docs/major-pins.md` port log. **Note (learned 2026-07-22): agreement count is NOT a quality signal** — ASSIST publishes a page for every CC × program pair, so essentially every program returns exactly 115 agreements whether or not anything articulates. A count of 0 means a typo in the string; any other count tells you nothing. Articulation quality only becomes visible post-F in the coverage/credit-loss views.
- [ ] **Step 3:** In the console (Admin → Dataset inventory), confirm the new (school, major) rows appear. They will NOT appear anywhere else yet — that's expected until F.
- [ ] **Step 4:** Match-string check (feeds F): for each pinned string, verify it case-insensitively **contains** the planned config `match` (`biology` for bio — note "Molecular & Cell Biology" passes; `econom` for econ). If ANY pin fails this test, write a ⚠ row in `docs/major-pins.md` — the F implementer must then extend `majorScopeFromQuery` to filter by the config `programs` pins (an `$in` clause like `paperMajorsQuery`) instead of the contains string for that major.
- [ ] **Step 5:** Commit the updated pins doc: `git commit -m "docs(w1): bio + econ ported, counts recorded"`.

### Task 0.4: Seed the tracking tasks (needs W4 merged; else defer)

- [ ] If the W4 branch has merged: create preset tasks — one "Major onboarding step" per major, and 18 "Degree template gathering" tasks (9 campuses × 2 majors). If W4 isn't merged yet, add a reminder line to `docs/major-pins.md` and do it when it is.

---

## Phase 1 — GATE: wait for F

- [ ] Confirm `main` contains `server/config/majors.js` and `GET /api/majors` (F merged). Everything below assumes it. If F isn't merged, stop here — Phase 0's data sits harmlessly in the cluster.

## Phase 2 — Config entries + admin enablement (post-F)

### Task 2.1: Add the `bio` and `econ` config entries

- [ ] **Step 1:** In `server/config/majors.js`, add entries per the F spec shape. `programs` comes verbatim from `docs/major-pins.md` (keyed by numeric school_id, arrays of pinned strings). Capabilities: `{ asDegrees: false, paperBaselines: false, transferMinimums: false, snapshots: [] }`. Starting `categories`/`coursePatterns`/`conceptDisciplines` per the W1 spec (bio: calculus, statistics, gen_chem, organic_chem, bio_series, physics, other_science, non_stem; econ: micro_principles, macro_principles, calculus, statistics, other_math, other_social, non_stem) — mark them `// provisional until Phase 3 curation` .
- [ ] **Step 2:** Extend `server/config/majors.test.js`: `listMajors()` returns 3 slugs; each new entry's programs match the pins doc; capability flags false. Run the FULL server suite — the F golden-invariant tests must still pass (they assert cs behavior, not major count; if any test hardcodes "1 major", fix the test to assert cs specifically and note it).
- [ ] **Step 3:** Frontend smoke: `npm run dev`, confirm MajorPicker now renders with 3 majors on the analyses that allow them, and that CS-locked (capability-gated) figures still pin to CS.
- [ ] **Step 4:** Commit: `feat(majors): onboard bio + econ config entries`.

### Task 2.2: Enable visibility

- [ ] Admin → visible majors grid: check the new majors' campuses (Tybalt or the partner does this in the UI — record the date in `docs/major-pins.md`).
- [ ] Verify the CC page, coverage heatmap, credit loss, choice cost, complexity, and time-to-degree all render under each new major (empty-ish category figures are expected until Phase 3).

## Phase 3 — Category + concept curation (console work)

- [ ] For each new major: work through the ported agreements' UC receiving courses in Data → mapping UI, assigning categories from the major's vocab (`?major=<slug>` per F Task 6). Track via the W4 onboarding task checklist.
- [ ] Adjust the provisional `categories`/`coursePatterns` in the config where reality disagrees (e.g. econ stats prefixes); commit adjustments.
- [ ] Extend `prereq_concept` docs where bio/econ chains need nodes (bio: gen_chem_1/2, organic_chem_1, bio_1/2; follow the locked acyclic conventions); tag the corresponding CC courses' `concept` fields for the pilot colleges.
- [ ] Exit check: CategoryGaps and CourseTypeCoverage render for each major without "uncategorized" dominating (eyeball ≥80% categorized).

## Phase 4 — Degree templates (slowest; trails launch)

- [ ] Work the 18 "Degree template gathering" tasks (9 campuses × 2 majors): author `curated_requirements` `kind:'degree'` docs for each pinned program, following the CS-pass conventions (source URL, IGETC lens, unit closure, ordering, keep-unresolved). Verification notes are Tybalt-authored only.
- [ ] Exit check per template: renders on the UC page's program selector; degree-based coverage mode returns sane numbers for 2 spot-check colleges.

## Phase 5 — QA sweep + sign-off

- [ ] Per major: pick 3 CCs (one large, one small, one quarter-system — e.g. De Anza). Hand-check the CC page agreements view and coverage/credit-loss/choice-cost against ASSIST.org. Record findings as task notes; file discrepancies as tasks.
- [ ] Tybalt signs off per major in `docs/major-pins.md` → the major is "launched".

## Phase 6 — Optional snapshots (only when wanted)

- [ ] `npm run snapshot:district-pathways -- --major bio` (etc., per F Task 8's slug-aware generators); add generated names to the major's `capabilities.snapshots`; commit artifacts.

## Self-review notes (applied)

- Spec Steps 1–7 map to Phases 0/0/2/3/4/2+5/6 respectively; the runbook's "definition of done" is Phase 5's exit.
- The match-string ⚠ check (Task 0.3 Step 4) closes the one real design gap between free-text `majorContains` filtering and pinned program names.
- Phase 0 deliberately produces only docs + ported data — zero code — so it cannot conflict with the F/W3/W4 branches.
