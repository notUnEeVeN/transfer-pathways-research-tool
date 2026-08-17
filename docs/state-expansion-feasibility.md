# State expansion — survey, feasibility, and outcome

**The test:** can we get machine-manipulable data of the form
*"from this community college, to this university, for this major — take these
courses"*? Everything else is secondary. A state that has it is integrable; a
state that doesn't is not, however clean its API. And does the state record
what a college is **missing**? Negative space is what every access measure is
computed from.

Every claim below was verified by fetching the system, not from documentation.
Investigated 2026-07-27.

> ## ⚠ Outcome — read this before the recommendations below
>
> This document recommended **Maryland (ARTSYS)** and parked Virginia. **That
> decision was later reversed.** Maryland was built, then parked under
> [`deprecated/maryland/`](../deprecated/maryland/) and is not wired into the
> application. **Virginia shipped instead** and is a live state tab
> (`va_courses`, `va_requirements`, `frontend/src/virginia/`), documented in
> [`virginia-courses.md`](virginia-courses.md),
> [`virginia-degree-collection.md`](virginia-degree-collection.md), and
> [`virginia-prerequisite-qa.md`](virginia-prerequisite-qa.md).
>
> The live state set is **California, Virginia, Massachusetts**. Everything
> below is the original research record — accurate about what each state
> publishes, superseded on which one to build.

## The nine-state survey

Nine state transfer systems, all investigated by fetching them rather than
reading their documentation.

### Not pursued

| State | Source | Why not |
| --- | --- | --- |
| **Louisiana** | [Power BI course equivalency matrix](https://app.powerbi.com/view?r=eyJrIjoiMDE4OTRhYjUtMTc5ZC00ZjdhLWIxZWUtMzk5N2JhMjgyODI3IiwidCI6ImYyNWI1Y2Q1LTI3ZDItNDg2Yy1hZjhjLTU2MTU2NzVkMjU1NCJ9) · Universal Transfer Pathways PDFs | Fully extractable — we pulled all 26,748 rows across three vintages in one call — but it covers only 336 statewide common courses, of which **Computer Science is five**, with no data structures, discrete math or computer organisation. |
| **Colorado** | [cdhe.colorado.gov](https://cdhe.colorado.gov/students/attending-college/colorado-transfer) | Cleanest data to scrape of any state, but GT Pathways is general education only and CDHE states outright that it *"does not apply to… computer science."* |
| **Illinois** | [itransfer.org](https://itransfer.org/submitters/searches/) | Widest institutional coverage at 118 colleges and it even publishes a "courses NOT at this institution" report, but the major layer is a statewide recommendation of **no more than four courses**. |
| **Indiana** | [transferin.net](https://transferin.net/ways-to-earn-credit/college-courses/) | The Core Transfer Library is a course list distributed as PDFs, and the site's own notice dates the data to AY 2024-25. |
| **Ohio** | [transfercredit.ohio.gov](https://transfercredit.ohio.gov/home) | By far the best machine access — an open, unauthenticated JSON API with ~1.05M equivalency rows and 20 years of history — but no per-pair requirements (the OGTP pathways are statewide PDFs), no recorded absence, no course units, and only **42 Computer Science courses statewide** across 20 of 36 institutions. |
| **Tennessee** | [tntransferpathway.org](https://www.tntransferpathway.org/) · [tnreconnect.gov](https://tnreconnect.gov/Student/Search-for-Course-Equivalencies) | The Transfer Pathways have genuinely good requirement structure, but it is one statewide curriculum per major published as a PDF, with per-university variation confined to four footnotes. |
| **Texas** | [ACGM](https://www.highered.texas.gov/) · [texas-direct](https://www.highered.texas.gov/texas-direct/) · [tccns.org](https://tccns.org/) | The ACGM is the best course-identity document we saw anywhere (TCCNS numbers, CIP codes, prerequisites, learning outcomes) and is worth porting on its own merits, but the TCCNS matrix download is behind an institutional login and the Computer Science Field of Study is still listed as *"in progress."* |

A pattern worth noting: most of these states **centralised** articulation behind
statewide common course numbering, which by design removes the college-to-college
variation our measure is built on. That is a policy fact, not a data-quality one.

### The two finalists

**Maryland — [artsys.usmd.edu](https://artsys.usmd.edu/)** was the only system
of the nine publishing a genuine per-pair requirement tree — one document per
*(community college × receiving university × program)* — with choose-N logic,
AND/OR alternatives, and an explicit **"No equivalency found."** on every
requirement a college cannot satisfy, so absence is a published fact rather than
an inference. Its rigidity made it verifiable: because each guide renders once
per sending college, the parser could be checked against all 9,600 renderings by
asserting the receiving structure is identical across them — **zero mismatches**,
zero unmatched headers, zero fetch errors. Corpus: 9,072 agreements · 367,024
requirements · 33,084 courses · 16 colleges · 13 receiving universities. *Built,
then parked — see the outcome box above.*

**Virginia — [transfervirginia.org](https://www.transfervirginia.org/)** is the
larger and in principle cleaner system: 23 community colleges, 29 receiving
institutions including privates, both halves public, and an exact join because
guides and colleges share VCCS course numbering. The original concern was that
its guides are hand-authored WYSIWYG tables written by 60+ institutions, so
requirements are prose to be interpreted rather than read — and that some
universities put **their own course codes in the community-college column**
(George Mason writes `ENGH 101` where the VCCS course belongs; one row mixes
both as `PHY 201 & PHYS 202`). *Built and shipped — those traps were addressed
in the collection pipeline; see [`virginia-degree-collection.md`](virginia-degree-collection.md).*

### The one-line version of the survey

Ohio has the best access but no requirements; Louisiana, Colorado, Illinois,
Indiana, Tennessee and Texas publish requirements only statewide or not for
Computer Science; Maryland and Virginia are the only two that publish what a
college requires *and* what it lacks.

---

## Part 1 — What the target shape is

Our agreement document (`assist_agreements`, consumed by
[eligibility.js](server/services/analysis/eligibility.js)) is keyed on
**(sending college × receiving university × program)** and holds:

```
requirement_groups[]   is_required · group_conjunction (And/Or)
│                      group_advisement (choose N) · group_unit_advisement
└── sections[]         section_advisement (choose N) · unit_advisement
    └── receivers[]    ONE receiving course · articulation_status · receiving.units
        └── options[]  alternative satisfying sets of sending course ids
                       course_conjunction (and/or)
```

Two properties matter most:

1. **Keyed per pair.** Statewide "this is the transfer pathway for History" is a
   different object — it has no sending-college dimension, so there is nothing to
   compare across colleges.
2. **Records absence.** `articulation_status: 'not_articulated'` is what makes a
   requirement a *gap*. A positive-only equivalency list cannot distinguish "no
   articulation" from "not in the dataset."

Almost every state system fails one or both. Most are hub-and-spoke — local course
→ statewide code → guaranteed everywhere — which by design removes the
sending-college dimension entirely.

---

## Part 2 — Maryland (ARTSYS) has it. Verified end to end.

One HTTP GET is one agreement document:

```
https://artsys.usmd.edu/program_transfer_guides/3354?sender_university_id=1768
        └── major × receiving university ──┘   └── sending community college ──┘
```

= **Montgomery College → Capitol Technology University → Computer Science, B.S.**

The markup is semantic and stable (`ptg-requirement-container`, `req-header`,
`andbranch`/`orbranch`, `leaf-item`, `sender-course`, `receiving-course`). I wrote
a parser and pulled the same guide for six colleges: **29 requirements in 6 groups,
0 unparsed cells.**

| Requirement (Capitol Tech CS B.S.) | Montgomery | Allegany | Garrett | CCBC | Howard | Wor-Wic |
| --- | --: | --: | --: | --: | --: | --: |
| CS120 Intro to Programming (Python) | 1 | **X** | **X** | **X** | 1 | **X** |
| CS150 Programming in C | 7 | **X** | **X** | 2 | 2 | **X** |
| CS230 Data Structures | 2 | **X** | **X** | **X** | 1 | **X** |
| DS235 Introduction to Data Mining | **X** | **X** | **X** | **X** | **X** | **X** |
| MA124 Discrete Mathematics | 2 | **X** | **X** | **X** | 1 | **X** |
| MA261 Calculus I | 4 | **X** | **X** | 1 | 1 | **X** |
| CT406 Web Programming Languages | **X** | **X** | **X** | **X** | **X** | **X** |
| … 22 more | | | | | | |
| **Requirements satisfiable** | **23/29** | **4/29** | **4/29** | **18/29** | **25/29** | **7/29** |

Cell = number of that college's courses that satisfy the requirement.
**X** = *"No equivalency found."*, rendered explicitly by ARTSYS.

This is the phenomenon the California work measures, present in the first guide
pulled: Howard and Montgomery (affluent DC/Baltimore suburbs) reach 25 and 23 of
29; Allegany and Garrett (rural western Maryland) reach 4. Four requirements are
missing at every college — a structural gap in the program, not a college gap.

A parsed record maps onto our schema with no invention:

```json
{ "receiving": "MA124 - Discrete Mathematics", "credits": "3",
  "status": "articulated",
  "sending": ["CMSC207 - INTRO TO DISCRETE STRUCTURES", "CS256 - DISCRETE STRUCTURES"] }
```

`receiving` → `receivers[].receiving` · `credits` → `receiving.units` ·
`status` → `articulation_status` · `sending[]` → `options[].course_ids` ·
group header *"complete the following 11 requirements · 33 credits"* →
`group_advisement` + `group_unit_advisement` · `andbranch`/`orbranch` →
`group_conjunction`. AND-options exist too (`MTH1120 College Algebra AND
MTH1130 Trig and Analytic Geom` in the Frostburg guide) → `course_conjunction: 'and'`.

### Corpus size — measured, not estimated

The importer has now run over the whole corpus (600 guides × 16 senders = 9,600
renderings, 2026-07-27):

| | |
| --- | --- |
| Agreements | **9,072** |
| Receivers | **367,024** |
| Not articulated | **174,957 (47.7%)** |
| Courses | 33,084 (30,660 sending · 2,424 receiving) |
| Empty stub guides | 33 |
| Validators | skeleton mismatches **0** · unmatched headers **0** · count mismatches **0** · HTTP errors **0** |

**Receiving coverage is the real constraint.** ARTSYS lists 20 receiving
institutions; only **13 have a populated guide**. Hood College's ~35 guides are
all empty stubs, and Bowie State, Coppin State, Goucher, Notre Dame of Maryland
and Mount St. Mary's have none. The distribution is severely skewed —
Salisbury 2,312 agreements, UMBC 1,530, Morgan State 1,292 … and **University of
Maryland, College Park, the flagship, has 68**.

That reshapes what Maryland can support. It is a genuine multi-institution
corpus, but a "statewide Maryland" claim built on it is really a claim about
Salisbury, UMBC, Morgan State, Towson and UMES. Any figure comparing
institutions must carry the denominator.

- Effective terms on every guide; course-equivalency search reaches back to **Fall 1989**
- `/equivalencies/{id}?modal=true` gives per-articulation detail (units, awarded
  credit, effective terms, catalog text)

### Costs, stated plainly

- **Scraping, not an API.** `.json` 404s on every route. ~8,800 fetches at ~0.5 MB
  each. Entirely feasible; needs polite rate limiting and a parser that is
  re-validated on each refresh.
- **Commercial platform** — "Powered by Quottly", now Parchment. Read the ToS; an
  email is cheap insurance.
- **Coverage is a moving target** by the operator's own admission.
- Sending-course credit values are sometimes absent (`0 credits`); receiving-side
  credits are reliable.
- No community-college *district* structure in Maryland — any grouped analysis
  needs a substitute (county, region) that we would define and document.

---

## Part 3 — Everyone else, against the same test

| State | Per-pair requirements? | What it actually is |
| --- | --- | --- |
| **Maryland** | **Yes — verified** | 600 guides × 16 senders, explicit "No equivalency found" |
| **Virginia** | **Half — demand yes, sending college no** | **559 Transfer Guides, public HTML, no login.** Real structure per (receiving university × major), privates included. But the sending side is **VCCS-wide course numbers**, not one college's — see §3.1 |
| Ohio | No | 15,157 courses / **CS = 42 across 20 of 36 institutions**. Open JSON API, ~1.05M equivalency rows, AU2005→SM2026 with 69% carrying expiry — a fine *longitudinal gen-ed* asset, but no requirement structure (OGTP = statewide PDFs), no negatives, **no units** |
| Texas | Not yet | ACGM is the best course-identity document reviewed (TCCNS number, CIP, prose prerequisites, learning outcomes) and worth porting on its own. But TCCNS matrix download is **login-gated**, and the Computer Science Field of Study is **"in progress"** |
| Illinois | No | 118 institutions (widest coverage), and a "courses NOT at institution" report — a rare absence source. But major layer is a statewide "Common Core of **no more than four courses**". ASP.NET VIEWSTATE scraping |
| Tennessee | Statewide only | TTP CS pathway has real structure (OR-of-AND science sequences, `MATH 2010 or MATH 2050`) but is one statewide curriculum; per-university variation lives in **four footnotes**. PDF |
| Louisiana | No | Whole matrix extractable in one Power BI call (26,748 rows, 3 vintages) — but **336 common courses total, CS = 5**, no data structures / discrete math / computer organization. Pathway PDFs are statewide |
| Colorado | No | Cleanest scrape (`Courses.aspx?cat=GT-MA1` → plain tables with effective/end dates), but gen-ed only and CDHE states GT Pathways **"does not apply to… computer science"** |
| Indiana | No | Course list + PDFs; TSAP is degree-to-degree but published as documents. Site's own note: data reflects **AY 2024-25** |

### 3.1 Virginia in detail — verified without an account

`transfervirginia.org/resources?f[0]=field_cc_resource_type:37` lists **559
Transfer Guides**, each a plain server-rendered page, no login. Faceted by
receiving institution — George Mason 34, Bridgewater 28, JMU 25, Longwood 25,
CNU 15, Hollins 15, and many more including privates.

`/content/bridgewater-computer-science-bs-transfer-guide` returns a real
requirement table (Course · Credits · Course Equivalent · Notes):

```
Catalog Year 2025-2027 — Based on VCCS Curriculum for COMPUTER SCIENCE
ENG 112 or ENG 113                                       3    CL 200
BIO 101, CHM 111, PHY 241, GOL 105, GOL 106, or GOL 110   4    Scientific Study of Nature
MTH 263                                                   4    Math Req
CSC 221                                                   3    CSCI 101
CSC 208 or MTH 288                                        3    CSCI 110
CSC 222                                                   4    CSCI 102
CSC 223                                                   4    CSCI 220
Pre-Transfer Credits                                  60-62
```

Choose-1-of-6 OR groups, credit ranges, and an explicit sending→receiving course
mapping (`CSC 221 → CSCI 101`). Genuinely good demand-side structure.

**But it fails the sending-college half of the test.** The header says *"Based on
VCCS Curriculum"* and *"Complete at a Virginia Community College"* — those are
statewide VCCS numbers shared by all 23 colleges. There is one guide per
(university × major), not per (college × university × major), and no absence data.

Virginia does hold a per-college layer — the "Where Can I Take An Equivalent
Course" tool implies per-college catalogs — but it runs through Drupal
`/system/ajax` form-state POSTs rather than the clean
`index.php?q=transfer/institution/ac/{q}` JSON endpoints, so it needs session
handling.

**The derived route.** Because VCCS numbering is shared statewide, Virginia
supports a different construction of the same measure:

> demand = transfer guide (university × major) → required VCCS courses with OR-groups
> supply = per-college catalog → does *this* college teach MTH 288?
> gap    = a requirement none of whose alternatives are taught at that college

Matching is trivial (identical course numbers, no articulation ambiguity), and the
resulting gap is a "not taught" gap rather than a "not articulated" one — which is
the *fate B* concept from our own repair work, measured directly. It is a real
analysis and arguably a cleaner one, but it is **not** the ASSIST measure and
should never be labelled as such.

---

## Part 3.5 — How many documents to build an accurate parser

Measured on a 60-guide random sample (`scratchpad/md/`), decomposed into three
layers that behave completely differently.

**Layer 1 — tree skeleton. Saturates at ~3 guides.**
Across all 60 guides: exactly **2** branch classes (`andbranch` 387,
`orbranch` 324) and **3** leaf states (`single_equiv` 949, `no_equivalency` 598,
`multi_equiv_dialog` 317). Nothing else appeared. This is far more rigid than
ASSIST, whose advisement geometry had to be reconstructed from enum combinations.

A fourth leaf state exists at **~4%** (79 of 1,943): abstract category
placeholders (`Arts and Humanities Gen Ed`, `Civic and Community Engagement`)
rather than named courses — a requirement slot with no specific receiving course.
Real, and it needs handling.

**Layer 2 — quantifier grammar. Saturates at ~25 guides.** These are the only
constructs that change the computed requirement:

```
N_credits 537 · credit_range 174 · take_N_from_list 79 · at_least_N 45
select_N_courses 30 · complete_following_N 27 · complete_one_of 21
through_level 16 · sequence 9 · each_from_different 8 · lecture_and_lab 7
up_to_N 6 · take_one_of 5 · complete_all 3 · N_from_K_groups 2
from_K_different 2 · no_double_count 1
```

**17 constructs, 27 co-occurring combinations, 0.2% of group headers unmatched.**
Discovery curve: 12 constructs by guide 10, 17 by guide 25, **1 new across the
final 20 guides.** This is the same problem class as ASSIST's `NFromArea` /
`group_min_distinct_sections` / `group_max_distinct_sections`, expressed in
English instead of enums — comparable size (17 vs ~12 ASSIST enums), but with a
human having already resolved the ambiguity.

**Layer 3 — institutional prose. Never saturates, and does not need to.**
A naive feature count looks alarming (227 distinct features after 60 guides, 38
first seen in the last 10) but that is dominated by general-education *narrative
labels*, which each university invents for itself — Towson "Core 1…14", UMD
"Fundamental Studies / Distributive Studies", Frostburg "GEP:", Salisbury
"General Education Requirement:". This set grows with the **20 universities**, not
with guide count, and it is a label, not semantics. Carry it as an opaque string.

### The free validator

A guide's **receiving** structure is invariant across senders — only the sending
side changes. Confirmed on the Capitol Tech CS guide: all six colleges parsed to
the identical 6 groups / 29 receiving courses. That gives **16 independent
renderings of every requirement tree**, so any parse whose receiving skeleton
differs across senders is a bug, detected automatically with no human reading.
ASSIST had no equivalent to this.

### Recommendation

| Stage | Documents | Purpose |
| --- | --- | --- |
| Build | **~30, stratified 1–2 per receiving university** (not random — prose vocabulary is university-scoped, and a random draw over-weights Towson) | Covers the full quantifier grammar |
| Harden | **~100–150** | Long tail: category-placeholder leaves, AND-options, credit ranges, grade minima, `no_double_count`, sequences |
| Validate | **all ~9,600** — by machine, not reading | Cross-sender invariant · unmatched-header rate ≈ 0 · header credits vs sum of leaves · every guide yields ≥1 group with ≥1 leaf |

Realistic human review: **20–40 documents**, and mostly the disagreements the
invariant surfaces rather than documents chosen up front.

**The honest caveat.** ASSIST gave complete data with ambiguous semantics — more
sampling always helped. ARTSYS gives unambiguous rendering that is **lossy**:
anything in Quottly's underlying model that the HTML does not render is invisible,
and no sample size reveals it. That risk is retired by validating against
university catalogs on a handful of programs, not by reading more guides. Guides
are also versioned by effective term, so the grammar check must re-run at each
refresh.

### Correction after building it

The estimate above was right about the **header grammar** and wrong about the
**DOM shape**. Building the parser (`server/services/artsys/`) found three
defects that no amount of document-reading would have surfaced, because each one
produced output that looked entirely plausible:

| Defect | Effect | Found by |
| --- | --- | --- |
| Branches nest (`orbranch` inside `andbranch`) | choose-one alternatives folded into the required set; one CS group read as 14 requirements against a stated 11 | receiver count 32 vs 29 distinct |
| Leaves render outside any branch | **24% of all receivers silently dropped**, group headers still displayed | stated-count cross-check |
| `(Subject)` slots alongside `(Requirement)` | 221 gap signals lost to `unknown` | unknown-state counter |

All three were caught by cheap invariants run over the whole corpus, not by
sampling: the cross-sender skeleton check, an unknown-state counter, and a
semantic check that a group cannot ask for more requirements than its tree
offers. **Budget the reading for the grammar (~30 documents) and the confidence
for the invariants (all ~9,600, by machine).** A scraper whose only validation is
"I read some documents and they looked right" would have shipped all three.

---

## Part 4 — Answer and next step

**Maryland is a valid system for us to integrate.** It is the only one of the nine
that answers the question directly, and I confirmed it by extracting a real CS
program across six colleges with a clean parse and large, plausible variation.

Everything else fails the test as-is. Ohio, Illinois, Louisiana and Colorado are
course-equivalency registries with no notion of what a major requires. Tennessee,
Texas and Louisiana publish requirement structure but only statewide. Indiana is
thin and stale.

Virginia was checked and resolved (§3.1): good demand structure, 559 public
guides, but no sending-college dimension. It is a viable *second* state for a
"required course not taught here" analysis, not a substitute for Maryland.

**Do this next, in order:** *(historical — superseded by the outcome box at the
top of this document. Maryland was built and then parked; Virginia shipped.)*

1. **Harden the ARTSYS parser** and pull the full 600 × 16 grid to a staging
   collection. The parser in
   `scratchpad/ptg4.py` already handles all three leaf states
   (single equivalent / N equivalents / no equivalency); it needs AND-option
   splitting and group-advisement extraction before it is schema-complete.
3. **Read Quottly/Parchment's terms**, and email ARTSYS about bulk access — a
   sanctioned extract would remove the fragility entirely.
4. **Bank Ohio anyway.** The API is open and cheap, and the 2005–2026 expiry-preserving
   history is unique. It is not the integration target, but it is worth having.
5. **Email `tccns@tacrao.org`** about matrix access — low effort, and Texas is the
   largest system in the country if it opens up.
