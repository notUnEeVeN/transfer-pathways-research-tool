# ARTSYS (Maryland) importer

Converts Maryland's ARTSYS Program Transfer Guides into documents shaped exactly
like the ASSIST corpus, so `services/analysis/eligibility.js` runs over them
unmodified.

Feasibility work and the measurements behind the parser design are in
[`docs/state-expansion-feasibility.md`](../../../docs/state-expansion-feasibility.md).

## What one document is

One ARTSYS guide rendered for one sending college is one agreement — the same
primitive as an ASSIST agreement:

```
/program_transfer_guides/<guideId>?sender_university_id=<senderId>
   └── major × receiving university ──┘   └── sending community college ──┘
```

**Measured on the full corpus** (600 guides, 9,600 renderings, 2026-07-27):

| | |
| --- | --- |
| Agreements | **9,072** (567 populated guides × 16 colleges) |
| Receivers | **367,024** |
| Not articulated | **174,957 (47.7%)** |
| Courses | 33,084 — 30,660 sending, 2,424 receiving |
| Institutions | 16 colleges, **13 receiving universities** |
| Empty renderings | 528 (33 stub guides × 16) |

### Receiving-institution coverage is uneven, and that matters

ARTSYS lists 20 receiving institutions but only **13 have a populated guide**:

```
Salisbury 2,312 · UMBC 1,530 · Morgan State 1,292 · Towson 1,275
UMES 1,088 · Frostburg 799 · UMGC 544 · U Baltimore 323 · Stevenson 255
Washington College 85 · UM College Park 68 · St. Mary's 34 · Capitol Tech 34
```

- **Hood College** has ~35 guides and every one is an empty stub.
- **Bowie State, Coppin State, Goucher, Notre Dame of Maryland, and
  Mount St. Mary's** have no guides at all.

The distribution is also heavily skewed: Salisbury alone is a quarter of the
corpus and College Park — the flagship — has 68 agreements to Salisbury's 2,312.
Any cross-institution comparison has to carry that, and a statewide claim built
on this corpus is really a claim about a handful of institutions.

## Isolation

Nothing here touches `assist_*`. The Maryland corpus has its own collections and
its own id namespace, so the California figures cannot be perturbed by an import
and a combined export can never collide two states on the same integer id.

| Collection | Holds |
| --- | --- |
| `artsys_institutions` | 16 community colleges + 20 universities |
| `artsys_courses` | sending and receiving courses, split by `side` |
| `artsys_agreements` | one document per (college, university, program) |
| `artsys_import_meta` | the last import's report, at `_id: 'current'` |

Ids: `md:cc:<n>` · `md:uni:<n>` · `md:crs:<n>` (or `md:crs:h<hash>` when ARTSYS
exposes no course id) · `md:agr:<guide>:<sender>`. Every document also carries
`source: 'artsys'` and `state: 'MD'`.

## Running it

```bash
cd server
npm run artsys:audit                       # dry run over everything, writes nothing
npm run artsys:audit -- --limit 20         # quick pass
npm run artsys:audit -- --guides 3354,3480 # named guides
npm run artsys:import                      # build and install the collections
npm run artsys:refresh                     # re-fetch (new term vintage) and install
```

Pages are cached under `server/.artsys-cache/` (gitignored) and the cache never
expires on its own — a refresh is explicit, because ARTSYS updates on a term
boundary and a silent mid-run refresh would mix two vintages into one import.
Re-running after a parser change therefore costs zero requests.

ARTSYS is a public site run by a third party, not an API we have been granted.
The client holds a bounded concurrency and a delay between requests; leave them
alone unless you have a reason.

## How it is validated

A guide's **receiving** structure does not depend on which college is selected —
only the sending side changes. Every guide is therefore parsed 16 times and the
skeletons must agree. That checks the parser against the whole corpus without
anyone reading a document, and it is the reason the import can be trusted at a
scale nobody will review by hand. Guides whose skeletons disagree are reported
and, by default, block the write (`--allow-mismatch` to override).

Three further counters should stay at zero:

- `unmatched_headers` — a group header matching no known rule. The header
  vocabulary is closed and measured (17 constructs); a nonzero count means
  ARTSYS added phrasing and `quantifiers.js` needs a case.
- `unknown_sender_state` — a leaf whose sending side matches none of the five
  known renderings. A nonzero count means the markup changed.
- `count_mismatches` — a group whose header states a course count its tree
  cannot supply. Nothing can ask for 11 requirements and offer 10, so any
  nonzero value is a parse defect. **This check found every bug listed below.**

`count_mismatches` compares against what the *engine* will read, not what the
markup looks like: a group that states its own count leaves its sections
uncapped, and a category slot is repeatable, so both supply the full ask. A
group listing more than it asks for (`take 3 from these 5`) is ordinary
choose-N and is not flagged.

## The five sending-side renderings

Telling these apart is the whole job, because two of them are what make a gap
measurable at all.

| Rendering | Meaning |
| --- | --- |
| one `content-loader-modal` div | a single equivalent — the **visible button is the course**; its dialog is empty until AJAX fills it, so reading the dialog yields zero options and turns a satisfied requirement into a false gap |
| `"N equivalent courses found"` | N alternatives, listed in a populated dialog body |
| `"No equivalency found."` | **not articulated** — the measurement |
| `"N Courses for this Requirement\|Subject"` | a category slot (`Science Elective`, `ANCS Ancient Studies`); the dialog lists every qualifying course at the college. **Repeatable** — one slot can absorb a whole multi-course ask |
| `"No courses found for this Requirement\|Subject"` | a category slot the college cannot fill. Also a gap |

## Tree shape: two traps

Both were found by whole-corpus validation, not by reading guides, and both
were silently wrong in ways that produced a plausible-looking import.

1. **Branches nest.** An `orbranch` inside an `andbranch` means "complete all of
   these *and* one of those". A branch that sweeps up its descendants'
   leaves double-counts them and folds a choose-one set into the required set —
   reading one CS group as 14 requirements against a stated 11.
2. **Leaves are not always inside a branch.** A flat group renders `leaf-item`
   directly under `.reqs-container`. Walking branches alone dropped **24% of all
   receivers** while the group still displayed its header, so nothing looked
   wrong.

## Pass two: enrichment

The guide page renders the sending side as a bare label, so sending-course units
are `null` after the import. They live one level down, on the equivalency detail
modal each option already links to via `artsys_equivalency_id`.

```bash
npm run artsys:enrich -- --limit 500          # dry run, one slice
npm run artsys:enrich:apply -- --limit 500    # write it
npm run artsys:enrich:apply                   # everything remaining
```

It is a separate bounded job, not part of the import, because the equivalency
set is much larger than the guide set (9,409 distinct ids referenced by the
first ~6% of the corpus) and it is someone else's server. It shares the import's
cache, orders already-cached work first, and takes `--limit`, so it can be run
in slices over several sittings and never refetches a page.

**Measured coverage** — 96 equivalencies stratified across all 16 colleges:

| Field | Coverage | Notes |
| --- | --- | --- |
| Sending units | **100%** | this is what the pass is for; the gap closes completely |
| Catalog description | 61% | |
| Prerequisite prose | 29% | only where a description exists *and* states a rule |

**Description coverage is a property of the college, not the parser**, and it is
strongly bimodal: Frederick, Garrett and CCBC populate essentially everything;
Allegany, Baltimore City and Chesapeake publish none at all. **A college with no
descriptions will show zero prerequisites, and that is a data artifact rather
than a fact about its curriculum** — any college-level analysis using this layer
is confounded by it. `description_coverage_by_institution` is in the report for
exactly this reason. Units, the actual point of the pass, are unaffected.

Two credit figures on the modal are different quantities and are stored apart: a
4-credit college course routinely transfers as 3, so the course's own credits
land on the course document and the awarded credit on the articulation.

Prerequisite rows land in `artsys_prerequisites` as `status: 'needs_review'`
with the raw prose and the course codes it mentions. Nothing resolves them to
course ids — "a grade of C or better in CMSC 140 or consent of department" is a
curation decision, and generating it automatically would put unreviewed guesses
in the same shape as hand-verified work.

## Known limits

- **Receiving units are reliable** from the guide page; sending units require
  pass two.
- **Category slots** (`receiving.kind === 'category'`) name a requirement, not a
  course. They are kept rather than dropped so a consumer can decide whether to
  count them — about 40% of receivers in the sampled corpus.
- **Coverage is a moving target.** ARTSYS's own site lists more equivalencies and
  more guides as forthcoming, and a small number of guides are empty stubs.
- **ARTSYS is lossy.** Anything in the underlying vendor model that the HTML does
  not render is invisible to any parser. Retire that risk by spot-checking parsed
  programs against university catalogs, not by parsing more guides.
