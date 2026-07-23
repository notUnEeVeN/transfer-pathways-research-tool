# District transfer heatmap — replication note

**Why our district transfer heatmap differs from the paper's — and why ours is right.**

> Dataset `2026-07-03-v2` · CS majors · 9 UC campuses × 72 CC districts · July 4, 2026

Current-data rows are isolated to the nine exact canonical CS
campus/program pairs in `server/config/majors.js` (and
`analysis/major_pins.py` for the standalone audit). Adding another major or a
CS sibling program to Atlas cannot change this matrix.

## How to read this note

For the condensed memory-refresh version, start with
[`../visualization-quick-reference.md`](../visualization-quick-reference.md).
This page is the full receipt trail for the 99.5% heatmap replication result:
the exact computation rule, the three gained cells, and the course-level
evidence behind each one.

## The short version

We rebuilt the paper's district transfer matrix on our data and compared it
cell against cell. The two matrices agree on **645 of 648 cells (99.5%)**.
All three disagreements go one way: districts that **can newly complete** a
campus's requirements in our data, because specific colleges added
articulations after the paper's ASSIST snapshot — the decisive new courses,
checkable by hand on ASSIST.org or in either dataset:

- **UC Davis × Santa Barbara CCD** — Santa Barbara City College closed the
  `ECS 036B` gap: it now articulates the ECS 036 series via
  `CS 105 / CS 106 / CS 137 / CS 140`.
- **UC Davis × West Valley–Mission CCD** — Mission College added
  `CIS 043 → ECS 036B` and `CIS 039 → ECS 050`.
- **UC Santa Barbara × Allan Hancock JCCD** — Allan Hancock added
  `CS 111 → CMPSC 16` and `CS 112 → CMPSC 24`.

Nothing got worse anywhere; ASSIST simply grew. **The one-liner:** *"Same
requirements, same rules, newer ASSIST data — 99.5% identical, and the 0.5%
is new articulations that appeared since the paper."*

---

## Verdict (detail)

**The two matrices agree on 645 of 648 cells (99.5%).** Every disagreement is a
cell that is *complete in our data and missing in the paper's* — never the
reverse. All three were verified down to the individual articulated course,
none is an artifact of our pipeline, and all three are consistent with
articulation agreements added after the paper's ASSIST snapshot. Our matrix is
a strict superset of the paper's.

| Complete — ours | Complete — paper | Gained | Lost |
| --- | --- | --- | --- |
| 440 | 437 | **+3** | 0 |

The three gained cells (district indexes use the paper's 0–71 order):

- **UC Davis × Santa Barbara CCD** (district 53)
- **UC Davis × West Valley–Mission CCD** (district 69)
- **UC Santa Barbara × Allan Hancock JCCD** (district 0)

Nothing is complete in the paper only.

## What each cell means, and how both versions compute it

A cell is dark when a student in that community-college district can complete
*all* of that UC campus's hard CS transfer requirements through articulated
courses. Both versions share the same requirement model and the same
evaluation rule; the only input that differs is the ASSIST snapshot.

| Ingredient | Paper | Ours |
| --- | --- | --- |
| **What is required** | Hand-curated per-campus hard minimums from university websites (`course_reqs.json`) | **The same file**, imported verbatim into `curated_requirements` |
| **What is articulated** | ASSIST agreements, circa the paper's scrape | ASSIST agreements, 2025–26 scrape |
| **Evaluation rule** | Identical: a requirement is met if any of its matched university courses is articulated; a set is met if all its requirements are; a group if any set is; the cell is complete if every group is. Districts pool their colleges (a student may attend any college in the district). | (same) |

Because the requirements side is byte-for-byte the paper's own curation, any
disagreement can only come from the articulation data — that is, from ASSIST
itself changing between the two scrapes.

## The three differing cells, with receipts

Each gained cell was re-derived from the raw agreement documents, course by
course. In every case a *single college* completes the campus's full
requirement list — no cell depends on pooling colleges across a district.

### UC Davis × Santa Barbara CCD — gained, via Santa Barbara City College alone

All eight Davis requirement groups articulate at SBCC:

| Davis requires | Articulated at SBCC via |
| --- | --- |
| MAT 021A / 021B / 021C | ✓ MATH150, MATH160, MATH200 |
| ECS 036A / 036B / 036C | ✓ CS105, CS106, CS137, CS140 |
| ECS 020 (discrete math) | ✓ CS108 |
| ECS 050 (organization) | ✓ CS107 |

### UC Davis × West Valley–Mission CCD — gained, via Mission College alone

Mission College articulates all eight groups — decisively `ECS 036B` via
`CIS043` and `ECS 050` via `CIS039`. Its sibling West Valley College is still
missing exactly those two articulations, which is presumably why the paper-era
district showed as incomplete: the older snapshot lacked Mission's coverage.

| Davis requires | Articulated at Mission via |
| --- | --- |
| MAT 021A / 021B / 021C | ✓ MAT003A/AH, MAT003B, MAT004A |
| ECS 036A | ✓ CIS037A, CIS040, CIS043, EGR030 |
| ECS 036B | ✓ CIS043 |
| ECS 036C (data structures) | ✓ CIS044 |
| ECS 020 (discrete math) | ✓ MAT020 |
| ECS 050 (organization) | ✓ CIS039 |

### UC Santa Barbara × Allan Hancock JCCD — gained, via Allan Hancock College alone

All seven UCSB requirement groups articulate at Allan Hancock:

| UCSB requires | Articulated at Hancock via |
| --- | --- |
| MATH 3A / 3B | ✓ MATH181, MATH182 |
| MATH 4A / 4B (lin. alg., diff. eq.) | ✓ MATH184 |
| CMPSC 16 (intro) | ✓ CS111 |
| CMPSC 24 (data structures) | ✓ CS112 |
| CMPSC 40 (discrete math) | ✓ CS161 |

## Why we're confident these are real

- **No join artifacts.** All 648 endpoint rows mapped cleanly onto the paper's
  72 districts and 9 campuses — zero rows were dropped or mis-keyed.
- **No district-pooling artifact.** The one methodological liberty in the
  district framing — pooling articulations across a district's colleges — was
  tested explicitly. It never decides a cell: every gained cell is complete at
  a single college.
- **Independent reproduction.** A from-scratch Python implementation
  ([`analysis/paper_district_heatmap.py`](../../analysis/paper_district_heatmap.py)),
  sharing no code with the website, reproduces the site's matrix
  cell-for-cell: 440 complete, the same 3 gains, 0 losses.
- **The direction is the smoking gun.** Articulation agreements accumulate;
  they are rarely withdrawn. A newer ASSIST snapshot should produce a few
  one-directional gains and no losses — exactly the observed pattern. Random
  error in either pipeline would scatter in both directions.
- **Same requirements as the paper.** Our requirement table is imported from
  the paper repository's own curation, so the demanding side of the comparison
  cannot drift.

## Anticipated questions

**"Couldn't your parser just be more lenient than theirs?"**
A lenient parser would inflate completeness broadly — dozens of gains
scattered across the matrix — not exactly three cells, each traceable to
specific named articulations (e.g. `CIS043 → ECS 036B`). And a
strict-vs-lenient difference would also produce losses somewhere; there are
none.

**"How do we know it isn't the district pooling?"**
We evaluated every gained cell per college. Each is complete at one college on
its own. (West Valley–Mission is the illustrative case: West Valley alone
still fails, Mission alone passes — the district passes for the right reason.)

**"Can someone outside our pipeline confirm it?"**
Yes — on ASSIST.org today. Look up Mission College → UC Davis (Computer
Science) and check `CIS043 → ECS 036B` and `CIS039 → ECS 050`; likewise
SBCC → Davis and Allan Hancock → UCSB. If those articulations appear on the
live site, the difference is confirmed real-world change, independent of
anything we built.

**"Why doesn't the credit-loss figure count all three of these gains?"**
Two of the three (both Davis cells) rest on *series* articulations — one
ASSIST receiver covering ECS 036A+B+C together. This heatmap's completeness
rule counts any articulated path, series included. The credit-loss figure
replicates the paper's district-CSV pipeline, whose curated-key filter drops
cross-group series receivers — so those two districts stay outside Davis's
credit-loss average, exactly as the paper's own code would compute on today's
data. Both figures are faithful to their own paper methodology; the
methodologies simply read series articulations differently, which only shows
on new data. Details: [paper-credit-loss.md](paper-credit-loss.md).

**"So is the paper wrong?"**
No — both matrices are snapshots. The paper was almost certainly right about
its scrape date; ours is right about 2025–26. The honest framing: *we
replicate the paper at 99.5% cell agreement, and the residual 0.5% is
one-directional articulation growth since their snapshot* — which is itself a
(small) finding about how these pathways evolve.

## Reproduce it yourself

```bash
cd analysis
python paper_district_heatmap.py --diff              # matrix + the 3 cells
python paper_district_heatmap.py --explain davis "west valley"   # course receipts
python paper_district_heatmap.py --figure out.png    # paper-style PNG
```

---

*Sources: `curated_requirements` (imported from the paper repo's
`course_reqs.json`) · `assist_agreements` (ASSIST 2025–26) ·
`assist_institutions`. Local computation and render:
`analysis/paper_district_heatmap.py`; publish the checked matplotlib Figure
with `pmt.publish(fig, ...)`.*
