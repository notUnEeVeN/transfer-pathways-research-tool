# FIX (high priority): ASSIST-minimums eligibility is wrong — use PMT's formula

**Proven counterexample (2026-07-07):** UCB × College of Marin, `Computer
Science, B.A.`: one required group; section 1 `section_advisement: 2` (MATH
51, 52 — both articulated via COM MATH 123/124); section 2
`section_advisement: 1` (MATH 54 / EECS 16A / MATH 56 — MATH 54 and MATH 56
articulated). Marin therefore FULLY satisfies UCB's ASSIST-stated demand.
Our ASSIST outputs marked UCB blocked in 71 districts by "MATH 56" because
the demand model treated every receiver as mandatory, ignoring
`section_advisement` choose-N semantics.

**Why the validation didn't catch it:** `validate_assist_coverage` compared
the MILP against an OFFLINE REPLICA of the coverage rule written in the same
file — both sides shared the bug (correlated error). Additionally the
server's own assist branch in `pathways.js coverageData` computes
`fully_articulated` as "every receiver in required groups articulated",
which has the same flaw — so the heatmap's "ASSIST minimums" toggle is wrong
too.

**Required fix (user-specified):**
1. Port the eligibility formula from the production Plan My Transfer site —
   repo at `~/Desktop/pmt` — as the single source of truth for "does a
   college satisfy a campus's ASSIST-stated requirements". Find its
   agreement-evaluation code (search for section/group advisement handling,
   e.g. "advisement", "select", "eligib") and replicate it exactly, with ONE
   deliberate modification: where PMT treats a mandatory requirement with NO
   articulation as default-ACCEPTED, we treat it as NOT satisfied.
2. Apply that formula in ALL of:
   - `analysis/paper_credit_loss.py` ASSIST mode (demand model +
     unarticulated counting + blockers; the MILP's constraints must encode
     choose-N per section/group exactly as PMT does),
   - `server/services/analysis/pathways.js` assist coverage
     (`fully_articulated`) — this drives the heatmap's ASSIST toggle,
   - re-check `optionSolver.agreementMinSet` against PMT's semantics (it
     honors section_advisement, but verify group-level rules match PMT).
3. Re-run ASSIST mode; regenerate JSON + blockers. Acceptance: UCB × College
   of Marin (and by extension Marin CCD) is fully articulable; re-derive UCB
   inclusion counts; verify 3+ agreements by hand against ASSIST.org pages
   (print chosen receivers per section vs the page's "Complete 1 from the
   following" blocks).
4. Independent validation MUST NOT be a same-file replica: validate against
   PMT's own evaluation (import/port its code as the oracle, or run its
   implementation directly on the same docs).
5. Update `docs/figures/paper-credit-loss.md` ASSIST section (inclusion
   counts, blockers, short-version line) — current numbers there are WRONG.
   Website-minimums mode and the paper replication are unaffected (their
   demand comes from `ref_uc_transfer_requirements`, not agreement groups).

Known-good context: PAPER_MAJORS pinning (frozen per-campus program lists) is
correct and validated — do not touch. `university_courses` code lookup:
field is not `course_code` for all docs — inspect actual fields before
resolving labels.
