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
hosts were probed live rather than assumed; UVA and VMI are explicit
`needs_collection` additions and are not accepted degree records.

## Current state — 2026-08-09

The parser-only counts below are the pre-expansion 55-school collection
diagnostics, not degree-completeness claims; UVA and VMI are not folded into
them until their source layers have actually been captured:

| | Community colleges | Four-year institutions |
| --- | ---: | ---: |
| Captured program tree | 16 | 21 |
| URL/source only | 0 | 5 |
| Official no-program finding | 7 | 5 |
| Blocked capture | 1 | 0 |
| Parser verdict `pass` / `warn` | 5 / 11 | 0 / 21 |

The source-walked compositions in `.va-catalogs/composed/` are the only records
eligible for catalog acceptance. Parser-only trees remain `major_only` or
`captured_only`; exact composition and acceptance counts are reported by the
importer’s dry run rather than maintained manually in this resume file.

The 2026-08-09 accepted-only publication evaluated the then-current 55 institutions and
published 12 source-composed documents (six A.S. and six B.S.) plus all 55
coverage rows. All 12 are catalog-accepted, none is analysis-ready, and none is
human-verified. Tidewater and Averett remain visible source artifacts but were
not published as accepted degrees. On 2026-08-10 the registry gained UVA and
VMI to complete SCHEV's 15-school public cohort; the API synthesizes honest
`not_collected` work rows for them until the next collection/publication run.

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

- **In the pre-expansion 55-school scrape, 12 institutions offer no CS degree** — 7 community colleges and 5 four-years,
  each confirmed at the catalog rather than inherited from a registry:
  - *Community colleges (7 of 24):* Danville, Eastern Shore, Mountain Empire,
    Mountain Gateway, Patrick & Henry, Rappahannock, Southside Virginia.
  - *Four-years (5 of 31):* Appalachian College of Pharmacy (a pharmacy
    school), Bluefield University (its programs list carries Cybersecurity and
    Information Technology but no CS), Mary Baldwin (its CS page redirects to a
    URL ending `-discontinued`), Sweet Briar College, University of Lynchburg.

  So **17 of 24 community colleges and 26 of 31 four-years do offer it**.
- **William & Mary is `url_only`, not no-program.** `catalog.wm.edu` serves a
  CourseLeaf "coming soon" placeholder and `wm.edu/as/computerscience` redirects
  to `cdsp.wm.edu`, whose B.S. page is prose with no course list. The college
  plainly offers the degree; it currently publishes no machine-readable
  requirements anywhere. Re-point at the catalog once it launches.
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

- **Tidewater** is the one blocked institution: Cloudflare on top of Acalog.
  It has succeeded before with a warm profile — retry rather than treat as
  permanent.
- **5 four-year institutions are `url_only`** — Hollins, Marymount, Regent,
  Roanoke, and William & Mary. Averett's bounded current PDF and Bridgewater's
  current CleanCatalog source layers are now captured; Reynolds and Camp are
  likewise no longer source-only. Sweet Briar is a current official no-program
  finding.
- 32 documents are `warn`. The commonest reason is `credits_partial` — the
  catalog prints a figure on some headings and not others, so the sum cannot be
  reconciled. That is a fact about the page, not a defect.
- Hand-authored trees go in `.va-catalogs/requirements/<slug>.json` with
  `"hand_read": true` and are never overwritten by a re-run.

## Rebuilding from scratch

```
node scripts/importVirginiaCourses.js --uri <uri> --db pmt_research --crosscheck 25
node scripts/captureVirginiaCatalogs.js                 # opens Chrome; leave it alone
node scripts/extractVirginiaRequirements.js --uri <uri>
node scripts/importVirginiaCatalogDegrees.js --uri <uri> --db pmt_research --dry-run
node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --uri <uri> --db pmt_research
```

Collections: `va_courses`, `va_institutions`, `va_requirements`, `va_coverage`,
`va_revisions`. Only source-composed records that pass the catalog gate should
be considered candidates for a write. Analysis-ready and human-verified remain
separate, stricter states.
