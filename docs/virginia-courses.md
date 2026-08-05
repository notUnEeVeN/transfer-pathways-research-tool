# Virginia course equivalencies

The Transfer Virginia layer we can stand on. Course-level only — see
[Scope](#scope) for why the degree layers are held back.

## What the corpus is

One document per **VCCS common course**, holding:

- the course itself (code, title, credits, department, description, source URL)
- `articulates_to[]` — every four-year institution that publishes an
  equivalency, with the identifier the course lands as, that institution's own
  course title, and its notes verbatim
- `offered_by[]` — every college whose catalog carries the same course number

Collections are `va_courses` and `va_institutions`, both under a `va_` prefix so
nothing can be confused with the ASSIST corpus in the same database.

## Source

`https://www.transfervirginia.org/course/<GUID>` — one page per *(college,
course)*, carrying a server-rendered **"Where Will This Course Transfer?"**
table with columns `Institution | Identifier | Name | Notes | Level`. No
JavaScript, no token, no pagination; the whole table is in the HTML.

Course GUIDs come from `/courses?query=<CODE>`. The query must be the
**concatenated** form — `CSC 221` matches fuzzily and returns CSC222 alongside
it, so the parser keeps only pages whose code matches exactly and a request for
CSC221 can never be satisfied by its neighbour's page.

## Why one page per course code is enough

Equivalencies key on the VCCS common course, **not** on the sending college.
Four renderings of CSC221 — Blue Ridge, Central Virginia, Danville and Germanna
— returned identical four-year mappings: the same 17 institutions with the same
target identifiers.

That is the fidelity property Virginia's transfer guides never had, and it is
the same kind of check that made Maryland trustworthy: a claim that can be
falsified for free on data we already fetched. It is enforced rather than
assumed — `crossCheck()` compares multiple renderings and the import reports
every disagreement as `extra` / `missing` / `differs`, so a course whose
equivalencies turn out to depend on the sender is surfaced instead of averaged.

The sending-college dimension then comes from the two-year rows, which name
every college carrying the same course. That is the same answer
`courseSupply.js` derived from Solr facets in 586 requests, already on the page.

## Scope

Deliberately **courses only**. The other two layers exist and parse, and are
held back for stated reasons rather than technical ones:

| Layer | Status |
| --- | --- |
| Course equivalencies | in the corpus |
| VCCS prerequisite/corequisite baseline | built as separate verification-ready artifacts; live import pending |
| AS degrees (CS) | parse cleanly for 17 of 23 colleges — not surfaced yet |
| Four-year CS requirements | published for only **12 of 25** universities |

The four-year gap is the one that matters. The 13 with nothing published include
George Mason, VCU, Old Dominion, Radford, Norfolk State, Christopher Newport and
Longwood — most of the large publics — while what *is* published skews small and
private. A degree view over that would read as coverage it does not have, so
four-year program requirements are coming from institution catalogs instead,
which is how the other states were handled.

Course equivalencies do not have this problem: George Mason, VCU, Virginia Tech
and JMU all publish them. That asymmetry is the reason this layer went first.

## Running the import

```bash
node scripts/importVirginiaCourses.js --uri mongodb://localhost:27017 --db pmt_research --crosscheck 25
```

`--uri` and `--db` beat every environment variable, and the resolved destination
is logged before any write — an earlier import in this project silently
preferred `TARGET_MONGO_URI` from `scripts/.env` and wrote to the shared
research cluster. Collections are staged and renamed atomically, so a failed run
never leaves a half-written collection in place of a good one.

Useful flags: `--dry-run`, `--codes CSC221,CSC222`, `--crosscheck N` (fetch three
renderings for the first N codes and validate the invariant), `--refresh`,
`--limit N`, `--delay ms` (default 2500).

Prerequisites come from the separate official VCCS Master Course File, not
Transfer Virginia equivalency pages. Build and validate them independently so
a `va_courses` refresh cannot erase the mappings:

```bash
cd server
node scripts/buildVirginiaPrerequisites.js --write
node scripts/importVirginiaPrerequisites.js       # validation-only by default
```

See [`virginia-prerequisite-qa.md`](virginia-prerequisite-qa.md) for the scope
ledger, Boolean formula contract, local-page audit, and partner review queue.

The scope defaults to `.va-degrees/cs_course_scope.json` — the 335 distinct
course codes named by the 21 community-college CS associate maps, so the course
universe is defined by the data rather than by guessing prefixes. Note that it
includes some non-VCCS prefixes (`ENGL`, `HIST`, `MATH`, `PHYS`) picked up from
Richard Bland, which uses its own numbering. The prerequisite artifacts retain
all 335 codes. A Transfer Virginia same-code record is identity evidence only
when its offering colleges overlap the requirement source; otherwise the row is
kept and visibly flagged instead of borrowing an unrelated title.

Richard Bland is an explicit exception. Its local course identities do not
inherit same-code VCCS master rules, and a mixed Richard Bland/VCCS code can
carry an institution-specific title override. The application therefore shows
Richard Bland as incomplete local evidence rather than presenting the statewide
VCCS prerequisite baseline as its policy.

## What the first full import returned

**304 courses · 4,668 equivalencies · 970 carrying notes · 69 departments ·
24 community colleges · 33 four-year institutions.** Zero WAF blocks, zero fetch
errors, and the cross-check ran on 25 codes with **0 inconsistencies**.

The institutions accepting the most courses are Virginia Commonwealth (255), Old
Dominion (238) and George Mason (237) — the same universities whose degree maps
are unpublished, which is the asymmetry this layer exists to exploit.

### The 31 codes that returned no Transfer Virginia result

These are retained as unresolved requirement evidence rather than assumed to be
current course identities. Many are legacy VCCS numbers co-listed with a newer
course in the same requirement rule; others need partner verification against
the originating catalog. Common historical/renumbering patterns include:

| Retired | Live |
| --- | --- |
| `MTH173` / `MTH174` | `MTH263` / `MTH264` (Calculus I–II) |
| `MTH163` / `MTH164` / `MTH166` | `MTH161` / `MTH162` / `MTH167` |
| `MTH240` | `MTH245` (Statistics) |
| `MTH277` / `MTH285` / `MTH287` | `MTH265` / `MTH266` / `MTH288` |
| `EGR120` / `EGR124` | `EGR121` / `EGR122` |
| `SPD100` / `SPD110` | `CST100` / `CST110` (Speech → Communication) |
| `STD100…109` | `SDV100` / `SDV101` / `SDV108` |

The prerequisite artifacts keep every one of the 31 codes as a direct scoped
row, even when a likely successor exists. They are reported as `no_results` in
the course import and flagged for review rather than silently dropped or merged
with a different code.

### Four-year institutions in `offered_by`

13 four-year institutions appear in `offered_by` — reached as the *rendering
owner*, not through a 2-Year row (the counts match exactly). Scope includes a
few non-VCCS codes from Richard Bland's numbering (`HIST201`, `ENGL…`), and
searching those returns a four-year-owned course record.

`offered_by` is still retained as "institutions whose selected rendering carries
this code," but a code match alone is not treated as proof of a shared course
identity. The **Reach** matrix filters its row axis to
community colleges, because using `offered_by` unfiltered would put universities
on the sending side of a sending→receiving view. That filter is what moved the
matrix from 37×32 with 405 empty cells to 24×32 with 10.

## Reading the console

The `Virginia` area now has five top-level views:

- **Overview** — corpus counts and collection progress.
- **Community Colleges** — offered courses, associate degrees, and a per-college
  projection of the published VCCS prerequisite baseline.
- **Universities** — accepted courses, graduation requirements, and a deliberately
  labelled **Transfer Preparation** projection rather than claimed university prerequisites.
- **Courses** — filter the shared course corpus and inspect equivalencies.
- **Prerequisites** — statewide published graph plus the read-only mapping review queue.

One caveat worth keeping in view on the Reach tab: a cell counts courses a
college teaches that a university has agreed to accept. It is **not** a claim
that those courses satisfy any degree, and it should not be read as a pathway
completeness measure.

## WAF

Transfer Virginia sits behind AWS WAF, which answers a tripped bot rule with
HTTP **200** and a ~2KB JavaScript challenge page. Treating that as content is
the worst failure mode available here — the parser finds no table and the corpus
quietly claims the course has no equivalencies. `isBotChallenge()` detects it,
never caches it, and counts it separately; the import prints the blocked count.
An earlier crawl in this project cached 406 such pages before this check existed.
