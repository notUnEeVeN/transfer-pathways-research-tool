# Virginia CS prerequisites — verification handoff

**Status:** source/review artifacts; not sufficient for the paper's current
fail-closed Figure 6 publication contract and not published to the canonical
prerequisite collections. Older Virginia requirement documents already exist
in the shared database, but they are not a publication credential for this
generation.

**Scope:** Virginia Computer Science only

**Snapshot date:** 2026-08-25

> Publication note (2026-08-23): Figure 6 now requires two exact ownership
> domains: `va:vccs` sending-course prerequisites and
> `va:uni:<school_id>` receiving-university prerequisites. Both must encode
> complete `paths_or__conditions_and` formulas and share a verified import
> generation. This document describes an earlier VCCS-centered research build;
> its counts are retained for provenance, not as evidence that Figure 6 is
> release-ready. No numeric Virginia Figure 6 cells are emitted until the new
> owner-specific contract passes for the full cohort.

The broader Virginia source plan has 37 selected release documents and five
explicitly retained Transfer Virginia alternates. All **42/42 extracted source
records are accounted for**, but only three of five alternate dispositions are
safe: the Roy-verified Reynolds and Camp maps differ from their selected,
unverified official-catalog replacements and therefore keep the gate closed.
Eight of the 37 selected documents are ready for complete-degree analysis.
The authoritative Mongo projection has 21/35 Figure 3/4 source-ready documents,
**285/304 condition-ready cells**, and **109/304** cells that clear both gates.
The read-only accepted-source candidate improves the condition measurement to
**288/304** for three gains and zero regressions, but it cannot inherit source
readiness across its protected-core changes. The older **110/304** joint claim
is not reproducible under the current signature gate and is not a current
candidate credential. Ten protected-core conflicts, two changed source bundles,
and five unsigned records still require review. Virginia visuals remain
fail-closed until an exact publication receipt binds a fully passing
authoritative projection.

In the candidate, 15 condition blockers are Virginia Tech `CSC222` to `CS1114`
cells and the sixteenth is Southwest Virginia to Radford. The authoritative
projection retains three additional Virginia Tech blockers. An exact retained
audit covers all 15 candidate Virginia Tech sender endpoints and 40 current official `CSC222` schedule
sections. Central Virginia's endpoint is available but currently lists zero
sections. No endpoint supplies an explicit Java section binding. Historical,
advisory, instructor, or provider references cannot establish the current
sender-specific condition; a current syllabus, section note, universal college
policy, or official written confirmation is required.

Radford is 18/19 condition-ready. Richard Bland's exact owner-local
`PHYS201`/`PHYS202` plan courses are bound to current `PHYS221`/`PHYS222`
equivalency and laboratory evidence without converting them to VCCS identity.
Southwest remains blocked because the selected 60-credit plan contains only one
eligible named science and has no open capacity for a second; an equivalency
cannot add an unselected course to the degree.

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

### Strict VCCS Figure 6 projection audit (2026-08-24)

The checked-in artifact can be projected without dropping its raw clauses,
formula-path text, parser flags, effective dates, or local-page audit evidence.
That projection assigns the statewide rows to `owner_namespace: va:vccs` and
excludes the 76 Richard Bland-only rows, because Richard Bland is not a VCCS
institution. Known missing and unparsed rows stay in the projection and block
publication.

| Strict-contract item | Result |
| --- | ---: |
| VCCS rows including prerequisite closure | 189 |
| Required VCCS sending courses present | 184 / 184 |
| Required sending courses with exact formulas or validated complete-record `none` | 184 / 184 |
| Required sending courses missing prerequisite authority | 0 |
| Required sending courses with an unparsed formula | 0 |
| Structured complete-record `none` rows with receipts | 97 / 97 (96 current master; 1 controlled owner record) |
| Prerequisite-closure rows (parsed / structured `none` / blocked) | 4 / 1 / 0 |
| Missing formula-closure rows | 0 |

The strict VCCS half now passes its source, ownership, formula, and closure
validator. This does not make Figure 6 publication-ready: the receiving-
university corpus and generation-bound independent human receipt remain open.
The semicolon/timing formulas for `EGR121` and `BIO141` are parsed exactly; five
owner-complete formulas close `ENG249`, `ENG268`, and the retired
`CSC200`–`CSC202` chain. The validator also rejects duplicate course keys,
missing formula-closure rows, non-VCCS authority, any owner other than
`va:vccs`, and every `missing` or `unparsed` status.

The checked-in source-gap ledger now has zero residual rows and retains every
resolution receipt. `EGR126` is `none` through the complete boundary of its
exact current statewide master record; the silent archived Laurel Ridge entry
remains explicitly unresolved and is not the none authority. `PHI102` is a
separate controlled-owner finding: its exact Southwest CourseLeaf entry is one
bounded record with zero requisite clauses, and an exact `ENG268` entry from
the same catalog and `catoid` supplies the requisite-marker control. Its
`literal_none_statement` remains `false`. Reproduce the audit with
`npm run va:prerequisites:vccs-gaps:check`; do not promote a Transfer Virginia
title, an unbounded retired-page shell, or a similarly numbered `SDV` course
into a prerequisite claim.

The Southwest proof is not based on copied text alone. The repository retains
the exact official HTTP bodies for `ENG249`, `ENG268`, and `PHI102` and binds
three layers independently: whole-response SHA-256 and byte count, the single
`course_preview_title` course-fragment SHA-256 and byte count, and the extracted
entry-text SHA-256. The loader re-extracts all three records, requires the exact
catalog edition and course heading, and rejects multiple course fragments. The
response hashes are `d191460e…acc09`, `070f7a8b…643a1`, and
`e84ae9af…3a0f`, respectively. The `PHI102` none finding and its `ENG268`
marker control carry those response receipts into the generated corpus.

### Receiving-university review floor (2026-08-25)

The degree-derived direct scope contains 843 named receiving courses across the
16 universities that participate in Figure 3/4. Seven separately proved
Longwood deterministic resident-path courses extend the prerequisite review
scope to 850 rows without changing the authored named-course count. The current
cache-only acquisition artifact plans **980 capture keys over 285 routes** and
retains **935 unique exact entries**. The candidate builder combines those
entries with already retained exact official-cache evidence to produce **1,169
safely bounded review candidates: 849 direct and 320 closure**. The one direct
row without an exact entry is Virginia Tech `BIT4614`.

| Current generated review item | Result |
| --- | ---: |
| Required direct rows | 850 |
| Direct parsed / structural `none` / unparsed / missing | 652 / 171 / 26 / 1 |
| Closure candidate rows | 320 |
| Closure parsed / structural `none` / unparsed | 190 / 109 / 21 |
| Bounded candidates reviewed | 1,169 |
| Promoted contract-shaped review rows | 1,122 |
| Publication rows | 0 |

A structural `none` is admitted only from an exact bounded official record and
the evidence controls required by that source adapter; absent search results or
an uncontrolled missing marker do not count. The 1,122 promoted rows are still
review evidence, not a publication corpus.

The recursive walk now contains **709 formula-reference keys**. Of those, 633
resolve to promoted rows and **76 remain unresolved**: 11 reference unparsed
direct rows, 20 reference unparsed closure rows, one references the missing
direct `BIT4614` row, and 44 fall outside the current bounded scope. Those 44
are not inferred as zero-edge courses. They require version-aligned archived
official evidence or an institution-specific identity mapping before they can
be resolved safely. These reference counts are intentionally smaller than the
total unparsed-row counts because only rows reached by the recursive formulas
enter this closure denominator.

Recent exact-source work is incorporated in those totals:

- VCU supplies exact complete entries for `EGMN102`, `EGMN190`, and `EGMN203`.
  The latter two are safe structural-`none` rows. `EGMN102` remains blocked as
  one atomic row: its prerequisite is `MATH200` at C or better **or** instructor
  permission, and its concurrent prerequisite is `PHYS207` **or** instructor
  permission. The graph cannot publish only the course edges while discarding
  the unresolved permission paths.
- Radford and UVA Wise supply 14 exact complete entries. Five formulas are safe:
  Radford `PHYS112` → `PHYS111`, `PHYS221` → (`MATH169` or `MATH171`),
  and `PHYS222` → `PHYS221`; UVA Wise `MTH1110` → `MTH1010` at C or
  better and `MTH1210` → `MTH1110` at C or better. Nine exact-source rows
  remain blocked because their retained text includes exclusion-only,
  pre-or-corequisite timing, placement, high-school, underspecified, or other
  unsupported semantics. Exact capture therefore does not imply a safe
  formula or zero-edge finding.

Reproduce the fixed point with
`npm run va:prerequisites:university-scope:check`, the cache-only acquisition
check `npm run va:prerequisites:university-acquisition:check`,
`npm run va:prerequisites:university-candidates:check`, and
`npm run va:prerequisites:university-review:check`. The generated review
artifact reports **zero publication rows**. Figure 6 remains fail-closed until
all recursive references resolve, the complete university corpus is generated,
and an independent human approval receipt binds its exact generation.

### Paper-publication contract and receipt

`npm run va:prerequisites:publication:plan` is the combined Figure 6 gate. It is
dry by default and does not create a Mongo client. The current default inputs
are expected to fail overall: the VCCS projection now passes, but the final
university corpus does not yet exist and no human approval receipt has been
issued.

A final corpus artifact must use schema version 1, artifact name
`virginia_figure6_prerequisite_corpus`, contract version
`va-figure6-prerequisites-v2`, its exact `community_college` or `university`
role, and contract-shaped `rows`. Every row must retain the complete official
course-entry text and its matching SHA-256 in `source_evidence`, use a URL on
the owner's allowlisted official catalog host, and carry the content-derived
hash of that owner's complete source bundle. A parsed formula's raw clause must
occur in the retained entry. A `none` row must cite either an explicit official
none statement or an explicit human finding over a populated, exact course
entry, or the structured current VCCS master-record evidence kind whose exact
`dt`/`dd` boundary has zero recognized requisite clauses under the pinned parser
contract, or the controlled Southwest owner-record evidence whose exact
single-record CourseLeaf boundary and same-catalog requisite-marker control are
both pinned. An empty search result, unbounded retired-page shell, or
uncontrolled absent marker is not a none finding.

The publisher recomputes one generation from both canonical row sets and both
degree-derived direct sets. It then requires an independent human receipt that
names that generation, hashes the exact two corpus files and two scope files,
and explicitly attests official provenance, recursive closure, lossless formula
transcription, and every none finding. Editing any formula, source text, scope,
or file byte invalidates the receipt.

Only an explicit `--apply` can write. The apply path runs one Mongo transaction:
before replacing anything, it records one generation-complete snapshot of both
prerequisite collections and the complete publication-receipt collection, with
exact counts and content hashes. It also retains the content-addressed research
archive, replaces both prerequisite collections, stores the active receipt, and
verifies the written content before commit. There is no incomplete/staging
override. The legacy research builder and importer remain available for
research and cannot produce a v2 publication generation by themselves.

The rollback identifier printed by a successful publication restores all three
targets byte-for-byte and snapshots the state being replaced in the same
transaction. Preview and apply it with:

```bash
node scripts/va/publishFigure6Prerequisites.js --restore <generation-id>
node scripts/va/publishFigure6Prerequisites.js --restore <generation-id> --apply
```

A missing, mixed-generation, or hash-mismatched snapshot fails before any live
row is deleted.

A prerequisite-only restore also restores the exact active/inactive receipt set
that accompanied those corpus bytes, but the restore itself appends the newest
prerequisite transition. That later transition invalidates the previously
active projection authorization. Figure 6 therefore remains disabled until a
fresh full projection publication binds the restored prerequisite generation.
A projection restore likewise writes a newer publication tombstone; historical
receipts never reactivate either restored state.

As of 2026-08-25, `npm run va:rollback:live:audit` reports **0/0 prerequisite
snapshots** and no shared publication-transition ledger. The rollback code and
synthetic transaction tests pass, but no live prerequisite rollback generation
exists until the first successful transactional publication creates one.

The receipt is a reviewed artifact, not a flag generated by the scraper. Its
required shape is:

```json
{
  "schema_version": 1,
  "artifact": "virginia_figure6_prerequisite_verification_receipt",
  "contract_version": "va-figure6-prerequisites-v2",
  "decision": "approved_for_figure6_publication",
  "verification_method": "independent_human_review",
  "verified_by": { "kind": "human", "name": "...", "role": "..." },
  "verified_at": "ISO-8601 timestamp",
  "signed_statement": "I independently reviewed this exact Virginia Figure 6 prerequisite generation and approve it for publication.",
  "publication_generation": "64-character SHA-256",
  "artifact_sha256": {
    "community_college_corpus": "64-character SHA-256",
    "university_corpus": "64-character SHA-256",
    "vccs_scope": "64-character SHA-256",
    "university_scope": "64-character SHA-256"
  },
  "attestations": {
    "official_source_hosts_and_content": true,
    "complete_direct_and_recursive_closure": true,
    "lossless_formula_transcription": true,
    "explicit_none_findings": true
  }
}
```

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

The legacy importer validates exact 335-code direct-set equality, aligned course
identities, allowed concepts, formula closure, Richard Bland isolation, and
institution overrides before writing. It stages both collections and stamps
them with the same content-derived `import_generation`. The API serves no
prerequisite corpus when one collection is absent or the generations differ,
and the UI reports the specific incomplete/mismatched import state.

That legacy `import_generation` is not a Figure 6 publication credential. The
v2 source validator additionally requires the combined content-derived
`publication_generation`, owner-official source text and hashes, and a matching
active human verification receipt. Legacy rows remain useful research evidence
but fail the paper gate closed.

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

# Rebuild in memory and require byte-identical checked-in artifacts.
npm run va:prerequisites:vccs-corpus:check

# Intentionally replace the checked-in artifacts.
node scripts/buildVirginiaPrerequisites.js --write

# Validate only (default); this performs no Mongo writes.
node scripts/importVirginiaPrerequisites.js

# Combined paper-publication plan; dry, fail-closed, and no Mongo connection.
npm run va:prerequisites:publication:plan

# A future approved publication still requires explicit artifact paths and apply.
node scripts/va/publishFigure6Prerequisites.js \
  --vccs-artifact <reviewed-vccs-corpus.json> \
  --university-artifact <reviewed-university-corpus.json> \
  --receipt <signed-review-receipt.json> \
  --apply --uri <uri> --db <db>

# A database write requires an explicit destination and --write.
node scripts/importVirginiaPrerequisites.js --write --uri <uri> --db <db>

npx vitest run services/virginia scripts/buildVirginiaPrerequisites.test.js scripts/importVirginiaPrerequisites.test.js
cd ..
python3 -m scripts.test_prereq_concept_data
```

Current deterministic SHA-256 values:

- `va_course_concepts.json`:
  `7705d1efd41a4ff3b2d9249f612435cedbb4673ce6416673009f7754665935c2`
- `va_course_requisites.json`:
  `4de03e8b4daf2ff12f8d93de0c610172b87b1b9317229be4e0cb8078520bc486`
- paired import generation:
  `04c2dbbff4fc90b43a7baeed079f888c0e90bf67b49ca9d1713fd24420611c16`

The importer has been run in dry-run mode against these exact files. No live
Mongo import, deployment, or production write was performed for this handoff.
