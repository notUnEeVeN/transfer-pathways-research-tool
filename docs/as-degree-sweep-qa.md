# AS-degree statewide sweep — QA report

**Date:** 2026-07-17
**Imported to:** local dev DB (`127.0.0.1:27017/pmt_research`). **Not yet on Atlas.**
**Source:** `scripts/data/as_degrees_cs_extraction.json` → `scripts/import_as_degrees.py`.

## What's in the database

- **2 templates** (`as_degree_template:cs_local`, `as_degree_template:cs_ast`), status locked.
- **199 `as_degree` docs** across **114 colleges** (Woodland CC = verified none, no doc):
  - `local_cs_as`: 45 · `ast`: 69 · `local_computing`: 85
  - unit system: 194 semester, 5 quarter (Foothill/De Anza family)
- 1 degree not imported: **College of San Mateo** AS-T (extraction returned an empty core, confidence 0.15 — a genuine extraction miss, not an importer bug).

## Confidence distribution (extraction confidence)

| Bucket | Docs |
|---|---|
| ≥ 0.95 | 108 |
| 0.85–0.95 | 84 |
| 0.70–0.85 | 4 |
| < 0.70 | 3 |

**96% of docs are ≥ 0.85.**

## Course resolution

Extracted catalog courses are resolved to canonical `assist_courses` ids by
`(college, prefix, normalized number)`. **2,376 / 2,657 = 89.4% resolved.**
Unresolved courses are preserved verbatim in each group's
`unresolved_courses_seen` (code + title + units) — no data is lost, they're
just not linked to a canonical course id. **61 docs carry ≥ 1 unresolved course.**

### Why courses don't resolve (two systematic causes — both fixable)

1. **Catalog vs. ASSIST version skew.** Colleges are adopting California's new
   Common Course Numbering (e.g. Butte's `MATH C2210` = Calculus I), but the
   `assist_courses` snapshot still has the old numbers (`MATH 30`). Same course,
   different number across the two sources — resolution by number misses it.
2. **`assist_courses` number artifacts.** Some colleges' numbers are stored
   malformed (e.g. Merced `MATH -06` instead of `MATH 06`), so normalized
   matching fails.

Neither is a genuine "course doesn't exist" case for the transferable core.
Separately, `local_computing` degrees legitimately cite many **non-transferable**
CIS/IT/business courses that are simply not in `assist_courses` (which only holds
courses appearing in ASSIST agreements) — those stay unresolved by design.

### Heavily-unresolved degrees (> 50% of a degree's courses) — 13

Mostly the two causes above. The AS-T cases (Merced 100%, Mt. San Jacinto 100%,
De Anza 55%) are renumbering/artifact-driven and would largely recover with a
**title-based resolution fallback** (match on course title within the college
when prefix+number fails). The `local_computing` cases (Copper Mountain,
Alameda, Norco, etc.) are mostly genuine non-transferable courses.

**Recommended refinement (not yet done):** add a title-similarity fallback to
the importer's resolver, then re-import. Expected to lift resolution well above
95% and recover the renumbered AS-T calculus/physics.

## Data-quality items for the hand-verification subset

These carry over to the paper's hand-verified subset (staged-verification model):

- **College of San Mateo** — AS-T not imported (empty extraction); re-extract.
- **Norco** — `local_computing` from a stale 2021-22 catalog; refresh.
- **Foothill / Santa Ana** — `local_cs_as` captured the whole department pool
  rather than the specific degree's required core; tighten.
- **LA Southwest** — degree-type labels swapped (its "CS A.S." is a Math A.A.).
- The 13 heavy-unresolved degrees (course linkage, per above).

## Not done yet (next steps)

1. Optional: title-based resolution fallback + re-import (lifts 89% → 95%+).
2. Atlas import (needs sign-off).
3. Splice 2–3 real degrees into `docs/as-degree-view-design-prompt.md` → frontend Claude-design handoff.
4. Hand-verification of the paper's college subset.
