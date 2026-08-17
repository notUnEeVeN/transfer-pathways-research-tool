# Massachusetts state port — design

Port the MA paper's data into our structures as a third state alongside
California and Virginia, recompute what their repo supports through the exact
CA engine, import the rest as published baselines, and produce a written
comparison of their method against ours.

**Status: awaiting Tybalt's approval.** Nothing below is implemented.

---

## What the recon established (2026-08-14, rev. 2 after git-history recovery)

The paper repo (`ma_paper/transferpaper`) contains **course-level truth for
everything** — part in the working tree, part recoverable only from git
history (commit `59c1b77`, absent from the current tree):

- **`Mass Heatmap.xlsx`, 11 university tabs** (working tree) — each tab
  lists that university's required BSCS courses by name and code as columns
  (lower-division block first, then upper-division), and each of the 15 CC
  rows carries a **per-course True/False articulation verdict**, plus an
  `MT` column marking A2B-pathway existence and a `Total` tally row. The
  complete binary matrix behind their published Figure 1 (38.2% mean) and
  Figure 2.
- **`Sheets/All CC AS.xlsx`** (git history only) — all 15 community
  colleges' AS-in-CS degrees in Curricular Analytics format: Course ID,
  Name, Prefix/Number, Prerequisites, Corequisites, credit hours, semester
  system, CIP code.
- **`Sheets/All Pathways/<University>.xlsx` × 11** (git history only) —
  the resident BSCS plan as the first tab, then **one tab per local CC
  pair**: the layered transfer pathway with credit hours and prerequisite
  links — the exact inputs behind Figures 3–6 ("sum of Column H").
- **`CurrComp Master.xlsx`** (working tree) — the five aggregate sheets: a
  CC × university matrix of the published per-pair values (61 local pairs,
  Resident row per university). These become **validation targets** for our
  recomputation, not the only source.
- The workbook numbers reproduce the **final SIGCSE PDF** (38.2%, 68%,
  +13, $7,129, +15), not the repo's stale LaTeX draft. All comparisons pin
  to the final PDF.

Consequences for scope — everything recomputes, with published values as
the diff target:

| Their figure | Port mode |
|---|---|
| Fig 1 requirements heatmap | **Recompute** through our CA engine from imported templates + synthetic articulation; validate against their per-cell ratios |
| Fig 2 course-type distribution | **Recompute** (same engine, our course-typing rules on their course codes) |
| Fig 3 transfer credit rate, Fig 4 extra hours, Fig 5 cost | **Recompute** through `transferCreditRateData` from imported AS degrees (recovered) + templates + per-pair articulation; diff every cell against their published 61-pair values |
| Fig 6 complexity | Deprioritized by Tybalt; the recovered prerequisite links make it *possible* later, and its published baselines import for free |
| Fig 7 summary table | Derives from 3–6; render from our recomputed values beside their published row |

The recovered workbooks are vendored into this repo (open decision 6) so
the port never depends on the upstream repo's history remaining reachable.

## Data placement — recommended approach (C), with alternatives

**C (recommended): same document shapes, separate namespace.** Import MA
into the existing collections using the same schemas the CA engine already
reads, stamped and scoped so nothing bleeds:

- `curated_requirements` gains 11 `kind: 'degree'` documents
  (`state: 'ma'`, `major_slug: 'ma-cs'`, reserved `school_id` range e.g.
  9000+), course-count-shaped exactly like the nine CA CS templates: one
  receiver per required course, `tier: 'transferable'` for the
  lower-division block, `'nontransferable'` for upper-division, no GE groups
  (their data excludes GE by construction). "X or Y" course headers become
  one receiver with alternatives noted; the two "Natural Science Elective"
  columns become a 2-slot section. Credit hours come from the recovered
  resident-plan tabs, so unit lenses work too.
- `curated_requirements` gains 15 `kind: 'as_degree'` documents
  (`state: 'ma'`, `degree_type: 'local_as'`) built from the recovered
  `All CC AS.xlsx`: named-course sections with per-course credits in the
  same shape the CA AS-T documents use, `total_units` from the sheet's
  credit sum (validated against the published `% Credit Hours`
  denominators, e.g. Berkshire's 65).
- `assist_agreements` gains 165 synthetic agreements (`state: 'ma'`), one
  per pair: each required course a receiver with a minted `parent_id`,
  `articulation_status` from the heatmap boolean, and sending-course
  options minted from the recovered pathway overlays (an AS course that
  maps to a BS requirement in the pair's pathway tab becomes that
  receiver's option), so `transferCreditRateData` runs unmodified.
- `assist_institutions` gains the 15 MA community colleges and 11
  universities with `state: 'ma'` and reserved `source_id`s.
- A small `ma_paper_baselines` collection (or `kind: 'paper_baseline'`
  rows) holds the published per-pair Q2 values (four measures × 61 pairs +
  the per-university Resident row), plus their Fig 1/Fig 2 aggregates for
  the comparison panels.
- `config/majors.js` gains an `ma-cs` entry (code-config majors per the
  locked expansion-roadmap decision) pinning the 11 MA programs; the small
  set of institution loads that would otherwise mix states (pathways
  `loadRefs`, the transfer figures' institution query, Data-tab reference
  lists) learn a `state` filter that defaults to `'ca'` when absent, so
  every existing CA query is untouched by default.

Why not the alternatives: **(A)** un-stamped insertion into the shared
collections risks MA rows bleeding into CA figures (institution lists,
coverage matrices, the 9-UC/115-CC constants discipline); **(B)** VA-style
separate collections (`ma_*`) is proven for isolation but defeats the point
— Virginia has its own service code, and the goal here is running MA data
through *literally the same functions* as CA.

## Frontend

A third state tab (routing and shell mirroring `VirginiaPage`), hosting:

1. **Recomputed figures** — the existing `CoverageHeatmap` and
   `CourseTypeCoverage` components pointed at `majorSlug: 'ma-cs'`. The
   MA-equivalent course lens (built this week) is the *native* lens for this
   tab — their templates carry no units, so unit lenses would show the
   4-unit assumption throughout and default off.
2. **Recomputed transfer figures** — `TransferCreditRate`,
   `TransferExtraUnits`, `TransferExtraCost` pointed at `ma-cs`, running on
   the imported AS degrees and synthetic agreements.
3. **A comparison panel** — per-cell: our recomputed value vs their
   published value (61 pairs × the Fig 3–5 measures, plus the Fig 1
   matrix), with deltas; per-figure: their MA aggregate vs our CA aggregate
   on the identical measure. Fig 6's published values render as a
   baseline-only card until the complexity port exists.

## Validation and testing (TDD throughout)

- **Importer round-trip:** after import, recompute each pair's Lower and
  all-levels ratios from the imported documents and diff against the tab's
  own `Lower`/`Upper` columns; the importer fails loudly on any mismatch.
  A2B flags and Total rows check the same way.
- **Reproduction target:** our engine over imported MA data must reproduce
  their published Figure 1 matrix (38.2% mean) within
  encoding-explainable deltas; every residual delta gets a named cause
  (e.g. choose-one "MATH 120 or MATH 202" encodings, elective-slot
  judgments). That list *is* the methodology-comparison deliverable.
- **Bleed regressions:** with MA data present, CA and VA figure row counts
  and headline values are byte-identical to before the import.
- Importer, config scoping, and page each carry their own tests in the
  house style.

## Deliverable of the analysis phase

A written comparison (doc + artifact): where our engine reproduces their
numbers exactly, where it diverges and why (their hand-tally judgments vs
our encodings), what their structure could not express (units, choose-N,
series, GE netting, caps), and what ours holds that theirs needed
(per-course booleans as degenerate articulation). CA-vs-MA cross-state
reads on the shared measures close it out.

## Open decisions for Tybalt

1. Approach A / B / **C (recommended)**.
2. Own top-level tab (as requested, mirroring Virginia) — confirm.
3. Reserved id ranges for MA schools/colleges (proposal: school_id 9001–9011,
   community_college_id 9101–9115, parent_ids 900000+).
4. Where published baselines live (`ma_paper_baselines` collection vs
   `kind: 'paper_baseline'` rows — recommend the dedicated collection).
5. Whether the importer runs against Atlas directly (like `dev-db` workflow)
   or produces a reviewable JSON snapshot first (recommend snapshot-first).
6. Where the recovered git-history workbooks are vendored (recommend
   `ma_paper/recovered/` beside the upstream checkout, with the source
   commit hash recorded; they are inputs the importer must be able to
   re-read forever).

*Not committed to git: the repo's hold-until-complete commit policy applies;
this file rides with the working tree until the feature lands.*
