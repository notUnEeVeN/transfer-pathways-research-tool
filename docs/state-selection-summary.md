# State selection — what we looked at and why we chose Maryland

Nine state transfer systems from the original list, all investigated by fetching
them rather than reading their documentation. Full detail in
[`state-expansion-feasibility.md`](state-expansion-feasibility.md).

**The test:** does the state publish machine-readable data of the form
*"from this community college, to this university, for this major, take these
courses"* — and does it record what a college is **missing**? Negative space is
what every access measure is computed from.

## Not pursued

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

## Chosen — Maryland

[artsys.usmd.edu](https://artsys.usmd.edu/)

ARTSYS is the only system of the nine that publishes a genuine per-pair
requirement tree — one document per *(community college × receiving university ×
program)* — with choose-N logic, AND/OR alternatives, and, critically, an
explicit **"No equivalency found."** on every requirement a college cannot
satisfy, so absence is a published fact rather than something we infer.

Its rigidity is what made it trustworthy: sending and receiving courses are
separate structured fields that cannot be confused, and because each guide is
rendered once per sending college, we could check the parser against all 9,600
renderings by asserting the receiving structure is identical across them —
which returned **zero mismatches**, along with zero unmatched headers and zero
fetch errors.

Corpus: **9,072 agreements · 367,024 requirements · 33,084 courses · 16 colleges
· 13 receiving universities.** Imported locally and wired into the console
behind its own Maryland tab.

## Investigated but not pursued — Virginia

[transfervirginia.org](https://www.transfervirginia.org/)

Virginia is the larger and in principle cleaner system — 23 community colleges,
29 receiving institutions including privates, both halves public, and an exact
join because guides and colleges share VCCS course numbering — and we built a
working scraper for it that reaches 97.3% row coverage. But its guides are
hand-authored WYSIWYG tables written by 60+ institutions, so every requirement
is prose that has to be interpreted rather than read, and the parsing threw up
five separate traps that each produced a plausible-looking wrong number instead
of an error.

The decisive one is not fixable by better parsing: some universities put **their
own course codes in the community-college column** (George Mason writes
`ENGH 101` where the VCCS course belongs, and one row mixes both systems as
`PHY 201 & PHYS 202`), which destroys the exact-join advantage and would need a
per-guide editorial decision about which to correct and which to exclude.
Virginia also offers no equivalent of Maryland's cross-rendering check, so there
is no way to bound the errors we have not yet found.

Parked with its scraper, tests and cached corpus in
[`deprecated/virginia/`](../deprecated/virginia/README.md) — resuming is about a
day's work if Maryland turns out too small.

## The one-line version

Ohio has the best access but no requirements; Louisiana, Colorado, Illinois,
Indiana, Tennessee and Texas publish requirements only statewide or not for
Computer Science; Virginia has the data but in a form that has to be interpreted
at every step; **Maryland publishes what a college requires and what it lacks,
in a structure rigid enough to verify.**
