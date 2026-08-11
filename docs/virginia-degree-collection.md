# Virginia degree-requirement collection

This pipeline collects official requirements for Virginia Computer Science
associate and bachelor's degrees. Its output is intended for requirement
visualization and transfer-path analysis. It does not treat a prospective,
recommended, or sample schedule as the degree unless an institution (currently
NOVA) publishes its official requirement list only in a semester grid.

## Scope

The current registry is a defined research cohort, not a claim about every
postsecondary institution in Virginia:

- 23 Virginia Community College System colleges;
- Richard Bland College; and
- 15 SCHEV public four-year institutions as the primary, public-to-public
  comparison cohort; and
- 18 additional Virginia private/professional transfer partners retained as a
  secondary research cohort.

The website and API lead with the complete SCHEV cohort. All 15 public
institutions now have source-composed, catalog-accepted records: 12 use the
current 2026–2027 catalog, while CNU, Norfolk State, and VMI use 2025–2026
because that is still each institution's current official catalog. The
secondary cohort is one click/filter away; its source work is retained but does
not enter the primary verification denominator or UC comparison.

### Current primary-cohort result (2026-08-10)

- **15/15 SCHEV public four-year institutions:** full major, GE/college, and
  university-graduation layers are composed and catalog-accepted.
- **24/24 community-college/Richard Bland outcomes accounted for:** 19 current
  CS-directed associate paths are composed and catalog-accepted; five are
  official, source-backed findings that no current CS-specific curriculum
  exists.
- **The five negative findings:** Danville's previously published CS
  specialization is absent from the current catalog; Eastern Shore, Mountain
  Empire, Patrick & Henry, and Southside publish broad Science A.S. degrees but
  no current source-prescribed CS award, branch, or curriculum.
- **Two honest generic positives:** Mountain Gateway and Rappahannock publish a
  broad Science A.S. that explicitly names Computer Science as a supported
  transfer purpose/path. Their complete generic requirements are modeled, with
  `computer_science_specific_prescribed_branch: false`; no CSC sequence is
  invented.

The 34 positive primary records all pass source-layer/source-reference checks,
canonical unit closure, and course-identity resolution. They remain unsigned
until an allowlisted researcher performs the separate human-verification step.

An institution may have no Computer Science A.S./B.S., may publish a related
award under another title, or may expose more than one materially different
award or track. A `no_program` result is accepted only after an official catalog
index/program search is checked. Certificates are never promoted to A.S.
degrees merely because the institution is a community college. Career-oriented
A.A.S. awards are also outside this transfer-degree cohort and are not treated
as interchangeable with an A.S. or AA&S.

## Evidence and model layers

Collection has four deliberately separate stages:

1. **Capture official bytes.** Each source has a role (`program`, `ge`,
   `college`, `graduation`, `policy`, or `course_catalog`), requested and final
   URL, capture time, content hash, catalog year, and official-host result.
2. **Extract a neutral tree.** Platform adapters preserve headings, printed
   credit asks, courses, conjunctions, source text, and parse failures. A
   configured selector is an assertion and fails closed if it disappears.
3. **Compose the full degree.** A short, cited composition joins major,
   college/GE, and university-graduation rules and explicitly encodes nested
   AND/OR choices. Readable course codes are compiled to project-minted IDs;
   the composition never contains opaque hand-entered numeric IDs.
4. **Accept and verify.** Structural/catalog acceptance and analysis readiness
   are separate verdicts. Human verification is a third, signed verdict tied to
   the exact source-and-composition bundle hash.

Raw captured pages are local cache and intentionally ignored by Git. Reviewable
extraction artifacts in `server/.va-catalogs/requirements/`, source research in
`server/.va-catalogs/research/`, and curated compositions in
`server/.va-catalogs/composed/` are durable inputs.

## Collection states

| State | Meaning |
| --- | --- |
| `captured_only` | Official bytes were captured, but no trustworthy requirement tree exists. |
| `major_only` | The major page was parsed; GE/college/graduation rules are not yet composed. |
| `composed_full_degree` | Every required source layer has been walked and joined into a cited model. |
| `catalog_accepted` | Identity, official sources, source references, scope, layers, and canonical tree structure pass. |
| `analysis_ready` | Catalog acceptance also passes course resolution, exact AND/OR semantics, unit closure, and upper-level/residency audit checks. |
| human verified | An allowlisted researcher signed the current source-bundle hash. Any source or composition change makes the verdict stale. |

“Captured” never means “complete,” and neither catalog acceptance nor analysis
readiness is presented as human verification.

The Virginia review API recalculates catalog acceptance server-side on every
save. A request cannot unlock verification by submitting its own `acceptance`
flag, and changing the requirement/source material of a signed degree reopens
that verdict with the prior signature retained as stale audit history.

## Four-year completeness contract

A complete bachelor's record must identify the exact award/variant and catalog
year, the academic unit that owns the major, the college/school where relevant,
and the authority that owns general education. It must cite official sources
for all of the following:

- lower- and upper-division major requirements;
- college/school and general-education requirements after documented overlap;
- university graduation minimum;
- upper-level credit minimum or an explicit sourced `none_stated` declaration;
- residence/final-credit requirements or an explicit sourced `none_stated`
  declaration; and
- the official course dictionary or equally direct catalog evidence for every
  named university course.

The canonical unit path must close exactly to the published degree minimum.
GE is modeled as the distinct remaining requirement after known major overlap,
not gross GE added a second time. Free-elective capacity is derived arithmetic,
not a guessed list of courses. An upper-level or residency policy is an overlap
constraint and must not add fictitious credits to the degree.

Course alternatives are separate receivers in a choose-N section. A series is
only an AND sequence in which every `parent_id` is required. University numeric
IDs are code-derived and not globally unique; consumers must retain the
receiving institution context.

## Associate-degree completeness contract

A complete A.S. record must cite the exact official program title, award,
catalog year, total-credit range, program requirements, approved elective/GE
sources, and graduation policies. In the canonical tree:

- multiple options on one requirement are OR alternatives;
- multiple courses inside one option are an AND bundle;
- choose-N and choose-by-credit rules are explicit;
- GE categories remain named categories with their distinctness/exclusion
  rules; and
- every named course ID/key resolves to an actual course offered by the
  selected college/VCCS catalog.

An unenumerated line remains visible and blocks readiness. The importer never
turns “approved elective,” “no credit,” or another bucket into a fabricated
course identity. A residual `units_fill` group is allowed only to close
variable-credit paths to the published degree minimum.

Most community-college course codes use the VCCS master namespace. When an
official A.S. catalog instead declares `course_namespace.kind` as
`institution_local` (currently Richard Bland), `/va/degrees` retains the legacy
code-derived `course_id` and `course_key` but also returns `college_id`,
`institution_id`, `identity_scope`, and `scoped_course_key` on every course
row. Consumers must join those rows by `scoped_course_key` or by the
`(college_id, course_id)` tuple. A same-code row from `/va/courses` is not
evidence for an institution-local course.

Transfer Virginia program maps are retained only as corroboration. Their
importer replaces only its own `source: transferva_program_map` records, rejects
certificate/A.A.S. rows from this A.S. cohort, and never replaces the
institution-catalog requirement collection.

## Platform safety rules

- **CourseLeaf:** use the configured authoritative requirements container and
  explicit exclusions. Roadmaps, plans of study, honors, and accelerated tabs
  are excluded. Adjacent tables remain neutral until a composition attaches
  them to the owning rule.
- **Acalog:** capture the catalog-year-pinned program/print representation and
  retain descendant option branches. A suggested schedule after a categorical
  requirement list is not parsed as another copy of the degree.
- **PDF:** require actual PDF bytes, an identified program heading, bounded page
  or text anchors, and a nonempty requirement window. HTML challenge/error
  pages and whole-catalog fallbacks fail closed.
- **Coursedog/CleanCatalog/SmartCatalog:** prefer official embedded state or
  platform APIs over browser body text, and record the endpoint/version used.

Official sources are HTTPS by default. The two current, host-exact exceptions
are `catalog.rbc.edu` and `catalog.uvawise.edu`; their official current Acalog
catalogs are HTTP-only or downgrade after an HTTPS certificate/redirect
failure. Arbitrary insecure `.edu` URLs remain invalid evidence.

## Current source-composed records

### Northern Virginia Community College, Computer Science A.S. (2026–2027)

Official sources:

- <https://catalog.nvcc.edu/programs/computer-science-as/>
- <https://catalog.nvcc.edu/general-education-electives/>
- <https://catalog.nvcc.edu/academic-programs-requirements/>
- <https://catalog.nvcc.edu/academic-policies-information/>

The composition preserves the 60–63 credit publication, precalculus versus
placement-out paths, two-course/five-credit placement rule, approved elective
pool, two distinct humanities/fine-arts/literature areas, history and nonhistory
social-science requirements, conditional MTH 245 substitution, and the 25%
residence/2.00 program-GPA policies. It reorganizes the official grid into
requirements rather than presenting it as a suggested schedule.

### Additional source-composed A.S. records

- **Blue Ridge (2026–2027, 60–62):** the [program](https://catalog.brcc.edu/programs-study/science-computer-science/),
  [UCGS menu](https://catalog.brcc.edu/programs-study/ucgselectives/), and
  [graduation policy](https://catalog.brcc.edu/student-handbook/policies/graduation/)
  are captured separately. The four-credit GE slot with three-credit options,
  variable-cardinality CS elective pool, distinct-area rule, and overlap rules
  remain explicit constraints.
- **Brightpoint (2026–2027, 60-credit minimum):** the
  [program](https://catalog.brightpoint.edu/preview_program.php?catoid=12&poid=1464&returnto=1157),
  [graduation rules](https://catalog.brightpoint.edu/content.php?catoid=12&navoid=1153),
  and [academic policy](https://catalog.brightpoint.edu/content.php?catoid=12&navoid=1151)
  support a 60–61 modeled range. Its choose-two-or-three/minimum-eight elective
  rule and lab/elective overlap are not flattened.
- **Camp (2026–2027, plan 246, 61):** the
  [official catalog landing](https://www.pdc.edu/servicesandresources/resources-and-services-for-students/college-catalog-and-student-handbook/)
  links the bounded program PDF. The source's 61-credit row total versus
  62-credit printed term subtotals, and its four-credit MTH 264/MTH 245 slot,
  are retained as source conflicts.
- **Reynolds (2026–2027):** the
  [award page](https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4051&returnto=1496)
  publishes distinct destination maps. The selected 63-credit B.S. map and the
  alternate 62–63-credit B.A. map remain separate compiled variants; IDs for
  courses unique to either map are exposed by the API.
- **Richard Bland (2026–2027, 60):** this is accurately titled the combined
  [Math/Computer Science A.S.](https://www.rbc.edu/academics/programs-degree/),
  not a standalone CS award. The CS branch, institution-local course namespace,
  30-credit residence rule, and published component-range conflict are retained.

Tidewater's [current Computer Science A.S.](https://www.tcc.edu/programs/computer-science/)
is source-walked, compiled, and catalog-accepted at 60–63 credits, including its
nested mathematics path, two distinct technical slots, complete GE/elective
menus, and graduation rules. The official Acalog origin returns a reproducible
Cloudflare 403 to the project browser. The durable evidence therefore records
that direct failure separately from four repeatable transparent renders of the
exact official-origin pages, with response hashes and direct official Transfer
Virginia corroboration. This is an explicit provenance caveat, not a missing
requirement or an excuse to use a prospective schedule.

### George Mason University, Computer Science B.S. (2026–2027)

Official sources:

- <https://catalog.gmu.edu/colleges-schools/engineering-computing/school-computing/computer-science/computer-science-bs/>
- <https://catalog.gmu.edu/mason-core/>
- <https://catalog.gmu.edu/colleges-schools/engineering-computing/>
- <https://catalog.gmu.edu/policies/academic/undergraduate-policies/>
- <https://catalog.gmu.edu/courses/cs/>

The composition closes at 120 credits and keeps the program's major blocks,
12-credit natural-science rule, 24-credit net Additional Mason Core remainder,
eight credits of elective capacity, 45 upper-level credits, one-fourth Mason
residence minimum, and 12 upper-level Mason credits in the major. Conditional
graduate substitutions limited to accelerated/honors students are excluded
from the ordinary B.S. path. The official CS Core subtotal conflict is retained
as a review flag rather than silently choosing the printed subtotal.

### University of Mary Washington, Computer Science B.S. (2026–2027)

Official sources:

- <https://catalog.umw.edu/undergraduate/majors/computer-science/>
- <https://catalog.umw.edu/undergraduate/general-education/requirements-bachelor-arts-bachelor-science-degrees/>
- <https://catalog.umw.edu/undergraduate/college-arts-sciences/>
- <https://catalog.umw.edu/undergraduate/undergraduate-degrees/ba-bs-degree/>

The composition preserves the 46–48-credit major, the CPSC 284 versus MATH
201+300 choice, both upper-level course-selection rules, every published GE
course/attribute/experience gate, 120-credit total, and the three overlapping
residence rules. The explicitly suggested 120–122-credit plan is excluded. UMW
does not publish an independent additive GE subtotal, so exact GE gates constrain
a separately modeled remaining-credit capacity rather than being summed twice.

### Longwood University, Computer Science B.S. (2026–2027)

Official sources:

- <https://catalog.longwood.edu/preview_program.php?catoid=19&poid=2779&returnto=970>
- <https://catalog.longwood.edu/content.php?catoid=19&navoid=1004>
- <https://catalog.longwood.edu/content.php?catoid=19&navoid=968>

The composition selects the B.S. path from the combined B.A./B.S. program and
closes 39 Civitae Core credits, 45 major credits, three B.S.-specific credits,
and 33 credits of elective capacity to 120. It retains the published 30-credit
upper-level-at-Longwood rule, 25% residence rule, MATH 171 overlap, conditional
elective capacity, and exact Civitae and B.S. alternatives.

### Bridgewater College, Computer Science B.S. (2026–2027)

Official sources:

- <https://bridgewater.cleancatalog.io/mathematics-computer-science/bachelor-of-science-major/computer-science>
- <https://bridgewater.cleancatalog.io/the-connected-learning-cl-curriculum>
- <https://bridgewater.cleancatalog.io/degree-requirements>

The current 46-credit major is modeled as a 31-credit shared core plus exactly
one intact 15-credit Cybersecurity or Full-Stack track. The composition closes
to 120 while preserving the 45-credit upper-level minimum, 33-credit residence
minimum, 30-of-final-33 rule, nine major credits in residence, Connected
Learning range and transfer exception, and the catalog's cross-layer overlap
rules. Historical and prospective term plans are excluded.

### Shenandoah University, Computer Science B.S. (2025–2026)

Official sources:

- <https://catalog.su.edu/preview_program.php?catoid=33&poid=5244&returnto=2014>
- <https://catalog.su.edu/content.php?catoid=33&navoid=1975#General_Education_Curriculum>
- <https://catalog.su.edu/content.php?catoid=33&navoid=1975#Requirements_for_Degrees>

The composition closes the 55-credit major (43 fixed, six mathematics
electives, and six upper-level CSC/DATA electives) plus 65 credits of ShenEd
and elective capacity to 120. It preserves ShenEd's exact 30-credit sphere
ranges and transfer treatment, the 30-credit upper-level minimum (the major
guarantees 32), 25% residence, 24-of-final-30 rule, and transfer cap. The
separately labeled Course Map is excluded, including its conflicting schedule
value for CSC 407.

### Randolph-Macon College, Computer Science B.S. (2026–2027)

Official sources:

- <https://catalog.rmc.edu/programs/computer-science/computer-science-major/>
- <https://catalog.rmc.edu/academic-program/collegiate-requirements/>
- <https://catalog.rmc.edu/academic-program/degrees-offered/>
- <https://catalog.rmc.edu/academic-regulations/transfer-credit/>
- <https://catalog.rmc.edu/academic-regulations/course-numbering-policy/>

The composition preserves the exact 40-credit major, including the programming
emphasis and four-course elective menu, inside the 120-credit degree. It models
every Collegiate Requirement as a gate without inventing a GE subtotal and
retains the 75-credit external-credit cap, derived 45-credit institutional
floor, half-major residence rule, 2.0 GPA, and the source-backed 12-credit
minimum at the 300 level or above within the major.

### Averett University, blocked source-composed draft (2025–2026)

The [official current catalog PDF](https://www.averett.edu/wp-content/uploads/Academic-Catalog-2025-26.pdf)
is captured with an exact hash and page-110 requirement window. Its listed
major rows total 49 credits while the page prints 52, and the last three-credit
elective line omits the connector between its CSC and MTH pools. The draft
therefore remains catalog-blocked with both unresolved nodes visible. It does
not promote CSC 306 from the excluded sample sequence to repair the discrepancy.

Every composition described as catalog-accepted remains explicitly unverified
until an allowlisted researcher walks the cited sources and signs the current
bundle. Catalog acceptance also does not imply analysis readiness: exact
distinctness, overlap, variable-cardinality, exclusion, and conditional-path
rules remain explicit blockers until the downstream evaluator implements them.

Three program-listed codes deliberately retain a null title because their
institutions' current course catalogs contain no matching course entry:
Radford `GEOL 121` and Virginia Tech `ENGE 2724` / `ENGE 4724`. Their stable
IDs, requirement context, and source discrepancy are preserved with
`block_analysis` flags; the pipeline does not invent titles.

Source provenance is inventoried in
`server/.va-catalogs/research/primary-source-integrity-manifest.json`. Across
the 196 official references used by the 39 primary outcomes, 182 declarations
were checked against the locally retained normalized response bytes. Four
Tidewater references are explicitly classified as transparent-render transport
exceptions, and ten retain an official URL plus declared hash and compact
research evidence without claiming exact response-byte reproducibility. Raw
page captures remain an ignored transport cache, so this distinction is a
provenance limitation—not a hidden catalog-completeness claim—and must remain
visible during human verification.

## Publication gate

The source-composed records are published only through the accepted-composition
gate. New composition, requirement, research, and regression files must be
staged explicitly (for example with a reviewed `git add -A`); `git commit -am`
does not include new cohort artifacts. From `server/`, always run the no-write
preflight against the exact production database first:

```bash
node scripts/importVirginiaCatalogDegrees.js \
  --accepted-compositions-only \
  --dry-run \
  --uri <production-mongodb-uri> \
  --db pmt_research
```

The current expected preflight is:

- 57 registry candidates evaluated;
- 37 publishable documents: 19 A.S. and 18 bachelor's records;
- 37/37 catalog-accepted, including all 34 primary records plus Bridgewater,
  Randolph-Macon, and Shenandoah from the secondary cohort;
- one analysis-ready record (Virginia Western); every other accepted record is
  blocked only by explicitly retained `constraint_support` rules; and
- a database-specific list of ineligible legacy/incomplete records that would
  be superseded, with no write during the preflight. Review that list against
  production; its count depends on the target database's existing state.

After reviewing that exact output and receiving explicit production authority,
publish with the production Mongo URI and the same gate:

```bash
node scripts/importVirginiaCatalogDegrees.js \
  --accepted-compositions-only \
  --apply \
  --uri <production-mongodb-uri> \
  --db pmt_research
```

The importer is no-write by default, rejects unknown flags, and requires
`--apply` plus `--accepted-compositions-only` for the normal publication path.
The full publication also enforces the exact 15 public degrees, 19 associate
degrees, and five complete negative findings before starting one Mongo
transaction. If the preflight identifies a verified record in the supersede
plan, reconcile it first; applying that status change additionally requires the
explicit `--allow-verified-supersede` acknowledgement. Likewise, a verified
record whose source-bundle hash changed (or predates source hashing) is listed
for re-verification and requires `--allow-verified-reopen` before apply. A
successful code
deployment alone does not write these
Mongo-backed degree documents. After the import, verify the 15-row public
cohort, all 24 college coverage rows, the five `program_finding` negatives, and
representative `/va/degrees` course-ID/title catalogs through the guarded API.

## Researcher workflow

1. Capture every configured source role for one exact catalog version.
2. Run extraction and inspect the source tree, parser warnings, and exclusions.
3. Build or update the readable composition, citing every group and section.
4. Run the composition, acceptance, parser, and importer tests.
5. Inspect the rendered requirement ledger and unit audit against every source.
6. Record unresolved ambiguity as a blocking flag; do not flatten it away.
7. Sign verification only after the source walk. Re-capture in a new catalog
   year creates a new source hash and reopens verification automatically.
