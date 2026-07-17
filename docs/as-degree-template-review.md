# AS-degree data — pilot + statewide extraction review (G2 gate)

**Date:** 2026-07-17
**Status:** ⏸ awaiting Tybalt's review — templates not yet locked, schema not yet finalized, nothing imported.
**Artifacts:** `scripts/data/as_degrees_cs_extraction.json` (raw survey + extraction, all 115 colleges).
**Spec:** `docs/superpowers/specs/2026-07-17-as-degree-data-design.md`.

This is the G2 gate for the AS-degree data project. It reports what the
statewide sweep produced, the key findings that reshaped the target, the two
templates the data supports, and the decisions that need your sign-off before
we lock templates, finalize the schema, and import.

## 1. The finding that reshaped the target

The spec set out to catalog each college's *own local "Computer Science
A.S."* The pilot immediately showed that degree often doesn't exist: for
Computer Science specifically, the CS-titled associate degree at many colleges
is the **transfer ADT (AS-T)**, while a college's *local* computing degrees
are A.A.s or narrow tracks under other names. Verified across the full 115:

| | Colleges |
|---|---|
| Have a **local "Computer Science" A.S.** | 45 / 115 |
| Have the **transfer AS-T** in CS | 72 / 115 |
| Have **some** local computing associate degree | 107 / 115 |
| Have **≥ 1** CS-related associate degree | **114 / 115** |
| Genuine **none** (verified) | 1 — Woodland CC |

**Decision taken (your call, 2026-07-17):** capture *all* relevant degrees per
college, each tagged `degree_type ∈ {local_cs_as, local_computing, ast}`, and
defer the AS-T-vs-local choice to analysis. Rationale: no single degree type is
universal, but *some* degree exists at 114/115, so tagging everything gives
full coverage with no empty schools. **Caveat for analysis:** the AS-T is
engineered for ~zero transfer credit loss (TMC design), so it is a *contrast
baseline*, not the protagonist of a credit-loss finding — local degrees are
where loss lives.

## 2. What was produced

- **Survey** (degree inventory) for all 115 colleges — 0 low-confidence, 0
  browser-blocked. This is the coverage guarantee: we *know* what every college
  offers.
- **Extraction** (requirements) for all 114 non-empty colleges — **200
  degrees**: 45 `local_cs_as`, 70 `ast`, 85 `local_computing`. Mean
  `extraction_confidence` 0.92. Every college got ≥ 1 degree.

Per-college degree-type mix:

| Degrees present | Colleges |
|---|---|
| ast + local_computing | 41 |
| local_computing only | 21 |
| local_cs_as only | 12 |
| all three | 12 |
| local_computing + local_cs_as | 11 |
| ast + local_cs_as | 10 |
| ast only | 7 |

## 3. Feasibility (matters for cost)

**Extraction is fetch-based, not browser-bound.** 110 / 114 colleges extracted
from fetchable sources (catalog PDFs via `pdftotext`, program pages); only 4
flagged `needs_browser`. The whole statewide sweep ran as background agent
workflows (survey ≈ 4.1M tokens, extraction ≈ 5.8M tokens, ~1–1.5 h each). A
rigid scraper can't handle the catalog variety (eLumen SPAs, Acalog, Modern
Campus, PDFs), but per-college adaptive agents can — the agent *is* the scraper.

## 4. The templates the data supports

Courses were mapped to the existing 41-concept vocabulary **by title, not
prefix** (a lesson from Southwestern, which teaches CS under the `MATH` prefix —
`MATH 130 Introduction to Computer Programming` is `cs_1`). Concept frequency
across the extracted major cores:

**`local_cs_as` template (n = 45)** — moderate variation:

| Concept | Coverage |
|---|---|
| cs_1 (intro programming) | 97% |
| comp_arch_assembly | 86% |
| discrete_math | 73% |
| cs_3_data_structures | 62% |
| calc_1 | 62% |
| cs_2_oop | 48% |
| calc_2 | 46% |
| phys_mech / linear_alg | 31% / 24% |

**`ast` template (n = 70)** — tight, TMC-standardized:

| Concept | Coverage |
|---|---|
| calc_1 | 98% |
| discrete_math | 98% |
| comp_arch_assembly | 95% |
| calc_2 | 88% |
| cs_1 | 87% |
| phys_mech | 78% |
| science elective (bio 50% / chem 38% / phys_em 22%) | ~one required |
| cs_3_data_structures | 51% |

**Conclusion:** the concept-template approach works for both types, and both map
onto the existing vocabulary. The AS-T is uniform enough for a near-exact
template (it mirrors the statewide CS Transfer Model Curriculum); the local CS
A.S. is a looser "common core + variable science" shape. `local_computing` is
**not** templatable (CIS/IT/networking/business grab-bags) — it is captured for
coverage and handled case-by-case, not fit to a template.

**Proposed:** two templates — `as_degree_template:cs_local` (fitted, the table
above) and `as_degree_template:cs_ast` (the TMC). Both in the concept-slot shape
from spec §1A.

## 5. Data quality — cleanup list

Solid overall (0.92 mean confidence). Genuine issues, ~5 colleges, for the
hand-verification pass rather than blockers:

- **College of San Mateo** — AS-T core came back empty (conf 0.15); re-extract.
- **Norco** — `local_computing` used a stale 2021-22 catalog; refresh.
- **Foothill / Santa Ana** — `local_cs_as` listed the whole department's course
  pool instead of the specific degree's required core (acceptable for template
  fitting; tighten during hand-verification).
- **LA Southwest** — degree-type labels swapped (its "CS A.S." is really a Math
  A.A.); relabel.

Most automated flags were **false positives** — colleges using unfamiliar CS
prefixes (`CMPR`, `C S`, `COSC`, `CMPSCI`, `COMS`) that are genuinely CS
courses. Southwestern (flagged twice) is correct as extracted.

## 6. Decisions needed from you (G2 gate)

1. **Approve the two-template approach** (`cs_local` fitted + `cs_ast` TMC), or
   adjust which concepts count as required-core vs optional in each.
2. **Confirm `local_computing` stays capture-for-coverage, not templated.**
3. **Schema finalization** (deferred to now, against real data): `as_degree`
   becomes multiple docs per college, id `as_degree:<cc>:<degree_key>`, with a
   `degree_type` field and `major_slug:'cs'` for grouping; `asDegreeView`
   detail returns a college's several degrees. OK to implement?
4. **Cleanup scope now vs. at hand-verification:** fix the ~5 above now, or roll
   them into the paper's hand-verified subset?

On approval: lock the template JSONs, make the schema change (a focused
backend task), transform the extraction artifact into `as_degree` docs, import,
and produce the QA report — after which the frontend design handoff proceeds
with real data spliced into `docs/as-degree-view-design-prompt.md`.
