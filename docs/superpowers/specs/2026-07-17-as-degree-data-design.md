# Local AS degree data (CS) — design

**Date:** 2026-07-17
**Status:** approved (design review with Tybalt, 2026-07-17)

## Problem

The research compares completing a local AS degree at a community college
against UC transfer requirements: how much credit is lost, how long the CC leg
takes, and how many years remain at the 4-year. None of that analysis can run
because the underlying data does not exist: there are **0 rows** of local
AS-degree requirements anywhere in the system (the legacy `associate_degree`
kind in `curated_requirements` is an empty flat course-list shape from a
previous era). ASSIST does not carry local degree requirements, and with 115
colleges we cannot hand-verify every catalog.

**Scope of this spec: data establishment only.** Get per-school CS AS degree
requirements into the database and frontend, structured and provenance-tracked
well enough that (a) aggregate statistics can run later, and (b) a hand-picked
subset of colleges can be hand-verified for the paper, with visuals re-running
on the corrected data. Credit-loss, eligibility, and time-to-degree math are
explicitly **out of scope** (see §6).

Degree scope: **CS AS degrees only** — the AS degrees matching majors already
stored and selected in the tool. At CCs there is effectively no CS-vs-CSE
split, so one statewide CS template is the working assumption, tested by the
pilot.

## Decision summary

| Decision | Choice |
|---|---|
| Strategy | Pilot-calibrated statewide template + per-school extracted docs (Approach C) |
| Source of truth | The per-school `as_degree` doc — no stored deltas, no precedence rules |
| Template role | Extraction schema, comparability structure, and stamped fallback fill — never silently authoritative |
| Storage | Two new `curated_requirements` kinds: `as_degree_template`, `as_degree` |
| Legacy `associate_degree` kind | Untouched and empty — `timeToDegreeData` listens for it with old semantics and must stay dormant |
| Requirement expressiveness | Per-school requirement body reuses the ASSIST agreement skeleton **verbatim** (groups → sections → receivers → options → course_ids, same field names/semantics incl. `section_advisement`/`unit_advisement`), plus two extensions with no agreement analog (`ge_area`, `units_fill`) and additive provenance fields |
| GE modeling | Title 5 §55063 local-GE areas (not IGETC) with per-area unit minimums |
| Units | Stored in the college's native system with `unit_system: 'semester'\|'quarter'`; no conversion at storage time |
| Extraction pipeline | In-session Claude Code agent runs → git-committed JSON artifact with `meta` methodology block → importer; no LLM SDK/API key in the repo (same discipline as course-concept mapping) |
| Provenance | Per-group `source: 'extracted'\|'template_default'\|'curated'` + confidence; imports never overwrite `curated_by`; verification notes strictly user-authored |
| Verification model | Staged: aggregate-grade now; paper subset hand-verified later against stored `catalog_url`/`catalog_year` |
| Frontend | References table (standard plumbing) now; per-college AS Degree view via **Claude-design handoff** after data is in (§5 pause point) |

## 1 · Data model

Both kinds follow the polymorphic `curated_requirements` pattern
(`_id = '<kind>:<legacy_id>'`, `legacy_id`, `kind` on every row), giving them
validation hooks, referential-integrity guards, list/PUT/DELETE endpoints, and
References-table plumbing.

### 1A. Statewide template — kind `as_degree_template`

One doc per major (v1: exactly one, `cs`), git-artifact-backed in
`scripts/data/as_degree_template.json`. The group list below is
**illustrative**: the shape is fixed by this spec, the content is an output of
the pilot (§2) and locks only at the G2 gate.

```js
{
  _id: 'as_degree_template:cs',
  kind: 'as_degree_template',
  legacy_id: 'cs',
  slug: 'cs',
  name: 'Associate of Science — Computer Science (statewide template)',
  total_units_min: 60,              // semester units; quarter colleges ≈ 90
  // Structurally the ASSIST agreement skeleton (groups → sections → slots),
  // with concept slugs where per-school docs have course_ids — so template
  // and per-school groups align field-for-field. Deliberately named `groups`
  // (not `requirement_groups`): the template holds concept slots, not
  // receivers, and must never be mistaken for engine-consumable input.
  groups: [
    {
      group_id: 'core_programming',  // stable key; per-school docs align to it
      label: 'Programming core',
      is_required: true,
      sections: [{
        section_advisement: null,    // null → every slot required
        unit_advisement: null,
        slots: [                     // concept slots in receiver position
          { concepts: ['cs_1'] },
          { concepts: ['cs_2_oop'] },
          { concepts: ['cs_3_data_structures'] },
        ],
      }],
    },
    {
      group_id: 'core_systems',
      label: 'Systems requirement',
      is_required: true,
      sections: [{
        section_advisement: 1,       // "select 1 of the following"
        slots: [
          { concepts: ['comp_arch_assembly'] },
          { concepts: ['c_systems_programming'] },
          { concepts: ['digital_logic'] },
        ],
      }],
    },
    {
      group_id: 'ge_natural_sciences',
      label: 'GE: Natural Sciences',
      ge_area: 'natural_sciences',   // Title 5 local-GE area, not IGETC
      is_required: true,
      sections: [{ unit_advisement: 3, slots: [] }],  // open-ended area
    },
    // ... remaining Title 5 areas: social_behavioral, humanities,
    //     language_rationality (English comp + comm/analytical thinking),
    //     plus math competency
    {
      group_id: 'electives',
      label: 'Electives to total',
      units_fill: true,              // degree-applicable units up to total
    },
  ],
  note: '…normative calls recorded here, prereq_concepts style…',
}
```

Semantics come from the agreement fields, not a bespoke type vocabulary:
no advisement → all slots required; `section_advisement: N` → choose N
courses; `unit_advisement: N` → choose N units. Only two constructs have no
agreement analog and are extensions: `ge_area` (an open-ended Title 5 area —
its unit ask lives in `unit_advisement`, its slots may be empty or a sample)
and `units_fill` (unnamed degree-applicable units to reach the total).

A slot's `concepts` array references the existing 41-concept vocabulary
(`prereq_concept` kind); more than one entry means an OR-group, in the spirit
of `prereq_concept.requires`. **The template is a new kind with its own
validation** — it must not reuse `prereq_concept.requires`, whose cycle checks
and delete guards assume prerequisite (ordering) semantics, not membership.
The `prereq_concept` delete guard gains one check: a concept referenced by any
`as_degree_template` group **or any `as_degree` course entry** cannot be
deleted (the existing guard only counts prereq dependents and course
mappings, so without this a concept used solely in degree docs would be
deletable, leaving dangling refs).

### 1B. Per-school degree — kind `as_degree`

One doc per college × major. **Single source of truth for that school.** The
template never overrides it; a "deviates from template" diff is computed at
read time for display, never stored.

The requirement body deliberately reuses the ASSIST agreement skeleton
rather than a bespoke shape: every analysis this data exists for ("does the
AS meet transfer requirements", overlap/credit loss, min-course sets) runs
through the golden engines, which speak that shape natively — a bespoke
shape would put a translation layer exactly where correctness matters most.
Readability comes from the additive label/provenance fields, not from a
different structure.

```js
{
  _id: 'as_degree:<n>:cs',          // <n> = assist_institutions.source_id (Number)
  kind: 'as_degree',
  legacy_id: '<n>:cs',
  community_college_id: <n>,        // Number — the field agreements are queried by
  college_id: 'cc:<n>',             // canonical string id, mirroring agreements'
                                    // dual-id convention
  major_slug: 'cs',
  template_ref: 'as_degree_template:cs',

  status: 'found' | 'none_found' | 'ambiguous',
  degree_title_seen: 'Computer Science, A.S.',   // exactly as printed
  catalog_url: 'https://…',                      // page the data was read from
  catalog_year: '2025–2026',
  unit_system: 'semester' | 'quarter',
  total_units: 60,                               // native units, school's own figure

  // Requirement body: the ASSIST agreement skeleton, field-for-field
  // (verified against live assist_agreements docs), so the golden engines
  // (eligibility, min-courses, credit-loss overlap) can later evaluate an AS
  // degree with no translation layer. Note the field is requirement_groups —
  // the name isMajorArticulable() reads — and course_ids are Numbers with
  // 'cc:<n>' string mirrors in course_keys, exactly as agreements store them.
  requirement_groups: [
    {
      // — agreement-standard fields, same names and semantics —
      is_required: true,
      group_conjunction: 'And',
      group_advisement: null,
      group_unit_advisement: null,
      group_min_distinct_sections: null,
      group_max_distinct_sections: null,
      group_section_min_courses: null,
      sections: [
        {
          section_advisement: null,   // choose-N courses; null → all required
          unit_advisement: null,      // choose-N units ("9 units from …")
          receivers: [
            {
              receiving: null,        // a local degree has no UC receiving
                                      // course; the requirement IS the CC
                                      // course(s) in the options
              articulation_status: 'articulated',   // constant on this kind
              not_articulated_reason: null,
              options: [{ course_ids: [195603],     // Numbers (= assist_courses.course_id)
                          course_conjunction: 'and',
                          course_keys: ['cc:195603'] }],
              options_conjunction: 'and',
              hash_id: null,          // no cross-CC identity for local degrees
            },
          ],
        },
      ],

      // — as_degree extensions (additive; agreement consumers ignore them) —
      group_id: 'core_programming',   // stable key within this doc
      template_group: 'core_programming' | null,
                                      // aligned groups: template_group ===
                                      // group_id; school-specific extra
                                      // groups: template_group: null with a
                                      // school-chosen group_id slug
      label_seen: 'Required Core',    // the catalog's own heading
      source: 'extracted' | 'template_default' | 'curated',
      confidence: 0.0–1.0 | null,     // multi-vote agreement; null unless
                                      // source is 'extracted'
      curated_by: null | '<user>',    // group-level, human-only; imports
                                      // never overwrite (distinct from the
                                      // doc-level curated_by that
                                      // putRequirement auto-stamps on every
                                      // console save)
      ge_area: null | 'natural_sciences',
                                      // open-ended Title 5 area group: unit
                                      // ask in unit_advisement; receivers may
                                      // be a sample or empty
      units_fill: false,              // true → electives-to-total; no receivers
      unresolved_courses_seen: [      // catalog citations that didn't resolve
        { course_code_seen: 'CS 22A', title_seen: '…', units_seen: 4.5 },
      ],                              // to an assist course id; non-empty ⇒
                                      // group is flagged
    },
  ],

  verification: {
    verified: false,
    verified_by: null,
    verified_at: null,
    notes: null,        // strictly user-authored; tooling never writes here
  },
  extraction: {         // methodology stamp, mirrors concept-mapping artifact
    artifact: 'scripts/data/as_degrees_cs.json',
    model: '…', votes: 3, date: '…',
  },
}
```

Semantics that matter:

- **Absence is data.** A college examined and found to offer no CS AS gets a
  `status: 'none_found'` doc — distinct from having no doc at all
  (unexamined). This is the tri-state discipline applied at document level.
- **`template_default` groups are visibly not real data.** When extraction
  fails or multi-vote confidence falls below threshold for a group, the doc
  stores a **stub** — `{group_id, template_group, source: 'template_default'}`
  with no sections — and the doc is flagged. Consumers render the template's
  group in its place by joining `template_ref` at read time (never a stored
  copy, which would go stale when the template is edited). Aggregate
  consumers can include or exclude these explicitly.
- **Native units only.** Foothill/De Anza store quarter units and
  `unit_system: 'quarter'`; any semester conversion is an analysis-time
  concern (the hardcoded ÷1.5 elsewhere in the codebase is a known trap and
  must not leak into storage).
- **Course references are canonical, not embedded.** `course_ids` are the
  same numeric `assist_courses.course_id` values agreements use (with
  `course_keys` `'cc:<n>'` mirrors), so titles, units, `same_as`
  cross-listings, and the existing concept mapping all come by join — no
  duplicated copies on the degree doc. Same-as resolution must go through
  the `same_as` objects' numeric `course_id` (the stored `same_as_keys`
  field is corrupted — every value is `'cc:[object Object]'` — and must not
  be relied on). Catalog citations that don't resolve to an assist course
  land in `unresolved_courses_seen` and flag the group.
- **Referenced courses may lack concepts.** AS degrees cite courses outside
  the 4,730-course concept-examined agreement inventory (4,509 actually
  mapped) — especially GE. That's valid; backfilling those mappings is
  future work, not a blocker.

### 1C. What "the CS AS" means (degree matching)

Catalogs title degrees inconsistently ("Computer Science A.S.", "Computer
Programming A.S.", CS certificates, CS ADTs). Matching rules — which catalog
program counts as the school's CS AS, and what to do when several qualify —
are decided during the pilot from real examples and recorded in the template
doc's `note` / the G2 review doc. `status: 'ambiguous'` plus
`degree_title_seen` preserves the raw finding when rules don't resolve it.
Local AS-T/ADT programs are **excluded** — this dataset is specifically local
(non-transfer-guaranteed) AS degrees.

## 2 · Phase 1 — schema + pilot + template fitting

1. Implement both kinds: validation in `putRequirement`/`deleteRequirement`
   (`server/controllers/CanonicalData.js`), delete guards (a template
   referenced by `as_degree` docs cannot be deleted; a concept referenced by
   a template group or an `as_degree` course entry cannot be deleted),
   References registry entries.
2. **Stratified pilot, 12–15 colleges:** mix of large/small enrollment,
   north/south, multi-college districts (e.g. one Los Rios, one LACCD sibling
   pair to test district-level catalog sharing), and Foothill or De Anza for
   quarter units. Full, careful extraction of each pilot school's CS AS from
   its live catalog into the `as_degree` shape.
3. Fit the template from the pilot and produce a **coverage report** in
   `docs/as-degree-template-review.md`: per pilot school, the fraction of its
   actual degree the template's groups explain, everything that fell outside,
   and the proposed degree-matching rules (§1C).
4. **G2 gate:** Tybalt reviews the coverage report and template; template
   locks on approval. If pilot variance is high, this is the cheap exit — we
   reconsider before the statewide sweep, not after.

## 3 · Phase 2 — statewide sweep + import + References table

1. In-session multi-vote extraction of all 115 college catalogs against the
   locked template, producing `scripts/data/as_degrees_cs.json` with a `meta`
   methodology block (same discipline as the course-concept artifact).
2. Importer (`scripts/import_as_degrees.py`, following
   `import_course_concepts.py`'s artifact/meta conventions — but note its
   curated protection covers only `assist_courses` fields; the group-level
   merge here is **new logic**, not inherited). Merge semantics, explicitly:
   - A doc with `verification.verified: true` is skipped entirely (no
     `--force` override in v1; verified means verified).
   - Within an unverified doc, any group with `source: 'curated'` (equiv.
     group-level `curated_by` set) is preserved verbatim; other groups are
     replaced by the artifact's.
   - The `verification` object is never written by the importer.
   - Re-import protection is governed by **group-level** `curated_by` and
     `verification.verified` only — the doc-level `curated_by` that
     `putRequirement` auto-stamps on every console save carries no meaning
     here.
   - Stamps `extraction` on every import.
3. Bulk table for `as_degree`: server-side CRUD comes free from kind
   registration (the generic `/api/curated/requirements/:kind` routes); no
   `refTablesRegistry` entry is used, since the registry's flat field-schema
   modal cannot edit nested degree docs. The QA surface is a **bespoke table
   modeled on `frontend/src/prereqs/ConceptMappingTable.jsx`** (which is
   where the flagged-row filter, confidence display, and badge patterns
   actually live): one row per college, columns for status, confidence,
   source mix, flagged filter, and a triage-grade detail modal (mark-group-
   reviewed, status, total units) stamping group-level `curated_by`.
4. **QA report:** confidence distribution, `template_default` rate,
   `none_found`/`ambiguous` lists, per-group flag rates — so we know what the
   sweep actually produced before anyone consumes it.

## 4 · Verification model (staged)

- **Now (aggregate-grade):** multi-vote confidence + flagged rows + the QA
  report. Tybalt spot-checks whatever the flags surface.
- **Paper time (per-school-grade):** Tybalt selects the paper's college
  subset, opens each doc's `catalog_url`, corrects groups in the UI
  (stamping `curated`), writes verification notes himself, and marks
  `verification.verified`. Visuals then run on the corrected data with no
  pipeline changes. Every extracted doc carrying its source URL + catalog
  year is what makes this step cheap.

## 5 · Frontend + design-handoff pause point

**Built in Phase 2 (standard plumbing, no design pass):** the References
table.

**⏸ Pause point — after Phase 2's QA report is accepted** (data imported,
References table live, sweep quality known): stop feature work. Tybalt runs
the prepared design prompt — `docs/as-degree-view-design-prompt.md` — in a
fresh Claude design session, first refreshing its marked placeholder section
with 2–3 real extracted schools from the sweep (one clean match, one
deviation-heavy, one low-confidence). This mirrors the prereq-graph
design-handoff workflow (`docs/prereq-graph-design-prompt.md` →
`docs/handoff*`).

**Phase 3 (after the handoff comes back):** implement the per-college
**AS Degree view** from the returned design — the school's degree rendered as
its requirement groups with filling courses, unit accounting toward the
school's total, source/confidence badges, computed template-deviation
highlights, and the verification affordances of §4. Verification notes remain
user-authored; the UI provides the field, never the text.

## 6 · Explicitly out of scope

- Credit-loss, eligibility, articulation-overlap, and time-to-degree math —
  no *analysis* computation of any kind. The only in-scope computations are
  display-level: the read-time template diff and unit sums toward the
  school's own total (§5's unit accounting).
- `timeToDegreeData` and the legacy `associate_degree` kind — untouched,
  dormant. Wiring analysis to the new kinds is a future, deliberate step.
- Time-to-degree / term-packing ports from the paper repo.
- Concept-mapping backfill for non-agreement (GE) courses.
- Non-CS majors — the schema supports them (`major_slug`), v1 populates
  only `cs`.

The schema keeps units on every course entry and concepts on every core slot
precisely so all of the above can bolt on later without re-extraction.

## 7 · Testing

- Kind validation unit tests (agreement-skeleton fields, extension fields,
  concept OR-group nesting, native units, tri-state source values) alongside
  the existing `curated_requirements` kind tests — including a test that an
  `as_degree` group body is accepted by the agreement predicates
  (`isOptionCompleted`/`sectionContribution`) unchanged, which is the whole
  point of the shared skeleton.
- Importer verification (this repo's Python scripts have no unit-test
  convention — the discipline is `--dry-run` on committed `*.sample.json`
  fixtures plus scripted live checks): curated-row protection (a `curated`
  group survives re-import), verified docs skipped entirely, `none_found`
  upsert, `verification` never touched.
- Read-time diff tests: template-aligned, extra-group, and
  `template_default` cases.
- References-table wiring test mirroring the concept-mapping table's.
