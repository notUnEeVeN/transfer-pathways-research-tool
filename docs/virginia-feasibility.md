# Virginia (Transfer Virginia) — measured feasibility

Discovery for a second-state build alongside Maryland. Everything below was
verified by fetching the site, not from documentation. Companion:
[`state-expansion-feasibility.md`](state-expansion-feasibility.md).

Investigated 2026-07-28.

> **Outcome:** Virginia was subsequently built and shipped as a live state tab;
> Maryland was parked under [`deprecated/maryland/`](../deprecated/maryland/).
> This document is the original discovery record. Current Virginia docs:
> [`virginia-courses.md`](virginia-courses.md),
> [`virginia-degree-collection.md`](virginia-degree-collection.md),
> [`virginia-prerequisite-qa.md`](virginia-prerequisite-qa.md).

## The shape of the data

Virginia publishes the two halves **separately** and does not join them. That is
the difference from Maryland, where ARTSYS renders demand × supply per college
and prints the negative itself.

| | Source | Status |
| --- | --- | --- |
| **Demand** | 559 Transfer Guides at `/content/<slug>` | public HTML, no login |
| **Supply** | `/courses?query=…`, Solr with an `institutionName` facet | public HTML, no login |
| **Join** | — | **we build it**, exact on VCCS course number |

### Demand: the guides

`/resources?f[0]=field_cc_resource_type:37` paginates 28 pages; **544 distinct
guide slugs** enumerate cleanly. The facet reports 559 (the remainder are
non-guide resources caught by the same type).

Each guide is a Drupal node whose body holds **two hand-authored tables**:

```
TABLE 1  "Complete at a Virginia Community College" | Credits | Course Equivalent | Notes
TABLE 2  "Complete at <University>"                 | Credits | Notes
```

Table 1 is the transferable lower-division block — the part we need. Table 2 is
post-transfer coursework and is out of scope.

Sampled 14 guides at random across CNU, George Mason, Hollins, JMU, Norfolk
State, Radford, UMW, UVA, VCU, W&M:

- **14 of 14** had exactly 2 tables and 4 columns in table 1
- Only **two** header phrasings: *"Complete at a Virginia Community College"* (11)
  and *"Community College Course"* (3)
- 15–23 rows each

For hand-authored WYSIWYG tables that is far more regular than expected.

### The real risk: the sending column is prose

251 requirement rows across the sample, classified:

| Pattern | Count | Example |
| --- | ---: | --- |
| single course | 71 | `ENG 111` |
| code + inline title | 68 | `ENG 111 College Comp I` |
| A or B | 52 | `SDV 100 College Success Skills or 101 Orientation` |
| `Any <category>` | 33 | `Any UCGS History` |
| comma list + or | 26 | `Any UCGS Art, Humanities, or Literature` |
| A and B | 1 | `HLT 241 …; HLT 110 …` |

This is natural language written by 60+ institutions, not a structured field.
Several shorthands have to be decided rather than read:

- `SDV 100 or 101` — prefix carries to the second number
- `GOL 105/106/110` — slash-separated alternatives
- `MTH 161+162` — a required pair, not a choice
- `Any UCGS History` — a category slot, not a course
- `(PHI 220 recommended)` — parenthetical advice, not a requirement

The reliable anchor is the VCCS course code regex; the semantics around it need
a grammar module the way Maryland needed `quantifiers.js`. **Budget the parser
work here, not on table extraction.**

## What Virginia would give you that Maryland does not

- **23 community colleges** (Maryland 16) and **60+ receiving institutions
  including privates** (Maryland: 13 with populated guides).
- **An exact join.** Guides are written in VCCS numbers and the colleges use
  those same numbers, so "does this college offer CSC 223" is a lookup, not an
  inference. No equivalency table of unknown completeness, no fuzzy matching.
  Methodologically cleaner than Maryland *and* than California.
- **State-run**, not a commercial vendor — no ToS question, no platform
  migration risk.
- Both halves public with no account.

## What it cannot give you

**A Virginia gap means "this college does not teach the course."** It is not an
articulation gap, because statewide VCCS numbering means there is no negotiated
articulation to measure. Maryland's gap means "no equivalency exists."

Both are real barriers and the Virginia one is arguably more fundamental — a
college that does not teach Data Structures blocks the student regardless of
policy. But they are **different variables and must not be pooled**. It maps
onto the project's existing *fate C / not taught* concept, not onto
*not articulated*.

Virginia also publishes **no per-college requirement variation**: one guide
serves all 23 colleges. All variation lives in the supply side.

## Build estimate

| Piece | Assessment |
| --- | --- |
| Guide enumeration | solved — 544 slugs, 28 pages |
| Table extraction | low risk — 2 header phrasings, 4 columns |
| **Row grammar** | **the work** — prose, ~6 patterns, needs a quantifiers-style module |
| Supply scraper | Solr facet pagination, second scraper |
| Join + transform | straightforward once both sides parse |

Comparable to Maryland overall, with effort shifted from DOM archaeology to
language parsing, plus a second scraper. The Maryland architecture transfers
directly: fetch/parse/transform split, on-disk cache, structural validators,
`virginia_*` collections with a `va:` id namespace, its own route mount and
frontend folder.

**The validator to build first.** Maryland's cross-sender skeleton invariant has
no Virginia analogue (one guide, one rendering), so the equivalent safety net is
a *coverage* check: every extracted row must yield either ≥1 resolvable VCCS
course code or an explicit category slot. Any row producing neither is a parse
miss and must be reported, not silently dropped — the failure mode here is a
requirement quietly vanishing, which would make every college look better than
it is.
