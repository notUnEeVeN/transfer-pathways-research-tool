# Virginia CS prerequisites — verification handoff

**Status:** verification-ready local artifacts and application code; not imported into a live database

**Scope:** Virginia Computer Science only

**Snapshot date:** 2026-08-02

## Verification snapshot

The Virginia implementation is source-specific. It does not reuse California's
ASSIST inference rules: Virginia's official course pages publish course-level
prerequisites and corequisites, so those formulas are retained directly.

| Item | Result |
| --- | ---: |
| CS requirement course codes retained as direct scope | 335 / 335 |
| Virginia institutions represented in the direct scope | 17 |
| Recursive prerequisite-only closure courses | 24 |
| Aligned concept and requisite rows | 359 in each artifact |
| Concept mappings | 84 mapped; 275 examined-null |
| Requisite source status | 106 parsed; 142 none; 109 missing; 2 unparsed |
| Richard Bland direct scope | 75 courses: 69 local-only and 6 shared-code overrides |
| Local VCCS pages compared with the statewide rule | 1,831 across 108 courses |
| Local-rule differences / failed comparisons | 0 / 0 |
| Candidate additions to the shared concept vocabulary | 0 |

The two reviewable artifacts are:

- `scripts/data/va_course_concepts.json`
- `scripts/data/va_course_requisites.json`

The exact direct-scope ledger is
`server/.va-degrees/cs_course_scope.json`. Every code in that ledger remains a
direct row even when a current Transfer Virginia record or VCCS master page is
missing. The extra 24 rows exist only to close published prerequisite chains.

## Identity and source policy

The builder uses Transfer Virginia course data as corroboration only when a
course supplier overlaps a college that actually named that code in the CS
requirement scope. A same-code record from a different college or only a
four-year institution is retained as audit evidence, but cannot supply the
course title, identity, prerequisite rule, or university landing.

That rule matters in the current snapshot:

- 304 of the 335 direct codes have some same-code Transfer Virginia record.
- 221 have trusted VCCS supplier overlap.
- 34 Richard Bland-only codes have supplier overlap, but the records remain
  governed by the local catalog and are not trusted as VCCS identity evidence.
- 49 have a same-code record with no applicable scope-college overlap.
- 31 have no Transfer Virginia record.

Richard Bland College is not part of VCCS and uses an institution-local
namespace. Its 69 local-only rows never inherit same-code VCCS titles,
prerequisites, or university equivalencies. Six codes are shared with VCCS and
carry explicit Richard Bland overrides: `ART201`, `ART202`, `PSY201`, `PSY202`,
`REL210`, and `SOC201`. In particular:

- Richard Bland `REL210` is *Social History of Christianity*, not the VCCS
  *Survey of the New Testament* course.
- Richard Bland `SOC201` is *General Sociology* and remains classified as
  `intro_sociology`.
- `COMM101` is Public Speaking and maps to `public_speaking`; `COMM201` is
  Interpersonal Communication and deliberately remains unmapped.
- `ECON201` is macroeconomics and `ECON202` is microeconomics.

Richard Bland views therefore show requirement-scoped mapping evidence but do
not claim a published local prerequisite policy. Richard Bland courses are
also excluded from VCCS university transfer-preparation projections.

## Shared template and formula contract

The shared prerequisite vocabulary contains 57 concepts. The cross-major work
added `precalc_1`, `precalc_2`, `precalc_combined`, and `acct_managerial`; the
Virginia sweep did not require another concept. A null concept means the course
was examined and does not fit the current prerequisite template, not that it
was skipped.

For every published requisite group:

- `paths[]` are complete OR alternatives.
- Conditions inside one `paths[].all_of[]` are simultaneous AND requirements.
- Multiple groups on one course are simultaneously required.
- Prerequisites and corequisites remain distinct.
- Grades, equivalent-course language, placement, consent, approvals, raw
  clauses, and source URLs remain attached.

Regression examples include MTH 263 (`MTH167 OR (MTH161 AND MTH162)`), MTH 266
(`MTH263 at B OR MTH264 at C`), CSC 210, EGR 270, PHY 202, and CSC 223. API graph
edges are explicitly visual projections of these formulas. The two formulas
that cannot yet be represented safely, `BIO141` and `EGR121`, remain visible as
raw review rules and emit no authoritative graph edges.

## What partners should verify first

Open **Virginia → Prerequisites → Mapping Review**. The 125 `needs_review` rows
are intentionally broad: the flag includes unresolved/legacy identities and
missing local sources, not only questionable concept choices. Review in this
order:

1. Richard Bland's 75 direct courses, especially the six shared-code overrides.
2. The 40 applicable direct VCCS codes whose current master page was not found.
3. The 49 same-code Transfer Virginia collisions and 33 unresolved titles.
4. Legacy mappings such as CSC 200–202, MTH 163/164/166/173/174, ENG 251/252,
   PLS 130/212, and SPD 100.
5. The two raw formula rows, `BIO141` and `EGR121`.

For each row, verify the course identity/title, concept assignment, source
authority, published formula, and whether any college-local rule differs. A
college catalog can be stricter than the VCCS minimum. The current 1,831-page
comparison found no differences, but that is snapshot evidence rather than a
permanent guarantee.

The university subtab is deliberately labelled **Transfer Preparation**. It
intersects accepted VCCS courses with community-college supply; it is not the
university's own prerequisite graph and does not prove that an equivalency
applies to the CS degree.

## Import and runtime safeguards

The importer validates exact 335-code direct-set equality, aligned course
identities, allowed concepts, formula closure, Richard Bland isolation, and
institution overrides before writing. It stages both collections and stamps
them with the same content-derived `import_generation`. The API serves no
prerequisite corpus when one collection is absent or the generations differ,
and the UI reports the specific incomplete/mismatched import state.

The read endpoint is:

```text
GET /api/va/prerequisite-graph?college=<stable-id>&university=<stable-id>
```

Both selectors are optional. Statewide, per-college, per-university, and pair
projections use stable `va:CODE` graph keys and remain isolated from California
ASSIST collections.

## Reproduce and validate

From the repository root:

```bash
# Report-only source build. Cached source pages make repeats deterministic.
cd server
node scripts/buildVirginiaPrerequisites.js

# Intentionally replace the checked-in artifacts.
node scripts/buildVirginiaPrerequisites.js --write

# Validate only (default); this performs no Mongo writes.
node scripts/importVirginiaPrerequisites.js

# A database write requires an explicit destination and --write.
node scripts/importVirginiaPrerequisites.js --write --uri <uri> --db <db>

npx vitest run services/virginia scripts/buildVirginiaPrerequisites.test.js scripts/importVirginiaPrerequisites.test.js
cd ..
python3 -m scripts.test_prereq_concept_data
```

Current deterministic SHA-256 values:

- `va_course_concepts.json`:
  `7c144751b2ebf48c2a3b375d199a66782added68d05f381928917f25ed8c6af3`
- `va_course_requisites.json`:
  `64b14ac29521a514f670fbddf9c86383ba4c0c2ed9e243a996f21322c85f4e4e`
- paired import generation:
  `051164cecb82be9dbc14da759844eb8f966e355ca94ee6401a223fa29aa611f3`

The importer has been run in dry-run mode against these exact files. No live
Mongo import, deployment, or production write was performed for this handoff.
