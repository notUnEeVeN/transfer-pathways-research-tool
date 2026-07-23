# California Figure 5 — course barriers

> Current paper-matched data · 9 UC campuses × 72 community college districts ·
> July 22, 2026

## The short version

Figure 5 asks, for each course a UC campus requires for CS transfer admission:
**what share of the 72 community college districts has no course that
articulates to it?** Six panels, one per course category; a gray bar means the
campus does not require that course at all.

The port reproduces the published figure exactly, then recomputes it on
current agreement data. **28 of the 32 required campus–course cells are
identical to the paper.** Four cells improved by exactly one district each, and
those four are the same three districts that moved in the Figure 2, 3 and 4
ports — Allan Hancock, Santa Barbara, and West Valley–Mission — because a
course they were missing has since been articulated.

Nothing got worse: no cell gained a missing district.

## Verdict (detail)

| Panel | Campus | Paper | Current | District that resolved |
| --- | --- | ---: | ---: | --- |
| Calculus | UC1* (UC Davis) | 5.6% (4) | 4.2% (3) | West Valley–Mission CCD |
| Intro Programming | UC1* (UC Davis) | 31.9% (23) | 30.6% (22) | Santa Barbara CCD |
| Intro Programming | UC4* (UC Santa Barbara) | 19.4% (14) | 18.1% (13) | Allan Hancock JCCD |
| Data Structures | UC4* (UC Santa Barbara) | 27.8% (20) | 26.4% (19) | Allan Hancock JCCD |

Every other cell — all nine Calculus bars but Davis, the remaining six Intro
Programming bars, Data Structures at UC2/UC3, all five Advanced Math bars, both
Computer Organization bars, and all four Discrete Math bars — matches the
published percentage to the printed decimal, and matches district-for-district,
not just in total.

The interactive visual opens on current data with the same controls as the
Figure 2–4 ports: switch to **Paper baseline** for the published chart, or turn
on **Show differences** to see the signed point change above each bar (green =
fewer districts missing; magenta = more). Controls stay out of PNG/PDF exports.

## What each bar means, and how both versions compute it

The legacy implementation is
`question_2-3/district-level/course_analysis.py`, function
`create_all_course_graphs`, with the category rules in `helper.py`:

- A **course category** is assigned by matching the curated requirement
  group id against an ordered pattern list, first match wins:
  Calculus `calc`; Intro Programming `intro`, `program`; Data Structures
  `data`, `struct`; Advanced Math `linear`, `differential`; Computer
  Organization `organ`, `system`, `computer`; Discrete Math `discrete`.
  That ordering is load-bearing — `LinearAlgebraAndDifferentialEqations` is
  Advanced Math, `MultivariableCalc` and `VectorCalc` are Calculus.
- A **campus requires** a category when any of its curated transfer-minimum
  groups falls in it; otherwise the bar is gray.
- A **district counts as missing** a category when ANY group in that category
  is unsatisfied there. A group is satisfied when at least one of its
  alternative sets is fully articulated; when no set is complete, the group
  fails. This is the same group/set rule the district heatmap uses.
- The denominator is all 72 districts, not just the ones that require or offer
  the course.

The port applies that operation to the internal tool's canonical-CS coverage
rows (`majorSlug=cs`, `requirements=paper`, `groupBy=district`) — the same rows
behind Figures 2, 3 and 4. The server now returns a per-group verdict
(`requirement_groups: [{ group_id, satisfied, … }]`) with each row, so the
course panels read the heatmap's own evaluation rather than running a second
articulation model.

The **Paper baseline** view is transcribed, not recomputed: the percentages
printed on the published figure are stored verbatim in
`frontend/src/analyses/paperCourseBarriersBaseline.js`. Every printed value is
an exact multiple of 1/72, so the district counts behind them are unambiguous.

## The four differing cells, with receipts

In each case the paper's own district CSV records the course as
`Not Articulated`, and current ASSIST data has an articulation for it.

### Calculus — UC Davis × West Valley–Mission CCD

The paper's CSV row is `Not Articulated,UCD,Calc3,A,1,MAT 021C`. Davis requires
MAT 021A/B/C; the district had the first two only. Now West Valley College's
MATH 004A (Intermediate Calculus) articulates MAT 021C, and Mission College's
MAT 003A + 003B + 004A set covers all three. Calculus at Davis is therefore
complete for the district.

### Intro Programming — UC Davis × Santa Barbara CCD

The paper's CSV row is `Not Articulated,UCD,Intro2,A,1,ECS 036B`; ECS 036A was
already articulated via Santa Barbara City College's CS 137/CS 140. Current
data adds the CS 105 + CS 106 + CS 137/CS 140 combination, which articulates
both ECS 036A and ECS 036B, closing the group.

### Intro Programming — UC Santa Barbara × Allan Hancock JCCD

The paper's CSV row is `Not Articulated,UCSB,Intro,A,1,CMPSC 16`. Allan Hancock
College's CS 111 (Fundamentals of Programming 1) now articulates CMPSC 16.

### Data Structures — UC Santa Barbara × Allan Hancock JCCD

The paper's CSV row is `Not Articulated,UCSB,DataStructures,A,1,CMPSC 24`.
Allan Hancock College's CS 112 (Fundamentals of Programming 2) now articulates
CMPSC 24.

## Why we're confident these are real

1. **The paper's own pipeline was re-run.** Executing
   `count_transfer_options` + `categorize_group_id` over the legacy
   `district_csvs/` reproduces the published counts exactly — 4, 23, 14 and 20
   districts for the four cells above, and the same totals for the other 28
   cells. The category mapping and the group/set rule used by this port are
   therefore the paper's, not an interpretation of them.
2. **The comparison is district-level, not just totals.** All 32 required cells
   were diffed as sets of district names. Four sets differ by exactly one
   district; 28 are identical; no district was added to any cell.
3. **The movers are consistent across figures.** Allan Hancock, Santa Barbara
   and West Valley–Mission are precisely the three districts that gained a
   fully articulated campus in the Figure 2 heatmap, moved a bin in the Figure
   3 histogram, and gained a campus count on the Figure 4 map. The course-level
   receipts here name the exact courses behind those cell gains.
4. **Both directions were checked.** A resolved gap and a new gap are
   symmetric in the diff; only resolutions appeared.

## Anticipated questions

**Why does UC2 (Merced) show an Intro Programming bar when the paper's text
says it requires only Data Structures?** The published figure does show a 6.9%
Intro Programming bar at UC2, and Merced's curated minimums include CSE 022.
The baseline view transcribes the figure; the discussion sentence in the paper
appears to overstate the point.

**Why is UCI's `Programming` group in the Intro Programming panel?** The
paper's pattern list assigns it there (`program`), and UCI's Data Structures
panel is gray as a result. The port does not second-guess the categorization.

**Does a campus with zero missing districts disappear?** No. It renders as a
white hatched full-height bar labeled 0.0%, exactly as the paper's renderer
does. No such bar exists in either version today.

## Reproduce locally

From `analysis/`:

```bash
.venv/bin/python -m visuals.paper_course_barriers --output-dir results/previews
```

This writes paper, current, and current-difference previews. Publishing the
same entry point exposes the version selector and difference toggle in the
Visual Library.

To re-check against the paper's own code, from the legacy repository's
`question_2-3/district-level/` directory, run `course_analysis.main()` and
compare `per_course_analysis/all_courses_relative.png` with the baseline view.
