# Massachusetts Figure 2 — course-type coverage, on California data

> Current data · 9 UC computer science degree templates × 115 community
> colleges · July 22, 2026

## The short version

The MA paper's Figure 2 asks: of the courses a computer science bachelor's
degree requires, **what share can be taken at a community college — and does
the answer depend on what kind of course it is?** Their answer was that it
does, sharply: 22% of required *computing* courses had an equivalent, against
60% math, 93% science and 76% non-STEM. Transfer credit comes from everything
except computing.

California says the same thing, more starkly. The figure has a **Requirements
counted** toggle, because the answer depends on whether coursework a community
college cannot legally teach counts against it:

| Course type | Whole degree (default) | Lower-division only | MA paper |
| --- | ---: | ---: | ---: |
| Computing | **11.4%** | 47.4% | 22% |
| Math | **79.9%** | 83.9% | 60% |
| Science | **87.4%** | 91.1% | 93% |
| Non-STEM | **78.2%** | 100% | 76% |

The figure opens on the whole degree, which is the MA paper's question: how
much of the bachelor's can be finished before transferring. Read the
lower-division view when the question is articulation quality instead. Counting
upper-division work suppresses the computing column for a reason that has
nothing to do with articulation — a computer science degree's upper division is
computer science, so the same pattern would appear in any state, and a
mathematics degree would show it in math. Restricted to lower-division
coursework, where all four types can be taught at a community college,
computing still articulates at roughly half the rate of math. That gap is the
finding; the whole-degree number is the headline.

**This is a recreation, not a port.** The MA authors' code and data are not
available to us, so there is no paper-baseline view to switch to and no
difference view — one state only. The two columns above are not like-for-like
(see *Where this differs from theirs*), so read the shape, not the gap.

## What one point is

One point per UC campus per course type: the share of that campus's degree
requirements of that type that have a community college equivalent, averaged
over all 115 community colleges. The default scope counts every requirement in
the template. The lower-division scope keeps only the transferable and breadth
tiers, dropping upper-division and residency work that is never satisfiable at
a community college. The black diamond is the mean of the points
in the column — an average of campuses, not of the 1,035 campus–college pairs,
matching the MA figure's per-four-year points.

A campus that requires nothing of a type contributes no point — the mechanism
that leaves the MA figure's Non-STEM column shorter than its neighbours. In the
current California data every campus requires all four types, so all four
columns carry nine points.

## Per-campus values

| Campus | Comp slots | Math | Sci | Non-STEM | Comp % | Math % | Sci % | Non-STEM % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| UC Berkeley | 5/10 | 5/5 | 3/3 | 5/12 | 9.2 | 78.6 | 94.8 | 41.7 |
| UC Davis | 2/16 | 5/5 | 1/1 | 5/9 | 6.3 | 94.1 | 100.0 | 55.6 |
| UC Irvine | 9/26 | 5/5 | 3/3 | 11/11 | 13.9 | 57.7 | 100.0 | 99.8 |
| UC Merced | 4/14 | 6/6 | 7/7 | 5/7 | 19.6 | 77.8 | 78.8 | 71.4 |
| UC Riverside | 4/20 | 7/9 | 5/6 | 7/10 | 14.5 | 73.0 | 81.6 | 70.0 |
| UC San Diego | 6/24 | 5/6 | 1/1 | 12/14 | 7.1 | 76.4 | 100.0 | 85.7 |
| UC Santa Barbara | 4/20 | 7/7 | 5/6 | 12/12 | 12.9 | 83.2 | 83.3 | 100.0 |
| UC Santa Cruz | 4/15 | 6/6 | 2/2 | 12/13 | 11.7 | 85.4 | 50.0 | 92.3 |
| UCLA | 5/26 | 7/7 | 5/5 | 7/8 | 7.7 | 92.7 | 98.4 | 87.5 |

Slots read *lower-division / whole degree*; percentages are the plotted points
in the default whole-degree scope. The same table under the lower-division
scope reads 18.4 (Berkeley), 50.4 (Davis), 40.2 (Irvine), 68.5 (Merced), 72.6
(Riverside), 28.4 (San Diego), 64.3 (Santa Barbara), 43.9 (Santa Cruz) and 40.0
(UCLA) for computing, with Non-STEM at 100% everywhere.

Two things stand out in the lower-division view. Berkeley requires ten
computing slots but only five are lower-division, and just 18.4% of those
articulate — the worst in the system. Riverside and Merced, whose lower-division
computing requirement is four slots, clear 68%.

## Where the data comes from

The denominator is the curated `kind: degree` requirement template for each
campus — the same nine templates behind the MA Figure 1 port
(`coverage-heatmap`), including general education and including the
upper-division work that no community college can offer. Equivalency is the
same evaluation that figure uses: ASSIST articulation for major preparation,
the college's own IGETC-tagged catalog for GE areas, and American History &
Institutions assumed satisfiable everywhere.

The server returns the per-type split alongside the existing totals as
`degree_requirements_by_course_type`, so the four types always re-sum to the
slot totals the heatmap shows. Nothing is recomputed in the figure.

## How a requirement gets its type

The MA rule is "allocate the courses into the categories based on the course
codes at the Four Years — with the exception of Discrete Math, which we
categorized always as math, despite some variation". Applied to the UC side
(`server/services/courseTypes.js`):

1. **A requirement that names a university course** is typed by that course's
   catalog prefix. Computing: CS, CSE, ECS, CMPSC, COM SCI, COMPSCI, I&C SCI,
   IN4MATX, EECS, COGS, ICS. Math: MATH, MAT, STAT, STATS, PSTAT, AM. Science
   (engineering included, as in MA): PHYS/PHYSICS/PHY, CHEM/CHE, BILD, BIOL,
   BIOLOGY, MCELLBI, ASTRON, BIS, ENGR, EE, ECE, EC ENGR, MAE, ME, NANO, ENSC,
   BIEN, ESM. Anything else is Non-STEM, which is the right default for the
   writing and humanities codes in these templates (WCWP, ENGLISH, LING).
2. **Discrete math overrides the prefix**: UC San Diego's CSE 20 and UC Santa
   Barbara's CMPSC 40 are math, not computing.
3. **A cross-listed code resolves to its computing side** — UC Riverside's
   EE/CS 120A is computing.
4. **A requirement's own title decides it, not its commentary.** Only the text
   before an em dash or parenthesis is matched first, so UC Irvine's "Science &
   Technology — 3 courses ... outside Engineering/ICS/Economics/Mathematics"
   is science rather than computing.
5. **Requirements stored as free text** — upper-division blocks, elective
   pools, GE areas — have no code to read, so an ordered rule list types them.
   First match wins:

   | Order | Matches | Type |
   | --- | --- | --- |
   | 1 | discrete math / discrete structures | Math |
   | 2 | upper-division major or elective coursework, major field / technical / systems / theory-abstraction electives, applications of computing, project in computer science | Computing |
   | 3 | writing, composition, disciplinary communication, ethics | Non-STEM |
   | 4 | humanities, social science/analysis, arts, literature, history, culture, breadth, perspectives, ethnicity | Non-STEM |
   | 5 | unrestricted electives, additional upper-division units, Cal-GETC, "GE:" | Non-STEM |
   | 6 | a computing course code, software, algorithm, compiler, operating system, comput* | Computing |
   | 7 | probability, statistics, math | Math |
   | 8 | a science code, physics, chemistry, biology, life science, scientific, engineering, lab | Science |

Rule 2 sits above rule 3 deliberately. UC Irvine stores its whole
upper-division major as one 17-slot block whose title mentions that one of the
courses (I&C SCI 139W) also satisfies upper-division writing; without that
ordering the entire CS major would land in Non-STEM. The reverse case is
preserved: UC Santa Cruz's "Disciplinary Communication (DC) — CSE 115A, CSE
185E" is a communication requirement satisfied by a CS course, and stays
Non-STEM.

These free-text rules are the only judgment in the figure. Every campus's full
slot-by-slot assignment can be printed with the reproduce command below.

## Where this differs from theirs

- **General education is in our denominator; it was not in theirs.** The MA
  paper "included degree and college requirements but excluded general
  education". Ours is the whole modeled degree, so our Non-STEM column measures
  something broader — writing, breadth and unrestricted electives, essentially
  all of which articulate, which is why that column goes to a flat 100% line
  under the lower-division scope. Non-STEM here is a course type, not a GE
  bucket.
- **Their 22% computing is the whole-degree measure**, so it compares to our
  11.4%, not to the 47.4% lower-division figure.
- **Their unit of aggregation was 11 four-years × 15 community colleges; ours
  is 9 campuses × 115 colleges.** More colleges per point makes our points
  smoother, so the vertical spread within a column is narrower than theirs by
  construction.
- **Their equivalency came from three hand-assembled sources** (the A2B
  database, four-year websites, and the MassTransfer equivalency database);
  ours is ASSIST plus the college's own GE tagging.
- **UC computer science majors are large and heavily upper-division**, which is
  what the whole-degree scope mostly measures. UC Irvine is the clearest case:
  26 computing slots, 17 of them one upper-division block that nothing at a
  community college can satisfy.

## Reproduce locally

From `analysis/`:

```bash
.venv/bin/python -m visuals.ma_course_type_spread --output-dir results/previews
```

To print the slot-by-slot type assignment behind the figure, from `server/`:

```bash
node scripts/printCourseTypes.js
```
