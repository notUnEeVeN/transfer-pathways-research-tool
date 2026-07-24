# Economics associate-degree research checkpoint — 2026-07-23

The statewide speed-first Economics pass is complete. The source cohort is
pinned to **academic year 2025-2026** to match the latest complete ASSIST year;
newer 2026-2027 requirements were not substituted or relabeled.

## Final corpus

- Canonical college universe: **115 / 115** researched; **0 remain**.
- Official statewide discovery index: **97 colleges listed** and **100 raw
  program candidates**.
- Research outcomes: **97 `requirements_extracted`** and **18 sourced
  `none_found`** checkpoints.
- Awards extracted: **120** — 97 transfer awards (`ast`), no local A.S.
  awards, and 23 local A.A. awards (`local_other`).
- Database publication set: **174 rows** — the 120 found awards plus three
  explicit confirmed-none slots for each of the 18 negative checkpoints.
- Course resolution: **2,536 / 2,552 (99.4%)** — 2,456 exact-number links, 80
  conservative title-fallback links, and 16 unresolved citations.
- Three entirely unresolved groups remain in extraction metadata: Riverside
  City College statistics, Santa Barbara City College social-science
  electives, and Southwestern College foreign language.
- **161** catalog choice/alternative warnings remain review-gated. Every row
  has `analysis_ready: false` pending human verification and degree-template
  work.

The cumulative publication snapshot is
`scripts/data/as_degrees_econ_compiled.json`. Every college-specific source and
its catalog year is embedded in `colleges/<id>.json` for human verification.
The Economics transfer slot displays as **A.A.-T** while retaining the
major-neutral internal slot name `ast`.

## Scope and identity decisions

1. Active degree and negative sources are **2025-2026**.
2. The corpus includes general Economics A.A.-T., A.S.-T., A.A., and A.S.
   awards only. Business, accounting, and specialized/adjacent programs are
   out of scope.
3. The printed award is preserved in `award_seen`, including catalog-internal
   A.A.-T./A.S.-T disagreements.
4. Runtime IDs are `as_degree:<college_id>:econ:<slot>` with slots `ast`,
   `local_as`, and `local_other`.
5. One strong official college source per award is sufficient for this fast
   pass; source uncertainty is preserved rather than silently resolved.
6. Publication is upsert-only and skips any row saved or verified by a human.
7. Publication does not make a row analysis-ready.

## Validation and publication

From the repository root:

```bash
python scripts/econ_as_research.py validate
python scripts/econ_as_research.py status
python scripts/import_econ_as_degrees.py --dry-run
python scripts/import_econ_as_degrees.py
```

The importer reads `TARGET_MONGO_URI` and `TARGET_DB_NAME` from
`scripts/.env`. Run the dry-run against the exact intended database before a
live publication.

## Human-verification priorities

- Review the 16 unresolved citations and the three fully unresolved groups
  before enabling analysis.
- Review the 80 title-fallback links recorded in
  `extraction.title_fallback_matches`.
- Structure the 161 conditional-choice, prior-list, and alternative warnings
  preserved in `extraction.modeling_warnings`.
- Resolve source-internal award and unit inconsistencies only against the
  embedded official catalog links; do not infer missing requirements.
