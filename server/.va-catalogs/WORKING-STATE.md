# Virginia CS catalog scrape — working state

Resume file. Everything needed to continue is here; nothing has to be re-derived.

## Why this was rewritten

Every Virginia degree in the console used to render as a single group called
"Requirements" holding an undifferentiated bag of course codes. That was not a
rendering bug. The old collector ran a regex for course codes over whatever HTML
it received and stored the codes, so headings, credit figures and "choose two of
the following" instructions were discarded at fetch time and could not be
recovered downstream. `importVirginiaCatalogDegrees.js` then had nothing to
build groups from, and its fallback — one group, every code — ran for all 48
institutions.

The fix separates collection from interpretation. Capture saves pages verbatim;
extraction reads those pages and is a pure function of the bytes; import writes
canonical documents. Re-parsing never requires re-fetching, and a parser change
can be re-run against the same corpus and diffed.

## The pipeline

```
scripts/captureVirginiaCatalogs.js      → .va-catalogs/pages/<slug>__<role>.{html,txt}
scripts/extractVirginiaRequirements.js  → .va-catalogs/requirements/<slug>.json
scripts/importVirginiaCatalogDegrees.js → va_requirements, va_coverage, va_revisions
```

Parsers live in `services/virginia/catalogParse/`: `lines.js` (Acalog, PDF,
department pages), `courseleaf.js` (CourseLeaf markup), `pdf.js` (cuts one
program out of a whole-catalog PDF), `validate.js` (the import gate),
`normalize.js` (the shared vocabulary). The parser, capture, composition, and
acceptance paths all have focused regression coverage.

`.va-catalogs/institutions.json` is the registry: 57 institutions — 24 sending
colleges, the 15-school SCHEV public four-year primary cohort, and 18 additional
Virginia four-year partners retained as a secondary cohort. Existing catalog
hosts were probed live rather than assumed.

## Current state — 2026-08-10

The primary collection goal is complete at the catalog/source-composition
layer:

| Primary outcome | Complete | Notes |
| --- | ---: | --- |
| SCHEV public four-year degrees | 15 / 15 | Full major, GE/college, and graduation-policy composition |
| CS-directed CC/RBC associate paths | 19 / 19 | Includes the source-supported generic Science A.S. paths at Mountain Gateway and Rappahannock without inventing a CS-only sequence |
| Sourced CC negative findings | 5 / 5 | Danville, Eastern Shore, Mountain Empire, Patrick & Henry, Southside Virginia |

All 34 positive primary documents pass catalog acceptance and unit closure.
Virginia Western is analysis-ready; the other 33 retain exact rules the current
constraint solver cannot yet evaluate. The accepted-only release also contains
three source-complete secondary bachelor's records (Bridgewater,
Randolph-Macon, and Shenandoah), for 37 publishable documents total: 19 A.S.
and 18 bachelor's records. These are not automatically human-verified; that
verdict remains a separate signed source walk.

Tidewater is source-composed and catalog-accepted. Its official Acalog origin
returns Cloudflare 403 to the collector, so the retained provenance distinguishes
that failure from the exact transparent renders of the same official pages used
for composition. UVA, VMI, and William & Mary now have current full source
compositions rather than pending or URL-only records.

The durable source-integrity inventory is
`.va-catalogs/research/primary-source-integrity-manifest.json`: 196 primary
source references, 182 locally byte-matched, four explicit Tidewater
transparent-render exceptions, and ten URL/hash-only provenance limitations.
The ignored `pages/` directory remains a transport cache, not a publication
artifact; compact source-specific evidence is retained in nonignored research
JSON without pretending unavailable response bytes are reproducible.

The authoritative contract and current workflow are documented in
`docs/virginia-degree-collection.md`. In particular, a parser `pass` means only
that the captured program page has a coherent tree. It does **not** mean the GE,
college, graduation, upper-level, or residence layers have been composed.

No broad corpus import should run merely because capture/extraction succeeded.
Run the importer in dry-run mode and require the explicit acceptance verdict;
source-bundle changes also reopen any earlier human verdict.

## Transports, and why each is needed

| Transport | Used for | Why |
| --- | --- | --- |
| `fetch` | CourseLeaf, CleanCatalog, SmartCatalog, department pages | Works |
| `curl` fallback | Central Virginia, Rappahannock, Roanoke, Paul D. Camp | Node's fetch **throws** on these hosts while curl retrieves them first try. TLS/ALPN, not the sites. Without it four institutions read as publishing nothing |
| **headed Chrome** | all Acalog, plus Cloudflare hosts | Acalog answers scripted fetch with HTTP 202 and a bot challenge. **Headless Chrome fails; headed Chrome passes.** Not a preference — the only path that returns the page |
| `pdftotext` | Virginia Highlands, Averett, Lynchburg, Eastern Mennonite | The catalog is a single PDF |

The browser uses a persistent profile (`.va-catalogs/.browser-profile`) so the
Cloudflare clearance cookie survives between runs.

## Traps that cost real time

Four separate bugs, all the same missing word boundary in different clothing.
**Never put `\b` to the left of a course code or a credit unit** — catalog text
runs together at every column boundary.

- `(6cr)` — `\bcr\b` never matches between `6` and `c`, so every Germanna
  heading read as creditless and its ten groups collapsed into one.
- `SDV 100or SDV 101` — flattened from an indent block; `\bor\b` finds no
  boundary between `0` and `o`, so a choice read as a required pair.
- `CS 1114` under a three-digit pattern reads as `CS 111` plus a stray `4`.
  Virginia Tech's complete, correctly captured 123-credit degree was recorded as
  publishing nothing.
- `CS 4723D Game Programming` — a code, its credit figure and its title with no
  separators. Text alone cannot resolve it; the markup already did. The
  validator grades this `ambiguous`, never `absent`.

Others worth keeping:

- **Stop at the suggested schedule.** Acalog prints a term-by-term plan after
  the requirements, restating every course. Reading past it counts the degree
  twice. But at the CourseLeaf community colleges the plan grid *is* the
  published requirement structure — NOVA publishes no categorical breakdown —
  so there the terms are the groups. The difference is in the source.
- **A bare line inside a group is a sub-heading, not a group.** `Art`,
  `Humanities`, `Literature` are three sections of one 6-credit requirement.
- **A group-opening instruction scopes the group, not its first section.**
  "Choose any two … from two different categories" binds across all three.
- **Not every CourseLeaf template tags the title cell.** George Mason and
  Virginia Tech emit a bare `<td>`; reading only `.titlecol` returns zero
  titles, and four-year courses have no registry to look a name up in
  afterwards.
- **Four-year elective menus are labelled with `<strong>`, not a heading tag.**
- `--force` must re-fetch the selected institutions without discarding index
  entries for the ones the run does not touch.

## Findings about the institutions

- **Five of the 24 sending colleges have no current source-prescribed CS
  curriculum.** Danville's former specialization is absent from the current
  catalog despite stale marketing. Eastern Shore, Mountain Empire, Patrick &
  Henry, and Southside publish broad Science A.S. awards but no official
  CS-specific branch. These are complete, cited findings rather than missing
  scrape work.
- **Mountain Gateway and Rappahannock are positive generic paths.** Their
  current official sources explicitly name Computer Science as a supported
  transfer purpose, but do not prescribe a separate CSC sequence. Their exact
  broad degree is retained with that limitation visible.
- **William & Mary is fully composed.** Its current official sources require a
  cross-page source walk rather than relying on the earlier placeholder page.
- **Norfolk State's** previously recorded URL was Computer Engineering
  Technology, a different degree. It publishes five CS tracks; the corpus uses
  the Standard Track.
- **Old Dominion's** previously recorded URL was the department index, whose 104
  codes are course descriptions rather than requirements.
- **Central Virginia's** `catalog.centralvirginia.edu` is the college website.
  The Acalog instance is `centralvirginia.catalog.acalog.com`.
- **Richard Bland** uses its own numbering (`CSCI 222`) and prints codes as
  `ENGL - 101`; it will not join `va_courses`.
- **Virginia Wesleyan == Batten University.** The equivalency corpus files all
  137 accepted courses under the old name, so that name stays canonical.

## Still open

- Human verification remains separate from catalog acceptance. A researcher
  must walk the cited current source bundle before signing a degree.
- The downstream constraint solver still needs support for the exact overlap,
  distinctness, variable-cardinality, and conditional-path rules retained by
  33 primary documents.
- Radford `GEOL 121` and Virginia Tech `ENGE 2724` / `ENGE 4724` are named by
  their current program requirements but absent from the corresponding current
  course catalogs. Their IDs and contexts remain visible with block-analysis
  flags; no title was invented.
- Hand-authored trees go in `.va-catalogs/requirements/<slug>.json` with
  `"hand_read": true` and are never overwritten by a re-run.

## Rebuilding from scratch

```
node scripts/importVirginiaCourses.js --uri <uri> --db pmt_research --crosscheck 25
node scripts/captureVirginiaCatalogs.js                 # opens Chrome; leave it alone
node scripts/extractVirginiaRequirements.js --uri <uri>
node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --dry-run --uri <uri> --db pmt_research
node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --apply --uri <uri> --db pmt_research
```

Collections: `va_courses`, `va_institutions`, `va_requirements`, `va_coverage`,
`va_revisions`. Only source-composed records that pass the catalog gate should
be considered candidates for a write. Analysis-ready and human-verified remain
separate, stricter states.
