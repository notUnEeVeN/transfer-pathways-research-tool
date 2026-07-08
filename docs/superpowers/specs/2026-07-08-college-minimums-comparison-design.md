# Data page: per-college ASSIST-vs-website minimums comparison

**Status:** design approved (decisions locked), pending spec review
**Date:** 2026-07-08
**Scope:** the Data tab's Agreements browser + one new read-only analysis endpoint. No
new top-level page; the paper figures and other analyses are untouched.

## 1. Motivation

Nothing in the app puts the two minimum sources side by side for a college. The
coverage heatmap has an assist/website *toggle* (you flip, you never see both at
once); the paper figures swap whole versions; the Agreements browser's single
`AgreementDetail` only shows the default (ASSIST) coverage. Yet the most useful
question a researcher asks about a community college is exactly the comparison:
*"how much of the website hard-minimum does this CC articulate, vs how much of what
ASSIST actually states — and which courses drive the gap?"*

The two are **different requirement sets** (website = a curated per-campus hard
minimum; ASSIST = the full per-major required groups), so the story is usually
"ASSIST asks for more — here is what this college does and doesn't articulate."

## 2. Goals / non-goals

**Goals**
- In the Agreements browser, keep the current campus × major → colleges → college
  navigation, and add the ASSIST-vs-website comparison at the two lower levels.
- **Level 1 (colleges list):** each CC shows Website coverage % vs ASSIST coverage %
  + the delta, sortable by gap, with a summary strip.
- **Level 2 (college detail):** a course-level diff — every UC requirement tagged
  in-website / in-ASSIST / articulated-here — plus per-college coverage stats.
- One new focused read-only endpoint powering Level 2.

**Non-goals**
- No new top-level page or route (state-based nav stays).
- No cross-campus "this CC across all 9 UCs" profile — the campus is fixed by the
  Agreements entry (could be a later addition).
- No change to `coverageData`'s existing behavior, the paper figures, or the engine.
- Entry stays campus × major (extensible to non-CS majors later); for now the
  canonical CS major is the one that lines up with the website minimum.

## 3. Navigation & entry

Unchanged: Data tab → **Agreements** → pick campus × major program → colleges list →
one college. The major picker stays so we can expand beyond the canonical CS major
later; today the canonical CS major (the one in `dataset_config.partner_access`) is
what aligns with the curated website minimum.

The website minimum is campus-level (no major), so for a fixed campus the Website
column is identical across majors; only the ASSIST column follows the chosen major.

## 4. Level 1 — colleges list (enhance `ProgramColleges`, DataPage.jsx:179-252)

For the selected campus × major, replace the single coverage bar per college with a
two-column comparison:

```
Community college      Website min.   ASSIST min.    Δ      full?
De Anza                ████ 100%      ███░ 78%     −22%    W✓ A✗
Foothill               ████ 100%      ██░░ 66%     −34%    W✓ A✗
Allan Hancock          ████ 100%      ████ 100%      0%    W✓ A✓
 …
── summary: 112 colleges · mean Website 96% / ASSIST 74% · fully-prep 88 → 41 ──
```

- **Website %** = `coverageData({requirements:'paper', groupBy:'college'})` row for
  this campus, joined by `community_college_id`.
- **ASSIST %** = `coverageData({requirements:'assist', groupBy:'college'})` row for
  this campus × major.
- Δ = ASSIST − Website; `full?` = the two `fully_articulated` flags.
- Sortable by Δ (biggest gaps first), by name, or by either %.
- Summary strip: college count, mean Website % / mean ASSIST %, fully-prep counts
  under each minimum.

Both coverage calls already exist; Level 1 is a client-side join + presentation.

## 5. Level 2 — college detail (enhance `AgreementDetail`, DataPage.jsx:537-609)

Clicking a college adds a **Comparison** view above the existing Rendered / JSON /
Raw tabs (which stay):

```
Website 6/6 (100%)   ·   ASSIST 9/13 (69%)   ·   ASSIST adds 7 reqs, articulates 3 of them

UC requirement   Website   ASSIST   Articulated here?
MATH 20A            ✓        ✓             ✓
CSE 8A              ✓        ✓             ✓
CSE 15L             –        ✓             ✗   ← ASSIST-only gap (blocks ASSIST-full)
MATH 20E            –        ✓             ✓
 …
```

- Stat tiles: Website coverage (Y/Z), ASSIST coverage (B/C), and "ASSIST adds N
  requirements beyond the website minimum; this college articulates M of them."
- Unified table: one row per distinct UC requirement course, columns
  `in_website` / `in_assist` / `articulated_here`. ASSIST-only rows that aren't
  articulated (the gaps) are highlighted.
- Choose-N honored: a UC requirement that sits inside a satisfiable "Complete 1 of…"
  section is not shown as a blocking gap (consistent with the engine coverage).

## 6. New endpoint — `requirementComparisonData`

`GET /analysis/requirement-comparison?school_id&major&community_college_id`
(read-only; mirrors the other `Analysis.js` endpoints: param parsing, per-key cache,
`X-Dataset-Version`). Returns the unified per-requirement table for one
(campus, major, college):

```jsonc
{
  "school_id": 7, "school": "UC San Diego",
  "major": "CSE: Computer Science B.S.",
  "community_college_id": 30, "community_college": "De Anza College",
  "website": { "required": 6, "articulated": 6, "pct": 100, "fully": true },
  "assist":  { "required": 13, "articulated": 9, "pct": 69, "fully": false },
  "assist_extra": 7, "assist_extra_articulated": 3,
  "requirements": [
    { "uc_code": "MATH 20A", "parent_id": 1234, "in_website": true,  "in_assist": true,  "articulated": true },
    { "uc_code": "CSE 15L",  "parent_id": 5678, "in_website": false, "in_assist": true,  "articulated": false }
    // …
  ]
}
```

**Computation (in `server/services/analysis/pathways.js`, reusing existing helpers):**
- ASSIST side: the required receivers of the (school_id, major, community_college_id)
  agreement (choose-N honored via the eligibility engine, as `coverageData` does);
  each receiver → its UC receiving `parent_id`/`uc_code` + articulation.
- Website side: `ref_uc_transfer_requirements` curated rows for `school_id` (via
  `loadTransferRequirements`); each row's `parent_ids` matched against the college's
  articulated parent_ids (the `hardRequirementCoverageData` logic).
- Unify by UC course (`parent_id`): merge into one row list with `in_website`,
  `in_assist`, and a single `articulated` (evaluated from the college's articulated
  parent_ids so both sides use the same articulation reality).
- Aggregate the `website`/`assist` coverage summaries + `assist_extra` counts.

A `useRequirementComparison` query hook (frontend/src/shared/query/hooks/useData.js,
matching `useCoverage`) feeds Level 2.

## 7. Data flow

```
Agreements: pick campus × major
  └─ Level 1 colleges list
       useCoverage({requirements:'assist', groupBy:'college'})  ┐ join by
       useCoverage({requirements:'paper',  groupBy:'college'})  ┘ community_college_id
       → per-college Website% vs ASSIST% + Δ + summary
  └─ click a college → Level 2 detail
       useRequirementComparison({school_id, major, community_college_id})
       → stat tiles + unified requirement table   (+ existing ledger/JSON/raw tabs)
```

## 8. Testing

- Server: unit-test `requirementComparisonData` against a fixture agreement +
  curated requirements — assert the unified table tags in_website/in_assist/
  articulated correctly and the summaries match, incl. a choose-N case (an
  unarticulated optional alternative is not a false gap) and an ASSIST-only-gap case.
- Verify on real data: De Anza / Allan Hancock × a UCSD/UCB CS major read sensibly
  (Website ~100%, ASSIST < 100% with the named gap courses).
- Frontend build passes; the colleges list + detail render without layout breakage.

## 9. Risks / open items

- **Articulation source for the unified `articulated` column.** Resolve at
  implementation: evaluate each UC course against the college's articulated
  parent_ids (union across its CS agreements) so the Website and ASSIST columns are
  judged against one consistent articulation set. Confirm this matches the % that
  `coverageData` reports for each side (they should agree at the summary level).
- **UC course identity.** Join ASSIST receivers ↔ curated rows by
  `receiving.parent_id`; series receivers carry `parent_ids` (expand). Confirm the
  curated rows and ASSIST receivers share the parent_id space (they do elsewhere).
- **Major/website scope mismatch is expected**, not a bug — surface it (ASSIST-extra
  count) rather than hide it.

## 10. Deliverables checklist

- [x] `requirementComparisonData` in `pathways.js` + export + `Analysis.js` endpoint + route
- [x] server unit test (fixture: choose-N + ASSIST-only-gap)
- [x] `useRequirementComparison` hook
- [x] Level 1: `ProgramColleges` two-column comparison + sort + summary strip
- [x] Level 2: `AgreementDetail` Comparison view (stat tiles + unified table)
- [x] real-data spot check + frontend build

**Implementation notes (resolved open items):**
- Unified `articulated` column and both summaries are judged against ONE set:
  the college's articulated UC `parent_id`s (union across its CS agreements for
  the campus). §9's articulation-source item is settled this way.
- UC course codes: `receiving` objects in real data frequently carry no name, so
  `requirementComparisonData` resolves `parent_id → "PREFIX NUMBER"` from
  `university_courses` (one `$in` round trip) rather than trusting `receiving.name`.
- Level 1 joins two `useCoverage` calls (assist per-major, paper per-campus);
  Level 2 calls the new endpoint. Website column is campus-level (same across majors).
- **Difference is choose-N aware, not per-receiver.** "ASSIST asks more" counts
  only courses ASSIST requires BEYOND the website minimum. A required section is
  "already covered" when the website minimum provides enough of its alternatives,
  so a choose-1 section whose taken alternative is a website course adds nothing —
  its other alternatives are unchosen options, not extra requirements. Endpoint
  returns `website_requirements[]`, `assist_extra_groups[]` (each `{choose, gap,
  options[]}`), plus `assist_extra`, `assist_extra_articulated`, `website_only`,
  and `net_courses` (ASSIST minimum size − website minimum size; negative = fewer).
  This makes "100% ASSIST + unarticulated extras" impossible, and surfaces the
  common real case where ASSIST's true minimum is *smaller* than the curated set.
