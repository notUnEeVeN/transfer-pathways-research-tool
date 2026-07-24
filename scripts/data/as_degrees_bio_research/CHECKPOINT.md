# Biology associate-degree research checkpoint — 2026-07-23

The statewide speed-first Biology pass is complete. The source cohort is
pinned to **academic year 2025-2026** to match the latest complete ASSIST year;
newer 2026-2027 requirements were not substituted or relabeled.

## Final corpus

- Canonical college universe: **115 / 115** researched; **0 remain**.
- Official statewide discovery index: **106 colleges listed** and **103 raw
  program candidates**.
- Research outcomes: **105 `requirements_extracted`** and **10 sourced
  `none_found`** checkpoints.
- Awards extracted: **166** — 98 `ast`, 57 `local_as`, and 11 `local_other`.
- Database publication set: **196 rows** — the 166 found awards plus three
  explicit confirmed-none slots for each of the 10 negative checkpoints.
- Course resolution: **2,110 / 2,118 (99.6%)** — 2,045 exact-number links, 65
  conservative title-fallback links, and 8 unresolved citations.
- One entirely unresolved requirement group remains in extraction metadata:
  El Camino College's local A.S. “Preparation for Biology Transfer Major.”
- **173** catalog choice/alternative warnings remain review-gated. Every row
  has `analysis_ready: false` pending human verification and degree-template
  work.

The cumulative publication snapshot is
`scripts/data/as_degrees_bio_compiled.json`. Every college-specific source and
its catalog year is embedded in `colleges/<id>.json` for human verification.

## Scope and identity decisions

1. Active degree and negative sources are **2025-2026**.
2. The corpus includes general Biology/Biological Sciences A.S.-T., A.S., and
   A.A. awards only. Certificates and specialized/adjacent programs are out of
   scope.
3. General Biology/Biological Sciences A.A. awards use `local_other`.
4. Runtime IDs are `as_degree:<college_id>:bio:<slot>` with slots `ast`,
   `local_as`, and `local_other`.
5. One strong official college source per award is sufficient for this fast
   pass; source uncertainty is preserved rather than silently resolved.
6. Publication is upsert-only and skips any row saved or verified by a human.
7. Publication does not make a row analysis-ready.

## Validation and publication

From the repository root:

```bash
python scripts/bio_as_research.py validate
python scripts/bio_as_research.py status
python scripts/import_bio_as_degrees.py --dry-run
python scripts/import_bio_as_degrees.py
```

The importer reads `TARGET_MONGO_URI` and `TARGET_DB_NAME` from
`scripts/.env`. Run the dry-run against the exact intended database before a
live publication.

## Human-verification priorities

- Review the 8 unresolved citations and the one fully unresolved El Camino
  group before enabling analysis.
- Review the 65 title-fallback links recorded in
  `extraction.title_fallback_matches`.
- Structure the 173 paired-sequence, conditional-choice, honors, and
  alternative warnings preserved in `extraction.modeling_warnings`.
- Resolve source-internal inconsistencies only after comparing the embedded
  official catalog links; do not infer missing requirements.

## Primary statewide sources

- [Prior Biology Rev. 2 TMC](https://www.cccco.edu/-/media/CCCCO-Website/Files/Educational-Services-and-Support/TMC-Templates/tmc-biology-template-rev-2-ada.pdf)
- [Official California Community Colleges Biology discovery page](https://icangotocollege.com/college-courses/35547-as-t-in-biology)
